"""One-shot repair against the archived v9.1.8 baseline. Removed before merge.
Uses the original checked-in UI patchers, NOT prepare.py's incompatible rewrites.
No server resources, credentials or game memory are modified.
"""
from pathlib import Path
import subprocess
import sys
R = Path(__file__).resolve().parents[1]
def rd(p): return (R/p).read_text(encoding='utf-8-sig')
def wr(p,t): (R/p).write_text(t,encoding='utf-8',newline='\n')
def once(t,a,b):
    if t.count(a)!=1: raise RuntimeError(f'Boundary count {t.count(a)}: {a[:110]}')
    return t.replace(a,b)
if 'NewStorageCycleProof(' in rd('src/exe-route-navigation.ahk'):
    raise RuntimeError('Already finalized; validate checked-in sources instead of reapplying')
for script in ['web.py','backend.py','overlay.py']:
    subprocess.run([sys.executable,str(R/'scripts/route-ui-repair'/script)],cwd=R,check=True)
p='src/exe-route-navigation.ahk';t=rd(p)
t=once(t,'''        trialSaved := recorded && IniRead(meta, "Route", "Verified", "0") = "1"
            && !!FileExist(root "\\outbound.verified") && !!FileExist(root "\\return.verified")''', '''        trialSaved := recorded && ExeRouteFilesMatch(root)
            && IniRead(meta, "Route", "Verified", "0") = "1"''')
t=once(t,'''        . ',"busy":' ((LocalNav.busy || LocalNav.requestActive) ? "true" : "false")''', '''        . ',"busy":' ((LocalNav.busy || LocalNav.requestActive || State.running || State.registrationActive || State.startInProgress) ? "true" : "false")
        . ',"cycle":' StorageCycleProofJson(LocalNav.cycle)''')
t=t.replace('IniRead(meta, "Route", "StorageId", "") = Config.vehicleStorageId','IniRead(meta, "Route", "StorageId", "") == Config.vehicleStorageId')
t=t.replace('IniRead(meta, "Route", "StorageType", "") = Config.vehicleStorageType','IniRead(meta, "Route", "StorageType", "") == Config.vehicleStorageType')
t=once(t,'&& IniRead(meta, "Route", "Epoch", "") = epoch','&& (!verified || IniRead(meta, "Route", "Epoch", "") = epoch)')
t=once(t,'''            && FileExist(root "\\outbound.json") && FileExist(root "\\return.json")
            && FileRead(root "\\outbound.json", "UTF-8") = FileRead(root "\\outbound.verified", "UTF-8")
            && FileRead(root "\\return.json", "UTF-8") = FileRead(root "\\return.verified", "UTF-8")''','''            && ExeRouteFilesMatch(root)''')
func=r'''ExeRouteFilesMatch(root) {
    try {
        for leg in ["outbound", "return"] {
            file := root "\" leg ".json"
            proof := root "\" leg ".verified"
            if !FileExist(file) || !FileExist(proof)
                return false
            if FileGetSize(file) > 4 * 1024 * 1024 || FileGetSize(proof) > 4 * 1024 * 1024
                return false
            if !(FileRead(file, "UTF-8") == FileRead(proof, "UTF-8"))
                return false
        }
        return true
    } catch
        return false
}

'''
t=once(t,'ExeRouteBindingValid(mode, epoch, verified := true) {',func+'ExeRouteBindingValid(mode, epoch, verified := true) {')
t=once(t,'        IniWrite "1", root "\\route.ini", "Route", "Verified"','''        ; Renew a connection only AFTER a fresh trial verifies both endpoints.
        IniWrite epoch, root "\\route.ini", "Route", "Epoch"
        IniWrite "1", root "\\route.ini", "Route", "Verified"''')
