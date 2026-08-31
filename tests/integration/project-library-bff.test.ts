import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession, ProjectProfile } from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { getShanghaiMarketWorldReference } from "../../services/api/src/market-world-product";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

async function request<T>(
  baseUrl: string,
  path: string,
  options: { body?: unknown; method?: string; token?: string; tenantId?: string } = {}
): Promise<{ body: ApiEnvelope<T>; status: number }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": options.tenantId ?? "tenant_demo"
  });
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? (options.body === undefined ? "GET" : "POST")
  });
  return { body: (await response.json()) as ApiEnvelope<T>, status: response.status };
}

async function login(baseUrl: string, username: string): Promise<string> {
  const result = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    body: { password: username, username }
  });
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  return result.body.data.access_token;
}

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  store.courses[0]!.market_world_reference = getShanghaiMarketWorldReference();
  store.runs.push({
    course_id: "course_demo",
    parameter_set_id: "param_toy_approved_1",
    run_id: "run_project_library",
    scenario_package_id: "scenario_eldercare_demo",
    seed: 7,
    status: "active",
    tenant_id: "tenant_demo"
  });
  store.rounds.push({
    round_id: "round_project_library",
    round_no: 1,
    run_id: "run_project_library",
    status: "open",
    tenant_id: "tenant_demo"
  });
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

const profilePayload = {
  customer_segment: "上海城市养老照护家庭",
  description: "Safe normalized teaching project.",
  geography: "Shanghai",
  industry: "eldercare",
  market_world_reference: getShanghaiMarketWorldReference(),
  positioning: "连续可信的照护服务",
  project_profile_id: "shanghai-project-api",
  service_bundle: "社区照护与居家支持",
  starting_capacity: 100,
  starting_cash: 100000,
  template_id: "shanghai-eldercare-safe-v1",
  title: "Shanghai Care API",
  version: "2026-08-21.1"
};

describe("Project Library BFF", () => {
  it("runs the teacher -> exact assignment -> student safe brief -> admin audit journey", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const studentToken = await login(baseUrl, "student");
      const adminToken = await login(baseUrl, "admin");

      const emptyBrief = await request(
        baseUrl,
        "/api/v1/bff/student/project-brief?course_id=course_demo&run_id=run_project_library&team_id=team_alpha",
        { token: studentToken }
      );
      expect(emptyBrief.status).toBe(200);
      expect(emptyBrief.body.data).toBeNull();

      const created = await request<ProjectProfile>(
        baseUrl,
        "/api/v1/bff/teacher/courses/course_demo/project-library",
        { body: { project_profile: profilePayload }, token: teacherToken }
      );
      expect(created.status).toBe(201);
      expect(created.body.data.status).toBe("DRAFT");

      const profile = created.body.data;
      const profileRef = {
        content_digest: profile.content_digest,
        project_profile_id: profile.project_profile_id,
        tenant_id: profile.tenant_id,
        version: profile.version
      };
      const validated = await request<ProjectProfile>(
        baseUrl,
        "/api/v1/bff/teacher/courses/course_demo/project-library/validate",
        { body: { project_profile_ref: profileRef }, token: teacherToken }
      );
      expect(validated.status).toBe(200);
      expect(validated.body.data.status).toBe("VALIDATED");

      const assigned = await request(
        baseUrl,
        "/api/v1/bff/teacher/courses/course_demo/project-library/assign",
        {
          body: {
            project_profile_ref: profileRef,
            run_id: "run_project_library",
            team_id: "team_alpha"
          },
          token: teacherToken
        }
      );
      expect(assigned.status).toBe(200);
      expect(assigned.body.data.idempotent).toBe(false);

      const brief = await request(
        baseUrl,
        "/api/v1/bff/student/project-brief?course_id=course_demo&run_id=run_project_library&team_id=team_alpha",
        { token: studentToken }
      );
      expect(brief.status).toBe(200);
      expect(brief.body.data.project_profile_reference).toEqual(profileRef);
      expect(brief.body.data.decision_context_evidence_required).toBe(false);
      expect(JSON.stringify(brief.body.data)).not.toMatch(
        /raw_source|private|state_true|score|rank|settlement_result|other_team_data/i
      );

      const audit = await request(baseUrl, "/api/v1/bff/admin/project-library", {
        token: adminToken
      });
      expect(audit.status).toBe(200);
      expect(audit.body.data.assignments).toHaveLength(1);
      expect(audit.body.data.profiles).toEqual(
        expect.arrayContaining([expect.objectContaining({ status: "VALIDATED" })])
      );
      expect(store.w4.states).toHaveLength(1);
      expect(store.w4.states[0]?.state.cash).toBe(100000);
    } finally {
      server.close();
    }
  });

  it("rejects unsafe imports and cross-role reads", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const studentToken = await login(baseUrl, "student");
      const unsafe = await request(
        baseUrl,
        "/api/v1/bff/teacher/courses/course_demo/project-library/import",
        {
          body: { project_profile: { ...profilePayload, raw_source_path: "D:/restricted" } },
          token: teacherToken
        }
      );
      expect(unsafe.status).toBe(422);
      expect(unsafe.body.code).toBe("PROJECT_PROFILE_IMPORT_INVALID");

      const adminAttempt = await request(baseUrl, "/api/v1/bff/admin/project-library", {
        token: studentToken
      });
      expect(adminAttempt.status).toBe(403);
    } finally {
      server.close();
    }
  });
});
