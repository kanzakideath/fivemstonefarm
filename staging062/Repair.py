"""Apply a narrowly scoped repair to the released 0.6.1 source."""
from pathlib import Path
p=Path('portable')
f=p/'BridgeRead.cs';s=f.read_text(encoding='utf-8-sig')
old='"(()=>{"+InventoryPrelude()+"return "+probe.Trim().TrimEnd(\';\')+";})()"'
new='"(()=>{"+InventoryPrelude()+"return ("+probe.Trim().TrimEnd(\';\')+");})()"'
assert s.count(old)==1,'Unexpected inventory installation expression'
s=s.replace(old,new)
f.write_text(s,encoding='utf-8',newline='\n')
f=p/'Engine.cs';s=f.read_text(encoding='utf-8-sig')
old='CdpBridge.FishingTelemetryReader reader=null;\n   try{while(!token.IsCancellationRequested)'
new='CdpBridge.FishingTelemetryReader reader=null;string lastReadError="";double lastReadErrorAt=-10000;\n   try{while(!token.IsCancellationRequested)'
assert old in s;s=s.replace(old,new,1)
old='catch(Exception e){value=new Telemetry{Error="NUI読み取り再接続: "+e.GetType().Name};if(reader!=null)reader.Dispose();reader=null;}value.At=Now;'
new='''catch(Exception e){string code=e.GetType().Name+": "+e.Message.Replace("\\r"," ").Replace("\\n"," ");if(code.Length>180)code=code.Substring(0,180);value=new Telemetry{Error="所持品の読み取りエラー: "+code};if(lastReadError!=code||Now-lastReadErrorAt>=5000){Log("telemetry_error",code);lastReadError=code;lastReadErrorAt=Now;}if(reader!=null)reader.Dispose();reader=null;}if(value.Known&&lastReadError!=""){Log("telemetry_recovered","inventory_source="+value.InventorySource);lastReadError="";}value.At=Now;'''
assert old in s;s=s.replace(old,new,1)
f.write_text(s,encoding='utf-8',newline='\n')
for name in ['Engine.cs','Program.cs','Build.ps1','ui/index.html','README.txt']:
 f=p/name;s=f.read_text(encoding='utf-8-sig').replace('0.6.1-preview','0.6.2-preview').replace('0.6.1.0','0.6.2.0').replace('FishingPilot 0.6.1 build ready.','FishingPilot 0.6.2 build ready.')
 f.write_text(s,encoding='utf-8',newline='\n')
f=p/'README.txt'
f.write_text(f.read_text(encoding='utf-8')+'''
【0.6.2 修正】
所持品監視の初期化式で、return直後の複数行コメントによりJavaScriptが
値を返さず終了する問題を修正しました。所持品の読み取りエラーには
具体的なエラーコードを表示し、再試行のログは5秒間隔に制限しています。
設定の削除・リセットは不要です。旧版を終了し、このZIPを別フォルダーへ
一式展開して起動してください。F5開始、F6停止は変更していません。
本体が生成・送信した初期化式を実行する試験を追加しました。
実際のFiveMサーバーでの運転確認とは異なります。
''',encoding='utf-8',newline='\n')
print('Applied 0.6.2: parenthesized script return and actionable telemetry error logging')
