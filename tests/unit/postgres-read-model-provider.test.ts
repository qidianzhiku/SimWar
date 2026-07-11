import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as postgresAdapterModule from "../../services/api/src/postgres-repository-adapter.js";
import {
  createPostgresRepositoryAdapter,
  createPostgresSettlementReadModelProvider,
  POSTGRES_SETTLEMENT_READ_MODEL_CAPABILITY_GAPS,
  type PostgresQueryExecutor
} from "../../services/api/src/postgres-repository-adapter.js";
import { createSettlementReadRepositoryFacade } from "../../services/api/src/repository-facade.js";
import type { SettlementReadRepositoryPorts } from "../../services/api/src/repository-ports.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Postgres settlement read-model provider assembly", () => {
  it("declares tenant-scoped scenario candidate listing as an explicit Postgres capability gap", () => {
    expect(postgresAdapterModule.POSTGRES_SCENARIO_CANDIDATE_READ_CAPABILITY_GAPS).toEqual([
      "scenarios.listScenarioPackagesForTenant"
    ]);
  });

  it("creates a provider-neutral settlement read facade without write-side methods", async () => {
    const calls: string[] = [];
    const ports: SettlementReadRepositoryPorts = {
      decisions: {
        listDecisionsForRound: async () => {
          calls.push("decisions.listDecisionsForRound");
          return [];
        }
      },
      parameterSets: {
        getParameterSet: async () => {
          calls.push("parameterSets.getParameterSet");
          return null;
        }
      },
      rounds: {
        listRoundsForRun: async () => {
          calls.push("rounds.listRoundsForRun");
          return [];
        }
      },
      runs: {
        getRun: async () => {
          calls.push("runs.getRun");
          return null;
        }
      },
      scenarios: {
        getScenarioPackage: async () => {
          calls.push("scenarios.getScenarioPackage");
          return null;
        }
      },
      settlements: {
        listSettlementResultsForRound: async () => {
          calls.push("settlements.listSettlementResultsForRound");
          return [];
        }
      },
      teams: {
        listTeamsForRun: async () => {
          calls.push("teams.listTeamsForRun");
          return [];
        }
      }
    };

    const facade = createSettlementReadRepositoryFacade({ ports });

    await facade.runs.getRun("tenant-1", "run-1");
    await facade.rounds.listRoundsForRun("tenant-1", "run-1");
    await facade.scenarios.getScenarioPackage("tenant-1", "scenario-1");
    await facade.parameterSets.getParameterSet("tenant-1", "parameter-set-1");
    await facade.teams.listTeamsForRun("tenant-1", "run-1");
    await facade.decisions.listDecisionsForRound("tenant-1", "run-1", "round-1");
    await facade.settlements.listSettlementResultsForRound("tenant-1", "run-1", "round-1");

    expect(calls).toEqual([
      "runs.getRun",
      "rounds.listRoundsForRun",
      "scenarios.getScenarioPackage",
      "parameterSets.getParameterSet",
      "teams.listTeamsForRun",
      "decisions.listDecisionsForRound",
      "settlements.listSettlementResultsForRound"
    ]);
    expect(Object.prototype.hasOwnProperty.call(facade.rounds, "saveRound")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(facade.decisions, "saveDecision")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(facade.settlements, "saveSettlementResult")).toBe(
      false
    );
    expect(Object.prototype.hasOwnProperty.call(facade, "commitSettlementOutcome")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(facade, "auditLogs")).toBe(false);
  });

  it("assembles only native Postgres active settlement read namespaces and keeps gaps explicit", async () => {
    const queries: { params: readonly unknown[] | undefined; sql: string }[] = [];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      queries.push({ params, sql });

      return {
        rowCount: 0,
        rows: []
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });
    const provider = createPostgresSettlementReadModelProvider({ adapter });

    expect(provider.mode).toBe("postgres-read-model");
    expect(provider.capabilityGaps).toEqual(POSTGRES_SETTLEMENT_READ_MODEL_CAPABILITY_GAPS);
    expect(provider.capabilityGaps).toEqual([
      "teams.listTeamsForRun",
      "scenarios.getScenarioPackage",
      "parameterSets.getParameterSet"
    ]);

    await provider.facade.runs.getRun("tenant-1", "run-1");
    await provider.facade.rounds.listRoundsForRun("tenant-1", "run-1");
    await provider.facade.decisions.listDecisionsForRound("tenant-1", "run-1", "round-1");
    await provider.facade.settlements.listSettlementResultsForRound("tenant-1", "run-1", "round-1");

    expect(queries.map((query) => query.params)).toEqual([
      ["tenant-1", "run-1"],
      ["tenant-1", "run-1"],
      ["tenant-1", "run-1", "round-1"],
      ["tenant-1", "run-1", "round-1"]
    ]);
    expect(provider.facade).not.toHaveProperty("teams");
    expect(provider.facade).not.toHaveProperty("scenarios");
    expect(provider.facade).not.toHaveProperty("parameterSets");
    expect(Object.prototype.hasOwnProperty.call(provider.facade.rounds, "saveRound")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(provider.facade.decisions, "saveDecision")).toBe(
      false
    );
    expect(
      Object.prototype.hasOwnProperty.call(provider.facade.settlements, "saveSettlementResult")
    ).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(provider.facade, "commitSettlementOutcome")).toBe(
      false
    );
  });

  it("does not make Postgres read-model assembly reachable from the active API bootstrap", () => {
    const serverSource = readFileSync(
      resolve(__dirname, "../../services/api/src/server.ts"),
      "utf8"
    );

    expect(serverSource).toContain("createJsonRepositoryProvider({ store })");
    expect(serverSource).not.toContain("createPostgresSettlementReadModelProvider");
    expect(serverSource).not.toContain("DATABASE_URL");
  });
});
