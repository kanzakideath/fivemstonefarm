# STONE META GAME sidecar

`AI採掘機` の自動操作本体へ後から統合するために、別ディレクトリで実装した石ソシャゲです。
本体の `src/`、`config/`、ビルド成果物には変更を加えません。

## ゲームループ

```text
ホストが確定したSTONE作業報酬
  → Mining XP / Level / Mining Point
  → 好感度・実績・節目報酬
  → 単発／10連ガチャ
  → NEW・重複かけら・図鑑
  → アイコン／フレーム／称号
  → HOMEの次目標
```

HOMEには、レベル、好感度、チケット節目、図鑑完成率、未受取報酬から優先度の高い
4件だけを表示します。クリックや画面再描画では進まず、ホストが確認したSTONE作業報酬だけが
1つのトランザクションとして進行します。

## 実装内容

- `backend/`: .NET Framework 4.8の権威サイド
  - 安定したイベントIDによる採掘・抽選の冪等化
  - XPカーブ、レベル報酬、13段階の好感度イベント、39実績
  - 複数バナー、バナー別3系統Pity、10連保証、PICK UP、重複かけら
  - 報酬Grantの個別／一括受取と二重受取防止
  - SHA-256付きprimary/backup、自動保存、schema移行、将来schema拒否
- `data/`: 108種の石・アイコン・フレーム、バナー、確率、実績、好感度、報酬、
  称号、文章、Asset RegistryをJSONで管理
- `ui/`: HOME、FARM、AFFINITY、GACHA、COLLECTION、ACHIEVEMENTS、PROFILE
  - 物理カーブ付きケースリールと、確定済み結果への正確な停止
  - SSR/UR/LEGENDARY別演出、3種ずつの演出variant、予兆、fakeout
  - 10連の1枚ずつOPEN／ALL OPEN／SKIP
  - 10連は低レア順／最高レアを最後／ランダム順の3構成（確定結果は不変）
  - 履歴、公称率と実測率の比較、図鑑詳細、検索・絞り込み・お気に入り・NEW
  - 通知キュー、報酬演出、Audio管理、LOW/MEDIUM/HIGH、FAST/SKIP、reduced motion
  - 所持／未所持表示とライブプレビュー付きプロフィール編集、一括・原子的保存
  - ポイント、チケット、採掘記録のカウンターアニメーション
  - 横長サイドバーと狭幅下部ナビゲーション
- `demo/`: 本番データに触れないLocalStorageプレビュー
- `backend.tests/` / `tests/`: 境界、保存復旧、確率、保証、Pity、PICK UP、演出計画

## 独立プレビュー

Node.js 20以降で実行します。

```powershell
cd sidecar\stone-metagame
npm test
npm run preview
```

ブラウザーで `http://127.0.0.1:4173/demo/?reset=1` を開きます。

便利な表示fixture:

- `?reset=1&route=gacha`
- `?reset=1&route=collection`
- `?reset=1&route=achievements`
- `?reset=1&route=profile&modal=profile`
- `?reset=1&route=profile&modal=profile&profiletab=icon`
- `?reset=1&route=gacha&autodraw=1&force=SSR`
- `?reset=1&route=gacha&autodraw=1&force=UR`
- `?reset=1&route=gacha&autodraw=1&force=LEGENDARY`
- `?reset=1&route=gacha&autodraw=10&force=SSR&reveal=all`
- `?reset=1&onboarding=1`
- `?reset=1&debugpanel=1`

プレビューの赤い `DEBUG` から、ポイント、XP、採掘数、好感度、実績、各レア、
10連、SSR/UR/LEGENDARY Pityを直接確認できます。配布モードではDebug API自体が拒否されます。

## テスト

```powershell
npm test
dotnet run --project .\backend.tests\StoneMetaGame.Tests.csproj --configuration Release
node --check .\ui\meta-game.js
node --check .\demo\demo-adapter.js
```

`npm test` には100万回の基礎確率シミュレーションと、10万回の
「10連保証＋3系統Pity＋PICK UP」統合シミュレーションが含まれます。
詳細な確認結果とスクリーンショットは [VALIDATION.md](./VALIDATION.md) を参照してください。

## 信頼境界

- Web UIからSTONE作業回数、XP、ポイント、チケット、Pity、抽選結果を直接指定できません。
- STONE加算はホストだけが呼べる `RecordVerifiedMiningSuccess` に限定します。API名は統合互換性のため維持しています。
- ガチャ結果はC#で先に確定し、UIはその結果へ止まる演出だけを生成します。
- プレビュー用LocalStorage adapterは本番統合に使用しません。

本体への接続方法は [INTEGRATION.md](./INTEGRATION.md)、保存形式は
[docs/DATA_MODEL.md](./docs/DATA_MODEL.md) にまとめています。
