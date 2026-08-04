import {
  D5_EXPORT_KNOWN_LIMITS,
  D5_EXPORT_RUNTIME_AUTHORITY,
  D5_EXPORT_SCHEMA_VERSION,
  isD5ExactRef,
  isLearningExportBundleVersion,
  type AoLExportDatasetVersion,
  type D5ExactRef,
  type DestinationProfileVersion,
  type D5ExportBundleListDto,
  type D5ExportFailureCode,
  type D5ExportPreview,
  type LearningExportBundleVersion,
  type LearningExportPolicyVersion,
  type StudentLearningReport,
  type XapiProfileVersion,
  type XapiStatement,
  type XapiStatementBatchVersion
} from "@simwar/shared-contracts";
import type { StudentLearningReportProjectionService } from "./student-learning-report-projection.js";
import type { D5ExportPersistencePort } from "./d5-export-ports.js";
import { d5Digest } from "./d5-export-digest.js";

export interface D5ExportSelectionInput {
  readonly destination_ref?: D5ExactRef;
  readonly policy_ref?: D5ExactRef;
  readonly profile_ref?: D5ExactRef;
  readonly report_refs: readonly D5ExactRef[];
}

export interface D5ExportSealResult {
  readonly bundle: LearningExportBundleVersion;
  readonly status: "generated" | "reused";
}

export class D5ExportError extends Error {
  constructor(readonly code: D5ExportFailureCode) {
    super(code);
    this.name = "D5ExportError";
  }
}

const PROFILE_IRI = "https://simwar.local/xapi/profile/d5";
const DEFAULT_PROFILE_SEED = "simwar:d5:xapi-profile:v1";
const DEFAULT_POLICY_SEED = "simwar:d5:export-policy:v1";
const DEFAULT_DESTINATION_SEED = "simwar:d5:mock-lrs:v1";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function ref(
  tenantId: string,
  resourceType: D5ExactRef["resource_type"],
  resourceId: string,
  version: string,
  seed: unknown
): D5ExactRef {
  return {
    content_digest: d5Digest(seed),
    discriminator: "exact_ref",
    resource_id: resourceId,
    resource_type: resourceType,
    tenant_id: tenantId,
    version
  };
}

