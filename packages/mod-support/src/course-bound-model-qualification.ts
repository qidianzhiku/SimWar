import { createHash } from "node:crypto";

export const COURSE_BOUND_QUALIFICATION_SCHEMA_VERSION =
  "course-bound-model-qualification.v1" as const;
export const COURSE_BOUND_QUALIFICATION_CANDIDATE_TYPE =
  "CourseBoundModelQualificationCandidate" as const;
export const COURSE_BOUND_QUALIFICATION_MINIMUM_FIXTURES = 4 as const;

export type CourseBoundQualificationStatus =
  | "ELIGIBLE_FOR_SHADOW_WITH_LIMITS"
  | "NOT_ELIGIBLE"
  | "NOT_COMPUTABLE"
  | "REBASE_REQUIRED";

export interface CourseBoundExactReference {
  readonly resource_id: string;
  readonly resource_type: string;
  readonly version: string;
  readonly content_digest: string;
}

export interface CoursePackageQualificationBinding {
  readonly reference: CourseBoundExactReference;
  readonly tenant_id: string;
  readonly scenario_package_reference: CourseBoundExactReference;
  readonly parameter_set_reference: CourseBoundExactReference;
}

export interface ScenarioPackageQualificationBinding {
  readonly reference: CourseBoundExactReference;
  readonly tenant_id: string;
  readonly parameter_set_reference: CourseBoundExactReference;
  readonly model_family: "toy_logit" | "blp" | "rcnl" | "w5_governed" | "custom";
  readonly feature_mapper_version: string;
  readonly parameter_schema_versions: readonly string[];
  readonly status: "APPROVED";
}

export interface ParameterSetQualificationBinding {
  readonly reference: CourseBoundExactReference;
  readonly tenant_id: string;
  readonly model_family: "toy_logit" | "blp" | "rcnl" | "w5_governed" | "custom";
  readonly feature_mapper_version: string;
  readonly parameter_schema_version: string;
  readonly feature_schema_digest: string;
  readonly solver_version: string;
  readonly status: "CANDIDATE" | "SHADOW_TESTING" | "SHADOW_PASSED" | "APPROVED" | "DEPRECATED";
}

export interface ModelVersionQualificationBinding {
  readonly reference: CourseBoundExactReference;
  readonly tenant_id: string;
  readonly model_family: "toy_logit" | "blp" | "rcnl" | "w5_governed" | "custom";
  readonly feature_mapper_version: string;
  readonly parameter_schema_versions: readonly string[];
  readonly solver_version: string;
  readonly status: "DRAFT" | "VALIDATED" | "FROZEN" | "APPROVED" | "ACTIVE" | "RETIRED";
}

export interface SourceEvidenceQualificationBinding {
  readonly reference: CourseBoundExactReference;
  readonly tenant_id: string;
  readonly course_package_id: string;
  readonly feature_schema_digest: string;
  readonly rights_status: "VALID" | "EXPIRED" | "UNKNOWN" | "RESTRICTED";
  readonly freshness_status: "FRESH" | "STALE" | "UNKNOWN";
  readonly observed_at: string;
  readonly expires_at: string | null;
}

export interface CourseBoundQualificationEvaluationInput {
  readonly need_by: string;
  readonly tenant_id: string;
  readonly course_package: CoursePackageQualificationBinding;
  readonly scenario_package: ScenarioPackageQualificationBinding;
  readonly parameter_set: ParameterSetQualificationBinding;
  readonly model_version: ModelVersionQualificationBinding;
  readonly source_evidence: SourceEvidenceQualificationBinding;
}

export interface CourseBoundQualificationFixtureInput {
  readonly fixture_id: string;
  readonly expected_status: CourseBoundQualificationStatus;
  readonly input: CourseBoundQualificationEvaluationInput;
}

export interface CourseBoundQualificationInput extends CourseBoundQualificationEvaluationInput {
  readonly mission_id: string;
  readonly consumer_id: string;
  readonly requested_at: string;
  readonly mjp_fixtures: readonly CourseBoundQualificationFixtureInput[];
}

