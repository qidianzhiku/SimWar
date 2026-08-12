import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool, PoolConfig } from "pg";
import {
  createPostgresRepositoryProvider,
  type RepositoryProvider
} from "./repository-provider.js";
import {
  createPostgresValidationEnvironmentLaunchLedger,
  type ValidationEnvironmentLaunchLedger
} from "./validation-environment-launch.js";
import {
  createPostgresFormalAuthorityPersistence,
  type PostgresFormalAuthorityPersistence,
  type PostgresW025BindingPorts
} from "./postgres-formal-authority-persistence.js";
import type {
  PostgresQueryExecutor,
  PostgresTransactionExecutor
} from "./postgres-repository-adapter.js";

export type RepositoryRuntimeMode = "json" | "postgres";

export interface RepositoryModeEnvironment {
  SIMWAR_REPOSITORY_MODE?: string;
}

export function resolveRepositoryMode(
  env: RepositoryModeEnvironment = process.env
): RepositoryRuntimeMode {
  const raw = env.SIMWAR_REPOSITORY_MODE?.trim().toLowerCase() || "json";
  if (raw === "json" || raw === "postgres") return raw;
  throw new Error("repository_mode_invalid");
}

export interface PostgresRuntimeOptions {
  databaseUrl?: string;
  pool?: Pool;
  lockPool?: Pool;
  migrationsDir?: string;
  poolConfig?: Omit<PoolConfig, "connectionString">;
}

export interface PostgresRuntime {
  readonly mode: "postgres";
  readonly provider: RepositoryProvider;
  readonly pool: Pool;
  readonly validationEnvironmentLaunchLedger: ValidationEnvironmentLaunchLedger;
  readonly formalAuthorityPersistence: PostgresFormalAuthorityPersistence;
  readonly validationEnvironmentLaunchBindings: PostgresW025BindingPorts;
  ensureValidationUser(input: {
    tenant_id: string;
    user_id: string;
    display_name: string;
  }): Promise<void>;
  start(): Promise<void>;
  assertReady(): Promise<void>;
  close(): Promise<void>;
}

const MIGRATION_FILES = [
  "0001_initial_repository_schema.sql",
  "0002_add_settlement_business_identity_constraint.sql",
  "0003_add_course_memberships.sql",
  "0004_add_settlement_fingerprint.sql",
  "0005_tenant_scoped_referential_integrity.sql",
  "0006_w024_bounded_course_run_runtime.sql",
  "0007_w025_durable_validation_environment_launch.sql"
] as const;

const require = createRequire(import.meta.url);

function defaultMigrationsDir(): string {
  return join(process.cwd(), "db", "migrations");
}

