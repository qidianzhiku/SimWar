import type { ApiEnvelope, RegionalTransferAdminProjection } from "@simwar/shared-contracts";

export async function loadRegionalTransferAdminProjection(
  apiBase: string,
  token: string,
  candidateId: string
): Promise<RegionalTransferAdminProjection> {
  const response = await fetch(
    `${apiBase}/api/v1/bff/admin/regional-transfer/candidates/${encodeURIComponent(candidateId)}`,
    { headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } }
  );
  const body = (await response.json()) as ApiEnvelope<RegionalTransferAdminProjection> & {
    code?: string;
    message?: string;
  };
  if (!response.ok) throw new Error(body.code ?? body.message ?? "regional transfer audit failed");
  return body.data;
}
