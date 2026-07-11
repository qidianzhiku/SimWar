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
import type {
  RepositoryCourseReadModel,
  RepositoryEventQuery,
  RepositorySessionReadModel,
  RepositorySnapshotQuery,
  RepositoryTenantReadModel,
  RepositoryUserReadModel,
  SettlementOutcomeCommitResult,
  SettlementOutcomePersistencePort,
  SimWarRepositoryPorts
} from "./repository-ports.js";
import type { SimWarStore } from "./store.js";

/**
 * JSON-backed repository adapter for the current SimWar API store.
 *
 * This adapter is intentionally thin:
 * - It wraps the existing SimWarStore arrays.
 * - It does not change routes, settlement, replay hashing, or DB behavior.
 * - It does not introduce Postgres, migrations, package dependencies, or runtime wiring.
 * - It keeps canonical Decision and SettlementResult persistence separate from
 *   advisory, learning, or role-draft evidence.
 */

interface JsonRepositoryAdapterCollections {
  domainEvents: DomainEvent[];
  stateSnapshots: StateSnapshot[];
  replayInputManifests: ReplayInputManifest[];
  replayRuns: ReplayRun[];
  replayReports: ReplayReport[];
  replayDiffReports: ReplayDiffReport[];
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getString(value: unknown, key: string): string | undefined {
  const candidate = getRecord(value)[key];
  return typeof candidate === "string" ? candidate : undefined;
}

function getNumber(value: unknown, key: string): number | undefined {
  const candidate = getRecord(value)[key];
  return typeof candidate === "number" ? candidate : undefined;
}

function tenantMatches(value: unknown, tenantId: string): boolean {
  return getString(value, "tenant_id") === tenantId;
}

function idMatches(value: unknown, keys: string[], id: string): boolean {
  return keys.some((key) => getString(value, key) === id);
}

function eventMatchesQuery(event: DomainEvent, query: RepositoryEventQuery): boolean {
  if (!tenantMatches(event, query.tenant_id)) {
    return false;
  }

  if (query.aggregate_id && getString(event, "aggregate_id") !== query.aggregate_id) {
    return false;
  }

  if (query.aggregate_type && getString(event, "aggregate_type") !== query.aggregate_type) {
    return false;
  }

  const sequence = getNumber(event, "sequence");

  if (
    query.from_sequence !== undefined &&
    sequence !== undefined &&
    sequence < query.from_sequence
  ) {
    return false;
  }

  return true;
}

function snapshotMatchesQuery(snapshot: StateSnapshot, query: RepositorySnapshotQuery): boolean {
  if (!tenantMatches(snapshot, query.tenant_id)) {
    return false;
  }

  if (getString(snapshot, "aggregate_id") !== query.aggregate_id) {
    return false;
  }

  if (getString(snapshot, "aggregate_type") !== query.aggregate_type) {
    return false;
  }

  const sequence = getNumber(snapshot, "sequence");

  if (query.at_sequence !== undefined && sequence !== undefined && sequence > query.at_sequence) {
    return false;
  }

  return true;
}

function applyLimit<T>(items: T[], limit?: number): T[] {
  if (!limit || limit <= 0) {
    return items;
  }

  return items.slice(0, limit);
}

function toCourseReadModel(course: Course): RepositoryCourseReadModel {
  return {
    course_id: course.course_id,
    tenant_id: course.tenant_id,
    title: course.title,
    status: course.status,
    scenario_package_id: course.scenario_package_id,
    parameter_set_id: course.parameter_set_id,
    created_by: course.created_by
  };
}

function hasOwnReplayHash(round: Round): boolean {
  return Object.prototype.hasOwnProperty.call(round, "replay_hash");
}

export function createJsonSettlementOutcomePersistencePort(
  store: SimWarStore
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

      const round = store.rounds.find(
        (candidate) =>
          candidate.tenant_id === command.tenant_id && candidate.round_id === command.round_id
      );

      if (!round) {
        throw new Error("settlement_outcome_round_missing");
      }

      const settlementIndex = store.settlementResults.findIndex(
        (candidate) =>
          candidate.tenant_id === result.tenant_id &&
          candidate.settlement_result_id === result.settlement_result_id
      );
      const settlementSnapshot =
        settlementIndex >= 0
          ? {
              kind: "replace" as const,
              index: settlementIndex,
              previous: store.settlementResults[settlementIndex] as SettlementResult
            }
          : {
              kind: "append" as const,
              length: store.settlementResults.length
            };
      const roundSnapshot = {
        status: round.status,
        hadReplayHash: hasOwnReplayHash(round),
        replayHash: round.replay_hash
      };

      try {
        if (settlementIndex >= 0) {
          store.settlementResults[settlementIndex] = result;
        } else {
          store.settlementResults.push(result);
        }

        round.status = "settled";
        round.replay_hash = result.replay_hash;

        store.persist();
      } catch (error) {
        if (settlementSnapshot.kind === "replace") {
          store.settlementResults[settlementSnapshot.index] = settlementSnapshot.previous;
        } else {
          store.settlementResults.length = settlementSnapshot.length;
        }

        round.status = roundSnapshot.status;

        if (roundSnapshot.hadReplayHash) {
          Object.defineProperty(round, "replay_hash", {
            configurable: true,
            enumerable: true,
            value: roundSnapshot.replayHash,
            writable: true
          });
        } else {
          delete round.replay_hash;
        }

        throw error;
      }

      return {
        settlement_result: result,
        status: "committed"
      };
    }
  };
}

