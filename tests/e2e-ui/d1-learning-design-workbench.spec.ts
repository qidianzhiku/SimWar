import { expect, test, type Page } from "@playwright/test";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const digest = "a".repeat(64);

const teacherPackage = {
  course_blueprint_reference: {
    content_digest: digest,
    course_blueprint_id: "blueprint_d1_demo",
    tenant_id: "tenant_demo",
    version: "1.0.0"
  },
  course_package_reference: {
    content_digest: digest,
    course_package_id: "course_package_d1_demo",
    tenant_id: "tenant_demo",
    version: "1.0.0"
  },
  description: "D1 package",
  parameter_set_reference: {
    content_digest: digest,
    parameter_set_id: "parameter_d1_demo",
    version: "1.0.0"
  },
  scenario_package_reference: {
    content_digest: digest,
    scenario_package_id: "scenario_d1_demo",
    tenant_id: "tenant_demo",
    version: "1.0.0"
  },
  title: "D1 package"
};

function envelope(data: unknown) {
  return { code: "OK", data, message: "success", request_id: "d1_browser" };
}

async function signIn(page: Page): Promise<void> {
  const login = page.getByLabel("teacher login");
  await login.getByLabel("tenant").fill("tenant_demo");
  await login.getByLabel("username").fill("teacher");
  await login.getByLabel("password").fill("teacher");
  await login.getByRole("button", { name: "教师登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

test("Teacher can create and validate a D1 LearningGoalVersion without score semantics", async ({
  page
}) => {
  let goal = null as null | Record<string, unknown>;
  await page.route("**/api/v1/auth/login", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        envelope({
          access_token: "d1-teacher-token",
          expires_in: 3600,
          token_type: "Bearer",
          user: {
            user_id: "usr_teacher",
            tenant_id: "tenant_demo",
            display_name: "Teacher",
            roles: ["teacher"]
          }
        })
      )
    });
  });
  await page.route("**/api/v1/demo-state", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        envelope({
          current_user: {
            user_id: "usr_teacher",
            tenant_id: "tenant_demo",
            display_name: "Teacher",
            roles: ["teacher"]
          },
          courses: [],
          teams: [],
          runs: [],
          rounds: [],
          decisions: [],
          audit_logs: []
        })
      )
    });
  });
  await page.route("**/api/v1/bff/teacher/course-package-versions", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope({ course_package_versions: [teacherPackage] }))
    });
  });
  await page.route("**/api/v1/bff/teacher/learning-designs", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        envelope({
          explicit_non_proofs: ["NOT_ACTIVE_D1"],
          learning_goals: goal ? [{ ...goal }] : [],
          rubrics: [],
          runtime_authority: "JSON_INTERNAL_ONLY"
        })
      )
    });
  });
  await page.route("**/api/v1/bff/teacher/learning-goals/drafts", async (route) => {
    goal = {
      activity_refs: [],
      content_digest: digest,
      course_package_reference: teacherPackage.course_package_reference,
      created_at: "2026-08-03T00:00:00.000Z",
      created_by: "usr_teacher",
      expected_evidence_classes: ["reflection"],
      goal_id: "goal_measure_market",
      observable_behaviors: ["compare evidence"],
      role_scope: ["teacher"],
      schema_version: "learning-design.v1",
      statement: "Compare evidence.",
      status: "DRAFT",
      tenant_id: "tenant_demo",
      title: "Market observation",
      version: "1.0.0"
    };
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(envelope(goal))
    });
  });
  await page.route(
    "**/api/v1/bff/teacher/learning-goals/goal_measure_market/versions/1.0.0/validate",
    async (route) => {
      if (goal) goal.status = "VALIDATED";
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(envelope(goal))
      });
    }
  );
  await page.goto(teacherBaseUrl);
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Learning Goals & Rubrics" })).toBeVisible();
  await page.getByRole("button", { name: "Create Goal DRAFT" }).click();
  await expect(page.getByText("DRAFT", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Validate" }).click();
  await expect(page.getByText("VALIDATED", { exact: true })).toBeVisible();
  await expect(page.getByText(/NOT_ACTIVE_D1|不产生最终成绩/)).toBeVisible();
});
