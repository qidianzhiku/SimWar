import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  Decision,
  PublicResultView,
  Round,
  Run,
  SettlementResult
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store } from "../../services/api/src/store";

const M1_OFFICIAL_RESULT_LABEL = "M1 Teaching-Official Result under Current JSON Active Runtime";

type M1PublicResultView = PublicResultView & {
  classroom_debrief_prompts?: string[];
  result_label?: string;
  runtime_boundary?: string;
  runtime_limitations?: string[];
};

async function startServer(): Promise<{ baseUrl: string; server: Server }> {
  const server = createApiServer(createP1Store());
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("test server did not bind to a TCP port");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server
  };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

async function request<TData>(
  baseUrl: string,
  path: string,
  options: {
    body?: unknown;
    method?: string;
    servicePrincipal?: string;
    tenantId?: string;
    token?: string;
  } = {}
): Promise<{ body: ApiEnvelope<TData>; status: number }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": options.tenantId ?? "tenant_demo"
  });

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
    body: (await response.json()) as ApiEnvelope<TData>,
    status: response.status
  };
}

async function login(baseUrl: string, username: string, password: string): Promise<string> {
  const response = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    body: { password, username },
    method: "POST"
  });

  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

describe("M1 Teaching-Official JSON runtime loop", () => {
  it("runs the single-industry classroom loop with safe learner results and teacher debrief evidence", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");

      const runResponse = await request<{ round: Round; run: Run }>(
        baseUrl,
        "/api/v1/courses/course_demo/runs",
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(runResponse.status).toBe(201);
      const runId = runResponse.body.data.run.run_id;

      const startResponse = await request<Round>(baseUrl, `/api/v1/runs/${runId}/rounds/1/start`, {
        method: "POST",
        token: teacherToken
      });
      expect(startResponse.body.data.status).toBe("open");

      const decisionResponse = await request<Decision>(
        baseUrl,
        `/api/v1/runs/${runId}/rounds/1/decisions`,
        {
          body: {
            decision_payload: {
              capacity_plan: "expand",
              cash_buffer_target: 0.16,
              marketing_budget: 180000,
              pricing: { base_price: 12800 },
              service_quality_budget: 160000,
              strategy_statement: "守住中高端康养客群并优先保证交付能力"
            },
            team_id: "team_alpha"
          },
          method: "POST",
          token: studentToken
        }
      );
      expect(decisionResponse.status).toBe(201);
      expect(decisionResponse.body.data.status).toBe("validated");

      const lockResponse = await request<Round>(baseUrl, `/api/v1/runs/${runId}/rounds/1/lock`, {
        method: "POST",
        token: teacherToken
      });
      expect(lockResponse.body.data.status).toBe("locked");

      const settlementResponse = await request<SettlementResult>(
        baseUrl,
        `/api/v1/runs/${runId}/rounds/1/settle`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(settlementResponse.status).toBe(200);
      expect(settlementResponse.body.data.replay_hash).toHaveLength(64);
      expect(settlementResponse.body.data.team_results[0]?.state_true.settlement_status).toBe(
        "settled"
      );

      const publishResponse = await request<Round>(
        baseUrl,
        `/api/v1/runs/${runId}/rounds/1/publish`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(publishResponse.body.data.status).toBe("published");

      const studentResult = await request<M1PublicResultView>(
        baseUrl,
        `/api/v1/runs/${runId}/rounds/1/results`,
        {
          token: studentToken
        }
      );
      expect(studentResult.body.data.result_label).toBe(M1_OFFICIAL_RESULT_LABEL);
      expect(studentResult.body.data.runtime_boundary).toBe("current_json_active_runtime");
      expect(studentResult.body.data.runtime_limitations).toContain(
        "not_production_durable_settlement"
      );
      expect(studentResult.body.data.results).toHaveLength(1);
      expect(studentResult.body.data.results[0]?.state_true).toBeUndefined();
      expect(studentResult.body.data.results[0]?.state_est.recommended_focus).toBeTruthy();

      const teacherResult = await request<M1PublicResultView>(
        baseUrl,
        `/api/v1/runs/${runId}/rounds/1/results`,
        {
          token: teacherToken
        }
      );
      expect(teacherResult.body.data.result_label).toBe(M1_OFFICIAL_RESULT_LABEL);
      expect(teacherResult.body.data.classroom_debrief_prompts?.length).toBeGreaterThanOrEqual(3);
      expect(teacherResult.body.data.results[0]?.state_true?.settlement_status).toBe("settled");
      expect(teacherResult.body.data.replay_hash).toBe(settlementResponse.body.data.replay_hash);
    } finally {
      await stopServer(server);
    }
  });
});
