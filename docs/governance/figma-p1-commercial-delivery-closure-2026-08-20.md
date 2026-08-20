# SimWar Figma P1 commercial delivery closure

**Mission**: `SIMWAR-FE-P1-IMPLEMENTATION-CLOSURE-001`  
**Closure type**: documentation-only governance receipt  
**Closure date**: 2026-08-20 (America/Los_Angeles)  
**Product PR**: [#401](https://github.com/qidianzhiku/SimWar/pull/401)  
**Merged product SHA**: `c7d85f3bb2d64927e108936645caf53996dc613e`  
**Current `origin/master` at closure start**: `c7d85f3bb2d64927e108936645caf53996dc613e`

## Delivery decision

The Figma P1 visual foundation is merged and commercially handoff-ready as a
presentation-layer migration, with the limits below declared. The implementation
does not claim a new product route tree, independent Enterprise application,
Code Connect completion, production deployment, or human visual sign-off.

`FINAL_STATUS = COMPLETE_WITH_LIMITS`

The limits are explicit product-governance boundaries, not hidden test failures:

- Figma Code Connect is `BLOCKED_BY_SEAT` because the connected Figma account
  reports that a Dev or Full seat on an Organization or Enterprise plan is
  required.
- The ordinary pixel threshold remains 1%. This migration uses the approved
  Figma visual-delta receipt for the declared design-system replacement; it is
  therefore reported as `acceptable_difference`, not as a zero-diff claim.
- The route/state matrix distinguishes static classifications from runtime
  coverage. This closure does not convert every planned state into a browser
  observation.
- No human usability, pilot, production, or customer acceptance session was
  performed.
- The existing `npm audit` result contains 9 vulnerabilities (2 low, 7 high);
  no dependency upgrade or audit-fix mutation was authorized in this mission.

## Figma source and read-only assessment

Figma file: [SimWar Frontend P1 Design Board](https://www.figma.com/design/6ezOykmrZbMbFEYPfIkZ07)  
File key: `6ezOykmrZbMbFEYPfIkZ07`

The read-only source assessment found 15 root pages:

`00 Cover`, `01 Design System`, `02 Components`, `03 Teacher Portal`,
`04 Student Portal`, `05 Admin Portal`, `06 Scenario & Plugin`, `07 AI & Replay`,
`08 Prototype Flow`, `09 Mobile & Tablet`, `10 Archive`, `Archive Current Evidence`,
`Archive Optimization Plan`, `Archive Prompt Alignment`, and `Archive P1 Foundation`.

Implementation-relevant boards were `01 Design System / 19:45`,
`02 Components / 18:4 and 19:206`, `03 Teacher Portal / 20:2`,
`04 Student Portal / 20:105`, `05 Admin Portal / 20:210`, and
`09 Mobile & Tablet / 21:233`.

The design system inventory is:

- 26 variables in the existing `SimWar P1` collection (reused and extended,
  not duplicated);
- 6 Inter text styles (H1, H2, Title, Body, Caption, Metric);
- 4 component variant sets (`ActionButton`, `StateBadge`, `StatePanel`,
  `FormField`);
- primitive colors for brand, success, warning, danger, AI, official, replay,
  surface, border, strong text, muted text, and focus;
- 44px control sizing, 12px cards, 10px buttons, and 16px modal radii;
- light-surface accessibility aliases where the exact Figma primitive needs a
  higher-contrast presentation value.

## Frontend mapping and commercial route truth

The Figma portal boards map to the existing single-root applications. No React
Router was introduced and no independent browser routes were invented:

| Figma surface              | Current code mapping                                                                          | Runtime location                                             |
| -------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Design System / Components | `packages/ui/src/tokens.css`, `packages/ui/src/styles.css`, `packages/ui/DesignSystemLab.tsx` | DesignSystemLab dev server on port 3004                      |
| Teacher Portal             | `apps/teacher/src/App.tsx`, `apps/teacher/src/styles.css`                                     | Teacher root app with `#teacher-*` hash sections             |
| Student Portal             | `apps/student/src/App.tsx`, `apps/student/src/styles.css`                                     | Student root app with `#student-*` hash sections             |
| Admin Portal               | `apps/admin/src/App.tsx`, `apps/admin/src/styles.css`                                         | Admin root app with `#admin-*` hash sections                 |
| Mobile & Tablet            | the same three applications                                                                   | 1440x900, 1280x800, 1024x768, and 390x844 evidence viewports |

Direct code mappings include AppShell/context/navigation, AuthorityBadge and
state taxonomy, server-provided AllowedActionButton states, StatePanel recovery
states, existing Student FormField/DecisionForm surfaces, and the existing
Teacher/Student/Admin portal panels. API/BFF calls, server permissions,
`editable_fields`, role workflow writes, decision truth, replay truth, and
tenant boundaries are unchanged.

## Post-merge validation

Validation ran in the clean detached worktree:

`C:\Users\Marshall\AppData\Local\Temp\simwar-fe-p1-postmerge-c7d85f3`

Exact source head: `c7d85f3bb2d64927e108936645caf53996dc613e`.

| Evidence                    | Result                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm ci`                    | pass; audit reports the 9 pre-existing vulnerabilities listed above                             |
| `npm run typecheck`         | pass                                                                                            |
| `npm run build`             | pass for shared-contracts, agent-gateway, simulation-core, API, UI, Admin, Teacher, and Student |
| `npm run test:unit:pr4`     | pass; 4 files / 50 tests                                                                        |
| `npm run test:e2e:ui:pr4`   | pass; 4 focused tests (Lab, Admin+Enterprise, Teacher, Student)                                 |
| browser candidate inventory | 20 PNGs: Admin 4, Enterprise 4, Teacher 4, Student 4, Lab 4                                     |
| runtime performance         | 12 app rows + 4 Lab rows, all `within_budget`; CLS 0 and hash navigation under 100ms            |
| exact-head/port cleanup     | clean exact SHA; owned ports closed after the run                                               |

The coherent post-merge browser evidence is outside the product worktree at:

`C:\Users\Marshall\AppData\Local\Temp\simwar-pr4-postmerge-c7d85f3-full-retry2`

Its controlled Playwright store is:

`C:\Users\Marshall\AppData\Local\Temp\simwar-playwright\pr4-postmerge-c7d85f3-full-retry2\playwright-store.json`

## Independent visual baseline and comparator

The baseline was captured from a clean detached checkout at exact base
`2304f79b70d68f62a504073ae90232e1f52719cd`:

`C:\Users\Marshall\AppData\Local\Temp\simwar-fe-p1-base-2304f79`

The external baseline receipt and 20 PNGs are at:

`C:\Users\Marshall\AppData\Local\Temp\simwar-pr4-base-2304f79-evidence2`

The comparator output is:

`C:\Users\Marshall\AppData\Local\Temp\simwar-pr4-postmerge-c7d85f3-full-retry2\visual-manifest.json`

The comparator was run with the Figma receipt
`docs/design/ui-refoundation/figma-p1-visual-delta.json`, global threshold
`0.01`, and the frozen Student navigation exception `0.065`. It recorded:

```text
status: passed
ready_for_review: true
pixel_diff.status: acceptable_difference
compared_pairs: 20
base_sha: 2304f79b70d68f62a504073ae90232e1f52719cd
head_sha: c7d85f3bb2d64927e108936645caf53996dc613e
actual_sha: c7d85f3bb2d64927e108936645caf53996dc613e
clean: true
failures: []
```

The raw diff PNGs remain in the external `diff` directory. The accepted ratios
are bounded by role (`Admin .92`, `Enterprise .92`, `Teacher 1.00`, `Student
.97`, `Lab .65`) only because this exact Figma P1 migration is declared in the
receipt. Missing, malformed, undeclared, or over-limit pairs still fail closed.

## Product Design assessment

The merged direction is materially stronger than the pre-migration surface:

- the navy header establishes a cleaner product frame and a clearer authority
  hierarchy;
- role navigation is more legible, with selected/hash locations and mobile
  wrapping made explicit;
- primary actions have stronger contrast and consistent touch sizing;
- panel, card, status, and typography hierarchy is more coherent across Admin,
  Teacher, Student, and DesignSystemLab;
- loading, empty, blocked, error, stale, forbidden, advisory, replay, and
  official-result semantics remain visually distinguishable;
- the Figma variables and variants now have a traceable mapping to existing
  source components rather than an unbound mockup-only design.

Remaining product-design limits are also explicit: the three application roots
still contain long workbench surfaces rather than independently routed pages;
Enterprise is intentionally a read-only Admin projection; Code Connect is
blocked by the Figma seat; and accessibility/visual acceptance here is automated
evidence, not a substitute for a human product review.

## Scope and safety receipt

This delivery contains presentation-layer code, tests, visual evidence tooling,
and design/governance documentation only. It does not change:

- backend services, APIs, DTOs, contracts, persistence, migrations, or schemas;
- settlement, canonical Decision selection, replay hashes, scoring, ranking, or
  other truth fields;
- RBAC, tenant isolation, Student visibility, or server permission decisions;
- Advisor/W020, AI provider integration, Postgres runtime, or new business
  writers;
- production, pilot, customer, or paid Figma plan state.

The original dirty workspace was preserved and was not used for mutation or
validation. CodeGraph was not treated as fresh proof because the original graph
contains historical isolated paths; current mapping was validated from exact
source reads, tests, and clean detached worktrees.

## Follow-up ownership

1. Product/Design owner: perform human visual and usability review against the
   Figma board before production or pilot release.
2. Figma workspace owner: provide the required Dev/Full Organization or
   Enterprise seat if Code Connect is needed.
3. Engineering governance owner: retain the external baseline, candidate,
   comparator manifest, and raw diff PNGs with the release evidence; do not
   rewrite `acceptable_difference` as zero-diff.
4. Security owner: triage the existing npm audit vulnerabilities in a separate
   dependency-maintenance task.
