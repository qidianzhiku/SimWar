import { expect, test } from "@playwright/test";

const digest = "a".repeat(64);

function exactRef(resourceType: string, resourceId: string, version: string) {
  return {
    content_digest: digest,
    discriminator: "exact_ref",
    resource_id: resourceId,
    resource_type: resourceType,
    tenant_id: "tenant_demo",
    version
  };
}

test("Student Learning Report shows exact refs, provenance, and no private payload", async ({ page }) => {
  const report = {
    business_outcome: {
      status: "SEPARATE_SAFE_OUTCOME",
      summary: "Published business outcome remains in its separate safe result surface."
    },
    context: { course_id: "course_demo", run_id: "run_d4", team_id: "team_alpha", role_key: "CEO" },
    course_package_ref: exactRef("course_package_version", "package_d4", "1.0.0"),
    generated_at: "2026-08-03T00:00:00.000Z",
    evidence_refs: [exactRef("evidence_artifact", "artifact_d4", "1.0.0")],
    known_limits: ["Human validation is not performed."],
    learning_goal_ref: exactRef("learning_goal_version", "goal_d4", "1.0.0"),
    learning_evidence: {
      criterion_results: [{ criterion_id: "criterion_d4", level_ordinal: 2 }],
      provenance_chain: [{
        discriminator: "d4_provenance_edge",
        relation: "derived_from",
        source_ref: exactRef("role_workflow_event", "event_d4", "1.0.0"),
        target_ref: exactRef("evidence_artifact", "artifact_d4", "1.0.0")
      }],
      student_visible_feedback: []
    },
    report_digest: "b".repeat(64),
    report_ref: exactRef("student_learning_report", "student_report_confirmation_d4", "1.0.0"),
    rubric_ref: exactRef("rubric_version", "rubric_d4", "1.0.0"),
    runtime_authority: "JSON_INTERNAL_ONLY",
    schema_version: "student-learning-report.v1",
    source_confirmation_digest: digest,
    status: "CONFIRMED",
    student_scope: { team_id: "team_alpha", tenant_id: "tenant_demo", user_id: "usr_student" },
    teacher_confirmation_ref: exactRef("teacher_confirmation_version", "confirmation_d4", "2.0.0"),
    visibility: "student_safe"
  };

  await page.route("**/api/v1/bff/student/learning-reports", (route) =>
    route.fulfill({
      json: {
        code: "OK",
        data: {
          known_limits: ["Human validation is not performed."],
          reports: [report],
          report_schema_version: "student-learning-report.v1",
          runtime_authority: "JSON_INTERNAL_ONLY",
          scope: "student_team"
        },
        message: "success",
        request_id: "d4-browser"
      }
    })
  );

  await page.goto("/");
  const login = page.getByLabel("student login");
  await login.getByLabel("tenant").fill("tenant_demo");
  await login.getByLabel("username").fill("student");
  await login.getByLabel("password").fill("student");
  await login.getByRole("button", { name: "学员登录" }).click();

  const panel = page.getByLabel("student learning report");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("student_report_confirmation_d4 · v1.0.0")).toBeVisible();
  await expect(panel.getByText("1 条来源链")).toBeVisible();
  await expect(panel.getByText("teacher_feedback")).toHaveCount(0);
  await expect(panel.getByText("raw_evidence_payload")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
