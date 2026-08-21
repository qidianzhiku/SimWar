# M2-P2 Contract Receipt

Date: 2026-08-21

## Added contract surface

- `packages/shared-contracts/src/project-library.ts`
- `contracts/schemas/project-profile.v1.json`
- `contracts/schemas/project-assignment.v1.json`
- `contracts/fixtures/project-profile.valid.json`
- `contracts/fixtures/project-assignment.valid.json`
- OpenAPI paths for Teacher Project Library, command operations, Student project brief and Admin audit.

## Frozen boundaries

- `ProjectProfileRef` requires tenant, id, version and SHA-256 digest.
- Alias identities such as `latest`, `current`, `default`, `fallback`, `next` and `any` are rejected.
- Safe normalized import is closed-object only; unknown fields and raw/restricted source indicators are rejected.
- Student brief is a closed projection and has no runtime truth or official outcome fields.
- Assignment is idempotent for the same exact team/run/profile reference and conflicts for a different reference.

## Verification

`node scripts/check-contracts.mjs`

Result: `Contract conformance gate passed: 20 baseline files present, 37 M1 contract files present, 29 schema/fixture case groups validated.`
