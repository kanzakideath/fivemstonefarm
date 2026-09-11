from pathlib import Path
p=Path(__file__).resolve().parents[1]/'src/mining-auto.ahk'
b=p.read_bytes();s=b.decode('utf-8-sig').replace('\r\n','\n')
def once(a,c):
 global s
 if s.count(a)!=1:raise RuntimeError('Unexpected phase boundary: '+a[:90])
 s=s.replace(a,c)
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
