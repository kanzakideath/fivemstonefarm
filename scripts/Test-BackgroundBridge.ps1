#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Bridge = (Join-Path $PSScriptRoot '..\build\staging\AI採掘機_Background.exe'),
    [ValidateSet(0, 29200, 29300)]
    [int]$Port = 0
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
        $packetLength = ($bytes[6] -shl 24) -bor ($bytes[7] -shl 16) -bor
            ($bytes[8] -shl 8) -bor $bytes[9]
        while ($memory.Length -lt $packetLength) {
            $count = $stream.Read($buffer, 0, $buffer.Length)
            if ($count -le 0) { throw 'The fake DevCon connection closed before its payload.' }
            $memory.Write($buffer, 0, $count)
        }
        $bytes = $memory.ToArray()
        if ($packetLength -le 12 -or $bytes.Length -lt $packetLength) {
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

    # Another running AI採掘機 may probe both supported FiveM ports while this local
    # fake listener owns the otherwise-unused one. Drain those unrelated packets and
    # match the bridge-under-test command as a subsequence, with one overall deadline.
    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
    $ignored = [Collections.Generic.List[string]]::new()
    while ([DateTime]::UtcNow -lt $deadline) {
        $remaining = [Math]::Max(1, [int]($deadline - [DateTime]::UtcNow).TotalMilliseconds)
        $actual = Receive-DevConCommand -Listener $Listener -TimeoutMilliseconds $remaining
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
        [Parameter(Mandatory)] [string[]]$ExpectedCommands
    )

    $resultPath = Join-Path ([IO.Path]::GetTempPath()) ('ai-miner-bridge-test-' + [Guid]::NewGuid().ToString('N') + '.txt')
    $process = $null
    try {
        $argumentList = @($Arguments[0], ('"' + $resultPath + '"'))
        if ($Arguments.Length -gt 1) {
            $argumentList += $Arguments[1..($Arguments.Length - 1)]
        }
        $process = Start-Process -FilePath $Bridge -ArgumentList $argumentList -PassThru -WindowStyle Hidden
        $commands = foreach ($expectedCommand in $ExpectedCommands) {
            Receive-ExpectedDevConCommand -Listener $Listener -ExpectedCommand $expectedCommand
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

function Test-FinalReleaseFailure {
    param(
        [Parameter(Mandatory)] [System.Net.Sockets.TcpListener]$Listener,
        [Parameter(Mandatory)] [int]$SelectedPort,
        [Parameter(Mandatory)] [string]$ReleaseCommand,
        [Parameter(Mandatory)] [string]$PressedCommand
    )

    $resultPath = Join-Path ([IO.Path]::GetTempPath()) ('ai-miner-release-test-' + [Guid]::NewGuid().ToString('N') + '.txt')
    $process = $null
    try {
        $process = Start-Process -FilePath $Bridge -ArgumentList @(
            'play-route', ('"' + $resultPath + '"'), ([string]$SelectedPort), '500:65'
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

$resolvedBridge = [IO.Path]::GetFullPath($Bridge)
if (-not (Test-Path -LiteralPath $resolvedBridge -PathType Leaf)) {
    throw "Background bridge not found: $resolvedBridge"
}
$Bridge = $resolvedBridge

$candidatePorts = if ($Port -eq 0) { @(29300, 29200) } else { @($Port) }
$listener = $null
foreach ($candidatePort in $candidatePorts) {
    $candidateListener = $null
    try {
        $candidateListener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $candidatePort)
        $candidateListener.Start()
        $listener = $candidateListener
        $Port = $candidatePort
        break
    }
    catch {
        if ($candidateListener) { try { $candidateListener.Stop() } catch { } }
    }
}
if (-not $listener) {
    throw 'Neither supported DevCon port is available for the fake-server test.'
}
try {
    $inputRelease = '-move_up_only;-move_left_only;-move_down_only;-move_right_only;-look_up_only;-look_down_only;-look_left_only;-look_right_only'
    $expectedView = '-look_up_only;-look_down_only;-look_left_only;-look_right_only;+look_up_only;+look_left_only'
    $routePressed = $inputRelease + ';+move_up_only;+look_left_only'

    $view = Invoke-BridgeCapture -Listener $listener -Arguments @('set-view', ([string]$Port), '5') -ExpectedCommands @($expectedView)
    if ($view.Result -ne "VIEW $Port 5" -or $view.Commands[0] -ne $expectedView) {
        throw 'set-view did not emit the expected view command.'
    }

    $route = Invoke-BridgeCapture -Listener $listener -Arguments @('play-route', ([string]$Port), '25:65,25:0') `
        -ExpectedCommands @($inputRelease, $routePressed, $inputRelease, $inputRelease)
    if ($route.Result -ne "ROUTE $Port 50") {
        throw 'play-route returned an unexpected result.'
    }
    if (($route.Commands[1] -notmatch '\+move_up_only') -or
        ($route.Commands[1] -notmatch '\+look_left_only')) {
        throw 'play-route did not combine movement and view input.'
    }
    if ($route.Commands[3] -match '\+move_|\+look_') {
        throw 'play-route did not release all input at completion.'
    }

    $deactivate = Invoke-BridgeCapture -Listener $listener -Arguments @("deactivate-$Port") `
        -ExpectedCommands @('-ox_target', $inputRelease)
    if (($deactivate.Result -ne 'RELEASED') -or
        ($deactivate.Commands[1] -match '\+move_|\+look_') -or
        ($deactivate.Commands[1] -notmatch '-look_up_only') -or
        ($deactivate.Commands[1] -notmatch '-move_up_only')) {
        throw 'deactivate did not release all movement and view input.'
    }

    Test-FinalReleaseFailure -Listener $listener -SelectedPort $Port `
        -ReleaseCommand $inputRelease -PressedCommand $routePressed

    Write-Host 'Background bridge fake-DevCon tests passed.'
}
finally {
    $listener.Stop()
}
