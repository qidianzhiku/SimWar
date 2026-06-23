import { describe, expect, it, vi } from "vitest";
import type {
  CommitSettlementOutcomeCommand,
  SettlementOutcomeCommitResult,
  SimWarRepositoryPorts
} from "../../services/api/src/repository-ports.js";
import {
  createJsonRepositoryFacade,
  createRepositoryFacade
} from "../../services/api/src/repository-facade.js";
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
      getSession: vi.fn(async (tenantId, sessionId) => ({
        tenant_id: tenantId,
        session_id: sessionId,
        user_id: "user-1",
        expires_at: "2099-01-01T00:00:00.000Z"
      })),
      listActiveSessionsByUser: vi.fn(async () => [])
    },

    courses: {
      getCourse: vi.fn(async (tenantId, courseId) => ({
        tenant_id: tenantId,
        course_id: courseId,
        status: "active"
      })),
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
    tenants: [],
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

describe("repository facade", () => {
  it("forwards identity reads to the configured repository ports", async () => {
    const ports = createMockPorts();
    const facade = createRepositoryFacade({ ports });

    await expect(facade.identity.getTenant("tenant-1")).resolves.toEqual({
      tenant_id: "tenant-1",
      status: "active"
    });

    await expect(facade.identity.getUser("tenant-1", "user-1")).resolves.toEqual({
      tenant_id: "tenant-1",
      user_id: "user-1",
      status: "active"
    });

    expect(ports.identity.getTenant).toHaveBeenCalledWith("tenant-1");
    expect(ports.identity.getUser).toHaveBeenCalledWith("tenant-1", "user-1");
  });

  it("forwards canonical decision and settlement writes without changing payloads", async () => {
    const ports = createMockPorts();
    const facade = createRepositoryFacade({ ports });
    const decision = { decision_id: "decision-1" } as Parameters<
      typeof facade.decisions.saveCanonicalDecision
    >[0];
    const settlement = { settlement_result_id: "settlement-1" } as Parameters<
      typeof facade.settlements.saveSettlementResult
    >[0];

    await facade.decisions.saveCanonicalDecision(decision);
    await facade.settlements.saveSettlementResult(settlement);

    expect(ports.decisions.saveCanonicalDecision).toHaveBeenCalledWith(decision);
    expect(ports.settlements.saveSettlementResult).toHaveBeenCalledWith(settlement);
  });

  it("forwards atomic settlement outcome commits through one explicit facade method", async () => {
    const ports = createMockPorts();
    const facade = createRepositoryFacade({ ports });
    const command: CommitSettlementOutcomeCommand = {
      tenant_id: "tenant-1",
      round_id: "round-1",
      settlement_result: {
        tenant_id: "tenant-1",
        settlement_result_id: "settlement-1",
        run_id: "run-1",
        round_id: "round-1",
        round_no: 1,
        parameter_set_id: "parameter-set-1",
        scenario_package_id: "scenario-package-1",
        replay_hash: "replay-hash-1",
        team_results: []
      }
    };
    const originalCommand = structuredClone(command);

    await expect(facade.commitSettlementOutcome(command)).resolves.toEqual({
      settlement_result: command.settlement_result,
      status: "committed"
    });

    expect(ports.settlementOutcome.commitSettlementOutcome).toHaveBeenCalledTimes(1);
    expect(ports.settlementOutcome.commitSettlementOutcome).toHaveBeenCalledWith(command);
    expect(command).toEqual(originalCommand);
    expect(ports.settlements.saveSettlementResult).not.toHaveBeenCalled();
    expect(ports.rounds.saveRound).not.toHaveBeenCalled();
    expect(ports.rounds.markRoundSettled).not.toHaveBeenCalled();
    expect(ports.auditLogs.appendAuditLog).not.toHaveBeenCalled();
  });

  it("propagates atomic settlement outcome failures without fallback writes", async () => {
    const ports = createMockPorts();
    const failure = new Error("settlement_outcome_round_missing");
    vi.mocked(ports.settlementOutcome.commitSettlementOutcome).mockRejectedValueOnce(failure);
    const facade = createRepositoryFacade({ ports });
    const command: CommitSettlementOutcomeCommand = {
      tenant_id: "tenant-1",
      round_id: "round-1",
      settlement_result: {
        tenant_id: "tenant-1",
        settlement_result_id: "settlement-1",
        run_id: "run-1",
        round_id: "round-1",
        round_no: 1,
        parameter_set_id: "parameter-set-1",
        scenario_package_id: "scenario-package-1",
        replay_hash: "replay-hash-1",
        team_results: []
      }
    };

    await expect(facade.commitSettlementOutcome(command)).rejects.toBe(failure);

    expect(ports.settlementOutcome.commitSettlementOutcome).toHaveBeenCalledTimes(1);
    expect(ports.settlements.saveSettlementResult).not.toHaveBeenCalled();
    expect(ports.rounds.saveRound).not.toHaveBeenCalled();
    expect(ports.rounds.markRoundSettled).not.toHaveBeenCalled();
    expect(ports.auditLogs.appendAuditLog).not.toHaveBeenCalled();
  });

  it("creates a JSON-backed facade without wiring it into server runtime", async () => {
    const store = createMinimalStore();
    const facade = createJsonRepositoryFacade({ store });

    await expect(facade.identity.getTenant("missing-tenant")).resolves.toBeNull();
  });
});
