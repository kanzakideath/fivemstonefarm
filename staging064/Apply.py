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
# PowerShell variable names are case insensitive: do not overwrite the Case parameter.
p=root/'staging064/RunBackground.ps1'
s=p.read_text(encoding='utf-8').replace('$case','$caseDir')
p.write_text(s,encoding='utf-8',newline='\n')
# Keep the browser fixture version aligned with the actual executable.
p=root/'portable/TestUi.py'
p.write_text(p.read_text(encoding='utf-8').replace('0.6.1-preview','0.6.4-preview'),encoding='utf-8',newline='\n')
