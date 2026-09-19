from pathlib import Path
import base64,gzip,json,hashlib
root=Path(__file__).resolve().parent.parent
p=root/'staging070'
parts=[(p/n).read_text(encoding='ascii') for n in ['payload0.b64','payload1.b64','payload2.b64','payload3a.b64','payload3b.b64']]
# Normalize the known two-character text transport error before integrity verification.
parts[2]=parts[2].replace('W/T3tf6c0HL+','W/T3tf6HL+')
data=base64.b64decode(''.join(parts),validate=True)
assert hashlib.sha256(data).hexdigest()=='6a2b8c5ca388377b6b1919e5b0baaa9670ac4a49e43a306949ace42b09c89f11','Source bundle integrity mismatch'
rows=json.loads(gzip.decompress(data))
for row in rows:
 path=(root/row['path']).resolve()
 assert any(path.is_relative_to(root/x) for x in ['portable','distribution','staging070']),'Unexpected source path'
 old=path.read_text(encoding='utf-8-sig') if path.exists() else ''
 digest=hashlib.sha256(old.encode()).hexdigest()
 if digest==row['new']:
  print('Already applied:',row['path']);continue
 assert digest==row['base'],('Base mismatch',row['path'],digest)
 new=old
 for start,end,text in reversed(row['edits']):new=new[:start]+text+new[end:]
 assert hashlib.sha256(new.encode()).hexdigest()==row['new'],('Patched content mismatch',row['path'])
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_text(new,encoding='utf-8',newline='\n')
 print('Verified:',row['path'])
print('Verified and applied',len(rows),'source changes')
