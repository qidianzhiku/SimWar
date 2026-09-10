import { describe, expect, it } from "vitest";
import {
  adaptCanIndustryDiagnosticProducer,
  type CanIndustryDiagnosticContext
} from "../../services/api/src/industry-model-can-producer-adapter";
import type { CanServiceFeasibilityCandidate } from "@simwar/shared-contracts";

const context: CanIndustryDiagnosticContext = {
  tenant_id: "tenant-1",
  course_id: "course-1",
  run_id: "run-1",
  team_id: "team-1",
  round_id: "round-1",
  round_no: 1,
  scenario_package_id: "scenario-1",
  parameter_set_id: "parameter-1",
  observed_team_id: "team-1"
};

const candidate: CanServiceFeasibilityCandidate = {
  authority: {
    candidate_writer: "SIMULATION_CORE_READ_ONLY",
    official_truth_write: false,
    provider_calls: 0,
    replay_truth_write: false,
    settlement_write: false
  },
  candidate_digest: "c".repeat(64),
  candidate_id: "can_candidate_1",
  constraints: [],
  exact_binding: {
    binding_digest: "b".repeat(64),
    course_id: context.course_id,
    model_version_ref: "w5-model@1.1",
    no_implicit_latest: true,
    parameter_set_reference: {
      parameter_set_id: context.parameter_set_id,
      version: "1.0.0",
      content_digest: "p".repeat(64),
      tenant_id: context.tenant_id
    },
    round_id: context.round_id,
    round_no: 1,
    run_id: context.run_id,
    scenario_package_reference: {
      scenario_package_id: context.scenario_package_id,
      version: "1.0.0",
      content_digest: "s".repeat(64),
      tenant_id: context.tenant_id
    },
    seed: 7,
    tenant_id: context.tenant_id
  },
  producer_intrinsic_lineage: {
    model_version_reference: {
      model_version_id: "can_service_feasibility_v1",
      version: "1.0.0",
      content_digest: "m".repeat(64)
    },
    model_artifact_reference: {
      artifact_id: "can_service_feasibility_evaluator",
      content_digest: "n".repeat(64),
      format: "typescript-simulation-core",
      source_ref: "services/simulation-core/src/can-service-feasibility.ts"
    },
    producer_source_ref: "services/simulation-core/src/can-service-feasibility.ts",
    lineage_digest: "l".repeat(64)
  },
  queue: { claim: "NOT_CLAIMED", reason: "EXACT_QUEUE_INPUT_NOT_AVAILABLE" },
  status: "FEASIBLE",
  why_not: []
};

describe("CAN industry diagnostic producer adapter", () => {
  it("adapts exact CAN evidence without changing its status", () => {
    const result = adaptCanIndustryDiagnosticProducer({ context, candidate });

    expect(result.rebase_required).toBe(false);
    expect(result.producer.classification).toBe("CAN_EVIDENCE");
    expect(result.producer.evidence_identity).toBe(candidate.candidate_digest);
    expect(result.producer.official_truth_write).toBe(false);
  });

  it("preserves UNKNOWN and never upgrades it to FEASIBLE", () => {
    const result = adaptCanIndustryDiagnosticProducer({
      context,
      candidate: { ...candidate, status: "UNKNOWN" }
    });

    expect(result.producer.classification).toBe("CAN_EVIDENCE");
    expect(result.producer.known_limits).toContain("CAN_STATUS_UNKNOWN_NOT_FEASIBLE");
    expect(result.producer.derived_status).toBe("UNKNOWN");
  });

  it("returns NOT_PROVEN when exact CAN evidence is absent", () => {
    const result = adaptCanIndustryDiagnosticProducer({ context, candidate: null });

    expect(result.producer.classification).toBe("NOT_PROVEN");
    expect(result.producer.evidence_identity).toBe("NOT_PROVEN");
    expect(result.known_limits).toContain("CAN_EXACT_SOURCE_REQUIRED");
  });

  it("fails closed when a legacy-shaped CAN candidate has no typed producer lineage", () => {
    const legacyCandidate = { ...candidate };
    delete legacyCandidate.producer_intrinsic_lineage;
    const result = adaptCanIndustryDiagnosticProducer({
      context,
      candidate: legacyCandidate
    });

    expect(result.producer.classification).toBe("NOT_PROVEN");
    expect(result.producer.known_limits).toContain("CAN_TYPED_LINEAGE_NOT_EXPOSED_BY_PRODUCER");
  });

  it("requires rebase for a context or team movement", () => {
    const result = adaptCanIndustryDiagnosticProducer({
      context: { ...context, team_id: "team-2", observed_team_id: "team-1" },
      candidate
    });

    expect(result.rebase_required).toBe(true);
    expect(result.producer.classification).toBe("NOT_PROVEN");
    expect(result.identity_movements).toContain("can_team");
  });

  it("rejects an authority-invalid candidate instead of classifying it as CAN", () => {
    const result = adaptCanIndustryDiagnosticProducer({
      context,
      candidate: { ...candidate, authority: { ...candidate.authority, official_truth_write: true } }
    });

    expect(result.producer.classification).toBe("NOT_PROVEN");
    expect(result.known_limits).toContain("CAN_PRODUCER_AUTHORITY_INVALID");
  });
});
