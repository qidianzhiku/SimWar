import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface MigrationFile {
  name: string;
  sql: string;
}

async function readMigrationFiles(): Promise<MigrationFile[]> {
  const names = (await readdir("db/migrations"))
    .filter((name) => /^\d+_[\w-]+\.sql$/.test(name))
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(
    names.map(async (name) => ({
      name,
      sql: await readFile(join("db/migrations", name), "utf8")
    }))
  );
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

describe("settlement business identity migration", () => {
  it("adds one forward migration with a stable business identity constraint", async () => {
    const migrations = await readMigrationFiles();
    const settlementBusinessMigrations = migrations.filter((migration) =>
      migration.sql.includes("settlement_results_business_identity_key")
    );

    expect(settlementBusinessMigrations).toHaveLength(1);

    const migration = settlementBusinessMigrations[0]!;
    expect(migration.name).toMatch(/^\d+_add_settlement_business_identity_constraint\.sql$/);
    expect(migration.name.localeCompare("0001_initial_repository_schema.sql")).toBeGreaterThan(0);

    const normalized = normalizeSql(migration.sql);
    expect(normalized).toContain("settlement_results_business_identity_key");
    expect(normalized).toContain("UNIQUE (tenant_id, run_id, round_no)");
    expect(normalized).toContain("HAVING COUNT(*) > 1");
    expect(normalized).toContain("settlement_results_business_identity_duplicate");
    expect(normalized).not.toMatch(/\bDELETE\b/i);
    expect(normalized).not.toMatch(/\bUPDATE\b/i);
    expect(normalized).not.toMatch(/\bCREATE\s+TRIGGER\b/i);
    expect(normalized).not.toMatch(/\bCONCURRENTLY\b/i);
  });
});
