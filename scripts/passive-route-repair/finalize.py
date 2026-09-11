from pathlib import Path
R=Path(__file__).resolve().parents[2]
for name in ['docs/AI採掘機_使い方.txt','src/ui-web/README.md','src/ui-web/screenshots/README.md']:
    p=R/name;s=p.read_text(encoding='utf-8-sig')
    if '9.1.9' not in s: raise RuntimeError('Version boundary missing: '+name)
    p.write_text(s.replace('9.1.9','9.1.10'),encoding='utf-8',newline='\n')
p=R/'src/mining-auto.ahk';s=p.read_text(encoding='utf-8-sig')
pairs=[
('State.statusLabel.Text := "作業位置へ戻っています"','State.statusLabel.Text := ExeStorageMethod(State.runMode) = "stationary" ? "近接位置の作業状態を確認しています" : "作業位置へ戻っています"'),
('failureMessage := "EXE徒歩往路の実画面照合に失敗しました。盲目的な再走はしません。"','failureMessage := ExeStorageMethod(State.runMode) = "stationary" ? "近接設定の荷台・接続を確認できません。近接確認をやり直してください。" : "EXE徒歩往路の実画面照合に失敗しました。盲目的な再走はしません。"'),
('failureMessage := "徒歩経路の終点で登録した荷台を確認できませんでした。"','failureMessage := ExeStorageMethod(State.runMode) = "stationary" ? "今の位置・視点で登録荷台を確認できません。両方のボタンが見える位置で近接収納を再確認してください。" : "徒歩経路の終点で登録した荷台を確認できませんでした。"')]
for a,b in pairs:
    if s.count(a)!=1: raise RuntimeError('Status boundary: '+a)
    s=s.replace(a,b)
p.write_text(s,encoding='utf-8',newline='\n')
p=R/'src/exe-route-navigation.ahk';s=p.read_text(encoding='utf-8-sig')
a='② 作業場所で下の「往復を教える」。W/A/S/Dとマウスだけで歩く。'
b='② 荷台がその場で開くなら近接収納。歩く場合は「往復を教える」で準備後F6。W/A/S/Dとマウスだけで歩く。'
if s.count(a)!=1: raise RuntimeError('Native guide boundary')
p.write_text(s.replace(a,b),encoding='utf-8',newline='\n')
print('Release marker and mode-specific status corrections applied.')
