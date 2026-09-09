# サウンド資産スロット

現在の sidecar UI は、外部ファイルなしでも動く軽量な Web Audio 合成音を使用します。音声ファイルを後から用意する場合は、再配布権を確認したローカル資産だけをここへ置き、次の役割名で adapter から差し替えてください。

- `ui-click`: 決定音
- `ui-hover`: 控えめなフォーカス音
- `ui-navigate`: 画面遷移音
- `reel-loop`: ケース回転中のループ
- `reel-stop`: 停止音
- `rare-reveal`: 高レア開示
- `legendary-reveal`: LEGENDARY 開示
- `achievement`: 実績解除
- `affinity-level-up`: 好感度昇格

形式は配布サイズと WebView2 の互換性から `.ogg` または `.mp3` を推奨します。音量・ミュート・BGM/SFX区分は `MetaSettings` に接続し、ミュート中や `reduceMotion` 有効時に強制再生しないでください。
