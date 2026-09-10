#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$SourcePath = '',
    [string]$BridgeSourcePath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([String]::IsNullOrWhiteSpace($SourcePath)) {
    $SourcePath = Join-Path $PSScriptRoot '..\src\mining-auto.ahk'
}
if ([String]::IsNullOrWhiteSpace($BridgeSourcePath)) {
    $BridgeSourcePath = Join-Path $PSScriptRoot '..\src\background-bridge\CdpBridge.cs'
}

$resolvedSource = [System.IO.Path]::GetFullPath($SourcePath)
if (-not (Test-Path -LiteralPath $resolvedSource -PathType Leaf)) {
    throw "Farm recovery source was not found: $resolvedSource"
}
$source = Get-Content -LiteralPath $resolvedSource -Raw -Encoding UTF8
$resolvedBridgeSource = [System.IO.Path]::GetFullPath($BridgeSourcePath)
if (-not (Test-Path -LiteralPath $resolvedBridgeSource -PathType Leaf)) {
    throw "Farm recovery bridge source was not found: $resolvedBridgeSource"
}
$bridgeSource = Get-Content -LiteralPath $resolvedBridgeSource -Raw -Encoding UTF8

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

function Find-AhkImplicitCallContinuations {
    param([Parameter(Mandatory)] [string]$Text)

    # In AHK v2 an operand followed by a parenthesized expression is a call. A
    # visually tempting implicit concatenation such as:
    #
    #     recoveryAttempt
    #         ("/3")
    #
    # therefore invokes Integer.Call at runtime. Keep this check generic so the
    # same failure cannot move from one counter/status message to another.
    $lines = [regex]::Split($Text, '\r?\n')
    $findings = [System.Collections.Generic.List[string]]::new()
    $groupDepth = 0
    for ($index = 0; $index + 1 -lt $lines.Count; $index++) {
        $current = $lines[$index]
        $next = $lines[$index + 1]
        $structural = [regex]::Replace($current,
            '"(?:``.|""|[^"])*"|;.*$', '')
        foreach ($character in $structural.ToCharArray()) {
            if ($character -eq '(' -or $character -eq '[') { $groupDepth++ }
            elseif ($character -eq ')' -or $character -eq ']') {
                $groupDepth = [Math]::Max(0, $groupDepth - 1)
            }
        }
        if ($current -match '^\s*;' -or $next -match '^\s*;') { continue }

        # Direct operand + newline + '(' is always call syntax, even if the
        # author intended to concatenate a parenthesized status fragment.
        if ($next -match '^\s*\(' -and $current -match
            '(?<operand>\b(?:[A-Za-z_]\w*(?:\.[A-Za-z_]\w*|\[[^\]\r\n]+\])*)|[0-9]+)\s*$') {
            $findings.Add(('line {0}: {1} / {2}' -f ($index + 1),
                    $matches['operand'], $next.Trim()))
            continue
        }

        # The production crash used the other deceptive form: a complete
        # assignment followed by a more-indented bare value. AHK starts a new
        # expression there instead of extending the preceding string. Inside an
        # open (...) or [...] argument list the same layout is valid, so exclude
        # those structurally continued lines.
        $currentIndent = ([regex]::Match($current, '^\s*')).Length
        $nextIndent = ([regex]::Match($next, '^\s*')).Length
        $currentTrimmed = $current.TrimEnd()
        $nextToken = [regex]::Match($next,
            '^\s*(?<token>\(|"|[0-9]|[A-Za-z_][A-Za-z0-9_]*)')
        $controlLine = $current -match
            '^\s*(?:if|else|while|for|switch|case|try|catch|finally|class)\b'
        $nextIsControl = $nextToken.Success -and $nextToken.Groups['token'].Value -match
            '^(?:if|else|while|for|switch|case|return|throw|try|catch|finally|break|continue)$'
        $trailingContinuation = $currentTrimmed -match
            '(?:\.|,|:|\?|\+|-|\*|/|&&|\|\||\(|\[|:=|=)\s*$'
        if ($groupDepth -eq 0 -and $current -match ':=' -and
            $currentTrimmed.EndsWith('"', [StringComparison]::Ordinal) -and
            $nextIndent -gt $currentIndent -and $nextToken.Success -and
            -not $controlLine -and -not $nextIsControl -and
            -not $trailingContinuation) {
            $findings.Add(('line {0}: detached value {1} / {2}' -f
                    ($index + 1), $nextToken.Groups['token'].Value,
                    $next.Trim()))
        }
    }
    return @($findings)
}

