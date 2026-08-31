import type { CourseFactoryStudentEvidenceProjection } from "./course-factory.js";

export const STUDENT_DECISION_CONTEXT_EVIDENCE_SCHEMA_VERSION =
  "student-decision-context-evidence.v1" as const;

export type StudentDecisionContextEvidenceStage = "PROVEN" | "PENDING_PUBLISH" | "BLOCKED";
export type StudentDecisionContextEvidenceStatus = "READY" | "BLOCKED";

export interface StudentDecisionContextScope {
  readonly activity_id: string;
  readonly course_id: string;
  readonly role_key: string;
  readonly round_id: string;
  readonly round_no: number;
  readonly run_id: string;
  readonly team_id: string;
  readonly tenant_id: string;
}

export interface StudentDecisionContextEvidenceContinuity {
  readonly context: StudentDecisionContextEvidenceStage;
  readonly decision: StudentDecisionContextEvidenceStage;
  readonly consequence: StudentDecisionContextEvidenceStage;
  readonly debrief: StudentDecisionContextEvidenceStage;
  readonly regional_transfer: StudentDecisionContextEvidenceStage;
}

export interface StudentDecisionContextEvidence {
  readonly schema_version: typeof STUDENT_DECISION_CONTEXT_EVIDENCE_SCHEMA_VERSION;
  readonly evidence_id: string;
  readonly evidence_version: "student-decision-context.v1";
  readonly status: StudentDecisionContextEvidenceStatus;
  readonly scope: StudentDecisionContextScope;
  readonly source_context?: CourseFactoryStudentEvidenceProjection;
  readonly continuity: StudentDecisionContextEvidenceContinuity;
  readonly blocker_codes?: readonly ["SOURCE_EVIDENCE_UNAVAILABLE"];
  readonly known_limits: readonly string[];
}

const KNOWN_LIMITS = [
  "Source context is public-source-bound and qualification remains LIMITED.",
  "Calibration and formal model binding are not proven by this student-safe projection.",
  "The projection is read-only and never writes official outcomes or enterprise state.",
  "JSON_INTERNAL_ONLY is the active runtime authority; durable recovery, PostgreSQL/RLS, Pilot, and Production are outside this projection."
] as const;

function exactScopeKey(scope: StudentDecisionContextScope): string {
  return [
    scope.activity_id,
    scope.course_id,
    scope.role_key,
    scope.round_id,
    scope.round_no,
    scope.run_id,
    scope.team_id,
    scope.tenant_id
  ].join("|");
}

function evidenceId(scope: StudentDecisionContextScope, sourceBindingId?: string): string {
  const sourceSuffix = sourceBindingId
    ? `.${sourceBindingId.replace(/[^A-Za-z0-9._:-]/g, "_")}`
    : "";
  return `sdcx.v1.${exactScopeKey(scope).replace(/[^A-Za-z0-9._:-]/g, "_")}${sourceSuffix}`;
}

export function isStudentDecisionContextEvidenceScope(
  evidence: StudentDecisionContextEvidence,
  scope: StudentDecisionContextScope
): boolean {
  return exactScopeKey(evidence.scope) === exactScopeKey(scope);
}

export function createStudentDecisionContextEvidence(
  scope: StudentDecisionContextScope,
  sourceContext: CourseFactoryStudentEvidenceProjection | undefined,
  sourceBindingId?: string
): StudentDecisionContextEvidence {
  if (!sourceContext) {
    return {
      schema_version: STUDENT_DECISION_CONTEXT_EVIDENCE_SCHEMA_VERSION,
      evidence_id: evidenceId(scope),
      evidence_version: "student-decision-context.v1",
      status: "BLOCKED",
      scope: { ...scope },
      continuity: {
        context: "PROVEN",
        decision: "BLOCKED",
        consequence: "BLOCKED",
        debrief: "BLOCKED",
        regional_transfer: "BLOCKED"
      },
      blocker_codes: ["SOURCE_EVIDENCE_UNAVAILABLE"],
      known_limits: [...KNOWN_LIMITS]
    };
  }

  return {
    schema_version: STUDENT_DECISION_CONTEXT_EVIDENCE_SCHEMA_VERSION,
    evidence_id: evidenceId(scope, sourceBindingId ?? sourceContext.epoch_version),
    evidence_version: "student-decision-context.v1",
    status: "READY",
    scope: { ...scope },
    source_context: { ...sourceContext },
    continuity: {
      context: "PROVEN",
      decision: "PROVEN",
      consequence: "PENDING_PUBLISH",
      debrief: "PENDING_PUBLISH",
      regional_transfer: "PENDING_PUBLISH"
    },
    known_limits: [...KNOWN_LIMITS]
  };
}

export function advanceStudentDecisionContextEvidence(
  evidence: StudentDecisionContextEvidence,
  scope: StudentDecisionContextScope
): StudentDecisionContextEvidence {
  if (!isStudentDecisionContextEvidenceScope(evidence, scope)) {
    throw new Error("STUDENT_CONTEXT_EVIDENCE_SCOPE_MISMATCH");
  }
  if (evidence.status !== "READY" || !evidence.source_context) return { ...evidence };
  return {
    ...evidence,
    continuity: {
      context: "PROVEN",
      decision: "PROVEN",
      consequence: "PROVEN",
      debrief: "PROVEN",
      regional_transfer: "PROVEN"
    }
  };
}
