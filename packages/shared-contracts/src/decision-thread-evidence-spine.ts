export const DECISION_THREAD_EVIDENCE_SPINE_SCHEMA_VERSION =
  "decision-thread-evidence-spine.v1" as const;

export const DDT_EVIDENCE_SOURCE_NAMES = [
  "M2P6",
  "MODEL_QUALIFICATION",
  "STRATEGIC_PORTFOLIO",
  "INDUSTRY_MODEL",
  "GSI"
] as const;
export type DdtEvidenceSourceName = (typeof DDT_EVIDENCE_SOURCE_NAMES)[number];

export const DDT_EVIDENCE_STATUSES = [
  "AVAILABLE",
  "LIMITED",
  "CONTEXT_UNAVAILABLE",
  "REBASE_REQUIRED",
  "STALE"
] as const;
export type DdtEvidenceStatus = (typeof DDT_EVIDENCE_STATUSES)[number];

export const DDT_EVIDENCE_LEDGERS = [
  "OFFICIAL",
  "DIAGNOSTIC",
  "COUNTERFACTUAL",
  "ADVISORY"
] as const;
export type DdtEvidenceLedger = (typeof DDT_EVIDENCE_LEDGERS)[number];

export const DDT_EVIDENCE_CONTEXT_SCOPES = [
  "EXACT_DDT_CONTEXT",
  "TENANT_COURSE"
] as const;
export type DdtEvidenceContextScope = (typeof DDT_EVIDENCE_CONTEXT_SCOPES)[number];

export type DdtSurface = "teacher" | "student" | "admin";

export interface DdtExactContext {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly run_id: string;
  readonly team_id: string;
  readonly round_id: string;
  readonly round_no: number;
  readonly role_key: string;
  readonly activity_id: string;
}

/** Student-safe context intentionally omits tenant and activity internals. */
export interface DdtStudentContext {
  readonly course_id: string;
  readonly run_id: string;
  readonly team_id: string;
  readonly round_id: string;
  readonly round_no: number;
  readonly role_key: string;
}

export interface DdtSourceProvenance {
  readonly authority_owner: string;
  readonly source_ref: string;
  readonly contract_version: string;
}

export interface DdtSelectedRoundPair {
  readonly from_round_id: string;
  readonly to_round_id: string;
}

export interface DdtEvidenceSourceBase {
  readonly source: DdtEvidenceSourceName;
  readonly ledger: DdtEvidenceLedger;
  readonly status: DdtEvidenceStatus;
  /** The source's own binding scope; it may be narrower than the DDT request context. */
  readonly context_scope: DdtEvidenceContextScope;
  readonly summary: string;
  readonly known_limits: readonly string[];
}

export interface DdtTeacherEvidenceSource extends DdtEvidenceSourceBase {
  readonly exact_context: DdtExactContext;
  readonly provenance?: DdtSourceProvenance;
  /** Teacher/Admin may inspect the exact GSI round pair; Student never receives it. */
  readonly selected_round_pair?: DdtSelectedRoundPair;
}

export interface DdtStudentEvidenceSource extends DdtEvidenceSourceBase {
  readonly exact_context: DdtStudentContext;
}

export interface DdtAdminEvidenceSource extends DdtEvidenceSourceBase {
  readonly exact_context: DdtExactContext;
  readonly provenance?: DdtSourceProvenance;
  readonly selected_round_pair?: DdtSelectedRoundPair;
}

export interface DdtSpinePolicy {
  readonly provider: "OFF";
  readonly non_causal: true;
  readonly causal_proof: false;
  readonly official_truth_write: false;
  readonly formal_write_count: 0;
}

export interface DdtSpineBase extends DdtSpinePolicy {
  readonly schema_version: typeof DECISION_THREAD_EVIDENCE_SPINE_SCHEMA_VERSION;
  readonly surface: DdtSurface;
  readonly known_limits: readonly string[];
}

export interface DdtTeacherEvidenceSpineResponse extends DdtSpineBase {
  readonly surface: "teacher";
  readonly exact_context: DdtExactContext;
  readonly sources: readonly DdtTeacherEvidenceSource[];
}

export interface DdtStudentEvidenceSpineResponse extends DdtSpineBase {
  readonly surface: "student";
  readonly exact_context: DdtStudentContext;
  readonly sources: readonly DdtStudentEvidenceSource[];
}

export interface DdtAdminEvidenceSpineResponse extends DdtSpineBase {
  readonly surface: "admin";
  readonly exact_context: DdtExactContext;
  readonly sources: readonly DdtAdminEvidenceSource[];
}

export type DdtEvidenceSpineResponse =
  | DdtTeacherEvidenceSpineResponse
  | DdtStudentEvidenceSpineResponse
  | DdtAdminEvidenceSpineResponse;

export interface DdtEvidenceSpineRequestContext extends DdtExactContext {
  readonly gsi_from_round_id?: string;
  readonly gsi_to_round_id?: string;
}
