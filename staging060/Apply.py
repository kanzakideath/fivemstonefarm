from pathlib import Path
import hashlib,json,lzma
root=Path(__file__).resolve().parent.parent
payload=b''.join((root/'staging060'/('payload'+str(i)+'.xz')).read_bytes() for i in range(4))
assert hashlib.sha256(payload).hexdigest()=='519c6e2febf3de10796569b6e4deec53b5c3435dcb009c5bf45d2dbb9b6360f1','Payload integrity failure'
rows=json.loads(lzma.decompress(payload))
for row in rows:
    path=(root/row['path']).resolve()
    assert path.is_relative_to((root/'portable').resolve()),'Unexpected target'
    old=path.read_text(encoding='utf-8-sig') if path.exists() else ''
    digest=hashlib.sha256(old.encode()).hexdigest()
    if digest==row['new']:
        print('Already applied:',row['path']);continue
    assert digest==row['base'],('Base source mismatch',row['path'],digest)
    new=old
    for start,end,text in reversed(row['edits']):new=new[:start]+text+new[end:]
    assert hashlib.sha256(new.encode()).hexdigest()==row['new'],('Result mismatch',row['path'])
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('w',encoding='utf-8',newline='\n') as f:f.write(new)
    print('Verified:',row['path'])
print('Verified and integrated',len(rows),'source changes')
