import { resolve } from "node:path";
import Ajv from "ajv";
import SwaggerParser from "@apidevtools/swagger-parser";
import { describe, expect, it } from "vitest";

const specificationPath = resolve("contracts/openapi/p0-api.openapi.yaml");
type ResponseDocument = {
  paths: Record<
    string,
    {
      get: {
        responses: Record<
          string,
          { content: { "application/json": { schema: Record<string, unknown> } } }
        >;
      };
    }
  >;
};

describe("Decision Thread Evidence Spine OpenAPI contract", () => {
  it("binds all DDT error statuses to the canonical ApiErrorEnvelope", async () => {
    const spec = (await SwaggerParser.parse(specificationPath)) as unknown as ResponseDocument;
    for (const surface of ["teacher", "student", "admin"]) {
      for (const status of ["401", "403", "422", "500"]) {
        expect(
          spec.paths[`/api/v1/bff/${surface}/decision-thread/evidence-spine`].get.responses[status]
            .content["application/json"].schema
        ).toEqual({ $ref: "#/components/schemas/ApiErrorEnvelope" });
      }
    }
  });

  it("closes the public Student learning-report projection without changing internal W3 reports", async () => {
    const spec = (await SwaggerParser.dereference(
      specificationPath
    )) as unknown as ResponseDocument;
    const schema =
      spec.paths["/api/v1/bff/student/learning-reports"].get.responses["200"].content[
        "application/json"
      ].schema;
    const validate = new Ajv({ strict: false }).compile(schema);
    const report = {
      report_id: "student_report_1",
      context: {
        course_id: "course_1",
        run_id: "run_1",
        team_id: "team_1",
        role_key: "CEO",
        round_id: "round_1",
        round_no: 1
      },
      status: "CONFIRMED",
      learning_evidence: {
        criterion_results: [{ criterion_id: "criterion_1", level_ordinal: 2 }],
        student_visible_feedback: []
      },
      business_outcome: { status: "SEPARATE_SAFE_OUTCOME", summary: "separate published result" }
    };
    const envelope = {
      code: "OK",
      message: "success",
      request_id: "req_1",
      data: {
        scope: "student_team",
        report_schema_version: "student-learning-report.public.v1",
        known_limits: [],
        reports: [report]
      }
    };
    expect(validate(envelope)).toBe(true);
    for (const key of [
      "teacher_confirmation_ref",
      "report_ref",
      "report_digest",
      "source_confirmation_digest",
      "content_digest",
      "provenance_chain",
      "course_package_ref"
    ]) {
      expect(
        validate({
          ...envelope,
          data: { ...envelope.data, reports: [{ ...report, [key]: "private" }] }
        })
      ).toBe(false);
    }
  });

  it("requires exact context and keeps GSI pair selectors optional", async () => {
    const document = (await SwaggerParser.dereference(specificationPath)) as {
      paths: Record<
        string,
        {
          get?: {
            parameters?: Array<{ name: string; required?: boolean }>;
            "x-query-constraints"?: { allOrNone?: string[] };
            "x-runtime-constraints"?: {
              identity?: string;
              rejected_tokens?: string[];
              selected_gsi_to_round_must_equal_context_round?: boolean;
            };
            responses?: Record<string, unknown>;
          };
        }
      >;
    };
    for (const surface of ["teacher", "student", "admin"]) {
      const parameters =
        document.paths[`/api/v1/bff/${surface}/decision-thread/evidence-spine`]?.get?.parameters ??
        [];
      const required = new Set(
        parameters.filter((parameter) => parameter.required).map((parameter) => parameter.name)
      );
      expect(required).toEqual(
        new Set([
          "activity_id",
          "course_id",
          "role_key",
          "round_id",
          "round_no",
          "run_id",
          "team_id"
        ])
      );
      expect(parameters.find((parameter) => parameter.name === "gsi_from_round_id")?.required).toBe(
        false
      );
      expect(parameters.find((parameter) => parameter.name === "gsi_to_round_id")?.required).toBe(
        false
      );
      expect(
        document.paths[`/api/v1/bff/${surface}/decision-thread/evidence-spine`]?.get?.[
          "x-query-constraints"
        ]?.allOrNone
      ).toEqual(["gsi_from_round_id", "gsi_to_round_id"]);
      expect(
        document.paths[`/api/v1/bff/${surface}/decision-thread/evidence-spine`]?.get?.[
          "x-runtime-constraints"
        ]
      ).toMatchObject({
        identity: "trimmed_ascii_identifier",
        selected_gsi_to_round_must_equal_context_round: true,
        rejected_tokens: expect.arrayContaining(["latest", "default", "first"])
      });
      expect(
        document.paths[`/api/v1/bff/${surface}/decision-thread/evidence-spine`]?.get?.responses?.[
          "500"
        ]
      ).toBeDefined();
    }
  });

  it("keeps the Admin response schema independently bound to the Admin surface", async () => {
    const document = (await SwaggerParser.dereference(specificationPath)) as {
      components: {
        schemas: Record<
          string,
          { allOf?: unknown; properties?: Record<string, { const?: string }> }
        >;
      };
    };
    const schema = document.components.schemas.DdtAdminEvidenceSpine;
    expect(schema).toBeDefined();
    expect(schema.allOf).toBeUndefined();
    expect(schema.properties?.surface?.const).toBe("admin");
  });

  it("uses strict role-specific exact-context schemas", async () => {
    const document = (await SwaggerParser.parse(specificationPath)) as {
      components: {
        schemas: Record<
          string,
          {
            properties?: Record<string, { additionalProperties?: boolean; $ref?: string }>;
            required?: string[];
            additionalProperties?: boolean;
          }
        >;
      };
    };
    expect(document.components.schemas.DdtExactContext?.additionalProperties).toBe(false);
    expect(document.components.schemas.DdtStudentContext?.additionalProperties).toBe(false);
    expect(
      document.components.schemas.DdtTeacherEvidenceSpine?.properties?.exact_context?.$ref
    ).toBe("#/components/schemas/DdtExactContext");
    expect(document.components.schemas.DdtAdminEvidenceSpine?.properties?.exact_context?.$ref).toBe(
      "#/components/schemas/DdtExactContext"
    );
    expect(document.components.schemas.DdtSelectedRoundPair?.additionalProperties).toBe(false);
  });

  it("closes Student source provenance at the schema boundary", async () => {
    const document = (await SwaggerParser.dereference(specificationPath)) as {
      components: { schemas: Record<string, unknown> };
    };
    const schema = document.components.schemas.DdtStudentEvidenceSource;
    const validate = new Ajv({ strict: false }).compile(schema);
    const safeSource = {
      source: "M2P6",
      ledger: "OFFICIAL",
      status: "AVAILABLE",
      context_scope: "EXACT_DDT_CONTEXT",
      summary: "safe summary",
      known_limits: [],
      exact_context: {
        course_id: "course-1",
        run_id: "run-1",
        team_id: "team-1",
        round_id: "round-1",
        round_no: 1,
        role_key: "CEO"
      }
    };
    expect(validate(safeSource)).toBe(true);
    expect(
      validate({
        ...safeSource,
        provenance: {
          authority_owner: "private",
          source_ref: "private",
          contract_version: "private"
        }
      })
    ).toBe(false);
  });

  it("requires machine-readable source context scope", async () => {
    const document = (await SwaggerParser.dereference(specificationPath)) as {
      components: {
        schemas: Record<
          string,
          {
            required?: string[];
            properties?: Record<string, { enum?: string[] }>;
          }
        >;
      };
    };
    for (const schemaName of [
      "DdtTeacherEvidenceSource",
      "DdtStudentEvidenceSource",
      "DdtAdminEvidenceSource"
    ]) {
      const schema = document.components.schemas[schemaName];
      expect(schema.required).toContain("context_scope");
      expect(schema.properties.context_scope.enum).toEqual([
        "EXACT_DDT_CONTEXT",
        "TENANT_COURSE_ACTIVITY"
      ]);
    }
  });
});
