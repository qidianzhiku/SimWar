import {
  HistoricalScenarioArtifactError,
  createHistoricalScenarioArtifactReference,
  type HistoricalScenarioArtifactReference
} from "@simwar/shared-contracts";
import {
  HISTORICAL_R7_V1_ARTIFACTS,
  type HistoricalScenarioArtifact
} from "./historical-scenario-artifacts.js";

function sameIdentityWithoutTenant(
  artifact: HistoricalScenarioArtifact,
  reference: HistoricalScenarioArtifactReference
): boolean {
  return (
    artifact.reference.scenario_package_id === reference.scenario_package_id &&
    artifact.reference.version === reference.version
  );
}

export function resolveHistoricalScenarioArtifactForRun(
  tenantId: string,
  input: HistoricalScenarioArtifactReference
): HistoricalScenarioArtifact {
  const reference = createHistoricalScenarioArtifactReference(input);
  const sameIdentity = HISTORICAL_R7_V1_ARTIFACTS.filter((artifact) =>
    sameIdentityWithoutTenant(artifact, reference)
  );
  if (sameIdentity.length === 0) {
    throw new HistoricalScenarioArtifactError("NOT_FOUND");
  }

  const sameTenant = sameIdentity.filter(
    (artifact) => artifact.reference.tenant_id === tenantId && reference.tenant_id === tenantId
  );
  if (sameTenant.length === 0) {
    throw new HistoricalScenarioArtifactError("TENANT_SCOPE_VIOLATION");
  }

  const sameContent = sameTenant.filter(
    (artifact) => artifact.reference.content_digest === reference.content_digest
  );
  if (sameContent.length === 0) {
    throw new HistoricalScenarioArtifactError("CONTENT_DIGEST_MISMATCH");
  }

  const exact = sameContent.find(
    (artifact) => artifact.reference.artifact_digest === reference.artifact_digest
  );
  if (!exact) {
    throw new HistoricalScenarioArtifactError("ARTIFACT_DIGEST_MISMATCH");
  }

  return exact;
}

export function assertHistoricalScenarioArtifactNotBindable(
  reference: HistoricalScenarioArtifactReference
): never {
  resolveHistoricalScenarioArtifactForRun(reference.tenant_id, reference);
  throw new HistoricalScenarioArtifactError("RETIRED_FOR_NEW_BINDING");
}

export function projectHistoricalScenarioArtifactForStudent(
  reference: HistoricalScenarioArtifactReference
): Readonly<{
  historical_resolution: "READ_ONLY";
  lifecycle_status: "RETIRED";
  scenario_package_id: string;
  version: string;
}> {
  const artifact = resolveHistoricalScenarioArtifactForRun(reference.tenant_id, reference);

  return Object.freeze({
    historical_resolution: "READ_ONLY" as const,
    lifecycle_status: artifact.lifecycle_status,
    scenario_package_id: artifact.reference.scenario_package_id,
    version: artifact.reference.version
  });
}