t=once(t,'"同じ作業・荷台・接続で往復を記録してから試走してください。"','"同じ作業と荷台の往復記録を確認できません。記録を作成・修復してから試走してください。"')
t+=r'''

; This receipt reports observations. It is never authority to replay an item transfer.
NewStorageCycleProof(generation, mode) {
    return {generation: generation, mode: mode, phase: "departure", complete: false,
        reason: "", updatedAt: A_NowUTC}
}

AdvanceStorageCycleProof(proof, phase) {
    if !IsObject(proof) || proof.complete || proof.phase = "stopped"
        return false
    next := proof.phase = "departure" ? "truck_arrived"
        : proof.phase = "truck_arrived" ? "deposit_verified"
        : proof.phase = "deposit_verified" ? (proof.mode = "washing" ? "refill_verified" : "work_arrived")
        : proof.phase = "refill_verified" ? "work_arrived"
        : proof.phase = "work_arrived" ? "resumed_verified" : ""
    if phase != next
        return false
    proof.phase := phase
    proof.updatedAt := A_NowUTC
    proof.complete := phase = "resumed_verified"
    return true
}

StorageCycleProofJson(proof) {
    if !IsObject(proof)
        return "null"
    return '{"mode":' JsonQuote(proof.mode) ',"phase":' JsonQuote(proof.phase)
        . ',"complete":' (proof.complete ? "true" : "false")
        . ',"reason":' JsonQuote(proof.reason) ',"updatedAt":' JsonQuote(proof.updatedAt) '}'
}

ObserveStorageCycle(generation, phase, reason := "") {
    global LocalNav, State
    criticalWasOn := A_IsCritical
    if !criticalWasOn
        Critical "On"
    try {
        if !IsCurrentRun(generation)
            return false
        if phase = "departure"
            LocalNav.cycle := NewStorageCycleProof(generation, State.runMode)
        else {
            proof := LocalNav.cycle
            if !IsObject(proof) || proof.generation != generation
                return false
            if phase = "stopped" && !proof.complete {
                proof.phase := "stopped"
                proof.reason := SubStr(reason, 1, 200)
                proof.updatedAt := A_NowUTC
            } else if !AdvanceStorageCycleProof(proof, phase) {
                WriteDiagnostic("CYCLE_PROOF_REJECTED phase=" phase " previous=" proof.phase)
                return false
            }
        }
        try {
            output := LocalNav.root "\last-cycle.json"
            temp := output ".tmp"
            if FileExist(temp)
                FileDelete temp
            FileAppend StorageCycleProofJson(LocalNav.cycle), temp, "UTF-8-RAW"
            FileMove temp, output, true
        } catch as err {
            WriteDiagnostic("CYCLE_PROOF_SAVE_ERROR=" err.Message)
        }
        WriteDiagnostic("CYCLE_PROOF phase=" phase " mode=" State.runMode)
        QueueWebUiFlush(true)
        return true
    } finally {
        if !criticalWasOn
            Critical "Off"
    }
}

ValidateStorageCycleProof() {
    for mode in ["mining", "washing", "gold"] {
        Loop 100 {
            proof := NewStorageCycleProof(7, mode)
            if AdvanceStorageCycleProof(proof, "resumed_verified") || proof.complete
                return false
            if !AdvanceStorageCycleProof(proof, "truck_arrived") || !AdvanceStorageCycleProof(proof, "deposit_verified")
                return false
            if mode = "washing" {
                if AdvanceStorageCycleProof(proof, "work_arrived") || !AdvanceStorageCycleProof(proof, "refill_verified")
                    return false
            }
            if !AdvanceStorageCycleProof(proof, "work_arrived") || proof.complete
                return false
            if !AdvanceStorageCycleProof(proof, "resumed_verified") || !proof.complete
                return false
            if AdvanceStorageCycleProof(proof, "resumed_verified")
                return false
        }
    }
    return true
}
'''
wr(p,t)
p='src/mining-auto.ahk';t=rd(p)
t=once(t,'guide: 0, feedback: "", requestActive: false,','guide: 0, feedback: "", requestActive: false, cycle: 0,')
t=once(t,'    protectedSnapshot := IsObject(State.storagePreSnapshot)','    if !reuseStoragePose\n        ObserveStorageCycle(expectedGeneration, "departure")\n    protectedSnapshot := IsObject(State.storagePreSnapshot)')
t=once(t,'''    TransitionFarmState("OPENING_STORAGE",
        "登録済み荷台を開いた状態を確認", expectedGeneration)''','''    TransitionFarmState("OPENING_STORAGE",
        "登録済み荷台を開いた状態を確認", expectedGeneration)
    ObserveStorageCycle(expectedGeneration, "truck_arrived")''')
