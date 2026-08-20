import { describe, expect, it } from "vitest";
import { W5_MODEL_VERSION_REF } from "../../packages/shared-contracts/src";
import {
  W5GovernedModelError,
  W5GovernedModelService,
  type W5ServiceActor
} from "../../services/api/src/w5-governed-model-service";

const actor: W5ServiceActor = {
  actor_id: "usr_teacher",
  role: "teacher",
  tenant_id: "tenant_demo"
};

const scope = {
  activity_id: "w5-governed-model-studio",
  course_id: "course_demo"
};

function service(): W5GovernedModelService {
  return new W5GovernedModelService({ now: () => "2026-08-20T12:30:00.000Z" });
}

describe("W5GovernedModelService", () => {
  it("keeps the teacher lifecycle append-only and requires exact freeze-to-bind transitions", () => {
    const governed = service();
    const created = governed.createDraft(actor, scope, { title: "上海标准/进阶闭环" });
    expect(created.draft.status).toBe("DRAFT");
    expect(created.draft.model_version_ref).toBe(W5_MODEL_VERSION_REF);
    expect(() => governed.bindDraft(actor, scope, created.draft.draft_id, {
      run_id: "run_demo",
      round_no: 1,
      seed: 42,
      parameter_set_reference: {
        content_digest: "a".repeat(64),
        parameter_set_id: "param_toy_approved_1",
        version: "1.0.0"
      },
      scenario_package_reference: {
        content_digest: "b".repeat(64),
        scenario_package_id: "scenario_eldercare_demo",
        tenant_id: "tenant_demo",
        version: "1.0.0"
      }
    })).toThrow(new W5GovernedModelError("W5_DRAFT_NOT_FROZEN"));

    const validated = governed.validateDraft(actor, scope, created.draft.draft_id);
    const frozen = governed.freezeDraft(actor, scope, validated.draft.draft_id);
    const bound = governed.bindDraft(actor, scope, frozen.draft.draft_id, {
      run_id: "run_demo",
      round_no: 1,
      seed: 42,
      parameter_set_reference: {
        content_digest: "a".repeat(64),
        parameter_set_id: "param_toy_approved_1",
        version: "1.0.0"
      },
      scenario_package_reference: {
        content_digest: "b".repeat(64),
        scenario_package_id: "scenario_eldercare_demo",
        tenant_id: "tenant_demo",
        version: "1.0.0"
      }
    });
    expect(bound.draft.status).toBe("BOUND");
    expect(bound.draft.exact_runtime_binding?.no_implicit_latest).toBe(true);
    expect(bound.receipt.writes_formal_truth).toBe(false);
  });

  it("keeps WANT and CAN non-official while REALIZED comes from one core plane", () => {
    const governed = service();
    const draft = governed.createDraft(actor, scope, {}).draft;
    const frozen = governed.freezeDraft(actor, scope, governed.validateDraft(actor, scope, draft.draft_id).draft.draft_id).draft;
    governed.bindDraft(actor, scope, frozen.draft_id, {
      run_id: "run_demo",
      round_no: 1,
      seed: 42,
      parameter_set_reference: {
        content_digest: "a".repeat(64),
        parameter_set_id: "param_toy_approved_1",
        version: "1.0.0"
      },
      scenario_package_reference: {
        content_digest: "b".repeat(64),
        scenario_package_id: "scenario_eldercare_demo",
        tenant_id: "tenant_demo",
        version: "1.0.0"
      }
    });
    const standard = governed.evaluate(actor, { ...scope, run_id: "run_demo", round_no: 1 }, frozen.draft_id, "STANDARD");
    const advanced = governed.evaluate(actor, { ...scope, run_id: "run_demo", round_no: 1 }, frozen.draft_id, "ADVANCED");
    expect(standard.want.official).toBe(false);
    expect(standard.can.official).toBe(false);
    expect(standard.realized.authority).toBe("SIMULATION_CORE");
    expect(standard.realized.official).toBe(true);
    expect(standard.realized.replay_relevant_digest).toBe(advanced.realized.replay_relevant_digest);
    expect(standard.shadow.overwrites_official_result).toBe(false);
    expect(standard.replay.exact_identity).toBe("READY");
  });

  it("uses deterministic plane-off fallback and marks unmapped parameters draft-only", () => {
    const governed = service();
    const created = governed.createDraft(actor, scope, {
      parameters: { custom_parameter: "teacher hypothesis" }
    });
    expect(created.draft.parameter_descriptors.find((item) => item.key === "custom_parameter")?.mapping_readiness).toBe("DRAFT");
    const evaluated = governed.evaluate(actor, scope, created.draft.draft_id, "STANDARD", {
      model_plane: "OFF"
    });
    expect(evaluated.fallback.applied).toBe(true);
    expect(evaluated.fallback.official_path_continues).toBe(true);
    expect(evaluated.realized.authority).toBe("SIMULATION_CORE");
  });

  it("fails closed on a cross-tenant security context", () => {
    const governed = service();
    const created = governed.createDraft(actor, scope, {});
    expect(() => governed.getDraft({ ...actor, tenant_id: "tenant_other" }, { ...scope, course_id: "course_other" }, created.draft.draft_id)).toThrow(
      new W5GovernedModelError("W5_SCOPE_CONFLICT")
    );
  });
});
