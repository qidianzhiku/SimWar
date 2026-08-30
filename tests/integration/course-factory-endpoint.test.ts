import { once } from "node:events";
import { type Server } from "node:http";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession } from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { DEFAULT_TENANT_ID, createP1Store } from "../../services/api/src/store";

async function requestJson<T>(
  baseUrl: string,
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {}
): Promise<{ status: number; body: T }> {
  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers: {
      authorization: options.token ? `Bearer ${options.token}` : "",
      "content-type": "application/json",
      "x-tenant-id": DEFAULT_TENANT_ID
    },
    method: options.method ?? "GET"
  });
  return { body: (await response.json()) as T, status: response.status };
}

async function login(baseUrl: string, username: string, password: string): Promise<AuthSession> {
  const response = await requestJson<ApiEnvelope<AuthSession>>(baseUrl, "/api/v1/auth/login", {
    method: "POST",
    body: { password, username }
  });
  expect(response.status).toBe(200);
  return response.body.data;
}

async function startServer(): Promise<{ baseUrl: string; server: Server }> {
  const server = createApiServer(createP1Store());
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

describe("Course Factory API and BFF endpoints", () => {
  it("serves admin, teacher and sponsor projections through the existing runtime and denies learners", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const admin = await login(baseUrl, "admin", "admin");
      const teacher = await login(baseUrl, "teacher", "teacher");
      const student = await login(baseUrl, "student", "student");

      const adminCatalog = await requestJson<ApiEnvelope<{ catalog: readonly unknown[] }>>(
        baseUrl,
        "/api/v1/admin/course-factory/catalog",
        { token: admin.access_token }
      );
      expect(adminCatalog.status).toBe(200);
      expect(adminCatalog.body.data.catalog).toEqual([]);

      const teacherCatalog = await requestJson<ApiEnvelope<{ catalog: readonly unknown[] }>>(
        baseUrl,
        "/api/v1/bff/teacher/course-factory/catalog",
        { token: teacher.access_token }
      );
      expect(teacherCatalog.status).toBe(200);
      expect(teacherCatalog.body.data.catalog).toEqual([]);

      const sponsor = await requestJson<
        ApiEnvelope<{
          delivery_progress: Record<string, number>;
          evidence_pack: { private_data_included: false };
        }>
      >(baseUrl, "/api/v1/bff/enterprise/course-factory/sponsor", {
        token: admin.access_token
      });
      expect(sponsor.status).toBe(200);
      expect(sponsor.body.data.delivery_progress).toMatchObject({
        active_runs: 0,
        published_versions: 0,
        round_count: 0
      });
      expect(sponsor.body.data.delivery_progress.course_count).toBeGreaterThanOrEqual(1);
      expect(sponsor.body.data.evidence_pack.private_data_included).toBe(false);

      const learner = await requestJson<{ code: string }>(
        baseUrl,
        "/api/v1/admin/course-factory/catalog",
        { token: student.access_token }
      );
      expect(learner.status).toBe(403);
      expect(learner.body.code).toBe("COURSE_FACTORY_RIGHTS_SCOPE_VIOLATION");

      const malformed = await requestJson<{ code: string }>(
        baseUrl,
        "/api/v1/admin/course-factory/versions",
        { method: "POST", token: admin.access_token, body: { title: "missing exact inputs" } }
      );
      expect(malformed.status).toBe(422);
      expect(malformed.body.code).toBe("COURSE_FACTORY_INPUT_INVALID");
    } finally {
      await stopServer(server);
    }
  });
});
