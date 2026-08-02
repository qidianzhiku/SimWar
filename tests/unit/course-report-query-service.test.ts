import type { RepositoryFacade } from "../../services/api/src/repository-facade";
import { describe, expect, it } from "vitest";
import {
  CourseReportQueryService,
  CourseReportQueryServiceError,
  createCourseReportExport,
  type CourseReportProviderCapabilities
} from "../../services/api/src/course-report-query-service";

const tenantId = "tenant_demo";
const courseId = "course_report_demo";
const runId = "run_report_demo";
const jsonCapabilities: CourseReportProviderCapabilities = {
  knownLimits: ["JSON_INTERNAL_ONLY", "POSTGRESQL_NOT_ACTIVE"]
};

function createRepository(): Pick<
  RepositoryFacade,
  "courses" | "rounds" | "runs" | "settlements" | "teams"
> {
  return {
    courses: {
      getCourse: async (tenant, course) =>
        tenant === tenantId && course === courseId
          ? {
              course_id: courseId,
              created_by: "usr_teacher",
              parameter_set_id: "param_demo",
              scenario_package_id: "scenario_demo",
              status: "published",
              tenant_id: tenantId,
              title: "Report demo"
            }
          : null
    },
    rounds: {
      listRoundsForRun: async (tenant, run) =>
        tenant === tenantId && run === runId
          ? [
              {
                round_id: "round_report_draft",
                round_no: 1,
                run_id: runId,
                status: "settled",
                tenant_id: tenantId
              },
              {
                round_id: "round_report_published",
                round_no: 2,
                run_id: runId,
                status: "published",
                tenant_id: tenantId
              }
            ]
          : []
    },
    runs: {
      getRun: async (tenant, run) =>
        tenant === tenantId && run === runId
          ? {
              course_id: courseId,
              parameter_set_id: "param_demo",
              run_id: runId,
              scenario_package_id: "scenario_demo",
              seed: 42,
              status: "completed",
              tenant_id: tenantId
            }
          : null,
      listRunsForCourse: async (tenant, course) =>
        tenant === tenantId && course === courseId
          ? [
              {
                course_id: courseId,
                parameter_set_id: "param_demo",
                run_id: runId,
                scenario_package_id: "scenario_demo",
                seed: 42,
                status: "completed",
                tenant_id: tenantId
              }
            ]
          : []
    },
    settlements: {
      listSettlementResultsForRound: async (tenant, run, round) =>
        tenant === tenantId && run === runId && round === "round_report_published"
          ? [
              {
                parameter_set_id: "param_demo",
                replay_hash: "a".repeat(64),
                round_id: "round_report_published",
                round_no: 2,
                run_id: runId,
                scenario_package_id: "scenario_demo",
                settlement_result_id: "result_report_001",
                team_results: [
                  {
                    state_est: {
                      explanation: "safe explanation",
                      next_round_risk: "balanced",
                      recommended_focus: "observe"
                    },
                    state_obs: {
                      demand_band: "high",
                      profit_band: "healthy",
                      rank: 1,
                      revenue: 1200,
                      score: 88,
                      served_demand: 42
                    },
                    state_true: {
                      cash_flow: 100,
                      cost: 800,
                      demand: 50,
                      market_share: 0.5,
                      profit: 400,
                      rank: 1,
                      revenue: 1200,
                      score: 88,
                      served_demand: 42,
                      settlement_status: "settled"
                    },
                    team_id: "team_alpha",
                    team_name: "Alpha"
                  }
                ],
                tenant_id: tenantId
              }
            ]
          : []
    },
    teams: {
      getTeam: async (tenant, team) =>
        tenant === tenantId && team === "team_alpha"
          ? {
              captain_user_id: "usr_student",
              course_id: courseId,
              members: [{ display_name: "Student", role_slot: "CEO", user_id: "usr_student" }],
              name: "Alpha",
              team_id: "team_alpha",
              tenant_id: tenantId
            }
          : null,
      listTeamsForRun: async (tenant, run) =>
        tenant === tenantId && run === runId
          ? [
              {
                captain_user_id: "usr_student",
                course_id: courseId,
                members: [{ display_name: "Student", role_slot: "CEO", user_id: "usr_student" }],
                name: "Alpha",
                team_id: "team_alpha",
                tenant_id: tenantId
              }
            ]
          : []
    }
  } as Pick<RepositoryFacade, "courses" | "rounds" | "runs" | "settlements" | "teams">;
}

describe("CourseReportQueryService", () => {
  it("reads published observed metrics only and applies safe filters", async () => {
    const service = new CourseReportQueryService(createRepository(), jsonCapabilities);

    const report = await service.query(tenantId, {
      course_id: courseId,
      kpis: ["revenue", "score"],
      role: "CEO",
      run_id: runId
    });

    expect(report.rows).toEqual([
      {
        course_id: courseId,
        metrics: [
          { kpi: "revenue", value: 1200 },
          { kpi: "score", value: 88 }
        ],
        round_no: 2,
        run_id: runId,
        team_id: "team_alpha",
        team_name: "Alpha"
      }
    ]);
    expect(JSON.stringify(report)).not.toContain("state_true");
    expect(JSON.stringify(report)).not.toContain("replay_hash");
    expect(JSON.stringify(report)).not.toContain("safe explanation");
  });

  it("fails closed for a cross-course run, unknown team, and non-existent round", async () => {
    const service = new CourseReportQueryService(createRepository(), jsonCapabilities);

    await expect(
      service.query(tenantId, { course_id: courseId, run_id: "run_other" })
    ).rejects.toEqual(new CourseReportQueryServiceError("COURSE_REPORT_NOT_FOUND"));
    await expect(
      service.query(tenantId, { course_id: courseId, team_id: "team_other" })
    ).rejects.toEqual(new CourseReportQueryServiceError("COURSE_REPORT_NOT_FOUND"));
    await expect(
      service.query(tenantId, { course_id: courseId, round_no: 99, run_id: runId })
    ).rejects.toEqual(new CourseReportQueryServiceError("COURSE_REPORT_NOT_FOUND"));
  });

  it("creates only safe JSON and CSV export DTOs", async () => {
    const service = new CourseReportQueryService(createRepository(), jsonCapabilities);
    const report = await service.query(tenantId, { course_id: courseId });

    expect(createCourseReportExport(report, "json")).toMatchObject({
      export_format: "json",
      file_name: "course_report_demo-report.json"
    });
    expect(createCourseReportExport(report, "csv")).toMatchObject({
      export_format: "csv",
      file_name: "course_report_demo-report.csv"
    });
    expect(() => createCourseReportExport(report, "xlsx" as never)).toThrowError(
      new CourseReportQueryServiceError("COURSE_REPORT_EXPORT_FORMAT_UNSUPPORTED")
    );
  });

  it("derives known limits from provider capabilities instead of a service constant", async () => {
    const service = new CourseReportQueryService(createRepository(), {
      knownLimits: ["SYNTHETIC_ONLY", "LOOPBACK_ONLY"]
    });

    await expect(service.query(tenantId, { course_id: courseId })).resolves.toMatchObject({
      known_limits: ["SYNTHETIC_ONLY", "LOOPBACK_ONLY"]
    });
  });

  it("fails closed when the active provider does not expose capabilities", async () => {
    const service = new CourseReportQueryService(createRepository());

    await expect(service.query(tenantId, { course_id: courseId })).rejects.toEqual(
      new CourseReportQueryServiceError("COURSE_REPORT_PROVIDER_UNSUPPORTED")
    );
  });
});
