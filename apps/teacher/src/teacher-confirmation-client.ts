import type {
  ApiEnvelope,
  CoursePackageVersionTeacherDto,
  D2EvidenceListDto,
  LearningDesignListDto,
  TeacherConfirmationCommandInput,
  TeacherConfirmationRejectInput,
  TeacherConfirmationTeacherDto,
  TeacherConfirmationVersion,
  TeacherConfirmationWorkClaim
} from "@simwar/shared-contracts";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export type TeacherConfirmationList = {
  confirmations: readonly TeacherConfirmationVersion[];
  known_limits: readonly string[];
  runtime_authority: "JSON_INTERNAL_ONLY";
};

export type TeacherConfirmationDraftReceipt = {
  data: { confirmation: TeacherConfirmationVersion; status: "generated" | "reused" };
  known_limits: readonly string[];
  runtime_authority: "JSON_INTERNAL_ONLY";
};

export type TeacherConfirmationWorkClaimReceipt = {
  claim: TeacherConfirmationWorkClaim;
  known_limits: readonly string[];
};

export type TeacherConfirmationError = Error & { code?: string; status?: number };

function headers(token: string, tenantId: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-tenant-id": tenantId
  };
}

async function read<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiEnvelope<T> & { code?: string; message?: string };
  if (!response.ok) {
    const error = new Error(
      payload.message ?? "Teacher confirmation request failed"
    ) as TeacherConfirmationError;
    error.code = payload.code;
    error.status = response.status;
    throw error;
  }
  if (!payload.data) throw new Error("Teacher confirmation response was empty");
  return payload.data;
}

export function loadTeacherConfirmationReferences(
  token: string,
  tenantId: string
): Promise<{ packages: readonly CoursePackageVersionTeacherDto[]; design: LearningDesignListDto }> {
  return Promise.all([
    fetch(`${API_BASE}/api/v1/bff/teacher/course-package-versions`, {
      headers: headers(token, tenantId)
    }).then((response) =>
      read<{ course_package_versions: readonly CoursePackageVersionTeacherDto[] }>(response)
    ),
    fetch(`${API_BASE}/api/v1/bff/teacher/learning-designs`, {
      headers: headers(token, tenantId)
    }).then((response) => read<LearningDesignListDto>(response))
  ]).then(([packages, design]) => ({ packages: packages.course_package_versions, design }));
}

export function loadTeacherConfirmations(
  token: string,
  tenantId: string
): Promise<TeacherConfirmationList> {
  return fetch(`${API_BASE}/api/v1/bff/teacher/confirmations`, {
    headers: headers(token, tenantId)
  }).then((response) => read<TeacherConfirmationList>(response));
}

export function loadTeacherEvidence(
  token: string,
  tenantId: string,
  scope: {
    course_id: string;
    run_id: string;
    team_id: string;
    role_key: string;
    activity_id: string;
    round_id?: string;
    round_no?: number;
  }
): Promise<D2EvidenceListDto> {
  const query = new URLSearchParams(
    Object.entries(scope).reduce<Record<string, string>>((values, [key, value]) => {
      if (value !== undefined) values[key] = String(value);
      return values;
    }, {})
  );
  return fetch(`${API_BASE}/api/v1/bff/teacher/evidence?${query.toString()}`, {
    headers: headers(token, tenantId)
  }).then((response) => read<D2EvidenceListDto>(response));
}

export function saveTeacherConfirmationDraft(
  input: TeacherConfirmationCommandInput,
  token: string,
  tenantId: string
): Promise<TeacherConfirmationDraftReceipt> {
  return fetch(`${API_BASE}/api/v1/bff/teacher/confirmations/drafts`, {
    body: JSON.stringify(input),
    headers: headers(token, tenantId),
    method: "POST"
  }).then((response) => read<TeacherConfirmationDraftReceipt>(response));
}

export function confirmTeacherConfirmation(
  confirmationId: string,
  claimId: string,
  token: string,
  tenantId: string
): Promise<{ data: TeacherConfirmationTeacherDto; known_limits: readonly string[] }> {
  return fetch(
    `${API_BASE}/api/v1/bff/teacher/confirmations/${encodeURIComponent(confirmationId)}/confirm`,
    {
      body: JSON.stringify({ claim_id: claimId }),
      headers: headers(token, tenantId),
      method: "POST"
    }
  ).then((response) =>
    read<{ data: TeacherConfirmationTeacherDto; known_limits: readonly string[] }>(response)
  );
}

export function rejectTeacherConfirmation(
  confirmationId: string,
  claimId: string,
  input: TeacherConfirmationRejectInput,
  token: string,
  tenantId: string
): Promise<{ data: TeacherConfirmationTeacherDto; known_limits: readonly string[] }> {
  return fetch(
    `${API_BASE}/api/v1/bff/teacher/confirmations/${encodeURIComponent(confirmationId)}/reject`,
    {
      body: JSON.stringify({ ...input, claim_id: claimId }),
      headers: headers(token, tenantId),
      method: "POST"
    }
  ).then((response) =>
    read<{ data: TeacherConfirmationTeacherDto; known_limits: readonly string[] }>(response)
  );
}

export function reviseTeacherConfirmation(
  confirmationId: string,
  input: TeacherConfirmationCommandInput,
  token: string,
  tenantId: string
): Promise<TeacherConfirmationDraftReceipt> {
  return fetch(
    `${API_BASE}/api/v1/bff/teacher/confirmations/${encodeURIComponent(confirmationId)}/revise`,
    {
      body: JSON.stringify(input),
      headers: headers(token, tenantId),
      method: "POST"
    }
  ).then((response) => read<TeacherConfirmationDraftReceipt>(response));
}

export function claimTeacherConfirmationWork(
  context: {
    course_id: string;
    run_id: string;
    team_id: string;
    role_key: string;
    round_id?: string;
    round_no?: number;
  },
  evidenceSetDigest: string,
  token: string,
  tenantId: string
): Promise<TeacherConfirmationWorkClaimReceipt> {
  return fetch(`${API_BASE}/api/v1/bff/teacher/confirmations/claims`, {
    body: JSON.stringify({ context, evidence_set_digest: evidenceSetDigest }),
    headers: headers(token, tenantId),
    method: "POST"
  }).then((response) => read<TeacherConfirmationWorkClaimReceipt>(response));
}

export function releaseTeacherConfirmationWork(
  claimId: string,
  token: string,
  tenantId: string
): Promise<{ claim: TeacherConfirmationWorkClaim }> {
  return fetch(
    `${API_BASE}/api/v1/bff/teacher/confirmations/claims/${encodeURIComponent(claimId)}/release`,
    {
      body: "{}",
      headers: headers(token, tenantId),
      method: "POST"
    }
  ).then((response) => read<{ claim: TeacherConfirmationWorkClaim }>(response));
}

export function getTeacherConfirmationWorkClaim(
  claimId: string,
  token: string,
  tenantId: string
): Promise<{ claim: TeacherConfirmationWorkClaim; known_limits: readonly string[] }> {
  return fetch(
    `${API_BASE}/api/v1/bff/teacher/confirmations/claims/${encodeURIComponent(claimId)}`,
    { headers: headers(token, tenantId) }
  ).then((response) =>
    read<{ claim: TeacherConfirmationWorkClaim; known_limits: readonly string[] }>(response)
  );
}
