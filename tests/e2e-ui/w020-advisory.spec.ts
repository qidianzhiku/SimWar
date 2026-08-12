import { once } from "node:events";
import type { Server } from "node:http";
import { expect, test, type Page } from "@playwright/test";
import type {
  D2EvidenceArtifactVersion,
  D2ProvenanceEdge,
  TeacherConfirmationVersion
} from "@simwar/shared-contracts";
import { createApiServer } from "../../services/api/src/server.js";
import { createP1Store, type SimWarStore } from "../../services/api/src/store.js";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const sourceDigest = "a".repeat(64);

function w019Refs() {
  return {
    course: {
      content_digest: sourceDigest,
      discriminator: "exact_ref" as const,
      resource_id: "package_w020",
      resource_type: "course_package_version" as const,
      tenant_id: "tenant_demo",
      version: "1.0.0"
    },
    goal: {
      content_digest: sourceDigest,
      discriminator: "exact_ref" as const,
      resource_id: "goal_w020",
      resource_type: "learning_goal_version" as const,
      tenant_id: "tenant_demo",
      version: "1.0.0"
    },
    rubric: {
      content_digest: sourceDigest,
      discriminator: "exact_ref" as const,
      resource_id: "rubric_w020",
      resource_type: "rubric_version" as const,
      tenant_id: "tenant_demo",
      version: "1.0.0"
    },
    evidence: {
      content_digest: sourceDigest,
      discriminator: "exact_ref" as const,
      resource_id: "artifact_w020",
      resource_type: "evidence_artifact" as const,
      tenant_id: "tenant_demo",
      version: "1.0.0"
    },
    confirmation: {
      content_digest: sourceDigest,
      discriminator: "exact_ref" as const,
      resource_id: "confirmation_w020",
      resource_type: "teacher_confirmation_version" as const,
      tenant_id: "tenant_demo",
      version: "1.0.0"
    },
    event: {
      content_digest: sourceDigest,
      discriminator: "exact_ref" as const,
      resource_id: "event_w020_ready",
      resource_type: "role_workflow_event" as const,
      tenant_id: "tenant_demo",
      version: "1.0.0"
    },
    rule: {
      content_digest: sourceDigest,
      discriminator: "exact_ref" as const,
      resource_id: "rule_w020",
      resource_type: "transformation_rule" as const,
      tenant_id: "tenant_demo",
      version: "1.0.0"
    }
  };
}

