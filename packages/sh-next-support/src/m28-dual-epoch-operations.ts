import { stableDigest } from "./index.js";
import {
  buildM25PublicSourceRealityEvidenceEpochPack,
  validateM25PublicSourceRealityEvidenceEpochPack
} from "./m25-public-source-evidence.js";
import {
  buildM27SecondCityTransferRequalificationPack,
  validateM27SecondCityTransferRequalificationPack
} from "./m27-second-city-transfer.js";

export const M28_DUAL_EPOCH_SCHEMA_VERSION = "sh-dual-epoch-living-operations.v1" as const;
export const M28_CURRENT_MASTER_SHA = "cd7cff6dcd3bc7f896dd64333b08a2755155c8c8" as const;
export const M28_MISSION_ID = "SIMWAR-SH-M28-DUAL-EPOCH-LIVING-SCENARIO-OPERATIONS" as const;

export const M28_OPERATIONS = [
  "REFRESH",
  "DIFF",
  "IMPACT",
  "REQUALIFICATION",
  "ROLLBACK_CANDIDATE",
  "HISTORICAL_RESOLUTION",
  "WITHDRAW"
] as const;

export type M28OperationKind = (typeof M28_OPERATIONS)[number];

export type M28Operation = {
  sequence: number;
  operation: M28OperationKind;
  input_refs: string[];
  rule: string;
  assumption: string;
  output_refs: string[];
  status: "RECORDED";
  operation_digest: string;
};

export type M28Epoch = {
  epoch_id: string;
  version: string;
  status: "HISTORICAL_CANDIDATE" | "REFRESHED_CANDIDATE";
  parent_epoch_id: string | null;
  evidence_snapshot_id: string;
  evidence_snapshot_digest: string;
  content_change_status: "BASELINE_SNAPSHOT" | "NO_CONTENT_CHANGE_REFRESH_RECORDED";
  as_of: string;
  fetched_at: string;
  source_receipt_ids: string[];
  source_reality_class: "PUBLIC_SOURCE_BOUND";
  fallback_used: false;
  evidence_epoch_ref: {
    epoch_id: string;
    epoch_digest: string;
    source_epoch_base_sha: string;
  };
  transfer_candidate_ref: {
    transfer_id: string;
    pack_digest: string;
    candidate_version: string;
  };
  scenario_candidate_ref: {
    scenario_id: string;
    candidate_version: string;
    formal_runtime_admitted: false;
  };
  rights_status: "PUBLIC_REFERENCE_ONLY";
  expires_at: string;
  revalidation_required: true;
  content_digest: string;
};

export type M28FreshnessStatus = "VALID_BEFORE_EXPIRY" | "EXPIRY_REQUIRES_RECOMPILE";

