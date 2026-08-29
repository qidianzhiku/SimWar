import {
  buildM3OperatingStressWorld,
  projectM3ForRole,
  runM3StressMatrix,
  validateM3OperatingStress
} from "../../packages/sh-next-support/src/m3-operating-stress.js";
import { stableDigest } from "../../packages/sh-next-support/src/index.js";
import { describe, expect, it } from "vitest";

describe("M3 operating economics stress world", () => {
  it("keeps the six operating layers and a complete stress matrix separated", () => {
    const pack = buildM3OperatingStressWorld();

    expect(validateM3OperatingStress(pack)).toEqual([]);
    expect(pack.state_transition).toEqual({ from: "STATE_A", to: "STATE_B" });
    expect(Object.keys(pack.baseline_layers)).toEqual([
      "WANT",
      "CAN",
      "REALIZED",
      "FINANCE",
      "POLICY",
      "STAKEHOLDER"
    ]);
    expect(pack.shock_library.map((shock) => shock.kind)).toEqual(
      expect.arrayContaining(["DEMAND", "WORKFORCE", "QUALITY", "CASH", "POLICY", "STAKEHOLDER"])
    );
    expect(pack.experiment_matrix.map((item) => item.corridor)).toEqual(
      expect.arrayContaining(["NORMAL", "SINGLE_SHOCK", "DOUBLE_SHOCK", "TRIPLE_SHOCK", "RECOVERY"])
    );
    expect(pack.mjp).toMatchObject({
      status: "PASS",
      corridor: "M3-CORRIDOR-WORKFORCE-QUALITY-CASH"
    });
    expect(pack.experiment_results.some((result) => result.feasibility === "UNKNOWN")).toBe(true);
    const unknownResult = pack.experiment_results.find(
      (result) => result.feasibility === "UNKNOWN"
    );
    expect(unknownResult?.metrics.stakeholder_pressure_index).toBe(0.36);
  });

  it("replays the same deterministic input with stable ordering and digests", () => {
    const pack = buildM3OperatingStressWorld();
    const first = runM3StressMatrix(pack);
    const second = runM3StressMatrix(pack);

    expect(second).toEqual(first);
    expect(first.input_digest).toBe(pack.replay.input_digest);
    expect(first.results.map((result) => result.result_id)).toEqual(
      pack.experiment_results.map((result) => result.result_id)
    );
    expect(first.results.every((result) => /^[a-f0-9]{64}$/u.test(result.digest))).toBe(true);
  });

  it("binds existing GSI shadow signals without provider or truth writes", () => {
    const pack = buildM3OperatingStressWorld();

    expect(pack.gsi_binding.contract_id).toBe("gsi.governed.stakeholder.shadow.v1");
    expect(pack.gsi_binding.signal_bindings).toHaveLength(5);
    expect(pack.gsi_binding.provider).toBe("OFF");
    expect(pack.gsi_binding.formal_truth_write).toBe(false);
    expect(pack.gsi_binding.excluded_from_truth_hash).toBe(true);
    expect(pack.gsi_binding.model_call_log.input_digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(pack.gsi_binding.model_call_log.output_digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(pack.authority).toMatchObject({
      official_truth_write: false,
      settlement_write: false,
      parameter_set_formal_write: false,
      provider: "OFF"
    });
  });

  it("projects safe diagnostics and rejects cross-tenant access", () => {
    const pack = buildM3OperatingStressWorld("tenant_demo");
    const teacher = projectM3ForRole(pack, "teacher", "tenant_demo");
    const student = projectM3ForRole(pack, "student", "tenant_demo");

    expect(teacher.visibility).toBe("TEACHER_ONLY");
    expect(teacher.diagnostics.length).toBeGreaterThan(0);
    expect(student.visibility).toBe("STUDENT_SAFE");
    expect(student.forbidden_fields).toEqual(
      expect.arrayContaining(["private_truth", "raw_gsi_proposals", "official_score", "final_rank"])
    );
    expect(student.diagnostics.every((item) => item.visibility === "STUDENT_SAFE")).toBe(true);
    expect(() => projectM3ForRole(pack, "student", "tenant_other")).toThrow(/tenant_scope/u);
  });

  it("records explicit negative and recovery controls", () => {
    const pack = buildM3OperatingStressWorld();
    const recovery = pack.experiment_results.find((result) => result.corridor === "RECOVERY");

    expect(recovery).toBeDefined();
    expect(recovery?.recovery).toMatchObject({
      candidate_only: true,
      prior_result_id: expect.any(String),
      recovery_factor: expect.any(Number)
    });
    expect(pack.negative_controls).toEqual(
      expect.arrayContaining([
        "official_truth_write_rejected",
        "settlement_write_rejected",
        "student_private_signal_rejected",
        "cross_tenant_projection_rejected"
      ])
    );
  });

  it("binds source hashes to the complete provenance and governance record", () => {
    const pack = buildM3OperatingStressWorld();
    const { hash, ...sourceWithoutHash } = pack.sources[0];

    expect(hash).toBe(stableDigest(sourceWithoutHash));
    expect(sourceWithoutHash).toMatchObject({
      source_date: "2024-12-31",
      provenance: expect.any(String),
      license_or_usage_status: "INTERNAL_SUPPORT_ONLY",
      confidence: "LOW",
      sensitivity: "PUBLIC",
      role_visibility: "STUDENT_SAFE",
      evidence_status: "REFERENCE_ONLY"
    });
  });
});
