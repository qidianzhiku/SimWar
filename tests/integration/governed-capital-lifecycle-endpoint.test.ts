import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession } from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store } from "../../services/api/src/store";

const tenantId = "tenant_demo";

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
  body?: unknown
): Promise<{ status: number; body: ApiEnvelope<T> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-tenant-id": tenantId
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: response.status, body: (await response.json()) as ApiEnvelope<T> };
}

describe("R1 governed capital lifecycle real API/BFF journey", () => {
  it("moves Teacher proposal/approval/execution into role-safe Student and Admin projections", async () => {
    const { server, baseUrl } = await start();
    try {
      const teacher = await login(baseUrl, "teacher");
      const student = await login(baseUrl, "student");
      const admin = await login(baseUrl, "admin");
      const created = await request<{ run: { run_id: string } }>(
        baseUrl,
        "/api/v1/courses/course_demo/runs",
        teacher,
        {}
      );
      expect(created.status).toBe(201);
      const runId = created.body.data.run.run_id;
      const started = await request<{ round_id: string }>(
        baseUrl,
        `/api/v1/runs/${runId}/rounds/1/start`,
        teacher,
        {}
      );
      expect(started.status).toBe(200);
      const roundId = started.body.data.round_id;
      const initial = await request(baseUrl, `/api/v1/w4/runs/${runId}/rounds/1/states`, teacher, {
        course_id: "course_demo",
        team_id: "team_alpha",
        round_id: roundId,
        state: {
          cash: 1000,
          capacity: 100,
          product_lines: ["core-care"],
          positioning: "trusted-care",
          organization: { team_size: 4 },
          operating_units: [],
          portfolio: { projects: [], facilities: [] }
        }
      });
      expect(initial.status).toBe(201);
      const decision = await request<{ decision: { decision_id: string } }>(
        baseUrl,
        `/api/v1/w4/runs/${runId}/rounds/1/strategic-decisions`,
        student,
        {
          course_id: "course_demo",
          team_id: "team_alpha",
          round_id: roundId,
          decision: {
            decision_id: `capital-lifecycle-decision-${runId}`,
            tenant_id: tenantId,
            course_id: "course_demo",
            run_id: runId,
            round_id: roundId,
            round_no: 1,
            team_id: "team_alpha",
            kind: "capital_action",
            version: 1,
            status: "canonical",
            payload: {
              rationale: "protect bounded project ramp",
              lead_time_rounds: 0,
              reversible: true,
              dependencies: [],
              kpi_hypothesis: "keep liquidity above covenant",
              capital_action_kind: "debt",
              principal: 400,
              term_rounds: 2,
              rate_or_cost_bps: 250,
              cost_source: "scenario-capital-cost-v1",
              covenant_min_cash: 500,
              fees: 10,
              obligation: "term_debt"
            }
          }
        }
      );
      expect(decision.status, JSON.stringify(decision.body)).toBe(201);
      const decisionId = decision.body.data.decision.decision_id;
      const lifecycleRoot = `/api/v1/w4/runs/${runId}/rounds/1/capital-lifecycles`;
      const proposed = await request<{ lifecycle_id: string; status: string }>(
        baseUrl,
        `${lifecycleRoot}/propose`,
        teacher,
        {
          command_id: "capital-http-propose",
          lifecycle_id: "capital-http-lifecycle",
          decision_id: decisionId,
          instrument: "loan",
          principal: 400,
          cost_bps: 250,
          fee: 10,
          term_rounds: 2,
          covenant_min_cash: 500,
          source_digest: "capital-source-v1",
          course_id: "course_demo",
          team_id: "team_alpha",
          round_id: roundId
        }
      );
      expect(proposed.status, JSON.stringify(proposed.body)).toBe(201);
      expect(proposed.body.data.status).toBe("PROPOSED");

      const approved = await request<{ status: string }>(
        baseUrl,
        `${lifecycleRoot}/${proposed.body.data.lifecycle_id}/approve`,
        teacher,
        {
          command_id: "capital-http-approve",
          course_id: "course_demo",
          team_id: "team_alpha",
          round_id: roundId
        }
      );
      expect(approved.status).toBe(200);
      expect(approved.body.data.status).toBe("APPROVED");

      const executing = await request<{ status: string }>(
        baseUrl,
        `${lifecycleRoot}/${proposed.body.data.lifecycle_id}/execute`,
        teacher,
        {
          command_id: "capital-http-execute",
          decision_id: decisionId,
          course_id: "course_demo",
          team_id: "team_alpha",
          round_id: roundId
        }
      );
      expect(executing.status).toBe(200);
      expect(executing.body.data.status).toBe("EXECUTING");

      const studentProjection = await request<{
        status: string;
        explanation: { mechanism: string; limits: string[] };
        transition_history: Array<{ status: string; actor_id?: string; command_id?: string }>;
      }>(
        baseUrl,
        `/api/v1/bff/student/w4/runs/${runId}/rounds/1/capital-lifecycles/${proposed.body.data.lifecycle_id}?course_id=course_demo&team_id=team_alpha&round_id=${encodeURIComponent(roundId)}`,
        student
      );
      expect(studentProjection.status).toBe(200);
      expect(studentProjection.body.data.status).toBe("EXECUTING");
      expect(studentProjection.body.data.explanation.mechanism).toContain("existing W4 settlement");
      expect(studentProjection.body.data.transition_history).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ actor_id: expect.any(String) })])
      );

      const adminProjection = await request<{
        status: string;
        transition_history: Array<{ actor_id: string; command_id: string }>;
      }>(
        baseUrl,
        `/api/v1/bff/admin/w4/runs/${runId}/rounds/1/capital-lifecycles/${proposed.body.data.lifecycle_id}?course_id=course_demo&team_id=team_alpha&round_id=${encodeURIComponent(roundId)}`,
        admin
      );
      expect(adminProjection.status).toBe(200);
      expect(adminProjection.body.data.status).toBe("EXECUTING");
      expect(adminProjection.body.data.transition_history).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ actor_id: expect.any(String), command_id: expect.any(String) })
        ])
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("rejects cross-team Student reads instead of widening the role projection", async () => {
    const { server, baseUrl } = await start();
    try {
      const student = await login(baseUrl, "student");
      const response = await request(
        baseUrl,
        "/api/v1/bff/student/w4/runs/unknown/rounds/1/capital-lifecycles/unknown?course_id=course_demo&team_id=team_other&round_id=round",
        student
      );
      expect([403, 404, 409, 422]).toContain(response.status);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
