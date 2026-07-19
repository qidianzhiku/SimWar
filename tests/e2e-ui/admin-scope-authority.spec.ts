import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { PLAYWRIGHT_STORE_FILE, cleanupPlaywrightStore } from "./store-isolation";

const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const protectedMarkers = [
  "state_true",
  "ReplayManifest",
  "private replay",
  "private trace",
  "canonical_evidence_digest",
  "decision_batch_hash",
  "json_runtime_source_digest"
];

test.afterAll(() => {
  cleanupPlaywrightStore();
});

function formalStateDigest(): string {
  const snapshot = JSON.parse(readFileSync(PLAYWRIGHT_STORE_FILE, "utf8")) as Record<
    string,
    unknown
  >;
  return createHash("sha256")
    .update(
      JSON.stringify({
        courses: snapshot.courses,
        runs: snapshot.runs,
        settlementResults: snapshot.settlementResults,
        tenants: snapshot.tenants,
        users: snapshot.users
      })
    )
    .digest("hex");
}

async function signIn(
  page: Page,
  input: { password: string; tenant: string; username: string }
): Promise<string> {
  const loginResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/v1/auth/login") && response.status() === 200
  );
  const login = page.locator('section[aria-label="admin login"]');
  await login.getByLabel("tenant").fill(input.tenant);
  await login.getByLabel("username").fill(input.username);
  await login.getByLabel("password").fill(input.password);
  await login.getByRole("button", { name: "管理员登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
  const body = (await (await loginResponse).json()) as { data: { access_token: string } };
  return body.data.access_token;
}

async function directGet(
  page: Page,
  path: string,
  token: string
): Promise<{
  body: unknown;
  status: number;
}> {
  return page.evaluate(
    async ({ apiUrl, requestPath, requestToken }) => {
      const response = await fetch(`${apiUrl}${requestPath}`, {
        headers: { authorization: `Bearer ${requestToken}` },
        method: "GET"
      });
      return { body: await response.json(), status: response.status };
    },
    { apiUrl: apiBaseUrl, requestPath: path, requestToken: token }
  );
}

test("Tenant Admin consumes the scoped summary without platform authority or cross-tenant data", async ({
  page
}, testInfo) => {
  const consoleMessages: string[] = [];
  const requestUrls: string[] = [];
  const summaryRequests: Array<{ method: string; tenantHeader?: string; url: string }> = [];
  page.on("console", (message) => consoleMessages.push(message.text()));
  page.on("request", (request) => {
    requestUrls.push(request.url());
    if (request.url().includes("/api/v1/bff/admin/tenant-summary")) {
      summaryRequests.push({
        method: request.method(),
        tenantHeader: request.headers()["x-tenant-id"],
        url: request.url()
      });
    }
  });

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(adminBaseUrl);
  const summaryResponse = page.waitForResponse((response) =>
    response.url().includes("/api/v1/bff/admin/tenant-summary")
  );
  const token = await signIn(page, {
    password: "admin",
    tenant: "tenant_demo",
    username: "admin"
  });
  const digestBeforeSummary = formalStateDigest();

  const surface = page.getByLabel("tenant admin scoped summary");
  await expect(surface.getByRole("heading", { name: "当前租户范围" })).toBeVisible();
  await expect(surface.getByText("只读摘要")).toBeVisible();
  await expect(surface.getByText("tenant_demo", { exact: true })).toBeVisible();
  await expect(page.getByLabel("platform admin authority summary")).toHaveCount(0);
  await expect(page.getByText("Other Tenant")).toHaveCount(0);
  await expect(page.getByText("Other Teacher")).toHaveCount(0);
  await expect(page.getByText("SimWar Platform")).toHaveCount(0);

  expect(summaryRequests).toEqual([
    {
      method: "GET",
      tenantHeader: undefined,
      url: expect.stringContaining("/api/v1/bff/admin/tenant-summary")
    }
  ]);
  expect(summaryRequests[0]?.url).not.toContain("scope=platform");
  expect(requestUrls.some((url) => url.includes("internal/v1"))).toBe(false);

  const summaryEnvelope = (await (await summaryResponse).json()) as {
    data: Record<string, unknown>;
  };
  expect(Object.keys(summaryEnvelope.data).sort()).toEqual(
    [
      "actor_role",
      "allowed_actions",
      "explicit_non_proof",
      "redacted_fields",
      "source_runtime_path",
      "tenant_id",
      "visible_state",
      "visible_tenant_ids"
    ].sort()
  );

  const denied = await directGet(
    page,
    "/api/v1/bff/admin/platform-authority?scope=platform",
    token
  );
  expect(denied.status).toBe(403);
  expect(JSON.stringify(denied.body)).not.toMatch(/tenant_other|Other Tenant|tenant_private/i);
  expect(formalStateDigest()).toBe(digestBeforeSummary);

  const pageText = await page.locator("body").innerText();
  for (const marker of protectedMarkers) {
    expect(pageText).not.toContain(marker);
    expect(consoleMessages.join("\n")).not.toContain(marker);
  }
  await testInfo.attach("tenant-admin-mobile-scoped-summary", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png"
  });
});

