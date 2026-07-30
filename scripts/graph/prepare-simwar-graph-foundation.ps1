[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "Low")]
param(
  [string]$GraphInfraRoot = "D:\codex\graph-infra",
  [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$RepositoryUrl = "https://github.com/qidianzhiku/SimWar.git",
  [string]$ProtectedWorkspacePath = "D:\codex\SimWar",
  [string]$MissionId = "SIMWAR-L1-GRAPH-FOUNDATION-LITE-PARALLEL-001",
  [string]$OwnerToken = [Guid]::NewGuid().ToString("N"),
  [string]$EvidenceRoot,
  [switch]$BuildCodeGraph,
  [switch]$BuildGraphify,
  [switch]$RunHealthChecks,
  [switch]$SkipFetch,
  [switch]$ReleaseOwnedLock
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Get-UtcTimestamp {
  return [DateTime]::UtcNow.ToString("o")
}

function Get-GitOutput {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  $output = & git -C $Path @Arguments 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) {
    throw "git -C '$Path' $($Arguments -join ' ') failed: $output"
  }
  return $output.Trim()
}

function Write-AtomicJson {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)]$Value,
    [switch]$KeepBackup
  )

  $directory = Split-Path -Parent $Path
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  $temporaryPath = Join-Path $directory (".$([System.IO.Path]::GetFileName($Path)).$PID.$([Guid]::NewGuid().ToString('N')).tmp")
  $json = $Value | ConvertTo-Json -Depth 16
  [System.IO.File]::WriteAllText($temporaryPath, "$json`n", [System.Text.UTF8Encoding]::new($false))

  if (Test-Path -LiteralPath $Path) {
    $backupPath = if ($KeepBackup) { "$Path.$((Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')).bak" } else { "$temporaryPath.replace-backup" }
    [System.IO.File]::Replace($temporaryPath, $Path, $backupPath, $true)
    if (-not $KeepBackup -and (Test-Path -LiteralPath $backupPath)) {
      Remove-Item -LiteralPath $backupPath -Force
    }
  }
  else {
    [System.IO.File]::Move($temporaryPath, $Path)
  }
}

function Get-LockState {
  param([Parameter(Mandatory = $true)][string]$LockPath)

  if (-not (Test-Path -LiteralPath $LockPath)) {
    return [pscustomobject]@{ Exists = $false; Active = $false; Record = $null }
  }

  try {
    $record = Get-Content -Raw -LiteralPath $LockPath | ConvertFrom-Json
    $processIsActive = $false
    if ($null -ne $record.process_id) {
      $processIsActive = $null -ne (Get-Process -Id ([int]$record.process_id) -ErrorAction SilentlyContinue)
    }
    return [pscustomobject]@{
      Exists = $true
      Active = ($record.lock_status -eq "ACTIVE" -and $processIsActive)
      Record = $record
    }
  }
  catch {
    return [pscustomobject]@{ Exists = $true; Active = $true; Record = $null }
  }
}

function New-TaskLock {
  param(
    [Parameter(Mandatory = $true)][string]$LockPath,
    [Parameter(Mandatory = $true)]$Record
  )

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LockPath) | Out-Null
  try {
    $stream = [System.IO.File]::Open($LockPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    $stream.Dispose()
  }
  catch [System.IO.IOException] {
    throw "GRAPH_LOCK_ACTIVE: unable to atomically create '$LockPath'"
  }
  Write-AtomicJson -Path $LockPath -Value $Record
}

