# Plan: SimWar UI/UX V2 Foundation and Storybook Baseline

## Goal

Establish the first post-PR514 foundation slice for the UI/UX V2 target: one
source-bound design-system contract that can be consumed by code, Storybook,
Figma, and browser verification without changing product truth or role-specific
business behavior. The slice must leave a reproducible census of reachable
surfaces, a code-authoritative token ledger, a component reconciliation map,
and a Storybook entry point for the existing shared UI.

## Architecture

- `packages/ui/src/tokens.css` remains the production token authority.
- Existing `@simwar/ui` components remain canonical implementation semantics;
  this phase may add documentation, stories, and tests but does not create a
  second design system or replace existing components wholesale.
- Storybook is an isolated code-state catalog. `DesignSystemLab` remains the
  product-integrated lab and is not removed or repurposed.
- Figma authoring is restricted to new deterministic UIV2 pages. Existing
  evidence pages and nodes remain immutable reference material.
- Role surfaces are measured from actual AppRoot/RoleNavigation reachability;
  a registry entry is not treated as a Figma frame or as Product Acceptance.

## Tech Stack

- React 19 + TypeScript 5.9 + Vite 7 + npm workspaces.
- `@simwar/ui` shared components and CSS custom properties.
- Storybook React/Vite with the a11y and Vitest integrations, only if the
  declared dependency graph can be installed with a frozen lockfile.
- Vitest for contract/unit checks and Playwright for risk-based browser
  baselines; no route mocks for real-BFF evidence.
- Figma connector readback plus bounded isolated authoring; community kits are
  reference-only.

## Spec

1. Freshly bind master, open-PR hot files, role navigation, shared exports,
   current tests, browser infrastructure, and Figma file/page identity.
2. Produce `UI_SURFACE_REGISTRY.csv` using stable surface IDs, a role-local
   owner, user job, canonical pattern family, current design status, and
   risk-based viewport/state evidence. No entry may be `UNKNOWN`.
3. Produce `FIGMA_AUTHORITY_REGISTRY.json` and `TOKEN_PARITY_LEDGER.json`.
   Every disposition must be one of `MAP`, `ALIAS`, `SUPERSEDE`, `RETIRE`,
   `DESIGN_ONLY`, or `CODE_ONLY`; absence of a Figma variable is not a reason
   to invent provenance.
4. Add the minimum Storybook configuration and canonical stories for existing
   high-leverage components. Stories must cover default, relevant state,
   disabled/loading where applicable, mobile behavior, and a11y checks.
5. Add design-system contract tests before expanding component code. Tests must
   assert token export stability, minimum control height, state vocabulary, and
   that Storybook stories reference existing `@simwar/ui` exports.
6. Create isolated Figma UIV2 foundation/component pages only after current
   metadata and authoring guidance prove the write scope. Return every created
   node ID and keep a state ledger; variables precede components.
7. Run focused tests, package build, typecheck, Storybook build, and a small
   browser smoke/readback. Record limitations separately from Product
   Acceptance, Human Validation, and Production.

## Global Constraints

- Do not modify settlement, simulation truth, contracts, BFFs, stores,
  registries, AppRoot business wiring, or role-specific product behavior in
  this foundation slice.
- Do not install shadcn as a canonical system or introduce Radix without a
  proven repeated complex interaction.
- Do not mirror implementation-only CSS tokens into Figma mechanically.
- Do not claim pixel parity, browser acceptance, accessibility certification,
  or Product Acceptance from static metadata or Storybook presence.
- Preserve unrelated dirty worktrees; work only in
  `D:\codex\simwar-uiux-v2-phase1` and stage explicit files.
- Keep the change within one small foundation PR; stop at the Owner merge gate
  if remote mutation or merge authority is not separately available.

## Review Focus

- Is every registry entry reachable from a real role navigation/root path?
- Does each proposed component have at least three consumers or a documented
  cross-role critical-pattern justification?
- Are token mappings code-source-bound, with empty Figma variables and missing
  Code Connect recorded as limits rather than fabricated proof?
- Do Storybook stories exercise state/recovery and mobile behavior without
  changing product runtime semantics?
- Does the Figma page remain an implementation aid rather than a second source
  of business truth?

## Task 1 — Freeze fresh admission and source census

- Files: `package.json`, `package-lock.json`, `packages/ui/src/index.ts`,
  `packages/ui/src/tokens.css`, role AppRoot/RoleNavigation sources, current UI
  tests, and a new evidence directory outside product source if needed.
- Read current master/PR state, open-PR changed paths, current Figma metadata,
  variables, libraries, and Code Connect availability.
- Record the 36 reachable role surfaces and their source anchors; verify the
  role counts from actual navigation arrays rather than historical notes.
- Acceptance: clean branch, exact HEAD/tree receipt, no hot-file collision,
  no `UNKNOWN` surface status, and explicit current Figma authority limits.

## Task 2 — Write RED design-system contract tests

- Files: `packages/ui` test scope or `tests/unit/uiux-v2-foundation.test.ts`.
- Add failing assertions for token contract stability, the 44px control
  minimum, state-status coverage, and canonical export names before any new
  Storybook configuration or helper is added.
- Run the focused test and preserve the expected RED output.
- Acceptance: RED is caused by the missing Phase 1 contract, not by an
  unrelated repository baseline failure.

## Task 3 — Add minimal Storybook baseline and canonical stories

- Files: root/package workspace manifests as required by the real Storybook
  version, `packages/ui/.storybook/*`, and `packages/ui/src/**/*.stories.tsx`.
- Add only the packages/configuration needed for React + Vite, a11y, and
  Vitest integration. Keep `DesignSystemLab` unchanged.
- Start with high-leverage existing components: `WorkbenchFrame`,
  `AuthorityBadge`, `ContextBar`, `StatePanel`, `KnownLimitBanner`,
  `ReceiptPanel`, and `RoleNavigation`.
- Acceptance: frozen install, Storybook build, stories resolve only existing
  exports, and the RED contract becomes GREEN.

## Task 4 — Produce parity ledgers and Figma foundation/component pages

- Files: support evidence/registry artifacts plus the new isolated UIV2 Figma
  pages; no historical node mutation.
- Map code tokens and component semantics into deterministic Figma variables,
  variants, and auto-layout examples where the connector supports them.
- Record node IDs, variable scopes, code syntax, component disposition, and
  exact readback screenshots/metadata.
- Acceptance: Figma write is either fully read back with IDs and screenshots or
  explicitly sealed as `AUTHORING_BLOCKED` without blocking code-only token
  parity.

## Task 5 — Verify, package, and stop at the merge gate

- Run focused tests, `npm run build -w @simwar/ui`, `npm run typecheck`,
  `npm run lint`/format checks applicable to changed files, Storybook build,
  and risk-based browser/a11y evidence.
- Create the phase result ZIP only after hashes, JSON/JSONL, safe paths, and
  archive CRC are verified.
- No Product Acceptance, Human Validation, Production, or automatic successor
  claim is allowed in this phase.
