import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleTeacherConfirmationRoute, type TeacherConfirmationRouteRuntime } from "../../services/api/src/routes/teacher-confirmation-routes.js";

type FakeResponse = { statusCode: number; payload?: unknown; writeHead(status: number): void; end(body: string): void };

function response(): FakeResponse {
  return { statusCode: 0, payload: undefined, writeHead(status: number) { this.statusCode = status; }, end(body: string) { this.payload = JSON.parse(body); } };
}

describe("D3 Teacher Confirmation BFF route", () => {
  it("exposes teacher-only confirmation projection and does not expose a student route", async () => {
    const runtime = {
      queries: { listTeacher: vi.fn(async () => ({ confirmations: [], known_limits: ["teacher-only"], runtime_authority: "JSON_INTERNAL_ONLY" })) },
      commands: { saveDraft: vi.fn(), confirm: vi.fn() },
      claims: { claim: vi.fn(), release: vi.fn() }
    } as unknown as TeacherConfirmationRouteRuntime;
    const res = response();
    const sendJson = (target: ServerResponse, status: number, payload: unknown) => { const fake = target as unknown as FakeResponse; fake.writeHead(status); fake.end(JSON.stringify(payload)); };
    const context = { requestId: "req_001", tenantId: "tenant_demo", actorId: "usr_teacher" };
    const handled = await handleTeacherConfirmationRoute(runtime, { method: "GET" } as unknown as IncomingMessage, res as unknown as ServerResponse, new URL("http://localhost/api/v1/bff/teacher/confirmations"), context, {
      readJson: async () => ({}),
      sendJson,
      createEnvelope: (_context, payload) => ({ code: "OK", data: payload }),
      requireTeacher: () => undefined
    });
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const payload = res.payload as { data: { runtime_authority: string } };
    expect(payload.data.runtime_authority).toBe("JSON_INTERNAL_ONLY");
    const studentHandled = await handleTeacherConfirmationRoute(runtime, { method: "GET" } as unknown as IncomingMessage, res as unknown as ServerResponse, new URL("http://localhost/api/v1/bff/student/confirmations"), context, {
      readJson: async () => ({}), sendJson, createEnvelope: (_context, payload) => payload, requireTeacher: () => undefined
    });
    expect(studentHandled).toBe(false);
  });
});
