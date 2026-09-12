from pathlib import Path
import hashlib
root=Path(__file__).resolve().parents[1]
expected={'README.md':'2de7f6d39eda14df5cfcc7125f08b44ab2688478','config/AI採掘機.ini':'d8a206bacc5b1a3d0f43ee3617c5d33a1e0681f2','docs/AI採掘機_使い方.txt':'71003aef3b9353169a4aae870e6ce714d0fa4757','scripts/Build.ps1':'b97b405964e78d032c49f527f760415a46962348','scripts/Test-WashDomExpressions.mjs':'eb77dc18b9ba5fa0330f49ec1fdedb0d53a61733','scripts/Test-WashDomExpressions.ps1':'ccdc50c5b236843d0b446a9176b0036a4d15a82c','src/README.md':'aa6639d20ddb8c1d75454ae33b5467696f423a23','src/background-bridge/CdpBridge.cs':'5d1c24eff932ad6c020f7552342f7199a450e557','src/exe-route-navigation.ahk':'c7fde01e7b88dbd196d9fadb598a8b2f4c5c94e3','src/mining-auto.ahk':'8b84cf78ca4c2f580a963e42cb9cf3d28c73c125','src/ui-web/package-lock.json':'b1f8f63893287515760964cc1e951d8c9562e944','src/ui-web/package.json':'bdd2d6fb175dcb02301eba691763a72f65153333','src/ui-web/src/app.js':'567f2b6155aeea13b4a7c07059b901aea805e2a7','src/ui-web/src/index.html':'d01666a0de6ddefe37e085b9820b286e97a35353','src/wash-position.ahk':'14c25dc2ec257c2a77a9ae3344d0176e9d7474ae'}
for name,sha in expected.items():
 b=(root/name).read_bytes().replace(b'\r\n',b'\n')
 if hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()!=sha: raise RuntimeError('Unexpected baseline: '+name)
def load(name):
 raw=(root/name).read_bytes();return raw,raw.decode('utf-8-sig').replace('\r\n','\n')
def save(name,raw,s):
 (root/name).write_bytes((b'\xef\xbb\xbf' if raw.startswith(b'\xef\xbb\xbf') else b'')+s.encode())
def once(s,a,b):
 if s.count(a)!=1:raise RuntimeError('Unexpected boundary: '+a[:120])
 return s.replace(a,b,1)
