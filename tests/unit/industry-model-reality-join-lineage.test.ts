import { describe, expect, it } from "vitest";
import {
  buildM30CourseFactorySourceEvidence,
  type CourseFactorySourceEvidenceReference
} from "@simwar/sh-next-support";
import type {
  CourseFactoryMetadata,
  CoursePackageVersion,
  CoursePackageVersionDraftInput,
  QualifiedRunAdmissionSnapshot,
  Run
} from "@simwar/shared-contracts";
import {
  calculateCoursePackageContentDigest,
  createCoursePackageVersionReference
} from "../../services/api/src/course-package-json-registry";
import { createQualifiedRunAdmissionSnapshot } from "../../services/api/src/qualified-run-admission-snapshot";
import { resolveQualifiedRunAdmission } from "../../services/api/src/model-qualification-run-admission";
import {
  adaptIndustryModelRealityJoinLineage,
  type IndustryModelRealityJoinLineageAdapterInput
} from "../../services/api/src/industry-model-reality-join-lineage";
import {
  ADMISSION_FIXTURE_REFERENCES,
  createQualifiedRunAdmissionFixture
} from "../helpers/model-qualification-run-admission-fixtures";

const TENANT_ID = "tenant_demo";
const COURSE_ID = "course_demo";
const RUN_ID = "run_im_o3";
const AS_OF = "2026-09-06T00:00:00.000Z";

function factoryMetadata(
  sourceEvidence: CourseFactorySourceEvidenceReference = buildM30CourseFactorySourceEvidence()
): CourseFactoryMetadata {
  const sourceManifest = {
    course_blueprint_reference: {
      content_digest: "a".repeat(64),
      course_blueprint_id: "blueprint_demo",
      tenant_id: TENANT_ID,
      version: "1.0.0"
    },
    model_artifact_reference: {
      artifact_id: "artifact_demo",
      content_digest: ADMISSION_FIXTURE_REFERENCES.model_artifact.content_digest,
      format: "typescript-boundary",
      source_ref: "services/simulation-core/src/toy-logit-engine.ts"
    },
    model_version_reference: {
      content_digest: ADMISSION_FIXTURE_REFERENCES.model_version.content_digest,
      model_version_id: "model_demo",
      version: "2.0.0"
    },
    parameter_set_reference: {
      content_digest: ADMISSION_FIXTURE_REFERENCES.parameter.content_digest,
      parameter_set_id: "parameter_demo",
      version: "1.0.0"
    },
    scenario_package_reference: {
      content_digest: ADMISSION_FIXTURE_REFERENCES.scenario.content_digest,
      scenario_package_id: "scenario_demo",
      tenant_id: TENANT_ID,
      version: "1.0.0"
    }
  } as const;

  return {
    known_limits: ["M30 remains source-backed candidate evidence."],
    provenance: { kind: "ORIGINAL" },
    rights: {
      allowed_tenant_ids: [TENANT_ID],
      copy_allowed: true,
      export_allowed: true,
      expires_at: "2027-01-01T00:00:00.000Z",
      owner_tenant_id: TENANT_ID
    },
    schema_version: "course-factory.v1",
    source_manifest: sourceManifest,
    source_evidence_reference: sourceEvidence,
    user_data_policy: {
      copied_private_data: false,
      copied_user_decisions: false,
      copied_user_results: false
    }
  };
}

function coursePackageVersion(
  metadata: CourseFactoryMetadata = factoryMetadata()
): CoursePackageVersion {
  const draft: CoursePackageVersionDraftInput = {
    course_blueprint_reference: metadata.source_manifest.course_blueprint_reference,
    course_package_id: "course_factory_demo",
    description: "Exact IM-O3 factory package.",
    factory_metadata: metadata,
    parameter_set_reference: metadata.source_manifest.parameter_set_reference,
    scenario_package_reference: metadata.source_manifest.scenario_package_reference,
    title: "Exact IM-O3 package",
    version: "1.0.0"
  };
  return {
    ...draft,
    content_digest: calculateCoursePackageContentDigest(draft),
    created_at: "2026-09-01T00:00:00.000Z",
    created_by: "teacher_demo",
    schema_version: "course-package-version.v1",
    status: "PUBLISHED",
    tenant_id: TENANT_ID
  };
}

function run(): Run {
  return {
    course_id: COURSE_ID,
    parameter_set_id: "parameter_demo",
    run_id: RUN_ID,
    scenario_package_id: "scenario_demo",
    seed: 42,
    status: "active",
    tenant_id: TENANT_ID
  };
}

