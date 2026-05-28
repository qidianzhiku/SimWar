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
import { createP0Store } from "../../services/api/src/store";

async function startServer(): Promise<{ baseUrl: string; server: Server }> {
  const server = createApiServer(createP0Store());
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
    method?: string;
    token?: string;
    tenantId?: string;
    servicePrincipal?: string;
    body?: unknown;
  } = {}
): Promise<{ status: number; body: ApiEnvelope<TData> }> {
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
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  return {
    status: response.status,
    body: (await response.json()) as ApiEnvelope<TData>
  };
}

async function login(
  baseUrl: string,
  username: string,
  password: string,
  tenantId = "tenant_demo"
): Promise<string> {
  const response = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    method: "POST",
    tenantId,
    body: { username, password }
  });

  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

describe("P0 teacher-student settlement flow", () => {
  it("runs the P0 flow without exposing state_true to learners", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const runResponse = await request<{ run: Run; round: Round }>(
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
          method: "POST",
          token: studentToken,
          body: {
            team_id: "team_alpha",
            decision_payload: {
              pricing: { base_price: 12800 },
              marketing_budget: 180000,
              service_quality_budget: 160000,
              capacity_plan: "expand",
              cash_buffer_target: 0.16,
              strategy_statement: "守住中高端康养客群并优先保证交付能力"
            }
          }
        }
      );
      expect(decisionResponse.status).toBe(201);
      expect(decisionResponse.body.data.status).toBe("validated");

      const lockResponse = await request<Round>(baseUrl, `/api/v1/runs/${runId}/rounds/1/lock`, {
        method: "POST",
        token: teacherToken
      });
      expect(lockResponse.body.data.status).toBe("locked");

      const lateDecision = await request<Decision>(
        baseUrl,
        `/api/v1/runs/${runId}/rounds/1/decisions`,
        {
          method: "POST",
          token: studentToken,
          body: {
            team_id: "team_alpha",
            decision_payload: {
              pricing: { base_price: 12000 },
              marketing_budget: 120000,
              service_quality_budget: 110000,
              capacity_plan: "hold",
              cash_buffer_target: 0.2,
              strategy_statement: "锁轮后尝试修改应被拒绝"
            }
          }
        }
      );
      expect(lateDecision.status).toBe(409);

      const settlementResponse = await request<SettlementResult>(
        baseUrl,
        `/internal/v1/runs/${runId}/rounds/1/settle`,
        {
          method: "POST",
          token: "service-kernel-token",
          servicePrincipal: "service_kernel"
        }
      );
      expect(settlementResponse.status).toBe(200);
      expect(settlementResponse.body.data.replay_hash).toHaveLength(64);
      expect(settlementResponse.body.data.team_results[0]?.state_true.settlement_status).toBe(
        "settled"
      );

      const secondSettlement = await request<SettlementResult>(
        baseUrl,
        `/internal/v1/runs/${runId}/rounds/1/settle`,
        {
          method: "POST",
          token: "service-kernel-token",
          servicePrincipal: "service_kernel"
        }
      );
      expect(secondSettlement.body.data.replay_hash).toBe(settlementResponse.body.data.replay_hash);

      const publishResponse = await request<Round>(
        baseUrl,
        `/api/v1/runs/${runId}/rounds/1/publish`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(publishResponse.body.data.status).toBe("published");

      const studentResult = await request<PublicResultView>(
        baseUrl,
        `/api/v1/runs/${runId}/rounds/1/results`,
        {
          token: studentToken
        }
      );
      expect(studentResult.body.data.results[0]?.state_true).toBeUndefined();
      expect(studentResult.body.data.results[0]?.state_obs.rank).toBe(1);

      const teacherResult = await request<PublicResultView>(
        baseUrl,
        `/api/v1/runs/${runId}/rounds/1/results`,
        {
          token: teacherToken
        }
      );
      expect(teacherResult.body.data.results[0]?.state_true?.rank).toBe(1);

      const auditResponse = await request<unknown[]>(baseUrl, "/api/v1/audit/logs", {
        token: teacherToken
      });
      expect(auditResponse.body.data.length).toBeGreaterThanOrEqual(5);
    } finally {
      await stopServer(server);
    }
  });

  it("blocks cross-tenant access with the same token", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const response = await request<unknown>(baseUrl, "/api/v1/courses", {
        token: teacherToken,
        tenantId: "tenant_other"
      });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("TENANT-403-001");
    } finally {
      await stopServer(server);
    }
  });
});
