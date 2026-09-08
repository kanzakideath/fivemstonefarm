# AI Miner Companion for FiveM

AI採掘機デスクトップアプリに、録画座標ではなく「現在の登録車両」を知らせる任意のFiveMサーバーリソースです。サーバー管理者が正規のリソースとして導入し、所有権アダプターを設定した環境でだけ使用します。クライアントへのコード注入・メモリ読取り・アンチチート回避は行いません。

## できること

- デスクトップで登録待機中だけ、`ox_target` の車両へ「AI採掘機に登録」を追加
- `ox_target` がなくても、登録待機中の `/aiminer-register` で画面中央の車両を選択
- サーバーが発行した不透明な登録IDを、プレイヤー識別子・正規化ナンバー・モデルへ紐付け
- 車両選択は一時候補として扱い、荷台確認後の明示的な確定時だけ旧登録とResource KVPを置換
- 確定前の失敗・取消・3分の期限切れでは旧登録を維持し、リソースやサーバー再起後も同じIDを復元
- 移動のたびにnetwork ID、state bag、ナンバー、モデルから車両エンティティを再取得
- 車両が少し動いた場合は後端位置を再計算し、徒歩NavMeshタスクを更新
- 車両が走り出した、または大きく移動した場合は追跡せず安全停止
- 自動移動中にW/A/S/D・ジャンプ等の手動操作が入った場合は即座にタスクを解除
- 一時的な作業地点とカメラ向き・上下角度を記録し、収納後に徒歩で戻して作業視点を復元
- サーバー所有権・距離・車両一致を各操作時に再検証
- NUIフォーカスを一度も取得しない、小型・入力透過HUD

これは「マップ上のどこにある車へでも必ず行く」機能ではありません。既定ではプレイヤーから250m以内で、OneSyncとクライアント双方から安全に確認できる車両だけを対象にします。車両が未ストリーム、遠すぎる、同一ナンバー・モデルの候補が複数、経路が塞がれている場合は停止します。テレポートや自動運転はしません。

## 導入

1. この `ai_miner_companion` フォルダーをサーバーの `resources/[local]/` にコピーします。フォルダー名は変更しないでください。
2. `config.server.lua` の所有権検証を、サーバーの車両/ガレージ実装へ接続します。初期値は意図的に全件拒否です。
3. `server.cfg` に追加します。

```cfg
ensure ox_target            # 利用する場合だけ。companionより先
ensure ox_inventory         # 既定の荷台連携。companionより先
ensure ai_miner_companion
```

OneSyncが必須です。サーバー管理者の許可なく、他者が管理するサーバーへ導入しないでください。

### 所有権アダプター

`config.server.lua` はクライアントへ配信されません。既定の `hook` を保ち、`ServerConfig.Ownership.Validator` でサーバー側データベースまたはガレージexportを照合してください。

```lua
ServerConfig.Ownership.Validator = function(source, vehicle, context)
    -- context.ownerIdentifier / context.plate / context.model / context.networkId
    local owned = MyGarageOwnsVehicle(context.ownerIdentifier, context.plate, context.model)
    return owned == true, owned and nil or 'VEHICLE_NOT_OWNED'
end
```

検証できない場合は必ず `false` を返します。テスト用に `Mode = 'allow_all'`、ACE管理なら `Mode = 'ace'` を明示選択できますが、公開サーバーでの `allow_all` は推奨しません。キャラクター単位の識別子が必要なら `ServerConfig.IdentityProvider` も置き換えます。

### 荷台アダプター

初期設定は `ox_inventory` です。登録車両の後端へ到着後、サーバーで所有権・ナンバー・モデル・距離を再検証し、次にクライアントから正確なnetwork IDを渡して `openInventory('trunk', { netid = ... })` を呼びます。exportが失敗または開く処理を拒否した場合は `CARGO_OPEN_ERROR` / `CARGO_OPEN_REJECTED` で終端失敗します。`ox_inventory` の開始・停止は `capabilities.openCargo` に即時反映されます。

別のインベントリ実装を使う場合も、既存モードを選択できます。

- `arrival_only`: 荷台への到着と車両照合だけを行い、通常のtarget UIを使う
- `client_event`: `Config.Cargo.ClientEvent` を呼び出す
- `server_event`: `Config.Cargo.ServerEvent` をサーバー内部で呼び出す

