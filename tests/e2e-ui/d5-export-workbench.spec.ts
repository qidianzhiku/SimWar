import { expect, test, type Page } from "@playwright/test";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const digest = "a".repeat(64);
const reportRef = { content_digest: digest, discriminator: "exact_ref", resource_id: "report_d5", resource_type: "student_learning_report", tenant_id: "tenant_demo", version: "1.0.0" };
const bundleRef = { content_digest: "b".repeat(64), discriminator: "exact_ref", resource_id: "bundle_d5", resource_type: "learning_export_bundle_version", tenant_id: "tenant_demo", version: "1.0.0" };

async function signIn(page: Page) {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill("teacher");
  await page.getByLabel("password").fill("teacher");
  await page.getByRole("button", { name: "教师登录" }).click();
}

test("Teacher D5 export workbench keeps exact refs and exposes mock delivery receipt", async ({ page }) => {
  let deliveredJob: Record<string, unknown> | null = null;
  await page.route("**/api/v1/bff/teacher/learning-reports", (route) => route.fulfill({ json: { code: "OK", data: { reports: [{ report_ref: reportRef, context: { course_id: "course_d5", run_id: "run_d5", team_id: "team_d5", role_key: "CEO" }, status: "CONFIRMED" }], known_limits: [], report_schema_version: "student-learning-report.v1", runtime_authority: "JSON_INTERNAL_ONLY", scope: "tenant_preview" }, message: "success", request_id: "d5-reports" } }));
  await page.route("**/api/v1/bff/teacher/learning-exports", (route) => route.fulfill({ json: { code: "OK", data: { bundles: [], jobs: deliveredJob ? [deliveredJob] : [], receipts: [], known_limits: ["Mock LRS only"] }, message: "success", request_id: "d5-list" } }));
  await page.route("**/api/v1/bff/teacher/learning-exports/preview", async (route) => { expect(route.request().postDataJSON().report_refs[0]).toEqual(reportRef); await route.fulfill({ json: { code: "OK", data: { source_report_refs: [reportRef], statements: [{}], aol_dataset: { rows: [{ group_key: "course_d5", sample_size: 1, suppressed: true }] }, known_limits: ["Mock LRS only"] }, message: "success", request_id: "d5-preview" } }); });
  await page.route("**/api/v1/bff/teacher/learning-exports/seal", async (route) => { expect(route.request().postDataJSON().report_refs[0]).toEqual(reportRef); await route.fulfill({ json: { code: "OK", data: { bundle_ref: bundleRef, bundle_digest: "c".repeat(64) }, message: "generated", request_id: "d5-seal" } }); });
  await page.route("**/api/v1/bff/teacher/learning-exports/jobs", async (route) => { deliveredJob = { job_ref: { resource_id: "job_d5" }, status: "DELIVERED", attempt_count: 1 }; await route.fulfill({ json: { code: "OK", data: deliveredJob, message: "created", request_id: "d5-job" } }); });
  await page.goto(teacherBaseUrl);
  await signIn(page);
  const workbench = page.getByLabel("D5 teacher evidence export workbench");
  await expect(workbench).toBeVisible();
  await expect(workbench.getByText("report_d5@1.0.0")).toBeVisible();
  await workbench.getByRole("button", { name: "Preview" }).click();
  await expect(workbench.getByText("Preview ready")).toBeVisible();
  await workbench.getByRole("button", { name: "Seal immutable bundle" }).click();
  await expect(workbench.getByText("Bundle sealed")).toBeVisible();
  await workbench.getByRole("button", { name: "Deliver to Mock LRS" }).click();
  await expect(workbench.getByText("DELIVERED")).toBeVisible();
  await expect(workbench.getByText("teacher_feedback")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
