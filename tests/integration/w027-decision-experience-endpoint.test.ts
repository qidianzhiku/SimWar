import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  StudentRoleAssignment,
  W027StudentDecisionExperienceDTO,
  W027TeacherDecisionExperienceDTO,
  W027RoleRoster
} from "@simwar/shared-contracts";
import { hashPassword } from "../../services/api/src/auth";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

const tenantId = "tenant_w027_http";
const courseId = "course_w027_http";
const runId = "run_w027_http";
const roundId = "round_w027_http_1";
const teamId = "team_w027_http";

interface RequestOptions {
  body?: unknown;
  method?: string;
  token?: string;
}

async function request<T>(
  baseUrl: string,
  path: string,
  options: RequestOptions = {}
): Promise<{ body: ApiEnvelope<T>; status: number }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": tenantId
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

function seedFixture(store: SimWarStore): void {
  store.courses = [
    {
      course_id: courseId,
      created_by: "teacher",
      parameter_set_id: "parameters_w027_http",
      scenario_package_id: "scenario_w027_http",
      status: "active",
      tenant_id: tenantId,
      title: "W027 HTTP"
    }
  ];
  store.runs = [
    {
      course_id: courseId,
      parameter_set_id: "parameters_w027_http",
      run_id: runId,
      scenario_package_id: "scenario_w027_http",
      seed: 27,
      status: "active",
      tenant_id: tenantId
    }
  ];
  store.rounds = [
    {
      round_id: roundId,
      round_no: 1,
      run_id: runId,
      status: "open",
      tenant_id: tenantId
    }
  ];
  store.users.push({
    created_at: "2026-08-17T00:00:00.000Z",
    display_name: "W027 Teacher",
    email: "teacher@w027.demo.simwar.local",
    password_hash: hashPassword("teacher"),
    roles: ["teacher"],
    status: "active",
    tenant_id: tenantId,
    updated_at: "2026-08-17T00:00:00.000Z",
    user_id: "teacher_w027_http",
    username: "teacher"
  });

  const roleKeys = ["CEO", "CFO", "CMO", "COO", "CHRO"] as const;
  const members = roleKeys.map((roleKey) => {
    const userId = `w027_http_${roleKey.toLowerCase()}`;
    store.users.push({
      created_at: "2026-08-17T00:00:00.000Z",
      display_name: roleKey,
      email: `${userId}@demo.simwar.local`,
      password_hash: hashPassword(userId),
      roles: ["learner"],
      status: "active",
      team_id: teamId,
      tenant_id: tenantId,
      updated_at: "2026-08-17T00:00:00.000Z",
      user_id: userId,
      username: userId
    });
    return { display_name: roleKey, role_slot: roleKey, user_id: userId };
  });
  store.teams = [
    {
      captain_user_id: "w027_http_ceo",
      course_id: courseId,
      members,
      name: "W027 HTTP Team",
      team_id: teamId,
      tenant_id: tenantId
    }
  ];
  store.studentRoleAssignments = members.map(({ role_slot, user_id }) => {
    const assignment: StudentRoleAssignment = {
      assigned_at: "2026-08-17T00:00:00.000Z",
      assigned_by: "teacher",
      assignment_id: `assignment_${role_slot}`,
      course_id: courseId,
      role_key: role_slot,
      role_template_id: `role_template_${role_slot.toLowerCase()}_v1`,
      run_id: runId,
      source: "teacher_assigned",
      status: "active",
      team_id: teamId,
      tenant_id: tenantId,
      user_id
    };
    return assignment;
  });
}

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  seedFixture(store);
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

const query = `course_id=${courseId}&run_id=${runId}&round_id=${roundId}&team_id=${teamId}`;

describe("W027 decision experience HTTP boundary", () => {
  it("keeps Student private judgment and Teacher-safe projection separated", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const studentToken = await login(baseUrl, "w027_http_coo");
      const teacherToken = await login(baseUrl, "teacher");

      const roster = await request<W027RoleRoster>(baseUrl, "/api/v1/bff/teacher/w027/roster", {
        body: {
          course_id: courseId,
          role_keys: ["CEO", "CFO", "CMO", "COO", "CHRO", "Quality & Risk"],
          round_id: roundId,
          run_id: runId,
          team_id: teamId
        },
        method: "PUT",
        token: teacherToken
      });
      expect(roster.status).toBe(200);
      expect(roster.body.data.role_keys).toEqual(["CEO", "CFO", "CMO", "COO", "CHRO"]);

      const judgment = await request(baseUrl, "/api/v1/bff/student/w027/private-judgment", {
        body: {
          course_id: courseId,
          kind: "risk",
          round_id: roundId,
          run_id: runId,
          statement: "Private COO risk judgment",
          status: "ready",
          team_id: teamId
        },
        method: "PUT",
        token: studentToken
      });
      expect(judgment.status).toBe(200);

      const position = await request(baseUrl, "/api/v1/bff/student/w027/role-position", {
        body: {
          course_id: courseId,
          risk_flags: ["quality drift"],
          round_id: roundId,
          run_id: runId,
          status: "ready",
          summary: "COO team-safe position",
          team_id: teamId
        },
        method: "PUT",
        token: studentToken
      });
      expect(position.status).toBe(200);

      const studentWorkspace = await request<W027StudentDecisionExperienceDTO>(
        baseUrl,
        `/api/v1/bff/student/w027/decision-experience?${query}`,
        { token: studentToken }
      );
      expect(studentWorkspace.status).toBe(200);
      expect(studentWorkspace.body.data.private_judgments[0]?.statement).toBe(
        "Private COO risk judgment"
      );
      expect(studentWorkspace.body.data.team_safe_positions[0]).not.toHaveProperty("created_by");

      const teacherWorkspace = await request<W027TeacherDecisionExperienceDTO>(
        baseUrl,
        `/api/v1/bff/teacher/w027/decision-experience?${query}`,
        { token: teacherToken }
      );
      expect(teacherWorkspace.status).toBe(200);
      expect(JSON.stringify(teacherWorkspace.body.data)).not.toContain("Private COO risk judgment");
      expect(teacherWorkspace.body.data.private_judgment_summary[0]).not.toHaveProperty(
        "statement"
      );
      expect(teacherWorkspace.body.data.roster.role_keys).toEqual([
        "CEO",
        "CFO",
        "CMO",
        "COO",
        "CHRO"
      ]);

      const wrongCourse = await request(
        baseUrl,
        `/api/v1/bff/student/w027/decision-experience?course_id=course_other&run_id=${runId}&round_id=${roundId}&team_id=${teamId}`,
        { token: studentToken }
      );
      expect(wrongCourse.status).toBe(422);
      expect(wrongCourse.body.code).toBe("W027_SCOPE_INVALID");
    } finally {
      await stopServer(server);
    }
  });
});
