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

const alternateTeacherPackage = {
  ...teacherPackage,
  course_package_reference: {
    ...teacherPackage.course_package_reference,
    content_digest: "b".repeat(64),
    course_package_id: "course_package_d1_alternate"
  },
  title: "D1 alternate package"
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
  let goals: Record<string, unknown>[] = [];
  let rubrics: Record<string, unknown>[] = [];
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
      body: JSON.stringify(
        envelope({ course_package_versions: [teacherPackage, alternateTeacherPackage] })
      )
    });
  });
  await page.route("**/api/v1/bff/teacher/learning-designs", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        envelope({
          explicit_non_proofs: ["NOT_ACTIVE_D1"],
          learning_goals: goals.map((item) => ({ ...item })),
          rubrics: rubrics.map((item) => ({ ...item })),
          runtime_authority: "JSON_INTERNAL_ONLY"
        })
      )
    });
  });
  await page.route("**/api/v1/bff/teacher/learning-goals/drafts", async (route) => {
    const request = route.request().postDataJSON() as {
      activity_refs: Array<{ activity_id: string }>;
      course_package_reference: unknown;
      role_scope: string[];
    };
    expect(request.activity_refs[0]?.activity_id).toBe("activity_observe_v1");
    expect(request.course_package_reference).toEqual(
      alternateTeacherPackage.course_package_reference
    );
    expect(request.role_scope).toEqual(["teacher"]);
    const goal = {
      activity_refs: [],
      content_digest: digest,
      course_package_reference: alternateTeacherPackage.course_package_reference,
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
    goals = [goal];
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(envelope(goal))
    });
  });
  await page.route(
    "**/api/v1/bff/teacher/learning-goals/goal_measure_market/versions/1.0.0/validate",
    async (route) => {
      const goal = goals.find((item) => item.version === "1.0.0");
      if (goal) goal.status = "VALIDATED";
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(envelope(goal))
      });
    }
  );
  await page.route(
    "**/api/v1/bff/teacher/learning-goals/goal_measure_market/versions/1.0.0/publish",
    async (route) => {
      const goal = goals.find((item) => item.version === "1.0.0");
      if (goal) goal.status = "PUBLISHED";
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(envelope(goal))
      });
    }
  );
  await page.route("**/api/v1/bff/teacher/learning-goals/revisions", async (route) => {
    const request = route.request().postDataJSON() as {
      source_reference: { content_digest: string; version: string };
      version: string;
    };
    const source = goals.find((item) => item.version === "1.0.0");
    expect(request.source_reference.version).toBe("1.0.0");
    expect(request.source_reference.content_digest).toBe(source?.content_digest);
    expect(request.version).toBe("2.0.0");
    const revision = {
      ...source,
      content_digest: "b".repeat(64),
      status: "DRAFT",
      supersedes_ref: {
        content_digest: source?.content_digest,
        goal_id: source?.goal_id,
        tenant_id: source?.tenant_id,
        version: source?.version
      },
      version: "2.0.0"
    };
    goals = [...goals, revision];
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(envelope(revision))
    });
  });
  await page.route("**/api/v1/bff/teacher/rubrics/drafts", async (route) => {
    const rubric = {
      content_digest: "c".repeat(64),
      rubric_id: "rubric_market_reasoning",
      scoring_policy: "NOT_ACTIVE_D1",
      status: "DRAFT",
      title: "Market reasoning",
      version: "1.0.0"
    };
    rubrics = [rubric];
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(envelope(rubric))
    });
  });
  await page.route(
    "**/api/v1/bff/teacher/rubrics/rubric_market_reasoning/versions/1.0.0/validate",
    async (route) => {
      const rubric = rubrics.find((item) => item.version === "1.0.0");
      if (rubric) rubric.status = "VALIDATED";
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(envelope(rubric))
      });
    }
  );
  await page.route(
    "**/api/v1/bff/teacher/rubrics/rubric_market_reasoning/versions/1.0.0/publish",
    async (route) => {
      const rubric = rubrics.find((item) => item.version === "1.0.0");
      if (rubric) rubric.status = "PUBLISHED";
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(envelope(rubric))
      });
    }
  );
  await page.route("**/api/v1/bff/teacher/rubrics/revisions", async (route) => {
    const request = route.request().postDataJSON() as {
      source_reference: { content_digest: string; version: string };
      version: string;
    };
    const source = rubrics.find((item) => item.version === "1.0.0");
    expect(request.source_reference.version).toBe("1.0.0");
    expect(request.source_reference.content_digest).toBe(source?.content_digest);
    expect(request.version).toBe("2.0.0");
    const revision = {
      ...source,
      content_digest: "d".repeat(64),
      status: "DRAFT",
      version: "2.0.0"
    };
    rubrics = [...rubrics, revision];
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(envelope(revision))
    });
  });
  await page.route(
    "**/api/v1/bff/teacher/rubrics/rubric_market_reasoning/versions/2.0.0/reject",
    async (route) => {
      const rubric = rubrics.find((item) => item.version === "2.0.0");
      if (rubric) rubric.status = "REJECTED";
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(envelope(rubric))
      });
    }
  );
  await page.goto(teacherBaseUrl);
  await signIn(page);
  await page.getByRole("button", { name: "Open D1 Workbench" }).click();
  await expect(
    page.getByLabel("D1 Learning Goal and Rubric").getByRole("heading", {
      name: "Learning Goals & Rubrics"
    })
  ).toBeVisible();
  await page
    .getByLabel("D1 CoursePackageVersion")
    .selectOption("course_package_d1_alternate:1.0.0");
  await page.getByRole("button", { name: "Create Goal DRAFT" }).click();
  await expect(page.getByText("DRAFT", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Validate" }).click();
  await expect(page.getByText("VALIDATED", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("PUBLISHED", { exact: true })).toBeVisible();
  await expect(page.getByText(/digest a{64}/)).toBeVisible();
  await page.getByLabel("D1 revision version").fill("2.0.0");
  await page.getByRole("button", { name: "Create Goal Revision" }).click();
  await expect(page.getByText("goal_measure_market / 2.0.0")).toBeVisible();
  await page.getByRole("button", { name: "Create Rubric DRAFT" }).click();
  await expect(page.getByText("rubric_market_reasoning / 1.0.0")).toBeVisible();
  await page.getByRole("button", { name: "Validate Rubric" }).click();
  await expect(page.getByText("VALIDATED", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Publish Rubric" }).click();
  await expect(page.getByText("Scoring policy: NOT_ACTIVE_D1")).toBeVisible();
  await page.getByLabel("D1 revision version").fill("2.0.0");
  await page.getByRole("button", { name: "Create Rubric Revision" }).click();
  await page.getByRole("button", { name: "Reject Rubric" }).click();
  await expect(page.getByText("REJECTED", { exact: true })).toBeVisible();
  await expect(page.getByText("Scoring policy: NOT_ACTIVE_D1").first()).toBeVisible();
});
