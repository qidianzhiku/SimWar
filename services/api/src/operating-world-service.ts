import { createHash } from "node:crypto";
import type {
  OperatingWorldAdminAudit,
  OperatingWorldConfidence,
  OperatingWorldDraft,
  OperatingWorldEffectClass,
  OperatingWorldFamilies,
  OperatingWorldFamily,
  OperatingWorldFreshness,
  OperatingWorldInfo,
  OperatingWorldOfficialConsumerInput,
  OperatingWorldPreviewReceipt,
  OperatingWorldPreviewVariant,
  OperatingWorldSH16,
  OperatingWorldSH17,
  OperatingWorldSH18,
  OperatingWorldSH19,
  OperatingWorldStudentProjection,
  OperatingWorldTeacherProjection,
  OperatingWorldSourceCategory
} from "@simwar/shared-contracts";
import { OPERATING_WORLD_MISSION_ID } from "@simwar/shared-contracts";

export interface OperatingWorldServiceActor {
  actor_id: string;
  role: "teacher" | "student" | "learner" | "admin" | "tenant_admin" | "platform_admin";
  tenant_id: string;
}

export interface OperatingWorldServiceScope {
  activity_id: string;
  course_id: string;
  round_no?: number;
  run_id?: string;
}

export interface OperatingWorldDraftInput {
  families: OperatingWorldFamilies;
  seed?: number;
  title?: string;
}

export interface OperatingWorldBindInput {
  model_version_ref: string;
  parameter_set_reference: {
    content_digest: string;
    parameter_set_id: string;
    version: string;
  };
  round_no: number;
  run_id: string;
  scenario_package_reference: {
    content_digest: string;
    scenario_package_id: string;
    tenant_id: string;
    version: string;
  };
  seed: number;
}

export interface OperatingWorldPersistence {
  listDrafts(): readonly OperatingWorldDraft[];
  commitDraft(draft: OperatingWorldDraft): void;
}

interface Clock {
  now(): string;
}

const DEFAULT_CLOCK: Clock = { now: () => new Date().toISOString() };

export class OperatingWorldError extends Error {
  constructor(
    readonly code:
      | "OW_DRAFT_NOT_FOUND"
      | "OW_SCOPE_CONFLICT"
      | "OW_INVALID_VALUE"
      | "OW_SOURCE_PROVENANCE_REQUIRED"
      | "OW_INVALID_TRANSITION"
      | "OW_DRAFT_NOT_VALIDATED"
      | "OW_DRAFT_NOT_FROZEN"
      | "OW_EXACT_BINDING_REQUIRED"
      | "OW_BINDING_CONFLICT"
      | "OW_ROLE_FORBIDDEN"
      | "OW_STALE_SOURCE"
  ) {
    super(code);
    this.name = "OperatingWorldError";
  }
}

const KNOWN_LIMITS = [
  "上海纵向数据是场景输入证据，不自动等同于现实总体估计。",
  "PreviewReceipt 是非正式诊断，不能写入 SettlementResult、Replay truth、score 或 rank。",
  "资本/建设输入只有在既有 W4 canonical admission 与 sole-writer seam 中才具备正式消费者资格。",
  "学生投影隐藏原始路径、私有系数、隐藏冲击时序、教师预览和完整私有 manifest。"
] as const;

const MODEL_VERSION_REF = "eldercare_w5_governed_v1@1.0.0";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`)
    .join(",")}}`;
}

