# O9 Model Qualification Course Portfolio

O9 exposes a tenant-admin, read-only portfolio projection over the existing
canonical Course Authority and the existing per-course Model Qualification
authority. Course membership comes only from the tenant-scoped Course
repository; a qualification record cannot create a course or expand tenant
scope.

The portfolio is derived and query-only. It has a deterministic
`portfolio_state_digest`, reports exact adoption and qualification identities,
and includes O8 outcome/current-effect summaries when those summaries can be
resolved from exact records. It does not create an adoption, apply a
supersession, perform a rollback, write official truth, or introduce a Writer,
Store, Registry, or provider.

The supersession preview accepts explicit course IDs and the exact portfolio
digest returned by the server. A changed portfolio or selected course state
returns `REBASE_REQUIRED`. The preview never selects `latest`, `current`,
`default`, `fallback`, `first`, `last`, or `newest` implicitly, and it never
performs bulk adoption or rollback.

The endpoint is intentionally Admin-only:

- `GET /api/v1/bff/admin/model-qualification/course-portfolio`
- `POST /api/v1/bff/admin/model-qualification/course-portfolio/supersession-preview`

Teacher remains exact-course scoped, and Student has no tenant portfolio
endpoint or privileged portfolio identifiers. Provider remains `OFF`; formal
truth, settlement, score, rank, and replay authorities are unchanged.

With no governance record for an authorized course, the projection reports an
explicit blocking integrity finding rather than silently treating the course
as ready or selecting another record.
