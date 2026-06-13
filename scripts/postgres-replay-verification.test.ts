import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import type {
  ReplayDiffReport,
  ReplayInputManifest,
  ReplayReport,
  ReplayRun
} from "@simwar/shared-contracts";

type AdapterFactory =
  typeof import("../services/api/src/postgres-repository-adapter.js").createPostgresRepositoryAdapter;
type PostgresQueryExecutor =
  import("../services/api/src/postgres-repository-adapter.js").PostgresQueryExecutor;

export default defineConfig({
  resolve: {
    alias: {
      "@simwar/shared-contracts": resolve(process.cwd(), "packages/shared-contracts/src/index.ts")
    }
  },
  test: {
    environment: "node",
    hookTimeout: 30_000,
    include: ["scripts/postgres-replay-verification.test.ts"],
    testTimeout: 30_000
  }
});

const REQUIRED_ENV_ERROR =
  "SIMWAR_TEST_DATABASE_URL is required for disposable Postgres verification";

interface PgQueryResult<TRow extends Record<string, unknown> = Record<string, unknown>> {
  rowCount: number | null;
  rows: TRow[];
}

interface PgClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<TRow extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<PgQueryResult<TRow>>;
}

interface PgClientConstructor {
  new (options: { connectionString: string }): PgClient;
}

interface ReplayRecordSchemaColumn {
  column_name: string;
  data_type: string;
  is_identity: "YES" | "NO";
  udt_name: string;
}

interface ReplayRecordRow<TPayload> {
  append_sequence: string;
  id: string;
  manifest_id?: string | null;
  input_hash?: string | null;
  manifest_hash?: string | null;
  replay_result_hash?: string | null;
  payload: TPayload;
}

interface ManifestVerificationRow extends Record<string, unknown> {
  append_sequence: string | number;
  id: string;
  source_result_id: string;
  input_hash: string;
  manifest_hash: string;
  payload: ReplayInputManifest;
}

interface ReplayReportVerificationRow extends Record<string, unknown> {
  append_sequence: string | number;
  id: string;
  replay_run_id: string;
  source_result_id: string;
  replay_result_hash: string;
  status: ReplayReport["status"];
  payload: ReplayReport;
}

interface TableCounts {
  decisions: number;
  simulation_rounds: number;
  settlement_results: number;
}

let client: PgClient | undefined;
let schemaName = "";
let schemaCreated = false;
let adapter: ReturnType<AdapterFactory>;

function getDisposableDatabaseUrl(): string {
  const databaseUrl = process.env.SIMWAR_TEST_DATABASE_URL;

  if (databaseUrl === undefined || databaseUrl.trim() === "") {
    throw new Error(REQUIRED_ENV_ERROR);
  }

  const parsedUrl = new URL(databaseUrl);

  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
    throw new Error("SIMWAR_TEST_DATABASE_URL must use postgres or postgresql protocol");
  }

  if (parsedUrl.pathname === "" || parsedUrl.pathname === "/") {
    throw new Error("SIMWAR_TEST_DATABASE_URL must include a database name");
  }

  return databaseUrl;
}

function createSchemaName(): string {
  return `simwar_replay_verify_${randomUUID().replaceAll("-", "")}`;
}

function quoteIdentifier(identifier: string): string {
  if (!/^simwar_replay_verify_[a-f0-9]{32}$/.test(identifier)) {
    throw new Error("Unsafe generated schema identifier");
  }

  return `"${identifier}"`;
}

