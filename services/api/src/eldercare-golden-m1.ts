import { createHash } from "node:crypto";
import type {
  CourseBlueprintReference,
  ParameterSetReference,
  PluginManifest,
  ScenarioPackageReference
} from "@simwar/shared-contracts";
import type { ParameterSetDraftInput, ParameterSetJsonValue } from "./parameter-set-authority.js";
import type {
  ScenarioPackageDraftInput,
  ScenarioPackageJsonValue
} from "./scenario-package-authority.js";
import type { PluginReleaseDraftInput } from "./plugin-release-authority.js";
import type {
  CourseBlueprintDraftInput,
  CourseBlueprintJsonValue
} from "./course-blueprint-authority.js";
import type { CoursePackageVersionDraftInput } from "@simwar/shared-contracts";
import {
  compileShanghaiEldercareScenarioAsset,
  validateEldercareScenarioAsset,
  type EldercareScenarioAsset
} from "@simwar/simulation-core";

const ELDERCARE_WELLNESS_PLUGIN_MANIFEST: PluginManifest = {
  adapter_ref: "@simwar/simulation-core/eldercareWellnessPluginV1",
  industry: "wellness",
  manifest_version: "1.0.0",
  name: "康养行业插件 v1",
  parameter_schema_ref: "contracts/schemas/wellness-parameters.v1.json",
  parameter_schema_version: "wellness.parameters.v1",
  plugin_id: "plugin_wellness_eldercare_v1",
  settlement_hook_refs: [
    "adjustDemand:wellness_eldercare_demand_v1",
    "adjustOperations:wellness_capacity_guardrail_v1",
    "adjustFinance:wellness_partnership_discount_v1",
    "adjustScore:wellness_service_quality_weight_v1"
  ],
  status: "approved",
  supported_hooks: ["adjustDemand", "adjustOperations", "adjustFinance", "adjustScore"],
  version: "1.0.0"
};

export const ELDERCARE_GOLDEN_M1_SYNTHETIC_LABELS = [
  "L0_SYNTHETIC",
  "SYNTHETIC_TEACHING_BASELINE",
  "REALITY_CALIBRATION_NOT_PROVEN"
] as const;

const DEFAULT_ARTIFACT_IDS = {
  parameter_set_id: "parameter_eldercare_shanghai_golden_m1_v1",
  scenario_package_id: "scenario_eldercare_shanghai_golden_m1_v1",
  plugin_package_id: "plugin_wellness_eldercare_v1",
  course_blueprint_id: "blueprint_eldercare_shanghai_golden_m1_v1",
  course_package_id: "course_package_eldercare_shanghai_golden_m1_v1",
  version: "1.0.0"
} as const;

const FORMAL_PLUGIN_PACKAGE_ID = "plugin_wellness_eldercare_v1" as const;
const FORMAL_PLUGIN_VERSION = "1.0.0" as const;
const FORMAL_PARAMETER_MODEL_VERSION = "toy_logit_wellness_v1@0.1.0" as const;
const EXPECTED_R7A_ASSET_ID = "r7a-shanghai-eldercare-core-scenario-v2" as const;

export interface EldercareGoldenM1ArtifactIds {
  parameter_set_id: string;
  scenario_package_id: string;
  plugin_package_id: string;
  course_blueprint_id: string;
  course_package_id: string;
  version: string;
  parameter_set_version?: string;
  scenario_package_version?: string;
  plugin_version?: string;
  course_blueprint_version?: string;
  course_package_version?: string;
}

export interface EldercareGoldenM1Provenance {
  asset_hash?: string;
  compile_hash?: string;
}

export interface EldercareGoldenM1AdapterInput {
  source_tenant_id: string;
  target_tenant_id: string;
  artifact_ids?: Partial<EldercareGoldenM1ArtifactIds>;
  asset?: EldercareScenarioAsset;
  provenance?: EldercareGoldenM1Provenance;
  parameter_set_reference?: ParameterSetReference;
  scenario_package_reference?: ScenarioPackageReference;
  course_blueprint_reference?: CourseBlueprintReference;
}

export class EldercareGoldenM1AdapterError extends Error {
  constructor(
    readonly code: "TENANT_ID_INVALID" | "TENANT_SCOPE_MISMATCH" | "DEPENDENCY_REFERENCE_REQUIRED"
  ) {
    super(code);
    this.name = "EldercareGoldenM1AdapterError";
  }
}

