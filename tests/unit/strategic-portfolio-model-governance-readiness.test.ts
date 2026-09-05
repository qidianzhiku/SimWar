import { describe, expect, it } from "vitest";
import type {
  ModelQualification,
  ModelQualificationCoursePortfolio,
  W4StrategicPortfolioProjection
} from "@simwar/shared-contracts";
import {
  buildStrategicPortfolioModelGovernanceReadiness,
  STRATEGIC_PORTFOLIO_MODEL_GOVERNANCE_READINESS_POLICY_DIGEST,
  type StrategicPortfolioModelGovernanceReadinessInput
} from "../../services/api/src/strategic-portfolio-model-governance-readiness";

const TENANT = "tenant_demo";
const COURSE = "course_demo";
const ADOPTION_DIGEST = "a".repeat(64);
const ADOPTION_ID = "adoption_demo";
const QUALIFICATION_DIGEST = "b".repeat(64);
const QUALIFICATION_ID = "qualification_demo";
const MODEL_VERSION = {
  model_version_id: "model-version-demo",
  version: "1.0.0"
} as const;
const ARTIFACT = {
  artifact_id: "artifact-demo",
  artifact_digest: "c".repeat(64),
  artifact_type: "typescript-runtime"
} as const;

function qualification(): ModelQualification {
  return {
    artifact: ARTIFACT,
    authority_flags: { official_truth_write: false, provider_calls: 0 },
    binding: { course_id: COURSE, status: "BOUND" },
    calibration_dataset_id: "dataset-demo",
    content_digest: QUALIFICATION_DIGEST,
    course_id: COURSE,
    created_at: "2026-09-01T00:00:00.000Z",
    decision: "APPROVED",
    deterministic_seed: 7,
    diagnostics: {
      baseline_error: 0,
      convergence_status: "CONVERGED",
      differential_error: 0,
      drift_score: 0,
      holdout_leakage_count: 0,
      ood_rate: 0,
      sensitivity_max_delta: 0
    },
    known_limits: [],
    model_version_reference: MODEL_VERSION,
    no_implicit_latest: true,
    qualification_id: QUALIFICATION_ID,
    reasons: [],
    review: { status: "APPROVED" },
    source_package_id: "source-demo",
    tenant_id: TENANT,
    updated_at: "2026-09-01T00:00:00.000Z"
  };
}

function w4Portfolio(overrides: Partial<W4StrategicPortfolioProjection> = {}) {
  return {
    schema_version: "w4-strategic-portfolio.v1",
    candidate_status: "DERIVED",
    portfolio_id: "w4-portfolio-demo",
    portfolio_ref: {
      tenant_id: TENANT,
      course_id: COURSE,
      run_id: "run-demo",
      team_id: "team-demo",
      round_no: 1,
      portfolio_digest: "d".repeat(64)
    },
    exact_scope: {
      tenant_id: TENANT,
      course_id: COURSE,
      run_id: "run-demo",
      team_id: "team-demo",
      round_no: 1
    },
    members: [],
    allocations: [],
    constraints: {
      status: "WITHIN_LIMIT",
      cash_available: 100,
      covenant_min_cash: 0,
      total_project_cost: 0,
      allocated_capital_principal: 0,
      unfunded_project_cost: 0,
      dependency_project_entry_ids: []
    },
    persistence: {
      official_state_authority: "W4_ENTERPRISE_STATE_SERVICE",
      opening_state_ref: null,
      closing_state_ref: null,
      next_opening_state_ref: null,
      historical_decision_reentry: false
    },
    writer_authority: "SOLE_W4_ENTERPRISE_STATE_SERVICE",
    known_limits: [],
    ...overrides
  } satisfies W4StrategicPortfolioProjection;
}

function mqrPortfolio(overrides: Partial<ModelQualificationCoursePortfolio> = {}) {
  return {
    adoption_mutation: false,
    blockers: [],
    courses: [
      {
        adoption_state_digest: "e".repeat(64),
        blockers: [],
        course: { course_id: COURSE, tenant_id: TENANT, title: "Demo course" },
        current_adoption: { adoption_id: ADOPTION_ID, adoption_digest: ADOPTION_DIGEST },
        current_adoption_candidates: [
          { adoption_id: ADOPTION_ID, adoption_digest: ADOPTION_DIGEST }
        ],
        current_adoption_epoch: null,
        known_limits: [],
        o8_outcomes: [],
        qualification: qualification(),
        qualification_candidates: [
          { qualification_id: QUALIFICATION_ID, content_digest: QUALIFICATION_DIGEST }
        ],
        qualification_consistency: "CONSISTENT",
        writer_effect: "NONE"
      }
    ],
    derived: true,
    formal_truth_write: false,
    history_deleted: false,
    known_limits: [],
    no_new_registry: true,
    no_new_store: true,
    no_new_writer: true,
    official_truth_write: false,
    portfolio_state_digest: "f".repeat(64),
    portfolio_status: "READY",
    provider: "OFF",
    query_only: true,
    rank_write: false,
    rollback_applied: false,
    score_write: false,
    schema_version: "model-qualification-course-portfolio.v1",
    settlement_write: false,
    tenant_id: TENANT,
    writes_formal_truth: false,
    writer_effect: "NONE",
    ...overrides
  } satisfies ModelQualificationCoursePortfolio;
}

