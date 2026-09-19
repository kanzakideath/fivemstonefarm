from pathlib import Path
import json
cases={}
for name in ['before','after','left-null','full','inventory-open']:
 p=Path('artifacts/fishing062/integration',name)
 cases[name]=json.loads((p/'RESULT.json').read_text(encoding='utf-8-sig'))
 assert cases[name].get('pass'),('Integration failed',name,cases[name])
 evaluations=[json.loads(x) for x in (p/'js-evaluations.jsonl').read_text(encoding='utf-8').splitlines() if x]
 cases[name]['actual_inventory_javascript_evaluations']=len(evaluations)
 cases[name]['undefined_results']=sum(x['type']=='undefined' for x in evaluations)
 assert evaluations,('Actual JavaScript was not executed',name)
 if name=='before':assert all(x['type']=='undefined' for x in evaluations),'Released ASI failure was not reproduced'
 else:assert all(x['type']=='string' and not x['exception'] for x in evaluations),('Repair did not return real snapshots',name)
assert cases['before']['rod_down']==0 and cases['before']['expected_blocked']
assert cases['after']['rod_down']>=1 and cases['after']['digit_down']==1 and cases['after']['results']>=1
for name in ['left-null','full','inventory-open']:assert cases[name]['rod_down']==0 and cases[name]['expected_blocked'],('Guard bypassed',name)
Path('portable/dist/FiveM-FishingPilot-Integration.exe').unlink(missing_ok=True)
source=Path('portable/Package060.py').read_text(encoding='utf-8-sig').replace('fishing060','fishing062').replace('0.6.0','0.6.2')
source=source.replace("'HEAD','portable']","'HEAD','portable','staging061','staging062','.github/workflows/fishing062-build.yml']")
exec(compile(source,'Package062.generated','exec'))
report=Path('artifacts/fishing062-download/FishingPilot-0.6.2-verification.json')
v=json.loads(report.read_text(encoding='utf-8-sig'))
v['actual_javascript_startup_integration']=cases
v['integration_scope']='Windows F5/F6, production Engine/CDP client and actual inventory expressions executed in Node VM with local DOM/Redux fixtures. Scene responses are simulated. Real Windows key-down/key-up captured. NOT a real FiveM server.'
v['root_cause']='return followed by a multiline comment inserted automatic semicolon: the inventory installer returned undefined before creating the observer. Fixed by parenthesizing the returned script expression.'
report.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS: actual shipped JavaScript failure reproduced before repair; after repair completes a simulated fishing cycle with all inventory guards preserved')
