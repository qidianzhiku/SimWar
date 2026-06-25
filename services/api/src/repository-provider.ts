import type { SimWarRepositoryPorts } from "./repository-ports.js";
import { createJsonRepositoryPorts } from "./json-repository-adapter.js";
import { createRepositoryFacade, type RepositoryFacade } from "./repository-facade.js";
import { nextId, type SimWarStore } from "./store.js";

/**
 * Repository provider for API service composition.
 *
 * This provider is intentionally small and unwired:
 * - It groups repository ports and the repository facade into one composition object.
 * - It provides a JSON-backed provider factory for the current in-memory/JSON store.
 * - It does not modify routes, server runtime, DB, migrations, package dependencies,
 *   settlement logic, replay hashing, or canonical decision behavior.
 */

export type RepositoryProviderMode = "custom" | "json";

export interface RepositoryProvider {
  mode: RepositoryProviderMode;
  ports: SimWarRepositoryPorts;
  facade: RepositoryFacade;
  idGenerator: RepositoryIdGenerator;
}

export interface RepositoryIdGenerator {
  createSettlementResultId(): string;
  createAuditLogId(): string;
}

export interface RepositoryProviderOptions {
  ports: SimWarRepositoryPorts;
  mode?: RepositoryProviderMode;
  idGenerator?: RepositoryIdGenerator;
}

export interface JsonRepositoryProviderOptions {
  store: SimWarStore;
}

function createMissingRepositoryIdGenerator(mode: RepositoryProviderMode): RepositoryIdGenerator {
  return {
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
    idGenerator: options.idGenerator ?? createMissingRepositoryIdGenerator(mode)
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
    idGenerator: {
      createSettlementResultId: () => nextId(store, "result", "result"),
      createAuditLogId: () => nextId(store, "audit", "audit")
    }
  });
}
