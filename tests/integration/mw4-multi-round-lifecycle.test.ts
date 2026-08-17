import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  Decision,
  Round,
  Run,
  StudentBffCockpitDTO,
  TeacherBffWorkspaceDTO
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

const tenantId = "tenant_demo";
const runId = "mw4-multi-round-run";

type ContinuationReceipt = {
  action: "round.continue";
  audit_id: string;
  continuation_key: string;
  outcome: "created" | "reused";
  predecessor_round_id: string;
  round_id: string;
  round_no: number;
  run_id: string;
  tenant_id: string;
};

type ContinuationResult = { receipt: ContinuationReceipt; round: Round };

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  const run: Run = {
    course_id: "course_demo",
    parameter_set_id: "param_toy_approved_1",
    run_id: runId,
    scenario_package_id: "scenario_eldercare_demo",
    seed: 23,
    status: "active",
    tenant_id: tenantId
  };
  const previousRound: Round = {
    round_id: "mw4-round-1",
    round_no: 1,
    run_id: runId,
    status: "published",
    tenant_id: tenantId
  };
  const previousDecision: Decision = {
    decision_id: "mw4-decision-1",
    payload: {
      capacity_plan: "expand",
      cash_buffer_target: 0.16,
      marketing_budget: 180000,
      pricing: { base_price: 12800 },
      service_quality_budget: 160000,
      strategy_statement: "previous round decision remains immutable"
    },
    round_id: previousRound.round_id,
    round_no: 1,
    run_id: runId,
    status: "submitted",
    submitted_by: "student_demo",
    team_id: "team_alpha",
    tenant_id: tenantId,
    validation_report: [],
    version: 1
  };
  store.runs.push(run);
  store.rounds.push(previousRound);
  store.decisions.push(previousDecision);

  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function request<TData>(
  baseUrl: string,
  path: string,
  options: { method?: string; token?: string; tenantId?: string } = {}
): Promise<{ status: number; body: ApiEnvelope<TData> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      authorization: options.token ? `Bearer ${options.token}` : "",
      "content-type": "application/json",
      "x-tenant-id": options.tenantId ?? tenantId
    },
    method: options.method ?? "GET"
  });
  return {
    status: response.status,
    body: (await response.json()) as ApiEnvelope<TData>
  };
}

async function login(baseUrl: string, username: "teacher" | "student"): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    body: JSON.stringify({ password: username, username }),
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as ApiEnvelope<AuthSession>).data.access_token;
}

async function continueRound(
  baseUrl: string,
  token: string,
  roundNo = 1,
  requestTenantId = tenantId
) {
  return request<ContinuationResult>(baseUrl, `/api/v1/runs/${runId}/rounds/${roundNo}/continue`, {
    method: "POST",
    token,
    tenantId: requestTenantId
  });
}

describe("MW4 formal multi-round lifecycle continuation", () => {
  it("MR01, MR05, MR06, MR07-MR12 creates one exact draft without copying history", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const beforeRound = structuredClone(store.rounds[0]);
      const beforeDecision = structuredClone(store.decisions[0]);
      const response = await continueRound(baseUrl, teacherToken);

      expect(response.status).toBe(201);
      expect(response.body.data.round).toMatchObject({
        round_id: `round_${runId}_2`,
        round_no: 2,
        run_id: runId,
        status: "draft",
        tenant_id: tenantId
      });
      expect(response.body.data.receipt).toMatchObject({
        action: "round.continue",
        continuation_key: `${tenantId}:${runId}:mw4-round-1`,
        outcome: "created",
        predecessor_round_id: "mw4-round-1",
        round_no: 2
      });
      expect(
        store.rounds.filter((round) => round.run_id === runId && round.round_no === 2)
      ).toHaveLength(1);
      expect(store.rounds.find((round) => round.round_id === beforeRound.round_id)).toEqual(
        beforeRound
      );
      expect(
        store.decisions.find((decision) => decision.decision_id === beforeDecision.decision_id)
      ).toEqual(beforeDecision);
      expect(store.decisions.some((decision) => decision.round_no === 2)).toBe(false);
      expect(store.auditLogs.some((log) => log.action === "round.continue")).toBe(true);
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  it("MR02 and MR18 fail closed for an unpublished or wrong predecessor", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      store.rounds[0].status = "draft";
      const unpublished = await continueRound(baseUrl, teacherToken);
      expect(unpublished.status).toBe(409);
      expect(unpublished.body.code).toBe("ROUND_CONTINUATION_REQUIRES_PUBLISHED");
      expect(store.rounds).toHaveLength(1);

      store.rounds[0].status = "published";
      const wrongPredecessor = await continueRound(baseUrl, teacherToken, 99);
      expect(wrongPredecessor.status).toBe(404);
      expect(store.rounds).toHaveLength(1);
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  it("MR03 and MR04 return one exact identity for repeated and concurrent commands", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const first = await continueRound(baseUrl, teacherToken);
      const repeated = await continueRound(baseUrl, teacherToken);
      const concurrent = await Promise.all(
        Array.from({ length: 8 }, () => continueRound(baseUrl, teacherToken))
      );
      const results = [first, repeated, ...concurrent];
      expect(new Set(results.map((result) => result.body.data.round.round_id))).toEqual(
        new Set([`round_${runId}_2`])
      );
      expect(results.every((result) => result.body.data.round.round_no === 2)).toBe(true);
      expect(results.some((result) => result.body.data.receipt.outcome === "reused")).toBe(true);
      expect(
        store.rounds.filter((round) => round.run_id === runId && round.round_no === 2)
      ).toHaveLength(1);
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  it("MR15-MR17 exposes exact Teacher and Student contexts and tenant rejection", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const studentToken = await login(baseUrl, "student");
      const created = await continueRound(baseUrl, teacherToken);
      const teacherWorkspace = await request<TeacherBffWorkspaceDTO>(
        baseUrl,
        `/api/v1/bff/teacher/runs/${runId}/rounds/1/workspace`,
        { token: teacherToken }
      );
      expect(teacherWorkspace.status).toBe(200);
      expect(teacherWorkspace.body.data.round_control).toMatchObject({
        round_id: "mw4-round-1",
        round_no: 1,
        status: "published"
      });
      expect(teacherWorkspace.body.data.round_control.allowed_actions).toContain("round:continue");

      const studentWorkspace = await request<StudentBffCockpitDTO>(
        baseUrl,
        `/api/v1/bff/student/runs/${runId}/rounds/${created.body.data.round.round_no}/cockpit`,
        { token: studentToken }
      );
      expect(studentWorkspace.status).toBe(200);
      expect(studentWorkspace.body.data.student_cockpit).toMatchObject({
        round_id: created.body.data.round.round_id,
        round_no: 2,
        run_id: runId
      });
      expect(studentWorkspace.body.data.published_result.redacted_result).toBeUndefined();

      const crossTenant = await continueRound(baseUrl, teacherToken, 1, "tenant_other");
      expect(crossTenant.status).toBeGreaterThanOrEqual(400);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
