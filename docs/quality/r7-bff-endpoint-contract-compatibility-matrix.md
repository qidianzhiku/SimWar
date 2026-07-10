# R7 BFF Endpoint Compatibility Matrix

| Area               | Contract draft                                  | Explicit non-proof                       |
| ------------------ | ----------------------------------------------- | ---------------------------------------- |
| Tenant context     | Explicit tenant/course/run identifiers required | No cross-tenant authorization proof      |
| Scenario context   | Scenario and ParameterSet references only       | No official binding or write             |
| Student projection | Redacted projection only                        | No complete privacy or runtime proof     |
| Replay             | Reference-only compatibility                    | No Replay or Shadow Replay execution     |
| Advisory           | Advisory-only slot                              | No AI runtime or formal-truth write      |
| Transport          | Future request/response shape only              | No route, handler, IO, or frontend fetch |

The matrix is review evidence for a future implementation gate, not a release
or readiness claim.
