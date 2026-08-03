# D1 Learning Design Contract

The D1 contract defines immutable, teacher-authored learning design records:
`LearningGoalVersion` and `RubricVersion`.

The JSON Schema is closed. Unknown properties, score or grade fields, missing
exact references, wildcard or fallback references, duplicate criterion ids,
and empty rubric levels are invalid. `RubricVersion.scoring_policy` is the
literal `NOT_ACTIVE_D1`; it is not a grading engine.

The source of the contract is
`contracts/schemas/learning-design.v1.json`. The command path is owned by
`services/api/src/learning-design.ts` and exposed through the Teacher BFF only.
The frontend consumes API DTOs and never reads the JSON store directly.
