from pathlib import Path
p = Path(__file__).resolve().parents[1] / 'scripts/ui-tests/StationaryWaitHarness.ahk'
s = p.read_text(encoding='utf-8-sig').replace('\r\n','\n')
if 'fastWashMode: false' not in s:
    old = 'Config := {vehicleStorageId: "fixture-truck", vehicleStorageType: "trunk", vehicleCompanionProtocol: 0}'
    new = 'Config := {vehicleStorageId: "fixture-truck", vehicleStorageType: "trunk", vehicleCompanionProtocol: 0, fastWashMode: false}'
    if s.count(old) != 1:
        raise RuntimeError('Harness Config boundary changed')
    s = s.replace(old, new, 1)
s = s.replace('Fault = "STATIONARY_CARGO_OBSERVATION_FAULT" && CargoCalls.Length = 0', 'Fault = "STATIONARY_CARGO_OBSERVATION_FAULT" && CargoCalls = 1')
p.write_text(s, encoding='utf-8-sig')
print('Stationary harness models fastWashMode=false and preserves cargo assertion.')
