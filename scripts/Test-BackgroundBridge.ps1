#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Bridge = (Join-Path $PSScriptRoot '..\build\staging\AI採掘機_Background.exe')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Receive-DevConCommand {
    param(
        [Parameter(Mandatory)] [System.Net.Sockets.TcpListener]$Listener,
        [int]$TimeoutMilliseconds = 5000
    )

    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
    while (-not $Listener.Pending()) {
        if ([DateTime]::UtcNow -ge $deadline) {
            throw 'Timed out waiting for a fake DevCon connection.'
        }
        Start-Sleep -Milliseconds 10
    }
    $client = $Listener.AcceptTcpClient()
    try {
        $stream = $client.GetStream()
        $stream.ReadTimeout = $TimeoutMilliseconds
        $buffer = New-Object byte[] 4096
        $memory = New-Object System.IO.MemoryStream
        while ($memory.Length -lt 12) {
            $count = $stream.Read($buffer, 0, $buffer.Length)
            if ($count -le 0) { throw 'The fake DevCon connection closed before its header.' }
            $memory.Write($buffer, 0, $count)
        }

        $bytes = $memory.ToArray()
        # PowerShell preserves [byte] for bit shifts, so cast before shifting or
        # packets larger than 255 bytes are silently truncated to their low byte.
        $packetLength = (([int]$bytes[6] -shl 24) -bor ([int]$bytes[7] -shl 16) -bor
            ([int]$bytes[8] -shl 8) -bor [int]$bytes[9])
        if ($bytes[0] -ne [byte][char]'C' -or $bytes[1] -ne [byte][char]'M' -or
            $bytes[2] -ne [byte][char]'N' -or $bytes[3] -ne [byte][char]'D' -or
            $packetLength -le 12 -or $packetLength -gt 1048576) {
            throw 'The fake DevCon server received an invalid packet header.'
        }
        while ($memory.Length -lt $packetLength) {
            $count = $stream.Read($buffer, 0, $buffer.Length)
            if ($count -le 0) { throw 'The fake DevCon connection closed before its payload.' }
            $memory.Write($buffer, 0, $count)
        }
        $bytes = $memory.ToArray()
        if ($bytes.Length -lt $packetLength) {
            throw 'The fake DevCon server received an invalid packet length.'
        }
        return [Text.Encoding]::UTF8.GetString($bytes, 12, $packetLength - 12).Trim([char]0)
    }
    finally {
        $client.Dispose()
    }
}

function Receive-ExpectedDevConCommand {
    param(
        [Parameter(Mandatory)] [System.Net.Sockets.TcpListener]$Listener,
        [Parameter(Mandatory)] [string]$ExpectedCommand,
        [int]$TimeoutMilliseconds = 5000
    )

    # The authenticated random test port should have one writer. Keep subsequence
    # matching so a diagnostic packet cannot shift the command assertions.
    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
    $ignored = [Collections.Generic.List[string]]::new()
    while ([DateTime]::UtcNow -lt $deadline) {
        $remaining = [Math]::Max(1, [int]($deadline - [DateTime]::UtcNow).TotalMilliseconds)
        try {
            $actual = Receive-DevConCommand -Listener $Listener -TimeoutMilliseconds $remaining
        }
        catch {
            break
        }
        if ($actual -ceq $ExpectedCommand) {
            return $actual
        }
        if ($ignored.Count -lt 12) {
            $ignored.Add($actual)
        }
    }
    $summary = if ($ignored.Count) { $ignored -join ' | ' } else { '(none)' }
    throw "Timed out waiting for the expected fake DevCon command. Ignored: $summary"
}

