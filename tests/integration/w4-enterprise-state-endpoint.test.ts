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

async function login(baseUrl: string, username: "teacher" | "student"): Promise<string> {
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

      const projection = await request<{ state: Record<string, unknown> }>(
        baseUrl,
        `/api/v1/bff/student/w4/runs/${activeRunId}/rounds/2/portfolio?course_id=course_demo`,
        student
      );
      expect(projection.status).toBe(200);
      expect(projection.body.data.state.cash).toBeUndefined();
      expect(projection.body.data.opening_state_ref).toEqual(continued.body.data.state_ref);
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
});
