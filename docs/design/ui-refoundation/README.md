# SimWar UI Refoundation：PR1 审计与设计冻结索引

本目录是 Product PR1 的可审计设计冻结面。它记录当前 exact source、Figma 状态、Graphify/CodeGraph provenance、三端页面/状态边界、共享组件合同、已实现的 `@simwar/ui` foundation 与 DesignSystemLab，以及视觉基线索引；它不宣称 WCAG、视觉回归、Human Validation 或生产页面已完成。

## Provenance

| 项目                                | 当前值                                                                                                                                                                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| source SHA                          | `bb343faf0c38e4a4a6d8b7928d0a0f35ecf8ad37`                                                                                                                                                                                                                                                        |
| product worktree                    | `D:\codex\SimWar-fe-wave-001-p1-foundation` / branch `codex/fe-wave-001-foundation`                                                                                                                                                                                                               |
| Figma                               | `SimWar Design System V6.0` / key `g73vJXbLoQVhY87lbUaueL` / `P1_PASS`                                                                                                                                                                                                                            |
| Figma validation                    | variables/styles `P1_PASS`；6 collections / 68 variables；WEB syntax/scope/alias PASS；3 physical pages / 12 logical sections；editable component variants/final screens/Code Connect `BLOCKED_BY_PLAN_LIMIT`；`FIGMA_STARTER_3_PAGE_LIMIT` + `FIGMA_STARTER_MCP_RATE_LIMIT`                      |
| Graphify                            | external `graph.json` `built_at_commit=bb343faf0c38e4a4a6d8b7928d0a0f35ecf8ad37`；11,745 nodes / 18,781 links / 18,643 extracted / 138 inferred / 796 communities / 10 gods / 5 surprises；manifest 没有 SHA 字段                                                                                 |
| CodeGraph                           | v1.2.0；`lastIndexed=2026-08-12T16:39:12.596Z`；473 files / 7,514 nodes / 30,596 edges / pending 0 / mismatch null                                                                                                                                                                                |
| PR #372 historical pre-W025 capture | `updatedAt=2026-08-12T16:42:29Z`；旧 head `64fac64bca2138abb33e2db731714ba9bc864254`；base `bb343faf0c38e4a4a6d8b7928d0a0f35ecf8ad37`；当时 quality/browser-smoke/Analyze/CodeQL SUCCESS；6 unresolved threads；仅保留为历史证据                                                                  |
| PR #372 post-W025 merge readback    | merged `2026-08-13T00:33:12Z`；final head `a24dad3f8d3aca905fafb0a42f05b2309e16e02f`；merge commit/protected `origin/master` `93883f47af9d1ee8892eeabf40f78240c186589a`；36 files；CI quality/browser-smoke 与 CodeQL Analyze JavaScript and TypeScript/CodeQL SUCCESS；6 review threads resolved |
| live PR #365                        | OPEN/CONFLICTING；exact head `0fd0cd2c85b5012512716c53b89951cc442db748`；base `675f…`（capture 仅提供前缀）；Advisor/W020 overlap ownership remains protected                                                                                                                                     |

Graphify 与 CodeGraph 只用于架构/影响分析，不是 readiness 或 merge 证明。受污染工作树中的 `isolated/` 副本仅作 historical background；它们不进入当前 exact-SHA 结论。Figma 是视觉规格工具，不是 Authority、permission、truth、settlement 或 Student visibility 的来源。

## Post-W025 integration readback (2026-08-13)

PR1 was locally rebased onto the protected `origin/master` merge commit
`93883f47af9d1ee8892eeabf40f78240c186589a`; the replayed implementation commit
is `639b063ea8f6f535a9114fbd558c841191c776e7`. The remote PR #373 head
`a43609dc0011c655bc1b6f7850ab68cf8027b1de` remains a historical/stale draft
until Sol republishes it; no push or PR mutation occurred in this readback.
All W025 files and behavior remain in the rebased tree, and the PR1 UI
workspace, scripts, lockfile entry, and build/test additions are retained.

## PR1 implementation and lab receipt

The tracked `@simwar/ui` foundation is implemented in the Product PR1
working tree. Core exports are `AppShell`, `ContextBar`,
`AuthorityBadge`, `AllowedActionButton`, `ReceiptPanel`,
`KnownLimitBanner`, and `StatePanel`; their durable source
paths are recorded in `code-connect-map.json`. `RoleNavigation`
and `EvidenceDrawer` remain target-not-present. `DesignSystemLab`
is implemented at `packages/ui/src/DesignSystemLab.tsx` with tracked
entry `packages/ui/lab/main.tsx`.

