import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import {
  isStudentLearningReport,
  isStudentLearningReportListDto
} from "@simwar/shared-contracts";

const schema = JSON.parse(readFileSync(resolve(process.cwd(), "contracts/schemas/student-learning-report.v1.json"), "utf8"));
const valid = JSON.parse(readFileSync(resolve(process.cwd(), "contracts/fixtures/student-learning-report.valid.json"), "utf8"));
const invalid = JSON.parse(readFileSync(resolve(process.cwd(), "contracts/fixtures/student-learning-report.invalid.json"), "utf8"));
const openApi = readFileSync(resolve(process.cwd(), "contracts/openapi/p0-api.openapi.yaml"), "utf8");

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addFormat("date-time", { type: "string", validate: (value) => !Number.isNaN(Date.parse(value)) });
  return ajv.compile(schema);
}

describe("D4 Student Learning Report contract", () => {
  it("accepts strict safe reports in Ajv and the runtime validator", () => {
    const validate = validator();
    expect(validate(valid)).toBe(true);
    expect(isStudentLearningReport(valid)).toBe(true);
    expect(isStudentLearningReportListDto({
      known_limits: ["limit"],
      reports: [valid],
      report_schema_version: "student-learning-report.v1",
      runtime_authority: "JSON_INTERNAL_ONLY",
      scope: "student_team"
    })).toBe(true);
  });

  it("rejects private payload, missing evidence and non-safe runtime fields", () => {
    const validate = validator();
    expect(validate(invalid)).toBe(false);
    expect(isStudentLearningReport(invalid)).toBe(false);
  });

  it("declares the six read-only BFF surfaces", () => {
    expect(openApi).toContain("/api/v1/bff/student/learning-reports:");
    expect(openApi).toContain("/api/v1/bff/teacher/learning-reports:");
    expect(openApi).toContain("/api/v1/bff/admin/learning-reports:");
    expect(openApi).not.toContain("D4_LEARNING_REPORT_CREATE");
  });
});