function digest(value: unknown): string {
  return createHash("sha256").update(stable(value), "utf8").digest("hex");
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function ratio(value: unknown): boolean {
  return finite(value) && value >= 0 && value <= 1;
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function info(value: unknown): value is OperatingWorldInfo {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "confidence",
      "demand_signal",
      "freshness",
      "known_limits",
      "source_category",
      "source_ref"
    ])
  ) {
    throw new OperatingWorldError("OW_INVALID_VALUE");
  }
  if (
    !finite(value.demand_signal) ||
    value.demand_signal < 0 ||
    value.demand_signal > 1 ||
    !nonBlank(value.source_ref) ||
    !Array.isArray(value.known_limits) ||
    value.known_limits.length === 0 ||
    value.known_limits.some((limit) => !nonBlank(limit))
  ) {
    throw new OperatingWorldError("OW_SOURCE_PROVENANCE_REQUIRED");
  }
  const categories: OperatingWorldSourceCategory[] = [
    "LOCAL_DATA",
    "OFFICIAL_PRIMARY",
    "SYNTHETIC",
    "ASSUMPTION",
    "TEACHER_INPUT"
  ];
  const confidences: OperatingWorldConfidence[] = ["HIGH", "MEDIUM", "LOW", "UNKNOWN"];
  const freshness: OperatingWorldFreshness[] = ["CURRENT", "STALE", "UNKNOWN"];
  if (
    !categories.includes(value.source_category as OperatingWorldSourceCategory) ||
    !confidences.includes(value.confidence as OperatingWorldConfidence) ||
    !freshness.includes(value.freshness as OperatingWorldFreshness)
  ) {
    throw new OperatingWorldError("OW_SOURCE_PROVENANCE_REQUIRED");
  }
  return true;
}

function validateFamilies(families: unknown): asserts families is OperatingWorldFamilies {
  if (!isRecord(families) || !hasExactKeys(families, ["SH-16", "SH-17", "SH-18", "SH-19"])) {
    throw new OperatingWorldError("OW_INVALID_VALUE");
  }
  const rawSh16 = families["SH-16"];
  const rawSh17 = families["SH-17"];
  const rawSh18 = families["SH-18"];
  const rawSh19 = families["SH-19"];
  if (!isRecord(rawSh16) || !isRecord(rawSh17) || !isRecord(rawSh18) || !isRecord(rawSh19)) {
    throw new OperatingWorldError("OW_INVALID_VALUE");
  }
  if (
    !hasExactKeys(rawSh16, [
      "info",
      "quality_target",
      "recovery_lag",
      "recruitment_pressure",
      "service_capacity",
      "staffing_floor",
      "turnover_pressure",
      "wage_pressure",
      "workforce_supply"
    ]) ||
    !hasExactKeys(rawSh17, [
      "approved_capacity_max",
      "approved_capacity_min",
      "capital_cost",
      "construction_cost",
      "construction_cycle",
      "covenant_tightness",
      "credit_availability",
      "financing_availability",
      "info"
    ]) ||
    !hasExactKeys(rawSh18, [
      "economic_cycle",
      "effective_time",
      "info",
      "policy_pack_ref",
      "priority",
      "shock_ref",
      "visibility"
    ]) ||
    !hasExactKeys(rawSh19, [
      "info",
      "market_node_ref",
      "portfolio_constraints",
      "project_option_compatibility",
      "project_slot_ref"
    ])
  ) {
    throw new OperatingWorldError("OW_INVALID_VALUE");
  }
  const sh16 = rawSh16 as unknown as OperatingWorldSH16;
  const sh17 = rawSh17 as unknown as OperatingWorldSH17;
  const sh18 = rawSh18 as unknown as OperatingWorldSH18;
  const sh19 = rawSh19 as unknown as OperatingWorldSH19;
  info(sh16.info);
  info(sh17.info);
  info(sh18.info);
  info(sh19.info);
  const sh16Numbers = [
    sh16.workforce_supply,
    sh16.wage_pressure,
    sh16.staffing_floor,
    sh16.service_capacity,
    sh16.quality_target,
    sh16.recruitment_pressure,
    sh16.turnover_pressure,
    sh16.recovery_lag
  ];
  if (
    sh16Numbers.some((value) => !finite(value) || value < 0) ||
    !ratio(sh16.wage_pressure) ||
    !ratio(sh16.quality_target) ||
    !ratio(sh16.recruitment_pressure) ||
    !ratio(sh16.turnover_pressure)
  ) {
    throw new OperatingWorldError("OW_INVALID_VALUE");
  }
  const sh17Numbers = [
    sh17.capital_cost,
    sh17.construction_cost,
    sh17.construction_cycle,
    sh17.approved_capacity_min,
    sh17.approved_capacity_max
  ];
  if (
    sh17Numbers.some((value) => !finite(value) || value < 0) ||
    !ratio(sh17.capital_cost) ||
    !ratio(sh17.credit_availability) ||
    !ratio(sh17.covenant_tightness) ||
    !ratio(sh17.financing_availability) ||
    sh17.approved_capacity_min > sh17.approved_capacity_max
  ) {
    throw new OperatingWorldError("OW_INVALID_VALUE");
  }
  if (
    !nonBlank(sh18.policy_pack_ref) ||
    !nonBlank(sh18.economic_cycle) ||
    !nonBlank(sh18.effective_time) ||
    !nonBlank(sh18.shock_ref) ||
    !["low", "normal", "high"].includes(sh18.priority) ||
    !["STUDENT_SAFE", "TEACHER_ONLY"].includes(sh18.visibility)
  ) {
    throw new OperatingWorldError("OW_INVALID_VALUE");
  }
  if (
    !nonBlank(sh19.market_node_ref) ||
    !nonBlank(sh19.project_slot_ref) ||
    !Array.isArray(sh19.portfolio_constraints) ||
    !Array.isArray(sh19.project_option_compatibility) ||
    sh19.portfolio_constraints.some((value) => !nonBlank(value)) ||
    sh19.project_option_compatibility.some((value) => !nonBlank(value))
  ) {
    throw new OperatingWorldError("OW_INVALID_VALUE");
  }
}

