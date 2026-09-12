from pathlib import Path
import base64, hashlib, json, zlib

root = Path(__file__).resolve().parents[1]
parts = [(root / f'scripts/stationary-wait-{n}.b64').read_text().strip() for n in range(7)]
# Repair two transcription differences in the first transport fragment. Full
# uncompressed SHA below remains authoritative; no partial delta is accepted.
parts[0] = parts[0].replace('Y++SdRmx', 'Y++RdRmx').replace('Cv7+av//Sa', 'Cv7+9hJOCvz+av//Sa')
packed = base64.b64decode(''.join(parts), validate=True)
data = zlib.decompress(packed)
assert hashlib.sha256(data).hexdigest() == 'b44caeb345396397c33e7f546d689b2f62d1a65127beee660c097fe90d9e98df', 'Transport SHA mismatch'
rows = json.loads(data)
prepared = []
for row in rows:
    name = row['path']
    path = (root / name).resolve()
    assert path.is_relative_to(root) and '.git' not in path.parts, 'Unexpected path'
    exists = path.exists()
    text = path.read_text(encoding='utf-8-sig') if exists else ''
    text = text.replace('\r\n', '\n')
    if row['base'] is None:
        assert not exists, f'New source already exists: {name}'
    else:
        assert exists and hashlib.sha256(text.encode()).hexdigest() == row['base'], f'Base changed: {name}'
    lines = text.splitlines(keepends=True)
    for start, end, content in reversed(row['edits']):
        assert 0 <= start <= end <= len(lines), 'Invalid edit bounds'
        lines[start:end] = [content]
    value = ''.join(lines)
    assert hashlib.sha256(value.encode()).hexdigest() == row['after'], f'Result mismatch: {name}'
    prepared.append((path, (b'\xef\xbb\xbf' if row['bom'] else b'') + value.encode()))
for path, value in prepared:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(value)
print(f'Applied {len(prepared)} exact source files; all base and result hashes verified.')
