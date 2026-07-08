import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ActorRole,
  ApiEnvelope,
  ApiErrorEnvelope,
  AuthSession,
  Course,
  Decision,
  DecisionPayload,
  Round,
  Run,
  SettlementResult,
  Team,
  User
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

const DEMO_TENANT_ID = "tenant_demo";
const PLATFORM_TENANT_ID = "tenant_platform";
const SERVICE_KERNEL_TOKEN = "test-internal-service-token";

function createDecisionPayload(label: string, price: number): DecisionPayload {
  return {
    pricing: { base_price: price },
    marketing_budget: 180000,
    service_quality_budget: 160000,
    capacity_plan: "expand",
    cash_buffer_target: 0.16,
    strategy_statement: label
  };
}

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("test server did not bind to a TCP port");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
    store
  };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

async function request<TBody>(
  baseUrl: string,
  path: string,
  options: {
    body?: unknown;
    method?: string;
    requestId?: string;
    servicePrincipal?: string;
    tenantId?: string;
    token?: string;
  } = {}
): Promise<{ body: TBody; headers: Headers; status: number }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": options.tenantId ?? DEMO_TENANT_ID
  });

  if (options.requestId) {
    headers.set("x-request-id", options.requestId);
  }

  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }

  if (options.servicePrincipal) {
    headers.set("x-service-principal", options.servicePrincipal);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers,
    method: options.method ?? "GET"
  });

  return {
    body: (await response.json()) as TBody,
    headers: response.headers,
    status: response.status
  };
}

async function login(
  baseUrl: string,
  username: string,
  password: string,
  tenantId = DEMO_TENANT_ID
): Promise<AuthSession> {
  const response = await request<ApiEnvelope<AuthSession>>(baseUrl, "/api/v1/auth/login", {
    body: { password, username },
    method: "POST",
    tenantId
  });

  expect(response.status).toBe(200);
  return response.body.data;
}

function assertNoProtectedMarkers(value: unknown): void {
  const serialized = JSON.stringify(value);
  const forbiddenMarkers = [
    "canonical_evidence_digest",
    "decision_batch_hash",
    "json_runtime_source_digest",
    "private_replay",
    "plugin_trace",
    "shock_internal_detail"
  ];

  for (const marker of forbiddenMarkers) {
    expect(serialized).not.toContain(marker);
  }
}

