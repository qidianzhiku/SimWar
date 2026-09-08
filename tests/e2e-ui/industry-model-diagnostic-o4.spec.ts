import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { ApiEnvelope, AuthSession, P0DemoState, Run, W5ExactRuntimeBinding } from "../../packages/shared-contracts/src";
import { cleanupPlaywrightStore } from "./store-isolation";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const tenantId = "tenant_demo";

test.afterAll(() => cleanupPlaywrightStore());

async function apiPost<TData>(
  request: APIRequestContext,
  path: string,
  token: string | undefined,
  body: unknown = {}
) {
  const response = await request.post(`${apiBaseUrl}${path}`, {
    data: body,
    headers: {
      authorization: token ? `Bearer ${token}` : "",
      "content-type": "application/json",
      "x-tenant-id": tenantId
    }
  });
  return { response, body: (await response.json()) as ApiEnvelope<TData> };
}

async function login(request: APIRequestContext, username: "teacher" | "student" | "admin") {
  const result = await apiPost<AuthSession>(request, "/api/v1/auth/login", undefined, {
    password: username,
    username
  });
  expect(result.response.ok()).toBe(true);
  return result.body.data;
}

async function signIn(page: Page, surface: "teacher" | "student" | "admin"): Promise<void> {
  const loginPanel = page.locator(`section[aria-label="${surface} login"]`);
  await loginPanel.getByLabel("tenant").fill(tenantId);
  await loginPanel.getByLabel("username").fill(surface);
  await loginPanel.getByLabel("password").fill(surface);
  await loginPanel
    .getByRole("button", {
      name: surface === "teacher" ? "教师登录" : surface === "student" ? "学员登录" : "管理员登录"
    })
    .click();
}

async function createQualifiedEvidence(request: APIRequestContext, teacherToken: string) {
  const source = await apiPost<{ source_package: { source_package_id: string } }>(
    request,
    "/api/v1/bff/teacher/model-qualification/source-packages",
    teacherToken,
    {
      content_digest: "a".repeat(64),
      course_id: "course_demo",
      evidence_refs: ["fixture:generic-source:o4"],
      feature_schema_digest: "b".repeat(64),
      freshness_status: "FRESH",
      observed_at: "2026-09-07T00:00:00.000Z",
      quality: { conflict_count: 0, missingness_rate: 0.02, record_count: 4 },
      rights_status: "VALID",
      source_ref: "fixture://generic-source/o4",
      source_version: "1.0.0",
      title: "IM-O4 exact producer browser fixture"
    }
  );
  expect(source.response.status()).toBe(201);
  const sourceId = source.body.data.source_package.source_package_id;
  const dataset = await apiPost<{
    calibration_dataset: { calibration_dataset_id: string };
  }>(request, "/api/v1/bff/teacher/model-qualification/datasets", teacherToken, {
    calibration_record_ids: ["cal-1", "cal-2"],
    content_digest: "c".repeat(64),
    course_id: "course_demo",
    holdout_record_ids: ["holdout-1", "holdout-2"],
    source_package_id: sourceId
  });
  expect(dataset.response.status()).toBe(201);
  const datasetId = dataset.body.data.calibration_dataset.calibration_dataset_id;
  const qualification = await apiPost<{
    qualification: { qualification_id: string };
  }>(request, "/api/v1/bff/teacher/model-qualification/qualifications", teacherToken, {
    calibration_dataset_id: datasetId,
    course_id: "course_demo",
    deterministic_seed: 42,
    model_version_reference: {
      content_digest: "c".repeat(64),
      model_version_id: "toy_logit_wellness_v2",
      version: "2.0.0"
    },
    source_package_id: sourceId
  });
  expect(qualification.response.status()).toBe(201);
  const qualificationId = qualification.body.data.qualification.qualification_id;
  const review = await apiPost(
    request,
    `/api/v1/bff/teacher/model-qualification/qualifications/${qualificationId}/review?courseId=course_demo`,
    teacherToken,
    { decision: "APPROVED", note: "IM-O4 exact producer browser review" }
  );
  expect(review.response.ok()).toBe(true);
  const bound = await apiPost(
    request,
    `/api/v1/bff/teacher/model-qualification/qualifications/${qualificationId}/bind?courseId=course_demo`,
    teacherToken
  );
  expect(bound.response.ok()).toBe(true);
  return qualificationId;
}

