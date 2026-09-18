from pathlib import Path
import json,hashlib,subprocess,zipfile
root=Path('portable/dist');evidence=Path('artifacts/fishing040');out=Path('artifacts/fishing040-download');out.mkdir(parents=True,exist_ok=True)
native=(root/'test-evidence/RESULT.txt').read_text(encoding='utf-8-sig')
suites={n:json.loads((evidence/n/'RESULT.json').read_text(encoding='utf-8-sig')) for n in ('scene','ui','storage')}
assert native.startswith('PASS') and all(v.get('pass') for v in suites.values()),'Missing passing test evidence'
sha=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
metadata={'version':'0.4.0-preview','source_sha':sha,'distribution':'standalone','live_fivem_tested':False,'framework7':'9.1.3'}
(root/'build.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
files=sorted(p for p in root.rglob('*') if p.is_file() and 'test-evidence' not in p.parts and p.name!='SHA256SUMS.txt')
sums={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
(root/'SHA256SUMS.txt').write_text(''.join(h+'  '+n+'\n' for n,h in sums.items()),encoding='utf-8')
archive=out/'FishingPilot-0.4.0-preview-win-x64.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in files+[root/'SHA256SUMS.txt']:z.write(p,p.relative_to(root).as_posix())
with zipfile.ZipFile(archive) as z:
 for n,h in sums.items():assert hashlib.sha256(z.read(n)).hexdigest()==h,n
report=dict(metadata,windows_self_test=native,tests=suites,archive_roundtrip_verified=True,runtime_file_count=len(files),archive_sha256=hashlib.sha256(archive.read_bytes()).hexdigest())
(out/'FishingPilot-0.4.0-verification.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
(out/'FishingPilot-0.4.0-native-ui.png').write_bytes((root/'test-evidence/ui.png').read_bytes())
(out/'FishingPilot-0.4.0-storage-ui.png').write_bytes((evidence/'ui/storage-1160.png').read_bytes())
subprocess.run(['git','archive','--format=zip','-o',str(out/'FishingPilot-0.4.0-preview-source.zip'),'HEAD','portable'],check=True)
print(json.dumps(report,ensure_ascii=False,indent=2))
