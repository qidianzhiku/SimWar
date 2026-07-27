# ADR-INDUSTRY-001: Shanghai Eldercare Scenario Supersession

## Status

Accepted for the current synthetic teaching asset path.

## Context

The V3 delivery plan moves industry-specific scenarios, industry data, and
calibration out of the generic Core Roadmap and into a separately governed
Industry Scenario / Industry Data Program. The previous R7 source asset used
a Beijing-Yanjiao synthetic geography. The current teaching baseline must use
Shanghai instead without claiming real project data, public-policy evidence,
or a calibrated operating model.

## Decision

Create a new versioned asset chain rather than rewrite an existing identity:

```text
R7-A: r7a-shanghai-eldercare-core-scenario-v2
R7-B: r7b-shanghai-eldercare-scenario-lifecycle-v2
R7-C: r7c-shanghai-eldercare-family-v2
```

The Shanghai asset uses only synthetic, uncalibrated teaching values and is
classified as `SYNTHETIC_TEACHING_SCENARIO`. It is not a runtime activation,
default tenant switch, real-data import, policy recommendation, investment
recommendation, or settlement/replay change.

The previous v1 source identities remain resolvable only through the
read-only, exact-identity historical artifact boundary in ADR-DATA-005E.
That boundary binds each retained record to its frozen source SHA, tenant,
package, version, content digest, and artifact digest. Git history alone is
not an executable resolver and must not be used to select a replacement or a
latest version. This change does not access a persistence store, mutate an
existing Run, or overwrite a historical evidence pack.

## Consequences

- Current R7 compiler and fixture paths use the Shanghai v2 identities.
- Tests reject Beijing-Yanjiao references from current generated assets.
- Historical v1 readback is exact and read-only; retired content cannot bind a
  new Run.
- A future calibrated Shanghai scenario requires separate data-governance,
  model-calibration, runtime, and release authorization.
- Core settlement formulas, formal truth fields, replay semantics, routes,
  and database behavior remain unchanged.

## Non-Goals

- PostgreSQL or SQL activation
- Pilot or Production authorization
- Real customer, project, or policy data
- Scenario runtime activation or Teacher/Student/Admin UI activation
