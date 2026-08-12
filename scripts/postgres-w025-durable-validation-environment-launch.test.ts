import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createPostgresRuntime } from "../services/api/src/postgres-runtime.js";

const databaseUrl = process.env.SIMWAR_TEST_DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("SIMWAR_TEST_DATABASE_URL is required for W025 durable launch validation");
}

const digest = "a".repeat(64);
const sourceProductMergeSha = "b".repeat(40);

function createInput(launchKey: string, courseTitle = "W025 durable launch") {
  return {
    target_tenant_id: `w025-tenant-${launchKey}`,
    launch_key: launchKey,
    created_by: "w025-teacher",
    source_parameter_set: {
      tenant_id: "w025-source",
      reference: { parameter_set_id: "w025-parameter", version: "1.0.0", content_digest: digest }
    },
    source_scenario_package: {
      tenant_id: "w025-source",
      reference: {
        scenario_package_id: "w025-scenario",
        tenant_id: "w025-source",
        version: "1.0.0",
        content_digest: digest
      }
    },
    course_blueprint_reference: {
      course_blueprint_id: "w025-blueprint",
      tenant_id: `w025-tenant-${launchKey}`,
      version: "1.0.0",
      content_digest: digest
    },
    course_package_reference: {
      course_package_id: "w025-package",
      tenant_id: `w025-tenant-${launchKey}`,
      version: "1.0.0",
      content_digest: digest
    },
    course_title: courseTitle,
    source_product_merge_sha: sourceProductMergeSha,
    cohort_template_digest: digest,
    cohort_template: {
      teacher_user_id: "w025-teacher",
      teams: [
        {
          team_key: "a",
          name: "W025 Team A",
          members: [
            { user_id: `w025-${launchKey}-a-ceo`, display_name: "A CEO", role_slot: "CEO" },
            { user_id: `w025-${launchKey}-a-cfo`, display_name: "A CFO", role_slot: "CFO" },
            { user_id: `w025-${launchKey}-a-cmo`, display_name: "A CMO", role_slot: "CMO" },
            { user_id: `w025-${launchKey}-a-coo`, display_name: "A COO", role_slot: "COO" }
          ]
        },
        {
          team_key: "b",
          name: "W025 Team B",
          members: [
            { user_id: `w025-${launchKey}-b-ceo`, display_name: "B CEO", role_slot: "CEO" },
            { user_id: `w025-${launchKey}-b-cfo`, display_name: "B CFO", role_slot: "CFO" },
            { user_id: `w025-${launchKey}-b-cmo`, display_name: "B CMO", role_slot: "CMO" },
            { user_id: `w025-${launchKey}-b-coo`, display_name: "B COO", role_slot: "COO" }
          ]
        }
      ]
    },
    seed: 25025
  };
}

function childSource(): string {
  return `
    import { Pool } from "pg";
    import {
      createPostgresValidationEnvironmentLaunchLedger,
      createTestLaunchStepExecutor,
      ValidationEnvironmentLaunchService
    } from "./services/api/dist/validation-environment-launch.js";

    const pool = new Pool({ connectionString: process.env.SIMWAR_TEST_DATABASE_URL });
    const queryExecutor = async (sql, params) => {
      const result = await pool.query(sql, params);
      return { rowCount: result.rowCount ?? 0, rows: result.rows };
    };
    const transactionExecutor = async (callback) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await callback(async (sql, params) => {
          const response = await client.query(sql, params);
          return { rowCount: response.rowCount ?? 0, rows: response.rows };
        });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    };
    const ledger = createPostgresValidationEnvironmentLaunchLedger({ queryExecutor, transactionExecutor });
    const service = new ValidationEnvironmentLaunchService(ledger);
    const input = JSON.parse(process.env.W025_LAUNCH_INPUT_JSON);
    const crashHook = process.env.W025_CRASH_HOOK;
    const executor = createTestLaunchStepExecutor({
      hooks: crashHook ? { [crashHook]: async () => process.exit(91) } : {}
    });
    try {
      const result = await service.start(input, executor);
      console.log(JSON.stringify({ status: result.status, version: result.version, launch_id: result.launch_id }));
    } catch (error) {
      console.error(
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : error instanceof Error
            ? error.message
            : String(error)
      );
      process.exitCode = 42;
    } finally {
      await pool.end();
    }
  `;
}

function runChild(input: unknown, crashHook?: string) {
  return spawnSync(process.execPath, ["--input-type=module", "--eval", childSource()], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      SIMWAR_TEST_DATABASE_URL: databaseUrl,
      W025_LAUNCH_INPUT_JSON: JSON.stringify(input),
      ...(crashHook ? { W025_CRASH_HOOK: crashHook } : {})
    },
    timeout: 30_000
  });
}

describe("W025 PostgreSQL durable launch C1-C5 process recovery", () => {
  it("restarts from every durable boundary and reaches READY exactly once", async () => {
    const runtime = createPostgresRuntime({ databaseUrl });
    await runtime.start();
    const hooks = [
      "DURABLE_ROW",
      "BASELINE_READY",
      "COURSE_RUN_READY",
      "COHORT_READY",
      "SESSION_PREFLIGHT_READY"
    ] as const;
    const runSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      for (const [index, hook] of hooks.entries()) {
        const input = createInput(`restart-${runSuffix}-${index}`);
        const interrupted = runChild(input, hook);
        expect(interrupted.status, `${hook} stderr: ${interrupted.stderr}`).toBe(91);

        const resumed = runChild(input);
        expect(resumed.status, `${hook} resume stderr: ${resumed.stderr}`).toBe(0);
        const result = JSON.parse(resumed.stdout.trim()) as {
          status: string;
          version: number;
          launch_id: string;
        };
        expect(result.status).toBe("READY");
        expect(result.version).toBe(5);

        const pool = new Pool({ connectionString: databaseUrl });
        try {
          const row = await pool.query(
            "SELECT status, version FROM w025_validation_environment_launches WHERE launch_id = $1",
            [result.launch_id]
          );
          expect(row.rows).toEqual([{ status: "READY", version: "5" }]);
        } finally {
          await pool.end();
        }
      }
    } finally {
      await runtime.close();
    }
  });

  it("serializes identical requests and rejects a changed fingerprint", async () => {
    const input = createInput(
      `concurrency-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );
    const first = runChild(input);
    const second = runChild(input);
    expect(first.status).toBe(0);
    expect(second.status).toBe(0);

    const conflict = runChild(createInput("concurrency", "changed"));
    expect(conflict.status).toBe(42);
    expect(conflict.stderr).toContain("W025_LAUNCH_CONFLICT");
  });
});
