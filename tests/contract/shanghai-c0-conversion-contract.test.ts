import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import {
  ShanghaiC0ConversionService,
  type ShanghaiC0Request
} from "../../services/api/src/shanghai-c0-conversion-service";

const schema = JSON.parse(
  readFileSync(resolve("contracts/schemas/shanghai-c0-conversion.v1.json"), "utf8")
);

const exactBinding = {
  exact_binding: true as const,
  tenant_id: "tenant_demo",
  course_id: "course_demo",
  run_id: "run_contract",
  team_id: "team_alpha",
  round_id: "round_1",
  round_no: 1,
  scenario_package_id: "scenario_contract",
  scenario_package_version: "1.0.0",
  parameter_set_id: "parameter_contract",
  parameter_set_version: "1.0.0",
  model_version_id: "model_contract",
  model_version: "1.0.0",
  engine_id: "toy_logit_wellness_v1",
  seed: 7
};

function request(macroId: ShanghaiC0Request["macro_id"]): ShanghaiC0Request {
  return {
    discriminator: "shanghai_c0_conversion_request",
    macro_id: macroId,
    exact_binding: exactBinding,
    experience_profile: "STANDARD",
    experiment: {
      action:
        macroId === "M13"
          ? "loan"
          : macroId === "M14"
            ? "positioning"
            : macroId === "M15"
              ? "service_shock"
              : macroId === "M16"
                ? "qualification"
                : macroId === "M17"
                  ? "episode"
                  : "diff",
      option_id: `${macroId}-option`,
      region: "shanghai",
      cohort: "community-eldercare",
      service_bundle: "integrated-care",
      positioning: "trusted-care",
      staffing_shock: -0.1,
      capacity_shock: -0.1,
      quality_shock: -0.1,
      horizon_rounds: macroId === "M15" ? 2 : undefined,
      episode_no: macroId === "M17" ? 1 : undefined,
      target_version: macroId === "M18" ? "2.0.0" : undefined
    },
    idempotency_key: `contract-${macroId}`
  };
}

describe("Shanghai C0 conversion JSON contract", () => {
  it("validates request and all role projections", async () => {
    const validate = new Ajv({ strict: false }).compile(schema);
    const target = new ShanghaiC0ConversionService({
      now: () => "2026-08-30T00:00:00.000Z",
      getRun: async () => ({
        course_id: "course_demo",
        scenario_package_id: "scenario_contract",
        parameter_set_id: "parameter_contract"
      }),
      getRound: async () => ({
        tenant_id: "tenant_demo",
        run_id: "run_contract",
        round_id: "round_1",
        round_no: 1
      })
    });
    const actor = { user_id: "usr_teacher", tenant_id: "tenant_demo", roles: ["teacher"] as const };
    const teacher = await target.createTeacher(actor, request("M13"));
    expect(validate(request("M13")), JSON.stringify(validate.errors)).toBe(true);
    expect(validate(teacher), JSON.stringify(validate.errors)).toBe(true);
    expect(
      validate(
        await target.getStudent(
          {
            user_id: "usr_student",
            tenant_id: "tenant_demo",
            roles: ["learner"],
            team_id: "team_alpha"
          },
          teacher.receipt.receipt_id
        )
      ),
      JSON.stringify(validate.errors)
    ).toBe(true);
    expect(
      validate(
        await target.getAdmin(
          { user_id: "usr_admin", tenant_id: "tenant_demo", roles: ["tenant_admin"] },
          teacher.receipt.receipt_id
        )
      ),
      JSON.stringify(validate.errors)
    ).toBe(true);
  });
});
