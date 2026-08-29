import type { ApiEnvelope, RegionalTransferStudentProjection } from "@simwar/shared-contracts";

export async function loadRegionalTransferStudentProjection(
  apiBase: string,
  token: string,
  candidateId: string
): Promise<RegionalTransferStudentProjection> {
  const response = await fetch(
    `${apiBase}/api/v1/bff/student/regional-transfer/candidates/${encodeURIComponent(candidateId)}`,
    { headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } }
  );
  const body = (await response.json()) as ApiEnvelope<RegionalTransferStudentProjection> & {
    code?: string;
    message?: string;
  };
  if (!response.ok)
    throw new Error(body.code ?? body.message ?? "regional transfer projection unavailable");
  return body.data;
}
