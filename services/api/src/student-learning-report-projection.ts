import { createHash } from "node:crypto";
import {
  isStudentLearningReport,
  isD2ExactRef,
  isD2EvidenceArtifactVersion,
  isTeacherConfirmationExactRef,
  isTeacherConfirmationVersion,
  type D2EvidenceArtifactVersion,
  type D2ExactRef,
  type D2ProvenanceEdge,
  type StudentLearningReport,
  type StudentLearningReportExactRef,
  type StudentLearningReportFailureCode,
  type StudentLearningReportListDto,
  type StudentLearningReportPublicListDto,
  type TeacherConfirmationExactRef,
  type TeacherConfirmationVersion
} from "@simwar/shared-contracts";
import type {
  EvidenceProvenanceRepositoryPort,
  RoleWorkflowRepositoryPort
} from "./repository-ports.js";
import { TeacherConfirmationCommandService } from "./teacher-confirmation.js";

const KNOWN_LIMITS = [
  "D4 is a read-only projection of confirmed D3 evidence.",
  "Teacher feedback is omitted unless D3 explicitly marks it student-visible.",
  "Business outcomes remain in a separate safe result surface and are not copied into D4.",
  "JSON_INTERNAL_ONLY is the active runtime authority; durable recovery is not proven.",
  "Human Validation is not performed.",
  "Issue #111 remains an open known limit.",
  "PostgreSQL, Pilot, and Production are not active or authorized."
] as const;

export class StudentLearningReportProjectionError extends Error {
  constructor(readonly code: StudentLearningReportFailureCode) {
    super(code);
    this.name = "StudentLearningReportProjectionError";
  }
}

export interface StudentLearningReportActor {
  readonly tenant_id: string;
  readonly user_id: string;
  readonly team_id?: string;
}

export interface StudentLearningReportProjectionDependencies {
  readonly confirmations: TeacherConfirmationCommandService;
  readonly evidence: EvidenceProvenanceRepositoryPort;
  readonly roleWorkflow?: Pick<RoleWorkflowRepositoryPort, "readRoleWorkflow">;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
      .join(",")}}`;
  }
  throw new StudentLearningReportProjectionError("D4_REPORT_OUTPUT_INVALID");
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

function ref(value: TeacherConfirmationExactRef | D2ExactRef): StudentLearningReportExactRef {
  return {
    content_digest: value.content_digest,
    discriminator: "exact_ref",
    resource_id: value.resource_id,
    resource_type: value.resource_type,
    tenant_id: value.tenant_id,
    version: value.version
  };
}

function edge(
  value: D2ProvenanceEdge
): StudentLearningReport["learning_evidence"]["provenance_chain"][number] {
  return {
    discriminator: "d4_provenance_edge",
    relation: value.relation,
    source_ref: ref(value.source_ref),
    target_ref: ref(value.target_ref)
  };
}

function confirmationVersion(value: string): number {
  const match = /^(\d+)\.0\.0$/.exec(value);
  return match ? Number(match[1]) : 0;
}

function latestByConfirmation(
  records: readonly TeacherConfirmationVersion[]
): TeacherConfirmationVersion[] {
  const groups = new Map<string, TeacherConfirmationVersion[]>();
  for (const record of records.filter(isTeacherConfirmationVersion)) {
    const key = `${record.confirmation_ref.resource_id}:${record.context.team_id}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return [...groups.values()]
    .map((group) =>
      [...group].sort(
        (left, right) =>
          confirmationVersion(left.confirmation_ref.version) -
          confirmationVersion(right.confirmation_ref.version)
      )
    )
    .map((group) => group.at(-1)!)
    .filter((record) => record.status === "CONFIRMED");
}

function hasEarlierConfirmed(
  records: readonly TeacherConfirmationVersion[],
  current: TeacherConfirmationVersion
): boolean {
  return records.some(
    (record) =>
      record.confirmation_ref.resource_id === current.confirmation_ref.resource_id &&
      record.status === "CONFIRMED" &&
      confirmationVersion(record.confirmation_ref.version) <
        confirmationVersion(current.confirmation_ref.version)
  );
}

type ExactReference = TeacherConfirmationExactRef | D2ExactRef;

function exactReferenceMatches(left: ExactReference, right: ExactReference): boolean {
  return (
    left.content_digest === right.content_digest &&
    left.discriminator === right.discriminator &&
    left.resource_id === right.resource_id &&
    left.resource_type === right.resource_type &&
    left.tenant_id === right.tenant_id &&
    left.version === right.version
  );
}

