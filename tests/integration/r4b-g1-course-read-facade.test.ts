import { once } from "node:events";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import { describe, expect, it, vi } from "vitest";
import type { ApiEnvelope, AuthSession, Course } from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createJsonRepositoryProvider } from "../../services/api/src/repository-provider";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

async function startServer(
  store: SimWarStore = createP1Store(),
  options: Parameters<typeof createApiServer>[1] = {}
): Promise<{ baseUrl: string; server: Server }> {
  const server = createApiServer(store, options);
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

describe("R4b G1 course read facade slice", () => {
  it("reads course details through the repository facade without falling back to the concrete store", async () => {
    const store = createP1Store();
    const course = store.courses.find((candidate) => candidate.course_id === "course_demo");
    expect(course).toBeDefined();

    const provider = createJsonRepositoryProvider({ store });
    const getCourse = vi.fn(async (tenantId: string, courseId: string) =>
      tenantId === course?.tenant_id && courseId === course.course_id ? course : null
    );
    provider.facade.courses.getCourse = getCourse;
    store.courses = [];

    const { baseUrl, server } = await startServer(store, { repositoryProvider: provider });

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const response = await request<Course>(baseUrl, "/api/v1/courses/course_demo", {
        token: teacherToken
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(course);
      expect(JSON.stringify(response.body.data)).not.toContain("state_true");
      expect(JSON.stringify(response.body.data)).not.toContain("decision_batch_hash");
      expect(JSON.stringify(response.body.data)).not.toContain("json_runtime_source_digest");
      expect(JSON.stringify(response.body.data)).not.toContain("canonical_evidence_digest");
      expect(getCourse).toHaveBeenCalledWith("tenant_demo", "course_demo");
    } finally {
      await stopServer(server);
    }
  });

  it("preserves course read not-found, auth, and tenant boundaries", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");

      const missing = await request<unknown>(baseUrl, "/api/v1/courses/missing-course", {
        token: teacherToken
      });
      expect(missing.status).toBe(404);
      expect(missing.body.code).toBe("COURSE-404-001");

      const unauthenticated = await request<unknown>(baseUrl, "/api/v1/courses/course_demo");
      expect(unauthenticated.status).toBe(401);
      expect(unauthenticated.body.code).toBe("AUTH-401-001");

      const crossTenant = await request<unknown>(baseUrl, "/api/v1/courses/course_demo", {
        token: teacherToken,
        tenantId: "tenant_other"
      });
      expect(crossTenant.status).toBe(403);
      expect(crossTenant.body.code).toBe("TENANT-403-001");
    } finally {
      await stopServer(server);
    }
  });

  it("keeps the course read helper behind the repository facade boundary", () => {
    const serverSource = readFileSync(
      new URL("../../services/api/src/server.ts", import.meta.url),
      "utf8"
    );
    const courseReadSource = serverSource.slice(
      serverSource.indexOf("async function getCourseForRead"),
      serverSource.indexOf("function getRun")
    );

    expect(courseReadSource).toContain("runtime.repositoryProvider.facade.courses.getCourse(");
    expect(courseReadSource).not.toContain("runtime.store.courses.find");
    expect(courseReadSource).not.toContain("store.courses.find");
    expect(serverSource).not.toContain("DATABASE_URL");
  });
});
