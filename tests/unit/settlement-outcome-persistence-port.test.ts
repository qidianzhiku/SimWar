import type { SettlementResult } from "@simwar/shared-contracts";
import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  CommitSettlementOutcomeCommand,
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

  it("defines a standalone domain-specific async persistence port", async () => {
    expectTypeOf<SettlementOutcomePersistencePort>().toEqualTypeOf<{
      commitSettlementOutcome(command: CommitSettlementOutcomeCommand): Promise<void>;
    }>();

    const received: CommitSettlementOutcomeCommand[] = [];
    const port: SettlementOutcomePersistencePort = {
      async commitSettlementOutcome(command) {
        received.push(command);
      }
    };
    const command: CommitSettlementOutcomeCommand = {
      round_id: "round-1",
      settlement_result: createSettlementResult(),
      tenant_id: "tenant-1"
    };

    await expect(port.commitSettlementOutcome(command)).resolves.toBeUndefined();

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
});
