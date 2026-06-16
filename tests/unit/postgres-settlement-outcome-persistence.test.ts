import { describe, expect, it } from "vitest";
import type { SettlementResult } from "@simwar/shared-contracts";
import {
  createPostgresSettlementOutcomePersistencePort,
  type PostgresQueryExecutor
} from "../../services/api/src/postgres-repository-adapter.js";

const teamResults: SettlementResult["team_results"] = [
  {
    state_est: {
      explanation: "stable execution",
      next_round_risk: "balanced",
      recommended_focus: "maintain service quality"
    },
    state_obs: {
      demand_band: "high",
      profit_band: "healthy",
      rank: 1,
      revenue: 1200000,
      score: 88,
      served_demand: 95
    },
    state_true: {
      cash_flow: 280000,
      cost: 850000,
      demand: 100,
      market_share: 0.42,
      profit: 350000,
      rank: 1,
      revenue: 1200000,
      score: 88,
      served_demand: 95,
      settlement_status: "settled"
    },
    team_id: "team-1",
    team_name: "Team One"
  }
];

function createSettlementResult(overrides: Partial<SettlementResult> = {}): SettlementResult {
  return {
    parameter_set_id: "parameter-set-1",
    replay_hash: "replay-hash-1",
    round_id: "round-1",
    round_no: 1,
    run_id: "run-1",
    scenario_package_id: "scenario-package-1",
    settlement_result_id: "settlement-1",
    team_results: teamResults,
    tenant_id: "tenant-1",
    ...overrides
  };
}

