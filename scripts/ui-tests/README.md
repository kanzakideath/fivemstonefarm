# AI採掘機 UI visual tests

These scripts capture only a selected top-level window. They never use
`CopyFromScreen`, desktop coordinates, or a full-monitor screenshot fallback.
The capture backend is Win32 `PrintWindow` with `PW_RENDERFULLCONTENT`, cropped
to the DWM extended frame bounds.

## Expected visual-test host contract

The default scenario manifest expects an explicitly supplied executable to stay
open and accept:

```text
--visual-test --fixture <overview|action-sheet|settings>
--window-width <pixels> --window-height <pixels>
```

The host should disable persistence, update/network checks, global hotkeys, and
automation side effects in this mode. It should render deterministic fixture
data and keep its main window open until it receives a normal close request. It
should honor `AI_MINER_VISUAL_TEST_USER_DATA_FOLDER` for WebView2 data instead
of opening the normal profile. The harness creates a GUID-named directory under
the system temp folder and removes only that verified directory after the owned
host exits.
Change `scenarios.json`, `-ManifestPath`, `-BaseArguments`, or
`-WindowTitlePattern` if the host uses another fixture protocol.

## Capture the full suite

```powershell
pwsh -NoProfile -File scripts/ui-tests/Invoke-UiVisualTests.ps1 `
  -ExecutablePath C:\absolute\path\AI採掘機.exe `
  -OutputDirectory artifacts/ui-tests/current
```

The suite launches one process per scenario, finds a stable visible window only
within that PID, verifies its process creation time to reject PID reuse, captures
it, then asks that exact process to close. If it does
not close within the timeout, only the retained `Process` object created by the
suite is killed. The script never searches for or stops processes by name or
window title, so an already-running AI採掘機 instance is not a cleanup target.

`suite.json` records the executable SHA-256, arguments, PID, actual DPI, image
size, and cleanup result. Each PNG has a JSON sidecar recording its HWND, window
class, physical bounds, and that no desktop fallback was used.

## DPI coverage

Use all three supported WebView rendering factors without changing global
Windows display settings:

```powershell
pwsh -NoProfile -File scripts/ui-tests/Invoke-UiVisualTests.ps1 `
  -ExecutablePath C:\absolute\path\AI採掘機.exe `
  -OutputDirectory artifacts/ui-tests/scales `
  -WebViewScaleFactors 1,1.5,2
```

The harness sets `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` per child process with
`--force-device-scale-factor` and, by default, `--disable-gpu` so WebView2 is
more reliable with `PrintWindow`. It also sets `AI_MINER_VISUAL_TEST=1` and
`AI_MINER_VISUAL_TEST_SCALE`. This is Chromium content-scale emulation, not a
proof of Windows non-client behavior at each OS DPI. The JSON sidecars report
the real `GetDpiForWindow` value. Inventory the actual monitors without changing
them with:

```powershell
pwsh -NoProfile -File scripts/ui-tests/Get-DpiInventory.ps1
```

For full per-monitor validation, run the same suite on real monitors or VMs set
to 100%, 150%, and 200%. The scripts intentionally never modify display
settings.

## One screenshot or a short frame sequence

```powershell
pwsh -NoProfile -File scripts/ui-tests/Capture-Window.ps1 `
  -ProcessId 1234 -WindowTitlePattern '^AI採掘機$' `
  -OutputPath artifacts/ui-tests/manual/overview.png

pwsh -NoProfile -File scripts/ui-tests/Capture-WindowSequence.ps1 `
  -ProcessId 1234 -WindowTitlePattern '^AI採掘機$' `
  -OutputDirectory artifacts/ui-tests/manual/frames `
  -DurationSeconds 3 -FramesPerSecond 8
```

The sequence is dependency-free PNG frames plus `frames.json`. It deliberately
does not install or invoke FFmpeg. Encode it later in a trusted build environment
if MP4/GIF is required.

## Tool self-test

```powershell
pwsh -NoProfile -File scripts/ui-tests/Test-UiTestTools.ps1
```

The self-test uses a local, inert WinForms fixture. It starts a same-title
baseline window, runs all four scenarios, verifies every PNG, and verifies that
the baseline process survived. It closes only the fixture processes it created
and removes only its GUID-named temporary directory.

## Limitations

- `PrintWindow` can still return blank WebView pixels on some GPU/driver builds.
  There is intentionally no screen-copy fallback because that could expose
  unrelated desktop content. Keep software rendering enabled for visual tests.
- A launcher that exits and transfers ownership of the main window to another
  process is rejected. Pass the actual UI host executable.
- The frame sequence is intended for short UI transitions, not high-frame-rate
  video capture.
