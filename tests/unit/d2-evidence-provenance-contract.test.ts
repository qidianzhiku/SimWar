import { describe, expect, it } from "vitest";
import {
  isD2CaptureReceipt,
  isD2EvidenceArtifactVersion,
  isD2ExactRef,
  isD2ProvenanceEdge,
  isD2SourceEventDto,
  type D2EvidenceArtifactVersion,
  type D2ExactRef
} from "@simwar/shared-contracts";

const digest = "a".repeat(64);
const otherDigest = "b".repeat(64);

function ref(resource_type: D2ExactRef["resource_type"], resource_id: string): D2ExactRef {
  return {
    content_digest: digest,
    discriminator: "exact_ref",
    resource_id,
    resource_type,
    tenant_id: "tenant_d2",
    version: "1.0.0"
  };
}

function artifact(): D2EvidenceArtifactVersion {
  const artifactRef = ref("evidence_artifact", "artifact_001");
  return {
    artifact_digest: artifactRef.content_digest,
    artifact_kind: "observation",
    artifact_ref: artifactRef,
    captured_at: "2026-08-03T00:00:00.000Z",
    captured_by: "usr_teacher",
    course_package_ref: ref("course_package_version", "package_001"),
    discriminator: "d2_evidence_artifact_version",
    idempotency_key: "capture-key-001",
    known_limits: ["D2 evidence is not learning confirmation or final grading."],
    learning_goal_ref: ref("learning_goal_version", "goal_001"),
    rubric_ref: ref("rubric_version", "rubric_001"),
    schema_version: "evidence-provenance.v1",
    source_event_ref: ref("role_workflow_event", "event_001"),
    transformation_rule_ref: ref("transformation_rule", "d2-role-event-to-evidence-v1"),
    visibility: "teacher_only",
    context: {
      activity_id: "activity_001",
      course_id: "course_001",
      role_key: "CMO",
      run_id: "run_001",
      team_id: "team_001"
    }
  };
}

describe("D2 evidence and provenance contracts", () => {
  it("accepts the closed immutable artifact shape", () => {
    expect(isD2ExactRef(artifact().artifact_ref)).toBe(true);
    expect(isD2EvidenceArtifactVersion(artifact())).toBe(true);
  });

  it("rejects malformed refs, wildcard refs, and unexpected fields", () => {
    expect(isD2ExactRef({ ...ref("evidence_artifact", "latest") })).toBe(false);
    expect(isD2ExactRef({ ...ref("evidence_artifact", "artifact_001"), version: "*" })).toBe(false);
    expect(isD2ExactRef({ ...ref("evidence_artifact", "artifact_001"), extra: true })).toBe(false);
  });

  it("rejects cross-tenant artifacts and missing provenance metadata", () => {
    const candidate = artifact();
    expect(
      isD2EvidenceArtifactVersion({
        ...candidate,
        rubric_ref: { ...candidate.rubric_ref, tenant_id: "tenant_other" }
      })
    ).toBe(false);
    expect(isD2EvidenceArtifactVersion({ ...candidate, known_limits: [] })).toBe(false);
    expect(isD2EvidenceArtifactVersion({ ...candidate, private_payload: { secret: true } })).toBe(false);
  });

  it("accepts only an eligible teacher-safe source event projection", () => {
    expect(
      isD2SourceEventDto({
        created_at: "2026-08-03T00:00:00.000Z",
        event_id: "event_001",
        event_type: "section_ready",
        eligibility: "eligible",
        source_event_ref: ref("role_workflow_event", "event_001"),
        scope: {
          course_id: "course_001",
          role_key: "CMO",
          run_id: "run_001",
          team_id: "team_001"
        }
      })
    ).toBe(true);
  });

  it("requires A5-compatible provenance direction and tenant equality", () => {
    const candidate = artifact();
    const edge = {
      discriminator: "d2_provenance_edge" as const,
      relation: "derived_from" as const,
      source_ref: candidate.artifact_ref,
      target_ref: candidate.source_event_ref
    };
    expect(isD2ProvenanceEdge(edge)).toBe(true);
    expect(isD2ProvenanceEdge({ ...edge, target_ref: { ...edge.target_ref, tenant_id: "other" } })).toBe(false);
    expect(isD2ProvenanceEdge({ ...edge, source_ref: edge.source_ref, target_ref: edge.source_ref })).toBe(false);
  });

  it("keeps the capture receipt closed and truth-neutral", () => {
    const candidate = artifact();
    expect(
      isD2CaptureReceipt({
        data: {
          artifact: candidate,
          provenance_edges: [],
          status: "generated"
        },
        formal_truth_write: false,
        known_limits: candidate.known_limits,
        request_id: "req_001",
        schema_version: "evidence-provenance.v1"
      })
    ).toBe(true);
  });
});