type ResolvedArtifactIds = {
  parameter_set_id: string;
  scenario_package_id: string;
  plugin_package_id: string;
  course_blueprint_id: string;
  course_package_id: string;
  parameter_set_version: string;
  scenario_package_version: string;
  plugin_version: string;
  course_blueprint_version: string;
  course_package_version: string;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new EldercareGoldenM1AdapterError("TENANT_SCOPE_MISMATCH");
  }
  return serialized;
}

export function calculateEldercareGoldenM1AssetHash(asset: EldercareScenarioAsset): string {
  const assetWithoutHash = Object.fromEntries(
    Object.entries(asset).filter(([key]) => key !== "asset_hash")
  );
  return createHash("sha256").update(stableStringify(assetWithoutHash), "utf8").digest("hex");
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function assertNoProtectedParameterFields(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoProtectedParameterFields);
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[_-]/g, "");
    if (
      [
        "statetrue",
        "settlementresult",
        "score",
        "rank",
        "marketshare",
        "demand",
        "serveddemand",
        "cashflow",
        "profit",
        "inventory",
        "capacity",
        "settlementstatus",
        "truthhash",
        "manifesthash",
        "canonicalevidencedigest",
        "pluginruntimetrace",
        "aiformaloutput"
      ].includes(normalizedKey) ||
      normalizedKey.includes("replay") ||
      normalizedKey.includes("private") ||
      normalizedKey.startsWith("official")
    ) {
      throw new EldercareGoldenM1AdapterError("TENANT_SCOPE_MISMATCH");
    }
    assertNoProtectedParameterFields(child);
  }
}

function assertExactReferenceKeys(value: unknown, expectedKeys: readonly string[]): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new EldercareGoldenM1AdapterError("TENANT_SCOPE_MISMATCH");
  }

  const actualKeys = Object.keys(value);
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => !expectedKeys.includes(key))
  ) {
    throw new EldercareGoldenM1AdapterError("TENANT_SCOPE_MISMATCH");
  }
}

function assertAssetIsSafe(
  asset: EldercareScenarioAsset,
  provenance: EldercareGoldenM1Provenance | undefined
): void {
  const validationErrors = validateEldercareScenarioAsset(asset);
  if (
    validationErrors.length > 0 ||
    asset.asset_id !== EXPECTED_R7A_ASSET_ID ||
    asset.status_boundary.g0_status !== "EXCEPTION" ||
    asset.status_boundary.g0_pass !== "NOT_GRANTED" ||
    asset.status_boundary.l1_status !== "NOT_READY" ||
    asset.synthetic_data_policy.calibration_status !== "UN_CALIBRATED" ||
    asset.synthetic_data_policy.geography_scope !== "SHANGHAI_SYNTHETIC_ONLY" ||
    asset.synthetic_data_policy.real_user_data ||
    asset.synthetic_data_policy.real_payment_data ||
    asset.synthetic_data_policy.production_identifier ||
    asset.scenario_package.status !== "approved" ||
    asset.parameter_set.status !== "candidate" ||
    asset.scenario_package.plugin_package_ids.length !== 1 ||
    asset.scenario_package.plugin_package_ids[0] !== FORMAL_PLUGIN_PACKAGE_ID ||
    !asset.parameter_set.parameters ||
    asset.parameter_set.parameters.schema_version !== "wellness.parameters.v1"
  ) {
    throw new EldercareGoldenM1AdapterError("TENANT_SCOPE_MISMATCH");
  }

  const roundTitles = new Set<string>();
  if (
    asset.rounds.some((round, index) => {
      const duplicateTitle = roundTitles.has(round.title);
      roundTitles.add(round.title);
      return (
        !Number.isInteger(round.round_no) ||
        round.round_no !== index + 1 ||
        round.title.trim().length === 0 ||
        duplicateTitle ||
        round.decision_focus.length === 0 ||
        round.decision_focus.some((focus) => focus.trim().length === 0) ||
        round.evidence_boundary !== "SOURCE_ONLY_INFERENCE"
      );
    })
  ) {
    throw new EldercareGoldenM1AdapterError("TENANT_SCOPE_MISMATCH");
  }

  assertNoProtectedParameterFields(asset.parameter_set);
  assertNoProtectedParameterFields(asset.rounds);

  const calculatedAssetHash = calculateEldercareGoldenM1AssetHash(asset);
  if (
    asset.asset_hash !== calculatedAssetHash ||
    (provenance?.asset_hash !== undefined && provenance.asset_hash !== calculatedAssetHash) ||
    (provenance?.compile_hash !== undefined && !isSha256(provenance.compile_hash))
  ) {
    throw new EldercareGoldenM1AdapterError("TENANT_SCOPE_MISMATCH");
  }
}

