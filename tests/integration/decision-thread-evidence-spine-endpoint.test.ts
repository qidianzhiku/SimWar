import { once } from "node:events";
import { IncomingMessage, ServerResponse, type Server } from "node:http";
import { Socket } from "node:net";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  GSIReceipt,
  StudentRoleAssignment
} from "@simwar/shared-contracts";
import { createApiServer } from "../../services/api/src/server";
import { hashPassword, verifyPassword } from "../../services/api/src/auth";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";
import { createEvidenceAdoptionServiceFixture } from "../helpers/model-qualification-evidence-adoption-fixtures";

const tenantId = "tenant-ddt-http";
const courseId = "course-ddt-http";
const runId = "run-ddt-http";
const roundId = "round-ddt-http-1";
const teamId = "team-ddt-http";

function seed(store: SimWarStore): void {
  store.courses.push({
    course_id: courseId,
    created_by: "teacher-ddt",
    parameter_set_id: "parameters-ddt",
    scenario_package_id: "scenario-ddt",
    status: "active",
    tenant_id: tenantId,
    title: "DDT HTTP"
  });
  store.runs.push({
    course_id: courseId,
    parameter_set_id: "parameters-ddt",
    run_id: runId,
    scenario_package_id: "scenario-ddt",
    seed: 1,
    status: "active",
    tenant_id: tenantId
  });
  store.rounds.push({
    round_id: roundId,
    round_no: 1,
    run_id: runId,
    status: "open",
    tenant_id: tenantId
  });
  store.teams.push({
    course_id: courseId,
    created_at: "2026-09-12T00:00:00.000Z",
    members: [{ display_name: "Student", role_slot: "CEO", user_id: "student-ddt" }],
    name: "DDT Team",
    status: "active",
    team_id: teamId,
    tenant_id: tenantId
  });
  for (const [userId, role, password] of [
    ["teacher-ddt", "teacher", "teacher-ddt"],
    ["admin-ddt", "admin", "admin-ddt"],
    ["student-ddt", "student", "student-ddt"]
  ] as const) {
    store.users.push({
      created_at: "2026-09-12T00:00:00.000Z",
      display_name: userId,
      email: `${userId}@example.invalid`,
      password_hash: hashPassword(password),
      roles: [role],
      status: "active",
      tenant_id: tenantId,
      updated_at: "2026-09-12T00:00:00.000Z",
      user_id: userId,
      username: userId
    });
  }
  store.studentRoleAssignments.push({
    assignment_id: "assignment-ddt-ceo",
    tenant_id: tenantId,
    course_id: courseId,
    run_id: runId,
    team_id: teamId,
    user_id: "student-ddt",
    role_key: "CEO",
    role_template_id: "role-template-ceo",
    status: "active",
    source: "teacher_assigned",
    assigned_by: "teacher-ddt",
    assigned_at: "2026-09-12T00:00:00.000Z"
  } satisfies StudentRoleAssignment);
}

function seededStore(withStaleQualification = false): SimWarStore {
  const store = createP1Store();
  seed(store);
  if (withStaleQualification) {
    const fixture = createEvidenceAdoptionServiceFixture();
    const record = JSON.parse(
      JSON.stringify(fixture.primary.record)
        .replaceAll("tenant_demo", tenantId)
        .replaceAll("course_demo", courseId)
    );
    record.qualifications = [record.qualifications[0]];
    record.source_packages = record.source_packages.map((source: object) => ({
      ...source,
      freshness_status: "STALE"
    }));
    store.modelQualificationRecords = [record];
  }
  return store;
}

async function start(): Promise<{ server: Server; baseUrl: string }> {
  const store = seededStore();
  const seededTeacher = store.users.find((user) => user.username === "teacher-ddt");
  if (!seededTeacher || !verifyPassword("teacher-ddt", seededTeacher.password_hash)) {
    throw new Error("DDT fixture password verification failed");
  }
  const server = createApiServer(store);
  const runtimeTeacher = store.users.find((user) => user.username === "teacher-ddt");
  if (!runtimeTeacher || !verifyPassword("teacher-ddt", runtimeTeacher.password_hash)) {
    throw new Error("DDT fixture password changed during server creation");
  }
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function login(baseUrl: string, username: string, password = username): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    body: JSON.stringify({ username, password })
  });
  if (response.status !== 200) {
    throw new Error(`login ${username} failed: ${response.status} ${await response.text()}`);
  }
  return ((await response.json()) as ApiEnvelope<AuthSession>).data.access_token;
}

function query(): string {
  return new URLSearchParams({
    activity_id: "activity_consequence",
    course_id: courseId,
    role_key: "CEO",
    round_id: roundId,
    round_no: "1",
    run_id: runId,
    team_id: teamId
  }).toString();
}

