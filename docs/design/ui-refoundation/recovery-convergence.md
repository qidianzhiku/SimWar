# R3 Cross-role accessibility and recovery convergence

The four role surfaces use the shared `CrossRoleRecoveryRail` as a visible, keyboard-operable state boundary. It exposes exact supplied context, uses text and a cue instead of color alone, and provides a state-specific recovery action for signed-out, loading, ready, stale, re-authentication, conflict, rollback, and error states.

The rail is a presentation and recovery affordance. It does not create a route, BFF, store, writer, registry, settlement authority, or truth field. Admin and Enterprise remain projections of the existing server authorities; Teacher and Student continue to use their existing BFF and session/request identity guards.

The matrix in `recovery-state-matrix.csv` is the R3 acceptance inventory for the four critical journeys. Automated browser evidence is not Human Validation and must remain labelled `NOT_PERFORMED` in mission receipts.
