# P2-B Decision Learning and Teacher Debrief

## Scope

This document records the FE-19 Student decision-learning journey and the FE-20 Teacher debrief workspace delivered from the Figma-first handoff. The implementation is presentation and read-model only. It does not add an API route, DTO, permission rule, settlement writer, model provider, or truth authority.

Figma source: `6ezOykmrZbMbFEYPfIkZ07`, page `39:2` (`11 P2-B Decision Learning & Teacher Debrief`).

## Figma-to-runtime map

| Figma surface                           | Runtime route                  | Runtime component                                                                         | Existing authority                                        |
| --------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `40:28` S-P2B-01 to `40:125` S-P2B-04   | `#student-debrief`             | `StudentDecisionLearningJourney`                                                          | Student W3 safe consequence projection                    |
| `43:4` S-P2B-05 我的经营复盘            | `#student-debrief`             | `StudentDecisionLearningJourney` reflection stage                                         | AI-off Student reflection endpoint; one composed response |
| `43:32` S-P2B-06 下一轮假设             | `#student-debrief`             | Student transfer stage                                                                    | W3 next-round hypothesis read model                       |
| `43:57` to `44:39` T-P2B-01 to T-P2B-05 | `#teacher-debrief`             | `TeacherDebriefWorkspace`                                                                 | Teacher W3 read model plus existing team monitor summary  |
| `46:19` State Matrix                    | Student/Teacher state branches | `blocked`, `loading`, `empty`, `ready`, `stale`, `error`, `recovery`, `committed receipt` | Existing BFF state and receipt conventions                |

The two advanced W3 command surfaces remain available under an explicit compatibility disclosure. They are not duplicated as a second primary product flow.

## Component and token reuse

The implementation reuses the existing UI foundations rather than introducing a second design system:

- `AppShell`, `WorkbenchFrame`, `ContextBar`, `RoleNavigation`, `StatePanel`, `KnownLimitBanner`;
- `AuthorityBadge` for official/advisory/read-only boundaries;
- `AllowedActionButton` for server-gated commands;
- existing warm-white, navy, gold, teal, and crimson application tokens, with P2-B layout classes scoped to the Student and Teacher applications.

The Figma library names are mapped explicitly where the codebase uses a different name: `StateBadge` → `AuthorityBadge`, and `ActionButton` → `AllowedActionButton`.

## Student journey

The six stages are stable and ordered as:

1. Published result
2. Decision story
3. Bounded mechanism
4. Teacher-generated one-change What-if (read-only for the learner)
5. Reflection (three local fields composed into the existing single W3 `response` field)
6. Transfer to the next round

The journey is closed before publication. When no redacted published result exists, the Student component does not fetch W3 consequence data and the D4 report component does not fetch learning reports. Student reflection is AI-off and advisory-only; it cannot write canonical Decision or SettlementResult data.

## Teacher workspace

The five stages are:

1. Today
2. Highest blocker
3. Cohort learning progress
4. Teachable moment
5. Debrief preparation

The local classroom note is deliberately a browser-local draft. The UI states that it is not uploaded, not included in D4, and not written to a formal result. The Teacher workspace displays aggregated safe signals and does not render private peer judgments or raw DTO JSON.

## State and recovery contract

Each primary surface has explicit idle/loading/empty/error handling. The Figma state matrix is an implementation aid, not a claim that every state has a backend fixture. Recovery remains a refresh/reload of the server projection. A committed receipt remains a server-owned result and is never recreated in the browser.

## Accessibility and responsive constraints

- All new action buttons and summary targets preserve the existing 44px minimum target convention.
- Textareas have an 86px minimum height and visible focus outlines.
- Cards and grids use `minmax(0, 1fr)` and collapse to one column below the existing 760/780px breakpoints.
- The Figma page contains mobile frames for all six Student stages and all five Teacher stages; recursive Figma overflow validation returned zero violations across 24 P2-B top-level frames.

## Known limits

This wave does not claim production durability, PostgreSQL runtime, human validation, pilot readiness, or a new causal-inference authority. Product Design connector operations were unavailable in this run; the independent design review and Figma evidence are recorded in the governance closure. CodeGraph and Graphify were unavailable or stale for the exact worktree, so source/test/git evidence is the authoritative fallback.
