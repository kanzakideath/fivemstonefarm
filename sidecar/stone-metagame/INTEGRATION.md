# AI採掘機 本体への統合手順

この文書は、`sidecar/stone-metagame` を後から現在の `AI採掘機` へ連結するための作業指示です。
sidecar は既存コードを変更せずに実装・検証してあります。統合時点の本体差分を先に確認し、下記の順序で取り込んでください。

## 統合時に守る境界

1. STONE作業回数の権威は AHK/Web UI ではなく、認証済みバックエンド通知を受けるホスト側に置く。
2. `石掘り`、`石洗い`、`砂金採り` のいずれも、完了後の報酬またはインベントリ増加を確認できた時だけ `RecordVerifiedMiningSuccess` を1回呼ぶ。
3. ボタン押下、試行開始、画面上の演出、失敗、収納、Farm再開だけではSTONE作業数を増やさない。
4. WebView から採掘数、ポイント、チケット、Pity、抽選結果を直接指定できる API を作らない。
5. ガチャ抽選は C# で先に確定し、Web UI は受け取った結果に停止する演出だけを行う。
6. `debug.*` は明示的な開発起動時だけ有効にし、配布版では無効かつ非表示にする。

## 1. C# ドメイン層を UI Host に組み込む

対象:

- sidecar: `backend/*.cs`
- 本体: `src/ui-host/`

推奨は、`src/ui-host/MetaGame/` へ5ファイルをコピーする方法です。sidecar を作業用のまま残す場合は、プロジェクトファイルから `Compile Include="..\\..\\sidecar\\stone-metagame\\backend\\*.cs" Link="MetaGame\\%(Filename)%(Extension)"` でリンクしても構いません。

`MainForm` 生成時に次を1インスタンスだけ作ります。

```csharp
var metaDataPath = Path.Combine(assetsPath, "metagame", "data");
var metaStatePath = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
    "AI採掘機", "metagame", "state.json");
_metaGame = new StoneMetaGameHost(metaDataPath, metaStatePath, developmentMode);
```

`developmentMode` は通常起動で必ず `false` にし、既存の fixture/visual-test または新設する明示的な `--meta-debug` の検証済み引数だけで `true` にしてください。

## 2. データをオフライン資産として配布する

対象:

- sidecar: `data/*.json`
- 本体配布資産: `src/ui-web/www/metagame/data/`

ビルド時に9個のJSON（`gacha`、`banners`、`items`、`affinity`、
`achievements`、`level-rewards`、`titles`、`assets`、`messages`）をコピーし、
アップデーターのマニフェスト・ハッシュ対象にも含めます。CDN は使いません。

起動時に `MetaGameCatalog.Load` が以下を検証するため、検証失敗時はメタゲーム画面を無効化し、既存の採掘機能は継続できるようにしてください。

- レア度確率の合計が10,000 basis points（100%）
- 100種類以上の一意なアイテム
- Pity・Pickup・実績・好感度定義の参照整合性

## 3. 認証済みバックエンド通知を追加する

既存の `BackendIdentity` と `WM_COPYDATA` の送信元検証を再利用します。既存 UI 状態メッセージと衝突しない固定プレフィックス（例: `AIUIMETA1 `）を追加し、セッション値も必ず照合してください。

ホストが受ける信頼済みコマンドは次の3種類だけです。

```text
SESSION_BEGIN <sessionId> <startedAtUnixMs>
MINING_SUCCESS <eventId> <completedAtUnixMs>
SESSION_END <sessionId> <endedAtUnixMs>
```

文字数上限、ASCII ID、時刻範囲、フィールド数を厳密に検証してから、それぞれ次へ渡します。

- `BeginMiningSessionJson`
- `RecordVerifiedMiningSuccessJson`
- `EndMiningSessionJson`

戻り値 JSON は WebView へ `PostWebMessageAsJson` し、同時に既存画面の状態にも反映します。`eventId` は再送されても同じ値になるよう、最低限 `runGeneration + miningAttemptId + inventorySnapshotRevision` から生成してください。サービス側にも重複排除があります。

## 4. AHK の正しい成功地点へフックする

`StartMining` 成功後にセッション開始、`StopMining` の finally 相当でセッション終了を送ります。

`MINING_SUCCESS` を送る場所はクリック数ベースの箇所ではありません。3種類の作業に共通する完了後のインベントリ snapshotで、個数または使用重量が直前の確定snapshotより増えたことを確認した分岐へ置いてください。差分確認が失敗・不明・タイムアウトなら加算せず、次の再確認へ回します。command/API名は互換性のため従来名を維持し、event IDへ作業モードを含めます。

最低限の状態機械:

```text
attempt started (mining / washing / gold)
  -> interaction accepted
  -> work progress completed
  -> inventory snapshot changed by the verified work reward
  -> emit one stable MINING_SUCCESS event
```