function Invoke-BridgeCapture {
    param(
        [Parameter(Mandatory)] [System.Net.Sockets.TcpListener]$Listener,
        [Parameter(Mandatory)] [string[]]$Arguments,
        [Parameter(Mandatory)] [string[]]$ExpectedCommands,
        [Parameter(Mandatory)] [string]$TestToken
    )

    $resultPath = Join-Path ([IO.Path]::GetTempPath()) ('ai-miner-bridge-test-' + [Guid]::NewGuid().ToString('N') + '.txt')
    $process = $null
    try {
        $argumentList = @($Arguments[0], ('"' + $resultPath + '"'))
        if ($Arguments.Length -gt 1) {
            $argumentList += $Arguments[1..($Arguments.Length - 1)]
        }
        $argumentList += $TestToken
        $process = Start-Process -FilePath $Bridge -ArgumentList $argumentList -PassThru -WindowStyle Hidden
        try {
            $commands = foreach ($expectedCommand in $ExpectedCommands) {
                Receive-ExpectedDevConCommand -Listener $Listener -ExpectedCommand $expectedCommand
            }
        }
        catch {
            [void]$process.WaitForExit(1000)
            $exitSummary = if ($process.HasExited) { [string]$process.ExitCode } else { 'running' }
            $resultSummary = if (Test-Path -LiteralPath $resultPath -PathType Leaf) {
                (Get-Content -LiteralPath $resultPath -Raw).Trim()
            } else { '(none)' }
            throw "$($_.Exception.Message) Bridge exit=$exitSummary result=$resultSummary"
        }
        if (-not $process.WaitForExit(10000)) {
            try { $process.Kill() } catch { }
            throw 'The background bridge test timed out.'
        }
        if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $resultPath -PathType Leaf)) {
            throw "The background bridge failed with exit code $($process.ExitCode)."
        }
        return [pscustomobject]@{
            Result = (Get-Content -LiteralPath $resultPath -Raw).Trim()
            Commands = @($commands)
        }
    }
    finally {
        if ($process -and -not $process.HasExited) {
            try { $process.Kill() } catch { }
        }
        if (Test-Path -LiteralPath $resultPath -PathType Leaf) {
            Remove-Item -LiteralPath $resultPath -Force
        }
    }
}

function Invoke-BridgeSimple {
    param(
        [Parameter(Mandatory)] [string]$Mode
    )

    $resultPath = Join-Path ([IO.Path]::GetTempPath()) ('ai-miner-bridge-simple-' + [Guid]::NewGuid().ToString('N') + '.txt')
    $process = $null
    try {
        $process = Start-Process -FilePath $Bridge -ArgumentList @(
            $Mode, ('"' + $resultPath + '"')
        ) -PassThru -WindowStyle Hidden
        if (-not $process.WaitForExit(10000)) {
            try { $process.Kill() } catch { }
            throw "The $Mode bridge test timed out."
        }
        if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $resultPath -PathType Leaf)) {
            throw "The $Mode bridge test failed with exit code $($process.ExitCode)."
        }
        return (Get-Content -LiteralPath $resultPath -Raw).Trim()
    }
    finally {
        if ($process -and -not $process.HasExited) {
            try { $process.Kill() } catch { }
        }
        if (Test-Path -LiteralPath $resultPath -PathType Leaf) {
            Remove-Item -LiteralPath $resultPath -Force
        }
    }
}

function Test-FinalReleaseFailure {
    param(
        [Parameter(Mandatory)] [System.Net.Sockets.TcpListener]$Listener,
        [Parameter(Mandatory)] [int]$SelectedPort,
        [Parameter(Mandatory)] [string]$ReleaseCommand,
        [Parameter(Mandatory)] [string]$PressedCommand,
        [Parameter(Mandatory)] [string]$TestToken
    )

    $resultPath = Join-Path ([IO.Path]::GetTempPath()) ('ai-miner-release-test-' + [Guid]::NewGuid().ToString('N') + '.txt')
    $process = $null
    try {
        $process = Start-Process -FilePath $Bridge -ArgumentList @(
            'play-route', ('"' + $resultPath + '"'), ([string]$SelectedPort), '500:65', $TestToken
        ) -PassThru -WindowStyle Hidden
        [void](Receive-ExpectedDevConCommand -Listener $Listener -ExpectedCommand $ReleaseCommand)
        [void](Receive-ExpectedDevConCommand -Listener $Listener -ExpectedCommand $PressedCommand)
        $Listener.Stop()
        if (-not $process.WaitForExit(10000)) {
            try { $process.Kill() } catch { }
            throw 'The final-release failure test timed out.'
        }
        $result = if (Test-Path -LiteralPath $resultPath -PathType Leaf) {
            (Get-Content -LiteralPath $resultPath -Raw).Trim()
        } else { '' }
        if ($process.ExitCode -eq 0 -or $result -ne 'ERROR INPUT_RELEASE_UNAVAILABLE') {
            throw 'play-route reported success after its final release connection failed.'
        }
    }
    finally {
        if ($process -and -not $process.HasExited) {
            try { $process.Kill() } catch { }
        }
        if (Test-Path -LiteralPath $resultPath -PathType Leaf) {
            Remove-Item -LiteralPath $resultPath -Force
        }
    }
}

