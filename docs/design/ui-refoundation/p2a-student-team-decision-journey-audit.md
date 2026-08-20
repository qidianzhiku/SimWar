# P2-A Student / Team Decision Journey — Product Design Audit

Date: 2026-08-20
Product surface: SimWar Student (`/`)
Figma file: `6ezOykmrZbMbFEYPfIkZ07`
Figma reference frames: `34:2` (Student / Ready / Desktop), `36:2` (Prototype Flow / Desktop)
Audit mode: read-only Figma inspection + local browser capture; no Figma edits during this audit.

## Scope and route mapping

The current implementation is a hash-based single-page Student workspace. The P2-A journey is mapped to the existing Student surface rather than a new route:

| Journey step                     | Current UI location                                                      | Current code mapping                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enter current run / role context | `#student-role-mission`, `#student-cockpit`                              | `apps/student/src/App.tsx` context projection and `StudentRoleWorkflowPanel`                                                                                      |
| Private judgment                 | `#student-private-draft` + `#student-w027-decision-experience`           | `StudentRoleWorkflowPanel` remains the canonical role-draft/merge/confirm writer; `W027DecisionExperiencePanel` owns private judgment capture and safe projection |
| Role-safe position               | W027 section 02                                                          | `W027DecisionExperiencePanel.tsx`, read-only `own_role_position` / `team_safe_positions` projection                                                               |
| Divergence and dissent           | W027 section 03 + `#student-divergence`                                  | W027 resolution/acknowledgement endpoints plus existing generic divergence surface                                                                                |
| Team merge and formal confirm    | `#student-private-draft`, `#student-confirmation`, `#student-submission` | Existing `StudentRoleWorkflowPanel` and App confirmation chain; P2-A does not introduce a second canonical writer                                                 |
| Canonical readback               | `#student-results` and W027 readback section                             | Existing server-published result surface; W027 labels Confirm, Round Lock, and Settlement as distinct states                                                      |

No new browser route or navigation item was added. This preserves the existing stable Student location contract and avoids a second decision surface.

## Figma inspection

### Page and frame structure

- `04 Student Portal` (`18:6`) contains the Student portal flow. The relevant frames are S-001 course entry, S-002 dashboard, S-004 decision, S-005 confirm, S-007 feedback, and S-008 advice.
- `08 Prototype Flow` (`18:10`) contains the teacher, student, and governance lanes. The Student lane is Enter → Observe → Draft → Validate → Confirm → Feedback, with 401/403/stale/command-conflict recovery annotations.
- `09 Mobile & Tablet` (`18:11`) covers 1440, 1024, and 390 widths, including sidebar collapse, bottom navigation/drawer behavior, 44px controls, no-overflow, and error/forbidden/stale recovery.
- The added P2-A Figma frames are `34:2` and `36:2`. They are documentation/visual references only; the implementation continues to consume server DTOs and existing role-workflow writers.

### Components, variables, and design system

The file contains 26 local variables: color, spacing, radius, focus-ring, and control min-height tokens. The most directly relevant tokens are `color/brand/primary`, `color/state/success`, `color/state/warning`, `color/state/danger`, `color/surface/base`, `color/text/strong`, `color/text/muted`, `color/focus/ring`, `color/official`, `color/replay`, and `control/min-height`.

Component sets include:

- `ActionButton`: primary, secondary, disabled;
- `StateBadge`: official, draft, shadow, advisory;
- `StatePanel`: ready, loading, error;
- `FormField`: default, error, disabled.

The P2-A implementation maps these concepts to existing React/CSS primitives rather than introducing a second design system. W027 uses the existing panel, status, button, field, and responsive shell conventions, with scoped `.w027-*` presentation rules.

### Direct code mappings