# Prove the scanner catches both concrete forms that escaped the previous
# contracts, then apply it to every source line (not just those two variables).
$integerCallFixture = @'
label := "attempt "
    recoveryAttempt "/3"
detail := "probe "
    State.capacityProbeFailures "/3"
'@
$fixtureFindings = @(Find-AhkImplicitCallContinuations $integerCallFixture)
Assert-Contract ($fixtureFindings.Count -eq 2) `
    'The Integer.Call regression scanner no longer recognizes its two fixtures.'
$implicitCallFindings = @(Find-AhkImplicitCallContinuations $source)
Assert-Contract ($implicitCallFindings.Count -eq 0) `
    ('AHK contains a newline implicit-concatenation that can execute *.Call: ' +
        ($implicitCallFindings -join '; '))
Assert-Contract (([regex]::Matches($source, '\.Call\(\)')).Count -eq 3 -and
    ([regex]::Matches($source,
        'IsObject\([^\r\n]+\)\s*&&\s*HasMethod\([^\r\n]+,\s*"Call"\)[\s\S]{0,80}\.Call\(\)')).Count -eq 3) `
    'Every deliberate callback invocation must prove that the object implements Call.'

$recovery = Get-AhkFunctionBody 'RunFarmRecoveryCycle'
$enterRecovery = Get-AhkFunctionBody 'EnterFarmRecovery'
$preflightFailure = Get-AhkFunctionBody 'HandleFarmRecoveryPreflightFailure'
$preflightPolicy = Get-AhkFunctionBody 'RecoveryPreflightAction'
$restart = Get-AhkFunctionBody 'RestartFarmAfterRecoveryExhausted'
$restartPolicy = Get-AhkFunctionBody 'RecoveryRestartAllowed'
$releaseInputs = Get-AhkFunctionBody 'ReleaseAllInputs'
$releaseAlt = Get-AhkFunctionBody 'ReleaseAlt'
$releaseRight = Get-AhkFunctionBody 'ReleaseRight'
$releaseLeft = Get-AhkFunctionBody 'ReleaseLeft'
$releaseFood = Get-AhkFunctionBody 'ReleaseFood'

# Recovery is a bounded state machine. Exhaustion must have one owner, release
# every input channel first, and then make exactly one restart-or-stop decision.
Assert-Contract ($recovery -match
    'targetRecoveryAttempts\s*>=\s*[1-9][0-9]*[\s\S]{0,500}RestartFarmAfterRecoveryExhausted\(expectedGeneration,') `
    'Target recovery is not bounded by a finite attempt limit.'
Assert-Contract (([regex]::Matches($recovery,
    'RestartFarmAfterRecoveryExhausted\(')).Count -eq 1) `
    'One recovery exhaustion can request restart/stop more than once.'
Assert-Contract ($recovery -match
    'if\s+!ReleaseBackgroundTarget\(true\)\s*\{[\s\S]{0,260}HandleFarmRecoveryPreflightFailure\(expectedGeneration,\s*\r?\n?\s*expectedTaskId,\s*"release_background_target"' -and
    $recovery -match
    'if\s+closeResult\s*!=\s*"CLOSED"\s*\{[\s\S]{0,260}HandleFarmRecoveryPreflightFailure\(expectedGeneration,\s*\r?\n?\s*expectedTaskId,\s*"close_inventory"') `
    'Recovery input release or inventory close can still retry outside the bounded preflight owner.'
Assert-Contract ($enterRecovery -notmatch
    'ReleaseBackgroundTarget\(|RunBackgroundBridge\(' -and
    $enterRecovery -match 'State\.recoveryPreflightFailures\s*:=\s*0') `
    'Recovery entry performs an uncounted background preflight or does not reset the episode counter.'
Assert-Contract ($preflightPolicy -match
    'failureCount\s*<\s*3[\s\S]{0,80}return\s+"RETRY"' -and
    $preflightPolicy -match
    'RecoveryRestartAllowed\(restartCount,\s*restartPending\)[\s\S]{0,80}\?\s*"RESTART"\s*:\s*"STOP"') `
    'Recovery preflight policy is not a finite retry/restart/stop decision.'
