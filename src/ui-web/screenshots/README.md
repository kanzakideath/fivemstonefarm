# Archived UI captures

The PNG files in this directory are the historical v8.0.0 visual baseline. They are not the current v9.1.6 release UI and are not packaged into the application.

Current release captures are generated from the completed executable immediately before tagging with:

```powershell
$assets = (Resolve-Path 'src/ui-web/www').Path
& scripts/ui-tests/Invoke-UiVisualTests.ps1 `
  -ExecutablePath <absolute-path-to-AI採掘機.exe> `
  -OutputDirectory artifacts/ui-tests/v9.1.6 `
  -BaseArguments @('--visual-test', '--assets', $assets) `
  -WebViewScaleFactors 1,1.5,2
```

The generated `suite.json`, PNG files, and per-window JSON records are the release evidence. They remain build artifacts so stale screenshots cannot silently be presented as the current UI.
