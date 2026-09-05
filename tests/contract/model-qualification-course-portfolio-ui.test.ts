import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("apps/admin/src/ModelQualificationCoursePortfolioPanel.tsx", "utf8");

describe("O9 Admin course portfolio UI boundary", () => {
  it("uses the exact admin read and explicit supersession preview endpoints", () => {
    expect(source).toContain("/api/v1/bff/admin/model-qualification/course-portfolio");
    expect(source).toContain(
      "/api/v1/bff/admin/model-qualification/course-portfolio/supersession-preview"
    );
    expect(source).toContain("expected_portfolio_state_digest");
    expect(source).toContain("REBASE_REQUIRED");
    expect(source).toContain("preview_applied=false");
  });

  it("keeps the projection query-only and does not add a Student portfolio endpoint", () => {
    expect(source).toContain("derived · query-only · Provider OFF");
    expect(source).toContain("未执行任何组合或治理变更");
    expect(source).not.toContain("/api/v1/bff/student/model-qualification/course-portfolio");
    expect(source).not.toContain("自动回退");
  });
});