function requireTenant(value: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim()) {
    throw new EldercareGoldenM1AdapterError("TENANT_ID_INVALID");
  }
  return value;
}

function requireArtifactId(value: string | undefined, fallback: string): string {
  const resolved = value ?? fallback;
  if (
    typeof resolved !== "string" ||
    resolved.trim().length === 0 ||
    resolved !== resolved.trim()
  ) {
    throw new EldercareGoldenM1AdapterError("TENANT_ID_INVALID");
  }
  return resolved;
}

function resolveArtifactIds(input: EldercareGoldenM1AdapterInput): ResolvedArtifactIds {
  const overrides = input.artifact_ids ?? {};
  const version = requireArtifactId(overrides.version, DEFAULT_ARTIFACT_IDS.version);

  return {
    parameter_set_id: requireArtifactId(
      overrides.parameter_set_id,
      DEFAULT_ARTIFACT_IDS.parameter_set_id
    ),
    scenario_package_id: requireArtifactId(
      overrides.scenario_package_id,
      DEFAULT_ARTIFACT_IDS.scenario_package_id
    ),
    plugin_package_id: requireArtifactId(
      overrides.plugin_package_id,
      DEFAULT_ARTIFACT_IDS.plugin_package_id
    ),
    course_blueprint_id: requireArtifactId(
      overrides.course_blueprint_id,
      DEFAULT_ARTIFACT_IDS.course_blueprint_id
    ),
    course_package_id: requireArtifactId(
      overrides.course_package_id,
      DEFAULT_ARTIFACT_IDS.course_package_id
    ),
    parameter_set_version: requireArtifactId(overrides.parameter_set_version, version),
    scenario_package_version: requireArtifactId(overrides.scenario_package_version, version),
    plugin_version: requireArtifactId(overrides.plugin_version, version),
    course_blueprint_version: requireArtifactId(overrides.course_blueprint_version, version),
    course_package_version: requireArtifactId(overrides.course_package_version, version)
  };
}

interface ResolvedContext {
  asset: EldercareScenarioAsset;
  artifacts: ResolvedArtifactIds;
  source_tenant_id: string;
  target_tenant_id: string;
  provenance: { asset_hash: string; compile_hash?: string };
}

function resolveContext(input: EldercareGoldenM1AdapterInput): ResolvedContext {
  const sourceTenantId = requireTenant(input.source_tenant_id);
  const targetTenantId = requireTenant(input.target_tenant_id);
  if (sourceTenantId === targetTenantId) {
    throw new EldercareGoldenM1AdapterError("TENANT_SCOPE_MISMATCH");
  }

  const asset = input.asset ?? compileShanghaiEldercareScenarioAsset();
  assertAssetIsSafe(asset, input.provenance);
  if (
    asset.parameter_set.tenant_id !== sourceTenantId ||
    asset.scenario_package.tenant_id !== sourceTenantId
  ) {
    throw new EldercareGoldenM1AdapterError("TENANT_SCOPE_MISMATCH");
  }

  const artifacts = resolveArtifactIds(input);
  if (
    artifacts.plugin_package_id !== FORMAL_PLUGIN_PACKAGE_ID ||
    artifacts.plugin_version !== FORMAL_PLUGIN_VERSION
  ) {
    throw new EldercareGoldenM1AdapterError("TENANT_SCOPE_MISMATCH");
  }
  return {
    asset,
    artifacts,
    source_tenant_id: sourceTenantId,
    target_tenant_id: targetTenantId,
    provenance: {
      asset_hash: asset.asset_hash,
      ...(input.provenance?.compile_hash ? { compile_hash: input.provenance.compile_hash } : {})
    }
  };
}

function syntheticClassification(): string {
  return ELDERCARE_GOLDEN_M1_SYNTHETIC_LABELS.join("|");
}

