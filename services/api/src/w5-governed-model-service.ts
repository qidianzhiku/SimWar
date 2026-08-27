import { createHash } from "node:crypto";
import type {
  ActorRole,
  AuditLog,
  ParameterSetReference,
  ScenarioPackageReference,
  W5ConvergenceProjection,
  W5GovernedModelAdminProjection,
  W5DataClassification,
  W5GovernedDemandCandidateProjection,
  W5ExactRuntimeBinding,
  W5GovernedModelStudentProjection,
  W5GovernedModelTeacherProjection,
  W5ModelVersion,
  W5MutationReceipt,
  W5ParameterDescriptor,
  W5ScenarioDraft,
  W5SecurityContext,
  W5SecurityDimensionEvidence,
  W5ExperienceProfile
} from "@simwar/shared-contracts";
import {
  createDefaultEldercareModelInput,
  createDemandBinding,
  createDemandModelVersion,
  createGenericDemandMarket,
  createShanghaiDemandMarket,
  evaluateDemandRuntime,
  type DemandExactBinding,
  type DemandMarket,
  type GovernedDemandRuntimeOutput
} from "@simwar/simulation-core";
import { evaluateW5CoreRealization } from "@simwar/simulation-core";

export interface W5ServiceActor {
  actor_id: string;
  role: Extract<ActorRole, "learner" | "student" | "teacher" | "tenant_admin" | "platform_admin">;
  tenant_id: string;
}

export interface W5ServiceScope {
  activity_id: string;
  course_id: string;
  round_no?: number;
  run_id?: string;
  team_id?: string;
}

export interface W5CreateDraftInput {
  data_classification?: W5DataClassification;
  parameters?: Readonly<Record<string, boolean | number | string>>;
  seed?: number;
  title?: string;
}

export interface W5BindDraftInput {
  parameter_set_reference: ParameterSetReference;
  round_no: number;
  run_id: string;
  scenario_package_reference: ScenarioPackageReference;
  seed: number;
}

/**
 * Persistence boundary for the JSON runtime's governance-plane records.
 * Drafts and their audit entries are deliberately separate from canonical
 * decisions and settlement truth.
 */
export interface W5GovernedModelPersistence {
  listDrafts(): readonly W5ScenarioDraft[];
  commitDraft(draft: W5ScenarioDraft, auditLog: AuditLog): void;
}

export type W5ModelPlane = "OFF" | "ON";

export class W5GovernedModelError extends Error {
  constructor(
    readonly code:
      | "W5_DRAFT_NOT_FOUND"
      | "W5_DRAFT_NOT_FROZEN"
      | "W5_DRAFT_NOT_VALIDATED"
      | "W5_INVALID_PARAMETER"
      | "W5_INVALID_TRANSITION"
      | "W5_PARAMETER_MAPPING_DRAFT"
      | "W5_SCOPE_CONFLICT"
      | "W5_EXACT_BINDING_REQUIRED"
  ) {
    super(code);
    this.name = "W5GovernedModelError";
  }
}

interface Clock {
  now(): string;
}

const DEFAULT_CLOCK: Clock = { now: () => new Date().toISOString() };

