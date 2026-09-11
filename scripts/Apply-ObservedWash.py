from pathlib import Path
R = Path(__file__).resolve().parents[1]
def update(path, fn):
 p=R/path; raw=p.read_bytes(); before=raw.decode('utf-8-sig').replace('\r\n','\n'); after=fn(before)
 if before==after: raise RuntimeError('Unchanged: '+path)
 p.write_bytes((b'\xef\xbb\xbf' if raw.startswith(b'\xef\xbb\xbf') else b'')+after.encode('utf-8'))
def once(s,a,b):
 if s.count(a)!=1: raise RuntimeError('Boundary count '+str(s.count(a))+': '+a[:100])
 return s.replace(a,b)
def function(s,name,nextname,body):
 a=s.index('\n'+name+'(')+1; b=s.index('\n'+nextname+'(',a)+1
 return s[:a]+body.rstrip()+'\n\n'+s[b:]
def main(s):
 s=once(s,'#Include exe-route-navigation.ahk','#Include exe-route-navigation.ahk\n#Include wash-position.ahk')
 s=once(s,'settleDeadline := MonotonicMs() + Config.washPostCompletionSettleMs','settleDelay := Config.washForwardCorrection ? 1 : Config.washPostCompletionSettleMs\n            settleDeadline := MonotonicMs() + settleDelay')
 s=once(s,'    ScheduleNext(expectedGeneration, Config.washPostCompletionSettleMs)','    ScheduleNext(expectedGeneration, Config.washForwardCorrection ? 1 : Config.washPostCompletionSettleMs)')
 s=once(s,'WriteDiagnostic("attempt=" attemptId " WASH_SETTLE_BEGIN delay="\n        Config.washPostCompletionSettleMs " deadline=" settleDeadline)','WriteDiagnostic("attempt=" attemptId " WASH_SETTLE_BEGIN delay="\n        settleDelay " deadline=" settleDeadline " observed=" Config.washForwardCorrection)')
 s=once(s,'    global State, Config\n    bounds := 0\n    if !State.running || !State.targetHwnd','    global State, Config, LocalNav\n    bounds := 0\n    if LocalNav.pid\n        return false\n    if !State.running || !State.targetHwnd')
 needle='MaintainBackgroundWorkView(expectedGeneration, force := false,\n    ignoreVerifiedTarget := false) {\n    global State, Config'
 s=once(s,needle,needle+''', LocalNav
    if State.runMode = "washing" && Config.washForwardCorrection {
        WriteDiagnostic("WASH_VIEW_PRESERVED generation=" expectedGeneration " camera_input=0")
        return IsCurrentRun(expectedGeneration)
    }''')
 s=once(s,'''    State.modeLabel.Text := Config.backgroundMode
        ? "バックグラウンド操作: オン（他の作業を妨げません）"
        : "バックグラウンド操作: オフ（前面操作）"''','''    State.modeLabel.Text := State.runMode = "washing" && Config.washForwardCorrection
        ? "石洗いの画面補正: FiveMを前面にしてください"
        : Config.backgroundMode
            ? "バックグラウンド操作: オン（徒歩・画面補正時は前面が必要）"
            : "バックグラウンド操作: オフ（前面操作）"''')
 a=s.index('WashAttemptBackground(expectedGeneration) {'); b=s.index('ResetGoldRecoveryState() {',a)
 body=s[a:b]
 body=once(body,'    State.attempts += 1','    if !EnsureObservedWashAnchor(expectedGeneration)\n        return\n    State.attempts += 1')
 body=once(body,'    if !EnsureWorkViewDown(expectedGeneration, "washing", true) {','    if !Config.washForwardCorrection && !EnsureWorkViewDown(expectedGeneration, "washing", true) {')
 body=body.replace('    ; Inventory capture may take long enough for the game camera to drift.  Make\n    ; the real, verified down pulse the final operation immediately before the\n    ; atomic target scan/click, on every single washing attempt.','    ; Observed correction preserves the captured camera. The legacy view-only\n    ; mode remains opt-out; never pitch-clamp the visual anchor on every attempt.')
 s=s[:a]+body+s[b:]
 correction=r'''PerformWashCompletionCorrection(expectedGeneration, expectedTaskId,
    expectedAttemptId) {
    global State, Config, LocalNav
    if !Config.washForwardCorrection
        return true
    if !IsTargetForeground(expectedGeneration) {
        State.statusLabel.Text := "●  石洗いの位置確認待ち。FiveMを前面にしてください"
        ScheduleNext(expectedGeneration, 300)
        return false
    }
    Critical "On"
    if !IsCurrentFarmTask(expectedGeneration, expectedTaskId,
        "WASH_CORRECTING")
        || State.washRecoveryGeneration != expectedGeneration
        || State.washRecoveryAttemptId != expectedAttemptId {
        Critical "Off"
        return false
    }
    if State.washCorrectionSent {
        Critical "Off"
        return !State.washCorrectionInFlight
    }
    if State.washCorrectionInFlight {
        Critical "Off"
        return false
    }
    State.washCorrectionInFlight := true
    ; This latches the entire observed transaction, not each native micro-pulse.
    ; Only that helper can take another measured step within its small budget.
    State.washCorrectionSent := true
    Critical "Off"
    if LocalNav.washAnchorGeneration != expectedGeneration
        return FailObservedWash(expectedGeneration, "ERROR ANCHOR_MISSING")
    State.statusLabel.Text := "●  画面で静止・位置ずれ・前進の効果を確認しています"
    WriteDiagnostic("attempt=" expectedAttemptId " WASH_VISUAL_BEGIN settle=observed input=foreground_scancode")
    nudgeResult := RunObservedWashHelper("wash-correct", expectedGeneration)
    visualOk := RegExMatch(nudgeResult, "^WASH_STABLE (\d+) (\d+) (\d+) (\d+)$", &observed)
    criticalWasOn := EnterMetagameOutboxCritical()
    try {
        if !IsCurrentFarmTask(expectedGeneration, expectedTaskId,
            "WASH_CORRECTING")
            || State.washRecoveryGeneration != expectedGeneration
            || State.washRecoveryAttemptId != expectedAttemptId
            return false
        State.washCorrectionInFlight := false
        if visualOk {
            if observed[1] + 0 > 0 {
                State.nudges += 1
                State.mealLabel.Text := "画面確認済み補正`n" State.nudges
            }
            LocalNav.washFeedback := (observed[1] + 0 > 0 ? "補正確認" : "補正不要")
                . " / W入力 " observed[1] "回・計" observed[2] "ms / ずれ "
                . (observed[3] / 1000) "px / 確認時間 " observed[4] "ms"
            WriteDiagnostic("attempt=" expectedAttemptId " WASH_VISUAL_VERIFIED " nudgeResult)
        }
    } finally LeaveMetagameOutboxCritical(criticalWasOn)
    if !visualOk
        return FailObservedWash(expectedGeneration, nudgeResult)
    ; Stable scene was independently checked after the last input. No additional
    ; unconditional 2-second delay or camera sweep is added here.
    return IsCurrentRun(expectedGeneration)
}'''
 s=function(s,'PerformWashCompletionCorrection','RunWashCompletionRecoveryCycle',correction)
 return s
