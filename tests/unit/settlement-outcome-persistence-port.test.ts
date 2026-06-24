import type { SettlementResult } from "@simwar/shared-contracts";
import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  CommitSettlementOutcomeCommand,
  SettlementOutcomeCommitResult,
  SettlementOutcomePersistencePort
} from "../../services/api/src/repository-ports.js";

function createSettlementResult(overrides: Partial<SettlementResult> = {}): SettlementResult {
  return {
    parameter_set_id: "parameter-set-1",
    replay_hash: "replay-hash-1",
    round_id: "round-1",
    round_no: 1,
    run_id: "run-1",
    scenario_package_id: "scenario-1",
    settlement_result_id: "settlement-1",
    team_results: [],
    tenant_id: "tenant-1",
    ...overrides
  };
}

describe("settlement outcome persistence port contract", () => {
  it("exports a domain command with explicit tenant, round, and SettlementResult fields", () => {
    expectTypeOf<CommitSettlementOutcomeCommand>().toEqualTypeOf<{
      tenant_id: string;
      round_id: string;
      settlement_result: SettlementResult;
    }>();

    const settlement = createSettlementResult();
    const command: CommitSettlementOutcomeCommand = {
      round_id: settlement.round_id,
      settlement_result: settlement,
      tenant_id: settlement.tenant_id
    };

    expect(command).toEqual({
      round_id: "round-1",
      settlement_result: settlement,
      tenant_id: "tenant-1"
    });
  });

  it("keeps the persisted settlement result typed as the shared SettlementResult contract", () => {
    expectTypeOf<
      CommitSettlementOutcomeCommand["settlement_result"]
    >().toEqualTypeOf<SettlementResult>();
  });

  it("atomic settlement outcome contract requires tenant and round identity consistency", () => {
    // TypeScript can guarantee that both identity fields use the formal
    // contract types, but runtime implementations must enforce value equality
    // and reject mismatches without side effects.
    expectTypeOf<CommitSettlementOutcomeCommand["tenant_id"]>().toEqualTypeOf<
      SettlementResult["tenant_id"]
    >();
    expectTypeOf<CommitSettlementOutcomeCommand["round_id"]>().toEqualTypeOf<
      SettlementResult["round_id"]
    >();
  });

  it("defines a standalone domain-specific async persistence port", async () => {
    expectTypeOf<SettlementOutcomeCommitResult>().toEqualTypeOf<
      | { settlement_result: SettlementResult; status: "committed" }
      | { settlement_result: SettlementResult; status: "reused" }
      | {
          reason: "replay_hash_mismatch";
          settlement_result: SettlementResult;
          status: "conflict";
        }
    >();

    expectTypeOf<SettlementOutcomePersistencePort>().toEqualTypeOf<{
      commitSettlementOutcome(
        command: CommitSettlementOutcomeCommand
      ): Promise<SettlementOutcomeCommitResult>;
    }>();

    const received: CommitSettlementOutcomeCommand[] = [];
    const port: SettlementOutcomePersistencePort = {
      async commitSettlementOutcome(command) {
        received.push(command);

        return {
          settlement_result: command.settlement_result,
          status: "committed"
        };
      }
    };
    const command: CommitSettlementOutcomeCommand = {
      round_id: "round-1",
      settlement_result: createSettlementResult(),
      tenant_id: "tenant-1"
    };

    await expect(port.commitSettlementOutcome(command)).resolves.toEqual({
      settlement_result: command.settlement_result,
      status: "committed"
    });

    expect(received).toEqual([command]);
    expect(Object.keys(port)).toEqual(["commitSettlementOutcome"]);
    expect(port).not.toHaveProperty("begin");
    expect(port).not.toHaveProperty("commit");
    expect(port).not.toHaveProperty("rollback");
    expect(port).not.toHaveProperty("transaction");
    expect(port).not.toHaveProperty("query");
    expect(port).not.toHaveProperty("execute");
    expect(port).not.toHaveProperty("client");
    expect(port).not.toHaveProperty("pool");
  });

  it("characterizes the current commit result discriminants without in-progress semantics", () => {
    const settlement = createSettlementResult();
    const committed: SettlementOutcomeCommitResult = {
      settlement_result: settlement,
      status: "committed"
    };
    const reused: SettlementOutcomeCommitResult = {
      settlement_result: settlement,
      status: "reused"
    };
    const conflict: SettlementOutcomeCommitResult = {
      reason: "replay_hash_mismatch",
      settlement_result: settlement,
      status: "conflict"
    };

    const variants = [committed, reused, conflict];

    expect(variants.map((variant) => variant.status)).toEqual([
      "committed",
      "reused",
      "conflict"
    ]);
    expect(conflict.reason).toBe("replay_hash_mismatch");
    expect(variants).not.toContainEqual(
      expect.objectContaining({ status: "in_progress" })
    );
  });
});
