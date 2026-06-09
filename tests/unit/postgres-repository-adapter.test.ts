import { describe, expect, it } from "vitest";
import {
  createPostgresRepositoryAdapter,
  PostgresRepositoryAdapter,
  type PostgresQueryExecutor,
  type PostgresQueryResult
} from "../../services/api/src/postgres-repository-adapter.js";

describe("Postgres repository adapter skeleton", () => {
  interface CourseRow extends Record<string, unknown> {
    course_id: string;
    tenant_id: string;
  }

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

  it("queryRows delegates to the injected executor and returns rows", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const rows: CourseRow[] = [
      {
        course_id: "course-1",
        tenant_id: "tenant-1"
      },
      {
        course_id: "course-2",
        tenant_id: "tenant-1"
      }
    ];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: rows.length,
        rows
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(
      adapter.queryRows<CourseRow>("select * from courses where tenant_id = $1", ["tenant-1"])
    ).resolves.toEqual(rows);
    expect(calls).toEqual([
      {
        params: ["tenant-1"],
        sql: "select * from courses where tenant_id = $1"
      }
    ]);
  });

  it("queryOne returns the first row when rows are present", async () => {
    const rows: CourseRow[] = [
      {
        course_id: "course-1",
        tenant_id: "tenant-1"
      },
      {
        course_id: "course-2",
        tenant_id: "tenant-1"
      }
    ];
    const queryExecutor: PostgresQueryExecutor = async () => ({
      rowCount: rows.length,
      rows
    });
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.queryOne<CourseRow>("select * from courses")).resolves.toEqual(rows[0]);
  });

  it("queryOne returns null when no rows are present", async () => {
    const queryExecutor: PostgresQueryExecutor = async () => ({
      rowCount: 0,
      rows: []
    });
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.queryOne<CourseRow>("select * from courses")).resolves.toBeNull();
  });

  it("execute delegates to the injected executor and returns rowCount", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 2,
        rows: []
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(
      adapter.execute("update courses set status = $1 where tenant_id = $2", [
        "archived",
        "tenant-1"
      ])
    ).resolves.toEqual({
      rowCount: 2
    });
    expect(calls).toEqual([
      {
        params: ["archived", "tenant-1"],
        sql: "update courses set status = $1 where tenant_id = $2"
      }
    ]);
  });

  it("query helpers do not require DATABASE_URL", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      const queryExecutor: PostgresQueryExecutor = async () => ({
        rowCount: 0,
        rows: []
      });
      const adapter = createPostgresRepositoryAdapter({ queryExecutor });

      await expect(adapter.queryRows<CourseRow>("select * from courses")).resolves.toEqual([]);
      expect(process.env.DATABASE_URL).toBeUndefined();
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
    }
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
