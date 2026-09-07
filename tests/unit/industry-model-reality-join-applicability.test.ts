import { describe, expect, it } from "vitest";
import { buildM30CourseFactorySourceEvidence } from "@simwar/sh-next-support";
import {
  resolveIndustryModelRealityJoinApplicability,
  type IndustryModelRealityJoinLineageFacts,
  type IndustryModelRealityJoinApplicabilityInput
} from "../../services/api/src/industry-model-reality-join-applicability";

const context = {
  tenant_id: "tenant_demo",
  course_id: "course_demo",
  run_id: "run_demo",
  team_id: "team_demo",
  round_id: "round_demo",
  scenario_package_id: "scenario_demo",
  parameter_set_id: "parameter_demo",
  qualification_id: "qualification_demo"
} as const;

function lineage(): IndustryModelRealityJoinLineageFacts {
  const sourceEvidence = buildM30CourseFactorySourceEvidence();
  const modelVersion = {
    content_digest: "a".repeat(64),
    model_version_id: "model_demo",
    version: "1.0.0"
  } as const;
  const modelArtifact = {
    artifact_id: "artifact_demo",
    content_digest: "b".repeat(64),
    format: "typescript-boundary",
    source_ref: "services/simulation-core/src/toy-logit-engine.ts"
  } as const;
  const scenario = {
    content_digest: "c".repeat(64),
    scenario_package_id: context.scenario_package_id,
    tenant_id: context.tenant_id,
    version: "1.0.0"
  } as const;
  const parameter = {
    content_digest: "d".repeat(64),
    parameter_set_id: context.parameter_set_id,
    version: "1.0.0"
  } as const;
  const coursePackage = {
    content_digest: "e".repeat(64),
    course_package_id: "course_package_demo",
    tenant_id: context.tenant_id,
    version: "1.0.0"
  } as const;
  const admission = {
    calibration_dataset_id: "dataset_demo",
    course_id: context.course_id,
    course_package_reference: coursePackage,
    model_artifact_reference: modelArtifact,
    model_version_reference: modelVersion,
    parameter_set_reference: parameter,
    qualification_id: context.qualification_id,
    scenario_package_reference: scenario,
    source_package_id: "source_demo",
    tenant_id: context.tenant_id
  } as const;
  const epoch = {
    calibration_dataset_content_digest: "f".repeat(64),
    calibration_dataset_id: admission.calibration_dataset_id,
    course_id: context.course_id,
    epoch_digest: "1".repeat(64),
    model_artifact_reference: modelArtifact,
    model_version_reference: modelVersion,
    qualification_content_digest: "2".repeat(64),
    qualification_id: admission.qualification_id,
    source_content_digest: "3".repeat(64),
    source_expires_at: "2026-12-31T00:00:00.000Z",
    source_package_id: admission.source_package_id,
    tenant_id: context.tenant_id
  } as const;
  return {
    admission_receipt: { ...admission, evidence_epoch: epoch } as never,
    course_package_reference: coursePackage,
    evidence_epoch: epoch,
    run_identity: {
      course_id: context.course_id,
      run_id: context.run_id,
      tenant_id: context.tenant_id
    },
    source_evidence_reference: sourceEvidence,
    source_manifest: {
      course_blueprint_reference: {
        content_digest: "4".repeat(64),
        course_blueprint_id: "blueprint_demo",
        tenant_id: context.tenant_id,
        version: "1.0.0"
      },
      model_artifact_reference: modelArtifact,
      model_version_reference: modelVersion,
      parameter_set_reference: parameter,
      scenario_package_reference: scenario
    }
  };
}

function input(overrides: Partial<IndustryModelRealityJoinApplicabilityInput> = {}) {
  return { exact_context: context, lineage: lineage(), ...overrides };
}

describe("IM-O3 exact support applicability resolver", () => {
  it("returns BOUND only for the exact lineage and keeps upstream limits", () => {
    const result = resolveIndustryModelRealityJoinApplicability(input());
    expect(result.status).toBe("BOUND");
    expect(result.support_evidence.availability).toBe("BOUND");
    expect(result.support_evidence).toMatchObject({
      holdout: { eligibility: "NOT_ELIGIBLE" },
      portability: { external_validity: "NOT_PROVEN" },
      shanghai: { calibration_evidence: "NOT_PROVEN", formal_binding_eligible: false }
    });
    expect(result.writer_effect).toBe("NONE");
    expect(result.official_truth_write).toBe(false);
  });

  it("returns UNAVAILABLE without a provable exact lineage", () => {
    const result = resolveIndustryModelRealityJoinApplicability({
      exact_context: context,
      lineage: undefined
    });
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.support_evidence.availability).toBe("UNAVAILABLE");
  });

  it("fails closed as REBASE_REQUIRED on context or expected-digest movement", () => {
    const moved = resolveIndustryModelRealityJoinApplicability(
      input({ exact_context: { ...context, run_id: "run_other" } })
    );
    expect(moved.status).toBe("REBASE_REQUIRED");
    const bound = resolveIndustryModelRealityJoinApplicability(input());
    const rebased = resolveIndustryModelRealityJoinApplicability(
      input({ expected_applicability_digest: `${bound.applicability_digest.slice(0, 63)}0` })
    );
    expect(rebased.status).toBe("REBASE_REQUIRED");
  });
});
