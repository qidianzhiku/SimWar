import { describe, expect, it } from "vitest";
import type { W5ServiceActor } from "../../services/api/src/w5-governed-model-service";
import {
  W5GovernedModelService
} from "../../services/api/src/w5-governed-model-service";
import {
  createEvidenceAdoptionClock,
  createEvidenceAdoptionServiceFixture,
  seedApprovedBoundChain
} from "../helpers/model-qualification-evidence-adoption-fixtures";
import type { ModelQualificationActor } from "../../services/api/src/model-qualification-service";
import { ModelQualificationService } from "../../services/api/src/model-qualification-service";

const actor: ModelQualificationActor = {
  actor_id: "teacher_demo",
  role: "teacher",
  tenant_id: "tenant_demo"
};

const w5Actor: W5ServiceActor = {
  actor_id: actor.actor_id,
  role: "teacher",
  tenant_id: actor.tenant_id
};

function createW5Draft() {
  const w5 = new W5GovernedModelService();
  const studioScope = { activity_id: "r1_can_service_feasibility", course_id: "course_demo" };
  const created = w5.createDraft(w5Actor, studioScope, { seed: 7 });
  w5.validateDraft(w5Actor, studioScope, created.draft.draft_id);
  w5.freezeDraft(w5Actor, studioScope, created.draft.draft_id);
  const bound = w5.bindDraft(
    w5Actor,
    { ...studioScope, run_id: "run-im-o1", round_no: 1, team_id: "team-im-o1" },
    created.draft.draft_id,
    {
      parameter_set_reference: {
        parameter_set_id: "params-im-o1",
        version: "1.0.0",
        content_digest: "a".repeat(64),
        tenant_id: actor.tenant_id
      },
      round_no: 1,
      run_id: "run-im-o1",
      scenario_package_reference: {
        scenario_package_id: "scenario-im-o1",
        version: "1.0.0",
        content_digest: "b".repeat(64),
        tenant_id: actor.tenant_id
      },
      seed: 7
    }
  );
  return { draft: bound.draft, w5 };
}

describe("IM-O4 exact W5/CAN/REALIZED producer integration", () => {
  it("keeps raw producer classes qualification-scoped until exact typed lineage is proven", () => {
    const base = createEvidenceAdoptionServiceFixture();
    const w5Fixture = createW5Draft();
    const service = new ModelQualificationService(createEvidenceAdoptionClock(), base.persistence, {
      w5Reader: {
        read: (_readerActor, input) => {
          const draft = w5Fixture.w5.getDraft(
            w5Actor,
            {
              activity_id: "r1_can_service_feasibility",
              course_id: input.course_id
            },
            input.w5_draft_id
          );
          const convergence = w5Fixture.w5.evaluate(
            w5Actor,
            {
              activity_id: "r1_can_service_feasibility",
              course_id: input.course_id,
              run_id: input.run_id,
              round_no: input.round_no,
              team_id: input.team_id
            },
            input.w5_draft_id,
            "STANDARD"
          );
          return { draft, convergence };
        }
      }
    });
    const chain = seedApprovedBoundChain(service, base.primary.scope, actor);
    const result = service.getIndustryModelDiagnosticReadiness(actor, chain.scope, {
      run_id: "run-im-o1",
      team_id: "team-im-o1",
      round_id: "round-im-o1",
      round_no: 1,
      scenario_package_id: "scenario-im-o1",
      parameter_set_id: "params-im-o1",
      qualification_id: chain.qualificationA.qualification_id,
      w5_draft_id: w5Fixture.draft.draft_id
    });

    expect(result.provability?.map((entry) => entry.classification)).toEqual([
      "NOT_PROVEN",
      "NOT_PROVEN",
      "NOT_PROVEN",
      "NOT_PROVEN"
    ]);
    expect(result.qualified_producer_admission?.map((entry) => entry.status)).toEqual([
      "QUALIFICATION_NOT_PROVEN",
      "QUALIFICATION_NOT_PROVEN",
      "QUALIFICATION_NOT_PROVEN",
      "QUALIFICATION_NOT_PROVEN"
    ]);
    expect(result.provability?.find((entry) => entry.producer_id === "w5-governed-demand-candidate"))
      .toMatchObject({
        known_limits: expect.arrayContaining(["WANT_NOT_CALIBRATED"]),
        producer_model_version_reference: {
          model_version_id: "o3-governed-demand-v1",
          version: "1.0.0"
        },
        producer_model_artifact_reference: {
          artifact_id: "artifact:o3-governed-demand-v1:1.0.0"
        }
      });
    expect(result.provability?.find((entry) => entry.producer_id === "can-service-feasibility"))
      .toMatchObject({ known_limits: expect.arrayContaining(["CAN_STATUS_UNKNOWN_NOT_FEASIBLE"]) });
    expect(result.provability?.find((entry) => entry.producer_id === "can-service-feasibility"))
      .toMatchObject({
        source: {
          path: "services/simulation-core/src/can-service-feasibility.ts",
          symbol: "evaluateCanServiceFeasibility"
        }
      });
  });

  it("keeps the explicit producer gap when the W5 draft is not exact", () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const result = fixture.service.getIndustryModelDiagnosticReadiness(
      fixture.primary.actor,
      fixture.primary.scope,
      {
        run_id: "run-im-o1",
        team_id: "team-im-o1",
        round_id: "round-im-o1",
        round_no: 1,
        scenario_package_id: "scenario-im-o1",
        parameter_set_id: "params-im-o1",
        qualification_id: fixture.primary.qualificationA.qualification_id,
        w5_draft_id: "w5_draft_missing"
      }
    );

    expect(result.provability?.slice(1).every((entry) => entry.classification === "NOT_PROVEN")).toBe(
      true
    );
    expect(result.known_limits).toContain("W5_EXACT_BOUND_DRAFT_REQUIRED");
  });
});
