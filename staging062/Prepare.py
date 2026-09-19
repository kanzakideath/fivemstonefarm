from pathlib import Path
p=Path('staging062');old=Path('staging061')
s=(old/'RunCase.ps1').read_text(encoding='utf-8-sig').replace('artifacts/fishing061','artifacts/fishing062').replace("(Join-Path $PSScriptRoot 'Integration.cs')","(Join-Path $root 'staging061/Integration.cs')")
(p/'RunCase.ps1').write_text(s,encoding='utf-8')
s=(old/'Fixture.py').read_text(encoding='utf-8-sig').replace('import asyncio,json,argparse','import asyncio,json,argparse,subprocess,atexit')
s=s.replace("urls=['nui:","runtime=subprocess.Popen(['node',str(Path(__file__).with_name('Runtime.cjs'))],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True,encoding='utf-8')\natexit.register(runtime.terminate)\nurls=['nui:")
a="""    value=json.dumps(inv if '__fpInventory060' in expression else scene,ensure_ascii=False)
    result={'result':{'type':'string','value':value}}"""
b="""    if '__fpInventory060' in expression:
     query={'expression':expression,'mode':(root/'mode.txt').read_text().strip(),'done':(root/'digit.sent').exists()}
     runtime.stdin.write(json.dumps(query,ensure_ascii=False)+'\\n');runtime.stdin.flush()
     result=json.loads(runtime.stdout.readline())
     with (root/'js-evaluations.jsonl').open('a',encoding='utf-8') as log:
      log.write(json.dumps({'type':result['result'].get('type'),'exception':result.get('exceptionDetails'),'installed':('addEventListener' in expression)},ensure_ascii=False)+'\\n')
    else:result={'result':{'type':'string','value':json.dumps(scene,ensure_ascii=False)}}"""
assert a in s
(p/'Fixture.py').write_text(s.replace(a,b),encoding='utf-8')
