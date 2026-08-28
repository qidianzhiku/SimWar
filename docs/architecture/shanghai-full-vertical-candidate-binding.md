# Shanghai Full-Vertical Candidate Binding

## Status

```text
Source anchor:
9aea2edb5b5683e8c065307b508da35601971ac7

Implementation status:
READ_ONLY_CANDIDATE_BINDING

Formal Truth mutation:
0

Settlement mutation:
0

ParameterSet mutation:
0

Runtime activation:
0
```

This document records the bounded `MAIN-SH-FV-O1` implementation slice. It closes the identity gap between an R7C Shanghai synthetic release candidate and the exact formal references supplied to Course Delivery, without creating a Shanghai kernel, runtime, registry, app, or second authority writer.

## Candidate-to-formal identity contract

`ShanghaiFullVerticalCandidateIdentityV1` contains only candidate metadata:

```text
tenant_id
course_id
scenario_package_id + scenario_package_version
scenario_version + scenario_family_version + compiler_version
parameter_set_id + parameter_set_version + parameter_set_seed
plugin_package_ids + plugin_version
```

`ShanghaiFullVerticalFormalReferencesV1` contains exact authority references for the Course Delivery caller:

```text
tenant_id + course_id
ScenarioPackageReference
ParameterSetReference
PluginReleaseReference[]
```

The validator fails closed for tenant, course, scenario package, ParameterSet ID/version/seed, plugin-set, and plugin-version drift. It returns stable issue codes rather than silently choosing one side of a conflict.

The resulting evidence is explicitly candidate-only:

```text
status = BOUND
digest_status = REFERENCE_ONLY_NOT_REHASHED
formal_truth_write = false
settlement_write = false
parameter_set_write = false
runtime_activation = false
```

`REFERENCE_ONLY_NOT_REHASHED` is an honest limit: the pure shared contract compares exact IDs and versions but does not claim that authority artifact bytes were rehashed. Artifact digest verification remains an authority/service responsibility for a future separately authorized slice.

## Course Delivery integration

`createCourseDeliveryBlueprintV1` now requires the formal references and verifies that they match the supplied `Course`, `ScenarioPackage`, `ParameterSet`, and selected plugin before returning a blueprint. The blueprint carries the structured binding evidence for teacher/configuration review. It does not assign a ScenarioPackage, modify a ParameterSet, activate a plugin, write settlement state, or change Replay/hash inputs.

The existing course state machine remains the sole path for Course, Run, Round, Decision, SettlementResult, and published-result behavior. The existing student projection continues to exclude protected fields and the learning-evidence ledger remains excluded from truth hash.

## Teacher readiness route contract

The already implemented route is now described by a shared contract:

```text
GET /api/v1/bff/teacher/runs/{runId}/scenario-selection-readiness
```

It reads the exact run, ScenarioPackage, and ParameterSet through the repository facade and returns a Teacher-safe readiness projection. It is not a binding command. It keeps the following protections false:

```text
direct_store_access = false
official_scenario_binding_write = false
official_parameter_set_write = false
settlement_result_write = false
runtime_activation = false
student_visibility_expansion = false
```

The OpenAPI operation, shared contract, server implementation, and integration tests now agree on the route and query names. The older R7 boundary package remains a historical seed contract for the pre-route draft and is not silently relabeled as runtime evidence.

## Non-proofs and next gate

This slice does not prove:

- artifact-byte digest verification or external license approval;
- real Shanghai data calibration or `MODEL_CALIBRATED`;
- PostgreSQL runtime/RLS, durable settlement, Pilot, Production, or Human Validation;
- a formal Shanghai ScenarioPackage/ParameterSet lifecycle write;
- a second Truth, Settlement, W4, EnterpriseState, or Model-Governance writer;
- automatic execution of GSI, ESL, RT, or any successor mission.

The output is therefore a governed candidate binding seam, not a release or deployment approval.
