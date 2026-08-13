import { describe, expect, it } from "vitest";
import type { ValidationEnvironmentLaunch } from "@simwar/shared-contracts";
import type { Pool } from "pg";
import {
  createPostgresRuntime,
  resolveRepositoryMode
} from "../../services/api/src/postgres-runtime.js";

function createTracingPool(name: string, events: string[]): Pool {
  const query = async (sql: string) => {
    events.push(`${name}:query:${sql}`);
    return {
      rowCount: sql.startsWith("SELECT payload") ? 0 : 1,
      rows: []
    };
  };
  const client = {
    query,
    release() {
      events.push(`${name}:release`);
    }
  };
  return {
    async connect() {
      events.push(`${name}:connect`);
      return client;
    },
    query,
    async end() {
      events.push(`${name}:end`);
    }
  } as unknown as Pool;
}

function requestedLaunch(): ValidationEnvironmentLaunch {
  return {
    schema_version: "validation-environment-launch.v1",
    launch_id: "vlaunch_pool_routing",
    tenant_id: "tenant_pool_routing",
    business_key_digest: "a".repeat(64),
    request_fingerprint: "b".repeat(64),
    status: "REQUESTED",
    source_parameter_set: {
      tenant_id: "tenant_source",
      reference: {
        parameter_set_id: "parameter_pool_routing",
        version: "1.0.0",
        content_digest: "c".repeat(64)
      }
    },
    source_scenario_package: {
      tenant_id: "tenant_source",
      reference: {
        scenario_package_id: "scenario_pool_routing",
        tenant_id: "tenant_source",
        version: "1.0.0",
        content_digest: "d".repeat(64)
      }
    },
    course_blueprint_reference: {
      course_blueprint_id: "blueprint_pool_routing",
      tenant_id: "tenant_pool_routing",
      version: "1.0.0",
      content_digest: "e".repeat(64)
    },
    course_package_reference: {
      course_package_id: "package_pool_routing",
      tenant_id: "tenant_pool_routing",
      version: "1.0.0",
      content_digest: "f".repeat(64)
    },
    step_receipts: {},
    version: 0,
    created_by: "usr_teacher",
    created_at: "2026-08-13T00:00:00.000Z",
    updated_at: "2026-08-13T00:00:00.000Z",
    known_limits: []
  };
}

describe("W024 Postgres runtime mode", () => {
  it("accepts explicit JSON and Postgres modes", () => {
    expect(resolveRepositoryMode({ SIMWAR_REPOSITORY_MODE: "json" })).toBe("json");
    expect(resolveRepositoryMode({ SIMWAR_REPOSITORY_MODE: "postgres" })).toBe("postgres");
  });

  it("rejects an unsupported mode", () => {
    expect(() => resolveRepositoryMode({ SIMWAR_REPOSITORY_MODE: "sqlite" })).toThrow(
      "repository_mode_invalid"
    );
  });

  it("fails closed when Postgres configuration is absent", async () => {
    await expect(createPostgresRuntime({ databaseUrl: "" }).start()).rejects.toThrow(
      "postgres_database_config_missing"
    );
  });

  it("does not expose a JSON fallback in Postgres mode", () => {
    expect(() =>
      createPostgresRuntime({ databaseUrl: "postgres://example.invalid/db" })
    ).not.toThrow();
  });

  it("keeps advisory-lock waiters off the repository transaction pool", async () => {
    const repositoryEvents: string[] = [];
    const lockEvents: string[] = [];
    const runtime = createPostgresRuntime({
      databaseUrl: "postgres://unused.invalid/simwar",
      pool: createTracingPool("repository", repositoryEvents),
      lockPool: createTracingPool("lock", lockEvents)
    });
    const launch = requestedLaunch();

    await runtime.validationEnvironmentLaunchLedger.withBusinessKeyLock!(
      launch.tenant_id,
      launch.business_key_digest,
      async () => {
        await runtime.validationEnvironmentLaunchLedger.acquire({
          tenant_id: launch.tenant_id,
          business_key_digest: launch.business_key_digest,
          launch_id: launch.launch_id,
          request_fingerprint: launch.request_fingerprint,
          initial: launch
        });
      }
    );

    expect(lockEvents.some((event) => event.includes("pg_advisory_lock"))).toBe(true);
    expect(lockEvents.some((event) => event.includes("BEGIN"))).toBe(false);
    expect(repositoryEvents.some((event) => event.includes("BEGIN"))).toBe(true);
    expect(repositoryEvents.some((event) => event.includes("pg_advisory_lock"))).toBe(false);
  });

  it("releases the isolated advisory lock when its callback fails", async () => {
    const lockEvents: string[] = [];
    const runtime = createPostgresRuntime({
      databaseUrl: "postgres://unused.invalid/simwar",
      pool: createTracingPool("repository", []),
      lockPool: createTracingPool("lock", lockEvents)
    });

    await expect(
      runtime.validationEnvironmentLaunchLedger.withBusinessKeyLock!(
        "tenant_pool_routing",
        "a".repeat(64),
        async () => {
          throw new Error("injected_callback_failure");
        }
      )
    ).rejects.toThrow("injected_callback_failure");

    expect(lockEvents.some((event) => event.includes("pg_advisory_unlock"))).toBe(true);
    expect(lockEvents.at(-1)).toBe("lock:release");
  });

  it("does not globally serialize different business keys", async () => {
    const runtime = createPostgresRuntime({
      databaseUrl: "postgres://unused.invalid/simwar",
      pool: createTracingPool("repository", []),
      lockPool: createTracingPool("lock", [])
    });
    let activeCallbacks = 0;
    let maximumActiveCallbacks = 0;
    let releaseBoth!: () => void;
    const bothEntered = new Promise<void>((resolve) => {
      releaseBoth = resolve;
    });
    const callback = async () => {
      activeCallbacks += 1;
      maximumActiveCallbacks = Math.max(maximumActiveCallbacks, activeCallbacks);
      if (activeCallbacks === 2) releaseBoth();
      await bothEntered;
      activeCallbacks -= 1;
    };

    await Promise.all([
      runtime.validationEnvironmentLaunchLedger.withBusinessKeyLock!(
        "tenant_pool_routing",
        "a".repeat(64),
        callback
      ),
      runtime.validationEnvironmentLaunchLedger.withBusinessKeyLock!(
        "tenant_pool_routing",
        "b".repeat(64),
        callback
      )
    ]);

    expect(maximumActiveCallbacks).toBe(2);
  });
});