Run from the repository root:

```powershell
npm run dev:lab -w @simwar/ui
npm run build:lab -w @simwar/ui
```

The lab serves on `http://localhost:3004` and `build:lab` writes to the
ignored `packages/ui/dist/lab` directory. These commands exercise the
code-first implementation; Figma variables/styles remain `P1_PASS`, while
editable Figma component variants, final screens, and Code Connect remain
`BLOCKED_BY_PLAN_LIMIT` under both Figma limit codes.

The frozen initial PR1 lab browser evidence is indexed in
`visual-baseline/README.md`: external root
`C:\Users\Marshall\.codex\visualizations\2026\08\12\019ff6ce-99bb-7100-b86c-f47b294d077a\fe-pr1-design-system-lab`,
runtime JSON hash `E5CD...3764F`, and four automated viewports. The fresh
post-W025 rebase readback is stored separately at
`C:\Users\Marshall\.codex\visualizations\2026\08\12\019ff6ce-99bb-7100-b86c-f47b294d077a\fe-pr1-post-w025-rebase`;
its `receipt.json` and four screenshot hashes are the mutable integration
evidence for source `639b063ea8f6f535a9114fbd558c841191c776e7`. No binary
evidence is copied into the repository.

## Artifact index

| artifact                                                                 | purpose                                                                                                   | source/owner                    |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------- |
| [`principles.md`](./principles.md)                                       | Apple-inspired interaction rules、商学院编辑 VI、中文 copy、状态、响应式、Figma/code contract             | PR1 design owner                |
| [`current-reality-receipt.md`](./current-reality-receipt.md)             | current reality、FE_UI_DEBT_BASELINE、Graphify/CodeGraph/Figma/PR evidence、Known Limits                  | exact SHA + runtime receipt     |
| [`page-inventory.csv`](./page-inventory.csv)                             | observed browser-root/section/workbench inventory、source/BFF/state evidence                              | current apps + runtime          |
| [`route-state-matrix.csv`](./route-state-matrix.csv)                     | logical route/BFF aggregate × state/command evidence matrix                                               | source/BFF + bounded runtime    |
| [`component-inventory.csv`](./component-inventory.csv)                   | duplicate families、target shared components、state/authority/ownership contract                          | current apps + design freeze    |
| [`authority-visibility-boundary.md`](./authority-visibility-boundary.md) | Sole Writer、BFF projection、Student forbidden fields、canonical AuthorityBadge enum、ReceiptPanel fields | contracts/source readback       |
| [`open-pr-ownership-map.md`](./open-pr-ownership-map.md)                 | #372 merge readback, #365 ownership, and serial Product PR/Governance boundaries                          | GitHub readback                 |
| [`design-tokens.json`](./design-tokens.json)                             | token values, state taxonomy, accessibility, exact Figma WEB name families                                | Figma P1_PASS + design contract |
| [`code-connect-map.json`](./code-connect-map.json)                       | Figma physical/logical page map, component/state mapping, AuthorityBadge/ReceiptPanel mapping             | Figma P1_PASS + source paths    |
| [`visual-baseline/README.md`](./visual-baseline/README.md)               | external screenshot/DOM/ARIA/runtime evidence index; no binaries copied                                   | external Luna evidence root     |

## Current vs historical facts

“Current” means the source SHA or live capture explicitly listed above. “Historical” means an earlier bounded preflight or polluted graph observation retained only to explain provenance and not to describe present state.

| fact                                                                                                                                                                                         | classification                                        | rule                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| #372 head `64fac64bca2138abb33e2db731714ba9bc864254`, checks SUCCESS                                                                                                                         | historical pre-W025 capture                           | retain only as bounded historical evidence; do not describe as current open state                                                    |
| #372 merged final head `a24dad3f8d3aca905fafb0a42f05b2309e16e02f`, merge/master `93883f47af9d1ee8892eeabf40f78240c186589a`, 36 files, all four required checks SUCCESS, six threads resolved | current post-W025 integration readback                | protected master is exact `93883f47af9d1ee8892eeabf40f78240c186589a`; local PR1 rebase is `639b063ea8f6f535a9114fbd558c841191c776e7` |
| #372 old head `574ce707fcca77fec74f5dc3c3a9969f39b3de14` and its old browser-smoke failure                                                                                                   | historical preflight only                             | never report as current failure; do not repair in UI PR                                                                              |
| Graphify `built_at_commit=bb343...` and exact node/link/extracted/inferred counts                                                                                                            | current external index provenance                     | manifest lacks SHA, so retain the explicit limitation                                                                                |
| `isolated/` CodeGraph copies                                                                                                                                                                 | historical background                                 | not a readiness or source-of-truth signal                                                                                            |
| current-product runtime screenshots/DOM/ARIA in `fe-current-baseline-luna`                                                                                                                   | current product baseline captured at 1440×900         | not final design, WCAG PASS, or human validation                                                                                     |
| PR1 DesignSystemLab runtime/screenshot evidence in `fe-pr1-design-system-lab`                                                                                                                | current code-first lab evidence at 1440/1280/1024/390 | automated/product-lab evidence only; not WCAG AA, Human Validation, or production proof                                              |

