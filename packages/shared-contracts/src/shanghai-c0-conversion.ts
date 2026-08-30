export const SHANGHAI_C0_CONVERSION_SCHEMA_VERSION = "simwar.shanghai.c0-conversion.v1" as const;

export type ShanghaiC0MacroId = "M13" | "M14" | "M15" | "M16" | "M17" | "M18";
export type ShanghaiC0ExperienceProfile = "STANDARD" | "ADVANCED";
export type ShanghaiC0Surface = "TEACHER" | "STUDENT" | "ADMIN";

export interface ShanghaiC0ExactBinding {
  exact_binding: true;
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_id: string;
  round_id: string;
  round_no: number;
  scenario_package_id: string;
  scenario_package_version: string;
  parameter_set_id: string;
  parameter_set_version: string;
  model_version_id: string;
  model_version: string;
  engine_id: string;
  seed: number;
}

export interface ShanghaiC0Experiment {
  action: string;
  option_id: string;
  region?: string;
  cohort?: string;
  service_bundle?: string;
  positioning?: string;
  staffing_shock?: number;
  capacity_shock?: number;
  quality_shock?: number;
  horizon_rounds?: number;
  episode_no?: number;
  target_version?: string;
}

export interface ShanghaiC0Request {
  discriminator: "shanghai_c0_conversion_request";
  macro_id: ShanghaiC0MacroId;
  exact_binding: ShanghaiC0ExactBinding;
  experience_profile: ShanghaiC0ExperienceProfile;
  experiment: ShanghaiC0Experiment;
  idempotency_key: string;
}

export type ShanghaiC0ConsumerSurfaceRef =
  | "main.w4-enterprise-state"
  | "main.executive-strategy-lab"
  | "main.m4-counterfactual-transfer"
  | "main.w5-governed-model"
  | "main.teacher-scenario-studio"
  | "main.o4-cross-round-dynamics"
  | "main.shanghai-full-vertical"
  | "main.decision-learning"
  | "main.regional-transfer"
  | "main.enterprise-course-factory";

export interface ShanghaiC0MacroDefinition {
  macro_id: ShanghaiC0MacroId;
  title: string;
  current_surface_refs: readonly ShanghaiC0ConsumerSurfaceRef[];
  candidate_support_refs: readonly string[];
  teacher_action: string;
  student_mechanism: string;
  admin_lineage: string;
}

export const SHANGHAI_C0_MACRO_DEFINITIONS: Readonly<
  Record<ShanghaiC0MacroId, ShanghaiC0MacroDefinition>
