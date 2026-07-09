# R7 Scenario Compatibility Matrix

## Status Boundary

```text
Source SHA:
2038c8f0ebaa762461cd1140565426e37a268b2c

Seed Package Source SHA:
33b0983859d4f01a48d298ee2f23253ffb8455fc

G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

R8-G1 Status:
INTERNAL_ONLY_DRAFT_NOT_RELEASED
```

## ParameterSet compatibility matrix

| Compatibility Item             | Evidence Label           | Current Status               | Proof Scope                   | Required Future Gate                         | Explicit Non-Proof               |
| ------------------------------ | ------------------------ | ---------------------------- | ----------------------------- | -------------------------------------------- | -------------------------------- |
| scenario package reference     | CONTRACT_BACKED_EVIDENCE | COMPATIBLE_BY_REFERENCE_ONLY | scenario_package_id present   | OWNER_AUTHORIZED_PARAMETERSET_VERSION_REVIEW | not runtime registry             |
| ParameterSet reference         | CONTRACT_BACKED_EVIDENCE | COMPATIBLE_BY_REFERENCE_ONLY | parameter_set_id present      | OWNER_AUTHORIZED_PARAMETERSET_VERSION_REVIEW | not official_parameter_set write |
| ParameterSet version reference | CONTRACT_BACKED_EVIDENCE | COMPATIBLE_BY_REFERENCE_ONLY | parameter_set_version present | OWNER_AUTHORIZED_PARAMETERSET_VERSION_REVIEW | not version mutation             |
| PluginPackage reference        | CONTRACT_BACKED_EVIDENCE | COMPATIBLE_BY_REFERENCE_ONLY | plugin_package_id present     | OWNER_AUTHORIZED_PARAMETERSET_VERSION_REVIEW | not Plugin Runtime               |
| seed reference                 | CONTRACT_BACKED_EVIDENCE | COMPATIBLE_BY_REFERENCE_ONLY | seed present                  | OWNER_AUTHORIZED_PARAMETERSET_VERSION_REVIEW | not calibration result           |

```text
official_parameter_set_write = false
parameter_set_version_mutation = false
```

## Shadow Replay compatibility matrix

| Compatibility Item      | Evidence Label           | Current Status                             | Proof Scope                             | Required Future Gate                           | Explicit Non-Proof              |
| ----------------------- | ------------------------ | ------------------------------------------ | --------------------------------------- | ---------------------------------------------- | ------------------------------- |
| Shadow Replay reference | CONTRACT_BACKED_EVIDENCE | SHADOW_REPLAY_REFERENCE_ONLY_NON_OVERWRITE | reference boundary only                 | OWNER_AUTHORIZED_SHADOW_REPLAY_EXECUTION_GUARD | not Shadow Replay execution     |
| Non-overwrite boundary  | CONTRACT_BACKED_EVIDENCE | SHADOW_REPLAY_REFERENCE_ONLY_NON_OVERWRITE | formal result overwrite forbidden       | OWNER_AUTHORIZED_SHADOW_REPLAY_EXECUTION_GUARD | not durable recovery            |
| Hash semantic boundary  | CONTRACT_BACKED_EVIDENCE | SHADOW_REPLAY_REFERENCE_ONLY_NON_OVERWRITE | replay_hash and manifest_hash unchanged | OWNER_AUTHORIZED_SHADOW_REPLAY_EXECUTION_GUARD | not replay implementation proof |

```text
shadow_replay_overwrites_official_result = false
shadow_replay_executes = false
replay_hash_semantics_changed = false
manifest_hash_semantics_changed = false
```

## Non-Proof

This matrix does not authorize runtime routes, official ParameterSet writes, Shadow Replay execution, official result overwrite, Scenario Factory runtime activation, R8-G1 release, Teacher rehearsal, Pilot readiness, Production readiness, PostgreSQL runtime, or durable settlement claims.

```text
AI Advisory: NOT_AUTHORIZED_TO_WRITE_TRUTH
Plugin Runtime: NOT_AUTHORIZED
```

Relates to #111.
Relates to #114.
Relates to #115.
