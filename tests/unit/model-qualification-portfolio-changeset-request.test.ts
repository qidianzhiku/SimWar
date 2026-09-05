import { describe, expect, it } from "vitest";
import type { ModelQualificationCoursePortfolio } from "../../services/api/src/model-qualification-course-portfolio";
import {
  buildModelQualificationPortfolioSupersessionPreview,
  digestModelQualificationPortfolioCourseState,
  digestModelQualificationPortfolioState,
  type ModelQualificationPortfolio,
  type ModelQualificationPortfolioCourse
} from "../../services/api/src/model-qualification-portfolio-supersession-preview";
import {
  buildPortfolioChangeSetRequest,
  digestPortfolioChangeSetPolicy,
  PortfolioChangeSetRequestError
} from "../../services/api/src/model-qualification-portfolio-changeset-request";

const TENANT = "tenant-demo";

function adoption(seed: string) {
  return { adoption_id: `adoption-${seed}`, adoption_digest: seed.repeat(64) };
}

function portfolio(): ModelQualificationCoursePortfolio {
  const state = {
    blocked_reasons: [],
    current_adoption: adoption("a"),
    governed_rollback_available: false,
    requalification_required: false,
    review_required: false
  };
  const sourceCourse = {
    course_id: "course-a",
    tenant_id: TENANT,
    title: "Course A"
  };
  const p: ModelQualificationPortfolio = {
    portfolio_id: `model-qualification-course-portfolio:${TENANT}`,
    tenant_id: TENANT,
    courses: [{ authorized: true, course_id: sourceCourse.course_id, state, tenant_id: TENANT }]
  };
  const preview = buildModelQualificationPortfolioSupersessionPreview({
    expected_portfolio_state_digest: digestModelQualificationPortfolioState(p),
    portfolio: p,
    selected_course_identities: [
      {
        course_id: "course-a",
        tenant_id: TENANT,
        course_state_digest: digestModelQualificationPortfolioCourseState(state),
        current_adoption: state.current_adoption
      }
    ]
  });
  return {
    preview,
    value: {
      adoption_mutation: false,
      blockers: [],
      courses: [
        {
          adoption_state_digest: "a".repeat(64),
          blockers: [],
          course: sourceCourse,
          current_adoption: state.current_adoption,
          current_adoption_candidates: [state.current_adoption],
          current_adoption_epoch: null,
          known_limits: [],
          o8_outcomes: [],
          qualification: null,
          qualification_candidates: [],
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
      portfolio_state_digest: digestModelQualificationPortfolioState(p),
      portfolio_status: "READY",
      provider: "OFF",
      query_only: true,
      rank_write: false,
      rollback_applied: false,
      schema_version: "model-qualification-course-portfolio.v1",
      score_write: false,
      settlement_write: false,
      tenant_id: TENANT,
      writes_formal_truth: false,
      writer_effect: "NONE"
    } satisfies ModelQualificationCoursePortfolio
  };
}

describe("O10 portfolio changeset request compiler", () => {
  it("compiles exact O9 input into a deterministic query-only request", () => {
    const fixture = portfolio();
    const input = {
      portfolio: fixture.value,
      preview: fixture.preview,
      expected_portfolio_state_digest: fixture.value.portfolio_state_digest,
      expected_changeset_policy_digest: digestPortfolioChangeSetPolicy()
    };
    const first = buildPortfolioChangeSetRequest(input);
    const second = buildPortfolioChangeSetRequest(input);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      status: "READY",
      requestable: true,
      selected_course_ids: ["course-a"],
      derived: true,
      query_only: true,
      provider: "OFF",
      request_persisted: false,
      handoff_executed: false,
      apply: false,
      bulk_apply: false,
      cross_course_transaction: false,
      writer_effect: "NONE"
    });
    expect(first.request_digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.request_id).toContain(first.request_digest.slice(0, 24));
    expect(first.readback.request_digest).toBe(first.request_digest);
  });

  it("keeps a stale O9 preview as an explicit rebase request, never as ready", () => {
    const fixture = portfolio();
    const stalePreview = { ...fixture.preview, status: "REBASE_REQUIRED" as const };
    const result = buildPortfolioChangeSetRequest({
      portfolio: fixture.value,
      preview: stalePreview,
      expected_portfolio_state_digest: fixture.value.portfolio_state_digest,
      expected_changeset_policy_digest: digestPortfolioChangeSetPolicy()
    });
    expect(result.status).toBe("REBASE_REQUIRED");
    expect(result.requestable).toBe(false);
  });

  it("rejects a policy digest that is not the current versioned policy", () => {
    const fixture = portfolio();
    expect(() =>
      buildPortfolioChangeSetRequest({
        portfolio: fixture.value,
        preview: fixture.preview,
        expected_portfolio_state_digest: fixture.value.portfolio_state_digest,
        expected_changeset_policy_digest: "f".repeat(64)
      })
    ).toThrowError(new PortfolioChangeSetRequestError("O10_CHANGESET_POLICY_DIGEST_CHANGED"));
  });

  it("rejects selected identity drift instead of selecting another course", () => {
    const fixture = portfolio();
    const changed = {
      ...fixture.preview,
      course_previews: fixture.preview.course_previews.map((item) => ({
        ...item,
        current_adoption: adoption("b")
      }))
    };
    expect(() =>
      buildPortfolioChangeSetRequest({
        portfolio: fixture.value,
        preview: changed,
        expected_portfolio_state_digest: fixture.value.portfolio_state_digest,
        expected_changeset_policy_digest: digestPortfolioChangeSetPolicy()
      })
    ).toThrowError(new PortfolioChangeSetRequestError("O10_SELECTED_COURSE_IDENTITY_MISMATCH"));
  });
});
