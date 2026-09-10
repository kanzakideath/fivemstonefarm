#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ExecutablePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$executable = [System.IO.Path]::GetFullPath($ExecutablePath)
if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
    throw "Compiled executable was not found: $executable"
}

$temporaryBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$testRoot = [System.IO.Path]::GetFullPath((Join-Path $temporaryBase `
    ('ai-miner-stone-backfill-' + [Guid]::NewGuid().ToString('N'))))
$prefix = $temporaryBase.TrimEnd([System.IO.Path]::DirectorySeparatorChar) `
    + [System.IO.Path]::DirectorySeparatorChar
if (-not $testRoot.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Backfill test root escaped the operating-system temporary directory.'
}

$emptyInstallRoot = Join-Path $testRoot 'install-empty'
$emptyExecutable = Join-Path $emptyInstallRoot 'AI採掘機-empty-import-test.exe'
$emptyDiagnosticPath = Join-Path $emptyInstallRoot 'AI採掘機_診断.log'
$emptyMarkerPath = Join-Path $emptyInstallRoot 'AI採掘機_STONE履歴移行.v1.done'
$emptyLocalRoot = Join-Path $testRoot 'local-empty'
$emptyOutboxPath = Join-Path $emptyLocalRoot 'AI採掘機\metagame-outbox.tsv'
$installRoot = Join-Path $testRoot 'install-history'
$localRoot = Join-Path $testRoot 'local'
$testExecutable = Join-Path $installRoot 'AI採掘機-history-import-test.exe'
$diagnosticPath = Join-Path $installRoot 'AI採掘機_診断.log'
$recoveryDiagnosticPath = Join-Path $installRoot 'AI採掘機_STONE履歴復元.log'
$stateRoot = Join-Path $localRoot 'AI採掘機'
$outboxPath = Join-Path $stateRoot 'metagame-outbox.tsv'
$markerPath = Join-Path $installRoot 'AI採掘機_STONE履歴移行.v1.done'
$supportReceiptPath = Join-Path $installRoot 'AI採掘機_STONE履歴復元.v1.receipt'
$largeInstallRoot = Join-Path $testRoot 'install-large'
$largeExecutable = Join-Path $largeInstallRoot 'AI採掘機-large-import-test.exe'
$largeDiagnosticPath = Join-Path $largeInstallRoot 'AI採掘機_診断.log'
$largeLocalRoot = Join-Path $testRoot 'local-large'
$largeStateRoot = Join-Path $largeLocalRoot 'AI採掘機'
$largeOutboxPath = Join-Path $largeStateRoot 'metagame-outbox.tsv'
$largeMarkerPath = Join-Path $largeInstallRoot 'AI採掘機_STONE履歴移行.v1.done'
$previousLocalAppData = $env:LOCALAPPDATA

function Invoke-HistoryImportTestProcess {
    param(
        [Parameter(Mandatory)][string]$Phase,
        [Parameter(Mandatory)][string]$ProcessPath
    )

    # The bundle is a Windows GUI-subsystem executable. PowerShell's call
    # operator can return before such a process exits and leave LASTEXITCODE
    # unset, so use an explicit process handle for a real completion barrier.
    $process = Start-Process -FilePath $ProcessPath `
        -ArgumentList '--history-import-self-test' -PassThru -WindowStyle Hidden
    if (-not $process.WaitForExit(30000)) {
        try { $process.Kill() } catch { }
        throw "$Phase compiled history import timed out."
    }
    if ($process.ExitCode -ne 0) {
        throw "$Phase compiled history import failed with exit code $($process.ExitCode)."
    }
}

$fixture = @'
2099-09-10 12:00:00.000 | AI採掘機 v9.0.1 診断開始
2099-09-10 12:00:01.000 | FARM_REWARD_CONFIRMED id=1 mode=mining reason=weight_increase beforeWeight=1000 afterWeight=2000 revision=3
2099-09-10 12:00:01.010 | ACTION_PROGRESS_DONE mode=mining elapsed=5000
2099-09-10 12:00:02.000 | FARM_REWARD_CONFIRMED id=2 mode=washing reason=item_increase beforeWeight=2000 afterWeight=2000 revision=6
2099-09-10 12:00:02.010 | BG_CLICKED mode=washing
2099-09-10 12:00:03.000 | FARM_REWARD_CONFIRMED id=3 mode=gold reason=weight_increase beforeWeight=2000 afterWeight=3000 revision=9
'@

$currentExactId = 'mine_run_9002_1_1893456000000_mining_1_3'
$currentFixture = @"
2099-09-10 12:00:00.000 | AI採掘機 v9.0.2 診断開始
2099-09-10 12:00:01.000 | FARM_REWARD_CONFIRMED id=1 mode=mining reason=weight_increase beforeWeight=1000 afterWeight=2000 revision=3 eventId=$currentExactId eventAt=1893456000000
2099-09-10 12:00:01.010 | METAGAME_ACK command=MINING_SUCCESS id=$currentExactId remaining=0
2099-09-10 12:00:02.000 | FARM_REWARD_CONFIRMED id=2 mode=washing reason=item_increase beforeWeight=2000 afterWeight=2000 revision=6
"@
$supportDuplicateFixture = @'
2099-09-10 12:00:00.000 | AI採掘機 v9.0.1 診断開始
2099-09-10 12:00:01.000 | FARM_REWARD_CONFIRMED id=1 mode=mining reason=weight_increase beforeWeight=1000 afterWeight=2000 revision=3
'@
$supportAddedFixture = $supportDuplicateFixture + "`r`n" + @'
2099-09-10 12:00:03.000 | FARM_REWARD_CONFIRMED id=3 mode=washing reason=item_increase beforeWeight=2000 afterWeight=2000 revision=9
'@

try {
    New-Item -ItemType Directory `
        -Path $emptyInstallRoot, $installRoot, $largeInstallRoot, $emptyLocalRoot,
            $localRoot `
        -Force | Out-Null
    Copy-Item -LiteralPath $executable -Destination $emptyExecutable -Force
    Copy-Item -LiteralPath $executable -Destination $testExecutable -Force
    Copy-Item -LiteralPath $executable -Destination $largeExecutable -Force
    [System.IO.File]::WriteAllText($emptyDiagnosticPath,
        "2026-09-10 11:59:59.000 | AI採掘機 v9.0.1 診断開始`r`n" +
        "2026-09-10 11:59:59.010 | ACTION_PROGRESS_DONE mode=mining elapsed=5000`r`n",
        [System.Text.UTF8Encoding]::new($false))
    $env:LOCALAPPDATA = $emptyLocalRoot

    Invoke-HistoryImportTestProcess -Phase 'Empty-install' `
        -ProcessPath $emptyExecutable
    if (Test-Path -LiteralPath $emptyMarkerPath -PathType Leaf) {
        throw 'An empty new install incorrectly consumed its future migration eligibility.'
    }
    if (Test-Path -LiteralPath $emptyOutboxPath -PathType Leaf) {
        throw 'An empty new install unexpectedly created a progression outbox.'
    }
    [System.IO.File]::WriteAllText($emptyDiagnosticPath, $fixture,
        [System.Text.UTF8Encoding]::new($false))
    Invoke-HistoryImportTestProcess -Phase 'Empty-then-history' `
        -ProcessPath $emptyExecutable
    if (-not (Test-Path -LiteralPath $emptyMarkerPath -PathType Leaf) -or
        -not (Test-Path -LiteralPath $emptyOutboxPath -PathType Leaf)) {
        throw 'A later diagnostic copy into an initially empty install was not imported.'
    }
    $emptyProgressEvents = @(Get-Content -LiteralPath $emptyOutboxPath |
        Where-Object { $_ -match '^E\tMINING_SUCCESS\t' })
    if ($emptyProgressEvents.Count -ne 3) {
        throw 'The initially empty install did not recover all three later rewards.'
    }

    # A complete v9.0.2 row with an exact ACK is already counted, while the next
    # row torn immediately after revision is not valid legacy history. This first
    # pass intentionally imports zero events but completes the normal marker.
    [System.IO.File]::WriteAllText($diagnosticPath, $currentFixture,
        [System.Text.UTF8Encoding]::new($false))
    $env:LOCALAPPDATA = $localRoot
    Invoke-HistoryImportTestProcess -Phase 'Current-zero-import' `
        -ProcessPath $testExecutable
    if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
        throw 'Current-format zero import did not complete the normal marker.'
    }
    if (Test-Path -LiteralPath $outboxPath -PathType Leaf) {
        $unexpectedCurrentEvents = @(Get-Content -LiteralPath $outboxPath |
            Where-Object { $_ -match '^E\tMINING_SUCCESS\t' })
        if ($unexpectedCurrentEvents.Count -ne 0) {
            throw 'Current exact ACK or suffix-torn row was imported.'
        }
    }

    # Place a support export only after the normal marker exists. Its duplicate
    # confirmation must inherit the exact ACK found in the normal log across file
    # boundaries, import zero, and receive a content-specific independent receipt.
    [System.IO.File]::WriteAllText($recoveryDiagnosticPath,
        $supportDuplicateFixture, [System.Text.UTF8Encoding]::new($false))
    Invoke-HistoryImportTestProcess -Phase 'Support-after-normal-marker' `
        -ProcessPath $testExecutable
    if (-not (Test-Path -LiteralPath $supportReceiptPath -PathType Leaf)) {
        throw 'Support export did not receive its independent content receipt.'
    }
    if (Test-Path -LiteralPath $outboxPath -PathType Leaf) {
        $duplicateEvents = @(Get-Content -LiteralPath $outboxPath |
            Where-Object { $_ -match '^E\tMINING_SUCCESS\t' })
        if ($duplicateEvents.Count -ne 0) {
            throw 'Support/normal duplicate ignored the propagated exact ACK.'
        }
    }
    $firstReceiptHash = (Get-FileHash -LiteralPath $supportReceiptPath `
        -Algorithm SHA256).Hash
    Invoke-HistoryImportTestProcess -Phase 'Repeated-support' `
        -ProcessPath $testExecutable
    $secondReceiptHash = (Get-FileHash -LiteralPath $supportReceiptPath `
        -Algorithm SHA256).Hash
    if ($firstReceiptHash -cne $secondReceiptHash) {
        throw 'Identical support export unexpectedly changed its receipt.'
    }

    # A changed support export is a new receipt transaction. It may add only the
    # newly verified row, wrapped in one closed support session, and a repeat is
    # byte-for-byte idempotent.
    [System.IO.File]::WriteAllText($recoveryDiagnosticPath,
        $supportAddedFixture, [System.Text.UTF8Encoding]::new($false))
    Invoke-HistoryImportTestProcess -Phase 'Changed-support' `
        -ProcessPath $testExecutable
    if (-not (Test-Path -LiteralPath $outboxPath -PathType Leaf)) {
        throw 'Changed support export did not create its durable outbox.'
    }
    $lines = Get-Content -LiteralPath $outboxPath
    $progressEvents = @($lines | Where-Object { $_ -match '^E\tMINING_SUCCESS\t' })
    $sessionBegins = @($lines | Where-Object { $_ -match '^E\tSESSION_BEGIN\t' })
    $sessionEnds = @($lines | Where-Object { $_ -match '^E\tSESSION_END\t' })
    if ($progressEvents.Count -ne 1 -or $sessionBegins.Count -ne 1 -or
        $sessionEnds.Count -ne 1 -or
        -not ($progressEvents[0] -match '_washing_')) {
        throw 'Changed support export did not add exactly its one new verified reward.'
    }
    $supportSessionAt = [Int64](($sessionBegins[0] -split "`t")[3])
    $supportEventAt = [Int64](($progressEvents[0] -split "`t")[3])
    if ($supportEventAt -gt $supportSessionAt) {
        throw 'A future support timestamp was not clamped before Host replay.'
    }
    $changedHash = (Get-FileHash -LiteralPath $outboxPath -Algorithm SHA256).Hash
    Invoke-HistoryImportTestProcess -Phase 'Repeated-changed-support' `
        -ProcessPath $testExecutable
    $repeatedChangedHash = (Get-FileHash -LiteralPath $outboxPath `
        -Algorithm SHA256).Hash
    if ($changedHash -cne $repeatedChangedHash) {
        throw 'Repeated changed-support import changed the durable FIFO.'
    }

    # Three retained 5,000-line diagnostics can legitimately contain more than
    # 2,048 compact reward confirmations. Exercise the former failure boundary
    # with the compiled parser so those users are not locked out at startup.
    $largeFixture = [System.Text.StringBuilder]::new()
    [void]$largeFixture.AppendLine(
        '2026-09-10 13:00:00.000 | AI採掘機 v9.0.1 診断開始')
    $largeBase = [DateTime]::ParseExact('2026-09-10 13:00:00.000',
        'yyyy-MM-dd HH:mm:ss.fff', [Globalization.CultureInfo]::InvariantCulture)
    $modes = @('mining', 'washing', 'gold')
    foreach ($index in 1..2049) {
        $timestamp = $largeBase.AddMilliseconds($index).ToString(
            'yyyy-MM-dd HH:mm:ss.fff', [Globalization.CultureInfo]::InvariantCulture)
        $mode = $modes[($index - 1) % $modes.Count]
        [void]$largeFixture.AppendLine(
            "$timestamp | FARM_REWARD_CONFIRMED id=$index mode=$mode reason=item_increase beforeWeight=1000 afterWeight=1000 revision=$index")
    }
    [System.IO.File]::WriteAllText($largeDiagnosticPath, $largeFixture.ToString(),
        [System.Text.UTF8Encoding]::new($false))
    $env:LOCALAPPDATA = $largeLocalRoot
    Invoke-HistoryImportTestProcess -Phase 'Large-history' `
        -ProcessPath $largeExecutable
    if (-not (Test-Path -LiteralPath $largeMarkerPath -PathType Leaf)) {
        throw 'Large compiled history import did not create its completion marker.'
    }
    $largeEvents = @(Get-Content -LiteralPath $largeOutboxPath |
        Where-Object { $_ -match '^E\tMINING_SUCCESS\t' })
    if ($largeEvents.Count -ne 2049) {
        throw "Large compiled history import persisted $($largeEvents.Count) of 2049 rewards."
    }

    Write-Output 'Compiled STONE history backfill integration tests passed.'
}
finally {
    $env:LOCALAPPDATA = $previousLocalAppData
    if (Test-Path -LiteralPath $testRoot) {
        $resolvedRoot = [System.IO.Path]::GetFullPath($testRoot)
        if (-not $resolvedRoot.StartsWith($prefix,
                [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Refusing to remove a backfill test path outside the temporary directory.'
        }
        # Windows Defender/SmartScreen can retain a newly compiled executable for
        # a brief scan after the child has exited. Retry only this validated temp
        # root so a transient scanner lock cannot turn a passing test into a build
        # failure.
        $cleanupError = $null
        foreach ($cleanupAttempt in 1..10) {
            try {
                Remove-Item -LiteralPath $resolvedRoot -Recurse -Force -ErrorAction Stop
                $cleanupError = $null
                break
            }
            catch {
                $cleanupError = $_
                if ($cleanupAttempt -lt 10) {
                    Start-Sleep -Milliseconds 250
                }
            }
        }
        if ($cleanupError) {
            throw $cleanupError
        }
    }
}
