# Design-system consumption proof — Phase 1

## Proven now

- @simwar/ui is already imported by Teacher, Student, and Admin applications.
- Shared exports include AppShell, RoleNavigation, WorkbenchFrame,
  AuthorityBadge, ContextBar, StatePanel, KnownLimitBanner, and ReceiptPanel.
- packages/ui/src/tokens.css is an actual code source consumed by the UI
  package and applications.
- The foundation contract is source-bound to existing exports and covered by
  tests/unit/uiux-v2-foundation.test.ts.
- Storybook 10.6.0 is installed for @simwar/ui, builds with React + Vite,
  and includes the a11y and Vitest addons without replacing DesignSystemLab.
- Fresh Figma readback proves existing foundation and portal boards, plus the
  isolated UIV2 Governance Board (page 301:2, frame 301:3) created in this
  slice.
- Fresh Figma screenshot PNG bytes are stored under screenshots/figma/ with
  SHA256 receipts.

## Explicit limits

- Exact role-specific Figma authority is not proven for every one of the 36
  registry entries; current portal boards are reference candidates pending
  surface-level rebinding.
- Figma token parity is partial: 31 variables and six text styles exist, but
  one-to-one parity with packages/ui/src/tokens.css is not complete.
- Some existing Figma variables use broad ALL_FILLS scopes; scope repair is a
  future design decision, not an implicit mutation in this slice.
- Code Connect is unavailable for the current seat/plan.
- Storybook build is proven; a full interactive browser/a11y run and all
  surface baselines are not yet proven.
- Consumer counts in COMPONENT_RECONCILIATION.json are a source census, not a
  permission to mutate canonical shared UI.

## Required next slice

Use the governance board and current portal/reference boards to bind the first
role-spine consumers. Add exact surface-level Figma targets only where a real
consumer exists, then run risk-based browser screenshots at 1440/1024/390
(and 1280/768 for critical journeys). Do not duplicate 01 Design System or
02 Components, and do not treat Storybook build success as Product Acceptance.