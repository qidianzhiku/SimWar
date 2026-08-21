# FE-19 / FE-20 Figma-to-code map

| Figma surface                     | Runtime route      | Code surface                                                   | Mapping status                                             |
| --------------------------------- | ------------------ | -------------------------------------------------------------- | ---------------------------------------------------------- |
| `40:28` S-P2B-01 Result           | `#student-debrief` | `apps/student/src/P2BDecisionLearningJourney.tsx` result stage | Direct; official result remains read-only                  |
| `40:64` S-P2B-02 Decision Story   | `#student-debrief` | Student `story` stage                                          | Direct; source text is the safe BFF projection             |
| `40:97` S-P2B-03 Mechanism        | `#student-debrief` | Student `mechanism` stage                                      | Direct; bounded mechanism copy only                        |
| `40:125` S-P2B-04 What-if         | `#student-debrief` | Student `what_if` stage                                        | Direct; teacher-generated preview, no client calculation   |
| `43:4` S-P2B-05 Reflection        | `#student-debrief` | Student `reflection` stage                                     | Direct; POST is advisory-only reflection input             |
| `43:32` S-P2B-06 Transfer         | `#student-debrief` | Student `transfer` stage                                       | Direct; next-round hypothesis is server projection         |
| `43:57` T-P2B-01 Today            | `#teacher-debrief` | `apps/teacher/src/P2BTeacherDebriefWorkspace.tsx` today stage  | Direct; teacher-safe projection                            |
| `43:90` T-P2B-02 Highest Blocker  | `#teacher-debrief` | Teacher `highest_blocker` stage                                | Direct; safe blocker summary                               |
| `43:119` T-P2B-03 Cohort Progress | `#teacher-debrief` | Teacher `cohort_progress` stage                                | Safe empty projection preserved; no fabricated A/B/C rows  |
| `44:11` T-P2B-04 Teachable Moment | `#teacher-debrief` | Teacher `teachable_moment` stage                               | Direct; local ask/show/listen facilitation only            |
| `44:39` T-P2B-05 Debrief Prep     | `#teacher-debrief` | Teacher `debrief_prep` stage                                   | Direct; blocker card is a safe reference, not a new writer |

## State and authority mapping

- Figma unpublished/blocked → Student `published=false` gate; no prefetch and no result read.
- Figma loading/empty/error/stale → Student and Teacher BFF fetch states. Error states expose a retry action; stale states retain the prior safe record while a refresh is in flight.
- Figma published/ready → `W3OfficialConsequenceResponse` safe projection.
- Figma recovery → retry/refetch path; no replacement of the canonical result.
- Figma committed → reflection receipt only; it explicitly remains outside formal settlement.
- Figma unknown → no formal result copy; the state matrix is a design contract and does not widen visibility.

## Acceptable deltas

The Figma cohort example contains sample A/B/C rows, while runtime code intentionally renders a teacher-safe empty state because no server cohort rows are present. This is an intentional privacy and anti-fabrication delta. Figma's visual labels such as `FE-19`/`FE-20` are handoff metadata; customer-facing runtime copy remains Chinese-first.
