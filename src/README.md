# ソース配置

- `mining-auto.ahk`: v7.0.0のデスクトップ本体。採掘・石洗い・砂金採り、重量監視、ネイティブUI、companion連携、安全停止を担当します。
- `background-bridge/CdpBridge.cs`: FiveMの対象・インベントリNUIを構造的に操作し、`ai_miner_companion` の公開状態とDevConコマンドを厳格なプロトコルで中継します。
- `updater/Updater.cs`: 固定GitHub ReleaseのECDSA署名、配布物SHA-256、置換後の自己検証を行います。
- `assets/`: AutoHotkeyへ埋め込む静的アセットです。

FiveM側のソースは `../fivem-resource/ai_miner_companion/` に分離しています。所有権アダプターを含む `config.server.lua` はshared scriptではなく、クライアントへ配信しません。

## 車両収納の境界

v7の有効なデスクトップ設定は `RouteFormat=4`、`CompanionProtocol=1`、サーバー発行の `CompanionRegistrationId`、検証済みの種類 `trunk` です。旧版の座標・W/A/S/D・矢印キー記録は使用しません。`OutboundRoute` と `ReturnRoute` は移行時に読み込めても、車両移動には再生しません。

resourceはプレイヤー識別子・ナンバー・モデルへ紐付いた不透明IDをサーバーKVPに保存します。車両のnetwork IDと座標は一時値です。操作のたびにサーバーがOneSync上で車両を再解決して所有権と距離を検証し、クライアントが現在の車体寸法と向きから後部の接近地点を計算し直してNavMesh移動します。

既定構成の `server.cfg` では `ensure ox_inventory` を `ensure ai_miner_companion` より前に置きます。`ox_target` を使用する場合もcompanionより先に起動します。resource更新時は既存の `config.server.lua` を別の安全な場所へバックアップし、新しいテンプレートとの差分へ所有権ValidatorとIdentityProviderを手作業でマージしてください。ZIPから稼働中の設定を直接上書きしません。

デスクトップbridgeはhidden NUIのprotocol/version/epoch/token/capabilities/stateを検証し、allowlist済みコマンドだけを送ります。epoch変更、登録ID不一致、semantic failure、タイムアウトでは成功扱いにしません。停止時はresourceへ `cancel` を送り、FiveMタスクも解除します。

## 容量と採集品の保護

プレイヤー容量はox_inventoryの `leftInventory.weight` / `maxWeight` を優先し、残り重量が `MinimumFreeWeight` 以下になると収納を開始します。全スロット使用は補助条件です。

開始時のアイテムをスロット、名前、正規化メタデータ、数量で基準化し、その基準分を保護します。荷台側の容量を確認し、各移動後にプレイヤー側の減少と荷台側の増加を照合します。登録したストレージIDと種類 `trunk` が一致しない場合は移動しません。

## セッション監視

FiveMウィンドウ/PID、対象NUI、インベントリNUI、companion epochを開始時に固定します。PID消失・置換、NUI session変更、resource epoch変更は即時停止し、一時的な取得失敗中は新しい作業を凍結します。

## UI

デスクトップUIはAutoHotkey v2のネイティブGUIです。車両登録の可視状態はresource NUIの入力透過HUDで表示し、車両選択は通常のox_targetを優先します。既定のバックグラウンドNUI操作とcompanion経路ではNUIフォーカスや物理マウスを占有せず、固定画面座標や独自の矢印操作パネルは使いません。

## ビルド

`Build.ps1` はC# helperとAutoHotkey本体を生成し、bridge capability/self-test、偽DevConテスト、resource静的検証、完成EXEのvalidate/smoke-testを実行します。生成EXEや取得済みtoolchainを `src/` へコミットしないでください。
