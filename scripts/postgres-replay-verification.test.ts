import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { defineConfig } from "vitest/config";
import type {
  Round,
  ReplayDiffReport,
  ReplayInputManifest,
  ReplayReport,
  ReplayRun,
  SettlementResult
} from "@simwar/shared-contracts";

type AdapterFactory =
  typeof import("../services/api/src/postgres-repository-adapter.js").createPostgresRepositoryAdapter;
type SettlementOutcomeFactory =
  typeof import("../services/api/src/postgres-repository-adapter.js").createPostgresSettlementOutcomePersistencePort;
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
const REPORT_PATH_ENV = "SIMWAR_VERIFICATION_REPORT_PATH";

const VERIFICATION_CHECKS = [
  "migration_apply",
  "temporary_schema_creation",
  "append_sequence_identity",
  "record_type_constraint",
  "diff_report_id_exists",
  "old_replay_diff_report_id_absent",
  "payload_schema_is_jsonb",
  "manifest_round_trip",
  "run_round_trip",
  "report_round_trip",
  "diff_round_trip",
  "payload_runtime_is_jsonb",
  "duplicate_append_retained",
  "internal_row_ids_differ",
  "append_sequence_monotonic",
  "first_match_returns_earliest_payload",
  "tenant_isolation",
  "manifest_source_result_id_explicit_matches_payload",
  "report_replay_run_id_explicit_matches_payload",
  "report_source_result_id_explicit_matches_payload",
  "hash_preservation",
  "settlement_business_constraint_exists",
  "settlement_business_identity_columns_not_null",
  "settlement_business_existing_upgrade",
  "settlement_business_duplicate_upgrade_rejected",
  "settlement_business_duplicate_insert_rejected",
  "settlement_business_different_round_allowed",
  "settlement_business_different_run_allowed",
  "settlement_business_tenant_isolation",
  "settlement_business_null_identity_rejected",
  "settlement_business_technical_id_move_rejected",
  "atomic_outcome_success",
  "atomic_outcome_round_missing",
  "atomic_outcome_run_mismatch",
  "atomic_outcome_round_no_mismatch",
  "atomic_outcome_statement_rollback",
  "atomic_outcome_retry_upsert",
  "truth_chain_tables_unchanged"
] as const;

type VerificationStatus = "passed" | "failed" | "unavailable" | "skipped-with-reason";
type VerificationCheck = (typeof VERIFICATION_CHECKS)[number];

const verificationStartedAt = Date.now();
const verificationChecks = new Map<VerificationCheck, VerificationStatus>(
  VERIFICATION_CHECKS.map((check) => [check, "failed"])
);

let temporarySchemaCleanup: VerificationStatus = "skipped-with-reason";
let databaseClientCleanup: VerificationStatus = "skipped-with-reason";

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

interface SettlementOutcomeRoundRow extends Record<string, unknown> {
  decision_batch_id?: string | null;
  payload: Record<string, unknown>;
  replay_hash?: string | null;
  round_id: string;
  round_no: number | null;
  run_id: string;
  status: string | null;
  tenant_id: string;
}

interface SettlementOutcomeResultRow extends Record<string, unknown> {
  parameter_set_id: string;
  payload: SettlementResult;
  replay_hash: string;
  round_id: string;
  round_no: number;
  run_id: string;
  scenario_package_id: string;
  settlement_result_id: string;
  team_results: SettlementResult["team_results"];
  tenant_id: string;
}

interface MigrationFile {
  name: string;
  sql: string;
}

interface SettlementBusinessIdentityColumnRow extends Record<string, unknown> {
  column_name: string;
  is_nullable: "YES" | "NO";
}

interface SettlementBusinessConstraintRow extends Record<string, unknown> {
  constraint_name: string;
}

interface DirectSettlementResultRow extends Record<string, unknown> {
  parameter_set_id: string;
  payload: SettlementResult;
  replay_hash: string;
  round_id: string;
  round_no: number;
  run_id: string;
  scenario_package_id: string;
  settlement_result_id: string;
  tenant_id: string;
}

let client: PgClient | undefined;
let schemaName = "";
let schemaCreated = false;
let adapter: ReturnType<AdapterFactory>;
let settlementOutcomePort: ReturnType<SettlementOutcomeFactory>;

function markCheckPassed(check: VerificationCheck): void {
  verificationChecks.set(check, "passed");
}

function markChecksPassed(checks: readonly VerificationCheck[]): void {
  for (const check of checks) {
    markCheckPassed(check);
  }
}

function verificationCommandStatus(): VerificationStatus {
  return [...verificationChecks.values()].every((status) => status === "passed") &&
    temporarySchemaCleanup === "passed" &&
    databaseClientCleanup === "passed"
    ? "passed"
    : "failed";
}

