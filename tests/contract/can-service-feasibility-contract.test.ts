import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import {
  CAN_SERVICE_FEASIBILITY_SCHEMA_VERSION,
  isCanServiceFeasibilityResponse,
  type CanServiceFeasibilityResponse
} from "../../packages/shared-contracts/src/can-service-feasibility";

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8")) as unknown;

describe("R1 CAN service-feasibility contract", () => {
  it("keeps the schema and valid fixture aligned with the no-write response contract", () => {
    const schema = readJson("contracts/schemas/can-service-feasibility.v1.json") as {
      properties?: { schema_version?: { const?: string } };
    };
    const fixture = readJson("contracts/fixtures/can-service-feasibility.valid.json");

    expect(schema.properties?.schema_version?.const).toBe(CAN_SERVICE_FEASIBILITY_SCHEMA_VERSION);
    expect(isCanServiceFeasibilityResponse(fixture)).toBe(true);
    expect((fixture as CanServiceFeasibilityResponse).authority.official_truth_write).toBe(false);
    expect((fixture as CanServiceFeasibilityResponse).authority.settlement_write).toBe(false);
  });

  it("rejects the student-private fixture when it contains admin-only exact inputs", () => {
    expect(
      isCanServiceFeasibilityResponse(
        readJson("contracts/fixtures/can-service-feasibility.student-private.invalid.json")
      )
    ).toBe(false);
  });

  it("rejects cross-role privileged projections for every surface", () => {
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(
      readJson("contracts/schemas/can-service-feasibility.v1.json")
    );
    const fixture = readJson("contracts/fixtures/can-service-feasibility.valid.json") as Record<
      string,
      unknown
    >;
    const studentProjection = {
      candidate_id: fixture.candidate_id,
      excluded_fields: ["candidate", "exact_binding", "source_refs"],
      role_safe: true,
      status: "FEASIBLE",
      surface: "student",
      why_not: []
    };
    const studentWithAdmin = {
      ...fixture,
      surface: "student",
      source_refs: [],
      student_projection: studentProjection,
      admin_projection: fixture.teacher_projection
    };
    delete studentWithAdmin.candidate;
    delete studentWithAdmin.exact_binding;
    delete studentWithAdmin.teacher_projection;
    expect(validate(studentWithAdmin)).toBe(false);
    expect(isCanServiceFeasibilityResponse(studentWithAdmin)).toBe(false);

    const teacherWithStudent = { ...fixture, student_projection: studentProjection };
    expect(validate(teacherWithStudent)).toBe(false);

    const adminWithStudent = {
      ...fixture,
      surface: "admin",
      admin_projection: fixture.teacher_projection,
      student_projection: studentProjection
    };
    expect(validate(adminWithStudent)).toBe(false);
  });
});
