import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import yaml from "js-yaml";

const requiredBaselineFiles = [
  "docs/contracts/api-contract.md",
  "docs/contracts/model-engineering-contract.md",
  "contracts/openapi/p0-api.openapi.yaml",
  "contracts/schemas/audit-log.v1.json",
  "contracts/schemas/auth-session.v1.json",
  "contracts/schemas/decision-payload.v1.json",
  "contracts/schemas/rbac.v1.json",
  "contracts/schemas/role-context.v1.json",
  "contracts/schemas/role-permission-policy.v1.json",
  "contracts/schemas/role-template.v1.json",
  "contracts/schemas/settlement-result.v1.json",
  "contracts/schemas/student-role-assignment.v1.json",
  "contracts/schemas/tenant.v1.json",
  "contracts/schemas/user.v1.json",
  "contracts/fixtures/role-context.valid.json",
  "contracts/fixtures/role-permission-policy.valid.json",
  "contracts/fixtures/role-template.valid.json",
  "contracts/fixtures/student-role-assignment.valid.json",
  "packages/shared-contracts/src/index.ts",
  "services/api/src/health.ts"
];

const m1ContractFiles = [
  "contracts/schemas/api-error-envelope.v1.json",
  "contracts/schemas/m1-decision-submit-request.v1.json",
  "contracts/schemas/m1-decision-submit-success-envelope.v1.json",
  "contracts/schemas/m1-student-result-envelope.v1.json",
  "contracts/schemas/m1-teacher-admin-result-envelope.v1.json",
  "contracts/schemas/m1-public-replay-evidence.v1.json",
  "contracts/fixtures/m1-decision-submit-request.valid.json",
  "contracts/fixtures/m1-decision-submit-request.invalid.json",
  "contracts/fixtures/m1-decision-submit-success-envelope.valid.json",
  "contracts/fixtures/m1-wrong-team-error-envelope.valid.json",
  "contracts/fixtures/api-error-envelope-missing-code.invalid.json",
  "contracts/fixtures/m1-student-result-envelope.valid.json",
  "contracts/fixtures/m1-student-result-state-true.invalid.json",
  "contracts/fixtures/m1-student-result-decision-batch-hash.invalid.json",
  "contracts/fixtures/m1-student-result-private-replay-metadata.invalid.json",
  "contracts/fixtures/m1-teacher-admin-result-envelope.valid.json",
  "contracts/fixtures/m1-teacher-admin-result-missing-state-true.invalid.json",
  "contracts/fixtures/m1-public-replay-evidence.valid.json",
  "contracts/fixtures/m1-public-replay-evidence-missing-decision-batch-hash.invalid.json",
  "contracts/fixtures/auth-required-error-envelope.valid.json",
  "contracts/fixtures/authz-missing-permission-error-envelope.valid.json",
  "contracts/fixtures/invalid-role-error-envelope.valid.json",
  "contracts/fixtures/internal-service-principal-error-envelope.valid.json",
  "contracts/fixtures/tenant-boundary-error-envelope.valid.json",
  "contracts/fixtures/user-password-required-error-envelope.valid.json"
];

const requiredOpenApiPaths = [
  "/api/v1/auth/login",
  "/api/v1/auth/logout",
  "/api/v1/auth/me",
  "/api/v1/admin/tenants",
  "/api/v1/admin/users",
  "/api/v1/rbac/roles",
  "/api/v1/rbac/permissions",
  "/api/v1/courses/{courseId}/runs",
  "/api/v1/runs/{runId}/rounds/{roundNo}/decisions",
  "/internal/v1/runs/{runId}/rounds/{roundNo}/settle",
  "/api/v1/runs/{runId}/rounds/{roundNo}/results"
];

