/**
 * Dependency-free Postgres repository adapter skeleton.
 *
 * This module only defines the future adapter construction boundary. It does
 * not import a database driver, implement SimWarRepositoryPorts, register with
 * the repository provider, connect to runtime, or change JSON adapter behavior.
 * Query helpers delegate only to the injected PostgresQueryExecutor.
 */

import type { Decision, Round, Run } from "@simwar/shared-contracts";
import type { RepositoryCourseReadModel, RepositoryId } from "./repository-ports.js";

export interface PostgresQueryResult<
  TRow extends Record<string, unknown> = Record<string, unknown>
> {
  rowCount: number;
  rows: TRow[];
}

export type PostgresQueryExecutor = <
  TRow extends Record<string, unknown> = Record<string, unknown>
>(
  sql: string,
  params?: readonly unknown[]
) => Promise<PostgresQueryResult<TRow>>;

export interface PostgresRepositoryAdapterOptions {
  applicationName?: string;
  queryExecutor: PostgresQueryExecutor;
  schema?: string;
}

export interface PostgresCourseReadMapping {
  getCourse(
    tenantId: RepositoryId,
    courseId: RepositoryId
  ): Promise<RepositoryCourseReadModel | null>;
  listCoursesForUser(
    tenantId: RepositoryId,
    userId: RepositoryId
  ): Promise<RepositoryCourseReadModel[]>;
}

export interface PostgresRunReadMapping {
  getRun(tenantId: RepositoryId, runId: RepositoryId): Promise<Run | null>;
  listRunsForCourse(tenantId: RepositoryId, courseId: RepositoryId): Promise<Run[]>;
}

export interface PostgresRoundReadMapping {
  getRound(tenantId: RepositoryId, roundId: RepositoryId): Promise<Round | null>;
  listRoundsForRun(tenantId: RepositoryId, runId: RepositoryId): Promise<Round[]>;
}

export interface PostgresDecisionReadMapping {
  getDecisionById(tenantId: RepositoryId, decisionId: RepositoryId): Promise<Decision | null>;
  listDecisionsForRound(
    tenantId: RepositoryId,
    runId: RepositoryId,
    roundId: RepositoryId
  ): Promise<Decision[]>;
}

interface PostgresUserPresenceRow extends Record<string, unknown> {
  user_id: RepositoryId;
}

interface PostgresCourseReadRow extends Record<string, unknown> {
  course_id: RepositoryId;
  status?: string | null;
  tenant_id: RepositoryId;
}

interface PostgresRunReadRow extends Record<string, unknown> {
  course_id: RepositoryId;
  parameter_set_id: RepositoryId;
  run_id: RepositoryId;
  scenario_package_id: RepositoryId;
  seed: number;
  status: Run["status"];
  tenant_id: RepositoryId;
}

interface PostgresRoundReadRow extends Record<string, unknown> {
  decision_batch_id?: string | null;
  replay_hash?: string | null;
  round_id: RepositoryId;
  round_no: Round["round_no"];
  run_id: RepositoryId;
  status: Round["status"];
  tenant_id: RepositoryId;
}

interface PostgresDecisionReadRow extends Record<string, unknown> {
  canonical_source?: Decision["canonical_source"] | null;
  decision_id: RepositoryId;
  merge_commit_id?: string | null;
  payload: Decision["payload"];
  round_id: RepositoryId;
  round_no: Decision["round_no"];
  run_id: RepositoryId;
  status: Decision["status"];
  submitted_by: string;
  team_confirmation_id?: string | null;
  team_id: RepositoryId;
  tenant_id: RepositoryId;
  validation_report: Decision["validation_report"];
  version: Decision["version"];
}

function toCourseReadModel(row: PostgresCourseReadRow): RepositoryCourseReadModel {
  const course: RepositoryCourseReadModel = {
    course_id: row.course_id,
    tenant_id: row.tenant_id
  };

  if (typeof row.status === "string") {
    course.status = row.status;
  }

  return course;
}

function toRun(row: PostgresRunReadRow): Run {
  return {
    course_id: row.course_id,
    parameter_set_id: row.parameter_set_id,
    run_id: row.run_id,
    scenario_package_id: row.scenario_package_id,
    seed: row.seed,
    status: row.status,
    tenant_id: row.tenant_id
  };
}

function toRound(row: PostgresRoundReadRow): Round {
  const round: Round = {
    round_id: row.round_id,
    round_no: row.round_no,
    run_id: row.run_id,
    status: row.status,
    tenant_id: row.tenant_id
  };

  if (typeof row.decision_batch_id === "string") {
    round.decision_batch_id = row.decision_batch_id;
  }

  if (typeof row.replay_hash === "string") {
    round.replay_hash = row.replay_hash;
  }

  return round;
}

function toDecision(row: PostgresDecisionReadRow): Decision {
  const decision: Decision = {
    decision_id: row.decision_id,
    payload: row.payload,
    round_id: row.round_id,
    round_no: row.round_no,
    run_id: row.run_id,
    status: row.status,
    submitted_by: row.submitted_by,
    team_id: row.team_id,
    tenant_id: row.tenant_id,
    validation_report: row.validation_report,
    version: row.version
  };

  if (typeof row.canonical_source === "string") {
    decision.canonical_source = row.canonical_source;
  }

  if (typeof row.merge_commit_id === "string") {
    decision.merge_commit_id = row.merge_commit_id;
  }

  if (typeof row.team_confirmation_id === "string") {
    decision.team_confirmation_id = row.team_confirmation_id;
  }

  return decision;
}

