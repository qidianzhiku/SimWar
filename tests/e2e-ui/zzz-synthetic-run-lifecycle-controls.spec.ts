import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { PLAYWRIGHT_STORE_FILE, cleanupPlaywrightStore } from "./store-isolation";

const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const protectedMarkers = [
  "state_true",
  "ReplayManifest",
  "canonical_evidence_digest",
  "decision_batch_hash",
  "json_runtime_source_digest",
  "private ParameterSet",
  "private Replay"
];

test.afterAll(() => {
  cleanupPlaywrightStore();
});

async function apiLogin(
  request: APIRequestContext,
  username: string,
  password: string
): Promise<string> {
  const response = await request.post(`${apiBaseUrl}/api/v1/auth/login`, {
    data: { password, username },
    headers: { "x-tenant-id": "tenant_demo" }
  });
  expect(response.status()).toBe(200);
  const envelope = (await response.json()) as { data: { access_token: string } };
  return envelope.data.access_token;
}

async function createSyntheticRun(
  request: APIRequestContext,
  teacherToken: string
): Promise<string> {
  const response = await request.post(`${apiBaseUrl}/api/v1/courses/course_demo/runs`, {
    headers: { authorization: `Bearer ${teacherToken}` }
  });
  expect(response.status()).toBe(201);
  const envelope = (await response.json()) as { data: { run: { run_id: string } } };
  return envelope.data.run.run_id;
}

async function adminSignIn(page: Page): Promise<void> {
  const login = page.locator('section[aria-label="admin login"]');
  await login.getByLabel("tenant").fill("tenant_demo");
  await login.getByLabel("username").fill("admin");
  await login.getByLabel("password").fill("admin");
  await login.getByRole("button", { name: "管理员登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

function formalStateDigest(): string {
  const snapshot = JSON.parse(readFileSync(PLAYWRIGHT_STORE_FILE, "utf8")) as Record<
    string,
    unknown
  >;
  return createHash("sha256")
    .update(
      JSON.stringify({
        decisions: snapshot.decisions,
        replayRuns: snapshot.replayRuns,
        rounds: snapshot.rounds,
        runs: snapshot.runs,
        settlementResults: snapshot.settlementResults,
        stateSnapshots: snapshot.stateSnapshots
      })
    )
    .digest("hex");
}

test("Tenant Admin applies bounded lifecycle controls without formal-state mutation", async ({
  page,
  request
}, testInfo) => {
  const teacherToken = await apiLogin(request, "teacher", "teacher");
  const runId = await createSyntheticRun(request, teacherToken);
  const formalStateBefore = formalStateDigest();
  const lifecycleRequests: Array<{
    body: string | null;
    method: string;
    tenantHeader?: string;
    url: string;
  }> = [];
  const consoleErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (browserRequest) => {
    if (browserRequest.url().includes("/lifecycle/")) {
      lifecycleRequests.push({
        body: browserRequest.postData(),
        method: browserRequest.method(),
        tenantHeader: browserRequest.headers()["x-tenant-id"],
        url: browserRequest.url()
      });
    }
  });

  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto(adminBaseUrl);
  await adminSignIn(page);

  const surface = page.getByLabel("synthetic run lifecycle controls");
  const run = surface.locator("article", { hasText: runId });
  await expect(run).toBeVisible();
  await expect(run.getByText("ACTIVE", { exact: true })).toBeVisible();
  await expect(run.getByText(/Cleanup 删除 0 个持久化对象/)).toBeVisible();
  await expect(run.getByRole("button", { name: "ABORT" })).toBeEnabled();
  await expect(run.getByRole("button", { name: "RESET" })).toBeDisabled();
  await expect(run.getByRole("button", { name: "CLEANUP" })).toBeDisabled();

  const confirmations: string[] = [];
  page.on("dialog", async (dialog) => {
    confirmations.push(dialog.message());
    await dialog.accept();
  });

  await run.getByRole("button", { name: "ABORT" }).click();
  await expect(run.getByText("ABORTED", { exact: true })).toBeVisible();
  await expect(run.getByRole("button", { name: "RESET" })).toBeEnabled();
  await expect(run.getByRole("button", { name: "CLEANUP" })).toBeEnabled();

  await run.getByRole("button", { name: "RESET" }).click();
  await expect(run.getByText("RESET_READY", { exact: true })).toBeVisible();

  await run.getByRole("button", { name: "CLEANUP" }).click();
  await expect(run.getByText("CLEANED", { exact: true })).toBeVisible();
  await expect(run.getByRole("button", { name: "ABORT" })).toBeDisabled();
  await expect(run.getByRole("button", { name: "RESET" })).toBeDisabled();
  await expect(run.getByRole("button", { name: "CLEANUP" })).toBeDisabled();

  expect(lifecycleRequests).toHaveLength(3);
  expect(
    lifecycleRequests.map(({ body, method, tenantHeader, url }) => ({
      body,
      method,
      operation: url.split("/").at(-1),
      tenantHeader
    }))
  ).toEqual([
    {
      body: JSON.stringify({ confirmation: `ABORT ${runId}` }),
      method: "POST",
      operation: "abort",
      tenantHeader: undefined
    },
    {
      body: JSON.stringify({ confirmation: `RESET ${runId}` }),
      method: "POST",
      operation: "reset",
      tenantHeader: undefined
    },
    {
      body: JSON.stringify({ confirmation: `CLEANUP ${runId}` }),
      method: "POST",
      operation: "cleanup",
      tenantHeader: undefined
    }
  ]);
  expect(confirmations).toHaveLength(3);
  expect(confirmations[0]).toContain(`ABORT ${runId}`);
  expect(confirmations[2]).toContain("deletes no persisted artifacts");
  expect(formalStateDigest()).toBe(formalStateBefore);

  const exposedClientState = await page.evaluate(() =>
    [
      document.body.innerText,
      document.cookie,
      JSON.stringify(localStorage),
      JSON.stringify(sessionStorage)
    ].join("\n")
  );
  for (const marker of protectedMarkers) {
    expect(exposedClientState).not.toContain(marker);
    expect(consoleErrors.join("\n")).not.toContain(marker);
  }
  expect(consoleErrors).toEqual([]);
  await testInfo.attach("tenant-admin-synthetic-lifecycle-cleaned", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png"
  });
});

test("Teacher and Student have neither lifecycle authority nor Admin product controls", async ({
  page,
  request
}) => {
  for (const actor of [
    { password: "teacher", username: "teacher" },
    { password: "student", username: "student" }
  ]) {
    const token = await apiLogin(request, actor.username, actor.password);
    const denied = await request.get(`${apiBaseUrl}/api/v1/bff/admin/run-lifecycle-controls`, {
      headers: { authorization: `Bearer ${token}` }
    });
    expect(denied.status()).toBe(403);

    await page.goto(adminBaseUrl);
    const login = page.locator('section[aria-label="admin login"]');
    await login.getByLabel("tenant").fill("tenant_demo");
    await login.getByLabel("username").fill(actor.username);
    await login.getByLabel("password").fill(actor.password);
    await login.getByRole("button", { name: "管理员登录" }).click();
    await expect(page.getByText("signed in")).toBeVisible();
    await expect(page.getByLabel("synthetic run lifecycle controls")).toHaveCount(0);
  }
});
