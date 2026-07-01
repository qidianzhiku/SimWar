import type {
  AuditLog,
  Course,
  Decision,
  DomainEvent,
  ParameterSet,
  ReplayDiffReport,
  ReplayInputManifest,
  ReplayReport,
  ReplayRun,
  Round,
  Run,
  ScenarioPackage,
  SettlementResult,
  StateSnapshot,
  Team
} from "@simwar/shared-contracts";

/**
 * Repository port boundary for the API service.
 *
 * This file only defines persistence interfaces. It must not contain JSON,
 * Postgres, HTTP, Express, route, settlement, replay, or AI advisory runtime
 * implementation.
 *
 * Truth-chain guardrails:
 * - Role drafts are not canonical decisions.
 * - AI advisory output and learning evidence must not enter canonical Decision
 *   or SettlementResult through repository ports.
 * - Replay truth hash behavior is owned by replay/runtime code, not repository
 *   persistence ports.
 */

export type RepositoryId = string;

export interface RepositoryTenantReadModel {
  tenant_id: RepositoryId;
  status?: string;
}

export interface RepositoryUserReadModel {
  tenant_id: RepositoryId;
  user_id: RepositoryId;
  status?: string;
}

export interface RepositorySessionReadModel {
  tenant_id: RepositoryId;
  session_id: RepositoryId;
  user_id: RepositoryId;
  expires_at?: string;
}

export type RepositoryCourseReadModel = Course;

export interface RepositoryEventQuery {
  tenant_id: RepositoryId;
  aggregate_id?: RepositoryId;
  aggregate_type?: string;
  from_sequence?: number;
  limit?: number;
}

export interface RepositorySnapshotQuery {
  tenant_id: RepositoryId;
  aggregate_id: RepositoryId;
  aggregate_type: string;
  at_sequence?: number;
}

export interface IdentityRepositoryPort {
  getTenant(tenantId: RepositoryId): Promise<RepositoryTenantReadModel | null>;

  getUser(tenantId: RepositoryId, userId: RepositoryId): Promise<RepositoryUserReadModel | null>;
}

export interface SessionRepositoryPort {
  getSession(
    tenantId: RepositoryId,
    sessionId: RepositoryId
  ): Promise<RepositorySessionReadModel | null>;

  listActiveSessionsByUser(
    tenantId: RepositoryId,
    userId: RepositoryId
  ): Promise<RepositorySessionReadModel[]>;
}

export interface CourseRepositoryPort {
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

export interface TeamRepositoryPort {
  getTeam(tenantId: RepositoryId, teamId: RepositoryId): Promise<Team | null>;

  listTeamsForRun(tenantId: RepositoryId, runId: RepositoryId): Promise<Team[]>;

  getTeamForUser(
    tenantId: RepositoryId,
    runId: RepositoryId,
    userId: RepositoryId
  ): Promise<Team | null>;
}

export interface RunRepositoryPort {
  getRun(tenantId: RepositoryId, runId: RepositoryId): Promise<Run | null>;

  listRunsForCourse(tenantId: RepositoryId, courseId: RepositoryId): Promise<Run[]>;
}

export interface ScenarioRepositoryPort {
  getScenarioPackage(
    tenantId: RepositoryId,
    scenarioPackageId: RepositoryId
  ): Promise<ScenarioPackage | null>;
}

export interface ParameterSetRepositoryPort {
  getParameterSet(
    tenantId: RepositoryId,
    parameterSetId: RepositoryId
  ): Promise<ParameterSet | null>;
}

export interface RoundRepositoryPort {
  getRound(tenantId: RepositoryId, roundId: RepositoryId): Promise<Round | null>;

  listRoundsForRun(tenantId: RepositoryId, runId: RepositoryId): Promise<Round[]>;

  saveRound(round: Round): Promise<void>;

  markRoundSettled(
    tenantId: RepositoryId,
    roundId: RepositoryId,
    settlementResultId: RepositoryId
  ): Promise<void>;
}

export interface DecisionRepositoryPort {
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

