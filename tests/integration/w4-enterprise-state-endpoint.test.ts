import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession } from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store } from "../../services/api/src/store";

const tenantId = "tenant_demo";
const runId = "w4-endpoint-run";

async function start(): Promise<{ server: Server; baseUrl: string }> {
  const server = createApiServer(createP1Store());
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function login(baseUrl: string, username: "teacher" | "student" | "admin"): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    body: JSON.stringify({ username, password: username })
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as ApiEnvelope<AuthSession>).data.access_token;
}

async function request<T>(
  baseUrl: string,
  path: string,
  token: string,
  body?: unknown,
  tenant = tenantId
): Promise<{ status: number; body: ApiEnvelope<T> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-tenant-id": tenant
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: response.status, body: (await response.json()) as ApiEnvelope<T> };
}

describe("W4 Enterprise State strategic evolution endpoints", () => {
  it("runs New Project from opening state to exact next opening with safe projections", async () => {
    const { server, baseUrl } = await start();
    try {
      const teacher = await login(baseUrl, "teacher");
      const student = await login(baseUrl, "student");
      const created = await request<{ run: { run_id: string } }>(
        baseUrl,
        "/api/v1/courses/course_demo/runs",
        teacher,
        {}
      );
      expect(created.status).toBe(201);
      const activeRunId = created.body.data.run.run_id;
      const started = await request<{ round_id: string }>(
        baseUrl,
        `/api/v1/runs/${activeRunId}/rounds/1/start`,
        teacher,
        {}
      );
      expect(started.status).toBe(200);
      const roundId = started.body.data.round_id;
      const initial = await request<{ state_ref: unknown }>(
        baseUrl,
        `/api/v1/w4/runs/${activeRunId}/rounds/1/states`,
        teacher,
        {
          course_id: "course_demo",
          team_id: "team_alpha",
          round_id: roundId,
          state: {
            cash: 1000,
            capacity: 100,
            product_lines: ["core-care"],
            positioning: "trusted-care",
            organization: { team_size: 4 },
            operating_units: [
              { operating_unit_id: "unit_alpha", name: "Alpha Operations", status: "active" }
            ],
            portfolio: { projects: [], facilities: [] }
          }
        }
      );
      expect(initial.status).toBe(201);

      const decision = await request(
        baseUrl,
        `/api/v1/w4/runs/${activeRunId}/rounds/1/strategic-decisions`,
        student,
        {
          course_id: "course_demo",
          team_id: "team_alpha",
          round_id: roundId,
          decision: {
            decision_id: "w4-http-decision-1",
            tenant_id: tenantId,
            course_id: "course_demo",
            run_id: activeRunId,
            round_id: roundId,
            round_no: 1,
            team_id: "team_alpha",
            kind: "new_project",
            version: 1,
            status: "canonical",
            payload: {
              project_name: "新区康养中心",
              cost: 300,
              cycle_rounds: 3,
              area: 12000,
              beds: 120,
              bed_mix: { standard: 72, memory_care: 36, premium: 12 },
              ramp: 0.4,
              lead_time_rounds: 2
            }
          }
        }
      );
      expect(decision.status).toBe(201);

      const openRoundSettlement = await request(
        baseUrl,
        `/api/v1/w4/runs/${activeRunId}/rounds/1/settle`,
        teacher,
        {
          course_id: "course_demo",
          team_id: "team_alpha",
          round_id: roundId,
          opening_state_ref: initial.body.data.state_ref,
          decision_id: "w4-http-decision-1"
        }
      );
      expect(openRoundSettlement.status).toBe(409);

      const canonicalRoundDecision = await request(
        baseUrl,
        `/api/v1/runs/${activeRunId}/rounds/1/decisions`,
        student,
        {
          team_id: "team_alpha",
          decision_payload: {
            pricing: { base_price: 12000 },
            marketing_budget: 10,
            service_quality_budget: 10,
            capacity_plan: "hold",
            cash_buffer_target: 0.3,
            strategy_statement: "W4 settlement admission decision"
          }
        }
      );
      expect(canonicalRoundDecision.status).toBe(201);

      const locked = await request(
        baseUrl,
        `/api/v1/runs/${activeRunId}/rounds/1/lock`,
        teacher,
        {}
      );
      expect(locked.status).toBe(200);

      const settled = await request<{ closing_state_ref: Record<string, unknown> }>(
        baseUrl,
        `/api/v1/w4/runs/${activeRunId}/rounds/1/settle`,
        teacher,
        {
          course_id: "course_demo",
          team_id: "team_alpha",
          round_id: roundId,
          opening_state_ref: initial.body.data.state_ref,
          decision_id: "w4-http-decision-1"
        }
      );
      expect(settled.status).toBe(200);

      const continued = await request<{ state_ref: Record<string, unknown> }>(
        baseUrl,
        `/api/v1/w4/runs/${activeRunId}/rounds/2/continue`,
        teacher,
        {
          course_id: "course_demo",
          team_id: "team_alpha",
          closing_state_ref: settled.body.data.closing_state_ref
        }
      );
      expect(continued.status).toBe(201);
      expect(continued.body.data.state_ref).toEqual(settled.body.data.closing_state_ref);

      const projection = await request<{
        state: Record<string, unknown>;
        path_evidence: {
          opening_vs_closing: { parent_state_ref: unknown; changed_paths: string[] };
          official_replay_path: {
            official_outcome_id: string;
            path_digests: string[];
            replay_writes_formal_results: false;
          };
        };
      }>(
        baseUrl,
        `/api/v1/bff/student/w4/runs/${activeRunId}/rounds/2/portfolio?course_id=course_demo`,
        student
      );
      expect(projection.status).toBe(200);
      expect(projection.body.data.state.cash).toBeUndefined();
      expect(projection.body.data.opening_state_ref).toEqual(continued.body.data.state_ref);
      expect(projection.body.data.path_evidence.opening_vs_closing).toBeNull();

      const roundOneProjection = await request<{
        path_evidence: {
          opening_vs_closing: { parent_state_ref: unknown; changed_paths: string[] };
          official_replay_path: {
            official_outcome_id: string;
            path_digests: string[];
            replay_writes_formal_results: false;
          };
        };
      }>(
        baseUrl,
        `/api/v1/bff/student/w4/runs/${activeRunId}/rounds/1/portfolio?course_id=course_demo&round_id=${encodeURIComponent(roundId)}`,
        student
      );
      expect(
        roundOneProjection.body.data.path_evidence.opening_vs_closing.parent_state_ref
      ).toEqual(initial.body.data.state_ref);
      expect(roundOneProjection.body.data.path_evidence.opening_vs_closing.changed_paths).toContain(
        "cash"
      );
      expect(
        roundOneProjection.body.data.path_evidence.official_replay_path.path_digests
      ).toHaveLength(1);
      expect(
        roundOneProjection.body.data.path_evidence.official_replay_path.replay_writes_formal_results
      ).toBe(false);

      const admin = await login(baseUrl, "admin");
      const adminProjection = await request<{
        portfolios: Array<{
          operating_units: Array<{ operating_unit_id: string; name: string; status: string }>;
          team_paths: Array<{ team_id: string; path_evidence: { official_replay_path: unknown } }>;
        }>;
      }>(baseUrl, "/api/v1/bff/admin/w4/portfolio", admin);
      expect(adminProjection.status).toBe(200);
      expect(adminProjection.body.data.portfolios[0]?.operating_units).toEqual([
        { operating_unit_id: "unit_alpha", name: "Alpha Operations", status: "active" }
      ]);
      expect(adminProjection.body.data.portfolios[0]?.team_paths[0]?.path_evidence).toBeDefined();

      const unknownRoundProjection = await request(
        baseUrl,
        `/api/v1/bff/student/w4/runs/${activeRunId}/rounds/99/portfolio?course_id=course_demo`,
        student
      );
      expect(unknownRoundProjection.status).toBe(409);
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  it("rejects cross-tenant access and duplicate strategic commands", async () => {
    const { server, baseUrl } = await start();
    try {
      const student = await login(baseUrl, "student");
      const crossTenant = await request(
        baseUrl,
        `/api/v1/bff/student/w4/runs/${runId}/rounds/1/portfolio?course_id=course_demo`,
        student,
        undefined,
        "tenant_other"
      );
      expect(crossTenant.status).toBeGreaterThanOrEqual(400);
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  it("enforces the W4 route authorization matrix and rejects stale scope", async () => {
    const { server, baseUrl } = await start();
    try {
      const teacher = await login(baseUrl, "teacher");
      const student = await login(baseUrl, "student");
      const created = await request<{ run: { run_id: string } }>(
        baseUrl,
        "/api/v1/courses/course_demo/runs",
        teacher,
        {}
      );
      expect(created.status).toBe(201);
      const activeRunId = created.body.data.run.run_id;
      const started = await request<{ round_id: string }>(
        baseUrl,
        `/api/v1/runs/${activeRunId}/rounds/1/start`,
        teacher,
        {}
      );
      expect(started.status).toBe(200);
      const roundId = started.body.data.round_id;
      const initial = await request(
        baseUrl,
        `/api/v1/w4/runs/${activeRunId}/rounds/1/states`,
        teacher,
        {
          course_id: "course_demo",
          team_id: "team_alpha",
          round_id: roundId,
          state: {}
        }
      );
      expect(initial.status).toBe(201);

      const wrongTenant = await request(
        baseUrl,
        `/api/v1/bff/student/w4/runs/${activeRunId}/rounds/1/portfolio?course_id=course_demo&round_id=${encodeURIComponent(roundId)}`,
        student,
        undefined,
        "tenant_other"
      );
      expect(wrongTenant.status).toBeGreaterThanOrEqual(400);
      expect(wrongTenant.body.code).toBe("TENANT-403-001");

      const wrongCourse = await request(
        baseUrl,
        `/api/v1/bff/student/w4/runs/${activeRunId}/rounds/1/portfolio?course_id=course_other&round_id=${encodeURIComponent(roundId)}`,
        student
      );
      expect(wrongCourse.status).toBe(409);
      expect(wrongCourse.body.data).toMatchObject({ code: "W4_COURSE_SCOPE_CONFLICT" });

      const unknownRun = await request(
        baseUrl,
        "/api/v1/bff/student/w4/runs/unknown-w4-run/rounds/1/portfolio?course_id=course_demo",
        student
      );
      expect(unknownRun.status).toBe(404);
      expect(unknownRun.body.data).toMatchObject({ code: "W4_RUN_NOT_FOUND" });

      const wrongRound = await request(
        baseUrl,
        `/api/v1/bff/student/w4/runs/${activeRunId}/rounds/99/portfolio?course_id=course_demo`,
        student
      );
      expect(wrongRound.status).toBe(409);
      expect(wrongRound.body.data).toMatchObject({ code: "W4_ROUND_SCOPE_CONFLICT" });

      const staleRoundId = await request(
        baseUrl,
        `/api/v1/bff/student/w4/runs/${activeRunId}/rounds/1/portfolio?course_id=course_demo&round_id=stale-round-id`,
        student
      );
      expect(staleRoundId.status).toBe(409);
      expect(staleRoundId.body.data).toMatchObject({ code: "W4_ROUND_SCOPE_CONFLICT" });

      const wrongTeam = await request(
        baseUrl,
        `/api/v1/w4/runs/${activeRunId}/rounds/1/strategic-decisions`,
        student,
        { course_id: "course_demo", team_id: "team_beta", round_id: roundId }
      );
      expect(wrongTeam.status).toBe(409);
      expect(wrongTeam.body.data).toMatchObject({ code: "W4_TEAM_SCOPE_CONFLICT" });

      const wrongRole = await request(
        baseUrl,
        `/api/v1/w4/runs/${activeRunId}/rounds/1/states`,
        student,
        { course_id: "course_demo", team_id: "team_alpha", round_id: roundId, state: {} }
      );
      expect(wrongRole.status).toBe(403);
      expect(wrongRole.body.code).toBe("D4_REPORT_SCOPE_VIOLATION");

      const staleState = await request(
        baseUrl,
        `/api/v1/w4/runs/${activeRunId}/rounds/2/continue`,
        teacher,
        {
          course_id: "course_demo",
          team_id: "team_alpha",
          closing_state_ref: {
            enterprise_state_id: "stale-state",
            tenant_id: tenantId,
            course_id: "course_demo",
            run_id: activeRunId,
            team_id: "team_alpha",
            round_id: roundId,
            round_no: 1,
            version: 1,
            state_digest: "0".repeat(64),
            parent_state_ref: null
          }
        }
      );
      expect(staleState.status).toBe(409);
      expect(staleState.body.data).toMatchObject({ code: "W4_STATE_REF_CONFLICT" });

      const activityIsServerBound = await request<{
        process_information: { activity_id: string };
      }>(
        baseUrl,
        `/api/v1/bff/student/w4/runs/${activeRunId}/rounds/1/portfolio?course_id=course_demo&round_id=${encodeURIComponent(roundId)}&activity_id=caller-supplied-wrong-activity`,
        student
      );
      expect(activityIsServerBound.status).toBe(200);
      expect(activityIsServerBound.body.data.process_information.activity_id).toBe(
        "w4-enterprise-state-strategic-evolution"
      );
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  it("allows only a teacher to advance a project lifecycle on the existing W4 initiative", async () => {
    const { server, baseUrl } = await start();
    try {
      const teacher = await login(baseUrl, "teacher");
      const student = await login(baseUrl, "student");
      const created = await request<{ run: { run_id: string } }>(
        baseUrl,
        "/api/v1/courses/course_demo/runs",
        teacher,
        {}
      );
      const activeRunId = created.body.data.run.run_id;
      const started = await request<{ round_id: string }>(
        baseUrl,
        `/api/v1/runs/${activeRunId}/rounds/1/start`,
        teacher,
        {}
      );
      const roundId = started.body.data.round_id;
      await request(baseUrl, `/api/v1/w4/runs/${activeRunId}/rounds/1/states`, teacher, {
        course_id: "course_demo",
        team_id: "team_alpha",
        round_id: roundId,
        state: {}
      });
      const decision = await request<{
        initiative: { initiative_id: string; project_lifecycle_status: string };
      }>(baseUrl, `/api/v1/w4/runs/${activeRunId}/rounds/1/strategic-decisions`, student, {
        course_id: "course_demo",
        team_id: "team_alpha",
        round_id: roundId,
        decision: {
          decision_id: "w4-lifecycle-route-decision",
          tenant_id: tenantId,
          course_id: "course_demo",
          run_id: activeRunId,
          round_id: roundId,
          round_no: 1,
          team_id: "team_alpha",
          kind: "new_project",
          version: 1,
          status: "canonical",
          payload: {
            project_name: "Lifecycle route project",
            cost: 100,
            cycle_rounds: 2,
            area: 5000,
            beds: 50,
            bed_mix: { standard: 50 },
            ramp: 0.5,
            lead_time_rounds: 1
          }
        }
      });
      expect(decision.status).toBe(201);
      expect(decision.body.data.initiative.project_lifecycle_status).toBe("Feasibility");

      const lifecyclePath = `/api/v1/w4/runs/${activeRunId}/rounds/1/initiatives/${decision.body.data.initiative.initiative_id}/lifecycle`;
      const studentAttempt = await request(baseUrl, lifecyclePath, student, {
        course_id: "course_demo",
        team_id: "team_alpha",
        round_id: roundId,
        target: "DueDiligence"
      });
      expect(studentAttempt.status).toBe(403);

      const teacherAdvance = await request<{ project_lifecycle_status: string }>(
        baseUrl,
        lifecyclePath,
        teacher,
        {
          course_id: "course_demo",
          team_id: "team_alpha",
          round_id: roundId,
          target: "DueDiligence"
        }
      );
      expect(teacherAdvance.status).toBe(200);
      expect(teacherAdvance.body.data.project_lifecycle_status).toBe("DueDiligence");
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