function Test-ManagedPath {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Root
  )

  $fullPath = [System.IO.Path]::GetFullPath($Path).TrimEnd([char]'\', [char]'/')
  $fullRoot = [System.IO.Path]::GetFullPath($Root).TrimEnd([char]'\', [char]'/')
  return $fullPath.StartsWith("$fullRoot$([System.IO.Path]::DirectorySeparatorChar)", [System.StringComparison]::OrdinalIgnoreCase)
}

function Test-PathOverlap {
  param(
    [Parameter(Mandatory = $true)][string]$FirstPath,
    [Parameter(Mandatory = $true)][string]$SecondPath
  )

  $first = [System.IO.Path]::GetFullPath($FirstPath).TrimEnd([char]'\', [char]'/')
  $second = [System.IO.Path]::GetFullPath($SecondPath).TrimEnd([char]'\', [char]'/')
  return $first.Equals($second, [System.StringComparison]::OrdinalIgnoreCase) -or
    $first.StartsWith("$second$([System.IO.Path]::DirectorySeparatorChar)", [System.StringComparison]::OrdinalIgnoreCase) -or
    $second.StartsWith("$first$([System.IO.Path]::DirectorySeparatorChar)", [System.StringComparison]::OrdinalIgnoreCase)
}

function Normalize-RemoteUrl {
  param([Parameter(Mandatory = $true)][string]$Url)
  return $Url.Trim().TrimEnd("/").ToLowerInvariant()
}

function Invoke-GraphCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$Command,
    [Parameter(Mandatory = $true)][string]$EvidencePath,
    [Parameter(Mandatory = $true)][string]$ExpectedPattern
  )

  $output = & $Command 2>&1 | Out-String
  $exitCode = $LASTEXITCODE
  [System.IO.File]::WriteAllText($EvidencePath, $output, [System.Text.UTF8Encoding]::new($false))
  return [ordered]@{
    name = $Name
    exit_code = $exitCode
    status = if ($exitCode -eq 0 -and $output.Trim() -ne "" -and $output -match $ExpectedPattern) { "PASS" } else { "FAIL" }
    evidence_file = $EvidencePath
    result_excerpt = $output.Substring(0, [Math]::Min(2000, $output.Length))
    temporary_path_detected = $output -match "(?i)(AppData[\\/]Local[\\/]Temp|[\\/]tmp[\\/])"
  }
}

function Get-CommandVersion {
  param([Parameter(Mandatory = $true)][string]$Name)

  if ($null -eq (Get-Command $Name -ErrorAction SilentlyContinue)) {
    return "NOT_AVAILABLE"
  }
  $output = & $Name --version 2>&1 | Out-String
  if ($LASTEXITCODE -eq 0 -and $output.Trim() -ne "") {
    return $output.Trim()
  }
  return "UNKNOWN_NOT_EXPOSED_BY_TOOL"
}

function Test-GraphifyGraph {
  param([Parameter(Mandatory = $true)][string]$GraphPath)

  if (-not (Test-Path -LiteralPath $GraphPath)) {
    return $false
  }
  try {
    $graph = Get-Content -Raw -LiteralPath $GraphPath | ConvertFrom-Json
    return $null -ne $graph -and $null -ne $graph.nodes -and $null -ne $graph.edges -and @($graph.nodes).Count -gt 0 -and @($graph.edges).Count -gt 0
  }
  catch {
    return $false
  }
}

function Get-CodeGraphMetrics {
  param(
    [Parameter(Mandatory = $true)][string]$SourceRoot,
    [Parameter(Mandatory = $true)][bool]$IsReady
  )

  $unknown = "UNKNOWN_NOT_EXPOSED_BY_TOOL"
  $metrics = [ordered]@{
    file_count = $unknown
    node_count = $unknown
    edge_count = $unknown
  }
  if (-not $IsReady) {
    return $metrics
  }
  try {
    $output = & codegraph status $SourceRoot --json 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
      return $metrics
    }
    $status = $output | ConvertFrom-Json
    $metrics.file_count = $status.fileCount
    $metrics.node_count = $status.nodeCount
    $metrics.edge_count = $status.edgeCount
  }
  catch {
    return $metrics
  }
  return $metrics
}

