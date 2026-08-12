import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("W024 Postgres runtime activation boundary", () => {
  it("requires explicit Postgres mode and does not silently construct a JSON provider", async () => {
    const source = await readFile(resolve("services/api/src/server.ts"), "utf8");
    expect(source).toContain('resolveRepositoryMode() === "postgres"');
    expect(source).toContain("postgres_runtime_provider_required");
  });

  it("keeps the W024 migration in the forward-only runtime migration list", async () => {
    const source = await readFile(resolve("services/api/src/postgres-runtime.ts"), "utf8");
    const migration = await readFile(
      resolve("db/migrations/0006_w024_bounded_course_run_runtime.sql"),
      "utf8"
    );
    expect(source).toContain('"0006_w024_bounded_course_run_runtime.sql"');
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS w024_runtime_records");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS w024_role_workflow_records");
    expect(migration).toContain("ON DELETE NO ACTION");
    expect(migration).not.toMatch(/ON DELETE CASCADE/i);
    expect(migration).not.toMatch(/CREATE POLICY/i);
  });
});