name='src/mining-auto.ahk';raw,s=load(name)
s=once(s,'#Include wash-position.ahk','#Include wash-position.ahk\n#Include nearby-wash.ahk')
s=once(s,'if !ValidateStorageCycleProof() || !ValidateStationaryWorkflow() {','if !ValidateStorageCycleProof() || !ValidateStationaryWorkflow() || !ValidateNearbyWashRecovery() {')
s=once(s,'    nudgeResult := RunObservedWashHelper("wash-correct", expectedGeneration)','    LocalNav.washRecoveryOutcome := "VISUAL_PENDING"\n    nudgeResult := RunObservedWashHelper("wash-correct", expectedGeneration)')
s=once(s,'        if visualOk {\n            if observed[1] + 0 > 0 {','        if visualOk {\n            LocalNav.washRecoveryOutcome := "VISUAL_VERIFIED"\n            if observed[1] + 0 > 0 {')
s=once(s,'ResumeAfterWashCompletionRecovery(expectedGeneration, expectedTaskId,\n    expectedState, attemptId) {\n    global State, Config','ResumeAfterWashCompletionRecovery(expectedGeneration, expectedTaskId,\n    expectedState, attemptId) {\n    global State, Config, LocalNav')
s=once(s,'"洗浄後の位置補正完了。次の対象を即時監視"','"洗浄後の継続条件を確認。次の対象を即時監視"')
s=once(s,'    State.statusLabel.Text := "●  補正完了。次の「" chr(0x77F3)\n        . "を洗う」を待っています"','    State.statusLabel.Text := LocalNav.HasOwnProp("washRecoveryOutcome")\n        && LocalNav.washRecoveryOutcome = "NEARBY_WASH_READY"\n        ? "●  荷台前の操作範囲を確認。次の石洗いを開始します"\n        : "●  補正完了。次の石洗いを開始します"')
s=once(s,'global AppVersion := "9.1.11"','global AppVersion := "9.1.12"')
save(name,raw,s)
name='src/wash-position.ahk';raw,s=load(name)
s=once(s,'    reason := InStr(result, "WASH_TARGET_MISSING_AT_ANCHOR")','    ; A fixed-camera pixel threshold is not the task completion criterion at a\n    ; verified nearby cargo spot. Do not change the visual report or count a nudge.\n    if TryAcceptNearbyWashRecovery(generation, result)\n        return true\n    if !IsCurrentRun(generation)\n        return false\n    reason := InStr(result, "WASH_TARGET_MISSING_AT_ANCHOR")')
save(name,raw,s)
name='src/exe-route-navigation.ahk';raw,s=load(name)
s=once(s,'    if !ExeRouteBindingValid(State.runMode, State.serverEpoch) {\n        StopAutomationWithFault(', '    if !ExeRouteBindingValid(State.runMode, State.serverEpoch) {\n        ; Registered washing cargo beside the work spot can be verified without\n        ; a walking recording. No automatic movement or item transfer is used.\n        if TryConfirmNearbyWashingForRun(expectedGeneration)\n            return IsCurrentRun(expectedGeneration)\n        if !IsCurrentRun(expectedGeneration)\n            return false\n        StopAutomationWithFault(')
s=once(s,'この作業のEXE徒歩ルートが未登録・未試走か、接続が変わりました。車両画面の「徒歩ルート・音声設定」で往復を教え、自動試走してください','収納先の近接確認／徒歩試走が未完了です。荷台前では「この位置で近接収納を確認」、離れた車両では往復記録・試走を行ってください')
save(name,raw,s)
name='src/background-bridge/CdpBridge.cs';raw,s=load(name)
s=once(s,'        bool actionCompletionMode = args.Length == 4 && mode == "wait-action-completion";','        bool nearbyWashProbeMode = args.Length == 3 && mode == "probe-wash-storage";\n        bool actionCompletionMode = args.Length == 4 && mode == "wait-action-completion";')
s=once(s,'if (!twoArgumentMode && !actionTryMode && !actionCompletionMode && !washCompletionMode','if (!twoArgumentMode && !actionTryMode && !nearbyWashProbeMode && !actionCompletionMode && !washCompletionMode')
s=once(s,'            else if (actionCompletionMode)\n','            else if (nearbyWashProbeMode)\n            {\n                if (!IsValidServerEpoch(args[2])) return 64;\n                result = ProbeNearbyWashAsync(args[2]).GetAwaiter().GetResult();\n            }\n            else if (actionCompletionMode)\n')
addition='''    // Non-mutating functional-area proof. The two labels are read in the same
    // JS turn; stale/alternating single-label samples cannot become a pair.
    private static string NearbyWashControlsExpression()
    {
        return "(() => {const wash=" + WashTargetExpression(false)
            + ",storage=" + StorageTargetExpression(false) + ";"
            + "if(storage==='AMBIGUOUS')return 'AMBIGUOUS WASH_STORAGE';"
            + "if(storage!=='PRESENT')return 'MISSING WASH_STORAGE';"
            + "return wash?'PRESENT WASH_STORAGE':'PRESENT STORAGE_ONLY';})()";
    }

    private static async Task<string> ProbeNearbyWashAsync(string expectedEpoch)
    {
        string[] frames;
        if (!TryDecodeServerEpoch(expectedEpoch, out frames))
            return "ERROR SERVER_SESSION_CHANGED";
        using (var session = await CdpSession.OpenAsync(TargetFramePart,
            TimeSpan.FromSeconds(5), frames).ConfigureAwait(false))
        {
            string first = null;
            for (int sample = 0; sample < 3; sample++)
            {
                if (sample > 0) await Task.Delay(120, session.Token).ConfigureAwait(false);
                if (!await session.MatchesServerEpochAsync().ConfigureAwait(false))
                    return "ERROR SERVER_SESSION_CHANGED";
                string value = await session.EvaluateStringAsync(
                    NearbyWashControlsExpression(), false).ConfigureAwait(false);
                if (value != "PRESENT WASH_STORAGE" && value != "PRESENT STORAGE_ONLY")
                    return value;
                if (first != null && value != first) return "MISSING WASH_STORAGE";
                first = value;
            }
            if (!await session.MatchesServerEpochAsync().ConfigureAwait(false))
                return "ERROR SERVER_SESSION_CHANGED";
            return first;
        }
    }

'''
s=once(s,'    private static string ProbeStorageExpression()\n',addition+'    private static string ProbeStorageExpression()\n')
save(name,raw,s)
name='scripts/Test-WashDomExpressions.ps1';raw,s=load(name)
s=once(s,"$progressMethod = $bridgeType.GetMethod('WorkProgressExpression', $bindingFlags)","$progressMethod = $bridgeType.GetMethod('WorkProgressExpression', $bindingFlags)\n$nearbyMethod = $bridgeType.GetMethod('NearbyWashControlsExpression', $bindingFlags)")
s=once(s,'if (-not $mainMethod -or -not $targetMethod -or -not $progressMethod) {','if (-not $mainMethod -or -not $targetMethod -or -not $progressMethod -or -not $nearbyMethod) {')
s=once(s,"    [string[]]@('try-mining', 'unused-result.txt'),","    [string[]]@('probe-wash-storage', 'unused-result.txt'),\n    [string[]]@('probe-wash-storage', 'unused-result.txt', 'invalid-epoch'),\n    [string[]]@('try-mining', 'unused-result.txt'),")
s=once(s,'    $payload = [ordered]@{','    $payload = [ordered]@{\n        nearby = [string]$nearbyMethod.Invoke($null, [object[]]@())')
save(name,raw,s)
name='scripts/Test-WashDomExpressions.mjs';raw,s=load(name)
s+='''
// Paired task-area evidence must not click, confuse a partial match, or accept
// multiple cargo options. Washing may disappear legitimately at raw stone 0.
for (const label of ['ストレージを開く', 'トランクを開く', '荷台を開く']) {
  const f = targetFixture();
  const cargo = washOption(label, 300, { states: ['hover'] });
  f.root.append(cargo.hit);
  assert(evaluate(expressions.nearby, f.document) === 'PRESENT WASH_STORAGE', 'Both exact usable controls must be accepted.');
  assert(cargo.hit.clicked === 0 && f.first.hit.clicked === 0 && f.second.hit.clicked === 0, 'Probe must never click.');
  f.first.hit.style.display = f.second.hit.style.display = 'none';
  assert(evaluate(expressions.nearby, f.document) === 'PRESENT STORAGE_ONLY', 'Raw stone empty must leave a refill-only proof.');
  cargo.hit.attributes['aria-disabled'] = 'true';
  assert(evaluate(expressions.nearby, f.document) === 'MISSING WASH_STORAGE', 'Disabled cargo cannot authorize continuation.');
}
{
  const f = targetFixture();
  assert(evaluate(expressions.nearby, f.document) === 'MISSING WASH_STORAGE', 'Wash without cargo is not nearby proof.');
  f.root.append(washOption('ストレージを開く', 300).hit, washOption('ストレージを開く', 70).hit);
  assert(evaluate(expressions.nearby, f.document) === 'AMBIGUOUS WASH_STORAGE', 'Two cargo targets must be rejected.');
  f.root.style.display = 'none';
  assert(evaluate(expressions.nearby, f.document) === 'MISSING WASH_STORAGE', 'Hidden interaction list must be rejected.');
}
{
  const f = targetFixture();
  f.root.append(washOption('インベントリを開く', 300).hit);
  assert(evaluate(expressions.nearby, f.document) === 'MISSING WASH_STORAGE', 'A generic inventory control is not registered cargo.');
}
console.log('Paired nearby wash/storage DOM probes passed (no clicks or item transfers).');
'''
save(name,raw,s)
name='src/ui-web/src/index.html';raw,s=load(name)
s=once(s,'石洗いの位置補正 · 入力と効果','石洗いの位置補正 · 入力と継続判定')
s=once(s,'開始位置を保持し、洗浄後に景色の静止とずれを測ります。ずれた時だけ短いW入力で補正し、動かなければ成功扱いしません。','後退補正は維持します。近接モードでは画像が完全一致しなくても、洗浄・荷台の両ボタンを連続確認できれば追加前進せず続行します。「画像補正の確認」と「作業できる範囲の確認」は別表示です。石0では荷台を確認して収納・補充へ進みます。')
s=once(s,'立ち位置・視点を変えずに、作業 → 登録荷台 → 作業を確認します。徒歩記録は不要です。確認ではアイテムを動かしません。','立ち位置・視点を変えずに、作業 → 登録荷台 → 作業を確認します。徒歩記録は不要です。収納ONで石洗いを開始した時も、徒歩記録がない場合はこの実確認を自動で試みます。確認ではアイテムを動かしません。')
save(name,raw,s)
for name in ['README.md','src/README.md','docs/AI採掘機_使い方.txt','config/AI採掘機.ini','src/ui-web/package.json','src/ui-web/package-lock.json','src/ui-web/src/app.js']:
 raw,s=load(name)
 if '9.1.11' not in s:raise RuntimeError('Version marker missing: '+name)
 save(name,raw,s.replace('9.1.11','9.1.12'))