Assert-Contract ($preflightFailure -match
    'State\.recoveryPreflightFailures\s*\+=\s*1' -and
    $preflightFailure -match
    'RecoveryPreflightAction\(failureCount,\s*restartCount,\s*\r?\n?\s*restartPending\)' -and
    $preflightFailure -match
    'action\s*=\s*"RETRY"[\s\S]{0,350}ScheduleNext\(expectedGeneration,\s*500\)' -and
    $preflightFailure -match
    'action\s*=\s*"RESTART"[\s\S]{0,260}RestartFarmAfterRecoveryExhausted\(expectedGeneration,' -and
    $preflightFailure -match 'StopAutomationWithFault\(') `
    'Recovery preflight exhaustion is not owned by one bounded restart-or-stop handler.'
Assert-Contract ($source -match
    'RecoveryPreflightAction\(1,\s*0,\s*false\)[\s\S]{0,100}=\s*"RETRY"' -and
    $source -match
    'RecoveryPreflightAction\(3,\s*0,\s*false\)\s*=\s*"RESTART"' -and
    $source -match
    'RecoveryPreflightAction\(3,\s*1,\s*false\)\s*=\s*"STOP"' -and
    $source -match
    'RecoveryPreflightAction\(3,\s*0,\s*true\)\s*=\s*"STOP"') `
    'Compiled --validate no longer covers repeated release/close preflight failure decisions.'
Assert-Contract ($restartPolicy -match
    'return\s+restartCount\s*<\s*1\s*&&\s*!restartPending' -and
    $source -match
    'RecoveryRestartAllowed\(0,\s*false\)[\s\S]{0,100}!RecoveryRestartAllowed\(1,\s*false\)[\s\S]{0,100}!RecoveryRestartAllowed\(0,\s*true\)') `
    'Compiled --validate no longer exercises the finite one-restart policy.'
Assert-Contract ($restart -match
    'IsCurrent(?:FarmTask|Run)\(expectedGeneration' -and
    $restart -match
    'RecoveryRestartAllowed\(State\.recoveryRestartCount,\s*\r?\n?\s*State\.recoveryRestartPending\)' -and
    $restart -match 'State\.recoveryRestartPending\s*:=\s*true' -and
    $restart -match 'State\.recoveryRestartCount\s*\+=\s*1') `
    'Recovery restart lacks active-generation ownership or an at-most-once latch.'

$cancelIndex = $restart.IndexOf('CancelActiveBridgeProcess(',
    [StringComparison]::Ordinal)
$releaseIndex = $restart.IndexOf('ReleaseAllInputs(',
    [StringComparison]::Ordinal)
$targetReleaseIndex = $restart.IndexOf('ReleaseBackgroundTarget(true)',
    [StringComparison]::Ordinal)
$transitionIndex = $restart.IndexOf('TransitionFarmState(',
    [StringComparison]::Ordinal)
$scheduleIndex = $restart.IndexOf('ScheduleNext(expectedGeneration,',
    [StringComparison]::Ordinal)
Assert-Contract ($cancelIndex -ge 0 -and $releaseIndex -gt $cancelIndex -and
    $targetReleaseIndex -gt $releaseIndex -and
    $transitionIndex -gt $targetReleaseIndex -and
    $scheduleIndex -gt $transitionIndex) `
    'Recovery exhaustion must cancel helpers and release all inputs before restart/stop.'
Assert-Contract (([regex]::Matches($restart,
    'ScheduleNext\(expectedGeneration,')).Count -eq 1 -and
    $recovery -match
    'if\s+restarted\s*\r?\n\s*return\s*\r?\n\s*StopAutomationWithFault\(') `
    'Recovery exhaustion does not make one exclusive restart-or-stop decision.'
