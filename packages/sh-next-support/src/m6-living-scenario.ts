import { stableDigest } from "./index.js";
import type { ExactRef } from "./index.js";
import { buildM1ExecutiveSeason } from "./index.js";
import { buildM2CapitalSequencingWorld } from "./m2-capital-sequencing.js";
import { buildM3OperatingStressWorld } from "./m3-operating-stress.js";
import { buildM4PortabilityCompatibilityPack } from "./m4-portability.js";
import {
  buildM5RealityQualificationPack,
  classifyM5Qualification,
  type M5QualificationGateInput,
  type M5RealityQualificationPack,
  type M5QualificationStatus
} from "./m5-reality-qualification.js";

export const M6_SOURCE_MASTER_SHA = "d573ea20ab352b5cc6f22d6af3de45c68f6d3334" as const;
export const M6_SCHEMA_VERSION = "sh-next-living-scenario.v1" as const;
export const M6_MISSION_ID = "SH-OPS-NEXT-01-LIVING-SCENARIO-REFRESH-DRIFT-ROLLBACK" as const;
export const M6_VALIDATION_AS_OF = "2026-08-29" as const;

export type M6LifecycleEventType =
  | "REFRESH"
  | "DIFF"
  | "IMPACT"
  | "REQUALIFY"
  | "ROLLBACK_CANDIDATE"
  | "HISTORICAL_RESOLUTION"
  | "RETIRE";
export type M6LifecycleEventStatus = "RECORDED" | "CANDIDATE_ONLY";
export type M6ImpactNodeKind = "SOURCE" | "FEATURE" | "MODEL" | "SCENARIO_CONSUMER";

export interface M6RefreshCandidate {
  source_id: string;
  source_version: string;
  prior_expiry: string;
  current_as_of: string;
  trigger: "EXPIRY_DETECTED";
  refresh_status: "CANDIDATE_REFRESH_ONLY";
  retrieval_status: "NOT_RETRIEVED";
  rights_status: "PUBLIC_SAFE";
  promoted: false;
  digest: string;
}

export interface M6DiffChange {
  field: "expiry" | "evidence_status";
  previous: string;
  current: string;
  change_kind: "EXPIRY" | "CONTENT";
  evidence_status: "REFERENCE_ONLY" | "NOT_RETRIEVED";
  provenance: string;
}

export interface M6ScenarioDiff {
  diff_id: string;
  baseline_digest: string;
  candidate_digest: string;
  status: "DIFF_RECORDED";
  changes: M6DiffChange[];
  unsupported_claims_are_facts: false;
  digest: string;
}

export interface M6ImpactEdge {
  edge_id: string;
  from: { kind: M6ImpactNodeKind; id: string };
  to: { kind: M6ImpactNodeKind; id: string };
  relationship: "SOURCE_FEEDS_FEATURE" | "FEATURE_FEEDS_MODEL" | "MODEL_AFFECTS_CONSUMER";
  impact_status: "REQUALIFICATION_REQUIRED";
  digest: string;
}

export interface M6Requalification {
  qualification_id: string;
  upstream_m5_pack_digest: string;
  classifier_input: M5QualificationGateInput;
  qualification_status: M5QualificationStatus;
  evidence_status: "NOT_RETRIEVED";
  calibration_eligible: false;
  formal_truth_overwritten: false;
  consumer_ready: false;
  digest: string;
}

export interface M6RollbackCandidate {
  rollback_id: string;
  active_version: string;
  candidate_version: string;
  rollback_version: string;
  version_guard: "EXACT_VERSION_REQUIRED";
  dry_run: true;
  executed: false;
  formal_write: false;
  deletion: false;
  resolution: "SAFE_DRY_RUN_CANDIDATE";
  checks: string[];
  digest: string;
}

export interface M6HistoricalResolution {
  request_id: string;
  requested_version: string;
  resolved_version: string;
  resolution_status: "EXACT_VERSION_RESOLVED";
  implicit_latest_forbidden: true;
  resolved_digest: string;
  history_deletion: false;
  digest: string;
}

export interface M6LifecycleEvent {
  event_id: string;
  event_type: M6LifecycleEventType;
  occurred_as_of: string;
  input_version: string;
  output_version: string;
  status: M6LifecycleEventStatus;
  exact_refs: ExactRef[];
  digest: string;
}

