# C4 Instructor Intelligence Kit Contract

`instructor-intelligence-kit.v1` is a teacher-only, deterministic debrief projection. A teacher creates an explicit draft asset for a Course that already has a frozen CourseBlueprint binding, then publishes it before the kit can be read for a Run and Round.

The teacher endpoint accepts only a published Round. The returned kit is advisory teaching material with `ai_status: off`. It carries immutable CourseBlueprint evidence references, a deterministic digest, and a `result_delta` derived only from the immediately preceding published Round and the current published Round's `state_obs` fields. It can report an unavailable baseline, or a deterministic score/rank/team-count delta. It never returns `state_true`. Discussion prompts, follow-up questions, time guidance, and known limitations remain teacher-only. It is not an AI provider result and cannot publish itself.

The schema is closed and intentionally rejects `state_true` and other undisclosed properties. It does not expose canonical decisions, internal settlement evidence, replay digests, hidden parameters, or Student-private data.

The JSON runtime uses compensating persistence for an asset mutation whose required audit append fails; it is not crash-safe durable atomicity. This contract does not create a truth writer, change settlement or score/rank semantics, activate PostgreSQL, provide durable recovery, establish Learning Confirmation, or authorize Pilot or Production.