server eventには `source`, authoritative vehicle entity, `{ registrationId, plate, model, networkId }` が渡ります。アダプター側でもインベントリの所有権・ロック・容量を検証してください。companion自体はアイテムを生成・移動しません。

## ゲーム内操作

- `ox_target`：デスクトップの登録待機中に、車両を選び「AI採掘機に登録」
- `/aiminer-register`：登録待機中に、近くの車両を画面中央へ合わせて選択
- `/aiminer-cancel`：進行中の移動または登録待機を中止

車両選択は、デスクトップアプリが `arm-register` で登録待機を開始した時だけ受け付けます。通常時はox_target項目を表示せず、`/aiminer-register` 単独でも候補を作らないため、確定手段のない仮登録は残りません。車両を選んだ時点では仮登録です。デスクトップアプリがその候補の荷台まで移動してアクセスを確認し、`commit-registration` が成功した時点で初めて保存されます。確認に失敗した場合は `abort-registration` で旧登録へ戻します。仮登録は既定で3分後に自動破棄され、`/aiminer-cancel` でも安全のため破棄されます。

矢印キーで視点を記録する画面はありません。デスクトップアプリから登録待機を開始した場合も、車両を画面中央へ合わせて `E`、または `ox_target` で選びます。HUDは操作中だけ右下へ表示され、マウス・キーボード入力を遮りません。`set-work-anchor` は座標とped headingに加えて相対camera heading/pitchを保存し、`return-work` 到着時に下向きの作業視点まで復元します。

自動徒歩移動中に手動でW/A/S/D、ダッシュ、ジャンプ、乗車、しゃがみ等を入力すると `MANUAL_OVERRIDE` で停止し、プレイヤーの操作を優先します。スクリプトのNavMeshタスクはcontrol値を生成しないため、ゲームパッドの小さなスティックドリフトを除外する閾値を設けています。閾値と入力猶予は `Config.Navigation.ManualMoveThreshold` / `ManualOverrideGraceMs` で変更できます。

停車位置が少しずれた場合は後端を再計算します。一方、既定で車速2.5m/sを超える、1回の監視で6mを超えて移動する、または移動開始地点から12mを超える場合は `VEHICLE_MOVING_TOO_FAST` / `VEHICLE_MOVED_TOO_FAR` で停止します。各値は `config.shared.lua` で調整できます。

## デスクトップ連携プロトコル v1

NUIターゲットURLには `cfx-nui-ai_miner_companion` が含まれます。ページは可視HUDと非表示ブリッジを兼ね、次のDOMを更新します。

```text
https://cfx-nui-ai_miner_companion/ui/index.html
#ai-miner-companion-state  (textContentがJSON)
window.__AI_MINER_COMPANION_STATE__
```

DevConコマンドは1種類です。

```text
aiminer_companion <token> <requestId> <command> [registrationId]
```

`token` はNUI JSONで公開されるクライアントセッション限定トークンです。`requestId` は最大64文字の英数字・`_`・`-`。コマンドは次の通りです。

| command | 結果 |
|---|---|
| `capabilities` / `status` | 現在の機能・状態を応答 |
| `arm-register` | 30秒間、画面中央 + `E` またはox_targetの選択を待機 |
| `register-nearby` | 現在狙っている車両を仮登録（旧登録・KVPは維持） |
| `commit-registration [candidateId]` | 荷台位置・所有権等を再検証し、仮登録を確定 |
| `abort-registration [candidateId]` | 仮登録を破棄して旧登録へ復元 |
| `clear-registration [id]` | 確定済みサーバー登録・KVP・state markerを削除 |
| `set-work-anchor` | 現在の徒歩位置を一時作業地点にする |
| `go-vehicle [id]` | 現在の車両位置を解決し、後端へ徒歩移動 |
| `open-cargo [id]` | 到着位置・所有権を再検証して荷台アダプターを呼ぶ |
| `return-work` | 一時作業地点へ徒歩移動 |
| `cancel` | タスクを解除し、仮登録があれば安全に破棄して停止 |

`go-vehicle` と `return-work` の `lastResult` は受付時ではなく、到着または失敗した時点で確定します。別コマンドを受けるまで保持されます。

クライアントresource起動時は、request IDとクライアントepochを照合してサーバーの確定済み登録を復元します。`capabilities.serverRegistrationSync=false` の間は `capabilities`、`status`、安全停止用の`cancel`以外を `SERVER_REGISTRATION_SYNC_PENDING` で拒否します。プレイヤー識別子をまだ取得できない場合も同期済みとは扱わず、自動的に再試行します。

