import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { ApiEnvelope, AuthSession, Run } from "../../packages/shared-contracts/src";
import { cleanupPlaywrightStore } from "./store-isolation";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const tenantId = "tenant_demo";

test.afterEach(() => cleanupPlaywrightStore());

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

async function signIn(page: Page, surface: "teacher" | "student" | "admin", username = surface) {
  const loginPanel = page.locator(`section[aria-label="${surface} login"]`);
  await loginPanel.getByLabel("tenant").fill(tenantId);
  await loginPanel.getByLabel("username").fill(username);
  await loginPanel.getByLabel("password").fill(username);
  await loginPanel
    .getByRole("button", {
      name: surface === "teacher" ? "教师登录" : surface === "student" ? "学员登录" : "管理员登录"
    })
    .click();
}

test("R2 source-backed qualification is operated through real Teacher, Student, and Admin BFF surfaces", async ({
  page,
  request
}) => {
  const teacher = await login(request, "teacher");
  const run = await apiPost<{ run: Run }>(
    request,
    "/api/v1/courses/course_demo/runs",
    teacher.access_token
  );
  expect(run.response.ok()).toBe(true);
  const started = await apiPost(
    request,
    `/api/v1/runs/${run.body.data.run.run_id}/rounds/1/start`,
    teacher.access_token
  );
  expect(started.response.ok()).toBe(true);

  await page.goto(`${teacherBaseUrl}?courseId=course_demo`);
  await signIn(page, "teacher");
  const workbench = page.getByRole("region", {
    name: "source-backed model qualification workbench"
  });
  await expect(workbench).toBeVisible();
  const evidenceReview = workbench.getByRole("region", {
    name: "teacher exact model qualification evidence review"
  });
  const projectionResponse = await request.get(
    `${apiBaseUrl}/api/v1/bff/teacher/model-qualification?courseId=course_demo`,
    { headers: { authorization: `Bearer ${teacher.access_token}`, "x-tenant-id": tenantId } }
  );
  const projection = (await projectionResponse.json()) as ApiEnvelope<{
    calibration_datasets: unknown[];
    qualifications: unknown[];
    source_packages: unknown[];
  }>;
  expect(projectionResponse.ok()).toBe(true);
  if (projection.data.source_packages.length === 0) {
    await workbench.getByRole("button", { name: "登记来源与证据" }).click();
    await expect(workbench.getByRole("button", { name: /来源已登记/ })).toBeVisible();
  }
  await evidenceReview.getByLabel("ModelVersion").selectOption({ index: 1 });
  await evidenceReview.getByLabel("SourcePackage").selectOption({ index: 1 });
  if (projection.data.calibration_datasets.length === 0) {
    await workbench.getByRole("button", { name: "创建 Calibration / Holdout" }).click();
    await expect(workbench.getByRole("button", { name: /数据集已登记/ })).toBeVisible();
  }
  await evidenceReview.getByLabel("Calibration/Holdout Dataset").selectOption({ index: 1 });
  if (projection.data.qualifications.length === 0) {
    await workbench.getByRole("button", { name: "运行确定性资格检查" }).click();
    await expect(workbench.getByRole("button", { name: /资格已登记/ })).toBeVisible();
  }
  await evidenceReview.getByLabel("Qualification").selectOption({ index: 1 });
  const reviewButton = workbench.getByRole("button", { name: /批准资格候选|已复核/ });
  await expect(reviewButton).toBeVisible();
  if ((await reviewButton.textContent())?.includes("批准资格候选")) {
    await reviewButton.click();
    await expect(workbench.getByRole("button", { name: "已复核" })).toBeVisible();
  }
  const bindButton = workbench.getByRole("button", { name: /绑定到课程治理|已绑定课程/ });
  await expect(bindButton).toBeVisible();
  if ((await bindButton.textContent())?.includes("绑定到课程治理")) {
    await bindButton.click();
    await expect(workbench.getByRole("button", { name: "已绑定课程" })).toBeVisible();
  }

  const teacherProjection = await request.get(
    `${apiBaseUrl}/api/v1/bff/teacher/model-qualification?courseId=course_demo`,
    { headers: { authorization: `Bearer ${teacher.access_token}`, "x-tenant-id": tenantId } }
  );
  const teacherBody = (await teacherProjection.json()) as ApiEnvelope<{
    qualifications: Array<{ qualification_id: string; binding: { status: string } }>;
  }>;
  expect(teacherProjection.ok()).toBe(true);
  const qualificationId = teacherBody.data.qualifications.at(-1)?.qualification_id;
  expect(qualificationId).toBeTruthy();
  expect(teacherBody.data.qualifications.at(-1)?.binding.status).toBe("BOUND");

  await page.goto(
    `${studentBaseUrl}?modelQualificationId=${encodeURIComponent(qualificationId ?? "")}`
  );
  await signIn(page, "student");
  const studentSurface = page.getByRole("region", {
    name: "student role-safe model qualification explanation"
  });
  await expect(studentSurface).toBeVisible();
  await expect(studentSurface.getByText("ROLE_SAFE_STUDENT", { exact: false })).toBeVisible();
  await expect(studentSurface.getByText("source_ref", { exact: false })).toHaveCount(0);

  await page.goto(`${adminBaseUrl}?courseId=course_demo`);
  await signIn(page, "admin");
  const adminSurface = page.getByRole("region", {
    name: "source-backed model qualification audit"
  });
  await expect(adminSurface).toBeVisible();
  await expect(adminSurface.getByText("MAIN_MODEL_GOVERNANCE", { exact: false })).toBeVisible();
  await expect(adminSurface.getByText("正式真值写入", { exact: false })).toBeVisible();

  await page.goto(`${teacherBaseUrl}?courseId=course_demo`);
  await signIn(page, "teacher");
  const requalificationWorkbench = page.getByRole("region", {
    name: "source-backed model qualification workbench"
  });
  const requalificationEvidenceReview = requalificationWorkbench.getByRole("region", {
    name: "teacher exact model qualification evidence review"
  });
  await requalificationWorkbench.getByRole("button", { name: "登记候选替代来源" }).click();
  const requalification = requalificationWorkbench.getByRole("region", {
    name: "model qualification requalification preview"
  });
  await requalification.getByLabel("历史基线 SourcePackage").selectOption({ index: 1 });
  await requalification.getByLabel("候选替代 SourcePackage").selectOption({ index: 2 });
  await requalification.getByRole("button", { name: "生成差异与影响预览" }).click();
  await expect(requalification.getByTestId("requalification-preview")).toBeVisible();

  await requalificationEvidenceReview.getByLabel("ModelVersion").selectOption({ index: 1 });
  await requalificationEvidenceReview.getByLabel("SourcePackage").selectOption({ index: 2 });
  await requalificationWorkbench
    .getByRole("button", { name: "创建 Calibration / Holdout" })
    .click();
  await expect(
    requalificationWorkbench.getByRole("button", { name: /数据集已登记/ })
  ).toBeVisible();
  await requalificationEvidenceReview
    .getByLabel("Calibration/Holdout Dataset")
    .selectOption({ index: 2 });
  await requalificationWorkbench.getByRole("button", { name: "运行确定性资格检查" }).click();
  await expect(
    requalificationWorkbench.getByRole("button", { name: /当前 exact 资格已登记/ })
  ).toBeVisible();
  await requalificationEvidenceReview.getByLabel("Qualification").selectOption({ index: 2 });
  await requalificationWorkbench.getByRole("button", { name: "批准资格候选" }).click();
  await expect(requalificationWorkbench.getByRole("button", { name: "已复核" })).toBeVisible();
  await requalification.getByRole("button", { name: "批准替代证据预览" }).click();
  await expect(requalification.getByText(/review=APPROVED/)).toBeVisible();
  await requalificationWorkbench.getByRole("button", { name: "绑定到课程治理" }).click();
  await expect(requalificationWorkbench.getByRole("button", { name: "已绑定课程" })).toBeVisible();

  const finalTeacherProjection = await request.get(
    `${apiBaseUrl}/api/v1/bff/teacher/model-qualification?courseId=course_demo`,
    { headers: { authorization: `Bearer ${teacher.access_token}`, "x-tenant-id": tenantId } }
  );
  const finalTeacherBody = (await finalTeacherProjection.json()) as ApiEnvelope<{
    qualifications: Array<{ binding: { status: string }; qualification_id: string }>;
  }>;
  const replacementQualificationId = finalTeacherBody.data.qualifications.at(-1)?.qualification_id;
  expect(finalTeacherBody.data.qualifications.at(-1)?.binding.status).toBe("BOUND");
  expect(replacementQualificationId).toBeTruthy();

  await page.goto(
    `${studentBaseUrl}?modelQualificationId=${encodeURIComponent(replacementQualificationId ?? "")}`
  );
  await signIn(page, "student");
  const replacementStudentSurface = page.getByRole("region", {
    name: "student role-safe model qualification explanation"
  });
  await expect(replacementStudentSurface).toBeVisible();
  await expect(
    replacementStudentSurface.getByTestId("student-requalification-status")
  ).toContainText("ACCEPTED");
});
