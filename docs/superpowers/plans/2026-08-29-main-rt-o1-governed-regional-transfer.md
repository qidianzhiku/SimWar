# MAIN-RT-O1 Governed Regional Transfer and Scenario Evolution

## Product outcome

Turn the existing Shanghai M4/M5/M6 candidate support packs into one reproducible,
role-safe regional-transfer product journey. A teacher selects exact tenant,
course, run, baseline/target region and versioned ScenarioPackage/ParameterSet
references; the service composes and validates a bounded candidate, freezes it,
and binds it through the existing Scenario/Course authority path. Student access
is available only after activation/publication and exposes an allowlisted
projection. Admin receives tenant-safe provenance, lifecycle and rollback
candidate information.

The candidate remains advisory/candidate-only. WANT, CAN and REALIZED remain
separate; Simulation Core remains the only official realized/settlement authority;
formal writer mutations remain zero; Provider is OFF; PostgreSQL/RLS is not
activated; no full WCAG claim, Human Validation, Pilot or Production claim is
made.

## Fresh source binding

- Repository: `qidianzhiku/SimWar`
- Protected base: `master`
- Execution base: `a93da4fa962c1be7963813b6df3845c91775056f`
- Execution tree: `d34449e3ebb4860a84d2fbaccb4cc1d870fb196d`
- Product worktree: `D:\\codex\\worktrees\\simwar-main-rt-o1-governed-regional-transfer-20260829`
- Primary dirty worktree is inherited and out of scope.
- M4/M5/M6 source revisions remain historical support references and are
  surfaced as known limits; current source readback is the authority.

## Vertical slice

1. Shared `regional-transfer.v1` contract with exact references, lifecycle,
   candidate provenance, qualification, diff, role projections and explicit
   failure states.
2. Deterministic product service that reuses M4/M5/M6 builders, verifies tenant
   and exact course/run/scenario/parameter bindings through existing authority
   ports, and persists lifecycle records in the existing JSON store collection
   without creating a second store, registry or truth writer.
3. Teacher/Admin BFF routes and Teacher/Student/Admin surfaces. Student route
   fails closed before activation/publication and never exposes source digests,
   coefficients, conflicts, private fields or teacher/admin audit data.
4. Unit, contract, integration and real-BFF browser coverage, including
   cross-tenant, implicit-latest, stale/expired, qualification, digest,
   duplicate/retry, rollback and preactivation Student negative paths.

## Planned files

Production scope is limited to the new RT contract/service/routes/surfaces,
the existing store's additive candidate collection, the shared-contract export,
the relevant app entry points, tests and the RT technical/evidence documents.
No settlement, replay hash, canonical decision, Simulation Core official result,
provider, database, workflow or unrelated frontend refactor is in scope.

## Verification and stop state

- TDD: add failing contract/service tests before implementation.
- Run focused unit/contract/integration checks, then typecheck, lint, build and
  the existing direct-store boundary guard.
- Run the RT real-BFF Playwright journey with target-route mocks set to zero;
  report focused accessibility scope honestly and preserve known limits.
- Execute H2 in a fresh independent checkout/worktree and L5 at the exact
  product head when the local slice is stable.
- Create one dedicated branch and one unmerged Product PR. Run the machine
  merge gate, perform one ordinary merge only if every required check and
  authority predicate is green, then run detached post-merge H3.
- Stop after H3 at `COMPLETE`, `COMPLETE_WITH_LIMITS`,
  `PLATFORM_NONWAIVABLE_HOLD`, or `P0_AUTHORITY_HOLD`; do not start a successor.

## Bounded same-mission remote convergence extension

The first candidate push exposed CI build-order and bundle-budget findings; the
second push fixed those findings and made `quality` and the CodeQL analysis job
green, but `browser-smoke` still exposed five concrete integration regressions.
Local commit `5e249d24df1f23c51280eeb27e824f1850b85f2e` isolates the RT journey from
unrelated Teacher and Student startup paths and is verified by the dedicated RT
journey plus the affected inherited browser specs.

