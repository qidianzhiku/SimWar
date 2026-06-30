# R4b G1 Authority Matrix and Scope Lock

## Mission Scope

Mission: `AUD-R4B-G1-ADAPTER-CONTRACT-AND-REPOSITORY-AUTHORITY-REWORK`

Authorization: `OPTION_A_PRIME / CONDITIONALLY_APPROVED_PENDING_SCOPE_LOCK`

This record documents the single approved G1 slice selected after Scope-Lock:
course detail read for `GET /api/v1/courses/:courseId`.

This Mission remains limited to JSON runtime repository authority work. It does
not authorize PostgreSQL runtime, database connections, SQL, migrations,
provider activation, R9 PostgreSQL Read Runtime, R10 Durable Settlement,
Internal Pilot durability claims, Controlled Pilot claims, or Production claims.

## Governance Status

| Item | Status |
| --- | --- |
| JSON runtime | Current active default runtime |
| PostgreSQL runtime | Not active, not authorized |
| PR #187 | Merged into `master` |
| #111 | Open; durable settlement not proven |
| #114 | Open |
| #115 | Open |
| G2 DB / Migration / Provider Tooling | Not authorized |
| G3 PostgreSQL Read Runtime | Not authorized |
| G4 Durable Settlement | Not authorized / not proven |

## Scope-Lock Record

| Item | Value |
| --- | --- |
| Slice name | Course detail read facade slice |
| Old direct-store location | `services/api/src/server.ts`, `getCourseForRead`, `runtime.store.courses.find` |
| Route / helper | `GET /api/v1/courses/:courseId` -> `getCourseForRead` |
| Data read | Course record for the request tenant and course ID |
| Writes data | No |
| Truth-adjacent | No |
| Tenant/RBAC-adjacent | No; existing `course:read` and tenant context are preserved |
| Session authority | No |
| Student visibility impact | No; route response shape is preserved and does not include private result fields |
| Existing Port | `CourseRepositoryPort.getCourse` |
| Existing Facade | `RepositoryFacade.courses.getCourse` |
| Minimal additive contract | `RepositoryCourseReadModel` now carries the existing `Course` response shape |
| JSON adapter implementation | Maps `Course` from JSON store into `RepositoryCourseReadModel` |
| PostgreSQL candidate mapping | Selects `payload` through injected executor only; no runtime activation |
| HTTP behavior baseline | 200 course response, 404 `COURSE-404-001`, 401 unauthenticated, 403 cross-tenant |
| Permission baseline | Existing `requirePermission(context, "course:read")` remains unchanged |
| Direct-store manifest before | 57 approved legacy exceptions |
| Direct-store manifest after | 56 approved legacy exceptions |
| New unapproved direct-store access | 0 |
| Rollback | Revert this Mission commit; no data migration or dependency rollback needed |

## Authority Matrix

| Domain | Current reader | Current writer | Port | Facade | JSON adapter | Route/helper bypass | G1 eligibility | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| identity/session | `createContext`, auth routes | auth/session routes | Partial | Partial | Partial | Yes | Forbidden in this Mission | Session/RBAC authority |
| tenant | admin/read helpers | admin tenant create | Partial | Partial | Partial | Yes | Forbidden in this Mission | Tenant authority |
| user/role | admin/RBAC helpers | admin user create/update | Partial | Partial | Partial | Yes | Forbidden in this Mission | RBAC authority |
| course | course list/detail/create/publish routes | course create/publish routes | Partial, improved for detail read | Partial, improved for detail read | Partial, improved for detail read | One detail-read bypass removed | Eligible only for selected detail read | Low for selected slice; writes remain out of scope |
| run/round | route helpers and settlement paths | run/round command routes | Partial | Partial | Partial | Yes | Not selected | Truth-adjacent and command-path risk |
| team / membership | team routes and decision submit | team create route | Partial | Partial | Partial | Yes | Forbidden in this Mission | Team membership and decision authority |
| decision | decision submit and listing paths | decision submit | Partial | Partial | Partial | Yes | Forbidden in this Mission | Canonical decision/truth-adjacent |
| formal result | settlement/read result paths | settlement path | Partial | Partial | Partial | Yes | Forbidden in this Mission | Formal truth |
| audit | audit route/filter helpers | audit append | Partial | Partial | Partial | Yes | Forbidden in this Mission | Audit evidence |
| replay evidence | replay/result evidence paths | replay evidence writer | Partial | Partial | Partial | No selected slice | Forbidden in this Mission | Replay/hash evidence |
| scenario package | route and settlement reads | seed/admin future only | Partial | Partial | Partial | Yes | Not selected | Parameter/scenario authority |
| parameter set | route and settlement reads | seed/admin future only | Partial | Partial | Partial | Yes | Not selected | Parameter authority |

## Direct-Store Boundary Change

| Metric | Before | After |
| --- | ---: | ---: |
| approved legacy exceptions | 57 | 56 |
| read exceptions | 50 | 49 |
| write exceptions | 7 | 7 |
| target exceptions | 0 | 0 |
| new unapproved runtime direct-store access | 0 | 0 |
| stale approved exceptions | 0 | 0 |
| unsupported / ambiguous patterns | 0 | 0 |

Remaining approved legacy exceptions after this slice:

| Category | Count | Notes |
| --- | ---: | --- |
| `routeRequest` | 36 | Includes all 7 remaining writes; not eligible for this Mission |
| `createAdminState` | 7 | Admin projection and RBAC-adjacent fields |
| `submitDecision` | 3 | Decision / team / truth-adjacent; forbidden |
| `createContext` | 2 | Session authority; forbidden |
| `filterAuditLogs` | 2 | Audit and tenant projection; forbidden |
| `getCourse` | 1 | Still backs command-path helpers; not selected |
| `getRun` | 1 | Run authority; truth-adjacent |
| `getRound` | 1 | Round authority; truth-adjacent |
| `lockRound` | 1 | Round command path; forbidden |
| `publishRound` | 1 | Round command path; forbidden |
| `requireManagedTenant` | 1 | Tenant authority; forbidden |

Static guard limitation remains: alias and indirect store access are not fully
detected by the direct-store boundary guard.

## Non-Claims

This change does not prove or authorize:

- PostgreSQL parity.
- PostgreSQL active runtime.
- Database connection, SQL execution, migration apply, or rollback.
- RLS, transaction, row lock, unique constraint, cross-process idempotency,
  crash recovery, backup, or restore.
- R9 PostgreSQL Read Runtime.
- R10 Durable Settlement.
- #111, #114, or #115 closeout.
- Internal Pilot durability, Controlled Pilot, or Production readiness.
