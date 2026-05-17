import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const requiredFiles = [
  "docs/contracts/api-contract.md",
  "docs/contracts/model-engineering-contract.md",
  "contracts/openapi/p0-api.openapi.yaml",
  "contracts/schemas/audit-log.v1.json",
  "contracts/schemas/auth-session.v1.json",
  "contracts/schemas/decision-payload.v1.json",
  "contracts/schemas/rbac.v1.json",
  "contracts/schemas/settlement-result.v1.json",
  "contracts/schemas/tenant.v1.json",
  "contracts/schemas/user.v1.json",
  "packages/shared-contracts/src/index.ts",
  "services/api/src/health.ts"
];

const missing = requiredFiles.filter((file) => !existsSync(resolve(file)));

if (missing.length > 0) {
  console.error("Missing contract baseline files:");
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

const openApi = readFileSync(resolve("contracts/openapi/p0-api.openapi.yaml"), "utf8");
const requiredPaths = [
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
const missingPaths = requiredPaths.filter((path) => !openApi.includes(path));

if (missingPaths.length > 0) {
  console.error("Missing P0/P1 OpenAPI paths:");
  for (const path of missingPaths) {
    console.error(`- ${path}`);
  }
  process.exit(1);
}

for (const schemaPath of requiredFiles.filter((file) => file.startsWith("contracts/schemas/"))) {
  JSON.parse(readFileSync(resolve(schemaPath), "utf8"));
}

console.log("Contract baseline files and P0/P1 paths are present.");
