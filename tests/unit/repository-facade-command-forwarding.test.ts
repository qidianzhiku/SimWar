import { describe, expect, it, vi } from "vitest";
import type {
  AuditLog,
  ReplayDiffReport,
  ReplayInputManifest,
  ReplayReport,
  ReplayRun,
  SettlementResult,
  StateSnapshot
} from "../../packages/shared-contracts/src";
import { createRepositoryFacade } from "../../services/api/src/repository-facade.js";
import type { SimWarRepositoryPorts } from "../../services/api/src/repository-ports.js";

function createSpyPorts(): SimWarRepositoryPorts {
  return {
    identity: {
      getTenant: vi.fn(async () => null),
      getUser: vi.fn(async () => null)
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
      markRoundSettled: vi.fn(async () => undefined)
    },

    decisions: {
      getDecisionById: vi.fn(async () => null),
      getCanonicalDecisionForTeamRound: vi.fn(async () => null),
      listDecisionsForRound: vi.fn(async () => []),
      saveCanonicalDecision: vi.fn(async () => undefined)
    },

    settlements: {
      getSettlementResult: vi.fn(async () => null),
      listSettlementResultsForRound: vi.fn(async () => []),
      saveSettlementResult: vi.fn(async () => undefined)
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

describe("repository facade command forwarding", () => {
  it("forwards audit, settlement, and state snapshot writes without changing payloads", async () => {
    const ports = createSpyPorts();
    const facade = createRepositoryFacade({ ports });
    const auditLog: AuditLog = {
      audit_id: "audit_001",
      tenant_id: "tenant_demo",
      actor_id: "usr_admin",
      actor_role: "tenant_admin",
      action: "user.create",
      resource_type: "user",
      resource_id: "usr_learner",
      request_id: "req-001",
      created_at: "2026-06-08T00:00:00.000Z",
      before: { status: "missing" },
      after: { status: "created" }
    };
    const settlement: SettlementResult = {
      settlement_result_id: "result_001",
      tenant_id: "tenant_demo",
      run_id: "run_demo",
      round_id: "round_001",
      round_no: 1,
      parameter_set_id: "params_v1",
      scenario_package_id: "scenario_wellness",
      replay_hash: "hash_settlement",
      team_results: []
    };
    const snapshot: StateSnapshot = {
      snapshot_id: "snapshot_001",
      tenant_id: "tenant_demo",
      run_id: "run_demo",
      round_id: "round_001",
      snapshot_type: "settlement",
      captured_at: "2026-06-08T00:00:01.000Z",
      state: { replay_hash: "hash_settlement" }
    };
    const originalPayloads = structuredClone({
      auditLog,
      settlement,
      snapshot
    });

    await expect(facade.auditLogs.appendAuditLog(auditLog)).resolves.toBeUndefined();
    await expect(facade.settlements.saveSettlementResult(settlement)).resolves.toBeUndefined();
    await expect(facade.stateSnapshots.saveStateSnapshot(snapshot)).resolves.toBeUndefined();

    expect(ports.auditLogs.appendAuditLog).toHaveBeenCalledWith(auditLog);
    expect(ports.settlements.saveSettlementResult).toHaveBeenCalledWith(settlement);
    expect(ports.stateSnapshots.saveStateSnapshot).toHaveBeenCalledWith(snapshot);
    expect({ auditLog, settlement, snapshot }).toEqual(originalPayloads);
  });

  it("forwards replay writes without changing payloads", async () => {
    const ports = createSpyPorts();
    const facade = createRepositoryFacade({ ports });
    const manifest: ReplayInputManifest = {
      manifest_id: "manifest_001",
      tenant_id: "tenant_demo",
      run_id: "run_demo",
      round_id: "round_001",
      source_result_id: "result_001",
      input_hash: "hash_input",
      manifest_hash: "hash_manifest",
      included_sources: ["canonical_decisions", "scenario", "parameter_set"],
      excluded_from_truth_hash: { ai_advisory: true },
      created_at: "2026-06-08T00:00:00.000Z"
    };
    const replayRun: ReplayRun = {
      replay_run_id: "replay_run_001",
      tenant_id: "tenant_demo",
      run_id: "run_demo",
      round_id: "round_001",
      replay_mode: "official_replay",
      status: "completed",
      manifest_id: "manifest_001",
      started_at: "2026-06-08T00:00:01.000Z",
      completed_at: "2026-06-08T00:00:02.000Z"
    };
    const replayReport: ReplayReport = {
      replay_report_id: "replay_report_001",
      replay_run_id: "replay_run_001",
      tenant_id: "tenant_demo",
      run_id: "run_demo",
      round_id: "round_001",
      status: "matched",
      source_result_id: "result_001",
      replay_result_hash: "hash_settlement",
      matched: true,
      created_at: "2026-06-08T00:00:03.000Z"
    };
    const diffReport: ReplayDiffReport = {
      diff_report_id: "diff_report_001",
      replay_report_id: "replay_report_001",
      tenant_id: "tenant_demo",
      run_id: "run_demo",
      round_id: "round_001",
      severity: "none",
      differences: [],
      created_at: "2026-06-08T00:00:04.000Z"
    };
    const originalPayloads = structuredClone({
      manifest,
      replayRun,
      replayReport,
      diffReport
    });

    await expect(facade.replay.saveReplayInputManifest(manifest)).resolves.toBeUndefined();
    await expect(facade.replay.saveReplayRun(replayRun)).resolves.toBeUndefined();
    await expect(facade.replay.saveReplayReport(replayReport)).resolves.toBeUndefined();
    await expect(facade.replay.saveReplayDiffReport(diffReport)).resolves.toBeUndefined();

    expect(ports.replay.saveReplayInputManifest).toHaveBeenCalledWith(manifest);
    expect(ports.replay.saveReplayRun).toHaveBeenCalledWith(replayRun);
    expect(ports.replay.saveReplayReport).toHaveBeenCalledWith(replayReport);
    expect(ports.replay.saveReplayDiffReport).toHaveBeenCalledWith(diffReport);
    expect({ manifest, replayRun, replayReport, diffReport }).toEqual(originalPayloads);
  });
});
