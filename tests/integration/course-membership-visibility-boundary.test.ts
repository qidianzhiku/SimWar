import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  Course,
  Round,
  Run
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

async function startServer(store: SimWarStore): Promise<{ baseUrl: string; server: Server }> {
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("test server did not bind to a TCP port");
  }

  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

async function request<TData>(
  baseUrl: string,
  path: string,
  options: { method?: string; token?: string } = {}
): Promise<{ status: number; body: ApiEnvelope<TData> }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": "tenant_demo"
  });

  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers
  });

  return { status: response.status, body: (await response.json()) as ApiEnvelope<TData> };
}

async function login(baseUrl: string, username: string, password: string): Promise<string> {
  const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tenant-id": "tenant_demo"
    },
    body: JSON.stringify({ username, password })
  });
  const body = (await loginResponse.json()) as ApiEnvelope<AuthSession>;

  expect(loginResponse.status).toBe(200);
  return body.data.access_token;
}

function addUnassignedCourse(store: SimWarStore): Course {
  const template = store.courses.find((course) => course.course_id === "course_demo");
  if (!template) {
    throw new Error("course demo fixture is required");
  }

  const course: Course = {
    ...template,
    course_id: "course_unassigned",
    title: "Unassigned Same Tenant Course"
  };
  store.courses.push(course);
  return course;
}

function addUnassignedRun(store: SimWarStore, course: Course): void {
  const run: Run = {
    course_id: course.course_id,
    parameter_set_id: course.parameter_set_id,
    run_id: "run_unassigned",
    scenario_package_id: course.scenario_package_id,
    seed: 2048,
    status: "active",
    tenant_id: course.tenant_id
  };
  const round: Round = {
    round_id: "round_unassigned",
    round_no: 1,
    run_id: run.run_id,
    status: "open",
    tenant_id: course.tenant_id
  };

  store.runs.push(run);
  store.rounds.push(round);
}

describe("course membership visibility boundary", () => {
  it("limits learners to team-backed courses while classroom roles retain tenant catalog access", async () => {
    const store = createP1Store();
    const unassignedCourse = addUnassignedCourse(store);
    addUnassignedRun(store, unassignedCourse);
    const { baseUrl, server } = await startServer(store);

    try {
      const learnerToken = await login(baseUrl, "student", "student");
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const adminToken = await login(baseUrl, "admin", "admin");

      const learnerCourses = await request<Course[]>(baseUrl, "/api/v1/courses", {
        token: learnerToken
      });
      expect(learnerCourses.status).toBe(200);
      expect(learnerCourses.body.data.map((course) => course.course_id)).toEqual(["course_demo"]);

      const learnerAssignedCourse = await request<Course>(baseUrl, "/api/v1/courses/course_demo", {
        token: learnerToken
      });
      expect(learnerAssignedCourse.status).toBe(200);
      expect(learnerAssignedCourse.body.data.course_id).toBe("course_demo");

      const learnerUnassignedCourse = await request<unknown>(
        baseUrl,
        `/api/v1/courses/${unassignedCourse.course_id}`,
        { token: learnerToken }
      );
      expect(learnerUnassignedCourse.status).toBe(404);
      expect(learnerUnassignedCourse.body.code).toBe("COURSE-404-001");

      const learnerUnassignedCockpit = await request<unknown>(
        baseUrl,
        "/api/v1/bff/student/runs/run_unassigned/rounds/1/cockpit",
        { token: learnerToken }
      );
      expect(learnerUnassignedCockpit.status).toBe(404);
      expect(learnerUnassignedCockpit.body.code).toBe("COURSE-404-001");

      const teacherCourses = await request<Course[]>(baseUrl, "/api/v1/courses", {
        token: teacherToken
      });
      expect(teacherCourses.status).toBe(200);
      expect(teacherCourses.body.data.map((course) => course.course_id)).toEqual([
        "course_demo",
        "course_unassigned"
      ]);

      const adminCourses = await request<Course[]>(baseUrl, "/api/v1/courses", {
        token: adminToken
      });
      expect(adminCourses.status).toBe(200);
      expect(adminCourses.body.data.map((course) => course.course_id)).toEqual([
        "course_demo",
        "course_unassigned"
      ]);
    } finally {
      await stopServer(server);
    }
  });
});