  saveCanonicalDecision(decision: Decision): Promise<void>;

  saveDecision(decision: Decision): Promise<void>;
}

export interface SettlementRepositoryPort {
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

/**
 * Provider-neutral read model required by the active settlement input path.
 *
 * This type intentionally contains only read-side methods used to assemble
 * settlement inputs and locate canonical outcomes. It does not authorize
 * PostgreSQL runtime activation, writes, migrations, transaction semantics, or
 * durable cross-process idempotency.
 */
export interface SettlementReadRepositoryPorts {
  decisions: Pick<DecisionRepositoryPort, "listDecisionsForRound">;
  parameterSets: Pick<ParameterSetRepositoryPort, "getParameterSet">;
  rounds: Pick<RoundRepositoryPort, "listRoundsForRun">;
  runs: Pick<RunRepositoryPort, "getRun">;
  scenarios: Pick<ScenarioRepositoryPort, "getScenarioPackage">;
  settlements: Pick<SettlementRepositoryPort, "listSettlementResultsForRound">;
  teams: Pick<TeamRepositoryPort, "listTeamsForRun">;
}

export interface DomainEventRepositoryPort {
  appendDomainEvent(event: DomainEvent): Promise<void>;

  listDomainEvents(query: RepositoryEventQuery): Promise<DomainEvent[]>;
}

export interface StateSnapshotRepositoryPort {
  getStateSnapshot(query: RepositorySnapshotQuery): Promise<StateSnapshot | null>;

  saveStateSnapshot(snapshot: StateSnapshot): Promise<void>;
}

export interface AuditLogRepositoryPort {
  appendAuditLog(auditLog: AuditLog): Promise<void>;

  listAuditLogs(query: {
    tenant_id: RepositoryId;
    actor_id?: RepositoryId;
    action?: string;
    resource_id?: RepositoryId;
    limit?: number;
  }): Promise<AuditLog[]>;
}

export interface ReplayRepositoryPort {
  saveReplayInputManifest(manifest: ReplayInputManifest): Promise<void>;

  getReplayInputManifest(
    tenantId: RepositoryId,
    manifestId: RepositoryId
  ): Promise<ReplayInputManifest | null>;

  saveReplayRun(run: ReplayRun): Promise<void>;

  getReplayRun(tenantId: RepositoryId, replayRunId: RepositoryId): Promise<ReplayRun | null>;

  saveReplayReport(report: ReplayReport): Promise<void>;

  getReplayReport(
    tenantId: RepositoryId,
    replayReportId: RepositoryId
  ): Promise<ReplayReport | null>;

  saveReplayDiffReport(report: ReplayDiffReport): Promise<void>;