update('src/mining-auto.ahk',main)
def module(s):
 s=once(s,'    LocalNav.helper := LocalNav.runtime "\\LocalNavigation.exe"','    LocalNav.washHelper := LocalNav.runtime "\\WashPosition.exe"\n    LocalNav.washAnchorGeneration := 0\n    LocalNav.washFeedback := "未計測。石洗いはFiveMを前面にして開始してください"\n    FileInstall "WashPosition.exe", LocalNav.washHelper, true\n    LocalNav.helper := LocalNav.runtime "\\LocalNavigation.exe"')
 s=once(s,"        . ',\"feedback\":' JsonQuote(LocalNav.feedback) '}'", "        . ',\"washFeedback\":' JsonQuote(LocalNav.washFeedback)\n        . ',\"feedback\":' JsonQuote(LocalNav.feedback) '}'")
 s=once(s,'        try WinActivate "ahk_id " State.targetHwnd\n        if !WinWaitActive("ahk_id " State.targetHwnd,, 3)', '''        washOperation := operation = "wash-anchor" || operation = "wash-correct" || operation = "wash-check"
        if washOperation && !WinActive("ahk_id " State.targetHwnd)
            return "ERROR GAME_NOT_FOREGROUND"
        if !washOperation
            try WinActivate "ahk_id " State.targetHwnd
        if !WinWaitActive("ahk_id " State.targetHwnd,, 3)''')
 s=once(s,'        command := QuoteCommandArg(LocalNav.helper) " " operation','        helper := washOperation ? LocalNav.washHelper : LocalNav.helper\n        command := QuoteCommandArg(helper) " " operation')
 s=once(s,'        deadline := MonotonicMs() + 365000','        deadline := MonotonicMs() + (washOperation ? 24000 : 365000)')
 return s
update('src/exe-route-navigation.ahk',module)
def build(s):
 s=once(s,"Copy-Item -LiteralPath (Join-Path $sourceRoot 'exe-route-navigation.ahk') -Destination $stageRoot -Force", "Copy-Item -LiteralPath (Join-Path $sourceRoot 'exe-route-navigation.ahk') -Destination $stageRoot -Force\nCopy-Item -LiteralPath (Join-Path $sourceRoot 'wash-position.ahk') -Destination $stageRoot -Force")
 s=once(s,"$localNavOutput = Join-Path $stageRoot 'LocalNavigation.exe'", "$washPositionOutput = Join-Path $stageRoot 'WashPosition.exe'\nInvoke-CSharpBuild -Source (Join-Path $sourceRoot 'wash-position\\WashPosition.cs') -Output $washPositionOutput\nInvoke-CapabilitySmokeTest -Executable $washPositionOutput -Expected 'SELFTEST OK' -Mode 'self-test'\n$localNavOutput = Join-Path $stageRoot 'LocalNavigation.exe'")
 return s
