# ソース配置 v9.1.9

- `mining-auto.ahk`: 状態管理、設定、ホットキー、採掘処理、ローカル車両登録・探索・収納、更新制御を担当するバックエンドです。
- `ui-web/`: Framework7のiOSテーマを明示した完全オフラインUIです。概要・車両・STONE・設定・アップデートを提供し、`npm ci` と `npm run build` で `www/` を生成します。
- `ui-host/`: .NET Framework WinForms上のWebView2ホストです。ローカル資産だけを表示し、PID・HWND・セッションを照合したWM_COPYDATAでAHKと通信します。Stone Metagameの公開APIを直列ワーカーへ分離し、Farm処理を待たせずに処理します。
- `background-bridge/CdpBridge.cs`: FiveMのox_target・ox_inventory NUIを構造的に検出し、対象操作、容量取得、ストレージ照合、差分収納、境界付き移動・視点操作を行います。
- `updater/Updater.cs`: 固定GitHub Releaseの署名・サイズ・SHA-256を検証して自己更新します。
- `assets/`: AHKへ埋め込む検出用アセットです。
- `../sidecar/stone-metagame/`: 統合元の検証済みStone Metagameです。ドメイン、抽選、Profile、状態schemaを本体側で再実装せず、backendをリンクし、UIとカタログを一致検証して取り込みます。

## 作業完了の検知

採掘・石洗い・砂金採りは、対象選択から進捗UIの開始・安定した終了までを同じbridgeプロセスで監視し、次の作業対象が使用可能になった時点で再実行します。完了時の3フレーム照合も同一CDP接続を使い回します。サーバー側の作業時間自体は短縮しません。

石洗いと砂金は各操作の直前に下向き入力をクランプまで送り、実対象を再観測してからクリックします。石洗いは実報酬を確認すると `WASH_SETTLING` で既定2.0秒を無入力で待ち、アニメーション後退が止まってから `WASH_CORRECTING` で前進補正を1度だけ実行します。その後は重複した対象プローブを挟まず `try-washing` の対象待機・クリック・完了監視へ直接戻ります。最後の未洗浄石を消費した実スナップショットではWindows SAPIの日本語女性音声を優先した完了通知を出します。同じボタンが複数表示された場合は、選択状態、照準との距離、DOM順で使用可能な候補を1つに決定します。

## Stone Metagame連携

採掘・石洗い・砂金採りの開始前後で確定インベントリを比較し、重量または個数が実際に増えた時点だけで、モードを含む一意なwork event IDをMetagame公開APIへ送ります。同じIDは冪等に処理されるため、再送されても二重計上しません。クリック・進捗開始・失敗・収納・Farm再開はイベント源にしません。互換性のためwire command/API名は `MINING_SUCCESS` / `RecordVerifiedMiningSuccess` のままですが、v9.0.2以降の意味は3モード共通の確認済みSTONE作業報酬です。

v9.0.2への初回更新時は、UI Hostを起動する前にEXEと同じ場所の現行・ローテーション済み診断ログを読み、厳密な `FARM_REWARD_CONFIRMED` 行だけを専用の閉じたsessionとしてdurable outboxへ一度取り込みます。イベントIDはパスに依存せず、時刻・モード・attempt・inventory revisionから決定的に作ります。移行済みmarkerは診断ログを所有するインストールフォルダー単位で、outboxの原子的保存後に書くため、空の別フォルダーを先に起動しても旧フォルダーの履歴を阻害せず、途中終了時も次回起動で欠落または二重計上しません。削除済みログ、旧クリック数、進捗表示、経過時間から回数を推定しません。

新しい実報酬はoutboxより先に専用WALへ同期記録します。WAL E、outbox、WAL Aの順序を守り、未完了EはHost送信を抑止します。起動時と次回Farm開始前に同じIDで閉じた回復sessionへ移すため、確認直後のF9・強制終了・Host停止でも欠落せず、torn末尾やWindows時計の後退もFIFOを停止させません。

Metagame側は `totalStoneMined`、XP、Level、Affinity、Achievement、Points、Rewardsを所有し、Farm Controllerはそれらを計算しません。状態は `%LOCALAPPDATA%\AI採掘機\metagame\state.json` と `state.json.bak` にFarm設定とは分けて保存し、state schema v2と原子的置換の保証を維持します。UIはHOME、GACHA、COLLECTION、ACHIEVEMENTS、PROFILEをsidecarの部品・カタログと同じ内容で表示します。

## ローカル車両登録

現行設定は `RouteFormat=5`、`CompanionProtocol=0`、検証済みの `StorageType=trunk` です。登録開始後に利用者が手動で開いた荷台からストレージIDを取得し、保存直前にFiveM PIDとNUIセッションを再照合します。座標、車両network ID、往復ルート、サーバーresourceは保存・要求しません。

