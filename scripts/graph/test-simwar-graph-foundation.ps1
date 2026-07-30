[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

function Assert-Condition {
  param(
    [Parameter(Mandatory = $true)]
    [bool]$Condition,
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  if (-not $Condition) {
    throw "ASSERTION_FAILED: $Message"
  }
}

function Invoke-External {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  $output = & $Command 2>&1 | Out-String
  [pscustomobject]@{
    ExitCode = $LASTEXITCODE
    Output = $output
  }
}

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\\..")).Path
$prepareScript = Join-Path $PSScriptRoot "prepare-simwar-graph-foundation.ps1"
$verifyScript = Join-Path $PSScriptRoot "verify-simwar-graph-foundation.ps1"
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("simwar-graph-foundation-test-" + [Guid]::NewGuid().ToString("N"))

try {
  $dryRun = Invoke-External {
    & $prepareScript -GraphInfraRoot $testRoot -RepositoryRoot $repositoryRoot -WhatIf
  }
  Assert-Condition ($dryRun.ExitCode -eq 0) "prepare dry-run must exit successfully"
  Assert-Condition ($dryRun.Output -match "GRAPH_PREPARE_DRY_RUN") "prepare dry-run must emit its stable status"
  Assert-Condition (-not (Test-Path -LiteralPath $testRoot)) "prepare dry-run must not create managed assets"

  $unsafeRoot = Join-Path $repositoryRoot "graph-foundation-assets"
  $unsafeDryRun = Invoke-External {
    & $prepareScript -GraphInfraRoot $unsafeRoot -RepositoryRoot $repositoryRoot -WhatIf
  }
  Assert-Condition ($unsafeDryRun.ExitCode -ne 0) "prepare must reject a graph root inside the development worktree"
  Assert-Condition ($unsafeDryRun.Output -match "GRAPH_PREPARE_FAILED") "unsafe graph root must emit GRAPH_PREPARE_FAILED"

  $protectedRootBypass = Invoke-External {
    & $prepareScript -GraphInfraRoot "D:\codex\SimWar" -RepositoryRoot $repositoryRoot -ProtectedWorkspacePath (Join-Path $testRoot "not-the-protected-root") -WhatIf
  }
  Assert-Condition ($protectedRootBypass.ExitCode -ne 0) "prepare must enforce the fixed protected workspace even when an additional path is supplied"
  Assert-Condition ($protectedRootBypass.Output -match "GRAPH_PREPARE_FAILED") "protected workspace bypass attempt must report GRAPH_PREPARE_FAILED"

  $missingRegistry = Invoke-External {
    & $verifyScript -GraphInfraRoot $testRoot -RepositoryRoot $repositoryRoot
  }
  Assert-Condition ($missingRegistry.ExitCode -ne 0) "verify must reject a missing registry"
  Assert-Condition ($missingRegistry.Output -match "GRAPH_BROKEN") "missing registry must report GRAPH_BROKEN"

  $ownerToken = "test-owner-token"
  $prepared = Invoke-External {
    & $prepareScript -GraphInfraRoot $testRoot -RepositoryRoot $repositoryRoot -OwnerToken $ownerToken -SkipFetch
  }
  Assert-Condition ($prepared.ExitCode -eq 0) "prepare must create an exact managed source from the local repository"
  Assert-Condition ($prepared.Output -match "GRAPH_PREPARED") "prepare must emit GRAPH_PREPARED"
  $preparedJson = $prepared.Output | ConvertFrom-Json
  $sourceRemote = (& git -C $preparedJson.source_root remote get-url origin).Trim()
  Assert-Condition ($sourceRemote -eq "https://github.com/qidianzhiku/SimWar.git") "managed source must retain the official origin URL"

  $skippedFetchPublication = Invoke-External {
    & $verifyScript -GraphInfraRoot $testRoot -RepositoryRoot $repositoryRoot -OwnerToken $ownerToken -SkipFetch -PublishCurrent
  }
  Assert-Condition ($skippedFetchPublication.ExitCode -ne 0) "verify must reject publication that skips the required fresh fetch"
  Assert-Condition ($skippedFetchPublication.Output -match "requires a fresh origin fetch") "skipped-fetch publication must report its specific rejection"

  $noGraphPublish = Invoke-External {
    & $verifyScript -GraphInfraRoot $testRoot -RepositoryRoot $repositoryRoot -OwnerToken $ownerToken -PublishCurrent
  }
  Assert-Condition ($noGraphPublish.ExitCode -ne 0) "verify must not publish a baseline with no validated graph asset"
  Assert-Condition ($noGraphPublish.Output -match "fully unavailable graph baseline") "no-graph publication must report the unavailable-graph rejection"
  Assert-Condition (-not (Test-Path -LiteralPath (Join-Path $testRoot "registry\\simwar-current-master.json"))) "no-graph publication must not create a current registry"

  $resumableGraphPath = Join-Path $testRoot ("indexes\\graphify\\SimWar\\$($preparedJson.start_master_sha.Substring(0, 12))\\graphify-out\\graph.json")
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resumableGraphPath) | Out-Null
  Set-Content -LiteralPath $resumableGraphPath -Value '{"nodes":[{"id":"test"}],"edges":[{"source":"test","target":"test","relation":"test"}]}' -Encoding utf8
  $resumed = Invoke-External {
    & $prepareScript -GraphInfraRoot $testRoot -RepositoryRoot $repositoryRoot -OwnerToken $ownerToken -SkipFetch
  }
  Assert-Condition ($resumed.ExitCode -eq 0) "prepare must resume an owned interrupted baseline"
  $resumedJson = $resumed.Output | ConvertFrom-Json
  Assert-Condition ($resumedJson.graphify_status -eq "READY") "prepare must recognize an existing Graphify graph without rebuilding it"

  $testRegistryPath = Join-Path $testRoot "registry\simwar-current-master.candidate.json"
  $testRegistry = Get-Content -Raw -LiteralPath $testRegistryPath | ConvertFrom-Json
  $testRegistry.graphify.health_status = "PASS"
  $testRegistry | ConvertTo-Json -Depth 16 | Set-Content -LiteralPath $testRegistryPath -Encoding utf8
  $testGraphHealthPath = Join-Path $testRoot ("evidence\$($preparedJson.start_master_sha.Substring(0, 12))\graph-health.json")
  $testGraphHealth = Get-Content -Raw -LiteralPath $testGraphHealthPath | ConvertFrom-Json
  $healthStatusMismatch = Invoke-External {
    & $verifyScript -GraphInfraRoot $testRoot -RepositoryRoot $repositoryRoot -OwnerToken $ownerToken -ExpectedSha $preparedJson.start_master_sha -SkipFetch
  }
  Assert-Condition ($healthStatusMismatch.ExitCode -ne 0) "verify must reject a registry READY/PASS claim that disagrees with graph health evidence"
  Assert-Condition ($healthStatusMismatch.Output -match "health statuses do not match") "health status mismatch must report its specific rejection"

  $testGraphHealth.graphify.status = "PASS"
  $testGraphHealth.graphify.queries = @(
    @{ name = "student-published-result"; exit_code = 0; status = "PASS"; evidence_file = (Join-Path (Split-Path -Parent $testGraphHealthPath) "graphify-student-published-result.txt"); result_excerpt = "NODE test"; temporary_path_detected = $false },
    @{ name = "settlement-result"; exit_code = 0; status = "PASS"; evidence_file = (Join-Path (Split-Path -Parent $testGraphHealthPath) "graphify-settlement-result.txt"); result_excerpt = "NODE test"; temporary_path_detected = $false },
    @{ name = "replay-non-overwrite"; exit_code = 0; status = "PASS"; evidence_file = (Join-Path (Split-Path -Parent $testGraphHealthPath) "graphify-replay-non-overwrite.txt"); result_excerpt = "NODE test"; temporary_path_detected = $false }
  )
  foreach ($query in $testGraphHealth.graphify.queries) {
    Set-Content -LiteralPath $query.evidence_file -Value "NODE test" -Encoding utf8
  }
  $testGraphHealth | ConvertTo-Json -Depth 16 | Set-Content -LiteralPath $testGraphHealthPath -Encoding utf8
  $validGraphIntegrity = Invoke-External {
    & $verifyScript -GraphInfraRoot $testRoot -RepositoryRoot $repositoryRoot -OwnerToken $ownerToken -ExpectedSha $preparedJson.start_master_sha -SkipFetch
  }
  Assert-Condition ($validGraphIntegrity.ExitCode -eq 0) "verify must accept a structurally valid READY Graphify asset with matching metrics"
  Set-Content -LiteralPath $resumableGraphPath -Value '{"nodes":[],"edges":[]}' -Encoding utf8
  $corruptGraphIntegrity = Invoke-External {
    & $verifyScript -GraphInfraRoot $testRoot -RepositoryRoot $repositoryRoot -OwnerToken $ownerToken -ExpectedSha $preparedJson.start_master_sha -SkipFetch
  }
  Assert-Condition ($corruptGraphIntegrity.ExitCode -ne 0) "verify must reject a READY Graphify asset whose live structure is empty"
  Assert-Condition ($corruptGraphIntegrity.Output -match "valid non-empty graph") "empty READY Graphify asset must report its live-integrity rejection"
  Set-Content -LiteralPath $resumableGraphPath -Value '{"nodes":[{"id":"test"}],"edges":[{"source":"test","target":"test","relation":"test"}]}' -Encoding utf8

  $indexed = Invoke-External {
    & $prepareScript -GraphInfraRoot $testRoot -RepositoryRoot $repositoryRoot -OwnerToken $ownerToken -SkipFetch -BuildCodeGraph
  }
  Assert-Condition ($indexed.ExitCode -eq 0) "prepare must build CodeGraph for an owned exact source"
  $codeGraphProvenance = Get-Content -Raw -LiteralPath (Join-Path $testRoot ("evidence\\$($preparedJson.start_master_sha.Substring(0, 12))\\codegraph-provenance.json")) | ConvertFrom-Json
  $graphifyProvenance = Get-Content -Raw -LiteralPath (Join-Path $testRoot ("evidence\\$($preparedJson.start_master_sha.Substring(0, 12))\\graphify-provenance.json")) | ConvertFrom-Json
  Assert-Condition ($codeGraphProvenance.node_count -is [ValueType]) "CodeGraph provenance must retain exposed node metrics"
  Assert-Condition ($graphifyProvenance.node_count -eq 1) "Graphify provenance must retain exposed graph node metrics"

  Remove-Item -LiteralPath (Join-Path $preparedJson.source_root ".codegraph") -Recurse -Force
  Remove-Item -LiteralPath (Split-Path -Parent $resumableGraphPath) -Recurse -Force
  $partial = Invoke-External {
    & $prepareScript -GraphInfraRoot $testRoot -RepositoryRoot $repositoryRoot -OwnerToken $ownerToken -SkipFetch
  }
  Assert-Condition ($partial.ExitCode -eq 0) "prepare must record removed indexes as partial rather than ready"

  & git -C $preparedJson.source_root remote set-url origin "https://example.invalid/not-simwar.git"
  $remoteMismatch = Invoke-External {
    & $verifyScript -GraphInfraRoot $testRoot -RepositoryRoot $repositoryRoot -OwnerToken $ownerToken -ExpectedSha $preparedJson.start_master_sha -SkipFetch
  }
  Assert-Condition ($remoteMismatch.ExitCode -ne 0) "verify must reject a managed source whose origin is not official"
  Assert-Condition ($remoteMismatch.Output -match "GRAPH_BROKEN") "remote mismatch must report GRAPH_BROKEN"
  & git -C $preparedJson.source_root remote set-url origin "https://github.com/qidianzhiku/SimWar.git"

  $verifiedPrepared = Invoke-External {
    & $verifyScript -GraphInfraRoot $testRoot -RepositoryRoot $repositoryRoot -OwnerToken $ownerToken -ExpectedSha $preparedJson.start_master_sha -SkipFetch -ReleaseOwnedLock
  }
  Assert-Condition ($verifiedPrepared.ExitCode -eq 0) "verify must retain an exact source when both graph assets are unavailable"
  Assert-Condition ($verifiedPrepared.Output -match "GRAPH_UNAVAILABLE_WITH_REPO_NATIVE_FALLBACK") "unbuilt tools must use the repository-native fallback status"

  $locklessPublish = Invoke-External {
    & $verifyScript -GraphInfraRoot $testRoot -RepositoryRoot $repositoryRoot -PublishCurrent
  }
  Assert-Condition ($locklessPublish.ExitCode -ne 0) "verify must reject publishing without an owned lock"
  Assert-Condition ($locklessPublish.Output -match "requires an existing lock owned by this execution") "lockless publication must report the missing-lock rejection"
  Assert-Condition (-not (Test-Path -LiteralPath (Join-Path $testRoot "registry\\simwar-current-master.json"))) "lockless verification must not create a current registry"

  New-Item -ItemType Directory -Force -Path (Join-Path $testRoot "locks") | Out-Null
  @{
    mission_id = "another-mission"
    process_id = $PID
    lock_status = "ACTIVE"
  } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $testRoot "locks\\simwar-graph-foundation.lock.json") -Encoding utf8

  $verifyActiveLock = Invoke-External {
    & $verifyScript -GraphInfraRoot $testRoot -RepositoryRoot $repositoryRoot
  }
  Assert-Condition ($verifyActiveLock.ExitCode -ne 0) "verify must reject an active lock"
  Assert-Condition ($verifyActiveLock.Output -match "GRAPH_LOCK_ACTIVE") "verify active lock must emit GRAPH_LOCK_ACTIVE"

  $activeLock = Invoke-External {
    & $prepareScript -GraphInfraRoot $testRoot -RepositoryRoot $repositoryRoot
  }
  Assert-Condition ($activeLock.ExitCode -ne 0) "prepare must reject an active lock owned by another mission"
  Assert-Condition ($activeLock.Output -match "GRAPH_LOCK_ACTIVE") "active lock must emit GRAPH_LOCK_ACTIVE"

  Write-Output "PASS: graph foundation executable checks"
}
finally {
  if (Test-Path -LiteralPath $testRoot) {
    Remove-Item -LiteralPath $testRoot -Recurse -Force
  }
}
