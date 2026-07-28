# L1-VC-01 — Current Reality与工程基线

**Card Version:** `1.0`<br>
**Repository:** `qidianzhiku/SimWar`<br>
**Source SHA:** `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2`<br>
**Ledger:** `L1-LEDGER-001`<br>
**L1 DoD:** `L1-DOD-001—006`<br>
**Platform Gate:** `P-G0`<br>
**Current Status:** `MERGED_NOT_CLOSED`<br>
**Risk Tier:** `T1/T3`<br>
**Parallel Classification:** `SUPPORTING_ONLY`

## 1. Product and Operator Value

保证所有后续结论绑定同一current master、可重复安装、完整验证和post-merge receipt。

## 2. Stable Technical Contract

- **Primary Outcome type:** one recognizable L1 capability state transition.
- **Entry condition:** current master and graph manifest remain at `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2` or are revalidated.
- **Sole writer:** Repository governance / CI single writer.
- **Resource locks:** CI workflow, package/lockfile, heavy validation slot.
- **Blocks L1:** `true`.
- **Gap classification:** `L1_EVIDENCE_GAP`.

## 3. Current Source Map

- `package.json`
- `.github/workflows/ci.yml`
- `.github/workflows/codeql.yml`
- `scripts/check-hidden-unicode.mjs`
- `scripts/check-direct-store-boundaries.mjs`
- `playwright.config.ts`

## 4. Entry Symbols and Interfaces

- `root npm scripts`
- `CI quality job`
- `browser-smoke job`

## 5. Required Validation

### Focused / Affected

- `npm run check:hidden-unicode`
- `npm run check:direct-store-boundaries`
- `npm run typecheck`

### Closure

- `npm test`
- `npm run test:contract`
- `npm run build`
- `npm run test:e2e:ui`
- `npm run security:audit`

### Negative Matrix

- clean worktree
- no generated residue
- exact source SHA

## 6. Current Gaps

- current-master post-merge fresh-clone receipt未在本规格生成任务中执行

## 7. Graphify / CodeGraph Query Contract

**Graphify intent:** map module ownership, file overlap, resource locks, upstream/downstream capability impact, and candidate path alternatives.<br>
**CodeGraph intent:** trace exact definitions, callers, callees, imports, mutations, handlers, repository calls and test references for the listed entry symbols.<br>
**Required output:** exact source paths, exact symbols, affected tests, writer conclusion, collision report and confidence.<br>
**Stop condition:** graph source SHA differs from current master, writer is ambiguous, or a second Authority path appears.

## 8. Mission Compiler Interface

```yaml
capability_id: {c['id']}
ledger_id: {c['ledger_id']}
dod_reference: "{c['dod']}"
current_state: {c['status']}
target_state: CLOSED_AND_CURRENT
primary_outcome: "One bounded {c['name']} state transition"
sole_writer: "{c['writer']}"
risk_tier: "{c['risk']}"
parallel_classification: {c['parallel']}
resource_locks:
  - "CI workflow"
  - "package/lockfile"
  - "heavy validation slot"
automatic_next_start: false
```

## 9. Explicit Non-Proofs

- CI配置存在不证明current master所有命令已在fresh clone通过
- This card is a technical execution contract, not a current Mission authorization.
- Static graph presence is not runtime, CI, browser, fresh-clone or post-merge proof.

## 10. Invalidation

This card requires revalidation when master, graph manifest, Authority, shared contracts, runtime provider, listed source modules, tests or Known Limits change.
