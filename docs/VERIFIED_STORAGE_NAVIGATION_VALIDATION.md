# 徒歩収納・補充 修正候補の検証記録

## 状態

修正コードを実装し、Windows上でフルビルドと既存回帰試験を実行しました。
**実際のFiveMサーバーでの歩行・収納・補充・帰還は未検証です。安定版への自動配信は行っていません。**

ベース: main / v9.1.7 (`83e3a904c9c54ab9af59f567eefa46ae1d39c49e`)
検証した修正ソース: `e9dedef4993aa5fc68877a544607d49b1c48d552`
Windows Actions run: https://github.com/kanzakideath/fivemstonefarm/actions/runs/34563901290
job: `103151972503`, conclusion: success
実行日: 2026-09-11

一時的なソース適用スクリプトは上記検証後に削除しました。
残したCIはチェックイン済みソースをそのまま検証し、ソースやブランチを書き換えません。

## コードから確認した原因

1. 登録の入口が `BeginLocalVehicleRegistration` に固定され、徒歩連携登録に進まなかった。
2. `IsValidVehicleProfile` が protocol=0 しか受け付けず、companion登録を拒否していた。
3. 収納処理が長い視点探索と短い時間指定入力に依存し、登録車両の実座標へ到達する処理につながっていなかった。
4. UIがサーバー管理者・補助リソースの説明を別の案内へ置換し、徒歩連携の必要条件が見えなかった。
5. 石0から開始するcompanion側の経路が、存在しない洗浄ボタンの検出を先に要求していた。

## 実施した試験

| 試験 | 結果 | 確認範囲 |
|---|---|---|
| Test-VerifiedNavigation.mjs | PASS | 実装の接続箇所と実際のJS説明文関数 |
| Companion Validate-Resource.ps1 | 39チェック PASS | 正規リソースの静的検証。実ゲーム動作ではない |
| Camera recovery contract | PASS | ソース契約 |
| Washing completion recovery contract | PASS | ソース契約 |
| Farm recovery / alert safety contract | PASS | ソース契約 |
| Storage closed-loop contract | PASS | mainと実際のincludeモジュールの契約 |
| STONE progression contract | PASS | ソース契約 |
| Work DOM expression tests | PASS | UI式のテスト |
| Fake-DevCon tests | PASS | 模擬通信 |
| Stone Metagame Node tests | 7/7 PASS | 基礎抽選100万回・保証/Pity/Pickup10万回を含む |
| Stone Metagame backend tests | 83 assertions PASS | C#バックエンド |
| Web UI build/check | PASS | UI構築・構文・Adapter契約 |
| UI host build/self-test | PASS | Windows上のホスト検証 |
| AHK compilation | PASS | 実行可能ファイル生成 |
| Compiled history backfill integration | PASS | コンパイル済み履歴復元試験 |
| 完成EXE validate / smoke | PASS | 新しいナビAdapter模擬試験を含む自己テスト・画面起動 |

新しいナビ試験は本番と同じ `ExecuteVerifiedNavigation` に模擬Adapterを渡して実行します。
正常な到着、受付だけの応答、ID欠落、network ID 0、行き詰まり、手動停止、
入力解除・UI閉鎖・接続確認失敗、移動直後のキャンセルを確認します。
**「キー送信した」「StateがMOVINGになった」だけでは到着成功としません。**

## 初回の失敗と修正

最初の実行では収納契約テストがmainだけを読み、新しいinclude内のMOVING_TO_TRUCK入口を見つけられず失敗しました。
テストをスキップせず、実際にコンパイルされるincludeも読み込むよう変更して再実行しました。

## 未配信候補EXE

上記runで生成したEXE: 10,931,200 bytes
SHA-256: `1d64da3de03347b7dfac55377e6c0fdfbb24877066479cf422ae8bc51fd5841d`
バージョン表示はベースと同じ9.1.7です。配信済み9.1.7のEXEとは別の検証候補で、署名付き自動更新用リリースではありません。

## 利用前に必要な確認

- サーバー管理者が `ai_miner_companion` を導入し、所有権・ガレージ連携を設定すること。
- 今回のWorkArrivalDistance設定を含むresourceを使用すること。
- アプリで「徒歩往復する車両を登録」から登録し直すこと。
- 実機で石掘り・砂金・石洗いを少なくとも1往復ずつ確認すること。
- 90/180度の視点変更、F9停止、経路不達、荷台満杯、補充石0も確認すること。

専用のニューラルAI女性音源は未制作です。音声はWindows日本語女性音声優先のSAPIまたはユーザーが用意したローカルWAVです。
ローカル荷台IDだけでは車両座標を取得できないため、サーバー連携なしの遠距離徒歩往復はこの修正の対象外です。
