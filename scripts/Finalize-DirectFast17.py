from pathlib import Path

root = Path(__file__).resolve().parents[1]

def replace(rel, old, new):
    p = root / rel
    raw = p.read_bytes()
    text = raw.decode('utf-8-sig').replace('\r\n', '\n')
    if text.count(old) != 1:
        raise RuntimeError(f'{rel}: expected exactly one source match for {old[:80]!r}')
    p.write_bytes((b'\xef\xbb\xbf' if raw.startswith(b'\xef\xbb\xbf') else b'') + text.replace(old, new, 1).encode('utf-8'))

replace('scripts/ui-tests/FastWashHarness.ahk',
        '    Choose(value) { this.Value := value }',
        '    Choose(value) {\n        this.Value := value\n    }')

p = 'src/background-bridge/CdpBridge.cs'
replace(p,
'''        bool actionTryMode = (args.Length == 3 || (args.Length == 4 && mode == "try-washing")) && (mode == "try-mining"
            || mode == "try-washing" || mode == "try-gold");''',
'''        bool fastWashWorkOnly = mode == "try-washing" && args.Length == 5
            && String.Equals(args[4], "work-only", StringComparison.Ordinal);
        bool actionTryMode = (args.Length == 3 || (args.Length == 4 && mode == "try-washing")
            || fastWashWorkOnly) && (mode == "try-mining" || mode == "try-washing" || mode == "try-gold");''')
replace(p, '(washReadyMode || (actionTryMode && args.Length==4))',
        '(washReadyMode || (actionTryMode && args.Length>=4))')
replace(p, 'TryAndWaitActionAsync(mode, args[2], preferredWashPort).GetAwaiter().GetResult()',
        'TryAndWaitActionAsync(mode, args[2], preferredWashPort, fastWashWorkOnly).GetAwaiter().GetResult()')
replace(p, 'Action<long> clickDispatchObserver, int preferredPort = 0)',
        'Action<long> clickDispatchObserver, int preferredPort = 0, bool fastWashWorkOnly = false)')
replace(p,
'''                        expression = washingMode
                            ? WashTargetExpression(true) : ClickExpression(targetLabel, exactOnly);
                        expression = StationaryWorkClickExpression(expression);''',
'''                        // Fast washing omits cargo, not the exact work target or epoch.
                        expression = WorkClickExpressionForMode(mode, fastWashWorkOnly);''')
replace(p,
'''        string mode, string expectedEpoch, int preferredPort = 0)
    {
        WorkAction action;''',
'''        string mode, string expectedEpoch, int preferredPort = 0, bool fastWashWorkOnly = false)
    {
        WorkAction action;''')
replace(p, 'delegate(long timestamp) { clickDispatchTimestamp = timestamp; }, preferredPort)',
        'delegate(long timestamp) { clickDispatchTimestamp = timestamp; }, preferredPort, fastWashWorkOnly)')
replace(p, '    private static string StationaryWorkClickExpression(string workClick)\n',
'''    private static string WorkClickExpressionForMode(string mode, bool fastWashWorkOnly)
    {
        bool washing = mode == "try-washing";
        bool gold = mode == "try-gold";
        string workClick = washing ? WashTargetExpression(true)
            : ClickExpression(gold ? "砂金採りトレイ" : "鉱石を採掘する", gold);
        // This washing-only policy never authorizes an inventory transfer.
        return washing && fastWashWorkOnly ? workClick : StationaryWorkClickExpression(workClick);
    }

    private static string StationaryWorkClickExpression(string workClick)
''')
replace('src/mining-auto.ahk',
'''    clickResult := RunBackgroundBridgeCancelable(expectedGeneration,
        "try-washing", State.serverEpoch, (State.lastDevConPort = 29200 || State.lastDevConPort = 29300 ? State.lastDevConPort : 0))''',
'''    washArguments := [State.serverEpoch, (State.lastDevConPort = 29200 || State.lastDevConPort = 29300 ? State.lastDevConPort : 0)]
    if FastWashModeEnabled()
        washArguments.Push("work-only")
    WriteDiagnostic("WASH_CLICK_POLICY fast=" (FastWashModeEnabled() ? 1 : 0) " cargoGate=" (FastWashModeEnabled() ? 0 : 1))
    clickResult := RunBackgroundBridgeCancelable(expectedGeneration,
        "try-washing", washArguments*)''')
