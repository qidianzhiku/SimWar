import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type {
  ApiEnvelope,
  AuthSession,
  Decision,
  P0DemoState,
  Round,
  Run,
  TeacherBffWorkspaceDTO
} from "../../packages/shared-contracts/src";
import { cleanupPlaywrightStore } from "./store-isolation";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;

test.afterAll(() => {
  cleanupPlaywrightStore();
});

async function login(request: APIRequestContext): Promise<AuthSession> {
  const response = await request.post(`${apiBaseUrl}/api/v1/auth/login`, {
    data: { password: "teacher", username: "teacher" },
    headers: { "content-type": "application/json", "x-tenant-id": "tenant_demo" }
  });
  expect(response.status()).toBe(200);
  return ((await response.json()) as ApiEnvelope<AuthSession>).data;
}

async function createRun(request: APIRequestContext, token: string): Promise<Run> {
  const response = await request.post(`${apiBaseUrl}/api/v1/courses/course_demo/runs`, {
    data: {},
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-tenant-id": "tenant_demo"
    }
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as ApiEnvelope<{ run: Run; round: Round }>).data.run;
}

async function signInTeacherPage(page: Page): Promise<void> {
  await page.goto(teacherBaseUrl);
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill("teacher");
  await page.getByLabel("password").fill("teacher");
  await page.getByRole("button", { name: "教师登录" }).click();
  await expect(
    page.getByRole("status", { name: "教师操作通知" }).getByLabel("技术兼容标签")
  ).toContainText("signed in");
}

function addRoundTwoToDemoState(
  envelope: ApiEnvelope<P0DemoState>,
  runId: string,
  status: Round["status"]
): void {
  const roundOne = envelope.data.rounds.find(
    (round) => round.run_id === runId && round.round_no === 1
  );
  expect(roundOne).toBeTruthy();
  roundOne!.status = "published";

  const roundTwo: Round = {
    round_id: `mw3-browser-round-2-${runId}`,
    round_no: 2,
    run_id: runId,
    status,
    tenant_id: "tenant_demo"
  };
  envelope.data.rounds = envelope.data.rounds.filter(
    (round) => !(round.run_id === runId && round.round_no === 2)
  );
  envelope.data.rounds.push(roundTwo);

  const existingDecision = envelope.data.decisions.find((decision) => decision.run_id === runId);
  if (status !== "draft" && !existingDecision) {
    const template = envelope.data.decisions[0];
    const decision: Decision = template
      ? {
          ...structuredClone(template),
          decision_id: `mw3-browser-decision-${runId}`,
          round_id: roundTwo.round_id,
          round_no: 2,
          run_id: runId,
          tenant_id: "tenant_demo"
        }
      : {
          decision_id: `mw3-browser-decision-${runId}`,
          payload: {
            capacity_plan: "hold",
            cash_buffer_target: 0.2,
            marketing_budget: 100000,
            pricing: { base_price: 12000 },
            service_quality_budget: 100000,
            strategy_statement: "MW3 browser round context fixture"
          },
          round_id: roundTwo.round_id,
          round_no: 2,
          run_id: runId,
          status: "submitted",
          submitted_by: "usr_teacher",
          team_id: "team_alpha",
          tenant_id: "tenant_demo",
          validation_report: [],
          version: 1
        };
    envelope.data.decisions.push(decision);
  }
}

async function buildRoundTwoWorkspace(
  request: APIRequestContext,
  token: string,
  runId: string,
  status: Round["status"]
): Promise<TeacherBffWorkspaceDTO> {
  const source = await request.get(
    `${apiBaseUrl}/api/v1/bff/teacher/runs/${runId}/rounds/1/workspace`,
    {
      headers: { authorization: `Bearer ${token}`, "x-tenant-id": "tenant_demo" }
    }
  );
  expect(source.status()).toBe(200);
  const workspace = ((await source.json()) as ApiEnvelope<TeacherBffWorkspaceDTO>).data;
  const roundId = `mw3-browser-round-2-${runId}`;
  const action =
    status === "draft"
      ? "round:start"
      : status === "open"
        ? "round:lock"
        : status === "locked"
          ? "settlement:settle"
          : status === "settled"
            ? "round:publish"
            : undefined;
  workspace.round_control = {
    ...workspace.round_control,
    allowed_actions: action ? [action] : [],
    round_id: roundId,
    round_no: 2,
    run_id: runId,
    status
  };
  workspace.teacher_dashboard = {
    ...workspace.teacher_dashboard,
    visible_state: { ...workspace.teacher_dashboard.visible_state, round_status: status },
    run_id: runId
  };
  workspace.teacher_replay_summary = {
    ...workspace.teacher_replay_summary,
    round_id: roundId,
    round_no: 2,
    run_id: runId
  };
  return workspace;
}