async function applyMigrations(pool: Pool, migrationsDir: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "CREATE TABLE IF NOT EXISTS w024_schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
    );

    for (const migrationFile of MIGRATION_FILES) {
      const version = migrationFile.replace(/\.sql$/, "");
      const existing = await client.query<{ version: string }>(
        "SELECT version FROM w024_schema_migrations WHERE version = $1",
        [version]
      );
      if (existing.rowCount === 1) continue;
      const sql = await readFile(join(migrationsDir, migrationFile), "utf8");
      await client.query(sql);
      await client.query(
        "INSERT INTO w024_schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING",
        [version]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function createPostgresRuntime(options: PostgresRuntimeOptions = {}): PostgresRuntime {
  const databaseUrl = options.databaseUrl?.trim() || process.env.SIMWAR_DATABASE_URL?.trim();
  const { Pool: PgPool } = require("pg") as typeof import("pg");
  const pool =
    options.pool ??
    new PgPool({
      ...(databaseUrl ? { connectionString: databaseUrl } : {}),
      application_name: "simwar-w025-durable-validation-environment-launch",
      connectionTimeoutMillis: 5000,
      max: 10,
      ...options.poolConfig
    });
  const lockPool =
    options.lockPool ??
    (databaseUrl
      ? new PgPool({
          ...(databaseUrl ? { connectionString: databaseUrl } : {}),
          application_name: "simwar-w025-business-key-locks",
          connectionTimeoutMillis: 5000,
          ...options.poolConfig,
          max: 1
        })
      : pool);
  const ownsLockPool = lockPool !== pool;
  let started = false;

  const provider = createPostgresRepositoryProvider({
    pool,
    transactionExecutor: async (callback) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await callback(async (sql, params) => {
          const response = await client.query(sql, params as unknown[] | undefined);
          return { rowCount: response.rowCount ?? 0, rows: response.rows };
        });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }
  });

  const queryExecutor = (async (sql: string, params?: readonly unknown[]) => {
    const result = await pool.query(sql, params as unknown[] | undefined);
    return { rowCount: result.rowCount ?? 0, rows: result.rows as Record<string, unknown>[] };
  }) as PostgresQueryExecutor;
  const transactionExecutor = (async <T>(
    callback: (
      execute: (
        sql: string,
        params?: readonly unknown[]
      ) => Promise<{
        rowCount: number;
        rows: Record<string, unknown>[];
      }>
    ) => Promise<T>
  ): Promise<T> => {
    const client = await lockPool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(async (sql, params) => {
        const response = await client.query(sql, params as unknown[] | undefined);
        return {
          rowCount: response.rowCount ?? 0,
          rows: response.rows as Record<string, unknown>[]
        };
      });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }) as PostgresTransactionExecutor;
  const withBusinessKeyLock = async <T>(
    tenantId: string,
    businessKeyDigest: string,
    callback: () => Promise<T>
  ): Promise<T> => {
    const client = await pool.connect();
    const lockKey = `${tenantId}:${businessKeyDigest}`;
    try {
      await client.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [lockKey]);
      return await callback();
    } finally {
      await client
        .query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [lockKey])
        .catch(() => undefined);
      client.release();
    }
  };
  const validationEnvironmentLaunchLedger = createPostgresValidationEnvironmentLaunchLedger({
    queryExecutor,
    transactionExecutor,
    withBusinessKeyLock
  });
  const formalAuthorityPersistence = createPostgresFormalAuthorityPersistence({
    queryExecutor,
    transactionExecutor
  });
  const ensureValidationUser = async (input: {
    tenant_id: string;
    user_id: string;
    display_name: string;
  }): Promise<void> => {
    const payload = {
      tenant_id: input.tenant_id,
      user_id: input.user_id,
      display_name: input.display_name,
      status: "active"
    };
    await pool.query(
      `INSERT INTO users (id, user_id, tenant_id, status, payload, metadata)
       VALUES ($1, $1, $2, 'active', $3::jsonb, '{}'::jsonb)
       ON CONFLICT (user_id) DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         status = 'active',
         payload = EXCLUDED.payload,
         updated_at = now()
       WHERE users.tenant_id = EXCLUDED.tenant_id`,
      [input.user_id, input.tenant_id, JSON.stringify(payload)]
    );
    await pool.query(
      `INSERT INTO w024_runtime_records
         (tenant_id, record_type, record_id, payload, updated_at)
       VALUES ($1, 'user', $2, $3::jsonb, now())
       ON CONFLICT (tenant_id, record_type, record_id)
       DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
      [input.tenant_id, input.user_id, JSON.stringify(payload)]
    );
  };

  return {
    mode: "postgres",
    provider,
    pool,
    validationEnvironmentLaunchLedger,
    formalAuthorityPersistence,
    validationEnvironmentLaunchBindings: formalAuthorityPersistence.w025Bindings,
    ensureValidationUser,
    async start() {
      if (!databaseUrl && !options.pool) {
        throw new Error("postgres_database_config_missing");
      }
      await pool.query("SELECT 1");
      await applyMigrations(pool, options.migrationsDir ?? defaultMigrationsDir());
      const marker = await pool.query<{ version: string }>(
        "SELECT version FROM w024_schema_migrations WHERE version = $1",
        ["0006_w024_bounded_course_run_runtime"]
      );
      if (marker.rowCount !== 1) throw new Error("postgres_w024_migration_missing");
      const w025Marker = await pool.query<{ version: string }>(
        "SELECT version FROM w024_schema_migrations WHERE version = $1",
        ["0007_w025_durable_validation_environment_launch"]
      );
      if (w025Marker.rowCount !== 1) throw new Error("postgres_w025_migration_missing");
      started = true;
    },
    async assertReady() {
      if (!started) throw new Error("postgres_runtime_not_started");
      await pool.query("SELECT 1");
    },
    async close() {
      try {
        await pool.end();
      } finally {
        if (ownsLockPool) await lockPool.end();
        started = false;
      }
    }
  };
}
