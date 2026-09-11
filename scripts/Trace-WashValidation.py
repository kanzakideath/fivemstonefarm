from pathlib import Path
R=Path(__file__).resolve().parents[1]
p=R/'src/mining-auto.ahk'
b=p.read_bytes();s=b.decode('utf-8-sig').replace('\r\n','\n')
def once(a,c):
 global s
 if s.count(a)!=1:raise RuntimeError('Unexpected phase boundary: '+a[:90])
 s=s.replace(a,c)
once('if A_Args.Length && A_Args[1] = "--validate" {','if isValidationRun {')
# A release-marker substitution changed both input and expected output of this
# old version test to 9.1.10. Keep the actual increment/carry test release-neutral.
once('VisualFixtureNewerVersion("9.1.10") = "9.1.10"', 'VisualFixtureNewerVersion("12.34.99") = "12.34.100"')
once('    OnError(ValidationFatalError)', '    OnError(ValidationFatalError)\nif isValidationRun\n    FileAppend "VALIDATION_PHASE entry " A_Args.Length "`n", "**", "UTF-8-RAW"')
for label,needle in [
 ('proofs','    if !ValidateStorageCycleProof() || !ValidateStationaryWorkflow() {'),
 ('updater','    updaterCapabilities := RunUpdaterCapabilities()'),
 ('inventory-tests','    testWashOutputLedger := NewExactInventoryCountMap()'),
 ('reward-wal','    testRewardReloadedWalOk := LoadVerifiedRewardWal(testRewardWalPath,'),
 ('mode-workflows','    testMiningWorkflowOk := RunFarmStorageResumeModeMockTest("mining", 100,'),
 ('final-checks','    exitCode := !FileExist(State.buttonTemplates[1].path) ? 11'),
 ('final-result','    if exitCode = 0 && (CompletionPhrase("mining") != "石掘りが終わったよ"')]:
 once(needle,'    FileAppend "VALIDATION_PHASE '+label+' " A_TickCount "`n", "**", "UTF-8-RAW"\n'+needle)
p.write_bytes((b'\xef\xbb\xbf' if b.startswith(b'\xef\xbb\xbf') else b'')+s.encode('utf-8'))
p=R/'scripts/Build.ps1';b=p.read_bytes();s=b.decode('utf-8-sig').replace('\r\n','\n')
a="-ArgumentList @('/ErrorStdOut=UTF-8', $testMode)"
if s.count(a)!=1:raise RuntimeError('Compiled test launch boundary missing')
s=s.replace(a,'-ArgumentList $testMode')
p.write_bytes((b'\xef\xbb\xbf' if b.startswith(b'\xef\xbb\xbf') else b'')+s.encode('utf-8'))
# Explicitly bind each failure case rather than referencing a loop-local through
# an AHK callback. Keep all four injected failures and the pre-cancel assertion.
p=R/'src/exe-route-navigation.ahk';b=p.read_bytes();s=b.decode('utf-8-sig').replace('\r\n','\n')
a='        probe := (name, *) => (trace.Push(name), trace.Length != failAt)'
if s.count(a)!=1:raise RuntimeError('Stationary probe closure missing')
s=s.replace(a,'        probe := StationaryWorkflowTestProbe.Bind(trace, failAt)')
a='    result := EvaluateStationarySpot(() => false, (*) => calls.Push("work"),\n        (*) => calls.Push("cargo"), (*) => calls.Push("close"))'
c='    result := EvaluateStationarySpot(() => false, StationaryWorkflowTestProbe.Bind(calls, 0, "work"),\n        StationaryWorkflowTestProbe.Bind(calls, 0, "cargo"), StationaryWorkflowTestProbe.Bind(calls, 0, "close"))'
if s.count(a)!=1:raise RuntimeError('Stationary cancel closure missing')
s=s.replace(a,c)
a='ValidateStationaryWorkflow() {'
if s.count(a)!=1:raise RuntimeError('Stationary test function missing')
s=s.replace(a,'StationaryWorkflowTestProbe(trace, failAt, name, *) {\n    trace.Push(name)\n    return trace.Length != failAt\n}\n\n'+a)
p.write_bytes((b'\xef\xbb\xbf' if b.startswith(b'\xef\xbb\xbf') else b'')+s.encode('utf-8'))