Assert-Contract ($releaseInputs -match 'ReleaseAlt\(\)' -and
    $releaseInputs -match 'ReleaseRight\(\)' -and
    $releaseInputs -match 'ReleaseLeft\(\)' -and
    $releaseInputs -match 'ReleaseFood\(\)' -and
    $releaseAlt -match 'LAlt\s+up' -and
    $releaseRight -match 'RButton\s+up' -and
    $releaseLeft -match 'LButton\s+up' -and
    $releaseFood -match 'Config\.foodKey\s+"[^"]*up[^"]*"') `
    'ReleaseAllInputs no longer releases every foreground mouse/modifier input.'

$ensureDown = Get-AhkFunctionBody 'EnsureWorkViewDown'
$downModeSupported = Get-AhkFunctionBody 'WorkViewDownModeSupported'
$sendCamera = Get-AhkFunctionBody 'SendForegroundCameraDown'
$sendRelative = Get-AhkFunctionBody 'SendRelativeMouseDelta'
$sendBackgroundCamera = Get-AhkFunctionBody 'SendBackgroundCameraDown'
$backgroundDownRoute = Get-AhkFunctionBody 'BackgroundCameraDownRoute'
$washAttempt = Get-AhkFunctionBody 'WashAttemptBackground'
$goldAttempt = Get-AhkFunctionBody 'GoldAttemptBackground'
$dispatcher = Get-AhkFunctionBody 'AutomationCycleOwned'

# Washing and gold must use the physical relative-mouse adapter while foreground.
# Background DevCon delivery remains unverified until the real target is probed.
Assert-Contract ($ensureDown -match 'WorkViewDownModeSupported\(mode\)' -and
    $downModeSupported -match
    'mode\s*=\s*"washing"[\s\S]{0,80}mode\s*=\s*"gold"' -and
    $source -match
    'WorkViewDownModeSupported\("washing"\)[\s\S]{0,100}WorkViewDownModeSupported\("gold"\)[\s\S]{0,100}!WorkViewDownModeSupported\("mining"\)') `
    'The downward-view helper is not explicitly limited to washing/gold.'
Assert-Contract ($ensureDown -match
    'MaintainBackgroundWorkView\(expectedGeneration,\s*true,\s*force\)' -and
    $ensureDown -notmatch 'play-route|RunBackgroundBridge') `
    'The downward-view helper does not use the real foreground camera adapter.'
Assert-Contract ($source -match
    'MaintainBackgroundWorkView\(expectedGeneration,\s*force\s*:=\s*false,[\s\S]{0,120}ignoreVerifiedTarget\s*:=\s*false\)') `
    'Explicit downward alignment cannot bypass a stale TARGET_OK short-circuit.'
$maintain = Get-AhkFunctionBody 'MaintainBackgroundWorkView'
Assert-Contract ($maintain -match 'SendForegroundCameraDown\(') `
    'Work-view maintenance no longer dispatches the physical camera adapter.'
Assert-Contract ($sendCamera -match 'SendRelativeMouseDelta\(' -and
    $sendRelative -match 'user32\\SendInput' -and $sendRelative -match '0x0001') `
    'The downward-view path no longer reaches relative MOUSEEVENTF_MOVE SendInput.'
Assert-Contract ($maintain -match
    '!WinActive\("ahk_id " State\.targetHwnd\)[\s\S]{0,260}SendBackgroundCameraDown\(expectedGeneration' -and
    $sendBackgroundCamera -match
    'RunBackgroundBridgeCancelable\(expectedGeneration,\s*\r?\n\s*"play-route-health"' -and
    $backgroundDownRoute -match '":32"' -and
    $sendBackgroundCamera -notmatch 'ConfirmWorkViewTarget\(') `
    'Background downward input is not a bounded look-down route or incorrectly self-verifies.'
$alignIndex = $ensureDown.IndexOf(
    'MaintainBackgroundWorkView(expectedGeneration, true, force)',
    [StringComparison]::Ordinal)
$successIndex = $ensureDown.LastIndexOf('return true',
    [StringComparison]::Ordinal)
Assert-Contract ($alignIndex -ge 0 -and $successIndex -gt $alignIndex -and
    $ensureDown -notmatch 'ProbeWorkTarget\(|ConfirmWorkViewTarget\(' -and
    $ensureDown -match 'verified=0 proof=deferred_to_try') `
    'Downward alignment must defer proof to try-* instead of duplicating its target scan.'
