# R7 Teacher Scenario Readiness Browser Security Matrix

| Boundary         | Browser evidence                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Teacher role     | Teacher can open the panel only after the existing Teacher login and Run creation flow.                                  |
| Approved request | The readiness action issues one `GET` request to the merged BFF endpoint.                                                |
| Tenant           | The readiness request sends no `x-tenant-id`; the backend resolves tenant scope.                                         |
| READY            | The UI renders approved readiness fields and explicit non-proofs.                                                        |
| BLOCKED          | The UI renders stable redacted No-Go codes and Known Limits.                                                             |
| Error            | `404` is rendered as a generic unavailable/out-of-scope message.                                                         |
| Student          | Student DOM has no panel and its browser makes no readiness request.                                                     |
| Private fields   | The Teacher readiness panel and console checks exclude truth, Replay, protected-digest, and ParameterSet internals.      |
| Write boundary   | The readiness action uses GET only and has no activation, Replay, settlement, publish, or ParameterSet mutation control. |

The Playwright coverage is a synthetic internal browser proof. It is not a
complete UI security proof, Teacher rehearsal, Pilot, Production, or durable
settlement proof.