update('scripts/Build.ps1',build)
def test(s):
 s=once(s,"'The post-wash no-input window is not loaded with the safe 2.0 second minimum.'", "'The fallback without visual observation must preserve the 2.0 second minimum.'")
 s=once(s,"$movement = $correct.IndexOf('\"play-route-health\"',", "$movement = $correct.IndexOf('RunObservedWashHelper(',")
 s=once(s,"'nudgeResult := RunBackgroundBridgeCancelable(expectedGeneration,'", "'nudgeResult := RunObservedWashHelper('")
 s += r'''
Assert-Contract ($correct -notmatch 'play-route-health|washForwardPulseMs') 'Washing must not use unobserved transport nudges.'
Assert-Contract ($correct -match 'WASH_STABLE' -and $correct -match 'if visualOk') 'Movement success must require visual evidence.'
Assert-Contract ($begin -match 'settleDelay := Config.washForwardCorrection \? 1 : Config.washPostCompletionSettleMs') 'Observed settling must avoid adding the old unconditional wait.'
$attempt = Get-AhkFunctionBody 'WashAttemptBackground'
Assert-Contract ($attempt -match 'EnsureObservedWashAnchor' -and $attempt -match '!Config.washForwardCorrection && !EnsureWorkViewDown') 'Observed camera must not be pitch-clamped every wash.'
$vision = [IO.File]::ReadAllText((Join-Path (Split-Path $resolvedSource) 'wash-position\WashPosition.cs'))
Assert-Contract ($vision.Contains('FORWARD_NO_OBSERVED_EFFECT') -and $vision.Contains('WRONG_DIRECTION_OR_CAMERA_MOVED')) 'Observed correction must reject no-effect and worsening pulses.'
Assert-Contract ($vision.Contains('finally {ReleaseKey();') -and $vision.Contains('GetForegroundWindow()!=target')) 'Physical input must be released and foreground guarded.'
Assert-Contract ($vision -notmatch 'move_up_only|ReadProcessMemory|MoveCamera') 'Washing helper may not use guessed game commands or camera injection.'
'''
 return s
update('scripts/Test-WashRecoveryContract.ps1',test)
def recovery(s):
 s=once(s,'''                .ThenByDescending(x => x.State.Gacha.TotalDraws)
                .ThenByDescending(x => x.State.Collection.Count)''','''                .ThenByDescending(x => x.State.Gacha.TotalDraws)
                .ThenByDescending(x => !String.IsNullOrWhiteSpace(x.State.Profile.Name)
                    && !String.Equals(x.State.Profile.Name, "Miner", StringComparison.Ordinal))
                .ThenByDescending(x => x.State.Collection.Count)''')
 return once(s,'''                SeedBranch(dataPath, second, "branchB", "Miner", "draw:test:branchB");

                RecoveryReport report''','''                SeedBranch(dataPath, second, "branchB", "Miner", "draw:test:branchB");
                var customState = new MetaGameStateStore(first).LoadOrCreate(DateTimeOffset.UtcNow);
                var defaultState = new MetaGameStateStore(second).LoadOrCreate(DateTimeOffset.UtcNow);
                var expectedCustom = new Candidate { RequestedPath = "z-custom", State = customState };
                var moreCosmetics = new Candidate { RequestedPath = "a-default", State = defaultState };
                customState.RewardGrants.Clear();
                if (!Object.ReferenceEquals(SelectBase(new[] { moreCosmetics, expectedCustom }), expectedCustom))
                {
                    error = "default profile outranked custom profile at equal progression";
                    return false;
                }

                RecoveryReport report''')
update('src/ui-host/MetaGameStateRecovery.cs',recovery)
update('scripts/Test-WashDomExpressions.mjs', lambda s:s+r'''
{
  const fixture = targetFixture();
  const cargo = washOption('ストレージを開く', 492, {states:['hover']});
  fixture.root.append(cargo.hit);
  assert(evaluate(expressions.click, fixture.document) === true, 'Wash must remain selectable beside cargo.');
  assert(cargo.hit.clicked === 0, 'Hovered nearby cargo must never be clicked by washing.');
  assert(fixture.first.hit.clicked + fixture.second.hit.clicked === 1, 'Exactly one wash must be selected.');
}
''')
print('Observed wash integration applied; Windows compiler and real adapter tests remain required.')
