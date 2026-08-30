import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import SwaggerParser from "@apidevtools/swagger-parser";
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
  "contracts/schemas/m1-auth-session-envelope.v1.json",
  "contracts/schemas/m1-decision-submit-request.v1.json",
  "contracts/schemas/m1-decision-submit-success-envelope.v1.json",
  "contracts/schemas/m1-round-envelope.v1.json",
  "contracts/schemas/mw4-round-continuation-envelope.v1.json",
  "contracts/schemas/m1-run-create-envelope.v1.json",
  "contracts/schemas/m1-settlement-result-envelope.v1.json",
  "contracts/schemas/m1-student-result-envelope.v1.json",
  "contracts/schemas/m1-teacher-admin-result-envelope.v1.json",
  "contracts/schemas/m1-teacher-bff-workspace-envelope.v1.json",
  "contracts/schemas/m1-student-bff-cockpit-envelope.v1.json",
  "contracts/schemas/m2p4-live-round-ops.v1.json",
  "contracts/schemas/m1-public-replay-evidence.v1.json",
  "contracts/fixtures/m1-decision-submit-request.valid.json",
  "contracts/fixtures/m1-decision-submit-request.invalid.json",
  "contracts/fixtures/m1-decision-submit-success-envelope.valid.json",
  "contracts/fixtures/m1-auth-session-envelope.valid.json",
  "contracts/fixtures/m1-round-envelope.valid.json",
  "contracts/fixtures/mw4-round-continuation-envelope.valid.json",
  "contracts/fixtures/m1-run-create-envelope.valid.json",
  "contracts/fixtures/m1-settlement-result-envelope.valid.json",
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

const a5ContractFiles = [
  "contracts/schemas/a5-compatibility.v1.json",
  "contracts/fixtures/a5-compatibility.valid.json",
  "contracts/fixtures/a5-compatibility.invalid.json"
];

const d1ContractFiles = [
  "contracts/schemas/learning-design.v1.json",
  "contracts/fixtures/learning-design.valid.json",
  "contracts/fixtures/learning-design.invalid.json"
];

const d2ContractFiles = [
  "contracts/schemas/evidence-provenance.v1.json",
  "contracts/fixtures/evidence-provenance.valid.json",
  "contracts/fixtures/evidence-provenance.invalid.json"
];

const d3ContractFiles = [
  "contracts/schemas/teacher-confirmation.v1.json",
  "contracts/fixtures/teacher-confirmation.valid.json",
  "contracts/fixtures/teacher-confirmation.invalid.json"
];

const d4ContractFiles = [
  "contracts/schemas/student-learning-report.v1.json",
  "contracts/fixtures/student-learning-report.valid.json",
  "contracts/fixtures/student-learning-report.invalid.json"
];

const d5ContractFiles = [
  "contracts/schemas/d5-export.v1.json",
  "contracts/fixtures/d5-export.valid.json",
  "contracts/fixtures/d5-export.invalid.json"
];

const d6ContractFiles = [
  "contracts/schemas/d6-transfer-evidence.v1.json",
  "contracts/fixtures/d6-transfer-evidence.valid.json",
  "contracts/fixtures/d6-transfer-evidence.invalid.json",
  "contracts/fixtures/d6-transfer-evidence.privacy.invalid.json"
];

const r3ContractFiles = [
  "contracts/schemas/r3-golden-journey.v1.json",
  "contracts/fixtures/r3-golden-journey.valid.json",
  "contracts/fixtures/r3-golden-journey.invalid.json"
];

const c4ContractFiles = [
  "contracts/schemas/instructor-debrief-artifact.v1.json",
  "contracts/fixtures/instructor-debrief-artifact.valid.json",
  "contracts/fixtures/instructor-debrief-artifact.invalid.json"
];

const w020ContractFiles = [
  "contracts/schemas/w020-governed-ai-advisory.v1.json",
  "contracts/fixtures/w020-governed-ai-advisory.valid.json",
  "contracts/fixtures/w020-governed-ai-advisory.invalid.json"
];

const w022ContractFiles = [
  "contracts/schemas/fresh-learner-admission.v1.json",
  "contracts/fixtures/fresh-learner-admission.valid.json",
  "contracts/fixtures/fresh-learner-admission.invalid.json"
];

const w023ContractFiles = [
  "contracts/schemas/validation-session.v1.json",
  "contracts/fixtures/validation-session.valid.json",
  "contracts/fixtures/validation-session.invalid.json"
];

const w025ContractFiles = [
  "contracts/schemas/validation-environment-launch.v1.json",
  "contracts/fixtures/validation-environment-launch.valid.json",
  "contracts/fixtures/validation-environment-launch.invalid.json"
];

const w027ContractFiles = [
  "contracts/schemas/w027-decision-experience.v1.json",
  "contracts/fixtures/w027-decision-experience.valid.json",
  "contracts/fixtures/w027-decision-experience.invalid.json"
];

const w3ContractFiles = [
  "contracts/schemas/w3-official-consequence-learning.v1.json",
  "contracts/fixtures/w3-official-consequence-learning.valid.json",
  "contracts/fixtures/w3-official-consequence-learning.invalid.json"
];

const w4ContractFiles = [
  "contracts/schemas/w4-enterprise-state.v1.json",
  "contracts/fixtures/w4-enterprise-state.valid.json",
  "contracts/fixtures/w4-enterprise-state.invalid.json"
];

