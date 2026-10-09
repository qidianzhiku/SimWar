import { describe, expect, it } from "vitest";
import {
  COURSE_BOUND_QUALIFICATION_MINIMUM_FIXTURES,
  COURSE_BOUND_QUALIFICATION_SCHEMA_VERSION,
  assertCourseBoundQualificationResult,
  compileCourseBoundModelQualification,
  createDefaultCourseBoundQualificationInput,
  type CourseBoundQualificationInput
} from "../../packages/mod-support/src/course-bound-model-qualification";

const baseInput = (): CourseBoundQualificationInput => createDefaultCourseBoundQualificationInput();

const updateFixtures = (
  input: CourseBoundQualificationInput,
  update: (
    fixture: CourseBoundQualificationInput["mjp_fixtures"][number]
  ) => CourseBoundQualificationInput["mjp_fixtures"][number]
): CourseBoundQualificationInput => ({
  ...input,
  mjp_fixtures: input.mjp_fixtures.map(update)
});

describe("course-bound MOD model qualification", () => {
  it("classifies a complete five-way exact bundle as shadow-eligible only", () => {
    const result = compileCourseBoundModelQualification(baseInput());

    expect(result.schema_version).toBe(COURSE_BOUND_QUALIFICATION_SCHEMA_VERSION);
    expect(result.status).toBe("ELIGIBLE_FOR_SHADOW_WITH_LIMITS");
    expect(result.state_transition).toEqual({ from: "STATE_A", to: "STATE_B" });
    expect(result.exact_binding.no_implicit_latest).toBe(true);
    expect(Object.keys(result.exact_binding.refs)).toEqual([
      "course_package",
      "scenario_package",
      "parameter_set",
      "model_version",
      "source_evidence"
    ]);
    expect(result.candidate).toMatchObject({
      formal_binding_eligible: false,
      activation_permitted: false,
      official_truth_write: false,
      settlement_write: false,
      parameter_set_formal_write: false,
      replay_truth_write: false
    });
    expect(result.mjp.status).toBe("PASS");
    expect(result.mjp.fixture_count).toBeGreaterThanOrEqual(
      COURSE_BOUND_QUALIFICATION_MINIMUM_FIXTURES
    );
    expect(() => assertCourseBoundQualificationResult(result)).not.toThrow();
  });

  it("is deterministic for identical structured input and deep clones", () => {
    const first = compileCourseBoundModelQualification(baseInput());
    const second = compileCourseBoundModelQualification(structuredClone(baseInput()));

    expect(second).toEqual(first);
    expect(first.candidate_digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fails closed with precise reasons for cross-reference and compatibility drift", () => {
    const input = baseInput();
    const result = compileCourseBoundModelQualification({
      ...input,
      course_package: {
        ...input.course_package,
        scenario_package_reference: {
          ...input.scenario_package.reference,
          content_digest: "f".repeat(64)
        }
      },
      model_version: { ...input.model_version, model_family: "rcnl" }
    });

    expect(result.status).toBe("REBASE_REQUIRED");
    expect(result.candidate.reason_codes).toEqual(
      expect.arrayContaining(["COURSE_SCENARIO_REFERENCE_MISMATCH", "MODEL_FAMILY_INCOMPATIBLE"])
    );
    expect(result.join_request.requested_status).toBe("REBASE_REQUIRED");
  });

  it("rejects tenant drift and source rights/freshness/expiry without computing official eligibility", () => {
    const input = baseInput();
    const tenantDrift = compileCourseBoundModelQualification({
      ...input,
      source_evidence: { ...input.source_evidence, tenant_id: "tenant_other" }
    });
    expect(tenantDrift.status).toBe("NOT_ELIGIBLE");
    expect(tenantDrift.candidate.reason_codes).toContain("TENANT_SCOPE_MISMATCH");

    for (const sourcePatch of [
      { rights_status: "RESTRICTED" as const },
      { freshness_status: "STALE" as const },
      { expires_at: "2020-01-01T00:00:00.000Z" }
    ]) {
      const result = compileCourseBoundModelQualification({
        ...input,
        source_evidence: { ...input.source_evidence, ...sourcePatch }
      });
      expect(result.status).toBe("NOT_ELIGIBLE");
      expect(result.candidate.formal_binding_eligible).toBe(false);
    }
  });

  it("distinguishes non-computable source metadata from parameter/model rebase drift", () => {
    const input = baseInput();
    const unknownSource = compileCourseBoundModelQualification({
      ...input,
      source_evidence: { ...input.source_evidence, rights_status: "UNKNOWN" }
    });
    expect(unknownSource.status).toBe("NOT_COMPUTABLE");

    const deprecatedParameter = compileCourseBoundModelQualification({
      ...input,
      parameter_set: { ...input.parameter_set, status: "DEPRECATED" }
    });
    expect(deprecatedParameter.status).toBe("NOT_ELIGIBLE");
    expect(deprecatedParameter.candidate.reason_codes).toContain("PARAMETER_SET_NOT_ELIGIBLE");

    const solverDrift = compileCourseBoundModelQualification({
      ...input,
      model_version: { ...input.model_version, solver_version: "2.0.0" }
    });
    expect(solverDrift.status).toBe("REBASE_REQUIRED");
    expect(solverDrift.candidate.reason_codes).toContain("SOLVER_VERSION_INCOMPATIBLE");
  });

  it("rejects floating references before candidate compilation", () => {
    const input = baseInput();

    expect(() =>
      compileCourseBoundModelQualification({
        ...input,
        model_version: {
          ...input.model_version,
          reference: { ...input.model_version.reference, version: "latest" }
        }
      })
    ).toThrow("COURSE_BOUND_EXACT_REFERENCE_INVALID");

    expect(() =>
      compileCourseBoundModelQualification({
        ...input,
        parameter_set: {
          ...input.parameter_set,
          reference: { ...input.parameter_set.reference, version: "^1.0.0" }
        }
      })
    ).toThrow("COURSE_BOUND_EXACT_REFERENCE_INVALID");
  });

  it("rejects floating or wrong-type embedded package references", () => {
    const input = baseInput();
    const malformedInputs: CourseBoundQualificationInput[] = [
      {
        ...input,
        course_package: {
          ...input.course_package,
          scenario_package_reference: {
            ...input.course_package.scenario_package_reference,
            version: "latest"
          }
        }
      },
      {
        ...input,
        course_package: {
          ...input.course_package,
          parameter_set_reference: {
            ...input.course_package.parameter_set_reference,
            version: "^1.0.0"
          }
        }
      },
      {
        ...input,
        scenario_package: {
          ...input.scenario_package,
          parameter_set_reference: {
            ...input.scenario_package.parameter_set_reference,
            resource_type: "scenario_package"
          }
        }
      }
    ];

    for (const malformed of malformedInputs) {
      expect(() => compileCourseBoundModelQualification(malformed)).toThrow(
        "COURSE_BOUND_EXACT_REFERENCE_INVALID"
      );
    }
  });

  it("treats supported parameter schema versions as an order-insensitive set", () => {
    const input = baseInput();
    const result = compileCourseBoundModelQualification({
      ...input,
      scenario_package: {
        ...input.scenario_package,
        parameter_schema_versions: [...input.scenario_package.parameter_schema_versions].reverse()
      },
      model_version: {
        ...input.model_version,
        parameter_schema_versions: [...input.model_version.parameter_schema_versions].reverse()
      }
    });

    expect(result.status).toBe("ELIGIBLE_FOR_SHADOW_WITH_LIMITS");
    expect(result.candidate.compatibility.parameter_schema_match).toBe(true);
  });

  it("prioritizes fail-closed tenant and unknown-evidence states over rebase drift", () => {
    const input = baseInput();
    const tenantAndModelDrift = compileCourseBoundModelQualification({
      ...input,
      tenant_id: "tenant_other",
      model_version: { ...input.model_version, model_family: "rcnl" }
    });
    expect(tenantAndModelDrift.status).toBe("NOT_ELIGIBLE");
    expect(tenantAndModelDrift.candidate.reason_codes).toEqual(
      expect.arrayContaining(["TENANT_SCOPE_MISMATCH", "MODEL_FAMILY_INCOMPATIBLE"])
    );

    const unknownEvidenceAndModelDrift = compileCourseBoundModelQualification({
      ...input,
      source_evidence: { ...input.source_evidence, rights_status: "UNKNOWN" },
      model_version: { ...input.model_version, model_family: "rcnl" }
    });
    expect(unknownEvidenceAndModelDrift.status).toBe("NOT_COMPUTABLE");
    expect(unknownEvidenceAndModelDrift.candidate.reason_codes).toEqual(
      expect.arrayContaining(["SOURCE_RIGHTS_NOT_ELIGIBLE", "MODEL_FAMILY_INCOMPATIBLE"])
    );
  });

  it("withholds MJP PASS when fixtures are incomplete and rejects tampered expectations", () => {
    const input = baseInput();
    const incomplete = compileCourseBoundModelQualification({ ...input, mjp_fixtures: [] });
    expect(incomplete.mjp.status).toBe("SKIP");
    expect(incomplete.mjp.fixture_count).toBe(0);
    expect(incomplete.known_limits).toContain("MJP_PASS_NOT_PROVEN");

    const tampered = updateFixtures(input, (fixture, index) =>
      index === 0 ? { ...fixture, expected_status: "NOT_ELIGIBLE" } : fixture
    );
    expect(() => compileCourseBoundModelQualification(tampered)).toThrow(
      "COURSE_BOUND_MJP_EXPECTED_STATUS_MISMATCH"
    );
  });

  it("keeps student projection role-safe and validates the authority envelope", () => {
    const result = compileCourseBoundModelQualification(baseInput());
    const student = JSON.stringify(result.role_visibility.student);

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
    expect(student).not.toMatch(
      /content_digest|source_ref|tenant_id|raw|private|official|settlement|score|rank/i
    );
    expect(result.join_request.consumer_ready).toBe(false);
    expect(result.join_request.exact_binding_required).toBe(true);
    expect(() => assertCourseBoundQualificationResult(result)).not.toThrow();
  });
});
