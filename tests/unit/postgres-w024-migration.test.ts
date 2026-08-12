import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../db/migrations/0006_w024_bounded_course_run_runtime.sql", import.meta.url),
  "utf8"
);

describe("W024 forward-only migration", () => {
  it("creates bounded runtime records and migration marker", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS w024_runtime_records");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS w024_schema_migrations");
    expect(migration).toContain("FOREIGN KEY (tenant_id, run_id)");
    expect(migration).not.toMatch(/ON DELETE CASCADE|CREATE POLICY/i);
  });

  it("keeps the prior migration files outside the mutation", () => {
    expect(migration).not.toMatch(
      /ALTER TABLE (courses|simulation_runs|simulation_rounds)\s+DROP/i
    );
  });
});
