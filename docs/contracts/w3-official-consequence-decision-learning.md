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

## Official score read domain

`official_result.score` is a public read projection of the authoritative
producer value. The W3 read DTO accepts finite numbers, including fractional
values such as `24.75` and `37.25`, and copies the value unchanged. The
existing integer values `0`, `80`, and `100` remain valid for compatibility.

This is a read-domain clarification, not a new producer range. The current
simulation core may clamp its scoring output to `0`-`100` as part of its own
scoring semantics, but W3 does not invent an additional minimum or maximum and
does not clamp, round, truncate, stringify, coerce, or recalculate an official
value received from that producer. A missing, non-number, or non-finite value
(`NaN`, positive or negative `Infinity`) is not a valid official score; boxed
number objects, strings, `null`, `undefined`, and booleans are rejected as
well.

The `w3-official-consequence-learning.v1` schema keeps the same object shape
and field set, with no new fields or OpenAPI route changes. `score` remains a
TypeScript `number`; the contract's numeric read domain is finite rather than
integer-only. `rank` and `context.round_no` remain integer fields. Private
payloads and unsupported causal fields remain rejected by both the runtime
validator and the JSON Schema contract.

The official value is copied without rounding and remains a projection only.
Formal scoring, settlement, replay truth, publication authority, and other
Truth fields are unchanged.

## Evidence status and causal boundary

Historical run evidence remains unchanged: the previous primary run was
`1 failed / 2 skipped`, while the previous compatibility run was `1/1 passed`. The
score-domain mismatch is the bounded contract finding addressed here; it does
not prove that score validation was the exclusive root cause of the earlier
HTTP 409. Any remaining independent producer, fixture, or endpoint failure
must be recorded separately rather than inferred away by this read-domain
clarification.

## Learning path

`LearningGoalVersion -> Decision Activity -> EvidenceArtifact -> Rubric -> Reflection -> Teacher Confirmation -> Confirmed Evidence -> StudentLearningReport`

Reflection is AI-off and advisory-only. Evidence selection accepts only exact,
tenant/course/run/team-scoped existing EvidenceArtifact references. A next-round
hypothesis is `READY` only after publication, reflection, evidence selection and
teacher confirmation; otherwise it remains `BLOCKED`.

## Exact report observation and isolated store reopening

After exact-source admission, the Student report consumer reads
`GET /api/v1/bff/student/learning-reports/{report_id}` using the report reference
returned by the admitted W3 record. Product verification observes that exact
report path before triggering navigation or authentication, then checks the
returned report context, reference join and visible report card. A successful
unrelated list or detail response is not a substitute for that proof.

The isolated product fixture creates formal lifecycle inputs through the existing
authorized command routes. A native version result contains a string `version`,
whereas an approval or availability envelope contains an object `version`.
Lifecycle audit production must preserve the complete version object in either
case, consistent with the existing `AuditLog.before` and `AuditLog.after` object
contract. Mere presence of a `version` field cannot distinguish those results.

Persistence verification saves the API-generated store, closes the server and
reopens the same isolated snapshot. It checks retained audit identities and
content as well as unchanged decisions and settlement results. The snapshot
reader continues rejecting invalid audit shapes. This boundary does not authorize
rewriting historical audit records, migrating failed snapshots, or activating a
production persistence runtime.

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