t=once(t,'    CompleteVerifiedStorageReturn(expectedGeneration)\n}', '''    ObserveStorageCycle(expectedGeneration, "deposit_verified")
    if State.runMode = "washing"
        ObserveStorageCycle(expectedGeneration, "refill_verified")
    CompleteVerifiedStorageReturn(expectedGeneration)
}''')
t=once(t,'    State.storageTrips += 1\n    State.vehicleTripLabel.Text','    ObserveStorageCycle(expectedGeneration, "work_arrived")\n    State.storageTrips += 1\n    State.vehicleTripLabel.Text')
t=once(t,'''        if wasResume
            State.resumeVerificationPending := false''','''        if wasResume {
            State.resumeVerificationPending := false
            ObserveStorageCycle(expectedGeneration, "resumed_verified")
        }''')
t=once(t,'    return StopMining({message: message, pageName: pageName,','    ObserveStorageCycle(expectedGeneration, "stopped", resolvedCode)\n    return StopMining({message: message, pageName: pageName,')
t=once(t,'"近くの登録車両を探索",','"登録した往路で荷台へ移動",')
t=once(t,'    State.statusLabel.Text := "近くの登録車両を探しています"','    State.statusLabel.Text := "登録ルートで荷台への徒歩移動を開始します"')
t=t.replace('["overview", "stone", "vehicle", "settings", "update"]','["overview", "stone", "vehicle", "routes", "settings", "update"]')
t=once(t,'if A_Args.Length && A_Args[1] = "--validate" {','''if A_Args.Length && A_Args[1] = "--validate" {
    if !ValidateStorageCycleProof() {
        DeleteExtractedTemplates()
        ExitApp(145)
    }''')
wr(p,t)
p='src/ui-web/src/index.html';t=rd(p)
t=once(t,'                <div class="route-steps">','''                <section class="route-feedback" aria-live="polite" aria-label="実行結果の確認">
                  <strong>直近の収納サイクル</strong>
                  <p id="route-cycle-status">まだ実行記録はありません。試走では収納しません。</p>
                </section>
                <div class="route-steps">''')
wr(p,t)
p='src/ui-web/src/app.js';t=rd(p)
t=once(t,'    const route = state.routes || {};','''    const route = state.routes || {};
    const phaseLabels = {
      departure: '徒歩移動を開始。収納はまだ確認していません。',
      truck_arrived: '登録した荷台IDを確認。収納結果を確認中。',
      deposit_verified: '収納結果を確認済み。まだ帰還・作業再開は未確認。',
      refill_verified: '未洗浄石の補充を確認済み。帰還を確認中。',
      work_arrived: '帰還と作業対象を確認。次の実報酬を待っています。',
      resumed_verified: '収納・必要な補充・帰還・次の実報酬まで確認しました。',
      stopped: '途中で停止。収納サイクル完了とは扱いません。',
    };
    const cycle = route.cycle;
    const evidenceText = cycle ? phaseLabels[cycle.phase] || '未確認の実行状態です。' : 'まだ実行記録はありません。試走では収納しません。';
    document.getElementById('route-cycle-status').textContent = evidenceText + (cycle?.reason ? ` 理由：${cycle.reason}` : '');''')
wr(p,t)
p='src/local-navigation/LocalNavigation.cs';t=rd(p)
t=once(t,'    private readonly bool overlayPreview;','''    private readonly bool overlayPreview;
    private readonly List<object> diagnosticEvents = new List<object>();
    private int diagnosticSegment = -1;
    private double diagnosticScore = -1;''')
t=once(t,'                Result = "ROUTE_REPLAYED";','''                Guard();
                SaveRunEvidence("ROUTE_REPLAYED");
                Result = "ROUTE_REPLAYED";''')
t=once(t,'        displayedSegment = number;','        diagnosticSegment = number;\n        displayedSegment = number;')
t=once(t,'            double score = Similarity(reference, live);','            double score = Similarity(reference, live);\n            diagnosticScore = score;')
t=once(t,'        throw new InvalidOperationException("VISUAL_CHECKPOINT_MISMATCH");','''        diagnosticScore = best;
        throw new InvalidOperationException("VISUAL_CHECKPOINT_MISMATCH");''')
