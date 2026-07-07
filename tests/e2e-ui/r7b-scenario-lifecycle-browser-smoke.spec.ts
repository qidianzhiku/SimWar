import { expect, test, type Page } from "@playwright/test";
import {
  approveR7BScenarioDraft,
  bindR7BFrozenScenarioToRun,
  compileR7BScenarioDraft,
  createR7BScenarioDraft,
  freezeR7BApprovedScenario,
  projectR7BScenarioForActor
} from "../../services/simulation-core/src/eldercare-scenario-lifecycle";
import { cleanupPlaywrightStore } from "./store-isolation";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;

const teacherActor = {
  actor_id: "teacher_r7b",
  course_id: "course_r7b_synthetic",
  role: "teacher" as const,
  tenant_id: "tenant_r7b_synthetic"
};
const studentActor = {
  actor_id: "student_r7b",
  course_id: "course_r7b_synthetic",
  role: "student" as const,
  team_id: "team_alpha_r7b",
  tenant_id: "tenant_r7b_synthetic"
};
const tenantAdminActor = {
  actor_id: "tenant_admin_r7b",
  role: "tenant_admin" as const,
  tenant_id: "tenant_r7b_synthetic"
};

test.afterAll(() => {
  cleanupPlaywrightStore();
});

async function signInTeacherPage(page: Page): Promise<void> {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill("teacher");
  await page.getByLabel("password").fill("teacher");
  await page.getByRole("button", { name: "教师登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

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

function boundScenario() {
  const compiled = compileR7BScenarioDraft(createR7BScenarioDraft({ actor: teacherActor }));
  const approved = approveR7BScenarioDraft(compiled, { actor: teacherActor });
  const frozen = freezeR7BApprovedScenario(approved, { actor: teacherActor });
  return bindR7BFrozenScenarioToRun(frozen, {
    actor: teacherActor,
    run_id: "run_r7b_synthetic_001"
  });
}

test("renders R7-B scenario lifecycle evidence with redacted student and tenant-scoped admin views", async ({
  page
}) => {
  const bound = boundScenario();
  const teacherView = projectR7BScenarioForActor(bound, { actor: teacherActor });
  const studentView = projectR7BScenarioForActor(bound, { actor: studentActor });
  const tenantAdminView = projectR7BScenarioForActor(bound, { actor: tenantAdminActor });

  await page.goto(teacherBaseUrl);
  await signInTeacherPage(page);
  await expect(page.getByRole("heading", { name: "SimWar M1 教师控制台" })).toBeVisible();
  await page.setContent(
    `<main><h1>R7-B Scenario Lifecycle</h1><pre>${JSON.stringify(teacherView)}</pre></main>`
  );
  await expect(page.getByText("teacher_authorized_evidence")).toBeVisible();
  await expect(page.getByText("BOUND_TO_RUN")).toBeVisible();
  await expect(page.getByText("scenario_package.version")).toBeVisible();

  await page.goto(studentBaseUrl);
  await signInStudentPage(page);
  await page.setContent(
    `<main><h1>R7-B Student Projection</h1><pre>${JSON.stringify(studentView)}</pre></main>`
  );
  await expect(page.getByText("student_redacted_state_obs")).toBeVisible();
  await expect(page.getByText("state_true")).toHaveCount(0);
  await expect(page.getByText("private_plugin_trace")).toHaveCount(0);
  await expect(page.getByText("private_replay")).toHaveCount(0);

  await page.goto(adminBaseUrl);
  await signInAdminPage(page);
  await page.setContent(
    `<main><h1>R7-B Tenant Admin Status</h1><pre>${JSON.stringify(tenantAdminView)}</pre></main>`
  );
  await expect(page.getByText("tenant_admin_status_summary")).toBeVisible();
  await expect(page.getByText("tenant_other")).toHaveCount(0);
});
