# v9.1.19 検証記録

実施日: 2026-09-13 (JST)

公開判定: **PASS（ローカル／合成環境）** — 配布用の完全な `scripts/Build.ps1 -Version 9.1.19` と対象契約試験はPASS。実FiveMでの連続運転は別途未確認。

## 荷台前エンドレス石洗い

- `scripts/Test-EndlessWashContract.ps1`: PASS
  - 専用開始経路と実行単位の状態分離
  - 自動収納を有効にした登録荷台だけを使う開始条件
  - 洗浄後1.15秒の待機、移動入力1回80ms以下、視点補正1回、最大パルス数・期限
  - 「荷台だけ」ならW、「洗浄だけ」ならSへ戻す観測結果ベースの方向選択
  - 各入力前後のsession epoch、作業進捗、inventory、洗浄／荷台構造の再確認
  - 3回連続の安定観測、曖昧候補での入力禁止、入力全解放
  - 1回限りの再始動と、その後の安全停止
- `scripts/Test-WashRecoveryContract.ps1`: PASS
  - 実際の洗浄完了経路から専用復旧へ接続されることを静的に確認
- `scripts/Test-WashDomExpressions.ps1 -Bridge build/staging/AI採掘機_Background.exe`: PASS
  - `BOTH` / `STORAGE_ONLY` / `WASH_ONLY` / `NEITHER` / `AMBIGUOUS` の5状態
  - 登録荷台の正確なラベル、同一観測内のガード、観測時のクリック・転送なし
- `scripts/Test-StationaryWait.ps1 -OutputDirectory artifacts/v9.1.19-doc-validation/stationary-wait`: PASS（11 cases）
  - 本番AHK関数を読み取り専用アダプターで実行し、停止、世代管理、ledger保持、エラー、自動再開を確認
- `scripts/Test-FastWashContract.ps1`: PASS
  - 通常／高速経路に専用モードの移動例外が漏れていないことを確認

## UI

- `node src/ui-web/test.mjs`: PASS
  - 専用ボタン、backendの開始可否、`washing.endless.start` の許可リスト、配布用offline bundleとの一致を確認
- `artifacts/v9.1.19-final-browser/results.json`: PASS
  - 実際のoffline HTML/CSS/JavaScript fixtureを1366×850、820×640、600×640、390×700で確認
  - 4条件ともJavaScript page errorなし、横方向overflowなし

このUI fixtureはFiveMではなく、専用モードの表示とIPC操作を確認するものです。

## 完全ビルドと起動検証

`scripts/Build.ps1 -Version 9.1.19`: PASS。

- C# UI Host: 警告0、エラー0
- Stone Metagame backend: 83 assertions PASS
- Stone Metagame Node: 7 tests PASS（基礎抽選1,000,000回、保証／Pity／Pickup統合100,000回を含む）
- AutoHotkey自己完結EXE: コンパイルPASS
- `Test-UpdateStartup.ps1`: default no-console、custom settings no-console、custom settings redirected、smoke no-consoleの4ケースすべて終了コード0
- 各起動ケースでインストール元ファイルが変更されないことを確認

途中で一度だけ出た `EXIT=145` は、新しい洗浄処理ではなく既存の報酬WAL自己テストが、完了時刻を開始時刻より25ms未来に固定して即復元していたことが原因だった。25ms未満で進んだ高速起動だけ正しい未来時刻補正が働き、テスト期待値と不一致になっていた。fixture時刻を開始時刻へ揃え、製品の保存／復旧ロジックは変更していない。修正後は分離したno-console検証12/12と、上記公式4ケースがPASSした。

再現用コマンド:

```powershell
pwsh -NoProfile -File scripts/Build.ps1 -Version 9.1.19
pwsh -NoProfile -File scripts/Test-EndlessWashContract.ps1
pwsh -NoProfile -File scripts/Test-WashDomExpressions.ps1 -Bridge 'build/staging/AI採掘機_Background.exe'
node src/ui-web/test.mjs
git diff --check
```

