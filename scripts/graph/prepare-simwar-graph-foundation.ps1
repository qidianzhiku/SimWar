[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "Medium")]
param(
  [Parameter()]
  [ValidateNotNullOrEmpty()]
  [string]$GraphRoot = "D:\codex\graph-infra",

  [Parameter()]
  [ValidateNotNullOrEmpty()]
  [string]$RepositoryUrl = "https://github.com/qidianzhiku/SimWar.git",

  [Parameter()]
  [ValidateNotNullOrEmpty()]
  [string]$MissionId = "SIMWAR-GRAPH-FOUNDATION-MANUAL",

  [Parameter()]
  [ValidateNotNullOrEmpty()]
  [string]$ProtectedWorkspace = "D:\codex\SimWar",

  [Parameter()]
  [string]$EvidenceRoot
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$remoteTrackingRef = "refs/remotes/origin/master"
$remoteHeadRef = "refs/heads/master"
$utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)

function Resolve-NormalizedPath {
  param(
    [Parameter(Mandatory)]
    [string]$Path
  )

  return [System.IO.Path]::GetFullPath($Path).TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
  )
}

function Test-PathWithin {
  param(
    [Parameter(Mandatory)]
    [string]$Candidate,

    [Parameter(Mandatory)]
    [string]$Root
  )

  $normalizedCandidate = Resolve-NormalizedPath -Path $Candidate
  $normalizedRoot = Resolve-NormalizedPath -Path $Root
  if ($normalizedCandidate.Equals($normalizedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $true
  }

  $rootPrefix = "$normalizedRoot$([System.IO.Path]::DirectorySeparatorChar)"
  return $normalizedCandidate.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)
}

function Invoke-Git {
  param(
    [Parameter(Mandatory)]
    [string[]]$Arguments
  )

  $output = & git @Arguments 2>&1
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    throw "git $($Arguments -join ' ') failed with exit code $exitCode`: $($output -join [Environment]::NewLine)"
  }

  Write-Output -NoEnumerate @($output)
}

function Assert-FullSha {
  param(
    [Parameter(Mandatory)]
    [string]$Sha
  )

  if ($Sha -notmatch "^[0-9a-f]{40}$") {
    throw "Expected a full lowercase Git SHA, received '$Sha'."
  }
}

function Write-AtomicJson {
  param(
    [Parameter(Mandatory)]
    [string]$Path,

    [Parameter(Mandatory)]
    [object]$Value
  )

  $temporaryPath = "$Path.tmp-$PID"
  [System.IO.File]::WriteAllText(
    $temporaryPath,
    ($Value | ConvertTo-Json -Depth 20),
    $utf8WithoutBom
  )
  Move-Item -LiteralPath $temporaryPath -Destination $Path -Force
}

function Read-OwnedLock {
  param(
    [Parameter(Mandatory)]
    [string]$LockPath
  )

  if (-not (Test-Path -LiteralPath $LockPath -PathType Leaf)) {
    return $null
  }

  $lock = Get-Content -Raw -LiteralPath $LockPath | ConvertFrom-Json
  $status = [string]$lock.lock_status
  if ($status.StartsWith("ACTIVE", [System.StringComparison]::OrdinalIgnoreCase) -and
      [string]$lock.mission_id -ne $MissionId) {
    throw "Graph foundation lock is active for mission '$($lock.mission_id)'."
  }

  return $lock
}

function Resolve-RemoteShaForDryRun {
  param(
    [Parameter(Mandatory)]
    [string]$AdminGitDir
  )

  if (Test-Path -LiteralPath $AdminGitDir -PathType Container) {
    $output = Invoke-Git -Arguments @(
      "--git-dir=$AdminGitDir",
      "rev-parse",
      $remoteTrackingRef
    )
    return ([string]$output[-1]).Trim()
  }

  $output = Invoke-Git -Arguments @("ls-remote", $RepositoryUrl, $remoteHeadRef)
  $line = ([string]$output[-1]).Trim()
  if ($line -notmatch "^([0-9a-f]{40})\s+") {
    throw "Unable to resolve $remoteHeadRef from $RepositoryUrl."
  }

  return $Matches[1]
}

