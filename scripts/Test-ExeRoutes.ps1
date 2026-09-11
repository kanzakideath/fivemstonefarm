#Requires -Version 5.1
[CmdletBinding()]
param([string]$SourcePath = '')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot
if (-not $SourcePath) { $SourcePath = Join-Path $root 'src/mining-auto.ahk' }
$main = [IO.File]::ReadAllText($SourcePath)
$module = [IO.File]::ReadAllText((Join-Path $root 'src/exe-route-navigation.ahk'))
$helper = [IO.File]::ReadAllText((Join-Path $root 'src/local-navigation/LocalNavigation.cs'))
function Assert-Check([bool]$ok, [string]$message) { if (-not $ok) { throw $message } }
Assert-Check ($main.Contains('#Include exe-route-navigation.ahk')) 'EXE route module is not compiled into production.'
$start=$main.IndexOf('FindRegisteredStorageNearby(expectedGeneration, &movementHistory,')
$end=$main.IndexOf('TryRegisteredStorageViews(', $start)
$navigation=$main.Substring($start,$end-$start)
Assert-Check ($navigation.Contains('ExecuteExeRouteLeg(expectedGeneration, "outbound")')) 'No outward route execution.'
Assert-Check ($navigation.Contains('ProbeExeRouteCargo(')) 'No registered cargo verification.'
Assert-Check (-not $navigation.Contains('PlayLocalRoute') -and -not $navigation.Contains('movementSteps')) 'Blind wandering remained in storage navigation.'
Assert-Check ($main.Contains('poseRestored := ExecuteExeRouteLeg(expectedGeneration, "return")')) 'Return is not independently recorded.'
Assert-Check ($module.Contains('ProbeWorkTarget(mode, generation)')) 'No semantic work-target proof.'
Assert-Check ($module.Contains('id != Config.vehicleStorageId') -and $module.Contains('type != Config.vehicleStorageType')) 'Cargo identity proof lost.'
Assert-Check ($module.Contains('"Verified", "0") = "1"') -and $module.Contains('outbound.verified')) 'Route trial/integrity gate is missing.'
Assert-Check ($module.Contains('IniRead(meta, "Route", "Epoch", "") = epoch')) 'Routes are not bound to the recorded session.'
Assert-Check ($module -notmatch 'RunCompanion|go-vehicle|return-work|TaskFollowNavMesh|ReadProcessMemory') 'Client-only module unexpectedly depends on a server or memory reads.'
Assert-Check ($helper.Contains('GetForegroundWindow() != target') -and $helper.Contains('finally { release(); }')) 'Foreground/input-release protection missing.'
Assert-Check ($helper.Contains('NO_REPLAY_AFTER_FAILED_CHECKPOINT') -and $helper.Contains('INPUT_AFTER_CANCEL')) 'Actual planner failure/cancel tests missing.'
Assert-Check ($main.Contains('NotifyExeActionComplete(expectedGeneration, actionMode, attemptId)')) 'Per-action notifications not connected to verified reward completion.'
foreach($mode in @('mining','washing','gold')) {
  foreach($style in @('sweet','clear')) {
    $file=Join-Path $root "src/audio/$mode-complete-$style.wav"
    Assert-Check (Test-Path -LiteralPath $file) "Missing generated voice: $file"
  }
}
$manifest=Get-Content (Join-Path $root 'src/audio/voice-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
Assert-Check ($manifest.clips.Count -eq 6 -and $manifest.credit -eq 'VOICEVOX:四国めたん') 'Voice credits/manifest mismatch.'
foreach($clip in $manifest.clips) {
  $hash=(Get-FileHash (Join-Path $root ('src/audio/'+$clip.file)) -Algorithm SHA256).Hash.ToLowerInvariant()
  Assert-Check ($hash -eq $clip.sha256) ('Voice clip integrity mismatch: '+$clip.file)
}
Write-Host 'EXE-only route and voice integration checks passed (static wiring and assets; not live FiveM).'

$phrases = @{
    mining = '石掘りが終わったよ'
    washing = '石洗いが終わったよ'
    gold = '砂金取りが終わりました'
}
foreach ($mode in $phrases.Keys) {
    Assert-Check ($module.Contains($phrases[$mode])) ('Completion phrase missing: ' + $mode)
    foreach ($style in @('sweet', 'clear')) {
        $name = "$mode-complete-$style.wav"
        $clip = @($manifest.clips | Where-Object { $_.file -eq $name })
        Assert-Check ($clip.Count -eq 1) ('Expected exactly one voice record: ' + $name)
        Assert-Check ($clip[0].text.TrimEnd([char]0x3002) -ceq $phrases[$mode]) ('Voice text mismatch: ' + $name)
        [byte[]]$wav = [IO.File]::ReadAllBytes((Join-Path $root ('src/audio/' + $name)))
        Assert-Check ($wav.Length -gt 44 -and [Text.Encoding]::ASCII.GetString($wav,0,4) -eq 'RIFF' -and [Text.Encoding]::ASCII.GetString($wav,8,4) -eq 'WAVE') ('Invalid WAV: ' + $name)
    }
}
Write-Host 'All three exact completion phrases and six embedded WAV headers verified.'

Assert-Check (-not $helper.Contains('NormalisePitch')) 'Forced camera normalization returned.'
Assert-Check ($helper.Contains('RequirePlayback(mode); Guard();') -and $helper.Contains('RECORDING_INJECTION_POLICY_TEST')) 'Passive recording input policy missing.'
Assert-Check ($helper.Contains('LEGACY_ROUTE_RERECORD_NO_PITCH')) 'Legacy route needs explicit re-recording.'
Assert-Check ($module.Contains('EvaluateStationarySpot(') -and $main.Contains('ValidateStationaryWorkflow()')) 'Stationary workflow/compiled test missing.'
$start = $module.IndexOf('ProbeExeRouteCargo(generation,')
$end = $module.IndexOf('; This receipt', $start)
Assert-Check ($start -ge 0 -and $end -gt $start) 'Endpoint boundary missing.'
$endpoints = $module.Substring($start, $end - $start)
Assert-Check (-not $endpoints.Contains('ExeRouteCameraStep(')) 'Endpoint check must not change the recorded view.'
Write-Host 'Passive recording and stationary source contracts passed. Live game checks are separate.'