async function writeVerificationReport(): Promise<void> {
  const reportPath = process.env[REPORT_PATH_ENV];

  if (reportPath === undefined || reportPath.trim() === "") {
    return;
  }

  const checks = Object.fromEntries(verificationChecks) as Record<
    VerificationCheck,
    VerificationStatus
  >;
  const blockingFailures = new Set(
    Object.entries(checks)
      .filter(([, status]) => status === "failed")
      .map(([name]) => name)
  );

  if (temporarySchemaCleanup === "failed") {
    blockingFailures.add("temporary_schema_cleanup");
  }

  if (databaseClientCleanup === "failed") {
    blockingFailures.add("database_client_cleanup");
  }

  const blockingFailureList = [...blockingFailures];
  const commandStatus = verificationCommandStatus();
  const postgresReplayReady =
    commandStatus === "passed" &&
    temporarySchemaCleanup === "passed" &&
    databaseClientCleanup === "passed";
  const resolvedReportPath = resolve(reportPath);

  await mkdir(dirname(resolvedReportPath), { recursive: true });
  await writeFile(
    resolvedReportPath,
    `${JSON.stringify(
      {
        schema_version: 1,
        branch: process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? "",
        commit: process.env.GITHUB_SHA ?? "",
        base_ref: process.env.GITHUB_BASE_REF ?? "",
        scope: {
          reason: "Scope is not evaluated by the Postgres replay harness",
          status: "unavailable"
        },
        commands: [
          {
            duration_ms: Math.max(0, Date.now() - verificationStartedAt),
            name: "npm run test:postgres-replay",
            status: commandStatus
          }
        ],
        domain_harnesses: {
          postgres_replay: {
            checks,
            status: commandStatus
          }
        },
        cleanup: {
          database_client: databaseClientCleanup,
          temporary_schema: temporarySchemaCleanup
        },
        blocking_failures: blockingFailureList,
        postgres_replay_ready: postgresReplayReady
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

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
  await applyMigrationFilesIntoSchema(pgClient, schema, await readMigrationFiles());
}

async function readMigrationFiles(): Promise<MigrationFile[]> {
  const migrationNames = (await readdir("db/migrations"))
    .filter((name) => /^\d+_[\w-]+\.sql$/.test(name))
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(
    migrationNames.map(async (name) => ({
      name,
      sql: await readFile(join("db/migrations", name), "utf8")
    }))
  );
}

function settlementBusinessIdentityMigration(files: readonly MigrationFile[]): MigrationFile {
  const migration = files.find((file) =>
    file.sql.includes("settlement_results_business_identity_key")
  );

  if (migration === undefined) {
    throw new Error("settlement business identity migration missing");
  }

  return migration;
}

function migrationsBeforeSettlementBusinessIdentity(
  files: readonly MigrationFile[]
): MigrationFile[] {
  const businessMigration = settlementBusinessIdentityMigration(files);

  return files.filter((file) => file.name.localeCompare(businessMigration.name) < 0);
}

async function applyMigrationFilesIntoSchema(
  pgClient: PgClient,
  schema: string,
  files: readonly MigrationFile[]
): Promise<void> {
  if (files.length === 0) {
    throw new Error("No migration files were found");
  }

  await pgClient.query("BEGIN");

  try {
    await pgClient.query(`SET LOCAL search_path TO ${quoteIdentifier(schema)}`);
    for (const file of files) {
      await pgClient.query(file.sql);
    }
    await pgClient.query("COMMIT");
  } catch (error) {
    await pgClient.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function withTemporarySchema<T>(action: (schema: string) => Promise<T>): Promise<T> {
  const schema = createSchemaName();

  await requiredClient().query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);

  try {
    return await action(schema);
  } finally {
    await requiredClient().query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
  }
}

async function expectSettlementBusinessIdentityConstraint(schema: string): Promise<void> {
  const constraintRows = await requiredClient().query<SettlementBusinessConstraintRow>(
    "SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema = $1 AND table_name = 'settlement_results' AND constraint_type = 'UNIQUE' AND constraint_name = 'settlement_results_business_identity_key'",
    [schema]
  );

  if (constraintRows.rows.length !== 1) {
    throw new Error("settlement_results_business_identity_key missing");
  }
}

async function expectSettlementBusinessIdentityColumnsNotNull(schema: string): Promise<void> {
  const columns = await requiredClient().query<SettlementBusinessIdentityColumnRow>(
    "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'settlement_results' AND column_name IN ('tenant_id', 'run_id', 'round_no') ORDER BY column_name ASC",
    [schema]
  );

  const expectedColumns = [
    { column_name: "round_no", is_nullable: "NO" },
    { column_name: "run_id", is_nullable: "NO" },
    { column_name: "tenant_id", is_nullable: "NO" }
  ];

  if (JSON.stringify(columns.rows) !== JSON.stringify(expectedColumns)) {
    throw new Error("settlement_results business identity columns must be NOT NULL");
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

function settlementTeamResults(): SettlementResult["team_results"] {
  return [
    {
      state_est: {
        explanation: "Postgres atomic outcome fixture",
        next_round_risk: "balanced",
        recommended_focus: "keep capacity aligned"
      },
      state_obs: {
        demand_band: "high",
        profit_band: "healthy",
        rank: 1,
        revenue: 1_200_000,
        score: 88,
        served_demand: 95
      },
      state_true: {
        cash_flow: 280_000,
        cost: 850_000,
        demand: 100,
        market_share: 0.42,
        profit: 350_000,
        rank: 1,
        revenue: 1_200_000,
        score: 88,
        served_demand: 95,
        settlement_status: "settled"
      },
      team_id: "team-atomic",
      team_name: "Atomic Team"
    }
  ];
}

function settlementResult(overrides: Partial<SettlementResult> = {}): SettlementResult {
  const id = suffix();

  return {
    parameter_set_id: `parameter-set-${id}`,
    replay_hash: `replay-hash-${id}`,
    round_id: `round-${id}`,
    round_no: 1,
    run_id: `run-${id}`,
    scenario_package_id: `scenario-package-${id}`,
    settlement_result_id: `settlement-${id}`,
    team_results: settlementTeamResults(),
    tenant_id: `tenant-${id}`,
    ...overrides
  };
}

function roundForSettlementResult(result: SettlementResult, overrides: Partial<Round> = {}): Round {
  return {
    round_id: result.round_id,
    round_no: result.round_no,
    run_id: result.run_id,
    status: "locked",
    tenant_id: result.tenant_id,
    ...overrides
  };
}

async function resetSettlementOutcomeTables(): Promise<void> {
  await requiredClient().query("TRUNCATE settlement_results, simulation_rounds, simulation_runs");
}

async function insertSimulationRun(result: SettlementResult): Promise<void> {
  await requiredClient().query(
    "INSERT INTO simulation_runs (id, run_id, tenant_id, course_id, scenario_package_id, parameter_set_id, seed, status, payload) VALUES ($1, $1, $2, $3, $4, $5, $6, 'active', $7::jsonb) ON CONFLICT (run_id) DO NOTHING",
    [
      result.run_id,
      result.tenant_id,
      `course-${suffix()}`,
      result.scenario_package_id,
      result.parameter_set_id,
      12345,
      JSON.stringify({
        run_id: result.run_id,
        tenant_id: result.tenant_id
      })
    ]
  );
}

async function insertSimulationRound(
  round: Round,
  payload: Record<string, unknown> = { ...round, custom_marker: "preserve-me" }
): Promise<void> {
  await requiredClient().query(
    "INSERT INTO simulation_rounds (id, round_id, tenant_id, run_id, round_no, status, decision_batch_id, replay_hash, payload) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)",
    [
      JSON.stringify(["round", round.tenant_id, round.round_id]),
      round.round_id,
      round.tenant_id,
      round.run_id,
      round.round_no,
      round.status,
      round.decision_batch_id ?? null,
      round.replay_hash ?? null,
      JSON.stringify(payload)
    ]
  );
}

async function insertRoundForSettlementResult(
  result: SettlementResult,
  roundOverrides: Partial<Round> = {},
  payload?: Record<string, unknown>
): Promise<Round> {
  await insertSimulationRun(result);
  const round = roundForSettlementResult(result, roundOverrides);
  await insertSimulationRound(round, payload);

  return round;
}

async function fetchAtomicRound(
  tenantId: string,
  roundId: string
): Promise<SettlementOutcomeRoundRow | undefined> {
  const rows = await requiredClient().query<SettlementOutcomeRoundRow>(
    "SELECT tenant_id, round_id, run_id, round_no, status, decision_batch_id, replay_hash, payload FROM simulation_rounds WHERE tenant_id = $1 AND round_id = $2",
    [tenantId, roundId]
  );

  return rows.rows[0];
}

async function fetchAtomicSettlements(
  tenantId: string,
  settlementResultId: string
): Promise<SettlementOutcomeResultRow[]> {
  const rows = await requiredClient().query<SettlementOutcomeResultRow>(
    "SELECT tenant_id, settlement_result_id, run_id, round_id, round_no, parameter_set_id, scenario_package_id, replay_hash, team_results, payload FROM settlement_results WHERE tenant_id = $1 AND settlement_result_id = $2 ORDER BY created_at ASC",
    [tenantId, settlementResultId]
  );

  return rows.rows;
}

function directSettlementResultRow(
  overrides: Partial<DirectSettlementResultRow> = {}
): DirectSettlementResultRow {
  const result = settlementResult(overrides);

  return {
    parameter_set_id: result.parameter_set_id,
    payload: result,
    replay_hash: result.replay_hash,
    round_id: result.round_id,
    round_no: result.round_no,
    run_id: result.run_id,
    scenario_package_id: result.scenario_package_id,
    settlement_result_id: result.settlement_result_id,
    tenant_id: result.tenant_id,
    ...overrides
  };
}

async function insertDirectSettlementResult(
  pgClient: PgClient,
  schema: string,
  row: DirectSettlementResultRow
): Promise<void> {
  await pgClient.query(
    `INSERT INTO ${quoteIdentifier(schema)}.settlement_results (
      id,
      settlement_result_id,
      tenant_id,
      run_id,
      round_id,
      round_no,
      parameter_set_id,
      scenario_package_id,
      replay_hash,
      team_results,
      payload
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)`,
    [
      JSON.stringify(["settlement_result", row.tenant_id, row.settlement_result_id]),
      row.settlement_result_id,
      row.tenant_id,
      row.run_id,
      row.round_id,
      row.round_no,
      row.parameter_set_id,
      row.scenario_package_id,
      row.replay_hash,
      JSON.stringify(row.payload.team_results),
      JSON.stringify(row.payload)
    ]
  );
}

async function fetchDirectSettlementRows(
  pgClient: PgClient,
  schema: string
): Promise<DirectSettlementResultRow[]> {
  const result = await pgClient.query<DirectSettlementResultRow>(
    `SELECT
      settlement_result_id,
      tenant_id,
      run_id,
      round_id,
      round_no,
      parameter_set_id,
      scenario_package_id,
      replay_hash,
      payload
    FROM ${quoteIdentifier(schema)}.settlement_results
    ORDER BY tenant_id ASC, run_id ASC, round_no ASC, settlement_result_id ASC`
  );

  return result.rows;
}

if (process.env.VITEST_WORKER_ID !== undefined) {
  const { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } =
    await import("vitest");

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
      databaseClientCleanup = "failed";
      await client.query(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`);
      schemaCreated = true;
      temporarySchemaCleanup = "failed";
      markCheckPassed("temporary_schema_creation");
      await applyMigrationIntoSchema(client, schemaName);
      markCheckPassed("migration_apply");
      await client.query(`SET search_path TO ${quoteIdentifier(schemaName)}`);

      const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
        const result = await requiredClient().query(sql, params as unknown[]);

        return {
          rowCount: result.rowCount ?? result.rows.length,
          rows: result.rows
        };
      };

      adapter = adapterModule.createPostgresRepositoryAdapter({ queryExecutor });
      settlementOutcomePort = adapterModule.createPostgresSettlementOutcomePersistencePort({
        queryExecutor
      });
    });

    afterAll(async () => {
      let teardownError: unknown;

      try {
        if (client !== undefined) {
          await client.query("SET search_path TO public");

          if (schemaCreated) {
            await client.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schemaName)} CASCADE`);
            temporarySchemaCleanup = "passed";
          }
        }
      } catch (error) {
        teardownError = error;
      }

      if (client !== undefined) {
        try {
          await client.end();
          databaseClientCleanup = "passed";
        } catch (error) {
          databaseClientCleanup = "failed";
          teardownError ??= error;
        }
      }

      try {
        await writeVerificationReport();
      } catch (error) {
        teardownError ??= error;
      }

      if (teardownError !== undefined) {
        throw teardownError;
      }
    });

    it("applies migration and verifies replay_records schema", async () => {
      const tableResult = await requiredClient().query<{ exists: boolean }>(
        "SELECT to_regclass($1) IS NOT NULL AS exists",
        [`${schemaName}.replay_records`]
      );
      expect(tableResult.rows[0]?.exists).toBe(true);
      await expectSettlementBusinessIdentityConstraint(schemaName);
      markCheckPassed("settlement_business_constraint_exists");
      await expectSettlementBusinessIdentityColumnsNotNull(schemaName);
      markCheckPassed("settlement_business_identity_columns_not_null");

      const columns = await requiredClient().query<ReplayRecordSchemaColumn>(
        "SELECT column_name, data_type, is_identity, udt_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'replay_records'",
        [schemaName]
      );
      const byName = new Map(columns.rows.map((column) => [column.column_name, column]));

      expect(byName.get("append_sequence")).toMatchObject({
        data_type: "bigint",
        is_identity: "YES"
      });
      markCheckPassed("append_sequence_identity");
      expect(byName.get("diff_report_id")).toBeDefined();
      markCheckPassed("diff_report_id_exists");
      expect(byName.get("replay_diff_report_id")).toBeUndefined();
      markCheckPassed("old_replay_diff_report_id_absent");
      expect(byName.get("payload")?.udt_name).toBe("jsonb");
      markCheckPassed("payload_schema_is_jsonb");

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
      markCheckPassed("record_type_constraint");
    });

    it("upgrades existing non-duplicate settlement data without rewriting rows", async () => {
      const migrations = await readMigrationFiles();
      const oldMigrations = migrationsBeforeSettlementBusinessIdentity(migrations);
      const businessMigration = settlementBusinessIdentityMigration(migrations);

      await withTemporarySchema(async (upgradeSchema) => {
        await applyMigrationFilesIntoSchema(requiredClient(), upgradeSchema, oldMigrations);
        const first = directSettlementResultRow({
          replay_hash: "replay-hash-upgrade-first",
          round_no: 1,
          run_id: "run-upgrade"
        });
        const second = directSettlementResultRow({
          replay_hash: "replay-hash-upgrade-second",
          round_no: 2,
          run_id: "run-upgrade",
          settlement_result_id: "settlement-upgrade-second",
          tenant_id: first.tenant_id
        });

        await insertDirectSettlementResult(requiredClient(), upgradeSchema, first);
        await insertDirectSettlementResult(requiredClient(), upgradeSchema, second);
        const beforeRows = await fetchDirectSettlementRows(requiredClient(), upgradeSchema);

        await applyMigrationFilesIntoSchema(requiredClient(), upgradeSchema, [businessMigration]);

        await expectSettlementBusinessIdentityConstraint(upgradeSchema);
        expect(await fetchDirectSettlementRows(requiredClient(), upgradeSchema)).toEqual(
          beforeRows
        );
      });

      markCheckPassed("settlement_business_existing_upgrade");
    });

    it("rejects legacy duplicate business identities during upgrade", async () => {
      const migrations = await readMigrationFiles();
      const oldMigrations = migrationsBeforeSettlementBusinessIdentity(migrations);
      const businessMigration = settlementBusinessIdentityMigration(migrations);

      await withTemporarySchema(async (upgradeSchema) => {
        await applyMigrationFilesIntoSchema(requiredClient(), upgradeSchema, oldMigrations);
        const first = directSettlementResultRow({
          replay_hash: "replay-hash-duplicate-first",
          round_no: 1,
          run_id: "run-duplicate",
          settlement_result_id: "settlement-duplicate-first",
          tenant_id: "tenant-duplicate"
        });
        const duplicate = directSettlementResultRow({
          replay_hash: "replay-hash-duplicate-second",
          round_id: "round-duplicate-second",
          round_no: first.round_no,
          run_id: first.run_id,
          settlement_result_id: "settlement-duplicate-second",
          tenant_id: first.tenant_id
        });

        await insertDirectSettlementResult(requiredClient(), upgradeSchema, first);
        await insertDirectSettlementResult(requiredClient(), upgradeSchema, duplicate);
        const beforeRows = await fetchDirectSettlementRows(requiredClient(), upgradeSchema);

        await expect(
          applyMigrationFilesIntoSchema(requiredClient(), upgradeSchema, [businessMigration])
        ).rejects.toThrow("settlement_results_business_identity_duplicate");

        expect(await fetchDirectSettlementRows(requiredClient(), upgradeSchema)).toEqual(
          beforeRows
        );
        const constraints = await requiredClient().query<SettlementBusinessConstraintRow>(
          "SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema = $1 AND table_name = 'settlement_results' AND constraint_name = 'settlement_results_business_identity_key'",
          [upgradeSchema]
        );
        expect(constraints.rows).toHaveLength(0);
      });

      markCheckPassed("settlement_business_duplicate_upgrade_rejected");
    });

    describe("settlement business identity constraint", () => {
      beforeEach(async () => {
        await resetSettlementOutcomeTables();
      });

      afterEach(async () => {
        await resetSettlementOutcomeTables();
      });

      it("rejects a second SettlementResult for the same tenant, run, and round number", async () => {
        const first = directSettlementResultRow({
          replay_hash: "replay-hash-business-first",
          round_no: 1,
          run_id: "run-business",
          settlement_result_id: "settlement-business-first",
          tenant_id: "tenant-business"
        });
        const duplicate = directSettlementResultRow({
          replay_hash: "replay-hash-business-second",
          round_id: "round-business-second",
          round_no: first.round_no,
          run_id: first.run_id,
          settlement_result_id: "settlement-business-second",
          tenant_id: first.tenant_id
        });

        await insertDirectSettlementResult(requiredClient(), schemaName, first);
        await expect(
          insertDirectSettlementResult(requiredClient(), schemaName, duplicate)
        ).rejects.toThrow();

        expect(await fetchDirectSettlementRows(requiredClient(), schemaName)).toEqual([first]);
        markCheckPassed("settlement_business_duplicate_insert_rejected");
      });

      it("allows distinct business settlement identities", async () => {
        const base = directSettlementResultRow({
          round_no: 1,
          run_id: "run-identity",
          settlement_result_id: "settlement-identity-base",
          tenant_id: "tenant-identity"
        });
        const differentRound = directSettlementResultRow({
          round_id: "round-identity-2",
          round_no: 2,
          run_id: base.run_id,
          settlement_result_id: "settlement-identity-round-2",
          tenant_id: base.tenant_id
        });
        const differentRun = directSettlementResultRow({
          round_id: "round-identity-run-2",
          round_no: base.round_no,
          run_id: "run-identity-2",
          settlement_result_id: "settlement-identity-run-2",
          tenant_id: base.tenant_id
        });
        const differentTenant = directSettlementResultRow({
          round_id: "round-identity-tenant-2",
          round_no: base.round_no,
          run_id: base.run_id,
          settlement_result_id: "settlement-identity-tenant-2",
          tenant_id: "tenant-identity-2"
        });

        await insertDirectSettlementResult(requiredClient(), schemaName, base);
        await insertDirectSettlementResult(requiredClient(), schemaName, differentRound);
        await insertDirectSettlementResult(requiredClient(), schemaName, differentRun);
        await insertDirectSettlementResult(requiredClient(), schemaName, differentTenant);

        expect(await fetchDirectSettlementRows(requiredClient(), schemaName)).toEqual([
          base,
          differentRound,
          differentRun,
          differentTenant
        ]);
        markChecksPassed([
          "settlement_business_different_round_allowed",
          "settlement_business_different_run_allowed",
          "settlement_business_tenant_isolation"
        ]);
      });

      it("does not allow NULL business identity values to bypass uniqueness", async () => {
        const row = directSettlementResultRow({
          round_no: 1,
          run_id: "run-null",
          settlement_result_id: "settlement-null",
          tenant_id: "tenant-null"
        });

        await expect(
          requiredClient().query(
            `INSERT INTO ${quoteIdentifier(schemaName)}.settlement_results (
              id,
              settlement_result_id,
              tenant_id,
              run_id,
              round_id,
              round_no,
              parameter_set_id,
              scenario_package_id,
              replay_hash,
              team_results,
              payload
            ) VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)`,
            [
              JSON.stringify(["settlement_result", row.tenant_id, row.settlement_result_id]),
              row.settlement_result_id,
              row.tenant_id,
              row.round_id,
              row.round_no,
              row.parameter_set_id,
              row.scenario_package_id,
              row.replay_hash,
              JSON.stringify(row.payload.team_results),
              JSON.stringify(row.payload)
            ]
          )
        ).rejects.toThrow();

        expect(await fetchDirectSettlementRows(requiredClient(), schemaName)).toEqual([]);
        markCheckPassed("settlement_business_null_identity_rejected");
      });
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
      markCheckPassed("manifest_round_trip");
      expect(await adapter.replay.getReplayRun(run.tenant_id, run.replay_run_id)).toEqual(run);
      markCheckPassed("run_round_trip");
      expect(
        await adapter.replay.getReplayReport(report.tenant_id, report.replay_report_id)
      ).toEqual(report);
      markCheckPassed("report_round_trip");
      expect(await adapter.replay.getReplayDiffReport(diff.tenant_id, diff.diff_report_id)).toEqual(
        diff
      );
      markCheckPassed("diff_round_trip");

      const payloadType = await requiredClient().query<{ payload_type: string }>(
        "SELECT pg_typeof(payload)::text AS payload_type FROM replay_records WHERE manifest_id = $1",
        [manifest.manifest_id]
      );
      expect(payloadType.rows[0]?.payload_type).toBe("jsonb");
      markCheckPassed("payload_runtime_is_jsonb");
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
      markCheckPassed("duplicate_append_retained");
      expect(rows.rows[0]?.id).not.toBe(rows.rows[1]?.id);
      markCheckPassed("internal_row_ids_differ");
      expect(rows.rows[0]?.manifest_id).toBe(manifestId);
      expect(rows.rows[1]?.manifest_id).toBe(manifestId);
      expect(appendSequence(rows.rows[1]!.append_sequence)).toBeGreaterThan(
        appendSequence(rows.rows[0]!.append_sequence)
      );
      markCheckPassed("append_sequence_monotonic");
      expect(rows.rows[0]?.payload).toEqual(first);
      expect(rows.rows[1]?.payload).toEqual(second);

      const found = await adapter.replay.getReplayInputManifest(first.tenant_id, manifestId);
      expect(found).toEqual(rows.rows[0]?.payload);
      expect(found).toEqual(first);
      markCheckPassed("first_match_returns_earliest_payload");
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
      markCheckPassed("tenant_isolation");
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
      markCheckPassed("manifest_source_result_id_explicit_matches_payload");

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
      markChecksPassed([
        "report_replay_run_id_explicit_matches_payload",
        "report_source_result_id_explicit_matches_payload",
        "hash_preservation"
      ]);
    });

    describe("atomic settlement outcome persistence", () => {
      beforeEach(async () => {
        await resetSettlementOutcomeTables();
      });

      afterEach(async () => {
        await resetSettlementOutcomeTables();
      });

      it("commits a SettlementResult and Round marker atomically", async () => {
        const result = settlementResult({ replay_hash: "replay-hash-success" });
        const originalResult = structuredClone(result);
        const round = await insertRoundForSettlementResult(result, {
          decision_batch_id: "decision-batch-success",
          replay_hash: "old-round-hash",
          status: "locked"
        });

        await expect(
          settlementOutcomePort.commitSettlementOutcome({
            round_id: result.round_id,
            settlement_result: result,
            tenant_id: result.tenant_id
          })
        ).resolves.toEqual({
          settlement_result: result,
          status: "committed"
        });

        const settlements = await fetchAtomicSettlements(
          result.tenant_id,
          result.settlement_result_id
        );
        expect(settlements).toHaveLength(1);
        expect(settlements[0]).toMatchObject({
          parameter_set_id: result.parameter_set_id,
          replay_hash: result.replay_hash,
          round_id: result.round_id,
          round_no: result.round_no,
          run_id: result.run_id,
          scenario_package_id: result.scenario_package_id,
          settlement_result_id: result.settlement_result_id,
          tenant_id: result.tenant_id
        });
        expect(settlements[0]?.team_results).toEqual(result.team_results);
        expect(settlements[0]?.payload).toEqual(result);

        const committedRound = await fetchAtomicRound(result.tenant_id, result.round_id);
        expect(committedRound).toMatchObject({
          decision_batch_id: round.decision_batch_id,
          replay_hash: result.replay_hash,
          round_id: result.round_id,
          round_no: result.round_no,
          run_id: result.run_id,
          status: "settled",
          tenant_id: result.tenant_id
        });
        expect(committedRound?.payload.status).toBe("settled");
        expect(committedRound?.payload.replay_hash).toBe(result.replay_hash);
        expect(committedRound?.payload.custom_marker).toBe("preserve-me");
        expect(committedRound?.payload.run_id).toBe(result.run_id);
        expect(committedRound?.payload.round_no).toBe(result.round_no);
        expect(result).toEqual(originalResult);
        markCheckPassed("atomic_outcome_success");
      });

      it("rejects missing target Rounds without inserting SettlementResults", async () => {
        const result = settlementResult();

        await expect(
          settlementOutcomePort.commitSettlementOutcome({
            round_id: result.round_id,
            settlement_result: result,
            tenant_id: result.tenant_id
          })
        ).rejects.toThrow("settlement_outcome_round_missing");

        expect(
          await fetchAtomicSettlements(result.tenant_id, result.settlement_result_id)
        ).toHaveLength(0);
        expect(await fetchAtomicRound(result.tenant_id, result.round_id)).toBeUndefined();
        markCheckPassed("atomic_outcome_round_missing");
      });

      it("rejects target Round run mismatches without partial writes", async () => {
        const result = settlementResult({ run_id: `result-run-${suffix()}` });
        const persistedRound = await insertRoundForSettlementResult(result, {
          replay_hash: "old-run-mismatch-hash",
          run_id: `database-run-${suffix()}`,
          status: "locked"
        });
        const beforeRound = await fetchAtomicRound(result.tenant_id, result.round_id);

        await expect(
          settlementOutcomePort.commitSettlementOutcome({
            round_id: result.round_id,
            settlement_result: result,
            tenant_id: result.tenant_id
          })
        ).rejects.toThrow("settlement_outcome_run_mismatch");

        expect(
          await fetchAtomicSettlements(result.tenant_id, result.settlement_result_id)
        ).toHaveLength(0);
        const afterRound = await fetchAtomicRound(result.tenant_id, result.round_id);
        expect(afterRound).toEqual(beforeRound);
        expect(afterRound?.run_id).toBe(persistedRound.run_id);
        expect(afterRound?.status).toBe("locked");
        expect(afterRound?.replay_hash).toBe("old-run-mismatch-hash");
        markCheckPassed("atomic_outcome_run_mismatch");
      });

      it("rejects target Round number mismatches without partial writes", async () => {
        const result = settlementResult({ round_no: 9 });
        await insertRoundForSettlementResult(result, {
          replay_hash: "old-round-number-hash",
          round_no: 1,
          status: "locked"
        });
        const beforeRound = await fetchAtomicRound(result.tenant_id, result.round_id);

        await expect(
          settlementOutcomePort.commitSettlementOutcome({
            round_id: result.round_id,
            settlement_result: result,
            tenant_id: result.tenant_id
          })
        ).rejects.toThrow("settlement_outcome_round_no_mismatch");

        expect(
          await fetchAtomicSettlements(result.tenant_id, result.settlement_result_id)
        ).toHaveLength(0);
        expect(await fetchAtomicRound(result.tenant_id, result.round_id)).toEqual(beforeRound);
        markCheckPassed("atomic_outcome_round_no_mismatch");
      });

      it("rolls back the SettlementResult insert when the Round update fails", async () => {
        const result = settlementResult({ replay_hash: "replay-hash-rollback" });
        await insertRoundForSettlementResult(result, {
          replay_hash: "old-rollback-hash",
          status: "locked"
        });
        const beforeRound = await fetchAtomicRound(result.tenant_id, result.round_id);

        await requiredClient().query(`
          CREATE OR REPLACE FUNCTION fail_atomic_outcome_round_update()
          RETURNS trigger
          LANGUAGE plpgsql
          AS $$
          BEGIN
            RAISE EXCEPTION 'forced atomic outcome round update failure';
          END;
          $$
        `);
        await requiredClient().query(`
          CREATE TRIGGER fail_atomic_outcome_round_update
          BEFORE UPDATE ON simulation_rounds
          FOR EACH ROW
          EXECUTE FUNCTION fail_atomic_outcome_round_update()
        `);

        try {
          await expect(
            settlementOutcomePort.commitSettlementOutcome({
              round_id: result.round_id,
              settlement_result: result,
              tenant_id: result.tenant_id
            })
          ).rejects.toThrow("forced atomic outcome round update failure");
        } finally {
          await requiredClient().query(
            "DROP TRIGGER IF EXISTS fail_atomic_outcome_round_update ON simulation_rounds"
          );
          await requiredClient().query(
            "DROP FUNCTION IF EXISTS fail_atomic_outcome_round_update()"
          );
        }

        expect(
          await fetchAtomicSettlements(result.tenant_id, result.settlement_result_id)
        ).toHaveLength(0);
        expect(await fetchAtomicRound(result.tenant_id, result.round_id)).toEqual(beforeRound);
        markCheckPassed("atomic_outcome_statement_rollback");
      });

      it("upserts repeated settlement_result_id commits without duplicate rows", async () => {
        const result = settlementResult({ replay_hash: "replay-hash-first" });
        await insertRoundForSettlementResult(result);
        const replacement = {
          ...result,
          parameter_set_id: "parameter-set-replacement",
          replay_hash: "replay-hash-replacement",
          team_results: [
            {
              ...result.team_results[0]!,
              state_true: {
                ...result.team_results[0]!.state_true,
                score: 91
              }
            }
          ]
        } satisfies SettlementResult;

        await settlementOutcomePort.commitSettlementOutcome({
          round_id: result.round_id,
          settlement_result: result,
          tenant_id: result.tenant_id
        });
        await settlementOutcomePort.commitSettlementOutcome({
          round_id: replacement.round_id,
          settlement_result: replacement,
          tenant_id: replacement.tenant_id
        });

        const settlements = await fetchAtomicSettlements(
          result.tenant_id,
          result.settlement_result_id
        );
        expect(settlements).toHaveLength(1);
        expect(settlements[0]?.parameter_set_id).toBe(replacement.parameter_set_id);
        expect(settlements[0]?.replay_hash).toBe(replacement.replay_hash);
        expect(settlements[0]?.payload).toEqual(replacement);
        const committedRound = await fetchAtomicRound(result.tenant_id, result.round_id);
        expect(committedRound?.status).toBe("settled");
        expect(committedRound?.replay_hash).toBe(replacement.replay_hash);
        expect(committedRound?.payload.replay_hash).toBe(replacement.replay_hash);
        markCheckPassed("atomic_outcome_retry_upsert");
      });

      it("rejects reusing the same technical result id for a different business identity", async () => {
        const result = settlementResult({
          replay_hash: "replay-hash-original",
          round_no: 1,
          run_id: "run-technical-identity",
          settlement_result_id: "settlement-technical-identity",
          tenant_id: "tenant-technical-identity"
        });
        const movedResult = {
          ...result,
          replay_hash: "replay-hash-moved",
          round_id: "round-technical-identity-moved",
          round_no: 2,
          run_id: "run-technical-identity-moved"
        } satisfies SettlementResult;
        await insertRoundForSettlementResult(result, {
          replay_hash: "old-original-round-hash",
          status: "locked"
        });
        await insertRoundForSettlementResult(movedResult, {
          replay_hash: "old-moved-round-hash",
          status: "locked"
        });

        await settlementOutcomePort.commitSettlementOutcome({
          round_id: result.round_id,
          settlement_result: result,
          tenant_id: result.tenant_id
        });
        const firstRoundAfterCommit = await fetchAtomicRound(result.tenant_id, result.round_id);
        const movedRoundBeforeConflict = await fetchAtomicRound(
          movedResult.tenant_id,
          movedResult.round_id
        );

        await expect(
          settlementOutcomePort.commitSettlementOutcome({
            round_id: movedResult.round_id,
            settlement_result: movedResult,
            tenant_id: movedResult.tenant_id
          })
        ).rejects.toThrow("settlement_outcome_persistence_invariant_failed");

        const settlements = await fetchAtomicSettlements(
          result.tenant_id,
          result.settlement_result_id
        );
        expect(settlements).toHaveLength(1);
        expect(settlements[0]).toMatchObject({
          replay_hash: result.replay_hash,
          round_id: result.round_id,
          round_no: result.round_no,
          run_id: result.run_id,
          settlement_result_id: result.settlement_result_id,
          tenant_id: result.tenant_id
        });
        expect(settlements[0]?.payload).toEqual(result);
        expect(await fetchAtomicRound(result.tenant_id, result.round_id)).toEqual(
          firstRoundAfterCommit
        );
        expect(await fetchAtomicRound(movedResult.tenant_id, movedResult.round_id)).toEqual(
          movedRoundBeforeConflict
        );
        markCheckPassed("settlement_business_technical_id_move_rejected");
      });
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
      markCheckPassed("truth_chain_tables_unchanged");
    });
  });
}
