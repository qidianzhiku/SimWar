import type {
  ApiEnvelope,
  TransferResearchDesignBundle,
  TransferResearchDesignInput,
  TransferResearchDesignListDto,
  TransferEvidenceRecordCandidate
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
  if (!response.ok) throw new Error(body.code ?? body.message ?? "D6 request failed");
  return body.data;
}

export const loadTransferResearchDesigns = (apiBase: string, token: string, signal?: AbortSignal) =>
  request<TransferResearchDesignListDto>(
    apiBase,
    token,
    "/api/v1/bff/teacher/transfer-research-designs",
    signal ? { signal } : {}
  );
export const previewTransferResearchDesign = (
  apiBase: string,
  token: string,
  input: TransferResearchDesignInput
) =>
  request<TransferResearchDesignBundle>(
    apiBase,
    token,
    "/api/v1/bff/teacher/transfer-research-designs/preview",
    { body: JSON.stringify(input), method: "POST" }
  );
export const freezeTransferResearchDesign = (
  apiBase: string,
  token: string,
  input: TransferResearchDesignInput
) =>
  request<TransferResearchDesignBundle>(
    apiBase,
    token,
    "/api/v1/bff/teacher/transfer-research-designs/freeze",
    { body: JSON.stringify(input), method: "POST" }
  );
export const loadSyntheticTransferPreview = (apiBase: string, token: string, studyId: string) =>
  request<TransferEvidenceRecordCandidate>(
    apiBase,
    token,
    `/api/v1/bff/teacher/transfer-research-designs/${encodeURIComponent(studyId)}/synthetic-preview`
  );
export const reviseTransferResearchDesign = (
  apiBase: string,
  token: string,
  studyId: string,
  input: TransferResearchDesignInput
) =>
  request<TransferResearchDesignBundle>(
    apiBase,
    token,
    `/api/v1/bff/teacher/transfer-research-designs/${encodeURIComponent(studyId)}/revise`,
    {
      body: JSON.stringify(input),
      method: "POST"
    }
  );
export const retireTransferResearchDesign = (apiBase: string, token: string, studyId: string) =>
  request<TransferResearchDesignBundle>(
    apiBase,
    token,
    `/api/v1/bff/teacher/transfer-research-designs/${encodeURIComponent(studyId)}/retire`,
    {
      method: "POST"
    }
  );