describe("Teacher / Student BFF DTO productization", () => {
  it("projects Teacher, Student and Admin BFF DTOs from runtime state without widening truth visibility", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const teacher = await login(baseUrl, "teacher", "teacher");
      const tenantAdmin = await login(baseUrl, "admin", "admin");
      const studentAlpha = await login(baseUrl, "student", "student");
      const platformAdmin = await login(baseUrl, "platform", "platform", PLATFORM_TENANT_ID);

      const betaUser = await request<ApiEnvelope<User>>(baseUrl, "/api/v1/admin/users", {
        body: {
          display_name: "BFF Beta Student",
          email: "bff-beta-student@example.test",
          password: "student_beta_bff",
          roles: ["learner", "team_captain"] satisfies ActorRole[],
          tenant_id: DEMO_TENANT_ID,
          username: "bff_beta_student"
        },
        method: "POST",
        requestId: "req_bff_beta_user",
        token: tenantAdmin.access_token
      });
      expect(betaUser.status).toBe(201);
      const studentBeta = await login(baseUrl, "bff_beta_student", "student_beta_bff");

      const courseResponse = await request<ApiEnvelope<Course>>(baseUrl, "/api/v1/courses", {
        body: { title: "Teacher Student BFF DTO Productization Course" },
        method: "POST",
        requestId: "req_bff_course_create",
        token: teacher.access_token
      });
      expect(courseResponse.status).toBe(201);
      const course = courseResponse.body.data;

      const alphaTeam = await request<ApiEnvelope<Team>>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/teams`,
        {
          body: { captain_user_id: studentAlpha.user.user_id, name: "Alpha BFF Team" },
          method: "POST",
          requestId: "req_bff_alpha_team",
          token: teacher.access_token
        }
      );
      expect(alphaTeam.status).toBe(201);

      const betaTeam = await request<ApiEnvelope<Team>>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/teams`,
        {
          body: { captain_user_id: betaUser.body.data.user_id, name: "Beta BFF Team" },
          method: "POST",
          requestId: "req_bff_beta_team",
          token: teacher.access_token
        }
      );
      expect(betaTeam.status).toBe(201);

      const publishedCourse = await request<ApiEnvelope<Course>>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/publish`,
        {
          method: "POST",
          requestId: "req_bff_course_publish",
          token: teacher.access_token
        }
      );
      expect(publishedCourse.status).toBe(200);

      const runResponse = await request<ApiEnvelope<{ round: Round; run: Run }>>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/runs`,
        {
          method: "POST",
          requestId: "req_bff_run_create",
          token: teacher.access_token
        }
      );
      expect(runResponse.status).toBe(201);
      const { run } = runResponse.body.data;

      const startedRound = await request<ApiEnvelope<Round>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/start`,
        {
          method: "POST",
          requestId: "req_bff_round_start",
          token: teacher.access_token
        }
      );
      expect(startedRound.status).toBe(200);

      const alphaDecision = await request<ApiEnvelope<Decision>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: createDecisionPayload("Alpha BFF decision.", 12600),
            team_id: alphaTeam.body.data.team_id
          },
          method: "POST",
          requestId: "req_bff_alpha_decision",
          token: studentAlpha.access_token
        }
      );
      expect(alphaDecision.status).toBe(201);

      const betaDecision = await request<ApiEnvelope<Decision>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: createDecisionPayload("Beta BFF decision.", 12400),
            team_id: betaTeam.body.data.team_id
          },
          method: "POST",
          requestId: "req_bff_beta_decision",
          token: studentBeta.access_token
        }
      );
      expect(betaDecision.status).toBe(201);

      const lockedRound = await request<ApiEnvelope<Round>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/lock`,
        {
          method: "POST",
          requestId: "req_bff_round_lock",
          token: teacher.access_token
        }
      );
      expect(lockedRound.status).toBe(200);

      const settlement = await request<ApiEnvelope<SettlementResult>>(
        baseUrl,
        `/internal/v1/runs/${run.run_id}/rounds/1/settle`,
        {
          method: "POST",
          requestId: "req_bff_internal_settle",
          servicePrincipal: "service_kernel",
          token: SERVICE_KERNEL_TOKEN
        }
      );
      expect(settlement.status).toBe(200);
      expect(settlement.headers.get("x-simwar-settlement-outcome")).toBe("committed");

      const publishedRound = await request<ApiEnvelope<Round>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/publish`,
        {
          method: "POST",
          requestId: "req_bff_round_publish",
          token: teacher.access_token
        }
      );
      expect(publishedRound.status).toBe(200);

      const auditCountBeforeBffReads = store.auditLogs.length;

      const teacherWorkspace = await request<ApiEnvelope<Record<string, unknown>>>(
        baseUrl,
        `/api/v1/bff/teacher/runs/${run.run_id}/rounds/1/workspace`,
        { token: teacher.access_token }
      );
      expect(teacherWorkspace.status).toBe(200);
      expect(teacherWorkspace.body.data).toMatchObject({
        course_workspace: {
          actor_role: "teacher",
          course_id: course.course_id,
          run_id: run.run_id,
          tenant_id: DEMO_TENANT_ID
        },
        round_control: {
          actor_role: "teacher",
          round_id: lockedRound.body.data.round_id,
          round_no: 1,
          status: "published"
        },
        teacher_dashboard: {
          actor_role: "teacher",
          course_id: course.course_id,
          run_id: run.run_id,
          tenant_id: DEMO_TENANT_ID
        },
        teacher_replay_summary: {
          replay_status: "matched",
          replay_writes_formal_results: false
        }
      });
      expect(JSON.stringify(teacherWorkspace.body.data)).toContain("state_true");
      expect(JSON.stringify(teacherWorkspace.body.data)).toContain("BFF_DTO_PRODUCTIZATION");
      expect(JSON.stringify(teacherWorkspace.body.data)).not.toContain(
        'formal_truth_write_allowed":true'
      );

      const tenantAdminTeacherWorkspaceDenied = await request<ApiErrorEnvelope>(
        baseUrl,
        `/api/v1/bff/teacher/runs/${run.run_id}/rounds/1/workspace`,
        { token: tenantAdmin.access_token }
      );
      expect(tenantAdminTeacherWorkspaceDenied.status).toBe(403);
      expect(tenantAdminTeacherWorkspaceDenied.body.code).toBe("AUTHZ-403-001");

      const studentCockpit = await request<ApiEnvelope<Record<string, unknown>>>(
        baseUrl,
        `/api/v1/bff/student/runs/${run.run_id}/rounds/1/cockpit`,
        { token: studentAlpha.access_token }
      );
      expect(studentCockpit.status).toBe(200);
      expect(studentCockpit.body.data).toMatchObject({
        decision_form: {
          actor_role: "learner",
          course_id: course.course_id,
          run_id: run.run_id,
          team_id: alphaTeam.body.data.team_id,
          tenant_id: DEMO_TENANT_ID
        },
        published_result: {
          actor_role: "learner",
          course_id: course.course_id,
          run_id: run.run_id,
          team_id: alphaTeam.body.data.team_id
        },
        student_cockpit: {
          actor_role: "learner",
          course_id: course.course_id,
          run_id: run.run_id,
          team_id: alphaTeam.body.data.team_id
        }
      });
      const studentPublishedResult = (
        studentCockpit.body.data as {
          published_result?: { forbidden_fields?: string[]; redacted_result?: unknown };
        }
      ).published_result;
      assertNoProtectedMarkers(studentPublishedResult?.redacted_result);
      expect(studentPublishedResult?.forbidden_fields).toContain("state_true");
      expect(studentPublishedResult?.forbidden_fields).toContain("canonical_evidence_digest");
      expect(JSON.stringify(studentCockpit.body.data)).not.toContain(betaTeam.body.data.team_id);
      expect(JSON.stringify(studentCockpit.body.data)).toContain("state_obs");
      expect(JSON.stringify(studentCockpit.body.data)).toContain("state_est");
      expect(JSON.stringify(studentCockpit.body.data)).toContain('"advisory_only":true');
      expect(JSON.stringify(studentCockpit.body.data)).toContain("state_true");
      expect(JSON.stringify(studentPublishedResult?.redacted_result)).not.toContain("state_true");

      const tenantSummary = await request<ApiEnvelope<Record<string, unknown>>>(
        baseUrl,
        "/api/v1/bff/admin/tenant-summary",
        { token: tenantAdmin.access_token }
      );
      expect(tenantSummary.status).toBe(200);
      expect(tenantSummary.body.data).toMatchObject({
        actor_role: "tenant_admin",
        tenant_id: DEMO_TENANT_ID,
        visible_tenant_ids: [DEMO_TENANT_ID]
      });
      expect(JSON.stringify(tenantSummary.body.data)).not.toContain("tenant_other");

      const platformTenantSummaryDenied = await request<ApiErrorEnvelope>(
        baseUrl,
        "/api/v1/bff/admin/tenant-summary",
        {
          tenantId: PLATFORM_TENANT_ID,
          token: platformAdmin.access_token
        }
      );
      expect(platformTenantSummaryDenied.status).toBe(403);
      expect(platformTenantSummaryDenied.body.code).toBe("AUTHZ-403-001");

      const tenantAdminPlatformDenied = await request<ApiErrorEnvelope>(
        baseUrl,
        "/api/v1/bff/admin/platform-authority?scope=platform",
        { token: tenantAdmin.access_token }
      );
      expect(tenantAdminPlatformDenied.status).toBe(403);
      expect(tenantAdminPlatformDenied.body.code).toBe("AUTHZ-403-001");

      const platformMissingExplicitScope = await request<ApiErrorEnvelope>(
        baseUrl,
        "/api/v1/bff/admin/platform-authority",
        {
          tenantId: PLATFORM_TENANT_ID,
          token: platformAdmin.access_token
        }
      );
      expect(platformMissingExplicitScope.status).toBe(422);
      expect(platformMissingExplicitScope.body.code).toBe("BFF-422-001");

      const platformAuthority = await request<ApiEnvelope<Record<string, unknown>>>(
        baseUrl,
        "/api/v1/bff/admin/platform-authority?scope=platform",
        {
          tenantId: PLATFORM_TENANT_ID,
          token: platformAdmin.access_token
        }
      );
      expect(platformAuthority.status).toBe(200);
      expect(platformAuthority.body.data).toMatchObject({
        actor_role: "platform_admin",
        platform_authority: true,
        required_scope: "platform"
      });

      expect(store.auditLogs).toHaveLength(auditCountBeforeBffReads);
      expect(store.settlementResults).toHaveLength(1);
    } finally {
      await stopServer(server);
    }
  });
});
