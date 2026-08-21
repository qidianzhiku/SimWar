# DUAL_KG_RECONCILIATION

- Source/CodeGraph: authoritative for implementation call paths; current and up to date.
- Graphify: partial structural extraction only; no graph/cluster artifact was treated as truth.
- Reconciliation: no semantic dependency was accepted solely from Graphify. The implementation was checked against current source, shared contracts, repository ports, canonical admission, and focused tests.
- Status: `SOURCE_AND_CODEGRAPH_AUTHORITATIVE`, with Graphify limitation preserved.
