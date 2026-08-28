import { once } from "node:events";
import { request as nodeRequest } from "node:http";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession, Round, Run } from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { DEFAULT_TENANT_ID, createP1Store } from "../../services/api/src/store";

interface JsonOptions {
  body?: unknown;
  headers?: Record<string, string>;
  method?: string;
}

async function requestJson<T>(
  url: string,
  options: JsonOptions = {}
): Promise<{ body: T; status: number }> {
  return new Promise((resolve, reject) => {
    const request = nodeRequest(
      url,
      { headers: options.headers, method: options.method ?? "GET" },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          try {
            resolve({
              body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as T,
              status: response.statusCode ?? 0
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("error", reject);
    if (options.body !== undefined) request.write(JSON.stringify(options.body));
    request.end();
  });
}

async function api<T>(
  baseUrl: string,
  path: string,
  token: string | undefined,
  method = "GET",
  body?: unknown
) {
  return requestJson<T>(`${baseUrl}${path}`, {
    body,
    headers: {
      authorization: token ? `Bearer ${token}` : "",
      "content-type": "application/json",
      "x-tenant-id": DEFAULT_TENANT_ID
    },
    method
  });
}

async function login(baseUrl: string, username: string, password: string) {
  const result = await api<ApiEnvelope<AuthSession>>(
    baseUrl,
    "/api/v1/auth/login",
    undefined,
    "POST",
    { password, username }
  );
  expect(result.status).toBe(200);
  return result.body.data.access_token;
}

async function lifecycleDraft(
  baseUrl: string,
  teacherToken: string,
  runId: string,
  roundNo: number
) {
  const created = await api<ApiEnvelope<{ draft: { draft_id: string } }>>(
    baseUrl,
    "/api/v1/bff/teacher/w5/scenario-studio/drafts",
    teacherToken,
    "POST",
    { course_id: "course_demo", title: `Shanghai O1 round ${roundNo} governed demand` }
  );
  expect(created.status).toBe(201);
  const draftId = created.body.data.draft.draft_id;

  const validated = await api<ApiEnvelope<unknown>>(
    baseUrl,
    `/api/v1/bff/teacher/w5/scenario-studio/drafts/${draftId}/validate`,
    teacherToken,
    "POST"
  );
  expect(validated.status).toBe(200);

  const frozen = await api<ApiEnvelope<unknown>>(
    baseUrl,
    `/api/v1/bff/teacher/w5/scenario-studio/drafts/${draftId}/freeze`,
    teacherToken,
    "POST"
  );
  expect(frozen.status).toBe(200);

  const bound = await api<ApiEnvelope<unknown>>(
    baseUrl,
    `/api/v1/bff/teacher/w5/scenario-studio/drafts/${draftId}/bind`,
    teacherToken,
    "POST",
    { round_no: roundNo, run_id: runId }
  );
  expect(bound.status).toBe(200);
  return draftId;
}

describe("MAIN-SH-FV-O1 governed Shanghai full vertical real-BFF", () => {
  it("keeps one exact W5 binding visible across Teacher, Student and Admin surfaces", async () => {
    const store = createP1Store();
    const server = createApiServer(store);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const adminToken = await login(baseUrl, "admin", "admin");

      const catalog = await api<ApiEnvelope<Record<string, unknown>>>(
        baseUrl,
        "/api/v1/bff/teacher/shanghai/full-vertical?courseId=course_demo",
        teacherToken
      );
      expect(catalog.status).toBe(200);
      expect(catalog.body.data.status).toBe("NOT_READY");
      expect(catalog.body.data.surface).toBe("TEACHER");

      const createdRun = await api<ApiEnvelope<{ run: Run; round: Round }>>(
        baseUrl,
        "/api/v1/courses/course_demo/runs",
        teacherToken,
        "POST"
      );
      expect(createdRun.status).toBe(201);
      const runId = createdRun.body.data.run.run_id;
      const draftId = await lifecycleDraft(baseUrl, teacherToken, runId, 1);

      const evaluated = await api<ApiEnvelope<unknown>>(
        baseUrl,
        `/api/v1/bff/teacher/w5/scenario-studio/drafts/${draftId}/evaluate`,
        teacherToken,
        "POST",
        { experience_profile: "STANDARD", round_no: 1, run_id: runId }
      );
      expect(evaluated.status).toBe(200);

      const exactQuery = `courseId=course_demo&draftId=${draftId}&runId=${runId}&roundNo=1`;
      const teacher = await api<ApiEnvelope<Record<string, unknown>>>(
        baseUrl,
        `/api/v1/bff/teacher/shanghai/full-vertical?${exactQuery}`,
        teacherToken
      );
      expect(teacher.status).toBe(200);
      expect(teacher.body.data.status).toBe("READY_WITH_LIMITS");
      expect(teacher.body.data.journey).toMatchObject({
        exact_binding: true,
        teacher_preview: "READY"
      });

      const student = await api<ApiEnvelope<Record<string, unknown>>>(
        baseUrl,
        `/api/v1/bff/student/shanghai/full-vertical?draftId=${draftId}&runId=${runId}&roundNo=1`,
        studentToken
      );
      expect(student.status).toBe(200);
      expect(student.body.data.status).toBe("READY_WITH_LIMITS");
      expect(student.body.data.surface).toBe("STUDENT");
      expect(student.body.data.projection).toHaveProperty("visibility", "ROLE_SAFE_STUDENT");
      expect(JSON.stringify(student.body.data)).not.toContain("parameter_values");
      expect(JSON.stringify(student.body.data)).not.toContain("content_digest");

      const admin = await api<ApiEnvelope<Record<string, unknown>>>(
        baseUrl,
        `/api/v1/bff/admin/shanghai/full-vertical?${exactQuery}`,
        adminToken
      );
      expect(admin.status).toBe(200);
      expect(admin.body.data.status).toBe("READY_WITH_LIMITS");
      expect(admin.body.data.surface).toBe("ADMIN");
      expect(admin.body.data.binding).toHaveProperty("status", "BOUND");
      expect(admin.body.data.preview).toHaveProperty("realized.authority", "SIMULATION_CORE");

      const wrongRound = await api<ApiEnvelope<Record<string, unknown>>>(
        baseUrl,
        `/api/v1/bff/student/shanghai/full-vertical?draftId=${draftId}&runId=${runId}&roundNo=2`,
        studentToken
      );
      expect(wrongRound.status).toBe(422);
      expect(wrongRound.body.code).toBe("W5_EXACT_BINDING_REQUIRED");
    } finally {
      server.close();
      await once(server, "close");
    }
  }, 30_000);
});