t=once(t,'    private void Fail(Exception error) { recording = false; timer.Stop(); ReleaseKeys(); Result = "ERROR " + SafeError(error); Close(); }','''    private void Fail(Exception error) {
        recording = false; timer.Stop(); ReleaseKeys();
        Result = "ERROR " + SafeError(error); SaveRunEvidence(Result); Close();
    }
    private void SaveRunEvidence(string result) {
        if (overlayPreview || String.IsNullOrEmpty(path)) return;
        try {
            diagnosticEvents.Add(new { segment = diagnosticSegment, score = diagnosticScore,
                elapsedMs = clock.ElapsedMilliseconds, result = result, utc = DateTime.UtcNow.ToString("o") });
            if (diagnosticEvents.Count > 64) diagnosticEvents.RemoveAt(0);
            AtomicWrite(path + ".last-run.json", Json.Serialize(new {
                schema = 1, operation = mode, result = result, events = diagnosticEvents,
                inputReleased = heldMask == 0,
                scope = "Local route observations only; not an inventory receipt." }));
        } catch { /* Diagnostics must not prevent input release or cancellation. */ }
    }''')
t=once(t,'            progress(n + 1, value.segments.Count);','            guard(); progress(n + 1, value.segments.Count);')
t=once(t,'        return "SELFTEST OK";','''        for (int cycle = 0; cycle < 300; cycle++) {
            int completed = 0;
            ExecutePlan(route, delegate(byte[] image) { }, delegate(Segment seg, int n) { },
                delegate { }, delegate { }, delegate(int n, int count) { completed++; });
            if (completed != route.segments.Count) throw new Exception("REPEATED_PLAN_TEST");
        }
        bool cancelledAtEnd = false; observed = 0; aligned = 0;
        try {
            ExecutePlan(route, delegate(byte[] image) { if (++aligned == 3) cancelledAtEnd = true; },
                delegate(Segment seg, int n) { }, delegate { },
                delegate { if (cancelledAtEnd) throw new InvalidOperationException("CANCELLED"); },
                delegate(int n, int count) { observed++; });
            throw new Exception("FINAL_CANCEL_NOT_PROPAGATED");
        } catch (InvalidOperationException) { }
        if (observed != 1) throw new Exception("SUCCESS_AFTER_FINAL_CANCEL");
        return "SELFTEST OK";''')
wr(p,t)
p='scripts/ui-tests/Test-RouteSetupBrowser.py';t=rd(p)
t=t.replace("window.aiMiner.receive({type:'snapshot',payload:s});",'window.aiMinerTest.setState(s);')
t=once(t,"            page.locator('#content-stage').evaluate('(el) => { el.scrollTop = 0; }')", "            page.locator('#content-stage').evaluate('(el) => { el.scrollTop = 0; }')\n            page.locator('#screen-routes').evaluate('(el) => { el.scrollTop = 0; }')")
wr(p,t)
# The payload parser already calls EnsureOnlyKeys. Do not inject nonexistent result.Arguments.
assert 'EnsureOnlyKeys(payload, "mode")' in rd('src/ui-host/Protocol.cs')
assert 'result.Arguments' not in rd('src/ui-host/Protocol.cs')
p='docs/RELEASE_v9.1.9.md';t=rd(p)
t+='''\n## 収納の観測記録と再試走\n\n直近サイクルは移動開始・荷台ID確認・収納確認・補充確認・帰還確認・次の実報酬確認を区別します。最後の実報酬を確認するまでは一周完了ではありません。`exe-routes/last-cycle.json` は観測記録であり、再実行の指令ではありません。徒歩の失敗区間・一致度・経過時間は各ルートの `.last-run.json` へローカル保存します。画面やログの自動送信はありません。\n\nルートの文字列照合は大文字小文字まで一致させます。再接続後も保存済みの道自体が一致していれば、往復の自動試走で今回の接続を再確認できます。試走に成功するまでは実行時の接続ガードを解除しません。\n\n追加の300回の計画反復および3モード各100回の完了状態検証は模擬・ロジック試験であり、実FiveMでの300往復成功を意味しません。全地形・任意の車両位置での自動移動を保証するものではありません。\n'''
wr(p,t)
print('Actual source repaired. Full Windows compile, browser and overlay checks are required.')
