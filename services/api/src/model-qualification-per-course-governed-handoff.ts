import type { ModelQualificationPortfolioAdoptionIdentity } from "./model-qualification-portfolio-supersession-preview.js";
import { stableSha256 } from "./model-qualification-adoption-drift-assessment.js";

export const MODEL_QUALIFICATION_PER_COURSE_HANDOFF_SCHEMA_VERSION =
  "model-qualification-per-course-governed-handoff.v1" as const;

export type PerCourseHandoffReadiness =
  | "KEEP_CURRENT"
  | "REVIEW_EXISTING"
  | "REQUALIFY_CURRENT"
  | "REQUEST_GOVERNED_ROLLBACK"
  | "REBASE_REQUIRED"
  | "BLOCKED"
  | "NO_ACTIONABLE_ADOPTION";

export type PerCourseHandoffStatus = "AVAILABLE" | "BLOCKED" | "REBASE_REQUIRED" | "NO_ACTION";

export interface ExistingCourseGovernanceSeam {
  readonly operation_id:
    | "MODEL_QUALIFICATION_ADMIN_AUDIT_GET_V1"
    | "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_ADMIN_GET_V1"
    | "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_ADMIN_ROLLBACK_DRY_RUN_V1";
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly query: { readonly courseId: string };
  readonly mutates: false;
}

export interface PerCourseGovernedHandoff {
  readonly schema_version: typeof MODEL_QUALIFICATION_PER_COURSE_HANDOFF_SCHEMA_VERSION;
  readonly handoff_id: string;
  readonly handoff_digest: string;
  readonly request_id: string;
  readonly request_digest: string;
  readonly tenant_id: string;
  readonly course_id: string;
  readonly selected_course_state_digest: string;
  readonly current_adoption: ModelQualificationPortfolioAdoptionIdentity | null;
  readonly readiness: PerCourseHandoffReadiness;
  readonly status: PerCourseHandoffStatus;
  readonly existing_governance_seam: ExistingCourseGovernanceSeam | null;
  readonly handoff_executed: false;
  readonly apply: false;
  readonly bulk_apply: false;
  readonly cross_course_transaction: false;
  readonly writer_effect: "NONE";
  readonly official_truth_write: false;
  readonly provider: "OFF";
  readonly known_limits: readonly string[];
}

export interface PortfolioChangeSetRequestLike {
  readonly request_id: string;
  readonly request_digest: string;
  readonly tenant_id: string;
  readonly status: "READY" | "BLOCKED" | "REBASE_REQUIRED";
}

export interface PortfolioPreviewCourseLike {
  readonly course_id: string;
  readonly current_adoption: ModelQualificationPortfolioAdoptionIdentity | null;
  readonly current_course_state_digest: string;
  readonly selected_course_state_digest: string;
  readonly status: PerCourseHandoffReadiness;
  readonly reasons: readonly string[];
}

export class PerCourseGovernedHandoffError extends Error {
  readonly code = "O10_PER_COURSE_HANDOFF_INPUT_INVALID" as const;

  constructor(message = "O10_PER_COURSE_HANDOFF_INPUT_INVALID") {
    super(message);
    this.name = "PerCourseGovernedHandoffError";
  }
}

const DIGEST = /^[a-f0-9]{64}$/u;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sameAdoption(
  left: ModelQualificationPortfolioAdoptionIdentity | null,
  right: ModelQualificationPortfolioAdoptionIdentity | null
): boolean {
  return left === null || right === null
    ? left === right
    : left.adoption_id === right.adoption_id && left.adoption_digest === right.adoption_digest;
}

