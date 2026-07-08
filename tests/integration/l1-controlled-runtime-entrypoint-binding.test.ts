import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ActorRole,
  ApiEnvelope,
  ApiErrorEnvelope,
  AuditLog,
  AuthSession,
  Course,
  Decision,
  DecisionPayload,
  P0DemoState,
  PublicResultView,
  Round,
  Run,
  SettlementResult,
  Team,
  User
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

const DEMO_TENANT_ID = "tenant_demo";
const OTHER_TENANT_ID = "tenant_other";
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

function assertNoProtectedLeak(value: unknown, forbidden: string[]): void {
  const serialized = JSON.stringify(value);

  for (const item of forbidden) {
    expect(serialized).not.toContain(item);
  }
}

function countAuditAction(logs: AuditLog[], action: string): number {
  return logs.filter((log) => log.action === action).length;
}

function assertError(
  response: { body: ApiErrorEnvelope; status: number },
  status: number,
  code: string
): void {
  expect(response.status).toBe(status);
  expect(response.body.code).toBe(code);
}

describe("L1 controlled runtime entrypoint binding guard", () => {
  it("binds the Golden M1 flow to real API entrypoints without helper or direct-store bypass", async () => {
    const protectedSentinel = "l1-controlled-runtime-protected-truth-sentinel";
    const { baseUrl, server } = await startServer();

    try {
      const teacher = await login(baseUrl, "teacher", "teacher");
      const tenantAdmin = await login(baseUrl, "admin", "admin");
      const studentAlpha = await login(baseUrl, "student", "student");
      const otherTeacher = await login(baseUrl, "other_teacher", "teacher", OTHER_TENANT_ID);
      const platformAdmin = await login(baseUrl, "platform", "platform", PLATFORM_TENANT_ID);

      const betaUserResponse = await request<ApiEnvelope<User>>(baseUrl, "/api/v1/admin/users", {
        body: {
          display_name: "Runtime Beta Student",
          email: "runtime-beta-student@example.test",
          password: "student_beta_runtime",
          roles: ["learner", "team_captain"] satisfies ActorRole[],
          tenant_id: DEMO_TENANT_ID,
          username: "runtime_beta_student"
        },
        method: "POST",
        requestId: "req_l1_controlled_user_beta",
        token: tenantAdmin.access_token
      });
      expect(betaUserResponse.status).toBe(201);

      const studentBeta = await login(baseUrl, "runtime_beta_student", "student_beta_runtime");

      const createCourseResponse = await request<ApiEnvelope<Course>>(baseUrl, "/api/v1/courses", {
        body: { title: "L1 Controlled Runtime Entrypoint Course" },
        method: "POST",
        requestId: "req_l1_controlled_course_create",
        token: teacher.access_token
      });
      expect(createCourseResponse.status).toBe(201);
      expect(createCourseResponse.body.data.status).toBe("draft");
      expect(createCourseResponse.body.data.scenario_package_id).toBe("scenario_eldercare_demo");
      expect(createCourseResponse.body.data.parameter_set_id).toBe("param_toy_approved_1");
      const course = createCourseResponse.body.data;

      const alphaTeamResponse = await request<ApiEnvelope<Team>>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/teams`,
        {
          body: {
            captain_user_id: studentAlpha.user.user_id,
            name: "Alpha Controlled Runtime Team"
          },
          method: "POST",
          requestId: "req_l1_controlled_team_alpha",
          token: teacher.access_token
        }
      );
      expect(alphaTeamResponse.status).toBe(201);
      const alphaTeam = alphaTeamResponse.body.data;

      const betaTeamResponse = await request<ApiEnvelope<Team>>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/teams`,
        {
          body: {
            captain_user_id: betaUserResponse.body.data.user_id,
            name: "Beta Controlled Runtime Team"
          },
          method: "POST",
          requestId: "req_l1_controlled_team_beta",
          token: teacher.access_token
        }
      );
      expect(betaTeamResponse.status).toBe(201);
      const betaTeam = betaTeamResponse.body.data;

      const studentCannotBindTeam = await request<ApiErrorEnvelope>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/teams`,
        {
          body: {
            captain_user_id: betaUserResponse.body.data.user_id,
            name: "Unauthorized Team Bind"
          },
          method: "POST",
          requestId: "req_l1_controlled_team_denied",
          token: studentAlpha.access_token
        }
      );
      assertError(studentCannotBindTeam, 403, "AUTHZ-403-001");

      const publishCourseResponse = await request<ApiEnvelope<Course>>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/publish`,
        {
          method: "POST",
          requestId: "req_l1_controlled_course_publish",
          token: teacher.access_token
        }
      );
      expect(publishCourseResponse.status).toBe(200);
      expect(publishCourseResponse.body.data.status).toBe("published");

      const duplicateCoursePublish = await request<ApiEnvelope<Course>>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/publish`,
        {
          method: "POST",
          requestId: "req_l1_controlled_course_publish_duplicate",
          token: teacher.access_token
        }
      );
      expect(duplicateCoursePublish.status).toBe(200);
      expect(duplicateCoursePublish.body.data.status).toBe("published");

      const createRunResponse = await request<ApiEnvelope<{ round: Round; run: Run }>>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/runs`,
        {
          method: "POST",
          requestId: "req_l1_controlled_run_create",
          token: teacher.access_token
        }
      );
      expect(createRunResponse.status).toBe(201);
      expect(createRunResponse.body.data.run.course_id).toBe(course.course_id);
      expect(createRunResponse.body.data.run.scenario_package_id).toBe(course.scenario_package_id);
      expect(createRunResponse.body.data.run.parameter_set_id).toBe(course.parameter_set_id);
      expect(createRunResponse.body.data.round.status).toBe("draft");
      const run = createRunResponse.body.data.run;

      const openRoundResponse = await request<ApiEnvelope<Round>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/start`,
        {
          method: "POST",
          requestId: "req_l1_controlled_round_start",
          token: teacher.access_token
        }
      );
      expect(openRoundResponse.status).toBe(200);
      expect(openRoundResponse.body.data.status).toBe("open");

      const studentCannotLock = await request<ApiErrorEnvelope>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/lock`,
        {
          method: "POST",
          requestId: "req_l1_controlled_lock_denied",
          token: studentAlpha.access_token
        }
      );
      assertError(studentCannotLock, 403, "AUTHZ-403-001");

      const controlledTruthFailure = await request<ApiErrorEnvelope>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: {
              ...createDecisionPayload("Controlled failure must not leak protected data.", 12800),
              state_true: {
                protected_marker: protectedSentinel
              }
            },
            team_id: alphaTeam.team_id
          },
          method: "POST",
          requestId: "req_l1_controlled_truth_denied",
          token: studentAlpha.access_token
        }
      );
      assertError(controlledTruthFailure, 403, "TRUTH-403-001");
      assertNoProtectedLeak(controlledTruthFailure.body, [protectedSentinel]);

      const crossTeamDecisionFailure = await request<ApiErrorEnvelope>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: createDecisionPayload("Alpha cannot submit for beta.", 13000),
            team_id: betaTeam.team_id
          },
          method: "POST",
          requestId: "req_l1_controlled_cross_team_denied",
          token: studentAlpha.access_token
        }
      );
      assertError(crossTeamDecisionFailure, 403, "TEAM-403-001");

      const alphaPayload = createDecisionPayload("Alpha controlled runtime decision.", 12600);
      const alphaDecision = await request<ApiEnvelope<Decision>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: alphaPayload,
            team_id: alphaTeam.team_id
          },
          method: "POST",
          requestId: "req_l1_controlled_alpha_decision",
          token: studentAlpha.access_token
        }
      );
      expect(alphaDecision.status).toBe(201);
      expect(alphaDecision.body.data.team_id).toBe(alphaTeam.team_id);

      const duplicateAlphaDecision = await request<ApiEnvelope<Decision>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: alphaPayload,
            team_id: alphaTeam.team_id
          },
          method: "POST",
          requestId: "req_l1_controlled_alpha_decision",
          token: studentAlpha.access_token
        }
      );
      expect(duplicateAlphaDecision.status).toBe(201);
      expect(duplicateAlphaDecision.body.data.decision_id).toBe(
        alphaDecision.body.data.decision_id
      );

      const betaDecision = await request<ApiEnvelope<Decision>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: createDecisionPayload("Beta controlled runtime decision.", 12400),
            team_id: betaTeam.team_id
          },
          method: "POST",
          requestId: "req_l1_controlled_beta_decision",
          token: studentBeta.access_token
        }
      );
      expect(betaDecision.status).toBe(201);
      expect(betaDecision.body.data.team_id).toBe(betaTeam.team_id);

      const lockResponse = await request<ApiEnvelope<Round>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/lock`,
        {
          method: "POST",
          requestId: "req_l1_controlled_round_lock",
          token: teacher.access_token
        }
      );
      expect(lockResponse.status).toBe(200);
      expect(lockResponse.body.data.status).toBe("locked");

      const duplicateLock = await request<ApiEnvelope<Round>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/lock`,
        {
          method: "POST",
          requestId: "req_l1_controlled_round_lock_duplicate",
          token: teacher.access_token
        }
      );
      expect(duplicateLock.status).toBe(200);
      expect(duplicateLock.body.data.status).toBe("locked");

      const settlement = await request<ApiEnvelope<SettlementResult>>(
        baseUrl,
        `/internal/v1/runs/${run.run_id}/rounds/1/settle`,
        {
          method: "POST",
          requestId: "req_l1_controlled_internal_settle",
          servicePrincipal: "service_kernel",
          token: SERVICE_KERNEL_TOKEN
        }
      );
      expect(settlement.status).toBe(200);
      expect(settlement.headers.get("x-simwar-settlement-outcome")).toBe("committed");
      expect(settlement.body.data.team_results).toHaveLength(2);
      const replayHash = settlement.body.data.replay_hash;

      const duplicateSettlement = await request<ApiEnvelope<SettlementResult>>(
        baseUrl,
        `/internal/v1/runs/${run.run_id}/rounds/1/settle`,
        {
          method: "POST",
          requestId: "req_l1_controlled_internal_settle_duplicate",
          servicePrincipal: "service_kernel",
          token: SERVICE_KERNEL_TOKEN
        }
      );
      expect(duplicateSettlement.status).toBe(200);
      expect(duplicateSettlement.headers.get("x-simwar-settlement-outcome")).toBe("reused");
      expect(duplicateSettlement.body.data.replay_hash).toBe(replayHash);

      const publishRoundResponse = await request<ApiEnvelope<Round>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/publish`,
        {
          method: "POST",
          requestId: "req_l1_controlled_round_publish",
          token: teacher.access_token
        }
      );
      expect(publishRoundResponse.status).toBe(200);
      expect(publishRoundResponse.body.data.status).toBe("published");

      const duplicateRoundPublish = await request<ApiEnvelope<Round>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/publish`,
        {
          method: "POST",
          requestId: "req_l1_controlled_round_publish_duplicate",
          token: teacher.access_token
        }
      );
      expect(duplicateRoundPublish.status).toBe(200);
      expect(duplicateRoundPublish.body.data.status).toBe("published");

      const studentResult = await request<ApiEnvelope<PublicResultView>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        {
          token: studentAlpha.access_token
        }
      );
      expect(studentResult.status).toBe(200);
      expect(studentResult.body.data.status).toBe("published");
      expect(studentResult.body.data.results).toHaveLength(1);
      expect(studentResult.body.data.results[0]?.team_id).toBe(alphaTeam.team_id);
      expect(studentResult.body.data.replay_hash).toBe(replayHash);
      expect(studentResult.body.data.replay_evidence).toBeUndefined();
      expect(JSON.stringify(studentResult.body.data)).not.toContain("state_true");
      expect(JSON.stringify(studentResult.body.data)).not.toContain(betaTeam.team_id);

      const teacherResult = await request<ApiEnvelope<PublicResultView>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        {
          token: teacher.access_token
        }
      );
      expect(teacherResult.status).toBe(200);
      expect(teacherResult.body.data.results.map((result) => result.team_id).sort()).toEqual(
        [alphaTeam.team_id, betaTeam.team_id].sort()
      );
      expect(teacherResult.body.data.replay_evidence).toBeDefined();
      expect(JSON.stringify(teacherResult.body.data)).toContain("state_true");

      const demoState = await request<ApiEnvelope<P0DemoState>>(baseUrl, "/api/v1/demo-state", {
        token: tenantAdmin.access_token
      });
      expect(demoState.status).toBe(200);
      expect(demoState.body.data.current_user.tenant_id).toBe(DEMO_TENANT_ID);
      expect(
        demoState.body.data.courses.some((candidate) => candidate.course_id === course.course_id)
      ).toBe(true);
      expect(demoState.body.data.runs.some((candidate) => candidate.run_id === run.run_id)).toBe(
        true
      );

      const platformAudit = await request<ApiEnvelope<AuditLog[]>>(
        baseUrl,
        `/api/v1/audit/logs?tenant_id=${DEMO_TENANT_ID}`,
        {
          tenantId: PLATFORM_TENANT_ID,
          token: platformAdmin.access_token
        }
      );
      expect(platformAudit.status).toBe(200);
      expect(platformAudit.body.data.length).toBeGreaterThan(0);
      expect(platformAudit.body.data.every((log) => log.tenant_id === DEMO_TENANT_ID)).toBe(true);

      const crossTenantRead = await request<ApiErrorEnvelope>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        {
          tenantId: DEMO_TENANT_ID,
          token: otherTeacher.access_token
        }
      );
      assertError(crossTenantRead, 403, "TENANT-403-001");

      const audit = await request<ApiEnvelope<AuditLog[]>>(baseUrl, "/api/v1/audit/logs", {
        token: tenantAdmin.access_token
      });
      expect(audit.status).toBe(200);
      expect(countAuditAction(audit.body.data, "course.create")).toBe(1);
      expect(countAuditAction(audit.body.data, "course.publish")).toBe(1);
      expect(countAuditAction(audit.body.data, "team.create")).toBe(2);
      expect(countAuditAction(audit.body.data, "run.create")).toBe(1);
      expect(countAuditAction(audit.body.data, "round.start")).toBe(1);
      expect(countAuditAction(audit.body.data, "decision.submit")).toBe(2);
      expect(countAuditAction(audit.body.data, "round.lock")).toBe(1);
      expect(countAuditAction(audit.body.data, "round.settle")).toBe(1);
      expect(countAuditAction(audit.body.data, "round.publish")).toBe(1);
    } finally {
      await stopServer(server);
    }
  });
});