  getReplayDiffReport(
    tenantId: RepositoryId,
    replayDiffReportId: RepositoryId
  ): Promise<ReplayDiffReport | null>;
}

/**
 * Command/write path repository contracts for staged migration work.
 *
 * These interfaces are intentionally disconnected from SimWarRepositoryPorts,
 * the repository facade, provider wiring, and concrete adapters. They define
 * the future command boundary only; adding them must not change API runtime
 * behavior, route contracts, settlement hashing, replay hash inputs, or
 * canonical decision selection.
 */

/**
 * Persist a submitted Decision exactly as produced by the current command
 * path. This does not make role drafts canonical and must not change the
 * canonical / latest decision selection logic.
 */
export type DecisionCommandRepositoryPort = Pick<DecisionRepositoryPort, "saveDecision">;

/**
 * Persist the complete Round after an existing command path mutates status,
 * decision_batch_id, or replay_hash. Transition rules remain owned by API
 * command services, not by the repository port.
 */
export type RoundCommandRepositoryPort = Pick<RoundRepositoryPort, "saveRound">;

export type SettlementCommandRepositoryPort = Pick<
  SettlementRepositoryPort,
  "saveSettlementResult"
>;

export type AuditCommandRepositoryPort = Pick<AuditLogRepositoryPort, "appendAuditLog">;

/**
 * Domain command for atomically committing an official settlement outcome.
 *
 * The explicit tenant and round identity targets the existing Round to mark as
 * settled. The SettlementResult remains the source of the replay_hash; this
 * command must not recompute, normalize, or generate replay hashes.
 */
export interface CommitSettlementOutcomeCommand {
  tenant_id: RepositoryId;
  round_id: RepositoryId;
  settlement_result: SettlementResult;
}

/**
 * Domain result for the settlement outcome commit boundary.
 *
 * This discriminant is the contract foundation for future provider-level
 * idempotency. Providers must return only states they can prove at their own
 * persistence boundary. The current JSON implementation can report
 * "committed" after its existing write succeeds; it does not provide durable
 * cross-process business-key CAS, file locks, leases, or create-if-absent.
 *
 * "reused" and "conflict" are reserved for a future atomic provider protocol.
 * P1-006B route-level reuse/conflict handling remains unchanged in this PR.
 * "in_progress" is intentionally absent until there is a durable producer,
 * consumer, recovery rule, and API mapping.
 */
export type SettlementOutcomeCommitResult =
  | {
      settlement_result: SettlementResult;
      status: "committed";
    }
  | {
      settlement_result: SettlementResult;
      status: "reused";
    }
  | {
      reason: "replay_hash_mismatch";
      settlement_result: SettlementResult;
      status: "conflict";
    };

/**
 * Standalone contract for the future atomic settlement outcome write.
 *
 * Implementations must commit the SettlementResult, explicit Round.status,
 * explicit Round.replay_hash, and the Round payload status/replay_hash as one
 * all-or-nothing truth-state update. The command requires an existing Round
 * and tenant- and round-consistent command/result identities; failure must
 * commit none of that truth state.
 *
 * The command tenant_id must equal settlement_result.tenant_id, and the command
 * round_id must equal settlement_result.round_id. Any tenant or Round identity
 * mismatch must fail without persisting the SettlementResult, mutating the
 * Round, or committing a partial settlement truth state.
 *
 * AuditLog append is intentionally post-commit. StateSnapshot, DomainEvent, and
 * Replay artifacts are not part of this minimum atomic set. Logical settlement
 * idempotency key alignment remains deferred: the current runtime lookup uses
 * run_id + round_no while repository SettlementResult identity uses tenant_id +
 * settlement_result_id. The returned discriminant is not evidence that the
 * current provider has implemented durable cross-process idempotency.
 */
export interface SettlementOutcomePersistencePort {
  commitSettlementOutcome(
    command: CommitSettlementOutcomeCommand
  ): Promise<SettlementOutcomeCommitResult>;
}

export interface SettlementWriteRepositoryPorts {
  auditLogs: AuditCommandRepositoryPort;
  settlementOutcome: SettlementOutcomePersistencePort;
}

export interface SimWarCommandRepositoryPorts {
  decisions: DecisionCommandRepositoryPort;
  rounds: RoundCommandRepositoryPort;
  settlements: SettlementCommandRepositoryPort;
  auditLogs: AuditCommandRepositoryPort;
}

export interface SimWarRepositoryPorts {
  identity: IdentityRepositoryPort;
  sessions: SessionRepositoryPort;
  courses: CourseRepositoryPort;
  teams: TeamRepositoryPort;
  runs: RunRepositoryPort;
  scenarios: ScenarioRepositoryPort;
  parameterSets: ParameterSetRepositoryPort;
  rounds: RoundRepositoryPort;
  decisions: DecisionRepositoryPort;
  settlements: SettlementRepositoryPort;
  settlementOutcome: SettlementOutcomePersistencePort;
  domainEvents: DomainEventRepositoryPort;
  stateSnapshots: StateSnapshotRepositoryPort;
  auditLogs: AuditLogRepositoryPort;
  replay: ReplayRepositoryPort;
}
