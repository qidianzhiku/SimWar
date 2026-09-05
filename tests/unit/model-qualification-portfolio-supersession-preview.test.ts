import { describe, expect, it } from "vitest";
import {
  buildModelQualificationPortfolioSupersessionPreview,
  digestModelQualificationPortfolioState,
  digestModelQualificationPortfolioCourseState,
  type ModelQualificationPortfolio,
  type ModelQualificationPortfolioCourse,
  type ModelQualificationPortfolioCourseIdentity,
  type ModelQualificationPortfolioCourseState
} from "../../services/api/src/model-qualification-portfolio-supersession-preview";

const TENANT_ID = "tenant-demo";

function adoption(seed: string) {
  return {
    adoption_id: `adoption-${seed}`,
    adoption_digest: seed.repeat(64)
  };
}

function state(
  overrides: Partial<ModelQualificationPortfolioCourseState> = {}
): ModelQualificationPortfolioCourseState {
  return {
    current_adoption: adoption("a"),
    governed_rollback_available: false,
    requalification_required: false,
    review_required: false,
    blocked_reasons: [],
    ...overrides
  };
}

function course(
  course_id: string,
  stateOverrides: Partial<ModelQualificationPortfolioCourseState> = {},
  authorized = true
): ModelQualificationPortfolioCourse {
  return {
    course_id,
    tenant_id: TENANT_ID,
    authorized,
    state: state(stateOverrides)
  };
}

function portfolio(
  courses: readonly ModelQualificationPortfolioCourse[]
): ModelQualificationPortfolio {
  return {
    portfolio_id: "portfolio-demo",
    tenant_id: TENANT_ID,
    courses
  };
}

function identity(
  selected: ModelQualificationPortfolioCourse
): ModelQualificationPortfolioCourseIdentity {
  return {
    course_id: selected.course_id,
    tenant_id: selected.tenant_id,
    course_state_digest: digestModelQualificationPortfolioCourseState(selected.state),
    current_adoption: selected.state.current_adoption
  };
}

function input(
  exactPortfolio: ModelQualificationPortfolio,
  selected: readonly ModelQualificationPortfolioCourseIdentity[]
) {
  return {
    portfolio: exactPortfolio,
    selected_course_identities: selected,
    expected_portfolio_state_digest: digestModelQualificationPortfolioState(exactPortfolio)
  };
}

