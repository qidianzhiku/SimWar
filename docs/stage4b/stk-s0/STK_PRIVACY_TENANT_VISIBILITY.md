# STK Privacy, Tenant, and Visibility Boundary

## Current Position

This document defines a future candidate privacy boundary. It does not create a
data-processing authority, consent basis, provider connection, runtime route, or
public product surface.

The repository policy distinguishes a policy default from an effective
processing status. A default intent is never permission to process. Stage 4B
must remain OFF unless all later gates are satisfied.

## Least-Privilege Read Policy

| Data                                 | Teacher                              | Student                                              | Tenant Admin         | Platform Admin              | Future STK candidate                     |
| ------------------------------------ | ------------------------------------ | ---------------------------------------------------- | -------------------- | --------------------------- | ---------------------------------------- |
| Course/Run/Round status              | authorized course                    | enrolled course/team                                 | own tenant summary   | governed platform scope     | de-identified scoped projection          |
| Approved CourseBlueprint metadata    | authorized exact reference           | only product-safe instruction if exposed by mainline | status only          | governance metadata         | exact reference and allowlisted metadata |
| `state_obs` / `state_est`            | authorized summary                   | own team safe view                                   | aggregate only       | audit scope                 | cohort-level, de-identified candidate    |
| `state_true`                         | privileged current projection only   | forbidden                                            | not automatic        | governed audit only         | forbidden                                |
| Other-team decision or result        | teaching scope only where authorized | forbidden                                            | aggregate only       | governed audit only         | forbidden by default                     |
| Private Replay evidence              | bounded teacher/admin only           | forbidden                                            | forbidden by default | governed audit only         | forbidden                                |
| Raw reflection/private memory        | consented teaching scope only        | own data                                             | forbidden by default | exceptional governed access | forbidden                                |
| Learning Evidence                    | authorized teaching scope            | own safe report                                      | aggregate/status     | governed audit              | advisory candidate only                  |
| Hidden parameters/model coefficients | bounded governance only              | forbidden                                            | forbidden            | governed model role         | forbidden                                |

## Scope Chain

Every future request must prove:

```text
signed session
-> current actor
-> tenant membership
-> course membership
-> run membership
-> team scope when applicable
-> role permission
-> projection allowlist
```

Client-provided tenant, team, or role fields cannot increase authority.

## De-Identification Requirements

Before any stakeholder context leaves the existing product boundary:

1. Remove direct identifiers, emails, account IDs, and names.
2. Replace tenant, course, run, team, and user IDs with scoped pseudonyms where
   exact identity is unnecessary.
3. Aggregate to cohorts when individual behavior is not required.
4. Remove free-text quotations, relationship details, and rare attribute
   combinations that permit re-identification.
5. Remove enterprise names, proprietary strategy, and unreleased scenario data.
6. Record source references and a redaction policy version without copying raw
   private content into audit events.
7. Enforce retention and expiry independently from Course/Run retention.

Real-person digital-twin claims and unauthorized real data are forbidden.

## Persona Rules

### Teacher

May review a safe, bounded candidate diagnostic for an authorized course. Raw
private memory, hidden model data, and provider traces remain excluded. Teacher
review cannot commit a canonical Decision or formal result.

### Student

May receive only a deliberately published, redacted narrative related to the
student's own team and course. The surface must omit `state_true`, private
Replay, other-team data, raw memory, hidden parameters, resolver internals, and
formal evidence digests.

### Tenant Admin

May receive own-tenant counts, lifecycle status, policy status, and audit-safe
references. Tenant Admin does not automatically receive student private
content.

### Platform Admin

May receive governance metadata under explicit platform scope. Platform role is
not a reason to bypass purpose limitation or copy raw content into Stage 4B.

### AI / Provider

Receives a projection no broader than the initiating authorized actor and
normally narrower. Provider input must be de-identified, purpose-bound, and
logged by digest. Provider output is advisory/proposal-only.

## Policy and Consent

The existing privacy document is policy/design evidence, not proof that its
full state machine is implemented. A future Stage 4B path must independently
prove:

- effective consent or another approved processing basis;
- `effective_processing_status` for the exact purpose;
- human confirmation where required;
- tenant and enterprise policy;
- de-identification and DLP review;
- withdrawal and revocation handling;
- append-only audit evidence;
- provider retention and deletion terms.

## Mandatory Negative Tests for a Future Gate

- cross-tenant context request;
- cross-course and cross-team request;
- wrong role and missing membership;
- Student `state_true` and private Replay leak;
- raw memory and free-text re-identification leak;
- provider request with forbidden fields;
- revoked consent or expired state;
- policy default enabled but processing status not approved;
- error/log/export leakage;
- off-switch invoked during proposal generation.

No such runtime tests are executed or claimed by STK-S0.
