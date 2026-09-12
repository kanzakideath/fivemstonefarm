from pathlib import Path
import base64, hashlib, json, lzma
root = Path(__file__).resolve().parents[1]
data = lzma.decompress(base64.b64decode(''.join((root / f'scripts/forward-cycle-{n}.b64').read_text().strip() for n in range(3)), validate=True))
assert hashlib.sha256(data).hexdigest() == '9d58266488091f40278eb451806ef803ab747ae492f1919020a989e921d2cec4', 'Transport digest mismatch'
rows=json.loads(data)
prepared=[]
for row in rows:
    p=(root/row['path']).resolve()
    assert p.is_relative_to(root) and '.git' not in p.parts
    old=p.read_text(encoding='utf-8-sig').replace('\r\n','\n') if p.exists() else ''
    if row['base'] is None:
        assert not p.exists(), 'New path already exists: '+str(p)
    else:
        assert p.exists() and hashlib.sha256(old.encode()).hexdigest()==row['base'], 'Base changed: '+str(p)
    lines=old.splitlines(keepends=True)
    for start,end,text in reversed(row['edits']):
        assert 0<=start<=end<=len(lines)
        lines[start:end]=[text]
    value=''.join(lines)
    assert hashlib.sha256(value.encode()).hexdigest()==row['after'], 'Result mismatch: '+str(p)
    prepared.append((p,(b'\xef\xbb\xbf' if row['bom'] else b'')+value.encode()))
for p,value in prepared:
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_bytes(value)
p=root/'docs/AI採掘機_使い方.txt'
s=p.read_text(encoding='utf-8-sig')
assert s.count('v9.1.15は、')==1
p.write_text(s.replace('v9.1.15は、','前版は、',1),encoding='utf-8')
output=root/'artifacts/forward-cycle'
output.mkdir(parents=True,exist_ok=True)
(output/'changed-paths.json').write_text(json.dumps([r['path'] for r in rows],ensure_ascii=False),encoding='utf-8')
print('Applied',len(prepared),'reviewed files with verified before/after hashes.')
