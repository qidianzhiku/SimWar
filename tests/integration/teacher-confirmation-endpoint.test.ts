import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  handleTeacherConfirmationRoute,
  type TeacherConfirmationRouteRuntime
} from "../../services/api/src/routes/teacher-confirmation-routes.js";

type FakeResponse = {
  statusCode: number;
  payload?: unknown;
  writeHead(status: number): void;
  end(body: string): void;
};

function response(): FakeResponse {
  return {
    statusCode: 0,
    payload: undefined,
    writeHead(status: number) {
      this.statusCode = status;
    },
    end(body: string) {
      this.payload = JSON.parse(body);
    }
  };
}

describe("D3 Teacher Confirmation BFF route", () => {
  it("exposes teacher-only confirmation projection and does not expose a student route", async () => {
    const runtime = {
      queries: {
        listTeacher: vi.fn(async () => ({
          confirmations: [],
          known_limits: ["teacher-only"],
          runtime_authority: "JSON_INTERNAL_ONLY"
        }))
      },
      commands: { saveDraft: vi.fn(), confirm: vi.fn() },
      claims: { claim: vi.fn(), release: vi.fn() }
    } as unknown as TeacherConfirmationRouteRuntime;
    const res = response();
    const sendJson = (target: ServerResponse, status: number, payload: unknown) => {
      const fake = target as unknown as FakeResponse;
      fake.writeHead(status);
      fake.end(JSON.stringify(payload));
    };
    const context = { requestId: "req_001", tenantId: "tenant_demo", actorId: "usr_teacher" };
    const handled = await handleTeacherConfirmationRoute(
      runtime,
      { method: "GET" } as unknown as IncomingMessage,
      res as unknown as ServerResponse,
      new URL("http://localhost/api/v1/bff/teacher/confirmations"),
      context,
      {
        readJson: async () => ({}),
        sendJson,
        createEnvelope: (_context, payload) => ({ code: "OK", data: payload }),
        requireTeacher: () => undefined
      }
    );
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const payload = res.payload as { data: { runtime_authority: string } };
    expect(payload.data.runtime_authority).toBe("JSON_INTERNAL_ONLY");
    const studentHandled = await handleTeacherConfirmationRoute(
      runtime,
      { method: "GET" } as unknown as IncomingMessage,
      res as unknown as ServerResponse,
      new URL("http://localhost/api/v1/bff/student/confirmations"),
      context,
      {
        readJson: async () => ({}),
        sendJson,
        createEnvelope: (_context, payload) => payload,
        requireTeacher: () => undefined
      }
    );
    expect(studentHandled).toBe(false);
  });

  it("routes explicit reject, revise and work-claim operations without a student path", async () => {
    const runtime = {
      queries: {
        listTeacher: vi.fn(async () => ({
          confirmations: [],
          known_limits: [],
          runtime_authority: "JSON_INTERNAL_ONLY"
        }))
      },
      commands: {
        saveDraft: vi.fn(),
        confirm: vi.fn(),
        reject: vi.fn(async () => ({
          data: { confirmation: { status: "REJECTED" } },
          known_limits: []
        })),
        revise: vi.fn(async () => ({
          data: { confirmation: { status: "DRAFT" }, status: "generated" },
          known_limits: [],
          runtime_authority: "JSON_INTERNAL_ONLY"
        }))
      },
      claims: {
        claim: vi.fn(() => ({ claim_id: "claim_1", status: "CLAIMED" })),
        get: vi.fn(() => ({ claim_id: "claim_1", status: "CLAIMED" })),
        release: vi.fn(() => ({ claim_id: "claim_1", status: "RELEASED" }))
      }
    } as unknown as TeacherConfirmationRouteRuntime;
    const res = response();
    const body = { claim_id: "claim_1", rejection_reason: "Needs a clearer bounded source." };
    const helpers = {
      readJson: async () => body,
      sendJson: (target: ServerResponse, status: number, payload: unknown) => {
        const fake = target as unknown as FakeResponse;
        fake.writeHead(status);
        fake.end(JSON.stringify(payload));
      },
      createEnvelope: (_context: unknown, payload: unknown) => ({ code: "OK", data: payload }),
      requireTeacher: () => undefined
    };
    await handleTeacherConfirmationRoute(
      runtime,
      { method: "POST" } as unknown as IncomingMessage,
      res as unknown as ServerResponse,
      new URL("http://localhost/api/v1/bff/teacher/confirmations/confirmation_001/reject"),
      { requestId: "req_1", tenantId: "tenant_demo", actorId: "usr_teacher" },
      helpers
    );
    expect(runtime.commands.reject).toHaveBeenCalledWith(
      { actor_id: "usr_teacher", tenant_id: "tenant_demo" },
      "confirmation_001",
      "claim_1",
      body,
      "req_1"
    );
    expect(res.statusCode).toBe(200);

    const commandInput = {
      claim_id: "claim_1",
      confirmation_id: "confirmation_001",
      course_package_ref: {},
      learning_goal_ref: {},
      rubric_ref: {},
      evidence_refs: [],
      context: {},
      criterion_decisions: [],
      teacher_feedback: "",
      idempotency_key: "idem_1"
    };
    const reviseHelpers = { ...helpers, readJson: async () => commandInput };
    await handleTeacherConfirmationRoute(
      runtime,
      { method: "POST" } as unknown as IncomingMessage,
      res as unknown as ServerResponse,
      new URL("http://localhost/api/v1/bff/teacher/confirmations/confirmation_001/revise"),
      { requestId: "req_2", tenantId: "tenant_demo", actorId: "usr_teacher" },
      reviseHelpers
    );
    expect(runtime.commands.revise).toHaveBeenCalledWith(
      { actor_id: "usr_teacher", tenant_id: "tenant_demo" },
      "confirmation_001",
      commandInput,
      "req_2"
    );
    expect(res.statusCode).toBe(201);

    const claimHelpers = {
      ...helpers,
      readJson: async () => ({
        context: { course_id: "c", run_id: "r", team_id: "t", role_key: "role" },
        evidence_set_digest: "a".repeat(64)
      })
    };
    await handleTeacherConfirmationRoute(
      runtime,
      { method: "POST" } as unknown as IncomingMessage,
      res as unknown as ServerResponse,
      new URL("http://localhost/api/v1/bff/teacher/confirmations/claims"),
      { requestId: "req_3", tenantId: "tenant_demo", actorId: "usr_teacher" },
      claimHelpers
    );
    expect(runtime.claims.claim).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);

    const claimStatusHelpers = { ...helpers, readJson: async () => ({}) };
    await handleTeacherConfirmationRoute(
      runtime,
      { method: "GET" } as unknown as IncomingMessage,
      res as unknown as ServerResponse,
      new URL("http://localhost/api/v1/bff/teacher/confirmations/claims/claim_1"),
      { requestId: "req_4", tenantId: "tenant_demo", actorId: "usr_teacher" },
      claimStatusHelpers
    );
    expect(runtime.claims.get).toHaveBeenCalledWith("claim_1", "usr_teacher", expect.any(String));
    expect(res.statusCode).toBe(200);

    await handleTeacherConfirmationRoute(
      runtime,
      { method: "POST" } as unknown as IncomingMessage,
      res as unknown as ServerResponse,
      new URL("http://localhost/api/v1/bff/teacher/confirmations/claims/claim_1/release"),
      { requestId: "req_5", tenantId: "tenant_demo", actorId: "usr_teacher" },
      claimStatusHelpers
    );
    expect(runtime.claims.release).toHaveBeenCalledWith("claim_1", "usr_teacher");
    expect(res.statusCode).toBe(200);
  });
});
