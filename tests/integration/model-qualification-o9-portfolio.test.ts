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
  body?: unknown,
  tenantId = "tenant_demo"
): Promise<{ status: number; body: T }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-tenant-id": tenantId
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: response.status, body: (await response.json()) as T };
}

async function login(baseUrl: string): Promise<string> {
  const response = await requestJson<ApiEnvelope<AuthSession>>(
    baseUrl,
    "/api/v1/auth/login",
    "",
    "POST",
    { password: "admin", username: "admin" }
  );
  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

describe("O9 course portfolio and supersession preview BFF", () => {
  it("derives a tenant course portfolio from Course Authority and keeps the Student surface absent", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const token = await login(baseUrl);
      const portfolio = await requestJson<
        ApiEnvelope<{
          tenant_id: string;
          courses: Array<{ course_id: string; tenant_id: string }>;
          portfolio_state_digest: string;
          derived: true;
          query_only: true;
          provider: "OFF";
        }>
      >(baseUrl, "/api/v1/bff/admin/model-qualification/course-portfolio", token);

      expect(portfolio.status, JSON.stringify(portfolio.body)).toBe(200);
      expect(portfolio.body.data).toMatchObject({
        derived: true,
        provider: "OFF",
        query_only: true,
        tenant_id: "tenant_demo"
      });
      expect(portfolio.body.data.portfolio_state_digest).toMatch(/^[a-f0-9]{64}$/u);
      expect(portfolio.body.data.courses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            course: expect.objectContaining({ course_id: "course_demo" })
          })
        ])
      );

      const student = await requestJson<unknown>(
        baseUrl,
        "/api/v1/bff/student/model-qualification/course-portfolio",
        token
      );
      expect(student.status).toBe(404);
    } finally {
      server.close();
    }
  });

  it("returns a deterministic no-mutation supersession preview and rebases stale selections", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const token = await login(baseUrl);
      const initial = await requestJson<ApiEnvelope<{ portfolio_state_digest: string }>>(
        baseUrl,
        "/api/v1/bff/admin/model-qualification/course-portfolio",
        token
      );
      expect(initial.status).toBe(200);
      const digest = initial.body.data.portfolio_state_digest;

      const preview = await requestJson<
        ApiEnvelope<{
          status: string;
          derived: true;
          query_only: true;
          preview_applied: false;
          expected_portfolio_state_digest: string;
        }>
      >(
        baseUrl,
        "/api/v1/bff/admin/model-qualification/course-portfolio/supersession-preview",
        token,
        "POST",
        { course_ids: ["course_demo"], expected_portfolio_state_digest: digest }
      );
      expect(preview.status, JSON.stringify(preview.body)).toBe(200);
      expect(preview.body.data).toMatchObject({
        derived: true,
        preview_applied: false,
        query_only: true,
        status: "BLOCKED"
      });

      const stale = await requestJson<ApiEnvelope<{ status: string }>>(
        baseUrl,
        "/api/v1/bff/admin/model-qualification/course-portfolio/supersession-preview",
        token,
        "POST",
        { course_ids: ["course_demo"], expected_portfolio_state_digest: "f".repeat(64) }
      );
      expect(stale.status).toBe(200);
      expect(stale.body.data.status).toBe("REBASE_REQUIRED");
    } finally {
      server.close();
    }
  });
});
