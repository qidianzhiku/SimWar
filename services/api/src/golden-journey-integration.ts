import { createHash } from "node:crypto";
import type {
  CrossSliceReceiptEntry,
  CrossSliceReceiptIndex,
  CorrelationChainDto,
  GoldenJourneyAllowedActionsDto,
  GoldenJourneyContextDto,
  GoldenJourneyExactRef,
  GoldenJourneyStatusDto,
  R3GoldenRole
} from "@simwar/shared-contracts";
import { R3_GOLDEN_RUNTIME_AUTHORITY, R3_GOLDEN_SCHEMA_VERSION } from "@simwar/shared-contracts";
import type { RepositoryProvider } from "./repository-provider.js";
import type { SimWarStore } from "./store.js";

const KNOWN_LIMITS = [
  "R3 is a synthetic cross-slice integration journey, not Human Validation.",
  "JSON_INTERNAL_ONLY remains the active runtime authority.",
  "R3 does not write Truth, SettlementResult, Score, Rank, or Replay authority.",
  "D2/D3 private evidence remains teacher-only and is omitted from student status.",
  "D5 is mock export only and D6 is synthetic research design only.",
  "Durable recovery, PostgreSQL, Pilot, and Production are not proven or authorized."
] as const;

export interface GoldenJourneyQuery {
  readonly course_id?: string;
  readonly journey_id?: string;
  readonly run_id?: string;
  readonly team_id?: string;
}

export class GoldenJourneyIntegrationError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode = 422
  ) {
    super(code);
    this.name = "GoldenJourneyIntegrationError";
  }
}

