#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$SourcePath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$sourceCandidate = if ([string]::IsNullOrWhiteSpace($SourcePath)) {
    Join-Path $PSScriptRoot '..\src\mining-auto.ahk'
} else {
    $SourcePath
}
$resolvedSource = [System.IO.Path]::GetFullPath($sourceCandidate)
if (-not (Test-Path -LiteralPath $resolvedSource -PathType Leaf)) {
    throw "Camera recovery source was not found: $resolvedSource"
}
$source = Get-Content -LiteralPath $resolvedSource -Raw

function Assert-Contract {
    param(
        [Parameter(Mandatory)] [bool]$Condition,
        [Parameter(Mandatory)] [string]$Message
    )
    if (-not $Condition) { throw $Message }
}

function Get-AhkFunctionBody {
    param([Parameter(Mandatory)] [string]$Name)

    $match = [regex]::Match($source,
        '(?m)^' + [regex]::Escape($Name) + '\s*\([^)]*\)\s*\{')
    if (-not $match.Success) { throw "AHK function was not found: $Name" }

    $open = $source.IndexOf('{', $match.Index)
    $depth = 0
    for ($index = $open; $index -lt $source.Length; $index++) {
        if ($source[$index] -eq '{') { $depth++ }
        elseif ($source[$index] -eq '}') {
            $depth--
            if ($depth -eq 0) {
                return $source.Substring($open + 1, $index - $open - 1)
            }
        }
    }
    throw "AHK function has no closing brace: $Name"
}

$maintain = Get-AhkFunctionBody 'MaintainBackgroundWorkView'
$sendCamera = Get-AhkFunctionBody 'SendForegroundCameraDown'
$sendRelative = Get-AhkFunctionBody 'SendRelativeMouseDelta'
$confirm = Get-AhkFunctionBody 'ConfirmWorkViewTarget'
$markNoEffect = Get-AhkFunctionBody 'MarkWorkViewNoEffect'
$probe = Get-AhkFunctionBody 'ProbeWorkTarget'
$recovery = Get-AhkFunctionBody 'RunFarmRecoveryCycle'
$recoverLocal = Get-AhkFunctionBody 'RecoverLocalWorkTarget'
$markClicked = Get-AhkFunctionBody 'MarkPendingFarmAttemptClicked'
$readDirection = Get-AhkFunctionBody 'ReadViewDirectionSetting'
$overlay = Get-AhkFunctionBody 'RuntimeStatusOverlayDebug'

# A DevCon socket write is transport acknowledgement only. It must never be the
# camera-success path again.
Assert-Contract ($maintain -notmatch 'play-route-health|WorkViewDownRoute|RunBackgroundBridge') `
    'Camera maintenance regressed to a DevCon/route transport result.'
Assert-Contract ($maintain -notmatch 'workViewStatus\s*:=\s*"TARGET_OK"') `
    'Camera input dispatch incorrectly marks the target as verified.'
Assert-Contract ($maintain -notmatch 'ConfirmWorkViewTarget\(' -and
    $sendCamera -notmatch 'ConfirmWorkViewTarget\(') `
    'Dispatching relative input must not indirectly confirm the camera target.'

$foregroundIndex = $maintain.IndexOf('!WinActive("ahk_id " State.targetHwnd)')
$waitIndex = $maintain.IndexOf('State.workViewStatus := "WAIT_FG"')
$sendIndex = $maintain.IndexOf('SendForegroundCameraDown(')
$sentIndex = $maintain.IndexOf('State.workViewStatus := "INPUT_SENT"')
Assert-Contract ($foregroundIndex -ge 0 -and $waitIndex -gt $foregroundIndex) `
    'WAIT_FG must be selected after the explicit FiveM foreground guard.'
Assert-Contract ($sendIndex -gt $waitIndex -and $sentIndex -gt $sendIndex) `
    'INPUT_SENT must be recorded only after the foreground camera adapter runs.'

Assert-Contract ($sendCamera -match 'IsTargetForeground\(expectedGeneration\)') `
    'Every real camera pulse must retain the FiveM foreground/identity guard.'
Assert-Contract ($sendCamera -match 'SendRelativeMouseDelta\(0,\s*step\s*\*\s*direction\)') `
    'Camera correction is not using the relative mouse adapter.'
Assert-Contract ($sendCamera -match 'direction\s*:=\s*direction\s*<\s*0\s*\?\s*-1\s*:\s*1') `
    'Camera direction must be normalized before relative input is dispatched.'
Assert-Contract ($sendCamera -match '(?s)Critical\s+"On".*?IsTargetForeground\(expectedGeneration\).*?SendRelativeMouseDelta\(') `
    'F9 can interrupt between the final foreground check and physical camera input.'
Assert-Contract ($sendRelative -match 'user32\\SendInput') `
    'Relative camera input no longer uses SendInput.'
Assert-Contract ($sendRelative -match '0x0001') `
    'Relative camera input is missing MOUSEEVENTF_MOVE.'
Assert-Contract ($sendRelative -notmatch 'SetCursorPos|PostMessage|0x8000|MOUSEEVENTF_ABSOLUTE') `
    'Camera input must not fall back to absolute cursor coordinates or WM_MOUSEMOVE.'

