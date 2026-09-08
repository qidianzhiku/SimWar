import { describe, expect, it } from "vitest";
import {
  adaptW5IndustryDiagnosticProducers,
  type W5IndustryDiagnosticContext
} from "../../services/api/src/industry-model-w5-producer-adapter";
import type { W5ConvergenceProjection, W5ScenarioDraft } from "@simwar/shared-contracts";

const context: W5IndustryDiagnosticContext = {
  tenant_id: "tenant-1",
  course_id: "course-1",
  run_id: "run-1",
  team_id: "team-1",
  round_id: "round-1",
  round_no: 1,
  scenario_package_id: "scenario-1",
  parameter_set_id: "parameter-1"
};

const binding = {
  binding_digest: "b".repeat(64),
  binding_id: "binding-1",
  course_id: context.course_id,
  model_version_ref: "eldercare_w5_governed_v1@1.1.0" as const,
  no_implicit_latest: true as const,
  parameter_set_reference: {
    parameter_set_id: context.parameter_set_id,
    version: "1.0.0",
    content_digest: "p".repeat(64),
    tenant_id: context.tenant_id
  },
  round_no: 1,
  run_id: context.run_id,
  scenario_package_reference: {
    scenario_package_id: context.scenario_package_id,
    version: "1.0.0",
    content_digest: "s".repeat(64),
    tenant_id: context.tenant_id
  },
  seed: 7,
  status: "BOUND" as const,
  tenant_id: context.tenant_id
};

const draft: W5ScenarioDraft = {
  course_id: context.course_id,
  created_by: "teacher-1",
  data_classification: "SYNTHETIC",
  draft_id: "w5_draft_1",
  exact_runtime_binding: binding,
  model_version_ref: "eldercare_w5_governed_v1@1.1.0",
  parameter_descriptors: [],
  parameter_values: {},
  seed: 7,
  status: "BOUND",
  tenant_id: context.tenant_id,
  title: "Bound draft",
  updated_at: "2026-09-07T00:00:00.000Z"
};

const convergence = {
  can: {
    constraints: ["capacity=10"],
    eligible: true,
    official: false as const,
    source_plane: "CAPACITY_WORKFORCE_QUALITY_ELIGIBILITY" as const
  },
  demand_realization: {
    candidate: {
      authority_flags: { official_truth_write: false, provider_calls: 0, settlement_write: false },
      candidate_digest: "c".repeat(64),
      consumer_binding_digest: "d".repeat(64),
      exact_binding: true as const,
      feature_ownership: ["ideal_lancaster_fit", "huff_spatial_weight"] as const,
      market_count: 1,
      market_ids: ["market-1"],
      markets: [{ market_id: "market-1", outside_option_share: 0.2, products: [] }],
      model_family: "IDEAL_POINT_LANCASTER_HUFF_SPATIAL" as const,
      model_version_id: "o3-governed-demand-v1",
      source_plane: "GOVERNED_DEMAND_CANDIDATE" as const,
      status: "PASS" as const
    },
    readiness: "READY_WITH_LIMITS" as const,
    lineage: {
      data_classification: "SYNTHETIC" as const,
      exact_binding: true as const,
      model_version_ref: "eldercare_w5_governed_v1@1.1.0",
      round_no: 1
    },
    mechanism: {
      want: { candidate_value: 12, official: false as const, source_plane: "SYNTHETIC_HEURISTIC" as const },
      can: { constraints: ["capacity=10"], eligible: true, official: false as const, source_plane: "CAPACITY_WORKFORCE_QUALITY_ELIGIBILITY" as const },
      realized: { authority: "SIMULATION_CORE" as const, official: true as const, replay_relevant_digest: "r".repeat(64), writes_formal_result: false as const }
    },
    explanation: [],
    known_limits: ["synthetic"]
  },
  experience_profile: "STANDARD" as const,
  fallback: { applied: false, official_path_continues: true as const, plane: "ON" as const },
  known_limits: ["synthetic"],
  model_version_ref: "eldercare_w5_governed_v1@1.1.0",
  provenance: {
    data_classification: "SYNTHETIC" as const,
    exact_binding_digest: binding.binding_digest,
    model_version_ref: "eldercare_w5_governed_v1@1.1.0",
    parameter_set_reference: binding.parameter_set_reference,
    scenario_package_reference: binding.scenario_package_reference,
    seed: 7
  },
  realized: { authority: "SIMULATION_CORE" as const, official: true as const, replay_relevant_digest: "r".repeat(64), writes_formal_result: false as const },
  replay: { differential: "NON_OFFICIAL" as const, exact_identity: "READY" as const, replay_writes_official_results: false as const },
  security: { activity: "r1", actor: "teacher-1", course: context.course_id, dimensions: [], role: "teacher" as const, round: 1, run: context.run_id, team: context.team_id, tenant: context.tenant_id },
  shadow: { non_official: true, overwrites_official_result: false, plane: "SYSTEM_DYNAMICS" as const },
  want: { candidate_value: 12, official: false as const, source_plane: "SYNTHETIC_HEURISTIC" as const }
} satisfies W5ConvergenceProjection;

describe("W5 industry diagnostic producer adapter", () => {
  it("adapts one exact BOUND W5 context into WANT and REALIZED reference evidence", () => {
    const result = adaptW5IndustryDiagnosticProducers({ context, draft, convergence });

    expect(result.rebase_required).toBe(false);
    expect(result.producers.map((entry) => entry.classification)).toEqual([
      "WANT_EVIDENCE",
      "REALIZED_REFERENCE"
    ]);
    expect(result.producers[0]?.evidence_identity).toBe("c".repeat(64));
    expect(result.producers[0]?.known_limits).toContain("WANT_IS_SYNTHETIC_HEURISTIC");
    expect(result.producers[1]?.authority_owner).toBe("SIMULATION_CORE");
    expect(result.producers[1]?.official_truth_write).toBe(false);
  });

  it("keeps both producers NOT_PROVEN when the exact draft context is missing", () => {
    const result = adaptW5IndustryDiagnosticProducers({ context, draft: null, convergence: null });

    expect(result.rebase_required).toBe(false);
    expect(result.producers.every((entry) => entry.classification === "NOT_PROVEN")).toBe(true);
    expect(result.known_limits).toContain("W5_EXACT_BOUND_DRAFT_REQUIRED");
  });

  it("requires REBASE_REQUIRED when a bound identity moves", () => {
    const moved = { ...context, parameter_set_id: "parameter-2" };
    const result = adaptW5IndustryDiagnosticProducers({ context: moved, draft, convergence });

    expect(result.rebase_required).toBe(true);
    expect(result.identity_movements).toContain("w5_parameter_set");
    expect(result.producers.every((entry) => entry.classification === "NOT_PROVEN")).toBe(true);
  });

  it("rejects a producer that claims to write official truth", () => {
    const invalid = structuredClone(convergence);
    invalid.demand_realization.candidate.authority_flags.official_truth_write = true;
    const result = adaptW5IndustryDiagnosticProducers({ context, draft, convergence: invalid });

    expect(result.producers.every((entry) => entry.classification === "NOT_PROVEN")).toBe(true);
    expect(result.known_limits).toContain("W5_PRODUCER_AUTHORITY_INVALID");
  });
});