function admissionSnapshot(packageVersion: CoursePackageVersion): QualifiedRunAdmissionSnapshot {
  const fixture = createQualifiedRunAdmissionFixture();
  const targetRun = run();
  const packageReference = createCoursePackageVersionReference(packageVersion);
  const receipt = resolveQualifiedRunAdmission({
    ...fixture,
    admission: {
      ...fixture.admission,
      course_package_reference: packageReference
    },
    course_package: packageVersion
  });
  const source = fixture.qualification_record!.source_packages[0]!;
  const dataset = fixture.calibration_dataset!;
  return createQualifiedRunAdmissionSnapshot(targetRun, {
    ...receipt,
    admitted_at: "2026-09-03T12:00:00.000Z",
    adoption: {
      adoption_digest: "f".repeat(64),
      adoption_id: "adoption_im_o3"
    },
    evidence_epoch: {
      calibration_dataset_content_digest: dataset.content_digest,
      calibration_dataset_id: receipt.calibration_dataset_id,
      epoch_digest: "1".repeat(64),
      model_artifact_reference: receipt.model_artifact_reference,
      model_version_reference: receipt.model_version_reference,
      qualification_content_digest: receipt.qualification_content_digest,
      qualification_id: receipt.qualification_id,
      source_content_digest: source.content_digest,
      source_expires_at: source.expires_at,
      source_package_id: receipt.source_package_id,
      course_id: targetRun.course_id,
      tenant_id: targetRun.tenant_id
    },
    schema_version: "qualified-run-admission.v2"
  });
}

function validInput(
  overrides: Partial<IndustryModelRealityJoinLineageAdapterInput> = {}
): IndustryModelRealityJoinLineageAdapterInput {
  const coursePackage = coursePackageVersion();
  return {
    as_of: AS_OF,
    course_package_version: coursePackage,
    qualified_run_admission_snapshot: admissionSnapshot(coursePackage),
    expected_context: { course_id: COURSE_ID, run_id: RUN_ID, tenant_id: TENANT_ID },
    ...overrides
  };
}

