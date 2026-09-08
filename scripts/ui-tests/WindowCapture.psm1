#Requires -Version 5.1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$nativeSource = Join-Path $PSScriptRoot 'WindowCapture.Native.cs'
if (-not ('AiMiner.UiTests.NativeWindowCapture' -as [type])) {
    Add-Type -Path $nativeSource
}
Add-Type -AssemblyName System.Drawing

function Get-UiWindowByProcess {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateRange(1, [int]::MaxValue)]
        [int]$ProcessId,

        [string]$WindowTitlePattern = '.+',

        [ValidateRange(1, 300)]
        [int]$TimeoutSeconds = 20,

        [ValidateRange(0, 5000)]
        [int]$StableMilliseconds = 400
    )

    try {
        $titleRegex = [regex]::new(
            $WindowTitlePattern,
            [Text.RegularExpressions.RegexOptions]::CultureInvariant,
            [TimeSpan]::FromMilliseconds(250)
        )
    }
    catch {
        throw "WindowTitlePattern is not a valid regular expression: $($_.Exception.Message)"
    }

    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $stableSince = $null
    $stableSignature = ''
    $lastCandidates = @()
    while ([DateTime]::UtcNow -lt $deadline) {
        $lastCandidates = @(
            [AiMiner.UiTests.NativeWindowCapture]::EnumerateWindows($ProcessId) |
                Where-Object {
                    $_.Visible -and -not $_.Minimized -and -not $_.Cloaked -and
                    $_.FrameWidth -gt 0 -and $_.FrameHeight -gt 0 -and
                    $titleRegex.IsMatch([string]$_.Title)
                } |
                Sort-Object @{ Expression = { $_.FrameWidth * $_.FrameHeight }; Descending = $true }
        )

        if ($lastCandidates.Count -gt 0) {
            $candidate = $lastCandidates[0]
            $signature = '{0}:{1}:{2}:{3}:{4}:{5}' -f $candidate.Hwnd, $candidate.FrameLeft,
                $candidate.FrameTop, $candidate.FrameWidth, $candidate.FrameHeight, $candidate.Title
            if ($signature -ne $stableSignature) {
                $stableSignature = $signature
                $stableSince = [DateTime]::UtcNow
            }
            elseif ($StableMilliseconds -eq 0 -or
                ([DateTime]::UtcNow - $stableSince).TotalMilliseconds -ge $StableMilliseconds) {
                return $candidate
            }
        }
        else {
            $stableSince = $null
            $stableSignature = ''
        }
        Start-Sleep -Milliseconds 100
    }

    $titles = @($lastCandidates | ForEach-Object { "'$($_.Title)'" }) -join ', '
    if (-not $titles) { $titles = '(none)' }
    throw "No stable visible top-level window for PID $ProcessId matched '$WindowTitlePattern' within $TimeoutSeconds seconds. Candidates: $titles"
}

