import type {
  ExportDeliveryAttempt,
  ExportDeliveryReceipt,
  LearningExportBundleVersion,
  LearningExportJob
} from "@simwar/shared-contracts";
import type { D5ExportPersistencePort } from "./d5-export-ports.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** D5 operational records only; this registry cannot write D1-D4 or Truth. */
export class InMemoryD5ExportRegistry implements D5ExportPersistencePort {
  private readonly bundles: LearningExportBundleVersion[] = [];
  private readonly jobs: LearningExportJob[] = [];
  private readonly attempts: ExportDeliveryAttempt[] = [];
  private readonly receipts: ExportDeliveryReceipt[] = [];

  async listBundles(tenantId: string): Promise<LearningExportBundleVersion[]> {
    return clone(this.bundles.filter((bundle) => bundle.bundle_ref.tenant_id === tenantId));
  }

  async appendBundle(bundle: LearningExportBundleVersion): Promise<void> {
    if (this.bundles.some((candidate) => candidate.bundle_digest === bundle.bundle_digest)) return;
    this.bundles.push(clone(bundle));
  }

  async listJobs(tenantId: string): Promise<LearningExportJob[]> {
    return clone(this.jobs.filter((job) => job.job_ref.tenant_id === tenantId));
  }

  async appendJob(job: LearningExportJob): Promise<void> {
    this.jobs.push(clone(job));
  }

  async updateJob(job: LearningExportJob): Promise<void> {
    const index = this.jobs.findIndex((candidate) => candidate.job_ref.content_digest === job.job_ref.content_digest);
    if (index < 0) throw new Error("d5_job_not_found");
    this.jobs[index] = clone(job);
  }

  async appendAttempt(attempt: ExportDeliveryAttempt): Promise<void> {
    this.attempts.push(clone(attempt));
  }

  async listAttempts(tenantId: string, jobId?: string): Promise<ExportDeliveryAttempt[]> {
    return clone(this.attempts.filter((attempt) => attempt.attempt_ref.tenant_id === tenantId && (!jobId || attempt.job_ref.resource_id === jobId)));
  }

  async appendReceipt(receipt: ExportDeliveryReceipt): Promise<void> {
    if (this.receipts.some((candidate) => candidate.receipt_ref.content_digest === receipt.receipt_ref.content_digest)) return;
    this.receipts.push(clone(receipt));
  }

  async listReceipts(tenantId: string): Promise<ExportDeliveryReceipt[]> {
    return clone(this.receipts.filter((receipt) => receipt.receipt_ref.tenant_id === tenantId));
  }
}
