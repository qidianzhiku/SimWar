import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import type {
  StudentLearningReportPublicListDto,
  W3OfficialConsequenceResponse
} from "@simwar/shared-contracts";
import {
  createExactRoundLearningFixture,
  type ExactRoundLearningFixture
} from "./student-exact-round-learning-fixture";

let fixture: ExactRoundLearningFixture | undefined;

test.beforeAll(async ({ request }) => {
  // Independent of the exact-round spec's store, receipt and execution order.
  const receiptPath = resolve(
    test.info().project.outputDir,
    "role-safe-report-fixture",
    "fixture-receipt.local.json"
  );
  const sourceHash = createHash("sha256")
    .update(readFileSync(new URL(import.meta.url)))
    .update(readFileSync(new URL("./student-exact-round-learning-fixture.ts", import.meta.url)))
    .digest("hex");
  fixture = await createExactRoundLearningFixture(request, { receiptPath, sourceHash });
});

test.afterAll(async () => {
  await fixture?.dispose();
});

test("Student Learning Report renders a role-safe public projection", async ({ page, request }) => {
  if (!fixture) throw new Error("REAL_REPORT_FIXTURE_NOT_READY");
  const { api, student, scope, ceoUsername, fixturePassword } = fixture;
  const session = await fixture.loginApi(request, scope.tenant_id, ceoUsername, fixturePassword);
  const query = new URLSearchParams({ ...scope });
  query.delete("tenant_id");
  const consequence = await fixture.requestData<W3OfficialConsequenceResponse>(
    request,
    `/api/v1/bff/student/w3/consequence?${query}`,
    session.access_token
  );
  expect(consequence.visibility).toBe("student_safe");
  expect(consequence.record.context).toEqual({ ...scope, round_no: 1 });
  expect(consequence.record.learning.teacher_confirmation_status).toBe("CONFIRMED");
  const reference = consequence.record.learning.student_learning_report_ref;
  expect(reference?.resource_type).toBe("student_learning_report");
  expect(reference?.tenant_id).toBe(scope.tenant_id);
  if (!reference?.resource_id) throw new Error("REAL_EXACT_REPORT_REFERENCE_REQUIRED");
  const reportPath = `/api/v1/bff/student/learning-reports/${encodeURIComponent(reference.resource_id)}`;
  const actual = await fixture.requestData<StudentLearningReportPublicListDto>(
    request,
    reportPath,
    session.access_token
  );
  expect(actual.scope).toBe("student_team");
  expect(actual.report_schema_version).toBe("student-learning-report.public.v1");
  expect(actual.known_limits).toEqual([
    "Only published evidence for your active role and team is shown."
  ]);
  expect(actual.reports).toHaveLength(1);
  const report = actual.reports[0]!;
  expect(report.report_id).toBe(reference.resource_id);
  expect(report.context).toEqual({
    course_id: scope.course_id,
    run_id: scope.run_id,
    team_id: scope.team_id,
    round_id: scope.round_id,
    round_no: 1,
    role_key: scope.role_key
  });
  expect(report.learning_evidence.criterion_results).toHaveLength(1);
  expect(report.learning_evidence.criterion_results[0]!.criterion_id).toMatch(
    /^mlearn_d4_criterion_/
  );
  expect(report.learning_evidence.criterion_results[0]!.level_ordinal).toBe(2);
  expect(report.learning_evidence).not.toHaveProperty("provenance_chain");
  expect(report).not.toHaveProperty("teacher_feedback");
  expect(report).not.toHaveProperty("raw_evidence_payload");
  const observedReport = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === "GET" &&
      url.origin === new URL(api).origin &&
      url.pathname === reportPath
    );
  });
  const observedLogin = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url() === `${api}/api/v1/auth/login`
  );
  await page.goto(`${student}?${fixture.exactEntry()}`);
  const login = page.getByLabel("student login");
  await login.getByLabel("tenant").fill(scope.tenant_id);
  await login.getByLabel("username").fill(ceoUsername);
  await login.getByLabel("password").fill(fixturePassword);
  await login.getByRole("button", { name: "学员登录" }).click();
  expect((await observedLogin).status()).toBe(200);
  const reportResponse = await observedReport;
  expect(reportResponse.status()).toBe(200);
  const envelope: { code: string; data: StudentLearningReportPublicListDto } =
    await reportResponse.json();
  expect(envelope.code).toBe("OK");
  expect(envelope.data.reports).toHaveLength(1);
  expect(envelope.data.reports[0]!.report_id).toBe(report.report_id);
  const panel = page.getByLabel("student learning report");
  await expect(panel).toBeVisible();
  const card = panel.locator(".d4-report-card");
  await expect(card).toHaveCount(1);
  await expect(
    card.getByRole("heading", { name: `${scope.course_id} · CEO`, exact: true })
  ).toBeVisible();
  await expect(card.locator(".d4-report-identity strong")).toHaveText(`${scope.round_id} · 1`);
  await expect(card.getByText("1 项学习证据")).toBeVisible();
  await expect(
    card.getByText(report.learning_evidence.criterion_results[0]!.criterion_id, { exact: true })
  ).toBeVisible();
  await expect(panel.getByText(`${report.report_id} · v1.0.0`)).toHaveCount(0);
  await expect(panel.getByText(report.report_id, { exact: true })).toHaveCount(0);
  await expect(panel.getByText("1 条来源链")).toHaveCount(0);
  await expect(panel.getByText("teacher_feedback")).toHaveCount(0);
  await expect(panel.getByText("raw_evidence_payload")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});