function requireParameterReference(context: EldercareGoldenM1AdapterInput): ParameterSetReference {
  if (!context.parameter_set_reference) {
    throw new EldercareGoldenM1AdapterError("DEPENDENCY_REFERENCE_REQUIRED");
  }
  assertExactReferenceKeys(context.parameter_set_reference, [
    "content_digest",
    "parameter_set_id",
    "version"
  ]);
  return clone(context.parameter_set_reference);
}

function requireScenarioReference(
  context: EldercareGoldenM1AdapterInput
): ScenarioPackageReference {
  if (!context.scenario_package_reference) {
    throw new EldercareGoldenM1AdapterError("DEPENDENCY_REFERENCE_REQUIRED");
  }
  assertExactReferenceKeys(context.scenario_package_reference, [
    "content_digest",
    "scenario_package_id",
    "tenant_id",
    "version"
  ]);
  return clone(context.scenario_package_reference);
}

function requireBlueprintReference(
  context: EldercareGoldenM1AdapterInput
): CourseBlueprintReference {
  if (!context.course_blueprint_reference) {
    throw new EldercareGoldenM1AdapterError("DEPENDENCY_REFERENCE_REQUIRED");
  }
  assertExactReferenceKeys(context.course_blueprint_reference, [
    "content_digest",
    "course_blueprint_id",
    "tenant_id",
    "version"
  ]);
  return clone(context.course_blueprint_reference);
}

function assertParameterReference(
  reference: ParameterSetReference,
  artifacts: ResolvedArtifactIds
): void {
  if (
    reference.parameter_set_id !== artifacts.parameter_set_id ||
    reference.version !== artifacts.parameter_set_version ||
    !isSha256(reference.content_digest)
  ) {
    throw new EldercareGoldenM1AdapterError("TENANT_SCOPE_MISMATCH");
  }
}

function assertScenarioReference(
  reference: ScenarioPackageReference,
  artifacts: ResolvedArtifactIds,
  targetTenantId: string
): void {
  if (
    reference.scenario_package_id !== artifacts.scenario_package_id ||
    reference.version !== artifacts.scenario_package_version ||
    !isSha256(reference.content_digest) ||
    reference.tenant_id !== targetTenantId
  ) {
    throw new EldercareGoldenM1AdapterError("TENANT_SCOPE_MISMATCH");
  }
}

function assertTargetReferenceTenant(
  reference: { tenant_id: string },
  targetTenantId: string
): void {
  if (reference.tenant_id !== targetTenantId) {
    throw new EldercareGoldenM1AdapterError("TENANT_SCOPE_MISMATCH");
  }
}

interface EldercareGoldenM1RoundMetadata {
  decision_focus: string[];
  evidence_boundary: "SOURCE_ONLY_INFERENCE";
  round_no: number;
  title: string;
}

function roundMetadata(asset: EldercareScenarioAsset): EldercareGoldenM1RoundMetadata[] {
  return asset.rounds.map((round) => ({
    decision_focus: [...round.decision_focus],
    evidence_boundary: round.evidence_boundary,
    round_no: round.round_no,
    title: round.title
  }));
}

function provenanceMetadata(context: ResolvedContext): Record<string, ScenarioPackageJsonValue> {
  return {
    asset_hash: context.provenance.asset_hash,
    ...(context.provenance.compile_hash ? { compile_hash: context.provenance.compile_hash } : {})
  };
}

export function createEldercareGoldenM1ParameterDraft(
  input: EldercareGoldenM1AdapterInput
): ParameterSetDraftInput {
  const context = resolveContext(input);
  const { asset, artifacts } = context;
  const sourceParameters = asset.parameter_set.parameters;
  const runtime_parameter_set = {
    base_capacity: asset.parameter_set.base_capacity,
    base_market_size: asset.parameter_set.base_market_size,
    fixed_cost: asset.parameter_set.fixed_cost,
    model_family: asset.parameter_set.model_family,
    unit_cost: asset.parameter_set.unit_cost
  };

  const parameter_values = {
    base_capacity: asset.parameter_set.base_capacity,
    base_market_size: asset.parameter_set.base_market_size,
    fixed_cost: asset.parameter_set.fixed_cost,
    model_family: asset.parameter_set.model_family,
    seed: asset.parameter_set.seed,
    unit_cost: asset.parameter_set.unit_cost,
    runtime_parameter_set,
    ...(sourceParameters ? { parameters: clone(sourceParameters) } : {})
  } as unknown as ParameterSetJsonValue;

  return {
    compatibility_metadata: {
      engine_family: "eldercare-core.v1",
      parameter_schema: sourceParameters?.schema_version ?? "eldercare.parameters.v1",
      source_asset_hash: context.provenance.asset_hash,
      source_asset_id: asset.asset_id,
      source_tenant_id: context.source_tenant_id,
      synthetic_data_classification: syntheticClassification()
    },
    model_version_ref: FORMAL_PARAMETER_MODEL_VERSION,
    parameter_set_id: artifacts.parameter_set_id,
    parameter_values,
    schema_version: "parameter-set.v1",
    tenant_id: context.target_tenant_id,
    version: artifacts.parameter_set_version
  };
}