export interface M28DualEpochLivingOperationsPack {
  schema_version: typeof M28_DUAL_EPOCH_SCHEMA_VERSION;
  mission_id: typeof M28_MISSION_ID;
  state_a: {
    name: "SINGLE_EPOCH_STATIC_SCENARIO_WITHOUT_LIVING_OPERATIONS";
    limitation: string;
  };
  state_b: "DUAL_EPOCH_LIVING_SCENARIO_OPERATIONS_EXECUTED_CANDIDATE";
  state_transition: { from: "STATE_A"; to: "STATE_B" };
  provenance: {
    source_epoch_base_sha: string;
    predecessor_delivery_merge_sha: typeof M28_CURRENT_MASTER_SHA;
    candidate_head_sha: null;
    current_readback_sha: typeof M28_CURRENT_MASTER_SHA;
  };
  epoch_a: M28Epoch;
  epoch_b: M28Epoch;
  refresh_receipt: {
    receipt_id: string;
    from_epoch_id: string;
    to_epoch_id: string;
    source_epoch_digest: string;
    source_receipt_ids: string[];
    result: "REFRESHED_WITH_NO_CONTENT_CHANGE";
    as_of: string;
    expires_at: string;
    digest: string;
  };
  operation_log: M28Operation[];
  diff: {
    status: "DIFF_RECORDED";
    from_epoch_id: string;
    to_epoch_id: string;
    changed_fields: string[];
    evidence_level_result: "NO_CONTENT_CHANGE_REFRESH_RECORDED";
    compatibility: "SAME_SCHEMA_EXACT_BINDING_RECHECK_REQUIRED";
    diff_digest: string;
  };
  impact: {
    affected_consumers: string[];
    requalification_required: true;
    formal_binding_eligible: false;
    impact_digest: string;
  };
  requalification: {
    status: "LIMITED";
    source_status: "PUBLIC_SOURCE_BOUND";
    calibration_evidence: "NOT_PROVEN";
    calibration_eligible: false;
    formal_binding_eligible: false;
    result: "REQUALIFICATION_REQUIRED";
    reason: string;
    required_rechecks: string[];
    qualification_digest: string;
  };
  rollback_candidate: {
    candidate_epoch_id: string;
    rollback_version: string;
    exact_version_required: true;
    dry_run: true;
    executed: false;
    resolution: "SAFE_DRY_RUN_CANDIDATE";
    rollback_digest: string;
  };
  historical_resolution: {
    resolved_epoch_id: string;
    resolved_version: string;
    selection_rule: "EXACT_EPOCH_ID_AND_VERSION_REQUIRED";
    resolution_status: "HISTORICAL_EPOCH_RESOLVED";
    history_deleted: false;
    resolution_digest: string;
  };
  withdrawal: {
    withdrawn_epoch_id: string;
    withdrawal_status: "CANDIDATE_WITHDRAWN";
    withdrawal_action: "WITHDRAW";
    withdrawal_is_delete: false;
    delete_executed: false;
    history_deleted: false;
    withdrawal_digest: string;
  };
  revalidation: {
    as_of: string;
    expires_at: string;
    freshness_status: M28FreshnessStatus;
    exact_source_revalidation_required: true;
    expiry_behavior: "REJECT_AND_RECOMPILE_EPOCH";
    revalidation_before_expiry: true;
    runbook: string[];
    alerts: string[];
  };
  operational_controls: {
    scheduler_present: false;
    database_writer_present: false;
    frozen_input_overwrite: false;
    provider: "OFF";
    runtime_authority: "JSON_INTERNAL_ONLY";
  };
  role_visibility: {
    teacher: { visibility: "TEACHER_ONLY"; fields: string[] };
    student: { visibility: "STUDENT_SAFE"; fields: string[]; forbidden_fields: string[] };
    admin: { visibility: "INTERNAL_RESEARCH_ONLY"; fields: string[] };
    enterprise: { visibility: "RESTRICTED"; fields: string[]; forbidden_fields: string[] };
  };
  consumer: {
    status: "CANDIDATE_ONLY";
    formal_join: false;
    exact_binding_required: true;
    required_consumer_action: "MAIN_OWNS_FORMAL_BINDING_AND_WRITER";
  };
  tombstone_reuse: {
    m19_m24: "TOMBSTONED_PROFESSIONAL_CANDIDATE_WITH_LIMITS";
    m23: {
      status: "TOMBSTONED_PROFESSIONAL_CANDIDATE_WITH_LIMITS";
      capability: string;
      digest: string;
    };
    reused_capabilities: string[];
    no_second_lifecycle_writer: true;
  };
  authority: {
    candidate_writer: "SH_NEXT_SUPPORT_CANDIDATE_COMPILER";
    official_truth_write: false;
    settlement_write: false;
    score_write: false;
    rank_write: false;
    parameter_set_formal_write: false;
    second_truth_writer: false;
    provider: "OFF";
    runtime_authority: "JSON_INTERNAL_ONLY";
  };
  mjp: { status: "PASS"; operation_count: 7; checks: string[] };
  methods: { keep: string[]; change: string[]; retire: string[]; new: string[] };
  efficiency: {
    upstream_packs_reused: number;
    operation_records: number;
    manual_numeric_values: number;
    duplicate_writers: number;
    measured_elapsed_seconds: number | null;
    measurement_status: "NOT_RECORDED";
  };
  known_limits: string[];
  pack_digest: string;
}

function digestWithout<T extends Record<string, unknown>>(value: T, key: keyof T): string {
  const content = Object.fromEntries(Object.entries(value).filter(([entryKey]) => entryKey !== key));
  return stableDigest(content);
}

function operation(
  sequence: number,
  operationName: M28OperationKind,
  input_refs: string[],
  rule: string,
  assumption: string,
  output_refs: string[]
): M28Operation {
  const content = {
    sequence,
    operation: operationName,
    input_refs,
    rule,
    assumption,
    output_refs,
    status: "RECORDED" as const
  };
  return { ...content, operation_digest: stableDigest(content) };
}

function makeEpoch(
  m25: ReturnType<typeof buildM25PublicSourceRealityEvidenceEpochPack>,
  m27: ReturnType<typeof buildM27SecondCityTransferRequalificationPack>,
  input: {
    epoch_id: string;
    version: string;
    status: M28Epoch["status"];
    parent_epoch_id: string | null;
    evidence_snapshot_id: string;
    content_change_status: M28Epoch["content_change_status"];
    as_of: string;
  }
): M28Epoch {
  const withoutDigest: Omit<M28Epoch, "content_digest"> = {
    epoch_id: input.epoch_id,
    version: input.version,
    status: input.status,
    parent_epoch_id: input.parent_epoch_id,
    evidence_snapshot_id: input.evidence_snapshot_id,
    evidence_snapshot_digest: stableDigest({
      evidence_snapshot_id: input.evidence_snapshot_id,
      source_epoch_digest: m25.source_epoch.epoch_digest,
      source_receipt_ids: m25.source_epoch.source_receipts.map((item) => item.source_id),
      fetched_at: input.as_of,
      content_change_status: input.content_change_status
    }),
    content_change_status: input.content_change_status,
    as_of: input.as_of,
    fetched_at: input.as_of,
    source_receipt_ids: m25.source_epoch.source_receipts.map((item) => item.source_id),
    source_reality_class: "PUBLIC_SOURCE_BOUND",
    fallback_used: false,
    evidence_epoch_ref: {
      epoch_id: m25.source_epoch.epoch_id,
      epoch_digest: m25.source_epoch.epoch_digest,
      source_epoch_base_sha: m25.source_epoch.source_epoch_base_sha
    },
    transfer_candidate_ref: {
      transfer_id: m27.transfer_summary.transfer_id,
      pack_digest: m27.pack_digest,
      candidate_version: m27.transfer.candidate_ref.version
    },
    scenario_candidate_ref: {
      scenario_id: m25.scenario_candidates[0]?.scenario_id ?? "SH-M25-SCENARIO-CANDIDATE",
      candidate_version: "scenario-candidate.2026-08-30",
      formal_runtime_admitted: false
    },
    rights_status: "PUBLIC_REFERENCE_ONLY",
    expires_at: m25.source_epoch.expires_at,
    revalidation_required: true
  };
  return { ...withoutDigest, content_digest: stableDigest(withoutDigest) };
}

