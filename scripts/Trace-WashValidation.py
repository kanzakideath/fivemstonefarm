from pathlib import Path
R=Path(__file__).resolve().parents[1]
p=R/'src/mining-auto.ahk'
b=p.read_bytes();s=b.decode('utf-8-sig').replace('\r\n','\n')
def once(a,c):
 global s
 if s.count(a)!=1:raise RuntimeError('Unexpected phase boundary: '+a[:90])
 s=s.replace(a,c)
# Compiled AHK passes interpreter-only switches through as ordinary arguments.
# A parsed --validate flag must never fall through to the interactive UI simply
# because another argument precedes it. No validation assertion is bypassed.
once('if A_Args.Length && A_Args[1] = "--validate" {','if isValidationRun {')
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
