import { once } from "node:events";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  DecisionPayload,
  Round,
  Run,
  SettlementResult
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store } from "../../services/api/src/store";

const validDecisionPayload = {
  pricing: { base_price: 12800 },
  marketing_budget: 180000,
  service_quality_budget: 160000,
  capacity_plan: "expand",
  cash_buffer_target: 0.16,
  strategy_statement: "Hold the premium eldercare segment with reliable delivery."
} as const satisfies DecisionPayload;

function expectEnvelopeToMatchSchema(schemaFile: string, envelope: unknown): void {
  const schema = JSON.parse(readFileSync(resolve("contracts/schemas", schemaFile), "utf8"));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

  expect(validate(envelope), JSON.stringify(validate.errors)).toBe(true);
}

function expectNoForbiddenProperties(value: unknown, forbidden: readonly string[]): void {
  if (Array.isArray(value)) {
    for (const entry of value) expectNoForbiddenProperties(entry, forbidden);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    expect(forbidden).not.toContain(key);
    expectNoForbiddenProperties(entry, forbidden);
  }
}

async function startServer(): Promise<{ baseUrl: string; server: Server }> {
  const server = createApiServer(createP1Store());
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("test server did not bind to a TCP port");
  }

  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

async function request<TData>(
  baseUrl: string,
  path: string,
  options: { body?: unknown; method?: string; token?: string } = {}
): Promise<{ body: ApiEnvelope<TData>; status: number }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": "tenant_demo"
  });

  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers,
    method: options.method ?? "GET"
  });

  return { body: (await response.json()) as ApiEnvelope<TData>, status: response.status };
}

async function login(baseUrl: string, username: string, password: string): Promise<string> {
  const response = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    body: { password, username },
    method: "POST"
  });

  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

describe("M1 handler contract conformance", () => {
  it("validates decision, error, and role-projected result responses through the HTTP server", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const runResponse = await request<{ round: Round; run: Run }>(
        baseUrl,
        "/api/v1/courses/course_demo/runs",
        { method: "POST", token: teacherToken }
      );
      expect(runResponse.status).toBe(201);
      const run = runResponse.body.data.run;

      const unauthenticatedDecision = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: { decision_payload: validDecisionPayload, team_id: "team_alpha" },
          method: "POST"
        }
      );
      expect(unauthenticatedDecision.status).toBe(401);
      expectEnvelopeToMatchSchema("api-error-envelope.v1.json", unauthenticatedDecision.body);

      const startResponse = await request<Round>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/start`,
        { method: "POST", token: teacherToken }
      );
      expect(startResponse.status).toBe(200);

      const decisionResponse = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: { decision_payload: validDecisionPayload, team_id: "team_alpha" },
          method: "POST",
          token: studentToken
        }
      );
      expect(decisionResponse.status).toBe(201);
      expectEnvelopeToMatchSchema(
        "m1-decision-submit-success-envelope.v1.json",
        decisionResponse.body
      );

      const lockResponse = await request<Round>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/lock`,
        { method: "POST", token: teacherToken }
      );
      expect(lockResponse.status).toBe(200);

      const settlementResponse = await request<SettlementResult>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/settle`,
        { method: "POST", token: teacherToken }
      );
      expect(settlementResponse.status).toBe(200);

      const publishResponse = await request<Round>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/publish`,
        { method: "POST", token: teacherToken }
      );
      expect(publishResponse.status).toBe(200);

      const teacherResults = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        { token: teacherToken }
      );
      expect(teacherResults.status).toBe(200);
      expectEnvelopeToMatchSchema("m1-teacher-admin-result-envelope.v1.json", teacherResults.body);

      const studentResults = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        { token: studentToken }
      );
      expect(studentResults.status).toBe(200);
      expectEnvelopeToMatchSchema("m1-student-result-envelope.v1.json", studentResults.body);
      expect(JSON.stringify(studentResults.body.data)).not.toContain("state_true");
      expect(JSON.stringify(studentResults.body.data)).not.toContain("replay_evidence");
      expect(JSON.stringify(studentResults.body.data)).not.toContain("canonical_evidence_digest");

      const teacherWorkspace = await request<unknown>(
        baseUrl,
        `/api/v1/bff/teacher/runs/${run.run_id}/rounds/1/workspace`,
        { token: teacherToken }
      );
      expect(teacherWorkspace.status).toBe(200);
      expectEnvelopeToMatchSchema(
        "m1-teacher-bff-workspace-envelope.v1.json",
        teacherWorkspace.body
      );

      const studentCockpit = await request<unknown>(
        baseUrl,
        `/api/v1/bff/student/runs/${run.run_id}/rounds/1/cockpit`,
        { token: studentToken }
      );
      expect(studentCockpit.status).toBe(200);
      expectEnvelopeToMatchSchema("m1-student-bff-cockpit-envelope.v1.json", studentCockpit.body);
      expectNoForbiddenProperties(studentCockpit.body.data, [
        "state_true",
        "replay_evidence",
        "canonical_evidence_digest",
        "decision_batch_hash",
        "json_runtime_source_digest"
      ]);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
