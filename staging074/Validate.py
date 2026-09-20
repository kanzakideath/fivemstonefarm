from pathlib import Path, PurePosixPath
import hashlib
import json
import re
import sys
import zipfile


ROOT = Path(__file__).resolve().parent.parent
VERSION = "0.7.4"
PREVIEW = VERSION + "-preview"
EMBEDDED_REPORT = "build-verification.json"
PACKAGE_REPORT = f"FishingPilot-{VERSION}-package-verification.json"
DOWNLOAD = ROOT / "artifacts" / "fishing074-download"


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def text(relative):
    return (ROOT / relative).read_text(encoding="utf-8-sig")


def source():
    checks = {
        "portable/Program.cs": (
            'AssemblyVersion("0.7.4.0")',
            'AssemblyFileVersion("0.7.4.0")',
            'Version="0.7.4-preview"',
        ),
        "portable/Engine.cs": ('"version="+Program.Version',),
        "portable/Build.ps1": ("FishingPilot 0.7.4 build ready.",),
        "portable/README.txt": ("FishingPilot 0.7.4",),
        "portable/OwnerRuntime.cs": (
            "FishingPilot Admin 0.7.4",
            "FishingPilot 0.7.4",
        ),
        "portable/TestUi.py": ("'version':'0.7.4-preview'",),
        "portable/ui/index.html": ("FishingPilot 0.7.4-preview",),
        "staging071/Manager.cs": (
            'AssemblyVersion("0.7.4.0")',
            'Initial="0.7.4"',
        ),
        "staging071/View.cs": (
            'AssemblyVersion("0.7.4.0")',
            "FishingPilot Admin 0.7.4",
            "FishingPilot 0.7.4",
        ),
        "staging074/Build.ps1": ("'0.7.4'",),
        "staging074/Package.py": ('VERSION = "0.7.4"',),
        "staging074/Publish.py": ('VERSION = "0.7.4"',),
        "staging074/README.txt": ("FishingPilot 0.7.4",),
    }
    for relative, markers in checks.items():
        value = text(relative)
        for marker in markers:
            require(marker in value, relative + " is missing version marker: " + marker)
    # The release manager's updater protocol remains compatible with 0.7.3.
    # Changing this value requires a one-time full-ZIP migration plan.
    require('write_text("2\\n"' in text("staging074/Package.py"), "manager protocol marker changed")
    print("SOURCE_VERSION_PASS", len(checks))


def hash_file(path):
    value = hashlib.sha256(path.read_bytes()).hexdigest()
    checksum = path.with_name(path.name + ".sha256")
    require(checksum.exists(), "Missing checksum: " + checksum.name)
    fields = checksum.read_text(encoding="ascii").strip().split()
    require(len(fields) >= 2 and fields[0] == value and fields[-1] == path.name, "Bad checksum: " + path.name)
    return value


def safe_zip(path):
    names = set()
    total = 0
    with zipfile.ZipFile(path) as archive:
        require(archive.testzip() is None, "Corrupt ZIP: " + path.name)
        for entry in archive.infolist():
            raw = entry.filename.replace("\\", "/")
            pure = PurePosixPath(raw)
            require(
                raw
                and not raw.startswith("/")
                and ":" not in raw
                and all(part not in ("", ".", "..") for part in pure.parts),
                "Unsafe ZIP path: " + raw,
            )
            require(raw.casefold() not in names, "Duplicate ZIP path: " + raw)
            names.add(raw.casefold())
            total += entry.file_size
            require(entry.file_size <= 80_000_000 and total <= 220_000_000, "ZIP expansion limit exceeded")
        return archive.namelist(), {name: archive.read(name) for name in archive.namelist() if not name.endswith("/")}