function Test-TestPortAuthentication {
    param(
        [Parameter(Mandatory)] [System.Net.Sockets.TcpListener]$Listener,
        [Parameter(Mandatory)] [int]$SelectedPort,
        [Parameter(Mandatory)] [string]$TestToken
    )

    $resultPath = Join-Path ([IO.Path]::GetTempPath()) ('ai-miner-auth-test-' + [Guid]::NewGuid().ToString('N') + '.txt')
    $process = $null
    $wrongToken = if ($TestToken[0] -eq '0') { '1' + $TestToken.Substring(1) } else { '0' + $TestToken.Substring(1) }
    try {
        $process = Start-Process -FilePath $Bridge -ArgumentList @(
            'set-view', ('"' + $resultPath + '"'), ([string]$SelectedPort), '5', $wrongToken
        ) -PassThru -WindowStyle Hidden
        if (-not $process.WaitForExit(5000)) {
            try { $process.Kill() } catch { }
            throw 'The unauthorized test-port check timed out.'
        }
        if ($process.ExitCode -ne 64 -or (Test-Path -LiteralPath $resultPath -PathType Leaf)) {
            throw 'The bridge accepted a test port without the matching inherited token.'
        }
        if ($Listener.Pending()) {
            throw 'The rejected test-port request still emitted a DevCon packet.'
        }
    }
    finally {
        if ($process -and -not $process.HasExited) {
            try { $process.Kill() } catch { }
        }
        if (Test-Path -LiteralPath $resultPath -PathType Leaf) {
            Remove-Item -LiteralPath $resultPath -Force
        }
    }
}

function Test-RouteHealthProductionOnly {
    param(
        [Parameter(Mandatory)] [System.Net.Sockets.TcpListener]$Listener,
        [Parameter(Mandatory)] [int]$SelectedPort
    )

    $resultPath = Join-Path ([IO.Path]::GetTempPath()) ('ai-miner-route-health-test-' + [Guid]::NewGuid().ToString('N') + '.txt')
    $process = $null
    $epochBytes = [Text.Encoding]::UTF8.GetBytes("target-frame`ninventory-frame")
    $validEpoch = ([Convert]::ToBase64String($epochBytes)).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    try {
        # Even while the matching test environment is enabled, play-route-health
        # must never inherit the random-port escape hatch.
        $process = Start-Process -FilePath $Bridge -ArgumentList @(
            'play-route-health', ('"' + $resultPath + '"'), ([string]$SelectedPort),
            '25:1', $validEpoch
        ) -PassThru -WindowStyle Hidden
        if (-not $process.WaitForExit(5000)) {
            try { $process.Kill() } catch { }
            throw 'The production-only route-health check timed out.'
        }
        if ($process.ExitCode -ne 64 -or (Test-Path -LiteralPath $resultPath -PathType Leaf)) {
            throw 'play-route-health accepted the random test port.'
        }
        if ($Listener.Pending()) {
            throw 'The rejected play-route-health request still emitted a DevCon packet.'
        }
    }
    finally {
        if ($process -and -not $process.HasExited) {
            try { $process.Kill() } catch { }
        }
        if (Test-Path -LiteralPath $resultPath -PathType Leaf) {
            Remove-Item -LiteralPath $resultPath -Force
        }
    }
}

$resolvedBridge = [IO.Path]::GetFullPath($Bridge)
if (-not (Test-Path -LiteralPath $resolvedBridge -PathType Leaf)) {
    throw "Background bridge not found: $resolvedBridge"
}
$Bridge = $resolvedBridge

$testPortVariable = 'AI_MINER_BRIDGE_TEST_PORT'
$testTokenVariable = 'AI_MINER_BRIDGE_TEST_TOKEN'
$previousTestPort = [Environment]::GetEnvironmentVariable($testPortVariable, 'Process')
$previousTestToken = [Environment]::GetEnvironmentVariable($testTokenVariable, 'Process')

$listener = $null
foreach ($attempt in 1..8) {
    $candidateListener = $null
    try {
        $candidateListener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
        $candidateListener.Start(100)
        $selectedPort = ([Net.IPEndPoint]$candidateListener.LocalEndpoint).Port
        if ($selectedPort -lt 1024 -or $selectedPort -eq 29200 -or $selectedPort -eq 29300) {
            $candidateListener.Stop()
            continue
        }
        $listener = $candidateListener
        $Port = $selectedPort
        break
    }
    catch {
        if ($candidateListener) { try { $candidateListener.Stop() } catch { } }
    }
}
if (-not $listener) {
    throw 'A non-production loopback port is not available for the fake-server test.'
}