# TARGET_OK is an observed target result, never a successful input return value.
$targetOkAssignments = [regex]::Matches(
    $source, 'workViewStatus\s*:=\s*"TARGET_OK"').Count
Assert-Contract ($targetOkAssignments -eq 1) `
    'TARGET_OK must have exactly one assignment site.'
Assert-Contract ($confirm -match 'workViewStatus\s*:=\s*"TARGET_OK"') `
    'The target-confirmation function no longer owns TARGET_OK.'
Assert-Contract ($confirm -match 'lastWorkViewVerifiedAt\s*:=' -and
    $confirm -match 'workViewFailures\s*:=\s*0') `
    'A verified target must record its time and clear camera failures.'
Assert-Contract ($probe -match 'IsCurrentRun\(expectedGeneration\)' -and
    $probe -match 'ConfirmWorkViewTarget\(actionMode,\s*"probe",\s*expectedGeneration\)') `
    'ProbeWorkTarget must confirm the camera only after a PRESENT result.'
Assert-Contract ($confirm -match 'IsCurrentRun\(expectedGeneration\)' -and
    $confirm -match 'Critical\s+"On"') `
    'A late probe can restore TARGET_OK after F9 stopped its generation.'
Assert-Contract ($markClicked -match 'IsCurrentRun\(expectedGeneration\)' -and
    $markClicked -match 'ConfirmWorkViewTarget\(actionMode,\s*"action_click",\s*expectedGeneration\)') `
    'A late action-click result can restore TARGET_OK after F9.'

Assert-Contract ($markNoEffect -match
    'if\s+State\.workViewStatus\s*=\s*"INPUT_SENT"') `
    'No-effect handling must distinguish an unverified dispatched input.'
Assert-Contract ($markNoEffect -match 'workViewStatus\s*:=\s*"FAILED"') `
    'A missing target after INPUT_SENT must become FAILED, not TARGET_OK.'
Assert-Contract ($markNoEffect -match 'IsCurrentRun\(expectedGeneration\)') `
    'A late missing-target result can overwrite the stopped/new run camera state.'

# One recovery cycle may dispatch exactly one camera burst. Positional correction
# receives cameraAlreadySent=true and therefore must not stack another burst.
Assert-Contract (([regex]::Matches(
    $recovery, 'MaintainBackgroundWorkView\(')).Count -eq 1) `
    'RunFarmRecoveryCycle dispatches more than one camera burst per attempt.'
Assert-Contract ($recovery -match
    'RecoverLocalWorkTarget\(expectedGeneration,\s*cameraDispatched\)') `
    'Recovery no longer tells positional correction that the camera burst was sent.'
Assert-Contract ($recoverLocal -match
    'Config\.workViewLock\s*&&\s*!cameraAlreadySent') `
    'RecoverLocalWorkTarget can stack a second camera burst in one recovery attempt.'
Assert-Contract ($recovery -match '(?s)MaintainBackgroundWorkView\(expectedGeneration,\s*true\).*?IsCurrentFarmTask\(expectedGeneration,\s*expectedTaskId,\s*"RECOVERY"\).*?targetRecoveryAttempts\s*\+=\s*1') `
    'F9 can leave a stale target-recovery attempt after camera dispatch.'
Assert-Contract ($maintain -match '(?s)Critical\s+"On".*?IsCurrentRun\(expectedGeneration\).*?lastWorkViewAt\s*:=.*?workViewStatus\s*:=\s*"INPUT_SENT".*?Critical\s+"Off"') `
    'INPUT_SENT is not atomically committed against the active generation.'

# Direction is a normalized persisted setting; runtime alternation starts from it.
Assert-Contract ($source -match
    'workViewMouseDirection:\s*ReadViewDirectionSetting\(settingsPath\)') `
    'MouseDirection is not loaded into the runtime configuration.'
Assert-Contract ($source -match
    'IniWrite\s+Config\.workViewMouseDirection,\s*temporarySettingsPath,\s*"ViewLock",\s*"MouseDirection"') `
    'MouseDirection is not preserved by atomic settings save.'
Assert-Contract ($source -match
    'workViewDirection:\s*Config\.workViewMouseDirection') `
    'The runtime camera direction does not initialize from MouseDirection.'
Assert-Contract ($readDirection -match 'return\s+value\s*>\s*0\s*\?\s*1\s*:\s*-1') `
    'MouseDirection is not normalized to a safe +/-1 value.'

foreach ($mapping in @(
        @('TARGET_OK', 'TARGET_OK'),
        @('INPUT_SENT', 'VERIFY'),
        @('WAIT_FG', 'WAIT_FG'),
        @('FAILED', 'FAILED'))) {
    Assert-Contract ($overlay.Contains('cameraState = "' + $mapping[0] + '"') -and
        $overlay.Contains('"' + $mapping[1] + '"')) `
        "Camera overlay state is not distinct: $($mapping[0])"
}

Write-Host 'Camera recovery source contract tests passed.'
