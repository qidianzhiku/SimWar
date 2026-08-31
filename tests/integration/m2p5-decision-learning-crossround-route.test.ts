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
import { createStudentDecisionContextEvidence } from "../../packages/shared-contracts/src/student-decision-context-evidence";

const actor: M2P5DecisionLearningActor = {
  roles: ["teacher"],
  team_id: "team_alpha",
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

  it("checks student team scope before project evidence admission", async () => {
    const url = new URL(
      "http://localhost/api/v1/bff/student/m2p5/runs/run_m2p5/rounds/1/decision-learning?" +
        query.replace("team_id=team_alpha", "team_id=team_other")
    );
    let status = 0;
    let evidenceAdmissionCalled = false;
    const service = {
      getJourney: async () => {
        throw new Error("student scope must be rejected before composition");
      }
    } as unknown as M2P5DecisionLearningCrossRoundService;

    await handleM2P5DecisionLearningRoute(
      service,
      { method: "GET" } as never,
      {} as never,
      url,
      { requestId: "request_m2p5", tenantId: "tenant_demo" },
      {
        createEnvelope: (_context, value) => value,
        requireStudent: () => ({ ...actor, roles: ["student"] }),
        requireTeacher: () => actor,
        requiresStudentDecisionContextEvidence: async () => {
          evidenceAdmissionCalled = true;
          return true;
        },
        sendJson: (_response, nextStatus) => {
          status = nextStatus;
        }
      }
    );

    expect(status).toBe(403);
    expect(evidenceAdmissionCalled).toBe(false);
  });

  it("requires the exact ready evidence identity and advances the same scope", async () => {
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
    const sourceContext = {
      target_region: "Hangzhou" as const,
      epoch_version: "epoch-b.2026-08-30",
      qualification_status: "LIMITED" as const,
      consumption_status: "LOOKAHEAD_READY" as const,
      exact_binding_required: true as const
    };
    const evidence = createStudentDecisionContextEvidence(exactContext, sourceContext);
    const url = new URL(
      "http://localhost/api/v1/bff/student/m2p5/runs/run_m2p5/rounds/1/decision-learning?" +
        query +
        `&decision_context_evidence_id=${encodeURIComponent(evidence.evidence_id)}`
    );
    let payload: Record<string, unknown> | undefined;
    const service = {
      getJourney: async () => ({
        cross_round: { status: "ENTRY_READY" },
        learning_loop: {
          teacher_debrief_availability: "AVAILABLE",
          transfer_status: "READY",
          next_opening_state_readiness: "ENTRY_READY"
        },
        official_consequence: { record: { publication: { status: "PUBLISHED" } } },
        schema_version: "m2p5-decision-learning-crossround.v1"
      })
    } as unknown as M2P5DecisionLearningCrossRoundService;

    await handleM2P5DecisionLearningRoute(
      service,
      { method: "GET" } as never,
      {} as never,
      url,
      { requestId: "request_m2p5", tenantId: "tenant_demo" },
      {
        createEnvelope: (_context, value) => value,
        requireStudent: () => ({ ...actor, roles: ["student"] }),
        requireTeacher: () => actor,
        requiresStudentDecisionContextEvidence: async ({ context }) => {
          expect(context).toEqual(exactContext);
          return true;
        },
        resolveStudentDecisionContextEvidence: async ({ context }) => {
          expect(context).toEqual(exactContext);
          return evidence;
        },
        sendJson: (_response, status, value) => {
          expect(status).toBe(200);
          payload = value as Record<string, unknown>;
        }
      }
    );

    expect(payload).toMatchObject({
      decision_context_evidence: {
        evidence_id: evidence.evidence_id,
        status: "READY",
        continuity: {
          context: "PROVEN",
          decision: "PROVEN",
          consequence: "PROVEN",
          debrief: "PROVEN",
          regional_transfer: "PROVEN"
        }
      }
    });
  });

  it("fails closed before returning a project-aware learning projection without evidence", async () => {
    const url = new URL(
      "http://localhost/api/v1/bff/student/m2p5/runs/run_m2p5/rounds/1/decision-learning?" + query
    );
    let status = 0;
    const service = {
      getJourney: async () => {
        throw new Error("project-aware admission must run before projection composition");
      }
    } as unknown as M2P5DecisionLearningCrossRoundService;

    await handleM2P5DecisionLearningRoute(
      service,
      { method: "GET" } as never,
      {} as never,
      url,
      { requestId: "request_m2p5", tenantId: "tenant_demo" },
      {
        createEnvelope: (_context, value) => value,
        requireStudent: () => ({ ...actor, roles: ["student"] }),
        requireTeacher: () => actor,
        requiresStudentDecisionContextEvidence: async () => true,
        sendJson: (_response, nextStatus) => {
          status = nextStatus;
        }
      }
    );

    expect(status).toBe(409);
  });

  it("keeps blocked downstream continuity when the journey is not complete", async () => {
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
    const evidence = createStudentDecisionContextEvidence(exactContext, {
      target_region: "Hangzhou",
      epoch_version: "epoch-b.2026-08-30",
      qualification_status: "LIMITED",
      consumption_status: "LOOKAHEAD_READY",
      exact_binding_required: true
    });
    const url = new URL(
      "http://localhost/api/v1/bff/student/m2p5/runs/run_m2p5/rounds/1/decision-learning?" +
        query +
        `&decision_context_evidence_id=${encodeURIComponent(evidence.evidence_id)}`
    );
    let payload: Record<string, unknown> | undefined;
    const service = {
      getJourney: async () => ({
        cross_round: { status: "BLOCKED" },
        learning_loop: {
          teacher_debrief_availability: "BLOCKED",
          transfer_status: "BLOCKED",
          next_opening_state_readiness: "BLOCKED"
        },
        official_consequence: { record: { publication: { status: "PUBLISHED" } } },
        schema_version: "m2p5-decision-learning-crossround.v1"
      })
    } as unknown as M2P5DecisionLearningCrossRoundService;

    await handleM2P5DecisionLearningRoute(
      service,
      { method: "GET" } as never,
      {} as never,
      url,
      { requestId: "request_m2p5", tenantId: "tenant_demo" },
      {
        createEnvelope: (_context, value) => value,
        requireStudent: () => ({ ...actor, roles: ["student"] }),
        requireTeacher: () => actor,
        resolveStudentDecisionContextEvidence: async () => evidence,
        sendJson: (_response, status, value) => {
          expect(status).toBe(200);
          payload = value as Record<string, unknown>;
        }
      }
    );

    expect(payload).toMatchObject({
      decision_context_evidence: {
        continuity: {
          consequence: "PROVEN",
          debrief: "BLOCKED",
          regional_transfer: "BLOCKED"
        }
      }
    });
  });

  it("fails closed when a requested evidence identity cannot be resolved", async () => {
    const evidenceId =
      "sdcx.v1.activity_consequence_course_demo_CEO_round_m2p5_1_1_run_m2p5_team_alpha_tenant_demo";
    const url = new URL(
      "http://localhost/api/v1/bff/student/m2p5/runs/run_m2p5/rounds/1/decision-learning?" +
        query +
        `&decision_context_evidence_id=${evidenceId}`
    );
    let status = 0;
    const service = {
      getJourney: async () => ({ schema_version: "m2p5-decision-learning-crossround.v1" })
    } as unknown as M2P5DecisionLearningCrossRoundService;

    await handleM2P5DecisionLearningRoute(
      service,
      { method: "GET" } as never,
      {} as never,
      url,
      { requestId: "request_m2p5", tenantId: "tenant_demo" },
      {
        createEnvelope: (_context, value) => value,
        requireStudent: () => ({ ...actor, roles: ["student"] }),
        requireTeacher: () => actor,
        sendJson: (_response, nextStatus) => {
          status = nextStatus;
        }
      }
    );

    expect(status).toBe(409);
  });

  it("rejects an old source-bound identity after the package binding changes", async () => {
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
    const sourceContext = {
      target_region: "Hangzhou" as const,
      epoch_version: "epoch-b.2026-08-30",
      qualification_status: "LIMITED" as const,
      consumption_status: "LOOKAHEAD_READY" as const,
      exact_binding_required: true as const
    };
    const oldEvidence = createStudentDecisionContextEvidence(
      exactContext,
      { ...sourceContext, epoch_version: "epoch-b.2026-08-30" },
      "source-package-a"
    );
    const currentEvidence = createStudentDecisionContextEvidence(
      exactContext,
      { ...sourceContext, epoch_version: "epoch-b.2026-09-01" },
      "source-package-b"
    );
    const url = new URL(
      "http://localhost/api/v1/bff/student/m2p5/runs/run_m2p5/rounds/1/decision-learning?" +
        query +
        `&decision_context_evidence_id=${encodeURIComponent(oldEvidence.evidence_id)}`
    );
    let status = 0;
    const service = {
      getJourney: async () => ({ schema_version: "m2p5-decision-learning-crossround.v1" })
    } as unknown as M2P5DecisionLearningCrossRoundService;

    await handleM2P5DecisionLearningRoute(
      service,
      { method: "GET" } as never,
      {} as never,
      url,
      { requestId: "request_m2p5", tenantId: "tenant_demo" },
      {
        createEnvelope: (_context, value) => value,
        requireStudent: () => ({ ...actor, roles: ["student"] }),
        requireTeacher: () => actor,
        resolveStudentDecisionContextEvidence: async () => currentEvidence,
        sendJson: (_response, nextStatus) => {
          status = nextStatus;
        }
      }
    );

    expect(status).toBe(409);
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
