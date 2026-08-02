import { describe, expect, it, vi } from "vitest";
import type { AuditLog, Round, SettlementResult } from "@simwar/shared-contracts";
import { createJsonSettlementOutcomePersistencePort } from "../../services/api/src/json-repository-adapter.js";
import type { SimWarStore } from "../../services/api/src/store.js";

function createMinimalStore(overrides: Partial<SimWarStore> = {}): SimWarStore {
  return {
    tenants: [],
    users: [],
    roles: [],
    permissions: [],
    userRoles: [],
    rolePermissions: [],
    sessions: [],
    scenarios: [],
    parameterSets: [],
    courses: [],
    teams: [],
    runs: [],
    rounds: [],
    decisions: [],
    settlementResults: [],
    auditLogs: [],
    counters: {},
    persist: vi.fn(),
    ...overrides
  } as SimWarStore;
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
    team_results: [
      {
        team_id: "team-1",
        team_name: "Team One",
        state_true: {
          market_share: 0.42,
          demand: 100,
          served_demand: 95,
          revenue: 1200000,
          cost: 850000,
          profit: 350000,
          cash_flow: 280000,
          score: 88,
          rank: 1,
          settlement_status: "settled"
        },
        state_obs: {
          demand_band: "high",
          served_demand: 95,
          revenue: 1200000,
          profit_band: "healthy",
          score: 88,
          rank: 1
        },
        state_est: {
          next_round_risk: "balanced",
          explanation: "stable execution",
          recommended_focus: "maintain service quality"
        }
      }
    ],
    ...overrides
  };
}

function hasOwnReplayHash(round: Round): boolean {
  return Object.prototype.hasOwnProperty.call(round, "replay_hash");
}