const schemaCases = [
  {
    schema: "contracts/schemas/m1-decision-submit-request.v1.json",
    valid: ["contracts/fixtures/m1-decision-submit-request.valid.json"],
    invalid: ["contracts/fixtures/m1-decision-submit-request.invalid.json"]
  },
  {
    schema: "contracts/schemas/m1-decision-submit-success-envelope.v1.json",
    valid: ["contracts/fixtures/m1-decision-submit-success-envelope.valid.json"],
    invalid: []
  },
  {
    schema: "contracts/schemas/m1-student-result-envelope.v1.json",
    valid: ["contracts/fixtures/m1-student-result-envelope.valid.json"],
    invalid: [
      "contracts/fixtures/m1-student-result-state-true.invalid.json",
      "contracts/fixtures/m1-student-result-decision-batch-hash.invalid.json",
      "contracts/fixtures/m1-student-result-private-replay-metadata.invalid.json"
    ]
  },
  {
    schema: "contracts/schemas/m1-teacher-admin-result-envelope.v1.json",
    valid: ["contracts/fixtures/m1-teacher-admin-result-envelope.valid.json"],
    invalid: ["contracts/fixtures/m1-teacher-admin-result-missing-state-true.invalid.json"]
  },
  {
    schema: "contracts/schemas/api-error-envelope.v1.json",
    valid: [
      "contracts/fixtures/m1-wrong-team-error-envelope.valid.json",
      "contracts/fixtures/auth-required-error-envelope.valid.json",
      "contracts/fixtures/authz-missing-permission-error-envelope.valid.json",
      "contracts/fixtures/invalid-role-error-envelope.valid.json",
      "contracts/fixtures/internal-service-principal-error-envelope.valid.json",
      "contracts/fixtures/tenant-boundary-error-envelope.valid.json",
      "contracts/fixtures/user-password-required-error-envelope.valid.json"
    ],
    invalid: ["contracts/fixtures/api-error-envelope-missing-code.invalid.json"]
  },
  {
    schema: "contracts/schemas/m1-public-replay-evidence.v1.json",
    valid: ["contracts/fixtures/m1-public-replay-evidence.valid.json"],
    invalid: [
      "contracts/fixtures/m1-public-replay-evidence-missing-decision-batch-hash.invalid.json"
    ]
  }
];

function repoPath(path) {
  return resolve(path);
}

function readJson(path) {
  return JSON.parse(readFileSync(repoPath(path), "utf8"));
}

