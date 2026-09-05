import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@simwar/shared-contracts";
import { ModelQualificationService } from "../../services/api/src/model-qualification-service";
import { handleModelQualificationRoute } from "../../services/api/src/routes/model-qualification-routes";
import type { RepositoryFacade } from "../../services/api/src/repository-facade";

const actor = {
  user_id: "admin-1",
  tenant_id: "tenant-1",
  roles: ["tenant_admin"],
  permissions: ["course:read"]
} as unknown as CurrentUser;

async function invoke(path: string) {
  const dependencies = {
    actorHasAnyRole: () => true,
    createContext: () => ({ requestId: "request-1", tenantId: "tenant-1", actor }),
    createEnvelope: (_context: unknown, data: unknown) => ({ data }),
    getStrategicPortfolioProjections: async () => [],
    readJson: async () => ({}),
    repository: {
      courses: { listCoursesForTenant: async () => [] }
    } as unknown as RepositoryFacade,
    requirePermission: () => actor,
    sendJson: () => undefined
  };
  await handleModelQualificationRoute(
    new ModelQualificationService(),
    { method: "GET" } as IncomingMessage,
    {} as ServerResponse,
    new URL(`http://localhost${path}`),
    dependencies
  );
}

describe("SP-O2 readiness route digest expectations", () => {
  it.each(["foo", ""])("rejects malformed portfolioStateDigest=%j", async (digest) => {
    await expect(
      invoke(
        `/api/v1/bff/admin/model-qualification/strategic-portfolio-readiness?portfolioStateDigest=${digest}`
      )
    ).rejects.toThrow("MODEL_QUALIFICATION_SCOPE_CONFLICT");
  });
});
