import { describe, expect, it } from "vitest";
import {
  ShanghaiC0ConversionError,
  ShanghaiC0ConversionService
} from "../../services/api/src/shanghai-c0-conversion-service";
import type { ShanghaiC0Request } from "../../packages/shared-contracts/src";

const tenantId = "tenant_demo";
const binding = {
  exact_binding: true as const,
  tenant_id: tenantId,
  course_id: "course_demo",
  run_id: "run_shanghai_c0",
  team_id: "team_alpha",
  round_id: "round_1",
  round_no: 1,
  scenario_package_id: "scenario_shanghai_1",
  scenario_package_version: "1.0.0",
  parameter_set_id: "parameter_shanghai_1",
  parameter_set_version: "1.0.0",
  model_version_id: "model_shanghai_1",
  model_version: "1.0.0",
  engine_id: "toy_logit_wellness_v1",
  seed: 42
};

function request(macroId: ShanghaiC0Request["macro_id"]): ShanghaiC0Request {
  return {
    discriminator: "shanghai_c0_conversion_request",
    macro_id: macroId,
    exact_binding: binding,
    experience_profile: "STANDARD",
    experiment: {
      action:
        macroId === "M13"
          ? "refinance"
          : macroId === "M14"
            ? "positioning"
            : macroId === "M15"
              ? "service_shock"
              : macroId === "M16"
                ? "qualification"
                : macroId === "M17"
                  ? "episode"
                  : "rollback_dry_run",
      option_id: `${macroId.toLowerCase()}-option`,
      region: "shanghai",
      cohort: "community-eldercare",
      service_bundle: "integrated-care",
      positioning: "trusted-care",
      staffing_shock: -0.1,
      capacity_shock: -0.1,
      quality_shock: -0.05,
      horizon_rounds: macroId === "M15" ? 2 : undefined,
      episode_no: macroId === "M17" ? 1 : undefined,
      target_version: macroId === "M18" ? "2.0.0" : undefined
    },
    idempotency_key: `c0-${macroId.toLowerCase()}-001`
  };
}

function service(): ShanghaiC0ConversionService {
  return new ShanghaiC0ConversionService({
    now: () => "2026-08-30T00:00:00.000Z",
    getRun: async () => ({
      course_id: "course_demo",
      scenario_package_id: "scenario_shanghai_1",
      parameter_set_id: "parameter_shanghai_1"
    }),
    getRound: async () => ({
      tenant_id: tenantId,
      run_id: "run_shanghai_c0",
      round_id: "round_1",
      round_no: 1
    })
  });
}

describe("Shanghai M13-M18 C0 conversion service", () => {
  it.each(["M13", "M14", "M15", "M16", "M17", "M18"] as const)(
    "creates a current C0 receipt for %s without writing official truth",
    async (macroId) => {
      const target = service();
      const result = await target.createTeacher(
        { user_id: "usr_teacher", tenant_id: tenantId, roles: ["teacher"] },
        request(macroId)
      );

      expect(result.receipt.consumer_status).toBe("C0_CONSUMED");
      expect(result.receipt.state_a).toBe("C1_SUPPORT");
      expect(result.receipt.state_b).toBe("C0_CURRENT_PRODUCT_CONSUMPTION");
      expect(result.receipt.official_truth_write).toBe(false);
      expect(result.receipt.settlement_write).toBe(false);
      expect(result.receipt.parameter_formal_write).toBe(false);
      expect(result.receipt.provider).toBe("OFF");
      expect(result.receipt.current_surface_ref.length).toBeGreaterThan(0);
    }
  );

  it("keeps Student projection role-safe and accepts a non-official choice", async () => {
    const target = service();
    const created = await target.createTeacher(
      { user_id: "usr_teacher", tenant_id: tenantId, roles: ["teacher"] },
      request("M14")
    );
    const student = await target.getStudent(
      { user_id: "usr_student", tenant_id: tenantId, roles: ["learner"], team_id: "team_alpha" },
      created.receipt.receipt_id
    );

    expect(student.surface).toBe("STUDENT");
    expect(JSON.stringify(student)).not.toContain("parameter_set_id");
    expect(JSON.stringify(student)).not.toContain("model_version_id");
    const choice = await target.submitStudentChoice(
      { user_id: "usr_student", tenant_id: tenantId, roles: ["learner"], team_id: "team_alpha" },
      created.receipt.receipt_id,
      { option_id: "positioning-option" }
    );
    expect(choice.choice.status).toBe("NON_OFFICIAL_DRAFT");
    expect(choice.receipt.official_truth_write).toBe(false);
  });

  it("fails closed for stale exact bindings and cross-tenant access", async () => {
    const target = service();
    await expect(
      target.createTeacher(
        { user_id: "usr_teacher", tenant_id: tenantId, roles: ["teacher"] },
        { ...request("M13"), exact_binding: { ...binding, run_id: "run_other" } }
      )
    ).rejects.toMatchObject({ code: "SH_C0_EXACT_BINDING_REQUIRED" });

    const created = await target.createTeacher(
      { user_id: "usr_teacher", tenant_id: tenantId, roles: ["teacher"] },
      request("M13")
    );
    await expect(
      target.getStudent(
        {
          user_id: "usr_other",
          tenant_id: "tenant_other",
          roles: ["learner"],
          team_id: "team_alpha"
        },
        created.receipt.receipt_id
      )
    ).rejects.toMatchObject({ code: "SH_C0_FORBIDDEN" });
  });

  it("rejects unknown macro and malformed bounded shock inputs", async () => {
    const target = service();
    await expect(
      target.createTeacher(
        { user_id: "usr_teacher", tenant_id: tenantId, roles: ["teacher"] },
        { ...request("M13"), macro_id: "M19" as never }
      )
    ).rejects.toBeInstanceOf(ShanghaiC0ConversionError);
    await expect(
      target.createTeacher(
        { user_id: "usr_teacher", tenant_id: tenantId, roles: ["teacher"] },
        { ...request("M15"), experiment: { ...request("M15").experiment, capacity_shock: -2 } }
      )
    ).rejects.toMatchObject({ code: "SH_C0_EXPERIMENT_INVALID" });
  });
});
