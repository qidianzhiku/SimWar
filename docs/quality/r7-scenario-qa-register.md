# R7 Scenario QA Register

## Status Boundary

```text
Source SHA:
33b0983859d4f01a48d298ee2f23253ffb8455fc

G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

R8-G1 Status:
INTERNAL_ONLY_DRAFT_NOT_RELEASED
```

## QA register

| QA Record ID            | QA Status             | Required Check                                                                            | Release Boundary |
| ----------------------- | --------------------- | ----------------------------------------------------------------------------------------- | ---------------- |
| r7-qa-internal-draft-v1 | DRAFT_REVIEW_REQUIRED | hidden Unicode, source metadata, Template field dictionary, License / provenance register | NOT_RELEASED     |

## QA scope

The QA register must verify:

```text
Scenario source metadata exists
Template field dictionary exists
License / provenance register exists
ParameterSet and Shadow Replay boundary is non-writing
Teacher scenario selection boundary is preview/select/request-review only
```

## No-Go markers

No-Go triggers:

```text
state_true write required
SettlementResult shape change required
score or rank write required
replay_hash semantic change required
manifest_hash semantic change required
canonical_evidence_digest semantic change required
Plugin Runtime required
AI formal truth write required
PostgreSQL runtime required
Pilot or Production path required
```

```text
AI Advisory: NOT_AUTHORIZED_TO_WRITE_TRUTH
Plugin Runtime: NOT_AUTHORIZED
```

Relates to #111.
Relates to #114.
Relates to #115.
