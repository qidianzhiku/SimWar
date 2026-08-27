import { describe, expect, it } from "vitest";
import {
  handleM2P5DecisionLearningRoute,
  isM2P5DecisionLearningRoute
} from "../../services/api/src/routes/m2p5-decision-learning-crossround-routes";
import {
  M2P5DecisionLearningCrossRoundService,
  type M2P5DecisionLearningDependencies,
  M2P5DecisionLearningActor
} from "../../services/api/src/m2p5-decision-learning-crossround";

const actor: M2P5DecisionLearningActor = {
  roles: ["teacher"],
  tenant_id: "tenant_demo",
  user_id: "usr_teacher"
};

const query =
  "activity_id=activity_consequence&course_id=course_demo&role_key=CEO&round_id=round_m2p5_1" +
  "&round_no=1&run_id=run_m2p5&team_id=team_alpha";

describe("M2-P5 decision learning BFF route", () => {
  it("requires the exact round query to match the path", async () => {
    const url = new URL(
      "http://localhost/api/v1/bff/teacher/m2p5/runs/run_m2p5/rounds/1/decision-learning?" +
        query.replace("round_id=round_m2p5_1", "round_id=round_m2p5_2")
    );
    expect(isM2P5DecisionLearningRoute("GET", url)).toBe(true);
    let status = 0;
    let called = false;
    const result = await handleM2P5DecisionLearningRoute(
      {} as M2P5DecisionLearningCrossRoundService,
      { method: "GET" } as never,
      { method: "GET" } as never,
      url,
      { requestId: "request_m2p5", tenantId: "tenant_demo" },
      {
        createEnvelope: (_context, payload) => payload,
        requireStudent: () => actor,
        requireTeacher: () => actor,
        sendJson: (_response, nextStatus) => {
          status = nextStatus;
          called = true;
        }
      }
    );
    expect(result).toBe(true);
    expect(called).toBe(true);
    expect(status).toBe(422);
  });

  it("passes an exact context to the composition service", async () => {
    const url = new URL(
      "http://localhost/api/v1/bff/teacher/m2p5/runs/run_m2p5/rounds/1/decision-learning?" + query
    );
    let received: unknown;
    const service = {
      getJourney: async (input: unknown) => {
        received = input;
        return { schema_version: "m2p5-decision-learning-crossround.v1" };
      }
    } as unknown as M2P5DecisionLearningCrossRoundService;
    await handleM2P5DecisionLearningRoute(
      service,
      { method: "GET" } as never,
      {} as never,
      url,
      { requestId: "request_m2p5", tenantId: "tenant_demo" },
      {
        createEnvelope: (_context, payload) => payload,
        requireStudent: () => actor,
        requireTeacher: () => actor,
        sendJson: (_response, status, payload) => {
          expect(status).toBe(200);
          expect(payload).toMatchObject({
            schema_version: "m2p5-decision-learning-crossround.v1"
          });
        }
      }
    );
    expect(received).toMatchObject({
      surface: "teacher",
      context: {
        course_id: "course_demo",
        round_id: "round_m2p5_1",
        round_no: 1,
        run_id: "run_m2p5",
        team_id: "team_alpha",
        tenant_id: "tenant_demo"
      }
    });
  });

  it("emits the derived learning loop through the existing real composition route", async () => {
    const exactContext = {
      activity_id: "activity_consequence",
      course_id: "course_demo",
      role_key: "CEO",
      round_id: "round_m2p5_1",
      round_no: 1,
      run_id: "run_m2p5",
      team_id: "team_alpha",
      tenant_id: "tenant_demo"
    } as const;
    const exactRef = (
      resourceType: "canonical_decision" | "round" | "settlement_result",
      resourceId: string,
      digest: string
    ) => ({
      content_digest: digest.repeat(64),
      discriminator: "exact_ref" as const,
      resource_id: resourceId,
      resource_type: resourceType,
      tenant_id: exactContext.tenant_id,
      version: "1.0.0"
    });
    const dependencies: M2P5DecisionLearningDependencies = {
      getExactRound: async () => ({
        round_id: exactContext.round_id,
        round_no: exactContext.round_no,
        run_id: exactContext.run_id,
        status: "published",
        tenant_id: exactContext.tenant_id
      }),
      getNextRound: async () => null,
      getOfficialConsequence: async () =>
        ({
          known_limits: [],
          runtime_authority: "JSON_INTERNAL_ONLY",
          visibility: "teacher_safe",
          record: {
            context: exactContext,
            counterfactual: undefined,
            known_limits: [],
            learning: {
              evidence_selection_status: "NOT_SELECTED",
              next_round_hypothesis_status: "BLOCKED",
              teacher_confirmation_status: "MISSING"
            },
            publication: { status: "PUBLISHED" },
            reflection: undefined,
            record_id: "w3_route_m2p5",
            source: {
              canonical_decision_ref: exactRef("canonical_decision", "decision_m2p5", "a"),
              round_ref: exactRef("round", exactContext.round_id, "b"),
              settlement_ref: exactRef("settlement_result", "settlement_m2p5", "c")
            }
          }
        }) as never,
      getLearningReport: async () => undefined,
      getProjectContext: async () => ({ status: "RESOLVED" }),
      getTeachingClosure: async () =>
        ({
          queue_item: { confirmation_status: "MISSING" },
          student_safe_preview: { status: "UNAVAILABLE" }
        }) as never,
      getW4Projection: async () => ({ opening_state_ref: null, closing_state_ref: null }),
      validateNextRoundOpening: async () => {
        throw new Error("not called without a next round and closing state");
      }
    };
    const service = new M2P5DecisionLearningCrossRoundService(dependencies);
    const url = new URL(
      "http://localhost/api/v1/bff/teacher/m2p5/runs/run_m2p5/rounds/1/decision-learning?" + query
    );
    let payload: unknown;

    await handleM2P5DecisionLearningRoute(
      service,
      { method: "GET" } as never,
      {} as never,
      url,
      { requestId: "request_m2p5", tenantId: "tenant_demo" },
      {
        createEnvelope: (_context, value) => value,
        requireStudent: () => actor,
        requireTeacher: () => actor,
        sendJson: (_response, status, value) => {
          expect(status).toBe(200);
          payload = value;
        }
      }
    );

    expect(payload).toMatchObject({
      schema_version: "m2p5-decision-learning-crossround.v1",
      learning_loop: {
        schema_version: "m2p6-teacher-debrief-learning-transfer.v1",
        exact_context: exactContext,
        status: "BLOCKED",
        recovery_state: "EXACT_CONTEXT_RESTORED"
      }
    });
  });
});
