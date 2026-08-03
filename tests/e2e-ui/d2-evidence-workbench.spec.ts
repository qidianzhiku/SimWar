import { expect, test } from "@playwright/test";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const digest = "a".repeat(64);

function envelope<T>(data: T) {
  return { code: "OK", data, message: "success", request_id: "d2-browser-request" };
}

function exactRef(resourceType: string, resourceId: string, version: string) {
  return {
    content_digest: digest,
    discriminator: "exact_ref",
    resource_id: resourceId,
    resource_type: resourceType,
    tenant_id: "tenant_demo",
    version
  };
}

test("Teacher captures and inspects safe D2 evidence without private payload", async ({ page }) => {
  const sourceRef = exactRef("role_workflow_event", "event_d2_browser", "1");
  const artifact = {
    artifact_digest: digest,
    artifact_kind: "observation",
    artifact_ref: exactRef("evidence_artifact", "artifact_d2_browser", "1"),
    captured_at: "2026-08-03T07:00:00.000Z",
    captured_by: "usr_teacher",
    context: { activity_id: "activity_d2", course_id: "course_demo", role_key: "CEO", run_id: "run_d2", team_id: "team_alpha" },
    course_package_ref: exactRef("course_package_version", "pkg_demo", "1.0.0"),
    discriminator: "d2_evidence_artifact_version",
    idempotency_key: "idempotency_d2_browser",
    known_limits: ["JSON_INTERNAL_ONLY"],
    learning_goal_ref: exactRef("learning_goal_version", "goal_demo", "1.0.0"),
    rubric_ref: exactRef("rubric_version", "rubric_demo", "1.0.0"),
    schema_version: "evidence-provenance.v1",
    source_event_ref: sourceRef,
    transformation_rule_ref: exactRef("transformation_rule", "d2_observation_v1", "1"),
    visibility: "teacher_only"
  };
  const packageVersion = {
    course_blueprint_reference: { content_digest: digest, course_blueprint_id: "blueprint_demo", tenant_id: "tenant_demo", version: "1.0.0" },
    course_package_reference: { content_digest: digest, course_package_id: "pkg_demo", tenant_id: "tenant_demo", version: "1.0.0" },
    description: "D2 browser package",
    parameter_set_reference: { content_digest: digest, parameter_set_id: "params_demo", tenant_id: "tenant_demo", version: "1.0.0" },
    scenario_package_reference: { content_digest: digest, scenario_package_id: "scenario_demo", tenant_id: "tenant_demo", version: "1.0.0" },
    title: "D2 Browser Package"
  };
  const goal = {
    activity_refs: [{ activity_id: "activity_d2", content_digest: digest, version: "1.0.0" }],
    content_digest: digest,
    course_package_reference: { content_digest: digest, course_package_id: "pkg_demo", tenant_id: "tenant_demo", version: "1.0.0" },
    created_at: "2026-08-03T07:00:00.000Z",
    created_by: "usr_teacher",
    expected_evidence_classes: ["observation"],
    goal_id: "goal_demo",
    observable_behaviors: ["observe"],
    role_scope: ["CEO"],
    schema_version: "learning-design.v1",
    statement: "Observe a bounded activity.",
    status: "PUBLISHED",
    tenant_id: "tenant_demo",
    title: "D2 Goal",
    version: "1.0.0"
  };
  const rubric = {
    content_digest: digest,
    course_package_reference: { content_digest: digest, course_package_id: "pkg_demo", tenant_id: "tenant_demo", version: "1.0.0" },
    created_at: "2026-08-03T07:00:00.000Z",
    created_by: "usr_teacher",
    criteria: [],
    learning_goal_references: [{ content_digest: digest, goal_id: "goal_demo", tenant_id: "tenant_demo", version: "1.0.0" }],
    rubric_id: "rubric_demo",
    schema_version: "learning-design.v1",
    scoring_policy: "NOT_ACTIVE_D1",
    status: "PUBLISHED",
    tenant_id: "tenant_demo",
    title: "D2 Rubric",
    version: "1.0.0"
  };

  await page.route("**/api/v1/bff/teacher/course-package-versions", (route) => route.fulfill({ json: envelope({ course_package_versions: [packageVersion] }) }));
  await page.route("**/api/v1/bff/teacher/learning-designs", (route) => route.fulfill({ json: envelope({ explicit_non_proofs: [], learning_goals: [goal], rubrics: [rubric], runtime_authority: "JSON_INTERNAL_ONLY" }) }));
  let captured = false;
  await page.route("**/api/v1/bff/teacher/evidence?*", (route) => route.fulfill({ json: envelope({ artifacts: captured ? [artifact] : [], eligible_events: [{ created_at: "2026-08-03T07:00:00.000Z", event_id: "event_d2_browser", event_type: "section_ready", eligibility: "eligible", scope: { course_id: "course_demo", role_key: "CEO", run_id: "run_d2", team_id: "team_alpha" }, source_event_ref: sourceRef }], known_limits: ["JSON_INTERNAL_ONLY"], provenance_edges: captured ? [{ discriminator: "d2_provenance_edge", relation: "derived_from", source_ref: sourceRef, target_ref: artifact.artifact_ref }] : [], runtime_authority: "JSON_INTERNAL_ONLY" }) }));
  await page.route("**/api/v1/bff/teacher/evidence-artifacts/capture", async (route) => {
    captured = true;
    await route.fulfill({ json: envelope({ data: { artifact, provenance_edges: [{ discriminator: "d2_provenance_edge", relation: "derived_from", source_ref: sourceRef, target_ref: artifact.artifact_ref }], status: "generated" }, formal_truth_write: false, known_limits: ["JSON_INTERNAL_ONLY"], request_id: "capture_d2_browser", schema_version: "evidence-provenance.v1" }) });
  });

  await page.goto(teacherBaseUrl);
  const login = page.getByLabel("teacher login");
  await login.getByLabel("tenant").fill("tenant_demo");
  await login.getByLabel("username").fill("teacher");
  await login.getByLabel("password").fill("teacher");
  await login.getByRole("button", { name: "教师登录" }).click();

  const workbench = page.getByLabel("Teacher D2 Evidence Workbench");
  await expect(workbench).toBeVisible();
  await workbench.getByRole("button", { name: "Load exact references" }).click();
  await workbench.getByLabel("D2 course_id").fill("course_demo");
  await workbench.getByLabel("D2 run_id").fill("run_d2");
  await workbench.getByLabel("D2 team_id").fill("team_alpha");
  await workbench.getByLabel("D2 role_key").fill("CEO");
  await workbench.getByLabel("D2 activity_id").fill("activity_d2");
  await workbench.getByLabel("D2 exact course package").selectOption("pkg_demo:1.0.0");
  await workbench.getByLabel("D2 exact learning goal").selectOption("goal_demo:1.0.0");
  await workbench.getByLabel("D2 exact rubric").selectOption("rubric_demo:1.0.0");
  await workbench.getByRole("button", { name: "Load eligible events" }).click();
  await workbench.getByLabel("D2 eligible source event").selectOption("event_d2_browser");
  await workbench.getByRole("button", { name: "Generate Evidence" }).click();

  await expect(workbench.getByText("Evidence generated")).toBeVisible();
  await expect(workbench.getByText("teacher_only")).toBeVisible();
  await expect(workbench.getByText("private_payload")).toHaveCount(0);
  await expect(workbench.getByText("formal_truth_write: false")).toBeVisible();
  await workbench.getByLabel("D2 course_id").fill("course_changed");
  await expect(workbench.getByText("Scope or exact reference changed. Reload before capture.")).toBeVisible();
  await expect(workbench.getByRole("button", { name: "Generate Evidence" })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});
