[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$resourceRoot = Split-Path -Parent $PSScriptRoot

$required = @(
    'fxmanifest.lua',
    'config.shared.lua',
    'config.server.lua',
    'client.lua',
    'server.lua',
    'ui/index.html',
    'ui/styles.css',
    'ui/app.js',
    'README.md'
)

foreach ($relativePath in $required) {
    $path = Join-Path $resourceRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Missing required file: $relativePath"
    }
}

$manifest = Get-Content -LiteralPath (Join-Path $resourceRoot 'fxmanifest.lua') -Raw
$sharedConfig = Get-Content -LiteralPath (Join-Path $resourceRoot 'config.shared.lua') -Raw
$serverConfig = Get-Content -LiteralPath (Join-Path $resourceRoot 'config.server.lua') -Raw
$client = Get-Content -LiteralPath (Join-Path $resourceRoot 'client.lua') -Raw
$server = Get-Content -LiteralPath (Join-Path $resourceRoot 'server.lua') -Raw
$html = Get-Content -LiteralPath (Join-Path $resourceRoot 'ui/index.html') -Raw
$css = Get-Content -LiteralPath (Join-Path $resourceRoot 'ui/styles.css') -Raw

$stageHandler = [regex]::Match($server,
    "RegisterNetEvent\('ai_miner_companion:server:registerVehicle'[\s\S]*?(?=RegisterNetEvent\('ai_miner_companion:server:commitRegistration')").Value
$commitHandler = [regex]::Match($server,
    "RegisterNetEvent\('ai_miner_companion:server:commitRegistration'[\s\S]*?(?=RegisterNetEvent\('ai_miner_companion:server:abortRegistration')").Value
$abortHandler = [regex]::Match($server,
    "RegisterNetEvent\('ai_miner_companion:server:abortRegistration'[\s\S]*?(?=RegisterNetEvent\('ai_miner_companion:server:resolveVehicle')").Value
$syncHandler = [regex]::Match($server,
    "RegisterNetEvent\('ai_miner_companion:server:getActiveRegistration'[\s\S]*?(?=RegisterNetEvent\('ai_miner_companion:server:registerVehicle')").Value

