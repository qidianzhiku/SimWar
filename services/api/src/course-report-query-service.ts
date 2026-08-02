import {
  COURSE_REPORT_EXPORT_FORMATS,
  COURSE_REPORT_KPIS,
  COURSE_REPORT_SCHEMA_VERSION,
  type CourseReportDto,
  type CourseReportExportDto,
  type CourseReportExportFormat,
  type CourseReportFailureCode,
  type CourseReportFilterInput,
  type CourseReportKpi,
  type KnownLimitSemanticId,
  type Team
} from "@simwar/shared-contracts";
import type { RepositoryFacade } from "./repository-facade.js";

type CourseReportRepository = Pick<
  RepositoryFacade,
  "courses" | "rounds" | "runs" | "settlements" | "teams"
>;

export interface CourseReportProviderCapabilities {
  knownLimits: readonly KnownLimitSemanticId[];
}

export class CourseReportQueryServiceError extends Error {
  constructor(readonly code: CourseReportFailureCode) {
    super(code);
    this.name = "CourseReportQueryServiceError";
  }
}

/**
 * Read-only Course Report projection. It deliberately consumes only published
 * settlement observations and never exposes truth, decisions, or replay data.
 */
export class CourseReportQueryService {
  constructor(
    private readonly repository: CourseReportRepository,
    private readonly providerCapabilities?: CourseReportProviderCapabilities
  ) {}

  async query(tenantId: string, filters: CourseReportFilterInput): Promise<CourseReportDto> {
    if (!this.providerCapabilities) {
      throw new CourseReportQueryServiceError("COURSE_REPORT_PROVIDER_UNSUPPORTED");
    }
    const course = await this.repository.courses.getCourse(tenantId, filters.course_id);
    if (!course) throw new CourseReportQueryServiceError("COURSE_REPORT_NOT_FOUND");

    const runs = await this.resolveRuns(tenantId, course.course_id, filters.run_id);
    const selectedTeam = filters.team_id
      ? await this.repository.teams.getTeam(tenantId, filters.team_id)
      : null;
    if (filters.team_id && (!selectedTeam || selectedTeam.course_id !== course.course_id)) {
      throw new CourseReportQueryServiceError("COURSE_REPORT_NOT_FOUND");
    }

    const rows: CourseReportDto["rows"][number][] = [];
    let requestedRoundFound = filters.round_no === undefined;

    for (const run of runs) {
      const rounds = await this.repository.rounds.listRoundsForRun(tenantId, run.run_id);
      const requestedRounds =
        filters.round_no === undefined
          ? rounds
          : rounds.filter((round) => round.round_no === filters.round_no);
      if (requestedRounds.length > 0) requestedRoundFound = true;

      for (const round of requestedRounds) {
        if (round.status !== "published") continue;
        const settlements = await this.repository.settlements.listSettlementResultsForRound(
          tenantId,
          run.run_id,
          round.round_id
        );
        const settlement = settlements.find(
          (candidate) =>
            candidate.tenant_id === tenantId &&
            candidate.run_id === run.run_id &&
            candidate.round_id === round.round_id &&
            candidate.round_no === round.round_no
        );
        if (!settlement) continue;

        const teams = await this.repository.teams.listTeamsForRun(tenantId, run.run_id);
        const teamsById = new Map(teams.map((team) => [team.team_id, team]));
        const kpis = filters.kpis ?? COURSE_REPORT_KPIS;

        for (const result of settlement.team_results) {
          const team = teamsById.get(result.team_id);
          if (
            (filters.team_id !== undefined && result.team_id !== filters.team_id) ||
            !matchesRole(team, filters.role)
          ) {
            continue;
          }
          const observed: Record<CourseReportKpi, number | string> = {
            demand_band: result.state_obs.demand_band,
            profit_band: result.state_obs.profit_band,
            rank: result.state_obs.rank,
            revenue: result.state_obs.revenue,
            score: result.state_obs.score,
            served_demand: result.state_obs.served_demand
          };
          rows.push({
            course_id: course.course_id,
            metrics: kpis.map((kpi) => ({ kpi, value: observed[kpi] })),
            round_no: round.round_no,
            run_id: run.run_id,
            team_id: result.team_id,
            team_name: result.team_name
          });
        }
      }
    }

    if (!requestedRoundFound) throw new CourseReportQueryServiceError("COURSE_REPORT_NOT_FOUND");

    return {
      applied_filters: cloneFilters(filters),
      known_limits: [...this.providerCapabilities.knownLimits],
      report_schema_version: COURSE_REPORT_SCHEMA_VERSION,
      rows: rows.sort(compareRows)
    };
  }

  private async resolveRuns(
    tenantId: string,
    courseId: string,
    requestedRunId: string | undefined
  ) {
    if (requestedRunId === undefined) {
      return this.repository.runs.listRunsForCourse(tenantId, courseId);
    }

    const run = await this.repository.runs.getRun(tenantId, requestedRunId);
    if (!run || run.course_id !== courseId) {
      throw new CourseReportQueryServiceError("COURSE_REPORT_NOT_FOUND");
    }
    return [run];
  }
}

/** Export preserves the read-only safe report shape; serialization remains a client delivery concern. */
export function createCourseReportExport(
  report: CourseReportDto,
  format: CourseReportExportFormat
): CourseReportExportDto {
  if (!COURSE_REPORT_EXPORT_FORMATS.includes(format)) {
    throw new CourseReportQueryServiceError("COURSE_REPORT_EXPORT_FORMAT_UNSUPPORTED");
  }

  return {
    export_format: format,
    file_name: `${report.applied_filters.course_id}-report.${format}`,
    report
  };
}

function matchesRole(team: Team | undefined, role: CourseReportFilterInput["role"]): boolean {
  return role === undefined || team?.members.some((member) => member.role_slot === role) === true;
}

function cloneFilters(filters: CourseReportFilterInput): CourseReportFilterInput {
  return {
    course_id: filters.course_id,
    ...(filters.kpis ? { kpis: [...filters.kpis] } : {}),
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.round_no ? { round_no: filters.round_no } : {}),
    ...(filters.run_id ? { run_id: filters.run_id } : {}),
    ...(filters.team_id ? { team_id: filters.team_id } : {})
  };
}

function compareRows(
  left: CourseReportDto["rows"][number],
  right: CourseReportDto["rows"][number]
): number {
  return (
    left.run_id.localeCompare(right.run_id) ||
    left.round_no - right.round_no ||
    left.team_id.localeCompare(right.team_id)
  );
}
