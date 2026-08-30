# M26 source-bound operating and capital world

M26 compiles a source-bound operating candidate from the M25 public-source
evidence epoch. It reuses M25 feature identities and binds every operating
asset to the exact epoch digest and to a deterministic source-feature use
count. It does not add a kernel, runtime, registry, route, formal ParameterSet
writer, or finance truth writer.

## State transition

- State A: `STATIC_CANDIDATE_FIXTURES`, where the predecessor candidate assets
  were not bound to a current public-source epoch and the capital evidence gap
  was implicit.
- State B: `SOURCE_BOUND_OPERATING_CAPITAL_WORLD_COMPILED`.

The compiler emits three bounded Hangzhou assets from M25's labeled public
targets: nursing-bed ratio, dementia beds per 10,000 older people, and
certified care staff per 10,000 older people. The values remain candidate
context; the compiler never treats a target as an observed outcome.

## Capital and role boundaries

Capital feasibility is explicitly `NOT_COMPUTABLE` because the public-source
epoch has no audited cash-flow, capital, revenue, cost, covenant, or runway
observation. Finance receives an empty feature input list. The double-count
guard records one operating-layer use per source feature and prevents a hidden
finance loop.

Teacher visibility may include the candidate diagnostics and recovery state;
student visibility is limited to bounded labels and observable directions;
admin visibility is internal research only. Private finance rows, official
Truth, Settlement, Score, and Rank are forbidden from student output.

`validateM26SourceBoundOperatingCapitalWorldPack` recomputes pack, asset, and
corridor digests and fails closed for epoch drift, hidden fallback, invalid
finance inputs, double counting, and authority violations. Provider, formal
Truth/Settlement/ParameterSet writes, PostgreSQL/RLS, Pilot, Production, and
Human Validation remain off.
