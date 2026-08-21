# SimWar FE-P1 Figma → code map

Figma file: `6ezOykmrZbMbFEYPfIkZ07`  
Evidence date: 2026-08-21  
Forward source baseline: `cfd35ddd560dba2da4420f8a7586f234391423fa`

## Figma structure inspected

The connected file contains the following relevant pages and boards:

- `18:3` — `01 Design System`
- `18:4` — `02 Components`, including `19:206 Components Board`
- `18:5` — `03 Teacher Portal`
- `18:6` — `04 Student Portal`
- `18:7` — `05 Admin Portal`
- `13:2` — `Archive · P1 Foundation`, child board `13:3`
- `39:2` — `11 P2-B Decision Learning & Teacher Debrief`, child handoff
  `40:2`, student board `40:28`, teacher board `43:57`

The P1 board explicitly constrains P1 to identity entry, context parsing,
permission projection, audit visibility, and cross-tenant rejection. Course,
team, round, and decision behavior remains outside this visual wave.

## Variables and styles

The existing `SimWar P1` collection (`VariableCollectionId:14:2`) has one mode
and 28 variables. The implementation reuses its exact brand, state, surface,
border, text, focus, spacing, control-height, and radius values. The P2-B board
already exposes warm surface (`#f7f4ed`) and navy (`#10253f`) values; matching
semantic aliases were added to `packages/ui/src/tokens.css` so app CSS can
consume the Figma handoff without a local palette.

P2-B additions are semantic aliases for warm/navy surfaces, teal-subtle and
metric surfaces, mechanism and blocked surfaces, soft/input/blocked/transfer
borders, body/subtle/blocked text, critical state, and warm focus. They do not
replace P1 primitives or introduce another collection. The only Figma write in
this wave added the missing `space/10` (`VariableID:60:2`), `space/14`
(`VariableID:60:3`), and `space/18` (`VariableID:60:4`) variables to the
existing `SimWar P1` collection. Each is `FLOAT`, scoped to `GAP`, and exposes
the matching `var(--sw-space-*)` web code syntax; readback confirmed values
10, 14, and 18 in mode `14:0`.

## Component mapping

| Figma component/variant | Existing code authority | Mapping decision |
| --- | --- | --- |
| `SimWar / AppShell` (`19:340`) | `packages/ui/src/components/AppShell.tsx` | Reuse; no shell rewrite |
| `SimWar / DataTable` (`19:344`) | `packages/ui/src/components/WorkbenchFrame.tsx` | Reuse existing workbench pattern |
| `SimWar / StatusBadge` (`19:348`) | `packages/ui/src/components/AuthorityBadge.tsx` | Reuse; preserve official/advisory/shadow semantics |
| `SimWar / DecisionForm` (`19:352`) | `apps/student/src/App.tsx` and existing workflow panels | Reuse; no decision truth changes |
| `SimWar / AIAdviceCard` (`19:356`) | `packages/ui/src/components/AuthorityBadge.tsx` and advisory panels | Preserve advisory-only boundary |
| `SimWar / ReplayDiffCard` (`19:360`) | `packages/ui/src/components/WorkbenchFrame.tsx` | Preserve replay read-only semantics |
| `ActionButton` set (`29:8`) | `AllowedActionButton` | Reuse primary/secondary/disabled intent |
| `StateBadge` set (`29:17`) | `AuthorityBadge` | Reuse official/draft/shadow/advisory intent |
| `StatePanel` set (`29:30`) | `StatePanel` | Reuse ready/loading/error behavior |
| `FormField` set (`29:43`) | Existing app form controls | Reuse labels/error/disabled semantics |

## P2-B stage mapping

- Student `40:28`: result → story → mechanism → what-if → reflection →
  transfer, implemented by `P2BDecisionLearningJourney.tsx` and its CSS.
- Teacher `43:57`: today → highest blocker → cohort progress → teachable
  moment → debrief prep, implemented by `P2BTeacherDebriefWorkspace.tsx` and
  its CSS.
- Both boards use the shared authority badge, action control, safe projection,
  known-limit, and recovery patterns. What-if output remains explicitly
  non-official; reflection/notes remain local and cannot enter settlement truth.

## Fidelity and safety checks

The visual implementation now maps the P2-B handoff colors and geometry to
shared CSS variables, keeps a minimum interactive height of 44px, preserves
responsive one-column collapse, and adds a focused token contract test that
rejects reintroducing the old app-local palette. Automated visual confidence is
not human validation: the final receipt must still distinguish browser/a11y
automation from human sign-off, Pilot, and Production.
