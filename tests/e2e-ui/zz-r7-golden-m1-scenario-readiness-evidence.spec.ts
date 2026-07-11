import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  R7_GOLDEN_M1_BLOCKED_PARAMETER_SET_ID,
  R7_GOLDEN_M1_BLOCKED_RUN_ID,
  R7_GOLDEN_M1_READY_PARAMETER_SET_ID,
  R7_GOLDEN_M1_READY_RUN_ID,
  R7_GOLDEN_M1_READY_SCENARIO_ID
} from "./r7-golden-m1-scenario-readiness-fixture";
import { PLAYWRIGHT_STORE_FILE, cleanupPlaywrightStore } from "./store-isolation";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const privateMarkers = [
  "state_true",
  "canonical_evidence_digest",
  "decision_batch_hash",
  "ReplayManifest",
  "base_market_size"
];

test.skip(
  process.env.SIMWAR_PLAYWRIGHT_GOLDEN_M1 !== "true",
  "Golden M1 fixture is enabled only for the dedicated isolated browser harness."
);

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

async function openScenarioReadinessPanel(page: Page) {
  const initialState = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/demo-state") &&
      response.request().method() === "GET" &&
      response.status() === 200
  );

  await page.goto(teacherBaseUrl);
  await signIn(page, "教师登录", "teacher");
  await initialState;

  const panel = page.getByLabel("scenario readiness");
  await expect(panel).toBeVisible();
  await expect(panel.getByText(`Run context: ${R7_GOLDEN_M1_READY_RUN_ID}`)).toBeVisible();
  return panel;
}

function readinessStateDigest(): string {
  const snapshot = JSON.parse(readFileSync(PLAYWRIGHT_STORE_FILE, "utf8")) as Record<
    string,
    unknown
  >;
  const formalState = {
    parameterSets: snapshot.parameterSets,
    runs: snapshot.runs,
    scenarios: snapshot.scenarios,
    settlementResults: snapshot.settlementResults
  };

  return createHash("sha256").update(JSON.stringify(formalState)).digest("hex");
}

async function verifyReadOnlyReadiness(
  page: Page,
  parameterSetId: string,
  expectedStatus: "READY" | "BLOCKED",
  expectedReason?: string
) {
  const consoleMessages: string[] = [];
  const subsequentRequests: Array<{ method: string; url: string }> = [];
  page.on("console", (message) => consoleMessages.push(message.text()));
  page.on("request", (request) => {
    subsequentRequests.push({ method: request.method(), url: request.url() });
  });

  const panel = await openScenarioReadinessPanel(page);
  await panel.getByLabel("scenario package id").fill(R7_GOLDEN_M1_READY_SCENARIO_ID);
  await panel.getByLabel("parameter set id").fill(parameterSetId);
  const digestBeforeReadiness = readinessStateDigest();

  const readinessRequest = page.waitForRequest((request) =>
    request.url().includes("/scenario-selection-readiness")
  );
  await panel.getByRole("button", { name: "Check readiness" }).click();
  const request = await readinessRequest;

  expect(request.method()).toBe("GET");
  expect(request.headers()["x-tenant-id"]).toBeUndefined();
  expect(request.url()).toContain(`scenarioPackageId=${R7_GOLDEN_M1_READY_SCENARIO_ID}`);
  expect(request.url()).toContain(`parameterSetId=${parameterSetId}`);
  await expect(panel.locator(".readiness-result > strong")).toHaveText(expectedStatus);
  if (expectedReason) {
    await expect(panel.getByText(expectedReason)).toBeVisible();
  }

  const panelText = await panel.innerText();
  for (const marker of privateMarkers) {
    expect(panelText).not.toContain(marker);
    expect(consoleMessages.join("\n")).not.toContain(marker);
  }
  expect(
    panel.getByRole("button", { name: /Activate|Launch|Replay|Publish|Settlement/i })
  ).toHaveCount(0);
  expect(
    subsequentRequests.filter((requestRecord) =>
      /\/internal\/|\/settle|\/replay|\/activate|\/publish/.test(requestRecord.url)
    )
  ).toEqual([]);
  expect(readinessStateDigest()).toBe(digestBeforeReadiness);

  await test.info().attach(`scenario-readiness-${expectedStatus.toLowerCase()}-evidence.json`, {
    body: JSON.stringify({
      expectedStatus,
      parameterSetId,
      requestMethod: request.method(),
      requestHasTenantHeader: request.headers()["x-tenant-id"] !== undefined,
      formalStateDigestUnchanged: readinessStateDigest() === digestBeforeReadiness
    }),
    contentType: "application/json"
  });
}

test("Teacher Golden M1 readiness is READY through the real read-only BFF without formal writes", async ({
  page
}) => {
  await verifyReadOnlyReadiness(page, R7_GOLDEN_M1_READY_PARAMETER_SET_ID, "READY");
});

test("Teacher Golden M1 candidate ParameterSet is BLOCKED through the real read-only BFF", async ({
  page
}) => {
  const panel = await openScenarioReadinessPanel(page);
  await panel.getByLabel("scenario package id").fill(R7_GOLDEN_M1_READY_SCENARIO_ID);
  await panel.getByLabel("parameter set id").fill(R7_GOLDEN_M1_READY_PARAMETER_SET_ID);
  const tokenRequest = page.waitForRequest((request) =>
    request.url().includes("/scenario-selection-readiness")
  );
  await panel.getByRole("button", { name: "Check readiness" }).click();
  const teacherRequest = await tokenRequest;
  const authorization = teacherRequest.headers().authorization;
  expect(authorization).toBeTruthy();

  const digestBeforeReadiness = readinessStateDigest();
  const blockedResponse = await page.evaluate(
    async ({ apiUrl, authorizationHeader, parameterSetId, runId, scenarioPackageId }) => {
      const query = new URLSearchParams({ parameterSetId, scenarioPackageId });
      const response = await fetch(
        `${apiUrl}/api/v1/bff/teacher/runs/${encodeURIComponent(runId)}/scenario-selection-readiness?${query.toString()}`,
        { headers: { authorization: authorizationHeader }, method: "GET" }
      );
      return { body: await response.json(), status: response.status };
    },
    {
      apiUrl: apiBaseUrl,
      authorizationHeader: authorization ?? "",
      parameterSetId: R7_GOLDEN_M1_BLOCKED_PARAMETER_SET_ID,
      runId: R7_GOLDEN_M1_BLOCKED_RUN_ID,
      scenarioPackageId: R7_GOLDEN_M1_READY_SCENARIO_ID
    }
  );

  expect(blockedResponse.status).toBe(200);
  expect(blockedResponse.body).toMatchObject({
    no_go_reasons: ["R7_BFF_PARAMETER_SET_NOT_APPROVED"],
    readiness_status: "BLOCKED",
    run_id: R7_GOLDEN_M1_BLOCKED_RUN_ID
  });
  expect(readinessStateDigest()).toBe(digestBeforeReadiness);
});

test("Student has no Golden M1 readiness surface and never calls the Teacher endpoint", async ({
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
    R7_GOLDEN_M1_READY_SCENARIO_ID,
    R7_GOLDEN_M1_BLOCKED_PARAMETER_SET_ID,
    "R7_BFF_PARAMETER_SET_NOT_APPROVED",
    "PREPARATION_PACKAGE_ONLY",
    "INTERNAL_SYNTHETIC_ONLY"
  ]) {
    expect(studentText).not.toContain(marker);
  }
  expect(readinessRequests).toEqual([]);
});
