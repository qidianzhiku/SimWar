import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  isESLRequest,
  isESLResponse,
  type ESLRequest,
  type ESLResponse
} from "@simwar/shared-contracts";

const request: ESLRequest = {
  discriminator: "esl_strategy_lab_request",
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
  paths: [
    { path_id: "path_a", label: "优先投资", decision_ids: ["decision_a"] },
    { path_id: "path_b", label: "保守运营", decision_ids: ["decision_b"] }
  ],
  transfer_hypothesis: "下一轮先验证服务质量与现金缓冲的平衡。",
  idempotency_key: "esl-contract-001"
};

describe("Executive Strategy Lab contract", () => {
  it("accepts exact context and bounded alternatives", () => {
    expect(isESLRequest(request)).toBe(true);
  });

  it("rejects implicit latest/default references and unbounded paths", () => {
    expect(
      isESLRequest({
        ...request,
        exact_binding: { ...request.exact_binding, model_version: "latest" }
      })
    ).toBe(false);
    expect(
      isESLRequest({
        ...request,
        paths: Array.from({ length: 4 }, (_, index) => ({
          path_id: `path_${index}`,
          label: `path ${index}`,
          decision_ids: ["decision_a"]
        }))
      })
    ).toBe(false);
  });

  it("requires the official/non-official and no-write boundary in responses", () => {
    const response: ESLResponse = {
      schema_version: "main-esl-o2p.v1",
      candidate_id: "esl_candidate_1234567890abcdef",
      surface: "teacher",
      exact_binding: request.exact_binding,
      official_baseline: {
        officiality: "OFFICIAL",
        outcome_id: "outcome_demo",
        state_ref: null,
        summary: "官方基线已解析。"
      },
      paths: [],
      mechanisms: [],
      transfer: {
        status: "DRAFT",
        statement: request.transfer_hypothesis,
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
      known_limits: ["测试限制"],
      teacher_projection: {
        surface: "teacher",
        available_actions: [],
        official_baseline: {
          officiality: "OFFICIAL",
          outcome_id: "outcome_demo",
          state_ref: null,
          summary: "官方基线已解析。"
        },
        paths: [],
        mechanisms: [],
        transfer: {
          status: "DRAFT",
          statement: request.transfer_hypothesis,
          evidence_path_ids: [],
          applies_to_next_round: false
        }
      }
    };
    expect(isESLResponse(response)).toBe(true);
    expect(JSON.stringify(response)).not.toContain("state_true");
    expect(JSON.stringify(response)).not.toContain("settlement_result");
  });

  it("enforces response-surface projection and path isolation in the runtime guard", () => {
    const teacherResponse: ESLResponse = {
      schema_version: "main-esl-o2p.v1",
      candidate_id: "esl_candidate_1234567890abcdef",
      surface: "teacher",
      exact_binding: request.exact_binding,
      official_baseline: {
        officiality: "OFFICIAL",
        outcome_id: "outcome_demo",
        state_ref: null,
        summary: "官方基线已解析。"
      },
      paths: [],
      mechanisms: [],
      transfer: {
        status: "DRAFT",
        statement: request.transfer_hypothesis,
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
      known_limits: ["测试限制"],
      teacher_projection: {
        surface: "teacher",
        available_actions: [],
        official_baseline: {
          officiality: "OFFICIAL",
          outcome_id: "outcome_demo",
          state_ref: null,
          summary: "官方基线已解析。"
        },
        paths: [],
        mechanisms: [],
        transfer: {
          status: "DRAFT",
          statement: request.transfer_hypothesis,
          evidence_path_ids: [],
          applies_to_next_round: false
        }
      }
    };
    const studentWithTeacherProjection = {
      ...teacherResponse,
      surface: "student" as const,
      student_projection: {
        surface: "student" as const,
        role_safe: true as const,
        official_baseline: {
          officiality: "OFFICIAL" as const,
          outcome_id: "outcome_demo",
          summary: "官方基线已解析。"
        },
        paths: [],
        transfer: teacherResponse.transfer,
        excluded_fields: ["decision_ids"]
      }
    };

    expect(isESLResponse(teacherResponse)).toBe(true);
    expect(isESLResponse(studentWithTeacherProjection)).toBe(false);
  });

  it("binds root path shape to the declared response surface", () => {
    const schema = JSON.parse(
      readFileSync(resolve("contracts/schemas/executive-strategy-lab.v1.json"), "utf8")
    ) as Record<string, unknown>;
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
    const validTeacher = JSON.parse(
      readFileSync(resolve("contracts/fixtures/executive-strategy-lab.valid.json"), "utf8")
    ) as Record<string, unknown>;
    const invalidStudent = { ...validTeacher, surface: "student" };

    expect(validate(validTeacher)).toBe(true);
    expect(validate(invalidStudent)).toBe(false);
  });

  it("requires and isolates the projection that matches the declared response surface", () => {
    const schema = JSON.parse(
      readFileSync(resolve("contracts/schemas/executive-strategy-lab.v1.json"), "utf8")
    ) as Record<string, unknown>;
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
    const validTeacher = JSON.parse(
      readFileSync(resolve("contracts/fixtures/executive-strategy-lab.valid.json"), "utf8")
    ) as Record<string, unknown> & {
      official_baseline: {
        officiality: string;
        outcome_id: string | null;
        summary: string;
      };
      transfer: unknown;
      teacher_projection?: unknown;
    };
    const studentProjection = {
      surface: "student",
      role_safe: true,
      official_baseline: {
        officiality: validTeacher.official_baseline.officiality,
        outcome_id: validTeacher.official_baseline.outcome_id,
        summary: validTeacher.official_baseline.summary
      },
      paths: [],
      transfer: validTeacher.transfer,
      excluded_fields: ["decision_ids", "teacher_admin_provenance"]
    };
    const validStudent = {
      ...validTeacher,
      surface: "student",
      paths: [],
      student_projection: studentProjection
    };
    delete validStudent.teacher_projection;
    const studentWithTeacherProjection = {
      ...validStudent,
      teacher_projection: validTeacher.teacher_projection
    };
    const teacherWithStudentProjection = {
      ...validTeacher,
      student_projection: studentProjection
    };

    expect(validate(validTeacher)).toBe(true);
    expect(validate(validStudent)).toBe(true);
    expect(validate(studentWithTeacherProjection)).toBe(false);
    expect(validate(teacherWithStudentProjection)).toBe(false);
  });
});