function input(
  overrides: Partial<StrategicPortfolioModelGovernanceReadinessInput> = {}
): StrategicPortfolioModelGovernanceReadinessInput {
  return {
    tenant_id: TENANT,
    mqr_portfolio: mqrPortfolio(),
    strategic_portfolios: [w4Portfolio()],
    readiness_policy_digest: STRATEGIC_PORTFOLIO_MODEL_GOVERNANCE_READINESS_POLICY_DIGEST,
    ...overrides
  };
}

describe("SP-O2 strategic portfolio model governance readiness", () => {
  it("joins exact W4 and MQR identities as a derived query-only readiness result", () => {
    const result = buildStrategicPortfolioModelGovernanceReadiness(input());
    expect(result.readiness_status).toBe("READY");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.exact_scope).toEqual({
      tenant_id: TENANT,
      course_id: COURSE,
      run_id: "run-demo",
      team_id: "team-demo",
      round_no: 1
    });
    expect(result.entries[0]?.qualification?.qualification_id).toBe(QUALIFICATION_ID);
    expect(result.entries[0]?.current_adoption?.adoption_id).toBe(ADOPTION_ID);
    expect(result.derived).toBe(true);
    expect(result.query_only).toBe(true);
    expect(result.writer_effect).toBe("NONE");
    expect(result.no_new_writer).toBe(true);
    expect(result.no_new_store).toBe(true);
    expect(result.no_new_registry).toBe(true);
    expect(result.provider).toBe("OFF");
    expect(result.readiness_digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns REBASE_REQUIRED when the caller's exact portfolio digest is stale", () => {
    const result = buildStrategicPortfolioModelGovernanceReadiness(
      input({ expected_portfolio_state_digest: "0".repeat(64) })
    );
    expect(result.readiness_status).toBe("REBASE_REQUIRED");
    expect(result.entries[0]?.readiness).toBe("REBASE_REQUIRED");
    expect(result.entries[0]?.blockers).toContain("PORTFOLIO_STATE_DIGEST_MISMATCH");
  });

  it("never creates a phantom course from a W4 projection", () => {
    const result = buildStrategicPortfolioModelGovernanceReadiness(
      input({
        strategic_portfolios: [
          w4Portfolio({
            portfolio_ref: {
              ...w4Portfolio().portfolio_ref,
              course_id: "phantom-course"
            },
            exact_scope: { ...w4Portfolio().exact_scope, course_id: "phantom-course" }
          })
        ]
      })
    );
    expect(result.readiness_status).toBe("BLOCKED");
    expect(result.entries[0]?.readiness).toBe("BLOCKED");
    expect(result.entries[0]?.blockers).toContain("COURSE_NOT_IN_CANONICAL_AUTHORITY");
  });

  it("distinguishes missing exact qualification from a current ready join", () => {
    const portfolio = mqrPortfolio({
      courses: [
        {
          ...mqrPortfolio().courses[0]!,
          current_adoption: null,
          qualification: null,
          qualification_consistency: "BLOCKED",
          blockers: [
            {
              code: "QUALIFICATION_MISSING",
              course_id: COURSE,
              observed_tenant_id: TENANT,
              related_digests: [],
              related_ids: []
            }
          ]
        }
      ],
      portfolio_status: "BLOCKED"
    });
    const result = buildStrategicPortfolioModelGovernanceReadiness(input({ mqr_portfolio: portfolio }));
    expect(result.readiness_status).toBe("BLOCKED");
    expect(result.entries[0]?.readiness).toBe("NO_QUALIFIED_MODEL");
  });

  it("blocks a non-canonical W4 authority instead of silently accepting the join", () => {
    const portfolio = w4Portfolio({
      writer_authority: "UNAUTHORIZED_WRITER" as never
    });
    const result = buildStrategicPortfolioModelGovernanceReadiness(
      input({ strategic_portfolios: [portfolio] })
    );
    expect(result.readiness_status).toBe("BLOCKED");
    expect(result.entries[0]?.blockers).toContain("W4_AUTHORITY_INVALID");
  });
});
