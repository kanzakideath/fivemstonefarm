"""Narrow, fail-closed final corrections to the reviewed 9.1.8 candidate."""
from pathlib import Path
import re


def edit(name, transform):
    path = Path(name)
    raw = path.read_bytes()
    bom = raw.startswith(b'\xef\xbb\xbf')
    text = raw.decode('utf-8-sig').replace('\r\n', '\n')
    updated = transform(text)
    path.write_bytes(updated.encode('utf-8-sig' if bom else 'utf-8'))


def once(text, old, new):
    if old not in text and new in text:
        return text
    if text.count(old) != 1:
        raise RuntimeError('Unexpected source at: ' + old[:120])
    return text.replace(old, new, 1)


def route(text):
    text = once(text,
        '            " " QuoteCommandArg(routePath) " " Config.workViewMouseDirection " " State.targetPid',
        '            . " " QuoteCommandArg(routePath) " " Config.workViewMouseDirection " " State.targetPid')
    text = once(text, 'IniRead(LocalNav.options, "Voice", "Style", "sweet")',
        'IniRead(LocalNav.options, "Voice", "Style", "clear")')
    text = once(text, '        LocalNav.voiceStyle := "sweet"', '        LocalNav.voiceStyle := "clear"')
    text = once(text, '    LocalNav.voiceScope := IniRead(LocalNav.options, "Voice", "Scope", "batch")',
        '    LocalNav.voiceScope := IniRead(LocalNav.options, "Voice", "Scope", "batch")\n'
        '    if LocalNav.voiceScope != "batch" && LocalNav.voiceScope != "action"\n'
        '        LocalNav.voiceScope := "batch"')
    return text.replace('["アニメ調・甘め", "はっきりめ", "音声なし"]',
        '["アニメ調・甘め", "クリアな女性音声（標準）", "音声なし"]')

edit('src/exe-route-navigation.ahk', route)


def main(text):
    return once(text, '    if exitCode = 19\n',
        '    if exitCode = 0 && (CompletionPhrase("mining") != "石掘りが終わったよ"\n'
        '        || CompletionPhrase("washing") != "石洗いが終わったよ"\n'
        '        || CompletionPhrase("gold") != "砂金取りが終わりました")\n'
        '        exitCode := 175\n'
        '    if exitCode = 19\n')

edit('src/mining-auto.ahk', main)


def package(text):
    return once(text, "$autoHotkeyLicense = Join-Path $repoRoot 'tools\\AutoHotkey\\license.txt'",
        "# Distribute route prerequisites and voice reuse terms with the release ZIP.\n"
        "Copy-Item -LiteralPath (Join-Path $repoRoot 'docs\\EXE_ONLY_ROUTES.md') -Destination $packageRoot -Force\n"
        "Copy-Item -LiteralPath (Join-Path $repoRoot 'src\\audio\\CREDITS.txt') -Destination (Join-Path $packageRoot 'VOICE-CREDITS.txt') -Force\n"
        "Copy-Item -LiteralPath (Join-Path $repoRoot 'src\\audio\\voice-manifest.json') -Destination $packageRoot -Force\n"
        "$autoHotkeyLicense = Join-Path $repoRoot 'tools\\AutoHotkey\\license.txt'")

edit('scripts/Make-Release.ps1', package)


def docs(text):
    text = text.replace('【EXE単独の徒歩収納 修正候補】', '【EXE単独の徒歩収納・初回ルート登録必須】')
    text = text.replace('サーバー側へのファイル導入、車両座標、W/A/S/D・矢印キーの記録は使いません。',
        'サーバー側の追加導入や車両座標APIは使いません。徒歩収納は、車両画面でW/A/S/Dとマウスの往路・復路を教え、自動試走が成功した場合だけ利用できます。徒歩中はFiveMを前面で使用します。')
    text = text.replace('6. 近距離で視点と短い移動を境界付き探索し、開いた荷台のストレージIDが登録値と一致した場合だけ到着とします。',
        '6. 初回登録・試走済みの往路を画面照合しながら徒歩再生し、終点で開いた荷台のストレージIDが登録値と一致した場合だけ収納へ進みます。')
    text = text.replace('8. インベントリを閉じたことと逆経路を確認して作業地点へ戻り、',
        '8. インベントリの閉鎖を確認し、別に教えた復路を徒歩再生して作業地点へ戻り、')
    text = text.replace('「持ってる石、全部洗い終わったよ」とWindows内蔵の日本語女性音声を優先して通知し、利用できない環境では通知音へ切り替えます。',
        '「石洗いが終わったよ」とEXE内蔵のキャラクター音声で通知します。石掘り・砂金取りも満杯の区切りで作業別音声を再生します。')
    text = text.replace('- 車両の自動探索は作業場所の近距離だけです。遠距離の車両追跡や瞬間移動はしません。',
        '- 自動収納には現場ごとの往路・復路の初回登録と試走が必要です。移動時はFiveMを前面にします。車両移動・再接続時は再登録してください。')
    text = text.replace('「はっきりめ（ノーマル）」', '「クリアな女性音声（ノーマル・初期値）」')
    return text

for name in ['README.md', 'docs/AI採掘機_使い方.txt', 'docs/EXE_ONLY_ROUTES.md']:
    edit(name, docs)

# The actual embedded audio and the spoken phrase contract must stay in sync.
edit('scripts/Test-ExeRoutes.ps1', lambda text: text + '''
$phrases = @{
    mining = '石掘りが終わったよ'
    washing = '石洗いが終わったよ'
    gold = '砂金取りが終わりました'
}
foreach ($mode in $phrases.Keys) {
    Assert-Check ($module.Contains($phrases[$mode])) ('Completion phrase missing: ' + $mode)
    foreach ($style in @('sweet', 'clear')) {
        $name = "$mode-complete-$style.wav"
        $clip = @($manifest.clips | Where-Object { $_.file -eq $name })
        Assert-Check ($clip.Count -eq 1) ('Expected exactly one voice record: ' + $name)
        Assert-Check ($clip[0].text.TrimEnd([char]0x3002) -ceq $phrases[$mode]) ('Voice text mismatch: ' + $name)
        [byte[]]$wav = [IO.File]::ReadAllBytes((Join-Path $root ('src/audio/' + $name)))
        Assert-Check ($wav.Length -gt 44 -and [Text.Encoding]::ASCII.GetString($wav,0,4) -eq 'RIFF' -and [Text.Encoding]::ASCII.GetString($wav,8,4) -eq 'WAVE') ('Invalid WAV: ' + $name)
    }
}
Write-Host 'All three exact completion phrases and six embedded WAV headers verified.'
''' if "All three exact completion phrases" not in text else text)
print('Release corrections applied; runtime compilation and full regression are still required.')
