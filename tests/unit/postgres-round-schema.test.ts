import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function readInitialMigration(): Promise<string> {
  return readFile("db/migrations/0001_initial_repository_schema.sql", "utf8");
}

function getSimulationRoundsTable(migrationSql: string): string {
  const match = migrationSql.match(
    /CREATE TABLE IF NOT EXISTS simulation_rounds\s*\(([\s\S]*?)\);\s*CREATE INDEX IF NOT EXISTS simulation_rounds_tenant_id_idx/i
  );

  expect(match?.[1]).toBeDefined();
  return match?.[1] ?? "";
}

describe("Postgres round schema", () => {
  it("keeps internal row identity separate from tenant-scoped contract round identity", async () => {
    const simulationRoundsTable = getSimulationRoundsTable(await readInitialMigration());

    expect(simulationRoundsTable).toMatch(/\bid\s+text\s+PRIMARY\s+KEY\b/i);
    expect(simulationRoundsTable).toMatch(/\bround_id\s+text\s+NOT\s+NULL\b/i);
    expect(simulationRoundsTable).not.toMatch(/\bround_id\s+[^,\n]*\bUNIQUE\b/i);
    expect(simulationRoundsTable).not.toMatch(/\bround_id\s+[^,\n]*\bPRIMARY\s+KEY\b/i);
    expect(simulationRoundsTable).not.toMatch(/CHECK\s*\(\s*id\s*=\s*round_id\s*\)/i);
    expect(simulationRoundsTable).not.toMatch(/simulation_rounds_id_matches_round_id/i);
  });

  it("uses tenant and round id as the only round contract uniqueness target", async () => {
    const migrationSql = await readInitialMigration();
    const simulationRoundsTable = getSimulationRoundsTable(migrationSql);

    expect(simulationRoundsTable).toMatch(
      /CONSTRAINT\s+simulation_rounds_tenant_round_id_unique\s+UNIQUE\s*\(\s*tenant_id\s*,\s*round_id\s*\)/i
    );
    expect(simulationRoundsTable).not.toMatch(/UNIQUE\s*\(\s*round_id\s*\)/i);
    expect(migrationSql).not.toMatch(
      /CREATE\s+UNIQUE\s+INDEX[\s\S]*?ON\s+simulation_rounds\s*\(\s*round_id\s*\)/i
    );
    expect(migrationSql).not.toMatch(/UNIQUE\s*\(\s*tenant_id\s*,\s*run_id\s*,\s*round_no\s*\)/i);
    expect(migrationSql).not.toMatch(/UNIQUE\s*\(\s*run_id\s*,\s*round_no\s*\)/i);
    expect(migrationSql).not.toMatch(/UNIQUE\s*\(\s*tenant_id\s*,\s*round_no\s*\)/i);
  });

  it("does not add append sequencing or settlement result storage to rounds", async () => {
    const simulationRoundsTable = getSimulationRoundsTable(await readInitialMigration());

    expect(simulationRoundsTable).not.toMatch(/\bround_sequence\b/i);
    expect(simulationRoundsTable).not.toMatch(/\bappend_sequence\b/i);
    expect(simulationRoundsTable).not.toMatch(/\bsettlement_result_id\b/i);
  });

  it("keeps round fields and JSONB payload boundaries needed for future write mapping", async () => {
    const simulationRoundsTable = getSimulationRoundsTable(await readInitialMigration());

    for (const column of [
      "tenant_id",
      "run_id",
      "round_no",
      "status",
      "decision_batch_id",
      "replay_hash",
      "payload",
      "metadata",
      "created_at",
      "updated_at"
    ]) {
      expect(simulationRoundsTable).toMatch(new RegExp(`\\b${column}\\b`, "i"));
    }

    expect(simulationRoundsTable).toMatch(/\bpayload\s+jsonb\s+NOT\s+NULL\b/i);
    expect(simulationRoundsTable).toMatch(/\bmetadata\s+jsonb\s+NOT\s+NULL\b/i);
  });
});
