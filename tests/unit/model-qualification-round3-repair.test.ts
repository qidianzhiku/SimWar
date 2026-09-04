import { describe, expect, it } from "vitest";
import type {
  CoursePackageVersionTeacherDto,
  ModelQualificationRunAdmissionSelection
} from "@simwar/shared-contracts";
import {
  buildTeacherQualifiedRunAdmission,
  resolveExactTeacherCoursePackage
} from "../../apps/teacher/src/qualified-run-admission-selection";
import {
  EVIDENCE_ADOPTION_SCOPE,
  EVIDENCE_ADOPTION_TEACHER,
  createEvidenceAdoptionServiceFixture
} from "../helpers/model-qualification-evidence-adoption-fixtures";

describe("O5 Round 3 adoption admission boundary", () => {
  it("builds a complete selector and rejects ambiguous package versions", () => {
    const coursePackage = {
      course_blueprint_reference: {
        content_digest: "1".repeat(64),
        course_blueprint_id: "blueprint-a",
        tenant_id: "tenant_a",
        version: "1.0.0"
      },
      course_package_reference: {
        content_digest: "2".repeat(64),
        course_package_id: "package-a",
        tenant_id: "tenant_a",
        version: "1.0.0"
      },
      description: "fixture",
      parameter_set_reference: {
        content_digest: "3".repeat(64),
        parameter_set_id: "parameter-a",
        tenant_id: "tenant_a",
        version: "1.0.0"
      },
      scenario_package_reference: {
        content_digest: "4".repeat(64),
        scenario_package_id: "scenario-a",
        tenant_id: "tenant_a",
        version: "1.0.0"
      },
      title: "fixture"
    } as CoursePackageVersionTeacherDto;
    const selection = {
      adoption: { adoption_id: "adoption-a", adoption_digest: "5".repeat(64) },
      calibration_dataset_id: "dataset-a",
      model_artifact_reference: {
        artifact_id: "artifact-a",
        content_digest: "6".repeat(64),
        format: "typescript-boundary",
        source_ref: "artifact://model-a"
      },
      model_version_reference: {
        content_digest: "7".repeat(64),
        model_version_id: "model-a",
        version: "1.0.0"
      },
      qualification_id: "qualification-a",
      source_package_id: "source-a"
    } satisfies ModelQualificationRunAdmissionSelection;

    expect(
      resolveExactTeacherCoursePackage([coursePackage], {
        parameter_set_id: "parameter-a",
        scenario_package_id: "scenario-a",
        tenant_id: "tenant_a"
      })
    ).toBe(coursePackage);
    expect(buildTeacherQualifiedRunAdmission("course-a", coursePackage, selection)).toEqual({
      adoption: selection.adoption,
      calibration_dataset_id: "dataset-a",
      course_id: "course-a",
      course_package_reference: coursePackage.course_package_reference,
      model_artifact_reference: selection.model_artifact_reference,
      model_version_reference: selection.model_version_reference,
      qualification_id: "qualification-a",
      source_package_id: "source-a"
    });
    expect(
      resolveExactTeacherCoursePackage(
        [
          coursePackage,
          {
            ...coursePackage,
            course_package_reference: {
              ...coursePackage.course_package_reference,
              version: "2.0.0",
              content_digest: "8".repeat(64)
            }
          }
        ],
        {
          parameter_set_id: "parameter-a",
          scenario_package_id: "scenario-a",
          tenant_id: "tenant_a"
        }
      )
    ).toBeNull();
  });

  it("rejects an adoption mutation while the same course admission section is held", async () => {
    const { primary, service } = createEvidenceAdoptionServiceFixture();
    let release!: () => void;
    let entered!: () => void;
    const enteredPromise = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const releasePromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    const admission = (
      service as unknown as {
        withScopedEvidenceAdmission<T>(
          actor: { tenant_id: string },
          scope: typeof EVIDENCE_ADOPTION_SCOPE,
          operation: (record: unknown, now: () => string) => Promise<T>,
          options?: { allowMissingRecord?: boolean }
        ): Promise<T>;
      }
    ).withScopedEvidenceAdmission(
      { tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id },
      EVIDENCE_ADOPTION_SCOPE,
      async (record) => {
        expect(record).toBeTruthy();
        entered();
        await releasePromise;
        return "admission-complete";
      },
      { allowMissingRecord: true }
    );
    await enteredPromise;
    expect(() =>
      service.requestEvidenceAdoption(EVIDENCE_ADOPTION_TEACHER, EVIDENCE_ADOPTION_SCOPE, {
        command_id: "round3-concurrent-adoption",
        qualification_id: primary.qualificationB.qualification_id,
        expected_adoption: null
      })
    ).toThrow("EVIDENCE_ADOPTION_ADMISSION_IN_PROGRESS");
    release();
    await expect(admission).resolves.toBe("admission-complete");
  });
});
