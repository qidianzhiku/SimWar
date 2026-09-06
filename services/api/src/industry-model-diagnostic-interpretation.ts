export type DiagnosticInterpretationClassification =
  | "WANT_EVIDENCE"
  | "CAN_EVIDENCE"
  | "REALIZED_REFERENCE"
  | "NOT_PROVEN";

export type DiagnosticInterpretationStatus =
  | "READY"
  | "READY_WITH_LIMITS"
  | "BLOCKED"
  | "REBASE_REQUIRED";

interface DiagnosticContext {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly run_id: string;
  readonly team_id: string;
  readonly round_id: string;
}

interface DiagnosticEntry {
  readonly producer_id: string;
  readonly diagnostic_family: string;
  readonly classification: DiagnosticInterpretationClassification;
  readonly status: "PASS" | "WARN" | "FAIL";
  readonly bounded_metrics: Readonly<Record<string, number>>;
  readonly provenance: { readonly source_path: string; readonly symbol: string };
  readonly known_limits: readonly string[];
}

export interface DiagnosticInterpretationInput {
  readonly context: DiagnosticContext;
  readonly readiness_status: DiagnosticInterpretationStatus;
  readonly diagnostic_evidence_digest: string;
  readonly interpretation_policy_digest: string;
  readonly entries: readonly DiagnosticEntry[];
  readonly identity_movements: readonly string[];
  readonly provider: "OFF";
  readonly official_truth_write: false;
}

type TeacherEntry = DiagnosticEntry;

export interface DiagnosticInterpretationResult {
  readonly status: DiagnosticInterpretationStatus;
  readonly rebase_required: boolean;
  readonly context: DiagnosticContext;
  readonly teacher: {
    readonly entries: readonly TeacherEntry[];
    readonly known_limits: readonly string[];
  };
  readonly admin: {
    readonly context: DiagnosticContext;
    readonly entries: readonly TeacherEntry[];
    readonly diagnostic_evidence_digest: string;
    readonly interpretation_policy_digest: string;
    readonly known_limits: readonly string[];
  };
  readonly student: {
    readonly visibility: "ROLE_SAFE_STUDENT";
    readonly readiness_class: DiagnosticInterpretationStatus;
    readonly evidence_classes: readonly DiagnosticInterpretationClassification[];
    readonly known_limits: readonly string[];
  };
  readonly known_limits: readonly string[];
  readonly provider: "OFF";
  readonly official_truth_write: false;
}

const COMMON_LIMITS = ["DIAGNOSTIC_PASS_IS_NOT_BUSINESS_TRUTH", "NO_CAUSAL_PROOF"] as const;

function dedupe(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

export function interpretIndustryModelDiagnostics(
  input: DiagnosticInterpretationInput
): DiagnosticInterpretationResult {
  const identityMoved = input.identity_movements.length > 0;
  const status = identityMoved ? "REBASE_REQUIRED" : input.readiness_status;
  const knownLimits = dedupe([
    ...COMMON_LIMITS,
    ...(identityMoved ? ["EXACT_IDENTITY_MOVED_REQUIRES_REBASE"] : []),
    ...input.entries.flatMap((entry) => entry.known_limits)
  ]);
  const entries = input.entries.map((entry) => ({
    ...entry,
    bounded_metrics: { ...entry.bounded_metrics },
    known_limits: [...entry.known_limits],
    provenance: { ...entry.provenance }
  }));
  const evidenceClasses = [...new Set(entries.map((entry) => entry.classification))];
  const studentLimits = dedupe([
    "DIAGNOSTIC_PASS_IS_NOT_BUSINESS_TRUTH",
    ...(identityMoved ? ["EXACT_IDENTITY_MOVED_REQUIRES_REBASE"] : [])
  ]);

  return {
    status,
    rebase_required: identityMoved,
    context: { ...input.context },
    teacher: { entries, known_limits: knownLimits },
    admin: {
      context: { ...input.context },
      entries,
      diagnostic_evidence_digest: input.diagnostic_evidence_digest,
      interpretation_policy_digest: input.interpretation_policy_digest,
      known_limits: knownLimits
    },
    student: {
      visibility: "ROLE_SAFE_STUDENT",
      readiness_class: status,
      evidence_classes: evidenceClasses,
      known_limits: studentLimits
    },
    known_limits: knownLimits,
    provider: "OFF",
    official_truth_write: false
  };
}
