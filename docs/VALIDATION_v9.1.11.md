# v9.1.11 更新検査の検証記録

## 比較試験

Windows Actions: https://github.com/kanzakideath/fivemstonefarm/actions/runs/34662089918

公開v9.1.10のEXEはSHA-256 `cbbe82396409e10e1dc8df50171a133bcc7a151eac78f0a44ef35fca220e074d` を確認して使用しました。修正後の実ソースは `ea7f70195481975d77294e766af8adf6f6597185` です。

| 条件 | 公開v9.1.10 | 修正後 |
|---|---|---|
| GUI親・標準ハンドルなし・既定設定のvalidate | 146 | 0 |
| GUI親・標準ハンドルなし・カスタムINIのvalidate | 146 | 0 |
| 出力リダイレクトあり・カスタムINIのvalidate | 54 | 0 |
| GUI親・標準ハンドルなしのUI smoke | 0 | 0 |

修正後は4ケースすべて、現在のINI、旧INI、診断ログの内容・存在状態が変化しないことも確認しました。単に待機を長くした修正ではなく、補助ログの書込み失敗の非致命化と、検証用設定の分離です。既存の自己検査アサーションは残しています。

## 実行方法

`scripts/Test-UpdateStartup.ps1 -ExecutablePath <完成EXE>` は通常のBuild.ps1にも組み込まれています。小さなWinExe親プロセスがコンソールを切り離し標準ハンドルを空にしてから、アップデーターと同じProcessStartInfo条件で完成EXEを起動します。出力をリダイレクトする従来CIとの差を直接検査します。

フルWindowsビルド、完成EXEの通常検証、履歴移行テスト、既存の収納・石洗い等の回帰試験、合成Windows画面でのW入力検証も成功しました。これらは実FiveMの動作成功を意味しません。

## 配布前の追加検査

署名済み配布物ができた時点で、`scripts/Test-UpdateApply.ps1 -ArtifactDirectory <署名済み配布フォルダー>` を使います。このスクリプトは使い捨てGitHub Actions環境に限定しています。公開v9.1.9から本物のUpdaterバイナリを抽出し、既存署名鍵で署名された新版の実EXE置換・validate・smoke・設定保持・再起動までを検証します。結果は実行後の `apply-result.json` と `updater.log` に記録され、リリース公開をこの成功で制限します。

STONEや利用者の実ファイルを削除して検査を通す処理はありません。このバージョンの変更対象は更新用の検証起動、版数、試験と説明のみです。石洗い・移動・収納・補充の既存仕様と未検証範囲については [前版の実機能検証記録](VALIDATION_v9.1.10.md) を引き継ぎます。
