import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { Round, SettlementResult } from "@simwar/shared-contracts";
import type {
  CommitSettlementOutcomeCommand,
  SettlementOutcomeCommitResult,
  SimWarRepositoryPorts
} from "../../services/api/src/repository-ports.js";
import {
  createJsonRepositoryProvider,
  createRepositoryProvider
} from "../../services/api/src/repository-provider.js";
import type { SimWarStore } from "../../services/api/src/store.js";

function createMockPorts(): SimWarRepositoryPorts {
  return {
    identity: {
      getTenant: vi.fn(async (tenantId) => ({
        tenant_id: tenantId,
        status: "active"
      })),
      getUser: vi.fn(async (tenantId, userId) => ({
        tenant_id: tenantId,
        user_id: userId,
        status: "active"
      }))
    },

    sessions: {
      getSession: vi.fn(async () => null),
      listActiveSessionsByUser: vi.fn(async () => [])
    },

    courses: {
      getCourse: vi.fn(async () => null),
      listCoursesForUser: vi.fn(async () => [])
    },

    teams: {
      getTeam: vi.fn(async () => null),
      listTeamsForRun: vi.fn(async () => []),
      getTeamForUser: vi.fn(async () => null)
    },

    runs: {
      getRun: vi.fn(async () => null),
      listRunsForCourse: vi.fn(async () => [])
    },

    rounds: {
      getRound: vi.fn(async () => null),
      listRoundsForRun: vi.fn(async () => []),
      saveRound: vi.fn(async () => undefined),
      markRoundSettled: vi.fn(async () => undefined)
    },

    decisions: {
      getDecisionById: vi.fn(async () => null),
      getCanonicalDecisionForTeamRound: vi.fn(async () => null),
      listDecisionsForRound: vi.fn(async () => []),
      saveDecision: vi.fn(async () => undefined),
      saveCanonicalDecision: vi.fn(async () => undefined)
    },

    settlements: {
      getSettlementResult: vi.fn(async () => null),
      listSettlementResultsForRound: vi.fn(async () => []),
      saveSettlementResult: vi.fn(async () => undefined)
    },

    settlementOutcome: {
      commitSettlementOutcome: vi.fn(
        async (
          command: CommitSettlementOutcomeCommand
        ): Promise<SettlementOutcomeCommitResult> => ({
          settlement_result: command.settlement_result,
          status: "committed"
        })
      )
    },

    domainEvents: {
      appendDomainEvent: vi.fn(async () => undefined),
      listDomainEvents: vi.fn(async () => [])
    },

    stateSnapshots: {
      getStateSnapshot: vi.fn(async () => null),
      saveStateSnapshot: vi.fn(async () => undefined)
    },

    auditLogs: {
      appendAuditLog: vi.fn(async () => undefined),
      listAuditLogs: vi.fn(async () => [])
    },

    replay: {
      saveReplayInputManifest: vi.fn(async () => undefined),
      getReplayInputManifest: vi.fn(async () => null),
      saveReplayRun: vi.fn(async () => undefined),
      getReplayRun: vi.fn(async () => null),
      saveReplayReport: vi.fn(async () => undefined),
      getReplayReport: vi.fn(async () => null),
      saveReplayDiffReport: vi.fn(async () => undefined),
      getReplayDiffReport: vi.fn(async () => null)
    }
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
    persist: vi.fn()
  } as unknown as SimWarStore;
}

function createRound(overrides: Partial<Round> = {}): Round {
  return {
    tenant_id: "tenant-1",
    round_id: "round-1",
    run_id: "run-1",
    round_no: 1,
    status: "locked",
    decision_batch_id: "decision-batch-1",
    ...overrides
  };
}

function createSettlementResult(overrides: Partial<SettlementResult> = {}): SettlementResult {
  return {
    tenant_id: "tenant-1",
    settlement_result_id: "settlement-1",
    run_id: "run-1",
    round_id: "round-1",
    round_no: 1,
    parameter_set_id: "parameter-set-1",
    scenario_package_id: "scenario-package-1",
    replay_hash: "replay-hash-1",
    team_results: [],
    ...overrides
  };
}