async function defaultRequest<T>(
  baseUrl: string,
  path: string,
  options: { body?: unknown; method?: string; token?: string } = {}
): Promise<{ status: number; body: ApiEnvelope<T> }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": "tenant_demo"
  });
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? "GET"
  });
  return { status: response.status, body: (await response.json()) as ApiEnvelope<T> };
}

function gsiCandidateRequest(roundId: string, idempotencyKey: string, influence: number) {
  return {
    discriminator: "gsi_stakeholder_shadow_request",
    binding: {
      tenant_id: "tenant_demo",
      course_id: "course_demo",
      run_id: "run-ddt-gsi",
      round_id: roundId,
      round_no: Number(roundId.split("-").at(-1)),
      activity_id: "activity_consequence",
      role_key: "CEO",
      team_id: "team_alpha",
      scenario_package_id: "scenario_eldercare_demo",
      scenario_version: "1.0.0",
      parameter_set_id: "param_toy_approved_1",
      parameter_set_version: "1.0.0",
      model_version_id: "gsi-stakeholder-resolver-v1",
      model_version: "1.0.0",
      model_artifact_id: "artifact:gsi-stakeholder-resolver-v1:1.0.0",
      model_artifact_version: "1.0.0"
    },
    plane_mode: "OFF",
    publication_status: "PUBLISHED",
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

async function read<T>(baseUrl: string, surface: string, token: string, suffix = "") {
  const response = await fetch(
    `${baseUrl}/api/v1/bff/${surface}/decision-thread/evidence-spine?${query()}${suffix}`,
    { headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId } }
  );
  return { status: response.status, body: (await response.json()) as ApiEnvelope<T> };
}

describe("Decision Thread Evidence Spine real BFF", () => {
  it("reports course-scoped qualification and stale Student industry evidence with safe recovery", async () => {
    const store = seededStore(true);
    const server = createApiServer(store);
    // Exercise the real HTTP handler without requiring a listening socket.
    const request = (
      url: string,
      token?: string,
      body?: unknown
    ): Promise<{ status: number; data: unknown }> =>
      new Promise((resolve) => {
        const req = new IncomingMessage(new Socket());
        req.method = body === undefined ? "GET" : "POST";
        req.url = url;
        req.headers = {
          "content-type": "application/json",
          "x-tenant-id": tenantId,
          ...(token ? { authorization: `Bearer ${token}` } : {})
        };
        const res = new ServerResponse(req);
        res.end = ((chunk: string) => {
          resolve({ status: res.statusCode, data: JSON.parse(chunk).data });
          return res;
        }) as typeof res.end;
        if (body !== undefined) req.push(JSON.stringify(body));
        req.push(null);
        server.emit("request", req, res);
      });
    for (const surface of ["teacher", "student", "admin"]) {
      const session = await request("/api/v1/auth/login", undefined, {
        username: `${surface}-ddt`,
        password: `${surface}-ddt`
      });
      expect(session.status).toBe(200);
      const before = JSON.stringify(store);
      const result = await request(
        `/api/v1/bff/${surface}/decision-thread/evidence-spine?${query()}`,
        (session.data as AuthSession).access_token
      );
      expect(result.status).toBe(200);
      expect(JSON.stringify(store)).toBe(before);
      const data = result.data as {
        sources: {
          source: string;
          status: string;
          context_scope: string;
          summary: string;
          known_limits: string[];
        }[];
      };
      const qualification = data.sources.find((source) => source.source === "MODEL_QUALIFICATION");
      expect(qualification?.context_scope).toBe("TENANT_COURSE");
      const industry = data.sources.find((source) => source.source === "INDUSTRY_MODEL");
      expect(industry?.status).toBe("STALE");
      if (surface === "student") {
        expect(industry?.summary).toContain("重新载入");
        const serialized = JSON.stringify(data);
        for (const key of [
          "provability",
          "digest",
          "source_ref",
          "model_version_reference",
          "qualification_id"
        ])
          expect(serialized).not.toContain(key);
      } else {
        expect(qualification?.known_limits).toContain(
          "模型资格仅绑定租户和课程；不证明活动、具体运行、队伍、回合或角色绑定。"
        );
      }
    }
  });
  it("serves exact-context Teacher, Student, and Admin projections without writes", async () => {
    const { server, baseUrl } = await start();
    try {
      const teacherToken = await login(baseUrl, "teacher-ddt");
      const studentToken = await login(baseUrl, "student-ddt");
      const adminToken = await login(baseUrl, "admin-ddt");

      const teacher = await read<{
        surface: "teacher";
        sources: readonly { source: string; status: string }[];
      }>(baseUrl, "teacher", teacherToken);
      expect(teacher.status).toBe(200);
      expect(teacher.body.data.surface).toBe("teacher");
      expect(teacher.body.data.sources).toHaveLength(5);
      expect(teacher.body.data.sources.find((source) => source.source === "GSI")?.status).toBe(
        "CONTEXT_UNAVAILABLE"
      );
      expect(
        teacher.body.data.sources.find((source) => source.source === "STRATEGIC_PORTFOLIO")?.status
      ).toBe("CONTEXT_UNAVAILABLE");

      const teacherWrongRoleContext = new URLSearchParams(query());
      teacherWrongRoleContext.set("role_key", "CFO");
      const teacherWrongRole = await fetch(
        `${baseUrl}/api/v1/bff/teacher/decision-thread/evidence-spine?${teacherWrongRoleContext.toString()}`,
        { headers: { authorization: `Bearer ${teacherToken}`, "x-tenant-id": tenantId } }
      );
      expect(teacherWrongRole.status).toBe(403);

      const teacherWrongActivityContext = new URLSearchParams(query());
      teacherWrongActivityContext.set("activity_id", "activity_wrong");
      const teacherWrongActivity = await fetch(
        `${baseUrl}/api/v1/bff/teacher/decision-thread/evidence-spine?${teacherWrongActivityContext.toString()}`,
        { headers: { authorization: `Bearer ${teacherToken}`, "x-tenant-id": tenantId } }
      );
      expect(teacherWrongActivity.status).toBe(403);

      const student = await read<{ surface: "student" }>(baseUrl, "student", studentToken);
      expect(student.status).toBe(200);
      expect(student.body.data.surface).toBe("student");
      const serializedStudent = JSON.stringify(student.body.data);
      expect(serializedStudent).not.toContain(tenantId);
      expect(serializedStudent).not.toContain("source_ref");
      expect(serializedStudent).not.toContain("candidate_id");

      const wrongRoleContext = new URLSearchParams(query());
      wrongRoleContext.set("role_key", "CFO");
      const wrongRole = await fetch(
        `${baseUrl}/api/v1/bff/student/decision-thread/evidence-spine?${wrongRoleContext.toString()}`,
        { headers: { authorization: `Bearer ${studentToken}`, "x-tenant-id": tenantId } }
      );
      expect(wrongRole.status).toBe(403);

      const admin = await read<{ surface: "admin"; exact_context: { tenant_id: string } }>(
        baseUrl,
        "admin",
        adminToken
      );
      expect(admin.status).toBe(200);
      expect(admin.body.data.surface).toBe("admin");
      expect(admin.body.data.exact_context.tenant_id).toBe(tenantId);

      const adminWrongRoleContext = new URLSearchParams(query());
      adminWrongRoleContext.set("role_key", "CFO");
      const adminWrongRole = await fetch(
        `${baseUrl}/api/v1/bff/admin/decision-thread/evidence-spine?${adminWrongRoleContext.toString()}`,
        { headers: { authorization: `Bearer ${adminToken}`, "x-tenant-id": tenantId } }
      );
      expect(adminWrongRole.status).toBe(403);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("fails closed for incomplete context and partial GSI selection", async () => {
    const { server, baseUrl } = await start();
    try {
      const teacherToken = await login(baseUrl, "teacher-ddt");
      const missing = await fetch(
        `${baseUrl}/api/v1/bff/teacher/decision-thread/evidence-spine?course_id=${courseId}`,
        { headers: { authorization: `Bearer ${teacherToken}`, "x-tenant-id": tenantId } }
      );
      expect(missing.status).toBe(422);
      const partial = await read(
        baseUrl,
        "teacher",
        teacherToken,
        "&gsi_from_round_id=round-ddt-0"
      );
      expect(partial.status).toBe(422);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("composes an explicitly selected GSI pair through the real BFF for all roles", async () => {
    const store = createP1Store();
    store.runs = [
      {
        course_id: "course_demo",
        parameter_set_id: "param_toy_approved_1",
        run_id: "run-ddt-gsi",
        scenario_package_id: "scenario_eldercare_demo",
        seed: 20260912,
        status: "active",
        tenant_id: "tenant_demo"
      }
    ];
    store.rounds = [
      {
        round_id: "round-ddt-gsi-1",
        round_no: 1,
        run_id: "run-ddt-gsi",
        status: "open",
        tenant_id: "tenant_demo"
      },
      {
        round_id: "round-ddt-gsi-2",
        round_no: 2,
        run_id: "run-ddt-gsi",
        status: "open",
        tenant_id: "tenant_demo"
      }
    ];
    const server = createApiServer(store);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server address unavailable");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    try {
      const teacher = await defaultRequest<AuthSession>(baseUrl, "/api/v1/auth/login", {
        body: { username: "teacher", password: "teacher" },
        method: "POST"
      });
      const student = await defaultRequest<AuthSession>(baseUrl, "/api/v1/auth/login", {
        body: { username: "student", password: "student" },
        method: "POST"
      });
      const admin = await defaultRequest<AuthSession>(baseUrl, "/api/v1/auth/login", {
        body: { username: "admin", password: "admin" },
        method: "POST"
      });
      expect(teacher.status).toBe(200);
      expect(student.status).toBe(200);
      expect(admin.status).toBe(200);
      const teacherToken = teacher.body.data.access_token;
      const studentToken = student.body.data.access_token;
      const adminToken = admin.body.data.access_token;
      const assignment = await defaultRequest(
        baseUrl,
        "/api/v1/bff/teacher/role-workflows/assignments",
        {
          body: {
            course_id: "course_demo",
            role_key: "CEO",
            run_id: "run-ddt-gsi",
            team_id: "team_alpha",
            user_id: "usr_student"
          },
          method: "PUT",
          token: teacherToken
        }
      );
      expect(assignment.status).toBe(201);
      const from = await defaultRequest<GSIReceipt>(baseUrl, "/api/v1/bff/teacher/gsi/candidates", {
        body: gsiCandidateRequest("round-ddt-gsi-1", "ddt-gsi-from", 0.2),
        method: "POST",
        token: teacherToken
      });
      const to = await defaultRequest<GSIReceipt>(baseUrl, "/api/v1/bff/teacher/gsi/candidates", {
        body: gsiCandidateRequest("round-ddt-gsi-2", "ddt-gsi-to", 0.8),
        method: "POST",
        token: teacherToken
      });
      expect(from.status).toBe(201);
      expect(to.status).toBe(201);
      const canonicalCompare = await defaultRequest(
        baseUrl,
        `/api/v1/bff/teacher/gsi/candidates/compare?from_candidate_id=${encodeURIComponent(
          from.body.data.candidate_id
        )}&to_candidate_id=${encodeURIComponent(to.body.data.candidate_id)}&activity_id=activity_consequence&role_key=CEO`,
        { token: teacherToken }
      );
      if (canonicalCompare.status !== 200) {
        throw new Error(`canonical GSI compare failed: ${JSON.stringify(canonicalCompare.body)}`);
      }
      const canonicalRoundCompare = await defaultRequest(
        baseUrl,
        "/api/v1/bff/teacher/gsi/candidates/compare?course_id=course_demo&run_id=run-ddt-gsi&team_id=team_alpha&activity_id=activity_consequence&role_key=CEO&from_round_id=round-ddt-gsi-1&to_round_id=round-ddt-gsi-2",
        { token: teacherToken }
      );
      if (canonicalRoundCompare.status !== 200) {
        throw new Error(
          `canonical GSI round compare failed: ${JSON.stringify(canonicalRoundCompare.body)}`
        );
      }
      const exact = new URLSearchParams({
        ...Object.fromEntries(new URLSearchParams(query())),
        course_id: "course_demo",
        run_id: "run-ddt-gsi",
        round_id: "round-ddt-gsi-2",
        round_no: "2",
        team_id: "team_alpha",
        gsi_from_round_id: "round-ddt-gsi-1",
        gsi_to_round_id: "round-ddt-gsi-2"
      }).toString();
      const teacherSpine = await defaultRequest<{
        sources: readonly { source: string; status: string }[];
      }>(baseUrl, `/api/v1/bff/teacher/decision-thread/evidence-spine?${exact}`, {
        token: teacherToken
      });
      expect(teacherSpine.status).toBe(200);
      expect(teacherSpine.body.data.sources.find((source) => source.source === "GSI")?.status).toBe(
        "CONTEXT_UNAVAILABLE"
      );
      const studentSpine = await defaultRequest<{
        sources: readonly { source: string; status: string }[];
      }>(baseUrl, `/api/v1/bff/student/decision-thread/evidence-spine?${exact}`, {
        token: studentToken
      });
      expect(studentSpine.status).toBe(200);
      expect(studentSpine.body.data.sources.find((source) => source.source === "GSI")?.status).toBe(
        "CONTEXT_UNAVAILABLE"
      );
      const studentJson = JSON.stringify(studentSpine.body.data);
      expect(studentJson).not.toContain(from.body.data.candidate_id);
      expect(studentJson).not.toContain("comparison_digest");
      const adminSpine = await defaultRequest<{
        surface: "admin";
        exact_context: { tenant_id: string };
      }>(baseUrl, `/api/v1/bff/admin/decision-thread/evidence-spine?${exact}`, {
        token: adminToken
      });
      expect(adminSpine.status).toBe(200);
      expect(adminSpine.body.data.exact_context.tenant_id).toBe("tenant_demo");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