function defaultFamilies(): OperatingWorldFamilies {
  const baseInfo = (source_category: OperatingWorldSourceCategory): OperatingWorldInfo => ({
    confidence: source_category === "SYNTHETIC" ? "HIGH" : "MEDIUM",
    demand_signal: 0.6,
    freshness: "CURRENT",
    known_limits: ["默认教学场景，需要教师在真实项目中校准"],
    source_category,
    source_ref: `scenario://shanghai/${source_category.toLowerCase()}`
  });
  return {
    "SH-16": {
      info: baseInfo("SYNTHETIC"),
      quality_target: 0.9,
      recovery_lag: 2,
      recruitment_pressure: 0.2,
      service_capacity: 100,
      staffing_floor: 80,
      turnover_pressure: 0.12,
      wage_pressure: 0.08,
      workforce_supply: 120
    },
    "SH-17": {
      approved_capacity_max: 240,
      approved_capacity_min: 60,
      capital_cost: 0.055,
      construction_cost: 120000,
      construction_cycle: 3,
      covenant_tightness: 0.3,
      credit_availability: 0.7,
      financing_availability: 0.68,
      info: baseInfo("SYNTHETIC")
    },
    "SH-18": {
      economic_cycle: "slow-growth",
      effective_time: "2026-Q3",
      info: baseInfo("TEACHER_INPUT"),
      policy_pack_ref: "sh-policy-default-v1",
      priority: "normal",
      shock_ref: "none",
      visibility: "STUDENT_SAFE"
    },
    "SH-19": {
      info: baseInfo("ASSUMPTION"),
      market_node_ref: "shanghai-core-node",
      portfolio_constraints: ["single-campus-cap"],
      project_option_compatibility: ["community-care-v2"],
      project_slot_ref: "shanghai-project-slot-01"
    }
  };
}

export class OperatingWorldService {
  private readonly clock: Clock;
  private readonly persistence: OperatingWorldPersistence | undefined;
  private readonly drafts = new Map<string, OperatingWorldDraft>();
  private sequence = 0;

