# D3 Teacher Confirmation Contract

`teacher-confirmation.v1` is a teacher-only, immutable confirmation history
over exact D1 course-package, learning-goal, rubric, and D2 evidence refs.

The `TeacherConfirmationCommandService` is the sole writer. A confirmation
revision creates a new version with a `supersedes_ref`; no version is updated
in place. Repeating the same identity and content digest reuses the existing
receipt, while a different digest returns a stable conflict.

The contract deliberately excludes raw event payloads, Student routes, Truth,
SettlementResult, Score, Rank, canonical Decision, Replay authority, and AI
private context. The active runtime remains `JSON_INTERNAL_ONLY`; durable
cross-process claim locking and Human Validation are not proven.
