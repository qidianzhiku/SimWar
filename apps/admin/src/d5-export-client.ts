import type { D5ExactRef, ExportDeliveryReceipt, LearningExportBundleVersion, LearningExportJob } from "@simwar/shared-contracts";

export interface D5ReportSummary { report_ref: D5ExactRef; context: { course_id: string; run_id: string; team_id: string; role_key: string }; status: "CONFIRMED" | "AMENDED" }
export interface D5Preview { source_report_refs: readonly D5ExactRef[]; statements: readonly unknown[]; aol_dataset: { rows: readonly { group_key: string; sample_size: number; suppressed: boolean }[] }; known_limits: readonly string[] }
export interface D5List { bundles: readonly LearningExportBundleVersion[]; jobs: readonly LearningExportJob[]; receipts: readonly ExportDeliveryReceipt[]; known_limits: readonly string[] }
interface Envelope<T> { data: T; code: string; message: string }

async function request<T>(base: string, token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, { ...init, headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(init?.headers ?? {}) } });
  const envelope = (await response.json()) as Envelope<T>;
  if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
  return envelope.data;
}
export function loadD5Reports(base: string, token: string): Promise<{ reports: readonly D5ReportSummary[] }> { return request(base, token, "/api/v1/bff/admin/learning-reports"); }
export function previewD5Export(base: string, token: string, report_refs: readonly D5ExactRef[]): Promise<D5Preview> { return request(base, token, "/api/v1/bff/admin/learning-exports/preview", { method: "POST", body: JSON.stringify({ report_refs }) }); }
export function sealD5Export(base: string, token: string, report_refs: readonly D5ExactRef[]): Promise<LearningExportBundleVersion> { return request(base, token, "/api/v1/bff/admin/learning-exports/seal", { method: "POST", body: JSON.stringify({ report_refs }) }); }
export function loadD5Exports(base: string, token: string): Promise<D5List> { return request(base, token, "/api/v1/bff/admin/learning-exports"); }
export function createD5Job(base: string, token: string, bundle_ref: D5ExactRef): Promise<LearningExportJob> { return request(base, token, "/api/v1/bff/admin/learning-exports/jobs", { method: "POST", body: JSON.stringify({ bundle_ref }) }); }
export function retryD5Job(base: string, token: string, jobId: string): Promise<LearningExportJob> { return request(base, token, `/api/v1/bff/admin/learning-exports/jobs/${encodeURIComponent(jobId)}/retry`, { method: "POST" }); }
export function cancelD5Job(base: string, token: string, jobId: string): Promise<LearningExportJob> { return request(base, token, `/api/v1/bff/admin/learning-exports/jobs/${encodeURIComponent(jobId)}/cancel`, { method: "POST" }); }