function artifactContextMatches(
  artifact: D2EvidenceArtifactVersion,
  confirmation: TeacherConfirmationVersion
): boolean {
  const expected = confirmation.context;
  if (
    artifact.context.course_id !== expected.course_id ||
    artifact.context.run_id !== expected.run_id ||
    artifact.context.team_id !== expected.team_id ||
    artifact.context.role_key !== expected.role_key
  )
    return false;
  const exactRoundRequested = expected.round_id !== undefined || expected.round_no !== undefined;
  if (!exactRoundRequested) return true;
  return (
    expected.round_id !== undefined &&
    expected.round_no !== undefined &&
    artifact.context.round_id === expected.round_id &&
    artifact.context.round_no === expected.round_no
  );
}

function artifactHasSourceProvenance(
  artifact: D2EvidenceArtifactVersion,
  provenanceEdges: readonly D2ProvenanceEdge[]
): boolean {
  return provenanceEdges.some(
    (candidate) =>
      candidate.relation === "derived_from" &&
      exactReferenceMatches(candidate.source_ref, artifact.artifact_ref) &&
      exactReferenceMatches(candidate.target_ref, artifact.source_event_ref)
  );
}

function artifactMatchesEvidence(
  artifact: D2EvidenceArtifactVersion,
  evidenceRef: TeacherConfirmationExactRef,
  confirmation: TeacherConfirmationVersion,
  provenanceEdges: readonly D2ProvenanceEdge[]
): boolean {
  return (
    isD2EvidenceArtifactVersion(artifact) &&
    isD2ExactRef(artifact.artifact_ref) &&
    isTeacherConfirmationExactRef(evidenceRef) &&
    evidenceRef.resource_type === "evidence_artifact" &&
    evidenceRef.tenant_id === confirmation.confirmation_ref.tenant_id &&
    artifact.source_event_ref.tenant_id === confirmation.confirmation_ref.tenant_id &&
    artifact.source_event_ref.resource_type === "role_workflow_event" &&
    exactReferenceMatches(artifact.artifact_ref, evidenceRef) &&
    artifact.artifact_digest === evidenceRef.content_digest &&
    artifactContextMatches(artifact, confirmation) &&
    artifactHasSourceProvenance(artifact, provenanceEdges)
  );
}

type EvidenceResolution = "valid" | "invalid" | "missing";

function resolveEvidence(
  confirmation: TeacherConfirmationVersion,
  artifacts: readonly D2EvidenceArtifactVersion[],
  provenanceEdges: readonly D2ProvenanceEdge[]
): EvidenceResolution {
  if (confirmation.evidence_refs.length === 0) return "invalid";
  let invalid = false;
  for (const evidenceRef of confirmation.evidence_refs) {
    const candidates = artifacts.filter(
      (artifact) =>
        artifact.artifact_ref.resource_id === evidenceRef.resource_id &&
        artifact.artifact_ref.version === evidenceRef.version
    );
    if (candidates.length === 0) return "missing";
    if (
      !candidates.some((artifact) =>
        artifactMatchesEvidence(artifact, evidenceRef, confirmation, provenanceEdges)
      )
    )
      invalid = true;
  }
  return invalid ? "invalid" : "valid";
}

export class StudentLearningReportProjectionService {
  constructor(private readonly dependencies: StudentLearningReportProjectionDependencies) {}