function seedW020Journey(store: SimWarStore): void {
  const refs = w019Refs();
  store.runs.push({
    course_id: "course_demo",
    parameter_set_id: "param_toy_approved_1",
    run_id: "run_w020",
    scenario_package_id: "scenario_eldercare_demo",
    seed: 20,
    status: "completed",
    tenant_id: "tenant_demo"
  });
  store.rounds.push({
    round_id: "round_w020",
    round_no: 1,
    run_id: "run_w020",
    status: "published",
    tenant_id: "tenant_demo"
  });
  store.studentRoleAssignments.push({
    assigned_at: "2026-08-09T00:00:00.000Z",
    assigned_by: "usr_teacher",
    assignment_id: "assignment_w020",
    course_id: "course_demo",
    role_key: "CEO",
    role_template_id: "role_template_ceo_v1",
    run_id: "run_w020",
    source: "teacher_assigned",
    status: "active",
    team_id: "team_alpha",
    tenant_id: "tenant_demo",
    user_id: "usr_student"
  });
  store.roleWorkflowEvents.push({
    actor_id: "usr_student",
    created_at: "2026-08-09T00:00:00.000Z",
    event_id: "event_w020_ready",
    event_type: "section_ready",
    resource_id: "section_w020",
    round_id: "round_w020",
    run_id: "run_w020",
    team_id: "team_alpha",
    tenant_id: "tenant_demo"
  });
  store.decisions.push({
    canonical_source: "legacy_direct",
    decision_id: "decision_w020",
    payload: {
      capacity_plan: "hold",
      cash_buffer_target: 0.2,
      marketing_budget: 180000,
      pricing: { base_price: 12800 },
      service_quality_budget: 160000,
      strategy_statement: "Maintain a balanced operating plan."
    },
    round_id: "round_w020",
    round_no: 1,
    run_id: "run_w020",
    status: "validated",
    submitted_by: "usr_student",
    team_id: "team_alpha",
    tenant_id: "tenant_demo",
    validation_report: [],
    version: 1
  });
  store.settlementResults.push({
    parameter_set_id: "param_toy_approved_1",
    replay_hash: "b".repeat(64),
    round_id: "round_w020",
    round_no: 1,
    run_id: "run_w020",
    scenario_package_id: "scenario_eldercare_demo",
    settlement_result_id: "result_w020",
    team_results: [
      {
        state_est: {
          explanation: "internal only",
          next_round_risk: "balanced",
          recommended_focus: "observe"
        },
        state_obs: {
          demand_band: "medium",
          profit_band: "healthy",
          rank: 1,
          revenue: 1200,
          score: 88,
          served_demand: 40
        },
        state_true: {
          cash_flow: 300,
          cost: 800,
          demand: 43,
          market_share: 0.6,
          profit: 400,
          rank: 1,
          revenue: 1200,
          score: 88,
          served_demand: 40,
          settlement_status: "settled"
        },
        team_id: "team_alpha",
        team_name: "Alpha 康养队"
      }
    ],
    tenant_id: "tenant_demo"
  });

  const artifact: D2EvidenceArtifactVersion = {
    artifact_digest: sourceDigest,
    artifact_kind: "observation",
    artifact_ref: refs.evidence,
    captured_at: "2026-08-09T00:00:00.000Z",
    captured_by: "usr_teacher",
    context: {
      activity_id: "activity_w020",
      course_id: "course_demo",
      role_key: "CEO",
      run_id: "run_w020",
      team_id: "team_alpha"
    },
    course_package_ref: refs.course,
    discriminator: "d2_evidence_artifact_version",
    idempotency_key: "artifact_idem_w020",
    known_limits: ["teacher_only"],
    learning_goal_ref: refs.goal,
    rubric_ref: refs.rubric,
    schema_version: "evidence-provenance.v1",
    source_event_ref: refs.event,
    transformation_rule_ref: refs.rule,
    visibility: "teacher_only"
  };
  const edge: D2ProvenanceEdge = {
    discriminator: "d2_provenance_edge",
    relation: "derived_from",
    source_ref: refs.event,
    target_ref: refs.evidence
  };
  const confirmation: TeacherConfirmationVersion = {
    audit_receipt: {
      action: "teacher_confirmation.confirm",
      actor_id: "usr_teacher",
      audit_id: "audit_w020_confirmation",
      recorded_at: "2026-08-09T00:00:00.000Z",
      request_id: "request_w020_confirmation"
    },
    confirmation_ref: refs.confirmation,
    content_digest: sourceDigest,
    context: {
      course_id: "course_demo",
      role_key: "CEO",
      run_id: "run_w020",
      team_id: "team_alpha"
    },
    course_package_ref: refs.course,
    created_at: "2026-08-09T00:00:00.000Z",
    created_by: "usr_teacher",
    criterion_decisions: [{ criterion_id: "criterion_w020", level_ordinal: 2 }],
    discriminator: "teacher_confirmation_version",
    evidence_refs: [refs.evidence],
    idempotency_key: "idem_confirmation_w020",
    known_limits: ["D3 teacher-only"],
    learning_goal_ref: refs.goal,
    rubric_ref: refs.rubric,
    schema_version: "teacher-confirmation.v1",
    status: "CONFIRMED",
    teacher_feedback: "Private teacher note must not be exposed."
  };
  store.evidenceArtifacts.push(artifact);
  store.evidenceProvenanceEdges.push(edge);
  store.teacherConfirmationVersions.push(confirmation);
}

