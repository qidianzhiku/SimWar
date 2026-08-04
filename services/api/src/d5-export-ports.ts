import type {
  ExportDeliveryAttempt,
  ExportDeliveryReceipt,
  LearningExportBundleVersion,
  LearningExportJob
} from "@simwar/shared-contracts";

export interface D5ExportPersistencePort {
  listBundles(tenantId: string): Promise<LearningExportBundleVersion[]>;
  appendBundle(bundle: LearningExportBundleVersion): Promise<void>;
  listJobs(tenantId: string): Promise<LearningExportJob[]>;
  appendJob(job: LearningExportJob): Promise<void>;
  updateJob(job: LearningExportJob): Promise<void>;
  appendAttempt(attempt: ExportDeliveryAttempt): Promise<void>;
  listAttempts(tenantId: string, jobId?: string): Promise<ExportDeliveryAttempt[]>;
  appendReceipt(receipt: ExportDeliveryReceipt): Promise<void>;
  listReceipts(tenantId: string): Promise<ExportDeliveryReceipt[]>;
}
