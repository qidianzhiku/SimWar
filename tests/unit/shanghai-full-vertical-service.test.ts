import { describe, expect, it } from "vitest";
import { W5GovernedModelService } from "../../services/api/src/w5-governed-model-service";
import {
  ShanghaiFullVerticalError,
  ShanghaiFullVerticalService,
  type ShanghaiFullVerticalReadContext
} from "../../services/api/src/shanghai-full-vertical-service";
import type {
  ParameterSetReference,
  ScenarioPackageReference
} from "../../packages/shared-contracts/src";

const parameterSetReference: ParameterSetReference = {
  content_digest: "a".repeat(64),
  parameter_set_id: "parameter_r7a_shanghai_eldercare_v2",
  version: "r7a.shanghai.eldercare.parameters.v2"
};
const scenarioPackageReference: ScenarioPackageReference = {
  content_digest: "b".repeat(64),
  scenario_package_id: "r7a-shanghai-eldercare-core-scenario-v2",
  tenant_id: "tenant_demo",
  version: "2.0.0"
};

function actor(role: "teacher" | "learner" | "tenant_admin") {
  return { actor_id: `usr_${role}`, role, tenant_id: "tenant_demo" } as const;
}

function createBoundService(): { service: ShanghaiFullVerticalService; draftId: string } {
  const w5 = new W5GovernedModelService({ now: () => "2026-08-28T03:30:00.000Z" });
  const scope = { activity_id: "w5-governed-model-studio", course_id: "course_demo" };
  const draft = w5.createDraft(actor("teacher"), scope, { title: "Shanghai O1" }).draft;
  w5.validateDraft(actor("teacher"), scope, draft.draft_id);
  w5.freezeDraft(actor("teacher"), scope, draft.draft_id);
  w5.bindDraft(actor("teacher"), { ...scope, run_id: "run_demo", round_no: 1 }, draft.draft_id, {
    parameter_set_reference: parameterSetReference,
    round_no: 1,
    run_id: "run_demo",
    scenario_package_reference: scenarioPackageReference,
    seed: 42
  });
  return { draftId: draft.draft_id, service: new ShanghaiFullVerticalService(w5) };
}

function exactContext(draftId: string, teamId?: string): ShanghaiFullVerticalReadContext {
  return {
    course_id: "course_demo",
    current_parameter_set_reference: parameterSetReference,
    current_scenario_package_reference: scenarioPackageReference,
    draft_id: draftId,
    round_no: 1,
    run_id: "run_demo",
    ...(teamId ? { team_id: teamId } : {})
  };
}

describe("ShanghaiFullVerticalService", () => {
  it("keeps teacher catalog state explicit before an exact draft is selected", () => {
    const { service } = createBoundService();
    const result = service.getTeacher(actor("teacher"), {
      course_id: "course_demo",
      current_parameter_set_reference: null,
      current_scenario_package_reference: null,
      draft_id: null,
      round_no: null,
      run_id: null
    });

    expect(result.status).toBe("NOT_READY");
    expect(result.binding).toBeNull();
    expect(result.preview).toBeNull();
    expect(result.journey).toEqual({
      admin_audit: "BLOCKED",
      exact_binding: false,
      student_projection: "BLOCKED",
      teacher_preview: "BLOCKED"
    });
  });

  it("builds a deterministic teacher preview only for the exact current binding", () => {
    const { service, draftId } = createBoundService();
    const result = service.getTeacher(actor("teacher"), exactContext(draftId));

    expect(result.status).toBe("READY_WITH_LIMITS");
    expect(result.binding).toMatchObject({
      course_id: "course_demo",
      model_version_ref: "eldercare_w5_governed_v1@1.1.0",
      round_no: 1,
      run_id: "run_demo",
      status: "BOUND"
    });
    expect(result.preview?.demand_realization.candidate.model_family).toBe(
      "IDEAL_POINT_LANCASTER_HUFF_SPATIAL"
    );
    expect(result.preview?.realized.authority).toBe("SIMULATION_CORE");
  });

  it("fails closed when the current scenario or parameter reference differs", () => {
    const { service, draftId } = createBoundService();
    expect(() =>
      service.getTeacher(actor("teacher"), {
        ...exactContext(draftId),
        current_parameter_set_reference: {
          ...parameterSetReference,
          version: "different"
        }
      })
    ).toThrow(new ShanghaiFullVerticalError("SHANGHAI_FULL_VERTICAL_EXACT_BINDING_REQUIRED"));
  });

  it("returns a team-scoped Student projection without private binding data", () => {
    const { service, draftId } = createBoundService();
    const result = service.getStudent(actor("learner"), exactContext(draftId, "team_alpha"));

    expect(result.surface).toBe("STUDENT");
    expect(result.projection.visibility).toBe("ROLE_SAFE_STUDENT");
    expect(result.context).toEqual({
      course_id: "course_demo",
      draft_id: draftId,
      model_version_ref: "eldercare_w5_governed_v1@1.1.0",
      round_no: 1,
      run_id: "run_demo"
    });
    expect(JSON.stringify(result)).not.toContain("parameter_values");
    expect(JSON.stringify(result)).not.toContain("content_digest");
    expect(result.projection.security.team).toBe("team_alpha");
  });

  it("returns tenant-safe Admin provenance and keeps official truth ownership visible", () => {
    const { service, draftId } = createBoundService();
    const result = service.getAdmin(actor("tenant_admin"), exactContext(draftId));

    expect(result.binding.scenario_package_reference.scenario_package_id).toBe(
      scenarioPackageReference.scenario_package_id
    );
    expect(result.admin_projection.authority).toEqual({
      ai_provider: "OFF",
      formal_truth_writer: "SIMULATION_CORE",
      repository_provider: "JSON_INTERNAL_ONLY",
      writes_formal_truth: false
    });
    expect(result.preview.realized.authority).toBe("SIMULATION_CORE");
    expect(result.journey).toEqual({
      admin_audit: "READY",
      exact_binding: true,
      student_projection: "READY",
      teacher_preview: "READY"
    });
  });
});
