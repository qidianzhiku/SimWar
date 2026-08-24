import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import {
  OPERATING_WORLD_MISSION_ID,
  OPERATING_WORLD_SCHEMA_VERSION,
  type OperatingWorldPreviewReceipt,
  type OperatingWorldStudentProjection
} from "../../packages/shared-contracts/src";
import {
  defaultFamilies,
  OperatingWorldService
} from "../../services/api/src/operating-world-service";

const schema = JSON.parse(
  readFileSync(resolve("contracts/schemas/operating-world.v1.json"), "utf8")
);

describe("SH-M3 Operating World shared contract", () => {
  it("freezes the mission/schema identity and all four bounded family descriptors", () => {
    expect(OPERATING_WORLD_SCHEMA_VERSION).toBe("simwar.sh-m3-operating-world.v1");
    expect(OPERATING_WORLD_MISSION_ID).toBe("SIMWAR-SH-M3-W5-OPERATING-WORLD-MACRO-R2-20260823");
    expect(Object.keys(defaultFamilies()).sort()).toEqual(["SH-16", "SH-17", "SH-18", "SH-19"]);
    expect(defaultFamilies()["SH-17"]).toEqual(
      expect.objectContaining({
        capital_cost: expect.any(Number),
        construction_cost: expect.any(Number),
        construction_cycle: expect.any(Number),
        info: expect.objectContaining({
          source_ref: expect.any(String),
          known_limits: expect.any(Array)
        })
      })
    );
    const validate = new Ajv({ strict: false }).compile(schema);
    const teacher = new OperatingWorldService({
      now: () => "2026-08-23T00:00:00.000Z"
    }).getTeacherProjection(
      { actor_id: "teacher", role: "teacher", tenant_id: "tenant_demo" },
      { activity_id: "sh-m3-operating-world", course_id: "course_demo" }
    );
    expect(validate(teacher), JSON.stringify(validate.errors)).toBe(true);
  });

  it("requires non-official preview receipts and role-safe student projection shapes", () => {
    const receipt: OperatingWorldPreviewReceipt = {
      consumer_ref: "W4_CAPITAL_ACTION_OR_NEW_PROJECT_ADMISSION",
      diagnostics: [],
      effect_class: "SHADOW_ONLY",
      input_digest: "a".repeat(64),
      known_limits: ["limit"],
      no_official_write: true,
      parameter_delta: {},
      predicted_outputs: {},
      preview_digest: "b".repeat(64),
      preview_id: "preview-1",
      scenario_variant: "BASE",
      seed: 1,
      uncertainty: {}
    };
    const student: OperatingWorldStudentProjection = {
      brief: {
        construction_cost_range: [1, 2],
        construction_cycle_range: [1, 2],
        demand_outlook: 0.5,
        financing_environment: 0.5,
        known_limits: ["limit"],
        service_capacity: 1,
        visible_policy: "policy",
        wage_pressure: 0.1,
        workforce_supply: 1
      },
      binding_digest: "c".repeat(64),
      mission_id: OPERATING_WORLD_MISSION_ID,
      operation_id: "SH_M3_STUDENT_OPERATING_WORLD_BRIEF_GET_V1",
      visibility: "ROLE_SAFE_STUDENT"
    };
    expect(receipt.no_official_write).toBe(true);
    expect(JSON.stringify(student)).not.toContain("source_ref");
    expect(JSON.stringify(student)).not.toContain("parameter_set_reference");
    const leaked = {
      ...student,
      brief: { ...student.brief, source_ref: "private://raw-source" }
    };
    const validate = new Ajv({ strict: false }).compile(schema);
    expect(validate(leaked)).toBe(false);
  });
});
