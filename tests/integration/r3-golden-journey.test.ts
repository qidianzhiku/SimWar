import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession, GoldenJourneyStatusDto } from "@simwar/shared-contracts";
import { createApiServer } from "../../services/api/src/server";
import { DEFAULT_TENANT_ID, createP1Store, type SimWarStore } from "../../services/api/src/store";

async function start(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("R3 test server did not bind");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function request<T>(
  baseUrl: string,
  path: string,
  options: { method?: string; token?: string } = {}
) {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": DEFAULT_TENANT_ID,
    "x-correlation-id": "corr_r3_http_001"
  });
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  const response = await fetch(`${baseUrl}${path}`, { headers, method: options.method ?? "GET" });
  return { body: (await response.json()) as ApiEnvelope<T>, status: response.status };
}

async function login(baseUrl: string, username: string, password: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    body: JSON.stringify({ password, username }),
    headers: { "content-type": "application/json", "x-tenant-id": DEFAULT_TENANT_ID },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as ApiEnvelope<AuthSession>).data.access_token;
}

describe("R3 Golden Journey integration projection", () => {
  it("returns exact context, receipts and allowed actions for teacher and student", async () => {
    const { baseUrl, server, store } = await start();
    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const teacher = await request<GoldenJourneyStatusDto>(
        baseUrl,
        "/api/v1/bff/teacher/golden-journey/status?course_id=course_demo",
        { token: teacherToken }
      );
      expect(teacher.status).toBe(200);
      expect(teacher.body.data.context.course_package_ref.discriminator).toBe("exact_ref");
      expect(teacher.body.data.allowed_actions.allowed_actions).toContain("view_teacher_facts");
      expect(teacher.body.data.formal_truth_write).toBe(false);
      expect(teacher.body.data.runtime_authority).toBe("JSON_INTERNAL_ONLY");

      const student = await request<GoldenJourneyStatusDto>(
        baseUrl,
        "/api/v1/bff/student/golden-journey/status?course_id=course_demo",
        { token: studentToken }
      );
      expect(student.status).toBe(200);
      expect(student.body.data.allowed_actions.role).toBe("student");
      expect(student.body.data.allowed_actions.allowed_actions).not.toContain("view_teacher_facts");
      expect(student.body.data.student_private_fields_exposed).toBe(false);
      expect(student.body.data.receipt_index.entries.map((entry) => entry.slice)).not.toContain(
        "D2"
      );

      const actorTeam = store.teams.find((team) => team.team_id === "team_alpha");
      if (!actorTeam) throw new Error("team_alpha fixture is required");
      store.teams.push({ ...actorTeam, name: "R3 other team", team_id: "team_r3_other" });
      const crossTeam = await request<unknown>(
        baseUrl,
        "/api/v1/bff/student/golden-journey/status?course_id=course_demo&team_id=team_r3_other",
        { token: studentToken }
      );
      expect(crossTeam.status).toBe(403);
      expect(crossTeam.body.code).toBe("R3_GOLDEN_SCOPE_VIOLATION");
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  it("exposes narrow sub-projections without a student private route", async () => {
    const { baseUrl, server } = await start();
    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const context = await request<GoldenJourneyStatusDto["context"]>(
        baseUrl,
        "/api/v1/bff/teacher/golden-journey/context?course_id=course_demo",
        { token: teacherToken }
      );
      expect(context.status).toBe(200);
      expect(context.body.data.discriminator).toBe("golden_journey_context");
      const receipts = await request<GoldenJourneyStatusDto["receipt_index"]>(
        baseUrl,
        "/api/v1/bff/teacher/golden-journey/receipts?course_id=course_demo",
        { token: teacherToken }
      );
      expect(receipts.status).toBe(200);
      expect(receipts.body.data.discriminator).toBe("cross_slice_receipt_index");
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
