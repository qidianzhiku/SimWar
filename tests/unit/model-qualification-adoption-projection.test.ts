import { describe, expect, it } from "vitest";
import { ModelQualificationService } from "../../services/api/src/model-qualification-service";
import { emptyEvidenceAdoptionState } from "../../services/api/src/model-qualification-evidence-adoption";
import {
  EVIDENCE_ADOPTION_SCOPE as scope,
  EVIDENCE_ADOPTION_TEACHER as actor,
  seedApprovedBoundChain
} from "../helpers/model-qualification-evidence-adoption-fixtures";

describe("O5 persisted projection exact scope and integrity", () => {
  it("rejects a foreign embedded adoption state before exposing Teacher or Admin data", () => {
    const source = new ModelQualificationService({ now: () => "2026-09-03T12:00:00.000Z" });
    seedApprovedBoundChain(source, scope, actor);
    const record = source.getRecordForScope(scope)!;
    record.evidence_adoption = emptyEvidenceAdoptionState("tenant_foreign", scope.course_id);
    const service = new ModelQualificationService(
      { now: () => "2026-09-03T12:00:00.000Z" },
      {
        listRecords: () => [record],
        commitRecord: () => {
          throw new Error("read-only test");
        }
      }
    );
    expect(() => service.getEvidenceAdoptionState(actor, scope)).toThrow(
      "EVIDENCE_ADOPTION_SCOPE_MISMATCH"
    );
    expect(() => service.getTeacherProjection(actor, scope)).toThrow(
      "EVIDENCE_ADOPTION_SCOPE_MISMATCH"
    );
    expect(() => service.getAdminProjection({ ...actor, role: "tenant_admin" }, scope)).toThrow(
      "EVIDENCE_ADOPTION_SCOPE_MISMATCH"
    );
  });
  it("does not display a malformed adoption journal as a governed projection", () => {
    const source = new ModelQualificationService({ now: () => "2026-09-03T12:00:00.000Z" });
    seedApprovedBoundChain(source, scope, actor);
    const record = source.getRecordForScope(scope)!;
    record.evidence_adoption = {
      ...emptyEvidenceAdoptionState(scope.tenant_id, scope.course_id),
      commands: [
        {
          command_id: "orphan",
          entity_id: "missing",
          command_fingerprint: "a".repeat(64),
          actor_id: actor.actor_id,
          action: "REQUEST"
        }
      ]
    };
    const service = new ModelQualificationService(
      { now: () => "2026-09-03T12:00:00.000Z" },
      {
        listRecords: () => [record],
        commitRecord: () => {
          throw new Error("read-only test");
        }
      }
    );
    expect(() => service.getEvidenceAdoptionState(actor, scope)).toThrow(
      "EVIDENCE_ADOPTION_STATE_INVALID"
    );
    expect(() => service.getTeacherProjection(actor, scope)).toThrow(
      "EVIDENCE_ADOPTION_STATE_INVALID"
    );
  });
});
