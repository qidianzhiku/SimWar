import { expect, test, type Page } from "@playwright/test";
import { cleanupPlaywrightStore } from "./store-isolation";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;

test.afterAll(() => {
  cleanupPlaywrightStore();
});

async function signIn(page: Page, buttonName: "教师登录" | "学员登录", username: string) {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill(username);
  await page.getByLabel("password").fill(username);
  await page.getByRole("button", { name: buttonName }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

async function openScenarioReadinessPanel(page: Page) {
  const initialState = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/demo-state") &&
      response.request().method() === "GET" &&
      response.status() === 200
  );

  await page.goto(teacherBaseUrl);
  await signIn(page, "教师登录", "teacher");
  await initialState;

  const runStatus = page.getByRole("region", { name: "M1 run status" });
  await expect(runStatus.getByText("M1 康养教学闭环课程")).toBeVisible();

  const primaryAction = page.locator("header.topbar > button.primary");
  await expect(primaryAction).toBeVisible();
  const actionLabel = (await primaryAction.textContent())?.trim();
  await test.info().attach("scenario-readiness-workspace-state.json", {
    body: JSON.stringify({ actionLabel }),
    contentType: "application/json"
  });

  if (actionLabel === "创建 Run") {
    const createdState = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/demo-state") &&
        response.request().method() === "GET" &&
        response.status() === 200
    );
    await primaryAction.click();
    await expect(page.getByText("run created")).toBeVisible();
    await createdState;
  }

  const panel = page.getByLabel("scenario readiness");
  await expect(panel).toBeVisible();
  return panel;
}

test("Teacher checks scenario readiness through the read-only BFF without a tenant header", async ({
  page
}) => {
  const consoleMessages: string[] = [];
  page.on("console", (message) => consoleMessages.push(message.text()));

  const panel = await openScenarioReadinessPanel(page);
  await panel.getByRole("button", { name: "Check readiness" }).click();
  await expect(panel.getByText("Scenario Package ID is required.")).toBeVisible();
  await panel.getByLabel("scenario package id").fill("scenario_eldercare_demo");
  await panel.getByLabel("parameter set id").fill("param_toy_approved_1");

  const readinessRequest = page.waitForRequest((request) =>
    request.url().includes("/scenario-selection-readiness")
  );
  await panel.getByRole("button", { name: "Check readiness" }).click();
  const request = await readinessRequest;

  expect(request.method()).toBe("GET");
  expect(request.headers()["x-tenant-id"]).toBeUndefined();
  expect(request.url()).toContain("scenarioPackageId=scenario_eldercare_demo");
  expect(request.url()).toContain("parameterSetId=param_toy_approved_1");

  await expect(panel.locator(".readiness-result > strong")).toHaveText("READY");
  await expect(panel.getByText("COMPATIBLE_BY_REFERENCE_ONLY")).toBeVisible();
  await expect(panel.getByText("Known limits")).toBeVisible();
  await expect(
    panel.locator(".readiness-result").getByText("SCENARIO_RUNTIME_NOT_ACTIVATED")
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: /Activate|Launch|Replay|Publish|Settlement/i })
  ).toHaveCount(0);

  const privateMarkers = [
    "state_true",
    "canonical_evidence_digest",
    "decision_batch_hash",
    "ReplayManifest",
    "base_market_size"
  ];
  const panelText = await panel.innerText();
  for (const marker of privateMarkers) {
    expect(panelText).not.toContain(marker);
    expect(consoleMessages.join("\n")).not.toContain(marker);
  }

  await page.route(/\/scenario-selection-readiness\?/, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        operation_id: "R7_TEACHER_SCENARIO_SELECTION_READINESS_GET_V1",
        tenant_id: "tenant_demo",
        course_id: "course_demo",
        run_id: "run_demo",
        scenario_package_id: "scenario_eldercare_demo",
        parameter_set_id: "param_toy_approved_1",
        eligible: false,
        readiness_status: "BLOCKED",
        compatibility_status: "COMPATIBLE_BY_REFERENCE_ONLY",
        provenance_status: "INTERNAL_SYNTHETIC_ONLY",
        qa_status: "DRAFT_REVIEW_REQUIRED",
        license_status: "EXTERNAL_LICENSE_REVIEW_REQUIRED_BEFORE_RELEASE",
        calibration_status: "DRAFT_REGISTER_ONLY",
        runtime_adapter_status: "PREPARATION_PACKAGE_ONLY",
        no_go_reasons: ["R7_BFF_PARAMETER_SET_NOT_APPROVED"],
        evidence_freshness: { collected_at: null, expires_at: null, is_expired: false },
        explicit_non_proofs: ["SCENARIO_RUNTIME_NOT_ACTIVATED"]
      })
    });
  });
  await panel.getByRole("button", { name: "Check readiness" }).click();
  await expect(panel.locator(".readiness-result > strong")).toHaveText("BLOCKED");
  await expect(panel.getByText("R7_BFF_PARAMETER_SET_NOT_APPROVED")).toBeVisible();

  await page.unroute(/\/scenario-selection-readiness\?/);
  await page.route(/\/scenario-selection-readiness\?/, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 404,
      body: JSON.stringify({
        error: {
          code: "R7_BFF_SCENARIO_SELECTION_CONTEXT_NOT_FOUND",
          message: "scenario selection context not found",
          correlation_id: "req_browser"
        }
      })
    });
  });
  await panel.getByRole("button", { name: "Check readiness" }).click();
  await expect(panel.getByText("Readiness is unavailable or out of scope.")).toBeVisible();
});

