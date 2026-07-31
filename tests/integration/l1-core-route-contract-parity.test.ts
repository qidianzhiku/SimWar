import { once } from "node:events";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import { resolve } from "node:path";
import SwaggerParser from "@apidevtools/swagger-parser";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  Round,
  Run,
  SyntheticRunLifecycleOperationResultDTO
} from "../../packages/shared-contracts/src";
import { createContractAjv } from "../../scripts/contract-validation-facade.mjs";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store } from "../../services/api/src/store";

const fetchBlockedPorts = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102,
  103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465,
  512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993,
  995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 4242, 5060, 5061, 6000, 6566, 6665, 6666, 6667,
  6668, 6669, 6679, 6697, 10080
]);

type OpenApiSchema = { $ref?: string; [key: string]: unknown };
type OpenApiResponse = { content?: Record<string, { schema?: OpenApiSchema }> };
type OpenApiOperation = { responses: Record<string, OpenApiResponse> };
type OpenApiDocument = {
  components: { schemas: Record<string, unknown> };
  paths: Record<string, Record<string, OpenApiOperation>>;
};

function readJsonSchema(schemaFile: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve("contracts/schemas", schemaFile), "utf8"));
}

function expectEnvelopeToMatchSchema(schemaFile: string, envelope: unknown): void {
  const ajv = createContractAjv();
  ajv.addSchema(readJsonSchema("auth-session.v1.json"));
  const validate = ajv.compile(readJsonSchema(schemaFile));
  expect(validate(envelope), JSON.stringify(validate.errors)).toBe(true);
}

function openApiDocument(): OpenApiDocument {
  return yaml.load(
    readFileSync("contracts/openapi/p0-api.openapi.yaml", "utf8")
  ) as OpenApiDocument;
}

function responseSchema(response: OpenApiResponse): OpenApiSchema {
  const schema = response.content?.["application/json"]?.schema;
  if (!schema) throw new Error("OpenAPI response is missing an application/json schema");
  return schema;
}

function collectComponentReferences(value: unknown, references: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectComponentReferences(item, references);
    return;
  }

  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const reference = record.$ref;
  if (typeof reference === "string" && reference.startsWith("#/components/schemas/")) {
    references.add(reference.slice("#/components/schemas/".length));
  }
  for (const nested of Object.values(record)) collectComponentReferences(nested, references);
}

async function expectEnvelopeToMatchOpenApiResponse(
  path: string,
  method: "get" | "post",
  status: string,
  envelope: unknown
): Promise<void> {
  const original = openApiDocument();
  const response = structuredClone(original.paths[path][method].responses[status]);
  const componentNames = new Set<string>();
  collectComponentReferences(response, componentNames);
  const schemas: Record<string, unknown> = {};

  for (const componentName of componentNames) {
    const component = original.components.schemas[componentName];
    schemas[componentName] = structuredClone(component);
    collectComponentReferences(component, componentNames);
  }

  const document = (await SwaggerParser.dereference({
    components: { schemas },
    info: { title: "Scoped L1 route contract", version: "1.0.0" },
    openapi: "3.0.3",
    paths: { [path]: { [method]: { responses: { [status]: response } } } }
  })) as OpenApiDocument;
  const schema = responseSchema(document.paths[path][method].responses[status]);
  const validate = createContractAjv().compile(schema);
  expect(validate(envelope), JSON.stringify(validate.errors)).toBe(true);
}

async function startServer(): Promise<{ baseUrl: string; server: Server }> {
  const server = createApiServer(createP1Store());

  for (let attempt = 0; attempt < 3; attempt += 1) {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();

    if (address && typeof address !== "string" && !fetchBlockedPorts.has(address.port)) {
      return { baseUrl: `http://127.0.0.1:${address.port}`, server };
    }

    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => (error ? rejectClose(error) : resolveClose()));
    });
  }

  throw new Error("test server could not bind to a fetch-safe TCP port");
}

async function request<TData>(
  baseUrl: string,
  path: string,
  options: { body?: unknown; method?: string; token?: string } = {}
): Promise<{ body: ApiEnvelope<TData>; status: number }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": "tenant_demo"
  });

  if (options.token) headers.set("authorization", `Bearer ${options.token}`);

  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers,
    method: options.method ?? "GET"
  });

  return { body: (await response.json()) as ApiEnvelope<TData>, status: response.status };
}

