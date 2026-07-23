# V4.1 Automated Engineering Validation Policy Supplement

## Status And Precedence

This document is the canonical V4.1 policy supplement for internal engineering development after it is merged to `master`. It applies only to the status classification and entry criteria described here. It does not alter the historical V4 plan or retroactively relabel earlier evidence.

Historical baseline:

- File: `SimWar_V4_L1_Complete_Phase_Plan(44).docx`
- SHA-256: `76938f41e90a8a95843f2397eee8bcd63b22ee0e61cdd45e5970edfbe8791a73`
- Historical Phase 7 clauses: the Phase 7 heading, the 30-60 minute internal M1 teaching trial, and the statement that API-only or helper-only validation could not replace a real internal trial.

For internal engineering development only, this supplement supersedes the historical requirement that a real human trial is mandatory before the next internal engineering development stage. The historical document remains unchanged and continues to govern its original planning context. Human validation remains a separate requirement for external teaching, Controlled Pilot, and Production decisions.

## Scope

This policy is limited to synthetic, internal-only, loopback-only engineering work using the current JSON runtime. It does not authorize a customer, external teaching delivery, Controlled Pilot, Production, PostgreSQL runtime, SQL, migration, durable settlement, durable recovery, or a change to any product behavior.

The policy accepts automated engineering evidence only when it is source-bound, fresh, independently checkable, and explicit about its limits. It does not turn automated role personas into human participants.

## Evidence Basis

The current baseline is the sealed `SIMWAR-P7-L1-VAL-041AD-R4-D1` evidence pack at source `1b078d865954f37f31ad152cb908e96306f6efd6`. Its final result records passed automated discovery, Known Limits, four-role product flow, Run A durable freeze, Run B lifecycle, security boundaries, non-overwrite, and zero-residue teardown. It also records that human attendance, participant freeze, participation, and observation were not collected or performed.

The evidence pack supports an internal engineering decision. It is not proof of human usability, human understanding, human learning effect, durable settlement, durable recovery, Pilot readiness, or Production readiness.

## Phase 7E: Automated Engineering Application Validation

Phase 7E is the engineering validation gate for internal development. A current Phase 7E result requires all applicable automated evidence below:

1. source identity and evidence integrity are verified;
2. Teacher, Student, and Tenant Admin product surfaces complete the supported synthetic Golden M1 path;
3. student identity, team, tenant, and private-truth boundaries are verified;
4. Run A reaches the authorized lock, settlement, and publish path once;
5. Run A evidence and durable filesystem freeze are verified before Run B;
6. Run B performs only the authorized pre-settlement lifecycle path and does not settle, publish, execute Replay, or overwrite Run A;
7. Known Limits surfaces are readable by the supported roles; and
8. teardown verifies no process, listener, store, browser-context, credential, or source-mutation residue.

Phase 7E status for the current baseline is:

```text
L1 Engineering Validation:
SATISFIED_BY_OWNER_APPROVED_AUTOMATED_SUBSTITUTE_WITH_LIMITS
```

## Phase 7H: Human Factors Validation

Phase 7H covers real human usability, understanding, collaboration, learning effect, and acceptance of Known Limits. It is optional for the internal engineering development path governed by this supplement, but it is not completed by automated evidence and is not erased from the historical plan.

```text
Human Validation:
NOT_PROVEN_NOT_REQUIRED_FOR_INTERNAL_DEVELOPMENT
```

Phase 7H remains separately required before any external teaching claim, Controlled Pilot decision, or Production decision. Such work requires a fresh human-participant authorization and evidence package; this policy supplies neither.

## L1 Status Model

The following statuses are intentionally distinct:

| Status | Current classification |
| --- | --- |
| L1 engineering validation | `SATISFIED_BY_OWNER_APPROVED_AUTOMATED_SUBSTITUTE_WITH_LIMITS` |
| Human validation | `NOT_PROVEN_NOT_REQUIRED_FOR_INTERNAL_DEVELOPMENT` |
| L1 standard release readiness | `NOT_PROVEN` |
| Controlled Pilot | `NOT_AUTHORIZED` |
| Production | `NOT_AUTHORIZED` |

No row authorizes PostgreSQL runtime, SQL, migration, durable settlement, or durable recovery.

## Phase 8 Entry Rule

After this policy is merged, the next allowed decision is a separate `SIMWAR-P7P8-R0R7-AUD-ENTRY-042C` entry audit. That audit may recommend a separate Phase 8 development authorization only if all of the following are current:

1. the source anchor and required evidence remain fresh;
2. no required G0-G7 gate is failed or unknown;
3. Phase 7E remains passed with its stated limits;
4. Known Limits, security-boundary, and zero-residue evidence remain current;
5. the ScenarioPackage and ParameterSet authority boundaries are uniquely identified;
6. Shared Golden M1 parity is accepted for the proposed scope; and
7. the Owner separately authorizes both the entry audit and any later development work.

Until that separate audit and authorization complete:

```text
Phase 8 Development:
NOT_YET_GRANTED
```

## Preserved Boundaries

This supplement preserves the following non-negotiable controls:

- the simulation core remains the formal truth authority;
- settlement results, scores, rankings, canonical decisions, and replay-hash inputs are not changed by this policy;
- Replay and Shadow Replay cannot overwrite official results;
- tenant, role, team, and Student private-data isolation remain required;
- AI remains advisory-only and cannot write formal truth;
- JSON remains the current default internal runtime; and
- open Issues `#111`, `#114`, and `#115` remain open and are not closed by this policy.

## Freshness And Revalidation

This supplement expires for a downstream decision on any material change to the source anchor, product validation evidence, G0-G7 posture, Internal Pack, Known Limits, truth/replay/security boundaries, or relevant branch policy. The affected decision must then stop and perform a new evidence assessment; it must not automatically chase a newer `master` or reuse stale evidence.

## Explicit Non-Proofs

This policy does not prove or authorize:

- a completed human session or human validation;
- L1 standard release readiness;
- external teaching delivery;
- Controlled Pilot or Production;
- PostgreSQL runtime, SQL, or migration;
- durable settlement, backup/restore, or durable recovery;
- ScenarioPackage or ParameterSet mutation;
- Replay execution; or
- a Phase 8 development implementation.
