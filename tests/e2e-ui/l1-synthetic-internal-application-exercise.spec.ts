import { expect, test, type Page } from "@playwright/test";
import { cleanupPlaywrightStore } from "./store-isolation";

const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const forbiddenStudentPageMarkers = [
  "ReplayManifest",
  "replay_manifest",
  "decision_batch_hash",
  "json_runtime_source_digest",
  "canonical_evidence_digest",
  "tenant_other",
  "Other Teacher"
];
const forbiddenStudentConsoleMarkers = ["state_true", ...forbiddenStudentPageMarkers];

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

async function signInTeacherPage(page: Page): Promise<void> {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill("teacher");
  await page.getByLabel("password").fill("teacher");
  await page.getByRole("button", { name: "教师登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

async function signInAdminPage(page: Page): Promise<void> {
  const loginPanel = page.locator('section[aria-label="admin login"]');
  await loginPanel.getByLabel("tenant").fill("tenant_demo");
  await loginPanel.getByLabel("username").fill("admin");
  await loginPanel.getByLabel("password").fill("admin");
  await loginPanel.getByRole("button", { name: "管理员登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

test("keeps synthetic internal application browser surfaces read-only and scoped", async ({
  page
}) => {
  const consoleMessages: string[] = [];
  page.on("console", (message) => {
    consoleMessages.push(message.text());
  });

  await page.goto("/");
  await signInStudentPage(page);
  await expect(page.getByRole("heading", { name: "SimWar M1 学员驾驶舱" })).toBeVisible();
  await expect(page.getByText("learner / team_captain · tenant_demo")).toBeVisible();
  await expect(page.getByText("Replay Evidence")).toHaveCount(0);

  const studentPageText = await page.locator("body").innerText();
  const studentConsoleText = consoleMessages.join("\n");
  for (const marker of forbiddenStudentPageMarkers) {
    expect(studentPageText).not.toContain(marker);
  }
  for (const marker of forbiddenStudentConsoleMarkers) {
    expect(studentConsoleText).not.toContain(marker);
  }

  await page.goto(teacherBaseUrl);
  await signInTeacherPage(page);
  await expect(page.getByRole("heading", { name: "SimWar M1 教师控制台" })).toBeVisible();
  await expect(page.getByText("教师操作清单")).toBeVisible();
  await expect(page.getByText("最小学习证据 Rubric")).toBeVisible();

  await page.goto(adminBaseUrl);
  await signInAdminPage(page);
  await expect(page.getByRole("heading", { name: "SimWar P1 管理后台" })).toBeVisible();
  await expect(page.getByText("Demo Business School").first()).toBeVisible();
  await expect(page.getByText("Other Tenant")).toHaveCount(0);
  await expect(page.getByText("Other Teacher")).toHaveCount(0);
  await expect(page.getByText("SimWar Platform")).toHaveCount(0);
});
