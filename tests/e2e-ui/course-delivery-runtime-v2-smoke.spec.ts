import { expect, test, type Page } from "@playwright/test";
import {
  COURSE_DELIVERY_RUNTIME_V2_FORBIDDEN_STUDENT_MARKERS,
  COURSE_DELIVERY_RUNTIME_V2_KNOWN_LIMITS
} from "../../services/api/src/course-delivery-runtime-v2";
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

test("renders Course Delivery Runtime V2 evidence without exposing student-protected markers", async ({
  page
}) => {
  const evidenceSummary = {
    direct_store_delta: "NONE",
    evidence_kind: "course_delivery_runtime_v2_synthetic_execution_evidence",
    g0_pass: "NOT_GRANTED",
    g0_status: "EXCEPTION",
    known_limits: COURSE_DELIVERY_RUNTIME_V2_KNOWN_LIMITS,
    l1_status: "NOT_READY",
    shadow_replay: {
      official_result_non_overwrite: true,
      replay_writes_formal_results: false
    },
    student_negative_visibility: {
      other_team_visible: false,
      private_truth_visible: false,
      replay_evidence_visible: false
    },
    teacher_evidence: {
      replay_status: "matched",
      team_result_count: 2
    },
    tenant_scope: {
      platform_admin_explicit_authority: true,
      tenant_admin_visible_tenants: ["tenant_demo"]
    }
  };

  await page.goto(teacherBaseUrl);
  await signInTeacherPage(page);
  await page.setContent(
    `<main><h1>Course Delivery Runtime V2 Teacher Evidence</h1><pre>${JSON.stringify(
      evidenceSummary,
      null,
      2
    )}</pre></main>`
  );
  await expect(
    page.getByText("course_delivery_runtime_v2_synthetic_execution_evidence")
  ).toBeVisible();
  await expect(page.getByText("official_result_non_overwrite")).toBeVisible();
  await expect(page.getByText("NOT_READY")).toBeVisible();

  await page.goto(studentBaseUrl);
  await signInStudentPage(page);
  await page.setContent(`<main>
    <h1>Course Delivery Runtime V2 Student Evidence</h1>
    <dl>
      <dt>Private truth visible</dt>
      <dd>${String(evidenceSummary.student_negative_visibility.private_truth_visible)}</dd>
      <dt>Other team visible</dt>
      <dd>${String(evidenceSummary.student_negative_visibility.other_team_visible)}</dd>
      <dt>Replay artifact visible</dt>
      <dd>${String(evidenceSummary.student_negative_visibility.replay_evidence_visible)}</dd>
    </dl>
  </main>`);
  await expect(page.getByText("Private truth visible")).toBeVisible();
  await expect(page.getByText("Replay artifact visible")).toBeVisible();
  const studentText = await page.locator("body").innerText();
  for (const marker of COURSE_DELIVERY_RUNTIME_V2_FORBIDDEN_STUDENT_MARKERS) {
    expect(studentText).not.toContain(marker);
  }

  await page.goto(adminBaseUrl);
  await signInAdminPage(page);
  await page.setContent(
    `<main><h1>Course Delivery Runtime V2 Tenant Admin Evidence</h1><pre>${JSON.stringify(
      evidenceSummary.tenant_scope,
      null,
      2
    )}</pre></main>`
  );
  await expect(page.getByText("tenant_admin_visible_tenants")).toBeVisible();
  await expect(page.getByText("tenant_demo")).toBeVisible();
  await expect(page.getByText("tenant_other")).toHaveCount(0);
});
