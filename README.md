# AI採掘機 v7.0.0

FiveM上の対象ボタンを構造的に検出し、採掘・石洗い・砂金採りを繰り返すWindows向け補助ツールです。既定の「バックグラウンド動作」による対象NUI操作と、正規のcompanion resourceによる車両操作では、画面座標やモニター解像度に依存せず、物理マウスを占有しません。

v7では固定座標・W/A/S/D・矢印キーを記録する車両ルートを廃止しました。サーバー管理者が導入する正規のFiveMリソース `ai_miner_companion` と連携し、登録した車両エンティティを所有者・ナンバー・モデルで照合して、現在位置と荷台位置を操作のたびに取り直します。

> 使用するサーバーの利用規約と管理者の許可を必ず確認してください。補助リソースはサーバー管理者だけが導入できます。クライアントへのDLL注入、メモリ読取り、アンチチート回避は実装していません。

## 対応している作業

| モード | 検出する表示 | 標準周期 | 補足 |
|---|---|---:|---|
| 採掘 | `鉱石を採掘する` | 石の再出現を検知 | 石が戻ったときだけ実行 |
| 石洗い | `石を洗う` | 9秒 | 後退を抑える前進補正 |
| 砂金採り | `砂金採りトレイ` | 6秒 | 未検出時の境界付き位置補正 |

開始・停止キーは設定画面から変更できます。初期値は開始 `F8`、停止 `F9` です。

## v7.0.0の車両収納

- 登録するのは座標や録画ルートではなく、サーバー発行の不透明な車両登録IDです。
- 登録IDはプレイヤー識別子・正規化ナンバー・モデルに紐付き、サーバー側へ保存されます。
- 車両のnetwork IDと後部の接近地点は毎回解決し直すため、登録後に車両が少し移動しても同じ車両を探します。
- 車種の固定画面座標は使わず、クライアント側で車体寸法と現在の向きから後部位置を計算し直します。
- FiveMのNavMesh移動を使い、障害物、車両消失、手動入力、死亡、タイムアウト、所有権不一致ではタスクを解除して停止します。
- 作業開始時の地点はメモリ内の一時アンカーです。収納後はその地点へ戻り、作業対象を再確認できた場合だけ再開します。
- ox_inventoryの `weight` / `maxWeight` を主条件にするため、全スロットが埋まる前に重量上限へ達した場合も収納を開始します。
- 開始前から持っていた品を基準化し、実行後に増えた数量だけを登録済み荷台へ移します。

「どこに移動しても」は、車両がOneSyncで存在し、クライアントへストリームされ、設定された安全距離内で徒歩到達できる範囲を意味します。未ストリームの遠距離車両への瞬間移動や、別セッションからの車両生成は行いません。候補が曖昧な場合も誤収納を避けるため停止します。

## 導入

### 利用者