test("Platform Admin uses explicit platform scope and receives only the safe aggregate", async ({
  page
}, testInfo) => {
  const authorityRequests: Array<{ method: string; tenantHeader?: string; url: string }> = [];
  const consoleMessages: string[] = [];
  const requestUrls: string[] = [];
  page.on("console", (message) => consoleMessages.push(message.text()));
  page.on("request", (request) => {
    requestUrls.push(request.url());
    if (request.url().includes("/api/v1/bff/admin/platform-authority")) {
      authorityRequests.push({
        method: request.method(),
        tenantHeader: request.headers()["x-tenant-id"],
        url: request.url()
      });
    }
  });

  await page.goto(adminBaseUrl);
  const authorityResponse = page.waitForResponse((response) =>
    response.url().includes("/api/v1/bff/admin/platform-authority?scope=platform")
  );
  const token = await signIn(page, {
    password: "platform",
    tenant: "tenant_platform",
    username: "platform"
  });
  const digestBeforeSummary = formalStateDigest();

  const surface = page.getByLabel("platform admin authority summary");
  await expect(surface.getByRole("heading", { name: "Platform scope" })).toBeVisible();
  await expect(surface.getByText("Explicit platform authority")).toBeVisible();
  await expect(surface.getByText("Read-only summary")).toBeVisible();
  await expect(surface.getByText("3", { exact: true })).toBeVisible();
  await expect(page.getByLabel("tenant admin scoped summary")).toHaveCount(0);
  await expect(page.getByText("Other Tenant")).toHaveCount(0);
  await expect(page.getByText("Other Teacher")).toHaveCount(0);

  expect(authorityRequests).toEqual([
    {
      method: "GET",
      tenantHeader: undefined,
      url: expect.stringContaining("/api/v1/bff/admin/platform-authority?scope=platform")
    }
  ]);
  expect(requestUrls.some((url) => url.includes("internal/v1"))).toBe(false);

  const authorityEnvelope = (await (await authorityResponse).json()) as {
    data: Record<string, unknown>;
  };
  expect(Object.keys(authorityEnvelope.data).sort()).toEqual(
    [
      "actor_role",
      "allowed_actions",
      "explicit_authority_source",
      "explicit_non_proof",
      "platform_authority",
      "redacted_fields",
      "required_scope",
      "source_runtime_path",
      "visible_state"
    ].sort()
  );

  const missingScope = await directGet(page, "/api/v1/bff/admin/platform-authority", token);
  expect(missingScope.status).toBe(422);
  expect(missingScope.body).toMatchObject({ code: "BFF-422-001" });
  expect(JSON.stringify(missingScope.body)).not.toMatch(
    /tenant_other|Other Tenant|tenant_private/i
  );
  expect(formalStateDigest()).toBe(digestBeforeSummary);

  const pageText = await page.locator("body").innerText();
  for (const marker of protectedMarkers) {
    expect(pageText).not.toContain(marker);
    expect(consoleMessages.join("\n")).not.toContain(marker);
  }
  await testInfo.attach("platform-admin-desktop-authority-summary", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png"
  });
});

for (const actor of [
  { password: "teacher", tenant: "tenant_demo", username: "teacher" },
  { password: "student", tenant: "tenant_demo", username: "student" }
]) {
  test(`${actor.username} has no Admin product surface and direct Admin BFF access is denied`, async ({
    page
  }) => {
    await page.goto(adminBaseUrl);
    const token = await signIn(page, actor);

    await expect(page.getByLabel("tenant admin scoped summary")).toHaveCount(0);
    await expect(page.getByLabel("platform admin authority summary")).toHaveCount(0);
    const denied = await directGet(page, "/api/v1/bff/admin/tenant-summary", token);
    expect(denied.status).toBe(403);
    expect(JSON.stringify(denied.body)).not.toMatch(/tenant_other|Other Tenant|tenant_private/i);
  });
}

test("missing tenant context never becomes implicit platform authority", async ({ page }) => {
  await page.goto(adminBaseUrl);
  const login = page.locator('section[aria-label="admin login"]');
  await login.getByLabel("tenant").fill("");
  await login.getByLabel("username").fill("platform");
  await login.getByLabel("password").fill("platform");
  await login.getByRole("button", { name: "管理员登录" }).click();

  await expect(page.getByText(/AUTH-401-002|invalid credentials/)).toBeVisible();
  await expect(page.getByLabel("platform admin authority summary")).toHaveCount(0);
});