収納で所持品が減っただけの場合は除外します。石洗い・砂金採りも、実報酬の増加を確認できた場合は含めます。サーバー再起・FiveM終了・run generation変更時は未確定attemptを破棄します。

## 5. WebView の UI を連結する

対象:

- sidecar: `ui/meta-game-template.html`
- sidecar: `ui/meta-game.css`
- sidecar: `ui/meta-game.js`
- 本体: `src/ui-web/src/`（編集元）とビルド後の `src/ui-web/www/`

既存の Framework7 9.1.3 / `theme: 'ios'` インスタンスをそのまま使い、2個目の
Framework7を初期化しません。メタゲームの描画自体は独立したHTML/CSSコンポーネントです。
テンプレートの `<section data-meta-app>` を既存view/router内へ配置し、CSSを既存
`app.css` の後で読み込みます。JSはES moduleとしてバンドルするか、本体のビルド方式に
合わせて取り込みます。CDN、リモートfont、実行時npm解決は不要です。

本番 adapter の契約:

```javascript
{
  bootstrap(): Promise<{ catalog, snapshot, developmentMode }>,
  execute(action, payload): Promise<{ type: 'meta.result', result }>,
  subscribe(listener): () => void
}
```

許可するWebView操作は `gacha.draw`、`profile.update`（編集画面の原子的保存）、
互換用の `profile.rename` / `profile.appearance` / `profile.title`、
`collection.favorite`、`collection.acknowledge`、
`reward.claim`、`reward.claimAll`、`onboarding.complete`、`settings.update` です。
`debug.*` は開発モード時だけです。C#の `ExecuteUiJson` にそのまま渡し、返却JSONを
adapterでresolveします。各要求に一意なrequest IDとタイムアウトを付け、WebView
ナビゲーション時には未解決Promiseをrejectしてください。

`meta.miningRecorded`、`meta.sessionStarted`、`meta.sessionEnded` は adapter の `subscribe` 経由で UI の snapshot と通知演出へ流します。DOM 全再構築ではなく、sidecar UI の `renderAll`/個別 render を使います。

## 6. 既存画面とのナビゲーション

本体の「概要」または新しい「STONE」行からメタゲームを開き、`採掘へ戻る` は既存の自動操作画面へ戻すだけにします。メタゲームを閉じても採掘自動化、収納、空腹処理を停止・再起動しないでください。

横長ではサイドバー、狭い幅では下部ナビゲーションになる CSS が sidecar に含まれています。既存アプリのウィンドウ移動・サイズ変更・最小化・閉じる処理はホスト側を維持します。

## 7. 永続化・更新・移行

状態は `%LOCALAPPDATA%\\AI採掘機\\metagame\\state.json`、バックアップは同階層の `.bak` です。設定 INI や配布 ZIP の中へユーザーデータを書きません。

現在はstate schema v2です。カタログ文書は各JSONの `schemaVersion` を個別に検証します。
将来フィールドを増やす場合は以下を守ります。

1. `SchemaVersion` を上げる。
2. `MetaGameStateStore.Normalize` へ旧版からの明示的な移行を追加する。
3. 未知の将来版は上書きせず起動を止める。
4. 移行前バックアップを残す。
5. 同じ fixture で旧版→新版→再読込をテストする。

アイテム追加は JSON だけで可能です。既存 ID を変更・再利用すると図鑑が壊れるため、表示名を変えても ID は不変にします。レア度確率を変える場合は必ず合計10,000を維持し、UI の提供割合画面と同じデータを参照します。

## 8. 配布前の検証

sidecar 単体:

```powershell
cd sidecar\stone-metagame
npm test
dotnet run --project .\backend.tests\StoneMetaGame.Tests.csproj --configuration Release
npm run preview
```

本体統合後:

1. 既存 AHK/UI Host/Web UI テストをすべて実行。
2. 石掘り・石洗い・砂金採りを各1回成功させ、確定報酬3件で累計が3だけ増える。
3. 同じ成功通知を再送しても増えない。
4. ボタン押下、進捗だけの完了、報酬差分なし、収納だけでは増えない。
5. 1連/10連、チケット優先、ポイント不足、SSR/UR Pity、重複、履歴上限を確認。
6. 状態ファイル破損時に `.bak` から復旧する。
7. 通常版で debug UI と debug API が使えない。
8. オフライン環境で全画面と演出が表示される。
9. 狭幅、標準幅、150%表示倍率、`prefers-reduced-motion` を確認。

## メインチャットへ渡す依頼文

> `sidecar/stone-metagame/INTEGRATION.md` を読み、sidecar 内の実装を現在の本体へ統合してください。現在の本体差分を優先して競合を解消し、採掘成功はクリック時ではなくインベントリ報酬確認後だけ記録してください。統合後は sidecar と既存テストを両方実行し、配布ビルドで実画面も確認してください。
