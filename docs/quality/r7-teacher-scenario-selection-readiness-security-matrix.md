# R7 Teacher Scenario Selection Readiness Security Matrix

| Control                 | Runtime enforcement                                              | Expected result                                                         | Evidence         |
| ----------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------- |
| Authentication          | Existing signed token and active session context                 | Missing or invalid token returns `401 R7_BFF_AUTHENTICATION_REQUIRED`   | Integration test |
| Teacher role            | `course:read` plus exact `teacher` role                          | Student and Tenant Admin return `403 R7_BFF_TEACHER_AUTHORITY_REQUIRED` | Integration test |
| Platform isolation      | Actor tenant must equal the resolved request tenant              | Dual-role Platform Admin/Teacher tenant switching returns `403`         | Integration test |
| Tenant scope            | Tenant comes from authenticated context; facade reads include it | Other-tenant Teacher receives non-oracle `404`                          | Integration test |
| Run scope               | Run is loaded by tenant and path `runId`                         | Missing Run receives non-oracle `404`                                   | Integration test |
| Scenario scope          | Scenario is loaded by tenant and must match Run binding          | Missing or mismatched Scenario receives non-oracle `404`                | Integration test |
| ParameterSet scope      | ParameterSet is loaded by tenant and must match Run binding      | Missing or mismatched ParameterSet receives non-oracle `404`            | Integration test |
| Gate drift              | Existing implementation-gate validator is authoritative          | FAIL and UNKNOWN classifications fail closed                            | Integration test |
| Projection minimization | Explicit serializer returns only approved fields                 | No private Scenario, ParameterSet, Replay, truth, score, or rank fields | Integration test |
| Write boundary          | Handler uses three read-only facade calls                        | Store is byte-equivalent before and after the endpoint read             | Integration test |
| Internal failure        | Endpoint-specific catch maps unexpected errors                   | `500 R7_BFF_INTERNAL_ERROR` contains no exception or storage details    | Integration test |

## Stable Error Contract

All endpoint errors use:

```json
{
  "error": {
    "code": "<stable code>",
    "message": "<public message>",
    "correlation_id": "<request id or null>"
  }
}
```

The endpoint does not echo exception text, file paths, request credentials,
Scenario source content, ParameterSet values, Replay artifacts, or protected
truth fields.

## Validation Boundary

The security matrix is evidence for this endpoint diff only. Passing tests,
dependency audit, direct-store checks, or a zero-finding diff scan do not
prove whole-repository security, `G0 PASS`, `L1 READY`, Pilot readiness, or
Production readiness.
