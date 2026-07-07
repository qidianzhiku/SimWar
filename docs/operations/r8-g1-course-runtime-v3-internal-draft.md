# R8-G1 Course Runtime V3 Internal Draft

## Status Boundary

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

Operational release:
NOT_RELEASED
```

This note records how the `Course Runtime V3` synthetic evidence package may be
handled during internal review. It is not a release runbook and does not
authorize Pilot or Production activity.

## Internal Handling

The current package may be used only for:

- independent evidence review
- synthetic JSON runtime validation
- request-id idempotency review
- audit integrity review
- role-visibility review
- Replay and Shadow Arena non-overwrite review
- Learning Evidence truth-isolation review

It must not be used for:

- real learners
- real tenants
- real courses
- paid customer delivery
- Pilot
- Production
- PostgreSQL runtime activation
- SQL or migration execution
- durable settlement claims

## Review Checklist

Before any future release-oriented decision, reviewers must confirm:

- the integration guard still passes from a clean clone
- the browser smoke still hides protected markers from Student-visible content
- duplicate `decision.submit` request ids return the same decision only for the same command
- conflicting `decision.submit` request-id reuse fails closed
- `direct_store_delta` remains `NONE`
- Learning Evidence remains excluded from truth hash
- Shadow Arena evidence still cannot overwrite official result
- repeated settlement still reuses the existing formal result
- audit evidence keeps request ids and reports no duplicate side effects
- `G0 PASS` remains `NOT_GRANTED`
- `L1 Status` remains `NOT_READY`

## Exit Criteria

This internal draft can only move forward through a separate Owner-signed
decision. Passing tests or creating a PR does not by itself authorize merge,
Pilot, Production, durable settlement or G0/L1 status changes.

## Issue Relationship

Relates to #111. Relates to #114. Relates to #115.