function seamFor(
  readiness: PerCourseHandoffReadiness,
  courseId: string
): ExistingCourseGovernanceSeam | null {
  const query = { courseId } as const;
  if (readiness === "KEEP_CURRENT") {
    return {
      operation_id: "MODEL_QUALIFICATION_ADMIN_AUDIT_GET_V1",
      method: "GET",
      path: "/api/v1/bff/admin/model-qualification",
      query,
      mutates: false
    };
  }
  if (readiness === "REVIEW_EXISTING" || readiness === "REQUALIFY_CURRENT") {
    return {
      operation_id: "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_ADMIN_GET_V1",
      method: "GET",
      path: "/api/v1/bff/admin/model-qualification/adoption-operations",
      query,
      mutates: false
    };
  }
  if (readiness === "REQUEST_GOVERNED_ROLLBACK") {
    return {
      operation_id: "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_ADMIN_ROLLBACK_DRY_RUN_V1",
      method: "POST",
      path: "/api/v1/bff/admin/model-qualification/adoption-operations/rollback-dry-runs",
      query,
      mutates: false
    };
  }
  return null;
}

function handoffStatus(
  requestStatus: PortfolioChangeSetRequestLike["status"],
  readiness: PerCourseHandoffReadiness
): PerCourseHandoffStatus {
  if (requestStatus === "REBASE_REQUIRED" || readiness === "REBASE_REQUIRED") {
    return "REBASE_REQUIRED";
  }
  if (requestStatus === "BLOCKED" || readiness === "BLOCKED") return "BLOCKED";
  if (readiness === "NO_ACTIONABLE_ADOPTION") return "NO_ACTION";
  return "AVAILABLE";
}

/**
 * Maps exact O9 preview items to existing course-scoped governance seams.
 * This is a pure handoff description: it cannot apply, persist, review,
 * adopt, roll back, requalify, or execute a cross-course transaction.
 */
export function buildPerCourseGovernedHandoffs(
  request: PortfolioChangeSetRequestLike,
  courses: readonly PortfolioPreviewCourseLike[]
): readonly PerCourseGovernedHandoff[] {
  if (
    !request.request_id ||
    !DIGEST.test(request.request_digest) ||
    !request.tenant_id ||
    new Set(courses.map((course) => course.course_id)).size !== courses.length
  ) {
    throw new PerCourseGovernedHandoffError();
  }
  return courses.map((course) => {
    if (
      !course.course_id ||
      !DIGEST.test(course.current_course_state_digest) ||
      !DIGEST.test(course.selected_course_state_digest) ||
      course.current_course_state_digest !== course.selected_course_state_digest
    ) {
      throw new PerCourseGovernedHandoffError();
    }
    const status = handoffStatus(request.status, course.status);
    const seam = status === "AVAILABLE" ? seamFor(course.status, course.course_id) : null;
    const body = {
      schema_version: MODEL_QUALIFICATION_PER_COURSE_HANDOFF_SCHEMA_VERSION,
      request_id: request.request_id,
      request_digest: request.request_digest,
      tenant_id: request.tenant_id,
      course_id: course.course_id,
      selected_course_state_digest: course.selected_course_state_digest,
      current_adoption: course.current_adoption ? clone(course.current_adoption) : null,
      readiness: course.status,
      status,
      existing_governance_seam: seam,
      handoff_executed: false as const,
      apply: false as const,
      bulk_apply: false as const,
      cross_course_transaction: false as const,
      writer_effect: "NONE" as const,
      official_truth_write: false as const,
      provider: "OFF" as const,
      known_limits: [
        "This is an explicit per-course handoff description; it does not execute the existing seam.",
        "The existing seam remains course-scoped and must revalidate exact current state before any separately governed action.",
        "O10 has no Apply, bulk apply, automatic adoption, rollback, or requalification operation.",
        "Provider is OFF; no formal truth, settlement, score, rank, adoption, rollback, or history is changed.",
        ...course.reasons
      ] as const
    };
    const handoffDigest = stableSha256(body);
    return {
      ...body,
      handoff_id: `o10_course_handoff_${handoffDigest.slice(0, 24)}`,
      handoff_digest: handoffDigest
    };
  });
}