test("MW3 browser journey keeps Teacher commands on the selected Round 2", async ({
  page,
  request
}) => {
  const teacher = await login(request);
  const run = await createRun(request, teacher.access_token);
  let status: Round["status"] = "draft";
  const commandPaths: string[] = [];

  page.on("request", (browserRequest) => {
    const url = new URL(browserRequest.url());
    if (
      browserRequest.method() === "POST" &&
      url.pathname.includes(`/runs/${run.run_id}/rounds/`)
    ) {
      commandPaths.push(url.pathname);
    }
  });

  await page.route("**/api/v1/demo-state", async (route) => {
    const response = await route.fetch();
    const envelope = (await response.json()) as ApiEnvelope<P0DemoState>;
    addRoundTwoToDemoState(envelope, run.run_id, status);
    await route.fulfill({ json: envelope, response });
  });

  await page.route(`**/api/v1/bff/teacher/runs/${run.run_id}/rounds/2/workspace`, async (route) => {
    const workspace = await buildRoundTwoWorkspace(
      request,
      teacher.access_token,
      run.run_id,
      status
    );
    await route.fulfill({
      body: JSON.stringify({ code: "OK", data: workspace, message: "success" }),
      contentType: "application/json",
      status: 200
    });
  });

  await page.route(`**/api/v1/runs/${run.run_id}/rounds/2/*`, async (route) => {
    const url = new URL(route.request().url());
    const command = url.pathname.split("/").at(-1);
    const transitions: Record<string, Round["status"]> = {
      lock: "locked",
      publish: "published",
      settle: "settled",
      start: "open"
    };
    const nextStatus = command ? transitions[command] : undefined;
    if (route.request().method() !== "POST" || !nextStatus) {
      await route.fallback();
      return;
    }
    status = nextStatus;
    await route.fulfill({
      body: JSON.stringify({
        code: "MW3_BROWSER_FIXTURE",
        data: {
          round_id: `mw3-browser-round-2-${run.run_id}`,
          round_no: 2,
          run_id: run.run_id,
          status,
          tenant_id: "tenant_demo"
        },
        message: "success"
      }),
      contentType: "application/json",
      status: 200
    });
  });

  await signInTeacherPage(page);
  await expect(page.getByLabel("round selector")).toHaveValue(`mw3-browser-round-2-${run.run_id}`);
  await expect(page.getByLabel("当前上下文")).toContainText("回合2");

  await page.getByRole("button", { name: "开启回合" }).click();
  await expect(page.getByRole("status", { name: "教师操作通知" })).toContainText("回合已开启");

  await page.getByRole("button", { name: "锁定回合" }).click();
  await expect(page.getByRole("status", { name: "教师操作通知" })).toContainText("回合已锁定");

  await page.getByRole("button", { name: "请求结算" }).click();
  await expect(page.getByRole("status", { name: "教师操作通知" })).toContainText("结算已完成");

  await page.getByRole("button", { name: "发布结果" }).click();
  await expect(page.getByRole("status", { name: "教师操作通知" })).toContainText("正式结果已发布");
  await expect(page.getByText("历史 Run · 只读")).toBeVisible();
  await expect(page.getByLabel("round selector")).toHaveValue(`mw3-browser-round-2-${run.run_id}`);

  expect(commandPaths).toEqual([
    `/api/v1/runs/${run.run_id}/rounds/2/start`,
    `/api/v1/runs/${run.run_id}/rounds/2/lock`,
    `/api/v1/runs/${run.run_id}/rounds/2/settle`,
    `/api/v1/runs/${run.run_id}/rounds/2/publish`
  ]);
  expect(commandPaths.some((path) => path.endsWith("/rounds/1/start"))).toBe(false);
});