async function applyMigrationIntoSchema(pgClient: PgClient, schema: string): Promise<void> {
  const migrationSql = await readFile("db/migrations/0001_initial_repository_schema.sql", "utf8");

  await pgClient.query("BEGIN");

  try {
    await pgClient.query(`SET LOCAL search_path TO ${quoteIdentifier(schema)}`);
    await pgClient.query(migrationSql);
    await pgClient.query("COMMIT");
  } catch (error) {
    await pgClient.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function tableCounts(): Promise<TableCounts> {
  const result = await requiredClient().query<TableCounts>(
    "SELECT (SELECT count(*)::int FROM decisions) AS decisions, (SELECT count(*)::int FROM simulation_rounds) AS simulation_rounds, (SELECT count(*)::int FROM settlement_results) AS settlement_results"
  );

  return result.rows[0] ?? { decisions: -1, settlement_results: -1, simulation_rounds: -1 };
}

function requiredClient(): PgClient {
  if (client === undefined) {
    throw new Error("Postgres verification client was not initialized");
  }

  return client;
}

function appendSequence(value: string): bigint {
  return BigInt(value);
}

function suffix(): string {
  return randomUUID().replaceAll("-", "").slice(0, 12);
}

function replayManifest(overrides: Partial<ReplayInputManifest> = {}): ReplayInputManifest {
  const id = suffix();

  return {
    created_at: "2026-06-13T00:00:00.000Z",
    excluded_from_truth_hash: {
      analytics: { dashboard_view_id: `view-${id}` },
      ai_advice: { advisory_id: `advice-${id}` },
      learning_evidence: ["rubric-note"],
      role_drafts: [{ section_id: `section-${id}` }]
    },
    included_sources: ["canonical_decisions", "parameter_set", "scenario_package"],
    input_hash: `input-hash-${id}`,
    manifest_hash: `manifest-hash-${id}`,
    manifest_id: `manifest-${id}`,
    round_id: `round-${id}`,
    run_id: `run-${id}`,
    source_result_id: `settlement-${id}`,
    tenant_id: `tenant-${id}`,
    ...overrides
  };
}

function replayRun(overrides: Partial<ReplayRun> = {}): ReplayRun {
  const id = suffix();

  return {
    completed_at: "2026-06-13T00:03:00.000Z",
    manifest_id: `manifest-${id}`,
    replay_mode: "official_replay",
    replay_run_id: `replay-run-${id}`,
    round_id: `round-${id}`,
    run_id: `run-${id}`,
    started_at: "2026-06-13T00:02:00.000Z",
    status: "completed",
    tenant_id: `tenant-${id}`,
    ...overrides
  };
}

function replayReport(overrides: Partial<ReplayReport> = {}): ReplayReport {
  const id = suffix();

  return {
    created_at: "2026-06-13T00:04:00.000Z",
    matched: true,
    replay_report_id: `replay-report-${id}`,
    replay_result_hash: `result-hash-${id}`,
    replay_run_id: `replay-run-${id}`,
    round_id: `round-${id}`,
    run_id: `run-${id}`,
    source_result_id: `settlement-${id}`,
    status: "matched",
    tenant_id: `tenant-${id}`,
    ...overrides
  };
}

function replayDiffReport(overrides: Partial<ReplayDiffReport> = {}): ReplayDiffReport {
  const id = suffix();

  return {
    created_at: "2026-06-13T00:05:00.000Z",
    diff_report_id: `diff-report-${id}`,
    differences: [
      {
        actual: { score: 91, tags: ["stable", "replay"] },
        expected: { score: 91, tags: ["stable", "replay"] },
        field: "team_results[0].state_true.score",
        message: "Replay score matched"
      }
    ],
    replay_report_id: `replay-report-${id}`,
    round_id: `round-${id}`,
    run_id: `run-${id}`,
    severity: "none",
    tenant_id: `tenant-${id}`,
    ...overrides
  };
}

if (process.env.VITEST_WORKER_ID !== undefined) {
  const { afterAll, beforeAll, describe, expect, it } = await import("vitest");

  describe("disposable Postgres replay verification", () => {
    beforeAll(async () => {
      const connectionString = getDisposableDatabaseUrl();
      schemaName = createSchemaName();
      const [{ default: pg }, adapterModule] = await Promise.all([
        import("pg") as Promise<{ default: { Client: PgClientConstructor } }>,
        import("../services/api/src/postgres-repository-adapter.js")
      ]);
      client = new pg.Client({ connectionString });
      await client.connect();
      await client.query(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`);
      schemaCreated = true;
      await applyMigrationIntoSchema(client, schemaName);
      await client.query(`SET search_path TO ${quoteIdentifier(schemaName)}`);

      const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
        const result = await requiredClient().query(sql, params as unknown[]);

        return {
          rowCount: result.rowCount ?? result.rows.length,
          rows: result.rows
        };
      };

      adapter = adapterModule.createPostgresRepositoryAdapter({ queryExecutor });
    });

    afterAll(async () => {
      if (client === undefined) {
        return;
      }

      try {
        await client.query("SET search_path TO public");

        if (schemaCreated) {
          await client.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schemaName)} CASCADE`);
        }
      } finally {
        await client.end();
      }
    });

    it("applies migration and verifies replay_records schema", async () => {
      const tableResult = await requiredClient().query<{ exists: boolean }>(
        "SELECT to_regclass($1) IS NOT NULL AS exists",
        [`${schemaName}.replay_records`]
      );
      expect(tableResult.rows[0]?.exists).toBe(true);

      const columns = await requiredClient().query<ReplayRecordSchemaColumn>(
        "SELECT column_name, data_type, is_identity, udt_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'replay_records'",
        [schemaName]
      );
      const byName = new Map(columns.rows.map((column) => [column.column_name, column]));

      expect(byName.get("append_sequence")).toMatchObject({
        data_type: "bigint",
        is_identity: "YES"
      });
      expect(byName.get("diff_report_id")).toBeDefined();
      expect(byName.get("replay_diff_report_id")).toBeUndefined();
      expect(byName.get("payload")?.udt_name).toBe("jsonb");

      await requiredClient().query("BEGIN");
      await requiredClient().query("SAVEPOINT invalid_record_type");
      await expect(
        requiredClient().query(
          "INSERT INTO replay_records (id, tenant_id, record_type, payload) VALUES ($1, $2, 'invalid', '{}'::jsonb)",
          [`invalid-${suffix()}`, `tenant-${suffix()}`]
        )
      ).rejects.toThrow();
      await requiredClient().query("ROLLBACK TO SAVEPOINT invalid_record_type");
      await requiredClient().query("COMMIT");
    });

    it("round-trips all replay record types through JSONB payload", async () => {
      const manifest = replayManifest();
      const run = replayRun({
        manifest_id: manifest.manifest_id,
        round_id: manifest.round_id,
        run_id: manifest.run_id,
        tenant_id: manifest.tenant_id
      });
      const report = replayReport({
        replay_run_id: run.replay_run_id,
        round_id: manifest.round_id,
        run_id: manifest.run_id,
        source_result_id: manifest.source_result_id,
        tenant_id: manifest.tenant_id
      });
      const diff = replayDiffReport({
        replay_report_id: report.replay_report_id,
        round_id: manifest.round_id,
        run_id: manifest.run_id,
        tenant_id: manifest.tenant_id
      });

      await adapter.replay.saveReplayInputManifest(manifest);
      await adapter.replay.saveReplayRun(run);
      await adapter.replay.saveReplayReport(report);
      await adapter.replay.saveReplayDiffReport(diff);

      expect(
        await adapter.replay.getReplayInputManifest(manifest.tenant_id, manifest.manifest_id)
      ).toEqual(manifest);
      expect(await adapter.replay.getReplayRun(run.tenant_id, run.replay_run_id)).toEqual(run);
      expect(
        await adapter.replay.getReplayReport(report.tenant_id, report.replay_report_id)
      ).toEqual(report);
      expect(await adapter.replay.getReplayDiffReport(diff.tenant_id, diff.diff_report_id)).toEqual(
        diff
      );

      const payloadType = await requiredClient().query<{ payload_type: string }>(
        "SELECT pg_typeof(payload)::text AS payload_type FROM replay_records WHERE manifest_id = $1",
        [manifest.manifest_id]
      );
      expect(payloadType.rows[0]?.payload_type).toBe("jsonb");
    });

    it("preserves append-only duplicates and first-match replay reads", async () => {
      const manifestId = `manifest-duplicate-${suffix()}`;
      const first = replayManifest({
        input_hash: "input-hash-first",
        manifest_hash: "manifest-hash-first",
        manifest_id: manifestId
      });
      const second = replayManifest({
        input_hash: "input-hash-second",
        manifest_hash: "manifest-hash-second",
        manifest_id: manifestId,
        round_id: first.round_id,
        run_id: first.run_id,
        source_result_id: first.source_result_id,
        tenant_id: first.tenant_id
      });

      await adapter.replay.saveReplayInputManifest(first);
      await adapter.replay.saveReplayInputManifest(second);

      const rows = await requiredClient().query<ReplayRecordRow<ReplayInputManifest>>(
        "SELECT id, append_sequence, manifest_id, input_hash, manifest_hash, payload FROM replay_records WHERE tenant_id = $1 AND record_type = 'manifest' AND manifest_id = $2 ORDER BY append_sequence ASC",
        [first.tenant_id, manifestId]
      );

      expect(rows.rows).toHaveLength(2);
      expect(rows.rows[0]?.id).not.toBe(rows.rows[1]?.id);
      expect(rows.rows[0]?.manifest_id).toBe(manifestId);
      expect(rows.rows[1]?.manifest_id).toBe(manifestId);
      expect(appendSequence(rows.rows[1]!.append_sequence)).toBeGreaterThan(
        appendSequence(rows.rows[0]!.append_sequence)
      );
      expect(rows.rows[0]?.payload).toEqual(first);
      expect(rows.rows[1]?.payload).toEqual(second);

      const found = await adapter.replay.getReplayInputManifest(first.tenant_id, manifestId);
      expect(found).toEqual(rows.rows[0]?.payload);
      expect(found).toEqual(first);
    });

    it("keeps replay reads tenant-isolated for matching business identities", async () => {
      const manifestId = `manifest-shared-${suffix()}`;
      const tenantA = replayManifest({
        manifest_id: manifestId,
        tenant_id: `tenant-a-${suffix()}`
      });
      const tenantB = replayManifest({
        manifest_id: manifestId,
        tenant_id: `tenant-b-${suffix()}`
      });

      await adapter.replay.saveReplayInputManifest(tenantA);
      await adapter.replay.saveReplayInputManifest(tenantB);

      expect(await adapter.replay.getReplayInputManifest(tenantA.tenant_id, manifestId)).toEqual(
        tenantA
      );
      expect(await adapter.replay.getReplayInputManifest(tenantB.tenant_id, manifestId)).toEqual(
        tenantB
      );
      expect(
        await adapter.replay.getReplayInputManifest(`tenant-missing-${suffix()}`, manifestId)
      ).toBeNull();

      const rows = await requiredClient().query<ReplayRecordRow<ReplayInputManifest>>(
        "SELECT id, append_sequence, payload FROM replay_records WHERE manifest_id = $1 ORDER BY tenant_id ASC",
        [manifestId]
      );
      expect(rows.rows).toHaveLength(2);
      expect(rows.rows[0]?.id).not.toBe(rows.rows[1]?.id);
    });

    it("preserves replay hash fields in explicit columns and payload", async () => {
      const manifest = replayManifest({
        input_hash: "input-hash-preserved",
        manifest_hash: "manifest-hash-preserved"
      });
      const report = replayReport({
        replay_result_hash: "replay-result-hash-preserved",
        round_id: manifest.round_id,
        run_id: manifest.run_id,
        source_result_id: manifest.source_result_id,
        tenant_id: manifest.tenant_id
      });

      await adapter.replay.saveReplayInputManifest(manifest);
      await adapter.replay.saveReplayReport(report);

      const manifestRows = await requiredClient().query<ManifestVerificationRow>(
        "SELECT append_sequence, id, source_result_id, input_hash, manifest_hash, payload FROM replay_records WHERE tenant_id = $1 AND record_type = 'manifest' AND manifest_id = $2 ORDER BY append_sequence ASC LIMIT 1",
        [manifest.tenant_id, manifest.manifest_id]
      );
      const manifestRow = manifestRows.rows[0];
      expect(manifestRow).toBeDefined();
      expect(manifestRow?.source_result_id).toBe(manifest.source_result_id);
      expect(manifestRow?.input_hash).toBe(manifest.input_hash);
      expect(manifestRow?.manifest_hash).toBe(manifest.manifest_hash);
      expect(manifestRow?.payload.source_result_id).toBe(manifest.source_result_id);
      expect(manifestRow?.payload.input_hash).toBe(manifest.input_hash);
      expect(manifestRow?.payload.manifest_hash).toBe(manifest.manifest_hash);
      expect(manifestRow?.payload).toEqual(manifest);

      const reportRows = await requiredClient().query<ReplayReportVerificationRow>(
        "SELECT append_sequence, id, replay_run_id, source_result_id, replay_result_hash, status, payload FROM replay_records WHERE tenant_id = $1 AND record_type = 'report' AND replay_report_id = $2 ORDER BY append_sequence ASC LIMIT 1",
        [report.tenant_id, report.replay_report_id]
      );
      const reportRow = reportRows.rows[0];
      expect(reportRow).toBeDefined();
      expect(reportRow?.replay_run_id).toBe(report.replay_run_id);
      expect(reportRow?.source_result_id).toBe(report.source_result_id);
      expect(reportRow?.replay_result_hash).toBe(report.replay_result_hash);
      expect(reportRow?.status).toBe(report.status);
      expect(reportRow?.payload.replay_run_id).toBe(report.replay_run_id);
      expect(reportRow?.payload.source_result_id).toBe(report.source_result_id);
      expect(reportRow?.payload.replay_result_hash).toBe(report.replay_result_hash);
      expect(reportRow?.payload).toEqual(report);
      expect(
        await adapter.replay.getReplayReport(report.tenant_id, report.replay_report_id)
      ).toEqual(report);
    });

    it("does not mutate settlement truth-chain tables during replay persistence", async () => {
      const before = await tableCounts();
      const manifest = replayManifest();

      await adapter.replay.saveReplayInputManifest(manifest);
      expect(
        await adapter.replay.getReplayInputManifest(manifest.tenant_id, manifest.manifest_id)
      ).toEqual(manifest);

      const after = await tableCounts();
      expect(before).toEqual({ decisions: 0, settlement_results: 0, simulation_rounds: 0 });
      expect(after).toEqual(before);
    });
  });
}
