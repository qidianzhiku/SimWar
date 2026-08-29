import type {
  ApiEnvelope,
  RegionalTransferCandidate,
  RegionalTransferCandidateInput,
  RegionalTransferTeacherProjection
} from "@simwar/shared-contracts";

async function request<T>(
  apiBase: string,
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {})
    }
  });
  const body = (await response.json()) as ApiEnvelope<T> & { code?: string; message?: string };
  if (!response.ok)
    throw new Error(body.code ?? body.message ?? "regional transfer request failed");
  return body.data;
}

export async function loadRegionalTransferSelection(
  apiBase: string,
  token: string,
  courseId: string,
  runId: string,
  roundNo: number
): Promise<RegionalTransferCandidateInput> {
  const query = new URLSearchParams({
    courseId,
    runId,
    roundNo: String(roundNo)
  });
  const result = await request<{ actor_id: string; input: RegionalTransferCandidateInput }>(
    apiBase,
    token,
    `/api/v1/bff/teacher/regional-transfer/selection?${query.toString()}`
  );
  return result.input;
}

export const previewRegionalTransfer = (
  apiBase: string,
  token: string,
  input: RegionalTransferCandidateInput
) =>
  request<RegionalTransferTeacherProjection>(
    apiBase,
    token,
    "/api/v1/bff/teacher/regional-transfer/preview",
    { body: JSON.stringify(input), method: "POST" }
  );

export const validateRegionalTransfer = (
  apiBase: string,
  token: string,
  input: RegionalTransferCandidateInput
) =>
  request<RegionalTransferTeacherProjection>(
    apiBase,
    token,
    "/api/v1/bff/teacher/regional-transfer/validate",
    { body: JSON.stringify(input), method: "POST" }
  );

export const freezeRegionalTransfer = (
  apiBase: string,
  token: string,
  input: RegionalTransferCandidateInput
) =>
  request<RegionalTransferCandidate>(
    apiBase,
    token,
    "/api/v1/bff/teacher/regional-transfer/freeze",
    { body: JSON.stringify(input), method: "POST" }
  );

export const bindRegionalTransfer = (apiBase: string, token: string, candidateId: string) =>
  request<RegionalTransferCandidate>(
    apiBase,
    token,
    `/api/v1/bff/teacher/regional-transfer/candidates/${encodeURIComponent(candidateId)}/bind`,
    { method: "POST" }
  );
