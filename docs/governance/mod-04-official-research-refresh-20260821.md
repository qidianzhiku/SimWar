# MOD-04 Official Research Refresh — Governance Receipt

## Decision

`RESEARCH_READY_WITH_LIMITS`

This receipt closes the bounded MOD-04 research-refresh task from the V1.0
MOD/AGT plan. It does not close MOD-11, MOD-17, AGT-06, AGT-09 or AGT-10, and
does not authorize dependency/provider activation.

## Exact inputs

| Field              | Value                                                                      |
| ------------------ | -------------------------------------------------------------------------- |
| Plan ID            | `SIMWAR-MOD-AGT-DUAL-TRACK-PLAN-V1.0-20260820`                             |
| Plan SHA-256       | `EF2104E90C04A811697749388999E31AE27BCFC457D7804FB765A10C68120260`         |
| Current master     | `b9854f1a8cbebed725caf8f4e1ae4b6409fb4ee2`                                 |
| Candidate registry | `contracts/schemas/model-candidate-registry.v1.json`                       |
| Benchmark manifest | `docs/evidence/mod-04-research-refresh-20260821/benchmark-manifest.json`   |
| Source ledger      | `docs/evidence/mod-04-research-refresh-20260821/official-source-ledger.md` |
| Runtime            | `JSON_INTERNAL_ONLY`; provider calls `0`                                   |

## Research boundary

The research used official documentation, official repositories, official
terms pages and primary papers. The exact upstream refs and license dispositions
are recorded in the source ledger and registry fixture. Unknown or commercial
claims remain `WATCH` or `REJECT`; no marketing statement is promoted to a
SimWar SLO, hardware guarantee, calibration result or adoption approval.

The candidate registry enforces the following invariants through JSON Schema:

- source policy is `OFFICIAL_PRIMARY_ONLY`;
- activation policy is `NOT_AUTHORIZED`;
- provider calls are exactly `0`;
- no candidate can be an official truth writer;
- every candidate has a purpose, exact or explicitly unverified version,
  license source, decision, fallback and recheck date;
- research adoption is limited to `RESEARCH_ONLY` or `SHADOW_REFERENCE`.

## Candidate dispositions

- `ADOPT_RESEARCH_ONLY`: PyBLP v1.2.0, Generative Agents paper/repository and
  Concordia v2.4.0. These are offline/reference patterns only.
- `WATCH`: AgentSociety, Capsim, Cesim, Qwen3-8B, DeepSeek-V3 and MiniCPM5-1B.
  Further exact-release, license, hardware, SLO, maintenance or owner review
  is required before any dependency or provider decision.
- `REJECT`: AnyLogic as a SimWar runtime dependency and Forio as a runtime
  dependency. Their official commercial terms do not fit an unapproved
  embedded/redistributed authority path; their concepts remain research
  references.

## Validation and stop conditions

The benchmark manifest defines cases for source identity/license, research-only
boundaries, Provider-off fallback, unknown-claim handling and no-marketing-SLO
promotion. The registry contract has valid and invalid fixtures plus a contract
test. No candidate dependency installation, dependency upgrade or lockfile
mutation is part of MOD-04; repository verification may use the already
declared npm dependency set.

Stop and reopen if an upstream version, license, maintenance status, hardware
claim, SLO claim, provider policy or current master changes; if an owner asks
for a candidate to become a dependency; or if any candidate is proposed as a
formal truth/state/settlement writer.

## Non-proofs

This receipt does not prove that any external model or framework is installed,
runnable in the SimWar environment, calibrated, performant, safe, human
validated, suitable for Pilot/Production or allowed to write official truth.
