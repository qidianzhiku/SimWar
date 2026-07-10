# R7 BFF Endpoint Implementation Readiness Matrix

| Gate               | Required evidence                           | No-go condition                                            | Current package status           |
| ------------------ | ------------------------------------------- | ---------------------------------------------------------- | -------------------------------- |
| Identity           | Authenticated Teacher subject               | Anonymous or Student invocation                            | `REQUIRED_BEFORE_IMPLEMENTATION` |
| Tenant             | Explicit tenant context                     | Missing or cross-tenant context                            | `REQUIRED_BEFORE_IMPLEMENTATION` |
| Course/run         | Teacher authority for target course and run | Missing or mismatched authority                            | `REQUIRED_BEFORE_IMPLEMENTATION` |
| Scenario           | Approved Scenario Package reference         | Unapproved or mutable package                              | `REQUIRED_BEFORE_IMPLEMENTATION` |
| ParameterSet       | Read-only version reference                 | Official ParameterSet write                                | `REQUIRED_BEFORE_IMPLEMENTATION` |
| Replay             | Non-overwrite evidence                      | Replay execution or official-result overwrite              | `REQUIRED_BEFORE_IMPLEMENTATION` |
| Student projection | Negative visibility tests                   | `state_true`, private Replay, or protected digest exposure | `REQUIRED_BEFORE_IMPLEMENTATION` |
| Security           | Auth/tenant/projection review               | Blocking security finding                                  | `REQUIRED_BEFORE_IMPLEMENTATION` |
| Browser            | Regression coverage                         | Unsupported UI or visibility regression                    | `REQUIRED_BEFORE_IMPLEMENTATION` |
| Runtime boundary   | Explicit route/handler authorization        | Runtime activation before Owner authorization              | `REQUIRED_BEFORE_IMPLEMENTATION` |

This matrix is an implementation prerequisite, not proof that an endpoint
exists or that L1, Pilot, or Production readiness has been achieved.
