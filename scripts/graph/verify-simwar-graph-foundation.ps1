[CmdletBinding()]
param(
  [string]$GraphInfraRoot = "D:\codex\graph-infra",
  [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$ProtectedWorkspacePath = "D:\codex\SimWar",
  [string]$MissionId = "SIMWAR-L1-GRAPH-FOUNDATION-LITE-001",
  [string]$OwnerToken,
  [string]$RegistryPath,
  [string]$ExpectedSha,
  [switch]$SkipFetch,
  [switch]$PublishCurrent,
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

function Test-PositiveMetric {
  param($Value)
  return $Value -is [ValueType] -and [double]$Value -gt 0
}

function Get-CodeGraphMetrics {
  param([Parameter(Mandatory = $true)][string]$SourceRoot)

  $unknown = "UNKNOWN_NOT_EXPOSED_BY_TOOL"
  $metrics = [ordered]@{
    file_count = $unknown
    node_count = $unknown
    edge_count = $unknown
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

function Test-HealthQueries {
  param(
    [Parameter(Mandatory = $true)][ValidateSet("codegraph", "graphify")][string]$Tool,
    [Parameter(Mandatory = $true)]$Queries,
    [Parameter(Mandatory = $true)][string]$EvidenceRoot
  )

  $expectedNames = @("student-published-result", "settlement-result", "replay-non-overwrite", "golden-m1", "teacher-round-control", "direct-store-boundary", "json-runtime-authority", "shared-contract-usage")
  $expectedPattern = if ($Tool -eq "codegraph") { "Found [1-9][0-9]* symbols" } else { "NODE " }
  if (@($Queries).Count -ne $expectedNames.Count) {
    return $false
  }
  foreach ($expectedName in $expectedNames) {
    $matches = @($Queries | Where-Object { $_.name -eq $expectedName })
    if ($matches.Count -ne 1) {
      return $false
    }
    $query = $matches[0]
    $expectedEvidencePath = Join-Path $EvidenceRoot "$Tool-$expectedName.txt"
    if ($null -eq $query.exit_code -or $query.exit_code -ne 0 -or $query.status -ne "PASS" -or [string]::IsNullOrWhiteSpace($query.evidence_file) -or [System.IO.Path]::GetFullPath($query.evidence_file) -ne $expectedEvidencePath -or [string]::IsNullOrWhiteSpace($query.result_excerpt) -or $null -eq $query.temporary_path_detected -or $query.temporary_path_detected -ne $false) {
      return $false
    }
    if (-not (Test-Path -LiteralPath $expectedEvidencePath)) {
      return $false
    }
    $evidenceOutput = Get-Content -Raw -LiteralPath $expectedEvidencePath
    if ([string]::IsNullOrWhiteSpace($evidenceOutput) -or $evidenceOutput -notmatch $expectedPattern) {
      return $false
    }
  }
  return $true
}

function Get-LockRecord {
  param([Parameter(Mandatory = $true)][string]$LockPath)

  if (-not (Test-Path -LiteralPath $LockPath)) {
    return $null
  }
  try {
    return Get-Content -Raw -LiteralPath $LockPath | ConvertFrom-Json
  }
  catch {
    throw "GRAPH_LOCK_UNRESOLVED: lock at '$LockPath' is unreadable and was not removed"
  }
}

function Test-ActiveLock {
  param($LockRecord)

  if ($null -eq $LockRecord -or $LockRecord.lock_status -ne "ACTIVE" -or $null -eq $LockRecord.process_id) {
    return $false
  }
  return $null -ne (Get-Process -Id ([int]$LockRecord.process_id) -ErrorAction SilentlyContinue)
}

function Fail-Verification {
  param([Parameter(Mandatory = $true)][string]$Message)
  Write-Output "GRAPH_BROKEN: $Message"
  exit 1
}

try {
  $GraphInfraRoot = [System.IO.Path]::GetFullPath($GraphInfraRoot)
  $RepositoryRoot = (Resolve-Path -LiteralPath $RepositoryRoot).Path
  $fixedProtectedWorkspacePath = [System.IO.Path]::GetFullPath("D:\codex\SimWar")
  $additionalProtectedWorkspacePath = [System.IO.Path]::GetFullPath($ProtectedWorkspacePath)
  $protectedWorkspacePaths = @($fixedProtectedWorkspacePath, $additionalProtectedWorkspacePath) | Sort-Object -Unique
  if ($PublishCurrent -and $SkipFetch) {
    Fail-Verification "current registry publication requires a fresh origin fetch"
  }
  if (Test-PathOverlap -FirstPath $GraphInfraRoot -SecondPath $RepositoryRoot) {
    Fail-Verification "GraphInfraRoot must not overlap the development or protected workspace"
  }
  foreach ($protectedPath in $protectedWorkspacePaths) {
    if ((Test-PathOverlap -FirstPath $GraphInfraRoot -SecondPath $protectedPath) -or (Test-PathOverlap -FirstPath $RepositoryRoot -SecondPath $protectedPath)) {
      Fail-Verification "GraphInfraRoot and RepositoryRoot must not overlap a protected workspace"
    }
  }
  $repositoryOrigin = Get-GitOutput -Path $RepositoryRoot -Arguments @("remote", "get-url", "origin")
  if ((Normalize-RemoteUrl -Url $repositoryOrigin) -ne (Normalize-RemoteUrl -Url "https://github.com/qidianzhiku/SimWar.git")) {
    Fail-Verification "RepositoryRoot origin is not the official SimWar remote"
  }
  $lockPath = Join-Path $GraphInfraRoot "locks\simwar-graph-foundation.lock.json"
  $lockRecord = Get-LockRecord -LockPath $lockPath
  $lockIsOwned = $null -ne $lockRecord -and $lockRecord.mission_id -eq $MissionId -and
    -not [string]::IsNullOrWhiteSpace($OwnerToken) -and $lockRecord.owner_token -eq $OwnerToken
  if ((Test-ActiveLock -LockRecord $lockRecord) -and -not $lockIsOwned) {
    Write-Output "GRAPH_LOCK_ACTIVE: another execution owns '$lockPath'"
    exit 1
  }
  if ($null -ne $lockRecord -and -not $lockIsOwned) {
    Write-Output "GRAPH_LOCK_UNRESOLVED: lock is not owned by this execution and was not removed"
    exit 1
  }

  if ([string]::IsNullOrWhiteSpace($RegistryPath)) {
    $RegistryPath = Join-Path $GraphInfraRoot "registry\simwar-current-master.candidate.json"
  }
  $RegistryPath = [System.IO.Path]::GetFullPath($RegistryPath)
  if (-not (Test-ManagedPath -Path $RegistryPath -Root $GraphInfraRoot)) {
    Fail-Verification "registry path is outside the managed graph-infra root"
  }
  if (-not (Test-Path -LiteralPath $RegistryPath)) {
    Fail-Verification "registry does not exist at '$RegistryPath'"
  }

  $registry = Get-Content -Raw -LiteralPath $RegistryPath | ConvertFrom-Json
  if ([string]::IsNullOrWhiteSpace($registry.full_sha) -or [string]::IsNullOrWhiteSpace($registry.source_root)) {
    Fail-Verification "registry is missing full_sha or source_root"
  }
  if (-not [string]::IsNullOrWhiteSpace($ExpectedSha) -and $registry.full_sha -ne $ExpectedSha) {
    Fail-Verification "registry SHA '$($registry.full_sha)' does not match ExpectedSha '$ExpectedSha'"
  }
  if (-not (Test-ManagedPath -Path $registry.source_root -Root $GraphInfraRoot)) {
    Fail-Verification "source_root is outside the managed graph-infra root"
  }
  if ([string]::IsNullOrWhiteSpace($registry.graph_evidence_root) -or -not (Test-ManagedPath -Path $registry.graph_evidence_root -Root $GraphInfraRoot)) {
    Fail-Verification "graph_evidence_root is outside the managed graph-infra root"
  }
  if ([string]::IsNullOrWhiteSpace($registry.evidence_root) -or (Test-PathOverlap -FirstPath $registry.evidence_root -SecondPath $RepositoryRoot)) {
    Fail-Verification "evidence_root overlaps the development or protected workspace"
  }
  foreach ($protectedPath in $protectedWorkspacePaths) {
    if (Test-PathOverlap -FirstPath $registry.evidence_root -SecondPath $protectedPath) {
      Fail-Verification "evidence_root overlaps a protected workspace"
    }
  }
  $shortSha = $registry.full_sha.Substring(0, 12)
  $expectedSourceRoot = Join-Path $GraphInfraRoot "sources\SimWar\$shortSha"
  $expectedCodeGraphRoot = Join-Path $expectedSourceRoot ".codegraph"
  $expectedGraphifyRoot = Join-Path $GraphInfraRoot "indexes\graphify\SimWar\$shortSha"
  $expectedGraphifyFile = Join-Path $expectedGraphifyRoot "graphify-out\graph.json"
  $expectedGraphEvidenceRoot = Join-Path $GraphInfraRoot "evidence\$shortSha"
  $expectedCodeGraphProvenance = Join-Path $expectedGraphEvidenceRoot "codegraph-provenance.json"
  $expectedGraphifyProvenance = Join-Path $expectedGraphEvidenceRoot "graphify-provenance.json"
  $expectedGraphHealth = Join-Path $expectedGraphEvidenceRoot "graph-health.json"
  if ($registry.source_root -ne $expectedSourceRoot -or $registry.codegraph.index_root -ne $expectedCodeGraphRoot -or $registry.graphify.index_root -ne $expectedGraphifyRoot -or $registry.graphify.graph_file -ne $expectedGraphifyFile -or $registry.graph_evidence_root -ne $expectedGraphEvidenceRoot -or $registry.codegraph.provenance_file -ne $expectedCodeGraphProvenance -or $registry.graphify.provenance_file -ne $expectedGraphifyProvenance -or $registry.resource_lock -ne $lockPath) {
    Fail-Verification "registry managed paths do not match the exact SHA layout"
  }
  if (-not (Test-Path -LiteralPath $registry.source_root)) {
    Fail-Verification "source_root is missing"
  }

  $sourceHead = Get-GitOutput -Path $registry.source_root -Arguments @("rev-parse", "HEAD")
  $sourceStatus = Get-GitOutput -Path $registry.source_root -Arguments @("status", "--short")
  if ($sourceHead -ne $registry.full_sha) {
    Fail-Verification "source HEAD '$sourceHead' does not match registry SHA '$($registry.full_sha)'"
  }
  if ($sourceStatus -ne "") {
    Fail-Verification "managed source is not clean"
  }
  $sourceRemote = Get-GitOutput -Path $registry.source_root -Arguments @("remote", "get-url", "origin")
  if ((Normalize-RemoteUrl -Url $sourceRemote) -ne (Normalize-RemoteUrl -Url "https://github.com/qidianzhiku/SimWar.git")) {
    Fail-Verification "managed source origin is not the official SimWar remote"
  }

  foreach ($provenancePath in @($registry.codegraph.provenance_file, $registry.graphify.provenance_file)) {
    if ([string]::IsNullOrWhiteSpace($provenancePath) -or -not (Test-Path -LiteralPath $provenancePath)) {
      Fail-Verification "required provenance file is missing"
    }
  }
  $graphHealthPath = $expectedGraphHealth
  if (-not (Test-Path -LiteralPath $graphHealthPath)) {
    Fail-Verification "graph health evidence is missing"
  }
  $codeGraphProvenance = Get-Content -Raw -LiteralPath $registry.codegraph.provenance_file | ConvertFrom-Json
  $graphifyProvenance = Get-Content -Raw -LiteralPath $registry.graphify.provenance_file | ConvertFrom-Json
  $graphHealth = Get-Content -Raw -LiteralPath $graphHealthPath | ConvertFrom-Json
  if ($codeGraphProvenance.full_sha -ne $registry.full_sha -or $codeGraphProvenance.source_root -ne $registry.source_root -or $codeGraphProvenance.index_root -ne $registry.codegraph.index_root -or $codeGraphProvenance.status -ne $registry.codegraph.status) {
    Fail-Verification "CodeGraph provenance does not match the registry"
  }
  if ($graphifyProvenance.full_sha -ne $registry.full_sha -or $graphifyProvenance.source_root -ne $registry.source_root -or $graphifyProvenance.index_root -ne $registry.graphify.index_root -or $graphifyProvenance.status -ne $registry.graphify.status) {
    Fail-Verification "Graphify provenance does not match the registry"
  }
  if ($graphHealth.full_sha -ne $registry.full_sha -or $graphHealth.source_root -ne $registry.source_root) {
    Fail-Verification "graph health evidence does not match the registry"
  }
  if ($graphHealth.codegraph.status -ne $registry.codegraph.health_status -or $graphHealth.graphify.status -ne $registry.graphify.health_status) {
    Fail-Verification "graph health statuses do not match the registry"
  }
  if ($registry.codegraph.status -eq "READY" -and ($registry.codegraph.health_status -ne "PASS" -or -not (Test-HealthQueries -Tool "codegraph" -Queries $graphHealth.codegraph.queries -EvidenceRoot $registry.evidence_root))) {
    Fail-Verification "CodeGraph READY state lacks the complete passing health-query catalog"
  }
  if ($registry.graphify.status -eq "READY" -and ($registry.graphify.health_status -ne "PASS" -or -not (Test-HealthQueries -Tool "graphify" -Queries $graphHealth.graphify.queries -EvidenceRoot $registry.evidence_root))) {
    Fail-Verification "Graphify READY state lacks the complete passing health-query catalog"
  }

  if ($registry.codegraph.status -eq "READY" -and -not (Test-Path -LiteralPath $registry.codegraph.index_root)) {
    Fail-Verification "CodeGraph is marked READY but its index root is missing"
  }
  if ($registry.graphify.status -eq "READY" -and (-not (Test-Path -LiteralPath $registry.graphify.index_root) -or -not (Test-Path -LiteralPath $registry.graphify.graph_file))) {
    Fail-Verification "Graphify is marked READY but its index root or graph file is missing"
  }
  if ($registry.codegraph.status -eq "READY") {
    $liveCodeGraphMetrics = Get-CodeGraphMetrics -SourceRoot $registry.source_root
    if (-not (Test-PositiveMetric $liveCodeGraphMetrics.file_count) -or -not (Test-PositiveMetric $liveCodeGraphMetrics.node_count) -or -not (Test-PositiveMetric $liveCodeGraphMetrics.edge_count)) {
      Fail-Verification "CodeGraph READY state does not have positive live metrics"
    }
    if ($liveCodeGraphMetrics.file_count -ne $codeGraphProvenance.file_count -or $liveCodeGraphMetrics.node_count -ne $codeGraphProvenance.node_count -or $liveCodeGraphMetrics.edge_count -ne $codeGraphProvenance.edge_count) {
      Fail-Verification "CodeGraph live metrics do not match provenance"
    }
  }
  if ($registry.graphify.status -eq "READY") {
    if (-not (Test-GraphifyGraph -GraphPath $registry.graphify.graph_file)) {
      Fail-Verification "Graphify READY state does not contain a valid non-empty graph"
    }
    $liveGraphifyMetrics = Get-GraphifyMetrics -GraphPath $registry.graphify.graph_file
    if (-not (Test-PositiveMetric $liveGraphifyMetrics.node_count) -or -not (Test-PositiveMetric $liveGraphifyMetrics.edge_count)) {
      Fail-Verification "Graphify READY state does not have positive live metrics"
    }
    if ($liveGraphifyMetrics.node_count -ne $graphifyProvenance.node_count -or $liveGraphifyMetrics.edge_count -ne $graphifyProvenance.edge_count) {
      Fail-Verification "Graphify live metrics do not match provenance"
    }
  }

  if (-not $SkipFetch) {
    Get-GitOutput -Path $RepositoryRoot -Arguments @("fetch", "origin", "+refs/heads/master:refs/remotes/origin/master") | Out-Null
  }
  $finalMasterSha = Get-GitOutput -Path $RepositoryRoot -Arguments @("rev-parse", "origin/master")
  if ($finalMasterSha -ne $registry.full_sha) {
    $result = [ordered]@{
      status = "GRAPH_STALE_FOR_CURRENT_MASTER"
      start_master_sha = $registry.start_master_sha
      graph_sha = $registry.full_sha
      final_master_sha = $finalMasterSha
      registry_path = $RegistryPath
      published = $false
    }
    $result | ConvertTo-Json -Depth 4
    exit 0
  }

  $codeGraphReady = $registry.codegraph.status -eq "READY" -and $registry.codegraph.health_status -eq "PASS"
  $graphifyReady = $registry.graphify.status -eq "READY" -and $registry.graphify.health_status -eq "PASS"
  $bothReady = $codeGraphReady -and $graphifyReady
  $anyAvailable = $codeGraphReady -or $graphifyReady
  $status = if ($bothReady) { "GRAPH_EXACT_READY" } elseif ($anyAvailable) { "GRAPH_PARTIAL_READY" } else { "GRAPH_UNAVAILABLE_WITH_REPO_NATIVE_FALLBACK" }

  $registry | Add-Member -NotePropertyName final_master_sha -NotePropertyValue $finalMasterSha -Force
  $registry | Add-Member -NotePropertyName moving_master_status -NotePropertyValue "START_EQUALS_FINAL" -Force
  $registry | Add-Member -NotePropertyName overall_status -NotePropertyValue $status -Force
  $registry | Add-Member -NotePropertyName updated_at -NotePropertyValue (Get-UtcTimestamp) -Force
  Write-AtomicJson -Path $RegistryPath -Value $registry

  $publishedPath = $null
  $lockRemoved = $false
  if ($PublishCurrent) {
    if (-not $lockIsOwned) {
      Fail-Verification "current registry publication requires an existing lock owned by this execution"
    }
    if ($lockRecord.start_master_sha -ne $registry.full_sha -or $lockRecord.source_root -ne $registry.source_root -or $lockRecord.codegraph_index_root -ne $registry.codegraph.index_root -or $lockRecord.graphify_index_root -ne $registry.graphify.index_root) {
      Fail-Verification "owned lock does not bind to the registry SHA and managed paths"
    }
    if ($status -eq "GRAPH_UNAVAILABLE_WITH_REPO_NATIVE_FALLBACK") {
      Fail-Verification "a fully unavailable graph baseline cannot be published as current"
    }
    $publishedPath = Join-Path $GraphInfraRoot "registry\simwar-current-master.json"
    Write-AtomicJson -Path $publishedPath -Value $registry -KeepBackup
    $registryDigest = (Get-FileHash -Algorithm SHA256 -LiteralPath $publishedPath).Hash.ToLowerInvariant()
    $publishEvidence = [ordered]@{
      published_at = Get-UtcTimestamp
      registry_path = $publishedPath
      registry_sha256 = $registryDigest
      final_master_sha = $finalMasterSha
      status = $status
    }
    Write-AtomicJson -Path (Join-Path $registry.evidence_root "registry-publish.json") -Value $publishEvidence
  }

  if ($ReleaseOwnedLock -and $null -ne $lockRecord) {
    if (-not $lockIsOwned) {
      throw "GRAPH_LOCK_OWNERSHIP_LOST: refusing to remove a lock not created by this execution"
    }
    Remove-Item -LiteralPath $lockPath -Force
    $lockRemoved = $true
  }

  [ordered]@{
    status = $status
    start_master_sha = $registry.start_master_sha
    final_master_sha = $finalMasterSha
    source_root = $registry.source_root
    registry_path = $RegistryPath
    published_registry_path = $publishedPath
    lock_released = $lockRemoved
  } | ConvertTo-Json -Depth 6
  exit 0
}
catch {
  Write-Output "GRAPH_BROKEN: $($_.Exception.Message)"
  exit 1
}