  constructor(clock: Clock = DEFAULT_CLOCK, persistence?: OperatingWorldPersistence) {
    this.clock = clock;
    this.persistence = persistence;
    for (const draft of persistence?.listDrafts() ?? []) {
      this.drafts.set(draft.draft_id, clone(draft));
      const sequence = Number(draft.draft_id.replace(/^operating_world_draft_/, ""));
      if (Number.isSafeInteger(sequence)) this.sequence = Math.max(this.sequence, sequence);
    }
  }

  getTeacherProjection(
    actor: OperatingWorldServiceActor,
    scope: OperatingWorldServiceScope
  ): OperatingWorldTeacherProjection {
    this.assertTeacher(actor);
    this.assertScope(actor, scope);
    return {
      drafts: [...this.drafts.values()]
        .filter(
          (draft) => draft.tenant_id === actor.tenant_id && draft.course_id === scope.course_id
        )
        .map(clone),
      known_limits: [...KNOWN_LIMITS],
      mission_id: OPERATING_WORLD_MISSION_ID,
      operation_id: "SH_M3_TEACHER_OPERATING_WORLD_STUDIO_GET_V1"
    };
  }

  createDraft(
    actor: OperatingWorldServiceActor,
    scope: OperatingWorldServiceScope,
    input: OperatingWorldDraftInput
  ): { draft: OperatingWorldDraft } {
    this.assertTeacher(actor);
    this.assertScope(actor, scope);
    validateFamilies(input.families);
    if (input.seed !== undefined && (!Number.isSafeInteger(input.seed) || input.seed < 0)) {
      throw new OperatingWorldError("OW_INVALID_VALUE");
    }
    const draft: OperatingWorldDraft = {
      binding: null,
      course_id: scope.course_id,
      created_by: actor.actor_id,
      draft_id: `operating_world_draft_${++this.sequence}`,
      families: clone(input.families),
      model_version_ref: MODEL_VERSION_REF,
      seed: input.seed ?? 20260823,
      status: "DRAFT",
      tenant_id: actor.tenant_id,
      title: input.title?.trim() || "上海 Operating World Draft",
      updated_at: this.clock.now()
    };
    this.drafts.set(draft.draft_id, draft);
    try {
      this.commit(draft);
    } catch (error) {
      this.drafts.delete(draft.draft_id);
      throw error;
    }
    return { draft: clone(draft) };
  }

  getDraft(
    actor: OperatingWorldServiceActor,
    scope: OperatingWorldServiceScope,
    draftId: string
  ): OperatingWorldDraft {
    this.assertScope(actor, scope);
    const draft = this.drafts.get(draftId);
    if (!draft) throw new OperatingWorldError("OW_DRAFT_NOT_FOUND");
    if (draft.tenant_id !== actor.tenant_id || draft.course_id !== scope.course_id) {
      throw new OperatingWorldError("OW_SCOPE_CONFLICT");
    }
    return clone(draft);
  }

  validateDraft(
    actor: OperatingWorldServiceActor,
    scope: OperatingWorldServiceScope,
    draftId: string
  ): { draft: OperatingWorldDraft } {
    const draft = this.mutableDraft(actor, scope, draftId);
    if (draft.status !== "DRAFT") throw new OperatingWorldError("OW_INVALID_TRANSITION");
    validateFamilies(draft.families);
    draft.status = "VALIDATED";
    draft.updated_at = this.clock.now();
    this.commit(draft);
    return { draft: clone(draft) };
  }

