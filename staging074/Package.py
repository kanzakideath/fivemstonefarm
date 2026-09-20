from pathlib import Path
import hashlib
import json
import os
import shutil
import zipfile


ROOT = Path(__file__).resolve().parent.parent
VERSION = "0.7.4"
PREVIOUS = "0.7.3"
PREVIEW = VERSION + "-preview"
EMBEDDED_REPORT = "build-verification.json"
PACKAGE_REPORT = f"FishingPilot-{VERSION}-package-verification.json"
OUT = ROOT / "artifacts" / "fishing074-download"
EVIDENCE = ROOT / "artifacts" / "fishing074"
APP = ROOT / "portable" / "dist"
FULL = ROOT / "artifacts" / "client074"
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True, exist_ok=True)
if FULL.exists():
    shutil.rmtree(FULL)
FULL.mkdir(parents=True)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def checksum(path):
    value = sha256(path)
    path.with_name(path.name + ".sha256").write_text(
        value + "  " + path.name + "\n", encoding="ascii"
    )
    return value


def copy_runtime(source, destination):
    for path in source.rglob("*"):
        relative = path.relative_to(source)
        if (
            not path.is_file()
            or any(part in ("test-evidence", "node_modules", "obj", "bin") for part in relative.parts)
            or path.name == "SHA256SUMS.txt"
            or "Integration" in path.name
            or "BackgroundTest" in path.name
        ):
            continue
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)


def manifest(folder):
    return {
        path.relative_to(folder).as_posix(): sha256(path)
        for path in sorted(folder.rglob("*"))
        if path.is_file() and path.name != "SHA256SUMS.txt"
    }


def archive(folder, name):
    sums = manifest(folder)
    (folder / "SHA256SUMS.txt").write_text(
        "".join(value + "  " + relative + "\n" for relative, value in sums.items()),
        encoding="utf-8",
    )
    target = OUT / name
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as result:
        for path in sorted(folder.rglob("*")):
            if path.is_file():
                result.write(path, path.relative_to(folder).as_posix())
    with zipfile.ZipFile(target) as result:
        if result.testzip() is not None:
            raise RuntimeError("Archive CRC validation failed: " + name)
        for relative, value in sums.items():
            if hashlib.sha256(result.read(relative)).hexdigest() != value:
                raise RuntimeError("Archive content changed: " + relative)
    return {"files": len(sums), "sha256": checksum(target)}


def checked_result(path):
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if not (value.get("pass") is True or value.get("status") == "PASS" or value.get("ok") is True):
        raise RuntimeError("Required test did not pass: " + str(path))
    return value


checks = {}
for name, relative in (
    ("updater", "updater-tests.json"),
    ("owner", "owner-tests.json"),
    ("account", "account-tests.json"),
    ("experience-native", "experience-tests.json"),
    ("experience-browser", "experience/RESULT.json"),
    ("lease", "lease/RESULT.json"),
    ("ui", "ui/RESULT.json"),
    ("admin-ui", "admin-ui/RESULT.json"),
    ("scene", "scene/RESULT.json"),
    ("inventory", "inventory/RESULT.json"),
    ("storage", "storage/RESULT.json"),
):
    checks[name] = checked_result(EVIDENCE / relative)

native = (APP / "test-evidence" / "RESULT.txt").read_text(encoding="utf-8-sig")
if not native.startswith("PASS"):
    raise RuntimeError("Native self-tests did not pass")

(APP / "version.txt").write_text(VERSION, encoding="utf-8")
copy_runtime(APP, FULL / "versions" / VERSION)
copy_runtime(ROOT / "fallback" / PREVIOUS, FULL / "versions" / PREVIOUS)
shutil.copyfile(ROOT / "staging071/bin/Manager/FishingPilot.Manager.exe", FULL / "FishingPilot.exe")
(FULL / "manager-protocol.txt").write_text("2\n", encoding="ascii")
(FULL / "release-state.json").write_text(
    json.dumps(
        {
            "Active": VERSION,
            "Previous": PREVIOUS,
            "Pending": "",
            "Auto": True,
            "SettingsBackups": {},
        },
        separators=(",", ":"),
    ),
    encoding="utf-8",
)
(FULL / "FishingPilot.exe.config").write_text(
    '<?xml version="1.0" encoding="utf-8"?>'
    '<configuration><startup><supportedRuntime version="v4.0" '
    'sku=".NETFramework,Version=v4.8"/></startup></configuration>',
    encoding="utf-8",
)
(FULL / "Adminを開く.cmd").write_bytes(
    '@echo off\r\nstart "" "%~dp0FishingPilot.exe" --admin\r\n'.encode("ascii")
)
shutil.copyfile(ROOT / "staging074/README.txt", FULL / "README.txt")