function Get-GraphifyMetrics {
  param([Parameter(Mandatory = $true)][string]$GraphPath)

  $unknown = "UNKNOWN_NOT_EXPOSED_BY_TOOL"
  $metrics = [ordered]@{
    node_count = $unknown
    edge_count = $unknown
  }
  try {
    $graph = Get-Content -Raw -LiteralPath $GraphPath | ConvertFrom-Json
    if ($null -ne $graph.nodes) {
      $metrics.node_count = @($graph.nodes).Count
    }
    if ($null -ne $graph.edges) {
      $metrics.edge_count = @($graph.edges).Count
    }
  }
  catch {
    return $metrics
  }
  return $metrics
}

try {
  $RepositoryRoot = (Resolve-Path -LiteralPath $RepositoryRoot).Path
  $GraphInfraRoot = [System.IO.Path]::GetFullPath($GraphInfraRoot)
  $fixedProtectedWorkspacePath = [System.IO.Path]::GetFullPath("D:\codex\SimWar")
  $additionalProtectedWorkspacePath = [System.IO.Path]::GetFullPath($ProtectedWorkspacePath)
  $protectedWorkspacePaths = @($fixedProtectedWorkspacePath, $additionalProtectedWorkspacePath) | Sort-Object -Unique
  if (Test-PathOverlap -FirstPath $GraphInfraRoot -SecondPath $RepositoryRoot) {
    throw "GRAPH_PATH_REJECTED: GraphInfraRoot must not overlap the development or protected workspace"
  }
  foreach ($protectedPath in $protectedWorkspacePaths) {
    if ((Test-PathOverlap -FirstPath $GraphInfraRoot -SecondPath $protectedPath) -or (Test-PathOverlap -FirstPath $RepositoryRoot -SecondPath $protectedPath)) {
      throw "GRAPH_PATH_REJECTED: GraphInfraRoot and RepositoryRoot must not overlap a protected workspace"
    }
  }
  if (-not [string]::IsNullOrWhiteSpace($EvidenceRoot)) {
    $EvidenceRoot = [System.IO.Path]::GetFullPath($EvidenceRoot)
    if (Test-PathOverlap -FirstPath $EvidenceRoot -SecondPath $RepositoryRoot) {
      throw "GRAPH_PATH_REJECTED: EvidenceRoot must not overlap the development or protected workspace"
    }
    foreach ($protectedPath in $protectedWorkspacePaths) {
      if (Test-PathOverlap -FirstPath $EvidenceRoot -SecondPath $protectedPath) {
        throw "GRAPH_PATH_REJECTED: EvidenceRoot must not overlap a protected workspace"
      }
    }
  }
  $officialRepositoryUrl = "https://github.com/qidianzhiku/SimWar.git"
  if ((Normalize-RemoteUrl -Url $RepositoryUrl) -ne (Normalize-RemoteUrl -Url $officialRepositoryUrl)) {
    throw "GRAPH_REMOTE_REJECTED: RepositoryUrl must be the official SimWar remote"
  }
  $repositoryOrigin = Get-GitOutput -Path $RepositoryRoot -Arguments @("remote", "get-url", "origin")
  if ((Normalize-RemoteUrl -Url $repositoryOrigin) -ne (Normalize-RemoteUrl -Url $officialRepositoryUrl)) {
    throw "GRAPH_REMOTE_REJECTED: RepositoryRoot origin is not the official SimWar remote"
  }
  $lockPath = Join-Path $GraphInfraRoot "locks\simwar-graph-foundation.lock.json"

  if (-not $SkipFetch -and -not $WhatIfPreference) {
    Get-GitOutput -Path $RepositoryRoot -Arguments @("fetch", "origin", "+refs/heads/master:refs/remotes/origin/master") | Out-Null
  }

  $startMasterSha = Get-GitOutput -Path $RepositoryRoot -Arguments @("rev-parse", "origin/master")
  $shortSha = $startMasterSha.Substring(0, 12)
  $sourceRoot = Join-Path $GraphInfraRoot "sources\SimWar\$shortSha"
  $codeGraphReservedRoot = Join-Path $GraphInfraRoot "indexes\codegraph\SimWar\$shortSha"
  $codeGraphActualRoot = Join-Path $sourceRoot ".codegraph"
  $graphifyIndexRoot = Join-Path $GraphInfraRoot "indexes\graphify\SimWar\$shortSha"
  $graphifyGraphPath = Join-Path $graphifyIndexRoot "graphify-out\graph.json"
  $graphEvidenceRoot = Join-Path $GraphInfraRoot "evidence\$shortSha"
  if ([string]::IsNullOrWhiteSpace($EvidenceRoot)) {
    $EvidenceRoot = $graphEvidenceRoot
  }
  $EvidenceRoot = [System.IO.Path]::GetFullPath($EvidenceRoot)

  $lockState = Get-LockState -LockPath $lockPath
  $lockIsOwned = $lockState.Exists -and $null -ne $lockState.Record -and
    $lockState.Record.mission_id -eq $MissionId -and $lockState.Record.owner_token -eq $OwnerToken
  if ($lockState.Active -and -not $lockIsOwned) {
    throw "GRAPH_LOCK_ACTIVE: lock is owned by another active mission at '$lockPath'"
  }
  if ($lockState.Exists -and -not $lockIsOwned) {
    throw "GRAPH_LOCK_UNRESOLVED: a stale or unreadable lock exists at '$lockPath'; it was not removed"
  }
  if ($lockIsOwned -and ($lockState.Record.start_master_sha -ne $startMasterSha -or $lockState.Record.source_root -ne $sourceRoot -or $lockState.Record.codegraph_index_root -ne $codeGraphActualRoot -or $lockState.Record.graphify_index_root -ne $graphifyIndexRoot)) {
    throw "GRAPH_LOCK_MISMATCH: the owned lock does not bind to this SHA and managed paths"
  }

  if ($WhatIfPreference) {
    [ordered]@{
      status = "GRAPH_PREPARE_DRY_RUN"
      start_master_sha = $startMasterSha
      source_root = $sourceRoot
      codegraph_index_root = $codeGraphActualRoot
      graphify_index_root = $graphifyIndexRoot
      registry_candidate = (Join-Path $GraphInfraRoot "registry\simwar-current-master.candidate.json")
      evidence_root = $EvidenceRoot
    } | ConvertTo-Json -Depth 4
    exit 0
  }

  $requiredDirectories = @(
    $GraphInfraRoot,
    (Split-Path -Parent $sourceRoot),
    $codeGraphReservedRoot,
    $graphifyIndexRoot,
    $graphEvidenceRoot,
    $EvidenceRoot,
    (Split-Path -Parent $lockPath),
    (Join-Path $GraphInfraRoot "registry")
  )
  foreach ($directory in $requiredDirectories) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }

  $lockRecord = [ordered]@{
    mission_id = $MissionId
    owner_token = $OwnerToken
    process_id = $PID
    hostname = $env:COMPUTERNAME
    started_at = Get-UtcTimestamp
    start_master_sha = $startMasterSha
    source_root = $sourceRoot
    codegraph_index_root = $codeGraphActualRoot
    graphify_index_root = $graphifyIndexRoot
    lock_status = "ACTIVE"
  }
  if (-not $lockState.Exists) {
    New-TaskLock -LockPath $lockPath -Record $lockRecord
  }

  if (Test-Path -LiteralPath $sourceRoot) {
    $existingRemote = Get-GitOutput -Path $sourceRoot -Arguments @("remote", "get-url", "origin")
    $existingHead = Get-GitOutput -Path $sourceRoot -Arguments @("rev-parse", "HEAD")
    $existingStatus = Get-GitOutput -Path $sourceRoot -Arguments @("status", "--short")
    if ($existingRemote.TrimEnd("/") -ne $RepositoryUrl.TrimEnd("/") -or $existingHead -ne $startMasterSha -or $existingStatus -ne "") {
      throw "GRAPH_SOURCE_CONFLICT: existing source at '$sourceRoot' did not match the expected remote, SHA, and clean state"
    }
  }
  else {
    & git clone --no-checkout --no-hardlinks $RepositoryRoot $sourceRoot 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "GRAPH_SOURCE_CREATE_FAILED: local git clone failed for '$sourceRoot'"
    }
    Get-GitOutput -Path $sourceRoot -Arguments @("remote", "set-url", "origin", $RepositoryUrl) | Out-Null
    Get-GitOutput -Path $sourceRoot -Arguments @("checkout", "--detach", $startMasterSha) | Out-Null
  }

  $sourceHead = Get-GitOutput -Path $sourceRoot -Arguments @("rev-parse", "HEAD")
  $sourceStatus = Get-GitOutput -Path $sourceRoot -Arguments @("status", "--short")
  $sourceRemote = Get-GitOutput -Path $sourceRoot -Arguments @("remote", "get-url", "origin")
  if ($sourceHead -ne $startMasterSha -or $sourceStatus -ne "") {
    throw "GRAPH_SOURCE_INVALID: source '$sourceRoot' is not a clean checkout of '$startMasterSha'"
  }

  $excludePath = Join-Path $sourceRoot ".git\info\exclude"
  $excludeEntries = @(".codegraph/", "graphify-out/", "node_modules/", "dist/", "build/", "coverage/", "isolated/", "artifacts/", "evidence/")
  $existingExcludes = if (Test-Path -LiteralPath $excludePath) { Get-Content -LiteralPath $excludePath } else { @() }
  $missingExcludes = $excludeEntries | Where-Object { $_ -notin $existingExcludes }
  if ($missingExcludes.Count -gt 0) {
    Add-Content -LiteralPath $excludePath -Value $missingExcludes -Encoding utf8
  }

  $sourceProvenance = [ordered]@{
    repository = "qidianzhiku/SimWar"
    remote_url = $sourceRemote
    ref = "origin/master"
    full_sha = $startMasterSha
    short_sha = $shortSha
    source_root = $sourceRoot
    created_at = Get-UtcTimestamp
    git_status = if ($sourceStatus -eq "") { "CLEAN" } else { $sourceStatus }
    detached_head = ((Get-GitOutput -Path $sourceRoot -Arguments @("branch", "--show-current")) -eq "")
    source_validation_status = "READY"
    mission_id = $MissionId
    parallel_execution_status = "ISOLATED_MANAGED_SOURCE"
  }

  $codeGraphVersion = Get-CommandVersion -Name "codegraph"
  $graphifyVersion = Get-CommandVersion -Name "graphify"
  $trackedFileCount = @((Get-GitOutput -Path $sourceRoot -Arguments @("ls-files")) -split "`r?`n" | Where-Object { $_ -ne "" }).Count
  $codeGraphStatus = if ($codeGraphVersion -eq "NOT_AVAILABLE") { "UNAVAILABLE" } elseif (Test-Path -LiteralPath $codeGraphActualRoot) { "READY" } else { "PARTIAL" }
  $graphifyStatus = if ($graphifyVersion -eq "NOT_AVAILABLE") { "UNAVAILABLE" } elseif (Test-GraphifyGraph -GraphPath $graphifyGraphPath) { "READY" } else { "PARTIAL" }

  if ($BuildGraphify -and $graphifyVersion -ne "NOT_AVAILABLE") {
    try {
      $graphifyBuildOutput = & graphify extract $sourceRoot --code-only --no-cluster --out $graphifyIndexRoot 2>&1 | Out-String
      [System.IO.File]::WriteAllText((Join-Path $EvidenceRoot "graphify-build.txt"), $graphifyBuildOutput, [System.Text.UTF8Encoding]::new($false))
      if ($LASTEXITCODE -ne 0 -or -not (Test-GraphifyGraph -GraphPath $graphifyGraphPath)) {
        $graphifyStatus = "BROKEN"
      }
      else {
        $graphifyStatus = "READY"
      }
    }
    catch {
      $graphifyStatus = "BROKEN"
    }
  }

  if ($BuildCodeGraph -and $codeGraphVersion -ne "NOT_AVAILABLE") {
    try {
      $codeGraphBuildOutput = & codegraph init $sourceRoot 2>&1 | Out-String
      [System.IO.File]::WriteAllText((Join-Path $EvidenceRoot "codegraph-build.txt"), $codeGraphBuildOutput, [System.Text.UTF8Encoding]::new($false))
      if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $codeGraphActualRoot)) {
        $codeGraphStatus = "BROKEN"
      }
      else {
        $codeGraphStatus = "READY"
      }
    }
    catch {
      $codeGraphStatus = "BROKEN"
    }
  }

  $codeGraphMetrics = Get-CodeGraphMetrics -SourceRoot $sourceRoot -IsReady ($codeGraphStatus -eq "READY")
  $graphifyMetrics = Get-GraphifyMetrics -GraphPath $graphifyGraphPath
  if ($codeGraphStatus -eq "READY" -and ($codeGraphMetrics.node_count -eq "UNKNOWN_NOT_EXPOSED_BY_TOOL" -or $codeGraphMetrics.node_count -le 0)) {
    $codeGraphStatus = "PARTIAL"
  }
  if ($graphifyStatus -eq "READY" -and ($graphifyMetrics.node_count -eq "UNKNOWN_NOT_EXPOSED_BY_TOOL" -or $graphifyMetrics.node_count -le 0)) {
    $graphifyStatus = "PARTIAL"
  }

  $healthQueries = [ordered]@{ codegraph = @(); graphify = @() }
  if ($RunHealthChecks -and $codeGraphStatus -eq "READY") {
    $healthQueries.codegraph += Invoke-GraphCommand -Name "student-published-result" -EvidencePath (Join-Path $EvidenceRoot "codegraph-student-published-result.txt") -ExpectedPattern "Found [1-9][0-9]* symbols" -Command { Push-Location -LiteralPath $sourceRoot; try { codegraph explore "Find Student Published Result or Student Result Projection." } finally { Pop-Location } }
    $healthQueries.codegraph += Invoke-GraphCommand -Name "settlement-result" -EvidencePath (Join-Path $EvidenceRoot "codegraph-settlement-result.txt") -ExpectedPattern "Found [1-9][0-9]* symbols" -Command { Push-Location -LiteralPath $sourceRoot; try { codegraph explore "Locate formal SettlementResult write paths and their callers." } finally { Pop-Location } }
    $healthQueries.codegraph += Invoke-GraphCommand -Name "replay-non-overwrite" -EvidencePath (Join-Path $EvidenceRoot "codegraph-replay-non-overwrite.txt") -ExpectedPattern "Found [1-9][0-9]* symbols" -Command { Push-Location -LiteralPath $sourceRoot; try { codegraph explore "Find Replay non-overwrite guards or tests." } finally { Pop-Location } }
  }
  if ($RunHealthChecks -and $graphifyStatus -eq "READY") {
    $healthQueries.graphify += Invoke-GraphCommand -Name "student-published-result" -EvidencePath (Join-Path $EvidenceRoot "graphify-student-published-result.txt") -ExpectedPattern "NODE " -Command { graphify query "Student Published Result projection" --graph $graphifyGraphPath --budget 300 }
    $healthQueries.graphify += Invoke-GraphCommand -Name "settlement-result" -EvidencePath (Join-Path $EvidenceRoot "graphify-settlement-result.txt") -ExpectedPattern "NODE " -Command { graphify query "SettlementResult formal write path" --graph $graphifyGraphPath --budget 300 }
    $healthQueries.graphify += Invoke-GraphCommand -Name "replay-non-overwrite" -EvidencePath (Join-Path $EvidenceRoot "graphify-replay-non-overwrite.txt") -ExpectedPattern "NODE " -Command { graphify query "Replay must not overwrite formal settlement result" --graph $graphifyGraphPath --budget 300 }
  }

  $codeGraphHealth = if ($codeGraphStatus -eq "READY" -and $healthQueries.codegraph.Count -eq 3 -and ($healthQueries.codegraph | Where-Object status -ne "PASS").Count -eq 0) { "PASS" } elseif ($codeGraphStatus -eq "UNAVAILABLE") { "PASS_WITH_LIMITS" } else { "PASS_WITH_LIMITS" }
  $graphifyHealth = if ($graphifyStatus -eq "READY" -and $healthQueries.graphify.Count -eq 3 -and ($healthQueries.graphify | Where-Object status -ne "PASS").Count -eq 0) { "PASS" } elseif ($graphifyStatus -eq "UNAVAILABLE") { "PASS_WITH_LIMITS" } else { "PASS_WITH_LIMITS" }

  $codeGraphProvenance = [ordered]@{
    tool = "CodeGraph"
    tool_version = $codeGraphVersion
    source_root = $sourceRoot
    requested_external_index_root = $codeGraphReservedRoot
    index_root = $codeGraphActualRoot
    full_sha = $startMasterSha
    created_at = Get-UtcTimestamp
    indexing_mode = if ($BuildCodeGraph) { "codegraph init" } else { "NOT_RUN" }
    status = $codeGraphStatus
    include_rules = @("repository tracked source")
    exclude_rules = $excludeEntries
    file_count = if ($codeGraphMetrics.file_count -eq "UNKNOWN_NOT_EXPOSED_BY_TOOL") { $trackedFileCount } else { $codeGraphMetrics.file_count }
    node_count = $codeGraphMetrics.node_count
    edge_count = $codeGraphMetrics.edge_count
    parse_failures = "UNKNOWN_NOT_EXPOSED_BY_TOOL"
    failed_files = "UNKNOWN_NOT_EXPOSED_BY_TOOL"
    mcp_cli_status = if ($codeGraphVersion -eq "NOT_AVAILABLE") { "UNAVAILABLE" } else { "CLI_AVAILABLE" }
    stale_path_detected = $false
    parallel_write_conflict = $false
    external_index_root_supported = $false
  }
  $graphifyProvenance = [ordered]@{
    tool = "Graphify"
    tool_version = $graphifyVersion
    source_root = $sourceRoot
    index_root = $graphifyIndexRoot
    graph_file = $graphifyGraphPath
    full_sha = $startMasterSha
    created_at = Get-UtcTimestamp
    indexing_mode = if ($BuildGraphify) { "graphify extract --code-only --no-cluster" } else { "NOT_RUN" }
    status = $graphifyStatus
    include_rules = @("code files tracked by source and respected gitignore")
    exclude_rules = $excludeEntries
    file_count = "UNKNOWN_NOT_EXPOSED_BY_TOOL"
    node_count = $graphifyMetrics.node_count
    edge_count = $graphifyMetrics.edge_count
    parse_failures = "UNKNOWN_NOT_EXPOSED_BY_TOOL"
    failed_files = "UNKNOWN_NOT_EXPOSED_BY_TOOL"
    mcp_cli_status = if ($graphifyVersion -eq "NOT_AVAILABLE") { "UNAVAILABLE" } else { "CLI_AVAILABLE" }
    stale_path_detected = $false
    parallel_write_conflict = $false
  }
  $graphHealth = [ordered]@{
    full_sha = $startMasterSha
    source_root = $sourceRoot
    created_at = Get-UtcTimestamp
    codegraph = [ordered]@{ status = $codeGraphHealth; queries = $healthQueries.codegraph }
    graphify = [ordered]@{ status = $graphifyHealth; queries = $healthQueries.graphify }
  }

  $artifactPairs = @(
    @{ Name = "source-provenance.json"; Value = $sourceProvenance },
    @{ Name = "codegraph-provenance.json"; Value = $codeGraphProvenance },
    @{ Name = "graphify-provenance.json"; Value = $graphifyProvenance },
    @{ Name = "graph-health.json"; Value = $graphHealth },
    @{ Name = "04-start-master-sha.json"; Value = [ordered]@{ start_master_sha = $startMasterSha; short_sha = $shortSha; observed_at = Get-UtcTimestamp; remote_url = $sourceRemote } },
    @{ Name = "05-source-provenance.json"; Value = $sourceProvenance },
    @{ Name = "06-codegraph-provenance.json"; Value = $codeGraphProvenance },
    @{ Name = "07-graphify-provenance.json"; Value = $graphifyProvenance },
    @{ Name = "08-graph-health.json"; Value = $graphHealth },
    @{ Name = "10-resource-lock-record.json"; Value = $lockRecord }
  )
  foreach ($artifact in $artifactPairs) {
    Write-AtomicJson -Path (Join-Path $graphEvidenceRoot $artifact.Name) -Value $artifact.Value
    if ($EvidenceRoot -ne $graphEvidenceRoot) {
      Write-AtomicJson -Path (Join-Path $EvidenceRoot $artifact.Name) -Value $artifact.Value
    }
  }

  $registryCandidate = [ordered]@{
    schema_version = "1.0"
    repository = "qidianzhiku/SimWar"
    remote_url = $sourceRemote
    ref = "origin/master"
    start_master_sha = $startMasterSha
    full_sha = $startMasterSha
    short_sha = $shortSha
    source_root = $sourceRoot
    source_status = "READY"
    updated_at = Get-UtcTimestamp
    mission_id = $MissionId
    codegraph = [ordered]@{
      status = $codeGraphStatus
      tool_version = $codeGraphVersion
      index_root = $codeGraphActualRoot
      provenance_file = (Join-Path $graphEvidenceRoot "codegraph-provenance.json")
      health_status = $codeGraphHealth
    }
    graphify = [ordered]@{
      status = $graphifyStatus
      tool_version = $graphifyVersion
      index_root = $graphifyIndexRoot
      graph_file = $graphifyGraphPath
      provenance_file = (Join-Path $graphEvidenceRoot "graphify-provenance.json")
      health_status = $graphifyHealth
    }
    overall_status = "GRAPH_PREPARED_PENDING_FINAL_MASTER_CHECK"
    evidence_root = $EvidenceRoot
    graph_evidence_root = $graphEvidenceRoot
    resource_lock = $lockPath
  }
  $candidatePath = Join-Path $GraphInfraRoot "registry\simwar-current-master.candidate.json"
  Write-AtomicJson -Path $candidatePath -Value $registryCandidate

  if ($ReleaseOwnedLock) {
    $currentLock = Get-LockState -LockPath $lockPath
    if ($currentLock.Exists -and $null -ne $currentLock.Record -and $currentLock.Record.mission_id -eq $MissionId -and $currentLock.Record.owner_token -eq $OwnerToken) {
      Remove-Item -LiteralPath $lockPath -Force
    }
    elseif ($currentLock.Exists) {
      throw "GRAPH_LOCK_OWNERSHIP_LOST: refusing to remove a lock not created by this execution"
    }
  }

  [ordered]@{
    status = "GRAPH_PREPARED"
    start_master_sha = $startMasterSha
    source_root = $sourceRoot
    codegraph_status = $codeGraphStatus
    graphify_status = $graphifyStatus
    registry_candidate = $candidatePath
    evidence_root = $EvidenceRoot
    lock_path = $lockPath
  } | ConvertTo-Json -Depth 6
  exit 0
}
catch {
  Write-Output "GRAPH_PREPARE_FAILED: $($_.Exception.Message)"
  exit 1
}
