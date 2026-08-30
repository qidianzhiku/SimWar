import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { buildM30CourseFactorySourceEvidence } from "@simwar/sh-next-support";

function validator(): (value: unknown) => boolean {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const schema = JSON.parse(
    readFileSync(resolve("contracts/schemas/course-factory.v1.json"), "utf8")
  );
  return ajv.compile(schema);
}

function draft() {
  const digest = (char: string) => char.repeat(64);
  const blueprint = {
    content_digest: digest("a"),
    course_blueprint_id: "blueprint_m30",
    tenant_id: "tenant_demo",
    version: "1.0.0"
  };
  const scenario = {
    content_digest: digest("b"),
    scenario_package_id: "scenario_m30",
    tenant_id: "tenant_demo",
    version: "1.0.0"
  };
  const parameter = {
    content_digest: digest("c"),
    parameter_set_id: "parameter_m30",
    version: "1.0.0"
  };
  return {
    course_blueprint_reference: blueprint,
    course_package_id: "course_m30",
    description: "M30 source-backed course package.",
    factory_metadata: {
      known_limits: ["PUBLIC_SOURCE_BOUND; calibration not proven"],
      provenance: { kind: "ORIGINAL" },
      rights: {
        allowed_tenant_ids: ["tenant_demo"],
        copy_allowed: true,
        export_allowed: false,
        expires_at: "2026-11-30T00:00:00.000Z",
        owner_tenant_id: "tenant_demo"
      },
      schema_version: "course-factory.v1",
      source_evidence_reference: buildM30CourseFactorySourceEvidence(),
      source_manifest: {
        course_blueprint_reference: blueprint,
        parameter_set_reference: parameter,
        scenario_package_reference: scenario
      },
      user_data_policy: {
        copied_private_data: false,
        copied_user_decisions: false,
        copied_user_results: false
      }
    },
    parameter_set_reference: parameter,
    scenario_package_reference: scenario,
    title: "M30 source-backed course",
    version: "1.0.0"
  };
}

describe("M30 CourseFactory source evidence contract", () => {
  it("accepts the exact source evidence extension", () => {
    expect(validator()(draft())).toBe(true);
  });

  it("rejects an extension that attempts formal binding", () => {
    const candidate = draft();
    candidate.factory_metadata.source_evidence_reference.formal_binding_eligible = true;
    expect(validator()(candidate)).toBe(false);
  });
});
