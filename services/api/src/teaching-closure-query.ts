import {
  type D2EvidenceQuery,
  type TeachingClosureContext,
  type TeachingClosureDto,
  type TeacherConfirmationVersion,
  isTeachingClosureDto
} from "@simwar/shared-contracts";
import type { CourseReportQueryService } from "./course-report-query-service.js";
import type { EvidenceCaptureCommandService } from "./evidence-provenance.js";
import type { StudentLearningReportProjectionService } from "./student-learning-report-projection.js";
import type { TeacherConfirmationQueryService } from "./teacher-confirmation-query.js";
import type { TeacherConfirmationWorkClaimService } from "./teacher-confirmation-work-claim.js";

const KNOWN_LIMITS = [
  "D2 evidence is teacher-only and is not learning confirmation or final grading.",
  "D3 confirmation is teacher-only and is not final grading.",
  "D4 is a confirmed-only student-safe projection.",
  "JSON_INTERNAL_ONLY is the active runtime authority; durable locking and recovery are not proven.",
  "Human Validation is not performed."
] as const;

export class TeachingClosureQueryError extends Error {
  constructor(readonly code: "W019_CONTEXT_INVALID" | "W019_OUTPUT_INVALID") {
    super(code);
    this.name = "TeachingClosureQueryError";
  }
}

function sameContext(
  left: Pick<TeachingClosureContext, "course_id" | "run_id" | "team_id" | "role_key">,
  right: Pick<TeachingClosureContext, "course_id" | "run_id" | "team_id" | "role_key">
): boolean {
  return (
    left.course_id === right.course_id &&
    left.role_key === right.role_key &&
    left.run_id === right.run_id &&
    left.team_id === right.team_id
  );
}

function versionNumber(version: string): number {
  const match = /^(\d+)\.0\.0$/.exec(version);
  return match ? Number(match[1]) : 0;
}

function latestConfirmation(
  records: readonly TeacherConfirmationVersion[],
  context: TeachingClosureContext
): TeacherConfirmationVersion | undefined {
  return records
    .filter((record) => sameContext(record.context, context))
    .sort(
      (left, right) =>
        versionNumber(left.confirmation_ref.version) - versionNumber(right.confirmation_ref.version)
    )
    .at(-1);
}

export interface TeachingClosureQueryDependencies {
  readonly courseReports: Pick<CourseReportQueryService, "query">;
  readonly evidence: Pick<EvidenceCaptureCommandService, "listTeacherEvidence">;
  readonly confirmations: Pick<TeacherConfirmationQueryService, "listTeacher">;
  readonly studentReports: Pick<StudentLearningReportProjectionService, "listPreview">;
  readonly claims: Pick<TeacherConfirmationWorkClaimService, "findByContext">;
}

export class TeachingClosureQueryService {
  constructor(private readonly dependencies: TeachingClosureQueryDependencies) {}

  async get(
    actor: { readonly actor_id: string; readonly tenant_id: string },
    context: TeachingClosureContext
  ): Promise<TeachingClosureDto> {
    if (!isTeachingClosureContext(context)) {
      throw new TeachingClosureQueryError("W019_CONTEXT_INVALID");
    }
    const evidence = await this.dependencies.evidence.listTeacherEvidence(
      actor.tenant_id,
      context as D2EvidenceQuery
    );
    const confirmationList = await this.dependencies.confirmations.listTeacher(actor.tenant_id);
    const confirmation = latestConfirmation(confirmationList.confirmations, context);
    const claim = this.dependencies.claims.findByContext(
      actor.tenant_id,
      {
        course_id: context.course_id,
        run_id: context.run_id,
        team_id: context.team_id,
        role_key: context.role_key
      },
      new Date().toISOString()
    );
    const missing: Array<"eligible_event" | "evidence_artifact" | "confirmation"> = [];
    if (evidence.eligible_events.length === 0) missing.push("eligible_event");
    if (evidence.artifacts.length === 0) missing.push("evidence_artifact");
    if (!confirmation) missing.push("confirmation");

    let outcomeStatus: "UNAVAILABLE" | "PENDING" | "CONFIRMED" = "UNAVAILABLE";
    let criterionCount = 0;
    let outcomeEvidenceCount = 0;
    if (confirmation) {
      outcomeStatus = confirmation.status === "CONFIRMED" ? "CONFIRMED" : "PENDING";
      criterionCount = confirmation.criterion_decisions.length;
      outcomeEvidenceCount = confirmation.evidence_refs.length;
    }
    const previews = await this.dependencies.studentReports.listPreview({
      tenant_id: actor.tenant_id,
      user_id: actor.actor_id
    });
    const preview = previews.reports.find((report) => sameContext(report.context, context));
    if (preview) {
      outcomeStatus = "CONFIRMED";
      criterionCount = preview.learning_evidence.criterion_results.length;
      outcomeEvidenceCount = preview.evidence_refs.length;
    }

    let courseReportAvailable = false;
    try {
      const report = await this.dependencies.courseReports.query(actor.tenant_id, {
        course_id: context.course_id,
        run_id: context.run_id,
        team_id: context.team_id
      });
      courseReportAvailable = report.rows.some(
        (row) =>
          row.course_id === context.course_id &&
          row.run_id === context.run_id &&
          row.team_id === context.team_id
      );
    } catch {
      courseReportAvailable = false;
    }

    const result: TeachingClosureDto = {
      context,
      course_report_available: courseReportAvailable,
      export_formats: ["json", "markdown"],
      known_limits: [...KNOWN_LIMITS],
      queue_item: {
        ...(claim?.claimed_by ? { claim_owner: claim.claimed_by } : {}),
        ...(claim?.expires_at ? { claim_expires_at: claim.expires_at } : {}),
        claim_status:
          claim?.status === "CLAIMED" || claim?.status === "EXPIRED" ? claim.status : "AVAILABLE",
        confirmation_status: confirmation?.status ?? "MISSING",
        context,
        eligible_event_count: evidence.eligible_events.length,
        evidence_count: evidence.artifacts.length,
        known_limits: [...KNOWN_LIMITS],
        missing,
        outcome_status: outcomeStatus
      },
      runtime_authority: "JSON_INTERNAL_ONLY",
      schema_version: "teaching-closure.v1",
      student_safe_preview: {
        criterion_count: criterionCount,
        evidence_count: outcomeEvidenceCount,
        next_focus:
          outcomeStatus === "CONFIRMED"
            ? "Review the confirmed criterion outcome with the student."
            : "Teacher confirmation is required before a student outcome is available.",
        status: outcomeStatus,
        visibility: "student_safe"
      }
    };
    if (!isTeachingClosureDto(result)) {
      throw new TeachingClosureQueryError("W019_OUTPUT_INVALID");
    }
    return result;
  }
}

function isTeachingClosureContext(value: unknown): value is TeachingClosureContext {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 5 &&
    Object.values(value).every(
      (item) =>
        typeof item === "string" &&
        item.trim() === item &&
        /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(item) &&
        !/(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(
          item
        )
    )
  );
}