build_report = {
    "report_kind": "embedded-build-verification",
    "version": PREVIEW,
    "source_commit": os.environ.get("GITHUB_SHA", "local"),
    "precompiled": True,
    "component_tests": checks,
    "native_tests": native,
    "real_fivem_tested": False,
    "exclusive_fullscreen_verified": False,
    "wan_tested": False,
    "update_integrity": "HTTPS repository-scoped download plus SHA-256; not an Authenticode or public-key signature",
    "rollback": "Exact published 0.7.3 app included",
    "data_policy": "Settings, catch history and storage journals remain under LocalAppData and are not rolled back with binaries",
    "limits": [
        "A passing CI fixture is not proof of live FiveM behavior",
        "Exclusive fullscreen must not be claimed until a recorded live acceptance run passes",
        "The root update manager is not replaced by app-only automatic updates",
        "Automatic updates reach only compatible managers with Auto enabled and GitHub access",
        "Screen sharing uses the selected visible desktop and can consume CPU/GDI/memory bandwidth",
    ],
}

artifacts = {}
artifacts["app"] = archive(FULL / "versions" / VERSION, f"FishingPilot-{VERSION}-app.zip")

source_path = OUT / f"FishingPilot-{VERSION}-source.zip"
with zipfile.ZipFile(source_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as result:
    for directory in ("portable", "staging071", "staging072", "staging073", "staging074"):
        for path in sorted((ROOT / directory).rglob("*")):
            if path.is_file() and not any(
                part in ("bin", "obj", "dist", "node_modules", "__pycache__")
                or part.startswith("test-evidence")
                for part in path.relative_to(ROOT).parts
            ):
                result.write(path, path.relative_to(ROOT).as_posix())
    result.write(
        ROOT / ".github/workflows/fishing074-build.yml",
        ".github/workflows/fishing074-build.yml",
    )
with zipfile.ZipFile(source_path) as result:
    if result.testzip() is not None:
        raise RuntimeError("Source archive CRC validation failed")
    source_files = len(result.infolist())
artifacts["source"] = {"files": source_files, "sha256": checksum(source_path)}

build_report["artifacts"] = {
    name: artifacts[name] for name in ("app", "source")
}
embedded = FULL / EMBEDDED_REPORT
embedded.write_text(json.dumps(build_report, ensure_ascii=False, indent=2), encoding="utf-8")
embedded_identity = {
    "path": EMBEDDED_REPORT,
    "sha256": sha256(embedded),
}

artifacts["client"] = archive(FULL, f"FishingPilot-{VERSION}-win-x64.zip")
artifacts["admin"] = archive(FULL, f"FishingPilot-Admin-{VERSION}-win-x64.zip")

package_report = dict(build_report)
package_report["report_kind"] = "external-package-verification"
package_report["artifacts"] = artifacts
package_report["embedded_report"] = embedded_identity
verification = OUT / PACKAGE_REPORT
verification.write_text(
    json.dumps(package_report, ensure_ascii=False, indent=2), encoding="utf-8"
)
checksum(verification)

for name in ("admin-login.png", "admin-dashboard.png", "ui-dark.png"):
    shutil.copyfile(APP / "test-evidence" / name, OUT / name)
for source_name, output_name in (
    ("experience/quick-setup-1160.png", "quick-setup.png"),
    ("experience/catch-effect-1160.png", "catch-effect.png"),
    ("overlay-reward.png", "overlay-reward.png"),
):
    shutil.copyfile(EVIDENCE / source_name, OUT / output_name)

print(json.dumps({"pass": True, "version": VERSION, "artifacts": artifacts}))
