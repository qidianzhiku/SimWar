# L1 Issue Escalation Procedure

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

本 procedure 用于 synthetic internal validation 中的 issue escalation。它不关闭 #111、#114 或 #115，不授权 `Pilot`、`Production`、PostgreSQL runtime、SQL、migration 或 durable settlement。

## Escalation Categories

| Category | Examples | Required action |
|---|---|---|
| P0 protected data leak | Student sees `state_true`, private replay metadata, other tenant data | stop session, preserve evidence, require Owner disposition |
| P0 tenant breach | cross-tenant read/write succeeds | stop session, require R3 remediation |
| P1 replay overwrite | replay evidence changes formal result | stop session, require replay remediation |
| P1 recovery overclaim | docs imply backup restore or durable recovery without proof | hold release note, correct documentation |
| P2 operator ambiguity | runbook unclear but no protected data leak | revise internal docs only |
| Supply-chain risk | direct runtime critical vulnerability in JSON-only path | require dependency scope decision |

## Escalation Record

Record:

- timestamp
- actor role
- tenant id
- run id
- round number
- command or API path
- stable error code
- request id
- affected surface
- evidence label
- explicit non-proof statement

Do not record secrets, tokens, passwords, payment data, real customer data or production data.

## Issue Relationship

Use `Relates to #111`, `Relates to #114`, and `Relates to #115` only. Do not use issue closeout keywords in PR bodies unless separately authorized.

## Non-Proofs

Escalation records do not prove `G0 PASS`, `L1 READY`, `Pilot`, `Production`, PostgreSQL runtime, SQL migration or durable settlement.
