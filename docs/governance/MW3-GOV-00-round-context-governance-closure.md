# SimWar MW3 Governance Closure

Document ID: `MW3-GOV-00`
Version: `V1.0`
Date: `2026-08-16`
Source SHA: `7ee5107abcaea31b8a1ce4d69723b50c51acb6ea`
Document Type: `GOVERNANCE_CLOSURE_AND_PLANNING_RECONCILIATION`
Status: `PENDING_EXACT_HEAD_GOVERNANCE_PR`
Implementation Claim: `GOVERNANCE_RECORD_ONLY`
Repository Mutation: `DOCS_ONLY_IN_ONE_GOVERNANCE_PR`
Human Validation: `NOT_PERFORMED`
Pilot / Production: `NOT_AUTHORIZED`
automatic_next_start: `false`

## Purpose

This closure reconciles the planning carriers after Product PR #383 merged the
MW3 primary outcome. It does not reopen or reimplement MW1 canonical decision
admission, MW2 publication safety, UI refoundation, W020-W025, or any support
lane. It records the exact post-product master and preserves the boundary
between a completed bounded product outcome and future owner-directed work.

## Product merge and fresh readback

| Item              | Evidence                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Product PR        | #383, `fix: align teacher commands with exact round context`                                                           |
| Candidate head    | `01dd97fc9930ccda82f221cb02eb281f08d4c1ac`                                                                             |
| Product merge     | `7ee5107abcaea31b8a1ce4d69723b50c51acb6ea`                                                                             |
| Fresh master tree | `4ec0248a977c40ab118bbea9bdc5bcfb4cb174a8`                                                                             |
| Changed files     | 7; Teacher App/helper and focused tests/fixtures only                                                                  |
| Required checks   | `quality`, `browser-smoke`, `Analyze JavaScript and TypeScript`, and CodeQL all successful on the exact candidate head |
| Fresh clone       | Clean detached clone at the post-product merge                                                                         |

The source readback confirms exact `run_id` + `round_id` + `round_no` selection,
round-scoped start/lock/settle/publish paths, exact BFF workspace identity
validation, and preserved server-authored `allowed_actions`/stale-response
boundaries. No shared contract, OpenAPI, API server, repository adapter,
settlement, replay, migration, or database file changed.

## PR #374 disposition

PR #374 was freshly read before disposition:

- number `374`, title `docs: close W025 durable validation launch`;
- pre-disposition state `OPEN`, unmerged, head
  `98bc740f87cdebad87fce9a21f3e2b83fa71c615`, base
  `8bb489c8f92d04919bcea98cc95fc3c4d4a18bc0`;
- four changed files, all docs/planning or W025 capability documentation;
- patch capture digest SHA-256
  `79ad739cd180397a175dd1845dd52a434807867662f8cd37a7468c83da0fd68a`;
- scope remained W025 governed advisory remediation, with no unmerged MW3
  canonical or settlement safety repair;
- existing W025 substrate is already in protected master and future treatment
  remains a fresh W6 rebase/reuse/review.

The PR was closed, not merged, at `2026-08-16T18:11:00Z` with the governance
meaning `SUPERSEDED_FOR_CURRENT_PRODUCT_MAINLINE`. Its body, reviews, checks,
head/base, changed-file manifest, patch digest, and known limits remain
historical evidence. Its branch was not deleted; no rebase or cherry-pick was
performed.

## Planning reconciliation

The current-cycle and L1+ portfolio carriers now point to the MW3 product
merge, the exact Product PR, and the post-product tree. The predecessor UI
refoundation remains closed with limits at its own governance merge; W020-W025
remain closed with their original boundaries. The closure carrier keeps
Product Mainline WIP at 1 and the governance closure budget at 1.

The governance PR itself is the only remaining mutation in this wave. After it
merges, a fresh detached readback must replace the pending governance fields
with its exact merge SHA and release the logical MW3 locks. No Product PR,
support-lane mutation, or automatic successor may be started from this record.

## Known limits and non-claims

- The Teacher flow has no ordinary Round creation endpoint; MW3 browser
  multi-round acceptance uses a controlled Round 2 fixture.
- Backend round selection is unchanged and was explicitly out of scope.
- The evidence does not prove human validation, teaching effectiveness, pilot,
  production, general PostgreSQL, RLS, or migration readiness.
- Full repository formatting and inherited dependency advisories remain
  declared limits and were not widened by this governance closure.

## Re-entry rule

Any future work must begin from a fresh protected-master read, revalidate the
current contract and hot-file ownership, and receive separate Owner direction.
`automatic_next_start=false` is authoritative.