Assert-Contract ($dispatcher -match
    'if\s+!WorkViewDownModeSupported\(State\.runMode\)\s*\r?\n\s*&&\s*!MaintainBackgroundWorkView\(expectedGeneration\)') `
    'Washing/gold can receive a generic camera pulse immediately before their explicit down alignment.'

# The bound CDP try helper is the proof owner: it must discover the target,
# revalidate the exact frame/server epoch, dispatch the click in that same
# session, and only then expose CLICKED to AHK. This permits removing the costly
# pre-probe without weakening the click proof.
$tryActionStart = $bridgeSource.IndexOf(
    'private static async Task<string> TryActionAsync(',
    [StringComparison]::Ordinal)
$tryActionEnd = $bridgeSource.IndexOf(
    'private static async Task<string> TryAndWaitActionAsync(',
    [Math]::Max(0, $tryActionStart), [StringComparison]::Ordinal)
Assert-Contract ($tryActionStart -ge 0 -and $tryActionEnd -gt $tryActionStart) `
    'The bridge TryActionAsync proof owner was not found.'
$tryAction = $bridgeSource.Substring($tryActionStart,
    $tryActionEnd - $tryActionStart)
$presentIndex = $tryAction.IndexOf(
    'bool present = await session.EvaluateBooleanAsync(',
    [StringComparison]::Ordinal)
$presentGuardIndex = $tryAction.IndexOf('if (present)',
    [Math]::Max(0, $presentIndex), [StringComparison]::Ordinal)
$frameProofIndex = $tryAction.IndexOf(
    '!String.Equals(session.FrameId,', [Math]::Max(0, $presentGuardIndex),
    [StringComparison]::Ordinal)
$epochProofIndex = $tryAction.IndexOf('MatchesServerEpochAsync()',
    [Math]::Max(0, $frameProofIndex), [StringComparison]::Ordinal)
$clickDispatchIndex = $tryAction.IndexOf(
    'clickMayHaveBeenDispatched = true;', [Math]::Max(0, $epochProofIndex),
    [StringComparison]::Ordinal)
$clickEvaluationIndex = $tryAction.IndexOf(
    'clicked = await session.EvaluateBooleanAsync(',
    [Math]::Max(0, $clickDispatchIndex), [StringComparison]::Ordinal)
$clickedGuardIndex = $tryAction.IndexOf('if (clicked)',
    [Math]::Max(0, $clickEvaluationIndex), [StringComparison]::Ordinal)
$clickedResultIndex = $tryAction.IndexOf(
    'return "CLICKED " + actionToken;', [Math]::Max(0, $clickedGuardIndex),
    [StringComparison]::Ordinal)
Assert-Contract ($tryAction -match
    'washingMode\s*\?\s*WashTargetExpression\(false\)\s*:\s*ProbeExpression\(targetLabel,\s*exactOnly\)' -and
    $presentIndex -ge 0 -and $presentGuardIndex -gt $presentIndex -and
    $frameProofIndex -gt $presentGuardIndex -and
    $epochProofIndex -gt $frameProofIndex -and
    $clickDispatchIndex -gt $epochProofIndex -and
    $clickEvaluationIndex -gt $clickDispatchIndex -and
    $clickedGuardIndex -gt $clickEvaluationIndex -and
    $clickedResultIndex -gt $clickedGuardIndex) `
    'try-washing/try-gold can report CLICKED before bound target/frame/epoch proof.'

foreach ($modeContract in @(
        @{ Name = 'washing'; Body = $washAttempt; Command = 'try-washing' },
        @{ Name = 'gold'; Body = $goldAttempt; Command = 'try-gold' })) {
    $viewIndex = $modeContract.Body.IndexOf(
        ('EnsureWorkViewDown(expectedGeneration, "{0}"' -f $modeContract.Name),
        [StringComparison]::Ordinal)
    $baselineIndex = $modeContract.Body.IndexOf(
        ('CaptureFarmAttemptBaseline(expectedGeneration, "{0}")' -f
            $modeContract.Name), [StringComparison]::Ordinal)
    $clickIndex = $modeContract.Body.IndexOf(('"{0}"' -f $modeContract.Command),
        [StringComparison]::Ordinal)
    $markIndex = $modeContract.Body.IndexOf(
        'MarkPendingFarmAttemptClicked(expectedGeneration,',
        [StringComparison]::Ordinal)
    Assert-Contract ($baselineIndex -ge 0 -and $viewIndex -gt $baselineIndex -and
        $clickIndex -gt $viewIndex -and $markIndex -gt $clickIndex) `
        ("{0} does not run its final downward-view pulse immediately before target click." -f
            $modeContract.Name)
    Assert-Contract (([regex]::Matches($modeContract.Body,
        'EnsureWorkViewDown\(')).Count -eq 1) `
        ("{0} dispatches more than one explicit downward-view alignment per attempt." -f
            $modeContract.Name)
    Assert-Contract ($modeContract.Body -notmatch 'ProbeWorkTarget\(') `
        ("{0} still performs a duplicate target pre-probe before try-* proof." -f
            $modeContract.Name)
    $failureGuard = 'if\s+!EnsureWorkViewDown\(expectedGeneration,\s*"' +
        [regex]::Escape($modeContract.Name) + '"[^)]*\)\s*\{[\s\S]{0,220}' +
        'DiscardPendingFarmAttempt\("' + [regex]::Escape($modeContract.Name) +
        '_view_down_failed"\)[\s\S]{0,80}return'
    Assert-Contract ($modeContract.Body -match $failureGuard) `
        ("{0} can continue to click after downward-view preparation failed." -f
            $modeContract.Name)
}

$alert = Get-AhkFunctionBody 'EmitAutomationAlert'
$alertSoundType = Get-AhkFunctionBody 'AutomationAlertSoundType'
$transition = Get-AhkFunctionBody 'TransitionFarmState'
$stopMining = Get-AhkFunctionBody 'StopMining'

# Alerting is edge-triggered and also owns a monotonic de-duplication/cooldown
# guard. This prevents repeated inventory probes or ERROR rendering from beeping
# on every timer tick.
Assert-Contract ($alert -match 'MonotonicMs\(\)' -and
    $alert -match '(?i)(cooldown|lastAlert|automationAlert)') `
    'Automation alerts have no monotonic anti-spam state.'
