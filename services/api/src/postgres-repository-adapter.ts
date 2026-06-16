/**
 * Dependency-free Postgres repository adapter skeleton.
 *
 * This module only defines the future adapter construction boundary. It does
 * not import a database driver, implement SimWarRepositoryPorts, register with
 * the repository provider, connect to runtime, or change JSON adapter behavior.
 * Query helpers delegate only to the injected PostgresQueryExecutor.
 */

import { randomUUID } from "node:crypto";
import type {
  AuditLog,
  Decision,
  ReplayDiffReport,
  ReplayInputManifest,
  ReplayReport,
  ReplayRun,
  Round,
  Run,
  SettlementResult,
  StateSnapshot
} from "@simwar/shared-contracts";
import type {
  RepositoryCourseReadModel,
  RepositoryId,
  RepositorySnapshotQuery,
  SettlementOutcomePersistencePort
} from "./repository-ports.js";

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

export interface PostgresAuditLogMapping {
  appendAuditLog(auditLog: AuditLog): Promise<void>;
  listAuditLogs(query: {
    tenant_id: RepositoryId;
    actor_id?: RepositoryId;
    action?: string;
    resource_id?: RepositoryId;
    limit?: number;
  }): Promise<AuditLog[]>;
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

export interface PostgresRoundMapping {
  getRound(tenantId: RepositoryId, roundId: RepositoryId): Promise<Round | null>;
  listRoundsForRun(tenantId: RepositoryId, runId: RepositoryId): Promise<Round[]>;
  markRoundSettled(
    tenantId: RepositoryId,
    roundId: RepositoryId,
    settlementResultId: RepositoryId
  ): Promise<void>;
  saveRound(round: Round): Promise<void>;
}

export interface PostgresDecisionMapping {
  getDecisionById(tenantId: RepositoryId, decisionId: RepositoryId): Promise<Decision | null>;
  getCanonicalDecisionForTeamRound(
    tenantId: RepositoryId,
    runId: RepositoryId,
    roundId: RepositoryId,
    teamId: RepositoryId
  ): Promise<Decision | null>;
  listDecisionsForRound(
    tenantId: RepositoryId,
    runId: RepositoryId,
    roundId: RepositoryId
  ): Promise<Decision[]>;
  saveDecision(decision: Decision): Promise<void>;
  saveCanonicalDecision(decision: Decision): Promise<void>;
}

export interface PostgresSettlementMapping {
  getSettlementResult(
    tenantId: RepositoryId,
    settlementResultId: RepositoryId
  ): Promise<SettlementResult | null>;
  listSettlementResultsForRound(
    tenantId: RepositoryId,
    runId: RepositoryId,
    roundId: RepositoryId
  ): Promise<SettlementResult[]>;
  saveSettlementResult(result: SettlementResult): Promise<void>;
}

export interface PostgresReplayMapping {
  getReplayInputManifest(
    tenantId: RepositoryId,
    manifestId: RepositoryId
  ): Promise<ReplayInputManifest | null>;
  saveReplayInputManifest(manifest: ReplayInputManifest): Promise<void>;
  getReplayRun(tenantId: RepositoryId, replayRunId: RepositoryId): Promise<ReplayRun | null>;
  saveReplayRun(run: ReplayRun): Promise<void>;
  getReplayReport(
    tenantId: RepositoryId,
    replayReportId: RepositoryId
  ): Promise<ReplayReport | null>;
  saveReplayReport(report: ReplayReport): Promise<void>;
  getReplayDiffReport(
    tenantId: RepositoryId,
    replayDiffReportId: RepositoryId
  ): Promise<ReplayDiffReport | null>;
  saveReplayDiffReport(report: ReplayDiffReport): Promise<void>;
}

export interface PostgresStateSnapshotMapping {
  getStateSnapshot(query: RepositorySnapshotQuery): Promise<StateSnapshot | null>;
  saveStateSnapshot(snapshot: StateSnapshot): Promise<void>;
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

interface PostgresSettlementResultReadRow extends Record<string, unknown> {
  parameter_set_id: RepositoryId;
  replay_hash: SettlementResult["replay_hash"];
  round_id: RepositoryId;
  round_no: SettlementResult["round_no"];
  run_id: RepositoryId;
  scenario_package_id: RepositoryId;
  settlement_result_id: RepositoryId;
  team_results: SettlementResult["team_results"];
  tenant_id: RepositoryId;
}

interface PostgresReplayInputManifestReadRow extends Record<string, unknown> {
  payload: ReplayInputManifest;
}

interface PostgresReplayRunReadRow extends Record<string, unknown> {
  payload: ReplayRun;
}

interface PostgresReplayReportReadRow extends Record<string, unknown> {
  payload: ReplayReport;
}

interface PostgresReplayDiffReportReadRow extends Record<string, unknown> {
  payload: ReplayDiffReport;
}

interface PostgresAuditLogReadRow extends Record<string, unknown> {
  payload: AuditLog;
}

interface PostgresStateSnapshotReadRow extends Record<string, unknown> {
  payload: StateSnapshot;
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

function toDecisionRowId(tenantId: RepositoryId, decisionId: RepositoryId): string {
  return JSON.stringify(["decision", tenantId, decisionId]);
}

function toSettlementResultRowId(tenantId: RepositoryId, settlementResultId: RepositoryId): string {
  return JSON.stringify(["settlement_result", tenantId, settlementResultId]);
}

function toRoundRowId(tenantId: RepositoryId, roundId: RepositoryId): string {
  return JSON.stringify(["round", tenantId, roundId]);
}

function toReplayRecordRowId(): string {
  return JSON.stringify(["replay_record", randomUUID()]);
}

function toAuditLogRowId(): string {
  return JSON.stringify(["audit_log", randomUUID()]);
}

function toStateSnapshotRowId(): string {
  return JSON.stringify(["state_snapshot", randomUUID()]);
}

function getStringField(value: object, field: string): string | undefined {
  const record = value as Record<string, unknown>;
  const fieldValue = record[field];

  return typeof fieldValue === "string" ? fieldValue : undefined;
}

function getNumberField(value: object, field: string): number | undefined {
  const record = value as Record<string, unknown>;
  const fieldValue = record[field];

  return typeof fieldValue === "number" ? fieldValue : undefined;
}

function requireReplayIdentity(
  value: object,
  fields: readonly string[],
  recordLabel: string
): string {
  for (const field of fields) {
    const fieldValue = getStringField(value, field);

    if (fieldValue !== undefined) {
      return fieldValue;
    }
  }

  throw new Error(`${recordLabel} requires one of: ${fields.join(", ")}`);
}

function toSettlementResult(row: PostgresSettlementResultReadRow): SettlementResult {
  return {
    parameter_set_id: row.parameter_set_id,
    replay_hash: row.replay_hash,
    round_id: row.round_id,
    round_no: row.round_no,
    run_id: row.run_id,
    scenario_package_id: row.scenario_package_id,
    settlement_result_id: row.settlement_result_id,
    team_results: row.team_results,
    tenant_id: row.tenant_id
  };
}

export function createPostgresSettlementOutcomePersistencePort(
  options: PostgresRepositoryAdapterOptions
): SettlementOutcomePersistencePort {
  return {
    async commitSettlementOutcome(command): Promise<void> {
      const result = command.settlement_result;

      if (command.tenant_id !== result.tenant_id) {
        throw new Error("settlement_outcome_tenant_mismatch");
      }

      if (command.round_id !== result.round_id) {
        throw new Error("settlement_outcome_round_mismatch");
      }

      const queryResult = await options.queryExecutor(
        `WITH target_round AS (
          SELECT id
          FROM simulation_rounds
          WHERE tenant_id = $1 AND round_id = $2
          FOR UPDATE
        ),
        upserted_settlement AS (
          INSERT INTO settlement_results (
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
            payload,
            updated_at
          )
          SELECT $4, $3, $1, $5, $2, $6, $7, $8, $9, $10::jsonb, $11::jsonb, now()
          FROM target_round
          ON CONFLICT (tenant_id, settlement_result_id)
          DO UPDATE SET
            run_id = EXCLUDED.run_id,
            round_id = EXCLUDED.round_id,
            round_no = EXCLUDED.round_no,
            parameter_set_id = EXCLUDED.parameter_set_id,
            scenario_package_id = EXCLUDED.scenario_package_id,
            replay_hash = EXCLUDED.replay_hash,
            team_results = EXCLUDED.team_results,
            payload = EXCLUDED.payload,
            updated_at = now()
          RETURNING replay_hash
        )
        UPDATE simulation_rounds AS target
        SET
          status = 'settled',
          replay_hash = (SELECT replay_hash FROM upserted_settlement),
          payload = jsonb_set(
            jsonb_set(
              target.payload,
              '{status}',
              to_jsonb('settled'::text),
              true
            ),
            '{replay_hash}',
            to_jsonb((SELECT replay_hash FROM upserted_settlement)),
            true
          ),
          updated_at = now()
        FROM target_round
        WHERE target.id = target_round.id`,
        [
          command.tenant_id,
          command.round_id,
          result.settlement_result_id,
          toSettlementResultRowId(result.tenant_id, result.settlement_result_id),
          result.run_id,
          result.round_no,
          result.parameter_set_id,
          result.scenario_package_id,
          result.replay_hash,
          JSON.stringify(result.team_results),
          JSON.stringify(result)
        ]
      );

      if (queryResult.rowCount === 0) {
        throw new Error("settlement_outcome_round_missing");
      }

      if (queryResult.rowCount !== 1) {
        throw new Error("settlement_outcome_row_count_invariant");
      }
    }
  };
}

/**
 * Skeleton holder for a future Postgres implementation.
 *
 * A later PR should implement repository ports and parity tests. Until then, the
 * helper methods here only provide a narrow query boundary for future mappings.
 */
export class PostgresRepositoryAdapter {
  readonly auditLogs: PostgresAuditLogMapping;
  readonly courses: PostgresCourseReadMapping;
  readonly decisions: PostgresDecisionMapping;
  readonly options: Readonly<PostgresRepositoryAdapterOptions>;
  readonly queryExecutor: PostgresQueryExecutor;
  readonly replay: PostgresReplayMapping;
  readonly rounds: PostgresRoundMapping;
  readonly runs: PostgresRunReadMapping;
  readonly settlements: PostgresSettlementMapping;
  readonly stateSnapshots: PostgresStateSnapshotMapping;