const mod04ContractFiles = [
  "contracts/schemas/model-candidate-registry.v1.json",
  "contracts/fixtures/model-candidate-registry.valid.json",
  "contracts/fixtures/model-candidate-registry.invalid.json"
];

const mod06ContractFiles = [
  "contracts/schemas/model-governance-plane.v1.json",
  "contracts/fixtures/model-governance-plane.valid.json",
  "contracts/fixtures/model-governance-plane.invalid.json"
];

const shanghaiFullVerticalContractFiles = [
  "contracts/schemas/shanghai-full-vertical.v1.json",
  "contracts/fixtures/shanghai-full-vertical.valid.json"
];

const executiveStrategyLabContractFiles = [
  "contracts/schemas/executive-strategy-lab.v1.json",
  "contracts/fixtures/executive-strategy-lab.valid.json",
  "contracts/fixtures/executive-strategy-lab.invalid.json"
];

const shanghaiProductizationContractFiles = [
  "contracts/schemas/shanghai-productization.v1.json",
  "contracts/fixtures/shanghai-productization.valid.json"
];

const modNext6ContractFiles = [
  "contracts/schemas/mod-next6-consumption.v1.json",
  "contracts/fixtures/mod-next6-consumption.valid.json",
  "contracts/fixtures/mod-next6-consumption.student-private.invalid.json"
];

const r1CanServiceFeasibilityContractFiles = [
  "contracts/schemas/can-service-feasibility.v1.json",
  "contracts/fixtures/can-service-feasibility.valid.json",
  "contracts/fixtures/can-service-feasibility.student-private.invalid.json"
];

const requiredOpenApiPaths = [
  "/api/v1/auth/login",
  "/api/v1/auth/logout",
  "/api/v1/auth/me",
  "/api/v1/admin/tenants",
  "/api/v1/admin/users",
  "/api/v1/admin/validation-environment-launches",
  "/api/v1/rbac/roles",
  "/api/v1/rbac/permissions",
  "/api/v1/courses/{courseId}/runs",
  "/api/v1/courses/{courseId}/teams/{teamId}/members",
  "/api/v1/runs/{runId}/rounds/{roundNo}/decisions",
  "/api/v1/runs/{runId}/rounds/{roundNo}/continue",
  "/internal/v1/runs/{runId}/rounds/{roundNo}/settle",
  "/api/v1/runs/{runId}/rounds/{roundNo}/results",
  "/api/v1/bff/teacher/runs/{runId}/rounds/{roundNo}/workspace",
  "/api/v1/bff/student/runs/{runId}/rounds/{roundNo}/cockpit",
  "/api/v1/bff/teacher/learning-goals/revisions",
  "/api/v1/bff/teacher/rubrics/revisions",
  "/api/v1/bff/teacher/learning-goals/{goalId}/versions/{version}/{action}",
  "/api/v1/bff/teacher/rubrics/{rubricId}/versions/{version}/{action}",
  "/api/v1/bff/teacher/evidence",
  "/api/v1/bff/teacher/evidence-artifacts/capture",
  "/api/v1/bff/teacher/learning-exports/preview",
  "/api/v1/bff/teacher/learning-exports/seal",
  "/api/v1/bff/teacher/learning-exports",
  "/api/v1/bff/teacher/learning-exports/jobs",
  "/api/v1/bff/teacher/learning-exports/jobs/{jobId}/retry",
  "/api/v1/bff/teacher/learning-exports/jobs/{jobId}/cancel",
  "/api/v1/bff/admin/learning-exports/preview",
  "/api/v1/bff/admin/learning-exports/seal",
  "/api/v1/bff/admin/learning-exports",
  "/api/v1/bff/admin/learning-exports/jobs",
  "/api/v1/bff/admin/learning-exports/jobs/{jobId}/retry",
  "/api/v1/bff/admin/learning-exports/jobs/{jobId}/cancel",
  "/api/v1/bff/teacher/transfer-research-designs",
  "/api/v1/bff/teacher/transfer-research-designs/preview",
  "/api/v1/bff/teacher/transfer-research-designs/freeze",
  "/api/v1/bff/teacher/transfer-research-designs/{studyId}/synthetic-preview",
  "/api/v1/bff/admin/transfer-research-designs",
  "/api/v1/bff/admin/transfer-research-designs/preview",
  "/api/v1/bff/admin/transfer-research-designs/freeze",
  "/api/v1/bff/admin/transfer-research-designs/{studyId}/synthetic-preview",
  "/api/v1/bff/teacher/golden-journey/status",
  "/api/v1/bff/teacher/golden-journey/context",
  "/api/v1/bff/teacher/golden-journey/allowed-actions",
  "/api/v1/bff/teacher/golden-journey/receipts",
  "/api/v1/bff/student/golden-journey/status",
  "/api/v1/bff/student/golden-journey/context",
  "/api/v1/bff/student/golden-journey/allowed-actions",
  "/api/v1/bff/student/golden-journey/receipts",
  "/api/v1/bff/teacher/instructor-debrief-artifact",
  "/api/v1/bff/teacher/instructor-debrief-artifact/export",
  "/api/v1/bff/teacher/fresh-learner-admission",
  "/api/v1/bff/teacher/validation-sessions",
  "/api/v1/bff/student/w3/consequence",
  "/api/v1/bff/teacher/w3/consequence",
  "/api/v1/bff/teacher/w3/counterfactual",
  "/api/v1/bff/student/w3/reflection",
  "/api/v1/bff/teacher/w3/evidence-selection",
  "/api/v1/bff/teacher/w3/next-round-hypothesis",
  "/api/v1/w4/runs/{runId}/rounds/{roundNo}/states",
  "/api/v1/w4/runs/{runId}/rounds/{roundNo}/strategic-decisions",
  "/api/v1/w4/runs/{runId}/rounds/{roundNo}/settle",
  "/api/v1/w4/runs/{runId}/rounds/{roundNo}/continue",
  "/api/v1/w4/runs/{runId}/rounds/{roundNo}/replay",
  "/api/v1/w4/runs/{runId}/rounds/{roundNo}/shadow-replay",
  "/api/v1/bff/student/w4/runs/{runId}/rounds/{roundNo}/portfolio",
  "/api/v1/bff/teacher/w4/runs/{runId}/rounds/{roundNo}/portfolio",
  "/api/v1/bff/admin/w4/runs/{runId}/rounds/{roundNo}/portfolio",
  "/api/v1/bff/admin/w4/portfolio",
  "/api/v1/bff/teacher/courses/{courseId}/project-library",
  "/api/v1/bff/teacher/courses/{courseId}/project-library/{operation}",
  "/api/v1/bff/student/project-brief",
  "/api/v1/bff/admin/project-library",
  "/api/v1/bff/teacher/operating-world/studio",
  "/api/v1/bff/teacher/operating-world/drafts",
  "/api/v1/bff/teacher/operating-world/drafts/{draftId}/validate",
  "/api/v1/bff/teacher/operating-world/drafts/{draftId}/preview",
  "/api/v1/bff/teacher/operating-world/drafts/{draftId}/freeze",
  "/api/v1/bff/teacher/operating-world/drafts/{draftId}/bind",
  "/api/v1/bff/teacher/operating-world/drafts/{draftId}/official-consumer",
  "/api/v1/bff/student/operating-world/brief",
  "/api/v1/bff/admin/operating-world/audit",
  "/api/v1/bff/teacher/shanghai/full-vertical",
  "/api/v1/bff/student/shanghai/full-vertical",
  "/api/v1/bff/admin/shanghai/full-vertical",
  "/api/v1/bff/teacher/can/service-feasibility",
  "/api/v1/bff/student/can/service-feasibility",
  "/api/v1/bff/admin/can/service-feasibility",
  "/api/v1/bff/teacher/esl/strategy-lab",
  "/api/v1/bff/teacher/esl/candidates/{candidateId}",
  "/api/v1/bff/student/esl/candidates/{candidateId}",
  "/api/v1/bff/admin/esl/audit"
];

