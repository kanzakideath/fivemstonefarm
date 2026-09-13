$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$source = Get-Content -LiteralPath (Join-Path $root 'src/mining-auto.ahk') -Raw
$stationary = Get-Content -LiteralPath (Join-Path $root 'src/stationary-only.ahk') -Raw
$ui = Get-Content -LiteralPath (Join-Path $root 'src/ui-web/src/app.js') -Raw
$html = Get-Content -LiteralPath (Join-Path $root 'src/ui-web/src/index.html') -Raw
function Assert([bool]$ok,[string]$message){ if(-not $ok){ throw $message } }
Assert ($source.Contains('runFastWash: false')) 'Per-run fast-wash state is missing.'
Assert ($source.Contains('State.runFastWash := startMode = "fast-washing"')) 'StartMining does not claim fast wash for this run only.'
Assert ($source.Contains('State.runFastWash := false')) 'Fast-wash run state is not cleared by normal start/stop paths.'
Assert ($source.Contains('"fastWashActive":') -and $source.Contains('State.running && State.runFastWash')) 'UI state does not expose the effective per-run fast-wash state.'
Assert ($source.Contains('if StationaryOnlyEnabled() && !LiveWashCapacityModeEnabled()')) 'Washing pre-gate is not conditional.'
Assert ($source.Contains('FAST_WASH_RETRY') -and $source.Contains('storage_gate=0')) 'Fast wash missing-target retry missing.'
Assert ($stationary.Contains('FastWashModeEnabled()') -and $stationary.Contains('State.runFastWash') -and $stationary.Contains('startup_cargo_probe=deferred')) 'Stationary per-run fast-mode deferral missing.'
Assert ($stationary.Contains('WaitStationaryCargo(generation, &id, &kind)')) 'Actual cargo verification was removed.'
Assert (-not $html.Contains('id="setting-fast-wash"')) 'Fast wash must not be presented as a sticky Settings switch.'
Assert (-not $ui.Contains("sendAction('washing.fast.toggle'")) 'The web UI still emits the retired persistent fast-wash toggle.'
Assert ($source.Contains('"try-washing"')) 'Atomic wash helper path missing.'
Assert ($source.Contains('deposit-delta') -and $source.Contains('withdraw-item')) 'Transfer verification paths missing.'
Write-Host 'FAST_WASH_CONTRACT_PASS'

$hostSource = Get-Content (Join-Path $root 'src/ui-host/Protocol.cs') -Raw
Assert ($hostSource.Contains('case "washing.fast.start":')) 'Native host rejects the direct fast-wash action.'
Assert ($html.Contains('id="fast-wash-start"') -and $ui.Contains("sendAction('washing.fast.start')")) 'Direct fast-wash entry is missing.'
$normalStartIndex = $html.IndexOf('id="run-button"', [StringComparison]::Ordinal)
$fastStartIndex = $html.IndexOf('id="fast-wash-start"', [StringComparison]::Ordinal)
$metricsIndex = $html.IndexOf('class="section-block metrics-section"', [StringComparison]::Ordinal)
Assert ($normalStartIndex -ge 0 -and $normalStartIndex -lt $fastStartIndex -and $fastStartIndex -lt $metricsIndex) 'Fast wash is not a separate action immediately after normal Start.'
Assert ($source.Contains('&& (!LiveWashCapacityModeEnabled() || State.storagePending)')) 'Fast mode still uses independent periodic inventory dispatch.'
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
