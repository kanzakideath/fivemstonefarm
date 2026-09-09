# Stone Metagame統合仕様（v9.0.1）

この文書は、検証済みの `sidecar/stone-metagame/` をAI採掘機へ接続する境界をまとめたものです。抽選率、Pity、Pickup、保証、Profile、状態構造は本体側で再実装しません。詳細な正規仕様は `sidecar/stone-metagame/INTEGRATION.md` です。

## 境界とイベント

Farm Controllerは採掘の開始前後に確定インベントリsnapshotを取得します。`ConfirmPendingFarmReward` が重量またはアイテム数の増加を確認したときだけ、一意なevent IDをoutboxへ積み、認証済みUI hostへ `MINING_SUCCESS` を送ります。

- 1件の確認済み採掘報酬 = 1件のイベント
- 同じevent IDの再送はMetagame hostが冪等に処理
- UI hostが一時的に利用できない場合は、Farmループを止めず同じIDをbackoff再送
- 石洗い、砂金採り、クリック、進捗開始、失敗、Inventory Full、収納、復帰は対象外
- XP、Level、Affinity、Achievement、Points、Rewardsの計算はMetagame内部だけで実行

UIとの通信は既存の単一Framework7 9.1.3 iOS themeとWebView2 hostを使います。HOME、GACHA、COLLECTION、ACHIEVEMENTS、PROFILEは取り込んだsidecar部品を使い、ガチャ操作は公開API経由で実行します。既存FarmのCSSと衝突しないよう、Metagameのstyle scopeを維持します。

## 保存

Farm設定の `AI採掘機.ini` とMetagameデータは混在させません。

```text
%LOCALAPPDATA%\AI採掘機\metagame\state.json
%LOCALAPPDATA%\AI採掘機\metagame\state.json.bak
```

Metagame stateはschema v2です。本文とSHA-256を含むenvelopeを一時ファイルへ書き、置換によって原子的に保存します。通常ファイルを検証できない場合だけbackupを読みます。Profile、Gacha、Collection、Achievements、Affinity、Statistics、履歴、Pityはこの状態に含まれます。

## Farm・収納の閉ループ

Farm Controllerが持つ権威状態は次の12状態です。

```text
IDLE
FARMING
INVENTORY_CHECK
INVENTORY_FULL
STOPPING_FARM
OPENING_STORAGE
STORING
VERIFY_STORAGE
RETURNING_TO_FARM
RESUMING_FARM
RECOVERY
ERROR
```

正常な収納は次の順序を飛ばしません。

```text
FARMING
  -> INVENTORY_CHECK
  -> INVENTORY_FULL
  -> STOPPING_FARM
  -> OPENING_STORAGE
  -> STORING
  -> VERIFY_STORAGE
  -> RETURNING_TO_FARM
  -> RESUMING_FARM
  -> 最初の確認済み報酬
  -> FARMING
```

容量不足は、最新snapshotを使い、次のいずれかで判定します。

- `weight / maxWeight >= StorageTriggerPercent`（既定92%、50～99%）
- 残り重量が `max(MinimumFreeWeight, EstimatedRewardWeight)` 以下（予測重量の既定2000g、250～20000g）
- 空きスロットが `MinimumFreeSlots` 以下（既定1、0～10）

収納成功は、プレイヤー側の重量または数量が実際に減り、開始後に増えた差分が残らず、次回報酬を受け取れる容量になった場合だけです。検証に失敗してもすぐ作業地点へ戻らず、同じ荷台で `MaxRetries`（既定5、1～8回）まで再試行します。各検証の上限は `VerifyTimeoutMs`（既定5000ms、1000～15000ms）です。

収納対象は実行開始時snapshotからの正の数量差分だけです。開始時点ですでに容量不足の場合や差分を証明できない場合は、既存の食料・道具を全搬出せず `UNTRUSTED_STORAGE_BASELINE` で安全停止します。

世代とtask IDに一致しない遅延結果は捨て、Farm、収納、復帰、Recoveryを並列実行しません。Recoveryへ入ると所有している入力をすべて解放し、インベントリ・画面・視点を整理して最新状態を観測します。まだ容量不足なら荷台探索へ、収納済みなら作業地点への復帰へ分岐します。移動履歴を破棄して無条件にFarmへ戻すことはしません。

## Watchdogと可観測性

- `FarmWatchdogMs=60000`（15000～180000ms）: 確認済み報酬が増えない状態を検出
- `TargetLostRecoveryMs=15000`（5000～60000ms）: 作業対象を見失った状態から視点・対象Recoveryへ移行
- `RewardConfirmTimeoutMs=5000`（1000～10000ms）: 完了後の実インベントリ差分を待機
- `DebugOverlay=0`: 1にするとFSM状態、task ID、再試行、snapshot、Watchdog、判定理由を表示

ログには状態遷移、実行世代、task ID、インベントリrevision、重量・スロット、満量理由、収納前後差分、再試行、対象喪失時間、Watchdog時間、停止理由を記録します。

## 検証と既知の制約

ビルドはsidecarのNode/C#テスト、UI・catalog取り込み元とのSHA-256一致、Metagame IPCの認証・重複排除・再起動復元、Farm状態遷移の模擬試験を実行します。既存sidecarテストは削除しません。

自動テストは実際のFiveMへ入力しません。サーバー固有のox_inventory NUI、車両配置、フレーム落ち、通信遅延を含むライブ動作は、許可されたFiveM環境で追加確認が必要です。サーバー側APIを使わないため、作業場所から離れた登録車両をマップ全域で追跡することはできません。