function diffDigest(input: Omit<M28DualEpochLivingOperationsPack["diff"], "diff_digest">): string {
  return stableDigest(input);
}

function impactDigest(input: Omit<M28DualEpochLivingOperationsPack["impact"], "impact_digest">): string {
  return stableDigest(input);
}

function receiptDigest(input: Record<string, unknown>): string {
  return stableDigest(input);
}

function hasFloatingSelector(value: unknown): boolean {
  if (typeof value === "string") return /(^|[^a-z])(latest|default|current)([^a-z]|$)/iu.test(value.trim());
  if (Array.isArray(value)) return value.some((item) => hasFloatingSelector(item));
  if (value !== null && typeof value === "object") {
    return Object.values(value).some((item) => hasFloatingSelector(item));
  }
  return false;
}

export function evaluateM28EvidenceFreshness(
  pack: M28DualEpochLivingOperationsPack,
  asOf: string
): M28FreshnessStatus {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(asOf)) throw new Error("M28_AS_OF_DATE_INVALID");
  return asOf < pack.revalidation.expires_at ? "VALID_BEFORE_EXPIRY" : "EXPIRY_REQUIRES_RECOMPILE";
}

export type M28HistoricalResolutionRequest = {
  epoch_id: string;
  version: string;
  content_digest: string;
};

export type M28HistoricalResolutionResult = {
  epoch_id: string;
  version: string;
  content_digest: string;
  resolution_status: "HISTORICAL_EPOCH_RESOLVED";
  history_deleted: false;
  resolution_digest: string;
};

export function resolveM28HistoricalEpoch(
  pack: M28DualEpochLivingOperationsPack,
  request: M28HistoricalResolutionRequest
): M28HistoricalResolutionResult {
  const epoch = [pack.epoch_a, pack.epoch_b].find(
    (candidate) =>
      candidate.epoch_id === request.epoch_id &&
      candidate.version === request.version &&
      candidate.content_digest === request.content_digest
  );
  if (!epoch || hasFloatingSelector(request)) throw new Error("M28_EXACT_HISTORICAL_RESOLUTION_REQUIRED");
  const content = {
    epoch_id: epoch.epoch_id,
    version: epoch.version,
    content_digest: epoch.content_digest,
    resolution_status: "HISTORICAL_EPOCH_RESOLVED" as const,
    history_deleted: false as const
  };
  return { ...content, resolution_digest: receiptDigest(content) };
}

export function withdrawM28Candidate(
  pack: M28DualEpochLivingOperationsPack,
  request: { epoch_id: string; content_digest: string }
): M28DualEpochLivingOperationsPack["withdrawal"] {
  if (
    hasFloatingSelector(request) ||
    request.epoch_id !== pack.epoch_b.epoch_id ||
    request.content_digest !== pack.epoch_b.content_digest
  )
    throw new Error("M28_EXACT_CANDIDATE_WITHDRAWAL_REQUIRED");
  return structuredClone(pack.withdrawal);
}

export type M28Role = "teacher" | "student" | "admin" | "enterprise";

export function projectM28ForRole(pack: M28DualEpochLivingOperationsPack, role: M28Role): Record<string, unknown> {
  if (role === "teacher") {
    return {
      role,
      epoch_a: structuredClone(pack.epoch_a),
      epoch_b: structuredClone(pack.epoch_b),
      operation_log: structuredClone(pack.operation_log),
      diff: structuredClone(pack.diff),
      impact: structuredClone(pack.impact),
      requalification: structuredClone(pack.requalification),
      revalidation: structuredClone(pack.revalidation),
      withdrawal: structuredClone(pack.withdrawal),
      known_limits: [...pack.known_limits]
    };
  }
  if (role === "admin") {
    return {
      role,
      provenance: structuredClone(pack.provenance),
      operation_digests: pack.operation_log.map((item) => item.operation_digest),
      diff_digest: pack.diff.diff_digest,
      impact_digest: pack.impact.impact_digest,
      authority: structuredClone(pack.authority),
      revalidation: structuredClone(pack.revalidation)
    };
  }
  if (role === "enterprise") {
    return {
      role,
      candidate_scope: pack.consumer.status,
      exact_binding_required: pack.consumer.exact_binding_required,
      requalification_status: pack.requalification.status,
      known_limits: [...pack.known_limits]
    };
  }
  return {
    role,
    epoch_version: pack.epoch_b.version,
    requalification_status: pack.requalification.status,
    withdrawal_status: pack.withdrawal.withdrawal_status,
    historical_resolution_status: pack.historical_resolution.resolution_status
  };
}

