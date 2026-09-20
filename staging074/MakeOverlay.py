"""Build the reviewed 0.7.4 source overlay without publishing anything.

Run this only after the working-tree 0.7.4 source is final. The generated files
are consumed by Prepare.py and must be reviewed and committed together.
"""

from pathlib import Path, PurePosixPath
import base64
import difflib
import hashlib
import io
import json
import lzma
import tempfile
import urllib.request
import zipfile


ROOT = Path(__file__).resolve().parent.parent
STAGE = ROOT / "staging074"
BASE_TAG = "fishingpilot-v0.7.3-preview"
SOURCE_NAME = "FishingPilot-0.7.3-source.zip"
SOURCE_SHA256 = "025ddf7d818b5f6a117638a7de75f49f392196cb90b43746419fe4c11d4618d9"
SOURCE_URL = (
    "https://github.com/kanzakideath/fivemstonefarm/releases/download/"
    + BASE_TAG
    + "/"
    + SOURCE_NAME
)
SOURCE_ROOTS = ("portable", "staging071", "staging072", "staging073")
IGNORED = {"bin", "obj", "dist", "node_modules", "__pycache__"}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def included(relative):
    return (
        relative.parts
        and relative.parts[0] in SOURCE_ROOTS
        and not any(part in IGNORED or part.startswith("test-evidence") for part in relative.parts)
    )


def safe_name(name):
    normalized = name.replace("\\", "/")
    path = PurePosixPath(normalized)
    if (
        normalized.startswith("/")
        or ":" in normalized
        or any(part in ("", ".", "..") for part in path.parts)
        or not path.parts
    ):
        raise RuntimeError("Unsafe source member: " + name)
    return Path(*path.parts)


def baseline(destination):
    request = urllib.request.Request(
        SOURCE_URL, headers={"User-Agent": "FishingPilot-074-overlay-builder"}
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read(8_000_001)
    if len(data) > 8_000_000 or digest(data) != SOURCE_SHA256:
        raise RuntimeError("Published 0.7.3 source is missing or changed")
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        for entry in archive.infolist():
            if entry.is_dir():
                continue
            relative = safe_name(entry.filename)
            if not included(relative):
                continue
            target = (destination / relative).resolve()
            if not target.is_relative_to(destination.resolve()):
                raise RuntimeError("Unsafe source destination")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(entry))


def files(root):
    result = {}
    for top in SOURCE_ROOTS:
        folder = root / top
        if not folder.exists():
            continue
        for path in folder.rglob("*"):
            if path.is_file():
                relative = path.relative_to(root)
                if included(relative):
                    result[relative.as_posix()] = path
    return result


def text_edits(old, new):
    try:
        before = old.decode("utf-8-sig").splitlines(keepends=True)
        after_text = new.decode("utf-8-sig")
        after = after_text.splitlines(keepends=True)
    except UnicodeDecodeError:
        return None, new
    edits = []
    matcher = difflib.SequenceMatcher(a=before, b=after, autojunk=False)
    for operation, a0, a1, b0, b1 in matcher.get_opcodes():
        if operation != "equal":
            edits.append([a0, a1, "".join(after[b0:b1])])
    canonical = after_text.encode("utf-8")
    return edits, canonical


def main():
    with tempfile.TemporaryDirectory(prefix="FishingPilot-074-base-") as temp:
        base_root = Path(temp)
        baseline(base_root)
        old_files = files(base_root)
        new_files = files(ROOT)
        rows = []
        for name in sorted(set(old_files) | set(new_files)):
            old = old_files[name].read_bytes() if name in old_files else b""
            if name not in new_files:
                rows.append(
                    {
                        "path": name,
                        "base": digest(old),
                        "new": digest(b""),
                        "delete": True,
                    }
                )
                continue
            current = new_files[name].read_bytes()
            edits, canonical = text_edits(old, current)
            if edits is not None:
                new = canonical
                if old == new:
                    continue
                rows.append(
                    {
                        "path": name,
                        "base": digest(old),
                        "new": digest(new),
                        "edits": edits,
                    }
                )
            else:
                if old == current:
                    continue
                rows.append(
                    {
                        "path": name,
                        "base": digest(old),
                        "new": digest(current),
                        "data": base64.b64encode(current).decode("ascii"),
                    }
                )
    if not rows:
        raise RuntimeError("No 0.7.4 source changes were found")
    document = {
        "format": 1,
        "base_tag": BASE_TAG,
        "rows": rows,
    }
    raw = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    blob = lzma.compress(raw, format=lzma.FORMAT_XZ, preset=9)
    overlay = STAGE / "overlay.json.xz"
    checksum = STAGE / "overlay.sha256"
    overlay.write_bytes(blob)
    checksum.write_text(digest(blob) + "  overlay.json.xz\n", encoding="ascii")
    print("Created", overlay, "with", len(rows), "verified source changes")
    print("SHA256", digest(blob))


if __name__ == "__main__":
    main()
