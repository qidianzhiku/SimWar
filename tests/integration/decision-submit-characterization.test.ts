import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  Decision,
  Round,
  Run
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP0Store, type SimWarStore } from "../../services/api/src/store";

const VALID_DECISION_PAYLOAD = {
  pricing: { base_price: 12800 },
  marketing_budget: 180000,
  service_quality_budget: 160000,
  capacity_plan: "expand",
  cash_buffer_target: 0.16,
  strategy_statement: "Hold the premium eldercare segment with reliable delivery."
} as const;

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP0Store();
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

async function login(baseUrl: string, username: string, password: string): Promise<string> {
  const response = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    method: "POST",
    body: { username, password }
  });

  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

async function createRunAndOpenRound(baseUrl: string, teacherToken: string): Promise<Run> {
  const runResponse = await request<{ run: Run; round: Round }>(
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

describe("decision submit characterization", () => {
  it("characterizes successful submission response, store write, and audit side effect", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const run = await createRunAndOpenRound(baseUrl, teacherToken);

      const response = await request<Decision>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          method: "POST",
          token: studentToken,
          body: {
            team_id: "team_alpha",
            decision_payload: VALID_DECISION_PAYLOAD
          }
        }
      );

      expect(response.status).toBe(201);
      expect(response.body.code).toBe("OK");
      expect(response.body.message).toBe("success");
      expect(response.body.data).toMatchObject({
        tenant_id: "tenant_demo",
        run_id: run.run_id,
        round_no: 1,
        team_id: "team_alpha",
        status: "validated",
        version: 1,
        payload: VALID_DECISION_PAYLOAD,
        validation_report: [],
        submitted_by: "usr_student"
      });
      expect(response.body.data.decision_id).toMatch(/^decision_\d+$/);
      expect(response.body.data.round_id).toBeTruthy();

      expect(store.decisions).toHaveLength(1);
      expect(store.decisions[0]).toEqual(response.body.data);

      const decisionAudit = store.auditLogs.find(
        (log) =>
          log.action === "decision.submit" && log.resource_id === response.body.data.decision_id
      );
      expect(decisionAudit).toMatchObject({
        tenant_id: "tenant_demo",
        actor_id: "usr_student",
        actor_role: "learner",
        action: "decision.submit",
        resource_type: "decision",
        resource_id: response.body.data.decision_id
      });
      expect(decisionAudit?.after).toMatchObject({
        decision_id: response.body.data.decision_id,
        status: "validated",
        version: 1
      });
    } finally {
      await stopServer(server);
    }
  });

  it("characterizes repeated submissions as additional versions while the round remains open", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const run = await createRunAndOpenRound(baseUrl, teacherToken);

      const first = await request<Decision>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          method: "POST",
          token: studentToken,
          body: {
            team_id: "team_alpha",
            decision_payload: {
              ...VALID_DECISION_PAYLOAD,
              pricing: { base_price: 11800 },
              strategy_statement: "First validated decision version for characterization."
            }
          }
        }
      );
      const second = await request<Decision>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          method: "POST",
          token: studentToken,
          body: {
            team_id: "team_alpha",
            decision_payload: {
              ...VALID_DECISION_PAYLOAD,
              pricing: { base_price: 14800 },
              strategy_statement: "Second validated decision version for characterization."
            }
          }
        }
      );

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(first.body.data.version).toBe(1);
      expect(second.body.data.version).toBe(2);
      expect(first.body.data.decision_id).not.toBe(second.body.data.decision_id);

      const storedVersions = store.decisions.filter(
        (decision) =>
          decision.run_id === run.run_id &&
          decision.round_no === 1 &&
          decision.team_id === "team_alpha"
      );
      expect(storedVersions.map((decision) => decision.version)).toEqual([1, 2]);
      expect(storedVersions.at(-1)).toEqual(second.body.data);
    } finally {
      await stopServer(server);
    }
  });

  it("characterizes authentication and authorization failures for decision submit", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const run = await createRunAndOpenRound(baseUrl, teacherToken);

      const unauthenticated = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          method: "POST",
          body: {
            team_id: "team_alpha",
            decision_payload: VALID_DECISION_PAYLOAD
          }
        }
      );
      expect(unauthenticated.status).toBe(401);
      expect(unauthenticated.body.code).toBe("AUTH-401-001");

      const forbiddenTeacher = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          method: "POST",
          token: teacherToken,
          body: {
            team_id: "team_alpha",
            decision_payload: VALID_DECISION_PAYLOAD
          }
        }
      );
      expect(forbiddenTeacher.status).toBe(403);
      expect(forbiddenTeacher.body.code).toBe("AUTHZ-403-001");
    } finally {
      await stopServer(server);
    }
  });

  it("characterizes round-state restrictions without changing decision submit behavior", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");

      const draftRunResponse = await request<{ run: Run; round: Round }>(
        baseUrl,
        "/api/v1/courses/course_demo/runs",
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(draftRunResponse.status).toBe(201);
      const draftRun = draftRunResponse.body.data.run;

      const draftRoundSubmit = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${draftRun.run_id}/rounds/1/decisions`,
        {
          method: "POST",
          token: studentToken,
          body: {
            team_id: "team_alpha",
            decision_payload: VALID_DECISION_PAYLOAD
          }
        }
      );
      expect(draftRoundSubmit.status).toBe(409);
      expect(draftRoundSubmit.body.code).toBe("ROUND-409-002");

      const run = await createRunAndOpenRound(baseUrl, teacherToken);
      const decision = await request<Decision>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          method: "POST",
          token: studentToken,
          body: {
            team_id: "team_alpha",
            decision_payload: VALID_DECISION_PAYLOAD
          }
        }
      );
      expect(decision.status).toBe(201);

      const lockResponse = await request<Round>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/lock`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(lockResponse.status).toBe(200);
      expect(lockResponse.body.data.status).toBe("locked");

      const lockedRoundSubmit = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          method: "POST",
          token: studentToken,
          body: {
            team_id: "team_alpha",
            decision_payload: {
              ...VALID_DECISION_PAYLOAD,
              strategy_statement: "Attempting to submit after lock characterizes current behavior."
            }
          }
        }
      );
      expect(lockedRoundSubmit.status).toBe(409);
      expect(lockedRoundSubmit.body.code).toBe("ROUND-409-002");
    } finally {
      await stopServer(server);
    }
  });
});
