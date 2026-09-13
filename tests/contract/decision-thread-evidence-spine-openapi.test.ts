import { resolve } from "node:path";
import Ajv from "ajv";
import SwaggerParser from "@apidevtools/swagger-parser";
import { describe, expect, it } from "vitest";

const specificationPath = resolve("contracts/openapi/p0-api.openapi.yaml");

describe("Decision Thread Evidence Spine OpenAPI contract", () => {
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
});