1. [Releases](https://github.com/kanzakideath/fivemstonefarm/releases) から最新の `AI-Miner-vX.Y.Z.zip` を取得します。
2. ZIPを任意の書き込み可能なフォルダーへ展開します。
3. サーバー管理者が下記のFiveMリソースを導入済みであることを確認します。
4. `AI採掘機.exe` を起動します。

設定は実行ファイルと同じ場所の `AI採掘機.ini` に保存され、デスクトップアプリの更新時にも維持されます。

### FiveMサーバー管理者

1. Releaseの `AI-Miner-Companion-vX.Y.Z.zip`、またはデスクトップZIP内の `server-resource/ai_miner_companion` を取得します。
2. フォルダー名を変えず `resources/[local]/ai_miner_companion` へ配置します。
3. `config.server.lua` の所有権検証をサーバーのガレージ／車両DBへ接続します。初期状態は意図的に全車両を拒否します。
4. 使用するインベントリに合わせて荷台アダプターを設定します。
5. `server.cfg` でOneSyncを有効にし、既定構成では `ox_inventory`、その後に `ai_miner_companion` を起動します。`ox_target` を使う場合もcompanionより先に起動します。

```cfg
ensure ox_inventory
ensure ai_miner_companion
```

詳細は [FiveMリソースREADME](fivem-resource/ai_miner_companion/README.md) を参照してください。サーバーへ配置したリソースは接続時にFiveMが利用者へ配信するため、各利用者がASIやDLLを手動導入する必要はありません。

## 車両を登録する

1. 登録する自分の車両の近くに立ち、AI採掘機の「車両」画面で「ゲーム内で車両を登録」を押します。
2. FiveMへ戻ると、小型HUDが登録待機状態を示します。
3. 通常の `ox_target` 操作で自分の車両を選び、「AI採掘機に登録」を実行します。ox_targetを使わない構成では、車両を画面中央へ合わせて案内された決定キーを押します。
4. リソースが所有権をサーバー側で検証し、仮の車両登録IDを発行します。
5. 車両後部へ移動して荷台が開けること、開いたストレージが `trunk` であることを確認できた場合だけ登録を確定・保存します。失敗時は以前の登録を維持します。

矢印キー、固定座標、往路・復路の録画はありません。旧版の `RouteFormat=1/2/3` は安全のため再生せず、v7で再登録を求めます。

## 自動収納の流れ

1. 作業開始時に現在の徒歩位置を一時作業アンカーとして保存します。
2. 残り重量が設定値以下、または全スロット使用を検知すると新しい採集を止めます。
3. サーバーへ登録車両の再解決を要求し、現在のnetwork ID、所有権、車両一致、距離を再検証します。
4. クライアントが現在の車体寸法と向きから後部の接近地点を計算し直し、停止状態を確認して徒歩移動します。
5. 登録済みの荷台だけを開き、開始後に増えた品だけを収納します。
6. 一時作業アンカーへ戻り、作業ボタンを再検出できた場合だけ作業を再開します。

車両が見つからない、遠すぎる、動き続けている、経路が塞がれている、荷台IDが違う、容量がない、または作業地点へ戻れない場合は何も推測せず安全停止します。

## 接続監視と安全停止

開始時にFiveMのウィンドウ、プロセスID、対象NUI、インベントリNUI、companion resourceのepochを固定します。実行中にFiveM終了、プロセス置換、NUIセッション変更、resource再起動、サーバー再起動・再接続相当の変化を検知した場合は入力とFiveMタスクを解除して停止します。一時的な読取り失敗中は作業を凍結し、連続失敗時も停止します。

この監視は自動再ログインを行いません。特殊な切断状態をすべて即時判別できる保証もないため、停止キーは常に使用できるキーへ設定してください。

## UI

メイン画面はWindowsネイティブ部品の範囲で、iOS/iPadOSの「設定」に近い情報階層、inset grouped list、システムフォント、単一アクセント、明確な状態表示を参考にしています。車両登録中はFiveM resourceの入力透過HUDだけを表示し、ゲーム本来のtarget操作を使います。偽の端末外枠、ステータスバー、Appleロゴは使用しません。

参考: [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)、[Typography](https://developer.apple.com/design/human-interface-guidelines/typography)、[Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility/)

## 安全な自動更新

起動時または「アップデート」画面から新しいデスクトップ版を確認できます。更新先は `kanzakideath/fivemstonefarm` のGitHub Releasesに固定され、ECDSA P-256署名、製品名・URL、サイズ、SHA-256、置換後の自己検証がすべて成功した場合だけ適用します。

FiveMリソースはサーバー構成と所有権アダプターを含むため、デスクトップアプリから勝手に書き換えません。新しい `AI-Miner-Companion-vX.Y.Z.zip` が公開された場合は、稼働中の `config.server.lua` を先に別の安全な場所へバックアップし、ZIPを一時フォルダーへ展開して新旧差分を確認してください。新しいテンプレートへ所有権ValidatorやIdentityProviderの設定を手作業でマージし、既存の `config.server.lua` をZIPで直接上書きしないでください。接続プロトコルが不一致ならアプリは車両機能を無効化します。

## ソースからビルド

必要なもの:

- Windows 10 / 11（64 bit）
- PowerShell 7.2以上（Release作成時）
- .NET Framework 4.x のC#コンパイラー
- Git

```powershell
pwsh -File .\scripts\Build.ps1 -Version 7.0.0
```

初回は公式配布元から固定版AutoHotkeyとAhk2Exeを取得し、公開SHA-256を検証します。ビルドはC#ヘルパーの自己テスト、偽DevCon試験、companion resourceの静的検証、完成EXEの `--validate` / `--smoke-test` を実行します。静的試験だけで実サーバーの所有権DB、NavMesh、各車種の荷台アダプターまで保証するものではありません。

## Releaseを公開する

ソースの `AppVersion` と同じ `vX.Y.Z` タグをpushすると、署名済みデスクトップ配布物とFiveMリソースZIPを生成します。

```powershell
git tag v7.0.0
git push origin v7.0.0
```

公開物:

- `ai-miner-win-x64.exe`
- `AI-Miner-vX.Y.Z.zip`
- `AI-Miner-Companion-vX.Y.Z.zip`
- `update-manifest.json`
- `update-manifest.sig`
- `SHA256SUMS.txt`

署名鍵はリポジトリへ保存せず、GitHubの保護された `release` Environmentにだけ登録します。

## ディレクトリ構成

```text
src/
  mining-auto.ahk
  assets/
  background-bridge/CdpBridge.cs
  updater/Updater.cs
fivem-resource/ai_miner_companion/
config/AI採掘機.ini
docs/AI採掘機_使い方.txt
scripts/
```

## ライセンス

本プロジェクトの作者作成部分は [MIT License](LICENSE) です。サードパーティーコンポーネントには各ライセンスが適用されます。詳細は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照してください。