export interface CourseBoundCompatibility {
  readonly tenant_match: boolean;
  readonly course_scenario_match: boolean;
  readonly course_parameter_match: boolean;
  readonly scenario_parameter_match: boolean;
  readonly model_family_match: boolean;
  readonly feature_mapper_match: boolean;
  readonly parameter_schema_match: boolean;
  readonly solver_version_match: boolean;
  readonly source_course_match: boolean;
  readonly source_feature_schema_match: boolean;
  readonly parameter_status_eligible: boolean;
  readonly model_status_eligible: boolean;
  readonly source_rights_eligible: boolean;
  readonly source_freshness_eligible: boolean;
}

export interface CourseBoundQualificationResult {
  readonly schema_version: typeof COURSE_BOUND_QUALIFICATION_SCHEMA_VERSION;
  readonly mission_id: string;
  readonly consumer_id: string;
  readonly candidate_type: typeof COURSE_BOUND_QUALIFICATION_CANDIDATE_TYPE;
  readonly candidate_digest: string;
  readonly status: CourseBoundQualificationStatus;
  readonly state_transition: { readonly from: "STATE_A"; readonly to: "STATE_B" };
  readonly exact_binding: {
    readonly binding_digest: string;
    readonly no_implicit_latest: true;
    readonly refs: {
      readonly course_package: CourseBoundExactReference;
      readonly scenario_package: CourseBoundExactReference;
      readonly parameter_set: CourseBoundExactReference;
      readonly model_version: CourseBoundExactReference;
      readonly source_evidence: CourseBoundExactReference;
    };
  };
  readonly candidate: {
    readonly status: CourseBoundQualificationStatus;
    readonly reason_codes: readonly string[];
    readonly compatibility: CourseBoundCompatibility;
    readonly formal_binding_eligible: false;
    readonly activation_permitted: false;
    readonly official_truth_write: false;
    readonly settlement_write: false;
    readonly parameter_set_formal_write: false;
    readonly replay_truth_write: false;
  };
  readonly evidence: {
    readonly inputs: readonly {
      readonly ref: CourseBoundExactReference;
      readonly role: "TEACHER_ONLY" | "STUDENT_SAFE" | "INTERNAL_RESEARCH_ONLY" | "RESTRICTED";
    }[];
    readonly transformations: readonly {
      readonly input: readonly string[];
      readonly rule: string;
      readonly output: string;
      readonly confidence: "HIGH" | "MEDIUM" | "LOW" | "NOT_ESTABLISHED";
      readonly provenance: string;
    }[];
    readonly conflicts: readonly { readonly field: string; readonly reason: string }[];
    readonly differential: {
      readonly mode: "NON_OFFICIAL";
      readonly replay_truth_write: false;
      readonly official_result_overwrite: false;
    };
  };
  readonly mjp: {
    readonly status: "PASS" | "SKIP";
    readonly fixture_count: number;
    readonly minimum_fixture_count: typeof COURSE_BOUND_QUALIFICATION_MINIMUM_FIXTURES;
    readonly fixture_ids: readonly string[];
    readonly fixtures: readonly {
      readonly fixture_id: string;
      readonly expected_status: CourseBoundQualificationStatus;
      readonly observed_status: CourseBoundQualificationStatus;
      readonly input_digest: string;
      readonly result_digest: string;
      readonly executed: true;
    }[];
  };
  readonly role_visibility: {
    readonly teacher: { readonly visibility: "TEACHER_ONLY"; readonly fields: readonly string[] };
    readonly student: { readonly visibility: "STUDENT_SAFE"; readonly fields: readonly string[] };
    readonly admin: {
      readonly visibility: "INTERNAL_RESEARCH_ONLY";
      readonly fields: readonly string[];
    };
  };
  readonly authority: {
    readonly candidate_writer: "MOD_SUPPORT_CANDIDATE_COMPILER";
    readonly formal_writer: "NONE";
    readonly official_truth_write: false;
    readonly settlement_write: false;
    readonly parameter_set_formal_write: false;
    readonly replay_truth_write: false;
    readonly provider: "OFF";
    readonly runtime_authority: "JSON_INTERNAL_ONLY";
  };
  readonly join_request: {
    readonly consumer_id: string;
    readonly need_by: string;
    readonly consumer_ready: false;
    readonly exact_binding_required: true;
    readonly join_gate: "MAIN_INTEGRATION_LEASE_REQUIRED";
    readonly requested_status: CourseBoundQualificationStatus;
  };
  readonly known_limits: readonly string[];
}

