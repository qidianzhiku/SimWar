# Strategic Portfolio Model Governance Readiness

`StrategicPortfolioModelGovernanceReadiness` is a derived, query-only join of
the canonical tenant Course Authority, W4 Enterprise State strategic portfolio
projections, and the existing Model Qualification course portfolio.

The join is exact across tenant, course, run, team, round, W4 portfolio digest,
current adoption identity, qualification identity, and the versioned readiness
policy digest. W4 remains the only strategic portfolio authority and
`ModelQualificationService` remains the only model-governance authority.

The admin BFF endpoint is:

`GET /api/v1/bff/admin/model-qualification/strategic-portfolio-readiness`

An optional `portfolioStateDigest` query parameter is an exact freshness
expectation. A mismatch produces a derived `REBASE_REQUIRED` status; it never
selects a latest or default portfolio.

The endpoint does not create or mutate courses, qualifications, adoptions,
formal runs, settlement truth, scores, ranks, or replay state. It creates no
Writer, Store, Registry, or alternate authority. Provider remains OFF.

Admin receives tenant-scoped governance details. Any future teacher or student
projection must use the role projection boundary and must not expose tenant
portfolio membership or privileged governance identities to Student.
