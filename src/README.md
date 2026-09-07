# ソース配置

ビルドは次のファイルを使用します。

- `mining-auto.ahk`: メインアプリ
- `background-bridge/CdpBridge.cs`: FiveM NUIバックグラウンド操作ヘルパー
- `updater/Updater.cs`: 署名付き更新ヘルパー
- `assets/`: `FileInstall` するPNGなどの静的アセット

`Build.ps1` は `src/` を一時ステージへコピーし、C#ヘルパーを `AI採掘機_Background.exe` と `AI採掘機_Updater.exe` の名前でステージ直下へ生成してから、AutoHotkeyアプリをコンパイルします。生成されたEXEを `src/` へコミットしないでください。
