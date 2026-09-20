from pathlib import Path, PurePosixPath
import base64
import hashlib
import io
import json
import lzma
import re
import subprocess
import urllib.request
import zipfile


ROOT = Path(__file__).resolve().parent.parent
STAGE = ROOT / "staging074"
BASE_TAG = "fishingpilot-v0.7.3-preview"
BASE_URL = (
    "https://github.com/kanzakideath/fivemstonefarm/releases/download/"
    + BASE_TAG
    + "/"
)
BASE_ASSETS = (
    (
        "FishingPilot-0.7.3-source.zip",
        "025ddf7d818b5f6a117638a7de75f49f392196cb90b43746419fe4c11d4618d9",
        ROOT,
        ("portable/", "staging071/", "staging072/", "staging073/"),
    ),
    (
        "FishingPilot-0.7.3-app.zip",
        "776699463d664bf61115809ba8101f8d7587822976f11ea53f1d15d5e85e2545",
        ROOT / "fallback" / "0.7.3",
        None,
    ),
)
OVERLAY = STAGE / "overlay.json.xz"
OVERLAY_SUM = STAGE / "overlay.sha256"
ALLOWED_OVERLAY_ROOTS = {"portable", "staging071", "staging072", "staging073"}
IGNORED_PARTS = {"bin", "obj", "dist", "node_modules", "__pycache__"}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def download(name, expected, limit=8_000_000):
    request = urllib.request.Request(
        BASE_URL + name, headers={"User-Agent": "FishingPilot-074-builder"}
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise RuntimeError("Published baseline is unexpectedly large: " + name)
    if sha256(data) != expected:
        raise RuntimeError("Published baseline changed: " + name)
    return data


def safe_member(name):
    normalized = name.replace("\\", "/")
    path = PurePosixPath(normalized)
    if (
        not normalized
        or normalized.startswith("/")
        or ":" in normalized
        or any(part in ("", ".", "..") for part in path.parts)
    ):
        raise RuntimeError("Unsafe archive member: " + name)
    return normalized, path


def extract(data, destination, prefixes=None):
    destination = destination.resolve()
    destination.mkdir(parents=True, exist_ok=True)
    seen = set()
    extracted = set()
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        if len(archive.infolist()) > 4000:
            raise RuntimeError("Published baseline contains too many files")
        for entry in archive.infolist():
            normalized, relative = safe_member(entry.filename)
            if entry.is_dir():
                continue
            if prefixes and not normalized.startswith(prefixes):
                continue
            if normalized.casefold() in seen:
                raise RuntimeError("Duplicate archive member: " + normalized)
            seen.add(normalized.casefold())
            if any(part in IGNORED_PARTS for part in relative.parts):
                raise RuntimeError("Build output found in published source: " + normalized)
            target = (destination / Path(*relative.parts)).resolve()
            if not target.is_relative_to(destination):
                raise RuntimeError("Unsafe archive destination: " + normalized)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(entry))
            extracted.add(normalized)
    return extracted


def read_overlay():
    if not OVERLAY.exists() or not OVERLAY_SUM.exists():
        raise RuntimeError(
            "0.7.4 overlay is not generated yet. Run staging074/MakeOverlay.py "
            "after the 0.7.4 source is final, then commit overlay.json.xz and overlay.sha256."
        )
    checksum = OVERLAY_SUM.read_text(encoding="ascii").strip().split()
    if not checksum or not re.fullmatch(r"[0-9a-f]{64}", checksum[0]):
        raise RuntimeError("Invalid overlay.sha256")
    blob = OVERLAY.read_bytes()
    if sha256(blob) != checksum[0]:
        raise RuntimeError("0.7.4 overlay checksum mismatch")
    document = json.loads(lzma.decompress(blob))
    if (
        not isinstance(document, dict)
        or document.get("format") != 1
        or document.get("base_tag") != BASE_TAG
        or not isinstance(document.get("rows"), list)
    ):
        raise RuntimeError("Unsupported 0.7.4 overlay format")
    return document["rows"]


def overlay_target(raw):
    if not isinstance(raw, str):
        raise RuntimeError("Overlay path must be text")
    normalized, relative = safe_member(raw)
    if relative.parts[0] not in ALLOWED_OVERLAY_ROOTS:
        raise RuntimeError("Overlay path is outside the source set: " + normalized)
    if any(part in IGNORED_PARTS or part.startswith("test-evidence") for part in relative.parts):
        raise RuntimeError("Overlay contains generated output: " + normalized)
    target = (ROOT / Path(*relative.parts)).resolve()
    if not target.is_relative_to(ROOT.resolve()):
        raise RuntimeError("Overlay escaped the repository: " + normalized)
    return normalized, target


def validate_rows(rows):
    seen = set()
    for row in rows:
        if not isinstance(row, dict):
            raise RuntimeError("Invalid overlay row")
        name, _ = overlay_target(row.get("path"))
        if name.casefold() in seen:
            raise RuntimeError("Duplicate overlay path: " + name)
        seen.add(name.casefold())
        if not re.fullmatch(r"[0-9a-f]{64}", str(row.get("base", ""))):
            raise RuntimeError("Invalid overlay base digest: " + name)
        if not re.fullmatch(r"[0-9a-f]{64}", str(row.get("new", ""))):
            raise RuntimeError("Invalid overlay result digest: " + name)
        modes = int(row.get("delete") is True) + int("data" in row) + int("edits" in row)
        if modes != 1:
            raise RuntimeError("Overlay row must have exactly one change mode: " + name)