const schemaCases = [
  {
    schema: "contracts/schemas/shanghai-full-vertical.v1.json",
    valid: ["contracts/fixtures/shanghai-full-vertical.valid.json"],
    invalid: []
  },
  {
    schema: "contracts/schemas/operating-world.v1.json",
    valid: ["contracts/fixtures/operating-world-student.valid.json"],
    invalid: ["contracts/fixtures/operating-world-student-private.invalid.json"]
  },
  {
    schema: "contracts/schemas/m1-auth-session-envelope.v1.json",
    valid: ["contracts/fixtures/m1-auth-session-envelope.valid.json"],
    invalid: []
  },
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
    schema: "contracts/schemas/m1-round-envelope.v1.json",
    valid: ["contracts/fixtures/m1-round-envelope.valid.json"],
    invalid: []
  },
  {
    schema: "contracts/schemas/mw4-round-continuation-envelope.v1.json",
    valid: ["contracts/fixtures/mw4-round-continuation-envelope.valid.json"],
    invalid: []
  },
  {
    schema: "contracts/schemas/m1-run-create-envelope.v1.json",
    valid: ["contracts/fixtures/m1-run-create-envelope.valid.json"],
    invalid: []
  },
  {
    schema: "contracts/schemas/m1-settlement-result-envelope.v1.json",
    valid: ["contracts/fixtures/m1-settlement-result-envelope.valid.json"],
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
  },
  {
    schema: "contracts/schemas/a5-compatibility.v1.json",
    valid: ["contracts/fixtures/a5-compatibility.valid.json"],
    invalid: ["contracts/fixtures/a5-compatibility.invalid.json"]
  },
  {
    schema: "contracts/schemas/learning-design.v1.json",
    valid: ["contracts/fixtures/learning-design.valid.json"],
    invalid: ["contracts/fixtures/learning-design.invalid.json"]
  },
  {
    schema: "contracts/schemas/evidence-provenance.v1.json",
    valid: ["contracts/fixtures/evidence-provenance.valid.json"],
    invalid: ["contracts/fixtures/evidence-provenance.invalid.json"]
  },
  {
    schema: "contracts/schemas/teacher-confirmation.v1.json",
    valid: ["contracts/fixtures/teacher-confirmation.valid.json"],
    invalid: ["contracts/fixtures/teacher-confirmation.invalid.json"]
  },
  {
    schema: "contracts/schemas/student-learning-report.v1.json",
    valid: ["contracts/fixtures/student-learning-report.valid.json"],
    invalid: ["contracts/fixtures/student-learning-report.invalid.json"]
  },
  {
    schema: "contracts/schemas/d5-export.v1.json",
    valid: ["contracts/fixtures/d5-export.valid.json"],
    invalid: ["contracts/fixtures/d5-export.invalid.json"]
  },
  {
    schema: "contracts/schemas/d6-transfer-evidence.v1.json",
    valid: ["contracts/fixtures/d6-transfer-evidence.valid.json"],
    invalid: [
      "contracts/fixtures/d6-transfer-evidence.invalid.json",
      "contracts/fixtures/d6-transfer-evidence.privacy.invalid.json"
    ]
  },
  {
    schema: "contracts/schemas/r3-golden-journey.v1.json",
    valid: ["contracts/fixtures/r3-golden-journey.valid.json"],
    invalid: ["contracts/fixtures/r3-golden-journey.invalid.json"]
  },
  {
    schema: "contracts/schemas/instructor-debrief-artifact.v1.json",
    valid: ["contracts/fixtures/instructor-debrief-artifact.valid.json"],
    invalid: ["contracts/fixtures/instructor-debrief-artifact.invalid.json"]
  },
  {
    schema: "contracts/schemas/w020-governed-ai-advisory.v1.json",
    valid: ["contracts/fixtures/w020-governed-ai-advisory.valid.json"],
    invalid: ["contracts/fixtures/w020-governed-ai-advisory.invalid.json"]
  },
  {
    schema: "contracts/schemas/validation-session.v1.json",
    valid: ["contracts/fixtures/validation-session.valid.json"],
    invalid: ["contracts/fixtures/validation-session.invalid.json"]
  },
  {
    schema: "contracts/schemas/fresh-learner-admission.v1.json",
    valid: ["contracts/fixtures/fresh-learner-admission.valid.json"],
    invalid: ["contracts/fixtures/fresh-learner-admission.invalid.json"]
  },
  {
    schema: "contracts/schemas/validation-environment-launch.v1.json",
    valid: ["contracts/fixtures/validation-environment-launch.valid.json"],
    invalid: ["contracts/fixtures/validation-environment-launch.invalid.json"]
  },
  {
    schema: "contracts/schemas/w027-decision-experience.v1.json",
    valid: ["contracts/fixtures/w027-decision-experience.valid.json"],
    invalid: ["contracts/fixtures/w027-decision-experience.invalid.json"]
  },
  {
    schema: "contracts/schemas/w3-official-consequence-learning.v1.json",
    valid: ["contracts/fixtures/w3-official-consequence-learning.valid.json"],
    invalid: ["contracts/fixtures/w3-official-consequence-learning.invalid.json"]
  },
  {
    schema: "contracts/schemas/w4-enterprise-state.v1.json",
    valid: ["contracts/fixtures/w4-enterprise-state.valid.json"],
    invalid: ["contracts/fixtures/w4-enterprise-state.invalid.json"]
  },
  {
    schema: "contracts/schemas/model-candidate-registry.v1.json",
    valid: ["contracts/fixtures/model-candidate-registry.valid.json"],
    invalid: ["contracts/fixtures/model-candidate-registry.invalid.json"]
  },
  {
    schema: "contracts/schemas/model-governance-plane.v1.json",
    valid: ["contracts/fixtures/model-governance-plane.valid.json"],
    invalid: ["contracts/fixtures/model-governance-plane.invalid.json"]
  },
  {
    schema: "contracts/schemas/project-profile.v1.json",
    valid: ["contracts/fixtures/project-profile.valid.json"],
    invalid: []
  },
  {
    schema: "contracts/schemas/project-assignment.v1.json",
    valid: ["contracts/fixtures/project-assignment.valid.json"],
    invalid: []
  },
  {
    schema: "contracts/schemas/executive-strategy-lab.v1.json",
    valid: ["contracts/fixtures/executive-strategy-lab.valid.json"],
    invalid: ["contracts/fixtures/executive-strategy-lab.invalid.json"]
  },
  {
    schema: "contracts/schemas/shanghai-productization.v1.json",
    valid: ["contracts/fixtures/shanghai-productization.valid.json"],
    invalid: []
  },
  {
    schema: "contracts/schemas/mod-next6-consumption.v1.json",
    valid: ["contracts/fixtures/mod-next6-consumption.valid.json"],
    invalid: ["contracts/fixtures/mod-next6-consumption.student-private.invalid.json"]
  },
  {
    schema: "contracts/schemas/can-service-feasibility.v1.json",
    valid: ["contracts/fixtures/can-service-feasibility.valid.json"],
    invalid: ["contracts/fixtures/can-service-feasibility.student-private.invalid.json"]
  }
];