/**
 * Skeleton holder for a future Postgres implementation.
 *
 * A later PR should implement repository ports and parity tests. Until then, the
 * helper methods here only provide a narrow query boundary for future mappings.
 */
export class PostgresRepositoryAdapter {
  readonly courses: PostgresCourseReadMapping;
  readonly decisions: PostgresDecisionReadMapping;
  readonly options: Readonly<PostgresRepositoryAdapterOptions>;
  readonly queryExecutor: PostgresQueryExecutor;
  readonly rounds: PostgresRoundReadMapping;
  readonly runs: PostgresRunReadMapping;

  constructor(options: PostgresRepositoryAdapterOptions) {
    this.options = { ...options };
    this.queryExecutor = options.queryExecutor;
    this.courses = {
      getCourse: async (tenantId, courseId) => {
        const row = await this.queryOne<PostgresCourseReadRow>(
          "SELECT tenant_id, course_id, status FROM courses WHERE tenant_id = $1 AND course_id = $2",
          [tenantId, courseId]
        );

        return row === null ? null : toCourseReadModel(row);
      },
      listCoursesForUser: async (tenantId, userId) => {
        const user = await this.queryOne<PostgresUserPresenceRow>(
          "SELECT user_id FROM users WHERE tenant_id = $1 AND user_id = $2",
          [tenantId, userId]
        );

        if (user === null) {
          return [];
        }

        const rows = await this.queryRows<PostgresCourseReadRow>(
          "SELECT tenant_id, course_id, status FROM courses WHERE tenant_id = $1 ORDER BY created_at ASC, course_id ASC",
          [tenantId]
        );

        return rows.map(toCourseReadModel);
      }
    };
    this.runs = {
      getRun: async (tenantId, runId) => {
        const row = await this.queryOne<PostgresRunReadRow>(
          "SELECT tenant_id, run_id, course_id, scenario_package_id, parameter_set_id, seed, status FROM simulation_runs WHERE tenant_id = $1 AND run_id = $2",
          [tenantId, runId]
        );

        return row === null ? null : toRun(row);
      },
      listRunsForCourse: async (tenantId, courseId) => {
        const rows = await this.queryRows<PostgresRunReadRow>(
          "SELECT tenant_id, run_id, course_id, scenario_package_id, parameter_set_id, seed, status FROM simulation_runs WHERE tenant_id = $1 AND course_id = $2 ORDER BY created_at ASC, run_id ASC",
          [tenantId, courseId]
        );

        return rows.map(toRun);
      }
    };
    this.rounds = {
      getRound: async (tenantId, roundId) => {
        const row = await this.queryOne<PostgresRoundReadRow>(
          "SELECT tenant_id, round_id, run_id, round_no, status, decision_batch_id, replay_hash FROM simulation_rounds WHERE tenant_id = $1 AND round_id = $2",
          [tenantId, roundId]
        );

        return row === null ? null : toRound(row);
      },
      listRoundsForRun: async (tenantId, runId) => {
        const rows = await this.queryRows<PostgresRoundReadRow>(
          "SELECT tenant_id, round_id, run_id, round_no, status, decision_batch_id, replay_hash FROM simulation_rounds WHERE tenant_id = $1 AND run_id = $2 ORDER BY created_at ASC, round_id ASC",
          [tenantId, runId]
        );

        return rows.map(toRound);
      }
    };
    this.decisions = {
      getDecisionById: async (tenantId, decisionId) => {
        const row = await this.queryOne<PostgresDecisionReadRow>(
          "SELECT tenant_id, decision_id, run_id, round_id, round_no, team_id, status, version, payload, validation_report, submitted_by, canonical_source, merge_commit_id, team_confirmation_id FROM decisions WHERE tenant_id = $1 AND decision_id = $2",
          [tenantId, decisionId]
        );

        return row === null ? null : toDecision(row);
      },
      listDecisionsForRound: async (tenantId, runId, roundId) => {
        const rows = await this.queryRows<PostgresDecisionReadRow>(
          "SELECT tenant_id, decision_id, run_id, round_id, round_no, team_id, status, version, payload, validation_report, submitted_by, canonical_source, merge_commit_id, team_confirmation_id FROM decisions WHERE tenant_id = $1 AND run_id = $2 AND round_id = $3 ORDER BY created_at ASC, decision_id ASC",
          [tenantId, runId, roundId]
        );

        return rows.map(toDecision);
      }
    };
  }

  async queryRows<TRow extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<readonly TRow[]> {
    const result = await this.queryExecutor<TRow>(sql, params);

    return result.rows;
  }

  async queryOne<TRow extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<TRow | null> {
    const rows = await this.queryRows<TRow>(sql, params);

    return rows[0] ?? null;
  }

  async execute(
    sql: string,
    params?: readonly unknown[]
  ): Promise<Pick<PostgresQueryResult, "rowCount">> {
    const result = await this.queryExecutor(sql, params);

    return {
      rowCount: result.rowCount
    };
  }
}

export function createPostgresRepositoryAdapter(
  options: PostgresRepositoryAdapterOptions
): PostgresRepositoryAdapter {
  return new PostgresRepositoryAdapter(options);
}