function readOpenApi() {
  return yaml.load(readFileSync(repoPath("contracts/openapi/p0-api.openapi.yaml"), "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireFiles(paths) {
  const missing = paths.filter((file) => !existsSync(repoPath(file)));
  assert(
    missing.length === 0,
    `Missing contract files:\n${missing.map((file) => `- ${file}`).join("\n")}`
  );
}

function schemaRef(name) {
  return `#/components/schemas/${name}`;
}

function jsonContentSchema(responseOrRequest) {
  return responseOrRequest?.content?.["application/json"]?.schema;
}

function assertM1OpenApiBindings(openApi) {
  for (const path of requiredOpenApiPaths) {
    assert(openApi?.paths?.[path], `Missing P0/P1 OpenAPI path: ${path}`);
  }

  const loginPost = openApi.paths["/api/v1/auth/login"]?.post;
  assert(
    jsonContentSchema(loginPost?.responses?.["401"])?.$ref === schemaRef("ApiErrorEnvelope"),
    "Auth login 401 response must reference ApiErrorEnvelope."
  );

  const adminUsersPost = openApi.paths["/api/v1/admin/users"]?.post;
  assert(
    jsonContentSchema(adminUsersPost?.responses?.["403"])?.$ref === schemaRef("ApiErrorEnvelope"),
    "Admin user create 403 response must reference ApiErrorEnvelope."
  );
  assert(
    jsonContentSchema(adminUsersPost?.responses?.["422"])?.$ref === schemaRef("ApiErrorEnvelope"),
    "Admin user create 422 response must reference ApiErrorEnvelope."
  );

  const internalSettle = openApi.paths["/internal/v1/runs/{runId}/rounds/{roundNo}/settle"]?.post;
  assert(internalSettle, "Missing internal settle operation.");
  assert(
    internalSettle["x-simwar-internal"] === true,
    "Internal settle operation must be marked x-simwar-internal."
  );
  assert(
    internalSettle["x-simwar-public-client"] === false,
    "Internal settle operation must be excluded from public clients."
  );
  assert(
    internalSettle["x-simwar-service-principal-only"] === true,
    "Internal settle operation must be service-principal-only."
  );
  const internalSecurity = internalSettle.security?.[0] ?? {};
  assert(
    Array.isArray(internalSecurity.InternalServiceBearer),
    "Internal settle operation must require InternalServiceBearer."
  );
  assert(
    Array.isArray(internalSecurity.ServicePrincipalHeader),
    "Internal settle operation must require ServicePrincipalHeader."
  );
  assert(
    jsonContentSchema(internalSettle.responses?.["403"])?.$ref === schemaRef("ApiErrorEnvelope"),
    "Internal settle 403 response must reference ApiErrorEnvelope."
  );

  const decisionsPost = openApi.paths["/api/v1/runs/{runId}/rounds/{roundNo}/decisions"]?.post;
  assert(decisionsPost, "Missing POST operation for M1 decision submission.");
  assert(
    jsonContentSchema(decisionsPost.requestBody)?.$ref === schemaRef("M1DecisionSubmitRequest"),
    "M1 decision submit requestBody must reference M1DecisionSubmitRequest."
  );
  assert(
    jsonContentSchema(decisionsPost.responses?.["201"])?.$ref ===
      schemaRef("M1DecisionSubmitSuccessEnvelope"),
    "M1 decision submit 201 response must reference M1DecisionSubmitSuccessEnvelope."
  );

  for (const statusCode of ["403", "404", "409", "422"]) {
    assert(
      jsonContentSchema(decisionsPost.responses?.[statusCode])?.$ref ===
        schemaRef("ApiErrorEnvelope"),
      `M1 decision submit ${statusCode} response must reference ApiErrorEnvelope.`
    );
  }

  const resultsGet = openApi.paths["/api/v1/runs/{runId}/rounds/{roundNo}/results"]?.get;
  assert(resultsGet, "Missing GET operation for M1 results.");
  const resultOneOf = jsonContentSchema(resultsGet.responses?.["200"])?.oneOf ?? [];
  const resultRefs = resultOneOf.map((entry) => entry?.$ref);
  assert(
    resultRefs.includes(schemaRef("M1StudentResultEnvelope")),
    "M1 results 200 response must include M1StudentResultEnvelope."
  );
  assert(
    resultRefs.includes(schemaRef("M1TeacherAdminResultEnvelope")),
    "M1 results 200 response must include M1TeacherAdminResultEnvelope."
  );

  for (const statusCode of ["403", "404"]) {
    assert(
      jsonContentSchema(resultsGet.responses?.[statusCode])?.$ref === schemaRef("ApiErrorEnvelope"),
      `M1 results ${statusCode} response must reference ApiErrorEnvelope.`
    );
  }

  for (const name of [
    "ApiErrorEnvelope",
    "M1DecisionSubmitRequest",
    "M1DecisionSubmitSuccessEnvelope",
    "M1StudentResultEnvelope",
    "M1TeacherAdminResultEnvelope",
    "M1PublicReplayEvidence"
  ]) {
    const ref = openApi.components?.schemas?.[name]?.$ref;
    assert(
      typeof ref === "string" && ref.startsWith("../schemas/"),
      `OpenAPI component ${name} must reference a JSON Schema artifact.`
    );
    assert(
      existsSync(resolve("contracts/openapi", ref)),
      `OpenAPI component ${name} target missing: ${ref}`
    );
  }
}

function assertFrontendDoesNotUseInternalRoutes() {
  for (const file of [
    "apps/admin/src/App.tsx",
    "apps/teacher/src/App.tsx",
    "apps/student/src/App.tsx"
  ]) {
    const source = readFileSync(repoPath(file), "utf8");
    assert(
      !source.includes("/internal/v1"),
      `Frontend source must not call internal route: ${file}`
    );
  }
}

function formatAjvErrors(validate) {
  return validate.errors
    ?.map((error) => `${error.instancePath || "/"} ${error.message ?? "schema error"}`)
    .join("; ");
}

function validateFixtureCases() {
  for (const contractCase of schemaCases) {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    const validate = ajv.compile(readJson(contractCase.schema));

    for (const fixture of contractCase.valid) {
      const data = readJson(fixture);
      assert(
        validate(data),
        `Expected valid fixture to pass ${contractCase.schema}: ${fixture}\n${formatAjvErrors(validate)}`
      );
    }

    for (const fixture of contractCase.invalid) {
      const data = readJson(fixture);
      assert(
        !validate(data),
        `Expected invalid fixture to fail ${contractCase.schema}: ${fixture}`
      );
    }
  }
}

function assertStudentFixtureDoesNotExposePrivateFields() {
  const studentFixture = readJson("contracts/fixtures/m1-student-result-envelope.valid.json");
  const serialized = JSON.stringify(studentFixture.data);
  for (const privateField of [
    "state_true",
    "decision_batch_hash",
    "json_runtime_source_digest",
    "canonical_evidence_digest",
    "replay_evidence"
  ]) {
    assert(
      !serialized.includes(privateField),
      `Student result fixture must not expose private field: ${privateField}`
    );
  }
}

export function runContractValidation() {
  requireFiles([...requiredBaselineFiles, ...m1ContractFiles]);

  for (const jsonPath of [...requiredBaselineFiles, ...m1ContractFiles].filter((file) =>
    file.endsWith(".json")
  )) {
    readJson(jsonPath);
  }

  const openApi = readOpenApi();
  assertM1OpenApiBindings(openApi);
  assertFrontendDoesNotUseInternalRoutes();
  validateFixtureCases();
  assertStudentFixtureDoesNotExposePrivateFields();

  return {
    baselineFiles: requiredBaselineFiles.length,
    m1ContractFiles: m1ContractFiles.length,
    fixtureCases: schemaCases.length
  };
}