async function startW020Server(): Promise<{
  baseUrl: string;
  server: Server;
  store: SimWarStore;
}> {
  const store = createP1Store();
  seedW020Journey(store);
  const server = createApiServer(store, {
    env: {
      INTERNAL_SERVICE_TOKEN: "w020-browser-internal-service-token",
      JWT_SECRET: "w020-browser-jwt-secret-with-sufficient-length",
      SIMWAR_ENV: "test"
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("W020 browser server did not bind");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

async function routeToRealApi(
  page: Page,
  baseUrl: string,
  requests: Record<string, unknown>[],
  delayFor: (request: {
    body: Record<string, unknown> | null;
    method: string;
    pathname: string;
  }) => number = () => 75
): Promise<void> {
  await page.route("**/api/v1/**", async (route) => {
    const original = new URL(route.request().url());
    if (original.pathname.includes("/advisors/")) {
      const body = route.request().postDataJSON();
      if (body && typeof body === "object") requests.push(body as Record<string, unknown>);
      const delay = delayFor({
        body: body && typeof body === "object" ? (body as Record<string, unknown>) : null,
        method: route.request().method(),
        pathname: original.pathname
      });
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    }
    await route.continue({ url: `${baseUrl}${original.pathname}${original.search}` });
  });
}

test("student advisor uses the real BFF and exposes bounded deterministic states", async ({
  page
}) => {
  const journey = await startW020Server();
  const requests: Record<string, unknown>[] = [];
  let serverRunning = true;
  let delayFirstStudentRequest = true;
  try {
    await routeToRealApi(page, journey.baseUrl, requests, ({ body, pathname }) => {
      if (
        delayFirstStudentRequest &&
        pathname.endsWith("/bff/student/advisors/role") &&
        body?.role_key === "CEO"
      ) {
        delayFirstStudentRequest = false;
        return 400;
      }
      return 75;
    });
    await page.goto("/");
    const login = page.getByLabel("student login");
    await login.getByLabel("tenant").fill("tenant_demo");
    await login.getByLabel("username").fill("student");
    await login.getByLabel("password").fill("student");
    await login.getByRole("button", { name: "学员登录" }).click();

    const panel = page.getByLabel("Student Role Advisor");
    await expect(panel).toContainText("Deterministic Mock");
    await expect(panel).toContainText("Advisory Only");
    await panel.getByRole("button", { name: "请求角色建议" }).click();
    await expect(panel.getByRole("button", { name: "生成中" })).toBeDisabled();
    await panel.getByLabel("advisor role").selectOption("CFO");
    await expect(panel.getByRole("status")).toContainText("IDLE");
    await page.waitForTimeout(500);
    await expect(panel.getByRole("status")).toContainText("IDLE");
    await expect(panel.getByLabel("student advisory receipt")).toHaveCount(0);

    await panel.getByLabel("advisor role").selectOption("CEO");
    await panel.getByRole("button", { name: "请求角色建议" }).click();
    await expect(panel.getByRole("status")).toContainText("SUCCESS");
    await expect(panel.getByLabel("student advisory receipt")).toContainText(
      "Student Role Advisor"
    );
    expect(requests[0]).toMatchObject({
      role_key: "CEO",
      round_id: "round_w020",
      run_id: "run_w020",
      surface: "student_role",
      team_id: "team_alpha"
    });

    const existing = journey.store.governedAdvisoryRecords[0];
    expect(existing).toBeDefined();
    if (existing) Object.assign(existing, { request_digest: "c".repeat(64) });
    await panel.getByRole("button", { name: "请求角色建议" }).click();
    await expect(panel.getByRole("status")).toContainText("CONFLICT");
    await expect(panel.getByRole("button", { name: "重试角色建议" })).toBeVisible();

    await panel.getByLabel("advisor role").selectOption("CFO");
    await panel.getByRole("button", { name: "请求角色建议" }).click();
    await expect(panel.getByRole("status")).toContainText("FORBIDDEN");

    await panel.getByLabel("advisor role").selectOption("COO");
    await stopServer(journey.server);
    serverRunning = false;
    await panel.getByRole("button", { name: "请求角色建议" }).click();
    await expect(panel.getByRole("status")).toContainText("FAILED");
    await expect(panel).not.toContainText(
      /model_call_log|raw_prompt|SettlementResult|replay_hash/i
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  } finally {
    if (serverRunning) await stopServer(journey.server);
  }
});

test("teacher debrief uses the real W019-safe BFF and exposes bounded audit metadata", async ({
  page
}) => {
  const journey = await startW020Server();
  const requests: Record<string, unknown>[] = [];
  let delayFirstTeacherRequest = true;
  let delayNextAuditRequest = false;
  try {
    await routeToRealApi(page, journey.baseUrl, requests, ({ body, method, pathname }) => {
      if (
        delayFirstTeacherRequest &&
        pathname.endsWith("/bff/teacher/advisors/debrief") &&
        body?.activity_id === "activity_w020"
      ) {
        delayFirstTeacherRequest = false;
        return 400;
      }
      if (
        delayNextAuditRequest &&
        method === "GET" &&
        pathname.endsWith("/bff/teacher/advisors/audit")
      ) {
        delayNextAuditRequest = false;
        return 400;
      }
      return 75;
    });
    await page.goto(teacherBaseUrl);
    const login = page.getByLabel("teacher login");
    await login.getByLabel("tenant").fill("tenant_demo");
    await login.getByLabel("username").fill("teacher");
    await login.getByLabel("password").fill("teacher");
    await login.getByRole("button", { name: "教师登录" }).click();

    const panel = page.getByLabel("Teacher Debrief Advisor");
    await expect(panel).toContainText("Deterministic Mock");
    await expect(panel.getByLabel("advisor team")).toHaveValue("team_alpha");
    await panel.getByLabel("advisor role").selectOption("CEO");
    await panel.getByLabel("advisor activity").fill("activity_w020");
    await panel.getByRole("button", { name: "请求教师复盘建议" }).click();
    await expect(panel.getByRole("button", { name: "生成中" })).toBeDisabled();
    await panel.getByLabel("advisor activity").fill("activity_conflict");
    await expect(panel.getByRole("status")).toContainText("IDLE");
    await page.waitForTimeout(500);
    await expect(panel.getByRole("status")).toContainText("IDLE");
    await expect(panel.getByLabel("teacher advisory receipt")).toHaveCount(0);

    await panel.getByLabel("advisor activity").fill("activity_conflict");
    await panel.getByRole("button", { name: "请求教师复盘建议" }).click();
    await expect(panel.getByRole("status")).toContainText("CONFLICT");
    await expect(panel.getByRole("button", { name: "重试教师复盘建议" })).toBeVisible();

    await panel.getByLabel("advisor activity").fill("activity_w020");
    await expect(panel.getByRole("status")).toContainText("IDLE");
    delayNextAuditRequest = true;
    await panel.getByRole("button", { name: "请求教师复盘建议" }).click();
    await expect(panel.getByRole("button", { name: "生成中" })).toBeDisabled();
    await expect(panel.getByRole("status")).toContainText("SUCCESS");
    await expect(panel.getByLabel("teacher advisory receipt")).toContainText(
      "Discuss the confirmed CEO evidence for activity_w020."
    );
    await expect(panel.getByLabel("teacher advisory receipt")).toContainText(
      "Compare the confirmed evidence coverage with the listed Known Limits"
    );
    expect(requests.at(-1)).toMatchObject({
      activity_id: "activity_w020",
      role_key: "CEO",
      round_id: "round_w020",
      run_id: "run_w020",
      surface: "teacher_debrief",
      team_id: "team_alpha"
    });
    await panel.getByLabel("advisor activity").fill("activity_conflict");
    await expect(panel.getByRole("status")).toContainText("IDLE");
    await page.waitForTimeout(500);
    await expect(panel.getByLabel("teacher advisory audit list")).not.toContainText(
      "deterministic-mock / simwar-w020-deterministic-mock-v1"
    );
    await panel.getByLabel("advisor activity").fill("activity_w020");
    await panel.getByRole("button", { name: "请求教师复盘建议" }).click();
    await expect(panel.getByRole("status")).toContainText("SUCCESS");
    await expect(panel.getByLabel("teacher advisory audit list")).toContainText(
      "deterministic-mock / simwar-w020-deterministic-mock-v1"
    );
    await expect(panel).not.toContainText(/raw_prompt|raw_payload|SettlementResult|replay_hash/i);

    await page.setViewportSize({ width: 390, height: 844 });
    const overflowingElements = await panel.evaluate((root) =>
      [root, ...root.querySelectorAll<HTMLElement>("*")]
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map((element) => ({
          className: element.className,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          tagName: element.tagName
        }))
    );
    expect(overflowingElements).toEqual([]);
    const panelBounds = await panel.boundingBox();
    expect(panelBounds).not.toBeNull();
    expect((panelBounds?.x ?? 0) + (panelBounds?.width ?? 0)).toBeLessThanOrEqual(390);
  } finally {
    await stopServer(journey.server);
  }
});
