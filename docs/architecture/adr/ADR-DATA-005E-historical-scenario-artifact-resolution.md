# ADR-DATA-005E: Historical Scenario Artifact Resolution

## Status

Accepted for the bounded `047R` Recovery PR.

## Context

R7 Beijing-Yanjiao v1 scenario artifacts use exact historical identities. Some R7-C
versions are intentional opaque legacy values such as `r7c.base_operations.v1`, not
new-binding semantic versions. A future superseding scenario package must not make a
historical Run or Replay silently select a latest replacement or lose its original
artifact inputs.

The active ScenarioPackage Authority contract remains the formal new-binding path. It
uses exact semantic versions, lifecycle snapshots, and its controlled command service.
Changing that contract to accommodate legacy historical strings would widen a formal
writer boundary for the wrong reason.

## Decision

Add a read-only historical artifact boundary with these rules:

1. The sealed R7 v1 bundle is source-revision-bound, content-addressed, and deeply
   immutable.
2. Resolution requires an exact tenant, package id, version, content digest, and
   artifact digest match. There is no latest, wildcard, alias, fallback, Store, Git,
   network, or runtime checkout behavior.
3. `RETIRED` means unavailable for new binding but readable for an exact historical
   resolution. The resolver always rejects a new-bind request.
4. The historical reference accepts safe opaque legacy version tokens only in the
   historical contract. It does not weaken the formal ScenarioPackageReference semver
   contract.
5. Historical resolution has no writer, no repository adapter, no direct Store path,
   no SettlementResult write, and no Replay write.
6. The student projection exposes only the historical read-only status and public
   identity. It excludes content/artifact digests, source revision, and private
   artifact data.

## Consequences

- R7 v1 Runs can remain reproducible after a later R7 v2 candidate supersedes the
  active source builders.
- Shanghai v2 or another future package cannot overwrite an R7 v1 exact resolution.
- The bundle is deliberately narrow. It is not Scenario Factory activation, Run
  binding, PostgreSQL persistence, durable recovery, or a second formal authority.
- New source, package, ParameterSet, PluginRelease, model, or seed binding work still
  requires a separate authority and runtime decision.

## Validation

The Recovery regression suite verifies exact resolution, tenant and digest fail-closed
behavior, retired-for-new-binding behavior, opaque R7-C historical version support,
Golden v1 settlement parity, student redaction, immutable records, and the absence of
Store/Git/writer behavior in the static bundle.