function repoPath(path) {
  return resolve(path);
}

function readJson(path) {
  return JSON.parse(readFileSync(repoPath(path), "utf8"));
}

function readOpenApi(path) {
  return yaml.load(readFileSync(repoPath(path), "utf8"));
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
    jsonContentSchema(loginPost?.responses?.["200"])?.$ref === schemaRef("M1AuthSessionEnvelope"),
    "Auth login 200 response must reference M1AuthSessionEnvelope."
  );
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

  const runCreatePost = openApi.paths["/api/v1/courses/{courseId}/runs"]?.post;
  assert(runCreatePost, "Missing POST operation for M1 run creation.");
  assert(
    jsonContentSchema(runCreatePost.responses?.["201"])?.$ref === schemaRef("M1RunCreateEnvelope"),
    "M1 run create 201 response must reference M1RunCreateEnvelope."
  );
  for (const statusCode of ["401", "403"]) {
    assert(
      jsonContentSchema(runCreatePost.responses?.[statusCode])?.$ref ===
        schemaRef("ApiErrorEnvelope"),
      `M1 run create ${statusCode} response must reference ApiErrorEnvelope.`
    );
  }

  const lifecycleControlsGet = openApi.paths["/api/v1/bff/admin/run-lifecycle-controls"]?.get;
  assert(lifecycleControlsGet, "Missing GET operation for M1 lifecycle controls.");
  for (const statusCode of ["401", "403"]) {
    assert(
      jsonContentSchema(lifecycleControlsGet.responses?.[statusCode])?.$ref ===
        schemaRef("ApiErrorEnvelope"),
      `M1 lifecycle controls ${statusCode} response must reference ApiErrorEnvelope.`
    );
  }

  const lifecycleOperationPost =
    openApi.paths["/api/v1/bff/admin/courses/{courseId}/runs/{runId}/lifecycle/{operation}"]?.post;
  assert(lifecycleOperationPost, "Missing POST operation for M1 lifecycle operation.");
  for (const statusCode of ["401", "403", "404", "409", "422"]) {
    assert(
      jsonContentSchema(lifecycleOperationPost.responses?.[statusCode])?.$ref ===
        schemaRef("ApiErrorEnvelope"),
      `M1 lifecycle operation ${statusCode} response must reference ApiErrorEnvelope.`
    );
  }

  for (const path of [
    "/api/v1/runs/{runId}/rounds/{roundNo}/start",
    "/api/v1/runs/{runId}/rounds/{roundNo}/lock",
    "/api/v1/runs/{runId}/rounds/{roundNo}/publish"
  ]) {
    const operation = openApi.paths[path]?.post;
    assert(operation, `Missing POST operation for ${path}.`);
    assert(
      jsonContentSchema(operation.responses?.["200"])?.$ref === schemaRef("M1RoundEnvelope"),
      `${path} 200 response must reference M1RoundEnvelope.`
    );
  }

  const continuationPost = openApi.paths["/api/v1/runs/{runId}/rounds/{roundNo}/continue"]?.post;
  assert(continuationPost, "Missing POST operation for MW4 round continuation.");
  for (const statusCode of ["200", "201"]) {
    assert(
      jsonContentSchema(continuationPost.responses?.[statusCode])?.$ref ===
        schemaRef("MW4RoundContinuationEnvelope"),
      `MW4 round continuation ${statusCode} response must reference MW4RoundContinuationEnvelope.`
    );
  }
  for (const statusCode of ["403", "404", "409"]) {
    assert(
      jsonContentSchema(continuationPost.responses?.[statusCode])?.$ref ===
        schemaRef("ApiErrorEnvelope"),
      `MW4 round continuation ${statusCode} response must reference ApiErrorEnvelope.`
    );
  }

  for (const path of [
    "/api/v1/runs/{runId}/rounds/{roundNo}/settle",
    "/internal/v1/runs/{runId}/rounds/{roundNo}/settle"
  ]) {
    const operation = openApi.paths[path]?.post;
    assert(operation, `Missing POST operation for ${path}.`);
    assert(
      jsonContentSchema(operation.responses?.["200"])?.$ref ===
        schemaRef("M1SettlementResultEnvelope"),
      `${path} 200 response must reference M1SettlementResultEnvelope.`
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

  const teacherWorkspaceGet =
    openApi.paths["/api/v1/bff/teacher/runs/{runId}/rounds/{roundNo}/workspace"]?.get;
  assert(teacherWorkspaceGet, "Missing GET operation for the Teacher BFF workspace.");
  assert(
    jsonContentSchema(teacherWorkspaceGet.responses?.["200"])?.$ref ===
      schemaRef("M1TeacherBffWorkspaceEnvelope"),
    "Teacher BFF workspace 200 response must reference M1TeacherBffWorkspaceEnvelope."
  );
  assert(
    jsonContentSchema(teacherWorkspaceGet.responses?.["403"])?.$ref ===
      schemaRef("ApiErrorEnvelope"),
    "Teacher BFF workspace 403 response must reference ApiErrorEnvelope."
  );

  const studentCockpitGet =
    openApi.paths["/api/v1/bff/student/runs/{runId}/rounds/{roundNo}/cockpit"]?.get;
  assert(studentCockpitGet, "Missing GET operation for the Student BFF cockpit.");
  assert(
    jsonContentSchema(studentCockpitGet.responses?.["200"])?.$ref ===
      schemaRef("M1StudentBffCockpitEnvelope"),
    "Student BFF cockpit 200 response must reference M1StudentBffCockpitEnvelope."
  );
  assert(
    jsonContentSchema(studentCockpitGet.responses?.["403"])?.$ref === schemaRef("ApiErrorEnvelope"),
    "Student BFF cockpit 403 response must reference ApiErrorEnvelope."
  );

  for (const name of [
    "ApiErrorEnvelope",
    "M1AuthSessionEnvelope",
    "M1DecisionSubmitRequest",
    "M1DecisionSubmitSuccessEnvelope",
    "M1RoundEnvelope",
    "MW4RoundContinuationEnvelope",
    "M1RunCreateEnvelope",
    "M1SettlementResultEnvelope",
    "M1StudentResultEnvelope",
    "M1TeacherAdminResultEnvelope",
    "M1PublicReplayEvidence",
    "M1TeacherBffWorkspaceEnvelope",
    "M1StudentBffCockpitEnvelope"
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

function assertD2OpenApiBindings(openApi) {
  const list = openApi.paths["/api/v1/bff/teacher/evidence"]?.get;
  assert(list, "Missing D2 teacher evidence list operation.");
  assert(
    jsonContentSchema(list.responses?.["200"])?.$ref ===
      "#/components/schemas/D2EvidenceListEnvelope",
    "D2 evidence list must reference evidence-provenance schema."
  );
  const capture = openApi.paths["/api/v1/bff/teacher/evidence-artifacts/capture"]?.post;
  assert(capture, "Missing D2 evidence capture operation.");
  assert(
    jsonContentSchema(capture.requestBody)?.$ref === "#/components/schemas/D2EvidenceCaptureInput",
    "D2 evidence capture request must reference evidence-provenance schema."
  );
  for (const statusCode of ["201", "403", "409", "422"]) {
    assert(capture.responses?.[statusCode], `D2 capture missing response ${statusCode}.`);
  }
}

function assertD3OpenApiBindings(openApi) {
  const claim = openApi.paths["/api/v1/bff/teacher/confirmations/claims"]?.post;
  const status = openApi.paths["/api/v1/bff/teacher/confirmations/claims/{claim_id}"]?.get;
  const release =
    openApi.paths["/api/v1/bff/teacher/confirmations/claims/{claim_id}/release"]?.post;
  assert(claim, "Missing D3 teacher confirmation claim operation.");
  assert(status, "Missing D3 teacher confirmation claim status operation.");
  assert(release, "Missing D3 teacher confirmation claim release operation.");
  for (const [label, operation, statusCode] of [
    ["claim", claim, "201"],
    ["status", status, "200"],
    ["release", release, "200"]
  ]) {
    assert(
      jsonContentSchema(operation.responses?.[statusCode])?.$ref ===
        "#/components/schemas/TeacherConfirmationClaimEnvelope",
      `D3 ${label} response must reference TeacherConfirmationClaimEnvelope.`
    );
  }
}

function assertD4OpenApiBindings(openApi) {
  for (const path of [
    "/api/v1/bff/student/learning-reports",
    "/api/v1/bff/student/learning-reports/{reportId}",
    "/api/v1/bff/teacher/learning-reports",
    "/api/v1/bff/teacher/learning-reports/{reportId}",
    "/api/v1/bff/admin/learning-reports",
    "/api/v1/bff/admin/learning-reports/{reportId}"
  ]) {
    const operation = openApi.paths[path]?.get;
    assert(operation, `Missing D4 learning report operation: ${path}`);
    assert(
      jsonContentSchema(operation.responses?.["200"])?.$ref ===
        "#/components/schemas/StudentLearningReportListEnvelope",
      `D4 learning report 200 response must reference StudentLearningReportListEnvelope: ${path}`
    );
  }
  assert(
    openApi.components?.schemas?.StudentLearningReport?.$ref ===
      "../schemas/student-learning-report.v1.json",
    "D4 StudentLearningReport must reference its JSON Schema artifact."
  );
}

function assertD5OpenApiBindings(openApi) {
  for (const prefix of ["teacher", "admin"]) {
    for (const path of [
      `/api/v1/bff/${prefix}/learning-exports/preview`,
      `/api/v1/bff/${prefix}/learning-exports/seal`,
      `/api/v1/bff/${prefix}/learning-exports`,
      `/api/v1/bff/${prefix}/learning-exports/jobs`,
      `/api/v1/bff/${prefix}/learning-exports/jobs/{jobId}/retry`,
      `/api/v1/bff/${prefix}/learning-exports/jobs/{jobId}/cancel`
    ]) {
      assert(openApi.paths[path], `Missing D5 learning export operation: ${path}`);
    }
  }
  assert(
    openApi.components?.schemas?.D5LearningExportBundle?.$ref === "../schemas/d5-export.v1.json",
    "D5 LearningExportBundle must reference its JSON Schema artifact."
  );
}

function assertD6OpenApiBindings(openApi) {
  for (const prefix of ["teacher", "admin"]) {
    for (const path of [
      `/api/v1/bff/${prefix}/transfer-research-designs`,
      `/api/v1/bff/${prefix}/transfer-research-designs/preview`,
      `/api/v1/bff/${prefix}/transfer-research-designs/freeze`,
      `/api/v1/bff/${prefix}/transfer-research-designs/{studyId}/synthetic-preview`
    ]) {
      assert(openApi.paths[path], `Missing D6 transfer research operation: ${path}`);
    }
  }
  assert(
    openApi.components?.schemas?.D6TransferEvidence?.$ref ===
      "../schemas/d6-transfer-evidence.v1.json",
    "D6 TransferEvidence must reference its JSON Schema artifact."
  );
}

function assertR3OpenApiBindings(openApi) {
  for (const [path, schema] of [
    ["/api/v1/bff/teacher/golden-journey/status", "R3GoldenJourneyStatusEnvelope"],
    ["/api/v1/bff/teacher/golden-journey/context", "R3GoldenJourneyContextEnvelope"],
    ["/api/v1/bff/teacher/golden-journey/allowed-actions", "R3GoldenJourneyAllowedActionsEnvelope"],
    ["/api/v1/bff/teacher/golden-journey/receipts", "R3GoldenJourneyReceiptIndexEnvelope"],
    ["/api/v1/bff/student/golden-journey/status", "R3GoldenJourneyStatusEnvelope"]
  ]) {
    const operation = openApi.paths[path]?.get;
    assert(operation, `Missing R3 Golden Journey operation: ${path}`);
    assert(
      jsonContentSchema(operation.responses?.["200"])?.$ref === `#/components/schemas/${schema}`,
      `R3 Golden Journey path must reference ${schema}: ${path}`
    );
  }
}

function assertC4OpenApiBindings(openApi) {
  for (const path of [
    "/api/v1/bff/teacher/instructor-debrief-artifact",
    "/api/v1/bff/teacher/instructor-debrief-artifact/export"
  ]) {
    const operation = openApi.paths[path]?.get;
    assert(operation, "Missing C4 instructor debrief operation: " + path);
  }
  assert(
    openApi.components?.schemas?.InstructorDebriefArtifactEnvelope?.properties?.data?.$ref ===
      "../schemas/instructor-debrief-artifact.v1.json",
    "C4 instructor debrief envelope must reference its JSON Schema artifact."
  );
}

function assertW020OpenApiBindings(openApi) {
  assert(
    openApi?.paths?.["/api/v1/bff/student/advisors/role"],
    "Missing W020 student advisor path."
  );
  assert(
    openApi?.paths?.["/api/v1/bff/teacher/advisors/debrief"],
    "Missing W020 teacher advisor path."
  );
  assert(
    openApi?.paths?.["/api/v1/bff/teacher/advisors/audit"],
    "Missing W020 teacher audit path."
  );
  assert(
    openApi?.components?.schemas?.W020AdvisoryEnvelope,
    "Missing W020 advisory envelope schema."
  );
}

function assertW022OpenApiBindings(openApi) {
  assert(
    openApi?.paths?.["/api/v1/bff/teacher/fresh-learner-admission"],
    "Missing W022 fresh learner admission path."
  );
  assert(
    openApi?.components?.schemas?.FreshLearnerAdmissionEnvelope,
    "Missing W022 fresh learner admission envelope schema."
  );
  assert(
    openApi?.paths?.["/api/v1/bff/teacher/fresh-learner-admission"]?.get?.responses?.["200"]
      ?.content?.["application/json"]?.schema?.$ref === schemaRef("FreshLearnerAdmissionEnvelope"),
    "W022 admission path must reference FreshLearnerAdmissionEnvelope."
  );
}

function assertW023OpenApiBindings(openApi) {
  const path = openApi?.paths?.["/api/v1/bff/teacher/validation-sessions"];
  assert(path?.get && path?.post, "Missing W023 validation session list/create operations.");
  assert(
    openApi?.components?.schemas?.ValidationSessionEnvelope,
    "Missing W023 validation session envelope schema."
  );
}

function assertW3OpenApiBindings(openApi) {
  const responseSchema = (path, method = "get") =>
    jsonContentSchema(openApi?.paths?.[path]?.[method]?.responses?.["200"]);
  assert(
    responseSchema("/api/v1/bff/student/w3/consequence")?.$ref ===
      schemaRef("W3OfficialConsequenceEnvelope"),
    "W3 student consequence path must reference W3OfficialConsequenceEnvelope."
  );
  assert(
    responseSchema("/api/v1/bff/teacher/w3/consequence")?.$ref ===
      schemaRef("W3OfficialConsequenceEnvelope"),
    "W3 teacher consequence path must reference W3OfficialConsequenceEnvelope."
  );
  for (const path of [
    "/api/v1/bff/teacher/w3/counterfactual",
    "/api/v1/bff/student/w3/reflection",
    "/api/v1/bff/teacher/w3/evidence-selection",
    "/api/v1/bff/teacher/w3/next-round-hypothesis"
  ]) {
    assert(openApi?.paths?.[path]?.post, `Missing W3 command operation: ${path}`);
  }
  assert(
    openApi?.components?.schemas?.W3OfficialConsequenceEnvelope?.properties?.data?.$ref ===
      schemaRef("W3OfficialConsequenceResponse"),
    "W3 consequence envelope must reference W3OfficialConsequenceResponse."
  );
  assert(
    openApi?.components?.schemas?.W3OfficialConsequenceResponse?.properties?.record?.$ref ===
      "../schemas/w3-official-consequence-learning.v1.json",
    "W3 consequence response must reference its JSON Schema artifact."
  );
}

function assertESLOpenApiBindings(openApi) {
  assert(
    jsonContentSchema(
      openApi?.paths?.["/api/v1/bff/teacher/esl/strategy-lab"]?.post?.responses?.["201"]
    )?.$ref === schemaRef("ExecutiveStrategyLabEnvelope"),
    "ESL teacher create must reference ExecutiveStrategyLabEnvelope."
  );
  for (const path of [
    "/api/v1/bff/teacher/esl/candidates/{candidateId}",
    "/api/v1/bff/student/esl/candidates/{candidateId}",
    "/api/v1/bff/admin/esl/audit"
  ]) {
    assert(openApi?.paths?.[path]?.get, `Missing ESL read operation: ${path}`);
    assert(
      jsonContentSchema(openApi.paths[path].get.responses?.["200"])?.$ref ===
        schemaRef("ExecutiveStrategyLabEnvelope"),
      `ESL read operation must reference ExecutiveStrategyLabEnvelope: ${path}`
    );
  }
  assert(
    openApi.components?.schemas?.ExecutiveStrategyLabEnvelope?.properties?.data?.$ref ===
      "../schemas/executive-strategy-lab.v1.json",
    "ESL envelope must reference its JSON Schema artifact."
  );
  assert(
    openApi.components?.schemas?.ExecutiveStrategyLabRequest?.$ref ===
      "../schemas/executive-strategy-lab.v1.json#/$defs/request",
    "ESL request must reference its request definition."
  );
}

function formatAjvErrors(validate) {
  return validate.errors
    ?.map((error) => `${error.instancePath || "/"} ${error.message ?? "schema error"}`)
    .join("; ");
}

export function createContractAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addFormat("email", {
    type: "string",
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  });
  ajv.addFormat("date-time", {
    type: "string",
    validate: (value) => !Number.isNaN(Date.parse(value))
  });
  ajv.addFormat("uri", {
    type: "string",
    validate: (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }
  });
  return ajv;
}

function validateFixtureCases() {
  for (const contractCase of schemaCases) {
    const ajv = createContractAjv();
    ajv.addSchema(readJson("contracts/schemas/user.v1.json"));
    ajv.addSchema(readJson("contracts/schemas/auth-session.v1.json"));
    ajv.addSchema(readJson("contracts/schemas/settlement-result.v1.json"));
    ajv.addSchema(readJson("contracts/schemas/instructor-intelligence-kit.v1.json"));
    ajv.addSchema(
      readJson("contracts/schemas/m2p4-live-round-ops.v1.json"),
      "m2p4-live-round-ops.v1.json"
    );
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

export async function runContractValidation(options = {}) {
  const openApiPath = options.openApiPath ?? "contracts/openapi/p0-api.openapi.yaml";

  requireFiles([
    ...requiredBaselineFiles,
    ...m1ContractFiles,
    ...a5ContractFiles,
    ...d1ContractFiles,
    ...d2ContractFiles,
    ...d3ContractFiles,
    ...d4ContractFiles,
    ...d5ContractFiles,
    ...d6ContractFiles,
    ...r3ContractFiles,
    ...c4ContractFiles,
    ...w020ContractFiles,
    ...w022ContractFiles,
    ...w023ContractFiles,
    ...w025ContractFiles,
    ...w027ContractFiles,
    ...w3ContractFiles,
    ...w4ContractFiles,
    ...mod04ContractFiles,
    ...mod06ContractFiles,
    ...shanghaiFullVerticalContractFiles,
    ...executiveStrategyLabContractFiles,
    ...shanghaiProductizationContractFiles,
    ...modNext6ContractFiles,
    ...r1CanServiceFeasibilityContractFiles
  ]);

  for (const jsonPath of [
    ...requiredBaselineFiles,
    ...m1ContractFiles,
    ...a5ContractFiles,
    ...d1ContractFiles,
    ...d2ContractFiles,
    ...d3ContractFiles,
    ...d4ContractFiles,
    ...d5ContractFiles,
    ...d6ContractFiles,
    ...r3ContractFiles,
    ...c4ContractFiles,
    ...w020ContractFiles,
    ...w022ContractFiles,
    ...w023ContractFiles,
    ...w025ContractFiles,
    ...w027ContractFiles,
    ...w3ContractFiles,
    ...w4ContractFiles,
    ...mod04ContractFiles,
    ...mod06ContractFiles,
    ...shanghaiFullVerticalContractFiles,
    ...executiveStrategyLabContractFiles,
    ...shanghaiProductizationContractFiles,
    ...modNext6ContractFiles,
    ...r1CanServiceFeasibilityContractFiles
  ].filter((file) => file.endsWith(".json"))) {
    readJson(jsonPath);
  }

  await SwaggerParser.validate(repoPath(openApiPath));
  const openApi = readOpenApi(openApiPath);
  assertM1OpenApiBindings(openApi);
  assertD2OpenApiBindings(openApi);
  assertD3OpenApiBindings(openApi);
  assertD4OpenApiBindings(openApi);
  assertD5OpenApiBindings(openApi);
  assertD6OpenApiBindings(openApi);
  assertR3OpenApiBindings(openApi);
  assertC4OpenApiBindings(openApi);
  assertW020OpenApiBindings(openApi);
  assertW022OpenApiBindings(openApi);
  assertW023OpenApiBindings(openApi);
  assertW3OpenApiBindings(openApi);
  assertESLOpenApiBindings(openApi);
  assertFrontendDoesNotUseInternalRoutes();
  validateFixtureCases();
  assertStudentFixtureDoesNotExposePrivateFields();

  return {
    baselineFiles: requiredBaselineFiles.length,
    m1ContractFiles: m1ContractFiles.length,
    fixtureCases: schemaCases.length,
    openApiParser: "@apidevtools/swagger-parser"
  };
}
