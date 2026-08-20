# W3 Official Consequence and Decision Learning

W3 consumes the existing W027 canonical decision, exact round context, round
lock, official settlement and publication authorities. It does not create a
second truth, settlement, replay, evidence or learning authority.

## Runtime contract

- Runtime authority remains `JSON_INTERNAL_ONLY`.
- A consequence record is keyed by tenant, run, round, team and activity, and
  carries exact references to the admitted canonical decision, round and
  settlement result.
- A settled but unpublished round is teacher-visible only. Student consequence
  and reflection paths require `PUBLISHED`.
- Student output contains only safe result, Decision Story, bounded causal
  language and Known Limits. It never returns raw private payload, truth state,
  replay internals, or teacher-only evidence selection.
- Causal labels are `model_conditioned_association` or
  `causal_not_proven`; W3 never asserts a causal fact.

## Learning path

`LearningGoalVersion -> Decision Activity -> EvidenceArtifact -> Rubric -> Reflection -> Teacher Confirmation -> Confirmed Evidence -> StudentLearningReport`

Reflection is AI-off and advisory-only. Evidence selection accepts only exact,
tenant/course/run/team-scoped existing EvidenceArtifact references. A next-round
hypothesis is `READY` only after publication, reflection, evidence selection and
teacher confirmation; otherwise it remains `BLOCKED`.

## Counterfactual boundary

The teacher counterfactual endpoint replays one changed decision field against
the exact official context in isolation. It is explicitly non-official, cannot
overwrite the official settlement or replay record, and uses no multi-variable
oracle. Repeating the same idempotency input reuses the deterministic result;
conflicting input fails closed.

## BFF operations

- `GET /api/v1/bff/student/w3/consequence`
- `GET /api/v1/bff/teacher/w3/consequence`
- `POST /api/v1/bff/teacher/w3/counterfactual`
- `POST /api/v1/bff/student/w3/reflection`
- `POST /api/v1/bff/teacher/w3/evidence-selection`
- `POST /api/v1/bff/teacher/w3/next-round-hypothesis`

All operations require an authenticated tenant-scoped session and exact
course/run/round/team/activity context. W3 does not add a Student route for
teacher evidence, teacher confirmation, or arbitrary private event data.

## Known limits

- Human Validation is not performed by this contract.
- PostgreSQL application runtime is not activated.
- Durable recovery and cross-process concurrency are not proven.
- W3 does not authorize Pilot, Production, W4, or an automatic successor.