def package():
    required = [
        f"FishingPilot-{VERSION}-app.zip",
        f"FishingPilot-{VERSION}-win-x64.zip",
        f"FishingPilot-Admin-{VERSION}-win-x64.zip",
        f"FishingPilot-{VERSION}-source.zip",
    ]
    digests = {name: hash_file(DOWNLOAD / name) for name in required}
    verification = DOWNLOAD / PACKAGE_REPORT
    hash_file(verification)
    report = json.loads(verification.read_text(encoding="utf-8"))
    require(report.get("report_kind") == "external-package-verification", "Package report kind mismatch")
    require(report.get("version") == PREVIEW, "Verification version mismatch")
    require(report.get("source_commit"), "Verification source commit is missing")
    app_names, app = safe_zip(DOWNLOAD / required[0])
    require(app.get("version.txt", b"").decode("utf-8-sig").strip() == VERSION, "App version.txt mismatch")
    for name in ("FishingPilot.exe", "FishingPilot.View.exe", "owner-monitor.txt", "ui/index.html"):
        require(name in app_names, "App ZIP missing " + name)
    full_names, full = safe_zip(DOWNLOAD / required[1])
    for name in (
        "FishingPilot.exe",
        "manager-protocol.txt",
        "release-state.json",
        EMBEDDED_REPORT,
        f"versions/{VERSION}/FishingPilot.exe",
        "versions/0.7.3/FishingPilot.exe",
    ):
        require(name in full_names, "Full ZIP missing " + name)
    state = json.loads(full["release-state.json"].decode("utf-8-sig"))
    require(state.get("Active") == VERSION and state.get("Previous") == "0.7.3", "Release state mismatch")
    require(full["manager-protocol.txt"].decode("ascii").strip() == "2", "Manager protocol mismatch")
    admin_names, admin = safe_zip(DOWNLOAD / required[2])
    require(set(admin_names) == set(full_names), "Admin and unified ZIP contents differ")
    require(admin.get(EMBEDDED_REPORT) == full.get(EMBEDDED_REPORT), "Embedded reports differ between full ZIPs")
    embedded_bytes = full[EMBEDDED_REPORT]
    embedded = json.loads(embedded_bytes.decode("utf-8-sig"))
    require(embedded.get("report_kind") == "embedded-build-verification", "Embedded report kind mismatch")
    require(embedded.get("version") == PREVIEW, "Embedded report version mismatch")
    require(embedded.get("source_commit") == report.get("source_commit"), "Report source commits differ")
    for key, value in embedded.items():
        if key not in ("report_kind", "artifacts"):
            require(report.get(key) == value, "Embedded and package reports differ at " + key)
    require(set(embedded.get("artifacts", {})) == {"app", "source"}, "Embedded artifact scope mismatch")
    require(
        embedded["artifacts"]
        == {name: report.get("artifacts", {}).get(name) for name in ("app", "source")},
        "Embedded and package artifact records differ",
    )
    require(
        embedded["artifacts"]["app"].get("sha256") == digests[required[0]],
        "Embedded app hash mismatch",
    )
    require(
        embedded["artifacts"]["source"].get("sha256") == digests[required[3]],
        "Embedded source hash mismatch",
    )
    require(
        report.get("embedded_report")
        == {"path": EMBEDDED_REPORT, "sha256": hashlib.sha256(embedded_bytes).hexdigest()},
        "Package report does not identify the embedded report",
    )
    require(
        set(report.get("artifacts", {})) == {"app", "source", "client", "admin"},
        "Package artifact scope mismatch",
    )
    for key, filename in (
        ("app", required[0]),
        ("client", required[1]),
        ("admin", required[2]),
        ("source", required[3]),
    ):
        require(report["artifacts"][key].get("sha256") == digests[filename], "Report hash mismatch: " + key)
    require("verification.json" not in full_names and PACKAGE_REPORT not in full_names, "External report leaked into full ZIP")
    source_names, _ = safe_zip(DOWNLOAD / required[3])
    require(".github/workflows/fishing074-build.yml" in source_names, "Source ZIP missing workflow")
    require("staging074/Prepare.py" in source_names, "Source ZIP missing release source")
    print("PACKAGE_VALIDATION_PASS", len(required), "archives")


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ("source", "package"):
        raise SystemExit("usage: Validate.py source|package")
    source() if sys.argv[1] == "source" else package()


if __name__ == "__main__":
    main()