Assert-Contract ($alert -match
    'if\s+State\.lastAlertKind\s*=\s*kind\s*&&\s*State\.lastAlertAt[\s\S]{0,100}now\s*-\s*State\.lastAlertAt\s*<\s*[1-9][0-9]*[\s\S]{0,80}return\s+true' -and
    $alert -match
    'State\.lastAlertKind\s*:=\s*kind[\s\S]{0,80}State\.lastAlertAt\s*:=\s*now') `
    'Same-kind alerts are not atomically suppressed for a positive cooldown.'
Assert-Contract ($alertSoundType -match
    'kind\s*=\s*"error"\s*\?\s*0x10[\s\S]{0,80}kind\s*=\s*"capacity"\s*\?\s*0x30[\s\S]{0,40}:\s*0' -and
    $source -match
    'AutomationAlertSoundType\("capacity"\)\s*=\s*0x30[\s\S]{0,100}AutomationAlertSoundType\("error"\)\s*=\s*0x10[\s\S]{0,100}AutomationAlertSoundType\("other"\)\s*=\s*0') `
    'Compiled --validate no longer rejects unsupported alert kinds.'
$soundMatch = [regex]::Match($alert,
    '(?i)(SoundBeep|SoundPlay|MessageBeep|PlaySound)')
$dedupeMatch = [regex]::Match($alert,
    '(?i)(lastAlert|automationAlert|cooldown)')
Assert-Contract ($soundMatch.Success -and $dedupeMatch.Success -and
    $soundMatch.Index -gt $dedupeMatch.Index) `
    'Automation alert sound can play before its anti-spam guard.'
Assert-Contract ($stopMining -notmatch
    'lastAlertKind\s*:=\s*""|lastAlertAt\s*:=\s*0') `
    'StopMining clears alert history before ERROR entry and permits stale callbacks to beep repeatedly.'
Assert-Contract ($transition -match
    'previousState\s*!=\s*nextState[\s\S]{0,500}nextState\s*=\s*"INVENTORY_FULL"[\s\S]{0,300}EmitAutomationAlert\(' -and
    $transition -match
    'previousState\s*!=\s*nextState[\s\S]{0,900}nextState\s*=\s*"ERROR"[\s\S]{0,300}EmitAutomationAlert\(') `
    'INVENTORY_FULL/ERROR alerts are not restricted to state-entry edges.'
Assert-Contract (([regex]::Matches($source,
    'EmitAutomationAlert\(')).Count -eq 3) `
    'Automation alert gained a timer/loop call site outside its definition and two state-entry edges.'

Write-Host 'Farm recovery and alert safety source contract tests passed.'
