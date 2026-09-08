#Requires -Version 5.1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
$scriptArguments = @($args)
$appTitle = ('"AI\u63a1\u6398\u6a5f"' | ConvertFrom-Json)

function Get-UnicodeText {
    param([Parameter(Mandatory)] [string]$EscapedText)
    return ('"' + $EscapedText + '"' | ConvertFrom-Json)
}

function Read-ArgumentValue {
    param([string]$Name, [string]$Default)
    for ($index = 0; $index -lt $scriptArguments.Count - 1; $index++) {
        if ($scriptArguments[$index] -eq $Name) { return [string]$scriptArguments[$index + 1] }
    }
    return $Default
}

$scene = Read-ArgumentValue '--fixture' 'overview'
$windowTitle = Read-ArgumentValue '--window-title' $appTitle
$width = [int](Read-ArgumentValue '--window-width' '820')
$height = [int](Read-ArgumentValue '--window-height' '640')

$form = [Windows.Forms.Form]::new()
$form.Text = $windowTitle
$form.ClientSize = [Drawing.Size]::new($width, $height)
$form.MinimumSize = [Drawing.Size]::new(320, 360)
$form.StartPosition = [Windows.Forms.FormStartPosition]::CenterScreen
$form.BackColor = [Drawing.Color]::FromArgb(242, 242, 247)
$form.Font = [Drawing.Font]::new('Segoe UI', 10)

$header = [Windows.Forms.Label]::new()
$header.Text = $appTitle + '  /  VISUAL TEST'
$header.Font = [Drawing.Font]::new('Segoe UI Semibold', 18)
$header.AutoSize = $true
$header.Location = [Drawing.Point]::new(28, 24)
$form.Controls.Add($header)

$status = [Windows.Forms.Label]::new()
$status.Text = $scene
$status.AutoSize = $true
$status.ForeColor = [Drawing.Color]::FromArgb(88, 86, 214)
$status.Location = [Drawing.Point]::new(31, 66)
$form.Controls.Add($status)

$content = [Windows.Forms.Panel]::new()
$content.Location = [Drawing.Point]::new(24, 104)
$content.Size = [Drawing.Size]::new([Math]::Max(260, $width - 48), [Math]::Max(210, $height - 136))
$content.Anchor = 'Top,Bottom,Left,Right'
$content.BackColor = [Drawing.Color]::White
$form.Controls.Add($content)

$title = [Windows.Forms.Label]::new()
$title.AutoSize = $true
$title.Font = [Drawing.Font]::new('Segoe UI Semibold', 16)
$title.Location = [Drawing.Point]::new(22, 20)
$content.Controls.Add($title)

$detail = [Windows.Forms.Label]::new()
$detail.AutoSize = $true
$detail.ForeColor = [Drawing.Color]::FromArgb(99, 99, 102)
$detail.Location = [Drawing.Point]::new(24, 62)
$content.Controls.Add($detail)

switch ($scene) {
    'settings' {
        $title.Text = Get-UnicodeText '\u8a2d\u5b9a'
        $detail.Text = Get-UnicodeText '\u30ad\u30fc\u5272\u308a\u5f53\u3066\u3068\u901a\u77e5'
        $rows = @(
            (Get-UnicodeText '\u958b\u59cb\u30ad\u30fc        F8'),
            (Get-UnicodeText '\u505c\u6b62\u30ad\u30fc        F9'),
            (Get-UnicodeText '\u66f4\u65b0\u901a\u77e5        \u30aa\u30f3')
        )
        foreach ($row in $rows) {
            $label = [Windows.Forms.Label]::new()
            $label.Text = $row
            $label.AutoSize = $true
            $label.Location = [Drawing.Point]::new(26, 100 + ($content.Controls.Count * 34))
            $content.Controls.Add($label)
        }
    }
    'action-sheet' {
        $title.Text = Get-UnicodeText '\u63a1\u6398\u3092\u958b\u59cb'
        $detail.Text = Get-UnicodeText '\u64cd\u4f5c\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044'
        $sheet = [Windows.Forms.Panel]::new()
        $sheet.Anchor = 'Bottom,Left,Right'
        $sheet.Location = [Drawing.Point]::new(18, [Math]::Max(92, $content.Height - 174))
        $sheet.Size = [Drawing.Size]::new([Math]::Max(220, $content.Width - 36), 150)
        $sheet.BackColor = [Drawing.Color]::FromArgb(235, 235, 240)
        $content.Controls.Add($sheet)
        $items = @(
            (Get-UnicodeText '\u9271\u77f3\u3092\u63a1\u6398\u3059\u308b'),
            (Get-UnicodeText '\u77f3\u3092\u6d17\u3046'),
            (Get-UnicodeText '\u30ad\u30e3\u30f3\u30bb\u30eb')
        )
        foreach ($item in $items) {
            $button = [Windows.Forms.Button]::new()
            $button.Text = $item
            $button.Size = [Drawing.Size]::new([Math]::Max(180, $sheet.Width - 24), 36)
            $button.Location = [Drawing.Point]::new(12, 10 + ($sheet.Controls.Count * 44))
            $sheet.Controls.Add($button)
        }
    }
    default {
        $title.Text = Get-UnicodeText '\u6e96\u5099\u5b8c\u4e86'
        $detail.Text = Get-UnicodeText 'FiveM\u3092\u958b\u3044\u3066\u958b\u59cb\u3067\u304d\u307e\u3059'
        $button = [Windows.Forms.Button]::new()
        $button.Text = Get-UnicodeText '\u958b\u59cb'
        $button.Size = [Drawing.Size]::new(120, 40)
        $button.Location = [Drawing.Point]::new(24, 104)
        $content.Controls.Add($button)
    }
}

[Windows.Forms.Application]::Run($form)
