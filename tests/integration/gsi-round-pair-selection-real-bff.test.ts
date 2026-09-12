import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  GSICrossRoundPairOptions,
  GSICrossRoundStudentProjection,
  GSICrossRoundTeacherProjection,
  GSIReceipt
} from "@simwar/shared-contracts";
import { createApiServer } from "../../services/api/src/server";
import { DEFAULT_TENANT_ID, createP1Store, type SimWarStore } from "../../services/api/src/store";

interface RequestOptions {
  body?: unknown;
  method?: string;
  token?: string;
  tenantId?: string;
}

async function request<T>(
  baseUrl: string,
  path: string,
  options: RequestOptions = {}
): Promise<{ body: ApiEnvelope<T>; status: number }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": options.tenantId ?? DEFAULT_TENANT_ID
  });
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? "GET"
  });
  return { body: (await response.json()) as ApiEnvelope<T>, status: response.status };
}

async function login(baseUrl: string, username: string): Promise<string> {
  const response = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    body: { password: username, username },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

function binding(roundId: string) {
  return {
    tenant_id: DEFAULT_TENANT_ID,
    course_id: "course_demo",
    run_id: "run_gsi_pair_selection",
    round_id: roundId,
    team_id: "team_alpha",
    scenario_package_id: "scenario_eldercare_demo",
    scenario_version: "1.0.0",
    parameter_set_id: "param_toy_approved_1",
    parameter_set_version: "1.0.0",
    model_version_id: "gsi-stakeholder-resolver-v1",
    model_version: "1.0.0",
    model_artifact_id: "artifact:gsi-stakeholder-resolver-v1:1.0.0",
    model_artifact_version: "1.0.0"
  };
}

function candidateRequest(
  roundId: string,
  idempotencyKey: string,
  influence: number,
  publicationStatus: "DRAFT" | "PUBLISHED" = "PUBLISHED"
) {
  return {
    discriminator: "gsi_stakeholder_shadow_request",
    binding: binding(roundId),
    plane_mode: "OFF",
    publication_status: publicationStatus,
    proposals: [
      {
        proposal_id: `${idempotencyKey}_customer`,
        stakeholder_type: "customer",
        intent: "protect_demand",
        priority: 0.8,
        influence,
        summary: "Customers value predictable service."
      }
    ],
    idempotency_key: idempotencyKey
  };
}

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  store.runs = [
    {
      course_id: "course_demo",
      parameter_set_id: "param_toy_approved_1",
      run_id: "run_gsi_pair_selection",
      scenario_package_id: "scenario_eldercare_demo",
      seed: 20260911,
      status: "active",
      tenant_id: DEFAULT_TENANT_ID
    }
  ];
  store.rounds = [
    {
      round_id: "round_gsi_pair_1",
      round_no: 1,
      run_id: "run_gsi_pair_selection",
      status: "open",
      tenant_id: DEFAULT_TENANT_ID
    },
    {
      round_id: "round_gsi_pair_2",
      round_no: 2,
      run_id: "run_gsi_pair_selection",
      status: "open",
      tenant_id: DEFAULT_TENANT_ID
    },
    {
      round_id: "round_gsi_pair_3",
      round_no: 3,
      run_id: "run_gsi_pair_selection",
      status: "open",
      tenant_id: DEFAULT_TENANT_ID
    }
  ];
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function assignStudent(baseUrl: string, teacherToken: string): Promise<void> {
  const assignment = await request(baseUrl, "/api/v1/bff/teacher/role-workflows/assignments", {
    body: {
      course_id: "course_demo",
      role_key: "CEO",
      run_id: "run_gsi_pair_selection",
      team_id: "team_alpha",
      user_id: "usr_student"
    },
    method: "PUT",
    token: teacherToken
  });
  expect(assignment.status).toBe(201);
}

async function createCandidate(
  baseUrl: string,
  token: string,
  roundId: string,
  key: string,
  influence: number,
  publicationStatus: "DRAFT" | "PUBLISHED" = "PUBLISHED"
): Promise<GSIReceipt> {
  const result = await request<GSIReceipt>(baseUrl, "/api/v1/bff/teacher/gsi/candidates", {
    body: candidateRequest(roundId, key, influence, publicationStatus),
    method: "POST",
    token
  });
  expect(result.status).toBe(201);
  return result.body.data;
}

function optionsQuery() {
  return new URLSearchParams({
    course_id: "course_demo",
    run_id: "run_gsi_pair_selection",
    team_id: "team_alpha",
    activity_id: "activity_gsi_xr",
    role_key: "CEO"
  });
}

function roundCompareQuery(from: string, to: string) {
  return new URLSearchParams({
    course_id: "course_demo",
    run_id: "run_gsi_pair_selection",
    team_id: "team_alpha",
    from_round_id: from,
    to_round_id: to,
    activity_id: "activity_gsi_xr",
    role_key: "CEO"
  });
}

describe("GSI server-governed round pair selection real BFF", () => {
  it("returns safe round options and resolves one explicit pair for Teacher, Student and Admin", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const studentToken = await login(baseUrl, "student");
      const adminToken = await login(baseUrl, "admin");
      await assignStudent(baseUrl, teacherToken);
      const from = await createCandidate(
        baseUrl,
        teacherToken,
        "round_gsi_pair_1",
        "pair_from",
        0.2
      );
      const to = await createCandidate(baseUrl, teacherToken, "round_gsi_pair_2", "pair_to", 0.8);

      const teacherOptions = await request<GSICrossRoundPairOptions>(
        baseUrl,
        `/api/v1/bff/teacher/gsi/candidates/pair-options?${optionsQuery()}`,
        { token: teacherToken }
      );
      expect(teacherOptions.status).toBe(200);
      expect(teacherOptions.body.data.rounds).toEqual([
        { round_id: "round_gsi_pair_1", round_no: 1 },
        { round_id: "round_gsi_pair_2", round_no: 2 }
      ]);
      expect(JSON.stringify(teacherOptions.body.data)).not.toContain(from.candidate_id);
      expect(JSON.stringify(teacherOptions.body.data)).not.toContain(to.candidate_id);

      await createCandidate(
        baseUrl,
        teacherToken,
        "round_gsi_pair_3",
        "pair_hidden_draft",
        0.9,
        "DRAFT"
      );

      const studentOptions = await request<GSICrossRoundPairOptions>(
        baseUrl,
        `/api/v1/bff/student/gsi/candidates/pair-options?${optionsQuery()}`,
        { token: studentToken }
      );
      expect(studentOptions.status).toBe(200);
      expect(studentOptions.body.data.rounds).toHaveLength(2);
      expect(JSON.stringify(studentOptions.body.data)).not.toContain("candidate_id");
      expect(JSON.stringify(studentOptions.body.data)).not.toContain("candidate_digest");

      const query = roundCompareQuery("round_gsi_pair_1", "round_gsi_pair_2");
      const teacher = await request<GSICrossRoundTeacherProjection>(
        baseUrl,
        `/api/v1/bff/teacher/gsi/candidates/compare?${query}`,
        { token: teacherToken }
      );
      expect(teacher.status).toBe(200);
      expect(teacher.body.data.comparison.pair.from.candidate_id).toBe(from.candidate_id);
      expect(teacher.body.data.comparison.pair.to.candidate_id).toBe(to.candidate_id);
      expect(teacher.body.data.comparison.movements[0]?.direction).toBe("INCREASED");

      const student = await request<GSICrossRoundStudentProjection>(
        baseUrl,
        `/api/v1/bff/student/gsi/candidates/compare?${query}`,
        { token: studentToken }
      );
      expect(student.status).toBe(200);
      expect(student.body.data.movements[0]?.direction).toBe("INCREASED");
      const studentJson = JSON.stringify(student.body.data);
      expect(studentJson).not.toContain(from.candidate_id);
      expect(studentJson).not.toContain("candidate_digest");
      expect(studentJson).not.toContain("comparison_digest");

      const admin = await request<GSICrossRoundAdminProjection>(
        baseUrl,
        `/api/v1/bff/admin/gsi/candidates/compare?${query}`,
        { token: adminToken }
      );
      expect(admin.status).toBe(200);
      expect(admin.body.data.context.context_binding.tenant_id).toBe(DEFAULT_TENANT_ID);
      expect(admin.body.data.provider).toBe("OFF");
      expect(admin.body.data.official_truth_write).toBe(false);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });

  it("filters hidden Student records before exact-round uniqueness is evaluated", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const studentToken = await login(baseUrl, "student");
      await assignStudent(baseUrl, teacherToken);
      await createCandidate(baseUrl, teacherToken, "round_gsi_pair_1", "visible_from", 0.2);
      await createCandidate(
        baseUrl,
        teacherToken,
        "round_gsi_pair_1",
        "hidden_same_round_draft",
        0.95,
        "DRAFT"
      );
      await createCandidate(baseUrl, teacherToken, "round_gsi_pair_2", "visible_to", 0.8);

      const result = await request<GSICrossRoundStudentProjection>(
        baseUrl,
        `/api/v1/bff/student/gsi/candidates/compare?${roundCompareQuery(
          "round_gsi_pair_1",
          "round_gsi_pair_2"
        )}`,
        { token: studentToken }
      );

      expect(result.status).toBe(200);
      expect(result.body.data.movements[0]?.direction).toBe("INCREASED");
      const serialized = JSON.stringify(result.body.data);
      expect(serialized).not.toContain("hidden_same_round_draft");
      expect(serialized).not.toContain("candidate_id");
      expect(serialized).not.toContain("candidate_digest");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });

  it("does not expose ambiguity from Student records that are all inactive for the requested role", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const studentToken = await login(baseUrl, "default_cfo");
      await createCandidate(baseUrl, teacherToken, "round_gsi_pair_1", "inactive_one", 0.2);
      await createCandidate(baseUrl, teacherToken, "round_gsi_pair_1", "inactive_two", 0.3);
      await createCandidate(baseUrl, teacherToken, "round_gsi_pair_2", "inactive_to", 0.8);

      const result = await request(
        baseUrl,
        `/api/v1/bff/student/gsi/candidates/compare?${roundCompareQuery(
          "round_gsi_pair_1",
          "round_gsi_pair_2"
        )}`,
        { token: studentToken }
      );

      expect(result.status).toBe(409);
      expect(result.body.data.code).toBe("GSI_PAIR_NOT_AVAILABLE");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });

  it("rejects implicit selectors and ambiguous exact round pairs", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      await createCandidate(baseUrl, teacherToken, "round_gsi_pair_1", "pair_one", 0.2);
      await createCandidate(baseUrl, teacherToken, "round_gsi_pair_1", "pair_duplicate", 0.3);
      await createCandidate(baseUrl, teacherToken, "round_gsi_pair_2", "pair_two", 0.8);

      const implicit = await request(
        baseUrl,
        `/api/v1/bff/teacher/gsi/candidates/pair-options?${new URLSearchParams({
          ...Object.fromEntries(optionsQuery()),
          run_id: "latest"
        })}`,
        { token: teacherToken }
      );
      expect(implicit.status).toBe(422);
      expect(implicit.body.data.code).toBe("GSI_INPUT_INVALID");

      const ambiguous = await request(
        baseUrl,
        `/api/v1/bff/teacher/gsi/candidates/compare?${roundCompareQuery(
          "round_gsi_pair_1",
          "round_gsi_pair_2"
        )}`,
        { token: teacherToken }
      );
      expect(ambiguous.status).toBe(409);
      expect(ambiguous.body.data.code).toBe("GSI_PAIR_AMBIGUOUS");

      const adminToken = await login(baseUrl, "admin");
      const adminAmbiguous = await request(
        baseUrl,
        `/api/v1/bff/admin/gsi/candidates/compare?${roundCompareQuery(
          "round_gsi_pair_1",
          "round_gsi_pair_2"
        )}`,
        { token: adminToken }
      );
      expect(adminAmbiguous.status).toBe(409);
      expect(adminAmbiguous.body.data.code).toBe("GSI_PAIR_AMBIGUOUS");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
});
