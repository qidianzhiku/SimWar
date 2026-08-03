import type {
  ApiEnvelope,
  StudentLearningReportListDto
} from "@simwar/shared-contracts";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export async function fetchStudentLearningReports(
  token: string,
  tenantId: string,
  signal?: AbortSignal
): Promise<StudentLearningReportListDto> {
  const response = await fetch(`${API_BASE}/api/v1/bff/student/learning-reports`, {
    headers: {
      authorization: `Bearer ${token}`,
      "x-tenant-id": tenantId
    },
    ...(signal ? { signal } : {})
  });
  const envelope = (await response.json()) as ApiEnvelope<StudentLearningReportListDto> & {
    message?: string;
  };
  if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
  return envelope.data;
}
