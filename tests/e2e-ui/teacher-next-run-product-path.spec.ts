import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type {
  ApiEnvelope,
  AuthSession,
  Decision,
  P0DemoState,
  Round
} from "../../packages/shared-contracts/src";
import { cleanupPlaywrightStore } from "./store-isolation";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;

test.afterAll(() => {
  cleanupPlaywrightStore();
});

async function apiPost<TData>(
  request: APIRequestContext,
  path: string,
  token: string | undefined,
  body: unknown
): Promise<ApiEnvelope<TData>> {
  const response = await request.post(`${apiBaseUrl}${path}`, {
    data: body,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": "tenant_demo",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    }
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as ApiEnvelope<TData>;
}

async function apiGet<TData>(
  request: APIRequestContext,
  path: string,
  token: string
): Promise<ApiEnvelope<TData>> {
  const response = await request.get(`${apiBaseUrl}${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      "x-tenant-id": "tenant_demo"
    }
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as ApiEnvelope<TData>;
}

async function login(request: APIRequestContext, username: "student" | "teacher"): Promise<string> {
  const envelope = await apiPost<AuthSession>(request, "/api/v1/auth/login", undefined, {
    password: username,
    username
  });
  return envelope.data.access_token;
}

async function signInTeacherPage(page: Page): Promise<void> {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill("teacher");
  await page.getByLabel("password").fill("teacher");
  await page.getByRole("button", { name: "教师登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

type DemoRun = P0DemoState["runs"][number];
type DemoRound = P0DemoState["rounds"][number];

function expectExistingStatePreserved(
  currentState: P0DemoState,
  baseline: Pick<P0DemoState, "rounds" | "runs">
): void {
  for (const baselineRun of baseline.runs) {
    expect(currentState.runs.find((run) => run.run_id === baselineRun.run_id)).toEqual(baselineRun);
  }
  for (const baselineRound of baseline.rounds) {
    expect(currentState.rounds.find((round) => round.round_id === baselineRound.round_id)).toEqual(
      baselineRound
    );
  }
}

async function publishRun(
  request: APIRequestContext,
  teacherToken: string,
  studentToken: string,
  runId: string
): Promise<{ publishedRound: DemoRound; publishedRun: DemoRun }> {
  await apiPost<DemoRound>(request, `/api/v1/runs/${runId}/rounds/1/start`, teacherToken, {});
  await apiPost<Decision>(request, `/api/v1/runs/${runId}/rounds/1/decisions`, studentToken, {
    decision_payload: {
      capacity_plan: "expand",
      cash_buffer_target: 0.16,
      marketing_budget: 180000,
      pricing: { base_price: 12800 },
      service_quality_budget: 160000,
      strategy_statement: "preserve shared state while preparing the next teaching Run"
    },
    team_id: "team_alpha"
  });
  await apiPost<DemoRound>(request, `/api/v1/runs/${runId}/rounds/1/lock`, teacherToken, {});
  await apiPost<unknown>(request, `/api/v1/runs/${runId}/rounds/1/settle`, teacherToken, {});
  await apiPost<DemoRound>(request, `/api/v1/runs/${runId}/rounds/1/publish`, teacherToken, {});

  const publishedState = await apiGet<P0DemoState>(request, "/api/v1/demo-state", teacherToken);
  const publishedRun = publishedState.data.runs.find((run) => run.run_id === runId);
  const publishedRound = publishedState.data.rounds.find((round) => round.run_id === runId);
  expect(publishedRun).toBeTruthy();
  expect(publishedRound?.status).toBe("published");
  return { publishedRound: publishedRound!, publishedRun: publishedRun! };
}

async function createPublishedAnchorRun(
  request: APIRequestContext,
  teacherToken: string,
  studentToken: string
): Promise<{ publishedRound: DemoRound; publishedRun: DemoRun }> {
  const created = await apiPost<{ round: DemoRound; run: DemoRun }>(
    request,
    "/api/v1/courses/course_demo/runs",
    teacherToken,
    {}
  );
  return publishRun(request, teacherToken, studentToken, created.data.run.run_id);
}

async function readHorizontalOverflow(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => {
        const style = getComputedStyle(element);
        return {
          className: element.className,
          clientWidth: element.clientWidth,
          display: style.display,
          gridTemplateColumns: style.gridTemplateColumns,
          maxWidth: style.maxWidth,
          minWidth: style.minWidth,
          overflowWrap: style.overflowWrap,
          parentClassName: element.parentElement?.className ?? "",
          scrollWidth: element.scrollWidth,
          tagName: element.tagName,
          text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 160) ?? "",
          whiteSpace: style.whiteSpace,
          width: style.width
        };
      })
  );
}

test("Teacher creates and selects the next Run without reopening the published Run", async ({
  page,
  request
}) => {
  const failedBrowserCreateCount = 1;
  const setupCreatedRunCount = 1;
  const successfulBrowserCreateCount = 1;
  const browserRunCreationRequests: string[] = [];
  const successfulBrowserRunCreationResponses: number[] = [];
  const internalRequests: string[] = [];
  const expectedFailureConsoleErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("request", (browserRequest) => {
    const url = new URL(browserRequest.url());
    if (browserRequest.method() === "POST" && url.pathname === "/api/v1/courses/course_demo/runs") {
      browserRunCreationRequests.push(url.pathname);
    }
    if (url.pathname.startsWith("/internal/v1")) {
      internalRequests.push(url.pathname);
    }
  });
  page.on("response", (browserResponse) => {
    const url = new URL(browserResponse.url());
    if (
      browserResponse.request().method() === "POST" &&
      url.pathname === "/api/v1/courses/course_demo/runs" &&
      browserResponse.status() === 201
    ) {
      successfulBrowserRunCreationResponses.push(browserResponse.status());
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      if (
        message
          .text()
          .includes("Failed to load resource: the server responded with a status of 503")
      ) {
        expectedFailureConsoleErrors.push(message.text());
      } else {
        consoleErrors.push(message.text());
      }
    }
  });

  const teacherToken = await login(request, "teacher");
  const studentToken = await login(request, "student");
  const baselineEnvelope = await apiGet<P0DemoState>(request, "/api/v1/demo-state", teacherToken);
  const baseline = {
    rounds: structuredClone(baselineEnvelope.data.rounds),
    runs: structuredClone(baselineEnvelope.data.runs)
  };
  const { publishedRound, publishedRun } = await createPublishedAnchorRun(
    request,
    teacherToken,
    studentToken
  );
  const publishedRunId = publishedRun.run_id;
  const anchorState = await apiGet<P0DemoState>(request, "/api/v1/demo-state", teacherToken);
  expect(anchorState.data.runs).toHaveLength(baseline.runs.length + setupCreatedRunCount);
  expectExistingStatePreserved(anchorState.data, baseline);

  await page.goto(teacherBaseUrl);
  await signInTeacherPage(page);
  const runSelector = page.getByLabel("run selector");
  await expect(runSelector).toBeVisible();
  await runSelector.selectOption(publishedRunId);
  await expect(page.getByText("Historical Run · read-only")).toBeVisible();

  await page.route(
    "**/api/v1/courses/course_demo/runs",
    async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          code: "TEST-503",
          data: null,
          message: "synthetic create failure"
        }),
        contentType: "application/json",
        status: 503
      });
    },
    { times: 1 }
  );
  await page.getByRole("button", { name: "Create Next Run" }).click();
  await expect(page.getByText("TEST-503: synthetic create failure")).toBeVisible();
  const failedCreationState = await apiGet<P0DemoState>(
    request,
    "/api/v1/demo-state",
    teacherToken
  );
  expect(failedCreationState.data.runs).toHaveLength(baseline.runs.length + setupCreatedRunCount);
  expectExistingStatePreserved(failedCreationState.data, baseline);
  expect(failedCreationState.data.runs.find((run) => run.run_id === publishedRunId)).toEqual(
    publishedRun
  );
  expect(failedCreationState.data.rounds.find((round) => round.run_id === publishedRunId)).toEqual(
    publishedRound
  );
  await expect(runSelector.locator("option")).toHaveCount(anchorState.data.runs.length);

  await page.getByRole("button", { name: "Create Next Run" }).click();
  await expect(page.getByText("run created")).toBeVisible();

  await expect.soft
    .poll(
      async () =>
        (await apiGet<P0DemoState>(request, "/api/v1/demo-state", teacherToken)).data.runs.length,
      { timeout: 3_000 }
    )
    .toBe(baseline.runs.length + setupCreatedRunCount + successfulBrowserCreateCount);

  await expect.soft(runSelector).toBeVisible();
  await expect
    .soft(browserRunCreationRequests)
    .toHaveLength(failedBrowserCreateCount + successfulBrowserCreateCount);
  await expect
    .soft(successfulBrowserRunCreationResponses)
    .toHaveLength(successfulBrowserCreateCount);
  await expect
    .soft(successfulBrowserRunCreationResponses.every((status) => status === 201))
    .toBe(true);

  const finalState = await apiGet<P0DemoState>(request, "/api/v1/demo-state", teacherToken);
  const anchorStateRunIds = new Set(anchorState.data.runs.map((run) => run.run_id));
  const finalPublishedRun = finalState.data.runs.find((run) => run.run_id === publishedRunId);
  const finalPublishedRound = finalState.data.rounds.find(
    (round: Round) => round.run_id === publishedRunId
  );
  const nextRun = finalState.data.runs.find((run) => !anchorStateRunIds.has(run.run_id));
  expect(nextRun).toBeTruthy();
  expect(finalPublishedRun).toEqual(publishedRun);
  expect(finalPublishedRound).toEqual(publishedRound);
  expectExistingStatePreserved(finalState.data, baseline);

  await expect(runSelector).toHaveValue(nextRun?.run_id ?? "");
  const finalCourseRunCount = finalState.data.runs.filter(
    (run) => run.course_id === "course_demo"
  ).length;
  await expect(runSelector.locator("option")).toHaveCount(finalCourseRunCount);
  await expect(page.getByText(`Run context: ${nextRun?.run_id}`)).toBeVisible();
  await runSelector.selectOption(publishedRunId);
  await expect(page.getByText("Historical Run · read-only")).toBeVisible();
  await expect(page.getByRole("button", { name: "已发布" })).toBeDisabled();
  await expect(page.getByText(`Run context: ${publishedRunId}`)).toBeVisible();
  await runSelector.selectOption(nextRun?.run_id ?? "");
  await expect(page.getByRole("button", { name: "开启回合" })).toBeEnabled();
  await expect(page.getByText(`Run context: ${nextRun?.run_id}`)).toBeVisible();

  const nextRound = finalState.data.rounds.find((round) => round.run_id === nextRun?.run_id);
  expect(nextRound).toBeTruthy();
  await page.route(
    "**/api/v1/demo-state",
    async (route) => {
      const response = await route.fetch();
      const envelope = (await response.json()) as ApiEnvelope<P0DemoState>;
      envelope.data.runs.push({
        ...nextRun!,
        course_id: "course_out_of_scope",
        run_id: "run_out_of_scope"
      });
      envelope.data.rounds.push({
        ...nextRound!,
        round_id: "round_out_of_scope",
        run_id: "run_out_of_scope"
      });
      await route.fulfill({ json: envelope, response });
    },
    { times: 1 }
  );

  await page.reload();
  await signInTeacherPage(page);
  await expect(page.getByLabel("run selector")).toHaveValue(nextRun?.run_id ?? "");
  await expect(page.getByLabel("run selector").locator("option")).toHaveCount(finalCourseRunCount);
  await expect(
    page.getByLabel("run selector").locator('option[value="run_out_of_scope"]')
  ).toHaveCount(0);

  expect(internalRequests).toEqual([]);
  expect(expectedFailureConsoleErrors).toHaveLength(1);
  expect(consoleErrors).toEqual([]);

  const bodyText = await page.locator("body").innerText();
  for (const protectedMarker of [
    "state_true",
    "ReplayManifest",
    "privateEvidence",
    "canonical_evidence_digest"
  ]) {
    expect(bodyText).not.toContain(protectedMarker);
  }

  await page.setViewportSize({ height: 812, width: 375 });
  const overflowingElements = await readHorizontalOverflow(page);
  expect(overflowingElements).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );

  const publishedNext = await publishRun(request, teacherToken, studentToken, nextRun!.run_id);
  expect(publishedNext.publishedRun.run_id).toBe(nextRun?.run_id);
  expect(publishedNext.publishedRound.status).toBe("published");
  const handoffState = await apiGet<P0DemoState>(request, "/api/v1/demo-state", teacherToken);
  expectExistingStatePreserved(handoffState.data, baseline);
  expect(handoffState.data.runs.find((run) => run.run_id === publishedRunId)).toEqual(publishedRun);
  expect(handoffState.data.rounds.find((round) => round.run_id === publishedRunId)).toEqual(
    publishedRound
  );
});

test("Teacher Run workspace stays within the mobile viewport", async ({ page }) => {
  test.skip(
    process.env.SIMWAR_PLAYWRIGHT_GOLDEN_M1 !== "true",
    "requires the isolated Golden M1 fixture"
  );
  await page.setViewportSize({ height: 812, width: 375 });
  await page.goto(teacherBaseUrl);
  await signInTeacherPage(page);
  await expect(page.getByLabel("teacher bff dto surface")).toBeVisible();
  await expect(
    page.getByLabel("scenario package candidates").getByText("READY", { exact: true })
  ).toBeVisible();
  await page.getByLabel("known limits product disclosure").getByText("查看完整限制").click();

  expect(await readHorizontalOverflow(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
});