  previewDraft(
    actor: OperatingWorldServiceActor,
    scope: OperatingWorldServiceScope,
    draftId: string,
    variant: OperatingWorldPreviewVariant
  ): { draft: OperatingWorldDraft; receipt: OperatingWorldPreviewReceipt } {
    const draft = this.getDraft(actor, scope, draftId);
    if (draft.status !== "VALIDATED") throw new OperatingWorldError("OW_DRAFT_NOT_VALIDATED");
    const factor = variant === "LOW" ? 0.9 : variant === "HIGH" ? 1.1 : 1;
    const sh17 = draft.families["SH-17"];
    const inputDigest = digest({
      draft_id: draft.draft_id,
      families: draft.families,
      seed: draft.seed
    });
    const effectClass: OperatingWorldEffectClass =
      sh17.info.freshness === "CURRENT" && sh17.info.confidence !== "UNKNOWN"
        ? "OFFICIAL_CONSUMER_ELIGIBLE"
        : sh17.info.freshness === "STALE"
          ? "BLOCKED"
          : "SHADOW_ONLY";
    const parameterDelta = {
      capital_cost: Number((sh17.capital_cost * factor).toFixed(8)),
      construction_cost: Math.round(sh17.construction_cost * factor),
      construction_cycle: Math.max(1, Math.round(sh17.construction_cycle * factor)),
      wage_pressure: Number((draft.families["SH-16"].wage_pressure * factor).toFixed(8)),
      workforce_supply: Math.round(draft.families["SH-16"].workforce_supply * (2 - factor))
    };
    const receiptWithoutDigest = {
      consumer_ref: "W4_CAPITAL_ACTION_OR_NEW_PROJECT_ADMISSION" as const,
      diagnostics: [
        `variant=${variant}`,
        `effect_class=${effectClass}`,
        "no official W4/state/replay write performed"
      ],
      effect_class: effectClass,
      input_digest: inputDigest,
      known_limits: [...KNOWN_LIMITS],
      no_official_write: true as const,
      parameter_delta: parameterDelta,
      predicted_outputs: {
        service_capacity: draft.families["SH-16"].service_capacity,
        w4_eligible_construction_cost: parameterDelta.construction_cost
      },
      scenario_variant: variant,
      seed: draft.seed,
      uncertainty: {
        capital_cost: sh17.info.confidence === "HIGH" ? 0.05 : 0.2,
        construction_cycle: sh17.info.confidence === "HIGH" ? 0.1 : 0.3
      }
    };
    const receipt: OperatingWorldPreviewReceipt = {
      ...receiptWithoutDigest,
      preview_digest: digest(receiptWithoutDigest),
      preview_id: `operating_world_preview_${digest(receiptWithoutDigest).slice(0, 16)}`
    };
    return { draft, receipt };
  }

  freezeDraft(
    actor: OperatingWorldServiceActor,
    scope: OperatingWorldServiceScope,
    draftId: string
  ): { draft: OperatingWorldDraft } {
    const draft = this.mutableDraft(actor, scope, draftId);
    if (draft.status !== "VALIDATED") throw new OperatingWorldError("OW_DRAFT_NOT_VALIDATED");
    draft.status = "FROZEN";
    draft.updated_at = this.clock.now();
    this.commit(draft);
    return { draft: clone(draft) };
  }

  bindDraft(
    actor: OperatingWorldServiceActor,
    scope: OperatingWorldServiceScope,
    draftId: string,
    input: OperatingWorldBindInput
  ): { draft: OperatingWorldDraft } {
    const draft = this.mutableDraft(actor, scope, draftId);
    if (draft.status === "BOUND" && draft.binding) {
      if (scope.run_id !== input.run_id || scope.round_no !== input.round_no) {
        throw new OperatingWorldError("OW_BINDING_CONFLICT");
      }
      const expected = this.bindingWithoutDigest(actor, draft, input);
      if (draft.binding.binding_digest === digest(expected)) return { draft: clone(draft) };
      throw new OperatingWorldError("OW_BINDING_CONFLICT");
    }
    if (draft.status !== "FROZEN") throw new OperatingWorldError("OW_DRAFT_NOT_FROZEN");
    if (
      scope.run_id !== input.run_id ||
      scope.round_no !== input.round_no ||
      input.scenario_package_reference.tenant_id !== actor.tenant_id ||
      !nonBlank(input.model_version_ref) ||
      !/^[a-f0-9]{64}$/.test(input.parameter_set_reference.content_digest) ||
      !/^[a-f0-9]{64}$/.test(input.scenario_package_reference.content_digest) ||
      !Number.isSafeInteger(input.seed) ||
      input.seed < 0
    ) {
      throw new OperatingWorldError("OW_EXACT_BINDING_REQUIRED");
    }
    const bindingWithoutDigest = this.bindingWithoutDigest(actor, draft, input);
    draft.binding = { ...bindingWithoutDigest, binding_digest: digest(bindingWithoutDigest) };
    draft.seed = input.seed;
    draft.model_version_ref = input.model_version_ref;
    draft.status = "BOUND";
    draft.updated_at = this.clock.now();
    this.commit(draft);
    return { draft: clone(draft) };
  }

