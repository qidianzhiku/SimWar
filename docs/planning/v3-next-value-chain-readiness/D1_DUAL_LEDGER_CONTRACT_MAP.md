# D1 Dual Ledger Contract Map

**Candidate:** `CAND-L1P-D1-LEARNING-GOAL-RUBRIC`
**Status:** `DEPENDS_ON_SEPARATE_PROGRAM_D_MISSION`
**Assessment source anchor:** `8e96e88955c2d5543eeadf83643f2e2e10dd4be4`

| Ledger | Current authority | Future D1 rule |
| --- | --- | --- |
| Business outcome | Existing L1-L3 settlement path | D1 reads a safe published projection only. |
| Learning evidence | Synthetic guard/future learning authority | Excluded from truth hash and settlement inputs. |

Business Outcome is not a learning grade. Learning Evidence is not an input to
`state_true`, SettlementResult, Score, Rank, ParameterSet, or Replay hash.

The synthetic learning-evidence guard in
`docs/quality/r5-r6-course-delivery-learning-evidence.md` records
`formal_truth_write = false`; it is not a LearningGoal registry, rubric
runtime, formal grade, or Teacher Confirmation writer.

Future D1 needs immutable goal/rubric references, a separate Teacher
Confirmation lifecycle, role/activity provenance with field allowlists, and
negative tests for business-outcome and official-Replay writes. It must not
reuse RoleWorkflow storage as a learning ledger or introduce AI, external
providers, real data, PostgreSQL, or migrations.
