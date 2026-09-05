import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession } from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store } from "../../services/api/src/store";

async function startServer(): Promise<{ baseUrl: string; server: Server }> {
  const server = createApiServer(createP1Store());
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  token: string,
  method = "GET",
  body?: unknown
): Promise<{ status: number; body: T }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-tenant-id": "tenant_demo"
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: response.status, body: (await response.json()) as T };
}

async function login(baseUrl: string): Promise<string> {
  const result = await requestJson<ApiEnvelope<AuthSession>>(
    baseUrl,
    "/api/v1/auth/login",
    "",
    "POST",
    { password: "admin", username: "admin" }
  );
  expect(result.status).toBe(200);
  return result.body.data.access_token;
}

describe("O10 portfolio changeset BFF", () => {
  it("compiles a selected course into a query-only request and handoff", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const token = await login(baseUrl);
      const portfolio = await requestJson<ApiEnvelope<{ portfolio_state_digest: string }>>(
        baseUrl,
        "/api/v1/bff/admin/model-qualification/course-portfolio",
        token
      );
      const result = await requestJson<
        ApiEnvelope<{
          schema_version: string;
          request: {
            status: string;
            selected_course_ids: string[];
            request_persisted: false;
            handoff_executed: false;
            apply: false;
            bulk_apply: false;
            cross_course_transaction: false;
          };
          handoffs: Array<{ course_id: string; apply: false; handoff_executed: false }>;
        }>
      >(
        baseUrl,
        "/api/v1/bff/admin/model-qualification/course-portfolio/changeset-request",
        token,
        "POST",
        {
          course_ids: ["course_demo"],
          expected_portfolio_state_digest: portfolio.body.data.portfolio_state_digest
        }
      );
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      expect(result.body.data).toMatchObject({
        schema_version: "model-qualification-portfolio-changeset-response.v1",
        request: {
          selected_course_ids: ["course_demo"],
          request_persisted: false,
          handoff_executed: false,
          apply: false,
          bulk_apply: false,
          cross_course_transaction: false
        }
      });
      expect(result.body.data.handoffs).toEqual([
        expect.objectContaining({ course_id: "course_demo", apply: false, handoff_executed: false })
      ]);
    } finally {
      server.close();
    }
  });

  it("returns a rebase result for a stale portfolio digest and does not expose O10 to Student", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const token = await login(baseUrl);
      const stale = await requestJson<ApiEnvelope<{ request: { status: string } }>>(
        baseUrl,
        "/api/v1/bff/admin/model-qualification/course-portfolio/changeset-request",
        token,
        "POST",
        { course_ids: ["course_demo"], expected_portfolio_state_digest: "f".repeat(64) }
      );
      expect(stale.status).toBe(200);
      expect(stale.body.data.request.status).toBe("REBASE_REQUIRED");

      const student = await requestJson<unknown>(
        baseUrl,
        "/api/v1/bff/student/model-qualification/course-portfolio/changeset-request",
        token,
        "POST",
        { course_ids: ["course_demo"], expected_portfolio_state_digest: "f".repeat(64) }
      );
      expect(student.status).toBe(404);
    } finally {
      server.close();
    }
  });
});
