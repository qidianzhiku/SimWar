import { createHash } from "node:crypto";

export const SH_NEXT_SUPPORT_SCHEMA_VERSION = "sh-next-support.v1" as const;
export const SH_NEXT_SOURCE_MASTER_SHA = "cbcda2a4e89d19bce81f7e144dedf5a7e9f7af77" as const;

export type DataType =
  | "ACTUAL"
  | "BUDGET"
  | "FORECAST"
  | "INVESTMENT_MODEL"
  | "SURVEY"
  | "ASSUMPTION"
  | "SYNTHETIC"
  | "STRESS_TEST";
export type PrivacyClass = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
export type CandidateVisibility =
  | "TEACHER_ONLY"
  | "STUDENT_SAFE"
  | "INTERNAL_RESEARCH_ONLY"
  | "RESTRICTED";
export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "NOT_ESTABLISHED";
export type EvidenceStatus = "VERIFIED" | "REFERENCE_ONLY" | "NOT_RETRIEVED";

export interface ExactRef {
  ref_type: "CODE" | "CONTRACT" | "TEST" | "SOURCE";
  ref_id: string;
  path_or_uri: string;
  revision: string;
  line_start?: number;
  line_end?: number;
  digest: string;
  readback_status: "EXACT_SOURCE_READBACK" | "REFERENCE_ONLY";
}

export interface SourceAsset {
  source_id: string;
  source_type: "PUBLIC_DOCUMENT" | "INTERNAL_CAPABILITY" | "SYNTHETIC" | "ASSUMPTION";
  source_date: string;
  geography: string;
  time_scope: string;
  provenance: string;
  license_or_usage_status: string;
  confidence: Confidence;
  sensitivity: PrivacyClass;
  role_visibility: CandidateVisibility;
  derived_from: string[];
  evidence_status: EvidenceStatus;
  content_basis: string;
  hash: string;
}

export interface Observation {
  observation_id: string;
  source_id: string;
  location: string;
  period: string;
  basis: string;
  unit: string;
  geography: string;
  data_type: DataType;
  value: number | string;
  confidence: Confidence;
  sensitivity: PrivacyClass;
  observation_status: "CANDIDATE_ANCHOR" | "MISSING" | "UNKNOWN" | "CONFLICT";
  expiry: string;
}

export interface FeatureCandidate {
  feature_id: string;
  name: string;
  value: number | string;
  unit: string;
  range: { min: number | null; max: number | null };
  source_ids: string[];
  temporal_scope: string;
  geography: string;
  confidence: Confidence;
  possible_mod_consumer: string;
  calibration_evidence: "NONE" | "NOT_PROVEN";
  visibility: CandidateVisibility;
}

export interface TransformationRecord {
  transformation_id: string;
  input: string[];
  rule: string;
  assumption: string;
  output: string;
  unit: string;
  time_scope: string;
  geography: string;
  confidence: Confidence;
  provenance: string;
}

export interface RegionalTransferCandidate {
  transfer_id: string;
  source_geography: string;
  target_geography: string;
  driver: string;
  method: string;
  bounds: { min: number; max: number };
  unit: string;
  confidence: Confidence;
  valid_from: string;
  valid_to: string;
  rights_status: "PUBLIC_SAFE" | "INTERNAL_ONLY" | "UNKNOWN";
  approval_status: "CANDIDATE_ONLY";
  feature_ids: string[];
}

export interface ScenarioCandidate {
  scenario_id: string;
  title: string;
  geography: string;
  time_scope: string;
  data_type: "SYNTHETIC" | "STRESS_TEST";
  source_ids: string[];
  feature_ids: string[];
  transfer_ids: string[];
  visibility: CandidateVisibility;
  exact_refs: ExactRef[];
  no_correct_answer_prefilled: true;
  formal_runtime_admitted: false;
}

