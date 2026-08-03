import { expect, test, type Page } from "@playwright/test";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const digest = "a".repeat(64);

function envelope<T>(data: T) {
  return { code: "OK", data, message: "success", request_id: "d3-browser-request" };
}

function exactRef(resource_type: string, resource_id: string, version = "1.0.0") {
  return {
    content_digest: digest,
    discriminator: "exact_ref",
    resource_id,
    resource_type,
    tenant_id: "tenant_demo",
    version
  };
}

async function signIn(page: Page) {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill("teacher");
  await page.getByLabel("password").fill("teacher");
  await page.getByRole("button", { name: "教师登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

test("Teacher can see D3 exact-reference and confirmation states without student exposure", async ({
  page
}) => {
  await page.route("**/api/v1/bff/teacher/confirmations", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: {
          confirmations: [],
          known_limits: ["teacher-only"],
          runtime_authority: "JSON_INTERNAL_ONLY"
        },
        message: "success",
        request_id: "d3-list"
      })
    });
  });
  await page.route("**/api/v1/bff/teacher/course-package-versions", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: { course_package_versions: [] },
        message: "success",
        request_id: "d3-packages"
      })
    });
  });
  await page.route("**/api/v1/bff/teacher/learning-designs", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: {
          explicit_non_proofs: [],
          learning_goals: [],
          rubrics: [],
          runtime_authority: "JSON_INTERNAL_ONLY"
        },
        message: "success",
        request_id: "d3-design"
      })
    });
  });
  await page.goto(teacherBaseUrl);
  await signIn(page);
  const workbench = page.getByLabel("Teacher D3 Confirmation Workbench");
  await expect(workbench).toBeVisible();
  await expect(workbench.getByLabel("D3 exact course package")).toBeVisible();
  await expect(workbench.getByLabel("D3 exact learning goal")).toBeVisible();
  await expect(workbench.getByLabel("D3 exact rubric")).toBeVisible();
  await expect(page.getByLabel("Student D3 Confirmation Workbench")).toHaveCount(0);
});