export function createEldercareGoldenM1ScenarioDraft(
  input: EldercareGoldenM1AdapterInput
): ScenarioPackageDraftInput {
  const context = resolveContext(input);
  const { asset, artifacts } = context;
  const parameterSetReference = requireParameterReference(input);
  assertParameterReference(parameterSetReference, artifacts);
  if (input.scenario_package_reference) {
    const scenarioPackageReference = requireScenarioReference(input);
    assertScenarioReference(scenarioPackageReference, artifacts, context.target_tenant_id);
  }
  const content: ScenarioPackageJsonValue = {
    asset_id: asset.asset_id,
    evidence_boundary: "SOURCE_ONLY_INFERENCE",
    geography_scope: asset.synthetic_data_policy.geography_scope,
    name: asset.scenario_package.name,
    plugin_package_ids: [artifacts.plugin_package_id],
    runtime_scenario_package: {
      name: asset.scenario_package.name,
      plugin_package_ids: [artifacts.plugin_package_id]
    },
    rounds: roundMetadata(asset) as unknown as readonly ScenarioPackageJsonValue[],
    synthetic_data_classification: [...ELDERCARE_GOLDEN_M1_SYNTHETIC_LABELS],
    version: artifacts.scenario_package_version
  };

  return {
    artifact_policy: {
      artifact_media_type: "application/json",
      mode: "INLINE",
      retention: "IMMUTABLE"
    },
    compatibility_metadata: {
      engine_family: "eldercare-core.v1",
      source_asset_id: asset.asset_id,
      source_tenant_id: context.source_tenant_id,
      synthetic_data_classification: syntheticClassification()
    },
    content,
    metadata: {
      calibration_status: asset.synthetic_data_policy.calibration_status,
      geography_scope: asset.synthetic_data_policy.geography_scope,
      provenance: provenanceMetadata(context),
      runtime_authority: "scenario_asset_only",
      synthetic_data_classification: [...ELDERCARE_GOLDEN_M1_SYNTHETIC_LABELS]
    },
    parameter_set_reference: parameterSetReference,
    plugin_dependencies: [
      {
        plugin_package_id: artifacts.plugin_package_id,
        version: artifacts.plugin_version
      }
    ],
    scenario_package_id: artifacts.scenario_package_id,
    schema_version: "scenario-package.v1",
    tenant_id: context.target_tenant_id,
    version: artifacts.scenario_package_version
  };
}

export function createEldercareGoldenM1PluginDraft(
  input: EldercareGoldenM1AdapterInput
): PluginReleaseDraftInput {
  const context = resolveContext(input);
  const { asset, artifacts } = context;
  const plugin_manifest = {
    ...clone(ELDERCARE_WELLNESS_PLUGIN_MANIFEST),
    plugin_id: artifacts.plugin_package_id,
    status: "approved" as const,
    version: artifacts.plugin_version
  };

  return {
    compatibility_metadata: {
      engine_family: "eldercare-core.v1",
      parameter_schema: plugin_manifest.parameter_schema_version,
      source_asset_hash: context.provenance.asset_hash,
      source_asset_id: asset.asset_id,
      synthetic_data_classification: syntheticClassification()
    },
    official_commit_permissions: [],
    plugin_manifest,
    plugin_package_id: artifacts.plugin_package_id,
    schema_version: "plugin-release.v1",
    version: artifacts.plugin_version
  };
}

