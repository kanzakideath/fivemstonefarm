from pathlib import Path
p=Path('portable/ui/app.js');s=p.read_text(encoding='utf-8-sig')
a='観察テストON：キーは送信しません。設定でOFFにすると自動操作します。'
b='観察テストON：キーは送信しません。F5開始 / F6停止。設定でOFFにすると自動操作します。'
if a in s:s=s.replace(a,b)
elif b not in s:raise RuntimeError('Observation help text not found')
p.write_text(s,encoding='utf-8-sig')
