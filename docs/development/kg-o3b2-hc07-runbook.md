# KG-O3B2 HC-07 historical shadow runbook

This runbook describes one bounded, read-only calibration of Graph Companion
support. It is intentionally separate from Product runtime behavior and from
the forward Product-task queue.

## Inputs and identity

HC-07 uses the first material-review commit from PR #509 as a historical
locator only:

```text
locator commit: 14e577bf9c8745e3b8694812efb88fe3f4188e4a
task:            HC-07
mode:            historical blind comparison
```

Before running the comparison, resolve the locator to an exact commit and
record its exact tree SHA in the external evidence root. The commit's Product
files are read-only inputs for this calibration; this task does not patch,
rebase, or otherwise mutate Product code. Record the current repaired source
SHA separately as an exclusion check. Never substitute that current source
for the historical snapshot in either cell.

The control and treatment must share the same historical target, tree,
question framing, and time budget. Keep their working directories, notes, and
tool receipts isolated. Do not include an answer key in either cell input.

## Cell lifecycle

The bounded helper in `scripts/kg-o3b2-evidence.mjs` implements this lifecycle:

1. `createHistoricalCell` validates a 40-character target SHA and tree SHA,
   verifies the source snapshot is `HISTORICAL_SNAPSHOT`, strips the input down
   to bounded observation fields, and returns an `UNSEALED` cell. It rejects a
   short/ref target, a source/target mismatch, a current/repaired snapshot,
   and answer-key fields.
2. Run the source-only control and KG-assisted treatment independently. Record
   only bounded metrics and source/test anchors in their observations.
3. `sealHistoricalCell` returns a new sealed cell and a deterministic seal
   hash. It does not add, return, or expose an answer key. Sealing is a local
   data transformation; it does not write Product state.
4. Call `compareHistoricalCells` with both cells and the answer key. Before
   both cells are sealed it returns `WAITING_FOR_BOTH_CELLS_TO_SEAL`,
   `answer_key_status: WITHHELD`, and no `answer_key` property. After both
   cells seal, it may return `COMPARED` with the post-seal key and a bounded
   HC-07 classification.

The comparison rejects mismatched target/tree identities and task identities.
If a manually assembled cell tries to use current repaired source, the result
is `CURRENT_REPAIRED_SOURCE_FORBIDDEN`; do not bypass that result by copying
source from the current worktree.

## HC-07 interpretation

The result records treatment-side correctness, control/treatment metric deltas,
and one of the following contribution labels:

| Label | Meaning for this bounded comparison |
| --- | --- |
| `MATERIAL` | treatment is correct and either control missed or a bounded scope/test/authority delta exists |
| `CONFIRMATORY` | treatment is correct with no material delta |
| `NO_MATERIAL` | treatment did not establish a correct finding and is not an explicit false negative |
| `FP` | treatment is marked false positive |
| `FN` | treatment missed the finding |
| `NOT_COMPUTED` | cells or answer key are incomplete |

`statistics: NOT_COMPUTED` is required for this single historical comparison.
The label is evidence about this question only. It does not establish actual
developer value, production readiness, general graph precision, or a claim
that the current Product source is repaired because the treatment found a
candidate.

## Forward selection

HC-07 must not be reused as a forward pilot. Call `selectForwardPilot` with
the current pre-review Product-task inventory after current-first readback.
Only an explicitly marked Product task in pre-review and a non-terminal state
is eligible; historical/shadow/engineering and completed/post-review work is
excluded. The result is deterministic and contains a bounded selected summary.

When the inventory is empty, stale, or contains only excluded candidates, the
result must be:

```json
{
  "state": "WAITING_FOR_NEXT_PRE_REVIEW_PRODUCT_TASK",
  "selected_task": null
}
```

This is an honest no-candidate result. It does not authorize inventing a task,
opening a Product issue, mutating Product code, or automatically starting a
successor mission. A selected task still requires owner review before any
future pilot execution.

## Evidence handoff checklist

- exact historical commit SHA and tree SHA recorded;
- current repaired source recorded as excluded provenance only;
- control and treatment cells are isolated and separately sealed;
- no answer key appears before both seals;
- comparison target/tree identities match exactly;
- result carries `historical_only: true` and `statistics: NOT_COMPUTED`;
- HC-07 is excluded from forward selection;
- selector result is either an explicit task summary or
  `WAITING_FOR_NEXT_PRE_REVIEW_PRODUCT_TASK`;
- all artifacts remain external/read-only support evidence;
- `AUTOMATIC_NEXT_START=false` and owner gates remain in force.
