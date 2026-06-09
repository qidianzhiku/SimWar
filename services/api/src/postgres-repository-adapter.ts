/**
 * Dependency-free Postgres repository adapter skeleton.
 *
 * This module only defines the future adapter construction boundary. It does
 * not import a database driver, implement SimWarRepositoryPorts, register with
 * the repository provider, connect to runtime, or change JSON adapter behavior.
 * Query helpers delegate only to the injected PostgresQueryExecutor.
 */

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

/**
 * Skeleton holder for a future Postgres implementation.
 *
 * A later PR should implement repository ports and parity tests. Until then, the
 * helper methods here only provide a narrow query boundary for future mappings.
 */
export class PostgresRepositoryAdapter {
  readonly options: Readonly<PostgresRepositoryAdapterOptions>;
  readonly queryExecutor: PostgresQueryExecutor;

  constructor(options: PostgresRepositoryAdapterOptions) {
    this.options = { ...options };
    this.queryExecutor = options.queryExecutor;
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