| Figma concept                               | Existing code mapping                                                                       | Assessment                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Student AppShell and role navigation        | `packages/ui/src/components/AppShell.tsx`, `RoleNavigation.tsx`, `apps/student/src/App.tsx` | Direct mapping                                                |
| Loading / error / denied state              | `StatePanel` patterns plus W027 `data-state` and `role=alert`                               | Direct mapping with explicit W027 recovery                    |
| Private judgment fields                     | `W027DecisionExperiencePanel.tsx` full FE-16 field set                                      | Direct mapping to existing W027 BFF contract                  |
| Safe role position                          | W027 `own_role_position` and `team_safe_positions`                                          | Direct read-only mapping; no client writer added              |
| Divergence / dissent                        | W027 resolution and acknowledgement commands                                                | Direct mapping to existing endpoints, server permission-gated |
| Team merge / formal confirm                 | `StudentRoleWorkflowPanel.tsx` only                                                         | Reused; no duplicate canonical writer                         |
| Readback / published result                 | Existing Student result and feedback surfaces                                               | Reused; W027 only renders stage provenance/readback labels    |
| 44px targets, responsive layout, focus ring | Existing shared/app CSS plus scoped W027 rules                                              | Direct presentation mapping; browser-checked at 1440/1024/390 |

Figma Code Connect remains unavailable because the file is seat-limited. No retry or paid-seat workaround was attempted.

## Browser evidence

Screenshots were captured from the current local Student app after signing in as the demo Student (`tenant_demo` / `student`) against the JSON runtime. The current demo has no open run, so the honest W027 state is read-only/unknown rather than an invented ready state.

- `C:\Users\Marshall\AppData\Local\Temp\simwar-fe-p2a-audit\01-student-1440.png` — shell and sign-in context at 1440px.
- `C:\Users\Marshall\AppData\Local\Temp\simwar-fe-p2a-audit\02-student-1024.png` — responsive shell at 1024px.
- `C:\Users\Marshall\AppData\Local\Temp\simwar-fe-p2a-audit\03-student-390.png` — narrow responsive shell at 390px.
- `C:\Users\Marshall\AppData\Local\Temp\simwar-fe-p2a-audit\04-w027-1440.png` — W027 read-only/round-not-open state at 1440px.
- `C:\Users\Marshall\AppData\Local\Temp\simwar-fe-p2a-audit\05-student-1280.png` — responsive shell at 1280px.

Measured in the live browser:

- `document.documentElement.scrollWidth === innerWidth` at 1440, 1280, 1024, and 390;
- visible buttons in the captured Student surface were at least 44px high;
- no forbidden private/truth strings (`state_true`, `replay_hash`, `created_by`, `other_team`) appeared in the Student DOM;
- W027 rendered `data-state="unknown"` with “当前回合未开放编辑；已保留只读边界。”;
- browser console contained only the existing favicon 404 and React development messages; no application exception was observed.

## Findings

1. **Strong — explicit authority boundaries.** The W027 panel explains that private full text is self-only, safe positions are server projections, and merge/confirm remains in `StudentRoleWorkflowPanel`. This aligns the visual flow with the Figma governance lane and prevents a second canonical writer.
2. **Strong — honest empty/blocked state.** With no open round, the page does not expose editable fields or confirmation actions. The W027 section gives a clear read-only explanation and a refresh action.
3. **Strong — recovery behavior.** Same-context local edits survive a failed refresh, stale server projection is cleared, and a successful private save is not mislabeled as failed merely because a later readback refresh failed. Unit coverage exercises these paths.
4. **Watch — current shell is content-heavy.** At 1440px, the Student surface still presents many legacy workbenches above and below W027. This is structurally consistent with the existing stable-location contract, but a commercial handoff would benefit from a dedicated journey entry point or progressive disclosure after broader route evidence is available. No new nav item was added in this change to avoid breaking the existing location contract.
5. **Watch — bilingual technical copy.** W027 intentionally retains technical stage labels (`Role READY`, `Team Confirm`, `Round Lock`, `Settlement`) for provenance. Product copy can be localized later, but the technical labels should remain stable if they are used in evidence or support workflows.

## Accessibility and evidence limits

The browser checks above cover target size, responsive overflow, visible state semantics, and privacy-text absence. They do not constitute a full WCAG audit. In particular, this run did not measure color contrast with Axe, complete keyboard order/focus return across every panel, screen-reader output, zoom at 200%, or a ready-state W027 mutation flow. The W027 ready/error/permission paths are covered by focused Vitest fixtures; a live open-round BFF projection was not available in the current JSON demo session.

Human visual validation was not performed. The Figma frames and screenshots are evidence for mapping and review, not approval of production visual fidelity.