  constructor(options: PostgresRepositoryAdapterOptions) {
    this.options = { ...options };
    this.queryExecutor = options.queryExecutor;
    this.auditLogs = {
      appendAuditLog: async (auditLog) => {
        await this.saveAuditLogRow(auditLog);
      },
      listAuditLogs: async (query) => {
        const conditions = ["tenant_id = $1"];
        const params: unknown[] = [query.tenant_id];

        if (query.actor_id) {
          params.push(query.actor_id);
          conditions.push(`actor_id = $${params.length}`);
        }

        if (query.action) {
          params.push(query.action);
          conditions.push(`action = $${params.length}`);
        }

        if (query.resource_id) {
          params.push(query.resource_id);
          conditions.push(`resource_id = $${params.length}`);
        }

        let sql = `SELECT payload FROM audit_logs WHERE ${conditions.join(
          " AND "
        )} ORDER BY audit_sequence ASC`;

        if (query.limit && query.limit > 0) {
          params.push(query.limit);
          sql += ` LIMIT $${params.length}`;
        }

        const rows = await this.queryRows<PostgresAuditLogReadRow>(sql, params);

        return rows.map((row) => row.payload);
      }
    };
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
      },
      markRoundSettled: async (tenantId, roundId, settlementResultId) => {
        await this.markRoundSettledRow(tenantId, roundId, settlementResultId);
      },
      saveRound: async (round) => {
        await this.saveRoundRow(round);
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
      getCanonicalDecisionForTeamRound: async (tenantId, runId, roundId, teamId) => {
        const row = await this.queryOne<PostgresDecisionReadRow>(
          "SELECT tenant_id, decision_id, run_id, round_id, round_no, team_id, status, version, payload, validation_report, submitted_by, canonical_source, merge_commit_id, team_confirmation_id FROM decisions WHERE tenant_id = $1 AND run_id = $2 AND round_id = $3 AND team_id = $4 AND status = 'submitted' ORDER BY created_at ASC, decision_id ASC LIMIT 1",
          [tenantId, runId, roundId, teamId]
        );

        return row === null ? null : toDecision(row);
      },
      listDecisionsForRound: async (tenantId, runId, roundId) => {
        const rows = await this.queryRows<PostgresDecisionReadRow>(
          "SELECT tenant_id, decision_id, run_id, round_id, round_no, team_id, status, version, payload, validation_report, submitted_by, canonical_source, merge_commit_id, team_confirmation_id FROM decisions WHERE tenant_id = $1 AND run_id = $2 AND round_id = $3 ORDER BY created_at ASC, decision_id ASC",
          [tenantId, runId, roundId]
        );

        return rows.map(toDecision);
      },
      saveDecision: async (decision) => {
        await this.saveDecisionRow(decision);
      },
      saveCanonicalDecision: async (decision) => {
        await this.saveDecisionRow(decision);
      }
    };
    this.settlements = {
      getSettlementResult: async (tenantId, settlementResultId) => {
        const row = await this.queryOne<PostgresSettlementResultReadRow>(
          "SELECT tenant_id, settlement_result_id, run_id, round_id, round_no, parameter_set_id, scenario_package_id, replay_hash, team_results FROM settlement_results WHERE tenant_id = $1 AND settlement_result_id = $2",
          [tenantId, settlementResultId]
        );

        return row === null ? null : toSettlementResult(row);
      },
      listSettlementResultsForRound: async (tenantId, runId, roundId) => {
        const rows = await this.queryRows<PostgresSettlementResultReadRow>(
          "SELECT tenant_id, settlement_result_id, run_id, round_id, round_no, parameter_set_id, scenario_package_id, replay_hash, team_results FROM settlement_results WHERE tenant_id = $1 AND run_id = $2 AND round_id = $3 ORDER BY created_at ASC, settlement_result_id ASC",
          [tenantId, runId, roundId]
        );

        return rows.map(toSettlementResult);
      },
      saveSettlementResult: async (result) => {
        await this.saveSettlementResultRow(result);
      }
    };
    this.stateSnapshots = {
      getStateSnapshot: async (query) => {
        const params: unknown[] = [query.tenant_id, query.aggregate_type, query.aggregate_id];
        let sql =
          "SELECT payload FROM state_snapshots WHERE tenant_id = $1 AND aggregate_type = $2 AND aggregate_id = $3";

        if (query.at_sequence !== undefined) {
          params.push(query.at_sequence);
          sql += ` AND (sequence IS NULL OR sequence <= $${params.length})`;
        }

        sql += " ORDER BY snapshot_sequence DESC LIMIT 1";

        const row = await this.queryOne<PostgresStateSnapshotReadRow>(sql, params);

        return row === null ? null : row.payload;
      },
      saveStateSnapshot: async (snapshot) => {
        await this.saveStateSnapshotRow(snapshot);
      }
    };
    this.replay = {
      getReplayInputManifest: async (tenantId, manifestId) => {
        const row = await this.queryOne<PostgresReplayInputManifestReadRow>(
          "SELECT payload FROM replay_records WHERE tenant_id = $1 AND record_type = 'manifest' AND manifest_id = $2 ORDER BY append_sequence ASC LIMIT 1",
          [tenantId, manifestId]
        );

        return row === null ? null : row.payload;
      },
      saveReplayInputManifest: async (manifest) => {
        await this.saveReplayInputManifestRow(manifest);
      },
      getReplayRun: async (tenantId, replayRunId) => {
        const row = await this.queryOne<PostgresReplayRunReadRow>(
          "SELECT payload FROM replay_records WHERE tenant_id = $1 AND record_type = 'run' AND replay_run_id = $2 ORDER BY append_sequence ASC LIMIT 1",
          [tenantId, replayRunId]
        );

        return row === null ? null : row.payload;
      },
      saveReplayRun: async (run) => {
        await this.saveReplayRunRow(run);
      },
      getReplayReport: async (tenantId, replayReportId) => {
        const row = await this.queryOne<PostgresReplayReportReadRow>(
          "SELECT payload FROM replay_records WHERE tenant_id = $1 AND record_type = 'report' AND replay_report_id = $2 ORDER BY append_sequence ASC LIMIT 1",
          [tenantId, replayReportId]
        );

        return row === null ? null : row.payload;
      },
      saveReplayReport: async (report) => {
        await this.saveReplayReportRow(report);
      },
      getReplayDiffReport: async (tenantId, replayDiffReportId) => {
        const row = await this.queryOne<PostgresReplayDiffReportReadRow>(
          "SELECT payload FROM replay_records WHERE tenant_id = $1 AND record_type = 'diff' AND diff_report_id = $2 ORDER BY append_sequence ASC LIMIT 1",
          [tenantId, replayDiffReportId]
        );

        return row === null ? null : row.payload;
      },
      saveReplayDiffReport: async (report) => {
        await this.saveReplayDiffReportRow(report);
      }
    };
  }