try {
  $resolvedGraphRoot = Resolve-NormalizedPath -Path $GraphRoot
  $resolvedProtectedWorkspace = Resolve-NormalizedPath -Path $ProtectedWorkspace
  if (Test-PathWithin -Candidate $resolvedGraphRoot -Root $resolvedProtectedWorkspace) {
    throw "GraphRoot must not be the protected workspace or one of its descendants."
  }

  $adminGitDir = Join-Path $resolvedGraphRoot "repos\SimWar.git"
  $locksRoot = Join-Path $resolvedGraphRoot "locks"
  $lockPath = Join-Path $locksRoot "simwar-graph-foundation.lock.json"
  $registryRoot = Join-Path $resolvedGraphRoot "registry"
  $candidateRegistryPath = Join-Path $registryRoot "simwar-current-master.candidate.json"
  $existingLock = Read-OwnedLock -LockPath $lockPath

  if ($WhatIfPreference) {
    $dryRunSha = Resolve-RemoteShaForDryRun -AdminGitDir $adminGitDir
    Assert-FullSha -Sha $dryRunSha
    $dryRunShortSha = $dryRunSha.Substring(0, 12)
    $dryRunSource = Join-Path $resolvedGraphRoot "sources\SimWar\$dryRunShortSha"
    $dryRunGraphifyIndex = Join-Path $resolvedGraphRoot "indexes\graphify\SimWar\$dryRunShortSha"

    Write-Output "PREPARE_DRY_RUN_READY"
    [pscustomobject]@{
      candidate_registry = $candidateRegistryPath
      codegraph_index = Join-Path $dryRunSource ".codegraph"
      full_sha = $dryRunSha
      graph_root = $resolvedGraphRoot
      graphify_index = $dryRunGraphifyIndex
      lock_owner = if ($null -eq $existingLock) { $null } else { [string]$existingLock.mission_id }
      mission_id = $MissionId
      source_root = $dryRunSource
      write_performed = $false
    }
    exit 0
  }

  $requiredDirectories = @(
    $resolvedGraphRoot,
    (Join-Path $resolvedGraphRoot "repos"),
    (Join-Path $resolvedGraphRoot "sources\SimWar"),
    (Join-Path $resolvedGraphRoot "indexes\codegraph\SimWar"),
    (Join-Path $resolvedGraphRoot "indexes\graphify\SimWar"),
    (Join-Path $resolvedGraphRoot "evidence"),
    $registryRoot,
    $locksRoot
  )
  foreach ($directory in $requiredDirectories) {
    if (-not (Test-Path -LiteralPath $directory -PathType Container) -and
        $PSCmdlet.ShouldProcess($directory, "Create graph foundation directory")) {
      [void](New-Item -ItemType Directory -Path $directory)
    }
  }

  if ($null -eq $existingLock) {
    $lock = [ordered]@{
      schema_version = "1.0"
      mission_id = $MissionId
      process_id = $PID
      hostname = $env:COMPUTERNAME
      started_at = (Get-Date).ToUniversalTime().ToString("o")
      start_master_sha = "PENDING_FETCH"
      source_root = $null
      codegraph_index_root = $null
      graphify_index_root = $null
      lock_status = "ACTIVE_PREPARING"
    }
    $lockJson = $lock | ConvertTo-Json -Depth 10
    $stream = [System.IO.File]::Open(
      $lockPath,
      [System.IO.FileMode]::CreateNew,
      [System.IO.FileAccess]::Write,
      [System.IO.FileShare]::None
    )
    try {
      $writer = [System.IO.StreamWriter]::new($stream, $utf8WithoutBom)
      try {
        $writer.Write($lockJson)
      } finally {
        $writer.Dispose()
      }
    } finally {
      $stream.Dispose()
    }
    $existingLock = Get-Content -Raw -LiteralPath $lockPath | ConvertFrom-Json
  }

  if (-not (Test-Path -LiteralPath $adminGitDir -PathType Container)) {
    if ($PSCmdlet.ShouldProcess($adminGitDir, "Clone independent bare SimWar repository")) {
      [void](Invoke-Git -Arguments @("clone", "--bare", $RepositoryUrl, $adminGitDir))
    }
  }

  [void](Invoke-Git -Arguments @(
    "--git-dir=$adminGitDir",
    "config",
    "remote.origin.fetch",
    "+refs/heads/*:refs/remotes/origin/*"
  ))
  [void](Invoke-Git -Arguments @("--git-dir=$adminGitDir", "fetch", "--prune", "origin"))
  $shaOutput = Invoke-Git -Arguments @(
    "--git-dir=$adminGitDir",
    "rev-parse",
    $remoteTrackingRef
  )
  $fullSha = ([string]$shaOutput[-1]).Trim()
  Assert-FullSha -Sha $fullSha
  $shortSha = $fullSha.Substring(0, 12)

  $sourceRoot = Join-Path $resolvedGraphRoot "sources\SimWar\$shortSha"
  $codegraphIndexRoot = Join-Path $sourceRoot ".codegraph"
  $graphifyIndexRoot = Join-Path $resolvedGraphRoot "indexes\graphify\SimWar\$shortSha"
  $shaEvidenceRoot = if ([string]::IsNullOrWhiteSpace($EvidenceRoot)) {
    Join-Path $resolvedGraphRoot "evidence\$shortSha"
  } else {
    Resolve-NormalizedPath -Path $EvidenceRoot
  }

  $excludePath = Join-Path $adminGitDir "info\exclude"
  $existingExcludes = if (Test-Path -LiteralPath $excludePath -PathType Leaf) {
    @(Get-Content -LiteralPath $excludePath)
  } else {
    @()
  }
  $mergedExcludes = @($existingExcludes + @(".codegraph/", "graphify-out/") | Select-Object -Unique)
  [System.IO.File]::WriteAllLines($excludePath, $mergedExcludes, $utf8WithoutBom)

  if (Test-Path -LiteralPath $sourceRoot -PathType Container) {
    $existingHead = (
      Invoke-Git -Arguments @("-C", $sourceRoot, "rev-parse", "HEAD")
    )[-1].ToString().Trim()
    if ($existingHead -ne $fullSha) {
      throw "Existing managed source HEAD '$existingHead' does not match '$fullSha'."
    }
    $existingStatus = Invoke-Git -Arguments @(
      "-C",
      $sourceRoot,
      "status",
      "--porcelain",
      "--untracked-files=normal"
    )
    if (($existingStatus -join "").Length -gt 0) {
      throw "Existing managed source is not clean."
    }
  } elseif ($PSCmdlet.ShouldProcess($sourceRoot, "Create detached exact-SHA managed source")) {
    [void](Invoke-Git -Arguments @(
      "--git-dir=$adminGitDir",
      "worktree",
      "add",
      "--detach",
      $sourceRoot,
      $fullSha
    ))
  }

  foreach ($directory in @($graphifyIndexRoot, $shaEvidenceRoot)) {
    if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
      [void](New-Item -ItemType Directory -Path $directory)
    }
  }

  $existingLock.start_master_sha = $fullSha
  $existingLock.source_root = $sourceRoot
  $existingLock.codegraph_index_root = $codegraphIndexRoot
  $existingLock.graphify_index_root = $graphifyIndexRoot
  $existingLock.lock_status = "ACTIVE_PREPARED"
  $existingLock | Add-Member -NotePropertyName updated_at `
    -NotePropertyValue (Get-Date).ToUniversalTime().ToString("o") -Force
  Write-AtomicJson -Path $lockPath -Value $existingLock

  if (-not (Test-Path -LiteralPath $candidateRegistryPath -PathType Leaf)) {
    $candidate = [ordered]@{
      schema_version = "1.0"
      repository = "qidianzhiku/SimWar"
      remote_url = $RepositoryUrl
      ref = "origin/master"
      start_master_sha = $fullSha
      final_master_sha = $null
      full_sha = $fullSha
      short_sha = $shortSha
      source_root = $sourceRoot
      source_status = "READY"
      updated_at = (Get-Date).ToUniversalTime().ToString("o")
      mission_id = $MissionId
      registry_status = "CANDIDATE_NOT_CURRENT"
      codegraph = [ordered]@{
        status = "UNAVAILABLE"
        tool_version = "UNKNOWN_NOT_VERIFIED"
        index_root = $codegraphIndexRoot
        provenance_file = $null
        health_status = "FAIL"
      }
      graphify = [ordered]@{
        status = "UNAVAILABLE"
        tool_version = "UNKNOWN_NOT_VERIFIED"
        index_root = $graphifyIndexRoot
        provenance_file = $null
        health_status = "FAIL"
      }
      overall_status = "GRAPH_UNAVAILABLE_WITH_REPO_NATIVE_FALLBACK"
      evidence_root = $shaEvidenceRoot
    }
    Write-AtomicJson -Path $candidateRegistryPath -Value $candidate
  }

  Write-Output "PREPARE_READY"
  [pscustomobject]@{
    candidate_registry = $candidateRegistryPath
    codegraph_index = $codegraphIndexRoot
    full_sha = $fullSha
    graph_root = $resolvedGraphRoot
    graphify_index = $graphifyIndexRoot
    lock_path = $lockPath
    mission_id = $MissionId
    source_root = $sourceRoot
  }
  exit 0
} catch {
  [Console]::Error.WriteLine("GRAPH_FOUNDATION_PREPARE_FAILED: $($_.Exception.Message)")
  exit 1
}
