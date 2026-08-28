import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import {
  SHANGHAI_FULL_VERTICAL_MISSION_ID,
  SHANGHAI_FULL_VERTICAL_SCHEMA_VERSION,
  type ShanghaiFullVerticalAdminProjection,
  type ShanghaiFullVerticalStudentProjection,
  type ShanghaiFullVerticalTeacherProjection
} from "../../packages/shared-contracts/src";

const schema = JSON.parse(
  readFileSync(resolve("contracts/schemas/shanghai-full-vertical.v1.json"), "utf8")
);
const fixture = JSON.parse(
  readFileSync(resolve("contracts/fixtures/shanghai-full-vertical.valid.json"), "utf8")
);

describe("MAIN Shanghai full vertical contract", () => {
  it("freezes mission identity and validates the three role-specific projections", () => {
    expect(SHANGHAI_FULL_VERTICAL_SCHEMA_VERSION).toBe("simwar.shanghai.full-vertical.v1");
    expect(SHANGHAI_FULL_VERTICAL_MISSION_ID).toBe("MAIN-SH-FV-O1-GOVERNED-SHANGHAI-FULL-VERTICAL");

    const validate = new Ajv({ strict: false }).compile(schema);
    expect(validate(fixture), JSON.stringify(validate.errors)).toBe(true);

    const teacher = fixture.teacher as ShanghaiFullVerticalTeacherProjection;
    const student = fixture.student as ShanghaiFullVerticalStudentProjection;
    const admin = fixture.admin as ShanghaiFullVerticalAdminProjection;
    expect(teacher.surface).toBe("TEACHER");
    expect(teacher.binding?.model_version_ref).toBeTruthy();
    expect(student.surface).toBe("STUDENT");
    expect(student.projection.visibility).toBe("ROLE_SAFE_STUDENT");
    expect(admin.surface).toBe("ADMIN");
    expect(admin.binding.scenario_package_reference).toBeTruthy();
    expect(JSON.stringify(student)).not.toContain("parameter_values");
    expect(JSON.stringify(student)).not.toContain("content_digest");
  });

  it("rejects a student projection that contains private binding fields", () => {
    const validate = new Ajv({ strict: false }).compile(schema);
    const leaked = structuredClone(fixture) as Record<string, unknown>;
    (leaked.student as Record<string, unknown>).private_parameter_values = {};
    expect(validate(leaked)).toBe(false);
  });

  it("rejects private fields nested inside the student projection", () => {
    const validate = new Ajv({ strict: false }).compile(schema);
    const leaked = structuredClone(fixture) as Record<string, unknown>;
    (leaked.student as Record<string, unknown>).projection = {
      ...(leaked.student as { projection: Record<string, unknown> }).projection,
      parameter_values: {}
    };
    expect(validate(leaked)).toBe(false);
  });
});
