import { describe, expect, it, vi } from "vitest";
import type { SimWarRepositoryPorts } from "../../services/api/src/repository-ports.js";
import {
  createJsonRepositoryProvider,
  createRepositoryProvider,
} from "../../services/api/src/repository-provider.js";
import type { SimWarStore } from "../../services/api/src/store.js";

function createMockPorts(): SimWarRepositoryPorts {
  return {
    identity: {
      getTenant: vi.fn(async (tenantId) => ({
        tenant_id: tenantId,
        status: "active",
      })),
      getUser: vi.fn(async (tenantId, userId) => ({
        tenant_id: tenantId,
        user_id: userId,
        status: "active",
      })),
    },

    sessions: {
      getSession: vi.fn(async () => null),
      listActiveSessionsByUser: vi.fn(async () => []),
    },

    courses: {
      getCourse: vi.fn(async () => null),
      listCoursesForUser: vi.fn(async () => []),
    },

    teams: {
      getTeam: vi.fn(async () => null),
      listTeamsForRun: vi.fn(async () => []),
      getTeamForUser: vi.fn(async () => null),
    },

    runs: {
      getRun: vi.fn(async () => null),
      listRunsForCourse: vi.fn(async () => []),
    },

    rounds: {
      getRound: vi.fn(async () => null),
      listRoundsForRun: vi.fn(async () => []),
      markRoundSettled: vi.fn(async () => undefined),
    },

    decisions: {
      getDecisionById: vi.fn(async () => null),
      getCanonicalDecisionForTeamRound: vi.fn(async () => null),
      listDecisionsForRound: vi.fn(async () => []),
      saveCanonicalDecision: vi.fn(async () => undefined),
    },

    settlements: {
      getSettlementResult: vi.fn(async () => null),
      listSettlementResultsForRound: vi.fn(async () => []),
      saveSettlementResult: vi.fn(async () => undefined),
    },

    domainEvents: {
      appendDomainEvent: vi.fn(async () => undefined),
      listDomainEvents: vi.fn(async () => []),
    },

    stateSnapshots: {
      getStateSnapshot: vi.fn(async () => null),
      saveStateSnapshot: vi.fn(async () => undefined),
    },

    auditLogs: {
      appendAuditLog: vi.fn(async () => undefined),
      listAuditLogs: vi.fn(async () => []),
    },

    replay: {
      saveReplayInputManifest: vi.fn(async () => undefined),
      getReplayInputManifest: vi.fn(async () => null),
      saveReplayRun: vi.fn(async () => undefined),
      getReplayRun: vi.fn(async () => null),
      saveReplayReport: vi.fn(async () => undefined),
      getReplayReport: vi.fn(async () => null),
      saveReplayDiffReport: vi.fn(async () => undefined),
      getReplayDiffReport: vi.fn(async () => null),
    },
  };
}

function createMinimalStore(): SimWarStore {
  return {
    tenants: [{ tenant_id: "tenant-1", status: "active" }],
    users: [],
    sessions: [],
    courses: [],
    teams: [],
    runs: [],
    rounds: [],
    decisions: [],
    settlementResults: [],
    auditLogs: [],
    persist: vi.fn(),
  } as unknown as SimWarStore;
}

describe("repository provider", () => {
  it("creates a custom provider from repository ports", async () => {
    const ports = createMockPorts();
    const provider = createRepositoryProvider({ ports });

    expect(provider.mode).toBe("custom");
    expect(provider.ports).toBe(ports);

    await expect(provider.facade.identity.getTenant("tenant-1")).resolves.toEqual({
      tenant_id: "tenant-1",
      status: "active",
    });

    expect(ports.identity.getTenant).toHaveBeenCalledWith("tenant-1");
  });

  it("preserves an explicit provider mode when composing custom ports", () => {
    const ports = createMockPorts();
    const provider = createRepositoryProvider({ mode: "json", ports });

    expect(provider.mode).toBe("json");
    expect(provider.ports).toBe(ports);
    expect(provider.facade).toBeDefined();
  });

  it("creates a JSON-backed provider from the current store adapter", async () => {
    const store = createMinimalStore();
    const provider = createJsonRepositoryProvider({ store });

    expect(provider.mode).toBe("json");
    expect(provider.ports).toBeDefined();
    expect(provider.facade).toBeDefined();

    await expect(provider.facade.identity.getTenant("tenant-1")).resolves.toEqual({
      tenant_id: "tenant-1",
      status: "active",
    });
  });
});
