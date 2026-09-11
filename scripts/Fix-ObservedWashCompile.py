from pathlib import Path
import hashlib
R=Path(__file__).resolve().parents[1]
p=R/'src/wash-position/WashPosition.cs'
s=p.read_text(encoding='utf-8')
expected='451fcced7bdb9ac4097b4d48b8e5959f7856bf0147e4b8a470649e8afc1ff4cb'
if hashlib.sha256(p.read_bytes()).hexdigest()!=expected:raise RuntimeError('Unexpected helper source')
for a,b in [('sealed class Anchor','sealed class PositionAnchor'),('new Anchor {','new PositionAnchor {'),('Anchor anchor=Json.Deserialize<Anchor>','PositionAnchor anchor=Json.Deserialize<PositionAnchor>')]:
 if s.count(a)!=1:raise RuntimeError('Unexpected DTO boundary')
 s=s.replace(a,b)
p.write_text(s,encoding='utf-8',newline='\n')
if hashlib.sha256(p.read_bytes()).hexdigest()!='eccf3b02e23f234602513860d46fad4da7a78f90992ec63b21d4879945e57123':raise RuntimeError('Compiled helper source differs from audited correction')
# The prior assertion assumes all washing uses the legacy forced-pitch branch.
# Retain its return/discard proof for that branch and independently require the
# observed-anchor failure guard to precede baseline capture and target dispatch.
p=R/'scripts/Test-FarmRecoverySafetyContract.ps1'
b=p.read_bytes();s=b.decode('utf-8-sig').replace('\r\n','\n')
a="    $failureGuard = 'if\\s+!EnsureWorkViewDown\\(expectedGeneration,\\s*\"' +"
replacement="""    $conditionPrefix = if ($modeContract.Name -eq 'washing') {
        'if\\s+!Config\\.washForwardCorrection\\s+&&\\s+'
    } else { 'if\\s+' }
    $failureGuard = $conditionPrefix + '!EnsureWorkViewDown\\(expectedGeneration,\\s*"' +"""
if s.count(a)!=1:raise RuntimeError('Legacy failure guard boundary missing')
s=s.replace(a,replacement)
s+=r'''
# Observed washing must stop before baseline/click on missing visual anchor.
Assert-Contract ($washAttempt -match 'if\s+!EnsureObservedWashAnchor\(expectedGeneration\)\s*\r?\n\s*return' -and
    $washAttempt.IndexOf('EnsureObservedWashAnchor(') -lt $washAttempt.IndexOf('CaptureFarmAttemptBaseline(')) `
    'Observed washing can capture/click after visual anchor preparation failed.'
$washCorrection = Get-AhkFunctionBody 'PerformWashCompletionCorrection'
Assert-Contract ($washCorrection -match 'IsTargetForeground' -and $washCorrection -match 'RunObservedWashHelper\("wash-correct"' -and
    $washCorrection -match 'WASH_STABLE' -and $washCorrection -notmatch 'play-route-health') `
    'Observed washing lost its foreground/visual confirmation gate.'
'''
p.write_bytes((b'\xef\xbb\xbf' if b.startswith(b'\xef\xbb\xbf') else b'')+s.encode('utf-8'))