> = {
  M13: {
    macro_id: "M13",
    title: "上海经营与资本决策工作台",
    current_surface_refs: [
      "main.w4-enterprise-state",
      "main.executive-strategy-lab",
      "main.m4-counterfactual-transfer"
    ],
    candidate_support_refs: ["MOD.M1.FINANCE", "MOD.M3.CAN", "MAIN.PR-469"],
    teacher_action: "在精确上海项目上下文中比较资本动作与服务可行性。",
    student_mechanism: "资本约束、服务可行性和 why-not 机制。",
    admin_lineage: "scenario/parameter/model/transaction candidate lineage"
  },
  M14: {
    macro_id: "M14",
    title: "上海市场定位与需求决策工作台",
    current_surface_refs: ["main.w5-governed-model", "main.teacher-scenario-studio"],
    candidate_support_refs: ["MOD.M2.WANT-DEMAND", "SH.M7.CATALOG", "SH.M8.AUTHORING"],
    teacher_action: "比较区域、客群、服务包和定位选项的需求证据。",
    student_mechanism: "市场证据、外部选项和定位选择的机制说明。",
    admin_lineage: "demand source, model, scenario and binding candidate lineage"
  },
  M15: {
    macro_id: "M15",
    title: "上海服务承载、护理人力与跨轮韧性工作台",
    current_surface_refs: ["main.o4-cross-round-dynamics", "main.w4-enterprise-state"],
    candidate_support_refs: ["MOD.M3.CAN", "MOD.M4.CROSS-ROUND", "SIM-08"],
    teacher_action: "配置护理人力、容量和质量冲击并观察跨轮恢复走廊。",
    student_mechanism: "约束、滞后、后果和恢复条件。",
    admin_lineage: "workforce/capacity/quality source and lag semantics lineage"
  },
  M16: {
    macro_id: "M16",
    title: "Source-backed 模型资格、解释与不确定性中心",
    current_surface_refs: ["main.w5-governed-model", "main.shanghai-full-vertical"],
    candidate_support_refs: [
      "SH.M9.QUALIFICATION",
      "MOD.M5.EXPLAINABILITY",
      "MOD.M6.QUALIFICATION"
    ],
    teacher_action: "查看来源、权利、时效、holdout、资格、UQ、OOD 和 why-not。",
    student_mechanism: "仅展示角色安全的机制、不确定性和限制。",
    admin_lineage: "source rights, freshness, qualification and model lineage"
  },
  M17: {
    macro_id: "M17",
    title: "上海高管战略证据实验季",
    current_surface_refs: [
      "main.executive-strategy-lab",
      "main.decision-learning",
      "main.o4-cross-round-dynamics"
    ],
    candidate_support_refs: ["SH.M10.SEASON", "SIM-07", "M13-M16.C0-CONSUMERS"],
    teacher_action: "编排 4–6 集从情境到决策、后果、复盘、what-if、迁移的证据季。",
    student_mechanism: "当前集的决策机制、后果和可迁移限制。",
    admin_lineage: "episode, scenario, model and evidence binding lineage"
  },
  M18: {
    macro_id: "M18",
    title: "区域迁移、企业交付与 Living Scenario Operations",
    current_surface_refs: [
      "main.regional-transfer",
      "main.enterprise-course-factory",
      "main.w5-governed-model"
    ],
    candidate_support_refs: ["SH.M11.RIGHTS-DELIVERY", "SH.M12.LIFECYCLE", "MOD.M6.REGIONAL"],
    teacher_action: "演练版本刷新、影响检查、再资格和精确回滚。",
    student_mechanism: "仅呈现 sponsor-safe 的已授权交付状态和限制。",
    admin_lineage: "region/version/rights/expiry/diff/requalification lineage"
  }
} as const;

export interface ShanghaiC0EvidenceItem {
  evidence_id: string;
  label: string;
  status: "CURRENT_BOUND" | "CANDIDATE_SUPPORT" | "NOT_PROVEN";
  source_ref: string;
  model_ref: string;
  unit: string;
  temporal_scope: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NOT_PROVEN";
}

export interface ShanghaiC0Receipt {
  schema_version: typeof SHANGHAI_C0_CONVERSION_SCHEMA_VERSION;
  receipt_id: string;
  macro_id: ShanghaiC0MacroId;
  title: string;
  consumer_status: "C0_CONSUMED";
  state_a: "C1_SUPPORT";
  state_b: "C0_CURRENT_PRODUCT_CONSUMPTION";
  current_surface_ref: ShanghaiC0ConsumerSurfaceRef;
  current_surface_refs: readonly ShanghaiC0ConsumerSurfaceRef[];
  candidate_support_refs: readonly string[];
  exact_binding_digest: string;
  created_at: string;
  experience_profile: ShanghaiC0ExperienceProfile;
  official_truth_write: false;
  settlement_write: false;
  parameter_formal_write: false;
  provider: "OFF";
  replay_truth_unchanged: true;
}

export interface ShanghaiC0TeacherProjection {
  surface: "TEACHER";
  operation_id: "SHANGHAI_C0_TEACHER_CONVERSION_GET_V1";
  receipt: ShanghaiC0Receipt;
  exact_binding: ShanghaiC0ExactBinding;
  experiment: ShanghaiC0Experiment;
  evidence: readonly ShanghaiC0EvidenceItem[];
  available_actions: readonly string[];
  known_limits: readonly string[];
}

