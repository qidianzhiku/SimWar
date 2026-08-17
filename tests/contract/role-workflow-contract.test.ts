import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;

interface OpenApiOperation {
  parameters?: Array<{ in?: string; name?: string; required?: boolean }>;
  requestBody?: {
    content?: { "application/json"?: { schema?: { $ref?: string } } };
  };
  responses?: Record<string, { content?: { "application/json"?: { schema?: { $ref?: string } } } }>;
}

interface OpenApiDocument {
  components: {
    schemas: Record<
      string,
      {
        additionalProperties?: boolean;
        properties?: Record<string, unknown>;
        required?: string[];
      }
    >;
  };
  paths: Record<string, Record<string, OpenApiOperation>>;
}

const openApiDocument = (): OpenApiDocument =>
  yaml.load(
    readFileSync(resolve("contracts/openapi/p0-api.openapi.yaml"), "utf8")
  ) as OpenApiDocument;

describe("Role Workflow executable contracts", () => {
  it("validates Teacher and Student workspace fixtures and rejects private Student fields", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const student = ajv.compile(
      readJson("contracts/schemas/student-role-workflow-workspace.v1.json")
    );
    const teacher = ajv.compile(
      readJson("contracts/schemas/teacher-role-workflow-workspace.v1.json")
    );

    const studentFixture = readJson(
      "contracts/fixtures/student-role-workflow-workspace.valid.json"
    ) as Record<string, unknown>;
    const captainWorkspace = {
      ...studentFixture,
      merge_candidate: {
        created_at: "2026-07-31T02:02:00.000Z",
        merge_commit_id: "merge_contract",
        status: "validated"
      }
    };
    expect(student(studentFixture)).toBe(true);
    expect(student(captainWorkspace)).toBe(true);
    expect(
      student({
        ...captainWorkspace,
        merge_candidate: {
          ...(captainWorkspace.merge_candidate as Record<string, unknown>),
          merged_payload: { strategy_statement: "private team payload" }
        }
      })
    ).toBe(false);
    expect(student.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: "additionalProperties",
          params: { additionalProperty: "merged_payload" }
        })
      ])
    );
    expect(
      student(readJson("contracts/fixtures/student-role-workflow-workspace-private.invalid.json"))
    ).toBe(false);
    expect(student.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: "additionalProperties",
          params: { additionalProperty: "state_true" }
        })
      ])
    );
    expect(teacher(readJson("contracts/fixtures/teacher-role-workflow-workspace.valid.json"))).toBe(
      true
    );
  });

  it("validates the closed Student DecisionTrace contract and rejects private stage fields", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const trace = ajv.compile(readJson("contracts/schemas/student-decision-trace.v1.json"));

    expect(trace(readJson("contracts/fixtures/student-decision-trace.valid.json"))).toBe(true);
    expect(trace(readJson("contracts/fixtures/student-decision-trace-private.invalid.json"))).toBe(
      false
    );
    expect(trace.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: "additionalProperties",
          params: { additionalProperty: "payload" }
        }),
        expect.objectContaining({
          keyword: "additionalProperties",
          params: { additionalProperty: "actor_id" }
        })
      ])
    );
  });

  it("validates bounded divergence resolution evidence and rejects private actor/value fields", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const resolution = ajv.compile(
      readJson("contracts/schemas/team-divergence-resolution.v1.json")
    );

    expect(resolution(readJson("contracts/fixtures/team-divergence-resolution.valid.json"))).toBe(
      true
    );
    expect(resolution(readJson("contracts/fixtures/team-divergence-resolution.invalid.json"))).toBe(
      false
    );
    expect(resolution.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: "additionalProperties",
          params: { additionalProperty: "proposed_by" }
        }),
        expect.objectContaining({
          keyword: "additionalProperties",
          params: { additionalProperty: "state_true" }
        })
      ])
    );
  });

  it("accepts the assignment-bound RoleDecisionSection persisted by the C3 writer", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const section = ajv.compile(readJson("contracts/schemas/role-decision-section.v1.json"));

    expect(section(readJson("contracts/fixtures/role-decision-section.valid.json"))).toBe(true);
    expect(section.errors).toBeNull();
  });

  it("binds every C3 route to exact request, query, and response schemas", () => {
    const openapi = openApiDocument();
    const operations = [
      [
        "/api/v1/bff/teacher/role-workflows",
        "get",
        undefined,
        "RoleWorkflowTeacherWorkspaceEnvelope",
        "200"
      ],
      [
        "/api/v1/bff/teacher/role-workflows/assignments",
        "put",
        "RoleWorkflowAssignmentInput",
        "RoleWorkflowAssignmentEnvelope",
        "201"
      ],
      [
        "/api/v1/bff/teacher/role-workflows/reset",
        "post",
        "RoleWorkflowResetInput",
        "RoleWorkflowResetEnvelope",
        "200"
      ],
      [
        "/api/v1/bff/student/role-workspace",
        "get",
        undefined,
        "RoleWorkflowStudentWorkspaceEnvelope",
        "200"
      ],
      [
        "/api/v1/bff/student/role-workspace/decision-trace",
        "get",
        undefined,
        "RoleWorkflowStudentDecisionTraceEnvelope",
        "200"
      ],
      [
        "/api/v1/bff/student/role-workspace/section",
        "put",
        "RoleWorkflowSectionInput",
        "RoleWorkflowSectionEnvelope",
        "200"
      ],
      [
        "/api/v1/bff/student/role-workspace/ready",
        "post",
        "RoleWorkflowReadyInput",
        "RoleWorkflowSectionEnvelope",
        "200"
      ],
      [
        "/api/v1/bff/student/role-workspace/merge",
        "post",
        "RoleWorkflowMergeInput",
        "RoleWorkflowMergeEnvelope",
        "201"
      ],
      [
        "/api/v1/bff/student/role-workspace/confirm",
        "post",
        "RoleWorkflowConfirmInput",
        "RoleWorkflowConfirmationEnvelope",
        "201"
      ],
      [
        "/api/v1/bff/student/role-workspace/resolution",
        "post",
        "RoleWorkflowResolutionInput",
        "RoleWorkflowResolutionEnvelope",
        "201"
      ],
      [
        "/api/v1/bff/student/role-workspace/resolution/acknowledgement",
        "post",
        "RoleWorkflowAcknowledgementInput",
        "RoleWorkflowAcknowledgementEnvelope",
        "201"
      ]
    ] as const;

    for (const [path, method, requestSchema, responseSchema, successStatus] of operations) {
      const operation = openapi.paths[path]?.[method];
      expect(operation, `${method.toUpperCase()} ${path}`).toBeDefined();
      if (requestSchema) {
        expect(operation?.requestBody?.content?.["application/json"]?.schema?.$ref).toBe(
          `#/components/schemas/${requestSchema}`
        );
      }
      expect(
        operation?.responses?.[successStatus]?.content?.["application/json"]?.schema?.$ref
      ).toBe(`#/components/schemas/${responseSchema}`);
    }

    for (const path of [
      "/api/v1/bff/teacher/role-workflows",
      "/api/v1/bff/student/role-workspace",
      "/api/v1/bff/student/role-workspace/decision-trace"
    ]) {
      expect(openapi.paths[path].get.parameters).toEqual([
        { in: "query", name: "run_id", required: true, schema: expect.any(Object) },
        { in: "query", name: "round_id", required: true, schema: expect.any(Object) },
        { in: "query", name: "team_id", required: true, schema: expect.any(Object) }
      ]);
    }

    const assignment = openapi.components.schemas.RoleWorkflowAssignmentInput;
    expect(assignment.additionalProperties).toBe(false);
    expect(assignment.required).toEqual(["course_id", "role_key", "run_id", "team_id", "user_id"]);
    expect(assignment.properties).not.toHaveProperty("round_id");
  });
});