  projectStudent(
    actor: OperatingWorldServiceActor,
    scope: OperatingWorldServiceScope,
    draftId: string
  ): OperatingWorldStudentProjection {
    if (actor.role !== "student" && actor.role !== "learner") {
      throw new OperatingWorldError("OW_ROLE_FORBIDDEN");
    }
    const draft = this.getDraft(actor, scope, draftId);
    if (
      draft.status !== "BOUND" ||
      !draft.binding ||
      scope.run_id !== draft.binding.run_id ||
      scope.round_no !== draft.binding.round_no
    ) {
      throw new OperatingWorldError("OW_EXACT_BINDING_REQUIRED");
    }
    const sh16 = draft.families["SH-16"];
    const sh17 = draft.families["SH-17"];
    const sh18 = draft.families["SH-18"];
    return {
      brief: {
        construction_cost_range: [
          Math.round(sh17.construction_cost * 0.9),
          Math.round(sh17.construction_cost * 1.1)
        ],
        construction_cycle_range: [
          Math.max(1, sh17.construction_cycle - 1),
          sh17.construction_cycle + 1
        ],
        demand_outlook: sh16.info.demand_signal,
        financing_environment: sh17.financing_availability,
        known_limits: [...KNOWN_LIMITS],
        service_capacity: sh16.service_capacity,
        visible_policy:
          sh18.visibility === "STUDENT_SAFE" ? sh18.policy_pack_ref : "policy-visible-summary",
        wage_pressure: sh16.wage_pressure,
        workforce_supply: sh16.workforce_supply
      },
      binding_digest: draft.binding.binding_digest,
      mission_id: OPERATING_WORLD_MISSION_ID,
      operation_id: "SH_M3_STUDENT_OPERATING_WORLD_BRIEF_GET_V1",
      visibility: "ROLE_SAFE_STUDENT"
    };
  }

  getAdminAudit(
    actor: OperatingWorldServiceActor,
    scope: OperatingWorldServiceScope,
    draftId: string
  ): OperatingWorldAdminAudit {
    if (!["admin", "tenant_admin", "platform_admin", "teacher"].includes(actor.role)) {
      throw new OperatingWorldError("OW_ROLE_FORBIDDEN");
    }
    const draft = this.getDraft(actor, scope, draftId);
    if (
      (scope.run_id !== undefined || scope.round_no !== undefined) &&
      (!draft.binding ||
        draft.binding.run_id !== scope.run_id ||
        draft.binding.round_no !== scope.round_no)
    ) {
      throw new OperatingWorldError("OW_EXACT_BINDING_REQUIRED");
    }
    const freshness = {
      "SH-16": draft.families["SH-16"].info.freshness,
      "SH-17": draft.families["SH-17"].info.freshness,
      "SH-18": draft.families["SH-18"].info.freshness,
      "SH-19": draft.families["SH-19"].info.freshness
    } satisfies Record<OperatingWorldFamily, OperatingWorldFreshness>;
    const officialConsumerEligible =
      draft.status === "BOUND" &&
      draft.binding !== null &&
      draft.families["SH-17"].info.freshness === "CURRENT" &&
      draft.families["SH-17"].info.confidence !== "UNKNOWN";
    return {
      binding: clone(draft.binding),
      draft_id: draft.draft_id,
      effect_class: officialConsumerEligible
        ? "OFFICIAL_CONSUMER_ELIGIBLE"
        : draft.binding
          ? "BLOCKED"
          : "INFORMATION_ONLY",
      freshness,
      known_limits: [...KNOWN_LIMITS],
      readiness: draft.status,
      stale_or_conflict: Object.values(freshness).some((value) => value !== "CURRENT")
    };
  }