  async listStudentPublic(
    actor: StudentLearningReportActor,
    reportId?: string
  ): Promise<StudentLearningReportPublicListDto> {
    if (!actor.team_id) throw new StudentLearningReportProjectionError("D4_REPORT_SCOPE_VIOLATION");
    const result: StudentLearningReportPublicListDto["reports"][number][] = [];
    const records = latestByConfirmation(
      await this.dependencies.confirmations.list(actor.tenant_id)
    );
    const internalReports = this.dependencies.roleWorkflow
      ? await this.buildReports(actor.tenant_id, actor.user_id, actor.team_id, {
          skipUnavailable: true
        })
      : [];
    for (const record of records) {
      const context = record.context;
      const id = `student_report_${record.confirmation_ref.resource_id}`;
      if (
        record.confirmation_ref.tenant_id !== actor.tenant_id ||
        context.team_id !== actor.team_id ||
        !context.round_id ||
        !context.round_no ||
        (reportId && reportId !== id) ||
        !this.dependencies.roleWorkflow
      )
        continue;
      const snapshot = await this.dependencies.roleWorkflow.readRoleWorkflow({
        tenant_id: actor.tenant_id,
        run_id: context.run_id,
        round_id: context.round_id,
        team_id: actor.team_id
      });
      if (
        snapshot.course?.tenant_id !== actor.tenant_id ||
        snapshot.course.course_id !== context.course_id ||
        snapshot.run?.tenant_id !== actor.tenant_id ||
        snapshot.run.run_id !== context.run_id ||
        snapshot.run.course_id !== context.course_id ||
        snapshot.team?.tenant_id !== actor.tenant_id ||
        snapshot.team.team_id !== actor.team_id ||
        snapshot.team.course_id !== context.course_id ||
        snapshot.round?.tenant_id !== actor.tenant_id ||
        snapshot.round.run_id !== context.run_id ||
        snapshot.round.round_id !== context.round_id ||
        snapshot.round.round_no !== context.round_no ||
        snapshot.round.status !== "published" ||
        !snapshot.assignments.some(
          (assignment) =>
            assignment.status === "active" &&
            assignment.user_id === actor.user_id &&
            assignment.role_key === context.role_key
        )
      )
        continue;
      const report = internalReports.find((candidate) => candidate.report_ref.resource_id === id);
      if (!report) continue;
      result.push({
        report_id: id,
        context: {
          course_id: context.course_id,
          run_id: context.run_id,
          team_id: context.team_id,
          role_key: context.role_key,
          round_id: context.round_id,
          round_no: context.round_no
        },
        status: report.status,
        learning_evidence: {
          criterion_results: report.learning_evidence.criterion_results.map(
            ({ criterion_id, level_ordinal }) => ({ criterion_id, level_ordinal })
          ),
          student_visible_feedback: []
        },
        business_outcome: {
          status: "SEPARATE_SAFE_OUTCOME",
          summary: "Published business outcome remains in its separate safe result surface."
        }
      });
    }
    if (reportId && result.length === 0)
      throw new StudentLearningReportProjectionError("D4_REPORT_NOT_FOUND");
    return {
      reports: result,
      known_limits: ["Only published evidence for your active role and team is shown."],
      report_schema_version: "student-learning-report.public.v1",
      scope: "student_team"
    };
  }

  async listStudent(actor: StudentLearningReportActor): Promise<StudentLearningReportListDto> {
    if (!actor.team_id) throw new StudentLearningReportProjectionError("D4_REPORT_SCOPE_VIOLATION");
    const reports = await this.buildReports(actor.tenant_id, actor.user_id, actor.team_id);
    return {
      known_limits: [...KNOWN_LIMITS],
      reports,
      report_schema_version: "student-learning-report.v1",
      runtime_authority: "JSON_INTERNAL_ONLY",
      scope: "student_team"
    };
  }

  async getStudent(
    actor: StudentLearningReportActor,
    reportId: string
  ): Promise<StudentLearningReportListDto> {
    const result = await this.listStudent(actor);
    const report = result.reports.find(
      (candidate) => candidate.report_ref.resource_id === reportId
    );
    if (!report) throw new StudentLearningReportProjectionError("D4_REPORT_NOT_FOUND");
    return { ...result, reports: [report] };
  }

  async listPreview(actor: StudentLearningReportActor): Promise<StudentLearningReportListDto> {
    return {
      known_limits: [...KNOWN_LIMITS],
      reports: await this.buildReports(actor.tenant_id, "team_scoped"),
      report_schema_version: "student-learning-report.v1",
      runtime_authority: "JSON_INTERNAL_ONLY",
      scope: "tenant_preview"
    };
  }

  async getPreview(
    actor: StudentLearningReportActor,
    reportId: string
  ): Promise<StudentLearningReportListDto> {
    const result = await this.listPreview(actor);
    const report = result.reports.find(
      (candidate) => candidate.report_ref.resource_id === reportId
    );
    if (!report) throw new StudentLearningReportProjectionError("D4_REPORT_NOT_FOUND");
    return { ...result, reports: [report] };
  }

