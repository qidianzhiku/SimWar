import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { ApiEnvelope, AuthSession, Run } from "../../packages/shared-contracts/src";
import { cleanupPlaywrightStore } from "./store-isolation";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
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

async function login(request: APIRequestContext): Promise<AuthSession> {
  const result = await apiPost<AuthSession>(request, "/api/v1/auth/login", undefined, {
    password: "teacher",
    username: "teacher"
  });
  expect(result.response.ok()).toBe(true);
  return result.body.data;
}

async function signInTeacher(page: Page): Promise<void> {
  const loginPanel = page.locator('section[aria-label="teacher login"]');
  await loginPanel.getByLabel("tenant").fill(tenantId);
  await loginPanel.getByLabel("username").fill("teacher");
  await loginPanel.getByLabel("password").fill("teacher");
  await loginPanel.getByRole("button", { name: "教师登录" }).click();
}

test("Teacher selects one exact qualification chain and keeps the governance surface read-only", async ({
  page,
  request
}) => {
  const teacher = await login(request);
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

  const existingProjectionResponse = await request.get(
    `${apiBaseUrl}/api/v1/bff/teacher/model-qualification?courseId=course_demo`,
    { headers: { authorization: `Bearer ${teacher.access_token}`, "x-tenant-id": tenantId } }
  );
  const existingProjection = (await existingProjectionResponse.json()) as ApiEnvelope<{
    calibration_datasets: unknown[];
    qualifications: unknown[];
    source_packages: unknown[];
  }>;
  expect(existingProjectionResponse.ok()).toBe(true);

  await page.goto(`${teacherBaseUrl}?courseId=course_demo`);
  await signInTeacher(page);
  const workbench = page.getByRole("region", {
    name: "source-backed model qualification workbench"
  });
  const review = workbench.getByRole("region", {
    name: "teacher exact model qualification evidence review"
  });
  await expect(review).toBeVisible();
  await expect(review).toHaveAttribute("data-evidence-state", "NO_SELECTION");

  if (existingProjection.data.source_packages.length === 0) {
    await workbench.getByRole("button", { name: "登记来源与证据" }).click();
    await expect(workbench.getByRole("button", { name: /来源已登记/ })).toBeVisible();
  }
  const selectNonEdgeEvidence = async (label: string): Promise<string> => {
    const select = review.getByLabel(label);
    const values = await select
      .locator("option")
      .evaluateAll((options) =>
        options.map((option) => option.value).filter((value) => value.length > 0)
      );
    expect(values.length).toBeGreaterThan(0);
    const target = values.length >= 3 ? values[Math.floor(values.length / 2)] : values[0];
    await select.selectOption(target);
    return target;
  };

  await selectNonEdgeEvidence("ModelVersion");
  await selectNonEdgeEvidence("SourcePackage");

  if (existingProjection.data.calibration_datasets.length === 0) {
    await workbench.getByRole("button", { name: "创建 Calibration / Holdout" }).click();
    await expect(workbench.getByRole("button", { name: /数据集已登记/ })).toBeVisible();
  }
  await selectNonEdgeEvidence("Calibration/Holdout Dataset");

  if (existingProjection.data.qualifications.length === 0) {
    await workbench.getByRole("button", { name: "运行确定性资格检查" }).click();
    await expect(workbench.getByRole("button", { name: /资格已登记/ })).toBeVisible();
  }
  const selectedQualificationKey = await selectNonEdgeEvidence("Qualification");
  const selectedQualificationId = selectedQualificationKey.split("#", 1)[0];
  await expect(review).toHaveAttribute("data-evidence-state", "SELECTED");
  await expect(review.getByTestId("exact-evidence-inspector")).toContainText("qualification_id");
  await expect(review.getByTestId("exact-evidence-inspector")).toContainText("model_version_id");
  await expect(review.getByTestId("exact-evidence-inspector")).toContainText(
    "source_package_digest"
  );
  await expect(review.getByTestId("exact-evidence-inspector")).toContainText("read_only=true");

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

  const projection = await request.get(
    `${apiBaseUrl}/api/v1/bff/teacher/model-qualification?courseId=course_demo`,
    { headers: { authorization: `Bearer ${teacher.access_token}`, "x-tenant-id": tenantId } }
  );
  const body = (await projection.json()) as ApiEnvelope<{
    qualifications: Array<{ binding: { status: string }; qualification_id: string }>;
  }>;
  expect(projection.ok()).toBe(true);
  expect(
    body.data.qualifications.find(
      ({ qualification_id }) => qualification_id === selectedQualificationId
    )?.binding.status
  ).toBe("BOUND");
});
