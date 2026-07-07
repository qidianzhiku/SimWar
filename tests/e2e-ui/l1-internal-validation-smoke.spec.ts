import { expect, test, type Page } from "@playwright/test";
import { cleanupPlaywrightStore } from "./store-isolation";

const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const studentForbiddenPageMarkers = [
  "ReplayManifest",
  "replay_manifest",
  "decision_batch_hash",
  "json_runtime_source_digest",
  "canonical_evidence_digest",
  "tenant_other",
  "Other Teacher"
];
const studentForbiddenConsoleMarkers = ["state_true", ...studentForbiddenPageMarkers];

test.afterAll(() => {
  cleanupPlaywrightStore();
});

async function signInStudentPage(page: Page): Promise<void> {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill("student");
  await page.getByLabel("password").fill("student");
  await page.getByRole("button", { name: "学员登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

async function signInAdminPage(page: Page): Promise<void> {
  const login = page.locator('section[aria-label="admin login"]');
  await login.getByLabel("tenant").fill("tenant_demo");
  await login.getByLabel("username").fill("admin");
  await login.getByLabel("password").fill("admin");
  await login.getByRole("button", { name: "管理员登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

test("keeps the student internal-validation browser surface redacted", async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on("console", (message) => {
    consoleMessages.push(message.text());
  });

  await page.goto("/");
  await signInStudentPage(page);

  await expect(page.getByRole("heading", { name: "SimWar M1 学员驾驶舱" })).toBeVisible();
  await expect(page.getByText("learner / team_captain · tenant_demo")).toBeVisible();
  await expect(page.getByText("Replay Evidence")).toHaveCount(0);

  const pageText = await page.locator("body").innerText();
  const consoleText = consoleMessages.join("\n");

  for (const marker of studentForbiddenPageMarkers) {
    expect(pageText).not.toContain(marker);
  }

  for (const marker of studentForbiddenConsoleMarkers) {
    expect(consoleText).not.toContain(marker);
  }
});

test("keeps the tenant admin internal-validation browser surface tenant scoped", async ({
  page
}) => {
  await page.goto(adminBaseUrl);
  await signInAdminPage(page);

  await expect(page.getByRole("heading", { name: "SimWar P1 管理后台" })).toBeVisible();
  await expect(page.getByText("P0 Admin · tenant_admin")).toBeVisible();
  await expect(page.getByText("Demo Business School").first()).toBeVisible();
  await expect(page.getByText("Other Tenant")).toHaveCount(0);
  await expect(page.getByText("Other Teacher")).toHaveCount(0);
  await expect(page.getByText("SimWar Platform")).toHaveCount(0);
});
