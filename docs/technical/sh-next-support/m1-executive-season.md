# M1 Shanghai Executive Strategy Experiment Season

## State transition

`SH-ESL-NEXT-01-SHANGHAI-EXECUTIVE-STRATEGY-EXPERIMENT-SEASON` moves from a
scattered Shanghai strategic-portfolio/teaching capability (`STATE_A`) to a
deterministic support candidate with four complete, AI-off Episodes
(`STATE_B`). Each Episode contains a decision situation, candidate outcome
direction, debrief prompt, governed What-if, and transfer hook.

The implementation is in the lane-owned `@simwar/sh-next-support` package. It
does not add a Shanghai runtime, registry, persistence writer, or API route.
The package emits candidates only and keeps process, outcome, learning, and
counterfactual evidence in separate fields.

## Exact binding

Every Episode names a Scenario ID, Parameter ID, model reference, Course ID,
Run ID, seed, and exact source/contract/code references. The current master
revision is carried in each reference. No implicit latest resolution is used.

The current repository has no proven `MAIN-ESL-O1-EXECUTIVE-STRATEGY-LAB`
consumer seam at this freeze. The handoff is therefore `C1` and
`JOIN_WITH_LIMITS`; formal admission waits for a current C0 source/contract
binding.

## Role and authority safety

- Student projection exposes the situation, options, own rationale, candidate
  outcome direction, and reflection prompts only.
- Teacher-only facilitation and unpublished notes are not included in the
  student projection.
- The pack has no official truth, settlement, or formal ParameterSet write.
- Provider mode is `OFF`; the model reference is not calibration evidence.
- No correct strategy or final ranking is prefilled.

## Verification

```text
npm run build -w @simwar/sh-next-support
npx vitest run tests/sh-next-support/m1-executive-season.test.ts tests/sh-next-support/m1-contract.test.ts
```

The MJP uses Episode `SH-ESL-NEXT-01-E01` and checks exact references,
student-safe projection, AI-off behavior, candidate-only outcomes, and the
absence of a prefilled correct strategy. The JSON contract is
`contracts/schemas/sh-next-support-m1.v1.json`.

## Known limits

The four source records are bounded synthetic support anchors and do not prove
official Shanghai measurements. Calibration is explicitly not proven. The
formal Course/Run/Scenario/Parameter admission remains owned by the existing
MAIN authority and must be established by a later C0 join.