describe("IM-O3 exact Reality Join lineage adapter", () => {
  it("emits only exact package, M30, admission, epoch, and run applicability facts", () => {
    const input = validInput();
    const beforePackage = JSON.stringify(input.course_package_version);
    const beforeSnapshot = JSON.stringify(input.qualified_run_admission_snapshot);

    const result = adaptIndustryModelRealityJoinLineage(input);

    expect(result).toEqual({
      admission_receipt: input.qualified_run_admission_snapshot!.admission,
      course_package_reference: createCoursePackageVersionReference(input.course_package_version),
      evidence_epoch: input.qualified_run_admission_snapshot!.admission.evidence_epoch,
      run_identity: {
        course_id: COURSE_ID,
        run_id: RUN_ID,
        tenant_id: TENANT_ID
      },
      source_evidence_reference:
        input.course_package_version.factory_metadata!.source_evidence_reference,
      source_manifest: input.course_package_version.factory_metadata!.source_manifest
    });
    expect(JSON.stringify(input.course_package_version)).toBe(beforePackage);
    expect(JSON.stringify(input.qualified_run_admission_snapshot)).toBe(beforeSnapshot);
  });

  it("returns a detached deeply frozen projection that cannot be mutated through inputs", () => {
    const input = validInput();
    const result = adaptIndustryModelRealityJoinLineage(input);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.course_package_reference)).toBe(true);
    expect(Object.isFrozen(result.source_manifest)).toBe(true);
    expect(Object.isFrozen(result.source_evidence_reference)).toBe(true);
    expect(Object.isFrozen(result.admission_receipt)).toBe(true);
    expect(Object.isFrozen(result.admission_receipt.adoption)).toBe(true);
    expect(Object.isFrozen(result.evidence_epoch)).toBe(true);
    expect(Object.isFrozen(result.run_identity)).toBe(true);

    input.course_package_version.factory_metadata!.source_manifest.parameter_set_reference = {
      ...input.course_package_version.factory_metadata!.source_manifest.parameter_set_reference,
      parameter_set_id: "mutated_after_adaptation"
    };
    input.qualified_run_admission_snapshot!.admission.evidence_epoch.epoch_digest = "2".repeat(64);
    expect(result.source_manifest.parameter_set_reference.parameter_set_id).toBe("parameter_demo");
    expect(result.evidence_epoch.epoch_digest).toBe("1".repeat(64));
  });

  it.each([
    ["missing snapshot", undefined],
    ["null snapshot", null]
  ])("fails closed for %s", (_label, snapshot) => {
    expect(() =>
      adaptIndustryModelRealityJoinLineage(
        validInput({ qualified_run_admission_snapshot: snapshot as never })
      )
    ).toThrow("IM_O3_LINEAGE_SNAPSHOT_REQUIRED");
  });

  it.each([
    "tenant scope",
    "course scope",
    "run identity",
    "package reference",
    "scenario reference",
    "parameter reference",
    "model reference",
    "artifact reference",
    "source identity",
    "dataset identity",
    "qualification identity"
  ])("fails closed for %s drift", (kind) => {
    const input = validInput();
    const snapshot = structuredClone(input.qualified_run_admission_snapshot!);
    const packageVersion = structuredClone(input.course_package_version);
    if (kind === "tenant scope") snapshot.tenant_id = "tenant_other";
    if (kind === "course scope") snapshot.admission.course_id = "course_other";
    if (kind === "run identity") snapshot.run_id = "run_other";
    if (kind === "package reference") {
      snapshot.admission.course_package_reference.content_digest = "2".repeat(64);
    }
    if (kind === "scenario reference") {
      snapshot.admission.scenario_package_reference.scenario_package_id = "scenario_other";
    }
    if (kind === "parameter reference") {
      snapshot.admission.parameter_set_reference.parameter_set_id = "parameter_other";
    }
    if (kind === "model reference") {
      snapshot.admission.model_version_reference.model_version_id = "model_other";
    }
    if (kind === "artifact reference") {
      snapshot.admission.model_artifact_reference.artifact_id = "artifact_other";
    }
    if (kind === "source identity") {
      snapshot.admission.evidence_epoch.source_package_id = "source_other";
    }
    if (kind === "dataset identity") {
      snapshot.admission.evidence_epoch.calibration_dataset_id = "dataset_other";
    }
    if (kind === "qualification identity") {
      snapshot.admission.evidence_epoch.qualification_id = "qualification_other";
    }
    expect(() =>
      adaptIndustryModelRealityJoinLineage({
        as_of: AS_OF,
        course_package_version: packageVersion,
        qualified_run_admission_snapshot: snapshot,
        expected_context: { course_id: COURSE_ID, run_id: RUN_ID, tenant_id: TENANT_ID }
      })
    ).toThrow(/IM_O3_LINEAGE_/u);
  });

  it("fails closed for invalid and stale M30 evidence", () => {
    const invalid = validInput();
    invalid.course_package_version.factory_metadata!.source_evidence_reference = {
      ...invalid.course_package_version.factory_metadata!.source_evidence_reference!,
      evidence_digest: "0".repeat(64)
    };
    expect(() => adaptIndustryModelRealityJoinLineage(invalid)).toThrow(
      "IM_O3_LINEAGE_M30_EVIDENCE_INVALID"
    );

    const stale = validInput({ as_of: "2026-11-30T00:00:00.000Z" });
    expect(() => adaptIndustryModelRealityJoinLineage(stale)).toThrow(
      "IM_O3_LINEAGE_M30_EVIDENCE_STALE"
    );
  });

  it.each(["factory rights expiry", "admission source expiry"])(
    "fails closed for %s even when M30 remains valid",
    (expiryKind) => {
      const input = validInput();
      if (expiryKind === "factory rights expiry") {
        input.course_package_version.factory_metadata!.rights.expires_at =
          "2026-09-05T00:00:00.000Z";
      } else {
        input.qualified_run_admission_snapshot!.admission.evidence_epoch.source_expires_at =
          "2026-09-05T00:00:00.000Z";
      }
      expect(() => adaptIndustryModelRealityJoinLineage(input)).toThrow(
        "IM_O3_LINEAGE_GOVERNING_EXPIRY_STALE"
      );
    }
  );

  it("does not treat ordinary package prose as a floating selector", () => {
    const input = validInput();
    input.course_package_version.title = "Current market model";
    input.course_package_version.content_digest = calculateCoursePackageContentDigest(
      input.course_package_version
    );
    input.qualified_run_admission_snapshot!.admission.course_package_reference =
      createCoursePackageVersionReference(input.course_package_version);

    expect(() => adaptIndustryModelRealityJoinLineage(input)).not.toThrow();
  });

  it("fails closed for cross-scope M30 data and floating selectors", () => {
    const crossScope = validInput();
    crossScope.course_package_version.factory_metadata!.source_manifest.scenario_package_reference =
      {
        ...crossScope.course_package_version.factory_metadata!.source_manifest
          .scenario_package_reference,
        tenant_id: "tenant_other"
      };
    expect(() => adaptIndustryModelRealityJoinLineage(crossScope)).toThrow(
      "IM_O3_LINEAGE_CROSS_SCOPE"
    );

    const floating = validInput();
    floating.course_package_version.factory_metadata!.source_manifest.parameter_set_reference = {
      ...floating.course_package_version.factory_metadata!.source_manifest.parameter_set_reference,
      version: "latest"
    };
    expect(() => adaptIndustryModelRealityJoinLineage(floating)).toThrow(
      "IM_O3_LINEAGE_FLOATING_SELECTOR"
    );
  });
});
