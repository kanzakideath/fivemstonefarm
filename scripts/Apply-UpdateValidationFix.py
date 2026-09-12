from pathlib import Path
import hashlib
import re

root = Path(__file__).resolve().parents[1]
p = root / 'src/mining-auto.ahk'
b = p.read_bytes()
if hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest() != '69f1d958732cc46bc6165470c50230cc9124bd0f':
    raise RuntimeError('Unexpected application baseline; do not overwrite concurrent changes')
s = b.decode('utf-8-sig').replace('\r\n', '\n')
s, n = re.subn(r'(?m)^(\s*)FileAppend ("VALIDATION_PHASE [^\n]+)$', r'\1try FileAppend \2', s)
if n != 8:
    raise RuntimeError(f'Expected eight diagnostic-only writes; found {n}')
# Do not weaken assertions or the nonzero fatal error handler. Only diagnostic
# writes may fail harmlessly when the old GUI updater supplies no stderr handle.
s = s.replace('if isValidationRun\n    try FileAppend "VALIDATION_PHASE entry',
    '; GUI updaters may have no stderr handle. Logging must not fail validation.\nif isValidationRun\n    try FileAppend "VALIDATION_PHASE entry', 1)
for old, new in [
    ('settingsPath := isUiTestRun\n', 'settingsPath := isUiTestRun || isValidationRun\n'),
    ('if !FileExist(settingsPath) && FileExist(legacySettingsPath) {',
     'if !isUiTestRun && !isValidationRun\n    && !FileExist(settingsPath) && FileExist(legacySettingsPath) {')
]:
    if s.count(old) != 1: raise RuntimeError('Unexpected settings boundary: '+old)
    s = s.replace(old, new)
s = s.replace('global AppVersion := "9.1.10"', 'global AppVersion := "9.1.11"', 1)
p.write_bytes((b'\xef\xbb\xbf' if b.startswith(b'\xef\xbb\xbf') else b'') + s.encode('utf-8'))
for name in ['README.md','src/README.md','docs/AI採掘機_使い方.txt','config/AI採掘機.ini','src/ui-web/package.json','src/ui-web/package-lock.json']:
    p = root/name
    b = p.read_bytes()
    if b'9.1.10' not in b: raise RuntimeError('Missing release marker: '+name)
    p.write_bytes(b.replace(b'9.1.10', b'9.1.11'))
p = root/'src/ui-web/src/app.js'
b = p.read_bytes()
if b.count(b"version: '9.1.10'") != 1: raise RuntimeError('Unexpected deterministic UI fixture')
p.write_bytes(b.replace(b"version: '9.1.10'", b"version: '9.1.11'"))
p = root/'scripts/Test-UpdateStartup.ps1'
s = p.read_text(encoding='utf-8')
old = '[Storage]`nMinimumFreeWeight=1234`nTriggerPercent=55`n'
new = '[VehicleStorage]`nMinimumFreeWeight=1234`nEstimatedRewardWeight=500`nStorageTriggerPercent=55`nMinimumFreeSlots=3`n'
if s.count(old) != 1: raise RuntimeError('Unexpected startup fixture')
p.write_text(s.replace(old,new), encoding='utf-8', newline='\n')
p = root/'scripts/Build.ps1'
b = p.read_bytes(); s = b.decode('utf-8-sig').replace('\r\n','\n')
needle = 'Assert-X64PortableExecutable -Path $outputExe\n'
if s.count(needle) != 1: raise RuntimeError('Unexpected compiled build boundary')
s = s.replace(needle,
    '# Match the installed GUI updater, not only CI with redirected streams.\n'
    '& (Join-Path $PSScriptRoot \'Test-UpdateStartup.ps1\') -ExecutablePath $outputExe\n\n'+needle)
p.write_bytes((b'\xef\xbb\xbf' if b.startswith(b'\xef\xbb\xbf') else b'')+s.encode('utf-8'))
print('Only validation diagnostics/settings isolation, regression wiring and current version markers changed.')
