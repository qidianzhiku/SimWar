/**
 * PostgreSQL repository adapter for the explicitly selected W024 runtime.
 *
 * The adapter implements the repository ports without changing the JSON
 * provider or becoming active unless the runtime mode is explicitly set to
 * `postgres`. Query helpers delegate only to the injected query executor.
 */

import { randomUUID } from "node:crypto";
import {
  assertQualifiedRunAdmissionSnapshot,
  preserveQualifiedRunAdmissionSnapshot,
  type StoredQualifiedRun
} from "./qualified-run-admission-snapshot.js";
import type {
  AuditLog,
  Course,
  CourseStatus,
  Decision,
  DecisionMergeCommit,
  D2EvidenceArtifactVersion,
  D2ProvenanceEdge,
  DomainEvent,
  ParameterSet,
  ReplayDiffReport,
  ReplayInputManifest,
  ReplayReport,
  ReplayRun,
  Round,
  RoleDecisionSection,
  RoleWorkflowEvent,
  ResolutionAcknowledgement,
  Run,
  ScenarioPackage,
  SettlementResult,
  StateSnapshot,
  StudentRoleAssignment,
  Team,
  TeamConfirmation,
  TeamResolution,
  TeacherConfirmationVersion,
  W020AdvisoryRecord,
  ValidationSessionRecord
} from "@simwar/shared-contracts";
import type {
  EvidenceProvenanceCaptureCommand,
  EvidenceProvenanceRepositoryPort,
  GovernedAdvisoryRepositoryPort,
  RoleWorkflowCommitCommand,
  RoleWorkflowRepositoryPort,
  RoleWorkflowRepositoryQuery,
  RoleWorkflowRepositorySnapshot,
  RepositoryCourseReadModel,
  RepositoryId,
  RepositorySnapshotQuery,
  SettlementOutcomeCommitResult,
  SettlementOutcomePersistencePort,
  SettlementWriteRepositoryPorts,
  SimWarRepositoryPorts,
  TeacherConfirmationAppendCommand,
  TeacherConfirmationRepositoryPort,
  ValidationSessionRepositoryPort
} from "./repository-ports.js";
import {
  createSettlementWriteRepositoryFacade,
  type SettlementWriteRepositoryFacade
} from "./repository-facade.js";
import {
  createSettlementBusinessKey,
  createSettlementFingerprint
} from "./settlement-idempotency.js";

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

export type PostgresTransactionExecutor = <TResult>(
  callback: (queryExecutor: PostgresQueryExecutor) => Promise<TResult>
) => Promise<TResult>;

