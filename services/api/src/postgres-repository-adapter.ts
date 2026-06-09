/**
 * Dependency-free Postgres repository adapter skeleton.
 *
 * This module only defines the future adapter construction boundary. It does
 * not import a database driver, implement SimWarRepositoryPorts, register with
 * the repository provider, connect to runtime, or change JSON adapter behavior.
 * Query helpers delegate only to the injected PostgresQueryExecutor.
 */

import type { RepositoryCourseReadModel, RepositoryId } from "./repository-ports.js";

export interface PostgresQueryResult<
  TRow extends Record<string, unknown> = Record<string, unknown>
> {
  rowCount: number;
  rows: TRow[];
}

export type PostgresQueryExecutor = <
  TRow extends Record<string, unknown> = Record<string, unknown>
>(
  sql: string,
  params?: readonly unknown[]
) => Promise<PostgresQueryResult<TRow>>;

export interface PostgresRepositoryAdapterOptions {
  applicationName?: string;
  queryExecutor: PostgresQueryExecutor;
  schema?: string;
}

export interface PostgresCourseReadMapping {
  getCourse(
    tenantId: RepositoryId,
    courseId: RepositoryId
  ): Promise<RepositoryCourseReadModel | null>;
  listCoursesForUser(
    tenantId: RepositoryId,
    userId: RepositoryId
  ): Promise<RepositoryCourseReadModel[]>;
}

interface PostgresUserPresenceRow extends Record<string, unknown> {
  user_id: RepositoryId;
}

interface PostgresCourseReadRow extends Record<string, unknown> {
  course_id: RepositoryId;
  status?: string | null;
  tenant_id: RepositoryId;
}

function toCourseReadModel(row: PostgresCourseReadRow): RepositoryCourseReadModel {
  const course: RepositoryCourseReadModel = {
    course_id: row.course_id,
    tenant_id: row.tenant_id
  };

  if (typeof row.status === "string") {
    course.status = row.status;
  }

  return course;
}

/**
 * Skeleton holder for a future Postgres implementation.
 *
 * A later PR should implement repository ports and parity tests. Until then, the
 * helper methods here only provide a narrow query boundary for future mappings.
 */
export class PostgresRepositoryAdapter {
  readonly courses: PostgresCourseReadMapping;
  readonly options: Readonly<PostgresRepositoryAdapterOptions>;
  readonly queryExecutor: PostgresQueryExecutor;

  constructor(options: PostgresRepositoryAdapterOptions) {
    this.options = { ...options };
    this.queryExecutor = options.queryExecutor;
    this.courses = {
      getCourse: async (tenantId, courseId) => {
        const row = await this.queryOne<PostgresCourseReadRow>(
          "SELECT tenant_id, course_id, status FROM courses WHERE tenant_id = $1 AND course_id = $2",
          [tenantId, courseId]
        );

        return row === null ? null : toCourseReadModel(row);
      },
      listCoursesForUser: async (tenantId, userId) => {
        const user = await this.queryOne<PostgresUserPresenceRow>(
          "SELECT user_id FROM users WHERE tenant_id = $1 AND user_id = $2",
          [tenantId, userId]
        );

        if (user === null) {
          return [];
        }

        const rows = await this.queryRows<PostgresCourseReadRow>(
          "SELECT tenant_id, course_id, status FROM courses WHERE tenant_id = $1 ORDER BY created_at ASC, course_id ASC",
          [tenantId]
        );

        return rows.map(toCourseReadModel);
      }
    };
  }

  async queryRows<TRow extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<readonly TRow[]> {
    const result = await this.queryExecutor<TRow>(sql, params);

    return result.rows;
  }

  async queryOne<TRow extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<TRow | null> {
    const rows = await this.queryRows<TRow>(sql, params);

    return rows[0] ?? null;
  }

  async execute(
    sql: string,
    params?: readonly unknown[]
  ): Promise<Pick<PostgresQueryResult, "rowCount">> {
    const result = await this.queryExecutor(sql, params);

    return {
      rowCount: result.rowCount
    };
  }
}

export function createPostgresRepositoryAdapter(
  options: PostgresRepositoryAdapterOptions
): PostgresRepositoryAdapter {
  return new PostgresRepositoryAdapter(options);
}
