import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function readInitialMigration(): Promise<string> {
  return readFile("db/migrations/0001_initial_repository_schema.sql", "utf8");
}

function getStateSnapshotsTable(migrationSql: string): string {
  const match = migrationSql.match(
    /CREATE TABLE IF NOT EXISTS state_snapshots\s*\(([\s\S]*?)\);\s*CREATE INDEX IF NOT EXISTS state_snapshots_snapshot_id_idx/i
  );

  expect(match?.[1]).toBeDefined();
  return match?.[1] ?? "";
}

function getColumnLine(tableSql: string, columnName: string): string {
  const match = tableSql.match(new RegExp(`^\\s*${columnName}\\s+[^,]+,?\\s*$`, "im"));

  expect(match?.[0]).toBeDefined();
  return match?.[0] ?? "";
}

describe("Postgres state snapshot schema", () => {
  it("keeps row identity separate from appendable contract snapshot identity", async () => {
    const migrationSql = await readInitialMigration();
    const stateSnapshotsTable = getStateSnapshotsTable(migrationSql);

    expect(stateSnapshotsTable).toMatch(/\bid\s+text\s+PRIMARY\s+KEY\b/i);
    expect(stateSnapshotsTable).toMatch(/\bsnapshot_id\s+text\s+NOT\s+NULL\b/i);
    expect(stateSnapshotsTable).not.toMatch(/\bsnapshot_id\s+[^,\n]*\bUNIQUE\b/i);
    expect(stateSnapshotsTable).not.toMatch(/\bsnapshot_id\s+[^,\n]*\bPRIMARY\s+KEY\b/i);
    expect(stateSnapshotsTable).not.toMatch(/CHECK\s*\(\s*id\s*=\s*snapshot_id\s*\)/i);
    expect(stateSnapshotsTable).not.toMatch(/state_snapshots_id_matches_snapshot_id/i);
  });

  it("separates append order from nullable dynamic sequence", async () => {
    const stateSnapshotsTable = getStateSnapshotsTable(await readInitialMigration());
    const dynamicSequenceLine = getColumnLine(stateSnapshotsTable, "sequence");

    expect(stateSnapshotsTable).toMatch(
      /\bsnapshot_sequence\s+bigint\s+GENERATED\s+ALWAYS\s+AS\s+IDENTITY\b/i
    );
    expect(stateSnapshotsTable).toMatch(
      /CONSTRAINT\s+state_snapshots_snapshot_sequence_unique\s+UNIQUE\s*\(\s*snapshot_sequence\s*\)/i
    );
    expect(dynamicSequenceLine).toMatch(/\bsequence\s+bigint\b/i);
    expect(dynamicSequenceLine).not.toMatch(/\bNOT\s+NULL\b/i);
    expect(dynamicSequenceLine).not.toMatch(/\bDEFAULT\b/i);
    expect(dynamicSequenceLine).not.toMatch(/\bGENERATED\b/i);
    expect(dynamicSequenceLine).not.toMatch(/\bIDENTITY\b/i);
  });

  it("keeps non-unique snapshot lookup support without tenant or aggregate uniqueness", async () => {
    const migrationSql = await readInitialMigration();

    expect(migrationSql).toMatch(
      /CREATE INDEX IF NOT EXISTS state_snapshots_snapshot_id_idx\s+ON state_snapshots\s*\(\s*snapshot_id\s*\);/i
    );
    expect(migrationSql).not.toMatch(
      /CREATE\s+UNIQUE\s+INDEX[\s\S]*?ON\s+state_snapshots\s*\(\s*snapshot_id\s*\)/i
    );
    expect(migrationSql).not.toMatch(/UNIQUE\s*\(\s*tenant_id\s*,\s*snapshot_id\s*\)/i);
    expect(migrationSql).not.toMatch(
      /CREATE\s+UNIQUE\s+INDEX[\s\S]*?ON\s+state_snapshots\s*\(\s*tenant_id\s*,\s*snapshot_id\s*\)/i
    );
    expect(migrationSql).not.toMatch(
      /UNIQUE\s*\(\s*tenant_id\s*,\s*aggregate_type\s*,\s*aggregate_id\s*,\s*sequence\s*\)/i
    );
    expect(migrationSql).not.toMatch(
      /CREATE\s+UNIQUE\s+INDEX[\s\S]*?ON\s+state_snapshots\s*\(\s*tenant_id\s*,\s*aggregate_type\s*,\s*aggregate_id\s*,\s*sequence\s*\)/i
    );
  });

  it("keeps the fields needed for tenant-scoped snapshot eligibility and JSONB payloads", async () => {
    const stateSnapshotsTable = getStateSnapshotsTable(await readInitialMigration());

    for (const column of [
      "tenant_id",
      "aggregate_type",
      "aggregate_id",
      "sequence",
      "payload",
      "metadata",
      "captured_at",
      "created_at"
    ]) {
      expect(stateSnapshotsTable).toMatch(new RegExp(`\\b${column}\\b`, "i"));
    }

    expect(stateSnapshotsTable).toMatch(/\bpayload\s+jsonb\s+NOT\s+NULL\b/i);
    expect(stateSnapshotsTable).toMatch(/\bmetadata\s+jsonb\s+NOT\s+NULL\b/i);
  });
});