replace('scripts/Test-WashDomExpressions.ps1',
"    [string[]]@('try-washing', 'unused-result.txt', 'invalid-epoch', '29200'),",
"""    [string[]]@('try-washing', 'unused-result.txt', 'invalid-epoch', '29200'),
    [string[]]@('try-washing', 'unused-result.txt', 'invalid-epoch', '29200', 'work-only'),
    [string[]]@('try-washing', 'unused-result.txt', 'invalid-epoch', '42', 'work-only'),
    [string[]]@('try-washing', 'unused-result.txt', 'invalid-epoch', '29200', 'unrecognized'),
    [string[]]@('try-mining', 'unused-result.txt', 'invalid-epoch', '29200', 'work-only'),""")
replace('scripts/Test-WashDomExpressions.ps1', '        stationaryMine =',
"""        fastWashClick = [string]$bridgeType.GetMethod('WorkClickExpressionForMode', $bindingFlags).Invoke($null, [object[]]@('try-washing', $true))
        ordinaryWashClick = [string]$bridgeType.GetMethod('WorkClickExpressionForMode', $bindingFlags).Invoke($null, [object[]]@('try-washing', $false))
        fastFlagOnMineClick = [string]$bridgeType.GetMethod('WorkClickExpressionForMode', $bindingFlags).Invoke($null, [object[]]@('try-mining', $true))
        stationaryMine =""")
p = root / 'scripts/Test-WashDomExpressions.mjs'
with p.open('a', encoding='utf-8') as f:
    f.write('''
// Use the exact builder called at the production click site, not an unwrapped fixture.
for (const state of ['missing', 'disabled', 'ambiguous', 'generic']) {
  const f = targetFixture();
  const cargo = [];
  if (state === 'disabled') cargo.push(washOption('ストレージを開く',300,{attributes:{'aria-disabled':'true'}}));
  if (state === 'ambiguous') cargo.push(washOption('ストレージを開く',300),washOption('ストレージを開く',50));
  if (state === 'generic') cargo.push(washOption('インベントリを開く',300,{states:['hover']}));
  for (const c of cargo) f.root.append(c.hit);
  assert(evaluate(expressions.ordinaryWashClick,f.document) === false, state + ': ordinary cargo guard');
  assert(evaluate(expressions.fastWashClick,f.document) === true, state + ': fast washing without cargo');
  assert(f.first.hit.clicked + f.second.hit.clicked === 1, state + ': exactly one wash');
  assert(cargo.every(c => c.hit.clicked === 0), state + ': never click cargo/inventory');
}
{
  const f = targetFixture();
  f.first.hit.style.display = f.second.hit.style.display = 'none';
  const cargo = washOption('ストレージを開く',300); f.root.append(cargo.hit);
  assert(evaluate(expressions.fastWashClick,f.document) === false, 'Cargo cannot substitute for washing');
  assert(cargo.hit.clicked === 0, 'No fallback cargo click');
}
{
  const f = targetFixture();
  f.first.hit.style.display = f.second.hit.style.display = 'none';
  const mine = washOption('鉱石を採掘する',300); f.root.append(mine.hit);
  assert(evaluate(expressions.fastFlagOnMineClick,f.document) === false && mine.hit.clicked === 0, 'Fast flag cannot relax other modes');
}
console.log('FAST_WASH_DOM_PASS: actual dispatch expression, washing alone, exact single click');
''')
p = root / 'scripts/Test-FastWashContract.ps1'
with p.open('a', encoding='utf-8') as f:
    f.write('''
$bridgeSource = Get-Content (Join-Path $root 'src/background-bridge/CdpBridge.cs') -Raw
Assert ($bridgeSource.Contains('expression = WorkClickExpressionForMode(mode, fastWashWorkOnly);')) 'Final click is not wired to fast policy.'
Assert ($bridgeSource.Contains('washing && fastWashWorkOnly ? workClick : StationaryWorkClickExpression(workClick)')) 'Only fast washing may omit cargo guard.'
Assert ($source.Contains('washArguments.Push("work-only")')) 'AHK does not request the native fast policy.'
Write-Host 'FAST_WASH_FINAL_CLICK_WIRING_PASS'
''')
replace('docs/RELEASE_v9.1.17.md', 'v9.1.16の高速設定メッセージが',
        'クリック直前にも残っていたストレージ必須条件を修正しました。高速石洗いだけが専用のwork-only指定を送り、実際に使用できる「石を洗う」を1回選びます。通常モード・他の作業・収納先の検証は従来の条件を保ちます。洗浄対象が使えない場合に荷台や別の操作をクリックすることはありません。\n\nv9.1.16の高速設定メッセージが')
print('Final-click policy and compiled-expression tests applied.')
