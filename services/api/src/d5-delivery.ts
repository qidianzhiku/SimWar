import {
  D5_EXPORT_KNOWN_LIMITS,
  D5_EXPORT_RUNTIME_AUTHORITY,
  D5_EXPORT_SCHEMA_VERSION,
  D5_DELIVERY_OUTCOMES,
  isD5ExactRef,
  type D5DeliveryOutcome,
  type D5ExactRef,
  type ExportDeliveryAttempt,
  type ExportDeliveryReceipt,
  type LearningExportBundleVersion,
  type LearningExportJob
} from "@simwar/shared-contracts";
import { D5ExportAssembler, D5ExportError } from "./d5-export-assembler.js";
import { d5Digest } from "./d5-export-digest.js";
import type { D5ExportPersistencePort } from "./d5-export-ports.js";

export interface D5DeliveryRequest {
  readonly bundle_ref: D5ExactRef;
  readonly idempotency_key?: string;
}

export interface D5JobResult {
  readonly job: LearningExportJob;
  readonly status: "created" | "reused";
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sameRef(left: D5ExactRef, right: D5ExactRef): boolean {
  return left.tenant_id === right.tenant_id && left.resource_id === right.resource_id &&
    left.resource_type === right.resource_type && left.version === right.version &&
    left.content_digest === right.content_digest;
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

function statusFor(outcome: D5DeliveryOutcome): LearningExportJob["status"] {
  if (outcome === "ACCEPTED") return "DELIVERED";
  if (outcome === "PARTIAL") return "PARTIAL";
  if (outcome === "CLIENT_ERROR") return "FAILED";
  return "RETRYABLE";
}

function statementResults(bundle: LearningExportBundleVersion, outcome: D5DeliveryOutcome) {
  return bundle.statement_batch.statements.map((statement, index) => ({
    statement_id: statement.id,
    status: outcome === "ACCEPTED" || (outcome === "PARTIAL" && index === 0) ? "ACCEPTED" as const : "REJECTED" as const
  }));
}

export class D5DeliveryService {
  constructor(
    private readonly dependencies: {
      repository: D5ExportPersistencePort;
      assembler: Pick<D5ExportAssembler, "getDestination">;
      now?: () => string;
    }
  ) {}

  async createJob(
    actor: { actor_id: string; tenant_id: string },
    input: D5DeliveryRequest,
    outcome: D5DeliveryOutcome = "ACCEPTED"
  ): Promise<D5JobResult> {
    const bundle = await this.findBundle(actor.tenant_id, input.bundle_ref);
    const destination = this.dependencies.assembler.getDestination(actor.tenant_id);
    if (!D5_DELIVERY_OUTCOMES.includes(outcome)) throw new D5ExportError("D5_EXPORT_OUTPUT_INVALID");
    const idempotencyKey = input.idempotency_key ?? `d5_${d5Digest({ bundle: bundle.bundle_digest, destination: destination.destination_ref.content_digest }).slice(0, 32)}`;
    if (!/^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(idempotencyKey)) {
      throw new D5ExportError("D5_EXPORT_OUTPUT_INVALID");
    }
    const existing = (await this.dependencies.repository.listJobs(actor.tenant_id)).find((job) => job.idempotency_key === idempotencyKey);
    if (existing) {
      if (!sameRef(existing.bundle_ref, bundle.bundle_ref) || !sameRef(existing.destination_ref, destination.destination_ref)) {
        throw new D5ExportError("D5_EXPORT_DUPLICATE_CONFLICT");
      }
      return { job: clone(existing), status: "reused" };
    }
    const now = this.dependencies.now?.() ?? new Date().toISOString();
    const jobRef = ref(actor.tenant_id, "learning_export_job", `job_${d5Digest({ idempotencyKey }).slice(0, 24)}`, "1.0.0", { idempotencyKey, bundle: bundle.bundle_digest });
    const job: LearningExportJob = {
      attempt_count: 0,
      bundle_ref: bundle.bundle_ref,
      created_at: now,
      destination_ref: destination.destination_ref,
      idempotency_key: idempotencyKey,
      job_ref: jobRef,
      known_limits: [...D5_EXPORT_KNOWN_LIMITS],
      status: "QUEUED",
      updated_at: now
    };
    await this.dependencies.repository.appendJob(job);
    return { job: await this.runAttempt(job, bundle, outcome), status: "created" };
  }

  async retryJob(actor: { actor_id: string; tenant_id: string }, jobId: string): Promise<LearningExportJob> {
    const job = (await this.dependencies.repository.listJobs(actor.tenant_id)).find((candidate) => candidate.job_ref.resource_id === jobId);
    if (!job) throw new D5ExportError("D5_EXPORT_JOB_NOT_FOUND");
    if (!["RETRYABLE", "PARTIAL", "FAILED"].includes(job.status)) throw new D5ExportError("D5_EXPORT_JOB_NOT_RETRYABLE");
    const bundle = await this.findBundle(actor.tenant_id, job.bundle_ref);
    return this.runAttempt(job, bundle, "ACCEPTED");
  }

  async cancelJob(actor: { actor_id: string; tenant_id: string }, jobId: string): Promise<LearningExportJob> {
    const job = (await this.dependencies.repository.listJobs(actor.tenant_id)).find((candidate) => candidate.job_ref.resource_id === jobId);
    if (!job) throw new D5ExportError("D5_EXPORT_JOB_NOT_FOUND");
    if (!["QUEUED", "DELIVERING", "RETRYABLE", "PARTIAL"].includes(job.status)) throw new D5ExportError("D5_EXPORT_CANCEL_FORBIDDEN");
    const updated = { ...job, status: "CANCELLED" as const, updated_at: this.dependencies.now?.() ?? new Date().toISOString() };
    await this.dependencies.repository.updateJob(updated);
    return clone(updated);
  }

  private async findBundle(tenantId: string, bundleRef: D5ExactRef): Promise<LearningExportBundleVersion> {
    if (!isD5ExactRef(bundleRef) || bundleRef.tenant_id !== tenantId || bundleRef.resource_type !== "learning_export_bundle_version") {
      throw new D5ExportError("D5_EXACT_REFERENCE_INVALID");
    }
    const bundle = (await this.dependencies.repository.listBundles(tenantId)).find((candidate) => sameRef(candidate.bundle_ref, bundleRef));
    if (!bundle) throw new D5ExportError("D5_EXPORT_JOB_NOT_FOUND");
    return bundle;
  }

  private async runAttempt(job: LearningExportJob, bundle: LearningExportBundleVersion, outcome: D5DeliveryOutcome): Promise<LearningExportJob> {
    const now = this.dependencies.now?.() ?? new Date().toISOString();
    const attemptNo = job.attempt_count + 1;
    const results = statementResults(bundle, outcome);
    const attemptRef = ref(job.job_ref.tenant_id, "export_delivery_attempt", `${job.job_ref.resource_id}_attempt_${attemptNo}`, "1.0.0", { job: job.job_ref, attemptNo, outcome });
    const attempt: ExportDeliveryAttempt = {
      attempt_no: attemptNo,
      attempt_ref: attemptRef,
      finished_at: now,
      job_ref: job.job_ref,
      outcome,
      sealed_payload_digest: bundle.bundle_digest,
      started_at: now,
      statement_results: results
    };
    await this.dependencies.repository.appendAttempt(attempt);
    const updated: LearningExportJob = { ...job, attempt_count: attemptNo, status: statusFor(outcome), updated_at: now };
    await this.dependencies.repository.updateJob(updated);
    const receipt: ExportDeliveryReceipt = {
      attempt_no: attemptNo,
      bundle_ref: bundle.bundle_ref,
      created_at: now,
      destination_ref: job.destination_ref,
      job_ref: job.job_ref,
      known_limits: [...D5_EXPORT_KNOWN_LIMITS],
      outcome,
      receipt_ref: ref(job.job_ref.tenant_id, "export_delivery_receipt", `${job.job_ref.resource_id}_receipt_${attemptNo}`, "1.0.0", attempt),
      runtime_authority: D5_EXPORT_RUNTIME_AUTHORITY,
      sealed_payload_digest: bundle.bundle_digest,
      statement_results: results
    };
    await this.dependencies.repository.appendReceipt(receipt);
    return clone(updated);
  }
}
