import { expect, test, type Page } from "@playwright/test";
import { cleanupPlaywrightStore } from "./store-isolation";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;

test.afterAll(() => {
  cleanupPlaywrightStore();
});

async function signIn(page: Page, buttonName: "教师登录" | "学员登录", username: string) {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill(username);
  await page.getByLabel("password").fill(username);
  await page.getByRole("button", { name: buttonName }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

test("Teacher checks scenario readiness through the read-only BFF without a tenant header", async ({
  page
}) => {
  const consoleMessages: string[] = [];
  page.on("console", (message) => consoleMessages.push(message.text()));

  await page.goto(teacherBaseUrl);
  await signIn(page, "教师登录", "teacher");
  await expect(page.getByText("M1 康养教学闭环课程").first()).toBeVisible();
  const createRun = page.getByRole("button", { name: "创建 Run" });
  if (await createRun.isVisible()) {
    await createRun.click();
    await expect(page.getByText("run created")).toBeVisible();
  }

  const panel = page.getByLabel("scenario readiness");
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Check readiness" }).click();
  await expect(panel.getByText("Scenario Package ID is required.")).toBeVisible();
  await panel.getByLabel("scenario package id").fill("scenario_eldercare_demo");
  await panel.getByLabel("parameter set id").fill("param_toy_approved_1");

  const readinessRequest = page.waitForRequest((request) =>
    request.url().includes("/scenario-selection-readiness")
  );
  await panel.getByRole("button", { name: "Check readiness" }).click();
  const request = await readinessRequest;

  expect(request.method()).toBe("GET");
  expect(request.headers()["x-tenant-id"]).toBeUndefined();
  expect(request.url()).toContain("scenarioPackageId=scenario_eldercare_demo");
  expect(request.url()).toContain("parameterSetId=param_toy_approved_1");

  await expect(panel.locator(".readiness-result > strong")).toHaveText("READY");
  await expect(panel.getByText("COMPATIBLE_BY_REFERENCE_ONLY")).toBeVisible();
  await expect(panel.getByText("Known limits")).toBeVisible();
  await expect(panel.getByText("SCENARIO_RUNTIME_NOT_ACTIVATED")).toBeVisible();
  await expect(
    panel.getByRole("button", { name: /Activate|Launch|Replay|Publish|Settlement/i })
  ).toHaveCount(0);

  const privateMarkers = [
    "state_true",
    "canonical_evidence_digest",
    "decision_batch_hash",
    "ReplayManifest",
    "base_market_size"
  ];
  const panelText = await panel.innerText();
  for (const marker of privateMarkers) {
    expect(panelText).not.toContain(marker);
    expect(consoleMessages.join("\n")).not.toContain(marker);
  }

  await page.route(/\/scenario-selection-readiness\?/, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        operation_id: "R7_TEACHER_SCENARIO_SELECTION_READINESS_GET_V1",
        tenant_id: "tenant_demo",
        course_id: "course_demo",
        run_id: "run_demo",
        scenario_package_id: "scenario_eldercare_demo",
        parameter_set_id: "param_toy_approved_1",
        eligible: false,
        readiness_status: "BLOCKED",
        compatibility_status: "COMPATIBLE_BY_REFERENCE_ONLY",
        provenance_status: "INTERNAL_SYNTHETIC_ONLY",
        qa_status: "DRAFT_REVIEW_REQUIRED",
        license_status: "EXTERNAL_LICENSE_REVIEW_REQUIRED_BEFORE_RELEASE",
        calibration_status: "DRAFT_REGISTER_ONLY",
        runtime_adapter_status: "PREPARATION_PACKAGE_ONLY",
        no_go_reasons: ["R7_BFF_PARAMETER_SET_NOT_APPROVED"],
        evidence_freshness: { collected_at: null, expires_at: null, is_expired: false },
        explicit_non_proofs: ["SCENARIO_RUNTIME_NOT_ACTIVATED"]
      })
    });
  });
  await panel.getByRole("button", { name: "Check readiness" }).click();
  await expect(panel.locator(".readiness-result > strong")).toHaveText("BLOCKED");
  await expect(panel.getByText("R7_BFF_PARAMETER_SET_NOT_APPROVED")).toBeVisible();

  await page.unroute(/\/scenario-selection-readiness\?/);
  await page.route(/\/scenario-selection-readiness\?/, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 404,
      body: JSON.stringify({
        error: {
          code: "R7_BFF_SCENARIO_SELECTION_CONTEXT_NOT_FOUND",
          message: "scenario selection context not found",
          correlation_id: "req_browser"
        }
      })
    });
  });
  await panel.getByRole("button", { name: "Check readiness" }).click();
  await expect(panel.getByText("Readiness is unavailable or out of scope.")).toBeVisible();
});

test("Student has no scenario readiness surface and never calls the Teacher endpoint", async ({
  page
}) => {
  const readinessRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/scenario-selection-readiness")) {
      readinessRequests.push(request.url());
    }
  });

  await page.goto(studentBaseUrl);
  await signIn(page, "学员登录", "student");

  await expect(page.getByLabel("scenario readiness")).toHaveCount(0);
  const studentText = await page.locator("body").innerText();
  for (const marker of [
    "Scenario Readiness",
    "R7_BFF_PARAMETER_SET_NOT_APPROVED",
    "PREPARATION_PACKAGE_ONLY",
    "INTERNAL_SYNTHETIC_ONLY"
  ]) {
    expect(studentText).not.toContain(marker);
  }
  expect(readinessRequests).toEqual([]);
});