describe("repository provider", () => {
  it("creates a custom provider from repository ports", async () => {
    const ports = createMockPorts();
    const provider = createRepositoryProvider({ ports });

    expect(provider.mode).toBe("custom");
    expect(provider.ports).toBe(ports);

    await expect(provider.facade.identity.getTenant("tenant-1")).resolves.toEqual({
      tenant_id: "tenant-1",
      status: "active"
    });

    expect(ports.identity.getTenant).toHaveBeenCalledWith("tenant-1");
  });

  it("keeps the custom provider atomic settlement outcome port explicit", async () => {
    const ports = createMockPorts();
    const provider = createRepositoryProvider({ ports });
    const command: CommitSettlementOutcomeCommand = {
      tenant_id: "tenant-1",
      round_id: "round-1",
      settlement_result: createSettlementResult()
    };

    expect(provider.ports.settlementOutcome).toBe(ports.settlementOutcome);

    await expect(provider.facade.commitSettlementOutcome(command)).resolves.toEqual({
      settlement_result: command.settlement_result,
      status: "committed"
    });

    expect(ports.settlementOutcome.commitSettlementOutcome).toHaveBeenCalledTimes(1);
    expect(ports.settlementOutcome.commitSettlementOutcome).toHaveBeenCalledWith(command);
    expect(ports.settlements.saveSettlementResult).not.toHaveBeenCalled();
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
    expect(provider.ports.settlementOutcome).toBeDefined();
    expect(provider.ports.settlementOutcome.commitSettlementOutcome).toEqual(expect.any(Function));
    expect(provider.facade).toBeDefined();

    await expect(provider.facade.identity.getTenant("tenant-1")).resolves.toEqual({
      tenant_id: "tenant-1",
      status: "active"
    });
  });

  it("commits a JSON settlement outcome through provider aggregate and facade wiring", async () => {
    const round = createRound();
    const result = createSettlementResult({ replay_hash: "json-provider-replay-hash" });
    const store = createMinimalStore();
    store.rounds.push(round);
    const provider = createJsonRepositoryProvider({ store });
    const command: CommitSettlementOutcomeCommand = {
      tenant_id: "tenant-1",
      round_id: "round-1",
      settlement_result: result
    };
    const originalCommand = structuredClone(command);

    await expect(provider.facade.commitSettlementOutcome(command)).resolves.toEqual({
      settlement_result: result,
      status: "committed"
    });

    expect(store.settlementResults).toEqual([result]);
    expect(store.settlementResults[0]).toBe(result);
    expect(round.status).toBe("settled");
    expect(round.replay_hash).toBe("json-provider-replay-hash");
    expect(round.decision_batch_id).toBe("decision-batch-1");
    expect(command).toEqual(originalCommand);
    expect(store.persist).toHaveBeenCalledTimes(1);
  });

  it("propagates JSON settlement outcome failures without falling back to the old writer", async () => {
    const store = createMinimalStore();
    const provider = createJsonRepositoryProvider({ store });
    const command: CommitSettlementOutcomeCommand = {
      tenant_id: "tenant-1",
      round_id: "round-1",
      settlement_result: createSettlementResult()
    };

    await expect(provider.facade.commitSettlementOutcome(command)).rejects.toThrow(
      "settlement_outcome_round_missing"
    );

    expect(store.rounds).toEqual([]);
    expect(store.settlementResults).toEqual([]);
    expect(store.persist).not.toHaveBeenCalled();
  });

  it("routes active settlement commits through the atomic facade", () => {
    const serverSource = readFileSync(
      new URL("../../services/api/src/server.ts", import.meta.url),
      "utf8"
    );

    expect(serverSource).toContain("prepareSettlementOutcome(");
    expect(serverSource).toContain("runtime.repositoryProvider.facade.commitSettlementOutcome(");
    expect(serverSource).not.toContain("settleRoundWithSettlementWriter(");
  });
});