登録選択成功の結果コードは既存v1連携との互換性のため `REGISTERED` のままですが、これは保存完了を意味しません。`registrationTransaction.pending=true` と `registration.id=registrationTransaction.id` が仮登録を示します。確定成功は `REGISTRATION_COMMITTED`、取消成功は `REGISTRATION_ABORTED`、期限切れは `REGISTRATION_TRANSACTION_EXPIRED`、対象候補がない場合は `REGISTRATION_TRANSACTION_NOT_FOUND` です。確定時の車両・距離・所有権再検証に失敗した場合はその具体的な失敗コードを返し、自動で旧登録へロールバックします。

`commit-registration` は、応答喪失後に同じ候補IDを再送しても、そのIDがすでに現在の確定済み登録なら `REGISTRATION_COMMITTED` を再応答します。`abort-registration` も既定60秒間は同じ接続元・所有者・候補IDの再送を `REGISTRATION_ABORTED` として扱います。異なるIDや別プレイヤーのIDは成功扱いにしません。
仮登録と再送receiptの有効時間は `Config.Registration.TransactionTimeoutMs` / `TransactionReceiptMs` で変更できます。receiptはサーバーメモリだけに置かれ、車両登録を復元・永続化するものではありません。

常時存在するJSONの主要形状：

```json
{
  "protocol": "ai-miner-companion",
  "protocolVersion": 1,
  "resource": "ai_miner_companion",
  "resourceVersion": "1.1.0",
  "epoch": "ame_hex",
  "sequence": 1,
  "token": "amt_hex",
  "status": "ready",
  "capabilities": {
    "dynamicVehicleRegistration": true, "transactionalRegistration": true,
    "registrationCommit": true, "dynamicVehicleNavigation": true,
    "workAnchor": true, "returnToWork": true, "cancel": true,
    "cargoArrival": true, "serverRegistrationSync": true,
    "oxTarget": true, "openCargo": true,
    "maxVehicleDistance": 250, "maxTrackedVehicleSpeed": 2.5
  },
  "registration": {
    "registered": false, "id": "", "plate": "", "model": 0, "label": "",
    "networkId": 0, "lastSeen": 0, "available": false, "availabilityCode": ""
  },
  "registrationTransaction": {
    "pending": false, "id": "", "previousId": "",
    "startedAt": 0, "expiresAt": 0, "status": "idle"
  },
  "workAnchor": {
    "set": false, "x": 0, "y": 0, "z": 0, "heading": 0,
    "cameraHeading": 0, "cameraPitch": 0
  },
  "navigation": {
    "active": false, "kind": "", "registrationId": "", "networkId": 0,
    "distance": -1, "attempt": 0, "startedAt": 0, "status": "idle"
  },
  "lastResult": {
    "present": false, "requestId": "", "command": "", "ok": false,
    "code": "", "message": "", "registrationId": "", "networkId": 0
  }
}
```

`registrationTransaction.pending=false` の形は常に `id=""`, `previousId=""`, `startedAt=0`, `expiresAt=0`, `status="idle"` です。仮登録中は `status="staged"`、時刻はUnix秒の整数で、`expiresAt > startedAt` です。`previousId` は旧登録がない場合だけ空です。

`epoch` が変わった場合は古いコマンド結果を破棄してください。`sequence` は同じepoch内で単調増加します。登録IDは座標を含みません。確定済み登録だけがKVPに保存され、仮登録とwork anchorの座標・カメラ角度はメモリにのみ存在します。既存バージョンで保存済みのKVP形状は変更せず、そのまま読み込みます。

## 静的検証

Windows PowerShellで以下を実行できます。

```powershell
./tests/Validate-Resource.ps1
```

この検証は必須ファイル、プロトコル定数、設定のクライアント/サーバー分離、仮登録の非永続化・commit時だけのKVP置換・abort/期限切れ復元、冪等な再送、ox_inventoryの正確なtrunk呼出し、手動操作停止、走行車両停止、NUI入力透過、禁止されたNUIフォーカス取得がないことを確認します。実サーバーでは所有権アダプター、OneSync、ox_inventory、対象車両ごとのNavMesh到達性を別途確認してください。
