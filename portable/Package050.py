from pathlib import Path
import hashlib,json,zipfile,subprocess,shutil
root=Path('portable/dist'); evidence=Path('artifacts/fishing050');out=Path('artifacts/fishing050-download');out.mkdir(parents=True,exist_ok=True)
scene=json.loads((evidence/'scene/RESULT.json').read_text(encoding='utf-8-sig'))
ui=json.loads((evidence/'ui/RESULT.json').read_text(encoding='utf-8-sig'))
storage=json.loads((evidence/'storage/RESULT.json').read_text(encoding='utf-8-sig'))
native=(root/'test-evidence/RESULT.txt').read_text(encoding='utf-8-sig')
new=(root/'test-evidence/050.txt').read_text(encoding='utf-8-sig')
assert scene.get('pass') and ui.get('pass') and storage.get('pass') and native.startswith('PASS') and new.startswith('PASS')
assert not ui.get('inline_fixture_without_csp'), 'Windows browser test must retain normal URL/CSP path'
for p in ['FishingPilot.exe','SceneProbe.js','ui/index.html','test-evidence/ui.png','test-evidence/overlay.png']:
 assert (root/p).is_file(),p
sha=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
metadata={'version':'0.5.0-preview','source_sha':sha,'live_fivem_tested':False,'distribution':'standalone','shortcuts':{'start':'F5','stop':'F6'},'overlay':'separate mouse-transparent Windows overlay; exclusive fullscreen not guaranteed'}
(root/'build.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
files=sorted(p for p in root.rglob('*') if p.is_file() and 'test-evidence' not in p.parts and p.name!='SHA256SUMS.txt')
sums={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
(root/'SHA256SUMS.txt').write_text(''.join(h+'  '+n+'\n' for n,h in sums.items()),encoding='utf-8')
archive=out/'FishingPilot-0.5.0-preview-win-x64.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in files+[root/'SHA256SUMS.txt']:z.write(p,p.relative_to(root).as_posix())
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 for name,digest in sums.items():assert hashlib.sha256(z.read(name)).hexdigest()==digest,name
verification=dict(metadata,windows_self_test=native,fix_and_statistics_tests=new,rendered_scene=scene,responsive_ui=ui,storage_regression=storage,archive_sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),runtime_files=len(files),archive_roundtrip_verified=True)
(out/'FishingPilot-0.5.0-verification.json').write_text(json.dumps(verification,indent=2,ensure_ascii=False),encoding='utf-8')
shutil.copyfile(root/'test-evidence/ui.png',out/'FishingPilot-0.5.0-native-ui.png')
shutil.copyfile(root/'test-evidence/overlay.png',out/'FishingPilot-0.5.0-overlay-example.png')
if (evidence/'ui/inventory-1160.png').exists():shutil.copyfile(evidence/'ui/inventory-1160.png',out/'FishingPilot-0.5.0-inventory-example.png')
subprocess.run(['git','archive','--format=zip','-o',str(out/'FishingPilot-0.5.0-preview-source.zip'),'HEAD','portable'],check=True)
print(json.dumps({'source_sha':sha,'runtime_files':len(files),'archive_sha256':verification['archive_sha256']},indent=2))
