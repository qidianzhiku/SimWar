import {
  isTeachingClosureDto,
  type TeachingClosureContext,
  type TeachingClosureDto
} from "@simwar/shared-contracts";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type Envelope = { code: string; data?: unknown; message?: string };

export class TeachingClosureRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super("Teaching closure request failed");
    this.name = "TeachingClosureRequestError";
  }
}

export async function loadTeachingClosure(
  context: TeachingClosureContext,
  requestContext: { tenantId: string; token: string },
  fetcher: typeof fetch = fetch
): Promise<TeachingClosureDto> {
  const query = new URLSearchParams(Object.entries(context));
  const response = await fetcher(`${API_BASE}/api/v1/bff/teacher/teaching-closure?${query}`, {
    headers: {
      authorization: `Bearer ${requestContext.token}`,
      "x-tenant-id": requestContext.tenantId
    }
  });
  const envelope = (await response.json()) as Envelope;
  if (!response.ok || !isTeachingClosureDto(envelope.data)) {
    throw new TeachingClosureRequestError(response.status, envelope.code || "W019_OUTPUT_INVALID");
  }
  return envelope.data;
}