function Save-UiWindowCapture {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateRange(1, [long]::MaxValue)]
        [long]$Hwnd,

        [Parameter(Mandatory)]
        [ValidateRange(1, [int]::MaxValue)]
        [int]$ExpectedProcessId,

        [Parameter(Mandatory)]
        [string]$OutputPath,

        [string]$MetadataPath,

        [switch]$Force
    )

    $resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
    if (-not $MetadataPath) {
        $MetadataPath = [IO.Path]::ChangeExtension($resolvedOutput, '.json')
    }
    $resolvedMetadata = [IO.Path]::GetFullPath($MetadataPath)

    foreach ($path in @($resolvedOutput, $resolvedMetadata)) {
        if (Test-Path -LiteralPath $path) {
            if (-not $Force) {
                throw "Refusing to overwrite existing UI test artifact: $path"
            }
            Remove-Item -LiteralPath $path -Force
        }
        $parent = Split-Path -Parent $path
        if ($parent) { [void](New-Item -ItemType Directory -Path $parent -Force) }
    }

    $window = [AiMiner.UiTests.NativeWindowCapture]::DescribeWindow($Hwnd)
    if ($window.ProcessId -ne $ExpectedProcessId) {
        throw "HWND 0x$($Hwnd.ToString('X')) belongs to PID $($window.ProcessId), not expected PID $ExpectedProcessId."
    }
    if (-not $window.Visible -or $window.Minimized -or $window.Cloaked) {
        throw 'The target window must be visible, non-minimized, and non-cloaked.'
    }

    # PrintWindow renders in the target process's DPI coordinate space. The DWM
    # frame is physical pixels, so native code maps that frame back to the same
    # coordinate space before the bitmap is allocated. This avoids a black
    # three-quarter canvas for DPI-unaware windows on a 200% monitor.
    $metrics = [AiMiner.UiTests.NativeWindowCapture]::GetCaptureMetrics($Hwnd)
    $previousDpiContext = [AiMiner.UiTests.NativeWindowCapture]::EnterWindowDpiContext($Hwnd)
    try {
        $windowWidth = $metrics.WindowWidth
        $windowHeight = $metrics.WindowHeight
        if ($windowWidth -le 0 -or $windowHeight -le 0 -or $windowWidth -gt 32768 -or $windowHeight -gt 32768) {
            throw 'The target window has invalid capture dimensions.'
        }
        $cropX = $metrics.CropLeft
        $cropY = $metrics.CropTop
        $cropWidth = $metrics.CropWidth
        $cropHeight = $metrics.CropHeight
        if ($cropWidth -le 0 -or $cropHeight -le 0) {
            throw 'The DWM frame does not intersect the target window.'
        }

        $fullBitmap = [Drawing.Bitmap]::new($windowWidth, $windowHeight, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
            $graphics = [Drawing.Graphics]::FromImage($fullBitmap)
            try {
                $graphics.Clear([Drawing.Color]::Transparent)
                $destinationDc = $graphics.GetHdc()
                try {
                    $printSucceeded = [AiMiner.UiTests.NativeWindowCapture]::PrintWindowToDc($Hwnd, $destinationDc.ToInt64())
                }
                finally {
                    $graphics.ReleaseHdc($destinationDc)
                }
            }
            finally {
                $graphics.Dispose()
            }
            if (-not $printSucceeded) {
                $nativeError = [AiMiner.UiTests.NativeWindowCapture]::LastWin32Error()
                throw "PrintWindow(PW_RENDERFULLCONTENT) failed with Win32 error $nativeError. No desktop-copy fallback was used."
            }

            $cropRectangle = [Drawing.Rectangle]::new($cropX, $cropY, $cropWidth, $cropHeight)
            $croppedBitmap = $fullBitmap.Clone($cropRectangle, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
            try {
                $croppedBitmap.Save($resolvedOutput, [Drawing.Imaging.ImageFormat]::Png)
            }
            finally {
                $croppedBitmap.Dispose()
            }
        }
        finally {
            $fullBitmap.Dispose()
        }
    }
    finally {
        [AiMiner.UiTests.NativeWindowCapture]::LeaveDpiContext($previousDpiContext)
    }

    $metadata = [ordered]@{
        schemaVersion = 1
        capturedAtUtc = [DateTime]::UtcNow.ToString('o')
        captureBackend = 'PrintWindow(PW_RENDERFULLCONTENT)'
        desktopFallbackUsed = $false
        processId = $window.ProcessId
        hwnd = ('0x{0:X}' -f $window.Hwnd)
        title = $window.Title
        className = $window.ClassName
        dpi = $window.Dpi
        scalePercent = [int][Math]::Round($window.Dpi * 100.0 / 96.0)
        targetDpiAwareness = $metrics.TargetDpiAwareness
        physicalToCaptureScale = [ordered]@{
            x = $metrics.PhysicalToCaptureScaleX
            y = $metrics.PhysicalToCaptureScaleY
        }
        windowBounds = [ordered]@{
            left = $window.WindowLeft
            top = $window.WindowTop
            width = $window.WindowWidth
            height = $window.WindowHeight
        }
        capturedFrameBounds = [ordered]@{
            left = $window.FrameLeft
            top = $window.FrameTop
            width = $window.FrameWidth
            height = $window.FrameHeight
        }
        image = [ordered]@{
            path = $resolvedOutput
            width = $cropWidth
            height = $cropHeight
            format = 'png'
        }
        printWindowSucceeded = $printSucceeded
    }
    $metadata | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $resolvedMetadata -Encoding UTF8
    return [pscustomobject]$metadata
}

function Get-UiMonitorInventory {
    [CmdletBinding()]
    param()

    return @([AiMiner.UiTests.NativeWindowCapture]::EnumerateMonitors())
}

Export-ModuleMember -Function Get-UiWindowByProcess, Save-UiWindowCapture, Get-UiMonitorInventory