  private async saveAuditLogRow(auditLog: AuditLog): Promise<void> {
    await this.execute(
      "INSERT INTO audit_logs (id, audit_id, tenant_id, actor_id, actor_role, action, resource_type, resource_id, request_id, created_at, payload) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)",
      [
        toAuditLogRowId(),
        auditLog.audit_id,
        auditLog.tenant_id,
        auditLog.actor_id,
        auditLog.actor_role,
        auditLog.action,
        auditLog.resource_type,
        auditLog.resource_id,
        auditLog.request_id,
        auditLog.created_at,
        JSON.stringify(auditLog)
      ]
    );
  }

  private async saveDecisionRow(decision: Decision): Promise<void> {
    await this.execute(
      "INSERT INTO decisions (id, decision_id, tenant_id, run_id, round_id, round_no, team_id, version, status, canonical_source, merge_commit_id, team_confirmation_id, submitted_by, payload, validation_report, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now()) ON CONFLICT (tenant_id, decision_id) DO UPDATE SET run_id = EXCLUDED.run_id, round_id = EXCLUDED.round_id, round_no = EXCLUDED.round_no, team_id = EXCLUDED.team_id, version = EXCLUDED.version, status = EXCLUDED.status, canonical_source = EXCLUDED.canonical_source, merge_commit_id = EXCLUDED.merge_commit_id, team_confirmation_id = EXCLUDED.team_confirmation_id, submitted_by = EXCLUDED.submitted_by, payload = EXCLUDED.payload, validation_report = EXCLUDED.validation_report, updated_at = now()",
      [
        toDecisionRowId(decision.tenant_id, decision.decision_id),
        decision.decision_id,
        decision.tenant_id,
        decision.run_id,
        decision.round_id,
        decision.round_no,
        decision.team_id,
        decision.version,
        decision.status,
        decision.canonical_source ?? null,
        decision.merge_commit_id ?? null,
        decision.team_confirmation_id ?? null,
        decision.submitted_by,
        decision.payload,
        decision.validation_report
      ]
    );
  }