export function createEldercareGoldenM1BlueprintDraft(
  input: EldercareGoldenM1AdapterInput
): CourseBlueprintDraftInput {
  const context = resolveContext(input);
  const { asset, artifacts } = context;
  const rounds = roundMetadata(asset);
  const ordered_phases = rounds.map((round) => ({
    activity_type: "structured_decision_review",
    duration_minutes: 30,
    order: round.round_no,
    phase_id: `${artifacts.course_blueprint_id}:phase:${round.round_no}`,
    student_instruction: `Review the ${round.title.toLowerCase()} evidence boundary and submit a structured teaching decision.`,
    teacher_guidance: `Facilitate ${round.title.toLowerCase()} using source-only inference; do not present synthetic inputs as production evidence.`,
    title: round.title
  }));
  const activity_plan: CourseBlueprintJsonValue[] = rounds.map(
    (round) =>
      ({
        activity_id: `${artifacts.course_blueprint_id}:activity:${round.round_no}`,
        decision_focus: round.decision_focus,
        evidence_boundary: round.evidence_boundary,
        phase_id: `${artifacts.course_blueprint_id}:phase:${round.round_no}`,
        round_no: round.round_no,
        title: round.title
      }) as unknown as CourseBlueprintJsonValue
  );

  return {
    activity_plan,
    course_blueprint_id: artifacts.course_blueprint_id,
    description:
      "Synthetic Shanghai eldercare teaching baseline for structured six-round decision practice; reality calibration is not proven.",
    duration_minutes: ordered_phases.reduce((total, phase) => total + phase.duration_minutes, 0),
    instructor_guidance_reference: "eldercare-shanghai-golden-m1.instructor-guide.v1",
    objectives: [
      "Interpret source-only eldercare demand and capacity signals.",
      "Compare service quality, payer mix and license-boundary trade-offs.",
      "Practice deterministic, non-overwriting decision review."
    ],
    ordered_phases,
    required_product_capabilities: [
      "scenario_package_binding",
      "structured_decision_submission",
      "round_lock_and_settlement",
      "student_safe_feedback"
    ],
    scenario_compatibility_constraints: {
      parameter_set_id: artifacts.parameter_set_id,
      parameter_set_version: artifacts.parameter_set_version,
      plugin_package_id: artifacts.plugin_package_id,
      plugin_version: artifacts.plugin_version,
      scenario_package_id: artifacts.scenario_package_id,
      scenario_package_version: artifacts.scenario_package_version,
      synthetic_data_classification: syntheticClassification()
    },
    schema_version: "course-blueprint.v1",
    tenant_id: context.target_tenant_id,
    title: "Shanghai Eldercare Golden M1 · Synthetic Teaching Baseline",
    version: artifacts.course_blueprint_version
  };
}

export function createEldercareGoldenM1CoursePackageDraft(
  input: EldercareGoldenM1AdapterInput
): CoursePackageVersionDraftInput {
  const context = resolveContext(input);
  const { asset, artifacts } = context;
  const parameterSetReference = requireParameterReference(input);
  const scenarioPackageReference = requireScenarioReference(input);
  const courseBlueprintReference = requireBlueprintReference(input);
  assertParameterReference(parameterSetReference, artifacts);
  assertScenarioReference(scenarioPackageReference, artifacts, context.target_tenant_id);
  assertTargetReferenceTenant(courseBlueprintReference, context.target_tenant_id);

  if (
    !isSha256(scenarioPackageReference.content_digest) ||
    !isSha256(courseBlueprintReference.content_digest) ||
    scenarioPackageReference.scenario_package_id !== artifacts.scenario_package_id ||
    scenarioPackageReference.version !== artifacts.scenario_package_version ||
    courseBlueprintReference.course_blueprint_id !== artifacts.course_blueprint_id ||
    courseBlueprintReference.version !== artifacts.course_blueprint_version
  ) {
    throw new EldercareGoldenM1AdapterError("TENANT_SCOPE_MISMATCH");
  }

  return {
    course_blueprint_reference: courseBlueprintReference,
    course_package_id: artifacts.course_package_id,
    description: `Shanghai Eldercare Golden M1 course package (${ELDERCARE_GOLDEN_M1_SYNTHETIC_LABELS.join(", ")}); source asset ${asset.asset_id}.`,
    parameter_set_reference: parameterSetReference,
    scenario_package_reference: scenarioPackageReference,
    title: "Shanghai Eldercare Golden M1 · Synthetic Teaching Baseline",
    version: artifacts.course_package_version
  };
}
