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

  it("rejects teacher finance provenance and incomplete projections on the student surface", () => {
    const fixture = JSON.parse(
      readFileSync(resolve("contracts/fixtures/executive-strategy-lab.valid.json"), "utf8")
    ) as Record<string, unknown> & {
      official_baseline: {
        officiality: "OFFICIAL";
        outcome_id: string | null;
        summary: string;
      };
      paths: Array<Record<string, unknown>>;
      transfer: unknown;
      teacher_projection?: unknown;
    };
    const pathWithoutIds = { ...fixture.paths[0] };
    delete pathWithoutIds.decision_ids;
    delete pathWithoutIds.mechanism_ids;
    const teacherFinance = pathWithoutIds.finance_feasibility;
    const studentProjection = {
      surface: "student" as const,
      role_safe: true as const,
      official_baseline: {
        officiality: fixture.official_baseline.officiality,
        outcome_id: fixture.official_baseline.outcome_id,
        summary: fixture.official_baseline.summary
      },
      paths: [],
      transfer: fixture.transfer,
      excluded_fields: ["source_refs", "model", "debt_schedule"]
    };
    const responseWithTeacherFinance = {
      ...fixture,
      surface: "student" as const,
      paths: [{ ...pathWithoutIds, finance_feasibility: teacherFinance }],
      student_projection: studentProjection
    };
    delete responseWithTeacherFinance.teacher_projection;

    expect(isESLResponse(responseWithTeacherFinance)).toBe(false);

    const responseWithIncompleteProjection = {
      ...responseWithTeacherFinance,
      paths: [],
      student_projection: { surface: "student" }
    };
    expect(isESLResponse(responseWithIncompleteProjection)).toBe(false);

    const teacherFinanceRecord = teacherFinance as Record<string, unknown>;
    const responseWithStudentFinance = {
      ...responseWithTeacherFinance,
      paths: [
        {
          ...pathWithoutIds,
          finance_feasibility: teacherFinanceRecord.student_view
        }
      ]
    };
    expect(isESLResponse(responseWithStudentFinance)).toBe(true);
  });

  it("requires complete teacher and admin projection structures", () => {
    const fixture = JSON.parse(
      readFileSync(resolve("contracts/fixtures/executive-strategy-lab.valid.json"), "utf8")
    ) as Record<string, unknown>;
    const incompleteTeacher = structuredClone(fixture) as Record<string, unknown>;
    incompleteTeacher.teacher_projection = { surface: "teacher" };
    expect(isESLResponse(incompleteTeacher)).toBe(false);

    const incompleteAdmin = structuredClone(fixture) as Record<string, unknown>;
    incompleteAdmin.surface = "admin";
    incompleteAdmin.paths = [];
    delete incompleteAdmin.teacher_projection;
    incompleteAdmin.admin_projection = { surface: "admin" };
    expect(isESLResponse(incompleteAdmin)).toBe(false);
  });

  it("enforces finance amount and status coupling in the JSON Schema", () => {
    const schema = JSON.parse(
      readFileSync(resolve("contracts/schemas/executive-strategy-lab.v1.json"), "utf8")
    ) as Record<string, unknown>;
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
    const fixture = JSON.parse(
      readFileSync(resolve("contracts/fixtures/executive-strategy-lab.valid.json"), "utf8")
    ) as Record<string, unknown>;

    const knownWithNullAmount = structuredClone(fixture) as Record<string, unknown>;
    const knownFinance = (knownWithNullAmount.paths as Array<Record<string, unknown>>)[0]
      .finance_feasibility as Record<string, unknown>;
    knownFinance.cash_flow = {
      ...(knownFinance.cash_flow as Record<string, unknown>),
      amount: null,
      status: "KNOWN"
    };
    expect(validate(knownWithNullAmount)).toBe(false);

    const unknownWithNumber = structuredClone(fixture) as Record<string, unknown>;
    const unknownFinance = (unknownWithNumber.paths as Array<Record<string, unknown>>)[0]
      .finance_feasibility as Record<string, unknown>;
    unknownFinance.cash_flow = {
      ...(unknownFinance.cash_flow as Record<string, unknown>),
      amount: 10,
      status: "UNKNOWN",
      unknown_reason: "SOURCE_BASIS_UNAVAILABLE"
    };
    expect(validate(unknownWithNumber)).toBe(false);
  });

  it("enforces DSCR ratio and status coupling in the JSON Schema", () => {
    const schema = JSON.parse(
      readFileSync(resolve("contracts/schemas/executive-strategy-lab.v1.json"), "utf8")
    ) as Record<string, unknown>;
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
    const fixture = JSON.parse(
      readFileSync(resolve("contracts/fixtures/executive-strategy-lab.valid.json"), "utf8")
    ) as Record<string, unknown>;

    const knownWithNullRatio = structuredClone(fixture) as Record<string, unknown>;
    const knownFinance = (knownWithNullRatio.paths as Array<Record<string, unknown>>)[0]
      .finance_feasibility as Record<string, unknown>;
    knownFinance.dscr = {
      ...(knownFinance.dscr as Record<string, unknown>),
      ratio: null,
      status: "KNOWN"
    };
    expect(validate(knownWithNullRatio)).toBe(false);

    const unknownWithNumber = structuredClone(fixture) as Record<string, unknown>;
    const unknownFinance = (unknownWithNumber.paths as Array<Record<string, unknown>>)[0]
      .finance_feasibility as Record<string, unknown>;
    unknownFinance.dscr = {
      ...(unknownFinance.dscr as Record<string, unknown>),
      ratio: 1.5,
      status: "UNKNOWN",
      unknown_reason: "DSCR_BASIS_UNAVAILABLE"
    };
    expect(validate(unknownWithNumber)).toBe(false);
  });

  it("enforces finance unit, currency, and status coupling", () => {
    const schema = JSON.parse(
      readFileSync(resolve("contracts/schemas/executive-strategy-lab.v1.json"), "utf8")
    ) as Record<string, unknown>;
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
    const fixture = JSON.parse(
      readFileSync(resolve("contracts/fixtures/executive-strategy-lab.valid.json"), "utf8")
    ) as Record<string, unknown>;

    const knownWithUnknownCurrency = structuredClone(fixture) as Record<string, unknown>;
    const knownFinance = (knownWithUnknownCurrency.paths as Array<Record<string, unknown>>)[0]
      .finance_feasibility as Record<string, unknown>;
    knownFinance.cash_flow = {
      ...(knownFinance.cash_flow as Record<string, unknown>),
      currency: "UNKNOWN"
    };
    expect(validate(knownWithUnknownCurrency)).toBe(false);
    expect(isESLResponse(knownWithUnknownCurrency)).toBe(false);

    const ratioWithCurrency = structuredClone(fixture) as Record<string, unknown>;
    const ratioFinance = (ratioWithCurrency.paths as Array<Record<string, unknown>>)[0]
      .finance_feasibility as Record<string, unknown>;
    ratioFinance.capex = {
      ...(ratioFinance.capex as Record<string, unknown>),
      unit: "RATIO",
      currency: "SIMWAR_UNITS"
    };
    expect(validate(ratioWithCurrency)).toBe(false);
    expect(isESLResponse(ratioWithCurrency)).toBe(false);
  });

  it("rejects finance basis amount and status contradictions in the runtime guard", () => {
    const fixture = JSON.parse(
      readFileSync(resolve("contracts/fixtures/executive-strategy-lab.valid.json"), "utf8")
    ) as Record<string, unknown>;
    const knownWithNullAmount = structuredClone(fixture) as Record<string, unknown>;
    const knownFinance = (knownWithNullAmount.paths as Array<Record<string, unknown>>)[0]
      .finance_feasibility as Record<string, unknown>;
    knownFinance.cash_flow = {
      ...(knownFinance.cash_flow as Record<string, unknown>),
      amount: null,
      status: "KNOWN"
    };
    expect(isESLResponse(knownWithNullAmount)).toBe(false);

    const unknownWithNumber = structuredClone(fixture) as Record<string, unknown>;
    const unknownFinance = (unknownWithNumber.paths as Array<Record<string, unknown>>)[0]
      .finance_feasibility as Record<string, unknown>;
    unknownFinance.cash_flow = {
      ...(unknownFinance.cash_flow as Record<string, unknown>),
      amount: 10,
      status: "UNKNOWN",
      unknown_reason: "SOURCE_BASIS_UNAVAILABLE"
    };
    expect(isESLResponse(unknownWithNumber)).toBe(false);
  });

  it("requires at least one finance projection source reference", () => {
    const schema = JSON.parse(
      readFileSync(resolve("contracts/schemas/executive-strategy-lab.v1.json"), "utf8")
    ) as Record<string, unknown>;
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
    const fixture = JSON.parse(
      readFileSync(resolve("contracts/fixtures/executive-strategy-lab.valid.json"), "utf8")
    ) as Record<string, unknown>;
    const missingSourceRefs = structuredClone(fixture) as Record<string, unknown>;
    const finance = (missingSourceRefs.paths as Array<Record<string, unknown>>)[0]
      .finance_feasibility as Record<string, unknown>;
    finance.source_refs = [];

    expect(validate(missingSourceRefs)).toBe(false);
    expect(isESLResponse(missingSourceRefs)).toBe(false);
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

  it("keeps shared response paths discriminated by surface", () => {
    const validTeacher = JSON.parse(
      readFileSync(resolve("contracts/fixtures/executive-strategy-lab.valid.json"), "utf8")
    ) as ESLResponse;

    if (validTeacher.surface === "teacher") {
      expect(validTeacher.paths.every((path) => Array.isArray(path.decision_ids))).toBe(true);
    } else if (validTeacher.surface === "student") {
      expect(validTeacher.paths.every((path) => !Object.hasOwn(path, "decision_ids"))).toBe(true);
    } else {
      expect(validTeacher.paths.every((path) => Array.isArray(path.decision_ids))).toBe(true);
    }
  });
});
