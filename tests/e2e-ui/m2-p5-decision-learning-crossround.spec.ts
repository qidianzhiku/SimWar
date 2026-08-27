import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { ApiEnvelope, AuthSession } from "../../packages/shared-contracts/src";
import {
  M2P5_CONFIRMATION_ID,
  M2P5_COURSE_ID,
  M2P5_ROUND_1_ID,
  M2P5_ROUND_2_CONFIRMATION_ID,
  M2P5_ROUND_2_ID,
  M2P5_RUN_ID,
  M2P5_TEAM_ID,
  M2P5_TENANT_ID
} from "./m2-p5-decision-learning-crossround-fixture";
import { cleanupPlaywrightStore } from "./store-isolation";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const query = new URLSearchParams({
  w3: "true",
  activity_id: "activity_consequence",
  course_id: M2P5_COURSE_ID,
  role_key: "CEO",
  round_id: M2P5_ROUND_1_ID,
  round_no: "1",
  run_id: M2P5_RUN_ID,
  team_id: M2P5_TEAM_ID,
  tenant_id: M2P5_TENANT_ID
}).toString();
const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;

test.afterAll(() => cleanupPlaywrightStore());

async function apiRequest<T>(
  request: APIRequestContext,
  method: "GET" | "POST",
  path: string,
  token?: string,
  body?: unknown,
  tenantId = M2P5_TENANT_ID
): Promise<{ status: number; data?: T; raw: unknown }> {
  const response = await request.fetch(`${apiBaseUrl}${path}`, {
    data: body,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": tenantId,
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    method
  });
  const raw = (await response.json()) as ApiEnvelope<T>;
  return { data: raw.data, raw, status: response.status() };
}

async function login(request: APIRequestContext, username: "teacher" | "student"): Promise<string> {
  const response = await apiRequest<AuthSession>(request, "POST", "/api/v1/auth/login", undefined, {
    password: username,
    username
  });
  expect(response.status).toBe(200);
  return response.data!.access_token;
}

async function signIn(page: Page, app: "student" | "teacher"): Promise<void> {
  await page.getByLabel("tenant").fill(M2P5_TENANT_ID);
  await page.getByLabel("username").fill(app);
  await page.getByLabel("password").fill(app);
  await page.getByRole("button", { name: app === "student" ? "学员登录" : "教师登录" }).click();
  await expect(page.getByText("signed in").first()).toBeVisible();
}