name='scripts/Build.ps1';raw,s=load(name)
s=once(s,"Copy-Item -LiteralPath (Join-Path $sourceRoot 'wash-position.ahk') -Destination $stageRoot -Force", "Copy-Item -LiteralPath (Join-Path $sourceRoot 'wash-position.ahk') -Destination $stageRoot -Force\nCopy-Item -LiteralPath (Join-Path $sourceRoot 'nearby-wash.ahk') -Destination $stageRoot -Force")
save(name,raw,s)
name='README.md';raw,s=load(name)
s=once(s,'石洗いの前進補正を、入力信号の送信成功だけで判断する方式から、**開始時の景色を保持し、洗浄後のずれと短いW入力の効果を実画面で確認する方式**へ変更しました。ずれがない場合は前進せず、入力が効かない・ずれが増える・照合できない場合は成功扱いにしません。基準は毎回取り直さず、累積後退を追います。\n\n従来の固定2秒待ちと各回の強制下向きは、補正ON時には画像による静止確認へ置き換わります。ゲーム側の作業時間、クールダウン、報酬制限は変更しません。実FiveMでの速度改善量は未測定です。**この視覚補正はFiveM前面が必要**で、バックグラウンドのまま同じ補正ができるとは扱いません。\n\n前回未配信だった自然視点のF6開始ルート記録と、作業・荷台にその場で届く配置向けの近接収納も含みます。記録モードからのキー・カメラ入力は禁止し、勝手に下を向けません','荷台前で前進補正できているのに `FORWARD_NO_OBSERVED_EFFECT` だけで停止する問題に対応しました。補正自体は維持し、近接収納が確認済みの石洗いでは、限定した画像判定の不確定結果について **「石を洗う」と「ストレージを開く」が同時に使える状態を3回続けて確認** して続行します。画像一致を確認したと偽らず、画面には「操作範囲を確認」と表示します。石0の場合はストレージだけの確認から既存の収納・補充処理へ移ります。\n\n収納ONの石洗いで徒歩記録がない場合、開始地点から作業→登録荷台ID→作業を移動なしで確認して、成功した場合だけ近接設定を保存します。設定だけで収納ONにはせず、既存の徒歩ルートは上書きしません。キャンセル・フォーカス喪失・誤方向・キー解除失敗・接続変更は停止を維持します')
save(name,raw,s)
name='docs/AI採掘機_使い方.txt';raw,s=load(name)
s=once(s,'今回の変更\n----------\n','今回の変更\n----------\n荷台前の近接モードでは、画像補正が未確定でも洗浄と荷台の両操作を連続確認できれば続行します。石0ではストレージだけを確認して補充へ進みます。徒歩記録がない石洗いは、収納ONなら開始時に近接確認を試みます。\n')
save(name,raw,s)
expected_after={'README.md':'77e9614ba3e7b89be086eacf330d8383878fc7b943d27b666344164b7806a53e','config/AI採掘機.ini':'884f2ae239c763b402cb27b3d9630780b7f96e9a3094d8e977636df2ae0078da','docs/AI採掘機_使い方.txt':'dc824fa23f01ed1357e8f762c27eeb037e69983fa44e069af3caa227ce8ce028','scripts/Build.ps1':'7a5fca1d1398f2d090e0797531d426fdce05e00a517b76a393ec3d95f9f3fc4b','scripts/Test-WashDomExpressions.mjs':'ffe55728a2bee19f15458177dcf990893a810a25e605e5e8a67ed8470921a11b','scripts/Test-WashDomExpressions.ps1':'ea880bc8a2d5cc622cd3c23d1a564c067df1e5ed40dac5b53dea436b2769ebd7','src/README.md':'2affeb9fa52a32a13dc82180a32cd183dfa520d21e3b0d5df45a59cdabeb2b88','src/background-bridge/CdpBridge.cs':'3f536967014afea94b062e15b9e7811ce2e267be58e285b4f86cbd15b2d63da8','src/exe-route-navigation.ahk':'5a85d865cf41916c06196bb16bd890b623c294d6217e40d21100641b2636167c','src/mining-auto.ahk':'6da3a7635f086fbc2bcd0b2715441b0598a04a6313263b10145ce058370c6859','src/ui-web/package-lock.json':'c41cc14dc444e0fd7cf765cdba769fd30a6152c71b411c3b715430d0ca93662f','src/ui-web/package.json':'ce2b51867bbb57f010dd728113c56043bb603845846b41968ae271ba43321681','src/ui-web/src/app.js':'c51b4a3e6a4fef1cfb2a01f4df0241fd206fd59ece5c3f7038b54f98860a0b93','src/ui-web/src/index.html':'419de6ada392e2aa00e1513ad2879162b592af7ed9bc773e1c85525b4bf5f264','src/wash-position.ahk':'9c67ca8759d404afc08360d69ebe3e665ab07e858bf4e7de7b6b749b4aa89d93'}
for name,sha in expected_after.items():
 if hashlib.sha256((root/name).read_bytes()).hexdigest()!=sha:raise RuntimeError('Unexpected patched source: '+name)
print('Audited nearby task-readiness patch applied. Windows validation remains required.')
