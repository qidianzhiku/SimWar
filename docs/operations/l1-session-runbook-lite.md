# L1 Session Runbook Lite

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

本 runbook 只覆盖 JSON runtime 下的 synthetic internal application validation。它不授权 `Pilot`、`Production`、PostgreSQL runtime、SQL、migration、durable settlement 或真实教师试跑。

## Preflight

| Check | Required state |
|---|---|
| data | synthetic or cleanable only |
| runtime | JSON runtime only |
| PostgreSQL runtime | `NOT_AUTHORIZED` |
| issues | #111 / #114 / #115 remain open unless separately disposed |
| branch | no protected main workspace use |
| scope | no runtime, service, route, schema, OpenAPI, database or lockfile change |

## Happy Path

1. Teacher signs into synthetic environment.
2. Teacher creates or selects the synthetic course/run.
3. Teacher opens round 1.
4. Student submits a valid decision for own team.
5. Teacher locks round 1.
6. Existing settlement path computes official JSON runtime result.
7. Teacher publishes the result.
8. Student confirms redacted result only.
9. Teacher confirms authorized replay evidence.
10. Tenant Admin confirms current-tenant status or audit surface.

## Abort Points

Abort immediately if:

- Student sees `state_true`, private replay metadata, other tenant data, other team data or private digests.
- Tenant Admin sees platform or other-tenant data.
- replay evidence overwrites official result.
- controlled failure leaks protected sentinel or private input.
- session requires PostgreSQL runtime, SQL, migration, service change, route change, schema change or lockfile change.

## Evidence Preservation

Preserve:

- command name and exit code
- request id or stable error code
- role identity
- tenant id
- run id and round number
- replay hash or statement that replay evidence was not created
- known limit classification

Do not preserve real customer data, secrets, passwords, tokens, payment data or production data.

## Non-Proofs

This runbook does not prove crash recovery, backup restore, distributed recovery, durable retention, `Pilot`, `Production` or PostgreSQL runtime readiness.