export interface M1Episode {
  episode_id: string;
  title: string;
  objective: string;
  scenario_ref: {
    scenario_id: string;
    parameter_set_id: string;
    model_ref: string;
    course_id: string;
    run_id: string;
    seed: number;
    exact_refs: ExactRef[];
  };
  decision_context: {
    situation: string;
    options: string[];
    correct_answer_supplied: false;
    student_private_truth: false;
  };
  process: { authority: "CANDIDATE"; evidence: string[] };
  outcome_candidate: {
    authority: "CANDIDATE";
    observable_directions: string[];
    final_score?: never;
    final_rank?: never;
  };
  learning_evidence: { authority: "CANDIDATE"; prompts: string[] };
  counterfactual: { authority: "CANDIDATE"; what_if: string; transfer_hook: string };
  teacher_hook: { objective: string; facilitation: string[]; private_fields: string[] };
  student_evidence: { visible: string[]; hidden: string[] };
  loop: ["Decision", "Outcome", "Debrief", "What-if", "Transfer"];
  ai_mode: "OFF";
  final_ranking_prefilled: false;
}

export interface M1ExecutiveSeasonPack {
  schema_version: typeof SH_NEXT_SUPPORT_SCHEMA_VERSION;
  macro_key: "M1";
  mission_id: "SH-ESL-NEXT-01-SHANGHAI-EXECUTIVE-STRATEGY-EXPERIMENT-SEASON";
  state_transition: { from: "STATE_A"; to: "STATE_B" };
  sources: SourceAsset[];
  observations: Observation[];
  features: FeatureCandidate[];
  transformations: TransformationRecord[];
  regional_transfers: RegionalTransferCandidate[];
  scenarios: ScenarioCandidate[];
  episodes: M1Episode[];
  conflict_ledger: { conflict_id: string; sources: string[]; resolution: "PRESERVED" }[];
  provenance_graph: {
    nodes: { id: string; kind: "SOURCE" | "OBSERVATION" | "FEATURE" | "SCENARIO" | "EPISODE" }[];
    edges: { from: string; to: string; relation: "DERIVED_FROM" | "USES" | "TEACHES" }[];
  };
  role_visibility: {
    teacher: { visibility: "TEACHER_ONLY"; fields: string[] };
    student: { visibility: "STUDENT_SAFE"; fields: string[]; forbidden_fields: string[] };
    admin: { visibility: "INTERNAL_RESEARCH_ONLY"; fields: string[] };
  };
  consumer: {
    classification: "C1";
    consumer_id: "MAIN-ESL-O1-EXECUTIVE-STRATEGY-LAB";
    consumer_ready: false;
    formal_join: false;
    exact_binding_required: true;
  };
  authority: {
    candidate_writer: "SH_NEXT_SUPPORT_CANDIDATE_COMPILER";
    official_truth_write: false;
    settlement_write: false;
    parameter_set_formal_write: false;
    provider: "OFF";
    runtime_authority: "JSON_INTERNAL_ONLY";
  };
  mjp: { status: "PASS"; episode_id: string; checks: string[] };
  main_handoff: {
    status: "JOIN_WITH_LIMITS";
    required_consumer_action: "PROVE_C0_SOURCE_CONTRACT_SEAM";
    exact_refs: ExactRef[];
  };
  known_limits: string[];
  pack_digest: string;
}

export interface M1StudentEpisodeProjection {
  episode_id: string;
  title: string;
  objective: string;
  situation: string;
  options: string[];
  candidate_outcome: string[];
  reflection: string[];
  visible_fields: ["situation", "options", "own_rationale", "candidate_outcome", "reflection"];
}

