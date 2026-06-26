# P0 Product Seed 00: First Teaching Run

Status: PROPOSED

Human acceptance required: yes

Parent ADR: `ADR-DATA-005`

## 1. Accepted Product Seed

No accepted product seed artifact exists yet. Proposed seed: wellness /
eldercare demo; one tenant; one teacher-led course; multiple teams; one run;
numbered rounds; structured decisions; settlement; teaching result.

## 2. First Teaching Run Boundary

M1 Teaching-Official Result under Current JSON Active Runtime means JSON may
produce an official teaching workflow result. It is not durable settlement and
does not prove transaction, uniqueness, row lock, cross-process idempotency,
crash recovery, or commit / audit atomicity. #111 remains open.

## 3. Open Product Semantics

Human decisions still required:

- Team membership effect on submission, permission, or settlement eligibility;
- role/member history effect on historical Run interpretation;
- whether ParameterSet can affect an existing Run;
- whether ScenarioPackage is immutable after publication;
- which versioned references a Run freezes.
