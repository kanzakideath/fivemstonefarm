from pathlib import Path
import hashlib,json,lzma
root=Path(__file__).resolve().parent.parent
payload=b''.join((root/'staging064'/('payload'+str(i)+'.part')).read_bytes() for i in range(3))
assert hashlib.sha256(payload).hexdigest()=='3f4dcb299b0131387648b0aa1c822fcf149e28f8e056d92282c15a49aa73e290','Payload integrity failure'
rows=json.loads(lzma.decompress(payload))
for row in rows:
 path=(root/row['path']).resolve()
 assert path.is_relative_to((root/'portable').resolve()) or path.is_relative_to((root/'staging064').resolve()),'Unexpected target'
 old=path.read_text(encoding='utf-8-sig') if path.exists() else ''
 digest=hashlib.sha256(old.encode()).hexdigest()
 if digest==row['new']:
  print('Already applied:',row['path']);continue
 assert digest==row['base'],('Base mismatch',row['path'],digest)
 new=old
 for start,end,text in reversed(row['edits']):new=new[:start]+text+new[end:]
 assert hashlib.sha256(new.encode()).hexdigest()==row['new'],('Result mismatch',row['path'])
 path.parent.mkdir(parents=True,exist_ok=True)
 with path.open('w',encoding='utf-8',newline='\n') as f:f.write(new)
 print('Verified:',row['path'])
print('Verified source changes:',len(rows))