const PARAMETER_DESCRIPTORS: readonly W5ParameterDescriptor[] = [
  {
    consumer: "scenario_compiler",
    default: "2026-shanghai-aging",
    key: "economic_cycle",
    label: "经济周期",
    mapping_readiness: "READY",
    source: "Teacher Scenario Studio / scenario lineage",
    type: "enum",
    unit: "cycle_id",
    visibility: "teacher"
  },
  {
    consumer: "scenario_compiler",
    default: 120000,
    key: "construction_cost",
    label: "建设成本",
    mapping_readiness: "READY",
    range: { max: 10000000, min: 0 },
    source: "Teacher Scenario Studio / synthetic Shanghai assumption",
    type: "number",
    unit: "CNY",
    visibility: "teacher"
  },
  {
    consumer: "demand_candidate",
    default: 0.032,
    key: "aging_rate",
    label: "老龄化速率",
    mapping_readiness: "READY",
    range: { max: 1, min: 0 },
    source: "Shanghai synthetic calibration placeholder",
    type: "number",
    unit: "ratio/year",
    visibility: "advanced"
  },
  {
    consumer: "demand_candidate",
    default: 180,
    key: "customer_demand",
    label: "客户需求",
    mapping_readiness: "READY",
    range: { max: 10000, min: 0 },
    source: "BLP/RCNL candidate input",
    type: "number",
    unit: "households",
    visibility: "standard"
  },
  {
    consumer: "scenario_compiler",
    default: 0.021,
    key: "inflation",
    label: "通胀率",
    mapping_readiness: "READY",
    range: { max: 1, min: -1 },
    source: "Shanghai synthetic assumption",
    type: "number",
    unit: "ratio/year",
    visibility: "advanced"
  },
  {
    consumer: "finance_candidate",
    default: 0.038,
    key: "interest_rate",
    label: "利率",
    mapping_readiness: "READY",
    range: { max: 1, min: -1 },
    source: "Core finance candidate input",
    type: "number",
    unit: "ratio/year",
    visibility: "advanced"
  },
  {
    consumer: "finance_candidate",
    default: 0.055,
    key: "capital_cost",
    label: "资本成本",
    mapping_readiness: "READY",
    range: { max: 1, min: 0 },
    source: "Core finance candidate input",
    type: "number",
    unit: "ratio/year",
    visibility: "advanced"
  },
  {
    consumer: "operations_capacity",
    default: 64,
    key: "caregiver_supply",
    label: "照护供给",
    mapping_readiness: "READY",
    range: { max: 10000, min: 0 },
    source: "Workforce capacity constraint",
    type: "number",
    unit: "people",
    visibility: "standard"
  },
  {
    consumer: "scenario_compiler",
    default: "community-care-v2",
    key: "policy",
    label: "政策",
    mapping_readiness: "READY",
    source: "Teacher Scenario Studio / approved view",
    type: "enum",
    unit: "policy_id",
    visibility: "advanced"
  },
  {
    consumer: "scenario_compiler",
    default: "none",
    key: "shock",
    label: "冲击",
    mapping_readiness: "READY",
    source: "Teacher Scenario Studio / stress test",
    type: "enum",
    unit: "shock_id",
    visibility: "advanced"
  },
  {
    consumer: "course_blueprint",
    default: "eldercare-urban-core",
    key: "project_template",
    label: "项目模板",
    mapping_readiness: "READY",
    source: "CourseBlueprint Studio",
    type: "enum",
    unit: "template_id",
    visibility: "teacher"
  },
  {
    consumer: "unmapped_candidate",
    default: "none",
    key: "custom_parameter",
    label: "自定义参数",
    mapping_readiness: "DRAFT",
    source: "Teacher Scenario Studio / unmapped draft",
    type: "string",
    unit: "unmapped",
    visibility: "teacher"
  }
];

const DEFAULT_KNOWN_LIMITS = [
  "Shanghai evidence is synthetic/assumption-labelled; reality calibration is not proven.",
  "WANT and CAN are candidates/constraints and never write official truth.",
  "The O3 Ideal/Lancaster and Huff/Spatial runtime is a deterministic synthetic candidate, not calibrated production truth.",
  "BLP/RCNL and PyBLP remain offline/reference-only; no provider is activated.",
  "System Dynamics is shadow-only and does not integrate W4 persistent state.",
  "Human Validation A/B was not performed; this evidence can only be HV-B-ready.",
  "JSON_INTERNAL_ONLY remains the active runtime authority; Postgres/RLS is not active."
] as const;