const ID_PATTERN = /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/u;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/u;
const RESERVED_REFERENCE_PATTERN =
  /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved|wildcard)(?:$|[._:-])/iu;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function courseBoundStableDigest(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function isSafeIdentity(value: string): boolean {
  return ID_PATTERN.test(value) && !RESERVED_REFERENCE_PATTERN.test(value);
}

function isExactReference(reference: CourseBoundExactReference, expectedType?: string): boolean {
  return (
    isSafeIdentity(reference.resource_id) &&
    isSafeIdentity(reference.resource_type) &&
    (expectedType === undefined || reference.resource_type === expectedType) &&
    SEMVER_PATTERN.test(reference.version) &&
    !RESERVED_REFERENCE_PATTERN.test(reference.version) &&
    DIGEST_PATTERN.test(reference.content_digest)
  );
}

function sameReference(left: CourseBoundExactReference, right: CourseBoundExactReference): boolean {
  return (
    left.resource_id === right.resource_id &&
    left.resource_type === right.resource_type &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isIsoTimestamp(value: string): boolean {
  return ISO_TIMESTAMP_PATTERN.test(value) && Number.isFinite(Date.parse(value));
}

function assertExactBindingInput(input: CourseBoundQualificationEvaluationInput): void {
  const refs: readonly [CourseBoundExactReference, string][] = [
    [input.course_package.reference, "course_package"],
    [input.scenario_package.reference, "scenario_package"],
    [input.parameter_set.reference, "parameter_set"],
    [input.model_version.reference, "model_version"],
    [input.source_evidence.reference, "source_evidence"]
  ];
  if (
    !isSafeIdentity(input.tenant_id) ||
    !input.need_by.trim() ||
    refs.some(([reference, expectedType]) => !isExactReference(reference, expectedType))
  ) {
    throw new Error("COURSE_BOUND_EXACT_REFERENCE_INVALID");
  }
  if (
    !isSafeIdentity(input.course_package.tenant_id) ||
    !isSafeIdentity(input.scenario_package.tenant_id) ||
    !isSafeIdentity(input.parameter_set.tenant_id) ||
    !isSafeIdentity(input.model_version.tenant_id) ||
    !isSafeIdentity(input.source_evidence.tenant_id) ||
    !isSafeIdentity(input.source_evidence.course_package_id) ||
    !input.scenario_package.feature_mapper_version.trim() ||
    !input.parameter_set.feature_mapper_version.trim() ||
    !input.parameter_set.parameter_schema_version.trim() ||
    !input.parameter_set.solver_version.trim() ||
    !input.model_version.feature_mapper_version.trim() ||
    !input.model_version.solver_version.trim() ||
    input.scenario_package.parameter_schema_versions.length === 0 ||
    input.model_version.parameter_schema_versions.length === 0 ||
    !DIGEST_PATTERN.test(input.parameter_set.feature_schema_digest) ||
    !DIGEST_PATTERN.test(input.source_evidence.feature_schema_digest) ||
    !isIsoTimestamp(input.source_evidence.observed_at) ||
    (input.source_evidence.expires_at !== null && !isIsoTimestamp(input.source_evidence.expires_at))
  ) {
    throw new Error("COURSE_BOUND_EVIDENCE_INPUT_INVALID");
  }
}

function assertTopLevelInput(input: CourseBoundQualificationInput): void {
  if (
    !isSafeIdentity(input.mission_id) ||
    !isSafeIdentity(input.consumer_id) ||
    !isIsoTimestamp(input.requested_at)
  ) {
    throw new Error("COURSE_BOUND_REQUEST_INVALID");
  }
  assertExactBindingInput(input);
  const fixtureIds = input.mjp_fixtures.map((fixture) => fixture.fixture_id);
  if (
    fixtureIds.some((fixtureId) => !isSafeIdentity(fixtureId)) ||
    new Set(fixtureIds).size !== fixtureIds.length ||
    input.mjp_fixtures.some(
      (fixture) =>
        ![
          "ELIGIBLE_FOR_SHADOW_WITH_LIMITS",
          "NOT_ELIGIBLE",
          "NOT_COMPUTABLE",
          "REBASE_REQUIRED"
        ].includes(fixture.expected_status)
    )
  ) {
    throw new Error("COURSE_BOUND_MJP_FIXTURE_INVALID");
  }
  for (const fixture of input.mjp_fixtures) assertExactBindingInput(fixture.input);
}

function exactBindingRefs(input: CourseBoundQualificationEvaluationInput) {
  return {
    course_package: input.course_package.reference,
    scenario_package: input.scenario_package.reference,
    parameter_set: input.parameter_set.reference,
    model_version: input.model_version.reference,
    source_evidence: input.source_evidence.reference
  } as const;
}

function evaluateBinding(
  input: CourseBoundQualificationEvaluationInput,
  asOf = input.source_evidence.observed_at
): {
  status: CourseBoundQualificationStatus;
  reason_codes: readonly string[];
  compatibility: CourseBoundCompatibility;
} {
  const tenantMatch = [
    input.course_package.tenant_id,
    input.scenario_package.tenant_id,
    input.parameter_set.tenant_id,
    input.model_version.tenant_id,
    input.source_evidence.tenant_id
  ].every((tenantId) => tenantId === input.tenant_id);
  const courseScenarioMatch = sameReference(
    input.course_package.scenario_package_reference,
    input.scenario_package.reference
  );
  const courseParameterMatch = sameReference(
    input.course_package.parameter_set_reference,
    input.parameter_set.reference
  );
  const scenarioParameterMatch = sameReference(
    input.scenario_package.parameter_set_reference,
    input.parameter_set.reference
  );
  const modelFamilyMatch =
    input.scenario_package.model_family === input.parameter_set.model_family &&
    input.parameter_set.model_family === input.model_version.model_family;
  const featureMapperMatch =
    input.scenario_package.feature_mapper_version === input.parameter_set.feature_mapper_version &&
    input.parameter_set.feature_mapper_version === input.model_version.feature_mapper_version;
  const parameterSchemaMatch =
    input.scenario_package.parameter_schema_versions.includes(
      input.parameter_set.parameter_schema_version
    ) &&
    sameStringArray(
      input.scenario_package.parameter_schema_versions,
      input.model_version.parameter_schema_versions
    );
  const solverVersionMatch =
    input.parameter_set.solver_version === input.model_version.solver_version;
  const sourceCourseMatch =
    input.source_evidence.course_package_id === input.course_package.reference.resource_id;
  const sourceFeatureSchemaMatch =
    input.source_evidence.feature_schema_digest === input.parameter_set.feature_schema_digest;
  const modelStatusEligible = ["VALIDATED", "FROZEN", "APPROVED", "ACTIVE"].includes(
    input.model_version.status
  );
  const parameterStatusEligible = input.parameter_set.status !== "DEPRECATED";
  const sourceRightsEligible = input.source_evidence.rights_status === "VALID";
  const sourceFreshnessEligible = input.source_evidence.freshness_status === "FRESH";
  const compatibility: CourseBoundCompatibility = {
    tenant_match: tenantMatch,
    course_scenario_match: courseScenarioMatch,
    course_parameter_match: courseParameterMatch,
    scenario_parameter_match: scenarioParameterMatch,
    model_family_match: modelFamilyMatch,
    feature_mapper_match: featureMapperMatch,
    parameter_schema_match: parameterSchemaMatch,
    solver_version_match: solverVersionMatch,
    source_course_match: sourceCourseMatch,
    source_feature_schema_match: sourceFeatureSchemaMatch,
    parameter_status_eligible: parameterStatusEligible,
    model_status_eligible: modelStatusEligible,
    source_rights_eligible: sourceRightsEligible,
    source_freshness_eligible: sourceFreshnessEligible
  };
  const reasons: string[] = [];
  if (!tenantMatch) reasons.push("TENANT_SCOPE_MISMATCH");
  if (!courseScenarioMatch) reasons.push("COURSE_SCENARIO_REFERENCE_MISMATCH");
  if (!courseParameterMatch) reasons.push("COURSE_PARAMETER_REFERENCE_MISMATCH");
  if (!scenarioParameterMatch) reasons.push("SCENARIO_PARAMETER_REFERENCE_MISMATCH");
  if (!modelFamilyMatch) reasons.push("MODEL_FAMILY_INCOMPATIBLE");
  if (!featureMapperMatch) reasons.push("FEATURE_MAPPER_INCOMPATIBLE");
  if (!parameterSchemaMatch) reasons.push("PARAMETER_SCHEMA_INCOMPATIBLE");
  if (!solverVersionMatch) reasons.push("SOLVER_VERSION_INCOMPATIBLE");
  if (!sourceCourseMatch) reasons.push("SOURCE_COURSE_REFERENCE_MISMATCH");
  if (!sourceFeatureSchemaMatch) reasons.push("SOURCE_FEATURE_SCHEMA_INCOMPATIBLE");
  if (!parameterStatusEligible) reasons.push("PARAMETER_SET_NOT_ELIGIBLE");
  if (!modelStatusEligible) reasons.push("MODEL_VERSION_NOT_ELIGIBLE");
  if (!sourceRightsEligible) reasons.push("SOURCE_RIGHTS_NOT_ELIGIBLE");
  if (!sourceFreshnessEligible) reasons.push("SOURCE_FRESHNESS_NOT_PROVEN");
  if (
    input.source_evidence.expires_at !== null &&
    Date.parse(input.source_evidence.expires_at) <= Date.parse(asOf)
  ) {
    reasons.push("SOURCE_EVIDENCE_EXPIRED");
  }
  const rebaseReasons = new Set([
    "COURSE_SCENARIO_REFERENCE_MISMATCH",
    "COURSE_PARAMETER_REFERENCE_MISMATCH",
    "SCENARIO_PARAMETER_REFERENCE_MISMATCH",
    "MODEL_FAMILY_INCOMPATIBLE",
    "FEATURE_MAPPER_INCOMPATIBLE",
    "PARAMETER_SCHEMA_INCOMPATIBLE",
    "SOLVER_VERSION_INCOMPATIBLE",
    "SOURCE_COURSE_REFERENCE_MISMATCH",
    "SOURCE_FEATURE_SCHEMA_INCOMPATIBLE"
  ]);
  const status =
    reasons.length === 0
      ? "ELIGIBLE_FOR_SHADOW_WITH_LIMITS"
      : reasons.some((reason) => rebaseReasons.has(reason))
        ? "REBASE_REQUIRED"
        : input.source_evidence.rights_status === "UNKNOWN" ||
            input.source_evidence.freshness_status === "UNKNOWN"
          ? "NOT_COMPUTABLE"
          : "NOT_ELIGIBLE";
  return { status, reason_codes: reasons, compatibility };
}

function transformations(input: CourseBoundQualificationEvaluationInput) {
  return [
    {
      input: ["course_package.scenario_package_reference", "scenario_package.reference"],
      rule: "Exact reference equality is required for the CoursePackage to name its ScenarioPackage",
      output: "course_scenario_binding",
      confidence: "HIGH" as const,
      provenance: `${input.course_package.reference.resource_id}@${input.course_package.reference.version}`
    },
    {
      input: [
        "course_package.parameter_set_reference",
        "scenario_package.parameter_set_reference",
        "parameter_set.reference"
      ],
      rule: "Course and Scenario parameter references must equal the supplied ParameterSet",
      output: "parameter_binding",
      confidence: "HIGH" as const,
      provenance: `${input.parameter_set.reference.resource_id}@${input.parameter_set.reference.version}`
    },
    {
      input: ["scenario_package", "parameter_set", "model_version"],
      rule: "Model family, feature mapper, schema versions, and solver compatibility are compared exactly",
      output: "model_compatibility",
      confidence: "HIGH" as const,
      provenance: `${input.model_version.reference.resource_id}@${input.model_version.reference.version}`
    },
    {
      input: ["source_evidence", "course_package", "parameter_set"],
      rule: "Source evidence must bind to the exact course and feature schema with lawful fresh metadata",
      output: "source_evidence_compatibility",
      confidence: "MEDIUM" as const,
      provenance: `${input.source_evidence.reference.resource_id}@${input.source_evidence.reference.version}`
    }
  ];
}

function evaluateFixture(fixture: CourseBoundQualificationFixtureInput) {
  const evaluation = evaluateBinding(fixture.input);
  const result = {
    fixture_id: fixture.fixture_id,
    status: evaluation.status,
    reason_codes: evaluation.reason_codes
  };
  return {
    fixture_id: fixture.fixture_id,
    expected_status: fixture.expected_status,
    observed_status: evaluation.status,
    input_digest: courseBoundStableDigest(fixture.input),
    result_digest: courseBoundStableDigest(result),
    executed: true as const
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export function compileCourseBoundModelQualification(
  input: CourseBoundQualificationInput
): CourseBoundQualificationResult {
  assertTopLevelInput(input);
  const evaluated = evaluateBinding(input, input.requested_at);
  const refs = exactBindingRefs(input);
  const fixtureEvidence = input.mjp_fixtures.map(evaluateFixture);
  if (fixtureEvidence.some((fixture) => fixture.expected_status !== fixture.observed_status)) {
    throw new Error("COURSE_BOUND_MJP_EXPECTED_STATUS_MISMATCH");
  }
  const binding_digest = courseBoundStableDigest({
    mission_id: input.mission_id,
    consumer_id: input.consumer_id,
    refs
  });
  const known_limits = [
    "Candidate-only support evidence; no formal ModelVersion activation or official Truth write.",
    "Provider is OFF; calibration and causal validity are not claimed by this compiler.",
    "MAIN must revalidate consumer, role, rights, freshness, and integration-lease conditions.",
    "Student projection is role-safe and intentionally excludes source provenance and exact digests."
  ];
  if (fixtureEvidence.length < COURSE_BOUND_QUALIFICATION_MINIMUM_FIXTURES) {
    known_limits.push("MJP_PASS_NOT_PROVEN");
  }
  const resultWithoutDigest = {
    schema_version: COURSE_BOUND_QUALIFICATION_SCHEMA_VERSION,
    mission_id: input.mission_id,
    consumer_id: input.consumer_id,
    candidate_type: COURSE_BOUND_QUALIFICATION_CANDIDATE_TYPE,
    status: evaluated.status,
    state_transition: { from: "STATE_A" as const, to: "STATE_B" as const },
    exact_binding: {
      binding_digest,
      no_implicit_latest: true as const,
      refs
    },
    candidate: {
      status: evaluated.status,
      reason_codes: evaluated.reason_codes,
      compatibility: evaluated.compatibility,
      formal_binding_eligible: false as const,
      activation_permitted: false as const,
      official_truth_write: false as const,
      settlement_write: false as const,
      parameter_set_formal_write: false as const,
      replay_truth_write: false as const
    },
    evidence: {
      inputs: [
        { ref: refs.course_package, role: "TEACHER_ONLY" as const },
        { ref: refs.scenario_package, role: "TEACHER_ONLY" as const },
        { ref: refs.parameter_set, role: "INTERNAL_RESEARCH_ONLY" as const },
        { ref: refs.model_version, role: "INTERNAL_RESEARCH_ONLY" as const },
        { ref: refs.source_evidence, role: "RESTRICTED" as const }
      ],
      transformations: transformations(input),
      conflicts: evaluated.reason_codes.map((reason) => ({ field: "binding", reason })),
      differential: {
        mode: "NON_OFFICIAL" as const,
        replay_truth_write: false as const,
        official_result_overwrite: false as const
      }
    },
    mjp: {
      status:
        fixtureEvidence.length >= COURSE_BOUND_QUALIFICATION_MINIMUM_FIXTURES
          ? ("PASS" as const)
          : ("SKIP" as const),
      fixture_count: fixtureEvidence.length,
      minimum_fixture_count: COURSE_BOUND_QUALIFICATION_MINIMUM_FIXTURES,
      fixture_ids: fixtureEvidence.map((fixture) => fixture.fixture_id),
      fixtures: fixtureEvidence
    },
    role_visibility: {
      teacher: {
        visibility: "TEACHER_ONLY" as const,
        fields: ["qualification_status", "reason_codes", "compatibility", "exact_binding"]
      },
      student: {
        visibility: "STUDENT_SAFE" as const,
        fields: ["qualification_status", "compatibility_status", "reason_codes", "known_limits"]
      },
      admin: {
        visibility: "INTERNAL_RESEARCH_ONLY" as const,
        fields: ["exact_binding", "evidence", "authority", "known_limits"]
      }
    },
    authority: {
      candidate_writer: "MOD_SUPPORT_CANDIDATE_COMPILER" as const,
      formal_writer: "NONE" as const,
      official_truth_write: false as const,
      settlement_write: false as const,
      parameter_set_formal_write: false as const,
      replay_truth_write: false as const,
      provider: "OFF" as const,
      runtime_authority: "JSON_INTERNAL_ONLY" as const
    },
    join_request: {
      consumer_id: input.consumer_id,
      need_by: input.need_by,
      consumer_ready: false as const,
      exact_binding_required: true as const,
      join_gate: "MAIN_INTEGRATION_LEASE_REQUIRED" as const,
      requested_status: evaluated.status
    },
    known_limits
  } satisfies Omit<CourseBoundQualificationResult, "candidate_digest">;
  return deepFreeze({
    ...resultWithoutDigest,
    candidate_digest: courseBoundStableDigest(resultWithoutDigest)
  });
}

export function assertCourseBoundQualificationResult(value: CourseBoundQualificationResult): void {
  if (
    value.schema_version !== COURSE_BOUND_QUALIFICATION_SCHEMA_VERSION ||
    value.candidate_type !== COURSE_BOUND_QUALIFICATION_CANDIDATE_TYPE ||
    value.state_transition.from !== "STATE_A" ||
    value.state_transition.to !== "STATE_B" ||
    value.exact_binding.no_implicit_latest !== true ||
    !Object.entries(value.exact_binding.refs).every(([type, reference]) =>
      isExactReference(reference, type)
    ) ||
    value.status !== value.candidate.status ||
    value.status !== value.join_request.requested_status ||
    value.join_request.consumer_ready !== false ||
    value.join_request.exact_binding_required !== true ||
    value.authority.formal_writer !== "NONE" ||
    value.authority.provider !== "OFF" ||
    value.authority.official_truth_write !== false ||
    value.authority.settlement_write !== false ||
    value.authority.parameter_set_formal_write !== false ||
    value.authority.replay_truth_write !== false ||
    value.candidate.formal_binding_eligible !== false ||
    value.candidate.activation_permitted !== false ||
    value.candidate.official_truth_write !== false ||
    value.candidate.settlement_write !== false ||
    value.candidate.parameter_set_formal_write !== false ||
    value.candidate.replay_truth_write !== false
  ) {
    throw new Error("COURSE_BOUND_RESULT_AUTHORITY_OR_BINDING_INVALID");
  }
  if (
    value.mjp.fixture_count !== value.mjp.fixtures.length ||
    value.mjp.fixture_ids.length !== value.mjp.fixtures.length ||
    value.mjp.fixture_ids.some(
      (fixtureId, index) => fixtureId !== value.mjp.fixtures[index]?.fixture_id
    ) ||
    value.mjp.fixtures.some(
      (fixture) =>
        fixture.expected_status !== fixture.observed_status ||
        fixture.executed !== true ||
        !DIGEST_PATTERN.test(fixture.input_digest) ||
        !DIGEST_PATTERN.test(fixture.result_digest)
    ) ||
    (value.mjp.status === "PASS" &&
      value.mjp.fixture_count < COURSE_BOUND_QUALIFICATION_MINIMUM_FIXTURES) ||
    (value.mjp.status === "SKIP" &&
      value.mjp.fixture_count >= COURSE_BOUND_QUALIFICATION_MINIMUM_FIXTURES)
  ) {
    throw new Error("COURSE_BOUND_MJP_FIXTURE_INVALID");
  }
  const student = JSON.stringify(value.role_visibility.student);
  if (
    /content_digest|source_ref|tenant_id|raw|private|official|settlement|score|rank/i.test(student)
  ) {
    throw new Error("COURSE_BOUND_STUDENT_VISIBILITY_INVALID");
  }
  const { candidate_digest, ...withoutDigest } = value;
  if (candidate_digest !== courseBoundStableDigest(withoutDigest)) {
    throw new Error("COURSE_BOUND_CANDIDATE_DIGEST_INVALID");
  }
}

export function validateCourseBoundQualificationResult(
  value: unknown
): value is CourseBoundQualificationResult {
  try {
    assertCourseBoundQualificationResult(value as CourseBoundQualificationResult);
    return true;
  } catch {
    return false;
  }
}

export function createDefaultCourseBoundQualificationInput(): CourseBoundQualificationInput {
  const courseReference: CourseBoundExactReference = {
    resource_id: "course-package-demo",
    resource_type: "course_package",
    version: "1.0.0",
    content_digest: "a".repeat(64)
  };
  const scenarioReference: CourseBoundExactReference = {
    resource_id: "scenario-package-demo",
    resource_type: "scenario_package",
    version: "1.0.0",
    content_digest: "b".repeat(64)
  };
  const parameterReference: CourseBoundExactReference = {
    resource_id: "parameter-set-demo",
    resource_type: "parameter_set",
    version: "1.0.0",
    content_digest: "c".repeat(64)
  };
  const modelReference: CourseBoundExactReference = {
    resource_id: "model-version-demo",
    resource_type: "model_version",
    version: "1.0.0",
    content_digest: "d".repeat(64)
  };
  const sourceReference: CourseBoundExactReference = {
    resource_id: "source-evidence-demo",
    resource_type: "source_evidence",
    version: "1.0.0",
    content_digest: "e".repeat(64)
  };
  const parameterSet: ParameterSetQualificationBinding = {
    reference: parameterReference,
    tenant_id: "tenant-demo",
    model_family: "blp",
    feature_mapper_version: "1.0.0",
    parameter_schema_version: "1.0.0",
    feature_schema_digest: "f".repeat(64),
    solver_version: "1.0.0",
    status: "CANDIDATE"
  };
  const scenarioPackage: ScenarioPackageQualificationBinding = {
    reference: scenarioReference,
    tenant_id: "tenant-demo",
    parameter_set_reference: parameterReference,
    model_family: "blp",
    feature_mapper_version: "1.0.0",
    parameter_schema_versions: ["1.0.0"],
    status: "APPROVED"
  };
  const modelVersion: ModelVersionQualificationBinding = {
    reference: modelReference,
    tenant_id: "tenant-demo",
    model_family: "blp",
    feature_mapper_version: "1.0.0",
    parameter_schema_versions: ["1.0.0"],
    solver_version: "1.0.0",
    status: "VALIDATED"
  };
  const sourceEvidence: SourceEvidenceQualificationBinding = {
    reference: sourceReference,
    tenant_id: "tenant-demo",
    course_package_id: courseReference.resource_id,
    feature_schema_digest: parameterSet.feature_schema_digest,
    rights_status: "VALID",
    freshness_status: "FRESH",
    observed_at: "2026-08-30T00:00:00.000Z",
    expires_at: "2027-08-30T00:00:00.000Z"
  };
  const baseEvaluation: CourseBoundQualificationEvaluationInput = {
    need_by: "MAIN-ECF-O1-N+1-MODEL-CONTROL",
    tenant_id: "tenant-demo",
    course_package: {
      reference: courseReference,
      tenant_id: "tenant-demo",
      scenario_package_reference: scenarioReference,
      parameter_set_reference: parameterReference
    },
    scenario_package: scenarioPackage,
    parameter_set: parameterSet,
    model_version: modelVersion,
    source_evidence: sourceEvidence
  };
  const scenarioParameterDrift: CourseBoundQualificationEvaluationInput = {
    ...baseEvaluation,
    scenario_package: {
      ...baseEvaluation.scenario_package,
      parameter_set_reference: { ...parameterReference, content_digest: "0".repeat(64) }
    }
  };
  const staleSource: CourseBoundQualificationEvaluationInput = {
    ...baseEvaluation,
    source_evidence: { ...sourceEvidence, freshness_status: "STALE" }
  };
  const modelFamilyDrift: CourseBoundQualificationEvaluationInput = {
    ...baseEvaluation,
    model_version: { ...modelVersion, model_family: "rcnl" }
  };
  return {
    ...baseEvaluation,
    mission_id: "SIMWAR-MOD-ECF-MQ1-COURSE-BOUND-MODEL-QUALIFICATION-V2.0-20260830",
    consumer_id: "MAIN-ECF-O1-ENTERPRISE-COURSE-FACTORY",
    requested_at: "2026-08-30T00:00:00.000Z",
    mjp_fixtures: [
      {
        fixture_id: "course-bound-eligible-001",
        expected_status: "ELIGIBLE_FOR_SHADOW_WITH_LIMITS",
        input: baseEvaluation
      },
      {
        fixture_id: "course-bound-rebase-parameter-002",
        expected_status: "REBASE_REQUIRED",
        input: scenarioParameterDrift
      },
      {
        fixture_id: "course-bound-stale-source-003",
        expected_status: "NOT_ELIGIBLE",
        input: staleSource
      },
      {
        fixture_id: "course-bound-rebase-model-004",
        expected_status: "REBASE_REQUIRED",
        input: modelFamilyDrift
      }
    ]
  };
}