try {
    $tokenBytes = New-Object byte[] 32
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($tokenBytes) } finally { $random.Dispose() }
    $testToken = ([BitConverter]::ToString($tokenBytes)).Replace('-', '').ToLowerInvariant()

    [Environment]::SetEnvironmentVariable($testPortVariable, ([string]$Port), 'Process')
    [Environment]::SetEnvironmentVariable($testTokenVariable, $testToken, 'Process')

    if ((Invoke-BridgeSimple -Mode 'self-test') -ne 'SELFTEST OK') {
        throw 'self-test returned an unexpected result.'
    }

    Test-TestPortAuthentication -Listener $listener -SelectedPort $Port -TestToken $testToken
    Test-RouteHealthProductionOnly -Listener $listener -SelectedPort $Port

    $viewRelease = '-look_up_only;-look_down_only;-look_left_only;-look_right_only;-look_up;-look_down;-look_left;-look_right;-scaled_look_up_only;-scaled_look_down_only;-scaled_look_left_only;-scaled_look_right_only'
    $inputRelease = '-move_up_only;-move_left_only;-move_down_only;-move_right_only;' + $viewRelease + ';-hotkey1;-hotkey2;-hotkey3;-hotkey4;-hotkey5;-inv'
    $expectedView = $viewRelease + ';+look_up;+look_left'
    $routePressed = $inputRelease + ';+move_up_only;+look_left'

    $view = Invoke-BridgeCapture -Listener $listener -Arguments @('set-view', ([string]$Port), '5') `
        -ExpectedCommands @($expectedView) -TestToken $testToken
    if ($view.Result -ne "VIEW $Port 5" -or $view.Commands[0] -ne $expectedView) {
        throw 'set-view did not emit the expected view command.'
    }

    $hotbar = Invoke-BridgeCapture -Listener $listener `
        -Arguments @('press-hotbar', ([string]$Port), '1', '30') `
        -ExpectedCommands @('-hotkey1;+hotkey1', '-hotkey1') -TestToken $testToken
    if ($hotbar.Result -ne "HOTBAR $Port 1") {
        throw 'press-hotbar returned an unexpected result.'
    }

    $inventoryKey = Invoke-BridgeCapture -Listener $listener `
        -Arguments @('press-inventory', ([string]$Port), '30') `
        -ExpectedCommands @('-inv;+inv', '-inv') -TestToken $testToken
    if ($inventoryKey.Result -ne "INVENTORY $Port") {
        throw 'press-inventory returned an unexpected result.'
    }

    $route = Invoke-BridgeCapture -Listener $listener -Arguments @('play-route', ([string]$Port), '25:65,25:0') `
        -ExpectedCommands @($inputRelease, $routePressed, $inputRelease, $inputRelease) -TestToken $testToken
    if ($route.Result -ne "ROUTE $Port 50") {
        throw 'play-route returned an unexpected result.'
    }
    if (($route.Commands[1] -notmatch '\+move_up_only') -or
        ($route.Commands[1] -notmatch '\+look_left')) {
        throw 'play-route did not combine movement and view input.'
    }
    if ($route.Commands[3] -match '\+move_|\+look_') {
        throw 'play-route did not release all input at completion.'
    }

    $deactivate = Invoke-BridgeCapture -Listener $listener -Arguments @('deactivate-test', ([string]$Port)) `
        -ExpectedCommands @('-ox_target', $inputRelease) -TestToken $testToken
    if (($deactivate.Result -ne 'RELEASED') -or
        ($deactivate.Commands[1] -match '\+move_|\+look_') -or
        ($deactivate.Commands[1] -notmatch '-look_up_only') -or
        ($deactivate.Commands[1] -notmatch '-move_up_only')) {
        throw 'deactivate did not release all movement and view input.'
    }

    Test-FinalReleaseFailure -Listener $listener -SelectedPort $Port `
        -ReleaseCommand $inputRelease -PressedCommand $routePressed -TestToken $testToken

    Write-Host 'Background bridge fake-DevCon tests passed.'
}
finally {
    try { $listener.Stop() }
    finally {
        [Environment]::SetEnvironmentVariable($testPortVariable, $previousTestPort, 'Process')
        [Environment]::SetEnvironmentVariable($testTokenVariable, $previousTestToken, 'Process')
    }
}
