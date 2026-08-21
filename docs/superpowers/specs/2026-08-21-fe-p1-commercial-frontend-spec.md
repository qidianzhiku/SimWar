# SimWar P1 Figma Commercial Frontend Specification

## Goal

Move the current SimWar frontend from a read-only Figma foundation to a production-quality visual foundation: the shared UI package and the Admin, Teacher, and Student visual layers must use the approved Figma P1 tokens and component grammar, while preserving every existing BFF projection, permission boundary, canonical Decision path, settlement truth field, and route contract.

## Visual authority

- Figma file: `6ezOykmrZbMbFEYPfIkZ07`
- P1 foundation canvas: `13:2`
- P1 foundation board: `13:3`
- Components page: `18:4`
- Existing P2-B page: `39:2`
- Existing component sets: `29:8` ActionButton, `29:17` StateBadge, `29:30` StatePanel, `29:43` FormField
- Figma variables are the source of truth for visual values; current code tokens are mapped to them and must not introduce a second design system.

## Product boundaries

- UI may consume BFF/server projections only; it may not read a business store or formal writer directly.
- No change to simulation-core, settlement, replay truth hash, canonical Decision selection, score/rank, truth/state_true writers, RBAC semantics, tenant visibility, AI provider/model activation, PostgreSQL activation, or backend business logic.
- Student and Teacher advisory surfaces remain advisory-only and role-safe.
- Human validation, Pilot, and Production remain explicitly unperformed/unauthorized claims even when automated gates pass.

## In-scope implementation

1. Normalize the existing shared token layer to the Figma P1 values, including semantic status/authority/learning/advisory/counterfactual colors, spacing, radius, control size, focus, motion, and typography.
2. Reuse and extend `@simwar/ui` components rather than creating a parallel UI authority. Core components must expose explicit supported states or document `NOT_APPLICABLE`.
3. Replace duplicated P2-B local colors and geometry with shared tokens without changing state or data semantics.
4. Refine AppShell/navigation/context/status/recovery grammar across Admin, Teacher, and Student using existing hash sections and the current BFF route wiring.
5. Add focused unit/component/browser/a11y/responsive coverage for changed visual states.
6. Maintain a Figma-to-code map and a commercial delivery receipt with exact current SHA, Figma node IDs, changed files, checks, known limits, and rollback notes.

## Acceptance gates

- `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:contract`, `npm run build`, hidden-Unicode and security checks pass or are classified with exact existing limitations.
- Real-BFF browser evidence uses `MOCK_COUNT=0` where the flow needs backend interaction.
- Responsive evidence covers `1440x900`, `1280x800`, `1024x768`, and `390x844`.
- Keyboard order, visible focus, semantic headings/labels, error association, non-color state cues, reduced motion, 200% text zoom, and 44px touch targets are verified.
- `FIGMA_CODE_DELTA` contains only `MATCHED` or documented `ACCEPTABLE_DIFFERENCE`; `BLOCKING_MISMATCH=0`.
- Product PR contains Summary, Validation, Scope Notes, Figma file/node, visual source of truth, design-system delta, three workspace deltas, authority boundaries, known limits, and rollback.
- Post-merge validation uses a fresh detached checkout of final master; governance closure is docs-only and separate from product code.
