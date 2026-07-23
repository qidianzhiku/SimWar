export const PARAMETER_SET_AUTHORITY_FAILURE_CODES = [
  "NOT_FOUND",
  "TENANT_SCOPE_VIOLATION",
  "NOT_APPROVED",
  "DIGEST_MISMATCH",
  "RETIRED_FOR_NEW_BINDING"
] as const;

export type ParameterSetAuthorityFailureCode =
  (typeof PARAMETER_SET_AUTHORITY_FAILURE_CODES)[number];

export interface ParameterSetReference {
  content_digest: string;
  parameter_set_id: string;
  version: string;
}

export interface ParameterSetReferenceInput {
  content_digest: string;
  parameter_set_id: string;
  version: string;
}

export interface ParameterSetAuthorityReadPort {
  assertBindable(tenantId: string, reference: ParameterSetReference): Promise<void>;
  getByReference(tenantId: string, reference: ParameterSetReference): Promise<unknown | null>;
}

export class ParameterSetAuthorityError extends Error {
  readonly code: ParameterSetAuthorityFailureCode | "PARAMETER_SET_REFERENCE_INVALID";

  constructor(code: ParameterSetAuthorityFailureCode | "PARAMETER_SET_REFERENCE_INVALID") {
    super(code);
    this.code = code;
    this.name = "ParameterSetAuthorityError";
  }
}

function isNonBlankString(value: string): boolean {
  return value.trim().length > 0;
}

function isExactVersion(value: string): boolean {
  return value !== "latest" && value !== "*" && !value.includes("^") && !value.includes("~");
}

function isDigest(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

export function createParameterSetReference(input: ParameterSetReferenceInput): ParameterSetReference {
  if (
    !isNonBlankString(input.parameter_set_id) ||
    !isExactVersion(input.version) ||
    !isDigest(input.content_digest)
  ) {
    throw new ParameterSetAuthorityError("PARAMETER_SET_REFERENCE_INVALID");
  }

  return Object.freeze({
    content_digest: input.content_digest,
    parameter_set_id: input.parameter_set_id,
    version: input.version
  });
}
