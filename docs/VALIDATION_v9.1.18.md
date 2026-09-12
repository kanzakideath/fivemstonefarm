# v9.1.18 検証記録

実施日: 2026-09-13 (JST)

## ローカル Windows 検証

- `scripts/Build.ps1 -Version 9.1.18`: PASS
  - 配布用 x64 EXE のコンパイル
  - `--validate` / `--smoke-test`
  - UI Host、Background Bridge、Updater の自己検証
  - Stone Metagame Node 7テスト（基礎抽選100万回、保証/Pity/Pickup統合抽選10万回を含む）
  - Stone Metagame C# 83 assertions
- `scripts/Test-FastWashContract.ps1`: PASS
- `scripts/Test-FastWashRuntime.ps1`: PASS（229 assertions）
- `scripts/Test-StationaryWait.ps1`: PASS（11 cases）
- `scripts/Test-StoneProgressContract.ps1`: PASS
- `scripts/Test-SupportExport.ps1`: PASS
- `scripts/Test-WashPositionDesktop.ps1`: PASS
  - 合成Windowsターゲットに対する入力・観測試験であり、FiveM実動作ではない
- `scripts/Test-UpdateCatalog.ps1 -Live`: PASS
  - GitHub上のv9.1.17 / v9.1.16 / v9.1.15について、各署名manifestを検証
  - 指定したv9.1.17と同じバージョン・SHA-256のEXEが取得されることを確認

## UI実画面検証

実際のオフラインHTML/CSS/JavaScriptをChromeで起動し、1366×850、820×640、600×640、390×700の4条件で確認した。

- 通常開始ボタン直下の「高速石洗いを開始」
- 高速開始、停止、次の通常開始で高速状態を持ち越さないこと
- 設定画面に旧「最速石洗い」スイッチが存在しないこと
- v9.1.18 / v9.1.17 / v9.1.16 / v9.1.15の選択式一覧
- 手入力欄が存在しないこと
- 旧版切替の確認ダイアログと、確認後だけ送る正確な`update.install(version)`
- JavaScript page errorなし、横方向overflowなし

スクリーンショット:

- `artifacts/route-ui-v918-release/overview-1366.png`
- `artifacts/route-ui-v918-release/update-versions-1366.png`
- 同ディレクトリの820 / 600 / 390版

加えて、配布物と同じオフライン資産を実際のWindows WebView2ホストで起動し、実モニター2560×1600・表示倍率175%を含む13画面を確認した。

- 概要、作業選択シート、設定、車両、アップデート
- 狭幅レイアウト
- STONE各ページ
- JavaScriptエラーなし、テスト前後で配布用Web資産の変更なし

WebView2スクリーンショット:

- `artifacts/ui-host-v918/scale-100/overview.png`
- `artifacts/ui-host-v918/scale-100/update.png`
- 同ディレクトリ以下の各画面・表示倍率版

## 公開ゲート

一回限りのGitHub Actions publisherは、承認したmainの完全なSHAだけを対象に、署名、公開済みv9.1.17内蔵Updaterによる更新適用、公開カタログ、実ブラウザUI、アップロード後の全byte再照合を行う。公開後のLatest経路に失敗した場合はv9.1.17をLatestへ戻し、v9.1.18をdraftへ戻して失敗終了する。

## 未確認事項

この作業環境ではFiveMサーバーへ接続した長時間の石洗いを実行していない。高速経路は実本番関数を使うスクリプト化I/O試験までを確認済みで、実サーバー固有の表示遅延は公開後の利用環境で確認が必要。
