import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

const databaseUrl = process.env.SIMWAR_TEST_DATABASE_URL;
if (databaseUrl === undefined || databaseUrl.trim() === "") {
  throw new Error("SIMWAR_TEST_DATABASE_URL is required for W015 PostgreSQL verification");
}

type Migration = { name: string; sql: string };

const migrationRoot = join(process.cwd(), "db", "migrations");
const rootClient = new Client({ connectionString: databaseUrl });
let rootSchema = "";

function quoteIdentifier(identifier: string): string {
  if (!/^w015_[a-f0-9]{32}$/.test(identifier)) {
    throw new Error(`unsafe identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

async function readMigrations(): Promise<Migration[]> {
  const names = (await readdir(migrationRoot))
    .filter((name) => /^\d+_[\w-]+\.sql$/.test(name))
    .sort((left, right) => left.localeCompare(right));
  return Promise.all(
    names.map(async (name) => ({ name, sql: await readFile(join(migrationRoot, name), "utf8") }))
  );
}

async function createSchema(client: Client): Promise<string> {
  const schema = `w015_${randomUUID().replaceAll("-", "")}`;
  await client.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
  return schema;
}

async function dropSchema(client: Client, schema: string): Promise<void> {
  await client.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
}

async function applyMigrations(
  client: Client,
  schema: string,
  migrations: readonly Migration[]
): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(`SET LOCAL search_path TO ${quoteIdentifier(schema)}`);
    for (const migration of migrations) {
      await client.query(migration.sql);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function useSchema(client: Client, schema: string): Promise<void> {
  await client.query(`SET search_path TO ${quoteIdentifier(schema)}`);
}

async function insertCourse(client: Client, tenantId: string, courseId: string): Promise<void> {
  await client.query(
    "INSERT INTO courses (id, course_id, tenant_id, status) VALUES ($1, $1, $2, 'published')",
    [courseId, tenantId]
  );
}

async function insertRun(
  client: Client,
  tenantId: string,
  runId: string,
  courseId: string
): Promise<void> {
  await client.query(
    "INSERT INTO simulation_runs (id, run_id, tenant_id, course_id, scenario_package_id, parameter_set_id, seed, status) VALUES ($1, $1, $2, $3, $4, $5, 1, 'active')",
    [runId, tenantId, courseId, `scenario-${runId}`, `parameter-${runId}`]
  );
}

async function insertRound(
  client: Client,
  tenantId: string,
  runId: string,
  roundId: string,
  roundNo = 1
): Promise<void> {
  await client.query(
    "INSERT INTO simulation_rounds (id, round_id, tenant_id, run_id, round_no, status) VALUES ($1, $2, $3, $4, $5, 'open')",
    [roundId, roundId, tenantId, runId, roundNo]
  );
}

async function insertDecision(
  client: Client,
  tenantId: string,
  runId: string,
  roundId: string,
  decisionId = `decision-${randomUUID()}`
): Promise<void> {
  await client.query(
    "INSERT INTO decisions (id, decision_id, tenant_id, run_id, round_id, round_no, team_id, version, submitted_by, status) VALUES ($1, $1, $2, $3, $4, 1, $5, 1, $6, 'canonical')",
    [decisionId, tenantId, runId, roundId, `team-${decisionId}`, `user-${decisionId}`]
  );
}

async function insertSettlement(
  client: Client,
  tenantId: string,
  runId: string,
  roundId: string,
  resultId = `result-${randomUUID()}`,
  roundNo = 1
): Promise<void> {
  await client.query(
    "INSERT INTO settlement_results (id, settlement_result_id, tenant_id, run_id, round_id, round_no, parameter_set_id, scenario_package_id, replay_hash) VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8)",
    [
      resultId,
      tenantId,
      runId,
      roundId,
      roundNo,
      `parameter-${runId}`,
      `scenario-${runId}`,
      `hash-${resultId}`
    ]
  );
}

async function insertReplay(
  client: Client,
  tenantId: string,
  runId: string | null,
  roundId: string | null,
  sourceResultId: string | null = null,
  id = `replay-${randomUUID()}`
): Promise<void> {
  await client.query(
    "INSERT INTO replay_records (id, tenant_id, run_id, round_id, record_type, source_result_id, payload) VALUES ($1, $2, $3, $4, 'manifest', $5, '{}'::jsonb)",
    [id, tenantId, runId, roundId, sourceResultId]
  );
}

async function expectConstraint(action: () => Promise<unknown>, constraint: string): Promise<void> {
  try {
    await action();
    throw new Error(`expected constraint ${constraint} to reject`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("expected constraint")) {
      throw error;
    }
    expect((error as { constraint?: string }).constraint).toBe(constraint);
  }
}

async function constraintCount(client: Client, names: readonly string[]): Promise<number> {
  const result = await client.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM pg_constraint WHERE conname = ANY($1::text[])",
    [names]
  );
  return Number(result.rows[0]?.count ?? -1);
}

const newConstraintNames = [
  "simulation_runs_tenant_run_key",
  "simulation_rounds_tenant_run_round_key",
  "settlement_results_tenant_run_round_result_key",
  "simulation_runs_course_fk",
  "simulation_rounds_run_fk",
  "decisions_run_fk",
  "decisions_round_run_fk",
  "settlement_results_run_fk",
  "settlement_results_round_run_fk",
  "replay_records_run_round_null_policy",
  "replay_records_source_result_null_policy",
  "replay_records_run_fk",
  "replay_records_round_run_fk",
  "replay_records_source_settlement_fk"
] as const;

describe("W015 T4-F2 PostgreSQL tenant-scoped referential integrity", () => {
  let migrations: Migration[];

  beforeAll(async () => {
    migrations = await readMigrations();
    await rootClient.connect();
    rootSchema = await createSchema(rootClient);
    await applyMigrations(rootClient, rootSchema, migrations);
    await useSchema(rootClient, rootSchema);
  });

  afterAll(async () => {
    if (rootSchema !== "") {
      await dropSchema(rootClient, rootSchema);
    }
    await rootClient.end();
  });

  it("applies the empty database migration and exposes all required constraints", async () => {
    expect(migrations.map(({ name }) => name)).toEqual([
      "0001_initial_repository_schema.sql",
      "0002_add_settlement_business_identity_constraint.sql",
      "0003_add_course_memberships.sql",
      "0004_add_settlement_fingerprint.sql",
      "0005_tenant_scoped_referential_integrity.sql"
    ]);
    expect(await constraintCount(rootClient, newConstraintNames)).toBe(newConstraintNames.length);
    const teamTable = await rootClient.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'teams'"
    );
    expect(teamTable.rows).toHaveLength(0);
  });

  it("supports the same-tenant course-to-replay flow", async () => {
    const tenantId = `tenant-positive-${randomUUID()}`;
    const courseId = `course-positive-${randomUUID()}`;
    const runId = `run-positive-${randomUUID()}`;
    const roundId = `round-positive-${randomUUID()}`;
    const resultId = `result-positive-${randomUUID()}`;

    await insertCourse(rootClient, tenantId, courseId);
    await insertRun(rootClient, tenantId, runId, courseId);
    await insertRound(rootClient, tenantId, runId, roundId);
    await insertDecision(rootClient, tenantId, runId, roundId);
    await insertSettlement(rootClient, tenantId, runId, roundId, resultId);
    await insertReplay(rootClient, tenantId, runId, roundId, resultId);

    const result = await rootClient.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM replay_records WHERE tenant_id = $1 AND source_result_id = $2",
      [tenantId, resultId]
    );
    expect(Number(result.rows[0]?.count)).toBe(1);
  });

  it("rejects cross-tenant, cross-run, update and destructive-history operations", async () => {
    const tenantA = `tenant-a-${randomUUID()}`;
    const tenantB = `tenant-b-${randomUUID()}`;
    const courseA = `course-a-${randomUUID()}`;
    const courseB = `course-b-${randomUUID()}`;
    const runA = `run-a-${randomUUID()}`;
    const runB = `run-b-${randomUUID()}`;
    const roundA = `round-a-${randomUUID()}`;
    const roundB = `round-b-${randomUUID()}`;
    const resultA = `result-a-${randomUUID()}`;

    await insertCourse(rootClient, tenantA, courseA);
    await insertCourse(rootClient, tenantB, courseB);
    await insertRun(rootClient, tenantA, runA, courseA);
    await insertRun(rootClient, tenantB, runB, courseB);
    await insertRound(rootClient, tenantA, runA, roundA);
    await insertRound(rootClient, tenantB, runB, roundB);
    await insertSettlement(rootClient, tenantA, runA, roundA, resultA);

    await expectConstraint(
      () => insertRun(rootClient, tenantA, `run-cross-course-${randomUUID()}`, courseB),
      "simulation_runs_course_fk"
    );
    await expectConstraint(
      () => insertRound(rootClient, tenantA, runB, `round-cross-run-${randomUUID()}`),
      "simulation_rounds_run_fk"
    );
    await expectConstraint(
      () => insertDecision(rootClient, tenantA, runA, roundB),
      "decisions_round_run_fk"
    );
    await expectConstraint(
      () =>
        insertSettlement(
          rootClient,
          tenantA,
          runA,
          roundB,
          `result-cross-round-${randomUUID()}`,
          2
        ),
      "settlement_results_round_run_fk"
    );
    await expectConstraint(
      () => insertReplay(rootClient, tenantA, runA, roundB, resultA),
      "replay_records_round_run_fk"
    );
    await expectConstraint(
      () =>
        rootClient.query("DELETE FROM courses WHERE tenant_id = $1 AND course_id = $2", [
          tenantA,
          courseA
        ]),
      "simulation_runs_course_fk"
    );
    await expectConstraint(
      () =>
        rootClient.query(
          "UPDATE simulation_runs SET course_id = $1 WHERE tenant_id = $2 AND run_id = $3",
          [courseB, tenantA, runA]
        ),
      "simulation_runs_course_fk"
    );
  });

  it("rejects partial nullable replay references and permits the all-null form", async () => {
    const tenantId = `tenant-null-${randomUUID()}`;
    await insertReplay(rootClient, tenantId, null, null);
    await expectConstraint(
      () => insertReplay(rootClient, tenantId, "missing-run", null),
      "replay_records_run_round_null_policy"
    );
    await expectConstraint(
      () => insertReplay(rootClient, tenantId, null, null, "missing-result"),
      "replay_records_source_result_null_policy"
    );
  });

  it("prevents a race from committing a child after the parent transaction rolls back", async () => {
    const writerA = new Client({ connectionString: databaseUrl });
    const writerB = new Client({ connectionString: databaseUrl });
    const tenantId = `tenant-race-${randomUUID()}`;
    const courseId = `course-race-${randomUUID()}`;
    const runId = `run-race-${randomUUID()}`;
    await writerA.connect();
    await writerB.connect();
    try {
      await useSchema(writerA, rootSchema);
      await useSchema(writerB, rootSchema);
      await writerA.query("BEGIN");
      await writerA.query(
        "INSERT INTO courses (id, course_id, tenant_id, status) VALUES ($1, $1, $2, 'published')",
        [courseId, tenantId]
      );
      await writerB.query("BEGIN");
      const childInsert = writerB.query(
        "INSERT INTO simulation_runs (id, run_id, tenant_id, course_id, scenario_package_id, parameter_set_id, seed, status) VALUES ($1, $1, $2, $3, 'scenario-race', 'parameter-race', 1, 'active')",
        [runId, tenantId, courseId]
      );
      await writerA.query("ROLLBACK");
      await expect(childInsert).rejects.toMatchObject({ constraint: "simulation_runs_course_fk" });
      await writerB.query("ROLLBACK").catch(() => undefined);
    } finally {
      await writerA.end();
      await writerB.end();
    }
  });

  it("fails closed before mutation when a previous-level database contains an orphan", async () => {
    const schema = await createSchema(rootClient);
    try {
      await applyMigrations(rootClient, schema, migrations.slice(0, 4));
      await useSchema(rootClient, schema);
      await insertCourse(rootClient, "tenant-preflight", "course-valid");
      await insertRun(rootClient, "tenant-preflight", "run-orphan", "course-missing");
      const beforeRows = await rootClient.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM simulation_runs"
      );
      const beforeConstraints = await constraintCount(rootClient, newConstraintNames);

      await expect(applyMigrations(rootClient, schema, migrations.slice(4))).rejects.toThrow(
        "w015_preflight_orphan_run_course"
      );

      await useSchema(rootClient, schema);
      const afterRows = await rootClient.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM simulation_runs"
      );
      expect(afterRows.rows[0]?.count).toBe(beforeRows.rows[0]?.count);
      expect(await constraintCount(rootClient, newConstraintNames)).toBe(beforeConstraints);
    } finally {
      await dropSchema(rootClient, schema);
      await useSchema(rootClient, rootSchema);
    }
  });
});
