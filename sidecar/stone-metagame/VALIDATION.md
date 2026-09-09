# 単独検証記録

検証日: 2026-09-10
対象: `sidecar/stone-metagame` のみ

## 自動テスト

```powershell
npm test
dotnet run --project .\backend.tests\StoneMetaGame.Tests.csproj --configuration Release
node --check .\ui\meta-game.js
node --check .\demo\demo-adapter.js
node --check .\scripts\serve.mjs
```

最終結果:

- Node: 7 tests passed
- .NET Framework 4.8: 83 assertions passed
- JavaScript syntax: passed

Nodeで確認した内容:

- 108アイテム、6レア度、39実績、13好感度ランク、複数バナーの参照整合性
- 各バナーの提供割合が10,000 basis points
- 事前確定した単発結果がケースリールの指定停止位置へ必ず入る
- 不正なリール枚数／停止位置を黙って処理しない
- 10連の3種の開封順が全確定結果を重複・欠落なく保持する
- UI、データ、演出に外部CDN依存がない
- 1,000,000回の素の抽選を固定seedで実行し、全レア度が6σ範囲内
- 100,000回の統合抽選で、全10連の最低保証、SSR/UR/LEGENDARY Pity、
  Pity優先順位、PICK UP実測値を同時検証

.NETで確認した内容:

- 1件の採掘成功で累計、XP、Point、日別統計が一度だけ増える
- 採掘・石洗い・砂金採りを表す3つの安定event IDが各1回だけ加算され、逆順再送でも合計3のまま
- 5件の履歴移行を2件保存後に中断し、再起動後に全件再送しても合計、XP、Pointが5のまま
- 同じ採掘イベントIDと抽選request IDの再送は二重計上・二重消費しない
- 999回では未解除、1000回で実績と好感度を各1回解除、1001回で再解除しない
- Mining Level 10の1 XP前／ちょうど／1 XP後
- レベル・好感度・反復チケット目標の進捗バーが現在区間で正しく0へ戻る
- レベル／好感度／実績報酬Grantと個別受取、再受取拒否、称号所有
- 再起動後も受取済み状態と所有権を保持
- SSR/URの同時PityではUR、3系統同時ではLEGENDARYが優先
- 10連最低保証、PICK UP、通貨消費、重複かけら、図鑑、履歴
- primary破損時のchecksum付きbackup復旧
- 未知の将来schemaを初期化・上書きしない
- 強制終了セッションでオフライン時間を稼働時間へ加算しない
- 配布モードのDebug拒否、WebViewからの採掘数偽装拒否、余分なpayload拒否
- SVGのカスタムプロフィール画像を拒否
- プロフィール一括更新が全項目の検証前に部分保存されない

## 実ブラウザー描画

ローカルHTTPサーバーとインストール済みMicrosoft Edge／Google Chromeを使い、実際のHTML/CSS/JSを
1440×1000および600×1000で描画しました。単発と10連はDebug結果をUI経由で発火し、
単発では結果画面まで待機、10連ではALL OPENを実行しています。

- `preview-artifacts/v2-home.png`: HOME
- `preview-artifacts/v2-home-narrow.png`: 狭幅HOME／下部ナビゲーション
- `preview-artifacts/v2-affinity.png`: 好感度
- `preview-artifacts/v2-gacha.png`: 複数バナー／3系統Pity
- `preview-artifacts/v2-collection.png`: NEW・お気に入り・フレーム・アイコン
- `preview-artifacts/v2-achievements.png`: カテゴリ・tier・進捗
- `preview-artifacts/v2-profile.png`: プロフィールカード／採掘・抽選レコード
- `preview-artifacts/v2-settings.png`: 音量・品質・速度・reduced motion
- `preview-artifacts/v2-result-ssr.png`: 単発SSR RESULT
- `preview-artifacts/v2-ur-result.png`: 単発UR RESULT
- `preview-artifacts/v2-legendary-result.png`: 単発LEGENDARY RESULT
- `preview-artifacts/v2-ten-result.png`: 10連ALL OPEN
- `preview-artifacts/v3-profile-editor.png`: ライブプレビュー／称号の所持・未所持
- `preview-artifacts/v3-profile-icons.png`: 所持アイコン選択／未所持ロック表示／固定保存操作
- `preview-artifacts/v3-gacha-history.png`: 公称率・実測率と詳細統計
- `preview-artifacts/v3-onboarding.png`: 3ステップ初回導線
- `preview-artifacts/v3-ten-result.png`: 複数構成対応後の10連ALL OPEN
- `preview-artifacts/v3-profile-icons-narrow.png`: 600px幅のプロフィール編集
- `preview-artifacts/v3-ten-result-narrow.png`: 600px幅の10連結果／固定受取操作

描画確認中、非表示・最小化相当の環境では2フレーム待ちが停止し、単発演出がリールから
進まない問題を再現しました。`requestAnimationFrame` に80msの安全なfallbackを追加し、
同じヘッドレス条件でSSR/UR/LEGENDARYのRESULT到達を再確認しています。

## 未確認

- sidecarは本体へ未接続のため、現在の配布EXE／WebView2内での表示と実採掘連動
- FiveMの実報酬確認イベントから `RecordVerifiedMiningSuccess` への結線
- 実スピーカーによる音量バランス（Web Audioの生成経路と設定反映はコード／画面で確認）
- Windows表示倍率150%の配布EXE内確認
- サーバー、FiveM、他ユーザーのデータへ作用する試験

これらを「確認済み」とは扱いません。本体統合後の手順は [INTEGRATION.md](./INTEGRATION.md)
に分離しています。