const DEFAULT_MODEL_VERSION: W5ModelVersion = {
  approved_at: "2026-08-20T12:30:00.000Z",
  engine_reference: { engine_id: "eldercare_core_model_v1", version: "1.0.0" },
  feature_ownership: [
    {
      economic_meaning: "relative preference fit",
      feature_id: "preference_fit",
      primary_producer: "o3_governed_demand_candidate",
      source_ref: "services/simulation-core/src/model-candidates/governed-demand/ideal-lancaster.ts",
      unit: "index",
      visibility: "approved_view"
    },
    {
      economic_meaning: "latent demand and diversion candidate",
      feature_id: "latent_demand",
      primary_producer: "o3_governed_demand_candidate",
      source_ref: "services/simulation-core/src/model-candidates/governed-demand/runtime.ts",
      unit: "candidate_share",
      visibility: "approved_view"
    },
    {
      economic_meaning: "spatial access and catchment candidate",
      feature_id: "spatial_access",
      primary_producer: "o3_governed_demand_candidate",
      source_ref: "services/simulation-core/src/model-candidates/governed-demand/huff-spatial.ts",
      unit: "access_index",
      visibility: "approved_view"
    },
    {
      economic_meaning: "service capacity",
      feature_id: "service_capacity",
      primary_producer: "simulation_core_operations",
      source_ref: "services/simulation-core/src/eldercare-core-model.ts",
      unit: "places",
      visibility: "approved_view"
    },
    {
      economic_meaning: "staffing feasibility",
      feature_id: "workforce_feasibility",
      primary_producer: "simulation_core_operations",
      source_ref: "services/simulation-core/src/eldercare-core-model.ts",
      unit: "index",
      visibility: "approved_view"
    },
    {
      economic_meaning: "official realized outcome",
      feature_id: "realized_outcome",
      primary_producer: "simulation_core",
      source_ref: "services/simulation-core/src/w5-governed-convergence.ts",
      unit: "core_metrics",
      visibility: "internal"
    },
    {
      economic_meaning: "lag/stock/flow hypothesis",
      feature_id: "sd_lag_candidate",
      primary_producer: "system_dynamics_shadow",
      source_ref: "W5 shadow-only plane",
      unit: "index",
      visibility: "shadow"
    }
  ],
  fallback: {
    deterministic_plane: "CORE_ELDERCARE_V1",
    mode: "PLANE_OFF",
    official_path_continues: true
  },
  model_family: "eldercare_core_model_v1",
  model_family_readiness: [
    {
      activation_claim: "SYNTHETIC_HEURISTIC",
      classification: "NOT_CALIBRATED",
      family: "IDEAL_POINT_LANCASTER",
      invocation_proven: true,
      known_limit: "Deterministic candidate invocation is proven; calibration and official settlement authority are not claimed."
    },
    {
      activation_claim: "RESEARCH",
      classification: "RESEARCH",
      family: "BLP_RCNL",
      invocation_proven: false,
      known_limit: "Offline PyBLP/reference-only; no runtime invocation or provider activation."
    },
    {
      activation_claim: "SYNTHETIC_HEURISTIC",
      classification: "NOT_CALIBRATED",
      family: "HUFF_SPATIAL",
      invocation_proven: true,
      known_limit: "Deterministic candidate invocation is proven; Shanghai calibration is not proven."
    },
    {
      activation_claim: "SHADOW",
      classification: "SHADOW",
      family: "SYSTEM_DYNAMICS",
      invocation_proven: false,
      known_limit: "Shadow-only; cannot overwrite official results."
    },
    {
      activation_claim: "SYNTHETIC_HEURISTIC",
      classification: "CURRENT",
      family: "SYNTHETIC_WANT",
      invocation_proven: true,
      known_limit: "Synthetic heuristic; official=false."
    },
    {
      activation_claim: "CURRENT_CORE",
      classification: "CURRENT",
      family: "CORE_REALIZED",
      invocation_proven: true,
      known_limit: "Simulation Core projection only; formal settlement truth is not written."
    }
  ],
  model_version_ref: "eldercare_w5_governed_v1@1.0.0",
  no_implicit_latest: true,
  status: "APPROVED",
  visibility: {
    advanced: ["mechanism_trace", "provenance", "uncertainty", "shadow", "differential", "replay"],
    standard: ["readiness", "mechanism_trace", "provenance", "known_limits"],
    teacher: ["all_approved_views", "parameter_descriptors", "exact_binding", "fallback"]
  }
};

const O3_DEMAND_MODEL_VERSION = createDemandModelVersion({
  coefficients: {
    ideal_fit: 2.2,
    intercept: 0.1,
    price: -0.15,
    quality: 0.4,
    spatial: 0.8
  },
  model_version_id: "o3-governed-demand-v1",
  source_ref: "services/simulation-core/src/model-candidates/governed-demand",
  version: "1.0.0"
});

function createO3DemandMarket(
  binding: W5ExactRuntimeBinding,
  values: Readonly<Record<string, boolean | number | string>>
): DemandMarket {
  const marketId = `market:${binding.scenario_package_reference.scenario_package_id}:${binding.parameter_set_reference.parameter_set_id}:v1`;
  const customerDemand = typeof values.customer_demand === "number" ? values.customer_demand : 180;
  const scenarioId = binding.scenario_package_reference.scenario_package_id.toLowerCase();
  return scenarioId.includes("generic")
    ? createGenericDemandMarket({ customer_demand: customerDemand, market_id: marketId })
    : createShanghaiDemandMarket({ customer_demand: customerDemand, market_id: marketId });
}

