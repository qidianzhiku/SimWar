import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  ApiErrorEnvelope,
  AuthSession,
  Decision,
  PublicResultView,
  Round,
  Run,
  StudentBffCockpitDTO,
  SettlementResult
} from "../../packages/shared-contracts/src";
import { M1_STUDENT_RESULT_NOT_PUBLISHED_CODE } from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP0Store, type SimWarStore } from "../../services/api/src/store";

const VALID_DECISION_PAYLOAD = {
  pricing: { base_price: 12800 },
  marketing_budget: 180000,
  service_quality_budget: 160000,
  capacity_plan: "expand",
  cash_buffer_target: 0.16,
  strategy_statement: "Exercise the publication gate safety path."
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

  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

async function request<TData>(
  baseUrl: string,
  path: string,
  options: { body?: unknown; method?: string; servicePrincipal?: string; token?: string } = {}
): Promise<{ body: TData; status: number }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": "tenant_demo"
  });
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  if (options.servicePrincipal) headers.set("x-service-principal", options.servicePrincipal);

  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers,
    method: options.method ?? "GET"
  });
  return { body: (await response.json()) as TData, status: response.status };
}

async function login(baseUrl: string, username: string, password: string): Promise<AuthSession> {
  const response = await request<ApiEnvelope<AuthSession>>(baseUrl, "/api/v1/auth/login", {
    body: { password, username },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return response.body.data;
}

async function createSettledRun(
  baseUrl: string,
  teacherToken: string,
  studentToken: string
): Promise<Run> {
  const runResponse = await request<ApiEnvelope<{ round: Round; run: Run }>>(
    baseUrl,
    "/api/v1/courses/course_demo/runs",
    { method: "POST", token: teacherToken }
  );
  expect(runResponse.status).toBe(201);
  const run = runResponse.body.data.run;

  const started = await request<ApiEnvelope<Round>>(
    baseUrl,
    `/api/v1/runs/${run.run_id}/rounds/1/start`,
    { method: "POST", token: teacherToken }
  );
  expect(started.status).toBe(200);

  const decision = await request<ApiEnvelope<Decision>>(
    baseUrl,
    `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
    {
      body: { decision_payload: VALID_DECISION_PAYLOAD, team_id: "team_alpha" },
      method: "POST",
      token: studentToken
    }
  );
  expect(decision.status).toBe(201);

  const locked = await request<ApiEnvelope<Round>>(
    baseUrl,
    `/api/v1/runs/${run.run_id}/rounds/1/lock`,
    { method: "POST", token: teacherToken }
  );
  expect(locked.status).toBe(200);

  const settled = await request<ApiEnvelope<SettlementResult>>(
    baseUrl,
    `/internal/v1/runs/${run.run_id}/rounds/1/settle`,
    {
      method: "POST",
      servicePrincipal: "service_kernel",
      token: "test-internal-service-token"
    }
  );
  expect(settled.status).toBe(200);
  expect(settled.body.data.team_results).toHaveLength(1);
  return run;
}

describe("MW2 PX1-PG-01 publication gate safety", () => {
  it("blocks every Student result ingress before publish while retaining Teacher preview", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const teacher = await login(baseUrl, "teacher", "teacher");
      const student = await login(baseUrl, "student", "student");
      const run = await createSettledRun(baseUrl, teacher.access_token, student.access_token);

      const direct = await request<ApiErrorEnvelope>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        { token: student.access_token }
      );
      expect(direct.status).toBe(409);
      expect(direct.body.code).toBe(M1_STUDENT_RESULT_NOT_PUBLISHED_CODE);
      expect(JSON.stringify(direct.body)).not.toContain("state_obs");
      expect(JSON.stringify(direct.body)).not.toContain("state_est");

      const cockpit = await request<ApiEnvelope<StudentBffCockpitDTO>>(
        baseUrl,
        `/api/v1/bff/student/runs/${run.run_id}/rounds/1/cockpit`,
        { token: student.access_token }
      );
      expect(cockpit.status).toBe(200);
      expect(cockpit.body.data.student_cockpit.visible_state.round_status).toBe("settled");
      expect(cockpit.body.data.published_result.redacted_result).toBeUndefined();
      expect(cockpit.body.data.published_result.state_obs).toBeUndefined();
      expect(cockpit.body.data.published_result.state_est).toBeUndefined();
      expect(cockpit.body.data.three_part_feedback.feedback).toEqual({});
      expect(cockpit.body.data.learning_report.learning_evidence.prompts).toEqual([]);

      const demoState = await request<
        ApiEnvelope<{ latest_result?: PublicResultView; rounds: Array<{ status: string }> }>
      >(baseUrl, "/api/v1/demo-state", { token: student.access_token });
      expect(demoState.status).toBe(200);
      expect(demoState.body.data.latest_result).toBeUndefined();

      const teacherPreview = await request<
        ApiEnvelope<{ teacher_replay_summary: { authorized_result_snapshot: unknown[] } }>
      >(baseUrl, `/api/v1/bff/teacher/runs/${run.run_id}/rounds/1/workspace`, {
        token: teacher.access_token
      });
      expect(teacherPreview.status).toBe(200);
      expect(
        teacherPreview.body.data.teacher_replay_summary.authorized_result_snapshot
      ).toHaveLength(1);

      const teacherDirectPreview = await request<ApiEnvelope<PublicResultView>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        { token: teacher.access_token }
      );
      expect(teacherDirectPreview.status).toBe(200);
      expect(teacherDirectPreview.body.data.results[0]).toHaveProperty("state_true");
    } finally {
      await stopServer(server);
    }
  });

  it("reveals the same result only after the existing Round publish command", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const teacher = await login(baseUrl, "teacher", "teacher");
      const student = await login(baseUrl, "student", "student");
      const run = await createSettledRun(baseUrl, teacher.access_token, student.access_token);

      const publish = await request<ApiEnvelope<Round>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/publish`,
        { method: "POST", token: teacher.access_token }
      );
      expect(publish.status).toBe(200);
      expect(publish.body.data.status).toBe("published");

      const direct = await request<ApiEnvelope<PublicResultView>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        { token: student.access_token }
      );
      expect(direct.status).toBe(200);
      expect(direct.body.data.status).toBe("published");
      expect(direct.body.data.results).toHaveLength(1);

      const cockpit = await request<ApiEnvelope<StudentBffCockpitDTO>>(
        baseUrl,
        `/api/v1/bff/student/runs/${run.run_id}/rounds/1/cockpit`,
        { token: student.access_token }
      );
      expect(cockpit.status).toBe(200);
      expect(cockpit.body.data.published_result.redacted_result).toBeDefined();
      expect(cockpit.body.data.three_part_feedback.feedback.what_happened).toBeDefined();
      expect(cockpit.body.data.learning_report.learning_evidence.prompts.length).toBeGreaterThan(0);

      const demoState = await request<ApiEnvelope<{ latest_result?: PublicResultView }>>(
        baseUrl,
        "/api/v1/demo-state",
        { token: student.access_token }
      );
      expect(demoState.status).toBe(200);
      expect(demoState.body.data.latest_result?.status).toBe("published");
      expect(demoState.body.data.latest_result?.results).toHaveLength(1);
    } finally {
      await stopServer(server);
    }
  });
});
