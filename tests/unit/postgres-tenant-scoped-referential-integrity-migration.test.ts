import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

describe("W015 tenant-scoped referential integrity migration", () => {
  it("is one forward-only fail-closed migration without destructive actions", async () => {
    const name = "0005_tenant_scoped_referential_integrity.sql";
    const sql = await readFile(`db/migrations/${name}`, "utf8");
    const normalized = normalizeSql(sql);

    expect(name.localeCompare("0004_add_settlement_fingerprint.sql")).toBeGreaterThan(0);
    expect(normalized).toContain("LOCK TABLE courses");
    expect(normalized).toContain("w015_preflight_orphan_run_course");
    expect(normalized).toContain("w015_preflight_partial_replay_run_round");
    expect(normalized).toContain("w015_preflight_duplicate_settlement_business_key");
    expect(normalized).toContain("simulation_runs_tenant_run_key");
    expect(normalized).toContain("simulation_rounds_tenant_run_round_key");
    expect(normalized).toContain("settlement_results_tenant_run_round_result_key");
    expect(normalized).toContain("simulation_runs_course_fk");
    expect(normalized).toContain("simulation_rounds_run_fk");
    expect(normalized).toContain("decisions_run_fk");
    expect(normalized).toContain("decisions_round_run_fk");
    expect(normalized).toContain("settlement_results_run_fk");
    expect(normalized).toContain("settlement_results_round_run_fk");
    expect(normalized).toContain("replay_records_run_fk");
    expect(normalized).toContain("replay_records_round_run_fk");
    expect(normalized).toContain("replay_records_source_settlement_fk");
    expect(normalized).toContain("ON DELETE NO ACTION");
    expect(normalized).toContain("ON UPDATE NO ACTION");
    expect(normalized).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(normalized).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(normalized).not.toMatch(/\bDROP\b/i);
    expect(normalized).not.toMatch(/\bCASCADE\b/i);
    expect(normalized).not.toMatch(/\bCREATE\s+POLICY\b/i);
    expect(normalized).not.toMatch(/\bENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i);
  });
});
