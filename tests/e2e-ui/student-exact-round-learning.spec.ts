import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type {
  StudentLearningReportPublicListDto,
  W3OfficialConsequenceResponse
} from "@simwar/shared-contracts";
import {
  createExactRoundLearningFixture,
  tenantId,
  fixturePassword,
  type ExactScope,
  type ExactRoundLearningFixture
} from "./student-exact-round-learning-fixture";

let fixture: ExactRoundLearningFixture | undefined;
let api = "";
let student = "";
let scope: ExactScope;
let r2 = "";
let user = "";
let ceoUsername = "";
let loginApi: ExactRoundLearningFixture["loginApi"];
let requestData: ExactRoundLearningFixture["requestData"];
let exactEntry: ExactRoundLearningFixture["exactEntry"];
test.describe.configure({ retries: 0 });

test.beforeAll(async ({ request }) => {
  const receiptPath =
    process.env.SIMWAR_M_LEARN_FIXTURE_RECEIPT ??
    resolve(test.info().project.outputDir, "mlearn-d2-d4-fixture-receipt.local.json");
  const sourceHash = createHash("sha256")
    .update(readFileSync(new URL(import.meta.url)))
    .update(readFileSync(new URL("./student-exact-round-learning-fixture.ts", import.meta.url)))
    .digest("hex");
  fixture = await createExactRoundLearningFixture(request, { receiptPath, sourceHash });
  ({ api, student, scope, r2, user, ceoUsername, loginApi, requestData, exactEntry } = fixture);
});

test.afterAll(async () => {
  await fixture?.dispose();
  // Retain only this task's fixture/receipts for source-bound evidence.
});

async function signIn(page: Page) {
  const authenticated = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/auth/login") && response.request().method() === "POST"
  );
  await page.getByLabel("tenant").fill(scope.tenant_id);
  await page.getByLabel("username").fill(ceoUsername);
  await page.getByLabel("password").fill(fixturePassword);
  await page.getByRole("button", { name: "学员登录" }).click();
  expect((await authenticated).status()).toBe(200);
}

async function preserveR2Recovery(page: Page) {
  // Only non-secret browser navigation state is seeded. Business responses and
  // the DOM are never mocked, substituted or injected.
  await page.addInitScript(
    ({ context, id, uid }) =>
      window.sessionStorage.setItem(
        "simwar.reauth-context.v1",
        JSON.stringify({
          schema_version: 1,
          tenant_id: context.tenant_id,
          course_id: context.course_id,
          run_id: context.run_id,
          team_id: context.team_id,
          round_id: id,
          round_no: 2,
          user_id: uid,
          role: "CEO",
          route: "/student",
          view: "student-cockpit"
        })
      ),
    { context: scope, id: r2, uid: user }
  );
}