  getOfficialConsumerInput(
    actor: OperatingWorldServiceActor,
    scope: OperatingWorldServiceScope,
    draftId: string
  ): OperatingWorldOfficialConsumerInput {
    this.assertTeacher(actor);
    const draft = this.getDraft(actor, scope, draftId);
    if (
      draft.status !== "BOUND" ||
      !draft.binding ||
      scope.run_id !== draft.binding.run_id ||
      scope.round_no !== draft.binding.round_no
    ) {
      throw new OperatingWorldError("OW_EXACT_BINDING_REQUIRED");
    }
    const sh17 = draft.families["SH-17"];
    if (sh17.info.freshness !== "CURRENT" || sh17.info.confidence === "UNKNOWN") {
      throw new OperatingWorldError("OW_STALE_SOURCE");
    }
    return {
      capital_cost: sh17.capital_cost,
      construction_cost: sh17.construction_cost,
      construction_cycle: sh17.construction_cycle,
      credit_availability: sh17.credit_availability,
      effect_class: "OFFICIAL_CONSUMER_ELIGIBLE",
      source_binding_digest: draft.binding.binding_digest,
      consumer_ref: "W4_CAPITAL_ACTION_OR_NEW_PROJECT_ADMISSION"
    };
  }

  private bindingWithoutDigest(
    actor: OperatingWorldServiceActor,
    draft: OperatingWorldDraft,
    input: OperatingWorldBindInput
  ) {
    return {
      binding_id: `operating_world_binding_${draft.draft_id}`,
      course_id: draft.course_id,
      model_version_ref: input.model_version_ref,
      no_implicit_latest: true as const,
      parameter_set_reference: clone(input.parameter_set_reference),
      round_no: input.round_no,
      run_id: input.run_id,
      scenario_package_reference: clone(input.scenario_package_reference),
      seed: input.seed,
      status: "BOUND" as const,
      tenant_id: actor.tenant_id
    };
  }

  private mutableDraft(
    actor: OperatingWorldServiceActor,
    scope: OperatingWorldServiceScope,
    draftId: string
  ): OperatingWorldDraft {
    this.assertTeacher(actor);
    this.assertScope(actor, scope);
    const draft = this.drafts.get(draftId);
    if (!draft) throw new OperatingWorldError("OW_DRAFT_NOT_FOUND");
    if (draft.tenant_id !== actor.tenant_id || draft.course_id !== scope.course_id) {
      throw new OperatingWorldError("OW_SCOPE_CONFLICT");
    }
    return draft;
  }

  private assertTeacher(actor: OperatingWorldServiceActor): void {
    if (actor.role !== "teacher") throw new OperatingWorldError("OW_ROLE_FORBIDDEN");
  }

  private assertScope(actor: OperatingWorldServiceActor, scope: OperatingWorldServiceScope): void {
    if (!actor.tenant_id || !scope.activity_id || !scope.course_id) {
      throw new OperatingWorldError("OW_SCOPE_CONFLICT");
    }
  }

  private commit(draft: OperatingWorldDraft): void {
    this.persistence?.commitDraft(clone(draft));
  }
}

export { KNOWN_LIMITS, MODEL_VERSION_REF, defaultFamilies };
