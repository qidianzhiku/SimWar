import { describe, expect, it } from "vitest";
import * as sharedContracts from "../../packages/shared-contracts/src";

type Validator = (value: unknown) => boolean;

type A5CompatibilityValidators = {
  isDecisionThreadRef: Validator;
  isDomainEventEnvelope: Validator;
  isEvidenceArtifact: Validator;
  isExactRef: Validator;
  isModeBinding: Validator;
  isProvenanceEdge: Validator;
};

const compatibility = sharedContracts as unknown as A5CompatibilityValidators;

const exactRef = (resourceType: string, resourceId: string) => ({
  content_digest: "a".repeat(64),
  discriminator: "exact_ref",
  resource_id: resourceId,
  resource_type: resourceType,
  tenant_id: "tenant_a5",
  version: "1.0.0"
});

const decisionThread = () => {
  const threadRef = exactRef("decision_thread", "thread_001");

  return {
    aliases: [
      {
        alias: "ceo-round-one",
        discriminator: "decision_thread_alias",
        target_ref: threadRef
      }
    ],
    discriminator: "decision_thread_ref",
    thread_ref: threadRef
  };
};

const evidenceArtifact = () => {
  const artifactRef = exactRef("evidence_artifact", "evidence_001");

  return {
    artifact_kind: "observation",
    artifact_ref: artifactRef,
    captured_at: "2026-08-01T09:00:00.000Z",
    discriminator: "evidence_artifact",
    mode_binding: {
      discriminator: "mode_binding",
      mode: "evidence_only",
      subject_ref: artifactRef
    }
  };
};

const evidenceLinkedEvent = () => {
  const subjectRef = exactRef("course_blueprint", "blueprint_001");
  const artifact = evidenceArtifact();

  return {
    discriminator: "domain_event_envelope",
    event_id: "event_001",
    event_type: "evidence_linked",
    evidence_artifact: artifact,
    mode_binding: {
      discriminator: "mode_binding",
      mode: "reference_only",
      subject_ref: subjectRef
    },
    occurred_at: "2026-08-01T09:01:00.000Z",
    provenance_edge: {
      discriminator: "provenance_edge",
      relation: "supported_by",
      source_ref: subjectRef,
      target_ref: artifact.artifact_ref
    },
    subject_ref: subjectRef
  };
};

const referenceRecordedEvent = () => {
  const subjectRef = exactRef("course_blueprint", "blueprint_001");

  return {
    discriminator: "domain_event_envelope",
    event_id: "event_reference_001",
    event_type: "reference_recorded",
    mode_binding: {
      discriminator: "mode_binding",
      mode: "reference_only",
      subject_ref: subjectRef
    },
    occurred_at: "2026-08-01T09:02:00.000Z",
    provenance_edge: {
      discriminator: "provenance_edge",
      relation: "cites",
      source_ref: subjectRef,
      target_ref: exactRef("instructor_artifact", "guide_001")
    },
    subject_ref: subjectRef
  };
};

const decisionThreadLinkedEvent = () => {
  const subjectRef = exactRef("course_blueprint", "blueprint_001");
  const thread = decisionThread();

  return {
    decision_thread_ref: thread,
    discriminator: "domain_event_envelope",
    event_id: "event_thread_001",
    event_type: "decision_thread_linked",
    mode_binding: {
      discriminator: "mode_binding",
      mode: "reference_only",
      subject_ref: subjectRef
    },
    occurred_at: "2026-08-01T09:03:00.000Z",
    provenance_edge: {
      discriminator: "provenance_edge",
      relation: "derived_from",
      source_ref: subjectRef,
      target_ref: thread.thread_ref
    },
    subject_ref: subjectRef
  };
};

function withoutField(contract: Record<string, unknown>, field: string): Record<string, unknown> {
  const copy = { ...contract };
  delete copy[field];
  return copy;
}