test("IM-O4 producers remain qualification-scoped through real Teacher, Student, and Admin BFF surfaces", async ({
  page,
  request
}) => {
  test.setTimeout(180_000);
  const teacher = await login(request, "teacher");
  const run = await apiPost<{ run: Run }>(
    request,
    "/api/v1/courses/course_demo/runs",
    teacher.access_token
  );
  expect(run.response.ok()).toBe(true);
  const started = await apiPost<{ round_id: string }>(
    request,
    `/api/v1/runs/${run.body.data.run.run_id}/rounds/1/start`,
    teacher.access_token
  );
  expect(started.response.ok()).toBe(true);
  const qualificationId = await createQualifiedEvidence(request, teacher.access_token);

  await page.goto(`${teacherBaseUrl}?courseId=course_demo`);
  await signIn(page, "teacher");
  const w5 = page.getByRole("region", { name: "W5 Governed Model Studio" });
  await expect(w5).toBeVisible();
  await w5.getByRole("button", { name: "创建草稿" }).click();
  await expect(w5.getByText(/Draft: w5_draft_/)).toBeVisible();
  await w5.getByRole("button", { name: "验证草稿" }).click();
  await w5.getByRole("button", { name: "冻结草稿" }).click();
  await w5.getByRole("button", { name: "精确绑定当前 Run" }).click();
  await expect(w5.getByText("已精确绑定")).toBeVisible();
  const w5Projection = await request.get(
    `${apiBaseUrl}/api/v1/bff/teacher/w5/governed-model?courseId=course_demo`,
    { headers: { authorization: `Bearer ${teacher.access_token}`, "x-tenant-id": tenantId } }
  );
  const w5Body = (await w5Projection.json()) as ApiEnvelope<{
    drafts: Array<{ draft_id: string; exact_runtime_binding: W5ExactRuntimeBinding | null }>;
  }>;
  expect(w5Projection.ok()).toBe(true);
  const draft = w5Body.data.drafts.at(-1);
  const draftId = draft?.draft_id;
  const exactBoundRunId = draft?.exact_runtime_binding?.run_id;
  const exactBoundRoundNo = draft?.exact_runtime_binding?.round_no;
  expect(draftId).toBeTruthy();
  expect(exactBoundRunId).toBeTruthy();
  expect(exactBoundRoundNo).toBeTruthy();

  const demoStateResponse = await request.get(`${apiBaseUrl}/api/v1/demo-state`, {
    headers: { authorization: `Bearer ${teacher.access_token}`, "x-tenant-id": tenantId }
  });
  expect(demoStateResponse.ok()).toBe(true);
  const demoState = (await demoStateResponse.json()) as ApiEnvelope<P0DemoState>;
  const exactBoundRun = demoState.data.runs.find((candidate) => candidate.run_id === exactBoundRunId);
  const exactBoundRound = demoState.data.rounds.find(
    (candidate) => candidate.run_id === exactBoundRunId && candidate.round_no === exactBoundRoundNo
  );
  expect(exactBoundRun).toBeTruthy();
  expect(exactBoundRound).toBeTruthy();
  const exactBoundTeam = demoState.data.teams.find(
    (candidate) => candidate.course_id === "course_demo" && candidate.team_id === "team_alpha"
  );
  expect(exactBoundTeam).toBeTruthy();

  const selectExactOption = async (label: string, preferred?: string) => {
    const select = qualificationReview.getByLabel(label);
    await expect(select).toBeEnabled();
    const values = await select.locator("option").evaluateAll((options) =>
      options.map((option) => option.value).filter((value) => value.length > 0)
    );
    const value = preferred && values.includes(preferred) ? preferred : values.at(-1);
    expect(value).toBeTruthy();
    await select.selectOption(value ?? "");
  };

  const qualificationReview = page.getByRole("region", {
    name: "teacher exact model qualification evidence review"
  });
  await selectExactOption("ModelVersion");
  await selectExactOption("SourcePackage");
  await selectExactOption("Calibration/Holdout Dataset");
  const qualificationSelect = qualificationReview.getByLabel("Qualification");
  const qualificationValues = await qualificationSelect.locator("option").evaluateAll((options) =>
    options.map((option) => option.value).filter((value) => value.length > 0)
  );
  await expect(qualificationSelect).toBeEnabled();
  await qualificationSelect.selectOption(
    qualificationValues.find((value) => value.startsWith(`${qualificationId}#`)) ??
      qualificationValues.at(-1) ??
      ""
  );
  const teacherDiagnostic = page.getByRole("region", {
    name: "Industry Model diagnostic readiness"
  });
  await expect(teacherDiagnostic.getByTestId("industry-diagnostic-producers")).toContainText(
    "NOT_PROVEN"
  );
  await expect(teacherDiagnostic.getByTestId("industry-diagnostic-producers")).toContainText(
    "PRODUCER_MODEL_QUALIFICATION_NOT_PROVEN"
  );
  await expect(teacherDiagnostic.getByTestId("industry-diagnostic-qualified-admission")).toContainText(
    "QUALIFICATION_NOT_PROVEN"
  );
  await expect(teacherDiagnostic.getByTestId("industry-diagnostic-producers")).toContainText(
    "NOT_CALIBRATED"
  );
  const teacherResponse = await request.get(
    `${apiBaseUrl}/api/v1/bff/teacher/model-qualification/diagnostic-readiness?courseId=course_demo&runId=${encodeURIComponent(exactBoundRunId ?? "")}&teamId=${encodeURIComponent(exactBoundTeam?.team_id ?? "")}&roundId=${encodeURIComponent(exactBoundRound?.round_id ?? "")}&scenarioPackageId=${encodeURIComponent(exactBoundRun?.scenario_package_id ?? "")}&parameterSetId=${encodeURIComponent(exactBoundRun?.parameter_set_id ?? "")}&qualificationId=${encodeURIComponent(qualificationId)}&w5DraftId=${encodeURIComponent(draftId ?? "")}`,
    { headers: { authorization: `Bearer ${teacher.access_token}`, "x-tenant-id": tenantId } }
  );
  expect(teacherResponse.ok()).toBe(true);
  const teacherJson = JSON.stringify(await teacherResponse.json());
  expect(teacherJson).toContain("NOT_PROVEN");
  expect(teacherJson).toContain("QUALIFICATION_NOT_PROVEN");
  expect(teacherJson).not.toContain("QUALIFICATION_COMPATIBLE");
  expect(teacherJson).toContain("REALIZED_WRITES_FORMAL_RESULT_FALSE");

  const student = await login(request, "student");
  await page.goto(
    `${studentBaseUrl}?courseId=course_demo&runId=${encodeURIComponent(exactBoundRunId ?? "")}&roundId=${encodeURIComponent(exactBoundRound?.round_id ?? "")}&teamId=${encodeURIComponent(exactBoundTeam?.team_id ?? "")}&modelQualificationId=${encodeURIComponent(qualificationId)}&w5DraftId=${encodeURIComponent(draftId ?? "")}`
  );
  await signIn(page, "student");
  const studentDiagnostic = page.getByRole("region", {
    name: "Industry Model diagnostic readiness"
  });
  await expect(studentDiagnostic).toContainText("visibility=ROLE_SAFE_STUDENT");
  await expect(studentDiagnostic.getByText("w5_draft_", { exact: false })).toHaveCount(0);
  const studentResponse = await request.get(
    `${apiBaseUrl}/api/v1/bff/student/model-qualification/diagnostic-readiness?courseId=course_demo&runId=${encodeURIComponent(exactBoundRunId ?? "")}&teamId=${encodeURIComponent(exactBoundTeam?.team_id ?? "")}&roundId=${encodeURIComponent(exactBoundRound?.round_id ?? "")}&scenarioPackageId=${encodeURIComponent(exactBoundRun?.scenario_package_id ?? "")}&parameterSetId=${encodeURIComponent(exactBoundRun?.parameter_set_id ?? "")}&qualificationId=${encodeURIComponent(qualificationId)}&w5DraftId=${encodeURIComponent(draftId ?? "")}`,
    { headers: { authorization: `Bearer ${student.access_token}`, "x-tenant-id": tenantId } }
  );
  expect(studentResponse.ok()).toBe(true);
  const studentJson = JSON.stringify(await studentResponse.json());
  expect(studentJson).not.toContain(draftId ?? "w5_draft_");
  expect(studentJson).not.toContain("source_ref");

  const admin = await login(request, "admin");
  await page.goto(
    `${adminBaseUrl}?courseId=course_demo&runId=${encodeURIComponent(exactBoundRunId ?? "")}&roundId=${encodeURIComponent(exactBoundRound?.round_id ?? "")}&teamId=${encodeURIComponent(exactBoundTeam?.team_id ?? "")}&scenarioPackageId=${encodeURIComponent(exactBoundRun?.scenario_package_id ?? "")}&parameterSetId=${encodeURIComponent(exactBoundRun?.parameter_set_id ?? "")}&qualificationId=${encodeURIComponent(qualificationId)}&shanghaiDraftId=${encodeURIComponent(draftId ?? "")}`
  );
  await signIn(page, "admin");
  const adminDiagnostic = page.getByRole("region", {
    name: "Industry Model diagnostic readiness"
  });
  await expect(adminDiagnostic.getByTestId("industry-diagnostic-producers")).toContainText(
    "NOT_PROVEN"
  );
  await expect(adminDiagnostic.getByTestId("industry-diagnostic-qualified-admission")).toContainText(
    "QUALIFICATION_NOT_PROVEN"
  );
  const adminResponse = await request.get(
    `${apiBaseUrl}/api/v1/bff/admin/model-qualification/diagnostic-readiness?courseId=course_demo&runId=${encodeURIComponent(exactBoundRunId ?? "")}&teamId=${encodeURIComponent(exactBoundTeam?.team_id ?? "")}&roundId=${encodeURIComponent(exactBoundRound?.round_id ?? "")}&scenarioPackageId=${encodeURIComponent(exactBoundRun?.scenario_package_id ?? "")}&parameterSetId=${encodeURIComponent(exactBoundRun?.parameter_set_id ?? "")}&qualificationId=${encodeURIComponent(qualificationId)}&w5DraftId=${encodeURIComponent(draftId ?? "")}`,
    { headers: { authorization: `Bearer ${admin.access_token}`, "x-tenant-id": tenantId } }
  );
  expect(adminResponse.ok()).toBe(true);

  const requiredViewports = [
    { width: 1440, height: 1000 },
    { width: 1280, height: 900 },
    { width: 1024, height: 900 },
    { width: 390, height: 844 }
  ];
  for (const viewport of requiredViewports) {
    await page.setViewportSize(viewport);
    await expect(adminDiagnostic).toBeVisible();
    const layout = await adminDiagnostic.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      viewportWidth: window.innerWidth
    }));
    expect(layout.scrollWidth, JSON.stringify({ viewport, layout })).toBeLessThanOrEqual(
      layout.clientWidth + 1
    );
    const accessibility = await new AxeBuilder({ page })
      .include('[aria-label="Industry Model diagnostic readiness"]')
      .analyze();
    const seriousOrCritical = accessibility.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? "")
    );
    expect(seriousOrCritical, JSON.stringify({ viewport, seriousOrCritical })).toEqual([]);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
    true
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  const zoomLayout = await adminDiagnostic.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  }));
  expect(zoomLayout.scrollWidth, JSON.stringify(zoomLayout)).toBeLessThanOrEqual(
    zoomLayout.clientWidth + 1
  );
  await page.evaluate(() => {
    document.documentElement.style.zoom = "1";
  });
  const focusTarget = page.getByRole("button").first();
  await focusTarget.focus();
  expect(await focusTarget.evaluate((element) => document.activeElement === element)).toBe(true);
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement instanceof HTMLElement)).toBe(true);
});