  private async saveRoundRow(round: Round): Promise<void> {
    await this.execute(
      "INSERT INTO simulation_rounds (id, round_id, tenant_id, run_id, round_no, status, decision_batch_id, replay_hash, payload, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now()) ON CONFLICT (tenant_id, round_id) DO UPDATE SET run_id = EXCLUDED.run_id, round_no = EXCLUDED.round_no, status = EXCLUDED.status, decision_batch_id = EXCLUDED.decision_batch_id, replay_hash = EXCLUDED.replay_hash, payload = EXCLUDED.payload, updated_at = now()",
      [
        toRoundRowId(round.tenant_id, round.round_id),
        round.round_id,
        round.tenant_id,
        round.run_id,
        round.round_no,
        round.status,
        round.decision_batch_id ?? null,
        round.replay_hash ?? null,
        JSON.stringify(round)
      ]
    );
  }

  private async markRoundSettledRow(
    tenantId: RepositoryId,
    roundId: RepositoryId,
    settlementResultId: RepositoryId
  ): Promise<void> {
    await this.execute(
      "WITH settlement AS (SELECT replay_hash FROM settlement_results WHERE tenant_id = $1 AND settlement_result_id = $3 LIMIT 1) UPDATE simulation_rounds AS target SET status = 'settled', replay_hash = CASE WHEN EXISTS (SELECT 1 FROM settlement) THEN (SELECT replay_hash FROM settlement) ELSE target.replay_hash END, payload = CASE WHEN EXISTS (SELECT 1 FROM settlement) THEN jsonb_set(jsonb_set(target.payload, '{status}', to_jsonb('settled'::text), true), '{replay_hash}', to_jsonb((SELECT replay_hash FROM settlement)), true) ELSE jsonb_set(target.payload, '{status}', to_jsonb('settled'::text), true) END, updated_at = now() WHERE target.tenant_id = $1 AND target.round_id = $2",
      [tenantId, roundId, settlementResultId]
    );
  }

