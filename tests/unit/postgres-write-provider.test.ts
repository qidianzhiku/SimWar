import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AuditLog } from "@simwar/shared-contracts";
import { describe, expect, it, vi } from "vitest";
import {
  createPostgresRepositoryAdapter,
  createPostgresSettlementWriteModelProvider,
  type PostgresQueryExecutor
} from "../../services/api/src/postgres-repository-adapter.js";
import { createSettlementWriteRepositoryFacade } from "../../services/api/src/repository-facade.js";
import type {
  CommitSettlementOutcomeCommand,
  SettlementOutcomeCommitResult,
  SettlementWriteRepositoryPorts
} from "../../services/api/src/repository-ports.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function createSettlementResult(
  overrides: Partial<CommitSettlementOutcomeCommand["settlement_result"]> = {}
): CommitSettlementOutcomeCommand["settlement_result"] {
  return {
    parameter_set_id: "parameter-set-1",
    replay_hash: "replay-hash-1",
    round_id: "round-1",
    round_no: 1,
    run_id: "run-1",
    scenario_package_id: "scenario-package-1",
    settlement_result_id: "settlement-1",
    team_results: [],
    tenant_id: "tenant-1",
    ...overrides
  };
}

function createAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    action: "round.settle_requested",
    actor_id: "usr_teacher",
    actor_role: "teacher",
    audit_id: "audit-1",
    created_at: "2026-06-25T00:00:00.000Z",
    request_id: "request-1",
    resource_id: "settlement-1",
    resource_type: "settlement_result",
    tenant_id: "tenant-1",
    ...overrides
  };
}

describe("Postgres settlement write provider surface assembly", () => {
  it("creates a provider-neutral write facade for settlement outcome and post-commit audit only", async () => {
    const calls: string[] = [];
    const committed: SettlementOutcomeCommitResult = {
      settlement_result: createSettlementResult(),
      status: "committed"
    };
    const ports: SettlementWriteRepositoryPorts = {
      auditLogs: {
        appendAuditLog: vi.fn(async () => {
          calls.push("auditLogs.appendAuditLog");
        })
      },
      settlementOutcome: {
        commitSettlementOutcome: vi.fn(async () => {
          calls.push("settlementOutcome.commitSettlementOutcome");
          return committed;
        })
      }
    };

    const facade = createSettlementWriteRepositoryFacade({ ports });
    const command: CommitSettlementOutcomeCommand = {
      round_id: "round-1",
      settlement_result: committed.settlement_result,
      tenant_id: "tenant-1"
    };
    const auditLog = createAuditLog();

    await expect(facade.commitSettlementOutcome(command)).resolves.toBe(committed);
    await expect(facade.auditLogs.appendAuditLog(auditLog)).resolves.toBeUndefined();

    expect(calls).toEqual([
      "settlementOutcome.commitSettlementOutcome",
      "auditLogs.appendAuditLog"
    ]);
    expect(ports.settlementOutcome.commitSettlementOutcome).toHaveBeenCalledWith(command);
    expect(ports.auditLogs.appendAuditLog).toHaveBeenCalledWith(auditLog);
    expect(Object.prototype.hasOwnProperty.call(facade, "settlements")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(facade, "rounds")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(facade, "stateSnapshots")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(facade, "domainEvents")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(facade, "connect")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(facade, "transaction")).toBe(false);
  });

  it("assembles Postgres write capabilities without running constructor SQL or audit/outcome fallback writes", async () => {
    const calls: { params: readonly unknown[] | undefined; sql: string }[] = [];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ params, sql });

      if (sql.includes("INSERT INTO settlement_results")) {
        return {
          rowCount: 1,
          rows: [
            {
              error_code: null,
              round_row_count: 1,
              settlement_row_count: 1
            }
          ]
        };
      }

      if (sql.includes("INSERT INTO audit_logs")) {
        return {
          rowCount: 1,
          rows: []
        };
      }

      throw new Error(`unexpected SQL: ${sql}`);
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });
    const provider = createPostgresSettlementWriteModelProvider({ adapter });
    const result = createSettlementResult();
    const command: CommitSettlementOutcomeCommand = {
      round_id: "round-1",
      settlement_result: result,
      tenant_id: "tenant-1"
    };
    const auditLog = createAuditLog();

    expect(provider.mode).toBe("postgres-settlement-write");
    expect(provider.ports.settlementOutcome.commitSettlementOutcome).toEqual(expect.any(Function));
    expect(provider.ports.auditLogs.appendAuditLog).toEqual(expect.any(Function));
    expect(calls).toEqual([]);

    await expect(provider.facade.commitSettlementOutcome(command)).resolves.toEqual({
      settlement_result: result,
      status: "committed"
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain("INSERT INTO settlement_results");
    expect(calls[0]?.sql).toContain("UPDATE simulation_rounds AS target");
    expect(calls[0]?.sql).not.toContain("INSERT INTO audit_logs");

    await provider.facade.auditLogs.appendAuditLog(auditLog);

    expect(calls).toHaveLength(2);
    expect(calls[1]?.sql).toContain("INSERT INTO audit_logs");
    expect(calls[1]?.sql).not.toContain("INSERT INTO settlement_results");
    expect(Object.prototype.hasOwnProperty.call(provider.facade, "settlements")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(provider.facade, "rounds")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(provider.facade, "stateSnapshots")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(provider.facade, "domainEvents")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(provider.facade, "begin")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(provider.facade, "commit")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(provider.facade, "rollback")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(provider.facade, "transaction")).toBe(false);
  });

  it("keeps Postgres write assembly unreachable from active API bootstrap and JSON default runtime", () => {
    const serverSource = readFileSync(
      resolve(__dirname, "../../services/api/src/server.ts"),
      "utf8"
    );

    expect(serverSource).toContain("createJsonRepositoryProvider({ store })");
    expect(serverSource).toContain("runtime.repositoryProvider.facade.commitSettlementOutcome(");
    expect(serverSource).toContain("appendAudit(runtime,");
    expect(serverSource).not.toContain("createPostgresSettlementWriteModelProvider");
    expect(serverSource).not.toContain("postgres-settlement-write");
    expect(serverSource).not.toContain("DATABASE_URL");
  });
});
