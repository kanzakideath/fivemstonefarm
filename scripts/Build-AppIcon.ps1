#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Output
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

function New-RoundedRectanglePath {
    param(
        [Parameter(Mandatory)] [Drawing.RectangleF]$Rectangle,
        [Parameter(Mandatory)] [single]$Radius
    )

    $diameter = $Radius * 2
    $path = [Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddArc($Rectangle.X, $Rectangle.Y, $diameter, $diameter, 180, 90)
    $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Y, $diameter, $diameter, 270, 90)
    $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Bottom - $diameter,
        $diameter, $diameter, 0, 90)
    $path.AddArc($Rectangle.X, $Rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-IconPng {
    param([Parameter(Mandatory)] [int]$Size)

    $bitmap = [Drawing.Bitmap]::new($Size, $Size, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.Clear([Drawing.Color]::Transparent)
        $inset = [single]($Size * 0.035)
        $bounds = [Drawing.RectangleF]::new($inset, $inset,
            [single]($Size - 2 * $inset), [single]($Size - 2 * $inset))
        $backgroundPath = New-RoundedRectanglePath -Rectangle $bounds -Radius ([single]($Size * 0.22))
        $backgroundBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255, 17, 19, 24))
        try { $graphics.FillPath($backgroundBrush, $backgroundPath) }
        finally { $backgroundBrush.Dispose(); $backgroundPath.Dispose() }

        $orePoints = [Drawing.PointF[]]@(
            [Drawing.PointF]::new([single]($Size * 0.19), [single]($Size * 0.72)),
            [Drawing.PointF]::new([single]($Size * 0.31), [single]($Size * 0.49)),
            [Drawing.PointF]::new([single]($Size * 0.53), [single]($Size * 0.51)),
            [Drawing.PointF]::new([single]($Size * 0.65), [single]($Size * 0.72)),
            [Drawing.PointF]::new([single]($Size * 0.49), [single]($Size * 0.85)),
            [Drawing.PointF]::new([single]($Size * 0.27), [single]($Size * 0.82))
        )
        $oreBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255, 10, 132, 255))
        try { $graphics.FillPolygon($oreBrush, $orePoints) }
        finally { $oreBrush.Dispose() }

        $facetPen = [Drawing.Pen]::new([Drawing.Color]::FromArgb(185, 255, 255, 255),
            [single][Math]::Max(1.0, $Size * 0.035))
        try {
            $graphics.DrawLine($facetPen,
                [single]($Size * 0.31), [single]($Size * 0.49),
                [single]($Size * 0.40), [single]($Size * 0.80))
            $graphics.DrawLine($facetPen,
                [single]($Size * 0.40), [single]($Size * 0.80),
                [single]($Size * 0.65), [single]($Size * 0.72))
        }
        finally { $facetPen.Dispose() }

        $toolPen = [Drawing.Pen]::new([Drawing.Color]::FromArgb(255, 245, 245, 247),
            [single][Math]::Max(1.5, $Size * 0.075))
        $toolPen.StartCap = [Drawing.Drawing2D.LineCap]::Round
        $toolPen.EndCap = [Drawing.Drawing2D.LineCap]::Round
        try {
            $graphics.DrawLine($toolPen,
                [single]($Size * 0.43), [single]($Size * 0.67),
                [single]($Size * 0.70), [single]($Size * 0.32))
            $graphics.DrawLine($toolPen,
                [single]($Size * 0.54), [single]($Size * 0.27),
                [single]($Size * 0.80), [single]($Size * 0.38))
        }
        finally { $toolPen.Dispose() }

        $stream = [IO.MemoryStream]::new()
        try {
            $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png)
            return ,$stream.ToArray()
        }
        finally { $stream.Dispose() }
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

$resolvedOutput = [IO.Path]::GetFullPath($Output)
$outputDirectory = Split-Path -Parent $resolvedOutput
if (-not (Test-Path -LiteralPath $outputDirectory -PathType Container)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$sizes = @(16, 20, 24, 32, 40, 48, 64, 128, 256)
$images = @($sizes | ForEach-Object { New-IconPng -Size $_ })
$headerBytes = 6 + 16 * $images.Count
$offset = $headerBytes
$fileStream = [IO.File]::Open($resolvedOutput, [IO.FileMode]::Create,
    [IO.FileAccess]::Write, [IO.FileShare]::None)
$writer = [IO.BinaryWriter]::new($fileStream)
try {
    $writer.Write([uint16]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]$images.Count)
    for ($index = 0; $index -lt $images.Count; $index++) {
        $size = $sizes[$index]
        $dimensionByte = if ($size -eq 256) { 0 } else { $size }
        $writer.Write([byte]$dimensionByte)
        $writer.Write([byte]$dimensionByte)
        $writer.Write([byte]0)
        $writer.Write([byte]0)
        $writer.Write([uint16]1)
        $writer.Write([uint16]32)
        $writer.Write([uint32]$images[$index].Length)
        $writer.Write([uint32]$offset)
        $offset += $images[$index].Length
    }
    foreach ($image in $images) {
        $writer.Write($image)
    }
}
finally {
    $writer.Dispose()
    $fileStream.Dispose()
}

if ((Get-Item -LiteralPath $resolvedOutput).Length -lt 1024) {
    throw 'Generated application icon is unexpectedly small.'
}

Write-Output $resolvedOutput
