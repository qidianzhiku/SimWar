[CmdletBinding()]
param(
  [Parameter()]
  [ValidateNotNullOrEmpty()]
  [string]$GraphRoot = "D:\codex\graph-infra",

  [Parameter()]
  [string]$RegistryPath,

  [Parameter()]
  [string]$ExpectedMasterSha,

  [Parameter()]
  [string]$MissionId,

  [Parameter()]
  [switch]$AllowOwnedLock
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

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
    [string]$Sha,

    [Parameter(Mandatory)]
    [string]$Label
  )

  if ($Sha -notmatch "^[0-9a-f]{40}$") {
    throw "$Label must be a full lowercase Git SHA."
  }
}

function Stop-Broken {
  param(
    [Parameter(Mandatory)]
    [string]$Reason
  )

  Write-Output "GRAPH_BROKEN"
  [Console]::Error.WriteLine($Reason)
  exit 1
}

function Stop-Stale {
  param(
    [Parameter(Mandatory)]
    [string]$Reason
  )

  Write-Output "GRAPH_STALE_FOR_CURRENT_MASTER"
  [Console]::Error.WriteLine($Reason)
  exit 2
}

try {
  $resolvedGraphRoot = Resolve-NormalizedPath -Path $GraphRoot
  if ([string]::IsNullOrWhiteSpace($RegistryPath)) {
    $RegistryPath = Join-Path $resolvedGraphRoot "registry\simwar-current-master.json"
  }
  $resolvedRegistryPath = Resolve-NormalizedPath -Path $RegistryPath

  if (-not (Test-PathWithin -Candidate $resolvedRegistryPath -Root $resolvedGraphRoot)) {
    Stop-Broken -Reason "Registry path must be inside GraphRoot."
  }
  if (-not (Test-Path -LiteralPath $resolvedRegistryPath -PathType Leaf)) {
    Stop-Broken -Reason "Registry does not exist: $resolvedRegistryPath"
  }

  $registry = Get-Content -Raw -LiteralPath $resolvedRegistryPath | ConvertFrom-Json
  $registrySha = [string]$registry.full_sha
  Assert-FullSha -Sha $registrySha -Label "registry.full_sha"

  $sourceRoot = Resolve-NormalizedPath -Path ([string]$registry.source_root)
  $managedSourcesRoot = Join-Path $resolvedGraphRoot "sources\SimWar"
  if (-not (Test-PathWithin -Candidate $sourceRoot -Root $managedSourcesRoot)) {
    Stop-Broken -Reason "Managed source is outside GraphRoot sources boundary."
  }
  if (-not (Test-Path -LiteralPath $sourceRoot -PathType Container)) {
    Stop-Broken -Reason "Managed source does not exist: $sourceRoot"
  }

  $sourceHead = (
    Invoke-Git -Arguments @("-C", $sourceRoot, "rev-parse", "HEAD")
  )[-1].ToString().Trim()
  if ($sourceHead -ne $registrySha) {
    Stop-Broken -Reason "Registry SHA '$registrySha' does not match source HEAD '$sourceHead'."
  }

  $sourceStatus = Invoke-Git -Arguments @(
    "-C",
    $sourceRoot,
    "status",
    "--porcelain",
    "--untracked-files=normal"
  )
  if (($sourceStatus -join "").Length -gt 0) {
    Stop-Broken -Reason "Managed source is not clean."
  }

  foreach ($toolName in @("codegraph", "graphify")) {
    $tool = $registry.$toolName
    if ($null -eq $tool) {
      Stop-Broken -Reason "Registry is missing '$toolName'."
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$tool.provenance_file) -and
        -not (Test-Path -LiteralPath ([string]$tool.provenance_file) -PathType Leaf)) {
      Stop-Broken -Reason "$toolName provenance file is missing."
    }
  }

  if ($registry.PSObject.Properties.Name -contains "health_file") {
    if (-not [string]::IsNullOrWhiteSpace([string]$registry.health_file) -and
        -not (Test-Path -LiteralPath ([string]$registry.health_file) -PathType Leaf)) {
      Stop-Broken -Reason "Graph health evidence file is missing."
    }
  }

  $lockPath = Join-Path $resolvedGraphRoot "locks\simwar-graph-foundation.lock.json"
  if (Test-Path -LiteralPath $lockPath -PathType Leaf) {
    $lock = Get-Content -Raw -LiteralPath $lockPath | ConvertFrom-Json
    $lockStatus = [string]$lock.lock_status
    if ($lockStatus.StartsWith("ACTIVE", [System.StringComparison]::OrdinalIgnoreCase)) {
      $ownedLockAllowed = $AllowOwnedLock -and
        -not [string]::IsNullOrWhiteSpace($MissionId) -and
        [string]$lock.mission_id -eq $MissionId -and
        [string]$registry.mission_id -eq $MissionId
      if (-not $ownedLockAllowed) {
        Stop-Broken -Reason "An active graph foundation lock blocks verification."
      }
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($ExpectedMasterSha)) {
    Assert-FullSha -Sha $ExpectedMasterSha -Label "ExpectedMasterSha"
    if ($registrySha -ne $ExpectedMasterSha) {
      Stop-Stale -Reason "Registry SHA '$registrySha' does not match expected master '$ExpectedMasterSha'."
    }
  }

  $finalMasterSha = [string]$registry.final_master_sha
  if (-not [string]::IsNullOrWhiteSpace($finalMasterSha)) {
    Assert-FullSha -Sha $finalMasterSha -Label "registry.final_master_sha"
    if ($registrySha -ne $finalMasterSha) {
      Stop-Stale -Reason "Registry SHA '$registrySha' is stale for final master '$finalMasterSha'."
    }
  }
  if ([string]$registry.overall_status -eq "GRAPH_STALE_FOR_CURRENT_MASTER") {
    Stop-Stale -Reason "Registry explicitly records a stale exact-SHA baseline."
  }

  $codegraphReady = $false
  $codegraphStatus = [string]$registry.codegraph.status
  if ($codegraphStatus -eq "READY") {
    $codegraphRoot = Resolve-NormalizedPath -Path ([string]$registry.codegraph.index_root)
    if (-not (Test-PathWithin -Candidate $codegraphRoot -Root $sourceRoot)) {
      Stop-Broken -Reason "CodeGraph index must be inside the managed source for the current CLI contract."
    }
    if (-not (Test-Path -LiteralPath (Join-Path $codegraphRoot "codegraph.db") -PathType Leaf)) {
      Stop-Broken -Reason "CodeGraph database is missing."
    }
    $codegraphReady = [string]$registry.codegraph.health_status -eq "PASS"
  }

  $graphifyReady = $false
  $graphifyStatus = [string]$registry.graphify.status
  if ($graphifyStatus -in @("READY", "PARTIAL")) {
    $graphifyRoot = Resolve-NormalizedPath -Path ([string]$registry.graphify.index_root)
    $managedGraphifyRoot = Join-Path $resolvedGraphRoot "indexes\graphify\SimWar"
    if (-not (Test-PathWithin -Candidate $graphifyRoot -Root $managedGraphifyRoot)) {
      Stop-Broken -Reason "Graphify index is outside its managed root."
    }
    if (-not (Test-Path -LiteralPath (Join-Path $graphifyRoot "graphify-out\graph.json") -PathType Leaf)) {
      Stop-Broken -Reason "Graphify graph.json is missing."
    }
    $graphifyReady = [string]$registry.graphify.health_status -in @("PASS", "PASS_WITH_LIMITS")
  }

  if ($codegraphReady -and
      $graphifyReady -and
      $codegraphStatus -eq "READY" -and
      $graphifyStatus -eq "READY") {
    Write-Output "GRAPH_EXACT_READY"
    exit 0
  }

  if ($codegraphReady -or $graphifyReady) {
    Write-Output "GRAPH_PARTIAL_READY"
    exit 0
  }

  Write-Output "GRAPH_UNAVAILABLE_WITH_REPO_NATIVE_FALLBACK"
  exit 0
} catch {
  Stop-Broken -Reason "Graph foundation verification failed: $($_.Exception.Message)"
}
