# L1 Internal-Only Teacher Kit

## Status Boundary

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

PostgreSQL runtime:
NOT_AUTHORIZED
```

本 Teacher Kit 仅用于 synthetic internal application validation 准备。它不是真实教师试跑批准，不是 `Pilot`，不是 `Production`，不证明 PostgreSQL runtime、SQL、migration 或 durable settlement。

## Audience

| Role | Allowed use |
|---|---|
| Teacher operator | run a synthetic M1 session with cleanable data only |
| Student participant | use seeded or synthetic student identity only |
| Tenant Admin observer | inspect current-tenant status only |
| Reviewer | inspect evidence and non-proof boundaries |

## Session Scope

Allowed:

- `tenant_demo` or isolated synthetic tenant only.
- One synthetic course/run/round path.
- At least one Student decision submit.
- Teacher lock, settle, publish path.
- Student redacted result review.
- Teacher authorized evidence review.
- Tenant Admin current-tenant status or audit review.
- Shadow replay evidence review where current harness supports it.

Forbidden:

- real user data
- real customer data
- real payment
- billing, entitlement or production data
- PostgreSQL runtime
- SQL
- migration
- durable settlement
- Pilot
- Production

## Operator Checklist

1. Confirm this kit is used only for internal synthetic validation.
2. Confirm `G0 PASS` remains `NOT_GRANTED`.
3. Confirm `L1 Status` remains `NOT_READY`.
4. Confirm JSON runtime is the only active default.
5. Confirm no PostgreSQL runtime, SQL or migration action is planned.
6. Confirm session has an abort point and evidence preservation rule.
7. Confirm issue references are `Relates to #111`, `Relates to #114`, and `Relates to #115` only.

## Non-Proofs

Completing this kit does not prove Teacher rehearsal approval, `Pilot`, `Production`, PostgreSQL runtime, durable settlement, backup restore, distributed recovery, R4 Macro, R9 or R10.
