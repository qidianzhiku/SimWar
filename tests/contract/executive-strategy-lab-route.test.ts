import { describe, expect, it } from "vitest";
import type { CurrentUser, ESLResponse } from "@simwar/shared-contracts";
import { handleExecutiveStrategyLabRoute } from "../../services/api/src/routes/executive-strategy-lab-routes.js";
import type { ExecutiveStrategyLabService } from "../../services/api/src/executive-strategy-lab-service.js";

const teacher: CurrentUser = {
  display_name: "Teacher",
  permissions: ["course:read"],
  roles: ["teacher"],
  tenant_id: "tenant_demo",
  user_id: "usr_teacher"
};

const student: CurrentUser = {
  display_name: "Student",
  permissions: ["course:read"],
  roles: ["student"],
  tenant_id: "tenant_demo",
  team_id: "team_alpha",
  user_id: "usr_student"
};

function response() {
  return {
    statusCode: 0,
    body: "",
    writeHead(status: number) {
      this.statusCode = status;
    },
    end(body: string) {
      this.body = body;
    }
  };
}

const candidate: ESLResponse = {
  schema_version: "main-esl-o1.v1",
  candidate_id: "esl_candidate_1234567890abcdef",
  surface: "teacher",
  exact_binding: {
    tenant_id: "tenant_demo",
    course_id: "course_demo",
    run_id: "run_demo",
    team_id: "team_alpha",
    round_id: "round_demo_1",
    round_no: 1,
    scenario_package_id: "scenario_demo",
    scenario_version: "1.0.0",
    parameter_set_id: "parameter_demo",
    parameter_set_version: "1.0.0",
    model_version_id: "model_demo",
    model_version: "1.0.0",
    model_artifact_id: "artifact_demo",
    model_artifact_version: "1.0.0",
    engine_id: "toy_logit_wellness_v1",
    plugin_ids: ["plugin_wellness_stub"],
    seed: 79
  },
  official_baseline: {
    officiality: "OFFICIAL",
    outcome_id: "outcome_demo",
    state_ref: null,
    summary: "官方基线"
  },
  paths: [],
  mechanisms: [],
  transfer: {
    status: "DRAFT",
    statement: "假设",
    evidence_path_ids: [],
    applies_to_next_round: false
  },
  source_refs: {
    official_outcome_id: "outcome_demo",
    o4_candidate_digest: null,
    m4_candidate_digests: []
  },
  authority: {
    runtime_authority: "JSON_INTERNAL_ONLY",
    official_realized_source: "SIMULATION_CORE",
    writer_authority: "SOLE_W4_ENTERPRISE_STATE_SERVICE",
    formal_truth_write: false,
    settlement_write: false,
    replay_truth_write: false,
    provider: "OFF"
  },
  known_limits: []
};

describe("Executive Strategy Lab routes", () => {
  it("keeps Teacher create, Student projection, and Admin audit on separate paths", async () => {
    const current = response();
    const calls: string[] = [];
    const service = {
      createCandidate: async () => {
        calls.push("create");
        return candidate;
      },
      getStudent: async () => {
        calls.push("student");
        return { ...candidate, surface: "student" };
      },
      getAdmin: async () => {
        calls.push("admin");
        return { ...candidate, surface: "admin" };
      },
      getTeacher: async () => {
        calls.push("teacher");
        return candidate;
      }
    } as unknown as ExecutiveStrategyLabService;
    const helpers = {
      readJson: async () => ({
        discriminator: "esl_strategy_lab_request",
        exact_binding: candidate.exact_binding,
        paths: [
          { path_id: "path_a", label: "A", decision_ids: ["decision_a"] },
          { path_id: "path_b", label: "B", decision_ids: ["decision_b"] }
        ],
        transfer_hypothesis: "假设",
        idempotency_key: "route-1"
      }),
      sendJson: (_response: unknown, status: number, body: unknown) => {
        current.statusCode = status;
        current.body = JSON.stringify(body);
      },
      createEnvelope: (_context: unknown, payload: unknown) => ({ code: "OK", data: payload }),
      requireTeacher: () => teacher,
      requireStudent: () => student,
      requireAdmin: () => ({ ...teacher, roles: ["tenant_admin"] as const })
    };
    const context = { requestId: "req-1", tenantId: "tenant_demo" };

    expect(
      await handleExecutiveStrategyLabRoute(
        service,
        { method: "POST" } as never,
        current as never,
        new URL("http://localhost/api/v1/bff/teacher/esl/strategy-lab"),
        context,
        helpers
      )
    ).toBe(true);
    expect(current.statusCode).toBe(201);

    expect(
      await handleExecutiveStrategyLabRoute(
        service,
        { method: "GET" } as never,
        current as never,
        new URL(
          "http://localhost/api/v1/bff/student/esl/candidates/esl_candidate_1234567890abcdef"
        ),
        context,
        helpers
      )
    ).toBe(true);
    expect(current.statusCode).toBe(200);

    expect(
      await handleExecutiveStrategyLabRoute(
        service,
        { method: "GET" } as never,
        current as never,
        new URL(
          "http://localhost/api/v1/bff/admin/esl/audit?candidate_id=esl_candidate_1234567890abcdef"
        ),
        context,
        helpers
      )
    ).toBe(true);
    expect(calls).toEqual(["create", "student", "admin"]);
  });

  it("preserves HTTP authentication status codes from the shared server guards", async () => {
    const current = response();
    const authError = Object.assign(new Error("authentication required"), {
      statusCode: 401,
      code: "AUTH-401-001"
    });
    const helpers = {
      readJson: async () => ({}),
      sendJson: (_response: unknown, status: number, body: unknown) => {
        current.statusCode = status;
        current.body = JSON.stringify(body);
      },
      createEnvelope: (_context: unknown, payload: unknown) => ({ code: "OK", data: payload }),
      requireTeacher: () => {
        throw authError;
      },
      requireStudent: () => student,
      requireAdmin: () => ({ ...teacher, roles: ["tenant_admin"] as const })
    };

    expect(
      await handleExecutiveStrategyLabRoute(
        {} as ExecutiveStrategyLabService,
        { method: "POST" } as never,
        current as never,
        new URL("http://localhost/api/v1/bff/teacher/esl/strategy-lab"),
        { requestId: "req-auth", tenantId: "tenant_demo" },
        helpers
      )
    ).toBe(true);
    expect(current.statusCode).toBe(401);
    expect(current.body).toContain("AUTH-401-001");
  });
});