## Page/route/state crosswalk

`page-inventory.csv` answers “what UI surface was observed in the three root apps?” Its `inventory_id` values represent browser root, authenticated section, or logical Enterprise surface. `route-state-matrix.csv` answers “what BFF/API route or command composes that surface, and which states are observed/source-only/unknown?” Its `matrix_id` values may be one-to-one, one-to-many, or matrix-only because several controls share one page and some commands have no distinct visual page.

| inventory/page IDs                                                                                                                                                                                         | state/route matrix IDs                                                                                                                                               | interpretation                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADM-LOGIN`, `ADM-LIMITS`, `ADM-SUMMARY`, `ADM-STATE`, `ADM-USERS`, `ADM-TENANT-BASELINE`                                                                                                                  | `ADM-ROOT`, `ADM-TENANT`, `ADM-AUTHORITY`, `ADM-STATE`, `ADM-USERS`, `ADM-TENANT-BASELINE`                                                                           | root/identity and tenant admin surfaces; matrix rows split API projections and commands that share the root page                                                                                           |
| `ADM-D5`, `ADM-D6`, `ADM-REPORT`, `ADM-PACKAGE`, `ADM-LIFECYCLE`                                                                                                                                           | `ADM-D5`, `ADM-D6`, `ADM-REPORT`, `ADM-PACKAGE`                                                                                                                      | workbench pages with BFF aggregation; lifecycle controls remain part of the root page and are represented by `ADM-ROOT`/`ADM-TENANT` plus source row                                                       |
| `TCH-LOGIN`, `TCH-LIMITS`, `TCH-RUN`, `TCH-RUN-CONTROLS` (alias of `TCH-RUN-COMMANDS`), `TCH-PACKAGE-SURFACE`                                                                                              | `TCH-ROOT`, `TCH-RUN-COMMANDS`                                                                                                                                       | root page and M1 teaching package; `TCH-RUN-CONTROLS` is the observed run-control page ID mapped to the aggregate command matrix `TCH-RUN-COMMANDS`, which is intentionally separate from the root section |
| `TCH-GOLDEN`, `TCH-VALIDATION`, `TCH-CLOSURE`, `TCH-EVIDENCE`, `TCH-CONFIRM`, `TCH-D5`, `TCH-REPORT`, `TCH-D6`, `TCH-D1`, `TCH-PACKAGE`, `TCH-E4`, `TCH-ROLE`, `TCH-INTEL`, `TCH-ADVISOR`, `TCH-BLUEPRINT` | `TCH-GOLDEN`, `TCH-VALIDATION`, `TCH-CLOSURE`, `TCH-EVIDENCE`, `TCH-CONFIRM`, `TCH-D5`, `TCH-REPORT`, `TCH-D6`, `TCH-DESIGN`, `TCH-ROLE`, `TCH-INTEL`, `TCH-ADVISOR` | Teacher workbench sections map to dedicated BFF aggregates; `TCH-DESIGN` groups Learning Design and Blueprint API paths because they share one logical teaching-design task                                |
| `STU-LOGIN`, `STU-LIMITS`, `STU-STATUS`, `STU-ONBOARD`                                                                                                                                                     | `STU-ROOT`, `STU-COCKPIT`                                                                                                                                            | Student root/identity/status/onboarding sections are one page; cockpit BFF owns the safe projection                                                                                                        |
| `STU-GOLDEN`, `STU-ROLE`, `STU-ADVISOR`, `STU-REPORT`, `STU-DECISION`                                                                                                                                      | `STU-GOLDEN`, `STU-ROLE`, `STU-ADVISOR`, `STU-REPORT`, `STU-DECISION`                                                                                                | Student workbench/form surfaces with explicit safe projection and command rows                                                                                                                             |
| `ENT-LOGICAL`                                                                                                                                                                                              | `ENT-LOGICAL`                                                                                                                                                        | matrix-only logical workspace: no independent Enterprise route/app/BFF exists at this SHA; UI must show closed/known-limit or reuse existing Admin/Teacher contract                                        |

Rows marked `source`, `not captured`, `known limit`, or `not implemented` are not failures hidden by the design system; they tell later PRs what evidence must be added. No matrix row authorizes a new writer or visibility expansion.

## Reproducible checks

Run from `D:\codex\SimWar-fe-wave-001-p1-foundation` (these checks do not stage or mutate Git):

```powershell
$artifactRoot = 'docs/design/ui-refoundation'
Get-Content "$artifactRoot/design-tokens.json" -Raw | ConvertFrom-Json | Out-Null
Get-Content "$artifactRoot/code-connect-map.json" -Raw | ConvertFrom-Json | Out-Null
foreach ($file in 'page-inventory.csv','route-state-matrix.csv','component-inventory.csv') {
  $rows = @(Import-Csv "$artifactRoot/$file")
  $columns = (Get-Content "$artifactRoot/$file" -TotalCount 1).Split(',').Count
  if (@($rows | Where-Object { @($_.PSObject.Properties).Count -ne $columns }).Count -gt 0) { throw "non-rectangular CSV: $file" }
  Write-Output "$file rows=$($rows.Count) columns=$columns"
}
git diff --check -- docs/design/ui-refoundation
```

The exact-SHA debt scan recorded in `current-reality-receipt.md` is reproducible with:

```powershell
$sourceRoot = 'D:\codex\SimWar-fe-wave-001-reality-20260813'
$sourceRootSlash = ($sourceRoot -replace '\\','/').TrimEnd('/')
$sourcePrefixRegex = [regex]::Escape($sourceRootSlash)
$files = @(
  rg --files "$sourceRoot/apps" |
    ForEach-Object { $_ -replace '\\','/' } |
    Where-Object { $_ -match ('^' + $sourcePrefixRegex + '/apps/[^/]+/src/.*\.(ts|tsx|css)$') }
)
$colorPattern = '#[0-9A-Fa-f]{3,8}\b|rgba?\([^)]*\)'
$unitPattern = '(?<![\w.-])-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|vh|vw|%)\b'
$colorCount = ($files | ForEach-Object { [regex]::Matches((Get-Content $_ -Raw), $colorPattern).Count } | Measure-Object -Sum).Sum
$unitCount = ($files | ForEach-Object { [regex]::Matches((Get-Content $_ -Raw), $unitPattern).Count } | Measure-Object -Sum).Sum
if ($files.Count -ne 44 -or $colorCount -ne 258 -or $unitCount -ne 682) {
  throw "Unexpected exact-SHA scan: files=$($files.Count) colors=$colorCount units=$unitCount"
}
Write-Output "files=$($files.Count) colors=$colorCount units=$unitCount"
```

The reported result is 258 color references and 682 unit-like literals for 44 files. A plain JSX/quoted ASCII scan is deliberately only a heuristic upper bound for locating possible English residue; it is not a language coverage percentage, translation completeness claim, or accessibility result.

## Known limits

- Figma variables/styles have `P1_PASS`, but editable component variants, final product screens, and Code Connect are `BLOCKED_BY_PLAN_LIMIT` under `FIGMA_STARTER_3_PAGE_LIMIT` and `FIGMA_STARTER_MCP_RATE_LIMIT`.
- No independent Enterprise app/BFF/route exists; do not create a second business Authority for visual completeness.
- The current-product baseline remains `1440×900` only; the PR1 lab has automated evidence at `1440×900`, `1280×800`, `1024×768`, and `390×844`. Neither set is a pixel diff, Axe, 200% zoom, real screen-reader, WCAG AA, Human Validation, or production proof.
- Full page-state and command-state coverage is not yet proven; matrix evidence levels are intentionally explicit.
- PR #365 remains external mutable state and currently OPEN/CONFLICTING; refresh before later ownership decisions. No human approval, pilot, production deployment or human validation is claimed here.
- The PR1 Product scope includes documentation plus the implemented `@simwar/ui` foundation and code-first DesignSystemLab; later PRs still must integrate app migrations and rerun exact-head browser/accessibility gates.