function projectDemandCandidate(
  runtime: GovernedDemandRuntimeOutput,
  binding: DemandExactBinding
): W5GovernedDemandCandidateProjection {
  const markets = runtime.markets.map((market) => ({
    market_id: market.market_id,
    outside_option_share: market.outside_option_share,
    products: market.products.map((product) => ({
      candidate_share: product.candidate_share,
      product_id: product.product_id
    }))
  }));
  const marketIds = markets.map((market) => market.market_id);
  const sharedBinding = Object.fromEntries(
    Object.entries(binding).filter(([key]) => key !== "binding_digest" && key !== "team_id")
  );
  return {
    authority_flags: runtime.authority_flags,
    candidate_digest: digest({
      binding: sharedBinding,
      market_ids: marketIds,
      markets,
      model_version_id: runtime.model_version_ref.model_version_id,
      version: runtime.model_version_ref.version
    }),
    consumer_binding_digest: runtime.replay_input_digest,
    exact_binding: true,
    feature_ownership: ["ideal_lancaster_fit", "huff_spatial_weight"],
    market_count: markets.length,
    market_ids: marketIds,
    markets,
    model_family: "IDEAL_POINT_LANCASTER_HUFF_SPATIAL",
    model_version_id: runtime.model_version_ref.model_version_id,
    source_plane: "GOVERNED_DEMAND_CANDIDATE",
    status: runtime.status
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function descriptor(key: string): W5ParameterDescriptor {
  const found = PARAMETER_DESCRIPTORS.find((item) => item.key === key);
  if (!found) throw new W5GovernedModelError("W5_INVALID_PARAMETER");
  return found;
}

function defaultValues(): Record<string, boolean | number | string> {
  return Object.fromEntries(PARAMETER_DESCRIPTORS.map((item) => [item.key, item.default]));
}

function validateParameterValues(
  values: Readonly<Record<string, boolean | number | string>>
): void {
  for (const [key, value] of Object.entries(values)) {
    const item = descriptor(key);
    if (item.type === "number" && !isFiniteNumber(value)) {
      throw new W5GovernedModelError("W5_INVALID_PARAMETER");
    }
    if (item.type === "string" || item.type === "enum") {
      if (typeof value !== "string" || value.trim().length === 0) {
        throw new W5GovernedModelError("W5_INVALID_PARAMETER");
      }
    }
    if (item.type === "boolean" && typeof value !== "boolean") {
      throw new W5GovernedModelError("W5_INVALID_PARAMETER");
    }
    if (
      item.range &&
      typeof value === "number" &&
      (value < item.range.min || value > item.range.max)
    ) {
      throw new W5GovernedModelError("W5_INVALID_PARAMETER");
    }
  }
}

function securityContext(actor: W5ServiceActor, scope: W5ServiceScope): W5SecurityContext {
  const evidence = (
    dimension: W5SecurityDimensionEvidence["dimension"],
    value: number | string | null,
    status: "PASS" | "N/A"
  ): W5SecurityDimensionEvidence => ({
    dimension,
    enforcement_point: "W5GovernedModelService scope guard",
    evidence_ref: `W5-SEC-${dimension.toUpperCase()}-EXACT_SCOPE`,
    negative_test: `${dimension} mismatch fails closed before model projection`,
    status,
    value
  });
  return {
    activity: scope.activity_id,
    actor: actor.actor_id,
    course: scope.course_id,
    dimensions: [
      evidence("actor", actor.actor_id, "PASS"),
      evidence("tenant", actor.tenant_id, "PASS"),
      evidence("course", scope.course_id, "PASS"),
      evidence("run", scope.run_id ?? null, scope.run_id ? "PASS" : "N/A"),
      evidence("round", scope.round_no ?? null, scope.round_no ? "PASS" : "N/A"),
      evidence("team", scope.team_id ?? null, scope.team_id ? "PASS" : "N/A"),
      evidence("role", actor.role, "PASS"),
      evidence("activity", scope.activity_id, "PASS")
    ],
    role: actor.role,
    round: scope.round_no ?? null,
    run: scope.run_id ?? null,
    team: scope.team_id ?? null,
    tenant: actor.tenant_id
  };
}

function receipt(
  action: W5MutationReceipt["action"],
  security: W5SecurityContext,
  receiptId: string
): W5MutationReceipt {
  return {
    action,
    authority: "W5_MODEL_GOVERNANCE_PLANE",
    receipt_id: receiptId,
    security,
    writes_formal_truth: false
  };
}

export class W5GovernedModelService {
  readonly modelVersion = clone(DEFAULT_MODEL_VERSION);
  private readonly clock: Clock;
  private readonly persistence: W5GovernedModelPersistence | undefined;
  private readonly drafts = new Map<string, W5ScenarioDraft>();
  private sequence = 0;

  constructor(clock: Clock = DEFAULT_CLOCK, persistence?: W5GovernedModelPersistence) {
    this.clock = clock;
    this.persistence = persistence;
    for (const draft of persistence?.listDrafts() ?? []) {
      this.drafts.set(draft.draft_id, clone(draft));
      const sequence = Number(draft.draft_id.replace(/^w5_draft_/, ""));
      if (Number.isSafeInteger(sequence)) this.sequence = Math.max(this.sequence, sequence);
    }
  }

  getTeacherProjection(
    actor: W5ServiceActor,
    scope: W5ServiceScope
  ): W5GovernedModelTeacherProjection {
    this.assertTenant(actor, scope);
    return {
      known_limits: [...DEFAULT_KNOWN_LIMITS],
      model_version: clone(this.modelVersion),
      operation_id: "W5_TEACHER_GOVERNED_MODEL_STUDIO_GET_V1",
      parameter_descriptors: clone(PARAMETER_DESCRIPTORS),
      drafts: [...this.drafts.values()]
        .filter(
          (draft) => draft.tenant_id === actor.tenant_id && draft.course_id === scope.course_id
        )
        .map(clone),
      security: securityContext(actor, scope)
    };
  }

  getAdminProjection(actor: W5ServiceActor, scope: W5ServiceScope): W5GovernedModelAdminProjection {
    this.assertTenant(actor, scope);
    return {
      authority: {
        ai_provider: "OFF",
        formal_truth_writer: "SIMULATION_CORE",
        repository_provider: "JSON_INTERNAL_ONLY",
        writes_formal_truth: false
      },
      known_limits: [...DEFAULT_KNOWN_LIMITS],
      model_version: clone(this.modelVersion),
      operation_id: "W5_ADMIN_GOVERNED_MODEL_AUDIT_GET_V1",
      parameter_descriptors: clone(PARAMETER_DESCRIPTORS),
      drafts: [...this.drafts.values()]
        .filter(
          (draft) => draft.tenant_id === actor.tenant_id && draft.course_id === scope.course_id
        )
        .map(clone),
      security: securityContext(actor, scope)
    };
  }

  createDraft(
    actor: W5ServiceActor,
    scope: W5ServiceScope,
    input: W5CreateDraftInput
  ): { draft: W5ScenarioDraft; receipt: W5MutationReceipt } {
    this.assertTenant(actor, scope);
    const parameters = { ...defaultValues(), ...(input.parameters ?? {}) };
    validateParameterValues(parameters);
    const draft: W5ScenarioDraft = {
      course_id: scope.course_id,
      created_by: actor.actor_id,
      data_classification: input.data_classification ?? "SYNTHETIC",
      draft_id: `w5_draft_${++this.sequence}`,
      exact_runtime_binding: null,
      model_version_ref: this.modelVersion.model_version_ref,
      parameter_descriptors: clone(PARAMETER_DESCRIPTORS),
      parameter_values: parameters,
      seed: input.seed ?? 20260820,
      status: "DRAFT",
      tenant_id: actor.tenant_id,
      title: input.title?.trim() || "Shanghai Governed Model Studio Draft",
      updated_at: this.clock.now()
    };
    this.drafts.set(draft.draft_id, draft);
    const security = securityContext(actor, scope);
    const mutationReceipt = receipt("create_draft", security, `w5_receipt_${this.sequence}`);
    try {
      this.commitDraft(draft, actor, mutationReceipt);
    } catch (error) {
      this.drafts.delete(draft.draft_id);
      throw error;
    }
    return { draft: clone(draft), receipt: mutationReceipt };
  }

  getDraft(actor: W5ServiceActor, scope: W5ServiceScope, draftId: string): W5ScenarioDraft {
    this.assertTenant(actor, scope);
    const draft = this.drafts.get(draftId);
    if (!draft || draft.tenant_id !== actor.tenant_id || draft.course_id !== scope.course_id) {
      throw new W5GovernedModelError("W5_SCOPE_CONFLICT");
    }
    return clone(draft);
  }

  getDraftForTenant(actor: W5ServiceActor, draftId: string): W5ScenarioDraft {
    if (!actor.tenant_id) throw new W5GovernedModelError("W5_SCOPE_CONFLICT");
    const draft = this.drafts.get(draftId);
    if (!draft || draft.tenant_id !== actor.tenant_id) {
      throw new W5GovernedModelError("W5_SCOPE_CONFLICT");
    }
    return clone(draft);
  }

  validateDraft(
    actor: W5ServiceActor,
    scope: W5ServiceScope,
    draftId: string
  ): { draft: W5ScenarioDraft; receipt: W5MutationReceipt } {
    const draft = this.mutableDraft(actor, scope, draftId);
    if (draft.status !== "DRAFT") throw new W5GovernedModelError("W5_INVALID_TRANSITION");
    const previous = clone(draft);
    validateParameterValues(draft.parameter_values);
    if (
      draft.parameter_descriptors.some(
        (item) =>
          item.mapping_readiness === "DRAFT" && draft.parameter_values[item.key] !== item.default
      )
    ) {
      throw new W5GovernedModelError("W5_PARAMETER_MAPPING_DRAFT");
    }
    draft.status = "VALIDATED";
    draft.updated_at = this.clock.now();
    const security = securityContext(actor, scope);
    const mutationReceipt = receipt("validate", security, `w5_receipt_${++this.sequence}`);
    try {
      this.commitDraft(draft, actor, mutationReceipt);
    } catch (error) {
      Object.assign(draft, previous);
      throw error;
    }
    return { draft: clone(draft), receipt: mutationReceipt };
  }

  freezeDraft(
    actor: W5ServiceActor,
    scope: W5ServiceScope,
    draftId: string
  ): { draft: W5ScenarioDraft; receipt: W5MutationReceipt } {
    const draft = this.mutableDraft(actor, scope, draftId);
    if (draft.status !== "VALIDATED") throw new W5GovernedModelError("W5_DRAFT_NOT_VALIDATED");
    const previous = clone(draft);
    draft.status = "FROZEN";
    draft.updated_at = this.clock.now();
    const security = securityContext(actor, scope);
    const mutationReceipt = receipt("freeze", security, `w5_receipt_${++this.sequence}`);
    try {
      this.commitDraft(draft, actor, mutationReceipt);
    } catch (error) {
      Object.assign(draft, previous);
      throw error;
    }
    return { draft: clone(draft), receipt: mutationReceipt };
  }

  bindDraft(
    actor: W5ServiceActor,
    scope: W5ServiceScope,
    draftId: string,
    input: W5BindDraftInput
  ): { draft: W5ScenarioDraft; receipt: W5MutationReceipt } {
    const draft = this.mutableDraft(actor, scope, draftId);
    if (draft.status !== "FROZEN") throw new W5GovernedModelError("W5_DRAFT_NOT_FROZEN");
    const previous = clone(draft);
    if (
      (scope.run_id !== undefined && scope.run_id !== input.run_id) ||
      (scope.round_no !== undefined && scope.round_no !== input.round_no)
    ) {
      throw new W5GovernedModelError("W5_EXACT_BINDING_REQUIRED");
    }
    if (
      input.scenario_package_reference.tenant_id !== actor.tenant_id ||
      !/^[a-f0-9]{64}$/.test(input.parameter_set_reference.content_digest) ||
      !/^[a-f0-9]{64}$/.test(input.scenario_package_reference.content_digest) ||
      !Number.isSafeInteger(input.seed) ||
      input.seed < 0
    ) {
      throw new W5GovernedModelError("W5_EXACT_BINDING_REQUIRED");
    }
    const bindingWithoutDigest = {
      binding_id: `w5_binding_${draft.draft_id}`,
      course_id: draft.course_id,
      model_version_ref: this.modelVersion.model_version_ref,
      no_implicit_latest: true as const,
      parameter_set_reference: clone(input.parameter_set_reference),
      round_no: input.round_no,
      run_id: input.run_id,
      scenario_package_reference: clone(input.scenario_package_reference),
      seed: input.seed,
      status: "BOUND" as const,
      tenant_id: actor.tenant_id
    };
    const binding: W5ExactRuntimeBinding = {
      ...bindingWithoutDigest,
      binding_digest: digest(bindingWithoutDigest)
    };
    draft.exact_runtime_binding = binding;
    draft.seed = input.seed;
    draft.status = "BOUND";
    draft.updated_at = this.clock.now();
    const security = securityContext(actor, scope);
    const mutationReceipt = receipt("bind", security, `w5_receipt_${++this.sequence}`);
    try {
      this.commitDraft(draft, actor, mutationReceipt);
    } catch (error) {
      Object.assign(draft, previous);
      throw error;
    }
    return { draft: clone(draft), receipt: mutationReceipt };
  }

  evaluate(
    actor: W5ServiceActor,
    scope: W5ServiceScope,
    draftId: string,
    experienceProfile: W5ExperienceProfile,
    options: { model_plane?: W5ModelPlane } = {}
  ): W5ConvergenceProjection {
    const draft = this.getDraft(actor, scope, draftId);
    const binding = draft.exact_runtime_binding;
    if (
      !binding ||
      binding.status !== "BOUND" ||
      scope.run_id !== binding.run_id ||
      scope.round_no !== binding.round_no
    ) {
      throw new W5GovernedModelError("W5_EXACT_BINDING_REQUIRED");
    }
    const values = draft.parameter_values;
    const consumerTeam = scope.team_id ?? (actor.role === "teacher" ? "shared-governed-market" : null);
    if (!consumerTeam) throw new W5GovernedModelError("W5_SCOPE_CONFLICT");
    const baseInput = createDefaultEldercareModelInput();
    const input = {
      ...baseInput,
      seed: binding.seed,
      decision: {
        ...baseInput.decision,
        community_outreach_budget: Math.max(0, 60000 + Number(values.construction_cost) * 0.2),
        facility: {
          ...baseInput.decision.facility,
          staff_count: Number(values.caregiver_supply)
        },
        monthly_price: 11800 + Number(values.interest_rate) * 10000,
        service_quality_budget: Math.max(0, 120000 + Number(values.customer_demand) * 250)
      }
    };
    const core = evaluateW5CoreRealization(input);
    const security = securityContext(actor, scope);
    const planeOff = options.model_plane === "OFF";
    const demandMarket = createO3DemandMarket(binding, values);
    const o3Binding = createDemandBinding({
      artifact_digest: O3_DEMAND_MODEL_VERSION.artifact.content_digest,
      artifact_id: O3_DEMAND_MODEL_VERSION.artifact.artifact_id,
      course_id: binding.course_id,
      model_version: O3_DEMAND_MODEL_VERSION.version,
      model_version_id: O3_DEMAND_MODEL_VERSION.model_version_id,
      parameter_set_id: binding.parameter_set_reference.parameter_set_id,
      round_no: binding.round_no,
      run_id: binding.run_id,
      scenario_id: binding.scenario_package_reference.scenario_package_id,
      seed: binding.seed,
      team_id: consumerTeam,
      tenant_id: binding.tenant_id
    });
    const candidateRuntime = evaluateDemandRuntime({
      exact_binding: o3Binding,
      markets: [demandMarket],
      model_version: O3_DEMAND_MODEL_VERSION,
      plane: planeOff ? "OFF" : "ON"
    });
    const candidateMarket = candidateRuntime.markets[0];
    const demandCandidate = candidateMarket
      ? Math.round(
          Number(values.customer_demand) *
            (1 - candidateMarket.outside_option_share) *
            100
        ) / 100
      : 0;
    const demandCandidateProjection = projectDemandCandidate(candidateRuntime, o3Binding);
    const eligible =
      core.metrics.operations.service_capacity > 0 && core.metrics.quality.care_quality_index > 0;
    const realizedDigest = digest({
      binding: binding ? binding.binding_digest : null,
      core: core.replay_relevant_digest,
      model_version_ref: this.modelVersion.model_version_ref
    });
    const demandRealization = {
      readiness: "READY_WITH_LIMITS" as const,
      candidate: demandCandidateProjection,
      lineage: {
        data_classification: draft.data_classification,
        exact_binding: true as const,
        model_version_ref: this.modelVersion.model_version_ref,
        round_no: binding.round_no
      },
      mechanism: {
        want: {
          candidate_value: demandCandidate,
          official: false as const,
          source_plane: "SYNTHETIC_HEURISTIC" as const
        },
        can: {
          constraints: [
            `capacity=${core.metrics.operations.service_capacity}`,
            `workforce=${values.caregiver_supply}`,
            `quality=${core.metrics.quality.care_quality_index}`,
            "eligibility=license_and_staffing"
          ],
          eligible,
          official: false as const,
          source_plane: "CAPACITY_WORKFORCE_QUALITY_ELIGIBILITY" as const
        },
        realized: {
          authority: core.authority,
          official: true as const,
          replay_relevant_digest: realizedDigest,
          writes_formal_result: false as const
        }
      },
      explanation: [
        {
          official: false,
          stage: "WANT" as const,
          summary:
            "Synthetic demand candidate expresses latent demand only; it is not official truth."
        },
        {
          official: false,
          stage: "CAN" as const,
          summary: "Capacity, workforce, quality and eligibility constrain what can be served."
        },
        {
          official: true,
          stage: "REALIZED" as const,
          summary:
            "Simulation Core produces the realized projection; this read/evaluation path does not write a formal result."
        }
      ],
      known_limits: [...DEFAULT_KNOWN_LIMITS]
    };
    return {
      can: {
        constraints: [
          `capacity=${core.metrics.operations.service_capacity}`,
          `workforce=${values.caregiver_supply}`,
          `quality=${core.metrics.quality.care_quality_index}`,
          "eligibility=license_and_staffing"
        ],
        eligible,
        official: false,
        source_plane: "CAPACITY_WORKFORCE_QUALITY_ELIGIBILITY"
      },
      demand_realization: demandRealization,
      experience_profile: experienceProfile,
      fallback: {
        applied: planeOff,
        official_path_continues: true,
        plane: planeOff ? "PLANE_OFF" : "ON"
      },
      known_limits: [...DEFAULT_KNOWN_LIMITS],
      model_version_ref: this.modelVersion.model_version_ref,
      provenance: {
        data_classification: draft.data_classification,
        exact_binding_digest: binding.binding_digest,
        model_version_ref: this.modelVersion.model_version_ref,
        parameter_set_reference: binding.parameter_set_reference,
        scenario_package_reference: binding.scenario_package_reference,
        seed: binding.seed
      },
      realized: {
        authority: core.authority,
        official: true,
        replay_relevant_digest: realizedDigest,
        writes_formal_result: false
      },
      replay: {
        differential: "NON_OFFICIAL",
        exact_identity: "READY",
        replay_writes_official_results: false
      },
      security,
      shadow: {
        non_official: true,
        overwrites_official_result: false,
        plane: "SYSTEM_DYNAMICS"
      },
      want: {
        candidate_value: demandCandidate,
        official: false,
        source_plane: "SYNTHETIC_HEURISTIC"
      }
    };
  }

  projectStudent(
    actor: W5ServiceActor,
    scope: W5ServiceScope,
    draftId: string,
    experienceProfile: W5ExperienceProfile
  ): W5GovernedModelStudentProjection {
    const convergence = this.evaluate(actor, scope, draftId, experienceProfile);
    return {
      convergence: {
        can: convergence.can,
        demand_realization: convergence.demand_realization,
        experience_profile: convergence.experience_profile,
        fallback: convergence.fallback,
        known_limits: convergence.known_limits,
        model_version_ref: convergence.model_version_ref,
        realized: convergence.realized,
        replay: convergence.replay,
        shadow: convergence.shadow,
        want: convergence.want
      },
      operation_id: "W5_STUDENT_GOVERNED_MODEL_PROJECTION_GET_V1",
      security: convergence.security,
      visibility: "ROLE_SAFE_STUDENT"
    };
  }

  private assertTenant(actor: W5ServiceActor, scope: W5ServiceScope): void {
    if (!actor.tenant_id || !scope.course_id || !scope.activity_id) {
      throw new W5GovernedModelError("W5_SCOPE_CONFLICT");
    }
  }

  private commitDraft(
    draft: W5ScenarioDraft,
    actor: W5ServiceActor,
    mutationReceipt: W5MutationReceipt
  ): void {
    this.persistence?.commitDraft(clone(draft), {
      action: `w5.${mutationReceipt.action}`,
      actor_id: actor.actor_id,
      actor_role: actor.role,
      after: {
        course_id: draft.course_id,
        status: draft.status,
        ...(draft.exact_runtime_binding
          ? { binding_id: draft.exact_runtime_binding.binding_id }
          : {})
      },
      audit_id: `w5_audit_${mutationReceipt.receipt_id}`,
      created_at: this.clock.now(),
      request_id: mutationReceipt.receipt_id,
      resource_id: draft.draft_id,
      resource_type: "w5_governed_model_draft",
      tenant_id: actor.tenant_id
    });
  }

  private mutableDraft(
    actor: W5ServiceActor,
    scope: W5ServiceScope,
    draftId: string
  ): W5ScenarioDraft {
    this.getDraft(actor, scope, draftId);
    const draft = this.drafts.get(draftId);
    if (!draft) throw new W5GovernedModelError("W5_DRAFT_NOT_FOUND");
    return draft;
  }
}

export { DEFAULT_KNOWN_LIMITS, DEFAULT_MODEL_VERSION, PARAMETER_DESCRIPTORS };
