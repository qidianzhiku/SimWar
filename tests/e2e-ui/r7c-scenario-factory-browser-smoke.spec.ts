import { expect, test, type Page } from "@playwright/test";
import {
  approveR7CCompiledScenario,
  bindR7CReleaseCandidateToRun,
  buildR7CShadowArenaBatch,
  compileR7CScenarioDraft,
  createR7CReleaseCandidate,
  createR7CScenarioAuthoringDraft,
  createR7CScenarioRegistry,
  freezeR7CApprovedScenario,
  projectR7CScenarioForActor
} from "../../services/simulation-core/src/eldercare-scenario-factory";
import { cleanupPlaywrightStore } from "./store-isolation";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;

const teacherActor = {
  actor_id: "teacher_r7c",
  course_id: "course_r7c_synthetic",
  role: "teacher" as const,
  tenant_id: "tenant_r7c_synthetic"
};
const studentActor = {
  actor_id: "student_r7c",
  course_id: "course_r7c_synthetic",
  role: "student" as const,
  team_id: "team_alpha_r7c",
  tenant_id: "tenant_r7c_synthetic"
};
const tenantAdminActor = {
  actor_id: "tenant_admin_r7c",
  role: "tenant_admin" as const,
  tenant_id: "tenant_r7c_synthetic"
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

function boundCandidate() {
  const registry = createR7CScenarioRegistry({ actor: teacherActor });
  const draft = createR7CScenarioAuthoringDraft(registry, {
    actor: teacherActor,
    variant_id: "competition_entry"
  });
  const approved = approveR7CCompiledScenario(compileR7CScenarioDraft(draft), {
    actor: teacherActor
  });
  const frozen = freezeR7CApprovedScenario(approved, { actor: teacherActor });
  const candidate = createR7CReleaseCandidate(frozen, { actor: teacherActor });

  return {
    candidate: bindR7CReleaseCandidateToRun(candidate, {
      actor: teacherActor,
      run_id: "run_r7c_synthetic_001"
    }),
    family: registry.family
  };
}

test("renders R7-C scenario factory evidence with redacted student and tenant-scoped admin views", async ({
  page
}) => {
  const { candidate, family } = boundCandidate();
  const officialResult = {
    parameter_set_id: candidate.compiled_record.asset.parameter_set.parameter_set_id,
    replay_hash: "official-r7c-browser-replay-hash",
    round_id: "round_r7c_1",
    round_no: 1,
    run_id: "run_r7c_synthetic_001",
    scenario_package_id: candidate.compiled_record.asset.scenario_package.scenario_package_id,
    settlement_result_id: "official-result-r7c-browser",
    team_results: [],
    tenant_id: "tenant_r7c_synthetic"
  };
  const shadowArena = buildR7CShadowArenaBatch(family, candidate, officialResult);
  const teacherView = projectR7CScenarioForActor(candidate, {
    actor: teacherActor,
    shadow_arena: shadowArena
  });
  const studentView = projectR7CScenarioForActor(candidate, { actor: studentActor });
  const tenantAdminView = projectR7CScenarioForActor(candidate, { actor: tenantAdminActor });

  await page.goto(teacherBaseUrl);
  await signInTeacherPage(page);
  await page.setContent(
    `<main><h1>R7-C Scenario Factory</h1><pre>${JSON.stringify(teacherView)}</pre></main>`
  );
  await expect(page.getByText("teacher_authorized_scenario_factory")).toBeVisible();
  await expect(page.getByText("shadow_arena_batch")).toBeVisible();
  await expect(page.getByText("competition_entry")).toBeVisible();

  await page.goto(studentBaseUrl);
  await signInStudentPage(page);
  await page.setContent(
    `<main><h1>R7-C Student Projection</h1><pre>${JSON.stringify(studentView)}</pre></main>`
  );
  await expect(page.getByText("student_redacted_scenario_observation")).toBeVisible();
  await expect(page.getByText("state_true")).toHaveCount(0);
  await expect(page.getByText("private_assumption")).toHaveCount(0);
  await expect(page.getByText("private_replay")).toHaveCount(0);
  await expect(page.getByText("canonical_evidence_digest")).toHaveCount(0);

  await page.goto(adminBaseUrl);
  await signInAdminPage(page);
  await page.setContent(
    `<main><h1>R7-C Tenant Admin Status</h1><pre>${JSON.stringify(tenantAdminView)}</pre></main>`
  );
  await expect(page.getByText("tenant_admin_scenario_status")).toBeVisible();
  await expect(page.getByText("tenant_other")).toHaveCount(0);
});
