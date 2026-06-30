import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const frontendAppFiles = [
  "apps/admin/src/App.tsx",
  "apps/teacher/src/App.tsx",
  "apps/student/src/App.tsx"
];

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("R3 security baseline boundaries", () => {
  it("keeps frontend demo login shortcuts behind explicit demo-mode environment", () => {
    for (const file of frontendAppFiles) {
      const source = read(file);

      expect(source).toContain("VITE_SIMWAR_DEMO_MODE");
      expect(source).toContain("VITE_SIMWAR_DEMO_TENANT_ID");
      expect(source).toContain("VITE_SIMWAR_DEMO_USERNAME");
      expect(source).toContain("VITE_SIMWAR_DEMO_PASSWORD");
      expect(source).not.toContain("void signIn(DEFAULT_LOGIN)");
      expect(source).not.toMatch(/password:\s*"(?:admin|platform|simwar123|student|teacher)"/);
    }
  });

  it("keeps frontend source from calling internal settlement routes", () => {
    for (const file of frontendAppFiles) {
      expect(read(file)).not.toContain("/internal/v1");
    }
  });

  it("marks internal settle as service-principal-only in the OpenAPI boundary", () => {
    const openApi = read("contracts/openapi/p0-api.openapi.yaml");

    expect(openApi).toContain("/internal/v1/runs/{runId}/rounds/{roundNo}/settle:");
    expect(openApi).toContain("x-simwar-internal: true");
    expect(openApi).toContain("x-simwar-public-client: false");
    expect(openApi).toContain("x-simwar-service-principal-only: true");
    expect(openApi).toContain("InternalServiceBearer");
    expect(openApi).toContain("ServicePrincipalHeader");
  });
});