  private async saveSettlementResultRow(result: SettlementResult): Promise<void> {
    await this.execute(
      "INSERT INTO settlement_results (id, settlement_result_id, tenant_id, run_id, round_id, round_no, parameter_set_id, scenario_package_id, replay_hash, team_results, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, now()) ON CONFLICT (tenant_id, settlement_result_id) DO UPDATE SET run_id = EXCLUDED.run_id, round_id = EXCLUDED.round_id, round_no = EXCLUDED.round_no, parameter_set_id = EXCLUDED.parameter_set_id, scenario_package_id = EXCLUDED.scenario_package_id, replay_hash = EXCLUDED.replay_hash, team_results = EXCLUDED.team_results, updated_at = now()",
      [
        toSettlementResultRowId(result.tenant_id, result.settlement_result_id),
        result.settlement_result_id,
        result.tenant_id,
        result.run_id,
        result.round_id,
        result.round_no,
        result.parameter_set_id,
        result.scenario_package_id,
        result.replay_hash,
        JSON.stringify(result.team_results)
      ]
    );
  }

  private async saveStateSnapshotRow(snapshot: StateSnapshot): Promise<void> {
    await this.execute(
      "INSERT INTO state_snapshots (id, snapshot_id, tenant_id, run_id, round_id, team_id, aggregate_type, aggregate_id, sequence, snapshot_type, captured_at, payload) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)",
      [
        toStateSnapshotRowId(),
        snapshot.snapshot_id,
        snapshot.tenant_id,
        snapshot.run_id,
        snapshot.round_id,
        getStringField(snapshot, "team_id") ?? null,
        getStringField(snapshot, "aggregate_type") ?? null,
        getStringField(snapshot, "aggregate_id") ?? null,
        getNumberField(snapshot, "sequence") ?? null,
        snapshot.snapshot_type,
        snapshot.captured_at,
        JSON.stringify(snapshot)
      ]
    );
  }