export function buildM28DualEpochLivingOperationsPack(): M28DualEpochLivingOperationsPack {
  const m25 = buildM25PublicSourceRealityEvidenceEpochPack();
  const m27 = buildM27SecondCityTransferRequalificationPack();
  const m25Issues = validateM25PublicSourceRealityEvidenceEpochPack(m25);
  const m27Issues = validateM27SecondCityTransferRequalificationPack(m27);
  if (m25Issues.length > 0 || m27Issues.length > 0) throw new Error("M28_UPSTREAM_SUPPORT_PACK_INVALID");

  const asOf = "2026-08-30";
  const epochA = makeEpoch(m25, m27, {
    epoch_id: "SH-LIVING-EPOCH-A-2026-08-30",
    version: "epoch-a.2026-08-30",
    status: "HISTORICAL_CANDIDATE",
    parent_epoch_id: null,
    evidence_snapshot_id: "SH-PUBLIC-EVIDENCE-SNAPSHOT-A-2026-08-30",
    content_change_status: "BASELINE_SNAPSHOT",
    as_of: asOf
  });
  const epochB = makeEpoch(m25, m27, {
    epoch_id: "SH-LIVING-EPOCH-B-2026-08-30",
    version: "epoch-b.2026-08-30",
    status: "REFRESHED_CANDIDATE",
    parent_epoch_id: epochA.epoch_id,
    evidence_snapshot_id: "SH-PUBLIC-EVIDENCE-SNAPSHOT-B-2026-08-30",
    content_change_status: "NO_CONTENT_CHANGE_REFRESH_RECORDED",
    as_of: asOf
  });
  const refreshContent = {
    receipt_id: "M28-REFRESH-RECEIPT-A-TO-B",
    from_epoch_id: epochA.epoch_id,
    to_epoch_id: epochB.epoch_id,
    source_epoch_digest: m25.source_epoch.epoch_digest,
    source_receipt_ids: [...epochB.source_receipt_ids],
    result: "REFRESHED_WITH_NO_CONTENT_CHANGE" as const,
    as_of: asOf,
    expires_at: m25.source_epoch.expires_at
  };
  const refreshReceipt = { ...refreshContent, digest: receiptDigest(refreshContent) };
  const changedFields = [
    "evidence_snapshot_id",
    "evidence_snapshot_digest",
    "content_change_status",
    "epoch_id",
    "version",
    "status",
    "parent_epoch_id"
  ];
  const diffContent = {
    status: "DIFF_RECORDED" as const,
    from_epoch_id: epochA.epoch_id,
    to_epoch_id: epochB.epoch_id,
    changed_fields: changedFields,
    evidence_level_result: "NO_CONTENT_CHANGE_REFRESH_RECORDED" as const,
    compatibility: "SAME_SCHEMA_EXACT_BINDING_RECHECK_REQUIRED" as const
  };
  const diff = { ...diffContent, diff_digest: diffDigest(diffContent) };
  const affectedConsumers = [
    "M27_SECOND_CITY_TRANSFER_CANDIDATE",
    "MOD_REGIONAL_TRANSFER_DIAGNOSTICS",
    "MAIN_SOURCE_BACKED_CONSUMPTION_REQUEST"
  ];
  const impactContent = {
    affected_consumers: affectedConsumers,
    requalification_required: true as const,
    formal_binding_eligible: false as const
  };
  const impact = { ...impactContent, impact_digest: impactDigest(impactContent) };
  const requiredRechecks = [
    "Re-fetch the exact official source locators before the recorded expiry boundary.",
    "Recompute source, evidence-epoch, transfer, and scenario digests without an implicit selector.",
    "Verify unit, target-year, geography, rights, and compatibility for every changed field.",
    "Re-run shared-contract and consumer-boundary checks before any future formal join."
  ];
  const qualificationContent = {
    status: "LIMITED" as const,
    source_status: "PUBLIC_SOURCE_BOUND" as const,
    calibration_evidence: "NOT_PROVEN" as const,
    calibration_eligible: false as const,
    formal_binding_eligible: false as const,
    result: "REQUALIFICATION_REQUIRED" as const,
    reason: "Epoch B is a public-source-bound candidate refresh. It is not calibrated evidence and cannot be formally bound without exact consumer and governance checks.",
    required_rechecks: requiredRechecks
  };
  const qualification = {
    ...qualificationContent,
    qualification_digest: receiptDigest(qualificationContent)
  };
  const rollbackContent = {
    candidate_epoch_id: epochA.epoch_id,
    rollback_version: epochA.version,
    exact_version_required: true as const,
    dry_run: true as const,
    executed: false as const,
    resolution: "SAFE_DRY_RUN_CANDIDATE" as const
  };
  const rollbackCandidate = { ...rollbackContent, rollback_digest: receiptDigest(rollbackContent) };
  const historicalContent = {
    resolved_epoch_id: epochA.epoch_id,
    resolved_version: epochA.version,
    selection_rule: "EXACT_EPOCH_ID_AND_VERSION_REQUIRED" as const,
    resolution_status: "HISTORICAL_EPOCH_RESOLVED" as const,
    history_deleted: false as const
  };
  const historicalResolution = { ...historicalContent, resolution_digest: receiptDigest(historicalContent) };
  const withdrawalContent = {
    withdrawn_epoch_id: epochB.epoch_id,
    withdrawal_status: "CANDIDATE_WITHDRAWN" as const,
    withdrawal_action: "WITHDRAW" as const,
    withdrawal_is_delete: false as const,
    delete_executed: false as const,
    history_deleted: false as const
  };
  const withdrawal = { ...withdrawalContent, withdrawal_digest: receiptDigest(withdrawalContent) };
  const operationLog = [
    operation(1, "REFRESH", [epochA.evidence_snapshot_digest, epochA.content_digest], "Create a separately versioned epoch from exact source references.", "A refresh is a candidate compilation and does not mutate a frozen input.", [epochB.evidence_snapshot_digest, refreshReceipt.digest]),
    operation(2, "DIFF", [epochA.content_digest, epochB.content_digest], "Compare exact epoch IDs, versions, lineage, expiry, and rights.", "The explicit result records that no source content change was observed.", [diff.diff_digest]),
    operation(3, "IMPACT", [diff.diff_digest], "Map the diff to named candidate consumers and requalification gates.", "Impact is advisory and cannot write product truth.", [impact.impact_digest]),
    operation(4, "REQUALIFICATION", [epochB.content_digest, diff.diff_digest, impact.impact_digest], "Require source, contract, rights, expiry, and exact-binding rechecks.", "Public planning targets do not prove calibrated behavior.", [qualification.qualification_digest]),
    operation(5, "ROLLBACK_CANDIDATE", [epochB.content_digest, epochA.content_digest], "Retain the predecessor as an exact-version dry-run rollback candidate.", "Rollback is not executed and does not rewrite the historical record.", [rollbackCandidate.rollback_digest]),
    operation(6, "HISTORICAL_RESOLUTION", [epochA.epoch_id, epochA.version, epochA.content_digest], "Resolve a historical scenario only by exact epoch ID, version, and digest.", "History remains available for audit and replay-context inspection.", [historicalResolution.resolution_digest]),
    operation(7, "WITHDRAW", [epochB.epoch_id, epochB.content_digest], "Withdraw the candidate from future consideration without deleting history.", "Withdrawal is a governance state, not destructive deletion.", [withdrawal.withdrawal_digest])
  ];
  const content: Omit<M28DualEpochLivingOperationsPack, "pack_digest"> = {
    schema_version: M28_DUAL_EPOCH_SCHEMA_VERSION,
    mission_id: M28_MISSION_ID,
    state_a: {
      name: "SINGLE_EPOCH_STATIC_SCENARIO_WITHOUT_LIVING_OPERATIONS",
      limitation: "The predecessor exposed a source-bound candidate but did not prove a separately versioned refresh, diff, impact, requalification, rollback-candidate, historical-resolution, and withdrawal sequence."
    },
    state_b: "DUAL_EPOCH_LIVING_SCENARIO_OPERATIONS_EXECUTED_CANDIDATE",
    state_transition: { from: "STATE_A", to: "STATE_B" },
    provenance: {
      source_epoch_base_sha: m25.source_epoch.source_epoch_base_sha,
      predecessor_delivery_merge_sha: M28_CURRENT_MASTER_SHA,
      candidate_head_sha: null,
      current_readback_sha: M28_CURRENT_MASTER_SHA
    },
    epoch_a: epochA,
    epoch_b: epochB,
    refresh_receipt: refreshReceipt,
    operation_log: operationLog,
    diff,
    impact,
    requalification: qualification,
    rollback_candidate: rollbackCandidate,
    historical_resolution: historicalResolution,
    withdrawal,
    revalidation: {
      as_of: asOf,
      expires_at: m25.source_epoch.expires_at,
      freshness_status: "VALID_BEFORE_EXPIRY",
      exact_source_revalidation_required: true,
      expiry_behavior: "REJECT_AND_RECOMPILE_EPOCH",
      revalidation_before_expiry: true,
      runbook: [
        "Fetch the exact official source locator and retain a new receipt.",
        "Compare the new receipt against the bound epoch and record a diff.",
        "Requalify all affected candidate consumers and retain the predecessor epoch.",
        "Withdraw the candidate on expiry or rights change; do not delete historical evidence."
      ],
      alerts: [
        "EVIDENCE_EXPIRY_APPROACHING",
        "SOURCE_DIGEST_CHANGED",
        "RIGHTS_OR_LOCATOR_CHANGED",
        "CONSUMER_REQUALIFICATION_REQUIRED"
      ]
    },
    operational_controls: {
      scheduler_present: false,
      database_writer_present: false,
      frozen_input_overwrite: false,
      provider: "OFF",
      runtime_authority: "JSON_INTERNAL_ONLY"
    },
    role_visibility: {
      teacher: {
        visibility: "TEACHER_ONLY",
        fields: ["epoch_a", "epoch_b", "operation_log", "diff", "impact", "requalification", "revalidation", "known_limits"]
      },
      student: {
        visibility: "STUDENT_SAFE",
        fields: ["epoch_b.version", "bounded_requalification_status", "withdrawal_status", "historical_resolution_status"],
        forbidden_fields: ["raw_source_excerpt", "source_receipt_ids", "source_digests", "private_project_data", "official_truth", "settlement", "score", "rank"]
      },
      admin: {
        visibility: "INTERNAL_RESEARCH_ONLY",
        fields: ["evidence_epoch_ref", "operation_digests", "diff_digest", "impact_digest", "revalidation", "authority"]
      },
      enterprise: {
        visibility: "RESTRICTED",
        fields: ["candidate_scope", "exact_binding_required", "requalification", "known_limits"],
        forbidden_fields: ["raw_source_excerpt", "private_project_data", "official_truth", "settlement", "score", "rank"]
      }
    },
    consumer: {
      status: "CANDIDATE_ONLY",
      formal_join: false,
      exact_binding_required: true,
      required_consumer_action: "MAIN_OWNS_FORMAL_BINDING_AND_WRITER"
    },
    tombstone_reuse: {
      m19_m24: "TOMBSTONED_PROFESSIONAL_CANDIDATE_WITH_LIMITS",
      m23: {
        status: "TOMBSTONED_PROFESSIONAL_CANDIDATE_WITH_LIMITS",
        capability: "M23 seven-event preassembled lifecycle rehearsal reused as a read-only operation-chain predecessor.",
        digest: stableDigest({
          macro: "M23",
          capability: "seven-event preassembled lifecycle rehearsal",
          executed_across_two_epochs: false
        })
      },
      reused_capabilities: [
        "M25 public-source evidence epoch and deterministic source digest",
        "M27 regional-transfer.v1 candidate envelope and exact Hangzhou lineage",
        "M4/M5/M6 portability, reality, and lifecycle candidate concepts"
      ],
      no_second_lifecycle_writer: true
    },
    authority: {
      candidate_writer: "SH_NEXT_SUPPORT_CANDIDATE_COMPILER",
      official_truth_write: false,
      settlement_write: false,
      score_write: false,
      rank_write: false,
      parameter_set_formal_write: false,
      second_truth_writer: false,
      provider: "OFF",
      runtime_authority: "JSON_INTERNAL_ONLY"
    },
    mjp: {
      status: "PASS",
      operation_count: 7,
      checks: [
        "two separately versioned epochs with deterministic content digests",
        "ordered refresh-to-withdraw operation log with per-operation digests",
        "diff, impact, and requalification are explicit candidate records",
        "rollback candidate is exact-version dry-run only",
        "historical resolution preserves history and withdrawal is not deletion",
        "expiry, revalidation runbook, and alerts are explicit",
        "scheduler, database writer, provider, and frozen-input overwrite are disabled"
      ]
    },
    methods: {
      keep: ["exact source lineage", "deterministic digest", "candidate-only authority", "role-safe projection"],
      change: ["single static epoch to dual versioned epoch operation chain", "implicit refresh narrative to explicit operation receipts"],
      retire: ["unversioned scenario refresh", "destructive withdrawal semantics"],
      new: ["operation-level digests", "historical resolution guard", "expiry alerts and revalidation runbook"]
    },
    efficiency: {
      upstream_packs_reused: 2,
      operation_records: operationLog.length,
      manual_numeric_values: 0,
      duplicate_writers: 0,
      measured_elapsed_seconds: null,
      measurement_status: "NOT_RECORDED"
    },
    known_limits: [
      "Epoch A and Epoch B are deterministic candidate snapshots over the same public-source evidence; no live scheduler or data refresh is enabled.",
      "Public planning targets remain NOT_PROVEN calibration evidence; requalification is required after source, rights, expiry, schema, or consumer changes.",
      "MAIN still owns formal binding, shared runtime admission, and any official writer; this support pack does not join a product route.",
      "No official Truth, Settlement, Score, Rank, ParameterSet, Provider, database, Pilot, Production, or Human Validation state is written."
    ]
  };
  return { ...content, pack_digest: stableDigest(content) };
}

