# v9.1.20 validation

## 石掘り・砂金取り

- 自動収納OFF: `stationary-task-ready` と `try-mining` / `try-gold` に明示的 `work-only` を渡す。
- `work-only` は対象ラベル、server epoch、進捗IDLE、inventory CLOSEDを維持し、荷台表示だけを要求しない。
- 自動収納ON、通常石洗い、荷台前エンドレス石洗いはstorage gateを維持する。
- `READY WORK_ONLY` とstorage-gated resultの取り違えはfail-closedにする。

## 荷台ラベル

- `ストレージを開く` / `トランクを開く` / `荷台を開く` を優先する。
- 固有候補0件時だけ exact `インベントリを開く` をfallbackにする。
- 固有1件＋一般1件は固有1件として扱い、一般側はクリックしない。
- 選択された優先群内の複数候補は `AMBIGUOUS` として拒否する。

## 実行する検証

```powershell
pwsh -NoProfile -File scripts/Test-WashDomExpressions.ps1 -Bridge 'build/staging/AI採掘機_Background.exe'
pwsh -NoProfile -File scripts/Test-StationaryWait.ps1
pwsh -NoProfile -File scripts/Test-FastWashContract.ps1
pwsh -NoProfile -File scripts/Test-FarmRecoverySafetyContract.ps1
pwsh -NoProfile -File scripts/Test-ExeRoutes.ps1
pwsh -NoProfile -File scripts/Build.ps1 -Version 9.1.20
```

リリース前に `scripts/Make-Release.ps1 -Version 9.1.20` と `scripts/Verify-Release.ps1`、署名済み更新の実適用試験、公開後の再ダウンロードSHA-256検証を行う。
