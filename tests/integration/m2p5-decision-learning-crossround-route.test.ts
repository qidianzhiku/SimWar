import { describe, expect, it } from "vitest";
import {
  handleM2P5DecisionLearningRoute,
  isM2P5DecisionLearningRoute
} from "../../services/api/src/routes/m2p5-decision-learning-crossround-routes";
import type {
  M2P5DecisionLearningActor,
  M2P5DecisionLearningCrossRoundService
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
});
