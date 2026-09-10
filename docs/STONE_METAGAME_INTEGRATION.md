# Stone Metagame統合仕様（v9.1.2）

この文書は、検証済みの `sidecar/stone-metagame/` をAI採掘機へ接続する境界をまとめたものです。抽選率、Pity、Pickup、保証、Profile、状態構造は本体側で再実装しません。詳細な正規仕様は `sidecar/stone-metagame/INTEGRATION.md` です。

## 境界とイベント

Farm Controllerは採掘・石洗い・砂金採りの開始前後に確定インベントリsnapshotを取得します。`ConfirmPendingFarmReward` が重量またはアイテム数の増加を確認したときだけ、作業モードを含む一意なevent IDをoutboxへ積み、認証済みUI hostへ `MINING_SUCCESS` を送ります。wire commandは互換性のため従来名を維持しますが、意味は3モード共通の確認済みSTONE作業報酬です。

- 1件の確認済み作業報酬 = 1件のイベント（採掘・石洗い・砂金採り共通）
- 同じevent IDの再送はMetagame hostが冪等に処理
- UI hostが一時的に利用できない場合は、Farmループを止めず同じIDをbackoff再送
- クリック、進捗開始、失敗、Inventory Full、収納、復帰は対象外
- XP、Level、Affinity、Achievement、Points、Rewardsの計算はMetagame内部だけで実行

UIとの通信は既存の単一Framework7 9.1.3 iOS themeとWebView2 hostを使います。HOME、GACHA、COLLECTION、ACHIEVEMENTS、PROFILEは取り込んだsidecar部品を使い、ガチャ操作は公開API経由で実行します。既存FarmのCSSと衝突しないよう、Metagameのstyle scopeを維持します。

## 保存

Farm設定の `AI採掘機.ini` とMetagameデータは混在させません。

```text
%LOCALAPPDATA%\AI採掘機\metagame\state.json
%LOCALAPPDATA%\AI採掘機\metagame\state.json.bak
%LOCALAPPDATA%\AI採掘機\verified-reward-wal.tsv
```

Metagame stateはschema v2です。本文とSHA-256を含むenvelopeを一時ファイルへ書き、置換によって原子的に保存します。通常ファイルを検証できない場合だけbackupを読みます。Profile、Gacha、Collection、Achievements、Affinity、Statistics、履歴、Pityはこの状態に含まれます。

実報酬を確認すると、モード・snapshot revision・固定event ID・確認時刻を専用WALへ `FlushFileBuffers` 済みで記録し、次にoutbox、最後にWAL完了tombstoneの順で永続化します。未完了WAL行がある間はそのeventをHostへ送らず、起動時またはF9後の次回F8前に専用の閉じたsessionへ回収します。不完全な末尾行は次の行と連結しない形式で隔離します。時計が戻った場合はevent IDを維持したままreplay時刻だけ現在時刻以下へ丸めます。

v9.0.2への初回更新時は、EXEと同じ場所に残る診断ログの `FARM_REWARD_CONFIRMED` 行だけをUI Host起動前に読み、既存のdurable outboxへ閉じた履歴sessionとして積みます。移行event IDは元の時刻・モード・attempt・snapshot revisionから決定的に生成します。Windows時計やタイムゾーン変更で元時刻が未来になっている場合は、IDを変えず送信時刻だけ移行時刻へ丸め、Hostの未来時刻拒否でFIFOが停止しないようにします。移行markerは診断ログを所有するインストールフォルダー単位でoutboxの原子的保存後に記録します。このため、ログのない別フォルダーの初回起動は旧フォルダーの移行権を消費しません。削除済みログやクリック数からの推定は行いません。

## Farm・収納の閉ループ

Farm Controllerが持つ権威状態は次の23状態です。

```text
IDLE
FARMING
WASH_SETTLING
WASH_CORRECTING
WASH_VERIFYING
CHECKING_INVENTORY
NEED_STORAGE
STOPPING_FARM
LOCATING_TRUCK
MOVING_TO_TRUCK
VERIFY_TRUCK_REACHED
OPENING_STORAGE
STORING_OUTPUTS
VERIFY_STORAGE
REFILLING_INPUT
VERIFY_REFILL
LOCATING_FARM
RETURNING_TO_FARM
VERIFY_FARM_REACHED
RESUMING_FARM
VERIFY_FARM_RESUMED
RECOVERY
ERROR
```

正常な収納は次の順序を飛ばしません。

```text
FARMING
  -> CHECKING_INVENTORY
  -> NEED_STORAGE
  -> STOPPING_FARM
  -> LOCATING_TRUCK
  -> MOVING_TO_TRUCK
  -> VERIFY_TRUCK_REACHED
  -> OPENING_STORAGE
  -> STORING_OUTPUTS
  -> VERIFY_STORAGE
  -> （石洗いのみ）REFILLING_INPUT
  -> （石洗いのみ）VERIFY_REFILL
  -> LOCATING_FARM
  -> RETURNING_TO_FARM
  -> VERIFY_FARM_REACHED
  -> RESUMING_FARM
  -> VERIFY_FARM_RESUMED
  -> 最初の確認済み報酬
  -> FARMING
```

容量不足は、最新snapshotを使い、次のいずれかで判定します。

- `weight / maxWeight >= StorageTriggerPercent`（既定92%、50～99%）
- 残り重量が `max(MinimumFreeWeight, EstimatedRewardWeight)` 以下（予測重量の既定2000g、250～20000g）
- 空きスロットが `MinimumFreeSlots` 以下（既定1、0～10）

収納成功は、プレイヤー側で台帳対象が実際に減り、登録済み荷台側で同じname/metadataの数量が実際に増え、次回報酬を受け取れる容量になった場合だけです。部分移動は確認できた数量だけ台帳から減算し、残数を同じ荷台で再試行します。検証に失敗してもすぐ作業地点へ戻らず、同じ荷台で `MaxRetries`（既定5、1～8回）まで再観測します。各検証の上限は `VerifyTimeoutMs`（既定5000ms、1000～15000ms）です。

収納対象は、各確認済み報酬で増えたname/metadata別の正の数量差分を実行中の台帳へ加算した分だけです。途中で食料を使う、道具のmetadataだけが変わる、既存品が増減する場合は収納対象へ混ぜません。開始時点ですでに容量不足の場合や台帳上の出力を証明できない場合は、既存の食料・道具を全搬出せず `UNTRUSTED_STORAGE_BASELINE` で安全停止します。

石洗いでは収納確認後に、実報酬から学習済みの未洗浄石だけを最新容量内の絶対目標数まで荷台から戻し、プレイヤー側の実増加と荷台側の実減少を確認します。未洗浄石IDを証明できない、容量を再取得できない、補充差分を確認できない場合は作業復帰へ進みません。

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
