import { expect, test, type Page } from "@playwright/test";
import { COURSE_RUNTIME_V3_FORBIDDEN_STUDENT_MARKERS } from "../../services/api/src/course-runtime-v3";
import {
  L1_GOLDEN_M1_COURSE_RUNTIME_CHAIN,
  L1_GOLDEN_M1_COURSE_RUNTIME_NON_PROOFS
} from "../../services/api/src/l1-golden-m1-course-runtime-consolidation";
import { cleanupPlaywrightStore } from "./store-isolation";

const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;

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

test("renders L1 Golden M1 consolidation summaries without widening student visibility", async ({
  page
}) => {
  const consolidationSummary = {
    direct_store_delta: "NONE",
    evidence_kind: "l1_golden_m1_course_runtime_consolidation",
    g0_pass: "NOT_GRANTED",
    g0_status: "EXCEPTION",
    l1_status: "NOT_READY",
    non_proofs: L1_GOLDEN_M1_COURSE_RUNTIME_NON_PROOFS,
    replay_and_shadow: {
      replay_status: "matched",
      replay_writes_formal_results: false,
      shadow_replay_writes_formal_results: false
    },
    runtime_chain: L1_GOLDEN_M1_COURSE_RUNTIME_CHAIN,
    tenant_admin_scope: {
      visible_tenants: ["tenant_demo"]
    }
  };

  await page.goto(teacherBaseUrl);
  await signInTeacherPage(page);
  await page.setContent(
    `<main><h1>L1 Golden M1 Teacher Evidence</h1><pre>${JSON.stringify(
      consolidationSummary,
      null,
      2
    )}</pre></main>`
  );
  await expect(page.getByText("l1_golden_m1_course_runtime_consolidation")).toBeVisible();
  await expect(page.getByText("teacher.course_draft")).toBeVisible();
  await expect(page.getByText("shadow_replay_writes_formal_results")).toBeVisible();
  await expect(page.getByText("NOT_READY")).toBeVisible();

  await page.goto(studentBaseUrl);
  await signInStudentPage(page);
  await page.setContent(`<main>
    <h1>L1 Golden M1 Student Summary</h1>
    <dl>
      <dt>Decision submit observed</dt>
      <dd>true</dd>
      <dt>Redacted result observed</dt>
      <dd>true</dd>
      <dt>Replay writes formal result</dt>
      <dd>false</dd>
      <dt>Tenant scope</dt>
      <dd>tenant_demo</dd>
    </dl>
  </main>`);
  await expect(page.getByText("Decision submit observed")).toBeVisible();
  await expect(page.getByText("Redacted result observed")).toBeVisible();
  const studentText = await page.locator("body").innerText();
  for (const marker of COURSE_RUNTIME_V3_FORBIDDEN_STUDENT_MARKERS) {
    expect(studentText).not.toContain(marker);
  }

  await page.goto(adminBaseUrl);
  await signInAdminPage(page);
  await page.setContent(
    `<main><h1>L1 Golden M1 Tenant Admin Summary</h1><pre>${JSON.stringify(
      consolidationSummary.tenant_admin_scope,
      null,
      2
    )}</pre></main>`
  );
  await expect(page.getByText("tenant_demo")).toBeVisible();
  await expect(page.getByText("tenant_other")).toHaveCount(0);
});
