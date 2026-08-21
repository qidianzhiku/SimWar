# M2-P2 Authority / Design Reuse Receipt

Date: 2026-08-21

## Authority chain

```text
MarketWorldRef → Course context → ProjectProfile provenance/configuration
                              → exact ProjectAssignment(Course, Run, Team)
                              → existing W4 createInitialState writer
                              → existing Kernel / settlement / replay authorities
```

The Project Library service stops before W4. The Assignment route is the only orchestration seam that may request a W4 opening state, and it uses the existing W4 service with a precise Round 1 scope. Repeated assignment returns the existing W4 opening reference instead of creating another state.

## Product projections

- Teacher: list and lifecycle commands; exact refs and readiness only.
- Student: assigned safe brief for the current Course/Run/Team and authenticated team member.
- Admin: tenant-scoped profile and assignment audit, with no W4 mutation control.

## P0 evidence sources applied

- SimWar V3.0 integrated product blueprint: One Kernel/Truth/Settlement, Profile/Provenance versus Runtime Exact Authority, role-safe projections, historical non-overwrite, Shanghai thin vertical.
- STEP B V1.2 architecture: current capability reuse, sole writers, exact refs, W1 configuration seam and W4 state authority.
- STEP C V1.2 engineering plan: W1 exact Course/Run readiness, W4 state/initiative boundary, no direct UI Truth mutation, acceptance gates.
- Eldercare Stage 5 and Shanghai scenario specifications: repository fact first, generic core plus Shanghai fixture, safe normalized inputs, no raw data or production claims.

## Implementation evidence

- Unit: 6 Project Library authority tests pass.
- Integration: 2 real HTTP BFF tests pass, including W4 opening-state creation and Student privacy.
- Dedicated browser: 1/1 M2-P2 real-BFF journey passes on isolated ports 3210–3213.
