import type {
  AuditLog,
  Course,
  Decision,
  DomainEvent,
  ReplayReport,
  ReplayRun,
  Round,
  Run,
  SessionRecord,
  SettlementResult,
  StateSnapshot,
  Team,
  Tenant,
  User
} from "@simwar/shared-contracts";

/**
 * Repository ports define the persistence boundary for API services.
 * They are intentionally implementation-free: no store, database, HTTP, route,
 * or server runtime details belong in this file.
 */
export interface IdentityUserRecord extends User {
  password_hash: string;
}

export interface IdentityRepositoryPort {
  findTenantById(tenantId: string): Promise<Tenant | undefined>;
  listUsers(tenantId: string): Promise<User[]>;
  findUserById(tenantId: string, userId: string): Promise<IdentityUserRecord | undefined>;
  findUserByUsername(
    tenantId: string,
    username: string
  ): Promise<IdentityUserRecord | undefined>;
}

export interface SessionRepositoryPort {
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | undefined>;
  createSession(session: SessionRecord): Promise<SessionRecord>;
  revokeSessionByTokenHash(tokenHash: string, revokedAt: string): Promise<SessionRecord | undefined>;
}

export interface CourseRepositoryPort {
  listCourses(tenantId: string): Promise<Course[]>;
  findCourseById(tenantId: string, courseId: string): Promise<Course | undefined>;
  createCourse(course: Course): Promise<Course>;
  updateCourse(course: Course): Promise<Course>;
}

export interface TeamRepositoryPort {
  listTeamsByCourse(tenantId: string, courseId: string): Promise<Team[]>;
  findTeamById(tenantId: string, teamId: string): Promise<Team | undefined>;
  createTeam(team: Team): Promise<Team>;
  updateTeam(team: Team): Promise<Team>;
}

export interface RunRepositoryPort {
  listRunsByCourse(tenantId: string, courseId: string): Promise<Run[]>;
  findRunById(tenantId: string, runId: string): Promise<Run | undefined>;
  createRun(run: Run): Promise<Run>;
  updateRun(run: Run): Promise<Run>;
}

export interface RoundRepositoryPort {
  listRoundsByRun(tenantId: string, runId: string): Promise<Round[]>;
  findRoundByNo(
    tenantId: string,
    runId: string,
    roundNo: number
  ): Promise<Round | undefined>;
  createRound(round: Round): Promise<Round>;
  updateRound(round: Round): Promise<Round>;
}

export interface DecisionRepositoryPort {
  listDecisionsByRound(tenantId: string, runId: string, roundId: string): Promise<Decision[]>;
  findDecisionByTeam(
    tenantId: string,
    runId: string,
    roundId: string,
    teamId: string
  ): Promise<Decision | undefined>;
  createDecision(decision: Decision): Promise<Decision>;
  updateDecision(decision: Decision): Promise<Decision>;
}

export interface SettlementRepositoryPort {
  findSettlementByRound(
    tenantId: string,
    runId: string,
    roundNo: number
  ): Promise<SettlementResult | undefined>;
  appendSettlement(settlement: SettlementResult): Promise<SettlementResult>;
}

export interface DomainEventRepositoryPort {
  appendDomainEvent(event: DomainEvent): Promise<DomainEvent>;
  listDomainEvents(filter: {
    tenantId: string;
    aggregateType?: string;
    aggregateId?: string;
  }): Promise<DomainEvent[]>;
}

export interface StateSnapshotRepositoryPort {
  appendStateSnapshot(snapshot: StateSnapshot): Promise<StateSnapshot>;
  listStateSnapshots(filter: {
    tenantId: string;
    runId?: string;
    roundId?: string;
  }): Promise<StateSnapshot[]>;
}

export interface AuditLogRepositoryPort {
  appendAuditLog(auditLog: AuditLog): Promise<AuditLog>;
  listAuditLogs(filter: {
    tenantId: string;
    resourceType?: string;
    resourceId?: string;
  }): Promise<AuditLog[]>;
}

export interface ReplayRepositoryPort {
  appendReplayRun(replayRun: ReplayRun): Promise<ReplayRun>;
  findReplayRun(tenantId: string, replayRunId: string): Promise<ReplayRun | undefined>;
  listReplayRuns(tenantId: string, runId?: string): Promise<ReplayRun[]>;
  appendReplayReport(replayReport: ReplayReport): Promise<ReplayReport>;
  listReplayReports(tenantId: string, replayRunId?: string): Promise<ReplayReport[]>;
}

export interface SimWarRepositoryPorts {
  identity: IdentityRepositoryPort;
  sessions: SessionRepositoryPort;
  courses: CourseRepositoryPort;
  teams: TeamRepositoryPort;
  runs: RunRepositoryPort;
  rounds: RoundRepositoryPort;
  decisions: DecisionRepositoryPort;
  settlements: SettlementRepositoryPort;
  domainEvents: DomainEventRepositoryPort;
  stateSnapshots: StateSnapshotRepositoryPort;
  auditLogs: AuditLogRepositoryPort;
  replays: ReplayRepositoryPort;
}
