import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import { W5GovernedModelService } from "../../services/api/src/w5-governed-model-service";

const schema = JSON.parse(
  readFileSync(resolve("contracts/schemas/w5-governed-model.v1.json"), "utf8")
);

describe("W5 governed model contract", () => {
  it("validates teacher, convergence and student projections", () => {
    const ajv = new Ajv({ strict: false });
    const validate = ajv.compile(schema);
    const service = new W5GovernedModelService({ now: () => "2026-08-20T12:30:00.000Z" });
    const actor = { actor_id: "usr_teacher", role: "teacher" as const, tenant_id: "tenant_demo" };
    const scope = { activity_id: "w5-governed-model-studio", course_id: "course_demo" };
    const created = service.createDraft(actor, scope, {}).draft;
    const teacher = service.getTeacherProjection(actor, scope);

    expect(validate(teacher), JSON.stringify(validate.errors)).toBe(true);
    const validated = service.validateDraft(actor, scope, created.draft_id).draft;
    const frozen = service.freezeDraft(actor, scope, validated.draft_id).draft;
    service.bindDraft(actor, scope, frozen.draft_id, {
      parameter_set_reference: {
        content_digest: "a".repeat(64),
        parameter_set_id: "param_toy_approved_1",
        version: "1.0.0"
      },
      round_no: 1,
      run_id: "run_demo",
      scenario_package_reference: {
        content_digest: "b".repeat(64),
        scenario_package_id: "scenario_eldercare_demo",
        tenant_id: "tenant_demo",
        version: "1.0.0"
      },
      seed: 42
    });
    const convergence = service.evaluate(
      actor,
      { ...scope, round_no: 1, run_id: "run_demo" },
      frozen.draft_id,
      "STANDARD"
    );
    expect(validate(convergence), JSON.stringify(validate.errors)).toBe(true);
    const student = service.projectStudent(
      { actor_id: "usr_student", role: "learner", tenant_id: "tenant_demo" },
      { ...scope, round_no: 1, run_id: "run_demo" },
      frozen.draft_id,
      "STANDARD"
    );
    expect(validate(student), JSON.stringify(validate.errors)).toBe(true);
    expect(JSON.stringify(student)).not.toContain("parameter_values");
  });
});