自動収納は登録IDそのものを画面外から探索できないため、作業位置の近距離だけを短い対称ルートと視点走査で探します。容量不足後は作業Targetやカメラの状態で出発を妨げず、確認済みInventoryから直接探索へ移ります。候補を開いた後にストレージIDを厳密照合し、不一致なら閉じて無変更にします。プレイヤー側の実減少と荷台側の実増加を確認し、往路は逆順・逆方向で復元してから、作業ボタンと次の実報酬を再確認します。

石洗いでは正常な1回の洗浄前後で唯一減少した実アイテムIDを未洗浄石として学習します。洗浄結果を先に収納し、bridgeが最新の重量・1個重量・空きスロット・予約余裕から補充可能数を再計算して右Inventoryから左Inventoryへ移し、双方の個数差を照合します。未洗浄石がない場合は決められた診断を残して安全停止します。

## 所持品保護

容量はプレイヤー側の最新 `items[].weight` 合計と `maxWeight` による使用率、次の報酬予測を含む残り重量、空きスロット数を判定条件にします。インベントリを閉じた後に残る初期weight値は判定へ使いません。各確認済み報酬の前後から、名前と正規化メタデータが一致する正の増分だけを実行中の出力台帳へ積みます。収納直前には、それ以外の全所持品を合成保護baselineへ入れるため、途中で増えた食料やmetadataだけ変化した道具は移しません。部分収納は実減少を1回だけ台帳から引き、収納ごとに登録ストレージID、プレイヤー側の実減少、荷台側の同一品の実増加、次回報酬を受け取れる容量を検証します。

開始時点ですでにしきい値を超えている場合、開始後の正の差分が存在しないため自動収納は実行しません。既存品の全搬出を防ぐ `UNTRUSTED_STORAGE_BASELINE` として安全停止し、空きを作ってからの再開を案内します。

Farm Controllerは `IDLE` / `FARMING` と洗浄専用状態に加え、`CHECKING_INVENTORY` → `NEED_STORAGE` → `STOPPING_FARM` → `LOCATING_TRUCK` → `MOVING_TO_TRUCK` → `VERIFY_TRUCK_REACHED` → `OPENING_STORAGE` → `STORING_OUTPUTS` → `VERIFY_STORAGE` → `REFILLING_INPUT` → `VERIFY_REFILL` → `LOCATING_FARM` → `RETURNING_TO_FARM` → `VERIFY_FARM_REACHED` → `RESUMING_FARM` → `VERIFY_FARM_RESUMED` を唯一の権威状態として扱います。世代・task IDに一致しない遅延結果は破棄し、全入力解放後のRecoveryは最新所持品を観測して、未完了の収納・補充・帰還から再開します。復旧再始動は1回に制限し、`RESUMING_FARM` は最初の確認済み報酬が届くまで完了しません。

稼働HUDはAHK内のクリック透過・非アクティブな軽量ウィンドウです。FiveMのクライアント矩形へ追従し、FiveMが前面の間だけ表示します。WebView2を追加起動せず、別アプリの入力やフォーカスを奪いません。

## 視点固定と食事

石洗いと砂金は毎回、FiveMが前面ならWin32 `SendInput` の相対マウス入力、バックグラウンドならDevConの期限付き `look_down` だけで真下へ合わせ、実対象を再検出してから操作します。採掘は対象喪失時だけ同じ補正層を使います。入力の送信だけでは視点成功とせず、再観測結果を根拠にします。食事はFiveMが前面なら空腹ゲージを複数フレーム確認し、裏画面でゲージを安全に読めない間だけ時間上限のフォールバックを使います。設定画面のスロットはox_inventory標準の1～5に限定し、使用前後の同スロット品の個数減少を確認できた場合だけ成功として記録します。3回連続で確認できない場合は安全停止します。

作業対象の未検出が設定時間を超えると視点・対象Recoveryを開始します。確認済み報酬のない状態がWatchdog時間を超えた場合も同様に復旧し、上限後は安全停止します。詳細デバッグ表示は単一状態、task ID、再試行、容量判定理由をHUDへ追加します。

## ビルド

`scripts/Build.ps1` は固定依存からオフラインUIとWebView2ホストを作り、必要ファイルだけをAHKの単一EXEへ埋め込みます。UIホストは外部ナビゲーション、ダウンロード、新規ウィンドウを拒否します。Build内の完成EXE validate/smokeに加え、タグ作成前にビルド済みUIホストと同一Web資産を `scripts/ui-tests/Invoke-UiVisualTests.ps1` へ渡し、専用ウィンドウの視覚テストを通してから配布します。

Stone Metagame統合ではsidecarのNode/C#テスト、取り込みファイルのSHA-256一致、公開APIの重複排除・再起動復元テストもビルド条件です。実際のFiveMサーバー固有NUI、車両配置、通信遅延を含む実地試験は別途必要です。