test("@m2-p5-real renders the real two-round learning handoff without mocks or retries", async ({
  page,
  request
}) => {
  test.skip(
    process.env.SIMWAR_PLAYWRIGHT_M2P5 !== "true",
    "M2-P5 dedicated real-BFF fixture is enabled only for the explicit real run"
  );
  expect(process.env.SIMWAR_PLAYWRIGHT_M2P5).toBe("true");

  const studentToken = await login(request, "student");
  const teacherToken = await login(request, "teacher");
  const context = {
    activity_id: "activity_consequence",
    course_id: M2P5_COURSE_ID,
    role_key: "CEO",
    round_id: M2P5_ROUND_1_ID,
    round_no: 1,
    run_id: M2P5_RUN_ID,
    team_id: M2P5_TEAM_ID
  };

  await page.goto(`${studentBaseUrl}?${query}`);
  const initialM2P5 = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/bff/student/m2p5/") && response.request().method() === "GET"
  );
  await signIn(page, "student");
  const initialResponse = await initialM2P5;
  expect(initialResponse.status()).toBe(200);
  const initialCard = page.getByTestId("student-m2p5-cross-round");
  await expect(initialCard).toContainText("学习门禁：BLOCKED");
  const initialLoop = page.getByTestId("student-m2p6-learning-loop");
  await expect(initialLoop).toHaveAttribute("data-status", "BLOCKED");
  await expect(initialLoop).toContainText("REFLECTION_REQUIRED");
  await expect(initialLoop).toContainText("WHAT_IF_REQUIRED");

  const reflection = await apiRequest(
    request,
    "POST",
    "/api/v1/bff/student/w3/reflection",
    studentToken,
    {
      context,
      idempotency_key: "m2p5-browser-reflection",
      prompt_id: "w3-reflection-off-v1",
      response: "The published result is an exact bounded consequence of the admitted decision."
    }
  );
  expect(reflection.status).toBe(201);
  expect(JSON.stringify(reflection.raw)).toContain('"ai_used":false');

  const counterfactual = await apiRequest(
    request,
    "POST",
    "/api/v1/bff/teacher/w3/counterfactual",
    teacherToken,
    {
      changed_field: "marketing_budget",
      changed_value: 120000,
      context,
      idempotency_key: "m2p6-browser-counterfactual"
    }
  );
  expect(counterfactual.status).toBe(200);
  expect(JSON.stringify(counterfactual.raw)).toContain('"official":false');

  const selection = await apiRequest(
    request,
    "POST",
    "/api/v1/bff/teacher/w3/evidence-selection",
    teacherToken,
    {
      context,
      evidence_refs: [
        {
          content_digest: "d".repeat(64),
          discriminator: "exact_ref",
          resource_id: "m2p5-evidence-consequence",
          resource_type: "evidence_artifact",
          tenant_id: M2P5_TENANT_ID,
          version: "1.0.0"
        }
      ],
      idempotency_key: "m2p5-browser-selection"
    }
  );
  expect(selection.status).toBe(201);

  const hypothesis = await apiRequest(
    request,
    "POST",
    "/api/v1/bff/teacher/w3/next-round-hypothesis",
    teacherToken,
    { context }
  );
  expect(hypothesis.status).toBe(200);

  const exactStudentUrl = page.url();
  await page.reload();
  await expect(page.getByText("not signed in").first()).toBeVisible();
  expect(new URL(page.url()).search).toBe(new URL(exactStudentUrl).search);
  const recoveredM2P5 = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/bff/student/m2p5/") && response.request().method() === "GET"
  );
  await signIn(page, "student");
  expect((await recoveredM2P5).status()).toBe(200);
  const refreshedCard = page.getByTestId("student-m2p5-cross-round");
  await expect(refreshedCard).toContainText("下一回合已开放");
  await expect(refreshedCard).toContainText("M2-P5 Decision Learning Project");
  await expect(refreshedCard).toContainText("学习门禁：READY");
  const refreshedLoop = page.getByTestId("student-m2p6-learning-loop");
  await expect(refreshedLoop).toHaveAttribute("data-status", "READY");
  await expect(refreshedLoop).toContainText("CONFIRMED / SUBMITTED");
  await expect(refreshedLoop).toContainText("AVAILABLE / READY");
  await expect(refreshedLoop).toContainText("ENTRY_READY");
  await expect(page.getByTestId("student-m2p6-recovery")).toContainText("EXACT_CONTEXT_RESTORED");
  await expect(refreshedLoop).not.toContainText(M2P5_ROUND_2_CONFIRMATION_ID);
  await expect(page.locator("body")).not.toContainText(
    "Newer Round 2 confirmation must never satisfy the Round 1 learning loop."
  );
  await expect(page.locator("body")).not.toContainText("teacher_confirmation_ref");
  await expect(page.locator("body")).not.toContainText("state_true");

  const teacherPage = await page.context().newPage();
  try {
    await teacherPage.goto(`${teacherBaseUrl}?${query}`);
    const teacherM2P5 = teacherPage.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/bff/teacher/m2p5/") &&
        response.request().method() === "GET"
    );
    await signIn(teacherPage, "teacher");
    expect((await teacherM2P5).status()).toBe(200);
    const teacherCard = teacherPage.getByTestId("teacher-m2p5-cross-round");
    await expect(teacherCard).toContainText("下一回合已开放");
    await expect(teacherCard).toContainText("M2-P5 Decision Learning Project");
    await expect(teacherCard).toContainText("学习门禁：READY");
    const teacherLoop = teacherPage.getByTestId("teacher-m2p6-learning-loop");
    await expect(teacherLoop).toHaveAttribute("data-status", "READY");
    await expect(teacherLoop).toContainText(
      `${M2P5_COURSE_ID} / ${M2P5_RUN_ID} / ${M2P5_TEAM_ID} / R1`
    );
    await expect(teacherLoop).toContainText("AVAILABLE / READY");
    await expect(teacherLoop).toContainText("ENTRY_READY");
    await expect(teacherPage.getByTestId("teacher-m2p6-recovery")).toContainText(
      "EXACT_CONTEXT_RESTORED"
    );
    await expect(teacherLoop).not.toContainText(M2P5_ROUND_2_CONFIRMATION_ID);
    await expect(teacherPage.locator("body")).not.toContainText(
      "Newer Round 2 confirmation must never satisfy the Round 1 learning loop."
    );

    const exactTeacher = await apiRequest<{
      learning_loop: { teacher_confirmation_ref?: { resource_id: string } };
    }>(
      request,
      "GET",
      `/api/v1/bff/teacher/m2p5/runs/${M2P5_RUN_ID}/rounds/1/decision-learning?${query}`,
      teacherToken
    );
    expect(exactTeacher.status).toBe(200);
    expect(exactTeacher.data?.learning_loop.teacher_confirmation_ref?.resource_id).toBe(
      M2P5_CONFIRMATION_ID
    );
  } finally {
    await teacherPage.close();
  }

  const wrongRound = await apiRequest(
    request,
    "GET",
    `/api/v1/bff/student/m2p5/runs/${M2P5_RUN_ID}/rounds/2/decision-learning?${query}`,
    studentToken
  );
  expect(wrongRound.status).toBe(422);
  expect(JSON.stringify(wrongRound.raw)).toContain("M2P5_CONTEXT_INVALID");

  const crossTenant = await apiRequest(
    request,
    "GET",
    `/api/v1/bff/student/m2p5/runs/${M2P5_RUN_ID}/rounds/1/decision-learning?${query}`,
    studentToken,
    undefined,
    "tenant_other"
  );
  expect(crossTenant.status).toBe(403);
  expect((crossTenant.raw as { data?: unknown }).data).toBeUndefined();

  const roundTwoQuery = new URLSearchParams({
    activity_id: "activity_consequence",
    course_id: M2P5_COURSE_ID,
    role_key: "CEO",
    round_id: M2P5_ROUND_2_ID,
    round_no: "2",
    run_id: M2P5_RUN_ID,
    team_id: M2P5_TEAM_ID,
    tenant_id: M2P5_TENANT_ID
  }).toString();
  const prepublish = await apiRequest(
    request,
    "GET",
    `/api/v1/bff/student/m2p5/runs/${M2P5_RUN_ID}/rounds/2/decision-learning?${roundTwoQuery}`,
    studentToken
  );
  expect(prepublish.status).toBe(409);
  expect(JSON.stringify(prepublish.raw)).toContain("M2P5_OFFICIAL_RESULT_NOT_PUBLISHED");
});
