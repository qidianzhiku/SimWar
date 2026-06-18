import type {
  AuditLog,
  Decision,
  DomainEvent,
  ReplayDiffReport,
  ReplayInputManifest,
  ReplayReport,
  ReplayRun,
  Round,
  Run,
  SettlementResult,
  StateSnapshot,
  Team
} from "@simwar/shared-contracts";
import type {
  CommitSettlementOutcomeCommand,
  RepositoryCourseReadModel,
  RepositoryEventQuery,
  RepositorySessionReadModel,
  RepositorySnapshotQuery,
  RepositoryTenantReadModel,
  RepositoryUserReadModel,
  SimWarRepositoryPorts
} from "./repository-ports.js";
import { createJsonRepositoryPorts } from "./json-repository-adapter.js";
import type { SimWarStore } from "./store.js";

/**
 * Repository facade for API service use cases.
 *
 * This facade is intentionally thin:
 * - It centralizes repository access behind SimWarRepositoryPorts.
 * - It does not wire routes, server runtime, DB, migrations, or package changes.
 * - It does not change settlement, replay hash, or canonical decision behavior.
 * - It keeps future adapter replacement possible without touching API use cases.
 */

export interface RepositoryFacade {
  identity: {
    getTenant(tenantId: string): Promise<RepositoryTenantReadModel | null>;
    getUser(tenantId: string, userId: string): Promise<RepositoryUserReadModel | null>;
  };

  sessions: {
    getSession(tenantId: string, sessionId: string): Promise<RepositorySessionReadModel | null>;
    listActiveSessionsByUser(
      tenantId: string,
      userId: string
    ): Promise<RepositorySessionReadModel[]>;
  };

  courses: {
    getCourse(tenantId: string, courseId: string): Promise<RepositoryCourseReadModel | null>;
    listCoursesForUser(tenantId: string, userId: string): Promise<RepositoryCourseReadModel[]>;
  };

  teams: {
    getTeam(tenantId: string, teamId: string): Promise<Team | null>;
    listTeamsForRun(tenantId: string, runId: string): Promise<Team[]>;
    getTeamForUser(tenantId: string, runId: string, userId: string): Promise<Team | null>;
  };

  runs: {
    getRun(tenantId: string, runId: string): Promise<Run | null>;
    listRunsForCourse(tenantId: string, courseId: string): Promise<Run[]>;
  };

  rounds: {
    getRound(tenantId: string, roundId: string): Promise<Round | null>;
    listRoundsForRun(tenantId: string, runId: string): Promise<Round[]>;
    saveRound(round: Round): Promise<void>;
    markRoundSettled(tenantId: string, roundId: string, settlementResultId: string): Promise<void>;
  };

  decisions: {
    getDecisionById(tenantId: string, decisionId: string): Promise<Decision | null>;
    getCanonicalDecisionForTeamRound(
      tenantId: string,
      runId: string,
      roundId: string,
      teamId: string
    ): Promise<Decision | null>;
    listDecisionsForRound(tenantId: string, runId: string, roundId: string): Promise<Decision[]>;
    saveDecision(decision: Decision): Promise<void>;
    saveCanonicalDecision(decision: Decision): Promise<void>;
  };

  settlements: {
    getSettlementResult(
      tenantId: string,
      settlementResultId: string
    ): Promise<SettlementResult | null>;
    listSettlementResultsForRound(
      tenantId: string,
      runId: string,
      roundId: string
    ): Promise<SettlementResult[]>;
    saveSettlementResult(result: SettlementResult): Promise<void>;
  };

  commitSettlementOutcome(command: CommitSettlementOutcomeCommand): Promise<void>;

  domainEvents: {
    appendDomainEvent(event: DomainEvent): Promise<void>;
    listDomainEvents(query: RepositoryEventQuery): Promise<DomainEvent[]>;
  };

  stateSnapshots: {
    getStateSnapshot(query: RepositorySnapshotQuery): Promise<StateSnapshot | null>;
    saveStateSnapshot(snapshot: StateSnapshot): Promise<void>;
  };

  auditLogs: {
    appendAuditLog(auditLog: AuditLog): Promise<void>;
    listAuditLogs(query: {
      tenant_id: string;
      actor_id?: string;
      action?: string;
      resource_id?: string;
      limit?: number;
    }): Promise<AuditLog[]>;
  };

  replay: {
    saveReplayInputManifest(manifest: ReplayInputManifest): Promise<void>;
    getReplayInputManifest(
      tenantId: string,
      manifestId: string
    ): Promise<ReplayInputManifest | null>;

    saveReplayRun(run: ReplayRun): Promise<void>;
    getReplayRun(tenantId: string, replayRunId: string): Promise<ReplayRun | null>;

    saveReplayReport(report: ReplayReport): Promise<void>;
    getReplayReport(tenantId: string, replayReportId: string): Promise<ReplayReport | null>;

    saveReplayDiffReport(report: ReplayDiffReport): Promise<void>;
    getReplayDiffReport(
      tenantId: string,
      replayDiffReportId: string
    ): Promise<ReplayDiffReport | null>;
  };
}

