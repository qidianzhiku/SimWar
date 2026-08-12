import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("W024 durable restart and settlement boundary", () => {
  it("uses a transaction executor for the active Postgres provider", async () => {
    const provider = await readFile(resolve("services/api/src/repository-provider.ts"), "utf8");
    const runtime = await readFile(resolve("services/api/src/postgres-runtime.ts"), "utf8");
    expect(provider).toContain("transactionExecutor");
    expect(provider).toContain('mode: "postgres"');
    expect(runtime).toContain('await client.query("BEGIN")');
    expect(runtime).toContain('await client.query("COMMIT")');
    expect(runtime).toContain('await client.query("ROLLBACK")');
  });

  it("keeps exact retry and conflicting retry on the tenant/run/round business key", async () => {
    const adapter = await readFile(
      resolve("services/api/src/postgres-repository-adapter.ts"),
      "utf8"
    );
    expect(adapter).toContain("pg_advisory_xact_lock(hashtextextended($1, 0))");
    expect(adapter).toContain("WHERE tenant_id = $1 AND run_id = $2 AND round_no = $3");
    expect(adapter).toContain('status: "reused"');
    expect(adapter).toContain('status: "conflict"');
    expect(adapter).toContain("replay_hash_mismatch");
  });
});