$checks = [ordered]@{
    'OneSync dependency' = $manifest.Contains("dependency '/onesync'")
    'server config is server-only' = $manifest -match "server_scripts[\s\S]*config\.server\.lua"
    'ownership not shared' = $sharedConfig -notmatch 'Ownership|IdentityProvider'
    'ownership defaults fail closed' = $serverConfig.Contains("Mode = 'hook'") -and $serverConfig -match 'return false'
    'protocol v1' = $client -match 'PROTOCOL_VERSION\s*=\s*1' -and $client.Contains("PROTOCOL = 'ai-miner-companion'")
    'single bridge command' = $client -match 'RegisterCommand\(Config\.Commands\.Bridge'
    'clear registration command' = $client.Contains("command == 'clear-registration'")
    'transaction bridge commands' = $client.Contains("command == 'commit-registration'") -and $client.Contains("command == 'abort-registration'")
    'transaction timeout configuration' = $sharedConfig -match 'TransactionTimeoutMs\s*=\s*\d+' -and $sharedConfig -match 'TransactionReceiptMs\s*=\s*\d+'
    'first request is not rate limited' = $server -match 'local previous\s*=\s*buckets\[bucket\]\s+if previous and now - previous < intervalMs'
    'opaque server registration' = $server -match "'amv_'\s*\.\.\s*randomHex"
    'persistent registration KVP' = $server -match 'SetResourceKvp' -and $server -match 'GetResourceKvpString' -and $server -match 'DeleteResourceKvp'
    'selection stages without persistence' = $stageHandler -match 'pendingRegistrationByIdentity\[identity\]\s*=\s*record' -and $stageHandler -notmatch 'persistRecord\(' -and $stageHandler -notmatch 'activeRegistrationByIdentity\[identity\]\s*=\s*registrationId'
    'commit alone replaces persistent registration' = $commitHandler -match 'activeRegistrationByIdentity\[identity\]\s*=\s*record\.id' -and $commitHandler -match 'persistRecord\(record\)' -and $commitHandler -match "'REGISTRATION_COMMITTED'"
    'abort preserves committed registration' = $abortHandler -match 'abortPendingRegistration\(identity\)' -and $abortHandler -notmatch 'persistRecord\(' -and $abortHandler -notmatch 'DeleteResourceKvp'
    'transaction retry is idempotent' = $commitHandler -match 'active\.id\s*==\s*registrationId' -and $server -match 'abortedRegistrationReceiptsById\[registrationId\]' -and $abortHandler -match 'receipt\.source\s*==\s*source'
    'idempotent commands reach server' = $client -match "server:commitRegistration', requestId, id" -and $client -match "server:abortRegistration', requestId, id" -and $client -match 'if state\.registrationTransaction\.pending\s+and \(id ~= state\.registrationTransaction\.id'
    'NUI transaction schema is stable' = $html -match '"registrationTransaction":\{"pending":false,"id":"","previousId":"","startedAt":0,"expiresAt":0,"status":"idle"\}'
    'transaction capabilities are advertised' = $client -match 'transactionalRegistration\s*=\s*true' -and $client -match 'registrationCommit\s*=\s*true'
    'server registration sync starts closed' = $client -match 'serverRegistrationSync\s*=\s*false' -and $html -match '"serverRegistrationSync":false'
    'mutating commands wait for server sync' = $client -match "if not initialRegistrationSynchronized[\s\S]*?'SERVER_REGISTRATION_SYNC_PENDING'" -and $client -match "command ~= 'status' and command ~= 'cancel'"
    'server sync request is session bound' = $client -match "server:getActiveRegistration'[\s\S]*?requestId, clientEpoch" -and $server -match 'validClientEpoch\(clientEpoch\)'
    'server sync response is strictly matched' = $client -match "client:activeRegistration'[\s\S]*?requestId ~= initialRegistrationSyncRequestId[\s\S]*?clientEpoch ~= state\.epoch[\s\S]*?ok ~= true[\s\S]*?serverRegistrationSync = true"
    'startup sync aborts stale transaction before reply' = $syncHandler -match 'abortPendingRegistration\(identity\)' -and $syncHandler -match "requestId, clientEpoch, true, 'SERVER_REGISTRATION_SYNCED'"
    'sync identity failure remains closed' = $syncHandler -match "if not identity[\s\S]*?false, 'PLAYER_IDENTITY_UNAVAILABLE'" -and $client -match "ok ~= true[\s\S]*?serverRegistrationSync = false"
    'sync retries cannot abort a new candidate' = $server -match 'synchronizedClientEpochBySource\[source\] ~= clientEpoch[\s\S]*?abortPendingRegistration\(identity\)[\s\S]*?synchronizedClientEpochBySource\[source\] = clientEpoch'
    'NUI initial overlay schema is stable' = $html -match '"overlay":\{"visible":false,"title":"","detail":"","tone":"neutral"\}'
    'game target requires desktop arm' = $client -match "canInteract\s*=\s*function\(entity\)[\s\S]*?state\.status\s*==\s*'registration_armed'\s+and\s+armedRequest\s*~=\s*nil"
    'fallback requires desktop arm' = $client -match "RegisterCommand\(Config\.Commands\.RegisterFallback[\s\S]*?state\.status\s*~=\s*'registration_armed'\s+or\s+not\s+armedRequest"
    'dynamic rear navigation' = $client -match 'TaskFollowNavMeshToCoord' -and $client -match 'computeRearCargoPoint'
    'ox_inventory is default cargo provider' = $sharedConfig.Contains("Mode = 'ox_inventory'")
    'ox_inventory trunk uses authoritative netid' = $client -match "exports\.ox_inventory:openInventory\('trunk',\s*\{" -and $client -match 'netid\s*=\s*state\.registration\.networkId'
    'cargo capability follows resource lifecycle' = $client -match "resourceName == 'ox_inventory'" -and $client -match 'refreshCargoCapability'
    'manual input stops navigation' = $client -match 'manualOverrideDetected' -and $client -match "'MANUAL_OVERRIDE'"
    'moving vehicle safety bounds' = $sharedConfig -match 'MaxTrackedVehicleSpeed' -and $sharedConfig -match 'MaxVehicleDisplacement' -and $client -match "'VEHICLE_MOVING_TOO_FAST'" -and $client -match "'VEHICLE_MOVED_TOO_FAR'"
    'work camera is saved and restored' = $client -match 'cameraHeading\s*=\s*GetGameplayCamRelativeHeading' -and $client -match 'cameraPitch\s*=\s*GetGameplayCamRelativePitch' -and $client -match 'SetGameplayCamRelativeHeading\(state\.workAnchor\.cameraHeading\)' -and $client -match 'SetGameplayCamRelativePitch\(state\.workAnchor\.cameraPitch'
    'NUI bridge element' = $html -match 'id="ai-miner-companion-state"'
    'overlay does not capture input' = $css -match 'pointer-events:\s*none'
    'no NUI focus acquisition' = $client -notmatch 'SetNuiFocus'
}

$failed = @($checks.GetEnumerator() | Where-Object { -not $_.Value })
foreach ($check in $checks.GetEnumerator()) {
    $marker = if ($check.Value) { '[PASS]' } else { '[FAIL]' }
    Write-Host "$marker $($check.Key)"
}

if ($failed.Count -gt 0) {
    throw "$($failed.Count) static validation check(s) failed."
}

Write-Host "AI Miner Companion static validation passed ($($checks.Count) checks)."