test("exact published R1 overrides saved unpublished R2 across cockpit, W3 and DDT", async ({
  page
}) => {
  await preserveR2Recovery(page);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "GET" && request.url().startsWith(api)) requests.push(request.url());
  });
  await page.goto(`${student}?${exactEntry()}`);
  const cockpit = page.waitForResponse((response) =>
    response.url().endsWith(`/runs/${scope.run_id}/rounds/1/cockpit`)
  );
  const spine = page.waitForResponse((response) =>
    response.url().includes("/student/decision-thread/evidence-spine")
  );
  const consequence = page.waitForResponse((response) =>
    response.url().includes("/student/w3/consequence")
  );
  await signIn(page);
  expect((await cockpit).status()).toBe(200);
  expect((await spine).status()).toBe(200);
  const actualConsequence = await consequence;
  expect(actualConsequence.status()).toBe(200);
  const actual = ((await actualConsequence.json()) as { data: W3OfficialConsequenceResponse }).data;
  expect(actual.visibility).toBe("student_safe");
  expect(actual.record.context).toEqual({ ...scope, round_no: 1 });
  expect(actual.record.source.round_ref.resource_id).toBe(scope.round_id);
  await expect(page.getByTestId("student-p2b-result")).toBeVisible();
  await expect(
    page.locator(".w3-consequence-panel").getByText("PUBLISHED", { exact: true })
  ).toBeVisible();
  expect(requests.filter((url) => /\/cockpit$/.test(url))).toEqual([
    `${api}/api/v1/bff/student/runs/${scope.run_id}/rounds/1/cockpit`
  ]);
  for (const url of requests.filter((candidate) =>
    candidate.includes("/student/decision-thread/evidence-spine")
  )) {
    const query = new URL(url).searchParams;
    expect([...query.keys()].sort()).toEqual([
      "activity_id",
      "course_id",
      "role_key",
      "round_id",
      "round_no",
      "run_id",
      "team_id"
    ]);
    expect(query.get("round_id")).toBe(scope.round_id);
    expect(query.get("round_no")).toBe("1");
    expect(query.get("role_key")).toBe("CEO");
  }
  await page
    .getByLabel("我原本的判断")
    .fill("Read the exact published round, not the saved next round.");
  const reflectionText = "Reflection on the authenticated exact published round one.";
  await page.locator(".w3-consequence-panel textarea").fill(reflectionText);
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/student/w3/reflection") && response.request().method() === "POST"
  );
  await page.locator(".w3-consequence-panel").getByRole("button", { name: "提交反思" }).click();
  const receipt = await saved;
  expect(receipt.status()).toBe(201);
  const projection = ((await receipt.json()) as { data: W3OfficialConsequenceResponse }).data;
  expect(projection.record.context).toEqual({ ...scope, round_no: 1 });
  expect(projection.record.reflection).toMatchObject({
    response: reflectionText,
    ai_used: false,
    advisory_only: true,
    status: "SUBMITTED"
  });
  await expect(
    page.locator(".w3-consequence-panel").getByText("反思已记录，等待教师确认学习证据")
  ).toBeVisible();
  const teacher = await loginApi(page.request, tenantId, "teacher");
  const hypothesis = await requestData<W3OfficialConsequenceResponse>(
    page.request,
    "/api/v1/bff/teacher/w3/next-round-hypothesis",
    teacher.access_token,
    "POST",
    { context: { ...scope, round_no: 1 } }
  );
  expect(hypothesis.record.learning.evidence_selection_status).toBe("SELECTED");
  expect(hypothesis.record.learning.next_round_hypothesis_status).toBe("READY");
  expect(hypothesis.record.next_round_hypothesis?.status).toBe("READY");
  const reportRef = projection.record.learning.student_learning_report_ref;
  expect(reportRef?.resource_type).toBe("student_learning_report");
  expect(reportRef?.tenant_id).toBe(scope.tenant_id);
  expect(reportRef?.resource_id).toBeTruthy();
  if (!reportRef) throw new Error("An admitted exact-R1 report reference is required");
  const reportPath = `/api/v1/bff/student/learning-reports/${encodeURIComponent(reportRef.resource_id)}`;
  const reports = page.waitForResponse((response) => {
    const responseUrl = new URL(response.url());
    return (
      response.request().method() === "GET" &&
      responseUrl.origin === new URL(api).origin &&
      responseUrl.pathname === reportPath
    );
  });
  await page.reload();
  await signIn(page);
  await expect(page.getByTestId("student-p2b-result")).toBeVisible();
  const reportResponse = await reports;
  expect(reportResponse.status()).toBe(200);
  const reportData = ((await reportResponse.json()) as { data: StudentLearningReportPublicListDto })
    .data;
  expect(reportData.scope).toBe("student_team");
  const currentReports = reportData.reports.filter(
    (report) =>
      report.context.course_id === scope.course_id &&
      report.context.run_id === scope.run_id &&
      report.context.team_id === scope.team_id &&
      report.context.round_id === scope.round_id &&
      report.context.round_no === 1 &&
      report.context.role_key === scope.role_key
  );
  // Empty is a separate negative state, never a substitute for positive D4 delivery.
  expect(currentReports.length, "A real confirmed exact-R1 D4 report is required").toBeGreaterThan(
    0
  );
  const linkedReport = currentReports.find(
    (report) =>
      report.report_id === projection.record.learning.student_learning_report_ref?.resource_id
  );
  expect(linkedReport).toBeDefined();
  expect(projection.record.learning.teacher_confirmation_status).toBe("CONFIRMED");
  expect(projection.record.learning.student_learning_report_ref?.resource_type).toBe(
    "student_learning_report"
  );
  // The detail API proves report_id; the public card renders scope and evidence,
  // not that internal identifier. Bind both surfaces through the real D3 result.
  expect(currentReports).toHaveLength(1);
  expect(linkedReport!.learning_evidence.criterion_results).toHaveLength(1);
  const criterion = linkedReport!.learning_evidence.criterion_results[0]!;
  expect(criterion.criterion_id).toMatch(/^mlearn_d4_criterion_/);
  expect(criterion.level_ordinal).toBe(2);
  const reportRegion = page.getByRole("region", { name: "student learning report", exact: true });
  await expect(reportRegion).toHaveCount(1);
  await expect(reportRegion).toBeVisible();
  const reportCard = reportRegion.locator(".d4-report-card").filter({
    has: page.getByText(criterion.criterion_id, { exact: true })
  });
  await expect(reportRegion.locator(".d4-report-card")).toHaveCount(1);
  await expect(reportCard).toHaveCount(1);
  await expect(reportCard).toBeVisible();
  await expect(
    reportCard.getByRole("heading", {
      name: `${linkedReport!.context.course_id} · ${linkedReport!.context.role_key}`,
      exact: true
    })
  ).toBeVisible();
  await expect(reportCard.locator(".d4-report-identity strong")).toHaveText(
    `${scope.round_id} · 1`
  );
  const criterionRow = reportCard.locator(".d4-criterion-list li").filter({
    has: page.getByText(criterion.criterion_id, { exact: true })
  });
  await expect(criterionRow).toHaveCount(1);
  await expect(criterionRow.getByText(`能力等级 ${criterion.level_ordinal} Level 2`)).toBeVisible();
  await expect(page.locator(".d4-report-card").filter({ hasText: r2 })).toHaveCount(0);
});

