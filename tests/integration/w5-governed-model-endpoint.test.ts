import { once } from "node:events";
import { request as nodeRequest } from "node:http";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession, Round, Run } from "../../packages/shared-contracts/src";
import { W5_MODEL_VERSION_REF } from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { DEFAULT_TENANT_ID, OTHER_TENANT_ID, createP1Store } from "../../services/api/src/store";

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

async function login(
  baseUrl: string,
  username: string,
  password: string,
  tenantId = DEFAULT_TENANT_ID
) {
  const response = await requestJson<ApiEnvelope<AuthSession>>(`${baseUrl}/api/v1/auth/login`, {
    body: { password, username },
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return response.body.data;
}

async function startServer() {
  const store = createP1Store();
  const run: Run = {
    course_id: "course_demo",
    parameter_set_id: "param_toy_approved_1",
    run_id: "run_w5_demo",
    scenario_package_id: "scenario_eldercare_demo",
    seed: 20260820,
    status: "active",
    tenant_id: DEFAULT_TENANT_ID
  };
  const round: Round = {
    round_id: "round_w5_demo_1",
    round_no: 1,
    run_id: run.run_id,
    status: "open",
    tenant_id: DEFAULT_TENANT_ID
  };
  store.runs.push(run);
  store.rounds.push(round);
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function api<T>(
  baseUrl: string,
  path: string,
  token: string,
  method = "GET",
  body?: unknown,
  tenantId = DEFAULT_TENANT_ID
) {
  return requestJson<T>(`${baseUrl}${path}`, {
    body,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-tenant-id": tenantId
    },
    method
  });
}

describe("W5 governed model BFF", () => {
  it("runs the teacher lifecycle, exact binding, Standard/Advanced parity and student-safe projection", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const teacher = await login(baseUrl, "teacher", "teacher");
      const student = await login(baseUrl, "student", "student");
      const created = await api<ApiEnvelope<{ draft: { draft_id: string; status: string } }>>(
        baseUrl,
        "/api/v1/bff/teacher/w5/scenario-studio/drafts",
        teacher.access_token,
        "POST",
        { course_id: "course_demo", title: "上海 Standard Advanced" }
      );
      expect(created.status).toBe(201);
      const draftId = created.body.data.draft.draft_id;

      const validated = await api<ApiEnvelope<{ draft: { status: string } }>>(
        baseUrl,
        `/api/v1/bff/teacher/w5/scenario-studio/drafts/${draftId}/validate`,
        teacher.access_token,
        "POST"
      );
      expect(validated.status).toBe(200);
      expect(validated.body.data.draft.status).toBe("VALIDATED");

      const frozen = await api<ApiEnvelope<{ draft: { status: string } }>>(
        baseUrl,
        `/api/v1/bff/teacher/w5/scenario-studio/drafts/${draftId}/freeze`,
        teacher.access_token,
        "POST"
      );
      expect(frozen.status).toBe(200);
      expect(frozen.body.data.draft.status).toBe("FROZEN");

      const bound = await api<
        ApiEnvelope<{ draft: { status: string; exact_runtime_binding: unknown } }>
      >(
        baseUrl,
        `/api/v1/bff/teacher/w5/scenario-studio/drafts/${draftId}/bind`,
        teacher.access_token,
        "POST",
        { round_no: 1, run_id: "run_w5_demo", seed: 20260820 }
      );
      expect(bound.status).toBe(200);
      expect(bound.body.data.draft.status).toBe("BOUND");
      expect(bound.body.data.draft.exact_runtime_binding).toBeTruthy();
      expect(store.w5GovernedModelDrafts?.find((draft) => draft.draft_id === draftId)?.status).toBe(
        "BOUND"
      );
      expect(
        store.auditLogs
          .filter((audit) => audit.resource_id === draftId)
          .map((audit) => audit.action)
      ).toEqual(["w5.create_draft", "w5.validate", "w5.freeze", "w5.bind"]);

      const standard = await api<
        ApiEnvelope<{
          convergence: { realized: { replay_relevant_digest: string }; experience_profile: string };
        }>
      >(
        baseUrl,
        `/api/v1/bff/teacher/w5/scenario-studio/drafts/${draftId}/evaluate`,
        teacher.access_token,
        "POST",
        { round_no: 1, run_id: "run_w5_demo", experience_profile: "STANDARD" }
      );
      const advanced = await api<
        ApiEnvelope<{
          convergence: { realized: { replay_relevant_digest: string }; experience_profile: string };
        }>
      >(
        baseUrl,
        `/api/v1/bff/teacher/w5/scenario-studio/drafts/${draftId}/evaluate`,
        teacher.access_token,
        "POST",
        { round_no: 1, run_id: "run_w5_demo", experience_profile: "ADVANCED" }
      );
      expect(standard.status).toBe(200);
      expect(advanced.status).toBe(200);
      expect(standard.body.data.convergence.experience_profile).toBe("STANDARD");
      expect(advanced.body.data.convergence.experience_profile).toBe("ADVANCED");
      expect(standard.body.data.convergence.realized.replay_relevant_digest).toBe(
        advanced.body.data.convergence.realized.replay_relevant_digest
      );

      const studentProjection = await api<ApiEnvelope<Record<string, unknown>>>(
        baseUrl,
        `/api/v1/bff/student/w5/convergence?draftId=${draftId}&runId=run_w5_demo&roundNo=1`,
        student.access_token
      );
      expect(studentProjection.status).toBe(200);
      const serializedStudent = JSON.stringify(studentProjection.body.data);
      expect(serializedStudent).toContain("ROLE_SAFE_STUDENT");
      expect(serializedStudent).not.toContain("parameter_values");
      expect(serializedStudent).not.toContain("content_digest");
      expect(serializedStudent).toContain("SIMULATION_CORE");
      expect(serializedStudent).toContain("READY_WITH_LIMITS");
      expect(serializedStudent).toContain("demand_realization");

      const admin = await login(baseUrl, "admin", "admin");
      const adminProjection = await api<ApiEnvelope<Record<string, unknown>>>(
        baseUrl,
        "/api/v1/bff/admin/w5/governed-model?courseId=course_demo",
        admin.access_token
      );
      expect(adminProjection.status).toBe(200);
      expect(JSON.stringify(adminProjection.body.data)).toContain(
        "W5_ADMIN_GOVERNED_MODEL_AUDIT_GET_V1"
      );
      expect(JSON.stringify(adminProjection.body.data)).toContain(W5_MODEL_VERSION_REF);
      expect(JSON.stringify(adminProjection.body.data)).toContain("SIMULATION_CORE");
      expect(JSON.stringify(adminProjection.body.data)).toContain("JSON_INTERNAL_ONLY");

      const enrolledRun = store.runs.find((candidate) => candidate.run_id === "run_w5_demo");
      if (!enrolledRun) throw new Error("W5 test run was not stored");
      const unenrolledRun: Run = {
        ...enrolledRun,
        course_id: "course_without_team",
        run_id: "run_w5_unenrolled"
      };
      const enrolledRound = store.rounds.find((candidate) => candidate.run_id === "run_w5_demo");
      if (!enrolledRound) throw new Error("W5 test round was not stored");
      const unenrolledRound: Round = {
        ...enrolledRound,
        round_id: "round_w5_unenrolled_1",
        run_id: unenrolledRun.run_id
      };
      store.runs.push(unenrolledRun);
      store.rounds.push(unenrolledRound);
      const unenrolled = await api<Record<string, unknown>>(
        baseUrl,
        `/api/v1/bff/student/w5/convergence?draftId=${draftId}&runId=${unenrolledRun.run_id}&roundNo=1`,
        student.access_token
      );
      expect(unenrolled.status).toBe(403);

      const crossTenant = await api<Record<string, unknown>>(
        baseUrl,
        `/api/v1/bff/teacher/w5/scenario-studio/drafts/${draftId}/validate`,
        teacher.access_token,
        "POST",
        undefined,
        OTHER_TENANT_ID
      );
      expect(crossTenant.status).toBe(403);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
