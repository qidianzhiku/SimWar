import { describe, expect, it } from "vitest";
import { parseQualifiedRunAdmission } from "../../services/api/src/routes/validation-environment-launch-routes";
import { createQualifiedRunAdmissionFixture } from "../helpers/model-qualification-run-admission-fixtures";

const source = createQualifiedRunAdmissionFixture().admission;
const legacy = {
  course_id: source.course_id,
  course_package_reference: source.course_package_reference,
  source_package_id: source.source_package_id,
  calibration_dataset_id: source.calibration_dataset_id,
  qualification_id: source.qualification_id,
  model_version_reference: source.model_version_reference,
  model_artifact_reference: source.model_artifact_reference
};
const next = {
  ...legacy,
  adoption: { adoption_id: "adoption-exact", adoption_digest: "a".repeat(64) }
};
describe("O5 admission request version boundary", () => {
  it("retains v1 parsing without synthesizing adoption", () => {
    expect(parseQualifiedRunAdmission(legacy)).toEqual(legacy);
    expect(parseQualifiedRunAdmission(next)).toEqual(next);
  });
  it.each([
    { ...next, fallback: "latest" },
    { ...next, evidence_epoch: {} },
    { ...next, adoption: { ...next.adoption, current: true } },
    { ...next, model_version_reference: { ...next.model_version_reference, latest: true } },
    { ...next, course_package_reference: { ...next.course_package_reference, fallback: "current" } }
  ])("rejects unknown vNext selectors instead of silently dropping them", (input) => {
    expect(() => parseQualifiedRunAdmission(input)).toThrow("W025_INPUT_INVALID");
  });
});
