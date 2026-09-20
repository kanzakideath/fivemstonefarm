"""Stage, verify, publish, or emergency-redraft the FishingPilot 0.7.4 release."""

from pathlib import Path
import hashlib
import io
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile


ROOT = Path(__file__).resolve().parent.parent
VERSION = "0.7.4"
PREVIEW = VERSION + "-preview"
EMBEDDED_REPORT = "build-verification.json"
PACKAGE_REPORT = f"FishingPilot-{VERSION}-package-verification.json"
TAG = "fishingpilot-v" + PREVIEW
REPOSITORY = "kanzakideath/fivemstonefarm"
API = "https://api.github.com/repos/" + REPOSITORY
ASSET_API_PREFIX = API + "/releases/assets/"
ASSET_REDIRECT_HOSTS = {
    "objects.githubusercontent.com",
    "release-assets.githubusercontent.com",
}
PAYLOAD = ROOT / "artifacts" / "fishing074-download"
STATE = ROOT / "artifacts" / "fishing074-release"
RELEASE_STATE = STATE / "draft-release.json"
VERIFIED_STATE = STATE / "draft-verified.json"
TOKEN = os.environ.get("GH_TOKEN", "")
COMMIT = os.environ.get("GITHUB_SHA", "")


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def headers(accept="application/vnd.github+json"):
    require(TOKEN, "GH_TOKEN is required")
    return {
        "Authorization": "Bearer " + TOKEN,
        "Accept": accept,
        "User-Agent": "FishingPilot-074-release",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def request_json(path, data=None, method=None):
    body = None if data is None else json.dumps(data).encode("utf-8")
    request = urllib.request.Request(
        API + path,
        data=body,
        method=method,
        headers={**headers(), "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.load(response)


def upload(url, data):
    request = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={**headers("application/vnd.github+json"), "Content-Type": "application/octet-stream"},
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        return json.load(response)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, file, code, message, headers, new_url):
        return None


NO_REDIRECT = urllib.request.build_opener(NoRedirect())


def asset_bytes(asset, limit):
    url = str(asset.get("url", ""))
    require(
        url.startswith(ASSET_API_PREFIX)
        and url[len(ASSET_API_PREFIX) :].isdigit(),
        "Unexpected GitHub asset API URL",
    )
    authenticated = True
    for _ in range(6):
        request_headers = (
            headers("application/octet-stream")
            if authenticated
            else {
                "Accept": "application/octet-stream",
                "User-Agent": "FishingPilot-074-release",
            }
        )
        request = urllib.request.Request(url, headers=request_headers)
        try:
            response = NO_REDIRECT.open(request, timeout=180)
        except urllib.error.HTTPError as error:
            if error.code not in (301, 302, 303, 307, 308):
                raise
            location = error.headers.get("Location", "")
            error.close()
            require(location, "GitHub asset redirect omitted Location")
            url = urllib.parse.urljoin(url, location)
            destination = urllib.parse.urlparse(url)
            require(
                destination.scheme == "https"
                and destination.hostname in ASSET_REDIRECT_HOSTS
                and destination.port in (None, 443)
                and not destination.username
                and not destination.password,
                "GitHub asset redirect used an unapproved destination",
            )
            authenticated = False
            continue
        with response:
            require(response.getcode() == 200, "GitHub asset download did not return 200")
            value = response.read(limit + 1)
        require(len(value) <= limit, "Downloaded asset exceeds its verified size")
        return value
    raise RuntimeError("GitHub asset download exceeded the redirect limit")


def release_by_tag():
    for page in range(1, 4):
        rows = request_json(f"/releases?per_page=100&page={page}")
        for release in rows:
            if release.get("tag_name") == TAG:
                return release
        if len(rows) < 100:
            break
    return None


def require_tag_ref():
    encoded = urllib.parse.quote(TAG, safe="")
    existing = request_json("/git/ref/tags/" + encoded)
    require(existing["object"]["type"] == "commit", "0.7.4 tag is not a lightweight commit tag")
    require(existing["object"]["sha"] == COMMIT, "Existing 0.7.4 tag points to another commit")


def ensure_tag():
    require(re.fullmatch(r"[0-9a-f]{40}", COMMIT or ""), "GITHUB_SHA must be a full commit hash")
    try:
        require_tag_ref()
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
        request_json("/git/refs", {"ref": "refs/tags/" + TAG, "sha": COMMIT})
        require_tag_ref()


def payload_map():
    require(PAYLOAD.is_dir(), "Packaged release payload is missing")
    result = {}
    for path in sorted(PAYLOAD.iterdir()):
        if path.is_file():
            result[path.name] = {"size": path.stat().st_size, "sha256": digest(path.read_bytes())}
    required = {
        f"FishingPilot-{VERSION}-app.zip",
        f"FishingPilot-{VERSION}-app.zip.sha256",
        f"FishingPilot-{VERSION}-win-x64.zip",
        f"FishingPilot-{VERSION}-win-x64.zip.sha256",
        f"FishingPilot-Admin-{VERSION}-win-x64.zip",
        f"FishingPilot-Admin-{VERSION}-win-x64.zip.sha256",
        f"FishingPilot-{VERSION}-source.zip",
        f"FishingPilot-{VERSION}-source.zip.sha256",
        PACKAGE_REPORT,
        PACKAGE_REPORT + ".sha256",
    }
    require(required.issubset(result), "Release payload is incomplete")
    return result


def write_state(path, value):
    STATE.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def read_state(path):
    require(path.exists(), "Release state is missing: " + path.name)
    return json.loads(path.read_text(encoding="utf-8"))


def release_from_state():
    state = read_state(RELEASE_STATE)
    require(state.get("tag") == TAG and state.get("commit") == COMMIT, "Release state identity mismatch")
    release = request_json("/releases/" + str(state["id"]))
    require(release.get("tag_name") == TAG, "GitHub release tag changed")
    require_tag_ref()
    return release


def draft():
    ref = os.environ.get("GITHUB_REF", "")
    require(
        ref == "refs/heads/release/fishingpilot-0.7.4-reliability",
        "Publication is allowed only from release/fishingpilot-0.7.4-reliability",
    )
    require(release_by_tag() is None, "0.7.4 release already exists; never overwrite a published or draft release")
    ensure_tag()
    release = request_json(
        "/releases",
        {
            "tag_name": TAG,
            "target_commitish": COMMIT,
            "name": "FishingPilot 0.7.4 preview — consumables and fullscreen/background reliability",
            "body": (
                "Precompiled FishingPilot follow-up built from the published 0.7.3 baseline. "
                "It simplifies consumable configuration and contains targeted fullscreen/background reliability work. "
                "The attached verification report distinguishes fixture coverage from live FiveM acceptance. "
                "Includes an exact offline rollback to published 0.7.3. This release remains a prerelease and does "
                "not replace the mining tool's latest release."
            ),
            "draft": True,
            "prerelease": True,
            "make_latest": "false",
        },
    )
    write_state(
        RELEASE_STATE,
        {
            "id": release["id"],
            "tag": TAG,
            "commit": COMMIT,
            "url": release.get("html_url", ""),
            "draft": True,
        },
    )
    base = release["upload_url"].split("{")[0]
    for path in sorted(PAYLOAD.iterdir()):
        if path.is_file():
            upload(base + "?name=" + urllib.parse.quote(path.name), path.read_bytes())
    release = request_json("/releases/" + str(release["id"]))
    require(release.get("draft") is True, "Release became public before verification")
    write_state(
        RELEASE_STATE,
        {
            "id": release["id"],
            "tag": TAG,
            "commit": COMMIT,
            "url": release.get("html_url", ""),
            "draft": True,
            "assets": [asset.get("name") for asset in release.get("assets", [])],
        },
    )
    print("Draft uploaded:", release.get("html_url", ""))


def verify_checksum_pair(name, remote):
    checksum_name = name + ".sha256"
    require(name in remote and checksum_name in remote, "Missing checksum pair: " + name)
    fields = remote[checksum_name].decode("ascii").strip().split()
    require(len(fields) >= 2 and fields[0] == digest(remote[name]) and fields[-1] == name, "Checksum pair mismatch: " + name)


def verify_zip(remote):
    app_name = f"FishingPilot-{VERSION}-app.zip"
    full_name = f"FishingPilot-{VERSION}-win-x64.zip"
    with zipfile.ZipFile(io.BytesIO(remote[app_name])) as archive:
        require(archive.testzip() is None, "Uploaded app ZIP is corrupt")
        require(archive.read("version.txt").decode("utf-8-sig").strip() == VERSION, "Uploaded app version mismatch")
        for name in ("FishingPilot.exe", "FishingPilot.View.exe", "owner-monitor.txt", "ui/index.html"):
            require(name in archive.namelist(), "Uploaded app ZIP is missing " + name)
    with zipfile.ZipFile(io.BytesIO(remote[full_name])) as archive:
        require(archive.testzip() is None, "Uploaded full ZIP is corrupt")
        state = json.loads(archive.read("release-state.json").decode("utf-8-sig"))
        require(state.get("Active") == VERSION and state.get("Previous") == "0.7.3", "Uploaded rollback state mismatch")
        for name in (
            "FishingPilot.exe",
            f"versions/{VERSION}/FishingPilot.exe",
            "versions/0.7.3/FishingPilot.exe",
        ):
            require(name in archive.namelist(), "Uploaded full ZIP is missing " + name)
        require(EMBEDDED_REPORT in archive.namelist(), "Uploaded full ZIP is missing its build report")
        require(PACKAGE_REPORT not in archive.namelist(), "External package report was embedded in the full ZIP")
        embedded_bytes = archive.read(EMBEDDED_REPORT)
        embedded = json.loads(embedded_bytes.decode("utf-8-sig"))
        require(
            embedded.get("report_kind") == "embedded-build-verification"
            and embedded.get("version") == PREVIEW
            and embedded.get("source_commit") == COMMIT,
            "Uploaded embedded report identity mismatch",
        )
        require(set(embedded.get("artifacts", {})) == {"app", "source"}, "Uploaded embedded report scope mismatch")
        require(
            embedded["artifacts"]["app"].get("sha256") == digest(remote[app_name])
            and embedded["artifacts"]["source"].get("sha256")
            == digest(remote[f"FishingPilot-{VERSION}-source.zip"]),
            "Uploaded embedded report hashes do not match the payload",
        )
        return embedded_bytes


def verify_draft():
    expected = payload_map()
    release = release_from_state()
    require(release.get("draft") is True, "Release must remain draft during verification")
    require(release.get("prerelease") is True, "FishingPilot preview lost prerelease status")
    assets = release.get("assets", [])
    require(len(assets) == len(expected), "Draft asset count mismatch")
    by_name = {asset.get("name"): asset for asset in assets}
    require(set(by_name) == set(expected), "Draft asset names differ from the packaged payload")
    remote = {}
    for name, local in expected.items():
        asset = by_name[name]
        require(asset.get("state") == "uploaded" and asset.get("size") == local["size"], "Draft asset is incomplete: " + name)
        if asset.get("digest"):
            require(asset["digest"] == "sha256:" + local["sha256"], "GitHub asset digest mismatch: " + name)
        value = asset_bytes(asset, local["size"])
        require(len(value) == local["size"] and digest(value) == local["sha256"], "Downloaded draft asset mismatch: " + name)
        remote[name] = value
    for name in (
        f"FishingPilot-{VERSION}-app.zip",
        f"FishingPilot-{VERSION}-win-x64.zip",
        f"FishingPilot-Admin-{VERSION}-win-x64.zip",
        f"FishingPilot-{VERSION}-source.zip",
        PACKAGE_REPORT,
    ):
        verify_checksum_pair(name, remote)
    embedded_bytes = verify_zip(remote)
    report = json.loads(remote[PACKAGE_REPORT].decode("utf-8-sig"))
    require(
        report.get("report_kind") == "external-package-verification"
        and report.get("version") == PREVIEW
        and report.get("source_commit") == COMMIT,
        "Uploaded verification identity mismatch",
    )
    require(
        report.get("embedded_report")
        == {"path": EMBEDDED_REPORT, "sha256": digest(embedded_bytes)},
        "Uploaded package report does not identify the embedded report",
    )
    for key, name in (
        ("app", f"FishingPilot-{VERSION}-app.zip"),
        ("client", f"FishingPilot-{VERSION}-win-x64.zip"),
        ("admin", f"FishingPilot-Admin-{VERSION}-win-x64.zip"),
        ("source", f"FishingPilot-{VERSION}-source.zip"),
    ):
        require(
            report.get("artifacts", {}).get(key, {}).get("sha256") == digest(remote[name]),
            "Uploaded package report hash mismatch: " + key,
        )
    verified = {
        "release_id": release["id"],
        "tag": TAG,
        "commit": COMMIT,
        "payload": expected,
        "verified": True,
    }
    write_state(VERIFIED_STATE, verified)
    print("Draft verification passed for", len(expected), "assets")


def publish():
    verified = read_state(VERIFIED_STATE)
    require(
        verified.get("verified") is True
        and verified.get("tag") == TAG
        and verified.get("commit") == COMMIT
        and verified.get("payload") == payload_map(),
        "Draft verification is stale or belongs to another payload",
    )
    release = release_from_state()
    require(release.get("draft") is True, "Only a verified draft may be published")
    require(verified.get("release_id") == release.get("id"), "Verified draft release ID changed")
    expected_assets = {
        name: {"size": value["size"], "digest": "sha256:" + value["sha256"]}
        for name, value in verified["payload"].items()
    }
    current_assets = {}
    for asset in release.get("assets", []):
        name = asset.get("name")
        require(name and name not in current_assets, "Draft contains duplicate or unnamed assets")
        require(asset.get("state") == "uploaded", "Draft asset is not completely uploaded: " + name)
        current_assets[name] = {
            "size": asset.get("size"),
            "digest": asset.get("digest"),
        }
    require(current_assets == expected_assets, "Draft assets changed after verification")
    release = request_json(
        "/releases/" + str(release["id"]),
        {"draft": False, "prerelease": True, "make_latest": "false"},
        method="PATCH",
    )
    require(release.get("draft") is False and release.get("prerelease") is True, "GitHub did not publish the prerelease")
    write_state(
        STATE / "published-release.json",
        {
            "id": release["id"],
            "tag": TAG,
            "commit": COMMIT,
            "url": release.get("html_url", ""),
            "draft": False,
            "published_at": release.get("published_at"),
            "assets": [
                {key: asset.get(key) for key in ("name", "browser_download_url", "digest", "size")}
                for asset in release.get("assets", [])
            ],
        },
    )
    print("Published:", release.get("html_url", ""))


def redraft():
    if not RELEASE_STATE.exists():
        print("No created release was recorded; nothing can be public from this run")
        return
    release = release_from_state()
    if release.get("draft") is True:
        print("Release is already draft")
        return
    release = request_json(
        "/releases/" + str(release["id"]),
        {"draft": True, "prerelease": True, "make_latest": "false"},
        method="PATCH",
    )
    require(release.get("draft") is True, "EMERGENCY: GitHub did not return the failed release to draft")
    write_state(
        STATE / "emergency-redraft.json",
        {
            "id": release["id"],
            "tag": TAG,
            "commit": COMMIT,
            "url": release.get("html_url", ""),
            "draft": True,
            "reason": "Post-publication update-feed verification failed",
        },
    )
    print("Failed public release returned to draft:", release.get("html_url", ""))


def main():
    require(len(sys.argv) == 2, "usage: Publish.py draft|verify-draft|publish|redraft")
    command = sys.argv[1]
    actions = {
        "draft": draft,
        "verify-draft": verify_draft,
        "publish": publish,
        "redraft": redraft,
    }
    require(command in actions, "Unknown release command: " + command)
    actions[command]()


if __name__ == "__main__":
    main()