test("Teacher claims, drafts, rejects and revises an immutable confirmation", async ({ page }) => {
  const packageVersion = {
    course_blueprint_reference: {
      content_digest: digest,
      course_blueprint_id: "blueprint_demo",
      tenant_id: "tenant_demo",
      version: "1.0.0"
    },
    course_package_reference: {
      content_digest: digest,
      course_package_id: "pkg_demo",
      tenant_id: "tenant_demo",
      version: "1.0.0"
    },
    description: "D3 browser package",
    parameter_set_reference: {
      content_digest: digest,
      parameter_set_id: "params_demo",
      tenant_id: "tenant_demo",
      version: "1.0.0"
    },
    scenario_package_reference: {
      content_digest: digest,
      scenario_package_id: "scenario_demo",
      tenant_id: "tenant_demo",
      version: "1.0.0"
    },
    title: "D3 Browser Package"
  };
  const goal = {
    activity_refs: [{ activity_id: "activity_d3", content_digest: digest, version: "1.0.0" }],
    content_digest: digest,
    course_package_reference: {
      content_digest: digest,
      course_package_id: "pkg_demo",
      tenant_id: "tenant_demo",
      version: "1.0.0"
    },
    created_at: "2026-08-03T07:00:00.000Z",
    created_by: "usr_teacher",
    expected_evidence_classes: ["observation"],
    goal_id: "goal_demo",
    observable_behaviors: ["observe"],
    role_scope: ["marketing"],
    schema_version: "learning-design.v1",
    statement: "Observe a bounded activity.",
    status: "PUBLISHED",
    tenant_id: "tenant_demo",
    title: "D3 Goal",
    version: "1.0.0"
  };
  const rubric = {
    content_digest: digest,
    course_package_reference: {
      content_digest: digest,
      course_package_id: "pkg_demo",
      tenant_id: "tenant_demo",
      version: "1.0.0"
    },
    created_at: "2026-08-03T07:00:00.000Z",
    created_by: "usr_teacher",
    criteria: [
      {
        criterion_id: "criterion_demo",
        levels: [{ description: "Bounded", label: "Bounded", ordinal: 1 }]
      }
    ],
    learning_goal_references: [
      { content_digest: digest, goal_id: "goal_demo", tenant_id: "tenant_demo", version: "1.0.0" }
    ],
    rubric_id: "rubric_demo",
    schema_version: "learning-design.v1",
    scoring_policy: "NOT_ACTIVE_D1",
    status: "PUBLISHED",
    tenant_id: "tenant_demo",
    title: "D3 Rubric",
    version: "1.0.0"
  };
  const artifact = {
    artifact_digest: digest,
    artifact_kind: "observation",
    artifact_ref: exactRef("evidence_artifact", "artifact_demo"),
    captured_at: "2026-08-03T07:00:00.000Z",
    captured_by: "usr_teacher",
    context: {
      activity_id: "activity_d3",
      course_id: "course_demo",
      role_key: "marketing",
      run_id: "run_d3",
      team_id: "team_demo"
    },
    course_package_ref: exactRef("course_package_version", "pkg_demo"),
    discriminator: "d2_evidence_artifact_version",
    idempotency_key: "evidence_demo",
    known_limits: ["JSON_INTERNAL_ONLY"],
    learning_goal_ref: exactRef("learning_goal_version", "goal_demo"),
    rubric_ref: exactRef("rubric_version", "rubric_demo"),
    schema_version: "evidence-provenance.v1",
    source_event_ref: exactRef("role_workflow_event", "event_demo", "1"),
    transformation_rule_ref: exactRef("transformation_rule", "d2_observation_v1", "1"),
    visibility: "teacher_only"
  };
  const baseConfirmation = (status: "DRAFT" | "REJECTED", version: string, reason?: string) => ({
    audit_receipt: {
      action:
        status === "REJECTED" ? "teacher_confirmation.reject" : "teacher_confirmation.draft_save",
      actor_id: "usr_teacher",
      audit_id: `audit_${version}`,
      recorded_at: "2026-08-03T07:00:00.000Z",
      request_id: `req_${version}`
    },
    confirmation_ref: exactRef("teacher_confirmation_version", "confirmation_demo", version),
    content_digest: digest,
    context: {
      course_id: "course_demo",
      role_key: "marketing",
      run_id: "run_d3",
      team_id: "team_demo"
    },
    course_package_ref: exactRef("course_package_version", "pkg_demo"),
    created_at: "2026-08-03T07:00:00.000Z",
    created_by: "usr_teacher",
    criterion_decisions: [{ criterion_id: "criterion_demo", level_ordinal: 1 }],
    discriminator: "teacher_confirmation_version",
    evidence_refs: [exactRef("evidence_artifact", "artifact_demo")],
    idempotency_key: "confirmation_idem",
    known_limits: ["D3 is teacher-only and not final grading."],
    learning_goal_ref: exactRef("learning_goal_version", "goal_demo"),
    rubric_ref: exactRef("rubric_version", "rubric_demo"),
    schema_version: "teacher-confirmation.v1",
    status,
    teacher_feedback: "Bounded teacher feedback.",
    ...(reason ? { rejection_reason: reason } : {})
  });
  const draft = baseConfirmation("DRAFT", "1.0.0");
  const rejected = baseConfirmation("REJECTED", "2.0.0", "Evidence needs a clearer source.");
  const revised = baseConfirmation("DRAFT", "3.0.0");
  const confirmed = {
    ...revised,
    audit_receipt: { ...revised.audit_receipt, action: "teacher_confirmation.confirm" },
    confirmation_ref: { ...revised.confirmation_ref, version: "4.0.0" },
    status: "CONFIRMED" as const,
    supersedes_ref: revised.confirmation_ref
  };

  await page.route("**/api/v1/bff/teacher/confirmations", (route) =>
    route.fulfill({
      json: envelope({
        confirmations: [],
        known_limits: ["teacher-only"],
        runtime_authority: "JSON_INTERNAL_ONLY"
      })
    })
  );
  await page.route("**/api/v1/bff/teacher/course-package-versions", (route) =>
    route.fulfill({ json: envelope({ course_package_versions: [packageVersion] }) })
  );
  await page.route("**/api/v1/bff/teacher/learning-designs", (route) =>
    route.fulfill({
      json: envelope({
        explicit_non_proofs: [],
        learning_goals: [goal],
        rubrics: [rubric],
        runtime_authority: "JSON_INTERNAL_ONLY"
      })
    })
  );
  await page.route("**/api/v1/bff/teacher/evidence?*", (route) =>
    route.fulfill({
      json: envelope({
        artifacts: [artifact],
        eligible_events: [],
        known_limits: ["JSON_INTERNAL_ONLY"],
        provenance_edges: [],
        runtime_authority: "JSON_INTERNAL_ONLY"
      })
    })
  );
  await page.route("**/api/v1/bff/teacher/confirmations/claims", (route) =>
    route.fulfill({
      json: envelope({
        claim: {
          claim_id: "claim_demo",
          tenant_id: "tenant_demo",
          context: {
            course_id: "course_demo",
            run_id: "run_d3",
            team_id: "team_demo",
            role_key: "marketing"
          },
          evidence_set_digest: digest,
          claimed_by: "usr_teacher",
          claimed_at: "2026-08-03T07:00:00.000Z",
          expires_at: "2026-08-03T08:00:00.000Z",
          status: "CLAIMED"
        },
        known_limits: ["non-durable"]
      })
    })
  );
  await page.route("**/api/v1/bff/teacher/confirmations/drafts", async (route) => {
    expect(route.request().postDataJSON().confirmation_id).toBe("confirmation_demo");
    await route.fulfill({
      json: envelope({
        data: { confirmation: draft, status: "generated" },
        known_limits: ["teacher-only"],
        runtime_authority: "JSON_INTERNAL_ONLY"
      })
    });
  });
  await page.route(
    "**/api/v1/bff/teacher/confirmations/confirmation_demo/reject",
    async (route) => {
      expect(route.request().postDataJSON().rejection_reason).toContain("clearer");
      await route.fulfill({
        json: envelope({
          data: {
            confirmation: rejected,
            known_limits: ["teacher-only"],
            runtime_authority: "JSON_INTERNAL_ONLY"
          },
          known_limits: ["teacher-only"]
        })
      });
    }
  );
  await page.route("**/api/v1/bff/teacher/confirmations/confirmation_demo/revise", (route) =>
    route.fulfill({
      json: envelope({
        data: { confirmation: revised, status: "generated" },
        known_limits: ["teacher-only"],
        runtime_authority: "JSON_INTERNAL_ONLY"
      })
    })
  );
  await page.route("**/api/v1/bff/teacher/confirmations/confirmation_demo/confirm", (route) =>
    route.fulfill({
      json: envelope({
        data: {
          confirmation: confirmed,
          known_limits: ["teacher-only"],
          runtime_authority: "JSON_INTERNAL_ONLY"
        },
        known_limits: ["teacher-only"]
      })
    })
  );

  await page.goto(teacherBaseUrl);
  await signIn(page);
  const workbench = page.getByLabel("Teacher D3 Confirmation Workbench");
  await expect(workbench).toBeVisible();
  await workbench.getByRole("button", { name: "Refresh exact references" }).click();
  await workbench.getByLabel("D3 course_id").fill("course_demo");
  await workbench.getByLabel("D3 run_id").fill("run_d3");
  await workbench.getByLabel("D3 team_id").fill("team_demo");
  await workbench.getByLabel("D3 role_key").fill("marketing");
  await workbench.getByLabel("D3 activity_id").fill("activity_d3");
  await workbench.getByLabel("D3 confirmation id").fill("confirmation_demo");
  await workbench.getByLabel("D3 exact course package").selectOption(`pkg_demo:1.0.0:${digest}`);
  await workbench.getByLabel("D3 exact learning goal").selectOption("goal_demo:1.0.0");
  await workbench.getByLabel("D3 exact rubric").selectOption("rubric_demo:1.0.0");
  await workbench.getByRole("button", { name: "Load scoped evidence" }).click();
  await workbench.getByRole("button", { name: "Claim work item" }).click();
  await workbench.getByLabel("D3 exact evidence").selectOption({ index: 1 });
  await workbench.getByLabel("D3 rubric criterion").selectOption("criterion_demo");
  await workbench.getByLabel("D3 rubric level").selectOption("1");
  await workbench.getByRole("button", { name: "Save immutable draft" }).click();
  await expect(workbench.getByText("Draft saved.")).toBeVisible();
  await workbench.getByLabel("D3 rejection reason").fill("Evidence needs a clearer source.");
  await workbench.getByRole("button", { name: "Reject version" }).click();
  await expect(workbench.getByText("Rejected version appended.")).toBeVisible();
  await workbench.getByRole("button", { name: "Revise as new draft" }).click();
  await expect(workbench.getByText("Draft saved.")).toBeVisible();
  await workbench.getByRole("button", { name: "Confirm version" }).click();
  await expect(workbench.getByText("Confirmed version appended.")).toBeVisible();
  await expect(workbench.getByText(/REJECTED/)).toBeVisible();
});
