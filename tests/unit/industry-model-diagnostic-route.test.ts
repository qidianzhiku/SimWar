import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@simwar/shared-contracts";
import { handleModelQualificationRoute } from "../../services/api/src/routes/model-qualification-routes";
import type { RepositoryFacade } from "../../services/api/src/repository-facade";
import {
  EVIDENCE_ADOPTION_SCOPE,
  createEvidenceAdoptionServiceFixture
} from "../helpers/model-qualification-evidence-adoption-fixtures";

const actor = {
  user_id: "teacher_demo",
  tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id,
  roles: ["teacher"],
  permissions: ["course:read"]
} as unknown as CurrentUser;

const studentActor = {
  user_id: "student_demo",
  tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id,
  roles: ["student"],
  permissions: ["course:read"]
} as unknown as CurrentUser;

function exactRepository(): RepositoryFacade {
  return {
    courses: {
      getCourse: async () => ({
        course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
        tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id,
        title: "Exact course",
        scenario_package_id: "scenario-exact",
        parameter_set_id: "parameter-exact"
      }),
      listCoursesForTenant: async () => [],
      listCoursesForUser: async () => [],
      saveCourse: async () => undefined,
      deleteCourse: async () => undefined
    },
    runs: {
      getRun: async () => ({
        run_id: "run-exact",
        tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id,
        course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
        scenario_package_id: "scenario-exact",
        parameter_set_id: "parameter-exact",
        seed: 1,
        status: "draft"
      }),
      getQualifiedRunAdmission: async () => null,
      listRunsForCourse: async () => [],
      saveRun: async () => undefined,
      deleteRun: async () => undefined
    },
    teams: {
      getTeam: async () => ({
        team_id: "team-exact",
        tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id,
        course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
        name: "Exact team",
        captain_user_id: actor.user_id,
        members: []
      }),
      listTeamsForRun: async () => [],
      getTeamForUser: async () => null,
      createTeamWithCaptain: async () => undefined,
      addMemberToTeam: async () => {
        throw new Error("not used");
      }
    },
    rounds: {
      getRound: async () => ({
        round_id: "round-exact",
        tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id,
        run_id: "run-exact",
        round_no: 1,
        status: "draft"
      }),
      listRoundsForRun: async () => [],
      saveRound: async () => undefined,
      deleteRound: async () => undefined,
      markRoundSettled: async () => undefined
    },
    scenarios: {
      getScenarioPackage: async () => ({
        scenario_package_id: "scenario-exact",
        tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id,
        name: "Exact scenario",
        version: "1.0.0",
        status: "approved",
        plugin_package_ids: []
      }),
      listScenarioPackagesForTenant: async () => []
    },
    parameterSets: {
      getParameterSet: async () => ({
        parameter_set_id: "parameter-exact",
        tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id,
        version: "1.0.0",
        status: "approved",
        model_family: "toy_logit",
        seed: 1,
        base_market_size: 1,
        base_capacity: 1,
        unit_cost: 1,
        fixed_cost: 1
      })
    }
  } as unknown as RepositoryFacade;
}

describe("IM-O1 diagnostic readiness route", () => {
  it("requires every exact context reference before serving a role projection", async () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    let responseBody: unknown;
    let responseStatus = 0;
    const dependencies = {
      actorHasAnyRole: () => true,
      createContext: () => ({ requestId: "request-exact", tenantId: actor.tenant_id, actor }),
      createEnvelope: (_context: unknown, data: unknown) => ({
        code: "OK",
        data,
        message: "ok",
        request_id: "request-exact"
      }),
      readJson: async () => ({}),
      repository: exactRepository(),
      requirePermission: () => actor,
      sendJson: (_response: ServerResponse, status: number, body: unknown) => {
        responseStatus = status;
        responseBody = body;
      }
    };
    const qualificationId = fixture.primary.qualificationA.qualification_id;
    const url = new URL(
      `/api/v1/bff/teacher/model-qualification/diagnostic-readiness?courseId=course_demo&runId=run-exact&teamId=team-exact&roundId=round-exact&scenarioPackageId=scenario-exact&parameterSetId=parameter-exact&qualificationId=${qualificationId}`,
      "http://localhost"
    );
    await handleModelQualificationRoute(
      fixture.service,
      { method: "GET" } as IncomingMessage,
      {} as ServerResponse,
      url,
      dependencies
    );
    expect(responseStatus).toBe(200);
    expect(responseBody).toMatchObject({
      data: {
        exact_context: {
          course_id: "course_demo",
          run_id: "run-exact",
          team_id: "team-exact",
          round_id: "round-exact",
          scenario_package_id: "scenario-exact",
          parameter_set_id: "parameter-exact"
        },
        role: "teacher"
      }
    });
  });

  it("rejects a forged scenario reference even when the qualification is valid", async () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const dependencies = {
      actorHasAnyRole: () => true,
      createContext: () => ({ requestId: "request-forged", tenantId: actor.tenant_id, actor }),
      createEnvelope: (_context: unknown, data: unknown) => ({ data }),
      readJson: async () => ({}),
      repository: exactRepository(),
      requirePermission: () => actor,
      sendJson: () => undefined
    };
    const url = new URL(
      `/api/v1/bff/teacher/model-qualification/diagnostic-readiness?courseId=course_demo&runId=run-exact&teamId=team-exact&roundId=round-exact&scenarioPackageId=forged-scenario&parameterSetId=parameter-exact&qualificationId=${fixture.primary.qualificationA.qualification_id}`,
      "http://localhost"
    );
    await expect(
      handleModelQualificationRoute(
        fixture.service,
        { method: "GET" } as IncomingMessage,
        {} as ServerResponse,
        url,
        dependencies
      )
    ).rejects.toThrow("MODEL_QUALIFICATION_SCOPE_CONFLICT");
  });

  it("rejects a student diagnostic for a team other than the enrolled team", async () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const repository = exactRepository();
    repository.courses.listCoursesForUser = async () => [
      {
        course_id: "course_demo",
        tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id
      } as never
    ];
    const dependencies = {
      actorHasAnyRole: () => true,
      createContext: () => ({
        requestId: "request-student",
        tenantId: studentActor.tenant_id,
        actor: studentActor
      }),
      createEnvelope: (_context: unknown, data: unknown) => ({ data }),
      readJson: async () => ({}),
      repository,
      requirePermission: () => studentActor,
      sendJson: () => undefined
    };
    const url = new URL(
      `/api/v1/bff/student/model-qualification/diagnostic-readiness?courseId=course_demo&runId=run-exact&teamId=team-other&roundId=round-exact&scenarioPackageId=scenario-exact&parameterSetId=parameter-exact&qualificationId=${fixture.primary.qualificationA.qualification_id}`,
      "http://localhost"
    );
    await expect(
      handleModelQualificationRoute(
        fixture.service,
        { method: "GET" } as IncomingMessage,
        {} as ServerResponse,
        url,
        dependencies
      )
    ).rejects.toThrow("MODEL_QUALIFICATION_SCOPE_CONFLICT");
  });
});
