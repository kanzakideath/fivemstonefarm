from pathlib import Path
import hashlib,json,runpy
root=Path.cwd(); pending={}
for file in sorted(Path('staging050').glob('*.json')):
 docs=json.loads(file.read_text(encoding='utf-8-sig'))
 if isinstance(docs,dict):docs=[docs]
 for doc in docs:
  name=doc['path'];p=(root/name).resolve()
  if not p.is_relative_to(root/'portable') or name in pending:raise RuntimeError('Invalid or duplicate target '+name)
  text=p.read_text(encoding='utf-8-sig').replace('\r\n','\n')
  actual=hashlib.sha256(text.encode()).hexdigest()
  if actual!=doc['before']:raise RuntimeError('Baseline mismatch '+name+' '+actual)
  lines=text.splitlines(keepends=True)
  for start,end,replacement in reversed(doc['edits']):lines[start:end]=[replacement]
  result=''.join(lines)
  actual=hashlib.sha256(result.encode()).hexdigest()
  if actual!=doc['after']:
   Path('artifacts/fishing050').mkdir(parents=True,exist_ok=True)
   Path('artifacts/fishing050/transport-'+p.name).write_text(result,encoding='utf-8')
   raise RuntimeError('Result mismatch '+name+' '+actual)
  pending[name]=result
for name,text in pending.items():Path(name).write_text(text,encoding='utf-8-sig')
runpy.run_path('staging050/Ui050.py')
r=Path('portable')
# Update standalone readme to match the unified host input latch.
p=r/'README.txt';s=p.read_text(encoding='utf-8-sig');s=s.replace('対応するSVG円は描画された中心・半径・回転・円弧・数字を読み、同じ処理内で判定と通常キー入力を行います。','対応するSVG円は描画された中心・半径・回転・円弧・数字を読み、入力直前にも対象を確認します。');p.write_text(s,encoding='utf-8-sig')
s=(r/'Verify040.ps1').read_text(encoding='utf-8-sig').replace('fishing040','fishing050')
s+='\npython portable/TestRecognition050.py @browser --output artifacts/fishing050/recognition\nif($LASTEXITCODE -ne 0){throw "Recognition-mode regression failed"}\n'
(r/'Verify050.ps1').write_text(s,encoding='utf-8-sig')
s=(r/'Package040.py').read_text(encoding='utf-8-sig').replace('fishing040','fishing050').replace('0.4.0','0.5.0').replace("('scene','ui','storage')","('scene','ui','storage','recognition')")
s=s.replace("(out/'FishingPilot-0.5.0-native-ui.png').write_bytes", "(out/'FishingPilot-0.5.0-overlay.png').write_bytes((root/'test-evidence/overlay.png').read_bytes())\n(out/'FishingPilot-0.5.0-native-ui.png').write_bytes")
(r/'Package050.py').write_text(s,encoding='utf-8')
print('Applied',len(pending),'hash-verified file changes and added UI/overlay regression coverage')