test("Teacher prepares a server-derived binding preview before creating a formal Course", async ({
  page
}, testInfo) => {
  const nonce = `${testInfo.workerIndex}-${testInfo.retry}-${Date.now().toString(36)}`;
  const ids = {
    approvalId: `approval_browser_c1_${nonce}`,
    blueprintId: `blueprint_browser_c1_${nonce}`,
    courseId: `course_browser_c1_${nonce}`,
    roundId: `round_browser_c1_${nonce}`,
    runId: `run_browser_c1_${nonce}`,
    scenarioId: `scenario_browser_c1_${nonce}`,
    seed: 20260729 + testInfo.retry,
    teamId: `team_browser_c1_${nonce}`
  };
  const interceptedMutations: string[] = [];
  const serverRunCounts: number[] = [];
  let isolatedWorkspaceRunCreated = false;
  expect(interceptedMutations).toEqual([]);
  await test.info().attach("c1-isolation-identities.json", {
    body: JSON.stringify(ids),
    contentType: "application/json"
  });
  await page.route(/\/api\/v1\/demo-state$/, async (route) => {
    const response = await route.fetch();
    const envelope = (await response.json()) as {
      data: {
        rounds: Array<Record<string, unknown>>;
        runs: Array<Record<string, unknown>>;
      };
    };
    serverRunCounts.push(envelope.data.runs.length);
    if (isolatedWorkspaceRunCreated) {
      envelope.data.runs = [
        ...envelope.data.runs,
        {
          course_id: "course_demo",
          parameter_set_id: "param_toy_approved_1",
          run_id: ids.runId,
          scenario_package_id: "scenario_eldercare_demo",
          seed: ids.seed,
          status: "active",
          tenant_id: "tenant_demo"
        }
      ];
      envelope.data.rounds = [
        ...envelope.data.rounds,
        {
          round_id: ids.roundId,
          round_no: 1,
          run_id: ids.runId,
          status: "draft",
          tenant_id: "tenant_demo"
        }
      ];
    }
    await route.fulfill({ response, json: envelope });
  });
  await page.route(/\/api\/v1\/courses\/course_demo\/runs$/, async (route) => {
    isolatedWorkspaceRunCreated = true;
    interceptedMutations.push("workspace.run.create");
    await route.fulfill({
      contentType: "application/json",
      status: 201,
      body: JSON.stringify({
        data: {
          round: {
            round_id: ids.roundId,
            round_no: 1,
            run_id: ids.runId,
            status: "draft",
            tenant_id: "tenant_demo"
          },
          run: {
            course_id: "course_demo",
            parameter_set_id: "param_toy_approved_1",
            run_id: ids.runId,
            scenario_package_id: "scenario_eldercare_demo",
            seed: ids.seed,
            status: "active",
            tenant_id: "tenant_demo"
          }
        }
      })
    });
  });
  await page.route(
    /\/api\/v1\/bff\/teacher\/runs\/[^/]+\/rounds\/1\/workspace$/,
    async (route) => {
      interceptedMutations.push("workspace.read");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            course_workspace: {
              evidence_label: "TEACHER_PROJECTION_EVIDENCE",
              visible_state: {
                course_title: "M1 康养教学闭环课程",
                run_status: "active"
              }
            },
            round_control: {
              status: "draft",
              visible_state: {
                decision_count: 0,
                settlement_available: false,
                team_count: 1
              }
            },
            teacher_dashboard: {
              allowed_actions: [],
              evidence_label: "BFF_DTO_PRODUCTIZATION",
              visible_state: {
                course_status: "active",
                round_status: "draft",
                team_count: 1
              }
            },
            teacher_replay_summary: {
              formal_truth_write_allowed: false,
              redacted_fields: [],
              visible_state: {
                result_count: 0,
                runtime_boundary: "current_json_active_runtime"
              }
            },
            team_monitor: {
              teams: [],
              visible_state: {
                decision_count: 0,
                team_count: 1
              }
            }
          }
        })
      });
    }
  );
  const catalogRequests: Array<{ headers: Record<string, string>; method: string }> = [];
  page.on("request", (request) => {
    if (request.url().includes("/formal-scenario-package-catalog")) {
      catalogRequests.push({ headers: request.headers(), method: request.method() });
    }
  });
  await page.route(/\/formal-scenario-package-catalog$/, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        operation_id: "TEACHER_FORMAL_SCENARIO_PACKAGE_CATALOG_GET_V1",
        candidates: [
          {
            scenario_package_reference: {
              tenant_id: "tenant_demo",
              scenario_package_id: ids.scenarioId,
              version: "1.0.0",
              content_digest: "a".repeat(64)
            },
            parameter_set_reference: {
              parameter_set_id: "parameter_formal_eldercare_shanghai",
              version: "1.0.0",
              content_digest: "b".repeat(64)
            },
            status: "APPROVED",
            schema_version: "scenario-package.v1",
            compatibility_metadata: { engine: "simulation-core.v1" },
            plugin_dependencies: [{ plugin_package_id: "wellness", version: "1.0.0" }]
          }
        ],
        explicit_non_proofs: [
          "FORMAL_CATALOG_READ_ONLY",
          "LOCAL_DRAFT_SELECTION_DOES_NOT_BIND_A_RUN"
        ]
      })
    });
  });
  await page.route(/\/formal-course-bindings\/preview$/, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          engine_profile: {
            engine_id: "toy_logit_wellness_v1",
            model_version_ref: "toy_logit_wellness_v1@0.1.0",
            runtime_authority: "JSON_INTERNAL_ONLY",
            version: "0.1.0"
          },
          parameter_set_reference: {
            parameter_set_id: "parameter_formal_eldercare_shanghai",
            version: "1.0.0",
            content_digest: "b".repeat(64)
          },
          plugin_dependencies: [{ plugin_package_id: "wellness", version: "1.0.0" }],
          scenario_package_reference: {
            tenant_id: "tenant_demo",
            scenario_package_id: ids.scenarioId,
            version: "1.0.0",
            content_digest: "a".repeat(64)
          },
          selection_status: "READY"
        }
      })
    });
  });
  await page.route(/\/course-blueprints$/, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          operation_id: "TEACHER_COURSE_BLUEPRINT_CATALOG_V1",
          candidates: [{
            compatibility_constraints: { scenario_family: "wellness" },
            content_digest_summary: "c".repeat(12),
            course_blueprint_reference: { tenant_id: "tenant_demo", course_blueprint_id: ids.blueprintId, version: "1.0.0", content_digest: "c".repeat(64) },
            duration_minutes: 60,
            objectives_summary: ["Run the course"],
            phases_summary: [{ duration_minutes: 60, order: 1, title: "Briefing" }],
            status: "APPROVED",
            title: "Browser C1 Blueprint"
          }]
        }
      })
    });
  });
  await page.route(/\/course-blueprints\/readiness$/, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: {
        operation_id: "TEACHER_COURSE_BLUEPRINT_READINESS_V1",
        selection_status: "READY",
        blueprint: { course_blueprint_reference: { tenant_id: "tenant_demo", course_blueprint_id: ids.blueprintId, version: "1.0.0", content_digest: "c".repeat(64) }, title: "Browser C1 Blueprint", duration_minutes: 60, objectives_summary: ["Run the course"], phases_summary: [], compatibility_constraints: {}, content_digest_summary: "c".repeat(12), status: "APPROVED" },
        formal_course_binding: { engine_profile: { engine_id: "toy_logit_wellness_v1", model_version_ref: "toy_logit_wellness_v1@0.1.0", runtime_authority: "JSON_INTERNAL_ONLY", version: "0.1.0" }, parameter_set_reference: { parameter_set_id: "parameter_formal_eldercare_shanghai", version: "1.0.0", content_digest: "b".repeat(64) }, plugin_dependencies: [], scenario_package_reference: { tenant_id: "tenant_demo", scenario_package_id: ids.scenarioId, version: "1.0.0", content_digest: "a".repeat(64) }, selection_status: "READY" }
      } })
    });
  });
  await page.route(/\/course-blueprint-courses$/, async (route) => {
    interceptedMutations.push("course.create");
    await route.fulfill({
      contentType: "application/json",
      status: 201,
      body: JSON.stringify({ data: {
        operation_id: "TEACHER_COURSE_BLUEPRINT_COURSE_CREATE_V1",
        binding_summary: { course_blueprint_reference: { tenant_id: "tenant_demo", course_blueprint_id: ids.blueprintId, version: "1.0.0", content_digest: "c".repeat(64) } },
        formal_binding_summary: { engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" }, parameter_set_reference: { parameter_set_id: "parameter_formal_eldercare_shanghai", version: "1.0.0", content_digest: "b".repeat(64) }, scenario_package_reference: { tenant_id: "tenant_demo", scenario_package_id: ids.scenarioId, version: "1.0.0", content_digest: "a".repeat(64) } },
        course: { course_id: ids.courseId, created_by: "usr_teacher", parameter_set_id: "parameter_formal_eldercare_shanghai", scenario_package_id: ids.scenarioId, status: "draft", tenant_id: "tenant_demo", title: "Browser B5 Course" }
      } })
    });
  });
  await page.route(/\/formal-courses$/, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 201,
      body: JSON.stringify({
        data: {
          operation_id: "TEACHER_FORMAL_COURSE_CREATE_V1",
          binding_summary: {
            engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
            parameter_set_reference: {
              parameter_set_id: "parameter_formal_eldercare_shanghai",
              version: "1.0.0",
              content_digest: "b".repeat(64)
            },
            scenario_package_reference: {
              tenant_id: "tenant_demo",
              scenario_package_id: ids.scenarioId,
              version: "1.0.0",
              content_digest: "a".repeat(64)
            }
          },
          course: {
            course_id: ids.courseId,
            created_by: "usr_teacher",
            parameter_set_id: "parameter_formal_eldercare_shanghai",
            scenario_package_id: ids.scenarioId,
            status: "draft",
            tenant_id: "tenant_demo",
            title: "Browser B5 Course"
          }
        }
      })
    });
  });
  await page.route(new RegExp(`/courses/${ids.courseId}/publish$`), async (route) => {
    interceptedMutations.push("course.publish");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          course_id: ids.courseId,
          created_by: "usr_teacher",
          parameter_set_id: "parameter_formal_eldercare_shanghai",
          scenario_package_id: ids.scenarioId,
          status: "published",
          tenant_id: "tenant_demo",
          title: "Browser B5 Course"
        }
      })
    });
  });
  await page.route(new RegExp(`/courses/${ids.courseId}/runs$`), async (route) => {
    interceptedMutations.push("run.create");
    await route.fulfill({
      contentType: "application/json",
      status: 201,
      body: JSON.stringify({
        data: {
          run: {
            course_id: ids.courseId,
            parameter_set_id: "parameter_formal_eldercare_shanghai",
            run_id: ids.runId,
            scenario_package_id: ids.scenarioId,
            seed: ids.seed,
            status: "active",
            tenant_id: "tenant_demo"
          },
          round: {
            round_id: ids.roundId,
            round_no: 1,
            run_id: ids.runId,
            status: "draft",
            tenant_id: "tenant_demo"
          }
        }
      })
    });
  });

  const panel = await openScenarioReadinessPanel(page);
  const catalog = panel.getByLabel("formal ScenarioPackage catalog");
  await expect(catalog.getByText(ids.scenarioId)).toBeVisible();
  await catalog.getByRole("button", { name: "Prepare formal Course" }).click();

  const draft = catalog.getByLabel("formal ScenarioPackage Course selection");
  await expect(draft.getByText("Teacher selection preview")).toBeVisible();
  await expect(draft.getByText("toy_logit_wellness_v1")).toBeVisible();
  await expect(draft.getByText("JSON_INTERNAL_ONLY")).toBeVisible();
  await expect(draft.getByText("a".repeat(64))).toBeVisible();
  await expect(draft.getByText("b".repeat(64))).toBeVisible();
  const blueprintCatalog = panel.getByLabel("formal CourseBlueprint catalog");
  await expect(blueprintCatalog.getByText("Browser C1 Blueprint")).toBeVisible();
  await blueprintCatalog.getByRole("button", { name: "Select locally" }).click();
  await expect(blueprintCatalog.getByText("LOCAL_SELECTION_ONLY")).toBeVisible();
  await expect(blueprintCatalog.getByText("NO_COURSE_WRITE_YET")).toBeVisible();
  await draft.getByLabel("formal Course title").fill("Browser B5 Course");
  await draft.getByRole("button", { name: "Create formal Course" }).click();
  const runCreation = catalog.getByLabel("formal Run creation");
  await expect(runCreation).toContainText(ids.courseId);
  await runCreation.getByRole("button", { name: "Publish formal Course" }).click();
  await expect(runCreation.getByLabel("explicit Run seed")).toBeVisible();
  await runCreation.getByRole("button", { name: "Create formal Run" }).click();
  await expect(page.getByText("formal Run created")).toBeVisible();
  expect(catalogRequests).toEqual([
    expect.objectContaining({
      method: "GET",
      headers: expect.not.objectContaining({ "x-tenant-id": expect.any(String) })
    })
  ]);
  await expect(
    catalog.getByRole("button", { name: /Activate|Bind|Launch|Replay|Settlement/i })
  ).toHaveCount(0);

  await page.reload();
  await signIn(page, "教师登录", "teacher");
  const reloadedCatalog = page.getByLabel("formal ScenarioPackage catalog");
  await expect(reloadedCatalog).toBeVisible();
  await expect(reloadedCatalog.getByLabel("formal ScenarioPackage Course selection")).toHaveCount(
    0
  );
  expect(
    interceptedMutations.filter(
      (operation) => operation !== "workspace.run.create" && operation !== "workspace.read"
    )
  ).toEqual(["course.create", "course.publish", "run.create"]);
  expect(interceptedMutations).toContain("workspace.read");
  expect(new Set(serverRunCounts).size).toBe(1);
  await test.info().attach("c1-browser-residue.json", {
    body: JSON.stringify({
      approval_id: ids.approvalId,
      intercepted_mutations: interceptedMutations,
      server_persistence: "NONE_ALL_C1_MUTATIONS_ROUTE_ISOLATED",
      server_run_counts: serverRunCounts,
      team_id: ids.teamId
    }),
    contentType: "application/json"
  });
  await page.unrouteAll({ behavior: "wait" });
});

test("Student has no scenario readiness surface and never calls the Teacher endpoint", async ({
  page
}) => {
  const readinessRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/scenario-selection-readiness")) {
      readinessRequests.push(request.url());
    }
  });

  await page.goto(studentBaseUrl);
  await signIn(page, "学员登录", "student");

  await expect(page.getByLabel("scenario readiness")).toHaveCount(0);
  const studentText = await page.locator("body").innerText();
  for (const marker of [
    "Scenario Readiness",
    "R7_BFF_PARAMETER_SET_NOT_APPROVED",
    "PREPARATION_PACKAGE_ONLY",
    "INTERNAL_SYNTHETIC_ONLY"
  ]) {
    expect(studentText).not.toContain(marker);
  }
  expect(readinessRequests).toEqual([]);
});