The second remote analysis also classified a new high-severity CodeQL flow at
`formal-course-authority-binding.ts:88`. Exact source readback shows that the
production file is unchanged; the flow is introduced by the new RT integration
fixture passing formal Scenario runtime outputs into the binding-digest helper
within the same process that performs password-based login. The focused repair
keeps the production digest and all security checks intact, seeds exact approved
fixture snapshots directly, and retains the real BFF route journey.

Prompt paragraph 77 permits a bounded extension when additional cycles are
justified by an exact root cause. Accordingly, one third non-force push was
authorized for these two focused same-mission repairs only. It must not
change settlement, replay, canonical truth, workflow, provider, database,
security policy, or unrelated product behavior. Its remote result is recorded
below before any further convergence decision.

### Browser suite composition extension

Push 3 made `quality`, both CodeQL checks, and 121 inherited browser checks
green, but the default core suite also collected the dedicated RT journey while
running the default W3 fixture. The failure is deterministic: the RT test asks
the API for an exact RT binding, while the default fixture only contains
`run_w3_browser`, so the API correctly returns `RT_EXACT_BINDING_REQUIRED`.
The dedicated RT config already clears `testIgnore`, sets the RT fixture flag,
and passes the same test through the real BFF.

Prompt paragraphs 76, 77, and 95 require this ordinary browser composition
finding to remain in the same Mission without a new fix mission or intermediate
human authorization. One fourth and final non-force push is therefore bounded
to excluding `regional-transfer-product-journey.spec.ts` from the default core
config while retaining it in `playwright.rt-o1.config.ts`. Before that push,
both configurations must be checked with Playwright `--list`, the dedicated RT
journey must pass, and the full local `test:e2e:ui:core` command must pass. No
further push was planned after this extension; the PR4 guard result is recorded
below before the final convergence decision.

### PR4 guard alignment extension

Push 4 failed before any browser process started because
`ui-pr4-integration.test.tsx` intentionally pins the exact default `testIgnore`
expression. The production configuration behaved correctly in a full local
core run, but the guard still expected the pre-RT expression. A local rerun
reproduced exactly one failed assertion out of 57 PR4 unit tests, with all other
tests green.

Updating the guard to require the new RT-specific exclusion preserves its
original independence contract; it does not skip a PR4 test, relax a security
check, or alter browser behavior. Under Prompt paragraphs 76, 77, and 95, one
fifth and final non-force push is bounded to this guard expectation and this
Mission record. It requires `test:unit:pr4`, typecheck, lint, the dedicated RT
journey, and the full local `test:e2e:ui:core` evidence already bound to the
unchanged Playwright configuration. No further push, waiver, rerun-only
workaround, or gate bypass was planned after push 5.

### Required review convergence extension

Push 5 made `quality`, `browser-smoke`, CodeQL analysis and the separate CodeQL
run green at exact head `4d1784558bc6607ecad6579f840e84030bc4956c`.
The required-conversation-resolution gate then exposed seven unresolved review
findings: three P1 findings covering recorded lifecycle transitions, fresh
authority revalidation and exact schema shapes; one P1 OpenAPI coverage gap;
and three P2 findings covering malformed nested input, operation identifiers
and idempotent activation retries.

Exact source readback confirms all seven findings are in the RT-O1 product
scope. Prompt paragraphs 73-77 and 95 require ordinary review findings to stay
inside the same Mission and allow a bounded extension justified by exact root
cause. This section therefore supersedes the earlier push-5 stopping
assumption and authorizes one sixth non-force push limited to the RT service,
route, shared contract, JSON Schema/OpenAPI, focused tests, the contract-gate
manifest and this Mission
record. The repair must preserve one existing store, zero formal-writer
mutations, Provider OFF and unchanged settlement/replay/canonical truth. It may
be pushed only after the new tests fail on the old behavior and pass on the
repair, followed by focused, typecheck, lint, build and browser verification.
