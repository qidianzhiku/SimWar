import { describe, expect, it } from "vitest";
import type { Decision, Round, Run } from "@simwar/shared-contracts";
import type { RepositoryCourseReadModel } from "../../services/api/src/repository-ports.js";
import {
  createPostgresRepositoryAdapter,
  PostgresRepositoryAdapter,
  type PostgresQueryExecutor,
  type PostgresQueryResult
} from "../../services/api/src/postgres-repository-adapter.js";

describe("Postgres repository adapter skeleton", () => {
  interface CourseRow extends Record<string, unknown> {
    course_id: string;
    status?: string;
    tenant_id: string;
  }

  interface UserRow extends Record<string, unknown> {
    user_id: string;
  }

  interface RunRow extends Record<string, unknown> {
    course_id: string;
    parameter_set_id: string;
    run_id: string;
    scenario_package_id: string;
    seed: number;
    status: Run["status"];
    tenant_id: string;
  }

  interface RoundRow extends Record<string, unknown> {
    decision_batch_id?: string | null;
    replay_hash?: string | null;
    round_id: string;
    round_no: number;
    run_id: string;
    status: Round["status"];
    tenant_id: string;
  }

  interface DecisionRow extends Record<string, unknown> {
    canonical_source?: Decision["canonical_source"] | null;
    decision_id: string;
    merge_commit_id?: string | null;
    payload: Decision["payload"];
    round_id: string;
    round_no: number;
    run_id: string;
    status: Decision["status"];
    submitted_by: string;
    team_confirmation_id?: string | null;
    team_id: string;
    tenant_id: string;
    validation_report: Decision["validation_report"];
    version: number;
  }

  it("keeps the query executor boundary callable with SQL and params only", async () => {
    interface ProbeRow extends Record<string, unknown> {
      firstParam: unknown;
      sql: string;
    }

    const queryExecutor: PostgresQueryExecutor = async (
      sql,
      params
    ): Promise<PostgresQueryResult<ProbeRow>> => ({
      rowCount: 1,
      rows: [
        {
          firstParam: params?.[0],
          sql
        }
      ]
    });

    await expect(
      queryExecutor<ProbeRow>("select $1::text as tenant_id", ["tenant-1"])
    ).resolves.toEqual({
      rowCount: 1,
      rows: [
        {
          firstParam: "tenant-1",
          sql: "select $1::text as tenant_id"
        }
      ]
    });
  });

  it("constructs without running database queries or repository port behavior", () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 0,
        rows: []
      };
    };

    const adapter = createPostgresRepositoryAdapter({
      applicationName: "unit-test",
      queryExecutor,
      schema: "public"
    });

    expect(adapter).toBeInstanceOf(PostgresRepositoryAdapter);
    expect(adapter.queryExecutor).toBe(queryExecutor);
    expect(adapter.options).toEqual({
      applicationName: "unit-test",
      queryExecutor,
      schema: "public"
    });
    expect(calls).toEqual([]);
  });

  it("queryRows delegates to the injected executor and returns rows", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const rows: CourseRow[] = [
      {
        course_id: "course-1",
        tenant_id: "tenant-1"
      },
      {
        course_id: "course-2",
        tenant_id: "tenant-1"
      }
    ];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: rows.length,
        rows
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(
      adapter.queryRows<CourseRow>("select * from courses where tenant_id = $1", ["tenant-1"])
    ).resolves.toEqual(rows);
    expect(calls).toEqual([
      {
        params: ["tenant-1"],
        sql: "select * from courses where tenant_id = $1"
      }
    ]);
  });

  it("queryOne returns the first row when rows are present", async () => {
    const rows: CourseRow[] = [
      {
        course_id: "course-1",
        tenant_id: "tenant-1"
      },
      {
        course_id: "course-2",
        tenant_id: "tenant-1"
      }
    ];
    const queryExecutor: PostgresQueryExecutor = async () => ({
      rowCount: rows.length,
      rows
    });
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.queryOne<CourseRow>("select * from courses")).resolves.toEqual(rows[0]);
  });

  it("queryOne returns null when no rows are present", async () => {
    const queryExecutor: PostgresQueryExecutor = async () => ({
      rowCount: 0,
      rows: []
    });
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.queryOne<CourseRow>("select * from courses")).resolves.toBeNull();
  });

  it("execute delegates to the injected executor and returns rowCount", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 2,
        rows: []
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(
      adapter.execute("update courses set status = $1 where tenant_id = $2", [
        "archived",
        "tenant-1"
      ])
    ).resolves.toEqual({
      rowCount: 2
    });
    expect(calls).toEqual([
      {
        params: ["archived", "tenant-1"],
        sql: "update courses set status = $1 where tenant_id = $2"
      }
    ]);
  });

  it("courses.getCourse delegates through the injected executor and returns a read model", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const row: RepositoryCourseReadModel = {
      course_id: "course-1",
      status: "published",
      tenant_id: "tenant-1"
    };
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: [row]
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.courses.getCourse("tenant-1", "course-1")).resolves.toEqual(row);
    expect(calls).toEqual([
      {
        params: ["tenant-1", "course-1"],
        sql: "SELECT tenant_id, course_id, status FROM courses WHERE tenant_id = $1 AND course_id = $2"
      }
    ]);
  });

  it("courses.getCourse returns null when no row exists", async () => {
    const queryExecutor: PostgresQueryExecutor = async () => ({
      rowCount: 0,
      rows: []
    });
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.courses.getCourse("tenant-1", "missing-course")).resolves.toBeNull();
  });

  it("courses.listCoursesForUser checks user existence before listing courses", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const rows: RepositoryCourseReadModel[] = [
      {
        course_id: "course-1",
        status: "published",
        tenant_id: "tenant-1"
      },
      {
        course_id: "course-2",
        status: "draft",
        tenant_id: "tenant-1"
      }
    ];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });

      if (sql.startsWith("SELECT user_id FROM users")) {
        return {
          rowCount: 1,
          rows: [
            {
              user_id: "user-1"
            } satisfies UserRow
          ]
        };
      }

      return {
        rowCount: rows.length,
        rows
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.courses.listCoursesForUser("tenant-1", "user-1")).resolves.toEqual(rows);
    expect(calls).toEqual([
      {
        params: ["tenant-1", "user-1"],
        sql: "SELECT user_id FROM users WHERE tenant_id = $1 AND user_id = $2"
      },
      {
        params: ["tenant-1"],
        sql: "SELECT tenant_id, course_id, status FROM courses WHERE tenant_id = $1 ORDER BY created_at ASC, course_id ASC"
      }
    ]);
  });

  it("courses.listCoursesForUser returns an empty list and skips course lookup when user is missing", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });

      return {
        rowCount: 0,
        rows: []
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.courses.listCoursesForUser("tenant-1", "missing-user")).resolves.toEqual(
      []
    );
    expect(calls).toEqual([
      {
        params: ["tenant-1", "missing-user"],
        sql: "SELECT user_id FROM users WHERE tenant_id = $1 AND user_id = $2"
      }
    ]);
  });

  it("runs.getRun delegates through the injected executor and returns a full Run", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const row: RunRow = {
      course_id: "course-1",
      parameter_set_id: "param-1",
      run_id: "run-1",
      scenario_package_id: "scenario-1",
      seed: 20260517,
      status: "active",
      tenant_id: "tenant-1"
    };
    const expected: Run = { ...row };
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: [row]
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.runs.getRun("tenant-1", "run-1")).resolves.toEqual(expected);
    expect(calls).toEqual([
      {
        params: ["tenant-1", "run-1"],
        sql: "SELECT tenant_id, run_id, course_id, scenario_package_id, parameter_set_id, seed, status FROM simulation_runs WHERE tenant_id = $1 AND run_id = $2"
      }
    ]);
  });

  it("runs.getRun returns null when no row exists", async () => {
    const queryExecutor: PostgresQueryExecutor = async () => ({
      rowCount: 0,
      rows: []
    });
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.runs.getRun("tenant-1", "missing-run")).resolves.toBeNull();
  });

  it("runs.listRunsForCourse delegates through the injected executor and returns runs", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const rows: RunRow[] = [
      {
        course_id: "course-1",
        parameter_set_id: "param-1",
        run_id: "run-1",
        scenario_package_id: "scenario-1",
        seed: 20260517,
        status: "active",
        tenant_id: "tenant-1"
      },
      {
        course_id: "course-1",
        parameter_set_id: "param-2",
        run_id: "run-2",
        scenario_package_id: "scenario-2",
        seed: 20260518,
        status: "draft",
        tenant_id: "tenant-1"
      }
    ];
    const expected: Run[] = rows.map((row) => ({ ...row }));
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: rows.length,
        rows
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.runs.listRunsForCourse("tenant-1", "course-1")).resolves.toEqual(expected);
    expect(calls).toEqual([
      {
        params: ["tenant-1", "course-1"],
        sql: "SELECT tenant_id, run_id, course_id, scenario_package_id, parameter_set_id, seed, status FROM simulation_runs WHERE tenant_id = $1 AND course_id = $2 ORDER BY created_at ASC, run_id ASC"
      }
    ]);
    expect(calls[0]?.sql).not.toContain("payload");
    expect(calls[0]?.sql).not.toContain("metadata");
  });

  it("rounds.getRound delegates through the injected executor and returns a full Round", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const row: RoundRow = {
      decision_batch_id: "decision-batch-1",
      replay_hash: "replay-hash-1",
      round_id: "round-1",
      round_no: 1,
      run_id: "run-1",
      status: "settled",
      tenant_id: "tenant-1"
    };
    const expected: Round = { ...row };
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: [row]
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.rounds.getRound("tenant-1", "round-1")).resolves.toEqual(expected);
    expect(calls).toEqual([
      {
        params: ["tenant-1", "round-1"],
        sql: "SELECT tenant_id, round_id, run_id, round_no, status, decision_batch_id, replay_hash FROM simulation_rounds WHERE tenant_id = $1 AND round_id = $2"
      }
    ]);
  });

  it("rounds.getRound returns null when no row exists", async () => {
    const queryExecutor: PostgresQueryExecutor = async () => ({
      rowCount: 0,
      rows: []
    });
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.rounds.getRound("tenant-1", "missing-round")).resolves.toBeNull();
  });

  it("rounds.listRoundsForRun delegates through the injected executor and returns rounds", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const rows: RoundRow[] = [
      {
        decision_batch_id: "decision-batch-1",
        replay_hash: "replay-hash-1",
        round_id: "round-1",
        round_no: 1,
        run_id: "run-1",
        status: "settled",
        tenant_id: "tenant-1"
      },
      {
        decision_batch_id: null,
        replay_hash: null,
        round_id: "round-2",
        round_no: 2,
        run_id: "run-1",
        status: "open",
        tenant_id: "tenant-1"
      }
    ];
    const expected: Round[] = [
      rows[0],
      {
        round_id: "round-2",
        round_no: 2,
        run_id: "run-1",
        status: "open",
        tenant_id: "tenant-1"
      }
    ];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: rows.length,
        rows
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.rounds.listRoundsForRun("tenant-1", "run-1")).resolves.toEqual(expected);
    expect(calls).toEqual([
      {
        params: ["tenant-1", "run-1"],
        sql: "SELECT tenant_id, round_id, run_id, round_no, status, decision_batch_id, replay_hash FROM simulation_rounds WHERE tenant_id = $1 AND run_id = $2 ORDER BY created_at ASC, round_id ASC"
      }
    ]);
    expect(calls[0]?.sql).not.toContain("payload");
    expect(calls[0]?.sql).not.toContain("metadata");
  });

  it("decisions.getDecisionById delegates through the injected executor and returns a full Decision", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const row: DecisionRow = {
      canonical_source: "role_merge_commit",
      decision_id: "decision-1",
      merge_commit_id: "merge-1",
      payload: {
        capacity_plan: "hold",
        cash_buffer_target: 0.4,
        marketing_budget: 90000,
        pricing: {
          base_price: 15000
        },
        service_quality_budget: 70000,
        strategy_statement: "Hold price and improve service consistency."
      },
      round_id: "round-1",
      round_no: 1,
      run_id: "run-1",
      status: "validated",
      submitted_by: "user-captain",
      team_confirmation_id: "confirmation-1",
      team_id: "team-1",
      tenant_id: "tenant-1",
      validation_report: [],
      version: 2
    };
    const expected: Decision = { ...row };
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: [row]
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.decisions.getDecisionById("tenant-1", "decision-1")).resolves.toEqual(
      expected
    );
    expect(calls).toEqual([
      {
        params: ["tenant-1", "decision-1"],
        sql: "SELECT tenant_id, decision_id, run_id, round_id, round_no, team_id, status, version, payload, validation_report, submitted_by, canonical_source, merge_commit_id, team_confirmation_id FROM decisions WHERE tenant_id = $1 AND decision_id = $2"
      }
    ]);
    expect(calls[0]?.sql).not.toContain("metadata");
  });

  it("decisions.getDecisionById returns null when no row exists", async () => {
    const queryExecutor: PostgresQueryExecutor = async () => ({
      rowCount: 0,
      rows: []
    });
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(
      adapter.decisions.getDecisionById("tenant-1", "missing-decision")
    ).resolves.toBeNull();
  });

  it("decisions.listDecisionsForRound delegates through the injected executor and returns decisions", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const rows: DecisionRow[] = [
      {
        canonical_source: "legacy_direct",
        decision_id: "decision-1",
        merge_commit_id: null,
        payload: {
          capacity_plan: "hold",
          cash_buffer_target: 0.4,
          marketing_budget: 90000,
          pricing: {
            base_price: 15000
          },
          service_quality_budget: 70000,
          strategy_statement: "Hold price and improve service consistency."
        },
        round_id: "round-1",
        round_no: 1,
        run_id: "run-1",
        status: "validated",
        submitted_by: "user-captain",
        team_confirmation_id: null,
        team_id: "team-1",
        tenant_id: "tenant-1",
        validation_report: [],
        version: 1
      },
      {
        canonical_source: null,
        decision_id: "decision-2",
        payload: {
          capacity_plan: "expand",
          cash_buffer_target: 0.3,
          marketing_budget: 100000,
          pricing: {
            base_price: 14000
          },
          service_quality_budget: 75000,
          strategy_statement: "Expand capacity while keeping quality stable."
        },
        round_id: "round-1",
        round_no: 1,
        run_id: "run-1",
        status: "submitted",
        submitted_by: "user-cfo",
        team_id: "team-2",
        tenant_id: "tenant-1",
        validation_report: [
          {
            field: "pricing.base_price",
            reason: "within range"
          }
        ],
        version: 1
      }
    ];
    const expected: Decision[] = [
      {
        canonical_source: "legacy_direct",
        decision_id: "decision-1",
        payload: rows[0].payload,
        round_id: "round-1",
        round_no: 1,
        run_id: "run-1",
        status: "validated",
        submitted_by: "user-captain",
        team_id: "team-1",
        tenant_id: "tenant-1",
        validation_report: [],
        version: 1
      },
      {
        decision_id: "decision-2",
        payload: rows[1].payload,
        round_id: "round-1",
        round_no: 1,
        run_id: "run-1",
        status: "submitted",
        submitted_by: "user-cfo",
        team_id: "team-2",
        tenant_id: "tenant-1",
        validation_report: [
          {
            field: "pricing.base_price",
            reason: "within range"
          }
        ],
        version: 1
      }
    ];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: rows.length,
        rows
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(
      adapter.decisions.listDecisionsForRound("tenant-1", "run-1", "round-1")
    ).resolves.toEqual(expected);
    expect(calls).toEqual([
      {
        params: ["tenant-1", "run-1", "round-1"],
        sql: "SELECT tenant_id, decision_id, run_id, round_id, round_no, team_id, status, version, payload, validation_report, submitted_by, canonical_source, merge_commit_id, team_confirmation_id FROM decisions WHERE tenant_id = $1 AND run_id = $2 AND round_id = $3 ORDER BY created_at ASC, decision_id ASC"
      }
    ]);
    expect(calls[0]?.sql).not.toContain("metadata");
  });

  it("query helpers do not require DATABASE_URL", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      const queryExecutor: PostgresQueryExecutor = async () => ({
        rowCount: 0,
        rows: []
      });
      const adapter = createPostgresRepositoryAdapter({ queryExecutor });

      await expect(adapter.queryRows<CourseRow>("select * from courses")).resolves.toEqual([]);
      expect(process.env.DATABASE_URL).toBeUndefined();
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
    }
  });

  it("does not require DATABASE_URL to construct the skeleton", () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      const queryExecutor: PostgresQueryExecutor = async () => ({
        rowCount: 0,
        rows: []
      });

      const adapter = createPostgresRepositoryAdapter({ queryExecutor });

      expect(adapter).toBeInstanceOf(PostgresRepositoryAdapter);
      expect(process.env.DATABASE_URL).toBeUndefined();
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
    }
  });

  it("exposes only implemented partial repository namespaces", () => {
    const queryExecutor: PostgresQueryExecutor = async () => ({
      rowCount: 0,
      rows: []
    });

    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    expect(Object.keys(adapter).sort()).toEqual([
      "courses",
      "decisions",
      "options",
      "queryExecutor",
      "rounds",
      "runs"
    ]);
    expect("identity" in adapter).toBe(false);
    expect(adapter.courses.getCourse).toEqual(expect.any(Function));
    expect(adapter.courses.listCoursesForUser).toEqual(expect.any(Function));
    expect(adapter.runs.getRun).toEqual(expect.any(Function));
    expect(adapter.runs.listRunsForCourse).toEqual(expect.any(Function));
    expect(adapter.rounds.getRound).toEqual(expect.any(Function));
    expect(adapter.rounds.listRoundsForRun).toEqual(expect.any(Function));
    expect(adapter.decisions.getDecisionById).toEqual(expect.any(Function));
    expect(adapter.decisions.listDecisionsForRound).toEqual(expect.any(Function));
    expect("getCanonicalDecisionForTeamRound" in adapter.decisions).toBe(false);
    expect("saveDecision" in adapter.decisions).toBe(false);
    expect("saveCanonicalDecision" in adapter.decisions).toBe(false);
    expect("settlements" in adapter).toBe(false);
    expect("replay" in adapter).toBe(false);
  });
});
