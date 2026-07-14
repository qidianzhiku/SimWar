# L1 Issue Escalation Procedure

## Status Boundary

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

Phase 7:
NOT_AUTHORIZED

Controlled Pilot:
NOT_AUTHORIZED

Production:
NOT_AUTHORIZED

PostgreSQL runtime:
NOT_AUTHORIZED
```

本 procedure 用于 synthetic internal validation 中的 issue escalation。它不关闭 #111、#114 或 #115，不授权 `Pilot`、`Production`、PostgreSQL runtime、SQL、migration 或 durable settlement。

## Evidence Package Boundary

```text
INTERNAL_ONLY_DRAFT_NOT_RELEASED
```

本 escalation procedure 只服务 internal synthetic decision package。它不授权 Issue mutation，不授权 `Pilot`、`Production`，且 PostgreSQL runtime 保持 `NOT_AUTHORIZED`。

## REL-040 Release-Candidate Binding

```text
Current master anchor:
695cf955b3c9ab1d96b7fb59ac92671cf82dfdcf

Phase 5 Outcome:
L1_GATE_EXCEPTION_WITH_OWNER_AND_EXPIRY

Phase 6 Entry:
PHASE6_PACK_PR_CANDIDATE

G0 Exception Expiry:
2026-07-21T23:59:59+08:00

Issue #111:
OPEN

Issue #114:
OPEN

Issue #115:
OPEN
```

This procedure is refreshed for the R8-G1 internal application pack release
candidate. This mission does not authorize issue creation, mutation, labels,
comments, closeout, milestone, project or assignment changes.

## Escalation Categories

| Category               | Examples                                                              | Required action                                            |
| ---------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------- |
| P0 protected data leak | Student sees `state_true`, private replay metadata, other tenant data | stop session, preserve evidence, require Owner disposition |
| P0 tenant breach       | cross-tenant read/write succeeds                                      | stop session, require R3 remediation                       |
| P1 replay overwrite    | replay evidence changes formal result                                 | stop session, require replay remediation                   |
| P1 recovery overclaim  | docs imply backup restore or durable recovery without proof           | hold release note, correct documentation                   |
| P1 exception expiry    | time or event expiry occurs before formalization                      | stop pack work, require fresh Owner disposition            |
| P2 operator ambiguity  | runbook unclear but no protected data leak                            | revise internal docs only                                  |
| Supply-chain risk      | direct runtime critical vulnerability in JSON-only path               | require dependency scope decision                          |

## Escalation Record

Record:

- timestamp
- actor role
- tenant id
- run id
- round number
- command or API path
- stable error code
- request id
- affected surface
- evidence label
- explicit non-proof statement
- exception expiry and source SHA
- no-go disposition

Do not record secrets, tokens, passwords, payment data, real customer data or production data.

## Issue Relationship

Use `Relates to #111`, `Relates to #114`, and `Relates to #115` only. Do not use issue closeout keywords in PR bodies unless separately authorized.

Issue closeout keywords remain forbidden in this pack PR body:

- `Closes`
- `Fixes`
- `Resolves`

New issue creation is allowed only by a separately signed Owner authorization or
a future mission scope that explicitly authorizes issue mutation.

## No-Go Matrix

| Signal                                                                                 | Immediate disposition                                       |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Student private marker or cross-tenant/team data                                       | stop; preserve bounded evidence; Owner security disposition |
| Replay or Shadow Replay overwrites official result                                     | stop; replay remediation authorization required             |
| Reset or cleanup needs real data, SQL, database or durable recovery                    | stop; scope is unauthorized                                 |
| G0 exception expires or source/policy changes                                          | stop; current authorization expires                         |
| Product alignment requires runtime, frontend, BFF, fixture, package or workflow change | stop; return scope blocker                                  |
| Critical direct-runtime dependency risk                                                | stop; require human supply-chain decision                   |

Use `docs/operations/phase6-limited-internal-evidence-capture-template.md` for
the bounded record. Do not paste private payloads into an issue or PR.

## Non-Proofs

Escalation records do not prove `G0 PASS`, `L1 READY`, `Pilot`, `Production`, PostgreSQL runtime, SQL migration or durable settlement.

## REL-040 Evidence Handoff

| Field                | Value                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------- |
| Evidence Type        | `ESCALATION_EVIDENCE / DOCS_ONLY`                                                           |
| Source SHA           | `695cf955b3c9ab1d96b7fb59ac92671cf82dfdcf`                                                  |
| Result               | `PHASE6_PACK_PR_CANDIDATE`                                                                  |
| Scope of Proof       | Internal escalation classification, no-go matrix and issue relationship boundary            |
| Explicit Non-Proof   | Not Phase 7, not Issue mutation, not issue closeout, not release authorization              |
| Owner                | Marshall                                                                                    |
| Expiry Trigger       | 2026-07-21 23:59:59 +08:00 or earlier source, issue, policy or procedure change             |
| Revalidation Command | `npm test -- tests/unit/phase6-limited-internal-pack-contract.test.ts`                      |
| No-Go Trigger        | Unauthorized closeout semantics, private payload capture, expired exception or scope escape |