## 実FiveMで未確認の範囲

この作業環境では実FiveMサーバーへ接続していない。したがって、次はローカルの合成DOM、fixture、自己検証、読み取り専用アダプターでの確認に留まる。

- 実サーバーのox_target文言とDOM構造が想定した洗浄・登録荷台として一意に識別されること
- 洗浄報酬後の後退が1.15秒後に収まり、短いW/S・視点入力で開始位置周辺へ戻れること
- 実フレームレート、表示倍率、CDP応答、ネットワーク遅延の下で3回連続観測が成立すること
- 満重量からの実収納、未洗浄石0からの実補充、再洗浄までの長時間サイクル
- F9および手動入力による中断時に、実ゲーム内ですべての入力が解放されること

そのため、実FiveMでの「無期限運転」「任意の車両・洗浄場所への対応」「一般的な自動経路探索」は検証済み事項にも製品保証にも含めない。初回の実環境確認は、登録荷台と洗浄操作が同時表示される既知の開始位置で監視しながら行う。

## 安全な公開経路

`.github/workflows/publish-v9.1.18-once.yml` はバージョン、直前Latest、asset名、rollback先がv9.1.18専用に固定されているため、v9.1.19には使用できない。また、tag pushで起動する汎用 `.github/workflows/release.yml` は署名付きassetを作成できるが、承認SHAとmainの一致、公開前の全byte再照合、公開Latest経由のUpdater適用、失敗時rollbackまでを一体で保証しない。

v9.1.18のone-shotを基に監査した `.github/workflows/publish-v9.1.19-once.yml` を追加済み。mainへ取り込まれた後にだけ手動実行し、次の条件をv9.1.19用に固定する。

- 入力した40文字lowercase SHA、workflow dispatch SHA、checkout HEAD、origin/main、GitHub mainがすべて一致
- 公開開始時のLatestがv9.1.18であり、v9.1.19のtag／releaseが存在しない
- `Make-Release.ps1 -Version 9.1.19` と `Verify-Release.ps1`、本書の対象試験がすべてPASS
- `AI-Miner-v9.1.19.zip` を含む5 assetをdraftへ上げ、再downloadした全byteとallowlistを照合
- v9.1.19をLatestにした後、公開Latestを使う `Test-UpdateApply.ps1 -UsePublicLatest -ExpectedVersion 9.1.19` がPASS
- 公開後の検証失敗時は、第三のreleaseを上書きしないことを再確認してv9.1.18をLatestへ戻し、v9.1.19をdraftへ戻す
- tagはworkflowの `GITHUB_TOKEN` で作成し、汎用 `release.yml` を再帰起動させない

上記workflowがmainに入り、完全ビルドを含むすべてのゲートがPASSし、GitHubの `release` environment承認と、製品内蔵公開鍵に対応する `UPDATE_SIGNING_KEY_PKCS8_B64` secretが準備済みで、承認対象SHAが現在のorigin/mainと一致している場合だけ、repository rootから次を実行する。公開完了まで別のrelease workflowや手動のRelease変更を同時に行わない。

```powershell
git fetch --prune origin --tags
$approvedSha = 'ここを監査・承認したmainの40文字lowercase SHAへ置換'
if ($approvedSha -cnotmatch '^[0-9a-f]{40}$') { throw 'approved SHA is invalid' }
if ((git rev-parse origin/main).Trim() -cne $approvedSha) { throw 'origin/main moved after approval' }
gh workflow run publish-v9.1.19-once.yml --ref main --field "expected_source_sha=$approvedSha"
```

手動で `v9.1.19` tagをpushしない。公開時には `gh run watch --exit-status` またはGitHub Actions画面でone-shotの最終結果を確認し、成功後にLatest、5 asset、署名manifest、公開Updater適用の保存artifactを確認する。