function sameRef(left: D5ExactRef, right: D5ExactRef): boolean {
  return (
    left.tenant_id === right.tenant_id &&
    left.resource_id === right.resource_id &&
    left.resource_type === right.resource_type &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function reportRef(report: StudentLearningReport): D5ExactRef {
  return {
    ...report.report_ref,
    resource_type: "student_learning_report"
  };
}

function d5Ref(value: {
  readonly content_digest: string;
  readonly discriminator: "exact_ref";
  readonly resource_id: string;
  readonly resource_type: string;
  readonly tenant_id: string;
  readonly version: string;
}): D5ExactRef {
  return {
    content_digest: value.content_digest,
    discriminator: "exact_ref",
    resource_id: value.resource_id,
    resource_type: value.resource_type as D5ExactRef["resource_type"],
    tenant_id: value.tenant_id,
    version: value.version
  };
}

function profile(tenantId: string): XapiProfileVersion {
  const profileRef = ref(tenantId, "xapi_profile_version", "d5-internal-xapi-profile", "1.0.0", DEFAULT_PROFILE_SEED);
  return {
    content_digest: profileRef.content_digest,
    known_limits: [...D5_EXPORT_KNOWN_LIMITS],
    patterns: ["assessment-before-report"],
    profile_iri: PROFILE_IRI,
    profile_ref: profileRef,
    schema_version: D5_EXPORT_SCHEMA_VERSION,
    statement_templates: [
      {
        object_type: "Activity",
        template_id: "student-learning-report-completed",
        verb_id: "https://adlnet.gov/expapi/verbs/completed"
      }
    ],
    status: "ACTIVE"
  };
}

function policy(tenantId: string): LearningExportPolicyVersion {
  const policyRef = ref(tenantId, "learning_export_policy_version", "d5-aol-privacy-policy", "1.0.0", DEFAULT_POLICY_SEED);
  return {
    content_digest: policyRef.content_digest,
    known_limits: [...D5_EXPORT_KNOWN_LIMITS],
    minimum_cohort_size: 5,
    policy_ref: policyRef,
    raw_evidence_allowed: false,
    schema_version: D5_EXPORT_SCHEMA_VERSION,
    student_email_allowed: false,
    student_free_text_allowed: false,
    status: "ACTIVE",
    visibility: "teacher_admin_only"
  };
}

function destination(tenantId: string): DestinationProfileVersion {
  const destinationRef = ref(tenantId, "destination_profile_version", "d5-mock-lrs", "1.0.0", DEFAULT_DESTINATION_SEED);
  return {
    content_digest: destinationRef.content_digest,
    credential_required: false,
    destination_ref: destinationRef,
    kind: "MOCK_LRS",
    known_limits: [...D5_EXPORT_KNOWN_LIMITS],
    schema_version: D5_EXPORT_SCHEMA_VERSION,
    transport: "IN_PROCESS"
  };
}

function assertSelectedRef(actual: D5ExactRef | undefined, expected: D5ExactRef, code: D5ExportFailureCode): void {
  if (actual && (!isD5ExactRef(actual) || !sameRef(actual, expected))) throw new D5ExportError(code);
}

function buildStatement(report: StudentLearningReport, profileVersion: XapiProfileVersion, destinationVersion: DestinationProfileVersion): XapiStatement {
  const source = reportRef(report);
  const statementSeed = { destination: destinationVersion.destination_ref, profile: profileVersion.profile_ref, source };
  return {
    actor: {
      account: {
        home_page: "https://simwar.local/actor",
        name: `actor_${d5Digest({ tenant_id: report.student_scope.tenant_id, user_id: report.student_scope.user_id }).slice(0, 32)}`
      }
    },
    context: {
      extensions: {
        course_id: report.context.course_id,
        learning_goal_ref: d5Ref(report.learning_goal_ref),
        report_ref: source,
        rubric_ref: d5Ref(report.rubric_ref)
      }
    },
    id: `stmt_${d5Digest(statementSeed).slice(0, 32)}`,
    object: {
      definition: { name: "Student learning report", type: "Activity" },
      id: `https://simwar.local/learning-report/${source.resource_id}/${source.version}`
    },
    result: { completion: true, extensions: { status: report.status } },
    timestamp: report.generated_at,
    verb: {
      display: { "en-US": "completed" },
      id: "https://adlnet.gov/expapi/verbs/completed"
    }
  };
}

function buildDataset(
  tenantId: string,
  reports: readonly StudentLearningReport[],
  policyVersion: LearningExportPolicyVersion
): AoLExportDatasetVersion {
  const groups = new Map<string, StudentLearningReport[]>();
  for (const report of reports) {
    const key = `${report.context.course_id}:${report.learning_goal_ref.resource_id}:${report.learning_goal_ref.version}:${report.rubric_ref.resource_id}:${report.rubric_ref.version}`;
    groups.set(key, [...(groups.get(key) ?? []), report]);
  }
  const rows = [...groups.entries()].map(([groupKey, group]) => {
    const criterionCount = Math.max(...group.map((report) => report.learning_evidence.criterion_results.length), 0);
    const suppressed = group.length < policyVersion.minimum_cohort_size;
    const distribution: Record<string, number> = {};
    if (!suppressed) {
      for (const report of group) {
        for (const result of report.learning_evidence.criterion_results) {
          const key = String(result.level_ordinal);
          distribution[key] = (distribution[key] ?? 0) + 1;
        }
      }
    }
    return {
      coarsened: false,
      criterion_count: criterionCount,
      group_key: groupKey,
      level_distribution: distribution,
      sample_size: group.length,
      suppressed
    };
  });
  const sourceRefs = reports.map(reportRef);
  const seed = { policy: policyVersion.policy_ref, rows, source_refs: sourceRefs };
  const datasetRef = ref(tenantId, "aol_export_dataset_version", `aol_${d5Digest(seed).slice(0, 24)}`, "1.0.0", seed);
  return {
    content_digest: d5Digest({ ...seed, dataset_ref: datasetRef }),
    created_at: reports[0]?.generated_at ?? new Date(0).toISOString(),
    dataset_ref: datasetRef,
    known_limits: [...D5_EXPORT_KNOWN_LIMITS],
    policy_ref: policyVersion.policy_ref,
    rows,
    runtime_authority: D5_EXPORT_RUNTIME_AUTHORITY,
    schema_version: D5_EXPORT_SCHEMA_VERSION,
    source_report_refs: sourceRefs,
    visibility: "teacher_admin_only"
  };
}

export class D5ExportAssembler {
  constructor(
    private readonly dependencies: {
      reports: Pick<StudentLearningReportProjectionService, "listPreview">;
      repository: D5ExportPersistencePort;
      now?: () => string;
    }
  ) {}

  getPolicy(tenantId: string): LearningExportPolicyVersion {
    return policy(tenantId);
  }

  getProfile(tenantId: string): XapiProfileVersion {
    return profile(tenantId);
  }

  getDestination(tenantId: string): DestinationProfileVersion {
    return destination(tenantId);
  }

  async preview(tenantId: string, input: D5ExportSelectionInput): Promise<D5ExportPreview> {
    if (!Array.isArray(input.report_refs) || input.report_refs.length === 0 || input.report_refs.length > 100) {
      throw new D5ExportError("D5_REPORT_NOT_ELIGIBLE");
    }
    const policyVersion = policy(tenantId);
    const profileVersion = profile(tenantId);
    const destinationVersion = destination(tenantId);
    assertSelectedRef(input.policy_ref, policyVersion.policy_ref, "D5_EXPORT_POLICY_INVALID");
    assertSelectedRef(input.profile_ref, profileVersion.profile_ref, "D5_EXPORT_PROFILE_INVALID");
    assertSelectedRef(input.destination_ref, destinationVersion.destination_ref, "D5_EXPORT_DESTINATION_FORBIDDEN");
    if (input.report_refs.some((candidate) => !isD5ExactRef(candidate) || candidate.tenant_id !== tenantId || candidate.resource_type !== "student_learning_report")) {
      throw new D5ExportError("D5_EXACT_REFERENCE_INVALID");
    }
    const listed = await this.dependencies.reports.listPreview({ tenant_id: tenantId, user_id: "d5-export-reader" });
    const selected = input.report_refs.map((candidate) => listed.reports.find((report) => sameRef(reportRef(report), candidate)));
    if (selected.some((report) => !report || (report.status !== "CONFIRMED" && report.status !== "AMENDED"))) {
      throw new D5ExportError("D5_REPORT_NOT_ELIGIBLE");
    }
    const reports = selected as StudentLearningReport[];
    const scope = reports[0]?.context;
    if (!scope || reports.some((report) =>
      report.context.course_id !== scope.course_id ||
      report.context.run_id !== scope.run_id ||
      report.context.team_id !== scope.team_id ||
      report.context.role_key !== scope.role_key
    )) {
      throw new D5ExportError("D5_EXPORT_SCOPE_VIOLATION");
    }
    const statements = reports.map((report) => buildStatement(report, profileVersion, destinationVersion));
    const aolDataset = buildDataset(tenantId, reports, policyVersion);
    return {
      aol_dataset: aolDataset,
      destination: destinationVersion,
      known_limits: [...D5_EXPORT_KNOWN_LIMITS],
      policy: policyVersion,
      profile: profileVersion,
      source_report_refs: reports.map(reportRef),
      statements
    };
  }

  async seal(actor: { actor_id: string; tenant_id: string }, input: D5ExportSelectionInput): Promise<D5ExportSealResult> {
    const preview = await this.preview(actor.tenant_id, input);
    const now = this.dependencies.now?.() ?? new Date().toISOString();
    const batchSeed = {
      destination_ref: preview.destination.destination_ref,
      policy_ref: preview.policy.policy_ref,
      profile_ref: preview.profile.profile_ref,
      source_report_refs: preview.source_report_refs,
      statements: preview.statements
    };
    const batchRef = ref(actor.tenant_id, "xapi_statement_batch_version", `batch_${d5Digest(batchSeed).slice(0, 24)}`, "1.0.0", batchSeed);
    const statementBatch: XapiStatementBatchVersion = {
      batch_ref: batchRef,
      content_digest: d5Digest(batchSeed),
      created_at: now,
      destination_ref: preview.destination.destination_ref,
      known_limits: [...D5_EXPORT_KNOWN_LIMITS],
      policy_ref: preview.policy.policy_ref,
      profile_ref: preview.profile.profile_ref,
      runtime_authority: D5_EXPORT_RUNTIME_AUTHORITY,
      schema_version: D5_EXPORT_SCHEMA_VERSION,
      source_report_refs: preview.source_report_refs,
      statements: preview.statements,
      visibility: "teacher_admin_only"
    };
    const bundleSeed = { aol_dataset: preview.aol_dataset, statement_batch: statementBatch };
    const bundleDigest = d5Digest(bundleSeed);
    const bundleRef = ref(actor.tenant_id, "learning_export_bundle_version", `bundle_${bundleDigest.slice(0, 24)}`, "1.0.0", bundleDigest);
    const existing = (await this.dependencies.repository.listBundles(actor.tenant_id)).find((candidate) => candidate.bundle_digest === bundleDigest);
    if (existing) return { bundle: clone(existing), status: "reused" };
    const bundle: LearningExportBundleVersion = {
      aol_dataset: preview.aol_dataset,
      bundle_digest: bundleDigest,
      bundle_ref: bundleRef,
      created_by: actor.actor_id,
      known_limits: [...D5_EXPORT_KNOWN_LIMITS],
      sealed_at: now,
      schema_version: D5_EXPORT_SCHEMA_VERSION,
      statement_batch: statementBatch,
      status: "SEALED",
      visibility: "teacher_admin_only"
    };
    if (!isLearningExportBundleVersion(bundle)) throw new D5ExportError("D5_EXPORT_OUTPUT_INVALID");
    await this.dependencies.repository.appendBundle(bundle);
    return { bundle: clone(bundle), status: "generated" };
  }

  async list(tenantId: string): Promise<D5ExportBundleListDto> {
    return {
      bundles: await this.dependencies.repository.listBundles(tenantId),
      jobs: await this.dependencies.repository.listJobs(tenantId),
      known_limits: [...D5_EXPORT_KNOWN_LIMITS],
      receipts: await this.dependencies.repository.listReceipts(tenantId),
      runtime_authority: D5_EXPORT_RUNTIME_AUTHORITY
    };
  }
}