function createRecordingExecutor(
  calls: Array<{ params?: readonly unknown[]; sql: string }>,
  rowCount = 1
): PostgresQueryExecutor {
  return async (sql, params) => {
    calls.push({ params, sql });

    return {
      rowCount,
      rows: []
    };
  };
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

function extractRoundSetClause(sql: string): string {
  const normalized = normalizeSql(sql);
  const match = /UPDATE simulation_rounds AS target SET (?<set>[\s\S]*?) FROM target_round/i.exec(
    normalized
  );

  expect(match?.groups?.set).toBeDefined();

  return match?.groups?.set ?? "";
}

describe("Postgres settlement outcome persistence port", () => {
  it("creates a standalone port without constructor SQL or aggregate wiring", () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const port = createPostgresSettlementOutcomePersistencePort({
      queryExecutor: createRecordingExecutor(calls)
    });

    expect(Object.keys(port)).toEqual(["commitSettlementOutcome"]);
    expect(port.commitSettlementOutcome).toEqual(expect.any(Function));
    expect(port).not.toHaveProperty("begin");
    expect(port).not.toHaveProperty("commit");
    expect(port).not.toHaveProperty("rollback");
    expect(port).not.toHaveProperty("transaction");
    expect(calls).toEqual([]);
  });

  it("rejects tenant identity mismatches before executing SQL", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const port = createPostgresSettlementOutcomePersistencePort({
      queryExecutor: createRecordingExecutor(calls)
    });

    await expect(
      port.commitSettlementOutcome({
        round_id: "round-1",
        settlement_result: createSettlementResult({ tenant_id: "tenant-2" }),
        tenant_id: "tenant-1"
      })
    ).rejects.toThrow("settlement_outcome_tenant_mismatch");

    expect(calls).toEqual([]);
  });

  it("rejects round identity mismatches before executing SQL", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const port = createPostgresSettlementOutcomePersistencePort({
      queryExecutor: createRecordingExecutor(calls)
    });

    await expect(
      port.commitSettlementOutcome({
        round_id: "round-2",
        settlement_result: createSettlementResult({ round_id: "round-1" }),
        tenant_id: "tenant-1"
      })
    ).rejects.toThrow("settlement_outcome_round_mismatch");

    expect(calls).toEqual([]);
  });

  it("commits a settlement outcome through one target-round-gated statement", async () => {
    const result = createSettlementResult({ replay_hash: "fixed-replay-hash" });
    const original = structuredClone(result);
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const port = createPostgresSettlementOutcomePersistencePort({
      queryExecutor: createRecordingExecutor(calls, 1)
    });

    await expect(
      port.commitSettlementOutcome({
        round_id: "round-1",
        settlement_result: result,
        tenant_id: "tenant-1"
      })
    ).resolves.toBeUndefined();

    expect(calls).toHaveLength(1);

    const call = calls[0];
    const sql = call?.sql ?? "";
    const normalized = normalizeSql(sql);
    const roundSet = extractRoundSetClause(sql);

    expect(normalized).toMatch(/^WITH target_round AS/i);
    expect(normalized).toContain("SELECT id FROM simulation_rounds");
    expect(normalized).toContain("WHERE tenant_id = $1 AND round_id = $2");
    expect(normalized).toContain("FOR UPDATE");
    expect(normalized).toContain("upserted_settlement AS");
    expect(normalized).toContain("INSERT INTO settlement_results");
    expect(normalized).toContain(
      "SELECT $4, $3, $1, $5, $2, $6, $7, $8, $9, $10::jsonb, $11::jsonb, now() FROM target_round"
    );
    expect(normalized).toContain("ON CONFLICT (tenant_id, settlement_result_id)");
    expect(normalized).toContain("DO UPDATE SET");
    expect(normalized).toContain("run_id = EXCLUDED.run_id");
    expect(normalized).toContain("round_id = EXCLUDED.round_id");
    expect(normalized).toContain("round_no = EXCLUDED.round_no");
    expect(normalized).toContain("parameter_set_id = EXCLUDED.parameter_set_id");
    expect(normalized).toContain("scenario_package_id = EXCLUDED.scenario_package_id");
    expect(normalized).toContain("replay_hash = EXCLUDED.replay_hash");
    expect(normalized).toContain("team_results = EXCLUDED.team_results");
    expect(normalized).toContain("payload = EXCLUDED.payload");
    expect(normalized).toContain("RETURNING replay_hash");
    expect(normalized).toContain("UPDATE simulation_rounds AS target");
    expect(roundSet).toContain("status = 'settled'");
    expect(roundSet).toContain("replay_hash = (SELECT replay_hash FROM upserted_settlement)");
    expect(roundSet).toContain("jsonb_set(");
    expect(roundSet).toContain("target.payload, '{status}'");
    expect(roundSet).toContain("'{replay_hash}'");
    expect(roundSet).toContain("to_jsonb((SELECT replay_hash FROM upserted_settlement))");
    expect(roundSet).toContain("updated_at = now()");
    expect(normalized).toContain("WHERE target.id = target_round.id");
    expect(normalized).not.toContain("BEGIN");
    expect(normalized).not.toContain("COMMIT");
    expect(normalized).not.toContain("ROLLBACK");
    expect(normalized).not.toContain(";");
    expect(normalized).not.toContain(" VALUES ");
    expect(normalized).not.toContain("INSERT INTO simulation_rounds");
    expect(normalized).not.toContain("ON CONFLICT (settlement_result_id)");
    expect(normalized).not.toContain("ON CONFLICT (round_id)");
    expect(normalized).not.toContain("COALESCE");
    expect(normalized).not.toContain("buildReplayHash");
    expect(normalized).not.toContain("decisions");
    expect(normalized).not.toContain("replay_records");
    expect(normalized).not.toContain("state_snapshots");
    expect(normalized).not.toContain("audit_logs");
    expect(normalized).not.toContain("domain_events");
    expect(roundSet).not.toContain("decision_batch_id =");
    expect(roundSet).not.toContain("run_id =");
    expect(roundSet).not.toContain("round_no =");
    expect(roundSet).not.toContain("tenant_id =");
    expect(roundSet).not.toContain("round_id =");
    expect(roundSet).not.toContain("id =");
    expect(roundSet).not.toContain("created_at =");
    expect(roundSet).not.toContain("metadata =");

    expect(call?.params).toEqual([
      "tenant-1",
      "round-1",
      "settlement-1",
      JSON.stringify(["settlement_result", "tenant-1", "settlement-1"]),
      "run-1",
      1,
      "parameter-set-1",
      "scenario-package-1",
      "fixed-replay-hash",
      JSON.stringify(result.team_results),
      JSON.stringify(result)
    ]);
    expect(JSON.parse(call?.params?.[9] as string)).toEqual(result.team_results);
    expect(JSON.parse(call?.params?.[10] as string)).toEqual(result);
    expect(result).toEqual(original);
  });

  it("rejects missing target Rounds after one zero-row statement", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const port = createPostgresSettlementOutcomePersistencePort({
      queryExecutor: createRecordingExecutor(calls, 0)
    });

    await expect(
      port.commitSettlementOutcome({
        round_id: "round-1",
        settlement_result: createSettlementResult(),
        tenant_id: "tenant-1"
      })
    ).rejects.toThrow("settlement_outcome_round_missing");

    expect(calls).toHaveLength(1);
    expect(normalizeSql(calls[0]?.sql ?? "")).toContain("FROM target_round");
  });

  it("rejects impossible multi-row updates as invariant violations", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const port = createPostgresSettlementOutcomePersistencePort({
      queryExecutor: createRecordingExecutor(calls, 2)
    });

    await expect(
      port.commitSettlementOutcome({
        round_id: "round-1",
        settlement_result: createSettlementResult(),
        tenant_id: "tenant-1"
      })
    ).rejects.toThrow("settlement_outcome_row_count_invariant");

    expect(calls).toHaveLength(1);
  });

  it("rethrows executor failures without compensation SQL", async () => {
    const persistenceError = new Error("forced postgres statement failure");
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ params, sql });
      throw persistenceError;
    };
    const port = createPostgresSettlementOutcomePersistencePort({ queryExecutor });

    await expect(
      port.commitSettlementOutcome({
        round_id: "round-1",
        settlement_result: createSettlementResult(),
        tenant_id: "tenant-1"
      })
    ).rejects.toBe(persistenceError);

    expect(calls).toHaveLength(1);
  });
});