describe("A5 compatibility contracts", () => {
  it("exposes a closed ExactRef validator", () => {
    const contractExports = sharedContracts as Record<string, unknown>;

    expect(contractExports.isExactRef).toEqual(expect.any(Function));
  });

  it("accepts only an immutable exact reference", () => {
    expect(compatibility.isExactRef(exactRef("course_blueprint", "blueprint_001"))).toBe(true);
    expect(
      compatibility.isExactRef({
        ...exactRef("course_blueprint", "blueprint_001"),
        version: "latest"
      })
    ).toBe(false);
    expect(
      compatibility.isExactRef({
        ...exactRef("course_blueprint", "blueprint_001"),
        score: 100
      })
    ).toBe(false);
  });

  it("rejects indirection and fallback tokens in every ExactRef identity and scope field", () => {
    for (const inexactValue of ["latest", "*", "fallback"]) {
      expect(
        compatibility.isExactRef({
          ...exactRef("course_blueprint", "blueprint_001"),
          resource_id: inexactValue
        })
      ).toBe(false);
      expect(
        compatibility.isExactRef({
          ...exactRef("course_blueprint", "blueprint_001"),
          tenant_id: inexactValue
        })
      ).toBe(false);
      expect(
        compatibility.isExactRef({
          ...exactRef("course_blueprint", "blueprint_001"),
          version: inexactValue
        })
      ).toBe(false);
    }
  });

  it("requires every decision-thread alias to trace back to its exact thread reference", () => {
    expect(compatibility.isDecisionThreadRef(decisionThread())).toBe(true);
    expect(
      compatibility.isDecisionThreadRef({
        ...decisionThread(),
        aliases: [
          {
            alias: "ceo-round-one",
            discriminator: "decision_thread_alias",
            target_ref: exactRef("decision_thread", "another_thread")
          }
        ]
      })
    ).toBe(false);
  });

  it("accepts an evidence event only when its mode and provenance links are exact", () => {
    expect(compatibility.isEvidenceArtifact(evidenceArtifact())).toBe(true);
    expect(compatibility.isProvenanceEdge(evidenceLinkedEvent().provenance_edge)).toBe(true);
    expect(compatibility.isDomainEventEnvelope(evidenceLinkedEvent())).toBe(true);
    expect(
      compatibility.isDomainEventEnvelope({
        ...evidenceLinkedEvent(),
        mode_binding: {
          discriminator: "mode_binding",
          mode: "evidence_only",
          subject_ref: exactRef("course_blueprint", "different_blueprint")
        }
      })
    ).toBe(false);
  });

  it("rejects unknown discriminators and unexpected properties for every closed object", () => {
    const contracts: Array<[Validator, Record<string, unknown>]> = [
      [compatibility.isExactRef, exactRef("course_blueprint", "blueprint_001")],
      [
        compatibility.isModeBinding,
        {
          discriminator: "mode_binding",
          mode: "reference_only",
          subject_ref: exactRef("course_blueprint", "blueprint_001")
        }
      ],
      [compatibility.isEvidenceArtifact, evidenceArtifact()],
      [compatibility.isProvenanceEdge, evidenceLinkedEvent().provenance_edge],
      [compatibility.isDomainEventEnvelope, evidenceLinkedEvent()],
      [compatibility.isDecisionThreadRef, decisionThread()]
    ];

    for (const [validator, contract] of contracts) {
      expect(validator({ ...contract, unexpected: true })).toBe(false);
      expect(validator({ ...contract, discriminator: "unknown" })).toBe(false);
    }
  });

  it("rejects missing and malformed fields for every public compatibility object", () => {
    const contracts: Array<{
      malformed: Record<string, unknown>;
      missing_field: string;
      valid: Record<string, unknown>;
      validator: Validator;
    }> = [
      {
        malformed: {
          ...exactRef("course_blueprint", "blueprint_001"),
          resource_id: "fallback"
        },
        missing_field: "resource_id",
        valid: exactRef("course_blueprint", "blueprint_001"),
        validator: compatibility.isExactRef
      },
      {
        malformed: {
          discriminator: "mode_binding",
          mode: "runtime",
          subject_ref: exactRef("course_blueprint", "blueprint_001")
        },
        missing_field: "subject_ref",
        valid: {
          discriminator: "mode_binding",
          mode: "reference_only",
          subject_ref: exactRef("course_blueprint", "blueprint_001")
        },
        validator: compatibility.isModeBinding
      },
      {
        malformed: {
          ...evidenceArtifact(),
          captured_at: "not-a-timestamp"
        },
        missing_field: "artifact_ref",
        valid: evidenceArtifact(),
        validator: compatibility.isEvidenceArtifact
      },
      {
        malformed: {
          ...evidenceLinkedEvent().provenance_edge,
          relation: "resolves_to"
        },
        missing_field: "source_ref",
        valid: evidenceLinkedEvent().provenance_edge,
        validator: compatibility.isProvenanceEdge
      },
      {
        malformed: {
          ...decisionThread(),
          aliases: []
        },
        missing_field: "aliases",
        valid: decisionThread(),
        validator: compatibility.isDecisionThreadRef
      },
      {
        malformed: {
          ...referenceRecordedEvent(),
          occurred_at: "not-a-timestamp"
        },
        missing_field: "event_id",
        valid: referenceRecordedEvent(),
        validator: compatibility.isDomainEventEnvelope
      },
      {
        malformed: {
          ...evidenceLinkedEvent(),
          evidence_artifact: {
            ...evidenceArtifact(),
            artifact_kind: "settlement_result"
          }
        },
        missing_field: "evidence_artifact",
        valid: evidenceLinkedEvent(),
        validator: compatibility.isDomainEventEnvelope
      },
      {
        malformed: {
          ...decisionThreadLinkedEvent(),
          decision_thread_ref: {
            ...decisionThread(),
            aliases: []
          }
        },
        missing_field: "decision_thread_ref",
        valid: decisionThreadLinkedEvent(),
        validator: compatibility.isDomainEventEnvelope
      }
    ];

    for (const { malformed, missing_field, valid, validator } of contracts) {
      expect(validator(withoutField(valid, missing_field))).toBe(false);
      expect(validator(malformed)).toBe(false);
    }
  });

  it("exposes validation only, with no writer or runtime resolver surface", async () => {
    const module = await import("../../packages/shared-contracts/src/a5-compatibility");

    expect(Object.keys(module).sort()).toEqual([
      "isDecisionThreadRef",
      "isDomainEventEnvelope",
      "isEvidenceArtifact",
      "isExactRef",
      "isModeBinding",
      "isProvenanceEdge"
    ]);
  });
});
