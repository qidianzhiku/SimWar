# V4.1 Automated Engineering Validation Policy Rebase Decision

## Decision Record

| Field | Value |
| --- | --- |
| Decision owner | Marshall |
| Decision source | Current explicit project-owner prompt |
| Decision type | `V4_1_AUTOMATED_ENGINEERING_VALIDATION_POLICY_REBASE` |
| Decision status | `APPROVED` |
| Repository | `qidianzhiku/SimWar` |
| Source anchor | `1b078d865954f37f31ad152cb908e96306f6efd6` |
| Historical V4 baseline | `SimWar_V4_L1_Complete_Phase_Plan(44).docx` |
| Historical V4 SHA-256 | `76938f41e90a8a95843f2397eee8bcd63b22ee0e61cdd45e5970edfbe8791a73` |
| Governing supplement | `docs/governance/v4-1-automated-engineering-validation-policy.md` |

This is a policy rebase decision for internal engineering development. It is not a human-session record, human-attendance record, participant freeze, digital signature, or authorization for product mutation.

## Decision Basis

The historical V4 plan requires a real 30-60 minute internal M1 teaching trial and states that API-only or helper-only validation cannot replace it. That historical requirement is preserved as historical planning context and remains applicable to external teaching, Controlled Pilot, and Production decisions.

The sealed `SIMWAR-P7-L1-VAL-041AD-R4-D1` evidence at the stated source anchor provides a more complete automated product-validation basis for internal engineering than API-only or helper-only evidence. It includes supported role surfaces, role and tenant boundaries, one settlement/publish path, durable freeze before lifecycle work, lifecycle non-overwrite, Known Limits readback, and zero-residue teardown.

The Owner therefore accepts this automated evidence as a bounded substitute for the historical human prerequisite only for subsequent internal engineering development decisions. The decision does not assert that human validation was performed.

## Superseded Historical Clause

For the narrow scope above, this decision supersedes only the historical V4 condition that a real human internal trial is mandatory before internal engineering development can continue. It does not replace the V4 file, rewrite its history, or alter any other V4 safety, truth, Replay, security, tenant, or release boundary.

## Current Status

```text
L1 Engineering Validation:
SATISFIED_BY_OWNER_APPROVED_AUTOMATED_SUBSTITUTE_WITH_LIMITS

Human Validation:
NOT_PROVEN_NOT_REQUIRED_FOR_INTERNAL_DEVELOPMENT

L1 Standard Release Readiness:
NOT_PROVEN

Phase 8 Development:
NOT_YET_GRANTED

Controlled Pilot / Production / PostgreSQL Runtime:
NOT_AUTHORIZED
```

## Required Conditions For A Future Phase 8 Decision

This decision authorizes no Phase 8 implementation. After this document is merged, the only next policy route is a separately authorized Phase 8 entry audit. The audit must confirm fresh source and evidence, no required G0-G7 failure or unknown, current Known Limits and zero-residue evidence, a unique ScenarioPackage and ParameterSet authority boundary, accepted Shared Golden M1 parity, and a separate Owner development authorization.

## Preserved Controls

- Simulation core remains the formal truth authority.
- Official settlement and Replay results remain immutable under their existing controls.
- Tenant, role, team, and Student private-data isolation remain mandatory.
- AI remains advisory-only.
- JSON remains the active internal runtime; this decision does not activate PostgreSQL or durable persistence.
- Issues `#111`, `#114`, and `#115` remain open.

## Explicit Non-Proofs

This decision does not establish human usability, human learning effect, human attendance, L1 standard release readiness, external teaching readiness, Controlled Pilot readiness, Production readiness, durable settlement, durable recovery, or any authority to start Phase 8 development.

## Next Allowed Action

After this policy is merged and its exact head is independently reviewed, the next allowed mission is `SIMWAR-P7P8-R0R7-AUD-ENTRY-042C`. It remains an entry audit and cannot mutate ScenarioPackage, ParameterSet, Replay, settlement, or any product surface without separate Owner authorization.
