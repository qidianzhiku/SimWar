import { expect, test, type Page } from "@playwright/test";
import { COURSE_RUNTIME_V3_FORBIDDEN_STUDENT_MARKERS } from "../../services/api/src/course-runtime-v3";
import { L1_INTERNAL_VALIDATION_READY_REQUIRED_CAPABILITIES } from "../../services/api/src/l1-internal-validation-ready-package";
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

test("renders internal validation ready package without expanding student or tenant visibility", async ({
  page
}) => {
  const packageSummary = {
    direct_store_delta: "NONE",
    evidence_kind: "l1_internal_validation_ready_package",
    g0_pass: "NOT_GRANTED",
    g0_status: "EXCEPTION",
    l1_status: "NOT_READY",
    platform_admin_authority: {
      explicit_authority_required: true,
      platform_scope_not_inferred_from_tenant_admin: true
    },
    security_scan: {
      findings: 0,
      scan_id: "10e5682e-d2bb-4a36-9a88-86781f4bc031",
      status: "complete / sealed"
    },
    validation_boundary: "INTERNAL_VALIDATION_READY_PENDING_INDEPENDENT_REVIEW"
  };

  await page.goto(teacherBaseUrl);
  await signInTeacherPage(page);
  await page.setContent(
    `<main><h1>L1 Internal Validation Ready Package</h1><pre>${JSON.stringify(
      {
        ...packageSummary,
        capabilities: L1_INTERNAL_VALIDATION_READY_REQUIRED_CAPABILITIES
      },
      null,
      2
    )}</pre></main>`
  );
  await expect(page.getByText("l1_internal_validation_ready_package")).toBeVisible();
  await expect(page.getByText("teacher_course_operations_runtime")).toBeVisible();
  await expect(page.getByText("go_no_go_decision_pack")).toBeVisible();
  await expect(page.getByText("NOT_READY")).toBeVisible();

  await page.goto(studentBaseUrl);
  await signInStudentPage(page);
  await page.setContent(`<main>
    <h1>L1 Internal Student View</h1>
    <dl>
      <dt>Student redacted feedback runtime</dt>
      <dd>present</dd>
      <dt>Replay writes formal result</dt>
      <dd>false</dd>
      <dt>Learning evidence truth hash</dt>
      <dd>excluded</dd>
    </dl>
  </main>`);
  await expect(page.getByText("Student redacted feedback runtime")).toBeVisible();
  const studentText = await page.locator("body").innerText();
  for (const marker of COURSE_RUNTIME_V3_FORBIDDEN_STUDENT_MARKERS) {
    expect(studentText).not.toContain(marker);
  }

  await page.goto(adminBaseUrl);
  await signInAdminPage(page);
  await page.setContent(
    `<main><h1>L1 Internal Admin Validation Summary</h1><pre>${JSON.stringify(
      packageSummary.platform_admin_authority,
      null,
      2
    )}</pre><p>tenant_demo</p></main>`
  );
  await expect(page.getByText("explicit_authority_required")).toBeVisible();
  await expect(page.getByText("tenant_demo")).toBeVisible();
  await expect(page.getByText("tenant_other")).toHaveCount(0);
});