export interface PostgresRepositoryAdapterOptions {
  applicationName?: string;
  queryExecutor: PostgresQueryExecutor;
  schema?: string;
  transactionExecutor?: PostgresTransactionExecutor;
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
  listCoursesForTenant(tenantId: RepositoryId): Promise<RepositoryCourseReadModel[]>;
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

export const POSTGRES_SCENARIO_CANDIDATE_READ_CAPABILITY_GAPS = [
  "scenarios.listScenarioPackagesForTenant"
] as const;

export const POSTGRES_SCENARIO_PACKAGE_AUTHORITY_READ_CAPABILITY_GAPS = [
  "scenarioPackageAuthority.listApprovedForTenant"
] as const;

export const POSTGRES_SETTLEMENT_READ_MODEL_CAPABILITY_GAPS = [
  "teams.listTeamsForRun",
  "scenarios.getScenarioPackage",
  "parameterSets.getParameterSet"
] as const;

export type PostgresSettlementReadModelCapabilityGap =
  (typeof POSTGRES_SETTLEMENT_READ_MODEL_CAPABILITY_GAPS)[number];

export interface PostgresSettlementReadModelPorts {
  decisions: Pick<PostgresDecisionMapping, "listDecisionsForRound">;
  rounds: Pick<PostgresRoundMapping, "listRoundsForRun">;
  runs: Pick<PostgresRunReadMapping, "getRun">;
  settlements: Pick<PostgresSettlementMapping, "listSettlementResultsForRound">;
}

export interface PostgresSettlementReadModelFacade {
  decisions: {
    listDecisionsForRound(
      tenantId: RepositoryId,
      runId: RepositoryId,
      roundId: RepositoryId
    ): Promise<Decision[]>;
  };
  rounds: {
    listRoundsForRun(tenantId: RepositoryId, runId: RepositoryId): Promise<Round[]>;
  };
  runs: {
    getRun(tenantId: RepositoryId, runId: RepositoryId): Promise<Run | null>;
  };
  settlements: {
    listSettlementResultsForRound(
      tenantId: RepositoryId,
      runId: RepositoryId,
      roundId: RepositoryId
    ): Promise<SettlementResult[]>;
  };
}

export interface PostgresSettlementReadModelProvider {
  capabilityGaps: readonly PostgresSettlementReadModelCapabilityGap[];
  facade: PostgresSettlementReadModelFacade;
  mode: "postgres-read-model";
  ports: PostgresSettlementReadModelPorts;
}

export interface PostgresSettlementReadModelProviderOptions {
  adapter: Pick<PostgresRepositoryAdapter, "decisions" | "rounds" | "runs" | "settlements">;
}

export type PostgresSettlementWriteModelPorts = SettlementWriteRepositoryPorts;

export interface PostgresSettlementWriteModelProvider {
  facade: SettlementWriteRepositoryFacade;
  mode: "postgres-settlement-write";
  ports: PostgresSettlementWriteModelPorts;
}

export interface PostgresSettlementWriteModelProviderOptions {
  adapter: Pick<PostgresRepositoryAdapter, "auditLogs" | "options">;
}

interface PostgresCourseReadRow extends Record<string, unknown> {
  course_id: RepositoryId;
  payload: Course;
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

interface PostgresSettlementOutcomeCommitRow extends Record<string, unknown> {
  error_code?: string | null;
  round_row_count?: bigint | number | string | null;
  settlement_row_count?: bigint | number | string | null;
}

interface PostgresSettlementOutcomeExistingRow extends Record<string, unknown> {
  payload: SettlementResult;
  settlement_fingerprint?: string | null;
}

interface PostgresSettlementOutcomeRoundRow extends Record<string, unknown> {
  id: RepositoryId;
  round_no: number | null;
  run_id: RepositoryId;
}

function toCourseReadModel(row: PostgresCourseReadRow): RepositoryCourseReadModel {
  return {
    ...row.payload,
    course_id: row.course_id,
    tenant_id: row.tenant_id,
    status: isCourseStatus(row.status) ? row.status : row.payload.status
  };
}

function isCourseStatus(value: unknown): value is CourseStatus {
  return value === "draft" || value === "published" || value === "active" || value === "archived";
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

function toPostgresCount(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }

  return undefined;
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

async function commitPostgresSettlementOutcomeInTransaction(
  queryExecutor: PostgresQueryExecutor,
  command: Parameters<SettlementOutcomePersistencePort["commitSettlementOutcome"]>[0]
): Promise<SettlementOutcomeCommitResult> {
  const result = command.settlement_result;
  const businessKey = createSettlementBusinessKey(result);
  const fingerprint = createSettlementFingerprint(result);

  await queryExecutor("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [businessKey]);

  const targetRoundResult = await queryExecutor<PostgresSettlementOutcomeRoundRow>(
    `SELECT id, run_id, round_no
     FROM simulation_rounds
     WHERE tenant_id = $1 AND round_id = $2
     FOR UPDATE`,
    [command.tenant_id, command.round_id]
  );
  const targetRound = targetRoundResult.rows[0];

  if (targetRound === undefined) {
    throw new Error("settlement_outcome_round_missing");
  }

  if (targetRound.run_id !== result.run_id) {
    throw new Error("settlement_outcome_run_mismatch");
  }

  if (targetRound.round_no !== result.round_no) {
    throw new Error("settlement_outcome_round_no_mismatch");
  }

  const technicalIdResult = await queryExecutor<PostgresSettlementOutcomeExistingRow>(
    `SELECT payload, settlement_fingerprint
     FROM settlement_results
     WHERE tenant_id = $1 AND settlement_result_id = $2
     FOR UPDATE`,
    [result.tenant_id, result.settlement_result_id]
  );
  const technicalIdRow = technicalIdResult.rows[0];

  if (technicalIdRow !== undefined) {
    const technicalResult = technicalIdRow.payload;
    if (technicalResult.run_id !== result.run_id || technicalResult.round_no !== result.round_no) {
      throw new Error("settlement_outcome_result_id_conflict");
    }
  }

  const existingResultQuery = await queryExecutor<PostgresSettlementOutcomeExistingRow>(
    `SELECT payload, settlement_fingerprint
     FROM settlement_results
     WHERE tenant_id = $1 AND run_id = $2 AND round_no = $3
     FOR UPDATE`,
    [result.tenant_id, result.run_id, result.round_no]
  );
  const existingRow = existingResultQuery.rows[0];

  if (existingRow !== undefined) {
    const existingFingerprint =
      existingRow.settlement_fingerprint ?? createSettlementFingerprint(existingRow.payload);

    if (existingFingerprint === fingerprint) {
      return { settlement_result: existingRow.payload, status: "reused" };
    }

    return {
      reason: "replay_hash_mismatch",
      settlement_result: existingRow.payload,
      status: "conflict"
    };
  }

  await queryExecutor(
    `INSERT INTO settlement_results (
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
       settlement_fingerprint,
       updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, now())`,
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
      JSON.stringify(result.team_results),
      JSON.stringify(result),
      fingerprint
    ]
  );

  const updatedRoundResult = await queryExecutor(
    `UPDATE simulation_rounds
     SET status = 'settled',
         replay_hash = $2,
         payload = jsonb_set(
           jsonb_set(payload, '{status}', to_jsonb('settled'::text), true),
           '{replay_hash}',
           to_jsonb($2::text),
           true
         ),
         updated_at = now()
     WHERE id = $1`,
    [targetRound.id, result.replay_hash]
  );

  if (updatedRoundResult.rowCount !== 1) {
    throw new Error("settlement_outcome_round_update_invariant_failed");
  }

  if (command.success_audit) {
    const audit = command.success_audit;
    await queryExecutor(
      `INSERT INTO audit_logs (
         id,
         audit_id,
         tenant_id,
         actor_id,
         actor_role,
         action,
         resource_type,
         resource_id,
         request_id,
         created_at,
         payload
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
      [
        toAuditLogRowId(),
        audit.audit_id,
        audit.tenant_id,
        audit.actor_id,
        audit.actor_role,
        audit.action,
        audit.resource_type,
        audit.resource_id,
        audit.request_id,
        audit.created_at,
        JSON.stringify(audit)
      ]
    );
  }

  return { settlement_result: result, status: "committed" };
}

export function createPostgresSettlementOutcomePersistencePort(
  options: PostgresRepositoryAdapterOptions
): SettlementOutcomePersistencePort {
  return {
    async commitSettlementOutcome(command): Promise<SettlementOutcomeCommitResult> {
      const result = command.settlement_result;

      if (command.tenant_id !== result.tenant_id) {
        throw new Error("settlement_outcome_tenant_mismatch");
      }

      if (command.round_id !== result.round_id) {
        throw new Error("settlement_outcome_round_mismatch");
      }

      if (options.transactionExecutor) {
        return options.transactionExecutor((queryExecutor) =>
          commitPostgresSettlementOutcomeInTransaction(queryExecutor, command)
        );
      }

      const queryResult = await options.queryExecutor<PostgresSettlementOutcomeCommitRow>(
        `WITH target_round AS (
          SELECT id, tenant_id, round_id, run_id, round_no
          FROM simulation_rounds
          WHERE tenant_id = $1 AND round_id = $2
          FOR UPDATE
        ),
        validated_round AS (
          SELECT id
          FROM target_round
          WHERE run_id = $5 AND round_no = $6
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
          FROM validated_round
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
          WHERE settlement_results.tenant_id = EXCLUDED.tenant_id
            AND settlement_results.run_id = EXCLUDED.run_id
            AND settlement_results.round_id = EXCLUDED.round_id
            AND settlement_results.round_no = EXCLUDED.round_no
          RETURNING replay_hash
        ),
        updated_round AS (
        UPDATE simulation_rounds AS target
        SET
          status = 'settled',
          replay_hash = upserted_settlement.replay_hash,
          payload = jsonb_set(
            jsonb_set(
              target.payload,
              '{status}',
              to_jsonb('settled'::text),
              true
            ),
            '{replay_hash}',
            to_jsonb(upserted_settlement.replay_hash),
            true
          ),
          updated_at = now()
        FROM validated_round, upserted_settlement
        WHERE target.id = validated_round.id
        RETURNING target.id
        )
        SELECT
          CASE
            WHEN NOT EXISTS (SELECT 1 FROM target_round) THEN 'round_missing'
            WHEN NOT EXISTS (SELECT 1 FROM target_round WHERE run_id = $5) THEN 'run_mismatch'
            WHEN NOT EXISTS (SELECT 1 FROM target_round WHERE round_no = $6) THEN 'round_no_mismatch'
            ELSE NULL
          END AS error_code,
          (SELECT count(*)::int FROM upserted_settlement) AS settlement_row_count,
          (SELECT count(*)::int FROM updated_round) AS round_row_count`,
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
      const outcome = queryResult.rows[0];

      if (queryResult.rowCount !== 1 || outcome === undefined) {
        throw new Error("settlement_outcome_persistence_invariant_failed");
      }

      if (outcome.error_code === "round_missing") {
        throw new Error("settlement_outcome_round_missing");
      }

      if (outcome.error_code === "run_mismatch") {
        throw new Error("settlement_outcome_run_mismatch");
      }

      if (outcome.error_code === "round_no_mismatch") {
        throw new Error("settlement_outcome_round_no_mismatch");
      }

      if (outcome.error_code !== null && outcome.error_code !== undefined) {
        throw new Error("settlement_outcome_persistence_invariant_failed");
      }

      if (
        toPostgresCount(outcome.settlement_row_count) !== 1 ||
        toPostgresCount(outcome.round_row_count) !== 1
      ) {
        throw new Error("settlement_outcome_persistence_invariant_failed");
      }

      return {
        settlement_result: result,
        status: "committed"
      };
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
          "SELECT tenant_id, course_id, status, payload FROM courses WHERE tenant_id = $1 AND course_id = $2",
          [tenantId, courseId]
        );

        return row === null ? null : toCourseReadModel(row);
      },
      listCoursesForTenant: async (tenantId) => {
        const rows = await this.queryRows<PostgresCourseReadRow>(
          "SELECT tenant_id, course_id, status, payload FROM courses WHERE tenant_id = $1 ORDER BY created_at ASC, course_id ASC",
          [tenantId]
        );

        return rows.map((row) => toCourseReadModel(row));
      },
      listCoursesForUser: async (tenantId, userId) => {
        const rows = await this.queryRows<PostgresCourseReadRow>(
          "SELECT courses.tenant_id, courses.course_id, courses.status, courses.payload FROM courses INNER JOIN course_memberships ON course_memberships.tenant_id = courses.tenant_id AND course_memberships.course_id = courses.course_id WHERE courses.tenant_id = $1 AND course_memberships.user_id = $2 ORDER BY courses.created_at ASC, courses.course_id ASC",
          [tenantId, userId]
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
      "INSERT INTO settlement_results (id, settlement_result_id, tenant_id, run_id, round_id, round_no, parameter_set_id, scenario_package_id, replay_hash, team_results, settlement_fingerprint, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, now()) ON CONFLICT (tenant_id, run_id, round_no) DO NOTHING",
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
        JSON.stringify(result.team_results),
        createSettlementFingerprint(result)
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

function createPostgresSettlementReadModelFacade(
  ports: PostgresSettlementReadModelPorts
): PostgresSettlementReadModelFacade {
  return {
    decisions: {
      listDecisionsForRound: (tenantId, runId, roundId) =>
        ports.decisions.listDecisionsForRound(tenantId, runId, roundId)
    },
    rounds: {
      listRoundsForRun: (tenantId, runId) => ports.rounds.listRoundsForRun(tenantId, runId)
    },
    runs: {
      getRun: (tenantId, runId) => ports.runs.getRun(tenantId, runId)
    },
    settlements: {
      listSettlementResultsForRound: (tenantId, runId, roundId) =>
        ports.settlements.listSettlementResultsForRound(tenantId, runId, roundId)
    }
  };
}

export function createPostgresSettlementReadModelProvider(
  options: PostgresSettlementReadModelProviderOptions
): PostgresSettlementReadModelProvider {
  const { adapter } = options;
  const ports: PostgresSettlementReadModelPorts = {
    decisions: {
      listDecisionsForRound: (tenantId, runId, roundId) =>
        adapter.decisions.listDecisionsForRound(tenantId, runId, roundId)
    },
    rounds: {
      listRoundsForRun: (tenantId, runId) => adapter.rounds.listRoundsForRun(tenantId, runId)
    },
    runs: {
      getRun: (tenantId, runId) => adapter.runs.getRun(tenantId, runId)
    },
    settlements: {
      listSettlementResultsForRound: (tenantId, runId, roundId) =>
        adapter.settlements.listSettlementResultsForRound(tenantId, runId, roundId)
    }
  };

  return {
    capabilityGaps: POSTGRES_SETTLEMENT_READ_MODEL_CAPABILITY_GAPS,
    facade: createPostgresSettlementReadModelFacade(ports),
    mode: "postgres-read-model",
    ports
  };
}

export function createPostgresSettlementWriteModelProvider(
  options: PostgresSettlementWriteModelProviderOptions
): PostgresSettlementWriteModelProvider {
  const { adapter } = options;
  const ports: PostgresSettlementWriteModelPorts = {
    auditLogs: {
      appendAuditLog: (auditLog) => adapter.auditLogs.appendAuditLog(auditLog)
    },
    settlementOutcome: createPostgresSettlementOutcomePersistencePort({
      ...adapter.options
    })
  };

  return {
    facade: createSettlementWriteRepositoryFacade({ ports }),
    mode: "postgres-settlement-write",
    ports
  };
}

export function createPostgresRepositoryAdapter(
  options: PostgresRepositoryAdapterOptions
): PostgresRepositoryAdapter {
  return new PostgresRepositoryAdapter(options);
}

type RuntimeRecordRow = {
  tenant_id: string;
  record_id: string;
  record_type: string;
  course_id?: string | null;
  run_id?: string | null;
  round_id?: string | null;
  team_id?: string | null;
  payload: Record<string, unknown>;
};

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function payloadId(
  value: Record<string, unknown>,
  keys: readonly string[],
  fallback: string
): string {
  for (const key of keys) {
    const candidate = stringValue(value[key]);
    if (candidate) return candidate;
  }
  return fallback;
}

function scopeOf(
  value: Record<string, unknown>
): Pick<RuntimeRecordRow, "course_id" | "run_id" | "round_id" | "team_id"> {
  return {
    ...(stringValue(value.course_id) ? { course_id: value.course_id as string } : {}),
    ...(stringValue(value.run_id) ? { run_id: value.run_id as string } : {}),
    ...(stringValue(value.round_id) ? { round_id: value.round_id as string } : {}),
    ...(stringValue(value.team_id) ? { team_id: value.team_id as string } : {})
  };
}

async function saveRuntimeRecord(
  adapter: PostgresRepositoryAdapter,
  recordType: string,
  recordId: string,
  value: Record<string, unknown>,
  tenantId: string,
  executor: PostgresQueryExecutor = adapter.queryExecutor
): Promise<void> {
  const scope = scopeOf(value);
  await executor(
    `INSERT INTO w024_runtime_records
       (tenant_id, record_type, record_id, course_id, run_id, round_id, team_id, payload, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now())
     ON CONFLICT (tenant_id, record_type, record_id)
     DO UPDATE SET course_id = EXCLUDED.course_id, run_id = EXCLUDED.run_id,
       round_id = EXCLUDED.round_id, team_id = EXCLUDED.team_id,
       payload = EXCLUDED.payload, updated_at = now()`,
    [
      tenantId,
      recordType,
      recordId,
      scope.course_id ?? null,
      scope.run_id ?? null,
      scope.round_id ?? null,
      scope.team_id ?? null,
      JSON.stringify(value)
    ]
  );
}

async function listRuntimeRecords(
  adapter: PostgresRepositoryAdapter,
  recordType: string,
  tenantId: string,
  filters: Partial<
    Pick<RuntimeRecordRow, "record_id" | "course_id" | "run_id" | "round_id" | "team_id">
  > = {}
): Promise<RuntimeRecordRow[]> {
  const conditions = ["tenant_id = $1", "record_type = $2"];
  const params: unknown[] = [tenantId, recordType];
  for (const field of ["record_id", "course_id", "run_id", "round_id", "team_id"] as const) {
    const value = filters[field];
    if (value !== undefined) {
      params.push(value);
      conditions.push(`${field} = $${params.length}`);
    }
  }
  return [
    ...(await adapter.queryRows<RuntimeRecordRow>(
      `SELECT tenant_id, record_type, record_id, course_id, run_id, round_id, team_id, payload
       FROM w024_runtime_records WHERE ${conditions.join(" AND ")}
       ORDER BY record_id ASC`,
      params
    ))
  ];
}

async function saveCourseWithExecutor(
  adapter: PostgresRepositoryAdapter,
  course: Course,
  executor: PostgresQueryExecutor = adapter.queryExecutor
): Promise<void> {
  await executor(
    `INSERT INTO courses (id, course_id, tenant_id, status, payload, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, now())
     ON CONFLICT (tenant_id, course_id) DO UPDATE SET status = EXCLUDED.status,
       payload = EXCLUDED.payload, updated_at = now()`,
    [course.course_id, course.course_id, course.tenant_id, course.status, JSON.stringify(course)]
  );
}

async function saveRunWithExecutor(
  adapter: PostgresRepositoryAdapter,
  run: Run,
  executor: PostgresQueryExecutor = adapter.queryExecutor
): Promise<void> {
  await executor(
    `INSERT INTO simulation_runs
       (id, run_id, tenant_id, course_id, scenario_package_id, parameter_set_id, seed, status, payload, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now())
     ON CONFLICT (tenant_id, run_id) DO UPDATE SET course_id = EXCLUDED.course_id,
       scenario_package_id = EXCLUDED.scenario_package_id, parameter_set_id = EXCLUDED.parameter_set_id,
       seed = EXCLUDED.seed, status = EXCLUDED.status, payload = EXCLUDED.payload, updated_at = now()`,
    [
      run.run_id,
      run.run_id,
      run.tenant_id,
      run.course_id,
      run.scenario_package_id,
      run.parameter_set_id,
      run.seed,
      run.status,
      JSON.stringify(run)
    ]
  );
}

function roleRecordId(kind: string, value: Record<string, unknown>): string {
  const keysByKind: Record<string, readonly string[]> = {
    assignment: ["assignment_id"],
    confirmation: ["team_confirmation_id"],
    decision: ["decision_id"],
    event: ["event_id"],
    merge: ["merge_commit_id"],
    resolution: ["resolution_id"],
    acknowledgement: ["acknowledgement_id"],
    section: ["section_id"]
  };
  return payloadId(
    value,
    keysByKind[kind] ?? [
      "user_id",
      "session_id",
      "scenario_package_id",
      "parameter_set_id",
      "team_id",
      "course_id"
    ],
    `${kind}:${randomUUID()}`
  );
}

async function appendRoleRecord(
  adapter: PostgresRepositoryAdapter,
  command: RoleWorkflowCommitCommand,
  executor: PostgresQueryExecutor
): Promise<void> {
  const records: Array<{ type: string; value: Record<string, unknown> }> = [];
  if (command.kind === "append_assignment")
    records.push({
      type: "assignment",
      value: command.assignment as unknown as Record<string, unknown>
    });
  if (command.kind === "append_section")
    records.push({ type: "section", value: command.section as unknown as Record<string, unknown> });
  if (command.kind === "append_merge")
    records.push({
      type: "merge",
      value: command.merge_commit as unknown as Record<string, unknown>
    });
  if (command.kind === "append_resolution")
    records.push({
      type: "resolution",
      value: command.resolution as unknown as Record<string, unknown>
    });
  if (command.kind === "append_acknowledgement")
    records.push({
      type: "acknowledgement",
      value: command.acknowledgement as unknown as Record<string, unknown>
    });
  if (command.kind === "append_confirmation") {
    records.push({
      type: "confirmation",
      value: command.confirmation as unknown as Record<string, unknown>
    });
    await saveDecisionWithExecutor(adapter, command.decision, executor);
    records.push({
      type: "decision",
      value: command.decision as unknown as Record<string, unknown>
    });
  }
  for (const record of records) {
    const value = record.value;
    await executor(
      `INSERT INTO w024_role_workflow_records
         (record_id, tenant_id, run_id, team_id, round_id, record_type, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (record_id) DO UPDATE SET payload = EXCLUDED.payload`,
      [
        roleRecordId(record.type, value),
        value.tenant_id,
        value.run_id,
        value.team_id,
        value.round_id ?? null,
        record.type,
        JSON.stringify(value)
      ]
    );
  }
  const event = command.event;
  await executor(
    `INSERT INTO w024_role_workflow_records
       (record_id, tenant_id, run_id, team_id, round_id, record_type, payload)
     VALUES ($1, $2, $3, $4, $5, 'event', $6::jsonb)
     ON CONFLICT (record_id) DO UPDATE SET payload = EXCLUDED.payload`,
    [
      event.event_id,
      event.tenant_id,
      event.run_id,
      event.team_id,
      event.round_id ?? null,
      JSON.stringify(event)
    ]
  );
  if (command.kind === "reset") {
    await executor(
      `UPDATE w024_role_workflow_records SET payload = jsonb_set(payload, '{status}', '"inactive"'::jsonb, true)
       WHERE tenant_id = $1 AND run_id = $2 AND team_id = $3 AND record_type = 'assignment'
         AND record_id = ANY($4::text[])`,
      [event.tenant_id, event.run_id, event.team_id, command.assignment_ids]
    );
  }
}

async function saveDecisionWithExecutor(
  adapter: PostgresRepositoryAdapter,
  decision: Decision,
  executor: PostgresQueryExecutor
): Promise<void> {
  await executor(
    `INSERT INTO decisions
       (id, decision_id, tenant_id, run_id, round_id, round_no, team_id, version, status,
        canonical_source, merge_commit_id, team_confirmation_id, submitted_by, payload, validation_report, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, now())
     ON CONFLICT (tenant_id, decision_id) DO UPDATE SET status = EXCLUDED.status,
       payload = EXCLUDED.payload, validation_report = EXCLUDED.validation_report,
       merge_commit_id = EXCLUDED.merge_commit_id, team_confirmation_id = EXCLUDED.team_confirmation_id,
       updated_at = now()`,
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
      JSON.stringify(decision.payload),
      JSON.stringify(decision.validation_report)
    ]
  );
}

export interface PostgresRepositoryPortsOptions {
  adapter: PostgresRepositoryAdapter;
  transactionExecutor: PostgresTransactionExecutor;
}

export function createPostgresRepositoryPorts(
  options: PostgresRepositoryPortsOptions
): SimWarRepositoryPorts {
  const { adapter, transactionExecutor } = options;
  const saveRecord = (type: string, value: Record<string, unknown>, tenantId: string) =>
    saveRuntimeRecord(adapter, type, roleRecordId(type, value), value, tenantId);
  const listPayloads = async <T>(type: string, tenantId: string, filters = {}) =>
    (await listRuntimeRecords(adapter, type, tenantId, filters)).map((row) => row.payload as T);

  const roleWorkflow: RoleWorkflowRepositoryPort = {
    async readRoleWorkflow(
      query: RoleWorkflowRepositoryQuery
    ): Promise<RoleWorkflowRepositorySnapshot> {
      const [run, teamRows, roleRows] = await Promise.all([
        adapter.runs.getRun(query.tenant_id, query.run_id),
        listRuntimeRecords(adapter, "team", query.tenant_id, { record_id: query.team_id }),
        adapter.queryRows<{ payload: Record<string, unknown>; record_type: string }>(
          `SELECT record_type, payload FROM w024_role_workflow_records
           WHERE tenant_id = $1 AND run_id = $2 AND team_id = $3
             AND ($4::text IS NULL OR round_id IS NULL OR round_id = $4)
           ORDER BY append_sequence ASC`,
          [query.tenant_id, query.run_id, query.team_id, query.round_id ?? null]
        )
      ]);
      const round = query.round_id
        ? await adapter.rounds.getRound(query.tenant_id, query.round_id)
        : null;
      const course = run ? await adapter.courses.getCourse(query.tenant_id, run.course_id) : null;
      const assignments = roleRows
        .filter(
          (row) =>
            row.record_type === "assignment" &&
            row.payload.role_key !== undefined &&
            row.payload.assignment_id !== undefined
        )
        .map((row) => row.payload as unknown as StudentRoleAssignment);
      const sections = roleRows
        .filter((row) => row.record_type === "section" && row.payload.section_id !== undefined)
        .map((row) => row.payload as unknown as RoleDecisionSection);
      const merge_commits = roleRows
        .filter((row) => row.record_type === "merge" && row.payload.merge_commit_id !== undefined)
        .map((row) => row.payload as unknown as DecisionMergeCommit);
      const confirmations = roleRows
        .filter(
          (row) =>
            row.record_type === "confirmation" && row.payload.team_confirmation_id !== undefined
        )
        .map((row) => row.payload as unknown as TeamConfirmation);
      const resolutions = roleRows
        .filter(
          (row) => row.record_type === "resolution" && row.payload.resolution_id !== undefined
        )
        .map((row) => row.payload as unknown as TeamResolution);
      const acknowledgements = roleRows
        .filter(
          (row) =>
            row.record_type === "acknowledgement" && row.payload.acknowledgement_id !== undefined
        )
        .map((row) => row.payload as unknown as ResolutionAcknowledgement);
      const events = roleRows
        .filter((row) => row.record_type === "event" && row.payload.event_id !== undefined)
        .map((row) => row.payload as unknown as RoleWorkflowEvent);
      const decisions = await adapter.decisions.listDecisionsForRound(
        query.tenant_id,
        query.run_id,
        query.round_id ?? ""
      );
      return {
        assignments,
        confirmations,
        course,
        decisions,
        events,
        merge_commits,
        resolutions,
        acknowledgements,
        round,
        run,
        sections,
        team: (teamRows[0]?.payload as unknown as Team | undefined) ?? null
      };
    },
    async commitRoleWorkflow(command: RoleWorkflowCommitCommand): Promise<void> {
      await transactionExecutor((executor) => appendRoleRecord(adapter, command, executor));
    }
  } as unknown as RoleWorkflowRepositoryPort;

  const identity = {
    async getTenant(tenantId: string) {
      const rows = await listPayloads<{ tenant_id: string; status?: string }>("tenant", tenantId);
      return rows[0] ?? null;
    },
    async getUser(tenantId: string, userId: string) {
      const rows = await listRuntimeRecords(adapter, "user", tenantId, { record_id: userId });
      const user = rows[0]?.payload;
      return user ? (user as { tenant_id: string; user_id: string; status?: string }) : null;
    }
  };

  const teams = {
    async getTeam(tenantId: string, teamId: string) {
      const rows = await listRuntimeRecords(adapter, "team", tenantId, { record_id: teamId });
      return (rows[0]?.payload as unknown as Team | undefined) ?? null;
    },
    async listTeamsForRun(tenantId: string, runId: string) {
      const run = await adapter.runs.getRun(tenantId, runId);
      if (!run) return [];
      const candidates = await listPayloads<Team>("team", tenantId, {
        course_id: run.course_id
      });
      return candidates;
    },
    async getTeamForUser(tenantId: string, runId: string, userId: string) {
      const run = await adapter.runs.getRun(tenantId, runId);
      if (!run) return null;
      const candidates = await listPayloads<Team>("team", tenantId, {
        course_id: run.course_id
      });
      return (
        candidates.find((team) => team.members.some((member) => member.user_id === userId)) ?? null
      );
    },
    async createTeamWithCaptain(team: Team) {
      await saveRecord("team", team as unknown as Record<string, unknown>, team.tenant_id);
    },
    async addMemberToTeam(tenantId: string, teamId: string, member: Team["members"][number]) {
      const team = await teams.getTeam(tenantId, teamId);
      if (!team) throw new Error("team_not_found");
      const updated = { ...team, members: [...team.members, member] };
      await saveRecord("team", updated as unknown as Record<string, unknown>, tenantId);
      return updated;
    }
  };

  const genericPort = <T>(type: string) => ({
    async get(tenantId: string, id: string) {
      const rows = await listRuntimeRecords(adapter, type, tenantId, { record_id: id });
      return (rows[0]?.payload as T | undefined) ?? null;
    },
    async list(tenantId: string) {
      return listPayloads<T>(type, tenantId);
    }
  });

  const evidenceProvenance: EvidenceProvenanceRepositoryPort = {
    listEvidenceArtifacts: (tenantId) =>
      listPayloads<D2EvidenceArtifactVersion>("evidence_artifact", tenantId),
    listProvenanceEdges: (tenantId) => listPayloads<D2ProvenanceEdge>("provenance_edge", tenantId),
    async appendEvidenceCapture(command: EvidenceProvenanceCaptureCommand) {
      await transactionExecutor(async (executor) => {
        await saveRuntimeRecord(
          adapter,
          "evidence_artifact",
          payloadId(
            command.artifact as unknown as Record<string, unknown>,
            ["artifact_id", "resource_id"],
            "artifact"
          ),
          command.artifact as unknown as Record<string, unknown>,
          command.artifact.artifact_ref.tenant_id,
          executor
        );
        for (const edge of command.provenance_edges) {
          await saveRuntimeRecord(
            adapter,
            "provenance_edge",
            `${edge.source_ref.resource_id}:${edge.target_ref.resource_id}`,
            edge as unknown as Record<string, unknown>,
            command.audit_log.tenant_id,
            executor
          );
        }
        await executor(
          "INSERT INTO audit_logs (id, audit_id, tenant_id, actor_id, actor_role, action, resource_type, resource_id, request_id, created_at, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)",
          [
            toAuditLogRowId(),
            command.audit_log.audit_id,
            command.audit_log.tenant_id,
            command.audit_log.actor_id,
            command.audit_log.actor_role,
            command.audit_log.action,
            command.audit_log.resource_type,
            command.audit_log.resource_id,
            command.audit_log.request_id,
            command.audit_log.created_at,
            JSON.stringify(command.audit_log)
          ]
        );
      });
    }
  };

  const teacherConfirmations: TeacherConfirmationRepositoryPort = {
    list: (tenantId) => listPayloads<TeacherConfirmationVersion>("teacher_confirmation", tenantId),
    append: async (command: TeacherConfirmationAppendCommand) => {
      await transactionExecutor(async (executor) => {
        const value = command.confirmation as unknown as Record<string, unknown>;
        await saveRuntimeRecord(
          adapter,
          "teacher_confirmation",
          payloadId(value, ["confirmation_id", "resource_id"], "confirmation"),
          value,
          command.audit_log.tenant_id,
          executor
        );
        await executor(
          "INSERT INTO audit_logs (id, audit_id, tenant_id, actor_id, actor_role, action, resource_type, resource_id, request_id, created_at, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)",
          [
            toAuditLogRowId(),
            command.audit_log.audit_id,
            command.audit_log.tenant_id,
            command.audit_log.actor_id,
            command.audit_log.actor_role,
            command.audit_log.action,
            command.audit_log.resource_type,
            command.audit_log.resource_id,
            command.audit_log.request_id,
            command.audit_log.created_at,
            JSON.stringify(command.audit_log)
          ]
        );
      });
    }
  };

  const governedAdvisories: GovernedAdvisoryRepositoryPort = {
    list: (tenantId) => listPayloads<W020AdvisoryRecord>("governed_advisory", tenantId),
    append: (record) =>
      saveRecord(
        "governed_advisory",
        record as unknown as Record<string, unknown>,
        record.tenant_id
      )
  };

  const validationSessions: ValidationSessionRepositoryPort = {
    list: (tenantId) => listPayloads<ValidationSessionRecord>("validation_session", tenantId),
    get: async (tenantId, sessionId) =>
      genericPort<ValidationSessionRecord>("validation_session").get(tenantId, sessionId),
    save: (session) =>
      saveRecord(
        "validation_session",
        session as unknown as Record<string, unknown>,
        session.tenant_id
      )
  };

  return {
    identity,
    sessions: {
      getSession: async (tenantId: string, sessionId: string) =>
        genericPort<{ tenant_id: string; session_id: string; user_id: string }>("session").get(
          tenantId,
          sessionId
        ),
      listActiveSessionsByUser: async (tenantId: string, userId: string) =>
        (
          await listPayloads<{ tenant_id: string; session_id: string; user_id: string }>(
            "session",
            tenantId
          )
        ).filter((session) => session.user_id === userId)
    },
    courses: {
      getCourse: adapter.courses.getCourse,
      listCoursesForTenant: adapter.courses.listCoursesForTenant,
      listCoursesForUser: adapter.courses.listCoursesForUser,
      saveCourse: (course: Course) => saveCourseWithExecutor(adapter, course),
      deleteCourse: (tenantId: string, courseId: string) =>
        adapter
          .execute("DELETE FROM courses WHERE tenant_id = $1 AND course_id = $2", [
            tenantId,
            courseId
          ])
          .then(() => undefined)
    },
    teams,
    runs: {
      getRun: adapter.runs.getRun,
      listRunsForCourse: adapter.runs.listRunsForCourse,
      async getQualifiedRunAdmission(tenantId, runId) {
        const row = await adapter.queryOne<{ payload: StoredQualifiedRun }>(
          "SELECT payload FROM simulation_runs WHERE tenant_id = $1 AND run_id = $2",
          [tenantId, runId]
        );
        if (!row?.payload?.qualified_admission_snapshot) return null;
        const run = await adapter.runs.getRun(tenantId, runId);
        if (!run) return null;
        assertQualifiedRunAdmissionSnapshot(run, row.payload.qualified_admission_snapshot);
        return structuredClone(row.payload.qualified_admission_snapshot);
      },
      saveRun: (run, admission) =>
        transactionExecutor(async (executor) => {
          // Serialize the existing Run payload update; no separate receipt store.
          await executor("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
            JSON.stringify([run.tenant_id, run.run_id])
          ]);
          const rows = await executor<{ payload: StoredQualifiedRun }>(
            "SELECT payload FROM simulation_runs WHERE tenant_id = $1 AND run_id = $2 FOR UPDATE",
            [run.tenant_id, run.run_id]
          );
          const previous = rows.rows[0]?.payload;
          await saveRunWithExecutor(
            adapter,
            preserveQualifiedRunAdmissionSnapshot(run, previous, admission),
            executor
          );
        }),
      deleteRun: (tenantId: string, runId: string) =>
        adapter
          .execute("DELETE FROM simulation_runs WHERE tenant_id = $1 AND run_id = $2", [
            tenantId,
            runId
          ])
          .then(() => undefined)
    },
    scenarios: {
      getScenarioPackage: (tenantId: string, id: string) =>
        genericPort<ScenarioPackage>("scenario").get(tenantId, id),
      listScenarioPackagesForTenant: (tenantId: string) =>
        genericPort<ScenarioPackage>("scenario").list(tenantId)
    },
    parameterSets: {
      getParameterSet: (tenantId: string, id: string) =>
        genericPort<ParameterSet>("parameter_set").get(tenantId, id)
    },
    rounds: {
      getRound: adapter.rounds.getRound,
      listRoundsForRun: adapter.rounds.listRoundsForRun,
      saveRound: adapter.rounds.saveRound,
      deleteRound: (tenantId: string, roundId: string) =>
        adapter
          .execute("DELETE FROM simulation_rounds WHERE tenant_id = $1 AND round_id = $2", [
            tenantId,
            roundId
          ])
          .then(() => undefined),
      markRoundSettled: adapter.rounds.markRoundSettled
    },
    decisions: adapter.decisions,
    settlements: adapter.settlements,
    settlementOutcome: createPostgresSettlementOutcomePersistencePort({
      ...adapter.options,
      transactionExecutor
    }),
    domainEvents: {
      appendDomainEvent: (event: DomainEvent) =>
        saveRecord("domain_event", event as unknown as Record<string, unknown>, event.tenant_id),
      listDomainEvents: async (query) =>
        (
          await listPayloads<DomainEvent>("domain_event", query.tenant_id, {
            ...(query.aggregate_id ? { record_id: query.aggregate_id } : {})
          })
        ).filter((event) => !query.aggregate_type || event.aggregate_type === query.aggregate_type)
    },
    stateSnapshots: adapter.stateSnapshots,
    auditLogs: adapter.auditLogs as unknown as SimWarRepositoryPorts["auditLogs"],
    replay: adapter.replay,
    roleWorkflow,
    evidenceProvenance,
    teacherConfirmations,
    governedAdvisories,
    validationSessions
  };
}
