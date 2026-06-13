import { describe, expect, it } from "vitest";
import type {
  Decision,
  ReplayDiffReport,
  ReplayInputManifest,
  ReplayReport,
  ReplayRun,
  Round,
  Run,
  SettlementResult
} from "@simwar/shared-contracts";
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

  interface SettlementRow extends Record<string, unknown> {
    parameter_set_id: string;
    replay_hash: string;
    round_id: string;
    round_no: number;
    run_id: string;
    scenario_package_id: string;
    settlement_result_id: string;
    team_results: SettlementResult["team_results"];
    tenant_id: string;
  }

  interface ReplayInputManifestRow extends Record<string, unknown> {
    payload: ReplayInputManifest;
  }

  interface ReplayRunRow extends Record<string, unknown> {
    payload: ReplayRun;
  }

  interface ReplayReportRow extends Record<string, unknown> {
    payload: ReplayReport;
  }

  interface ReplayDiffReportRow extends Record<string, unknown> {
    payload: ReplayDiffReport;
  }

  const teamResults: SettlementResult["team_results"] = [
    {
      state_est: {
        explanation: "Balanced demand and cash position.",
        next_round_risk: "balanced",
        recommended_focus: "Keep service quality steady."
      },
      state_obs: {
        demand_band: "medium",
        profit_band: "healthy",
        rank: 1,
        revenue: 120000,
        score: 88,
        served_demand: 8
      },
      state_true: {
        cash_flow: 42000,
        cost: 78000,
        demand: 10,
        market_share: 0.42,
        profit: 42000,
        rank: 1,
        revenue: 120000,
        score: 88,
        served_demand: 8,
        settlement_status: "settled"
      },
      team_id: "team-1",
      team_name: "Team One"
    }
  ];

  const replayInputManifest: ReplayInputManifest = {
    created_at: "2026-06-08T00:00:00.000Z",
    excluded_from_truth_hash: {
      ai_advice: "excluded",
      learning_evidence: "excluded",
      role_drafts: "excluded"
    },
    included_sources: ["canonical_decisions", "scenario", "parameter_set"],
    input_hash: "input-hash-1",
    manifest_hash: "manifest-hash-1",
    manifest_id: "manifest-1",
    round_id: "round-1",
    run_id: "run-1",
    source_result_id: "settlement-1",
    tenant_id: "tenant-1"
  };

  const replayRun: ReplayRun = {
    completed_at: "2026-06-08T00:00:02.000Z",
    manifest_id: "manifest-1",
    replay_mode: "official_replay",
    replay_run_id: "replay-run-1",
    round_id: "round-1",
    run_id: "run-1",
    started_at: "2026-06-08T00:00:01.000Z",
    status: "completed",
    tenant_id: "tenant-1"
  };

  const replayReport: ReplayReport = {
    created_at: "2026-06-08T00:00:03.000Z",
    matched: true,
    replay_report_id: "replay-report-1",
    replay_result_hash: "replay-result-hash-1",
    replay_run_id: "replay-run-1",
    round_id: "round-1",
    run_id: "run-1",
    source_result_id: "settlement-1",
    status: "matched",
    tenant_id: "tenant-1"
  };

  const replayDiffReport: ReplayDiffReport = {
    created_at: "2026-06-08T00:00:04.000Z",
    diff_report_id: "diff-report-1",
    differences: [
      {
        actual: 90,
        expected: 88,
        field: "team_results[0].state_true.score",
        message: "score drift"
      }
    ],
    replay_report_id: "replay-report-1",
    round_id: "round-1",
    run_id: "run-1",
    severity: "low",
    tenant_id: "tenant-1"
  };

  const createRecordingExecutor = (
    calls: Array<{ params?: readonly unknown[]; sql: string }>
  ): PostgresQueryExecutor => {
    return async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: []
      };
    };
  };

  const expectReplayInsertBoundary = (
    call: { params?: readonly unknown[]; sql: string } | undefined,
    recordType: "diff" | "manifest" | "report" | "run",
    identityColumn: string
  ): void => {
    expect(call?.sql).toContain("INSERT INTO replay_records");
    expect(call?.sql).toContain(`record_type, ${identityColumn}`);
    expect(call?.sql).toContain(`'${recordType}'`);
    expect(call?.sql).toContain("::jsonb");
    expect(call?.sql).not.toContain("ON CONFLICT");
    expect(call?.sql).not.toContain("UPDATE replay_records");
    expect(call?.sql).not.toContain("DELETE");
    expect(call?.sql).not.toMatch(/^SELECT/i);
    expect(call?.sql).not.toContain("metadata");
    expect(call?.sql).not.toContain("buildReplayHash");
    expect(call?.sql).not.toContain("decisions");
    expect(call?.sql).not.toContain("simulation_rounds");
    expect(call?.sql).not.toContain("settlement_results");
    expect(call?.sql).not.toContain("role_draft");
    expect(call?.sql).not.toContain("ai_advice");
    expect(call?.sql).not.toContain("learning_evidence");
    expect(call?.sql).not.toContain("prompt_output");
    expect(call?.sql).not.toContain("analytics");
  };

  const expectReplayReadBoundary = (
    call: { params?: readonly unknown[]; sql: string } | undefined,
    recordType: "diff" | "manifest" | "report" | "run",
    identityColumn: string
  ): void => {
    expect(call?.sql).toMatch(/^SELECT payload FROM replay_records/);
    expect(call?.sql).toContain("tenant_id = $1");
    expect(call?.sql).toContain(`record_type = '${recordType}'`);
    expect(call?.sql).toContain(`${identityColumn} = $2`);
    expect(call?.sql).toContain("ORDER BY append_sequence ASC");
    expect(call?.sql).toContain("LIMIT 1");
    expect(call?.sql).not.toContain("metadata");
    expect(call?.sql).not.toContain("buildReplayHash");
    expect(call?.sql).not.toContain("created_at ASC");
    expect(call?.sql).not.toContain("append_sequence DESC");
    expect(call?.sql).not.toContain("version DESC");
    expect(call?.sql).not.toContain("latest");
    expect(call?.sql).not.toContain("MAX(");
    expect(call?.sql).not.toContain("DISTINCT ON");
  };

  const expectJsonPayloadParam = (param: unknown, expected: unknown): void => {
    expect(typeof param).toBe("string");
    expect(param).toBe(JSON.stringify(expected));
    expect(JSON.parse(param as string)).toEqual(expected);
  };

  const parseJsonPayloadParam = <TExpected>(param: unknown, expected: TExpected): TExpected => {
    expectJsonPayloadParam(param, expected);
    return JSON.parse(param as string) as TExpected;
  };

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

  it("decisions.getCanonicalDecisionForTeamRound returns the first submitted matching decision", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const row: DecisionRow = {
      canonical_source: "role_merge_commit",
      decision_id: "decision-canonical",
      merge_commit_id: "merge-1",
      payload: {
        capacity_plan: "hold",
        cash_buffer_target: 0.4,
        marketing_budget: 90000,
        pricing: {
          base_price: 15000
        },
        service_quality_budget: 70000,
        strategy_statement: "Submitted canonical decision."
      },
      round_id: "round-1",
      round_no: 1,
      run_id: "run-1",
      status: "submitted",
      submitted_by: "user-captain",
      team_confirmation_id: "confirmation-1",
      team_id: "team-1",
      tenant_id: "tenant-1",
      validation_report: [
        {
          field: "payload",
          reason: "accepted"
        }
      ],
      version: 1
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

    await expect(
      adapter.decisions.getCanonicalDecisionForTeamRound("tenant-1", "run-1", "round-1", "team-1")
    ).resolves.toEqual(expected);
    expect(calls).toEqual([
      {
        params: ["tenant-1", "run-1", "round-1", "team-1"],
        sql: "SELECT tenant_id, decision_id, run_id, round_id, round_no, team_id, status, version, payload, validation_report, submitted_by, canonical_source, merge_commit_id, team_confirmation_id FROM decisions WHERE tenant_id = $1 AND run_id = $2 AND round_id = $3 AND team_id = $4 AND status = 'submitted' ORDER BY created_at ASC, decision_id ASC LIMIT 1"
      }
    ]);
    expect(calls[0]?.sql).toContain("status = 'submitted'");
    expect(calls[0]?.sql).toContain("ORDER BY created_at ASC, decision_id ASC");
    expect(calls[0]?.sql).not.toContain("version DESC");
    expect(calls[0]?.sql).not.toContain("metadata");
  });

  it("decisions.getCanonicalDecisionForTeamRound returns null when no submitted row exists", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 0,
        rows: []
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(
      adapter.decisions.getCanonicalDecisionForTeamRound("tenant-1", "run-1", "round-1", "team-1")
    ).resolves.toBeNull();
    expect(calls).toHaveLength(1);
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

  it("decisions.saveDecision delegates through execute and forwards full Decision fields", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const decision: Decision = {
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
        strategy_statement: "Persist the submitted decision."
      },
      round_id: "round-1",
      round_no: 1,
      run_id: "run-1",
      status: "submitted",
      submitted_by: "user-captain",
      team_confirmation_id: "confirmation-1",
      team_id: "team-1",
      tenant_id: "tenant-1",
      validation_report: [
        {
          field: "payload",
          reason: "accepted"
        }
      ],
      version: 3
    };
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: []
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.decisions.saveDecision(decision)).resolves.toBeUndefined();

    expect(calls).toEqual([
      {
        params: [
          JSON.stringify(["decision", "tenant-1", "decision-1"]),
          "decision-1",
          "tenant-1",
          "run-1",
          "round-1",
          1,
          "team-1",
          3,
          "submitted",
          "role_merge_commit",
          "merge-1",
          "confirmation-1",
          "user-captain",
          decision.payload,
          decision.validation_report
        ],
        sql: "INSERT INTO decisions (id, decision_id, tenant_id, run_id, round_id, round_no, team_id, version, status, canonical_source, merge_commit_id, team_confirmation_id, submitted_by, payload, validation_report, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now()) ON CONFLICT (tenant_id, decision_id) DO UPDATE SET run_id = EXCLUDED.run_id, round_id = EXCLUDED.round_id, round_no = EXCLUDED.round_no, team_id = EXCLUDED.team_id, version = EXCLUDED.version, status = EXCLUDED.status, canonical_source = EXCLUDED.canonical_source, merge_commit_id = EXCLUDED.merge_commit_id, team_confirmation_id = EXCLUDED.team_confirmation_id, submitted_by = EXCLUDED.submitted_by, payload = EXCLUDED.payload, validation_report = EXCLUDED.validation_report, updated_at = now()"
      }
    ]);
    expect(calls[0]?.sql).toContain("ON CONFLICT (tenant_id, decision_id)");
    expect(calls[0]?.sql).not.toContain("metadata");
    expect(calls[0]?.sql).not.toMatch(/^SELECT/i);
  });

  it("decisions.saveDecision writes null for missing optional canonical fields", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const decision: Decision = {
      decision_id: "decision-2",
      payload: {
        capacity_plan: "expand",
        cash_buffer_target: 0.3,
        marketing_budget: 100000,
        pricing: {
          base_price: 14000
        },
        service_quality_budget: 75000,
        strategy_statement: "Persist without optional canonical fields."
      },
      round_id: "round-1",
      round_no: 1,
      run_id: "run-1",
      status: "validated",
      submitted_by: "user-cfo",
      team_id: "team-2",
      tenant_id: "tenant-1",
      validation_report: [],
      version: 1
    };
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: []
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await adapter.decisions.saveDecision(decision);

    expect(calls[0]?.params?.slice(9, 12)).toEqual([null, null, null]);
    expect(calls[0]?.params?.[13]).toBe(decision.payload);
    expect(calls[0]?.params?.[14]).toBe(decision.validation_report);
  });

  it("decisions.saveDecision scopes row identity by tenant and decision id", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: []
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });
    const baseDecision: Decision = {
      decision_id: "decision-shared",
      payload: {
        capacity_plan: "hold",
        cash_buffer_target: 0.4,
        marketing_budget: 90000,
        pricing: {
          base_price: 15000
        },
        service_quality_budget: 70000,
        strategy_statement: "Persist tenant scoped decision."
      },
      round_id: "round-1",
      round_no: 1,
      run_id: "run-1",
      status: "submitted",
      submitted_by: "user-captain",
      team_id: "team-1",
      tenant_id: "tenant-1",
      validation_report: [],
      version: 1
    };

    await adapter.decisions.saveDecision(baseDecision);
    await adapter.decisions.saveDecision({
      ...baseDecision,
      tenant_id: "tenant-2"
    });

    expect(calls[0]?.params?.[0]).toBe(JSON.stringify(["decision", "tenant-1", "decision-shared"]));
    expect(calls[1]?.params?.[0]).toBe(JSON.stringify(["decision", "tenant-2", "decision-shared"]));
    expect(calls[0]?.params?.[1]).toBe("decision-shared");
    expect(calls[1]?.params?.[1]).toBe("decision-shared");
    expect(calls[0]?.sql).toContain("ON CONFLICT (tenant_id, decision_id)");
    expect(calls[0]?.sql).not.toContain("decision_id text NOT NULL UNIQUE");
  });

  it("decisions.saveCanonicalDecision reuses the saveDecision upsert path and forwards full Decision fields", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const decision: Decision = {
      canonical_source: "role_merge_commit",
      decision_id: "decision-canonical",
      merge_commit_id: "merge-1",
      payload: {
        capacity_plan: "hold",
        cash_buffer_target: 0.4,
        marketing_budget: 90000,
        pricing: {
          base_price: 15000
        },
        service_quality_budget: 70000,
        strategy_statement: "Persist canonical decision."
      },
      round_id: "round-1",
      round_no: 1,
      run_id: "run-1",
      status: "submitted",
      submitted_by: "user-captain",
      team_confirmation_id: "confirmation-1",
      team_id: "team-1",
      tenant_id: "tenant-1",
      validation_report: [
        {
          field: "payload",
          reason: "accepted"
        }
      ],
      version: 4
    };
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: []
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await adapter.decisions.saveDecision(decision);
    await expect(adapter.decisions.saveCanonicalDecision(decision)).resolves.toBeUndefined();

    expect(calls).toHaveLength(2);
    expect(calls[1]?.sql).toBe(calls[0]?.sql);
    expect(calls[1]?.params).toEqual([
      JSON.stringify(["decision", "tenant-1", "decision-canonical"]),
      "decision-canonical",
      "tenant-1",
      "run-1",
      "round-1",
      1,
      "team-1",
      4,
      "submitted",
      "role_merge_commit",
      "merge-1",
      "confirmation-1",
      "user-captain",
      decision.payload,
      decision.validation_report
    ]);
    expect(calls[1]?.sql).toContain("ON CONFLICT (tenant_id, decision_id)");
    expect(calls[1]?.sql).not.toContain("metadata");
    expect(calls[1]?.sql).not.toMatch(/^SELECT/i);
  });

  it("decisions.saveCanonicalDecision writes null for missing optional canonical fields", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const decision: Decision = {
      decision_id: "decision-canonical-missing-fields",
      payload: {
        capacity_plan: "expand",
        cash_buffer_target: 0.3,
        marketing_budget: 100000,
        pricing: {
          base_price: 14000
        },
        service_quality_budget: 75000,
        strategy_statement: "Persist canonical decision without optional fields."
      },
      round_id: "round-1",
      round_no: 1,
      run_id: "run-1",
      status: "submitted",
      submitted_by: "user-captain",
      team_id: "team-1",
      tenant_id: "tenant-1",
      validation_report: [],
      version: 1
    };
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: []
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await adapter.decisions.saveCanonicalDecision(decision);

    expect(calls[0]?.params?.slice(9, 12)).toEqual([null, null, null]);
    expect(calls[0]?.params?.[13]).toBe(decision.payload);
    expect(calls[0]?.params?.[14]).toBe(decision.validation_report);
  });

  it("decision write mappings stay inside persistence columns without truth-chain fields", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const decision: Decision = {
      decision_id: "decision-truth-guard",
      payload: {
        capacity_plan: "hold",
        cash_buffer_target: 0.4,
        marketing_budget: 90000,
        pricing: {
          base_price: 15000
        },
        service_quality_budget: 70000,
        strategy_statement: "Persist without truth-chain side effects."
      },
      round_id: "round-1",
      round_no: 1,
      run_id: "run-1",
      status: "submitted",
      submitted_by: "user-captain",
      team_id: "team-1",
      tenant_id: "tenant-1",
      validation_report: [],
      version: 1
    };
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: []
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await adapter.decisions.saveDecision(decision);
    await adapter.decisions.saveCanonicalDecision(decision);

    for (const call of calls) {
      expect(call.sql).not.toMatch(/^SELECT/i);
      expect(call.sql).not.toContain("metadata");
      expect(call.sql).not.toContain("replay_hash");
      expect(call.sql).not.toContain("buildReplayHash");
      expect(call.sql).not.toContain("settlement");
      expect(call.sql).not.toContain("role_draft");
      expect(call.sql).not.toContain("ai_advice");
      expect(call.sql).not.toContain("learning_evidence");
    }
  });

  it("settlements.getSettlementResult delegates through the injected executor and returns a full SettlementResult", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const row: SettlementRow = {
      parameter_set_id: "parameter-set-1",
      replay_hash: "replay-hash-1",
      round_id: "round-1",
      round_no: 1,
      run_id: "run-1",
      scenario_package_id: "scenario-package-1",
      settlement_result_id: "settlement-1",
      team_results: teamResults,
      tenant_id: "tenant-1"
    };
    const expected: SettlementResult = { ...row };
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: [row]
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(
      adapter.settlements.getSettlementResult("tenant-1", "settlement-1")
    ).resolves.toEqual(expected);
    expect(calls).toEqual([
      {
        params: ["tenant-1", "settlement-1"],
        sql: "SELECT tenant_id, settlement_result_id, run_id, round_id, round_no, parameter_set_id, scenario_package_id, replay_hash, team_results FROM settlement_results WHERE tenant_id = $1 AND settlement_result_id = $2"
      }
    ]);
    expect(calls[0]?.sql).not.toContain("payload");
    expect(calls[0]?.sql).not.toContain("metadata");
    expect(calls[0]?.sql).not.toContain("buildReplayHash");
    expect(calls[0]?.sql).not.toContain("role_draft");
    expect(calls[0]?.sql).not.toContain("ai_advice");
    expect(calls[0]?.sql).not.toContain("learning_evidence");
  });

  it("settlements.getSettlementResult returns null when no row exists", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 0,
        rows: []
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(
      adapter.settlements.getSettlementResult("tenant-1", "missing-settlement")
    ).resolves.toBeNull();
    expect(calls).toEqual([
      {
        params: ["tenant-1", "missing-settlement"],
        sql: "SELECT tenant_id, settlement_result_id, run_id, round_id, round_no, parameter_set_id, scenario_package_id, replay_hash, team_results FROM settlement_results WHERE tenant_id = $1 AND settlement_result_id = $2"
      }
    ]);
  });

  it("settlements.listSettlementResultsForRound filters by tenant, run, and round with deterministic ordering", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const rows: SettlementRow[] = [
      {
        parameter_set_id: "parameter-set-1",
        replay_hash: "replay-hash-1",
        round_id: "round-1",
        round_no: 1,
        run_id: "run-1",
        scenario_package_id: "scenario-package-1",
        settlement_result_id: "settlement-1",
        team_results: teamResults,
        tenant_id: "tenant-1"
      },
      {
        parameter_set_id: "parameter-set-1",
        replay_hash: "replay-hash-2",
        round_id: "round-1",
        round_no: 1,
        run_id: "run-1",
        scenario_package_id: "scenario-package-1",
        settlement_result_id: "settlement-2",
        team_results: [
          {
            ...teamResults[0],
            team_id: "team-2",
            team_name: "Team Two"
          }
        ],
        tenant_id: "tenant-1"
      }
    ];
    const expected: SettlementResult[] = rows.map((row) => ({ ...row }));
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: rows.length,
        rows
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(
      adapter.settlements.listSettlementResultsForRound("tenant-1", "run-1", "round-1")
    ).resolves.toEqual(expected);
    expect(calls).toEqual([
      {
        params: ["tenant-1", "run-1", "round-1"],
        sql: "SELECT tenant_id, settlement_result_id, run_id, round_id, round_no, parameter_set_id, scenario_package_id, replay_hash, team_results FROM settlement_results WHERE tenant_id = $1 AND run_id = $2 AND round_id = $3 ORDER BY created_at ASC, settlement_result_id ASC"
      }
    ]);
    expect(calls[0]?.sql).toContain("ORDER BY created_at ASC, settlement_result_id ASC");
    expect(calls[0]?.sql).not.toContain("payload");
    expect(calls[0]?.sql).not.toContain("metadata");
    expect(calls[0]?.sql).not.toContain("buildReplayHash");
    expect(calls[0]?.sql).not.toContain("role_draft");
    expect(calls[0]?.sql).not.toContain("ai_advice");
    expect(calls[0]?.sql).not.toContain("learning_evidence");
  });

  it("settlements.listSettlementResultsForRound returns an empty list when no rows exist", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 0,
        rows: []
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(
      adapter.settlements.listSettlementResultsForRound("tenant-1", "run-1", "round-1")
    ).resolves.toEqual([]);
    expect(calls).toEqual([
      {
        params: ["tenant-1", "run-1", "round-1"],
        sql: "SELECT tenant_id, settlement_result_id, run_id, round_id, round_no, parameter_set_id, scenario_package_id, replay_hash, team_results FROM settlement_results WHERE tenant_id = $1 AND run_id = $2 AND round_id = $3 ORDER BY created_at ASC, settlement_result_id ASC"
      }
    ]);
  });

  it("settlements.saveSettlementResult delegates through execute and forwards full SettlementResult fields", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const settlement: SettlementResult = {
      parameter_set_id: "parameter-set-1",
      replay_hash: "replay-hash-1",
      round_id: "round-1",
      round_no: 1,
      run_id: "run-1",
      scenario_package_id: "scenario-package-1",
      settlement_result_id: "settlement-1",
      team_results: teamResults,
      tenant_id: "tenant-1"
    };
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: []
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.settlements.saveSettlementResult(settlement)).resolves.toBeUndefined();

    expect(calls).toEqual([
      {
        params: [
          JSON.stringify(["settlement_result", "tenant-1", "settlement-1"]),
          "settlement-1",
          "tenant-1",
          "run-1",
          "round-1",
          1,
          "parameter-set-1",
          "scenario-package-1",
          "replay-hash-1",
          JSON.stringify(settlement.team_results)
        ],
        sql: "INSERT INTO settlement_results (id, settlement_result_id, tenant_id, run_id, round_id, round_no, parameter_set_id, scenario_package_id, replay_hash, team_results, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, now()) ON CONFLICT (tenant_id, settlement_result_id) DO UPDATE SET run_id = EXCLUDED.run_id, round_id = EXCLUDED.round_id, round_no = EXCLUDED.round_no, parameter_set_id = EXCLUDED.parameter_set_id, scenario_package_id = EXCLUDED.scenario_package_id, replay_hash = EXCLUDED.replay_hash, team_results = EXCLUDED.team_results, updated_at = now()"
      }
    ]);
    expect(calls[0]?.sql).toContain("$10::jsonb");
    expect(calls[0]?.params).toHaveLength(10);
    expect(typeof calls[0]?.params?.[9]).toBe("string");
    expect(calls[0]?.params?.[8]).toBe(settlement.replay_hash);
    expect(calls[0]?.params?.[9]).toBe(JSON.stringify(settlement.team_results));
    expect(JSON.parse(calls[0]?.params?.[9] as string)).toEqual(settlement.team_results);
    expect(calls[0]?.sql).toContain("ON CONFLICT (tenant_id, settlement_result_id)");
    expect(calls[0]?.sql).toContain("run_id = EXCLUDED.run_id");
    expect(calls[0]?.sql).toContain("round_id = EXCLUDED.round_id");
    expect(calls[0]?.sql).toContain("round_no = EXCLUDED.round_no");
    expect(calls[0]?.sql).toContain("parameter_set_id = EXCLUDED.parameter_set_id");
    expect(calls[0]?.sql).toContain("scenario_package_id = EXCLUDED.scenario_package_id");
    expect(calls[0]?.sql).toContain("replay_hash = EXCLUDED.replay_hash");
    expect(calls[0]?.sql).toContain("team_results = EXCLUDED.team_results");
    expect(calls[0]?.sql).not.toMatch(/^SELECT/i);
    expect(calls[0]?.sql).not.toContain("payload");
    expect(calls[0]?.sql).not.toContain("metadata");
    expect(calls[0]?.sql).not.toContain("role_draft");
    expect(calls[0]?.sql).not.toContain("ai_advice");
    expect(calls[0]?.sql).not.toContain("learning_evidence");
    expect(calls[0]?.sql).not.toContain("prompt_output");
    expect(calls[0]?.sql).not.toContain("analytics");
    expect(calls[0]?.sql).not.toContain("buildReplayHash");
    expect(calls[0]?.sql).not.toContain("simulation_rounds");
  });

  it("settlements.saveSettlementResult scopes row identity by tenant and preserves replay hash", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: []
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });
    const baseSettlement: SettlementResult = {
      parameter_set_id: "parameter-set-1",
      replay_hash: "replay-hash-shared",
      round_id: "round-1",
      round_no: 1,
      run_id: "run-1",
      scenario_package_id: "scenario-package-1",
      settlement_result_id: "settlement-shared",
      team_results: teamResults,
      tenant_id: "tenant-1"
    };

    await adapter.settlements.saveSettlementResult(baseSettlement);
    await adapter.settlements.saveSettlementResult({
      ...baseSettlement,
      tenant_id: "tenant-2"
    });

    expect(calls[0]?.params?.[0]).toBe(
      JSON.stringify(["settlement_result", "tenant-1", "settlement-shared"])
    );
    expect(calls[1]?.params?.[0]).toBe(
      JSON.stringify(["settlement_result", "tenant-2", "settlement-shared"])
    );
    expect(calls[0]?.params?.[1]).toBe("settlement-shared");
    expect(calls[1]?.params?.[1]).toBe("settlement-shared");
    expect(calls[0]?.params?.[8]).toBe("replay-hash-shared");
    expect(baseSettlement.replay_hash).toBe("replay-hash-shared");
    expect(calls[0]?.params?.[9]).toBe(JSON.stringify(baseSettlement.team_results));
    expect(JSON.parse(calls[0]?.params?.[9] as string)).toEqual(baseSettlement.team_results);
    expect(calls[0]?.sql).toContain("ON CONFLICT (tenant_id, settlement_result_id)");
    expect(calls[0]?.sql).toContain("$10::jsonb");
    expect(calls[0]?.params).toHaveLength(10);
    expect(calls[1]?.params).toHaveLength(10);
    expect(calls[0]?.sql).not.toContain("metadata");
    expect(calls[0]?.sql).not.toContain("payload");
    expect(calls[0]?.sql).not.toContain("buildReplayHash");
    expect(calls[0]?.sql).not.toContain("simulation_rounds");
    expect(calls[0]?.sql).not.toMatch(/^SELECT/i);
  });

  it("settlements.saveSettlementResult stays inside settlement persistence boundaries", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const settlement: SettlementResult = {
      parameter_set_id: "parameter-set-1",
      replay_hash: "replay-hash-truth",
      round_id: "round-1",
      round_no: 1,
      run_id: "run-1",
      scenario_package_id: "scenario-package-1",
      settlement_result_id: "settlement-truth",
      team_results: teamResults,
      tenant_id: "tenant-1"
    };
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: []
      };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await adapter.settlements.saveSettlementResult(settlement);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain("INSERT INTO settlement_results");
    expect(calls[0]?.sql).not.toMatch(/^SELECT/i);
    expect(calls[0]?.sql).not.toContain("payload");
    expect(calls[0]?.sql).not.toContain("metadata");
    expect(calls[0]?.sql).not.toContain("role_draft");
    expect(calls[0]?.sql).not.toContain("ai_advice");
    expect(calls[0]?.sql).not.toContain("learning_evidence");
    expect(calls[0]?.sql).not.toContain("prompt_output");
    expect(calls[0]?.sql).not.toContain("analytics");
    expect(calls[0]?.sql).not.toContain("buildReplayHash");
    expect(calls[0]?.sql).not.toContain("simulation_rounds");
    expect(calls[0]?.params?.[8]).toBe("replay-hash-truth");
    expect(calls[0]?.params?.[9]).toBe(JSON.stringify(teamResults));
    expect(JSON.parse(calls[0]?.params?.[9] as string)).toEqual(teamResults);
  });

  it("replay.getReplayInputManifest reads the first manifest payload by tenant and canonical identity", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });

      return params?.[1] === replayInputManifest.manifest_id
        ? {
            rowCount: 1,
            rows: [{ payload: replayInputManifest } satisfies ReplayInputManifestRow]
          }
        : {
            rowCount: 0,
            rows: []
          };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.replay.getReplayInputManifest("tenant-1", "manifest-1")).resolves.toEqual(
      replayInputManifest
    );
    await expect(
      adapter.replay.getReplayInputManifest("tenant-1", "missing-manifest")
    ).resolves.toBeNull();

    expect(calls[0]).toEqual({
      params: ["tenant-1", "manifest-1"],
      sql: "SELECT payload FROM replay_records WHERE tenant_id = $1 AND record_type = 'manifest' AND manifest_id = $2 ORDER BY append_sequence ASC LIMIT 1"
    });
    expect(calls[0]?.sql).toMatch(/^SELECT payload FROM replay_records/);
    expect(calls[0]?.sql).toContain("record_type = 'manifest'");
    expect(calls[0]?.sql).toContain("manifest_id = $2");
    expect(calls[0]?.sql).toContain("ORDER BY append_sequence ASC");
    expect(calls[0]?.sql).toContain("LIMIT 1");
    expect(calls[0]?.sql).not.toContain("metadata");
    expect(calls[0]?.sql).not.toContain("buildReplayHash");
  });

  it("replay.getReplayRun reads the first replay run payload by tenant and canonical identity", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });

      return params?.[1] === replayRun.replay_run_id
        ? {
            rowCount: 1,
            rows: [{ payload: replayRun } satisfies ReplayRunRow]
          }
        : {
            rowCount: 0,
            rows: []
          };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.replay.getReplayRun("tenant-1", "replay-run-1")).resolves.toEqual(
      replayRun
    );
    await expect(adapter.replay.getReplayRun("tenant-1", "missing-run")).resolves.toBeNull();

    expect(calls[0]).toEqual({
      params: ["tenant-1", "replay-run-1"],
      sql: "SELECT payload FROM replay_records WHERE tenant_id = $1 AND record_type = 'run' AND replay_run_id = $2 ORDER BY append_sequence ASC LIMIT 1"
    });
    expect(calls[0]?.sql).toMatch(/^SELECT payload FROM replay_records/);
    expect(calls[0]?.sql).toContain("record_type = 'run'");
    expect(calls[0]?.sql).toContain("replay_run_id = $2");
    expect(calls[0]?.sql).toContain("ORDER BY append_sequence ASC");
    expect(calls[0]?.sql).toContain("LIMIT 1");
    expect(calls[0]?.sql).not.toContain("metadata");
    expect(calls[0]?.sql).not.toContain("buildReplayHash");
  });

  it("replay.getReplayReport reads the first replay report payload by tenant and canonical identity", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });

      return params?.[1] === replayReport.replay_report_id
        ? {
            rowCount: 1,
            rows: [{ payload: replayReport } satisfies ReplayReportRow]
          }
        : {
            rowCount: 0,
            rows: []
          };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.replay.getReplayReport("tenant-1", "replay-report-1")).resolves.toEqual(
      replayReport
    );
    await expect(adapter.replay.getReplayReport("tenant-1", "missing-report")).resolves.toBeNull();

    expect(calls[0]).toEqual({
      params: ["tenant-1", "replay-report-1"],
      sql: "SELECT payload FROM replay_records WHERE tenant_id = $1 AND record_type = 'report' AND replay_report_id = $2 ORDER BY append_sequence ASC LIMIT 1"
    });
    expect(calls[0]?.sql).toMatch(/^SELECT payload FROM replay_records/);
    expect(calls[0]?.sql).toContain("record_type = 'report'");
    expect(calls[0]?.sql).toContain("replay_report_id = $2");
    expect(calls[0]?.sql).toContain("ORDER BY append_sequence ASC");
    expect(calls[0]?.sql).toContain("LIMIT 1");
    expect(calls[0]?.sql).not.toContain("metadata");
    expect(calls[0]?.sql).not.toContain("buildReplayHash");
  });

  it("replay.getReplayDiffReport reads the first diff report payload by tenant and canonical identity", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const queryExecutor: PostgresQueryExecutor = async (sql, params) => {
      calls.push({ sql, params });

      return params?.[1] === replayDiffReport.diff_report_id
        ? {
            rowCount: 1,
            rows: [{ payload: replayDiffReport } satisfies ReplayDiffReportRow]
          }
        : {
            rowCount: 0,
            rows: []
          };
    };
    const adapter = createPostgresRepositoryAdapter({ queryExecutor });

    await expect(adapter.replay.getReplayDiffReport("tenant-1", "diff-report-1")).resolves.toEqual(
      replayDiffReport
    );
    await expect(
      adapter.replay.getReplayDiffReport("tenant-1", "missing-diff")
    ).resolves.toBeNull();

    expect(calls[0]).toEqual({
      params: ["tenant-1", "diff-report-1"],
      sql: "SELECT payload FROM replay_records WHERE tenant_id = $1 AND record_type = 'diff' AND diff_report_id = $2 ORDER BY append_sequence ASC LIMIT 1"
    });
    expect(calls[0]?.sql).toMatch(/^SELECT payload FROM replay_records/);
    expect(calls[0]?.sql).toContain("record_type = 'diff'");
    expect(calls[0]?.sql).toContain("diff_report_id = $2");
    expect(calls[0]?.sql).toContain("ORDER BY append_sequence ASC");
    expect(calls[0]?.sql).toContain("LIMIT 1");
    expect(calls[0]?.sql).not.toContain("replay_diff_report_id");
    expect(calls[0]?.sql).not.toContain("metadata");
    expect(calls[0]?.sql).not.toContain("buildReplayHash");
  });

  it("Postgres replay reads preserve JSON first-match append order", async () => {
    type ReplayPayload = ReplayInputManifest | ReplayRun | ReplayReport | ReplayDiffReport;
    const readCases: Array<{
      identity: string;
      identityColumn: string;
      payload: ReplayPayload;
      read: (adapter: PostgresRepositoryAdapter, identity: string) => Promise<ReplayPayload | null>;
      recordType: "diff" | "manifest" | "report" | "run";
    }> = [
      {
        identity: replayInputManifest.manifest_id,
        identityColumn: "manifest_id",
        payload: replayInputManifest,
        read: (adapter, identity) => adapter.replay.getReplayInputManifest("tenant-1", identity),
        recordType: "manifest"
      },
      {
        identity: replayRun.replay_run_id,
        identityColumn: "replay_run_id",
        payload: replayRun,
        read: (adapter, identity) => adapter.replay.getReplayRun("tenant-1", identity),
        recordType: "run"
      },
      {
        identity: replayReport.replay_report_id,
        identityColumn: "replay_report_id",
        payload: replayReport,
        read: (adapter, identity) => adapter.replay.getReplayReport("tenant-1", identity),
        recordType: "report"
      },
      {
        identity: replayDiffReport.diff_report_id,
        identityColumn: "diff_report_id",
        payload: replayDiffReport,
        read: (adapter, identity) => adapter.replay.getReplayDiffReport("tenant-1", identity),
        recordType: "diff"
      }
    ];

    for (const readCase of readCases) {
      const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
      const adapter = createPostgresRepositoryAdapter({
        queryExecutor: async (sql, params) => {
          calls.push({ sql, params });

          return params?.[1] === readCase.identity
            ? {
                rowCount: 1,
                rows: [{ payload: readCase.payload }]
              }
            : {
                rowCount: 0,
                rows: []
              };
        }
      });

      await expect(readCase.read(adapter, readCase.identity)).resolves.toEqual(readCase.payload);
      await expect(readCase.read(adapter, `missing-${readCase.recordType}`)).resolves.toBeNull();

      expect(calls).toHaveLength(2);
      expect(calls[0]?.params).toEqual(["tenant-1", readCase.identity]);
      expect(calls[1]?.params).toEqual(["tenant-1", `missing-${readCase.recordType}`]);
      expectReplayReadBoundary(calls[0], readCase.recordType, readCase.identityColumn);
      expectReplayReadBoundary(calls[1], readCase.recordType, readCase.identityColumn);
    }
  });

  it("replay.saveReplayInputManifest appends a full manifest payload through execute", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const adapter = createPostgresRepositoryAdapter({
      queryExecutor: createRecordingExecutor(calls)
    });

    await expect(
      adapter.replay.saveReplayInputManifest(replayInputManifest)
    ).resolves.toBeUndefined();

    expect(calls).toHaveLength(1);
    expectReplayInsertBoundary(calls[0], "manifest", "manifest_id");
    expect(calls[0]?.sql).toContain("source_result_id");
    expect(calls[0]?.sql).toContain("$9::jsonb");
    expect(calls[0]?.params).toHaveLength(9);
    expect(typeof calls[0]?.params?.[0]).toBe("string");
    expect(calls[0]?.params?.[1]).toBe(replayInputManifest.tenant_id);
    expect(calls[0]?.params?.[2]).toBe(replayInputManifest.run_id);
    expect(calls[0]?.params?.[3]).toBe(replayInputManifest.round_id);
    expect(calls[0]?.params?.[4]).toBe(replayInputManifest.manifest_id);
    expect(calls[0]?.params?.[5]).toBe(replayInputManifest.source_result_id);
    expect(calls[0]?.params?.[6]).toBe(replayInputManifest.input_hash);
    expect(calls[0]?.params?.[7]).toBe(replayInputManifest.manifest_hash);
    expectJsonPayloadParam(calls[0]?.params?.[8], replayInputManifest);
    expect(JSON.parse(calls[0]?.params?.[8] as string).source_result_id).toBe(
      replayInputManifest.source_result_id
    );
  });

  it("replay.saveReplayRun appends a full replay run payload through execute", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const adapter = createPostgresRepositoryAdapter({
      queryExecutor: createRecordingExecutor(calls)
    });

    await expect(adapter.replay.saveReplayRun(replayRun)).resolves.toBeUndefined();

    expect(calls).toHaveLength(1);
    expectReplayInsertBoundary(calls[0], "run", "replay_run_id");
    expect(calls[0]?.sql).toContain("$8::jsonb");
    expect(calls[0]?.params).toHaveLength(8);
    expect(typeof calls[0]?.params?.[0]).toBe("string");
    expect(calls[0]?.params?.[1]).toBe(replayRun.tenant_id);
    expect(calls[0]?.params?.[2]).toBe(replayRun.run_id);
    expect(calls[0]?.params?.[3]).toBe(replayRun.round_id);
    expect(calls[0]?.params?.[4]).toBe(replayRun.replay_run_id);
    expect(calls[0]?.params?.[5]).toBe(replayRun.manifest_id);
    expect(calls[0]?.params?.[6]).toBe(replayRun.status);
    expectJsonPayloadParam(calls[0]?.params?.[7], replayRun);
  });

  it("replay.saveReplayReport appends a full replay report payload through execute", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const adapter = createPostgresRepositoryAdapter({
      queryExecutor: createRecordingExecutor(calls)
    });

    await expect(adapter.replay.saveReplayReport(replayReport)).resolves.toBeUndefined();

    expect(calls).toHaveLength(1);
    expectReplayInsertBoundary(calls[0], "report", "replay_report_id");
    expect(calls[0]?.sql).toContain("replay_run_id");
    expect(calls[0]?.sql).toContain("$10::jsonb");
    expect(calls[0]?.params).toHaveLength(10);
    expect(typeof calls[0]?.params?.[0]).toBe("string");
    expect(calls[0]?.params?.[1]).toBe(replayReport.tenant_id);
    expect(calls[0]?.params?.[2]).toBe(replayReport.run_id);
    expect(calls[0]?.params?.[3]).toBe(replayReport.round_id);
    expect(calls[0]?.params?.[4]).toBe(replayReport.replay_report_id);
    expect(calls[0]?.params?.[5]).toBe(replayReport.replay_run_id);
    expect(calls[0]?.params?.[6]).toBe(replayReport.source_result_id);
    expect(calls[0]?.params?.[7]).toBe(replayReport.replay_result_hash);
    expect(calls[0]?.params?.[8]).toBe(replayReport.status);
    expectJsonPayloadParam(calls[0]?.params?.[9], replayReport);
    expect(JSON.parse(calls[0]?.params?.[9] as string).replay_run_id).toBe(
      replayReport.replay_run_id
    );
  });

  it("replay.saveReplayDiffReport appends a full diff report payload through execute", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const adapter = createPostgresRepositoryAdapter({
      queryExecutor: createRecordingExecutor(calls)
    });

    await expect(adapter.replay.saveReplayDiffReport(replayDiffReport)).resolves.toBeUndefined();

    expect(calls).toHaveLength(1);
    expectReplayInsertBoundary(calls[0], "diff", "diff_report_id");
    expect(calls[0]?.sql).toContain("$7::jsonb");
    expect(calls[0]?.sql).not.toContain("replay_diff_report_id");
    expect(calls[0]?.params).toHaveLength(7);
    expect(typeof calls[0]?.params?.[0]).toBe("string");
    expect(calls[0]?.params?.[1]).toBe(replayDiffReport.tenant_id);
    expect(calls[0]?.params?.[2]).toBe(replayDiffReport.run_id);
    expect(calls[0]?.params?.[3]).toBe(replayDiffReport.round_id);
    expect(calls[0]?.params?.[4]).toBe(replayDiffReport.diff_report_id);
    expect(calls[0]?.params?.[5]).toBe(replayDiffReport.replay_report_id);
    expectJsonPayloadParam(calls[0]?.params?.[6], replayDiffReport);
  });

  it("replay save methods normalize compatibility identities into canonical columns", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const adapter = createPostgresRepositoryAdapter({
      queryExecutor: createRecordingExecutor(calls)
    });
    const fallbackManifest = {
      ...replayInputManifest,
      replay_input_manifest_id: "legacy-manifest"
    } as unknown as ReplayInputManifest & { manifest_id?: string };
    delete fallbackManifest.manifest_id;
    const fallbackRun = { ...replayRun } as unknown as ReplayRun & { replay_run_id?: string };
    delete fallbackRun.replay_run_id;
    const fallbackReport = {
      ...replayReport,
      report_id: "legacy-report"
    } as unknown as ReplayReport & { replay_report_id?: string };
    delete fallbackReport.replay_report_id;
    const fallbackDiff = {
      ...replayDiffReport,
      replay_diff_report_id: "legacy-diff"
    } as unknown as ReplayDiffReport & { diff_report_id?: string };
    delete fallbackDiff.diff_report_id;

    await adapter.replay.saveReplayInputManifest(fallbackManifest as ReplayInputManifest);
    await adapter.replay.saveReplayRun(fallbackRun as ReplayRun);
    await adapter.replay.saveReplayReport(fallbackReport as ReplayReport);
    await adapter.replay.saveReplayDiffReport(fallbackDiff as ReplayDiffReport);

    expect(calls[0]?.params?.[4]).toBe("legacy-manifest");
    expect(calls[1]?.params?.[4]).toBe(fallbackRun.run_id);
    expect(calls[2]?.params?.[4]).toBe("legacy-report");
    expect(calls[3]?.params?.[4]).toBe("legacy-diff");
    expectJsonPayloadParam(calls[0]?.params?.[8], fallbackManifest);
    expectJsonPayloadParam(calls[1]?.params?.[7], fallbackRun);
    expectJsonPayloadParam(calls[2]?.params?.[9], fallbackReport);
    expectJsonPayloadParam(calls[3]?.params?.[6], fallbackDiff);
  });

  it("replay save methods keep duplicate append semantics with unique internal row IDs", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const adapter = createPostgresRepositoryAdapter({
      queryExecutor: createRecordingExecutor(calls)
    });

    await adapter.replay.saveReplayInputManifest(replayInputManifest);
    await adapter.replay.saveReplayInputManifest(replayInputManifest);

    expect(calls).toHaveLength(2);
    expect(calls[0]?.sql).toContain("INSERT INTO replay_records");
    expect(calls[1]?.sql).toContain("INSERT INTO replay_records");
    expect(calls[0]?.sql).not.toContain("ON CONFLICT");
    expect(calls[1]?.sql).not.toContain("ON CONFLICT");
    expect(calls[0]?.params?.[0]).not.toBe(calls[1]?.params?.[0]);
    expect(calls[0]?.params?.[4]).toBe(replayInputManifest.manifest_id);
    expect(calls[1]?.params?.[4]).toBe(replayInputManifest.manifest_id);
    expectJsonPayloadParam(calls[0]?.params?.[8], replayInputManifest);
    expectJsonPayloadParam(calls[1]?.params?.[8], replayInputManifest);
  });

  it("replay save methods keep tenant identity isolated for shared business IDs", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const adapter = createPostgresRepositoryAdapter({
      queryExecutor: createRecordingExecutor(calls)
    });

    await adapter.replay.saveReplayReport(replayReport);
    await adapter.replay.saveReplayReport({
      ...replayReport,
      tenant_id: "tenant-2"
    });

    expect(calls[0]?.params?.[1]).toBe("tenant-1");
    expect(calls[1]?.params?.[1]).toBe("tenant-2");
    expect(calls[0]?.params?.[4]).toBe(replayReport.replay_report_id);
    expect(calls[1]?.params?.[4]).toBe(replayReport.replay_report_id);
    expect(calls[0]?.params?.[0]).not.toBe(calls[1]?.params?.[0]);
  });

  it("replay write mappings preserve explicit columns, JSONB payloads, and truth-chain boundaries", async () => {
    const calls: Array<{ params?: readonly unknown[]; sql: string }> = [];
    const adapter = createPostgresRepositoryAdapter({
      queryExecutor: createRecordingExecutor(calls)
    });
    const originalInputs = JSON.stringify({
      replayDiffReport,
      replayInputManifest,
      replayReport,
      replayRun
    });

    await adapter.replay.saveReplayInputManifest(replayInputManifest);
    await adapter.replay.saveReplayRun(replayRun);
    await adapter.replay.saveReplayReport(replayReport);
    await adapter.replay.saveReplayDiffReport(replayDiffReport);

    expect(calls).toHaveLength(4);
    expect(
      JSON.stringify({
        replayDiffReport,
        replayInputManifest,
        replayReport,
        replayRun
      })
    ).toBe(originalInputs);

    const manifestPayload = parseJsonPayloadParam<ReplayInputManifest>(
      calls[0]?.params?.[8],
      replayInputManifest
    );
    const runPayload = parseJsonPayloadParam<ReplayRun>(calls[1]?.params?.[7], replayRun);
    const reportPayload = parseJsonPayloadParam<ReplayReport>(calls[2]?.params?.[9], replayReport);
    const diffPayload = parseJsonPayloadParam<ReplayDiffReport>(
      calls[3]?.params?.[6],
      replayDiffReport
    );

    expectReplayInsertBoundary(calls[0], "manifest", "manifest_id");
    expectReplayInsertBoundary(calls[1], "run", "replay_run_id");
    expectReplayInsertBoundary(calls[2], "report", "replay_report_id");
    expectReplayInsertBoundary(calls[3], "diff", "diff_report_id");
    expect(calls[0]?.sql).toContain("$9::jsonb");
    expect(calls[1]?.sql).toContain("$8::jsonb");
    expect(calls[2]?.sql).toContain("$10::jsonb");
    expect(calls[3]?.sql).toContain("$7::jsonb");

    expect(calls[0]?.params?.[4]).toBe(manifestPayload.manifest_id);
    expect(calls[0]?.params?.[5]).toBe(manifestPayload.source_result_id);
    expect(calls[0]?.params?.[6]).toBe(manifestPayload.input_hash);
    expect(calls[0]?.params?.[7]).toBe(manifestPayload.manifest_hash);

    expect(calls[1]?.params?.[4]).toBe(runPayload.replay_run_id);
    expect(calls[1]?.params?.[5]).toBe(runPayload.manifest_id);
    expect(calls[1]?.params?.[6]).toBe(runPayload.status);

    expect(calls[2]?.params?.[4]).toBe(reportPayload.replay_report_id);
    expect(calls[2]?.params?.[5]).toBe(reportPayload.replay_run_id);
    expect(calls[2]?.params?.[6]).toBe(reportPayload.source_result_id);
    expect(calls[2]?.params?.[7]).toBe(reportPayload.replay_result_hash);
    expect(calls[2]?.params?.[8]).toBe(reportPayload.status);

    expect(calls[3]?.params?.[4]).toBe(diffPayload.diff_report_id);
    expect(calls[3]?.params?.[5]).toBe(diffPayload.replay_report_id);
    expect(calls[3]?.sql).not.toContain("replay_diff_report_id");
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
      "replay",
      "rounds",
      "runs",
      "settlements"
    ]);
    expect("identity" in adapter).toBe(false);
    expect(adapter.courses.getCourse).toEqual(expect.any(Function));
    expect(adapter.courses.listCoursesForUser).toEqual(expect.any(Function));
    expect(adapter.runs.getRun).toEqual(expect.any(Function));
    expect(adapter.runs.listRunsForCourse).toEqual(expect.any(Function));
    expect(adapter.rounds.getRound).toEqual(expect.any(Function));
    expect(adapter.rounds.listRoundsForRun).toEqual(expect.any(Function));
    expect(adapter.decisions.getDecisionById).toEqual(expect.any(Function));
    expect(adapter.decisions.getCanonicalDecisionForTeamRound).toEqual(expect.any(Function));
    expect(adapter.decisions.listDecisionsForRound).toEqual(expect.any(Function));
    expect(adapter.decisions.saveDecision).toEqual(expect.any(Function));
    expect(adapter.decisions.saveCanonicalDecision).toEqual(expect.any(Function));
    expect(adapter.settlements.getSettlementResult).toEqual(expect.any(Function));
    expect(adapter.settlements.listSettlementResultsForRound).toEqual(expect.any(Function));
    expect(adapter.settlements.saveSettlementResult).toEqual(expect.any(Function));
    expect(Object.keys(adapter.decisions).sort()).toEqual([
      "getCanonicalDecisionForTeamRound",
      "getDecisionById",
      "listDecisionsForRound",
      "saveCanonicalDecision",
      "saveDecision"
    ]);
    expect(Object.keys(adapter.settlements).sort()).toEqual([
      "getSettlementResult",
      "listSettlementResultsForRound",
      "saveSettlementResult"
    ]);
    expect(Object.keys(adapter.replay).sort()).toEqual([
      "getReplayDiffReport",
      "getReplayInputManifest",
      "getReplayReport",
      "getReplayRun",
      "saveReplayDiffReport",
      "saveReplayInputManifest",
      "saveReplayReport",
      "saveReplayRun"
    ]);
    expect(adapter.replay.getReplayInputManifest).toEqual(expect.any(Function));
    expect(adapter.replay.getReplayRun).toEqual(expect.any(Function));
    expect(adapter.replay.getReplayReport).toEqual(expect.any(Function));
    expect(adapter.replay.getReplayDiffReport).toEqual(expect.any(Function));
    expect(adapter.replay.saveReplayInputManifest).toEqual(expect.any(Function));
    expect(adapter.replay.saveReplayRun).toEqual(expect.any(Function));
    expect(adapter.replay.saveReplayReport).toEqual(expect.any(Function));
    expect(adapter.replay.saveReplayDiffReport).toEqual(expect.any(Function));
    expect("listReplayRecords" in adapter.replay).toBe(false);
    expect("updateReplayRecord" in adapter.replay).toBe(false);
    expect("deleteReplayRecord" in adapter.replay).toBe(false);
    expect("list" in adapter.replay).toBe(false);
    expect("update" in adapter.replay).toBe(false);
    expect("delete" in adapter.replay).toBe(false);
    expect("provider" in adapter.replay).toBe(false);
    expect("repositoryProvider" in adapter.replay).toBe(false);
    expect("runtime" in adapter.replay).toBe(false);
    expect("connect" in adapter.replay).toBe(false);
    expect("provider" in adapter).toBe(false);
    expect("repositoryProvider" in adapter).toBe(false);
  });
});