export interface RepositoryFacadeOptions {
  ports: SimWarRepositoryPorts;
}

export interface JsonRepositoryFacadeOptions {
  store: SimWarStore;
}

/**
 * Create a repository facade from any concrete repository port implementation.
 */
export function createRepositoryFacade(options: RepositoryFacadeOptions): RepositoryFacade {
  const { ports } = options;

  return {
    identity: {
      getTenant: (tenantId) => ports.identity.getTenant(tenantId),
      getUser: (tenantId, userId) => ports.identity.getUser(tenantId, userId)
    },

    sessions: {
      getSession: (tenantId, sessionId) => ports.sessions.getSession(tenantId, sessionId),
      listActiveSessionsByUser: (tenantId, userId) =>
        ports.sessions.listActiveSessionsByUser(tenantId, userId)
    },

    courses: {
      getCourse: (tenantId, courseId) => ports.courses.getCourse(tenantId, courseId),
      listCoursesForUser: (tenantId, userId) => ports.courses.listCoursesForUser(tenantId, userId)
    },

    teams: {
      getTeam: (tenantId, teamId) => ports.teams.getTeam(tenantId, teamId),
      listTeamsForRun: (tenantId, runId) => ports.teams.listTeamsForRun(tenantId, runId),
      getTeamForUser: (tenantId, runId, userId) =>
        ports.teams.getTeamForUser(tenantId, runId, userId)
    },

    runs: {
      getRun: (tenantId, runId) => ports.runs.getRun(tenantId, runId),
      listRunsForCourse: (tenantId, courseId) => ports.runs.listRunsForCourse(tenantId, courseId)
    },

    rounds: {
      getRound: (tenantId, roundId) => ports.rounds.getRound(tenantId, roundId),
      listRoundsForRun: (tenantId, runId) => ports.rounds.listRoundsForRun(tenantId, runId),
      saveRound: (round) => ports.rounds.saveRound(round),
      markRoundSettled: (tenantId, roundId, settlementResultId) =>
        ports.rounds.markRoundSettled(tenantId, roundId, settlementResultId)
    },

    decisions: {
      getDecisionById: (tenantId, decisionId) =>
        ports.decisions.getDecisionById(tenantId, decisionId),
      getCanonicalDecisionForTeamRound: (tenantId, runId, roundId, teamId) =>
        ports.decisions.getCanonicalDecisionForTeamRound(tenantId, runId, roundId, teamId),
      listDecisionsForRound: (tenantId, runId, roundId) =>
        ports.decisions.listDecisionsForRound(tenantId, runId, roundId),
      saveDecision: (decision) => ports.decisions.saveDecision(decision),
      saveCanonicalDecision: (decision) => ports.decisions.saveCanonicalDecision(decision)
    },

    settlements: {
      getSettlementResult: (tenantId, settlementResultId) =>
        ports.settlements.getSettlementResult(tenantId, settlementResultId),
      listSettlementResultsForRound: (tenantId, runId, roundId) =>
        ports.settlements.listSettlementResultsForRound(tenantId, runId, roundId),
      saveSettlementResult: (result) => ports.settlements.saveSettlementResult(result)
    },

    commitSettlementOutcome: (command) => ports.settlementOutcome.commitSettlementOutcome(command),

    domainEvents: {
      appendDomainEvent: (event) => ports.domainEvents.appendDomainEvent(event),
      listDomainEvents: (query) => ports.domainEvents.listDomainEvents(query)
    },

    stateSnapshots: {
      getStateSnapshot: (query) => ports.stateSnapshots.getStateSnapshot(query),
      saveStateSnapshot: (snapshot) => ports.stateSnapshots.saveStateSnapshot(snapshot)
    },

    auditLogs: {
      appendAuditLog: (auditLog) => ports.auditLogs.appendAuditLog(auditLog),
      listAuditLogs: (query) => ports.auditLogs.listAuditLogs(query)
    },

    replay: {
      saveReplayInputManifest: (manifest) => ports.replay.saveReplayInputManifest(manifest),
      getReplayInputManifest: (tenantId, manifestId) =>
        ports.replay.getReplayInputManifest(tenantId, manifestId),

      saveReplayRun: (run) => ports.replay.saveReplayRun(run),
      getReplayRun: (tenantId, replayRunId) => ports.replay.getReplayRun(tenantId, replayRunId),

      saveReplayReport: (report) => ports.replay.saveReplayReport(report),
      getReplayReport: (tenantId, replayReportId) =>
        ports.replay.getReplayReport(tenantId, replayReportId),

      saveReplayDiffReport: (report) => ports.replay.saveReplayDiffReport(report),
      getReplayDiffReport: (tenantId, replayDiffReportId) =>
        ports.replay.getReplayDiffReport(tenantId, replayDiffReportId)
    }
  };
}

/**
 * Convenience factory for the current JSON-backed store.
 *
 * This function is intentionally not wired into server runtime in this PR.
 */
export function createJsonRepositoryFacade(options: JsonRepositoryFacadeOptions): RepositoryFacade {
  return createRepositoryFacade({
    ports: createJsonRepositoryPorts(options.store)
  });
}