export function createJsonRepositoryPorts(
  store: SimWarStore,
  collections: Partial<JsonRepositoryAdapterCollections> = {}
): SimWarRepositoryPorts {
  const domainEvents = collections.domainEvents ?? [];
  const stateSnapshots = collections.stateSnapshots ?? [];
  const replayInputManifests = collections.replayInputManifests ?? [];
  const replayRuns = collections.replayRuns ?? [];
  const replayReports = collections.replayReports ?? [];
  const replayDiffReports = collections.replayDiffReports ?? [];

  return {
    identity: {
      async getTenant(tenantId): Promise<RepositoryTenantReadModel | null> {
        const tenant = store.tenants.find((candidate) => candidate.tenant_id === tenantId);

        if (!tenant) {
          return null;
        }

        return {
          tenant_id: tenant.tenant_id,
          status: tenant.status
        };
      },

      async getUser(tenantId, userId): Promise<RepositoryUserReadModel | null> {
        const user = store.users.find(
          (candidate) => candidate.tenant_id === tenantId && candidate.user_id === userId
        );

        if (!user) {
          return null;
        }

        return {
          tenant_id: user.tenant_id,
          user_id: user.user_id,
          status: user.status
        };
      }
    },

    sessions: {
      async getSession(tenantId, sessionId): Promise<RepositorySessionReadModel | null> {
        const session = store.sessions.find(
          (candidate) => candidate.tenant_id === tenantId && candidate.session_id === sessionId
        );

        if (!session) {
          return null;
        }

        return {
          tenant_id: session.tenant_id,
          session_id: session.session_id,
          user_id: session.user_id,
          expires_at: session.expires_at
        };
      },

      async listActiveSessionsByUser(tenantId, userId): Promise<RepositorySessionReadModel[]> {
        const now = Date.now();

        return store.sessions
          .filter(
            (session) =>
              session.tenant_id === tenantId &&
              session.user_id === userId &&
              (!session.expires_at || Date.parse(session.expires_at) > now)
          )
          .map((session) => ({
            tenant_id: session.tenant_id,
            session_id: session.session_id,
            user_id: session.user_id,
            expires_at: session.expires_at
          }));
      }
    },

    courses: {
      async getCourse(tenantId, courseId): Promise<RepositoryCourseReadModel | null> {
        const course = store.courses.find(
          (candidate) => candidate.tenant_id === tenantId && candidate.course_id === courseId
        );

        if (!course) {
          return null;
        }

        return toCourseReadModel(course);
      },

      async listCoursesForTenant(tenantId): Promise<RepositoryCourseReadModel[]> {
        return store.courses
          .filter((course) => course.tenant_id === tenantId)
          .map((course) => toCourseReadModel(course));
      },

      async listCoursesForUser(tenantId, userId): Promise<RepositoryCourseReadModel[]> {
        const user = store.users.find(
          (candidate) => candidate.tenant_id === tenantId && candidate.user_id === userId
        );

        if (!user) {
          return [];
        }

        return store.courses
          .filter((course) => course.tenant_id === tenantId)
          .map(toCourseReadModel);
      }
    },

    teams: {
      async getTeam(tenantId, teamId): Promise<Team | null> {
        return (
          store.teams.find(
            (candidate) => candidate.tenant_id === tenantId && candidate.team_id === teamId
          ) ?? null
        );
      },

      async listTeamsForRun(tenantId, runId): Promise<Team[]> {
        const run = store.runs.find(
          (candidate) => candidate.tenant_id === tenantId && candidate.run_id === runId
        );

        if (!run) {
          return [];
        }

        return store.teams.filter(
          (team) => team.tenant_id === tenantId && team.course_id === run.course_id
        );
      },

      async getTeamForUser(tenantId, runId, userId): Promise<Team | null> {
        const run = store.runs.find(
          (candidate) => candidate.tenant_id === tenantId && candidate.run_id === runId
        );

        if (!run) {
          return null;
        }

        return (
          store.teams.find(
            (team) =>
              team.tenant_id === tenantId &&
              team.course_id === run.course_id &&
              (team.captain_user_id === userId ||
                team.members.some((member) => member.user_id === userId))
          ) ?? null
        );
      }
    },

    runs: {
      async getRun(tenantId, runId): Promise<Run | null> {
        return (
          store.runs.find(
            (candidate) => candidate.tenant_id === tenantId && candidate.run_id === runId
          ) ?? null
        );
      },

      async listRunsForCourse(tenantId, courseId): Promise<Run[]> {
        return store.runs.filter((run) => run.tenant_id === tenantId && run.course_id === courseId);
      }
    },

    scenarios: {
      async getScenarioPackage(tenantId, scenarioPackageId): Promise<ScenarioPackage | null> {
        return (
          store.scenarios.find(
            (candidate) =>
              candidate.tenant_id === tenantId &&
              candidate.scenario_package_id === scenarioPackageId
          ) ?? null
        );
      },

      async listScenarioPackagesForTenant(tenantId): Promise<ScenarioPackage[]> {
        return store.scenarios
          .filter((candidate) => candidate.tenant_id === tenantId)
          .sort((left, right) => {
            if (left.scenario_package_id < right.scenario_package_id) {
              return -1;
            }

            return left.scenario_package_id > right.scenario_package_id ? 1 : 0;
          });
      }
    },

    parameterSets: {
      async getParameterSet(tenantId, parameterSetId): Promise<ParameterSet | null> {
        return (
          store.parameterSets.find(
            (candidate) =>
              candidate.tenant_id === tenantId && candidate.parameter_set_id === parameterSetId
          ) ?? null
        );
      }
    },

    rounds: {
      async getRound(tenantId, roundId): Promise<Round | null> {
        return (
          store.rounds.find(
            (candidate) => candidate.tenant_id === tenantId && candidate.round_id === roundId
          ) ?? null
        );
      },

      async listRoundsForRun(tenantId, runId): Promise<Round[]> {
        return store.rounds.filter(
          (round) => round.tenant_id === tenantId && round.run_id === runId
        );
      },

      async saveRound(round): Promise<void> {
        const index = store.rounds.findIndex(
          (candidate) =>
            candidate.tenant_id === round.tenant_id && candidate.round_id === round.round_id
        );

        if (index >= 0) {
          store.rounds[index] = round;
        } else {
          store.rounds.push(round);
        }

        store.persist();
      },

      async markRoundSettled(tenantId, roundId, settlementResultId): Promise<void> {
        const round = store.rounds.find(
          (candidate) => candidate.tenant_id === tenantId && candidate.round_id === roundId
        );

        if (!round) {
          return;
        }

        round.status = "settled";

        const settlement = store.settlementResults.find(
          (candidate) =>
            candidate.tenant_id === tenantId &&
            candidate.settlement_result_id === settlementResultId
        );

        if (settlement) {
          round.replay_hash = settlement.replay_hash;
        }

        store.persist();
      }
    },

    decisions: {
      async getDecisionById(tenantId, decisionId): Promise<Decision | null> {
        return (
          store.decisions.find(
            (candidate) => candidate.tenant_id === tenantId && candidate.decision_id === decisionId
          ) ?? null
        );
      },

      async getCanonicalDecisionForTeamRound(
        tenantId,
        runId,
        roundId,
        teamId
      ): Promise<Decision | null> {
        return (
          store.decisions.find(
            (decision) =>
              decision.tenant_id === tenantId &&
              decision.run_id === runId &&
              decision.round_id === roundId &&
              decision.team_id === teamId &&
              decision.status === "submitted"
          ) ?? null
        );
      },

      async listDecisionsForRound(tenantId, runId, roundId): Promise<Decision[]> {
        return store.decisions.filter(
          (decision) =>
            decision.tenant_id === tenantId &&
            decision.run_id === runId &&
            decision.round_id === roundId
        );
      },

      async saveCanonicalDecision(decision): Promise<void> {
        const index = store.decisions.findIndex(
          (candidate) =>
            candidate.tenant_id === decision.tenant_id &&
            candidate.decision_id === decision.decision_id
        );

        if (index >= 0) {
          store.decisions[index] = decision;
        } else {
          store.decisions.push(decision);
        }

        store.persist();
      },

      async saveDecision(decision): Promise<void> {
        const index = store.decisions.findIndex(
          (candidate) =>
            candidate.tenant_id === decision.tenant_id &&
            candidate.decision_id === decision.decision_id
        );

        if (index >= 0) {
          store.decisions[index] = decision;
        } else {
          store.decisions.push(decision);
        }

        store.persist();
      }
    },

    settlements: {
      async getSettlementResult(tenantId, settlementResultId): Promise<SettlementResult | null> {
        return (
          store.settlementResults.find(
            (candidate) =>
              candidate.tenant_id === tenantId &&
              candidate.settlement_result_id === settlementResultId
          ) ?? null
        );
      },

      async listSettlementResultsForRound(tenantId, runId, roundId): Promise<SettlementResult[]> {
        return store.settlementResults.filter(
          (result) =>
            result.tenant_id === tenantId && result.run_id === runId && result.round_id === roundId
        );
      },

      async saveSettlementResult(result): Promise<void> {
        const index = store.settlementResults.findIndex(
          (candidate) =>
            candidate.tenant_id === result.tenant_id &&
            candidate.settlement_result_id === result.settlement_result_id
        );

        if (index >= 0) {
          store.settlementResults[index] = result;
        } else {
          store.settlementResults.push(result);
        }

        store.persist();
      }
    },

    settlementOutcome: createJsonSettlementOutcomePersistencePort(store),

    domainEvents: {
      async appendDomainEvent(event): Promise<void> {
        domainEvents.push(event);
      },

      async listDomainEvents(query): Promise<DomainEvent[]> {
        return applyLimit(
          domainEvents.filter((event) => eventMatchesQuery(event, query)),
          query.limit
        );
      }
    },

    stateSnapshots: {
      async getStateSnapshot(query): Promise<StateSnapshot | null> {
        const snapshots = stateSnapshots.filter((snapshot) =>
          snapshotMatchesQuery(snapshot, query)
        );

        if (snapshots.length === 0) {
          return null;
        }

        return snapshots[snapshots.length - 1] ?? null;
      },

      async saveStateSnapshot(snapshot): Promise<void> {
        stateSnapshots.push(snapshot);
      }
    },

    auditLogs: {
      async appendAuditLog(auditLog): Promise<void> {
        store.auditLogs.push(auditLog);
        store.persist();
      },

      async listAuditLogs(query): Promise<AuditLog[]> {
        return applyLimit(
          store.auditLogs.filter((auditLog) => {
            if (query.scope === "tenant" && auditLog.tenant_id !== query.tenant_id) {
              return false;
            }

            if (
              query.scope === "platform" &&
              query.tenant_id &&
              auditLog.tenant_id !== query.tenant_id
            ) {
              return false;
            }

            if (query.actor_id && auditLog.actor_id !== query.actor_id) {
              return false;
            }

            if (query.action && auditLog.action !== query.action) {
              return false;
            }

            if (query.resource_id && auditLog.resource_id !== query.resource_id) {
              return false;
            }

            if (query.resource_type && auditLog.resource_type !== query.resource_type) {
              return false;
            }

            return true;
          }),
          query.limit
        );
      }
    },

    replay: {
      async saveReplayInputManifest(manifest): Promise<void> {
        replayInputManifests.push(manifest);
      },

      async getReplayInputManifest(tenantId, manifestId): Promise<ReplayInputManifest | null> {
        return (
          replayInputManifests.find(
            (manifest) =>
              tenantMatches(manifest, tenantId) &&
              idMatches(manifest, ["replay_input_manifest_id", "manifest_id"], manifestId)
          ) ?? null
        );
      },

      async saveReplayRun(run): Promise<void> {
        replayRuns.push(run);
      },

      async getReplayRun(tenantId, replayRunId): Promise<ReplayRun | null> {
        return (
          replayRuns.find(
            (run) =>
              tenantMatches(run, tenantId) &&
              idMatches(run, ["replay_run_id", "run_id"], replayRunId)
          ) ?? null
        );
      },

      async saveReplayReport(report): Promise<void> {
        replayReports.push(report);
      },

      async getReplayReport(tenantId, replayReportId): Promise<ReplayReport | null> {
        return (
          replayReports.find(
            (report) =>
              tenantMatches(report, tenantId) &&
              idMatches(report, ["replay_report_id", "report_id"], replayReportId)
          ) ?? null
        );
      },

      async saveReplayDiffReport(report): Promise<void> {
        replayDiffReports.push(report);
      },

      async getReplayDiffReport(tenantId, replayDiffReportId): Promise<ReplayDiffReport | null> {
        return (
          replayDiffReports.find(
            (report) =>
              tenantMatches(report, tenantId) &&
              idMatches(
                report,
                ["replay_diff_report_id", "diff_report_id", "report_id"],
                replayDiffReportId
              )
          ) ?? null
        );
      }
    }
  };
}
