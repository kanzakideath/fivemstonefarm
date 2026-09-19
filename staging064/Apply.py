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
# Adding a food row must not move the fixture's catch update to the rod slot.
p=root/'staging064/BrowserPeer.py'
s=p.read_text(encoding='utf-8');assert 'item:rows()[1]' in s
p.write_text(s.replace('item:rows()[1]','item:rows().find(x=>x.slot===10)'),encoding='utf-8',newline='\n')
# A previous-supply cooldown must not delay the first verified low-gauge meal.
p=root/'portable/Engine.cs'
s=p.read_text(encoding='utf-8');assert s.count('foodActionAt=-10000')==2
p.write_text(s.replace('foodActionAt=-10000','foodActionAt=-15000'),encoding='utf-8',newline='\n')
p=root/'staging064/CheckCase.py'
s=p.read_text(encoding='utf-8').replace("if case=='supply-timeout':", "if case=='supply-timeout':\n assert e['slot_calls'][0]['body']=='1','confirmed low food must be serviced before the first cast'")
p.write_text(s,encoding='utf-8',newline='\n')
# Remove inherited wording that conflicts with the new unknown-needs option.
p=root/'portable/README.txt'
s=p.read_text(encoding='utf-8').replace('自動補給がONのとき、空腹・水分を読み取れない場合は理由を表示して待機します。','自動補給がONでも、未取得ゲージによる待機は初期状態では行いません。厳格な待機は設定で選択できます。').replace('【0.6.4 修正】\n所持品監視','【0.6.2 修正（継承）】\n所持品監視')
p.write_text(s,encoding='utf-8',newline='\n')
