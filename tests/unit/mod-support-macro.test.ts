import { describe, expect, it } from "vitest";
import {
  MOD_MACRO_KEYS,
  assertModMacroResult,
  compileModMacro,
  createDefaultModMacroRequest,
  createExactRef,
  stableDigest,
  type ModMacroKey,
  type ModMacroRequest
} from "../../packages/mod-support/src/index";

const macroKeys = [...MOD_MACRO_KEYS] as ModMacroKey[];

describe("MOD continuous six-macro candidate compiler", () => {
  it("compiles every macro into a State A to State B, joinable, non-write result", () => {
    for (const macroKey of macroKeys) {
      const result = compileModMacro(
        createDefaultModMacroRequest(macroKey, { fresh_need_proof: true })
      );

      expect(result.schema_version).toBe("mod-support-macro.v1");
      expect(result.state_transition.from).toBe("STATE_A");
      expect(result.state_transition.to).toBe("STATE_B");
      expect(["JOIN", "JOIN_WITH_LIMITS"]).toContain(result.status);
      expect(result.join_request.consumer_ready).toBe(false);
      expect(result.join_request.join_gate).toBe("MAIN_REVIEW_REQUIRED");
      expect(result.exact_binding.no_implicit_latest).toBe(true);
      expect(result.exact_binding.refs.length).toBeGreaterThanOrEqual(4);
      expect(result.authority).toEqual({
        candidate_writer: "MOD_SUPPORT_CANDIDATE_COMPILER",
        formal_writer: "NONE",
        official_truth_write: false,
        settlement_write: false,
        parameter_set_formal_write: false,
        replay_truth_write: false,
        provider: "OFF",
        runtime_authority: "JSON_INTERNAL_ONLY"
      });
      expect(result.mjp.fixture_count).toBeGreaterThanOrEqual(result.mjp.minimum_fixture_count);
      expect(result.mjp.fixture_count).toBe(result.mjp.fixtures.length);
      expect(result.mjp.fixture_ids).toEqual(
        result.mjp.fixtures.map((fixture) => fixture.fixture_id)
      );
      expect(result.known_limits.length).toBeGreaterThan(0);
      expect(() => assertModMacroResult(result)).not.toThrow();
      if (macroKey !== "R4" && macroKey !== "R6") {
        expect(
          result.mjp.fixtures.every((fixture) => {
            const evidence = fixture.result.execution_evidence as Record<string, unknown>;
            return evidence.runner_version === "mod-mjp-runner.v1" && evidence.executed === true;
          })
        ).toBe(true);
      }
    }
  });

  it("rejects floating references before any candidate is compiled", () => {
    expect(() =>
      createExactRef({
        resource_id: "model-version-1",
        resource_type: "model_version",
        version: "latest",
        content_digest: "a".repeat(64)
      })
    ).toThrow("MOD_EXACT_REF_INVALID");

    const request = createDefaultModMacroRequest("R1");
    const drifted = {
      ...request,
      exact_refs: [
        {
          ...request.exact_refs[0],
          version: "current"
        }
      ]
    } as ModMacroRequest;
    expect(() => compileModMacro(drifted)).toThrow("MOD_EXACT_REF_INVALID");
  });

  it("turns conditional R4 and R6 into explicit tombstones without fresh need proof", () => {
    for (const macroKey of ["R4", "R6"] as const) {
      const result = compileModMacro(createDefaultModMacroRequest(macroKey));

      expect(result.status).toBe("SKIP_TOMBSTONED");
      expect(result.state_transition.to).toBe("TOMBSTONED");
      expect(result.candidate).toMatchObject({
        execution: "SKIPPED",
        reason: "NO_FRESH_NEED_PROOF"
      });
      expect(result.mjp.fixture_count).toBe(0);
      expect(result.mjp.status).toBe("SKIP");
      expect(result.join_request.join_gate).toBe("FRESH_NEED_PROOF_REQUIRED");
    }
  });

  it("requires a bound, time-limited, digested proof object for conditional execution", () => {
    const request = createDefaultModMacroRequest("R4", { fresh_need_proof: true });
    expect(request.fresh_need_proof).not.toBeNull();
    const proof = request.fresh_need_proof!;
    expect(proof.authority).toBe("MAIN_NEED_REVIEW");
    expect(proof.source_refs.length).toBeGreaterThan(0);
    expect(proof.content_digest).toMatch(/^[a-f0-9]{64}$/);

    const invalidProof = { ...proof, source_refs: [] };
    expect(() => compileModMacro({ ...request, fresh_need_proof: invalidProof })).toThrow(
      "MOD_FRESH_NEED_PROOF_INVALID"
    );

    const staleProofBase = {
      ...proof,
      issued_at: "2020-01-01T00:00:00.000Z",
      expires_at: "2020-02-01T00:00:00.000Z"
    };
    const staleProof = {
      ...staleProofBase,
      content_digest: stableDigest(staleProofBase)
    };
    expect(() => compileModMacro({ ...request, fresh_need_proof: staleProof })).toThrow(
      "MOD_FRESH_NEED_PROOF_INVALID"
    );
  });

  it("withholds MJP PASS when verifiable fixture input/result pairs are missing", () => {
    const request = createDefaultModMacroRequest("R1");
    const result = compileModMacro({ ...request, mjp_fixtures: [] });

    expect(result.status).toBe("EVIDENCE_INSUFFICIENT");
    expect(result.mjp.status).toBe("SKIP");
    expect(result.mjp.fixture_count).toBe(0);
    expect(result.join_request.requested_status).toBe("EVIDENCE_INSUFFICIENT");
    expect(() => assertModMacroResult(result)).not.toThrow();
  });

  it("rejects a fixture whose claimed execution evidence does not match its input", () => {
    const request = createDefaultModMacroRequest("R2");
    const original = request.mjp_fixtures[0]!;
    const tamperedResult = {
      ...original.result,
      execution_evidence: {
        ...(original.result.execution_evidence as Record<string, unknown>),
        executed: false
      }
    };
    const tamperedFixture = {
      ...original,
      result: tamperedResult,
      result_digest: stableDigest(tamperedResult)
    };
    expect(() =>
      compileModMacro({
        ...request,
        mjp_fixtures: [tamperedFixture, ...request.mjp_fixtures.slice(1)]
      })
    ).toThrow("MOD_MJP_FIXTURE_INVALID");
  });

  it("requires all five experiment families before R3 can enter State B", () => {
    const request = createDefaultModMacroRequest("R3");
    const incomplete = request.experiment_variants.filter(
      (variant) => variant.family !== "FINANCE"
    );
    expect(() => compileModMacro({ ...request, experiment_variants: incomplete })).toThrow(
      "MOD_EXPERIMENT_VARIANT_INVALID"
    );
  });

  it("abstains on conflicting, stale, and out-of-domain stakeholder signals", () => {
    const request = createDefaultModMacroRequest("R2");
    const result = compileModMacro({
      ...request,
      stakeholder_signals: request.stakeholder_signals.map((signal, index) =>
        index === 0
          ? { ...signal, quality: "CONFLICT" }
          : index === 1
            ? { ...signal, quality: "STALE" }
            : index === 2
              ? { ...signal, quality: "OUT_OF_DOMAIN" }
              : signal
      )
    });

    expect(result.candidate).toMatchObject({ official_influence: 0 });
    expect(result.candidate.abstentions).toHaveLength(3);
    expect(result.evidence.conflicts).toHaveLength(1);
    expect(JSON.stringify(result.candidate)).not.toMatch(/recommendation|score|rank/i);
  });

  it("produces one bounded, deduplicated shadow response per stakeholder signal", () => {
    const request = createDefaultModMacroRequest("R2");
    const result = compileModMacro({
      ...request,
      stakeholder_signals: [
        ...request.stakeholder_signals,
        { ...request.stakeholder_signals[0], signal_id: "signal-customer-family-duplicate" }
      ]
    });
    const candidate = result.candidate as {
      diagnostic_responses: Array<Record<string, unknown>>;
      abstentions: Array<Record<string, unknown>>;
      double_count_guard: string;
      official_influence: number;
    };
    expect(candidate.double_count_guard).toBe("ON");
    expect(candidate.official_influence).toBe(0);
    expect(candidate.diagnostic_responses).toHaveLength(5);
    expect(candidate.abstentions).toContainEqual(
      expect.objectContaining({ reason: "DUPLICATE_STAKEHOLDER_ABSTENTION" })
    );
    for (const response of candidate.diagnostic_responses) {
      expect(response.bounded_diagnostic_delta).toBeGreaterThanOrEqual(-0.25);
      expect(response.bounded_diagnostic_delta).toBeLessThanOrEqual(0.25);
      expect(response.unit).toBe("bounded diagnostic delta");
    }
  });

  it("builds a reproducible five-family executive experiment manifest", () => {
    const result = compileModMacro(createDefaultModMacroRequest("R3", { fresh_need_proof: true }));
    const candidate = result.candidate as {
      families_covered: string[];
      experiment_history_manifest: Array<Record<string, unknown>>;
      variants: Array<Record<string, unknown>>;
      reproducibility: Record<string, unknown>;
      comparison_scope: string;
    };
    expect(candidate.families_covered).toEqual(["WANT", "CAN", "DYNAMICS", "FINANCE", "PORTFOLIO"]);
    expect(candidate.experiment_history_manifest).toEqual(
      result.exact_binding.refs.map((ref) => expect.objectContaining(ref))
    );
    expect(candidate.variants.length).toBeGreaterThanOrEqual(5);
    expect(
      candidate.variants.some(
        (variant) => variant.execution_status === "ABSTAINED_UNKNOWN_FEASIBILITY"
      )
    ).toBe(true);
    expect(candidate.reproducibility).toMatchObject({ replayable: true, official: false });
    expect(candidate.comparison_scope).toBe("WANT_CAN_DYNAMICS_FINANCE_PORTFOLIO");
  });

  it("keeps regional transfer rights, expiry, and calibration limits explicit", () => {
    const result = compileModMacro(createDefaultModMacroRequest("R5", { fresh_need_proof: true }));

    expect(result.candidate).toMatchObject({
      target_region: "hangzhou",
      rights_status: "PUBLIC_SAFE",
      compatibility_status: "COMPATIBLE_WITH_LIMITS",
      out_of_domain_action: "FAIL_CLOSED",
      calibration_status: "NOT_CALIBRATED"
    });
    expect(result.candidate.expiry).toBe("2027-08-28");
    expect(result.candidate).toMatchObject({
      model_card: {
        calibration_status: "NOT_CALIBRATED",
        official_recommendation: false
      },
      public_safe_harness: expect.arrayContaining([
        expect.objectContaining({ comparison: "SAME_MODEL_DIFFERENT_REGION" }),
        expect.objectContaining({ comparison: "SAME_REGION_DIFFERENT_MODEL_VERSION" })
      ])
    });
    expect(result.candidate.compatibility_matrix as Array<unknown>).toHaveLength(2);
  });

  it("records R1 reuse proof and R6 lifecycle gates without creating an activation writer", () => {
    const r1 = compileModMacro(createDefaultModMacroRequest("R1"));
    expect(r1.candidate).toMatchObject({
      reuse_status: "CURRENT_MAIN_CAPABILITY_REUSED_WITH_LOCAL_EVIDENCE",
      consumer_evidence: {
        consumer_id: "MAIN-SH-FV-O1-GOVERNED-SHANGHAI-FULL-VERTICAL",
        route_mode: "READ_ONLY_COMPOSITION"
      }
    });

    const r6 = compileModMacro(createDefaultModMacroRequest("R6", { fresh_need_proof: true }));
    expect(r6.candidate).toMatchObject({
      activation_allowed: false,
      rollback_receipt: { runtime_activation: false, formal_writer: "NONE" },
      lifecycle: [
        "REFERENCE",
        "ELIGIBLE",
        "CALIBRATION_CANDIDATE",
        "QUALIFIED_WITH_LIMITS",
        "EXPIRED",
        "ROLLBACK_READY"
      ]
    });
  });

  it("fails closed for restricted, unknown, or expired regional transfer inputs", () => {
    const request = createDefaultModMacroRequest("R5", { fresh_need_proof: true });
    for (const regional_target of [
      { ...request.regional_target, rights_status: "RESTRICTED" as const },
      { ...request.regional_target, rights_status: "UNKNOWN" as const },
      { ...request.regional_target, expiry: "2020-01-01" }
    ]) {
      const result = compileModMacro({ ...request, regional_target });

      expect(result.status).toBe("EVIDENCE_INSUFFICIENT");
      expect(result.mjp.status).toBe("SKIP");
      expect(result.join_request.join_gate).toBe("REGIONAL_RIGHTS_AND_EXPIRY_REQUIRED");
      expect(result.candidate).toMatchObject({
        compatibility_status: "NOT_JOINABLE",
        regional_transfer_allowed: false,
        out_of_domain_action: "FAIL_CLOSED"
      });
    }
  });

  it("keeps student projections free of private truth and formal result fields", () => {
    for (const macroKey of macroKeys) {
      const result = compileModMacro(
        createDefaultModMacroRequest(macroKey, { fresh_need_proof: true })
      );
      const studentProjection = JSON.stringify(result.role_visibility.student);
      expect(studentProjection).not.toMatch(
        /state_true|market_share|revenue|profit|cash_flow|score|rank|settlement|raw|secret|private/i
      );
    }
  });

  it("is deterministic for the same structured inputs", () => {
    const request = createDefaultModMacroRequest("R3", { fresh_need_proof: true });
    const first = compileModMacro(request);
    const second = compileModMacro(structuredClone(request));

    expect(first).toEqual(second);
    expect(first.candidate_digest).toMatch(/^[a-f0-9]{64}$/);
  });
});
