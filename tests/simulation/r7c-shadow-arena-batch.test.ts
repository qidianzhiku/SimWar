import type { SettlementResult } from "@simwar/shared-contracts";
import { describe, expect, it } from "vitest";
import {
  approveR7CCompiledScenario,
  bindR7CReleaseCandidateToRun,
  buildR7CScenarioDiffAndTrace,
  buildR7CShadowArenaBatch,
  buildR7CShadowReplayEvidence,
  compileR7CScenarioDraft,
  createR7CReleaseCandidate,
  createR7CScenarioAuthoringDraft,
  createR7CScenarioRegistry,
  freezeR7CApprovedScenario
} from "../../services/simulation-core/src/eldercare-scenario-factory";

const teacherActor = {
  actor_id: "teacher_r7c",
  course_id: "course_r7c_synthetic",
  role: "teacher" as const,
  tenant_id: "tenant_r7c_synthetic"
};

const officialResult = Object.freeze({
  parameter_set_id: "parameter_r7c_eldercare_lifecycle_v1",
  replay_hash: "official-r7c-replay-hash",
  round_id: "round_r7c_1",
  round_no: 1,
  run_id: "run_r7c_synthetic_001",
  scenario_package_id: "scenario_r7c_crisis_shock",
  settlement_result_id: "official-result-r7c",
  team_results: [],
  tenant_id: "tenant_r7c_synthetic"
} satisfies SettlementResult);

function boundCandidate() {
  const registry = createR7CScenarioRegistry({ actor: teacherActor });
  const draft = createR7CScenarioAuthoringDraft(registry, {
    actor: teacherActor,
    variant_id: "crisis_shock"
  });
  const compiled = compileR7CScenarioDraft(draft);
  const approved = approveR7CCompiledScenario(compiled, { actor: teacherActor });
  const frozen = freezeR7CApprovedScenario(approved, { actor: teacherActor });
  const candidate = createR7CReleaseCandidate(frozen, { actor: teacherActor });

  return {
    candidate: bindR7CReleaseCandidateToRun(candidate, {
      actor: teacherActor,
      run_id: "run_r7c_synthetic_001"
    }),
    family: registry.family
  };
}

const privateMarkers = [
  "state_true",
  "private_assumption",
  "private_parameter",
  "private_plugin_trace",
  "private_replay",
  "manifest_hash",
  "canonical_evidence_digest",
  "tenant_other"
];

describe("R7-C scenario shadow arena batch", () => {
  it("creates deterministic multi-variant shadow arena evidence without official result overwrite", () => {
    const { candidate, family } = boundCandidate();
    const before = JSON.stringify(officialResult);
    const first = buildR7CShadowArenaBatch(family, candidate, officialResult);
    const second = buildR7CShadowArenaBatch(family, candidate, officialResult);

    expect(second).toEqual(first);
    expect(JSON.stringify(officialResult)).toBe(before);
    expect(first.replay_mode).toBe("shadow_arena_batch");
    expect(first.official_result_non_overwrite).toBe(true);
    expect(first.replay_writes_formal_results).toBe(false);
    expect(first.cases).toHaveLength(family.variants.length);
    expect(first.cases.every((item) => item.golden_m1_compatibility === "passed")).toBe(true);
    expect(first.cases.every((item) => item.r3_boundary_compatibility === "passed")).toBe(true);
    expect(first.cases.every((item) => item.plugin_conformance_status === "passed")).toBe(true);
    expect(first.cases.some((item) => item.variant_id === "crisis_shock")).toBe(true);
    expect(
      first.cases.some((item) =>
        item.controlled_failures.includes("R7B_MEDICAL_REHAB_LICENSE_SCOPE_DENIED")
      )
    ).toBe(true);
    expect(first.public_view).toEqual({
      case_count: family.variants.length,
      official_result_non_overwrite: true,
      replay_mode: "shadow_arena_batch",
      status: "candidate_evidence_only"
    });

    const publicSerialized = JSON.stringify(first.public_view);
    for (const marker of privateMarkers) {
      expect(publicSerialized).not.toContain(marker);
    }
  });

  it("emits scenario, parameter, plugin, shock diff and trace evidence", () => {
    const { candidate } = boundCandidate();
    const evidence = buildR7CScenarioDiffAndTrace(candidate);

    expect(evidence.evidence_label).toBe("CONTRACT_BACKED_EVIDENCE");
    expect(evidence.scenario_diff.entries.some((entry) => entry.category === "scenario")).toBe(
      true
    );
    expect(evidence.parameter_diff.entries.some((entry) => entry.category === "parameter")).toBe(
      true
    );
    expect(evidence.plugin_diff.entries.some((entry) => entry.category === "plugin")).toBe(true);
    expect(evidence.shock_diff.entries.some((entry) => entry.category === "shock")).toBe(true);
    expect(evidence.plugin_trace_refs).toEqual(
      expect.arrayContaining(["eldercare.segment-demand.v1", "eldercare.capacity-guardrail.v1"])
    );
    expect(evidence.scenario_trace_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("preserves R7-B shadow replay public non-overwrite semantics", () => {
    const { candidate } = boundCandidate();
    const evidence = buildR7CShadowReplayEvidence(candidate, officialResult);

    expect(evidence.replay_mode).toBe("shadow_replay");
    expect(evidence.replay_writes_formal_results).toBe(false);
    expect(evidence.official_result_non_overwrite).toBe(true);
    expect(evidence.public_view).toMatchObject({
      replay_mode: "shadow_replay",
      status: "candidate_evidence_only"
    });
    expect(JSON.stringify(evidence.public_view)).not.toContain("state_true");
    expect(JSON.stringify(evidence.public_view)).not.toContain("private_replay");
  });
});
