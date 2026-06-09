import { describe, expect, it } from "vitest";
import {
  createPostgresRepositoryAdapter,
  PostgresRepositoryAdapter,
  type PostgresQueryExecutor,
  type PostgresQueryResult
} from "../../services/api/src/postgres-repository-adapter.js";

describe("Postgres repository adapter skeleton", () => {
  it("keeps the query executor boundary callable with SQL and params only", async () => {
    interface ProbeRow extends Record<string, unknown> {
      firstParam: unknown;
      sql: string;
    }

    const queryExecutor: PostgresQueryExecutor = async (
      sql,
      params
    ): Promise<PostgresQueryResult<ProbeRow>> => ({
      rowCount: 1,
      rows: [
        {
          firstParam: params?.[0],
          sql
        }
      ]
    });

    await expect(
      queryExecutor<ProbeRow>("select $1::text as tenant_id", ["tenant-1"])
    ).resolves.toEqual({
      rowCount: 1,
      rows: [
        {
          firstParam: "tenant-1",
          sql: "select $1::text as tenant_id"
        }
      ]
    });
  });

  it("constructs without running database queries or repository port behavior", () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 0,
        rows: []
      };
    };

    const adapter = createPostgresRepositoryAdapter({
      applicationName: "unit-test",
      queryExecutor,
      schema: "public"
    });

    expect(adapter).toBeInstanceOf(PostgresRepositoryAdapter);
    expect(adapter.queryExecutor).toBe(queryExecutor);
    expect(adapter.options).toEqual({
      applicationName: "unit-test",
      queryExecutor,
      schema: "public"
    });
    expect(calls).toEqual([]);
  });

  it("does not require DATABASE_URL to construct the skeleton", () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      const queryExecutor: PostgresQueryExecutor = async () => ({
        rowCount: 0,
        rows: []
      });

      const adapter = createPostgresRepositoryAdapter({ queryExecutor });

      expect(adapter).toBeInstanceOf(PostgresRepositoryAdapter);
      expect(process.env.DATABASE_URL).toBeUndefined();
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
    }
  });

  it("does not expose repository port namespaces before implementation", () => {
    const queryExecutor: PostgresQueryExecutor = async () => ({
      rowCount: 0,
      rows: []
    });

    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    expect(Object.keys(adapter).sort()).toEqual(["options", "queryExecutor"]);
    expect("identity" in adapter).toBe(false);
    expect("courses" in adapter).toBe(false);
    expect("decisions" in adapter).toBe(false);
    expect("settlements" in adapter).toBe(false);
    expect("replay" in adapter).toBe(false);
  });
});
