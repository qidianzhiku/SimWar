import { expect, test, type Page } from "@playwright/test";
import {
  COURSE_RUNTIME_V3_FORBIDDEN_STUDENT_MARKERS,
  COURSE_RUNTIME_V3_KNOWN_LIMITS,
  COURSE_RUNTIME_V3_REQUIRED_CHAIN
} from "../../services/api/src/course-runtime-v3";
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

test("renders Course Runtime V3 evidence without exposing student-private markers", async ({
  page
}) => {
  const evidenceSummary = {
    audit_integrity: {
      audit_events_have_request_id: true,
      duplicate_audit_side_effects_detected: false
    },
    course_blueprint: {
      mutation_allowed: false,
      scenario_package_id: "scenario_pkg_runtime_v3",
      seed: 20260707
    },
    direct_store_delta: "NONE",
    evidence_kind: "course_runtime_v3_synthetic_execution_evidence",
    g0_pass: "NOT_GRANTED",
    g0_status: "EXCEPTION",
    idempotency: {
      duplicate_decision_result_stable: true,
      duplicate_publish_result_stable: true,
      duplicate_round_lock_result_stable: true,
      duplicate_settlement_result_stable: true
    },
    known_limits: COURSE_RUNTIME_V3_KNOWN_LIMITS,
    l1_status: "NOT_READY",
    replay_and_shadow: {
      learning_evidence_excluded_from_truth_hash: true,
      replay_writes_formal_results: false,
      shadow_replay_writes_formal_results: false
    },
    role_scope: {
      denied_operations: ["round.lock", "decision.submit.cross_team", "result.read.cross_tenant"],
      tenant_admin_visible_tenants: ["tenant_demo"]
    },
    runtime_chain: COURSE_RUNTIME_V3_REQUIRED_CHAIN
  };

  await page.goto(teacherBaseUrl);
  await signInTeacherPage(page);
  await page.setContent(
    `<main><h1>Course Runtime V3 Teacher Evidence</h1><pre>${JSON.stringify(
      evidenceSummary,
      null,
      2
    )}</pre></main>`
  );
  await expect(page.getByText("course_runtime_v3_synthetic_execution_evidence")).toBeVisible();
  await expect(page.getByText("decision.submit.idempotent_replay")).toBeVisible();
  await expect(page.getByText("shadow_replay_writes_formal_results")).toBeVisible();
  await expect(page.getByText("NOT_READY")).toBeVisible();

  await page.goto(studentBaseUrl);
  await signInStudentPage(page);
  await page.setContent(`<main>
    <h1>Course Runtime V3 Student Evidence</h1>
    <dl>
      <dt>Decision duplicate stable</dt>
      <dd>${String(evidenceSummary.idempotency.duplicate_decision_result_stable)}</dd>
      <dt>Replay writes formal result</dt>
      <dd>${String(evidenceSummary.replay_and_shadow.replay_writes_formal_results)}</dd>
      <dt>Tenant scope</dt>
      <dd>${evidenceSummary.role_scope.tenant_admin_visible_tenants.join(", ")}</dd>
    </dl>
  </main>`);
  await expect(page.getByText("Decision duplicate stable")).toBeVisible();
  await expect(page.getByText("Replay writes formal result")).toBeVisible();
  const studentText = await page.locator("body").innerText();
  for (const marker of COURSE_RUNTIME_V3_FORBIDDEN_STUDENT_MARKERS) {
    expect(studentText).not.toContain(marker);
  }

  await page.goto(adminBaseUrl);
  await signInAdminPage(page);
  await page.setContent(
    `<main><h1>Course Runtime V3 Tenant Admin Evidence</h1><pre>${JSON.stringify(
      evidenceSummary.role_scope,
      null,
      2
    )}</pre></main>`
  );
  await expect(page.getByText("tenant_admin_visible_tenants")).toBeVisible();
  await expect(page.getByText("tenant_demo")).toBeVisible();
  await expect(page.getByText("tenant_other")).toHaveCount(0);
});
