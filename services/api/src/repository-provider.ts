import type { SimWarRepositoryPorts } from "./repository-ports.js";
import type { KnownLimitSemanticId } from "@simwar/shared-contracts";
import { createJsonRepositoryPorts } from "./json-repository-adapter.js";
import { createRepositoryFacade, type RepositoryFacade } from "./repository-facade.js";
import { nextId, type SimWarStore } from "./store.js";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import {
  createPostgresRepositoryAdapter,
  createPostgresRepositoryPorts,
  type PostgresQueryExecutor,
  type PostgresTransactionExecutor
} from "./postgres-repository-adapter.js";

/**
 * Repository provider for API service composition.
 *
 * This provider is intentionally small and unwired:
 * - It groups repository ports and the repository facade into one composition object.
 * - It provides a JSON-backed provider factory for the current in-memory/JSON store.
 * - It does not modify routes, server runtime, DB, migrations, package dependencies,
 *   settlement logic, replay hashing, or canonical decision behavior.
 */

export type RepositoryProviderMode = "custom" | "json" | "postgres";

export interface RepositoryProviderCapabilities {
  knownLimits: readonly KnownLimitSemanticId[];
}

export interface RepositoryProvider {
  mode: RepositoryProviderMode;
  ports: SimWarRepositoryPorts;
  facade: RepositoryFacade;
  idGenerator: RepositoryIdGenerator;
  capabilities?: RepositoryProviderCapabilities;
}

export interface RepositoryIdGenerator {
  createDecisionId(): string;
  createSettlementResultId(): string;
  createAuditLogId(): string;
}

export interface RepositoryProviderOptions {
  ports: SimWarRepositoryPorts;
  mode?: RepositoryProviderMode;
  idGenerator?: RepositoryIdGenerator;
  capabilities?: RepositoryProviderCapabilities;
}

export interface JsonRepositoryProviderOptions {
  store: SimWarStore;
}

export interface PostgresRepositoryProviderOptions {
  pool: Pool;
  transactionExecutor: PostgresTransactionExecutor;
}

function createMissingRepositoryIdGenerator(mode: RepositoryProviderMode): RepositoryIdGenerator {
  return {
    createDecisionId() {
      throw new Error(`repository_id_generator_missing:${mode}:decision`);
    },
    createSettlementResultId() {
      throw new Error(`repository_id_generator_missing:${mode}:settlement_result`);
    },
    createAuditLogId() {
      throw new Error(`repository_id_generator_missing:${mode}:audit_log`);
    }
  };
}

/**
 * Create a repository provider from any concrete repository port implementation.
 *
 * Use this for future adapters such as Postgres-backed ports without changing
 * API use cases that depend on the facade.
 */
export function createRepositoryProvider(options: RepositoryProviderOptions): RepositoryProvider {
  const { mode = "custom", ports } = options;

  return {
    mode,
    ports,
    facade: createRepositoryFacade({ ports }),
    idGenerator: options.idGenerator ?? createMissingRepositoryIdGenerator(mode),
    ...(options.capabilities ? { capabilities: options.capabilities } : {})
  };
}

/**
 * Create a repository provider backed by the current JSON store adapter.
 *
 * This is not wired into server runtime in this PR.
 */
export function createJsonRepositoryProvider(
  options: JsonRepositoryProviderOptions
): RepositoryProvider {
  const { store } = options;
  const ports = createJsonRepositoryPorts(store);

  return createRepositoryProvider({
    mode: "json",
    ports,
    capabilities: { knownLimits: ["JSON_INTERNAL_ONLY", "POSTGRESQL_NOT_ACTIVE"] },
    idGenerator: {
      createDecisionId: () => nextId(store, "decision", "decision"),
      createSettlementResultId: () => nextId(store, "result", "result"),
      createAuditLogId: () => nextId(store, "audit", "audit")
    }
  });
}

/**
 * Compose the explicit PostgreSQL provider. This factory intentionally has no
 * JSON store parameter: selecting this provider cannot create a JSON shadow
 * writer or silently fall back when the database is unavailable.
 */
export function createPostgresRepositoryProvider(
  options: PostgresRepositoryProviderOptions
): RepositoryProvider {
  const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
    const result = await options.pool.query(sql, params as unknown[] | undefined);
    return { rowCount: result.rowCount ?? 0, rows: result.rows };
  };
  const adapter = createPostgresRepositoryAdapter({
    applicationName: "simwar-w024-bounded-course-run",
    queryExecutor,
    transactionExecutor: options.transactionExecutor
  });
  const ports = createPostgresRepositoryPorts({
    adapter,
    transactionExecutor: options.transactionExecutor
  });

  return createRepositoryProvider({
    mode: "postgres",
    ports,
    capabilities: { knownLimits: [] },
    idGenerator: {
      createDecisionId: () => `decision_${randomUUID()}`,
      createSettlementResultId: () => `settlement_${randomUUID()}`,
      createAuditLogId: () => `audit_${randomUUID()}`
    }
  });
}