  private async buildReports(
    tenantId: string,
    userId: string,
    teamId?: string,
    options: { readonly skipUnavailable?: boolean } = {}
  ): Promise<StudentLearningReport[]> {
    const records = await this.dependencies.confirmations.list(tenantId);
    const latest = latestByConfirmation(records).filter(
      (record) =>
        record.confirmation_ref.tenant_id === tenantId &&
        (teamId === undefined || record.context.team_id === teamId)
    );
    const artifacts = await this.dependencies.evidence.listEvidenceArtifacts(tenantId);
    const edges = await this.dependencies.evidence.listProvenanceEdges(tenantId);
    const reports: StudentLearningReport[] = [];
    for (const record of latest) {
      const resolution = resolveEvidence(record, artifacts, edges);
      if (resolution === "missing") {
        if (options.skipUnavailable) continue;
        throw new StudentLearningReportProjectionError("D4_REPORT_NOT_AVAILABLE");
      }
      if (resolution === "invalid") continue;
      reports.push(this.toReport(record, records, artifacts, edges, userId));
    }
    reports.sort((left, right) => right.generated_at.localeCompare(left.generated_at));
    return reports;
  }

  private toReport(
    confirmation: TeacherConfirmationVersion,
    allConfirmations: readonly TeacherConfirmationVersion[],
    artifacts: Awaited<ReturnType<EvidenceProvenanceRepositoryPort["listEvidenceArtifacts"]>>,
    provenanceEdges: Awaited<ReturnType<EvidenceProvenanceRepositoryPort["listProvenanceEdges"]>>,
    userId: string
  ): StudentLearningReport {
    const evidenceRefs = confirmation.evidence_refs.map(ref);
    const matchingArtifacts = confirmation.evidence_refs
      .map((evidenceRef) =>
        artifacts.find((artifact) =>
          artifactMatchesEvidence(artifact, evidenceRef, confirmation, provenanceEdges)
        )
      )
      .filter((artifact): artifact is D2EvidenceArtifactVersion => artifact !== undefined);
    if (matchingArtifacts.length !== confirmation.evidence_refs.length) {
      throw new StudentLearningReportProjectionError("D4_REPORT_NOT_AVAILABLE");
    }
    const provenanceChain = provenanceEdges
      .filter((candidate) =>
        matchingArtifacts.some(
          (artifact) =>
            exactReferenceMatches(candidate.source_ref, artifact.artifact_ref) ||
            exactReferenceMatches(candidate.target_ref, artifact.artifact_ref)
        )
      )
      .map(edge);
    const status: StudentLearningReport["status"] = hasEarlierConfirmed(
      allConfirmations,
      confirmation
    )
      ? "AMENDED"
      : "CONFIRMED";
    const reportId = `student_report_${confirmation.confirmation_ref.resource_id}`;
    const seed = {
      business_outcome: {
        status: "SEPARATE_SAFE_OUTCOME" as const,
        summary: "Published business outcome remains in its separate safe result surface."
      },
      context: clone(confirmation.context),
      course_package_ref: ref(confirmation.course_package_ref),
      evidence_refs: evidenceRefs,
      known_limits: [...KNOWN_LIMITS],
      learning_goal_ref: ref(confirmation.learning_goal_ref),
      rubric_ref: ref(confirmation.rubric_ref),
      learning_evidence: {
        criterion_results: confirmation.criterion_decisions.map((decision) => ({ ...decision })),
        provenance_chain: provenanceChain,
        student_visible_feedback: []
      },
      report_id: reportId,
      source_confirmation_digest: confirmation.content_digest,
      status,
      student_scope: {
        team_id: confirmation.context.team_id,
        tenant_id: confirmation.confirmation_ref.tenant_id,
        user_id: userId
      },
      teacher_confirmation_ref: ref(confirmation.confirmation_ref)
    };
    const reportDigest = digest(seed);
    const report: StudentLearningReport = {
      ...seed,
      report_digest: reportDigest,
      report_ref: {
        content_digest: reportDigest,
        discriminator: "exact_ref",
        resource_id: reportId,
        resource_type: "student_learning_report",
        tenant_id: confirmation.confirmation_ref.tenant_id,
        version: "1.0.0"
      },
      generated_at: confirmation.created_at,
      runtime_authority: "JSON_INTERNAL_ONLY",
      schema_version: "student-learning-report.v1",
      visibility: "student_safe"
    };
    delete (report as unknown as Record<string, unknown>).report_id;
    if (!isStudentLearningReport(report)) {
      throw new StudentLearningReportProjectionError("D4_REPORT_OUTPUT_INVALID");
    }
    return report;
  }
}