  private async saveReplayInputManifestRow(manifest: ReplayInputManifest): Promise<void> {
    const manifestId = requireReplayIdentity(
      manifest,
      ["manifest_id", "replay_input_manifest_id"],
      "ReplayInputManifest"
    );

    await this.execute(
      "INSERT INTO replay_records (id, tenant_id, run_id, round_id, record_type, manifest_id, source_result_id, input_hash, manifest_hash, payload) VALUES ($1, $2, $3, $4, 'manifest', $5, $6, $7, $8, $9::jsonb)",
      [
        toReplayRecordRowId(),
        manifest.tenant_id,
        manifest.run_id,
        manifest.round_id,
        manifestId,
        manifest.source_result_id,
        manifest.input_hash,
        manifest.manifest_hash,
        JSON.stringify(manifest)
      ]
    );
  }

  private async saveReplayRunRow(run: ReplayRun): Promise<void> {
    const replayRunId = requireReplayIdentity(run, ["replay_run_id", "run_id"], "ReplayRun");

    await this.execute(
      "INSERT INTO replay_records (id, tenant_id, run_id, round_id, record_type, replay_run_id, manifest_id, status, payload) VALUES ($1, $2, $3, $4, 'run', $5, $6, $7, $8::jsonb)",
      [
        toReplayRecordRowId(),
        run.tenant_id,
        run.run_id,
        run.round_id,
        replayRunId,
        run.manifest_id,
        run.status,
        JSON.stringify(run)
      ]
    );
  }

  private async saveReplayReportRow(report: ReplayReport): Promise<void> {
    const replayReportId = requireReplayIdentity(
      report,
      ["replay_report_id", "report_id"],
      "ReplayReport"
    );

    await this.execute(
      "INSERT INTO replay_records (id, tenant_id, run_id, round_id, record_type, replay_report_id, replay_run_id, source_result_id, replay_result_hash, status, payload) VALUES ($1, $2, $3, $4, 'report', $5, $6, $7, $8, $9, $10::jsonb)",
      [
        toReplayRecordRowId(),
        report.tenant_id,
        report.run_id,
        report.round_id,
        replayReportId,
        report.replay_run_id,
        report.source_result_id,
        report.replay_result_hash,
        report.status,
        JSON.stringify(report)
      ]
    );
  }

  private async saveReplayDiffReportRow(report: ReplayDiffReport): Promise<void> {
    const diffReportId = requireReplayIdentity(
      report,
      ["diff_report_id", "replay_diff_report_id", "report_id"],
      "ReplayDiffReport"
    );

    await this.execute(
      "INSERT INTO replay_records (id, tenant_id, run_id, round_id, record_type, diff_report_id, replay_report_id, payload) VALUES ($1, $2, $3, $4, 'diff', $5, $6, $7::jsonb)",
      [
        toReplayRecordRowId(),
        report.tenant_id,
        report.run_id,
        report.round_id,
        diffReportId,
        report.replay_report_id,
        JSON.stringify(report)
      ]
    );
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
