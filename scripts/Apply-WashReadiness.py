from pathlib import Path
import json, hashlib
root=Path(__file__).resolve().parents[1]
changes={}
for f in sorted((root/'scripts/wash-repair').glob('*.json')):
    for name, spec in json.loads(f.read_text(encoding='utf-8')).items():
        if name in changes: raise RuntimeError('Duplicate patch path')
        path=(root/name).resolve()
        if root not in path.parents: raise RuntimeError('Invalid patch path')
        data=path.read_bytes() if path.exists() else b''
        text=data.decode('utf-8-sig').replace('\r\n','\n')
        if hashlib.sha256(text.encode()).hexdigest()!=spec['hash']: raise RuntimeError('Baseline changed: '+name)
        lines=text.splitlines(True)
        for first,last,replacement in reversed(spec['edits']):
            if first<0 or last<first or last>len(lines): raise RuntimeError('Invalid edit: '+name)
            lines[first:last]=[replacement]
        changes[name]=(path,(b'\xef\xbb\xbf' if data.startswith(b'\xef\xbb\xbf') else b'')+''.join(lines).encode())
for name,(path,data) in changes.items():
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(data)
print('Applied '+str(len(changes))+' hash-checked source files; no user logs or images were included.')
