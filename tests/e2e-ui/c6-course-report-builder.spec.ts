import { expect, test, type Page } from "@playwright/test";
import { cleanupPlaywrightStore } from "./store-isolation";

const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;

const report = {
  applied_filters: { course_id: "course_001", kpis: ["revenue", "score"], run_id: "run_001" },
  known_limits: ["JSON_INTERNAL_ONLY", "POSTGRESQL_NOT_ACTIVE"],
  report_schema_version: "course-report.v1",
  rows: [
    {
      course_id: "course_001",
      metrics: [
        { kpi: "revenue", value: 10800 },
        { kpi: "score", value: 91 }
      ],
      round_no: 1,
      run_id: "run_001",
      team_id: "team_001",
      team_name: "North Team"
    }
  ]
};

function envelope(data: unknown) {
  return { code: "OK", data, message: "success", request_id: "req_c6_browser" };
}

async function signIn(page: Page, surface: "admin" | "teacher"): Promise<void> {
  const login = page.getByLabel(`${surface} login`);
  await login.getByLabel("tenant").fill("tenant_demo");
  await login.getByLabel("username").fill(surface);
  await login.getByLabel("password").fill(surface);
  await login.getByRole("button", { name: surface === "admin" ? "管理员登录" : "教师登录" }).click();
  await expect(page.getByText("signed in", { exact: true })).toBeVisible();
}

test.afterEach(() => {
  cleanupPlaywrightStore();
});

test("Admin previews and exports only the frozen safe report projection", async ({ page }) => {
  const observedPaths: string[] = [];
  await page.route("**/api/v1/bff/admin/course-reports/**", async (route) => {
    observedPaths.push(route.request().url());
    const format = new URL(route.request().url()).searchParams.get("format") as "json" | "csv";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope({ export_format: format, file_name: `report.${format}`, report }))
    });
  });
  await page.route("**/api/v1/bff/admin/course-reports?*", async (route) => {
    observedPaths.push(route.request().url());
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(envelope(report)) });
  });

  await page.goto(adminBaseUrl);
  await signIn(page, "admin");
  const panel = page.getByLabel("Admin Course Report Builder");
  await panel.getByLabel("report course").fill("course_001");
  await panel.getByLabel("report run").fill("run_001");
  await panel.getByLabel("KPI revenue").check();
  await panel.getByLabel("KPI score").check();
  await panel.getByRole("button", { name: "Preview Course Report" }).click();
  await expect(panel.getByLabel("Course report preview").getByText("North Team")).toBeVisible();
  await expect(panel.getByText("state_true", { exact: true })).toHaveCount(0);
  await panel.getByRole("button", { name: "Export report as CSV" }).click();
  await expect(panel.getByLabel("Course report export receipt")).toContainText("report.csv");
  expect(observedPaths).toHaveLength(2);
  expect(observedPaths.every((path) => !new URL(path).searchParams.has("tenant_id"))).toBe(true);
});

test("Teacher ignores a stale report response after its selected scope changes", async ({ page }) => {
  let releaseOld: (() => void) | undefined;
  const oldResponse = new Promise<void>((resolve) => {
    releaseOld = resolve;
  });
  let calls = 0;
  await page.route("**/api/v1/bff/teacher/course-reports?*", async (route) => {
    calls += 1;
    if (calls === 1) {
      await oldResponse;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(envelope({ ...report, rows: [{ ...report.rows[0], team_name: "Old Team" }] }))
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope({ ...report, rows: [{ ...report.rows[0], team_name: "Current Team" }] }))
    });
  });
  await page.route("**/api/v1/bff/teacher/course-reports/export?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope({ export_format: "json", file_name: "report.json", report }))
    });
  });

  await page.goto(teacherBaseUrl);
  await signIn(page, "teacher");
  const panel = page.getByLabel("Teacher Course Report Builder");
  await panel.getByLabel("report course").fill("course_001");
  await panel.getByRole("button", { name: "Preview Course Report" }).click();
  await panel.getByLabel("report course").fill("course_002");
  await panel.getByRole("button", { name: "Preview Course Report" }).click();
  await expect(panel.getByText("Current Team")).toBeVisible();
  releaseOld?.();
  await expect(panel.getByText("Old Team")).toHaveCount(0);
  await panel.getByRole("button", { name: "Export report as JSON" }).click();
  await expect(panel.getByLabel("Course report export receipt")).toContainText("report.json");
});