interface GoldenJourneyDependencies {
  readonly repositoryProvider: RepositoryProvider;
  readonly store: SimWarStore;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(",")}}`;
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function exactRef(
  tenantId: string,
  resourceType: GoldenJourneyExactRef["resource_type"],
  resourceId: string,
  version: string,
  source: unknown
): GoldenJourneyExactRef {
  return {
    content_digest: digest(source),
    discriminator: "exact_ref",
    resource_id: resourceId,
    resource_type: resourceType,
    tenant_id: tenantId,
    version
  };
}

function copyRef(value: unknown): GoldenJourneyExactRef | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.discriminator !== "exact_ref" ||
    typeof candidate.content_digest !== "string" ||
    typeof candidate.resource_id !== "string" ||
    typeof candidate.resource_type !== "string" ||
    typeof candidate.tenant_id !== "string" ||
    typeof candidate.version !== "string"
  )
    return undefined;
  return candidate as unknown as GoldenJourneyExactRef;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export class GoldenJourneyIntegrationService {
  constructor(private readonly dependencies: GoldenJourneyDependencies) {}

  async getStatus(
    tenantId: string,
    actor: { user_id: string; role: R3GoldenRole; team_id?: string },
    query: GoldenJourneyQuery,
    requestId: string,
    correlationId: string
  ): Promise<GoldenJourneyStatusDto> {
    const courses =
      await this.dependencies.repositoryProvider.facade.courses.listCoursesForTenant(tenantId);
    const course = query.course_id
      ? await this.dependencies.repositoryProvider.facade.courses.getCourse(
          tenantId,
          query.course_id
        )
      : courses[0];
    if (!course) throw new GoldenJourneyIntegrationError("R3_GOLDEN_COURSE_NOT_FOUND", 404);

    const run = query.run_id
      ? await this.dependencies.repositoryProvider.facade.runs.getRun(tenantId, query.run_id)
      : (
          await this.dependencies.repositoryProvider.facade.runs.listRunsForCourse(
            tenantId,
            course.course_id
          )
        )[0];
    if (query.run_id && !run)
      throw new GoldenJourneyIntegrationError("R3_GOLDEN_RUN_NOT_FOUND", 404);

    const teamId = query.team_id ?? actor.team_id;
    const team = teamId
      ? await this.dependencies.repositoryProvider.facade.teams.getTeam(tenantId, teamId)
      : run
        ? (
            await this.dependencies.repositoryProvider.facade.teams.listTeamsForRun(
              tenantId,
              run.run_id
            )
          )[0]
        : undefined;
    if (teamId && !team) throw new GoldenJourneyIntegrationError("R3_GOLDEN_TEAM_NOT_FOUND", 404);
    if (team && team.tenant_id !== tenantId)
      throw new GoldenJourneyIntegrationError("R3_GOLDEN_SCOPE_VIOLATION", 403);

    const packageSnapshot = this.dependencies.store.coursePackageLifecycleSnapshots.find(
      (candidate) => candidate.tenant_id === tenantId && candidate.status === "AVAILABLE"
    );
    const coursePackageRef = packageSnapshot
      ? exactRef(
          tenantId,
          "course_package_version",
          packageSnapshot.course_package_id,
          packageSnapshot.version,
          packageSnapshot
        )
      : exactRef(tenantId, "course_package_version", "r3-synthetic-course-package", "1.0.0", {
          fixture: "R3_GOLDEN_SYNTHETIC_COURSE_PACKAGE",
          source_sha: "41a3ae8f0faa96edb8f24ba8e043356991f82e9d"
        });
    const goal = this.dependencies.store.learningGoalVersions.find(
      (candidate) => candidate.tenant_id === tenantId && candidate.status === "PUBLISHED"
    );
    const rubric = this.dependencies.store.rubricVersions.find(
      (candidate) => candidate.tenant_id === tenantId && candidate.status === "PUBLISHED"
    );
    const journeyId =
      query.journey_id ??
      `r3-${course.course_id}-${run?.run_id ?? "not-started"}-${team?.team_id ?? "not-started"}`;
    const roleKeys = team ? unique(team.members.map((member) => member.role_slot)) : [];
    const status =
      run && team ? (run.status === "completed" ? "complete" : "in_progress") : "ready";

    const context: GoldenJourneyContextDto = {
      correlation_id: correlationId,
      course_id: course.course_id,
      course_package_ref: coursePackageRef,
      discriminator: "golden_journey_context",
      journey_id: journeyId,
      known_limits: [...KNOWN_LIMITS],
      ...(goal
        ? {
            learning_goal_ref: exactRef(
              tenantId,
              "learning_goal_version",
              goal.goal_id,
              goal.version,
              goal
            )
          }
        : {}),
      ...(rubric
        ? {
            rubric_ref: exactRef(
              tenantId,
              "rubric_version",
              rubric.rubric_id,
              rubric.version,
              rubric
            )
          }
        : {}),
      request_id: requestId,
      role_keys: roleKeys,
      ...(run ? { run_id: run.run_id } : {}),
      runtime_authority: R3_GOLDEN_RUNTIME_AUTHORITY,
      schema_version: R3_GOLDEN_SCHEMA_VERSION,
      status,
      ...(team ? { team_id: team.team_id } : {}),
      tenant_id: tenantId
    };

    const entries = await this.buildReceiptEntries(tenantId, context, actor.role);
    const receiptIndex: CrossSliceReceiptIndex = {
      chain_digest: digest(entries),
      correlation_id: correlationId,
      discriminator: "cross_slice_receipt_index",
      entries,
      journey_id: journeyId,
      request_id: requestId,
      schema_version: R3_GOLDEN_SCHEMA_VERSION
    };
    const correlationChain: CorrelationChainDto = {
      correlation_id: correlationId,
      discriminator: "correlation_chain",
      journey_id: journeyId,
      request_id: requestId,
      schema_version: R3_GOLDEN_SCHEMA_VERSION,
      status: entries.length > 0 ? "complete" : "partial",
      steps: entries.map((entry) => ({
        correlation_id: correlationId,
        exact_refs: entry.exact_refs,
        operation: `${entry.slice.toLowerCase()}.receipt.read`,
        request_id: requestId,
        slice: entry.slice
      }))
    };
    const allowedActions: GoldenJourneyAllowedActionsDto = {
      allowed_actions:
        actor.role === "student"
          ? ["view_context", "view_allowed_actions", "view_receipts", "view_student_safe_report"]
          : [
              "view_context",
              "view_allowed_actions",
              "view_receipts",
              "view_provenance",
              "view_teacher_facts",
              "recover_journey",
              "abort_journey",
              "reset_journey",
              "cleanup_journey"
            ],
      blocked_reasons:
        actor.role === "student"
          ? ["Teacher-only evidence and private payloads are not exposed."]
          : [],
      correlation_id: correlationId,
      discriminator: "golden_journey_allowed_actions",
      journey_id: journeyId,
      request_id: requestId,
      role: actor.role,
      schema_version: R3_GOLDEN_SCHEMA_VERSION
    };

    return {
      allowed_actions: allowedActions,
      context,
      correlation_chain: correlationChain,
      discriminator: "golden_journey_status",
      formal_truth_write: false,
      receipt_index: receiptIndex,
      runtime_authority: R3_GOLDEN_RUNTIME_AUTHORITY,
      schema_version: R3_GOLDEN_SCHEMA_VERSION,
      student_private_fields_exposed: false
    };
  }

  private async buildReceiptEntries(
    tenantId: string,
    context: GoldenJourneyContextDto,
    role: R3GoldenRole
  ): Promise<CrossSliceReceiptEntry[]> {
    const entries: CrossSliceReceiptEntry[] = [
      { exact_refs: [context.course_package_ref], slice: "D1", status: "PASS" }
    ];
    const scopedEvents = this.dependencies.store.roleWorkflowEvents.filter(
      (event) =>
        event.tenant_id === tenantId &&
        (!context.run_id || event.run_id === context.run_id) &&
        (!context.team_id || event.team_id === context.team_id)
    );
    if (scopedEvents.length > 0) {
      entries.push({
        exact_refs: scopedEvents.map((event) =>
          exactRef(tenantId, "role_workflow_event", event.event_id, "1.0.0", event)
        ),
        slice: "R7",
        status: "PASS"
      });
    } else {
      entries.push({ exact_refs: [], slice: "R7", status: "KNOWN_LIMIT" });
    }
    if (context.run_id) {
      const run = this.dependencies.store.runs.find(
        (candidate) => candidate.run_id === context.run_id && candidate.tenant_id === tenantId
      );
      const round = this.dependencies.store.rounds.find(
        (candidate) => candidate.run_id === context.run_id && candidate.tenant_id === tenantId
      );
      entries.push({
        exact_refs: [
          ...(run ? [exactRef(tenantId, "run", run.run_id, "1.0.0", run)] : []),
          ...(round
            ? [exactRef(tenantId, "round", round.round_id, String(round.round_no), round)]
            : [])
        ],
        slice: "M1",
        status: run && round ? "PASS" : "KNOWN_LIMIT"
      });
    } else {
      entries.push({ exact_refs: [], slice: "M1", status: "KNOWN_LIMIT" });
    }
    if (role !== "student") {
      const artifacts = (
        await this.dependencies.repositoryProvider.ports.evidenceProvenance.listEvidenceArtifacts(
          tenantId
        )
      ).filter((artifact) => !context.run_id || artifact.context.run_id === context.run_id);
      entries.push({
        exact_refs: artifacts
          .map((artifact) => copyRef(artifact.artifact_ref))
          .filter((ref): ref is GoldenJourneyExactRef => Boolean(ref)),
        slice: "D2",
        status: artifacts.length > 0 ? "PASS" : "KNOWN_LIMIT"
      });
      entries.push({
        exact_refs: this.dependencies.store.teacherConfirmationVersions.map((confirmation) =>
          exactRef(
            tenantId,
            "teacher_confirmation",
            confirmation.confirmation_ref.resource_id,
            confirmation.confirmation_ref.version,
            confirmation
          )
        ),
        slice: "D3",
        status:
          this.dependencies.store.teacherConfirmationVersions.length > 0 ? "PASS" : "KNOWN_LIMIT"
      });
    }
    entries.push({ exact_refs: [], slice: "D4", status: "KNOWN_LIMIT" });
    entries.push({ exact_refs: [], slice: "D5", status: "KNOWN_LIMIT" });
    entries.push({ exact_refs: [], slice: "D6", status: "KNOWN_LIMIT" });
    return entries;
  }
}
