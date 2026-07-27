export const HISTORICAL_SCENARIO_ARTIFACT_FAILURE_CODES = [
  "NOT_FOUND",
  "TENANT_SCOPE_VIOLATION",
  "CONTENT_DIGEST_MISMATCH",
  "ARTIFACT_DIGEST_MISMATCH",
  "RETIRED_FOR_NEW_BINDING"
] as const;

export type HistoricalScenarioArtifactFailureCode =
  (typeof HISTORICAL_SCENARIO_ARTIFACT_FAILURE_CODES)[number];

export interface HistoricalScenarioArtifactReference {
  artifact_digest: string;
  content_digest: string;
  scenario_package_id: string;
  tenant_id: string;
  version: string;
}

export class HistoricalScenarioArtifactError extends Error {
  readonly code: HistoricalScenarioArtifactFailureCode | "HISTORICAL_REFERENCE_INVALID";

  constructor(code: HistoricalScenarioArtifactFailureCode | "HISTORICAL_REFERENCE_INVALID") {
    super(code);
    this.code = code;
    this.name = "HistoricalScenarioArtifactError";
  }
}

function isExactDigest(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function isExactLegacyVersion(value: string): boolean {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
    return false;
  }

  const normalized = value.toLowerCase();
  return !["latest", "next"].includes(normalized) && !/^\d+(?:\.(?:x|\*))+$/i.test(value);
}

function isNonBlank(value: string): boolean {
  return value.trim() === value && value.length > 0;
}

export function createHistoricalScenarioArtifactReference(
  input: HistoricalScenarioArtifactReference
): HistoricalScenarioArtifactReference {
  if (
    !isNonBlank(input.tenant_id) ||
    !isNonBlank(input.scenario_package_id) ||
    !isExactLegacyVersion(input.version) ||
    !isExactDigest(input.content_digest) ||
    !isExactDigest(input.artifact_digest)
  ) {
    throw new HistoricalScenarioArtifactError("HISTORICAL_REFERENCE_INVALID");
  }

  return Object.freeze({
    artifact_digest: input.artifact_digest,
    content_digest: input.content_digest,
    scenario_package_id: input.scenario_package_id,
    tenant_id: input.tenant_id,
    version: input.version
  });
}
