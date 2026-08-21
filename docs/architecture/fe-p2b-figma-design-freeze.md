# FE-19 / FE-20 P2-B Figma design freeze

## Provenance

- Mission: `SIMWAR-FE-P2B-DECISION-LEARNING-TEACHER-DEBRIEF-001`
- Starting master: `eb2314c6601779f720f399a003e623ac85119ef0`
- Implementation branch: `codex/fe-p2b-recompile-20260820`
- Figma file: `6ezOykmrZbMbFEYPfIkZ07`
- Figma page: `39:2` (`11 P2-B Decision Learning & Teacher Debrief`)
- External mutation ledger: `C:/Users/Marshall/AppData/Local/Temp/simwar-p2b-figma-state-ledger.json`

## Frozen screen inventory

Student screens are `S-P2B-01` through `S-P2B-06` (`40:28`, `40:64`, `40:97`, `40:125`, `43:4`, `43:32`). Teacher screens are `T-P2B-01` through `T-P2B-05` (`43:57`, `43:90`, `43:119`, `44:11`, `44:39`). Mobile frames are preserved at 390px. Responsive clones were added at 1280px and 1024px for all eleven desktop workflows; their IDs are recorded in the external ledger.

The state matrix `46:19` now explicitly distinguishes loading, unpublished/blocked, empty, published/ready, stale, error, recovery, committed, and unknown-context. Row two uses wrapping so the unknown card is not clipped.

## Design-system evidence

The P2-B page reuses the existing `ActionButton` and `StateBadge` instances, with code references to `AllowedActionButton` and `AuthorityBadge`. The existing `SimWar P1` variable collection was retained. All 26 original variables received explicit web code syntax and meaningful scopes. Two semantic surface variables were added:

- `VariableID:53:16` — `color/surface/warm`, `FRAME_FILL`/`SHAPE_FILL`, `var(--sw-color-surface-warm)`
- `VariableID:53:17` — `color/surface/navy`, `FRAME_FILL`/`SHAPE_FILL`, `var(--sw-color-surface-navy)`

Representative canvas, AppShell header, card fill, and border nodes are bound to those variables. The Figma design context confirms `StateBadge` maps to `packages/ui/src/components/AuthorityBadge.tsx` and `ActionButton` maps to `packages/ui/src/components/AllowedActionButton.tsx`.

## Prototype and interaction boundary

The page previously had zero reactions. Bounded same-page top-level reactions now connect the Student result/story/mechanism/reflection path and the Teacher today/blocker/cohort/teachable path. Figma rejected nested CTA destinations because the destination must be a different top-level frame; the final connections therefore use the exact top-level screen frames and do not imply an API command, permission grant, counterfactual writer, or settlement mutation.

## Independent design review

Post-mutation screenshots were reviewed for the Student result, Teacher today, Student mobile reflection, and state matrix. The result screen now has four metric cards and its story CTA; the teacher screen has the today/blocker CTA and bounded status hierarchy; the mobile reflection keeps all three learner inputs and a 44px save action; the state matrix wraps all nine states without clipping.

`DESIGN_GATE=PASS_WITH_LIMITS`: the Figma prototype is a high-fidelity implementation reference, not proof of every runtime BFF state. Product Design MCP was unavailable in this environment, so the structured audit fallback was used. Human visual approval was not performed.