export interface ShanghaiC0StudentProjection {
  surface: "STUDENT";
  operation_id: "SHANGHAI_C0_STUDENT_CONVERSION_GET_V1";
  receipt: Pick<
    ShanghaiC0Receipt,
    | "schema_version"
    | "receipt_id"
    | "macro_id"
    | "title"
    | "consumer_status"
    | "state_a"
    | "state_b"
    | "current_surface_ref"
    | "experience_profile"
    | "created_at"
    | "replay_truth_unchanged"
    | "official_truth_write"
    | "settlement_write"
    | "parameter_formal_write"
  >;
  student_context: {
    course_id: string;
    run_id: string;
    round_no: number;
    team_id: string;
  };
  mechanism: string;
  constraints: readonly string[];
  why_not: readonly string[];
  choice?: { option_id: string; status: "NON_OFFICIAL_DRAFT" };
  known_limits: readonly string[];
}

export interface ShanghaiC0AdminProjection {
  surface: "ADMIN";
  operation_id: "SHANGHAI_C0_ADMIN_CONVERSION_AUDIT_GET_V1";
  receipt: ShanghaiC0Receipt;
  exact_binding: ShanghaiC0ExactBinding;
  evidence: readonly ShanghaiC0EvidenceItem[];
  lineage: {
    source_refs: readonly string[];
    model_ref: string;
    scenario_ref: string;
    parameter_ref: string;
    transaction_ref: string;
    rights_status: "CANDIDATE_ONLY";
    qualification_status: "NOT_PROVEN";
    calibration_status: "NOT_PROVEN";
  };
  known_limits: readonly string[];
}

export interface ShanghaiC0StudentChoice {
  option_id: string;
}

const BANNED_ID_TOKEN =
  /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i;

function nonEmptyId(value: unknown): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && !BANNED_ID_TOKEN.test(value.trim())
  );
}

function exactBinding(value: unknown): value is ShanghaiC0ExactBinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const strings = [
    "tenant_id",
    "course_id",
    "run_id",
    "team_id",
    "round_id",
    "scenario_package_id",
    "scenario_package_version",
    "parameter_set_id",
    "parameter_set_version",
    "model_version_id",
    "model_version",
    "engine_id"
  ];
  return (
    candidate.exact_binding === true &&
    strings.every((key) => nonEmptyId(candidate[key])) &&
    typeof candidate.round_no === "number" &&
    Number.isSafeInteger(candidate.round_no) &&
    candidate.round_no >= 1 &&
    typeof candidate.seed === "number" &&
    Number.isSafeInteger(candidate.seed) &&
    candidate.seed >= 0
  );
}

export function isShanghaiC0Request(value: unknown): value is ShanghaiC0Request {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const experiment = candidate.experiment;
  if (!experiment || typeof experiment !== "object" || Array.isArray(experiment)) return false;
  const experimentRecord = experiment as Record<string, unknown>;
  const boundedShocks = ["staffing_shock", "capacity_shock", "quality_shock"];
  return (
    candidate.discriminator === "shanghai_c0_conversion_request" &&
    typeof candidate.macro_id === "string" &&
    Object.prototype.hasOwnProperty.call(SHANGHAI_C0_MACRO_DEFINITIONS, candidate.macro_id) &&
    exactBinding(candidate.exact_binding) &&
    (candidate.experience_profile === "STANDARD" || candidate.experience_profile === "ADVANCED") &&
    nonEmptyId(experimentRecord.action) &&
    nonEmptyId(experimentRecord.option_id) &&
    boundedShocks.every(
      (key) =>
        experimentRecord[key] === undefined ||
        (typeof experimentRecord[key] === "number" &&
          Number.isFinite(experimentRecord[key] as number))
    ) &&
    (experimentRecord.horizon_rounds === undefined ||
      (typeof experimentRecord.horizon_rounds === "number" &&
        Number.isSafeInteger(experimentRecord.horizon_rounds))) &&
    (experimentRecord.episode_no === undefined ||
      (typeof experimentRecord.episode_no === "number" &&
        Number.isSafeInteger(experimentRecord.episode_no))) &&
    nonEmptyId(candidate.idempotency_key)
  );
}