export interface M6CapabilityTombstone {
  macro_key: "M1" | "M2" | "M3" | "M4" | "M5";
  capability_id: string;
  status: "REUSED";
  pack_digest: string;
  writer_authority: "SH_NEXT_SUPPORT_CANDIDATE_COMPILER";
}

export interface M6ChainSummary {
  macro_keys: ["M1", "M2", "M3", "M4", "M5"];
  pack_digests: {
    M1: string;
    M2: string;
    M3: string;
    M4: string;
    M5: string;
  };
  tombstones: M6CapabilityTombstone[];
  no_second_writer: true;
}

export interface M6LivingScenarioLifecyclePack {
  schema_version: typeof M6_SCHEMA_VERSION;
  macro_key: "M6";
  mission_id: typeof M6_MISSION_ID;
  validation_as_of: typeof M6_VALIDATION_AS_OF;
  state_transition: { from: "STATE_A"; to: "STATE_B" };
  source_freeze: {
    status: "REFERENCE_ONLY_WITH_SYNTHETIC_FALLBACK";
    upstream_m5_retrieval: "REUSED_EXACT_PACK";
    unsupported_claims_are_facts: false;
  };
  reuse: {
    upstream_macro: "M5";
    upstream_pack_digest: string;
    reuse_count: number;
    regenerated: false;
    reuse_policy: "REUSE_EXACT_UPSTREAM_PACK_ONCE";
  };
  refresh_candidate: M6RefreshCandidate;
  diff: M6ScenarioDiff;
  impact_graph: M6ImpactEdge[];
  requalification: M6Requalification;
  rollback_candidate: M6RollbackCandidate;
  historical_resolution: M6HistoricalResolution;
  events: M6LifecycleEvent[];
  chain_summary: M6ChainSummary;
  role_visibility: {
    teacher: { visibility: "TEACHER_ONLY"; fields: string[] };
    student: { visibility: "STUDENT_SAFE"; fields: string[]; forbidden_fields: string[] };
    admin: { visibility: "INTERNAL_RESEARCH_ONLY"; fields: string[] };
  };
  consumer: {
    classification: "C1";
    consumer_ids: string[];
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
  mjp: { status: "PASS"; lifecycle_cycle_id: string; checks: string[] };
  known_limits: string[];
  pack_digest: string;
}

const EVENT_TYPES: readonly M6LifecycleEventType[] = [
  "REFRESH",
  "DIFF",
  "IMPACT",
  "REQUALIFY",
  "ROLLBACK_CANDIDATE",
  "HISTORICAL_RESOLUTION",
  "RETIRE"
];

const M6_EXACT_REFS = {
  m5: exactRef(
    "CODE",
    "sh-next-reality-qualification.v1",
    "packages/sh-next-support/src/m5-reality-qualification.ts",
    "EXACT_SOURCE_READBACK"
  ),
  lifecycleSource: exactRef(
    "CODE",
    "sh-next-living-scenario.v1",
    "packages/sh-next-support/src/m6-living-scenario.ts",
    "REFERENCE_ONLY"
  ),
  lifecycleSchema: exactRef(
    "CONTRACT",
    "sh-next-living-scenario.v1",
    "contracts/schemas/sh-next-living-scenario.v1.json",
    "REFERENCE_ONLY"
  ),
  lifecycleTests: exactRef(
    "TEST",
    "m6-living-scenario-tests",
    "tests/sh-next-support/m6-living-scenario.test.ts",
    "REFERENCE_ONLY"
  )
} as const;

function exactRef(
  ref_type: ExactRef["ref_type"],
  ref_id: string,
  path_or_uri: string,
  readback_status: ExactRef["readback_status"]
): ExactRef {
  return {
    ref_type,
    ref_id,
    path_or_uri,
    revision: M6_SOURCE_MASTER_SHA,
    digest: stableDigest({ ref_type, ref_id, path_or_uri, revision: M6_SOURCE_MASTER_SHA }),
    readback_status
  };
}

function withDigest<T extends Record<string, unknown>>(content: T): T & { digest: string } {
  return { ...content, digest: stableDigest(content) };
}

function buildChainSummary(m5: M5RealityQualificationPack): M6ChainSummary {
  const m1 = buildM1ExecutiveSeason();
  const m2 = buildM2CapitalSequencingWorld();
  const m3 = buildM3OperatingStressWorld();
  const m4 = buildM4PortabilityCompatibilityPack();
  const pack_digests = {
    M1: m1.pack_digest,
    M2: m2.pack_digest,
    M3: m3.pack_digest,
    M4: m4.pack_digest,
    M5: m5.pack_digest
  };
  const tombstoneData: ReadonlyArray<readonly [M6CapabilityTombstone["macro_key"], string]> = [
    ["M1", "SH-M1-EXECUTIVE-SEASON"],
    ["M2", "SH-M2-CAPITAL-SEQUENCING"],
    ["M3", "SH-M3-OPERATING-STRESS"],
    ["M4", "SH-M4-PORTABILITY"],
    ["M5", "SH-M5-REALITY-QUALIFICATION"]
  ];
  return {
    macro_keys: ["M1", "M2", "M3", "M4", "M5"],
    pack_digests,
    tombstones: tombstoneData.map(([macro_key, capability_id]) => ({
      macro_key,
      capability_id,
      status: "REUSED",
      pack_digest: pack_digests[macro_key],
      writer_authority: "SH_NEXT_SUPPORT_CANDIDATE_COMPILER"
    })),
    no_second_writer: true
  };
}

function buildEvents(
  activeVersion: string,
  candidateVersion: string,
  rollbackVersion: string
): M6LifecycleEvent[] {
  const versions: Record<M6LifecycleEventType, readonly [string, string, M6LifecycleEventStatus]> =
    {
      REFRESH: [activeVersion, candidateVersion, "CANDIDATE_ONLY"],
      DIFF: [activeVersion, candidateVersion, "RECORDED"],
      IMPACT: [candidateVersion, candidateVersion, "RECORDED"],
      REQUALIFY: [candidateVersion, candidateVersion, "RECORDED"],
      ROLLBACK_CANDIDATE: [candidateVersion, rollbackVersion, "CANDIDATE_ONLY"],
      HISTORICAL_RESOLUTION: [activeVersion, activeVersion, "RECORDED"],
      RETIRE: [candidateVersion, candidateVersion, "CANDIDATE_ONLY"]
    };
  return EVENT_TYPES.map((event_type) => {
    const [input_version, output_version, status] = versions[event_type];
    return withDigest({
      event_id: `SH-M6-EVENT-${event_type}`,
      event_type,
      occurred_as_of: M6_VALIDATION_AS_OF,
      input_version,
      output_version,
      status,
      exact_refs: [M6_EXACT_REFS.m5, M6_EXACT_REFS.lifecycleSource]
    });
  });
}

export function buildM6LivingScenarioLifecyclePack(): M6LivingScenarioLifecyclePack {
  const m5 = buildM5RealityQualificationPack();
  const source = m5.sources.find((item) => item.source_id.includes("TRANSPORT"));
  const quality = source
    ? m5.source_quality.find((item) => item.source_id === source.source_id)
    : undefined;
  if (!source || !quality) throw new Error("M6_UPSTREAM_TRANSPORT_SOURCE_NOT_FOUND");

  const activeVersion = `${source.source_id}@2025-V1`;
  const candidateVersion = `${source.source_id}@2026-08-29-CANDIDATE`;
  const rollbackVersion = activeVersion;
  const refreshContent = {
    source_id: source.source_id,
    source_version: candidateVersion,
    prior_expiry: quality.expiry,
    current_as_of: M6_VALIDATION_AS_OF,
    trigger: "EXPIRY_DETECTED" as const,
    refresh_status: "CANDIDATE_REFRESH_ONLY" as const,
    retrieval_status: "NOT_RETRIEVED" as const,
    rights_status: "PUBLIC_SAFE" as const,
    promoted: false as const
  };
  const refresh_candidate = withDigest(refreshContent);
  const diffCandidateDigest = stableDigest({
    source_id: source.source_id,
    source_version: candidateVersion,
    retrieval_status: refresh_candidate.retrieval_status,
    current_as_of: M6_VALIDATION_AS_OF
  });
  const diffContent = {
    diff_id: "SH-M6-DIFF-TRANSPORT-EXPIRY-2026",
    baseline_digest: m5.pack_digest,
    candidate_digest: diffCandidateDigest,
    status: "DIFF_RECORDED" as const,
    changes: [
      {
        field: "expiry" as const,
        previous: quality.expiry,
        current: M6_VALIDATION_AS_OF,
        change_kind: "EXPIRY" as const,
        evidence_status: "REFERENCE_ONLY" as const,
        provenance:
          "M5 source-quality expiry is used as an explicit refresh trigger; no current release was retrieved"
      },
      {
        field: "evidence_status" as const,
        previous: source.evidence_status,
        current: "REFRESH_NOT_RETRIEVED",
        change_kind: "CONTENT" as const,
        evidence_status: "NOT_RETRIEVED" as const,
        provenance:
          "refresh candidate records the absence of a new official source instead of inventing one"
      }
    ],
    unsupported_claims_are_facts: false as const
  };
  const diff = withDigest(diffContent);
  const impactContent: ReadonlyArray<Omit<M6ImpactEdge, "digest">> = [
    {
      edge_id: "SH-M6-IMPACT-SOURCE-SPATIAL",
      from: { kind: "SOURCE", id: source.source_id },
      to: { kind: "FEATURE", id: "SH-M5-FEATURE-SPATIAL" },
      relationship: "SOURCE_FEEDS_FEATURE",
      impact_status: "REQUALIFICATION_REQUIRED"
    },
    {
      edge_id: "SH-M6-IMPACT-FEATURE-MOD",
      from: { kind: "FEATURE", id: "SH-M5-FEATURE-SPATIAL" },
      to: { kind: "MODEL", id: "MOD-CALIBRATION-DIAGNOSTICS" },
      relationship: "FEATURE_FEEDS_MODEL",
      impact_status: "REQUALIFICATION_REQUIRED"
    },
    {
      edge_id: "SH-M6-IMPACT-MOD-MAIN",
      from: { kind: "MODEL", id: "MOD-CALIBRATION-DIAGNOSTICS" },
      to: { kind: "SCENARIO_CONSUMER", id: "MAIN-RT-O1-REGIONAL-TRANSFER-AND-SCENARIO-EVOLUTION" },
      relationship: "MODEL_AFFECTS_CONSUMER",
      impact_status: "REQUALIFICATION_REQUIRED"
    },
    {
      edge_id: "SH-M6-IMPACT-FEATURE-FE",
      from: { kind: "FEATURE", id: "SH-M5-FEATURE-SPATIAL" },
      to: { kind: "SCENARIO_CONSUMER", id: "FE-KNOWN-LIMITS" },
      relationship: "MODEL_AFFECTS_CONSUMER",
      impact_status: "REQUALIFICATION_REQUIRED"
    }
  ];
  const impact_graph = impactContent.map((edge) => withDigest(edge));
  const classifier_input: M5QualificationGateInput = {
    source_retrieved: false,
    rights_status: "PUBLIC_SAFE",
    conflict_count: m5.conflict_ledger.length,
    required_domains: m5.eligibility.length,
    computed_domains: 0,
    holdout_leakage_count: m5.holdout.leakage_count,
    replay_only: false
  };
  const requalification = withDigest({
    qualification_id: "SH-M6-REQUALIFY-M5-REFERENCE-2025",
    upstream_m5_pack_digest: m5.pack_digest,
    classifier_input,
    qualification_status: classifyM5Qualification(classifier_input),
    evidence_status: "NOT_RETRIEVED" as const,
    calibration_eligible: false as const,
    formal_truth_overwritten: false as const,
    consumer_ready: false as const
  });
  const rollback_candidate = withDigest({
    rollback_id: "SH-M6-ROLLBACK-CANDIDATE-TRANSPORT-V1",
    active_version: activeVersion,
    candidate_version: candidateVersion,
    rollback_version: rollbackVersion,
    version_guard: "EXACT_VERSION_REQUIRED" as const,
    dry_run: true as const,
    executed: false as const,
    formal_write: false as const,
    deletion: false as const,
    resolution: "SAFE_DRY_RUN_CANDIDATE" as const,
    checks: [
      "active version is named explicitly",
      "rollback version resolves to the prior exact candidate version",
      "no implicit latest lookup is used",
      "dry run does not execute a runtime or formal writer",
      "history is retained and no deletion is requested"
    ]
  });
  const historical_resolution = withDigest({
    request_id: "SH-M6-HISTORY-RESOLVE-M5-REFERENCE-2025-V1",
    requested_version: "SH-M5-REALITY-REFERENCE-2025-V1",
    resolved_version: "SH-M5-REALITY-REFERENCE-2025-V1",
    resolution_status: "EXACT_VERSION_RESOLVED" as const,
    implicit_latest_forbidden: true as const,
    resolved_digest: m5.pack_digest,
    history_deletion: false as const
  });
  const chain_summary = buildChainSummary(m5);
  const packWithoutDigest: Omit<M6LivingScenarioLifecyclePack, "pack_digest"> = {
    schema_version: M6_SCHEMA_VERSION,
    macro_key: "M6",
    mission_id: M6_MISSION_ID,
    validation_as_of: M6_VALIDATION_AS_OF,
    state_transition: { from: "STATE_A", to: "STATE_B" },
    source_freeze: {
      status: "REFERENCE_ONLY_WITH_SYNTHETIC_FALLBACK",
      upstream_m5_retrieval: "REUSED_EXACT_PACK",
      unsupported_claims_are_facts: false
    },
    reuse: {
      upstream_macro: "M5",
      upstream_pack_digest: m5.pack_digest,
      reuse_count: 1,
      regenerated: false,
      reuse_policy: "REUSE_EXACT_UPSTREAM_PACK_ONCE"
    },
    refresh_candidate,
    diff,
    impact_graph,
    requalification,
    rollback_candidate,
    historical_resolution,
    events: buildEvents(activeVersion, candidateVersion, rollbackVersion),
    chain_summary,
    role_visibility: {
      teacher: {
        visibility: "TEACHER_ONLY",
        fields: [
          "refresh_candidate",
          "diff",
          "impact_graph",
          "requalification",
          "rollback_candidate",
          "historical_resolution"
        ]
      },
      student: {
        visibility: "STUDENT_SAFE",
        fields: ["refresh_status", "bounded_change_direction", "known_limits"],
        forbidden_fields: [
          "private_truth",
          "official_calibration",
          "formal_settlement",
          "rollback_execution",
          "restricted_source"
        ]
      },
      admin: {
        visibility: "INTERNAL_RESEARCH_ONLY",
        fields: ["pack_digests", "exact_versions", "event_digests", "writer_guards"]
      }
    },
    consumer: {
      classification: "C1",
      consumer_ids: [
        "MAIN-RT-O1-REGIONAL-TRANSFER-AND-SCENARIO-EVOLUTION",
        "MOD-CALIBRATION-DIAGNOSTICS",
        "FE-KNOWN-LIMITS"
      ],
      consumer_ready: false,
      formal_join: false,
      exact_binding_required: true
    },
    authority: {
      candidate_writer: "SH_NEXT_SUPPORT_CANDIDATE_COMPILER",
      official_truth_write: false,
      settlement_write: false,
      parameter_set_formal_write: false,
      provider: "OFF",
      runtime_authority: "JSON_INTERNAL_ONLY"
    },
    mjp: {
      status: "PASS",
      lifecycle_cycle_id: "SH-M6-LIFECYCLE-CYCLE-2026-08-29",
      checks: [
        "expired source is converted into an explicit candidate refresh trigger",
        "diff records expiry and retrieval limits without unsupported facts",
        "impact graph reaches feature, MOD, MAIN, and frontend consumer boundaries",
        "M5 requalification returns NOT_ELIGIBLE without calibration promotion",
        "rollback candidate is exact-version dry-run only",
        "historical resolution forbids implicit latest and deletion"
      ]
    },
    known_limits: [
      "No new official public release was retrieved; refresh and diff remain reference-only candidates.",
      "M5 requalification remains NOT_ELIGIBLE and no calibrated model claim is emitted.",
      "Rollback is a dry-run candidate; no formal rollback, retire, or runtime write is executed.",
      "MAIN/MOD formal join remains pending on the exact C0 consumer contract seam.",
      "M1-M5 are represented by exact pack digests and tombstones; no second writer is introduced."
    ]
  };
  return { ...packWithoutDigest, pack_digest: stableDigest(packWithoutDigest) };
}

export function validateM6LivingScenarioLifecycle(pack: M6LivingScenarioLifecyclePack): string[] {
  const issues: string[] = [];
  const { pack_digest, ...content } = pack;
  if (stableDigest(content) !== pack_digest) issues.push("m6_pack_digest_mismatch");
  if (pack.state_transition.from !== "STATE_A" || pack.state_transition.to !== "STATE_B")
    issues.push("m6_state_transition_invalid");
  if (
    pack.reuse.upstream_macro !== "M5" ||
    pack.reuse.reuse_count !== 1 ||
    pack.reuse.regenerated ||
    pack.reuse.reuse_policy !== "REUSE_EXACT_UPSTREAM_PACK_ONCE"
  )
    issues.push("m6_reuse_guard_invalid");
  const refreshContent = Object.fromEntries(
    Object.entries(pack.refresh_candidate).filter(([key]) => key !== "digest")
  );
  if (stableDigest(refreshContent) !== pack.refresh_candidate.digest)
    issues.push("m6_refresh_digest_mismatch");
  const diffContent = Object.fromEntries(
    Object.entries(pack.diff).filter(([key]) => key !== "digest")
  );
  if (stableDigest(diffContent) !== pack.diff.digest) issues.push("m6_diff_digest_mismatch");
  if (pack.diff.baseline_digest !== pack.reuse.upstream_pack_digest)
    issues.push("m6_diff_baseline_not_bound");
  for (const edge of pack.impact_graph) {
    const edgeContent = Object.fromEntries(
      Object.entries(edge).filter(([key]) => key !== "digest")
    );
    if (stableDigest(edgeContent) !== edge.digest)
      issues.push(`${edge.edge_id}:m6_impact_digest_mismatch`);
  }
  const expectedQualification = classifyM5Qualification(pack.requalification.classifier_input);
  if (
    expectedQualification !== pack.requalification.qualification_status ||
    pack.requalification.qualification_status !== "NOT_ELIGIBLE" ||
    pack.requalification.calibration_eligible ||
    pack.requalification.formal_truth_overwritten ||
    pack.requalification.consumer_ready
  )
    issues.push("m6_requalification_guard_invalid");
  const rollbackContent = Object.fromEntries(
    Object.entries(pack.rollback_candidate).filter(([key]) => key !== "digest")
  );
  if (stableDigest(rollbackContent) !== pack.rollback_candidate.digest)
    issues.push("m6_rollback_digest_mismatch");
  if (
    !pack.rollback_candidate.dry_run ||
    pack.rollback_candidate.executed ||
    pack.rollback_candidate.formal_write ||
    pack.rollback_candidate.deletion ||
    pack.rollback_candidate.version_guard !== "EXACT_VERSION_REQUIRED" ||
    pack.rollback_candidate.candidate_version === "latest" ||
    pack.rollback_candidate.rollback_version === "latest"
  )
    issues.push("m6_rollback_guard_invalid");
  const historyContent = Object.fromEntries(
    Object.entries(pack.historical_resolution).filter(([key]) => key !== "digest")
  );
  if (stableDigest(historyContent) !== pack.historical_resolution.digest)
    issues.push("m6_history_digest_mismatch");
  if (
    !pack.historical_resolution.implicit_latest_forbidden ||
    pack.historical_resolution.history_deletion ||
    pack.historical_resolution.requested_version === "latest" ||
    pack.historical_resolution.resolution_status !== "EXACT_VERSION_RESOLVED" ||
    pack.historical_resolution.resolved_digest !== pack.reuse.upstream_pack_digest
  )
    issues.push("m6_history_guard_invalid");
  if (
    pack.events.length !== EVENT_TYPES.length ||
    pack.events.some((event, index) => event.event_type !== EVENT_TYPES[index])
  )
    issues.push("m6_event_sequence_invalid");
  for (const event of pack.events) {
    const eventContent = Object.fromEntries(
      Object.entries(event).filter(([key]) => key !== "digest")
    );
    if (stableDigest(eventContent) !== event.digest)
      issues.push(`${event.event_id}:m6_event_digest_mismatch`);
  }
  if (
    pack.chain_summary.macro_keys.join(",") !== "M1,M2,M3,M4,M5" ||
    Object.keys(pack.chain_summary.pack_digests).join(",") !== "M1,M2,M3,M4,M5" ||
    pack.chain_summary.tombstones.length !== 5 ||
    pack.chain_summary.tombstones.some((item) => item.status !== "REUSED") ||
    !pack.chain_summary.no_second_writer
  )
    issues.push("m6_chain_summary_invalid");
  if (
    pack.consumer.consumer_ready ||
    pack.consumer.formal_join ||
    !pack.consumer.exact_binding_required
  )
    issues.push("m6_consumer_claimed_ready_without_c0");
  if (
    pack.authority.provider !== "OFF" ||
    pack.authority.official_truth_write ||
    pack.authority.settlement_write ||
    pack.authority.parameter_set_formal_write
  )
    issues.push("m6_forbidden_authority_enabled");
  if (pack.mjp.status !== "PASS") issues.push("m6_mjp_not_pass");
  return issues;
}
