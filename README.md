# AI採掘機

FiveM上の対象ボタンを検出し、採掘・石洗い・砂金採りを繰り返すWindows向け補助ツールです。バックグラウンド動作では物理マウスを移動させないため、別のアプリを操作しながら実行できます。

> 使用するサーバーの利用規約・ルールを必ず確認してください。本ソフトウェアの使用によるアカウント制限、データ損失、そのほかの損害について作者は責任を負いません。

## 対応している作業

| モード | 検出する表示 | 標準周期 | 補足 |
|---|---|---:|---|
| 採掘 | `鉱石を採掘する` | 石の再出現を検知 | 石が戻ったときだけ押します |
| 石洗い | `石を洗う` | 9秒 | 後退を抑える前進補正付きです |
| 砂金採り | `砂金採りトレイ` | 6秒 | バックグラウンドで繰り返します |

開始・停止キーは設定画面から変更できます。初期値は開始 `F8`、停止 `F9` です。詳しい手順は [AI採掘機_使い方.txt](docs/AI採掘機_使い方.txt) を参照してください。

## インストール

1. [Releases](https://github.com/kanzakideath/fivemstonefarm/releases) から最新の `AI採掘機-vX.Y.Z.zip` を取得します。
2. ZIPを任意の書き込み可能なフォルダーへ展開します。
3. `AI採掘機.exe` を起動します。

配布物のハッシュは各Releaseの `SHA256SUMS.txt` で確認できます。設定は実行ファイルと同じ場所の `AI採掘機.ini` に保存され、更新時にも維持されます。

## 安全な自動更新

更新先は `kanzakideath/fivemstonefarm` のGitHub Releasesに固定されています。アプリは次のすべてを確認できた場合だけ更新します。

- `update-manifest.json` が、アプリに埋め込まれたECDSA P-256公開鍵で検証できること
- マニフェストの製品名・バージョン・配布URLが許可された形式と一致すること
- ダウンロードした実行ファイルのサイズとSHA-256がマニフェストと一致すること
- 置換後の実行ファイルが自己検証に成功すること

署名または検証に失敗した更新は適用しません。秘密の署名鍵はリポジトリへ保存せず、GitHubの保護された `release` Environmentにだけ登録します。

## ソースからビルド

必要なもの:

- Windows 10 / 11（64 bit）
- PowerShell 7.2以上（Release作成時）
- .NET Framework 4.x のC#コンパイラー
- Git

通常のビルド:

```powershell
pwsh -File .\scripts\Build.ps1 -Version 5.2.0
```

初回は公式配布元から次のツールを取得し、公開されているSHA-256を検証します。ダウンロード先の `tools/` と `.cache/` はGit管理外です。

- AutoHotkey v2.0.26
- Ahk2Exe v1.1.37.02a2

成果物は `dist/ai-miner-win-x64.exe` です。ビルドはC#ヘルパーのcapabilityテストと、完成した実行ファイルの `--validate` / `--smoke-test` を実行します。

## Releaseを公開する

1. GitHubリポジトリの Environment に `release` を作成します。
2. `release` Environment secret `UPDATE_SIGNING_KEY_PKCS8_B64` に、ECDSA P-256秘密鍵のPKCS#8 DERをBase64化した値を登録します。
3. ソース内の `AppVersion` と同じタグを作成してpushします。

```powershell
git tag v5.2.0
git push origin v5.2.0
```

`.github/workflows/release.yml` はタグ `vX.Y.Z` のみを受け付け、ビルド・自己検証・署名・署名再検証を行った後に次を公開します。

- `ai-miner-win-x64.exe`
- `AI採掘機-vX.Y.Z.zip`
- `update-manifest.json`
- `update-manifest.sig`
- `SHA256SUMS.txt`

署名秘密鍵から導出した公開鍵がアプリ内の固定公開鍵と一致しない場合、Release処理は停止します。

## ディレクトリ構成

```text
src/
  mining-auto.ahk
  assets/
  background-bridge/CdpBridge.cs
  updater/Updater.cs
config/AI採掘機.ini
docs/AI採掘機_使い方.txt
scripts/
  Bootstrap-Tools.ps1
  Build.ps1
  Make-Release.ps1
  Verify-Release.ps1
```

## ライセンス

本プロジェクトの作者作成部分は [MIT License](LICENSE) です。AutoHotkeyなどのサードパーティーコンポーネントには各コンポーネントのライセンスが適用されます。詳細は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照してください。