export function validateM28DualEpochLivingOperationsPack(
  pack: M28DualEpochLivingOperationsPack
): string[] {
  const issues: string[] = [];
  const { pack_digest, ...content } = pack;
  if (stableDigest(content) !== pack_digest) issues.push("pack_digest_mismatch");

  const m25 = buildM25PublicSourceRealityEvidenceEpochPack();
  const m27 = buildM27SecondCityTransferRequalificationPack();
  const expected = buildM28DualEpochLivingOperationsPack();
  issues.push(...validateM25PublicSourceRealityEvidenceEpochPack(m25).map((issue) => `m25_${issue}`));
  issues.push(...validateM27SecondCityTransferRequalificationPack(m27).map((issue) => `m27_${issue}`));
  if (hasFloatingSelector(pack)) issues.push("floating_selector_present");
  if (stableDigest(pack.provenance) !== stableDigest(expected.provenance)) issues.push("provenance_binding_invalid");
  for (const epoch of [pack.epoch_a, pack.epoch_b]) {
    if (digestWithout(epoch, "content_digest") !== epoch.content_digest)
      issues.push(`${epoch.epoch_id}_content_digest_invalid`);
    if (epoch.evidence_epoch_ref.epoch_id !== m25.source_epoch.epoch_id)
      issues.push(`${epoch.epoch_id}_evidence_epoch_id_invalid`);
    if (epoch.evidence_epoch_ref.epoch_digest !== m25.source_epoch.epoch_digest)
      issues.push(`${epoch.epoch_id}_evidence_epoch_digest_invalid`);
    if (epoch.evidence_epoch_ref.source_epoch_base_sha !== m25.source_epoch.source_epoch_base_sha)
      issues.push(`${epoch.epoch_id}_source_epoch_base_invalid`);
    if (epoch.transfer_candidate_ref.pack_digest !== m27.pack_digest)
      issues.push(`${epoch.epoch_id}_transfer_pack_digest_invalid`);
    if (!epoch.source_receipt_ids.length || epoch.source_reality_class !== "PUBLIC_SOURCE_BOUND" || epoch.fallback_used)
      issues.push(`${epoch.epoch_id}_source_reality_boundary_invalid`);
    if (!/^[a-f0-9]{64}$/u.test(epoch.evidence_snapshot_digest))
      issues.push(`${epoch.epoch_id}_evidence_snapshot_digest_invalid`);
    if (epoch.content_change_status === "NO_CONTENT_CHANGE_REFRESH_RECORDED" && epoch.status !== "REFRESHED_CANDIDATE")
      issues.push(`${epoch.epoch_id}_refresh_status_invalid`);
    if (epoch.scenario_candidate_ref.formal_runtime_admitted)
      issues.push(`${epoch.epoch_id}_formal_runtime_admitted`);
    if (epoch.rights_status !== "PUBLIC_REFERENCE_ONLY" || !epoch.revalidation_required)
      issues.push(`${epoch.epoch_id}_rights_or_revalidation_invalid`);
    if (epoch.expires_at !== m25.source_epoch.expires_at)
      issues.push(`${epoch.epoch_id}_expiry_invalid`);
    if (/^(latest|default|current)$/iu.test(epoch.version)) issues.push("floating_epoch_selector");
  }
  if (pack.epoch_a.epoch_id !== "SH-LIVING-EPOCH-A-2026-08-30" || pack.epoch_b.epoch_id !== "SH-LIVING-EPOCH-B-2026-08-30")
    issues.push("epoch_ids_invalid");
  if (pack.epoch_a.status !== "HISTORICAL_CANDIDATE" || pack.epoch_b.status !== "REFRESHED_CANDIDATE")
    issues.push("epoch_status_invalid");
  if (pack.epoch_a.parent_epoch_id !== null || pack.epoch_b.parent_epoch_id !== pack.epoch_a.epoch_id)
    issues.push("epoch_parent_chain_invalid");
  if (pack.epoch_a.content_digest === pack.epoch_b.content_digest) issues.push("epoch_versions_not_distinct");
  if (stableDigest(pack.refresh_receipt) !== stableDigest(expected.refresh_receipt)) issues.push("refresh_receipt_binding_invalid");
  if (digestWithout(pack.refresh_receipt, "digest") !== pack.refresh_receipt.digest) issues.push("refresh_receipt_digest_invalid");

  if (pack.operation_log.length !== M28_OPERATIONS.length) issues.push("operation_count_invalid");
  pack.operation_log.forEach((item, index) => {
    if (item.sequence !== index + 1 || item.operation !== M28_OPERATIONS[index]) issues.push("operation_order_invalid");
    if (item.status !== "RECORDED") issues.push("operation_status_invalid");
    if (digestWithout(item, "operation_digest") !== item.operation_digest) issues.push(`operation_${item.sequence}_digest_invalid`);
    if (stableDigest(item) !== stableDigest(expected.operation_log[index])) issues.push(`operation_${item.sequence}_binding_invalid`);
  });
  const expectedOperationBindings = [
    [expected.epoch_a.evidence_snapshot_digest, expected.epoch_a.content_digest],
    [expected.epoch_a.content_digest, expected.epoch_b.content_digest],
    [expected.diff.diff_digest],
    [expected.epoch_b.content_digest, expected.diff.diff_digest, expected.impact.impact_digest],
    [expected.epoch_b.content_digest, expected.epoch_a.content_digest],
    [expected.epoch_a.epoch_id, expected.epoch_a.version, expected.epoch_a.content_digest],
    [expected.epoch_b.epoch_id, expected.epoch_b.content_digest]
  ];
  const expectedOperationOutputs = [
    [expected.epoch_b.evidence_snapshot_digest, expected.refresh_receipt.digest],
    [expected.diff.diff_digest],
    [expected.impact.impact_digest],
    [expected.requalification.qualification_digest],
    [expected.rollback_candidate.rollback_digest],
    [expected.historical_resolution.resolution_digest],
    [expected.withdrawal.withdrawal_digest]
  ];
  pack.operation_log.forEach((item, index) => {
    if (
      JSON.stringify(item.input_refs) !== JSON.stringify(expectedOperationBindings[index]) ||
      JSON.stringify(item.output_refs) !== JSON.stringify(expectedOperationOutputs[index])
    )
      issues.push(`operation_${item.sequence}_cross_record_binding_invalid`);
  });
  if (pack.diff.status !== "DIFF_RECORDED" || pack.diff.from_epoch_id !== pack.epoch_a.epoch_id || pack.diff.to_epoch_id !== pack.epoch_b.epoch_id)
    issues.push("diff_binding_invalid");
  const expectedDiff = {
    status: pack.diff.status,
    from_epoch_id: pack.diff.from_epoch_id,
    to_epoch_id: pack.diff.to_epoch_id,
    changed_fields: pack.diff.changed_fields,
    evidence_level_result: pack.diff.evidence_level_result,
    compatibility: pack.diff.compatibility
  };
  if (diffDigest(expectedDiff) !== pack.diff.diff_digest) issues.push("diff_digest_invalid");
  if (stableDigest(pack.diff) !== stableDigest(expected.diff)) issues.push("diff_binding_invalid");
  if (pack.impact.requalification_required !== true || pack.impact.formal_binding_eligible !== false)
    issues.push("impact_boundary_invalid");
  const expectedImpact = {
    affected_consumers: pack.impact.affected_consumers,
    requalification_required: pack.impact.requalification_required,
    formal_binding_eligible: pack.impact.formal_binding_eligible
  };
  if (impactDigest(expectedImpact) !== pack.impact.impact_digest) issues.push("impact_digest_invalid");
  if (stableDigest(pack.impact) !== stableDigest(expected.impact)) issues.push("impact_binding_invalid");
  if (
    pack.requalification.status !== "LIMITED" ||
    pack.requalification.source_status !== "PUBLIC_SOURCE_BOUND" ||
    pack.requalification.calibration_evidence !== "NOT_PROVEN" ||
    pack.requalification.calibration_eligible ||
    pack.requalification.formal_binding_eligible ||
    pack.requalification.result !== "REQUALIFICATION_REQUIRED"
  )
    issues.push("requalification_boundary_invalid");
  if (stableDigest(pack.requalification) !== stableDigest(expected.requalification)) issues.push("requalification_binding_invalid");
  if (digestWithout(pack.requalification, "qualification_digest") !== pack.requalification.qualification_digest)
    issues.push("qualification_digest_invalid");
  if (
    pack.rollback_candidate.candidate_epoch_id !== pack.epoch_a.epoch_id ||
    pack.rollback_candidate.rollback_version !== pack.epoch_a.version ||
    !pack.rollback_candidate.exact_version_required ||
    !pack.rollback_candidate.dry_run ||
    pack.rollback_candidate.executed
  )
    issues.push("rollback_candidate_invalid");
  if (stableDigest(pack.rollback_candidate) !== stableDigest(expected.rollback_candidate)) issues.push("rollback_binding_invalid");
  if (digestWithout(pack.rollback_candidate, "rollback_digest") !== pack.rollback_candidate.rollback_digest)
    issues.push("rollback_digest_invalid");
  if (
    pack.historical_resolution.resolved_epoch_id !== pack.epoch_a.epoch_id ||
    pack.historical_resolution.resolved_version !== pack.epoch_a.version ||
    pack.historical_resolution.selection_rule !== "EXACT_EPOCH_ID_AND_VERSION_REQUIRED" ||
    pack.historical_resolution.history_deleted
  )
    issues.push("historical_resolution_invalid");
  if (stableDigest(pack.historical_resolution) !== stableDigest(expected.historical_resolution))
    issues.push("historical_resolution_binding_invalid");
  if (digestWithout(pack.historical_resolution, "resolution_digest") !== pack.historical_resolution.resolution_digest)
    issues.push("historical_resolution_digest_invalid");
  if (
    pack.withdrawal.withdrawn_epoch_id !== pack.epoch_b.epoch_id ||
    pack.withdrawal.withdrawal_action !== "WITHDRAW" ||
    pack.withdrawal.withdrawal_is_delete ||
    pack.withdrawal.delete_executed ||
    pack.withdrawal.history_deleted
  )
    issues.push("withdrawal_delete_boundary_invalid");
  if (stableDigest(pack.withdrawal) !== stableDigest(expected.withdrawal)) issues.push("withdrawal_binding_invalid");
  if (digestWithout(pack.withdrawal, "withdrawal_digest") !== pack.withdrawal.withdrawal_digest)
    issues.push("withdrawal_digest_invalid");
  if (
    pack.revalidation.as_of !== "2026-08-30" ||
    pack.revalidation.expires_at !== m25.source_epoch.expires_at ||
    pack.revalidation.freshness_status !== evaluateM28EvidenceFreshness(pack, pack.revalidation.as_of) ||
    !pack.revalidation.exact_source_revalidation_required ||
    pack.revalidation.expiry_behavior !== "REJECT_AND_RECOMPILE_EPOCH" ||
    !pack.revalidation.revalidation_before_expiry ||
    pack.revalidation.runbook.length === 0 ||
    pack.revalidation.alerts.length === 0
  )
    issues.push("revalidation_controls_invalid");
  if (pack.tombstone_reuse.m23.status !== "TOMBSTONED_PROFESSIONAL_CANDIDATE_WITH_LIMITS")
    issues.push("m23_tombstone_invalid");
  if (
    pack.tombstone_reuse.m23.digest !==
    stableDigest({ macro: "M23", capability: "seven-event preassembled lifecycle rehearsal", executed_across_two_epochs: false })
  )
    issues.push("m23_reuse_digest_invalid");
  if (
    pack.operational_controls.scheduler_present ||
    pack.operational_controls.database_writer_present ||
    pack.operational_controls.frozen_input_overwrite ||
    pack.operational_controls.provider !== "OFF" ||
    pack.operational_controls.runtime_authority !== "JSON_INTERNAL_ONLY"
  )
    issues.push("operational_authority_invalid");
  if (
    pack.authority.official_truth_write ||
    pack.authority.settlement_write ||
    pack.authority.score_write ||
    pack.authority.rank_write ||
    pack.authority.parameter_set_formal_write ||
    pack.authority.second_truth_writer ||
    pack.authority.provider !== "OFF" ||
    pack.authority.runtime_authority !== "JSON_INTERNAL_ONLY"
  )
    issues.push("authority_boundary_invalid");
  if (pack.consumer.formal_join || !pack.consumer.exact_binding_required)
    issues.push("consumer_formal_join_invalid");
  if (stableDigest(pack.authority) !== stableDigest(expected.authority)) issues.push("authority_binding_invalid");
  if (!pack.tombstone_reuse.no_second_lifecycle_writer)
    issues.push("second_lifecycle_writer_invalid");
  if (pack.state_b !== "DUAL_EPOCH_LIVING_SCENARIO_OPERATIONS_EXECUTED_CANDIDATE") issues.push("state_b_invalid");
  if (pack.state_transition.from !== "STATE_A" || pack.state_transition.to !== "STATE_B") issues.push("state_transition_invalid");
  return [...new Set(issues)];
}
