import { describe, expect, it } from "vitest";
import type { Decision, Round, Run, SettlementResult } from "@simwar/shared-contracts";
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
    expect(calls[0]?.params?.[8]).toBe(settlement.replay_hash);
    expect(calls[0]?.params?.[9]).toBe(JSON.stringify(settlement.team_results));
    expect(JSON.parse(calls[0]?.params?.[9] as string)).toEqual(settlement.team_results);
    expect(calls[0]?.sql).toContain("ON CONFLICT (tenant_id, settlement_result_id)");
    expect(calls[0]?.sql).not.toMatch(/^SELECT/i);
    expect(calls[0]?.sql).not.toContain("payload");
    expect(calls[0]?.sql).not.toContain("metadata");
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
    expect(calls[0]?.sql).not.toContain("metadata");
    expect(calls[0]?.sql).not.toMatch(/^SELECT/i);
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
    expect("replay" in adapter).toBe(false);
  });
});