def apply_overlay(rows):
    seen = set()
    for row in rows:
        if not isinstance(row, dict):
            raise RuntimeError("Invalid overlay row")
        name, target = overlay_target(row.get("path"))
        if name.casefold() in seen:
            raise RuntimeError("Duplicate overlay path: " + name)
        seen.add(name.casefold())
        old = target.read_bytes() if target.exists() else b""
        if sha256(old) != row.get("base"):
            raise RuntimeError("Overlay base mismatch: " + name)
        if row.get("delete") is True:
            if row.get("new") != sha256(b""):
                raise RuntimeError("Invalid delete digest: " + name)
            if target.exists():
                target.unlink()
            print("Verified deletion:", name)
            continue
        if "data" in row:
            try:
                new = base64.b64decode(row["data"], validate=True)
            except Exception as error:
                raise RuntimeError("Invalid binary overlay: " + name) from error
        else:
            edits = row.get("edits")
            if not isinstance(edits, list):
                raise RuntimeError("Missing text edits: " + name)
            try:
                lines = old.decode("utf-8-sig").splitlines(keepends=True)
            except UnicodeDecodeError as error:
                raise RuntimeError("Binary file requires data field: " + name) from error
            previous = len(lines) + 1
            for edit in reversed(edits):
                if (
                    not isinstance(edit, list)
                    or len(edit) != 3
                    or not isinstance(edit[0], int)
                    or not isinstance(edit[1], int)
                    or not isinstance(edit[2], str)
                    or edit[0] < 0
                    or edit[1] < edit[0]
                    or edit[1] > len(lines)
                    or edit[1] > previous
                ):
                    raise RuntimeError("Invalid text edit: " + name)
                previous = edit[0]
                lines[edit[0] : edit[1]] = [edit[2]]
            new = "".join(lines).encode("utf-8")
        if sha256(new) != row.get("new"):
            raise RuntimeError("Overlay result mismatch: " + name)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(new)
        print("Verified:", name)


def source_files():
    result = set()
    for top in ALLOWED_OVERLAY_ROOTS:
        folder = ROOT / top
        if not folder.exists():
            continue
        for path in folder.rglob("*"):
            if not path.is_file():
                continue
            relative = path.relative_to(ROOT)
            if any(
                part in IGNORED_PARTS or part.startswith("test-evidence")
                for part in relative.parts
            ):
                continue
            result.add(relative.as_posix())
    return result


def clean_git_checkout():
    result = subprocess.run(
        ["git", "status", "--porcelain=v1", "--untracked-files=all"],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError("Cannot verify a clean Git checkout: " + result.stderr.strip())
    return not result.stdout.strip()


def preflight_new_paths(rows):
    present = set()
    for row in rows:
        if row.get("base") != sha256(b""):
            continue
        name, target = overlay_target(row["path"])
        if not target.exists():
            continue
        if not target.is_file() or sha256(target.read_bytes()) != row.get("new"):
            raise RuntimeError("Existing new overlay file differs from the reviewed blob: " + name)
        present.add(name)
    if present and not clean_git_checkout():
        raise RuntimeError(
            "Existing new overlay files may be reconstructed only from a clean Git checkout"
        )
    return present


def normalize_checkout(rows, baseline_paths, approved_new_paths):
    overlay_paths = {row["path"] for row in rows}
    extras = source_files() - baseline_paths - overlay_paths
    if extras:
        sample = ", ".join(sorted(extras)[:8])
        raise RuntimeError("Source files are outside the reviewed overlay: " + sample)
    for row in rows:
        if row.get("base") != sha256(b""):
            continue
        name, target = overlay_target(row["path"])
        if not target.exists():
            continue
        if name not in approved_new_paths or sha256(target.read_bytes()) != row.get("new"):
            raise RuntimeError("New overlay file changed after clean-checkout preflight: " + name)
        # A clean checkout may contain readable source as well as the authoritative
        # overlay. Remove only a byte-identical, overlay-declared new path, then
        # recreate it from the reviewed blob.
        target.unlink()


def main():
    # Read and authenticate the overlay before replacing any source files.
    rows = read_overlay()
    validate_rows(rows)
    approved_new_paths = preflight_new_paths(rows)
    source_name, source_digest, source_destination, source_prefixes = BASE_ASSETS[0]
    baseline_paths = extract(
        download(source_name, source_digest), source_destination, source_prefixes
    )
    app_name, app_digest, app_destination, app_prefixes = BASE_ASSETS[1]
    extract(download(app_name, app_digest), app_destination, app_prefixes)
    normalize_checkout(rows, baseline_paths, approved_new_paths)
    apply_overlay(rows)
    print("0.7.4 source and exact published 0.7.3 rollback integrated")


if __name__ == "__main__":
    main()
