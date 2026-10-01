# UI/UX V2 Phase 1 Foundation Evidence

This directory records the first post-PR514 foundation slice. It is not Product
Acceptance, Human Validation, browser visual parity, or a claim that all 36
surfaces have already been redesigned.

The reachable denominator is derived from current role navigation sources:

- Teacher: 12 targets in apps/teacher/src/TeacherCourseWorkspace.tsx
- Student: 13 targets in apps/student/src/App.tsx
- Admin: 11 targets in apps/admin/src/AdminDeliveryTrustWorkspace.tsx

## Fresh Figma baseline

The current Figma file contains an existing SimWar foundation and portal
baseline. Fresh Plugin API readback identified:

- 01 Design System / page 18:3 / frame 19:45 / 1440x1820
- 02 Components / page 18:4 / frame 19:206 / 1440x2320
- 03 Teacher Portal / page 18:5 / frame 20:2 / 1440x1940
- 04 Student Portal / page 18:6 / frame 20:105 / 1440x2080
- 05 Admin Portal / page 18:7 / frame 20:210 / 1440x2020
- UIV2 Governance & Registry / page 301:2 / board 301:3 / 1440x836

The governance board is the only new authoring in this slice. It binds the
existing pages to code and consumer rules; it does not duplicate the existing
design system or promote a portal board into exact 36-surface authority.

The file currently has local collection SimWar P1 with 31 variables and six
Inter text styles. Several historical variables use broad ALL_FILLS scope;
this is recorded as scope debt and was not silently edited. Code Connect is
unavailable for the current seat/plan.

## Boundaries

- packages/ui/src/tokens.css remains code-authoritative.
- Existing Figma pages/nodes remain unchanged; the new governance page is
  isolated and read back by metadata plus actual PNG bytes.
- Community Figma libraries are reference-only.
- Product truth, BFF contracts, stores, writers, and role business behavior are
  outside this foundation slice.
- Role-specific exact frame authority for all 36 surfaces remains unproven
  until each surface is rebound with browser evidence.