describe("JSON settlement outcome persistence port", () => {
  it("creates a standalone port without side effects", () => {
    const store = createMinimalStore();
    const port = createJsonSettlementOutcomePersistencePort(store);

    expect(Object.keys(port)).toEqual(["commitSettlementOutcome"]);
    expect(port.commitSettlementOutcome).toEqual(expect.any(Function));
    expect(port).not.toHaveProperty("begin");
    expect(port).not.toHaveProperty("commit");
    expect(port).not.toHaveProperty("rollback");
    expect(port).not.toHaveProperty("transaction");
    expect(store.persist).not.toHaveBeenCalled();
  });

  it("atomically appends a new SettlementResult and marks the Round settled", async () => {
    const round = createRound();
    const result = createSettlementResult({ replay_hash: "fixed-replay-hash" });
    const auditLog = { audit_id: "audit-1" } as AuditLog;
    const store = createMinimalStore({
      auditLogs: [auditLog],
      rounds: [round]
    });
    const port = createJsonSettlementOutcomePersistencePort(store);
    const resultBefore = structuredClone(result);

    await expect(
      port.commitSettlementOutcome({
        tenant_id: "tenant-1",
        round_id: "round-1",
        settlement_result: result
      })
    ).resolves.toEqual({
      settlement_result: result,
      status: "committed"
    });

    expect(store.settlementResults).toEqual([result]);
    expect(store.settlementResults[0]).toBe(result);
    expect(round.status).toBe("settled");
    expect(round.replay_hash).toBe("fixed-replay-hash");
    expect(round.decision_batch_id).toBe("decision-batch-1");
    expect(round).toMatchObject({
      round_id: "round-1",
      tenant_id: "tenant-1",
      run_id: "run-1",
      round_no: 1
    });
    expect(result).toEqual(resultBefore);
    expect(store.auditLogs).toEqual([auditLog]);
    expect(store.persist).toHaveBeenCalledTimes(1);
  });

  it("reports only committed for the current JSON provider success path", async () => {
    const round = createRound();
    const result = createSettlementResult();
    const auditLog = { audit_id: "audit-before" } as AuditLog;
    const store = createMinimalStore({
      auditLogs: [auditLog],
      rounds: [round]
    });
    const port = createJsonSettlementOutcomePersistencePort(store);

    const commit = await port.commitSettlementOutcome({
      tenant_id: "tenant-1",
      round_id: "round-1",
      settlement_result: result
    });

    expect(commit).toEqual({
      settlement_result: result,
      status: "committed"
    });
    expect(commit.status).not.toBe("reused");
    expect(commit.status).not.toBe("conflict");
    expect(commit.status).not.toBe("in_progress");
    expect(commit).not.toHaveProperty("reason");
    expect(store.settlementResults).toEqual([result]);
    expect(store.auditLogs).toEqual([auditLog]);
    expect(store.persist).toHaveBeenCalledTimes(1);
  });

  it("rejects tenant identity mismatches without side effects", async () => {
    const round = createRound();
    const result = createSettlementResult({ tenant_id: "tenant-2" });
    const store = createMinimalStore({ rounds: [round] });
    const port = createJsonSettlementOutcomePersistencePort(store);
    const roundBefore = structuredClone(round);
    const settlementsBefore = [...store.settlementResults];

    await expect(
      port.commitSettlementOutcome({
        tenant_id: "tenant-1",
        round_id: "round-1",
        settlement_result: result
      })
    ).rejects.toThrow("settlement_outcome_tenant_mismatch");

    expect(round).toEqual(roundBefore);
    expect(store.settlementResults).toEqual(settlementsBefore);
    expect(store.persist).not.toHaveBeenCalled();
  });

  it("rejects round identity mismatches without side effects", async () => {
    const round = createRound({ round_id: "round-2" });
    const result = createSettlementResult({ round_id: "round-1" });
    const store = createMinimalStore({ rounds: [round] });
    const port = createJsonSettlementOutcomePersistencePort(store);
    const roundBefore = structuredClone(round);

    await expect(
      port.commitSettlementOutcome({
        tenant_id: "tenant-1",
        round_id: "round-2",
        settlement_result: result
      })
    ).rejects.toThrow("settlement_outcome_round_mismatch");

    expect(round).toEqual(roundBefore);
    expect(store.settlementResults).toEqual([]);
    expect(store.persist).not.toHaveBeenCalled();
  });

  it("rejects run and round-number identity mismatches without side effects", async () => {
    const round = createRound({ run_id: "run-2", round_no: 2 });
    const result = createSettlementResult();
    const store = createMinimalStore({ rounds: [round] });
    const port = createJsonSettlementOutcomePersistencePort(store);
    const roundBefore = structuredClone(round);

    await expect(
      port.commitSettlementOutcome({
        tenant_id: "tenant-1",
        round_id: "round-1",
        settlement_result: result
      })
    ).rejects.toThrow("settlement_outcome_business_identity_mismatch");

    expect(round).toEqual(roundBefore);
    expect(store.settlementResults).toEqual([]);
    expect(store.persist).not.toHaveBeenCalled();
  });

  it("rejects missing target Rounds without saving a SettlementResult", async () => {
    const result = createSettlementResult();
    const store = createMinimalStore();
    const port = createJsonSettlementOutcomePersistencePort(store);

    await expect(
      port.commitSettlementOutcome({
        tenant_id: "tenant-1",
        round_id: "round-1",
        settlement_result: result
      })
    ).rejects.toThrow("settlement_outcome_round_missing");

    expect(store.rounds).toEqual([]);
    expect(store.settlementResults).toEqual([]);
    expect(store.persist).not.toHaveBeenCalled();
  });

  it("settles only the requested tenant Round when round IDs are shared", async () => {
    const tenantOneRound = createRound({
      tenant_id: "tenant-1",
      round_id: "round-shared",
      replay_hash: "tenant-1-before"
    });
    const tenantTwoRound = createRound({
      tenant_id: "tenant-2",
      round_id: "round-shared",
      replay_hash: "tenant-2-before",
      status: "open"
    });
    const result = createSettlementResult({
      round_id: "round-shared",
      replay_hash: "tenant-1-after"
    });
    const store = createMinimalStore({
      rounds: [tenantTwoRound, tenantOneRound]
    });
    const port = createJsonSettlementOutcomePersistencePort(store);

    await port.commitSettlementOutcome({
      tenant_id: "tenant-1",
      round_id: "round-shared",
      settlement_result: result
    });

    expect(tenantOneRound.status).toBe("settled");
    expect(tenantOneRound.replay_hash).toBe("tenant-1-after");
    expect(tenantTwoRound.status).toBe("open");
    expect(tenantTwoRound.replay_hash).toBe("tenant-2-before");
    expect(store.persist).toHaveBeenCalledTimes(1);
  });

  it("returns the existing result for a same-business-key replay retry", async () => {
    const unrelatedBefore = createSettlementResult({
      round_id: "round-before",
      round_no: 2,
      run_id: "run-before",
      settlement_result_id: "settlement-before",
      replay_hash: "before-hash"
    });
    const original = createSettlementResult({
      settlement_result_id: "settlement-replace",
      replay_hash: "old-hash",
      team_results: []
    });
    const unrelatedAfter = createSettlementResult({
      round_id: "round-after",
      round_no: 3,
      run_id: "run-after",
      settlement_result_id: "settlement-after",
      replay_hash: "after-hash"
    });
    const replacement = createSettlementResult({
      settlement_result_id: "settlement-retry",
      replay_hash: "old-hash",
      parameter_set_id: "parameter-set-replacement"
    });
    const round = createRound();
    const store = createMinimalStore({
      rounds: [round],
      settlementResults: [unrelatedBefore, original, unrelatedAfter]
    });
    const port = createJsonSettlementOutcomePersistencePort(store);

    await expect(
      port.commitSettlementOutcome({
        tenant_id: "tenant-1",
        round_id: "round-1",
        settlement_result: replacement
      })
    ).resolves.toEqual({
      settlement_result: original,
      status: "reused"
    });

    expect(store.settlementResults).toEqual([unrelatedBefore, original, unrelatedAfter]);
    expect(store.settlementResults[1]).toBe(original);
    expect(store.settlementResults).toHaveLength(3);
    expect(round.status).toBe("locked");
    expect(round.replay_hash).toBeUndefined();
    expect(store.persist).not.toHaveBeenCalled();
  });

  it("reuses the authoritative result when a recreated Round has the same business key", async () => {
    const recreatedRound = createRound({ round_id: "round-recreated" });
    const originalResult = createSettlementResult({
      round_id: "round-original",
      replay_hash: "same-business-hash",
      settlement_result_id: "settlement-original"
    });
    const retryForRecreatedRound = createSettlementResult({
      round_id: "round-recreated",
      replay_hash: "same-business-hash",
      settlement_result_id: "settlement-recreated"
    });
    const store = createMinimalStore({
      rounds: [recreatedRound],
      settlementResults: [originalResult]
    });
    const port = createJsonSettlementOutcomePersistencePort(store);
    const roundBefore = structuredClone(recreatedRound);

    await expect(
      port.commitSettlementOutcome({
        tenant_id: "tenant-1",
        round_id: "round-recreated",
        settlement_result: retryForRecreatedRound
      })
    ).resolves.toEqual({
      settlement_result: originalResult,
      status: "reused"
    });

    expect(store.settlementResults).toEqual([originalResult]);
    expect(recreatedRound).toEqual(roundBefore);
    expect(store.persist).not.toHaveBeenCalled();
  });

  it("does not replace another tenant SettlementResult with the same id", async () => {
    const otherTenantResult = createSettlementResult({
      tenant_id: "tenant-2",
      settlement_result_id: "settlement-shared",
      replay_hash: "other-tenant-hash"
    });
    const result = createSettlementResult({
      settlement_result_id: "settlement-shared",
      replay_hash: "tenant-1-hash"
    });
    const store = createMinimalStore({
      rounds: [createRound()],
      settlementResults: [otherTenantResult]
    });
    const port = createJsonSettlementOutcomePersistencePort(store);

    await port.commitSettlementOutcome({
      tenant_id: "tenant-1",
      round_id: "round-1",
      settlement_result: result
    });

    expect(store.settlementResults).toEqual([otherTenantResult, result]);
    expect(store.settlementResults[0]).toBe(otherTenantResult);
    expect(store.settlementResults[1]).toBe(result);
    expect(store.persist).toHaveBeenCalledTimes(1);
  });

  it("rolls back an appended SettlementResult and Round mutation when persist fails", async () => {
    const persistenceError = new Error("forced persist failure");
    const unrelated = createSettlementResult({
      round_id: "round-unrelated",
      round_no: 2,
      run_id: "run-unrelated",
      settlement_result_id: "settlement-unrelated",
      replay_hash: "unrelated-hash"
    });
    const round = createRound({
      replay_hash: "round-hash-before",
      status: "locked"
    });
    const store = createMinimalStore({
      auditLogs: [{ audit_id: "audit-before" } as AuditLog],
      rounds: [round],
      settlementResults: [unrelated],
      persist: vi.fn(() => {
        throw persistenceError;
      })
    });
    const port = createJsonSettlementOutcomePersistencePort(store);

    await expect(
      port.commitSettlementOutcome({
        tenant_id: "tenant-1",
        round_id: "round-1",
        settlement_result: createSettlementResult({
          settlement_result_id: "settlement-new",
          replay_hash: "round-hash-after"
        })
      })
    ).rejects.toBe(persistenceError);

    expect(round.status).toBe("locked");
    expect(round.replay_hash).toBe("round-hash-before");
    expect(store.settlementResults).toEqual([unrelated]);
    expect(store.settlementResults[0]).toBe(unrelated);
    expect(store.auditLogs).toEqual([{ audit_id: "audit-before" }]);
    expect(store.persist).toHaveBeenCalledTimes(1);
  });

  it("rolls back a new business-key SettlementResult while preserving other results", async () => {
    const persistenceError = new Error("forced new settlement persist failure");
    const unrelatedBefore = createSettlementResult({
      round_id: "round-before",
      round_no: 2,
      run_id: "run-before",
      settlement_result_id: "settlement-before"
    });
    const original = createSettlementResult({
      round_id: "round-existing",
      round_no: 3,
      run_id: "run-existing",
      settlement_result_id: "settlement-1",
      replay_hash: "old-result-hash"
    });
    const unrelatedAfter = createSettlementResult({
      round_id: "round-after",
      round_no: 4,
      run_id: "run-after",
      settlement_result_id: "settlement-after"
    });
    const round = createRound({
      replay_hash: "old-round-hash",
      status: "locked"
    });
    const store = createMinimalStore({
      rounds: [round],
      settlementResults: [unrelatedBefore, original, unrelatedAfter],
      persist: vi.fn(() => {
        throw persistenceError;
      })
    });
    const port = createJsonSettlementOutcomePersistencePort(store);

    await expect(
      port.commitSettlementOutcome({
        tenant_id: "tenant-1",
        round_id: "round-1",
        settlement_result: createSettlementResult({
          replay_hash: "new-result-hash",
          settlement_result_id: "settlement-new"
        })
      })
    ).rejects.toBe(persistenceError);

    expect(store.settlementResults).toEqual([unrelatedBefore, original, unrelatedAfter]);
    expect(store.settlementResults[1]).toBe(original);
    expect(round.status).toBe("locked");
    expect(round.replay_hash).toBe("old-round-hash");
    expect(store.persist).toHaveBeenCalledTimes(1);
  });

  it("restores an absent Round replay_hash property after persist failure", async () => {
    const persistenceError = new Error("forced absence rollback failure");
    const round = createRound();
    const store = createMinimalStore({
      rounds: [round],
      persist: vi.fn(() => {
        throw persistenceError;
      })
    });
    const port = createJsonSettlementOutcomePersistencePort(store);

    expect(hasOwnReplayHash(round)).toBe(false);

    await expect(
      port.commitSettlementOutcome({
        tenant_id: "tenant-1",
        round_id: "round-1",
        settlement_result: createSettlementResult({ replay_hash: "new-hash" })
      })
    ).rejects.toBe(persistenceError);

    expect(round.status).toBe("locked");
    expect(hasOwnReplayHash(round)).toBe(false);
    expect(store.settlementResults).toEqual([]);
  });

  it("restores an existing Round replay_hash value after persist failure", async () => {
    const persistenceError = new Error("forced existing hash rollback failure");
    const round = createRound({ replay_hash: "old-hash" });
    const store = createMinimalStore({
      rounds: [round],
      persist: vi.fn(() => {
        throw persistenceError;
      })
    });
    const port = createJsonSettlementOutcomePersistencePort(store);

    await expect(
      port.commitSettlementOutcome({
        tenant_id: "tenant-1",
        round_id: "round-1",
        settlement_result: createSettlementResult({ replay_hash: "new-hash" })
      })
    ).rejects.toBe(persistenceError);

    expect(round.status).toBe("locked");
    expect(round.replay_hash).toBe("old-hash");
    expect(hasOwnReplayHash(round)).toBe(true);
    expect(store.settlementResults).toEqual([]);
  });

  it("rejects a same-business-key result with a different replay hash without overwriting", async () => {
    const round = createRound();
    const first = createSettlementResult({
      replay_hash: "first-hash"
    });
    const second = createSettlementResult({
      settlement_result_id: "settlement-2",
      replay_hash: "second-hash",
      parameter_set_id: "parameter-set-second"
    });
    const store = createMinimalStore({ rounds: [round] });
    const port = createJsonSettlementOutcomePersistencePort(store);

    await port.commitSettlementOutcome({
      tenant_id: "tenant-1",
      round_id: "round-1",
      settlement_result: first
    });
    await expect(
      port.commitSettlementOutcome({
        tenant_id: "tenant-1",
        round_id: "round-1",
        settlement_result: second
      })
    ).resolves.toEqual({
      reason: "replay_hash_mismatch",
      settlement_result: first,
      status: "conflict"
    });

    expect(store.settlementResults).toEqual([first]);
    expect(store.settlementResults[0]).toBe(first);
    expect(round.status).toBe("settled");
    expect(round.replay_hash).toBe("first-hash");
    expect(store.persist).toHaveBeenCalledTimes(1);
  });

  it("rejects a tenant-scoped result id already assigned to another business key", async () => {
    const existing = createSettlementResult({
      round_id: "round-existing",
      round_no: 2,
      run_id: "run-existing",
      settlement_result_id: "settlement-shared"
    });
    const result = createSettlementResult({ settlement_result_id: "settlement-shared" });
    const store = createMinimalStore({
      rounds: [createRound()],
      settlementResults: [existing]
    });
    const port = createJsonSettlementOutcomePersistencePort(store);

    await expect(
      port.commitSettlementOutcome({
        tenant_id: "tenant-1",
        round_id: "round-1",
        settlement_result: result
      })
    ).rejects.toThrow("settlement_outcome_result_id_conflict");

    expect(store.settlementResults).toEqual([existing]);
    expect(store.persist).not.toHaveBeenCalled();
  });

  it("rejects an occupied result id before same-business replay reuse", async () => {
    const existingBusinessResult = createSettlementResult({
      replay_hash: "existing-business-hash",
      settlement_result_id: "settlement-existing-business"
    });
    const otherBusinessResult = createSettlementResult({
      round_id: "round-other",
      round_no: 2,
      run_id: "run-other",
      settlement_result_id: "settlement-occupied-id"
    });
    const reusedBusinessRequest = createSettlementResult({
      replay_hash: "existing-business-hash",
      settlement_result_id: "settlement-occupied-id"
    });
    const round = createRound();
    const store = createMinimalStore({
      rounds: [round],
      settlementResults: [existingBusinessResult, otherBusinessResult]
    });
    const port = createJsonSettlementOutcomePersistencePort(store);
    const roundBefore = structuredClone(round);

    await expect(
      port.commitSettlementOutcome({
        tenant_id: "tenant-1",
        round_id: "round-1",
        settlement_result: reusedBusinessRequest
      })
    ).rejects.toThrow("settlement_outcome_result_id_conflict");

    expect(store.settlementResults).toEqual([existingBusinessResult, otherBusinessResult]);
    expect(round).toEqual(roundBefore);
    expect(store.persist).not.toHaveBeenCalled();
  });
});
