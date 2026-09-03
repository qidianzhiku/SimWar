import { describe, expect, it } from "vitest";
import { ModelQualificationService } from "../../services/api/src/model-qualification-service";
import { deriveEvidenceAdoptionEpoch } from "../../services/api/src/model-qualification-adopted-run-admission";
import {
  EVIDENCE_ADOPTION_SCOPE as scope,
  EVIDENCE_ADOPTION_TEACHER as actor,
  seedApprovedBoundChain
} from "../helpers/model-qualification-evidence-adoption-fixtures";

describe("immutable retained O5 epoch versus current admission catalog", () => {
  it("resolves historical evidence after the model leaves the current catalog, without future fallback", () => {
    const service = new ModelQualificationService({ now: () => "2026-09-03T12:00:00.000Z" });
    const chain = seedApprovedBoundChain(service, scope, actor);
    const record = service.getRecordForScope(scope)!;
    const original = deriveEvidenceAdoptionEpoch(
      record,
      chain.qualificationA.qualification_id,
      service.modelCatalog,
      "2026-09-03T12:00:00.000Z"
    );
    expect(
      deriveEvidenceAdoptionEpoch(
        record,
        chain.qualificationA.qualification_id,
        [],
        "2031-01-01T00:00:00.000Z",
        true
      )
    ).toEqual(original);
    expect(() =>
      deriveEvidenceAdoptionEpoch(
        record,
        chain.qualificationA.qualification_id,
        [],
        "2026-09-03T12:00:00.000Z"
      )
    ).toThrow("EVIDENCE_ADOPTION_EXACT_SOURCE_REQUIRED");
    const missingHistory = {
      ...record,
      source_packages: record.source_packages.filter(
        (source) => source.source_package_id !== chain.sourceA.source_package_id
      )
    };
    expect(() =>
      deriveEvidenceAdoptionEpoch(
        missingHistory,
        chain.qualificationA.qualification_id,
        [],
        "2031-01-01T00:00:00.000Z",
        true
      )
    ).toThrow("EVIDENCE_ADOPTION_EXACT_SOURCE_REQUIRED");
  });
});
