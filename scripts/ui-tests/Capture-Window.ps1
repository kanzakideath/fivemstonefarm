#Requires -Version 5.1
[CmdletBinding(DefaultParameterSetName = 'ByProcess')]
param(
    [Parameter(Mandatory, ParameterSetName = 'ByProcess')]
    [ValidateRange(1, [int]::MaxValue)]
    [int]$ProcessId,

    [Parameter(Mandatory, ParameterSetName = 'ByHwnd')]
    [ValidateRange(1, [long]::MaxValue)]
    [long]$Hwnd,

    [Parameter(Mandatory, ParameterSetName = 'ByHwnd')]
    [ValidateRange(1, [int]::MaxValue)]
    [int]$ExpectedProcessId,

    [Parameter(ParameterSetName = 'ByProcess')]
    [string]$WindowTitlePattern = '.+',

    [Parameter(ParameterSetName = 'ByProcess')]
    [ValidateRange(1, 300)]
    [int]$WaitTimeoutSeconds = 20,

    [Parameter(ParameterSetName = 'ByProcess')]
    [ValidateRange(0, 5000)]
    [int]$StableMilliseconds = 400,

    [Parameter(ParameterSetName = 'ByProcess')]
    [ValidateRange(1, [long]::MaxValue)]
    [long]$ExpectedProcessStartTimeUtcTicks,

    [Parameter(Mandatory)]
    [string]$OutputPath,

    [string]$MetadataPath,

    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot 'WindowCapture.psm1') -Force

if ($PSCmdlet.ParameterSetName -eq 'ByProcess') {
    if ($ExpectedProcessStartTimeUtcTicks -gt 0) {
        $targetProcess = [Diagnostics.Process]::GetProcessById($ProcessId)
        try {
            $actualTicks = $targetProcess.StartTime.ToUniversalTime().Ticks
        }
        finally {
            $targetProcess.Dispose()
        }
        if ([Math]::Abs($actualTicks - $ExpectedProcessStartTimeUtcTicks) -gt [TimeSpan]::TicksPerSecond) {
            throw "PID $ProcessId no longer identifies the process that the caller launched."
        }
    }
    $window = Get-UiWindowByProcess -ProcessId $ProcessId -WindowTitlePattern $WindowTitlePattern `
        -TimeoutSeconds $WaitTimeoutSeconds -StableMilliseconds $StableMilliseconds
    if ($ExpectedProcessStartTimeUtcTicks -gt 0) {
        $targetProcess = [Diagnostics.Process]::GetProcessById($ProcessId)
        try {
            $actualTicks = $targetProcess.StartTime.ToUniversalTime().Ticks
        }
        finally {
            $targetProcess.Dispose()
        }
        if ([Math]::Abs($actualTicks - $ExpectedProcessStartTimeUtcTicks) -gt [TimeSpan]::TicksPerSecond) {
            throw "PID $ProcessId was reused while waiting for its UI window."
        }
    }
    $Hwnd = $window.Hwnd
    $ExpectedProcessId = $ProcessId
}

$capture = Save-UiWindowCapture -Hwnd $Hwnd -ExpectedProcessId $ExpectedProcessId `
    -OutputPath $OutputPath -MetadataPath $MetadataPath -Force:$Force
$capture | ConvertTo-Json -Depth 6