describe("L1 core route contract parity", () => {
  it("binds core L1 auth, run, and lifecycle responses to OpenAPI JSON Schema envelopes", async () => {
    const openApi = openApiDocument();
    const studioFixture = JSON.parse(
      readFileSync(resolve("contracts/fixtures/teacher-course-blueprint-studio.valid.json"), "utf8")
    ) as unknown;

    expectEnvelopeToMatchSchema("teacher-course-blueprint-studio.schema.json", studioFixture);
    expect(
      openApi.paths["/api/v1/bff/teacher/course-blueprints/studio/preview"].post.requestBody
        .content["application/json"].schema.$ref
    ).toBe("#/components/schemas/TeacherCourseBlueprintStudioReferenceInput");
    expect(
      openApi.paths["/api/v1/bff/teacher/course-blueprints/studio/drafts"].post.requestBody.content[
        "application/json"
      ].schema.$ref
    ).toBe("#/components/schemas/TeacherCourseBlueprintStudioDraftCreateInput");
    expect(
      openApi.paths["/api/v1/bff/teacher/course-blueprints/studio/submissions"].post.requestBody
        .content["application/json"].schema.$ref
    ).toBe("#/components/schemas/TeacherCourseBlueprintStudioReferenceInput");

    expect(
      openApi.paths["/api/v1/auth/login"].post.responses["200"].content["application/json"].schema
        .$ref
    ).toBe("#/components/schemas/M1AuthSessionEnvelope");
    expect(
      openApi.paths["/api/v1/courses/{courseId}/runs"].post.responses["201"].content[
        "application/json"
      ].schema.$ref
    ).toBe("#/components/schemas/M1RunCreateEnvelope");
    expect(
      openApi.paths["/api/v1/courses/{courseId}/runs"].post.responses["401"].content[
        "application/json"
      ].schema.$ref
    ).toBe("#/components/schemas/ApiErrorEnvelope");
    expect(
      openApi.paths["/api/v1/bff/admin/run-lifecycle-controls"].get.responses["401"].content[
        "application/json"
      ].schema.$ref
    ).toBe("#/components/schemas/ApiErrorEnvelope");
    for (const status of ["401", "403", "404", "409", "422"]) {
      expect(
        openApi.paths["/api/v1/bff/admin/courses/{courseId}/runs/{runId}/lifecycle/{operation}"]
          .post.responses[status].content["application/json"].schema.$ref
      ).toBe("#/components/schemas/ApiErrorEnvelope");
    }

    const { baseUrl, server } = await startServer();

    try {
      const invalidLogin = await request<unknown>(baseUrl, "/api/v1/auth/login", {
        body: { password: "wrong", username: "teacher" },
        method: "POST"
      });
      expect(invalidLogin.status).toBe(401);
      expectEnvelopeToMatchSchema("api-error-envelope.v1.json", invalidLogin.body);

      const login = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
        body: { password: "teacher", username: "teacher" },
        method: "POST"
      });
      expect(login.status).toBe(200);
      expectEnvelopeToMatchSchema("m1-auth-session-envelope.v1.json", login.body);

      const unauthenticatedRunCreate = await request<unknown>(
        baseUrl,
        "/api/v1/courses/course_demo/runs",
        { method: "POST" }
      );
      expect(unauthenticatedRunCreate.status).toBe(401);
      expectEnvelopeToMatchSchema("api-error-envelope.v1.json", unauthenticatedRunCreate.body);

      const runCreate = await request<{ round: Round; run: Run }>(
        baseUrl,
        "/api/v1/courses/course_demo/runs",
        { method: "POST", token: login.body.data.access_token }
      );
      expect(runCreate.status).toBe(201);
      expectEnvelopeToMatchSchema("m1-run-create-envelope.v1.json", runCreate.body);

      const unauthenticatedControls = await request<unknown>(
        baseUrl,
        "/api/v1/bff/admin/run-lifecycle-controls"
      );
      expect(unauthenticatedControls.status).toBe(401);
      expectEnvelopeToMatchSchema("api-error-envelope.v1.json", unauthenticatedControls.body);

      const adminLogin = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
        body: { password: "admin", username: "admin" },
        method: "POST"
      });
      expect(adminLogin.status).toBe(200);
      const controls = await request<unknown>(baseUrl, "/api/v1/bff/admin/run-lifecycle-controls", {
        token: adminLogin.body.data.access_token
      });
      expect(controls.status).toBe(200);
      await expectEnvelopeToMatchOpenApiResponse(
        "/api/v1/bff/admin/run-lifecycle-controls",
        "get",
        "200",
        controls.body
      );

      const abort = await request<SyntheticRunLifecycleOperationResultDTO>(
        baseUrl,
        `/api/v1/bff/admin/courses/course_demo/runs/${runCreate.body.data.run.run_id}/lifecycle/abort`,
        {
          body: { confirmation: `ABORT ${runCreate.body.data.run.run_id}` },
          method: "POST",
          token: adminLogin.body.data.access_token
        }
      );
      expect(abort.status).toBe(200);
      await expectEnvelopeToMatchOpenApiResponse(
        "/api/v1/bff/admin/courses/{courseId}/runs/{runId}/lifecycle/{operation}",
        "post",
        "200",
        abort.body
      );
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
