import { describe, expect, it } from "vitest";
import { buildM30CourseFactorySourceEvidence } from "@simwar/sh-next-support";
import type {
  CourseFactoryMetadata,
  CoursePackageVersion,
  CoursePackageVersionDraftInput,
  QualifiedRunAdmissionSnapshot,
  Run
} from "@simwar/shared-contracts";
import { stableDigest } from "../../packages/sh-next-support/src/index";
import { composeIndustryModelRealityJoinSupport } from "../../services/api/src/industry-model-reality-join-evidence";
import {
  calculateCoursePackageContentDigest,
  createCoursePackageVersionReference
} from "../../services/api/src/course-package-json-registry";
import { resolveQualifiedRunAdmission } from "../../services/api/src/model-qualification-run-admission";
import { createQualifiedRunAdmissionSnapshot } from "../../services/api/src/qualified-run-admission-snapshot";
import { createQualifiedRunAdmissionFixture } from "../helpers/model-qualification-run-admission-fixtures";

const exactRequestContext = {
  tenant_id: "tenant_demo",
  course_id: "course_demo",
  run_id: "run-im-o2",
  team_id: "team-im-o2",
  round_id: "round-im-o2",
  scenario_package_id: "scenario-im-o2",
  parameter_set_id: "parameter-im-o2",
  qualification_id: "qualification-im-o2"
} as const;

describe("IM-O2 evidence composition cell", () => {
  it("does not attach global support packs without an exact applicability proof", () => {
    const result = composeIndustryModelRealityJoinSupport(exactRequestContext);
    expect(result.support_evidence.availability).toBe("UNAVAILABLE");
    expect(result.support_evidence.reason).toBe("EXACT_SUPPORT_APPLICABILITY_NOT_PROVEN");
    expect(result.support_evidence).not.toHaveProperty("portability");
    expect(result.support_evidence).not.toHaveProperty("holdout");
    expect(result.support_evidence).not.toHaveProperty("shanghai");
    expect(result.support_evidence_digest).toBe(
      stableDigest({
        support_evidence: result.support_evidence,
        source_refs: result.source_refs,
        upstream_pack_digests: result.upstream_pack_digests
      })
    );
  });

  it("binds the digest to exact request context and upstream pack identities", () => {
    const result = composeIndustryModelRealityJoinSupport(exactRequestContext);
    const moved = composeIndustryModelRealityJoinSupport({
      ...exactRequestContext,
      scenario_package_id: "different-scenario"
    });
    expect(result.support_evidence.request_context_digest).not.toBe(
      moved.support_evidence.request_context_digest
    );
    expect(result.support_evidence_digest).not.toBe(moved.support_evidence_digest);
    expect(result.upstream_pack_digests.m4).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.upstream_pack_digests.m5).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.upstream_pack_digests.m29).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("is a read-only evidence producer with explicit source lineage", () => {
    const result = composeIndustryModelRealityJoinSupport(exactRequestContext);
    expect(result.writer_effect).toBe("NONE");
    expect(result.official_truth_write).toBe(false);
    expect(result.source_refs).toEqual(
      expect.arrayContaining([
        "packages/sh-next-support/src/m4-portability.ts",
        "packages/sh-next-support/src/m5-reality-qualification.ts",
        "packages/sh-next-support/src/m29-main-pull-consumption.ts"
      ])
    );
  });

  it("proves BOUND only when the CourseFactory package and qualified admission share exact lineage", () => {
    const fixture = createQualifiedRunAdmissionFixture();
    const sourceEvidence = buildM30CourseFactorySourceEvidence();
    const metadata: CourseFactoryMetadata = {
      known_limits: ["M30 remains source-backed candidate evidence."],
      provenance: { kind: "ORIGINAL" },
      rights: {
        allowed_tenant_ids: ["tenant_demo"],
        copy_allowed: true,
        export_allowed: true,
        expires_at: "2027-01-01T00:00:00.000Z",
        owner_tenant_id: "tenant_demo"
      },
      schema_version: "course-factory.v1",
      source_manifest: {
        course_blueprint_reference: fixture.course_package!.course_blueprint_reference,
        model_artifact_reference: fixture.model!.artifact,
        model_version_reference: fixture.model!.model_version_reference,
        parameter_set_reference: fixture.parameter_set!.reference,
        scenario_package_reference: fixture.scenario_package!.reference
      },
      source_evidence_reference: sourceEvidence,
      user_data_policy: {
        copied_private_data: false,
        copied_user_decisions: false,
        copied_user_results: false
      }
    };
    const draft: CoursePackageVersionDraftInput = {
      course_blueprint_reference: metadata.source_manifest.course_blueprint_reference,
      course_package_id: "course_package_im_o3",
      description: "Exact IM-O3 package",
      factory_metadata: metadata,
      parameter_set_reference: fixture.parameter_set!.reference,
      scenario_package_reference: fixture.scenario_package!.reference,
      title: "IM-O3 package",
      version: "1.0.0"
    };
    const coursePackage: CoursePackageVersion = {
      ...draft,
      content_digest: calculateCoursePackageContentDigest(draft),
      created_at: "2026-09-01T00:00:00.000Z",
      created_by: "teacher_demo",
      schema_version: "course-package-version.v1",
      status: "PUBLISHED",
      tenant_id: "tenant_demo"
    };
    const run: Run = {
      course_id: "course_demo",
      parameter_set_id: "parameter_demo",
      run_id: "run-im-o3",
      scenario_package_id: "scenario_demo",
      seed: 42,
      status: "active",
      tenant_id: "tenant_demo"
    };
    const receipt = resolveQualifiedRunAdmission({
      ...fixture,
      admission: {
        ...fixture.admission,
        course_package_reference: createCoursePackageVersionReference(coursePackage)
      },
      course_package: coursePackage
    });
    const source = fixture.qualification_record!.source_packages[0]!;
    const dataset = fixture.calibration_dataset!;
    const admission: QualifiedRunAdmissionSnapshot = createQualifiedRunAdmissionSnapshot(run, {
      ...receipt,
      admitted_at: "2026-09-03T12:00:00.000Z",
      adoption: { adoption_id: "adoption-im-o3", adoption_digest: "f".repeat(64) },
      evidence_epoch: {
        calibration_dataset_content_digest: dataset.content_digest,
        calibration_dataset_id: receipt.calibration_dataset_id,
        course_id: run.course_id,
        epoch_digest: "1".repeat(64),
        model_artifact_reference: receipt.model_artifact_reference,
        model_version_reference: receipt.model_version_reference,
        qualification_content_digest: receipt.qualification_content_digest,
        qualification_id: receipt.qualification_id,
        source_content_digest: source.content_digest,
        source_expires_at: source.expires_at,
        source_package_id: receipt.source_package_id,
        tenant_id: run.tenant_id
      },
      schema_version: "qualified-run-admission.v2"
    });
    const result = composeIndustryModelRealityJoinSupport({
      ...exactRequestContext,
      run_id: run.run_id,
      scenario_package_id: run.scenario_package_id,
      parameter_set_id: run.parameter_set_id,
      qualification_id: receipt.qualification_id,
      course_package_version: coursePackage,
      qualified_run_admission_snapshot: admission
    });
    expect(result.support_evidence.availability).toBe("BOUND");
    expect(result.support_evidence).toMatchObject({
      portability: { external_validity: "NOT_PROVEN" },
      holdout: { eligibility: "NOT_ELIGIBLE" },
      shanghai: { formal_binding_eligible: false }
    });
  });
});