export interface M1StudentProjection {
  visibility: "STUDENT_SAFE";
  episodes: M1StudentEpisodeProjection[];
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function stableDigest(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function exactRef(
  ref_type: ExactRef["ref_type"],
  ref_id: string,
  path_or_uri: string,
  line_start: number,
  line_end: number
): ExactRef {
  return {
    ref_type,
    ref_id,
    path_or_uri,
    revision: SH_NEXT_SOURCE_MASTER_SHA,
    line_start,
    line_end,
    digest: stableDigest({
      ref_id,
      path_or_uri,
      revision: SH_NEXT_SOURCE_MASTER_SHA,
      line_start,
      line_end
    }),
    readback_status: "EXACT_SOURCE_READBACK"
  };
}

function source(input: Omit<SourceAsset, "hash">): SourceAsset {
  return { ...input, hash: stableDigest(input) };
}

const M1_REFS = {
  strategicPortfolio: exactRef(
    "CONTRACT",
    "strategic-portfolio.v1",
    "packages/shared-contracts/src/strategic-portfolio.ts",
    1,
    82
  ),
  fullVertical: exactRef(
    "CONTRACT",
    "shanghai-full-vertical.v1",
    "packages/shared-contracts/src/shanghai-full-vertical.ts",
    1,
    85
  ),
  scenarioFactory: exactRef(
    "CONTRACT",
    "r7-scenario-factory",
    "packages/shared-contracts/src/scenario-factory.ts",
    1,
    362
  ),
  compiler: exactRef(
    "CODE",
    "eldercare-scenario-compiler",
    "services/simulation-core/src/eldercare-scenario-compiler.ts",
    1,
    184
  ),
  integration: exactRef(
    "TEST",
    "shanghai-full-vertical-endpoint",
    "tests/integration/shanghai-full-vertical-endpoint.test.ts",
    1,
    190
  )
} as const;

function createM1Sources(): SourceAsset[] {
  return [
    source({
      source_id: "SH-M1-SRC-AGEING-DEMAND-ANCHOR",
      source_type: "SYNTHETIC",
      source_date: "2024-12-31",
      geography: "Shanghai",
      time_scope: "2024",
      provenance: "bounded synthetic anchor for support-pack rehearsal; not an official statistic",
      license_or_usage_status: "INTERNAL_SUPPORT_ONLY",
      confidence: "MEDIUM",
      sensitivity: "PUBLIC",
      role_visibility: "STUDENT_SAFE",
      derived_from: ["historical-teaching-capability-snapshot"],
      evidence_status: "REFERENCE_ONLY",
      content_basis: "bounded demand-pressure direction only; no real organization or person"
    }),
    source({
      source_id: "SH-M1-SRC-WORKFORCE-QUALITY-ANCHOR",
      source_type: "SYNTHETIC",
      source_date: "2024-12-31",
      geography: "Shanghai",
      time_scope: "2024",
      provenance: "bounded synthetic anchor for workforce-quality experiment",
      license_or_usage_status: "INTERNAL_SUPPORT_ONLY",
      confidence: "MEDIUM",
      sensitivity: "PUBLIC",
      role_visibility: "STUDENT_SAFE",
      derived_from: ["historical-teaching-capability-snapshot"],
      evidence_status: "REFERENCE_ONLY",
      content_basis: "directional workforce and service-quality trade-off; not a measured fact"
    }),
    source({
      source_id: "SH-M1-SRC-CAPITAL-EXPANSION-ANCHOR",
      source_type: "SYNTHETIC",
      source_date: "2024-12-31",
      geography: "Shanghai",
      time_scope: "2024-2026",
      provenance: "bounded synthetic capital sequencing anchor",
      license_or_usage_status: "INTERNAL_SUPPORT_ONLY",
      confidence: "LOW",
      sensitivity: "PUBLIC",
      role_visibility: "STUDENT_SAFE",
      derived_from: ["strategic-portfolio-contract"],
      evidence_status: "REFERENCE_ONLY",
      content_basis: "candidate expansion trade-off with no real project identity"
    }),
    source({
      source_id: "SH-M1-SRC-POLICY-STAKEHOLDER-ANCHOR",
      source_type: "SYNTHETIC",
      source_date: "2024-12-31",
      geography: "Shanghai",
      time_scope: "2024-2026",
      provenance: "bounded synthetic policy and stakeholder shock anchor",
      license_or_usage_status: "INTERNAL_SUPPORT_ONLY",
      confidence: "LOW",
      sensitivity: "PUBLIC",
      role_visibility: "STUDENT_SAFE",
      derived_from: ["governed-stakeholder-shadow-plane"],
      evidence_status: "REFERENCE_ONLY",
      content_basis: "directional shock only; no private stakeholder signal"
    })
  ];
}

function createM1Observations(): Observation[] {
  return [
    {
      observation_id: "SH-M1-OBS-AGEING-DEMAND",
      source_id: "SH-M1-SRC-AGEING-DEMAND-ANCHOR",
      location: "Shanghai-wide-support-scope",
      period: "2024",
      basis: "synthetic_bounded_anchor",
      unit: "index_points",
      geography: "Shanghai",
      data_type: "SYNTHETIC",
      value: 0.62,
      confidence: "MEDIUM",
      sensitivity: "PUBLIC",
      observation_status: "CANDIDATE_ANCHOR",
      expiry: "2026-12-31"
    },
    {
      observation_id: "SH-M1-OBS-WORKFORCE-QUALITY",
      source_id: "SH-M1-SRC-WORKFORCE-QUALITY-ANCHOR",
      location: "Shanghai-wide-support-scope",
      period: "2024",
      basis: "synthetic_bounded_anchor",
      unit: "quality_index",
      geography: "Shanghai",
      data_type: "SYNTHETIC",
      value: 0.58,
      confidence: "MEDIUM",
      sensitivity: "PUBLIC",
      observation_status: "CANDIDATE_ANCHOR",
      expiry: "2026-12-31"
    },
    {
      observation_id: "SH-M1-OBS-CAPITAL-HEADROOM",
      source_id: "SH-M1-SRC-CAPITAL-EXPANSION-ANCHOR",
      location: "Shanghai-wide-support-scope",
      period: "2024-2026",
      basis: "synthetic_bounded_anchor",
      unit: "relative_capacity",
      geography: "Shanghai",
      data_type: "INVESTMENT_MODEL",
      value: 0.45,
      confidence: "LOW",
      sensitivity: "PUBLIC",
      observation_status: "CANDIDATE_ANCHOR",
      expiry: "2026-12-31"
    },
    {
      observation_id: "SH-M1-OBS-POLICY-SHOCK",
      source_id: "SH-M1-SRC-POLICY-STAKEHOLDER-ANCHOR",
      location: "Shanghai-wide-support-scope",
      period: "2024-2026",
      basis: "synthetic_bounded_anchor",
      unit: "shock_level",
      geography: "Shanghai",
      data_type: "STRESS_TEST",
      value: 0.3,
      confidence: "LOW",
      sensitivity: "PUBLIC",
      observation_status: "CANDIDATE_ANCHOR",
      expiry: "2026-12-31"
    }
  ];
}

function createM1Features(): FeatureCandidate[] {
  return [
    {
      feature_id: "SH-M1-FEATURE-DEMAND-PRESSURE",
      name: "demand_pressure_candidate",
      value: 0.62,
      unit: "index_points",
      range: { min: 0, max: 1 },
      source_ids: ["SH-M1-SRC-AGEING-DEMAND-ANCHOR"],
      temporal_scope: "2024",
      geography: "Shanghai",
      confidence: "MEDIUM",
      possible_mod_consumer: "MAIN-ESL-O1 / demand-context",
      calibration_evidence: "NOT_PROVEN",
      visibility: "STUDENT_SAFE"
    },
    {
      feature_id: "SH-M1-FEATURE-WORKFORCE-QUALITY",
      name: "workforce_quality_candidate",
      value: 0.58,
      unit: "quality_index",
      range: { min: 0, max: 1 },
      source_ids: ["SH-M1-SRC-WORKFORCE-QUALITY-ANCHOR"],
      temporal_scope: "2024",
      geography: "Shanghai",
      confidence: "MEDIUM",
      possible_mod_consumer: "MAIN-ESL-O1 / operating-context",
      calibration_evidence: "NOT_PROVEN",
      visibility: "STUDENT_SAFE"
    },
    {
      feature_id: "SH-M1-FEATURE-CAPITAL-HEADROOM",
      name: "capital_headroom_candidate",
      value: 0.45,
      unit: "relative_capacity",
      range: { min: 0, max: 1 },
      source_ids: ["SH-M1-SRC-CAPITAL-EXPANSION-ANCHOR"],
      temporal_scope: "2024-2026",
      geography: "Shanghai",
      confidence: "LOW",
      possible_mod_consumer: "MAIN-ESL-O1 / portfolio-context",
      calibration_evidence: "NOT_PROVEN",
      visibility: "STUDENT_SAFE"
    },
    {
      feature_id: "SH-M1-FEATURE-POLICY-SHOCK",
      name: "policy_stakeholder_shock_candidate",
      value: 0.3,
      unit: "shock_level",
      range: { min: 0, max: 1 },
      source_ids: ["SH-M1-SRC-POLICY-STAKEHOLDER-ANCHOR"],
      temporal_scope: "2024-2026",
      geography: "Shanghai",
      confidence: "LOW",
      possible_mod_consumer: "MAIN-ESL-O1 / stakeholder-context",
      calibration_evidence: "NOT_PROVEN",
      visibility: "STUDENT_SAFE"
    }
  ];
}

function episode(
  episode_id: string,
  title: string,
  objective: string,
  situation: string,
  options: string[],
  observable_directions: string[],
  debrief: string,
  whatIf: string,
  transfer: string,
  feature_id: string,
  scenario_suffix: string,
  seed: number
): M1Episode {
  return {
    episode_id,
    title,
    objective,
    scenario_ref: {
      scenario_id: `sh-esl-next-01-scenario-${scenario_suffix}`,
      parameter_set_id: `sh-esl-next-01-parameter-${scenario_suffix}`,
      model_ref: "toy_logit_wellness_v1",
      course_id: "sh-esl-next-01-course-v1",
      run_id: `sh-esl-next-01-run-${scenario_suffix}`,
      seed,
      exact_refs: [M1_REFS.fullVertical, M1_REFS.strategicPortfolio, M1_REFS.compiler]
    },
    decision_context: {
      situation,
      options,
      correct_answer_supplied: false,
      student_private_truth: false
    },
    process: {
      authority: "CANDIDATE",
      evidence: [`record decision rationale against ${feature_id}`, "record trade-off considered"]
    },
    outcome_candidate: { authority: "CANDIDATE", observable_directions },
    learning_evidence: {
      authority: "CANDIDATE",
      prompts: [debrief, "identify which evidence would change the next decision"]
    },
    counterfactual: { authority: "CANDIDATE", what_if: whatIf, transfer_hook: transfer },
    teacher_hook: {
      objective,
      facilitation: [
        "ask for evidence before preference",
        "keep candidate outcome separate from grading"
      ],
      private_fields: ["teacher_notes", "unpublished_rubric_context"]
    },
    student_evidence: {
      visible: [
        "situation",
        "decision options",
        "own rationale",
        "candidate outcome direction",
        "reflection prompts"
      ],
      hidden: ["private_truth", "correct_answer", "final_ranking"]
    },
    loop: ["Decision", "Outcome", "Debrief", "What-if", "Transfer"],
    ai_mode: "OFF",
    final_ranking_prefilled: false
  };
}

export function buildM1ExecutiveSeason(): M1ExecutiveSeasonPack {
  const sources = createM1Sources();
  const observations = createM1Observations();
  const features = createM1Features();
  const transformations: TransformationRecord[] = features.map((feature, index) => ({
    transformation_id: `SH-M1-TRANSFORM-${index + 1}`,
    input: [observations[index]?.observation_id ?? "MISSING"],
    rule: "copy bounded candidate anchor into a named feature without extrapolation",
    assumption: "synthetic value is a teaching candidate, not an official measurement",
    output: feature.feature_id,
    unit: feature.unit,
    time_scope: feature.temporal_scope,
    geography: feature.geography,
    confidence: feature.confidence,
    provenance: feature.source_ids.join(",")
  }));
  const scenarioSpecs: ReadonlyArray<readonly [string, string, string, number]> = [
    [
      "positioning-portfolio",
      "Positioning and portfolio choice",
      "SH-M1-FEATURE-DEMAND-PRESSURE",
      11
    ],
    [
      "workforce-quality",
      "Workforce quality and service promise",
      "SH-M1-FEATURE-WORKFORCE-QUALITY",
      12
    ],
    ["capital-expansion", "Capital expansion under headroom", "SH-M1-FEATURE-CAPITAL-HEADROOM", 13],
    ["policy-stakeholder-shock", "Policy and stakeholder shock", "SH-M1-FEATURE-POLICY-SHOCK", 14]
  ];
  const scenarios: ScenarioCandidate[] = scenarioSpecs.map(([suffix, title, feature_id]) => ({
    scenario_id: `sh-esl-next-01-scenario-${suffix}`,
    title,
    geography: "Shanghai",
    time_scope: "2024-2026",
    data_type: "SYNTHETIC",
    source_ids: sources.map((item) => item.source_id),
    feature_ids: [feature_id as string],
    transfer_ids: [],
    visibility: "STUDENT_SAFE",
    exact_refs: [M1_REFS.fullVertical, M1_REFS.scenarioFactory],
    no_correct_answer_prefilled: true,
    formal_runtime_admitted: false
  }));
  const episodes = [
    episode(
      "SH-ESL-NEXT-01-E01",
      "定位与组合：先承诺什么",
      "让学员把定位承诺与组合取舍连接起来",
      "需求压力候选上升，但资源只能支持一项组合承诺。",
      ["聚焦高体验小组合", "扩大覆盖并降低承诺", "延迟扩张并验证信号"],
      [
        "coverage may improve while consistency falls",
        "focus may strengthen quality evidence",
        "delay preserves option value"
      ],
      "哪些证据让你把定位视为可检验假设，而不是口号？",
      "如果需求压力只在一个区域出现，组合是否仍应扩张？",
      "将候选定位假设迁移到下一城市时，先检查地理与时间范围。",
      "SH-M1-FEATURE-DEMAND-PRESSURE",
      "positioning-portfolio",
      11
    ),
    episode(
      "SH-ESL-NEXT-01-E02",
      "人员与质量：承诺能否交付",
      "让学员识别人员质量、容量和服务承诺的耦合关系",
      "服务质量候选下降，团队必须在招募、培训和容量之间排序。",
      ["优先培训并控制容量", "优先扩容并接受波动", "维持容量并降低承诺"],
      [
        "quality evidence may lag investment",
        "capacity can expose service variance",
        "lower promise narrows downside"
      ],
      "你区分了投入过程、服务结果和学习证据吗？",
      "如果质量信号是滞后的，下一回合会如何保留不确定性？",
      "转移到不同区域前，验证劳动力与服务定义是否可比。",
      "SH-M1-FEATURE-WORKFORCE-QUALITY",
      "workforce-quality",
      12
    ),
    episode(
      "SH-ESL-NEXT-01-E03",
      "资本扩张：先投哪里",
      "让学员在资本约束下解释项目排序，而非寻找唯一答案",
      "两个扩张项目都可行，但现金缓冲和启动时序不能同时最大化。",
      ["先投短周期项目", "先投规模项目", "分阶段保留选择权"],
      [
        "short cycle improves learning speed",
        "scale may amplify both upside and exposure",
        "staging protects cash headroom"
      ],
      "哪一项假设决定了你的资本顺序？",
      "如果融资成本上升，哪些项目应被暂停而不是删除？",
      "将项目排序方法迁移到另一城市，不迁移上海常数。",
      "SH-M1-FEATURE-CAPITAL-HEADROOM",
      "capital-expansion",
      13
    ),
    episode(
      "SH-ESL-NEXT-01-E04",
      "政策与利益相关者：冲击下重排",
      "让学员在冲击下分离过程、结果、复盘和反事实",
      "政策与利益相关者冲击候选出现，团队需要重排优先级并保留审计依据。",
      ["调整服务承诺", "调整扩张节奏", "保持计划并增加观测"],
      [
        "adjustment changes exposure",
        "slower expansion creates evidence",
        "holding course can reveal signal persistence"
      ],
      "哪些信息属于观察，哪些只是你的机制解释？",
      "如果冲击只影响一个利益相关者群体，怎样避免过度外推？",
      "迁移时保留冲击机制，但重新验证制度与权利边界。",
      "SH-M1-FEATURE-POLICY-SHOCK",
      "policy-stakeholder-shock",
      14
    )
  ];
  const packWithoutDigest: Omit<M1ExecutiveSeasonPack, "pack_digest"> = {
    schema_version: SH_NEXT_SUPPORT_SCHEMA_VERSION,
    macro_key: "M1" as const,
    mission_id: "SH-ESL-NEXT-01-SHANGHAI-EXECUTIVE-STRATEGY-EXPERIMENT-SEASON" as const,
    state_transition: { from: "STATE_A" as const, to: "STATE_B" as const },
    sources,
    observations,
    features,
    transformations,
    regional_transfers: [],
    scenarios,
    episodes,
    conflict_ledger: [],
    provenance_graph: {
      nodes: [
        ...sources.map((item) => ({ id: item.source_id, kind: "SOURCE" as const })),
        ...observations.map((item) => ({ id: item.observation_id, kind: "OBSERVATION" as const })),
        ...features.map((item) => ({ id: item.feature_id, kind: "FEATURE" as const })),
        ...scenarios.map((item) => ({ id: item.scenario_id, kind: "SCENARIO" as const })),
        ...episodes.map((item) => ({ id: item.episode_id, kind: "EPISODE" as const }))
      ],
      edges: [
        ...observations.map((item) => ({
          from: item.source_id,
          to: item.observation_id,
          relation: "DERIVED_FROM" as const
        })),
        ...features.flatMap((item) =>
          item.source_ids.map((source_id) => ({
            from: source_id,
            to: item.feature_id,
            relation: "DERIVED_FROM" as const
          }))
        ),
        ...scenarios.flatMap((item) =>
          item.feature_ids.map((feature_id) => ({
            from: feature_id,
            to: item.scenario_id,
            relation: "USES" as const
          }))
        ),
        ...episodes.map((item) => ({
          from: item.scenario_ref.scenario_id,
          to: item.episode_id,
          relation: "TEACHES" as const
        }))
      ]
    },
    role_visibility: {
      teacher: {
        visibility: "TEACHER_ONLY" as const,
        fields: ["teacher_hook", "provenance", "candidate_outcome"]
      },
      student: {
        visibility: "STUDENT_SAFE" as const,
        fields: ["situation", "options", "own_rationale", "candidate_outcome", "reflection"],
        forbidden_fields: [
          "private_truth",
          "correct_answer",
          "final_ranking",
          "unpublished_teacher_notes"
        ]
      },
      admin: {
        visibility: "INTERNAL_RESEARCH_ONLY" as const,
        fields: ["audit_manifest", "source_hashes", "exact_refs"]
      }
    },
    consumer: {
      classification: "C1" as const,
      consumer_id: "MAIN-ESL-O1-EXECUTIVE-STRATEGY-LAB" as const,
      consumer_ready: false,
      formal_join: false,
      exact_binding_required: true
    },
    authority: {
      candidate_writer: "SH_NEXT_SUPPORT_CANDIDATE_COMPILER" as const,
      official_truth_write: false,
      settlement_write: false,
      parameter_set_formal_write: false,
      provider: "OFF" as const,
      runtime_authority: "JSON_INTERNAL_ONLY" as const
    },
    mjp: {
      status: "PASS" as const,
      episode_id: "SH-ESL-NEXT-01-E01",
      checks: [
        "exact Scenario/Parameter/Model/Course/Run refs",
        "student-safe projection",
        "AI-off baseline",
        "no prefilled correct strategy"
      ]
    },
    main_handoff: {
      status: "JOIN_WITH_LIMITS" as const,
      required_consumer_action: "PROVE_C0_SOURCE_CONTRACT_SEAM" as const,
      exact_refs: [M1_REFS.fullVertical, M1_REFS.strategicPortfolio, M1_REFS.integration]
    },
    known_limits: [
      "Sources are bounded synthetic support anchors and do not prove official Shanghai measurements.",
      "No current MAIN-ESL consumer seam was found at the frozen source revision; this is a C1 forward pack.",
      "The candidate model reference is not calibration evidence and remains AI-off.",
      "Formal ScenarioPackage/ParameterSet admission remains MAIN-owned."
    ]
  };
  return { ...packWithoutDigest, pack_digest: stableDigest(packWithoutDigest) };
}

export function validateM1ExecutiveSeason(pack: M1ExecutiveSeasonPack): string[] {
  const issues: string[] = [];
  const { pack_digest, ...packContent } = pack;
  if (stableDigest(packContent) !== pack_digest) issues.push("m1_pack_digest_mismatch");
  if (pack.episodes.length !== 4) issues.push("m1_episode_count_invalid");
  if (pack.state_transition.to !== "STATE_B") issues.push("m1_state_transition_incomplete");
  if (
    pack.authority.official_truth_write ||
    pack.authority.settlement_write ||
    pack.authority.parameter_set_formal_write
  ) {
    issues.push("m1_forbidden_authority_enabled");
  }
  if (pack.authority.provider !== "OFF") issues.push("m1_provider_not_off");
  for (const episode of pack.episodes) {
    if (episode.ai_mode !== "OFF") issues.push(`${episode.episode_id}:ai_not_off`);
    if (episode.final_ranking_prefilled) issues.push(`${episode.episode_id}:ranking_prefilled`);
    if (episode.decision_context.correct_answer_supplied)
      issues.push(`${episode.episode_id}:answer_prefilled`);
    if (
      episode.outcome_candidate.final_score !== undefined ||
      episode.outcome_candidate.final_rank !== undefined
    ) {
      issues.push(`${episode.episode_id}:formal_outcome_leak`);
    }
    if (episode.loop.join("→") !== "Decision→Outcome→Debrief→What-if→Transfer") {
      issues.push(`${episode.episode_id}:loop_incomplete`);
    }
  }
  if (pack.mjp.status !== "PASS") issues.push("m1_mjp_not_pass");
  if (pack.consumer.formal_join) issues.push("m1_consumer_claimed_ready_without_c0");
  if (pack.sources.some((item) => !/^[a-f0-9]{64}$/.test(item.hash)))
    issues.push("m1_source_hash_invalid");
  if (
    pack.features.some(
      (item) => item.calibration_evidence !== "NOT_PROVEN" && item.calibration_evidence !== "NONE"
    )
  ) {
    issues.push("m1_calibration_claim_unbounded");
  }
  return issues;
}

export function projectM1ForStudent(pack: M1ExecutiveSeasonPack): M1StudentProjection {
  return {
    visibility: "STUDENT_SAFE",
    episodes: pack.episodes.map((episode) => ({
      episode_id: episode.episode_id,
      title: episode.title,
      objective: episode.objective,
      situation: episode.decision_context.situation,
      options: [...episode.decision_context.options],
      candidate_outcome: [...episode.outcome_candidate.observable_directions],
      reflection: [...episode.learning_evidence.prompts],
      visible_fields: ["situation", "options", "own_rationale", "candidate_outcome", "reflection"]
    }))
  };
}

export * from "./m2-capital-sequencing.js";
export * from "./m3-operating-stress.js";
export * from "./m4-portability.js";
export * from "./m5-reality-qualification.js";