describe("model qualification portfolio supersession preview", () => {
  it("keeps an exact current course and emits a deterministic query-only receipt", () => {
    const exactPortfolio = portfolio([course("course-keep")]);
    const request = input(exactPortfolio, [identity(exactPortfolio.courses[0]!)]);
    const before = structuredClone(exactPortfolio);

    const first = buildModelQualificationPortfolioSupersessionPreview(request);
    const second = buildModelQualificationPortfolioSupersessionPreview(request);

    expect(first).toMatchObject({
      status: "KEEP_CURRENT",
      portfolio_id: "portfolio-demo",
      tenant_id: TENANT_ID,
      selected_course_ids: ["course-keep"],
      expected_portfolio_state_digest: request.expected_portfolio_state_digest,
      current_portfolio_state_digest: request.expected_portfolio_state_digest,
      derived: true,
      query_only: true,
      writes_formal_truth: false,
      preview_applied: false,
      writer_effect: "NONE"
    });
    expect(first.course_previews).toEqual([
      expect.objectContaining({
        course_id: "course-keep",
        current_adoption: adoption("a"),
        status: "KEEP_CURRENT"
      })
    ]);
    expect(first.preview_digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.preview_digest).toBe(second.preview_digest);
    expect(first.preview_id).toBe(second.preview_id);
    expect(exactPortfolio).toEqual(before);
  });

  it("returns REBASE_REQUIRED when the expected portfolio digest is stale", () => {
    const original = portfolio([course("course-stale")]);
    const changed = portfolio([course("course-stale", { review_required: true })]);
    const selected = [identity(original.courses[0]!)];

    const result = buildModelQualificationPortfolioSupersessionPreview({
      portfolio: changed,
      selected_course_identities: selected,
      expected_portfolio_state_digest: digestModelQualificationPortfolioState(original)
    });

    expect(result.status).toBe("REBASE_REQUIRED");
    expect(result.blockers).toContain("PORTFOLIO_STATE_DIGEST_CHANGED");
    expect(result.expected_portfolio_state_digest).not.toBe(result.current_portfolio_state_digest);
  });

  it("fails closed for missing, duplicate, and unauthorized exact selections", () => {
    const authorizedCourse = course("course-authorized");
    const unauthorizedCourse = course("course-private", {}, false);
    const exactPortfolio = portfolio([authorizedCourse, unauthorizedCourse]);
    const expected = digestModelQualificationPortfolioState(exactPortfolio);

    const missing = buildModelQualificationPortfolioSupersessionPreview({
      portfolio: exactPortfolio,
      selected_course_identities: [
        {
          course_id: "course-missing",
          tenant_id: TENANT_ID,
          course_state_digest: "0".repeat(64),
          current_adoption: null
        }
      ],
      expected_portfolio_state_digest: expected
    });
    expect(missing.status).toBe("REBASE_REQUIRED");
    expect(missing.blockers).toContain("SELECTED_COURSE_NOT_FOUND");

    const duplicateIdentity = identity(authorizedCourse);
    const duplicate = buildModelQualificationPortfolioSupersessionPreview({
      portfolio: exactPortfolio,
      selected_course_identities: [duplicateIdentity, duplicateIdentity],
      expected_portfolio_state_digest: expected
    });
    expect(duplicate.status).toBe("REBASE_REQUIRED");
    expect(duplicate.blockers).toContain("SELECTED_COURSE_ID_DUPLICATE");

    const unauthorized = buildModelQualificationPortfolioSupersessionPreview({
      portfolio: exactPortfolio,
      selected_course_identities: [identity(unauthorizedCourse)],
      expected_portfolio_state_digest: expected
    });
    expect(unauthorized.status).toBe("REBASE_REQUIRED");
    expect(unauthorized.blockers).toContain("SELECTED_COURSE_NOT_AUTHORIZED");
  });

  it("derives each allowed readiness state from the selected course state", () => {
    const courses = [
      course("course-current"),
      course("course-review", { review_required: true }),
      course("course-requalify", { requalification_required: true }),
      course("course-rollback", { governed_rollback_available: true }),
      course("course-blocked", { blocked_reasons: ["SOURCE_RIGHTS_INVALID"] }),
      course("course-empty", { current_adoption: null }),
      course("course-unselected")
    ];
    const exactPortfolio = portfolio([...courses].reverse());
    const selected = courses
      .filter((item) => item.course_id !== "course-unselected")
      .reverse()
      .map(identity);

    const result = buildModelQualificationPortfolioSupersessionPreview(
      input(exactPortfolio, selected)
    );
    const statusByCourse = new Map(
      result.course_previews.map((preview) => [preview.course_id, preview.status])
    );

    expect(result.status).toBe("BLOCKED");
    expect(statusByCourse).toEqual(
      new Map([
        ["course-blocked", "BLOCKED"],
        ["course-current", "KEEP_CURRENT"],
        ["course-empty", "NO_ACTIONABLE_ADOPTION"],
        ["course-requalify", "REQUALIFY_CURRENT"],
        ["course-review", "REVIEW_EXISTING"],
        ["course-rollback", "REQUEST_GOVERNED_ROLLBACK"]
      ])
    );
    expect(result.selected_course_ids).not.toContain("course-unselected");
  });

  it("returns REBASE_REQUIRED when a selected course identity no longer matches current state", () => {
    const original = course("course-changing");
    const originalPortfolio = portfolio([original]);
    const selected = [identity(original)];
    const changedPortfolio = portfolio([
      course("course-changing", {
        current_adoption: adoption("b"),
        review_required: true
      })
    ]);

    const result = buildModelQualificationPortfolioSupersessionPreview({
      portfolio: changedPortfolio,
      selected_course_identities: selected,
      expected_portfolio_state_digest: digestModelQualificationPortfolioState(changedPortfolio)
    });

    expect(result.status).toBe("REBASE_REQUIRED");
    expect(result.blockers).toEqual(
      expect.arrayContaining(["SELECTED_COURSE_STATE_CHANGED", "SELECTED_COURSE_ADOPTION_CHANGED"])
    );
    expect(result.expected_portfolio_state_digest).toBe(
      digestModelQualificationPortfolioState(changedPortfolio)
    );
    expect(result.expected_portfolio_state_digest).not.toBe(
      digestModelQualificationPortfolioState(originalPortfolio)
    );
  });

  it("rejects selector aliases instead of resolving an implicit course", () => {
    const exactPortfolio = portfolio([course("course-explicit")]);
    const result = buildModelQualificationPortfolioSupersessionPreview({
      portfolio: exactPortfolio,
      selected_course_identities: [
        {
          course_id: "latest",
          tenant_id: TENANT_ID,
          course_state_digest: "0".repeat(64),
          current_adoption: null
        }
      ],
      expected_portfolio_state_digest: digestModelQualificationPortfolioState(exactPortfolio)
    });

    expect(result.status).toBe("REBASE_REQUIRED");
    expect(result.blockers).toEqual(
      expect.arrayContaining(["SELECTED_COURSE_SELECTOR_FORBIDDEN", "SELECTED_COURSE_NOT_FOUND"])
    );
    expect(result.course_previews).toEqual([]);
  });

  it("uses stable serialization without selecting by array position or timestamp", () => {
    const firstCourse = course("course-a");
    const secondCourse = course("course-b", { governed_rollback_available: true });
    const firstPortfolio = portfolio([firstCourse, secondCourse]);
    const secondPortfolio = portfolio([secondCourse, firstCourse]);

    const first = buildModelQualificationPortfolioSupersessionPreview(
      input(firstPortfolio, [identity(secondCourse), identity(firstCourse)])
    );
    const second = buildModelQualificationPortfolioSupersessionPreview(
      input(secondPortfolio, [identity(firstCourse), identity(secondCourse)])
    );

    expect(first.current_portfolio_state_digest).toBe(second.current_portfolio_state_digest);
    expect(first.preview_digest).toBe(second.preview_digest);
    expect(first.course_previews.map((preview) => preview.course_id)).toEqual([
      "course-a",
      "course-b"
    ]);
  });
});
