import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  FreshLearnerAdmissionReadiness,
  User
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

async function request<T>(
  baseUrl: string,
  path: string,
  options: { body?: unknown; method?: string; token?: string } = {}
): Promise<{ body: ApiEnvelope<T>; status: number }> {
  const headers = new Headers({ "content-type": "application/json", "x-tenant-id": "tenant_demo" });
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? (options.body === undefined ? "GET" : "POST")
  });
  return { body: (await response.json()) as ApiEnvelope<T>, status: response.status };
}

async function login(baseUrl: string, username: string, password = username): Promise<string> {
  const result = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    body: { password, username }
  });
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  return result.body.data.access_token;
}

async function createUser(baseUrl: string, adminToken: string, suffix: string): Promise<User> {
  const result = await request<User>(baseUrl, "/api/v1/admin/users", {
    body: {
      display_name: `W022 ${suffix}`,
      email: `${suffix}@w022.test`,
      password: suffix,
      roles: ["learner"],
      tenant_id: "tenant_demo",
      username: suffix
    },
    token: adminToken
  });
  expect(result.status, JSON.stringify(result.body)).toBe(201);
  return result.body.data;
}

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

describe("fresh learner admission API", () => {
  it("enrolls fresh members, rejects cross-team reuse, and exposes bounded readiness", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      store.teams.splice(
        0,
        store.teams.length,
        ...store.teams.filter((team) => team.course_id !== "course_demo")
      );
      store.runs.push({
        course_id: "course_demo",
        parameter_set_id: "param_toy_approved_1",
        run_id: "run_w022_admission",
        scenario_package_id: "scenario_eldercare_demo",
        seed: 22012,
        status: "active",
        tenant_id: "tenant_demo"
      });
      store.rounds.push({
        round_id: "round_w022_admission",
        round_no: 1,
        run_id: "run_w022_admission",
        status: "draft",
        tenant_id: "tenant_demo"
      });
      const adminToken = await login(baseUrl, "admin");
      const teacherToken = await login(baseUrl, "teacher");
      const users = await Promise.all(
        Array.from({ length: 8 }, (_, index) => createUser(baseUrl, adminToken, `w022_${index}`))
      );
      const teamA = await request<{ team_id: string }>(
        baseUrl,
        "/api/v1/courses/course_demo/teams",
        {
          body: { captain_user_id: users[0]!.user_id, name: "W022 Team A" },
          token: teacherToken
        }
      );
      const teamB = await request<{ team_id: string }>(
        baseUrl,
        "/api/v1/courses/course_demo/teams",
        {
          body: { captain_user_id: users[4]!.user_id, name: "W022 Team B" },
          token: teacherToken
        }
      );
      expect(teamA.status).toBe(201);
      expect(teamB.status).toBe(201);

      const roles = ["CEO", "CFO", "CMO", "COO"] as const;
      for (const [team, start] of [
        [teamA.body.data.team_id, 0],
        [teamB.body.data.team_id, 4]
      ] as const) {
        for (const [index, role_slot] of roles.entries()) {
          if (index === 0) continue;
          const result = await request(
            baseUrl,
            `/api/v1/courses/course_demo/teams/${team}/members`,
            {
              body: { role_slot, user_id: users[start + index]!.user_id },
              token: teacherToken
            }
          );
          expect(result.status, JSON.stringify(result.body)).toBe(201);
        }
      }

      const duplicate = await request(
        baseUrl,
        `/api/v1/courses/course_demo/teams/${teamA.body.data.team_id}/members`,
        {
          body: { role_slot: "CFO", user_id: users[1]!.user_id },
          token: teacherToken
        }
      );
      expect(duplicate.status).toBe(409);

      const crossTeam = await request(
        baseUrl,
        `/api/v1/courses/course_demo/teams/${teamB.body.data.team_id}/members`,
        {
          body: { role_slot: "CMO", user_id: users[1]!.user_id },
          token: teacherToken
        }
      );
      expect(crossTeam.status).toBe(409);

      const readiness = await request<FreshLearnerAdmissionReadiness>(
        baseUrl,
        `/api/v1/bff/teacher/fresh-learner-admission?course_id=course_demo&run_id=run_w022_admission&team_ids=${teamA.body.data.team_id},${teamB.body.data.team_id}`,
        { token: teacherToken }
      );
      expect(readiness.status, JSON.stringify(readiness.body)).toBe(200);
      expect(readiness.body.data.admission_status).toBe("BLOCKED");
      expect(readiness.body.data.team_count).toBe(2);
      expect(readiness.body.data.required_roster_count).toBe(8);
      expect(JSON.stringify(readiness.body.data)).not.toContain("password_hash");

      const started = await request(baseUrl, "/api/v1/runs/run_w022_admission/rounds/1/start", {
        body: {},
        method: "POST",
        token: teacherToken
      });
      expect(started.status, JSON.stringify(started.body)).toBe(200);

      const truthBeforeAdmission = JSON.stringify({
        decisions: store.decisions,
        rounds: store.rounds,
        settlements: store.settlementResults
      });

      for (const [team, start] of [
        [teamA.body.data.team_id, 0],
        [teamB.body.data.team_id, 4]
      ] as const) {
        for (const [index, role_key] of roles.entries()) {
          const assignment = await request(
            baseUrl,
            "/api/v1/bff/teacher/role-workflows/assignments",
            {
              body: {
                course_id: "course_demo",
                role_key,
                run_id: "run_w022_admission",
                team_id: team,
                user_id: users[start + index]!.user_id
              },
              method: "PUT",
              token: teacherToken
            }
          );
          expect(assignment.status, JSON.stringify(assignment.body)).toBe(201);
        }
      }

      const admitted = await request<FreshLearnerAdmissionReadiness>(
        baseUrl,
        `/api/v1/bff/teacher/fresh-learner-admission?course_id=course_demo&run_id=run_w022_admission&team_ids=${teamA.body.data.team_id},${teamB.body.data.team_id}`,
        { token: teacherToken }
      );
      expect(admitted.status, JSON.stringify(admitted.body)).toBe(200);
      expect(admitted.body.data.admission_status).toBe("READY_FOR_MACHINE_E4");
      expect(admitted.body.data.assigned_roster_count).toBe(8);
      expect(
        JSON.stringify({
          decisions: store.decisions,
          rounds: store.rounds,
          settlements: store.settlementResults
        })
      ).toBe(truthBeforeAdmission);

      // The complete fresh-identity workflow is owned by the real Chromium E4 test.
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
