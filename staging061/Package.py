from pathlib import Path
import json
cases={}
for name in ['before','after','left-null','full','inventory-open']:
    cases[name]=json.loads(Path('artifacts/fishing061/integration',name,'RESULT.json').read_text(encoding='utf-8-sig'))
    assert cases[name].get('pass'),('Integration failed',name,cases[name])
assert cases['before']['rod_down']==0 and cases['before']['expected_blocked']
assert cases['after']['rod_down']>=1 and cases['after']['digit_down']==1 and cases['after']['results']>=1
for name in ['after','left-null','full','inventory-open']:
    assert cases[name]['json_traversal_ok'] and cases[name]['arraylist_traversal_ok'],('Frame traversal failed',name)
for name in ['left-null','full','inventory-open']:
    assert cases[name]['rod_down']==0 and cases[name]['expected_blocked'],('Guard removed',name)
# Never include the local simulated game in the user distribution.
Path('portable/dist/FiveM-FishingPilot-Integration.exe').unlink(missing_ok=True)
source=Path('portable/Package060.py').read_text(encoding='utf-8-sig').replace('fishing060','fishing061').replace('0.6.0','0.6.1')
source=source.replace("'HEAD','portable']","'HEAD','portable','staging061','.github/workflows/fishing061-build.yml']")
exec(compile(source,'Package061.generated','exec'))
report=Path('artifacts/fishing061-download/FishingPilot-0.6.1-verification.json')
v=json.loads(report.read_text(encoding='utf-8-sig'))
v['startup_before_after_integration']=cases
v['integration_scope']='Windows F5/F6, production Engine and CDP client, local simulated CDP peer, actual SendInput key-down/key-up received by a local fixture. NOT a real FiveM server.'
v['root_cause']='Nullable right container rejected by telemetry decoder; frame traversal was restricted to object[] instead of accepting ArrayList.'
report.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS: baseline reproduces startup stall, patched engine completes fixture fishing cycle, all three blocking guards preserved')
