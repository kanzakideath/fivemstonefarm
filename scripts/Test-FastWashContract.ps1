$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$source = Get-Content -LiteralPath (Join-Path $root 'src/mining-auto.ahk') -Raw
$stationary = Get-Content -LiteralPath (Join-Path $root 'src/stationary-only.ahk') -Raw
$ui = Get-Content -LiteralPath (Join-Path $root 'src/ui-web/src/app.js') -Raw
$html = Get-Content -LiteralPath (Join-Path $root 'src/ui-web/src/index.html') -Raw
$config = Get-Content -LiteralPath (Join-Path $root 'config/AI採掘機.ini') -Raw
function Assert([bool]$ok,[string]$message){ if(-not $ok){ throw $message } }
Assert ($source.Contains('fastWashMode: ReadIntegerSetting(settingsPath, "Washing", "FastMode", 1, 0, 1)')) 'FastMode config missing.'
Assert ($source.Contains('if StationaryOnlyEnabled() && !FastWashModeEnabled()')) 'Washing pre-gate is not conditional.'
Assert ($source.Contains('FAST_WASH_RETRY') -and $source.Contains('storage_gate=0')) 'Fast wash missing-target retry missing.'
Assert ($source.Contains('IniWrite Config.fastWashMode, temporarySettingsPath, "Washing", "FastMode"')) 'FastMode persistence missing.'
Assert ($stationary.Contains('FastWashModeEnabled()') -and $stationary.Contains('startup_cargo_probe=deferred')) 'Stationary fast-mode deferral missing.'
Assert ($stationary.Contains('WaitStationaryCargo(generation, &id, &kind)')) 'Actual cargo verification was removed.'
Assert ($ui.Contains('setting-fast-wash') -and $ui.Contains("washing.fast.toggle")) 'Fast wash UI wiring missing.'
Assert ($html.Contains('最速石洗い（ストレージ表示を待たない）')) 'Fast wash toggle missing.'
Assert ($config.Contains('FastMode=1')) 'Fast mode template default is not ON.'
Assert ($source.Contains('"try-washing"')) 'Atomic wash helper path missing.'
Assert ($source.Contains('deposit-delta') -and $source.Contains('withdraw-item')) 'Transfer verification paths missing.'
Write-Host 'FAST_WASH_CONTRACT_PASS'

$hostSource = Get-Content (Join-Path $root 'src/ui-host/Protocol.cs') -Raw
Assert ($hostSource.Contains('case "washing.fast.toggle":') -and $hostSource.Contains('case "washing.fast.start":')) 'Native host rejects fast-wash actions.'
Assert ($html.Contains('id="fast-wash-start"') -and $ui.Contains("sendAction('washing.fast.start')")) 'Direct fast-wash entry is missing.'
Assert ($source.Contains('&& (!FastWashModeEnabled() || State.storagePending)')) 'Fast mode still uses independent periodic inventory dispatch.'
Assert ($source.Contains('MaybeHandleFastWashCapacity(expectedGeneration)')) 'Fast mode lost live pre-click capacity verification.'
Assert ($source.Contains('reuseObservation := FastWashCapacityObservationCurrent(expectedGeneration, observedInfo)')) 'Capacity workflow does not validate the observed snapshot.'
Assert ($source.Contains('poseRestored := StationaryOnlyEnabled() ? IsCurrentRun(expectedGeneration)')) 'Stationary return still invokes retired walking.'
Assert ($source.Contains('FAST_WASH_RESUME_DEFERRED')) 'Fast resume still waits for paired cargo display.'
Write-Host 'FAST_WASH_NATIVE_WIRING_PASS'

$bridgeSource = Get-Content (Join-Path $root 'src/background-bridge/CdpBridge.cs') -Raw
Assert ($bridgeSource.Contains('expression = WorkClickExpressionForMode(mode, fastWashWorkOnly);')) 'Final click is not wired to fast policy.'
Assert ($bridgeSource.Contains('washing && fastWashWorkOnly ? workClick : StationaryWorkClickExpression(workClick)')) 'Only fast washing may omit cargo guard.'
Assert ($source.Contains('washArguments.Push("work-only")')) 'AHK does not request the native fast policy.'
Write-Host 'FAST_WASH_FINAL_CLICK_WIRING_PASS'
