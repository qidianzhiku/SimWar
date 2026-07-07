import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  ApiErrorEnvelope,
  AuthSession,
  Decision,
  DecisionPayload,
  Round,
  Run,
  SettlementResult
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

const VALID_DECISION_PAYLOAD = {
  pricing: { base_price: 12800 },
  marketing_budget: 180000,
  service_quality_budget: 160000,
  capacity_plan: "expand",
  cash_buffer_target: 0.16,
  strategy_statement: "L1 abort and reset synthetic decision."
} as const satisfies DecisionPayload;

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

async function request<TData>(
  baseUrl: string,
  path: string,
  options: {
    body?: unknown;
    method?: string;
    requestId?: string;
    token?: string;
  } = {}
): Promise<{ body: ApiEnvelope<TData>; status: number }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": "tenant_demo"
  });

  if (options.requestId) {
    headers.set("x-request-id", options.requestId);
  }

  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
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

async function createRunAndOpenRound(baseUrl: string, teacherToken: string): Promise<Run> {
  const runResponse = await request<{ round: Round; run: Run }>(
    baseUrl,
    "/api/v1/courses/course_demo/runs",
    {
      method: "POST",
      token: teacherToken
    }
  );
  expect(runResponse.status).toBe(201);

  const run = runResponse.body.data.run;
  const startResponse = await request<Round>(baseUrl, `/api/v1/runs/${run.run_id}/rounds/1/start`, {
    method: "POST",
    token: teacherToken
  });
  expect(startResponse.status).toBe(200);
  expect(startResponse.body.data.status).toBe("open");

  return run;
}

async function submitDecision(
  baseUrl: string,
  token: string,
  runId: string,
  strategyStatement: string
): Promise<Decision> {
  const response = await request<Decision>(baseUrl, `/api/v1/runs/${runId}/rounds/1/decisions`, {
    body: {
      decision_payload: {
        ...VALID_DECISION_PAYLOAD,
        strategy_statement: strategyStatement
      },
      team_id: "team_alpha"
    },
    method: "POST",
    token
  });
  expect(response.status).toBe(201);
  return response.body.data;
}

function assertNoProtectedLeak(value: unknown, forbidden: string[]): void {
  const serialized = JSON.stringify(value);

  for (const item of forbidden) {
    expect(serialized).not.toContain(item);
  }
}

describe("L1 session abort, reset, and recovery boundary guard", () => {
  it("preserves evidence after a controlled abort and documents synthetic reset limits", async () => {
    const first = await startServer();
    const protectedSentinel = "l1-abort-protected-truth-sentinel";
    let runId = "";
    let replayHash = "";

    try {
      const teacherToken = await login(first.baseUrl, "teacher", "teacher");
      const studentToken = await login(first.baseUrl, "student", "student");
      const run = await createRunAndOpenRound(first.baseUrl, teacherToken);
      runId = run.run_id;

      const controlledAbort = await request<ApiErrorEnvelope>(
        first.baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: {
              ...VALID_DECISION_PAYLOAD,
              state_true: {
                protected_marker: protectedSentinel
              },
              strategy_statement: "Controlled abort must not leak protected values."
            },
            team_id: "team_alpha"
          },
          method: "POST",
          requestId: "req_l1_abort_truth_boundary",
          token: studentToken
        }
      );
      expect(controlledAbort.status).toBe(403);
      expect(controlledAbort.body.code).toBe("TRUTH-403-001");
      expect(controlledAbort.body.request_id).toBe("req_l1_abort_truth_boundary");
      assertNoProtectedLeak(controlledAbort.body, [protectedSentinel]);

      const decision = await submitDecision(
        first.baseUrl,
        studentToken,
        run.run_id,
        "The session continues after a controlled abort."
      );
      expect(decision.team_id).toBe("team_alpha");

      const lock = await request<Round>(first.baseUrl, `/api/v1/runs/${run.run_id}/rounds/1/lock`, {
        method: "POST",
        token: teacherToken
      });
      expect(lock.status).toBe(200);
      expect(lock.body.data.status).toBe("locked");

      const settlement = await request<SettlementResult>(
        first.baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/settle`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(settlement.status).toBe(200);
      replayHash = settlement.body.data.replay_hash;

      const publish = await request<Round>(
        first.baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/publish`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(publish.status).toBe(200);
      expect(publish.body.data.status).toBe("published");

      const settlementSnapshot = structuredClone(first.store.settlementResults);
      const roundSnapshot = structuredClone(first.store.rounds);
      const repeatedSettlement = await request<SettlementResult>(
        first.baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/settle`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(repeatedSettlement.status).toBe(200);
      expect(repeatedSettlement.body.data.replay_hash).toBe(replayHash);
      expect(first.store.settlementResults).toEqual(settlementSnapshot);
      expect(first.store.rounds).toEqual(roundSnapshot);

      expect(first.store.auditLogs.map((log) => log.action)).toEqual(
        expect.arrayContaining([
          "decision.submit",
          "round.lock",
          "round.settle_requested",
          "round.publish"
        ])
      );
    } finally {
      await stopServer(first.server);
    }

    const second = await startServer();

    try {
      expect(second.store.runs.some((run) => run.run_id === runId)).toBe(false);
      expect(
        second.store.settlementResults.some((settlement) => settlement.replay_hash === replayHash)
      ).toBe(false);
    } finally {
      await stopServer(second.server);
    }
  });
});
