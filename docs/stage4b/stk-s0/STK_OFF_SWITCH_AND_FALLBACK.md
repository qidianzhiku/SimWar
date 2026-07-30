# STK Off-Switch and Fallback

## Status

All controls in this document are `CANDIDATE_ONLY / NOT_IMPLEMENTED`. Current
Stage 4B mode is OFF because no current runtime is proven.

## Flag Hierarchy

Proposed evaluation order:

```text
global kill switch
> runtime environment policy
> tenant permission
> course permission
> run binding
> provider permission
> requested mode
```

Any false, missing, expired, incompatible, or unknown value produces `OFF`.
There is no silent enablement.

## Candidate Controls

| Control                            | Default     | Effect                                     |
| ---------------------------------- | ----------- | ------------------------------------------ |
| `SIMWAR_STAGE4B_ENABLED`           | `false`     | global service/route registration gate     |
| tenant `stakeholder_plane_enabled` | `false`     | tenant admission                           |
| course `stakeholder_mode`          | `OFF`       | exact Course scope                         |
| run binding `stakeholder_mode`     | `OFF`       | immutable Run scope                        |
| provider `enabled`                 | `false`     | external provider-call gate                |
| resolver compatibility             | fail closed | prevents incompatible signal/state         |
| emergency kill switch              | OFF         | stops new work and expires candidate state |

Names are proposed, not repository facts.

## Plane OFF Contract

When OFF:

1. no Stage 4B route or BFF endpoint is registered;
2. no provider is called;
3. no proposal, signal, memory, or runtime-state write occurs;
4. no existing Course, Run, Decision, settlement, Replay, or projection request
   depends on Stage 4B;
5. no fallback proposal is injected;
6. Golden and Replay digests match the non-Stage4B path exactly;
7. existing Teacher/Student/Admin behavior remains available.

The external baseline requires Plane OFF exact parity, but this is
`DOCUMENTED_ONLY`; no current Stage 4B parity harness exists.

## Failure and Fallback Rules

| Failure                      | Required behavior                                        |
| ---------------------------- | -------------------------------------------------------- |
| provider unavailable         | disable proposal generation; do not block formal runtime |
| invalid provider output      | reject and audit; no resolver input                      |
| resolver failure             | no signal/state; do not substitute raw proposal          |
| missing or expired state     | behave as OFF/zero signal                                |
| digest/reference mismatch    | fail closed                                              |
| tenant/course/run mismatch   | reject and audit                                         |
| privacy or consent failure   | stop processing and revoke candidate output              |
| bounds/compatibility failure | reject candidate state                                   |
| official Replay invocation   | load locked artifacts only; provider calls remain zero   |

Fallback must never mean:

- use latest model, parameter, proposal, or state;
- switch to another provider silently;
- reuse another tenant's state;
- submit a default Decision;
- write a neutral Settlement result;
- increase a global timeout or retry until accepted;
- mutate ModelVersion or ParameterSet.

## Off-Switch State Cleanup

A future implementation must distinguish:

- stopping new provider/resolver work immediately;
- expiring active-window candidate state;
- retaining append-only audit evidence;
- preserving formal Course/Run/Replay history;
- deleting provider caches and private memory according to policy.

The exact cleanup service, SLA, storage, and recovery behavior are `UNKNOWN`.

## Admission Gates

S1 requires an independent owner-authorized contract/privacy mission and Plane
OFF parity. S2 requires Program M formal rebase, a verified bounded adapter,
zero-provider-call official Replay, and independent authorization. Limited or
official influence remains T4 and is not authorized.
