import { describe, expect, it } from "vitest";
import type { RepositoryCourseReadModel } from "../../services/api/src/repository-ports.js";
import {
  createPostgresRepositoryAdapter,
  PostgresRepositoryAdapter,
  type PostgresQueryExecutor,
  type PostgresQueryResult
} from "../../services/api/src/postgres-repository-adapter.js";

describe("Postgres repository adapter skeleton", () => {
  interface CourseRow extends Record<string, unknown> {
    course_id: string;
    status?: string;
    tenant_id: string;
  }

  interface UserRow extends Record<string, unknown> {
    user_id: string;
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

  it("courses.getCourse delegates through the injected executor and returns a read model", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const row: RepositoryCourseReadModel = {
      course_id: "course-1",
      status: "published",
      tenant_id: "tenant-1"
    };
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: [row]
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.courses.getCourse("tenant-1", "course-1")).resolves.toEqual(row);
    expect(calls).toEqual([
      {
        params: ["tenant-1", "course-1"],
        sql: "SELECT tenant_id, course_id, status FROM courses WHERE tenant_id = $1 AND course_id = $2"
      }
    ]);
  });

  it("courses.getCourse returns null when no row exists", async () => {
    const queryExecutor: PostgresQueryExecutor = async () => ({
      rowCount: 0,
      rows: []
    });
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.courses.getCourse("tenant-1", "missing-course")).resolves.toBeNull();
  });

  it("courses.listCoursesForUser checks user existence before listing courses", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const rows: RepositoryCourseReadModel[] = [
      {
        course_id: "course-1",
        status: "published",
        tenant_id: "tenant-1"
      },
      {
        course_id: "course-2",
        status: "draft",
        tenant_id: "tenant-1"
      }
    ];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });

      if (sql.startsWith("SELECT user_id FROM users")) {
        return {
          rowCount: 1,
          rows: [
            {
              user_id: "user-1"
            } satisfies UserRow
          ]
        };
      }

      return {
        rowCount: rows.length,
        rows
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.courses.listCoursesForUser("tenant-1", "user-1")).resolves.toEqual(rows);
    expect(calls).toEqual([
      {
        params: ["tenant-1", "user-1"],
        sql: "SELECT user_id FROM users WHERE tenant_id = $1 AND user_id = $2"
      },
      {
        params: ["tenant-1"],
        sql: "SELECT tenant_id, course_id, status FROM courses WHERE tenant_id = $1 ORDER BY created_at ASC, course_id ASC"
      }
    ]);
  });

  it("courses.listCoursesForUser returns an empty list and skips course lookup when user is missing", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });

      return {
        rowCount: 0,
        rows: []
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.courses.listCoursesForUser("tenant-1", "missing-user")).resolves.toEqual(
      []
    );
    expect(calls).toEqual([
      {
        params: ["tenant-1", "missing-user"],
        sql: "SELECT user_id FROM users WHERE tenant_id = $1 AND user_id = $2"
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

    expect(Object.keys(adapter).sort()).toEqual(["courses", "options", "queryExecutor"]);
    expect("identity" in adapter).toBe(false);
    expect(adapter.courses.getCourse).toEqual(expect.any(Function));
    expect(adapter.courses.listCoursesForUser).toEqual(expect.any(Function));
    expect("decisions" in adapter).toBe(false);
    expect("settlements" in adapter).toBe(false);
    expect("replay" in adapter).toBe(false);
  });
});
