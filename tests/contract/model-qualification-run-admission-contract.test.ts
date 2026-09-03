import { describe, expect, it } from "vitest";
import { resolveQualifiedRunAdmission } from "../../services/api/src/model-qualification-run-admission";
import { createQualifiedRunAdmissionFixture } from "../helpers/model-qualification-run-admission-fixtures";

describe("qualified Run admission contract", () => {
  it("requires the exact six-resource chain and preserves advisory authority boundaries", () => {
    const result = resolveQualifiedRunAdmission(createQualifiedRunAdmissionFixture());

    expect(Object.keys(result).sort()).toEqual([
      "calibration_dataset_id",
      "course_id",
      "course_package_reference",
      "model_artifact_reference",
      "model_version_reference",
      "official_truth_write",
      "parameter_set_reference",
      "provider",
      "qualification_content_digest",
      "qualification_id",
      "scenario_package_reference",
      "source_package_id",
      "status",
      "tenant_id",
      "writer_effect"
    ]);
    expect(result).toMatchObject({
      status: "ADMITTED",
      official_truth_write: false,
      provider: "OFF",
      writer_effect: "NONE"
    });
  });

  it.each([
    "qualification_record",
    "course_package",
    "scenario_package",
    "parameter_set",
    "model",
    "calibration_dataset"
  ])("fails closed when %s is absent", (field) => {
    const fixture = createQualifiedRunAdmissionFixture();
    (fixture as unknown as Record<string, unknown>)[field] = null;
    expect(() => resolveQualifiedRunAdmission(fixture)).toThrow();
  });
});
