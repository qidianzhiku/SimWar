import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function readInitialMigration(): Promise<string> {
  return readFile("db/migrations/0001_initial_repository_schema.sql", "utf8");
}

function getAuditLogsTable(migrationSql: string): string {
  const match = migrationSql.match(
    /CREATE TABLE IF NOT EXISTS audit_logs\s*\(([\s\S]*?)\);\s*CREATE INDEX IF NOT EXISTS audit_logs_audit_id_idx/i
  );

  expect(match?.[1]).toBeDefined();
  return match?.[1] ?? "";
}

describe("Postgres audit log schema", () => {
  it("keeps audit log row identity separate from appendable contract audit identity", async () => {
    const migrationSql = await readInitialMigration();
    const auditLogsTable = getAuditLogsTable(migrationSql);

    expect(auditLogsTable).toMatch(/\bid\s+text\s+PRIMARY\s+KEY\b/i);
    expect(auditLogsTable).toMatch(/\baudit_id\s+text\s+NOT\s+NULL\b/i);
    expect(auditLogsTable).not.toMatch(/\baudit_id\s+[^,\n]*\bUNIQUE\b/i);
    expect(auditLogsTable).not.toMatch(/\baudit_id\s+[^,\n]*\bPRIMARY\s+KEY\b/i);
    expect(auditLogsTable).not.toMatch(/CHECK\s*\(\s*id\s*=\s*audit_id\s*\)/i);
  });

  it("preserves append ordering and non-unique audit id lookup support", async () => {
    const migrationSql = await readInitialMigration();
    const auditLogsTable = getAuditLogsTable(migrationSql);

    expect(auditLogsTable).toMatch(
      /\baudit_sequence\s+bigint\s+GENERATED\s+ALWAYS\s+AS\s+IDENTITY\b/i
    );
    expect(migrationSql).toMatch(
      /CREATE INDEX IF NOT EXISTS audit_logs_audit_id_idx\s+ON audit_logs\s*\(\s*audit_id\s*\);/i
    );
    expect(migrationSql).not.toMatch(
      /CREATE\s+UNIQUE\s+INDEX[\s\S]*?ON\s+audit_logs\s*\(\s*audit_id\s*\)/i
    );
    expect(migrationSql).not.toMatch(/UNIQUE\s*\(\s*tenant_id\s*,\s*audit_id\s*\)/i);
    expect(migrationSql).not.toMatch(
      /CREATE\s+UNIQUE\s+INDEX[\s\S]*?ON\s+audit_logs\s*\(\s*tenant_id\s*,\s*audit_id\s*\)/i
    );
  });

  it("keeps the audit log fields needed for tenant-scoped append and filtering", async () => {
    const auditLogsTable = getAuditLogsTable(await readInitialMigration());

    for (const column of [
      "tenant_id",
      "actor_id",
      "action",
      "resource_id",
      "payload",
      "created_at"
    ]) {
      expect(auditLogsTable).toMatch(new RegExp(`\\b${column}\\b`, "i"));
    }
  });
});
