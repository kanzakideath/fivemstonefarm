# AI採掘機 Web UI

Framework7 9.1.3 の iOS テーマを使う、WebView2 向けの完全オフライン UI です。通常起動時に CDN や外部ネットワークへ接続しません。

## ビルドと確認

```powershell
npm ci
npm run check
npm run build
```

配布用の静的ファイルは `www/` に生成されます。ブラウザーだけで画面を確認するときは `www/index.html?fixture=1` を開きます。`page=stone|vehicle|settings|update`、`metaRoute=home|gacha|collection|achievements|profile`、`running=1`、`picker=1` も組み合わせられます。fixture時だけsidecarのプレビューadapterを動的に読み込み、通常起動ではC#ホストを権威側として使用します。

## WebView メッセージ

ホストから受け取る状態は次の形です。

```json
{
  "type": "state",
  "revision": 1,
  "version": "9.1.5",
  "page": "overview",
  "running": false,
  "registrationActive": false,
  "actionMode": "mining",
  "windowVisible": true,
  "controls": {}
}
```

`controls` で利用するキーは次のとおりです。すべて任意で、欠けている値は安全な待機表示になります。

- 概要: `overviewSubtitle`, `runStatus`, `connection`, `operationMode`, `runButton`, `actionPicker`, `metricPrimaryLabel`, `metricPrimaryValue`, `metricCorrectionLabel`, `metricCorrectionValue`, `metricStorageValue`, `shortcut`
- 車両: `vehicleStatus`, `vehicleEnabled`, `capacity`, `capacityDetail`, `companionStatus`, `companionDetail`, `vehicleRegister`, `vehicleDelete`
- 設定: `startHotkey`, `stopHotkey`, `backgroundMode`, `hideWhileRunning`, `correctionEnabled`, `autoEat`, `foodKey`, `autoCheckUpdates`, `minimumFreeWeight`, `storageTriggerPercent`, `estimatedRewardWeight`, `minimumFreeSlots`, `storageMaxRetries`, `farmWatchdogMs`, `targetLostRecoveryMs`, `debugOverlay`, `settingsSave`, `settingsFeedback`
- 更新: `updateStatus`, `updateIntegrity`, `updateButton`, `updateFeedback`, `updateAvailable`

各コントロールは `{ "text": "表示", "value": true, "enabled": true, "tone": "success" }` の必要な項目だけを持てます。

UI からは常に次の形で送ります。

```json
{
  "type": "action",
  "action": "nav",
  "payload": { "page": "vehicle" }
}
```

対応アクションは `hello`, `nav`, `action.select`, `run.toggle`, `vehicle.toggle`, `vehicle.register`, `vehicle.delete`, `settings.save`, `update.check`, `window.close`, `smoke.result` です。車両登録は表示名や固定座標を送らず、ホスト側で「次に FiveM で開いた車両ストレージ」をローカル登録する取り込みを開始します。

ブラウザー fixture では `window.aiMinerTest` から状態変更、画面移動、作業選択、スモーク確認を実行できます。

## Stone Metagame

`metagame/meta-game.js`、`meta-game.css`、`meta-game-template.html`と9個のカタログJSONは、検証済みsidecarの同名ファイルを変更せず取り込んでいます。既存のFramework7 `theme: 'ios'`インスタンスを再利用し、メタゲーム用の2個目は作りません。

本番adapterの要求と応答は次の契約です。

```json
{ "type": "meta.bootstrap", "requestId": "meta-ui-..." }
{ "type": "meta.execute", "requestId": "meta-ui-...", "action": "gacha.draw", "payload": {} }
{ "type": "meta.response", "requestId": "meta-ui-...", "result": {} }
```

要求には一意なIDと20秒のタイムアウトがあり、WebViewのナビゲーション時には未解決要求を破棄します。許可する通常操作は`gacha.draw`、プロフィールの原子的更新、図鑑のお気に入り／既読、報酬受取、初回導線完了、メタゲーム設定更新だけです。採掘回数・XP・ポイント・Pity・抽選結果をWeb側から指定する操作はありません。

`meta.miningRecorded`、`meta.sessionStarted`、`meta.sessionEnded`は購読イベントとしてsidecar UIへ渡し、HOMEなどを部分更新します。`採掘へ戻る`は既存の概要画面へ移動するだけで、自動Farmの開始・停止は変更しません。