test("invalid exact URL cannot be repaired using saved R2 and valid navigation recovers", async ({
  page
}) => {
  await preserveR2Recovery(page);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "GET") requests.push(request.url());
  });
  const invalid = exactEntry();
  invalid.delete("round_id");
  const bootstrap = page.waitForResponse((response) => {
    const responseUrl = new URL(response.url());
    return (
      response.request().method() === "GET" &&
      responseUrl.origin === new URL(api).origin &&
      responseUrl.pathname === "/api/v1/demo-state"
    );
  });
  await page.goto(`${student}?${invalid}`);
  await signIn(page);
  const bootstrapResponse = await bootstrap;
  expect(bootstrapResponse.status()).toBe(200);
  const bootstrapEnvelope: unknown = await bootstrapResponse.json();
  const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
  if (!isObject(bootstrapEnvelope) || !isObject(bootstrapEnvelope.data)) {
    throw new Error("Authenticated demo-state requires an object envelope and data");
  }
  expect(bootstrapEnvelope.code).toBe("OK");
  expect(bootstrapEnvelope.message).toBe("success");
  expect(bootstrapEnvelope.request_id).toEqual(expect.any(String));
  expect(bootstrapEnvelope.request_id).not.toBe("");
  expect(bootstrapEnvelope).not.toHaveProperty("error");
  expect(bootstrapEnvelope).not.toHaveProperty("errors");
  expect(bootstrapEnvelope.data).not.toHaveProperty("error");
  expect(isObject(bootstrapEnvelope.data.current_user)).toBe(true);
  for (const key of ["courses", "teams", "runs", "rounds"]) {
    expect(Array.isArray(bootstrapEnvelope.data[key])).toBe(true);
  }
  await expect(page.locator(".student-task-summary")).toContainText("signed in");
  const rejected = page.getByRole("region", { name: "发生错误", exact: true });
  await expect(rejected).toBeVisible();
  await expect(rejected).toContainText("学员服务端投影加载失败；不会使用旧上下文或客户端推断。");
  await expect(
    rejected.getByRole("button", { name: "重新加载学员工作区", exact: true })
  ).toBeVisible();
  expect(
    requests.some((url) => url.endsWith("/cockpit") || url.includes("/student/w3/consequence"))
  ).toBe(false);
  expect(requests.some((url) => url.includes("/student/learning-reports"))).toBe(false);
  await expect(page.getByTestId("student-p2b-result")).toHaveCount(0);
  await expect(page.locator(".d4-report-card")).toHaveCount(0);
  const recovered = page.waitForResponse((response) => {
    const responseUrl = new URL(response.url());
    return (
      response.request().method() === "GET" &&
      responseUrl.origin === new URL(api).origin &&
      responseUrl.pathname === `/api/v1/bff/student/runs/${scope.run_id}/rounds/1/cockpit`
    );
  });
  await page.goto(`${student}?${exactEntry()}`);
  await signIn(page);
  expect((await recovered).status()).toBe(200);
  await expect(page.getByTestId("student-p2b-result")).toBeVisible();
});

test("unpublished R2 remains waiting and wrong role remains denied", async ({ page }) => {
  const next = new URLSearchParams({ w3: "true", ...scope, round_id: r2, round_no: "2" });
  await page.goto(`${student}?${next}`);
  await signIn(page);
  await expect(page.getByTestId("student-p2b-blocked")).toBeVisible();
  await expect(page.getByTestId("student-p2b-result")).toHaveCount(0);
  await expect(page.getByTestId("student-learning-report-blocked")).toBeVisible();
  const wrong = new URLSearchParams({ w3: "true", ...scope, role_key: "CFO" });
  await page.goto(`${student}?${wrong}`);
  await signIn(page);
  await expect(page.getByText("CONTEXT_UNAUTHORIZED", { exact: false }).first()).toBeVisible();
  await expect(page.getByTestId("student-p2b-result")).toHaveCount(0);
  await expect(page.locator(".d4-report-card")).toHaveCount(0);
  for (const denied of [{ team_id: "team_beta" }, { tenant_id: "foreign_tenant" }]) {
    const deniedEntry = new URLSearchParams({ w3: "true", ...scope, ...denied });
    await page.goto(`${student}?${deniedEntry}`);
    await signIn(page);
    await expect(page.getByText("CONTEXT_UNAUTHORIZED", { exact: false }).first()).toBeVisible();
    await expect(page.getByTestId("student-p2b-result")).toHaveCount(0);
    await expect(page.locator(".d4-report-card")).toHaveCount(0);
  }
});
