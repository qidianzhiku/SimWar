import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool, PoolConfig } from "pg";
import {
  createPostgresRepositoryProvider,
  type RepositoryProvider
} from "./repository-provider.js";

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
  migrationsDir?: string;
  poolConfig?: Omit<PoolConfig, "connectionString">;
}

export interface PostgresRuntime {
  readonly mode: "postgres";
  readonly provider: RepositoryProvider;
  readonly pool: Pool;
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
  "0006_w024_bounded_course_run_runtime.sql"
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
      application_name: "simwar-w024-bounded-course-run",
      connectionTimeoutMillis: 5000,
      max: 10,
      ...options.poolConfig
    });
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

  return {
    mode: "postgres",
    provider,
    pool,
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
      started = true;
    },
    async assertReady() {
      if (!started) throw new Error("postgres_runtime_not_started");
      await pool.query("SELECT 1");
    },
    async close() {
      await pool.end();
      started = false;
    }
  };
}
