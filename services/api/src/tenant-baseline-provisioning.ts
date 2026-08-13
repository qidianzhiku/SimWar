import { createHash } from "node:crypto";
import {
  createParameterSetReference,
  createScenarioPackageReference,
  isExactVersion,
  type TenantBaselineProvisioningRequest,
  type TenantBaselineProvisioningResult,
  type TenantBaselineProvenance
} from "@simwar/shared-contracts";
import type { JsonFormalScenarioAuthorityRuntime } from "./formal-scenario-authority-runtime.js";
import {
  calculateParameterSetContentDigest,
  ParameterSetAuthorityError,
  type ParameterSetDraftInput,
  type ParameterSetVersion
} from "./parameter-set-authority.js";
import {
  calculateScenarioPackageContentDigest,
  ScenarioPackageAuthorityError,
  type ScenarioPackageDraftInput,
  type ScenarioPackageVersion
} from "./scenario-package-authority.js";

export interface TenantBaselineProvisioningActor {
  readonly actor_id: string;
  readonly correlation_id: string;
}

export type TenantBaselineProvisioningFailureCode =
  | "CONFLICT"
  | "AUDIT_FAILED"
  | "REQUEST_INVALID"
  | "SOURCE_NOT_APPROVED"
  | "SOURCE_NOT_FOUND"
  | "SOURCE_SCOPE_DENIED";

export class TenantBaselineProvisioningError extends Error {
  constructor(readonly code: TenantBaselineProvisioningFailureCode) {
    super(code);
    this.name = "TenantBaselineProvisioningError";
  }
}

export type TenantBaselineProvisioningAfterMaterialization = (
  result: TenantBaselineProvisioningResult
) => Promise<void>;

function digest(value: unknown): string {
  const canonicalize = (candidate: unknown): string => {
    if (candidate === null || typeof candidate === "boolean" || typeof candidate === "number") {
      return JSON.stringify(candidate);
    }
    if (typeof candidate === "string") return JSON.stringify(candidate);
    if (Array.isArray(candidate)) return `[${candidate.map(canonicalize).join(",")}]`;
    if (candidate && typeof candidate === "object") {
      const object = candidate as Record<string, unknown>;
      return `{${Object.keys(object)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`)
        .join(",")}}`;
    }
    throw new TenantBaselineProvisioningError("REQUEST_INVALID");
  };
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSha256Digest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isCanonicalTenantId(value: unknown): value is string {
  return isNonBlankString(value) && value === value.trim();
}

function isParameterVersion(value: unknown): value is string {
  return (
    isNonBlankString(value) &&
    value !== "latest" &&
    value !== "*" &&
    !value.includes("^") &&
    !value.includes("~")
  );
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isStrictParameterApprovalRecord(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "approval_id",
      "approved_by",
      "correlation_id",
      "parameter_set_reference",
      "tenant_id"
    ]) &&
    isNonBlankString(value.approval_id) &&
    isNonBlankString(value.approved_by) &&
    isNonBlankString(value.correlation_id) &&
    isCanonicalTenantId(value.tenant_id) &&
    isRecord(value.parameter_set_reference) &&
    hasExactKeys(value.parameter_set_reference, [
      "content_digest",
      "parameter_set_id",
      "version"
    ]) &&
    isSha256Digest(value.parameter_set_reference.content_digest) &&
    isNonBlankString(value.parameter_set_reference.parameter_set_id) &&
    isParameterVersion(value.parameter_set_reference.version)
  );
}

function isStrictScenarioApprovalRecord(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "approval_id",
      "approved_by",
      "correlation_id",
      "scenario_package_reference",
      "tenant_id"
    ]) &&
    isNonBlankString(value.approval_id) &&
    isNonBlankString(value.approved_by) &&
    isNonBlankString(value.correlation_id) &&
    isCanonicalTenantId(value.tenant_id) &&
    isRecord(value.scenario_package_reference) &&
    hasExactKeys(value.scenario_package_reference, [
      "content_digest",
      "scenario_package_id",
      "tenant_id",
      "version"
    ]) &&
    isSha256Digest(value.scenario_package_reference.content_digest) &&
    isNonBlankString(value.scenario_package_reference.scenario_package_id) &&
    isCanonicalTenantId(value.scenario_package_reference.tenant_id) &&
    typeof value.scenario_package_reference.version === "string" &&
    isExactVersion(value.scenario_package_reference.version)
  );
}

function exactParameterReference(input: TenantBaselineProvisioningRequest) {
  try {
    return createParameterSetReference({
      content_digest: input.source_parameter_set.content_digest,
      parameter_set_id: input.source_parameter_set.parameter_set_id,
      version: input.source_parameter_set.version
    });
  } catch {
    throw new TenantBaselineProvisioningError("REQUEST_INVALID");
  }
}

function exactScenarioReference(input: TenantBaselineProvisioningRequest) {
  try {
    return createScenarioPackageReference({
      content_digest: input.source_scenario_package.content_digest,
      scenario_package_id: input.source_scenario_package.scenario_package_id,
      tenant_id: input.source_scenario_package.source_tenant_id,
      version: input.source_scenario_package.version
    });
  } catch {
    throw new TenantBaselineProvisioningError("REQUEST_INVALID");
  }
}

function isMaterializationConflict(error: unknown): boolean {
  return (
    (error instanceof ParameterSetAuthorityError &&
      error.code === "PARAMETER_SET_VERSION_ALREADY_EXISTS") ||
    (error instanceof ScenarioPackageAuthorityError &&
      (error.code === "SCENARIO_PACKAGE_VERSION_ALREADY_EXISTS" ||
        error.code === "SCENARIO_PACKAGE_DIGEST_CONFLICT"))
  );
}

function sameParameterReference(left: unknown, right: unknown): boolean {
  if (!isRecord(left) || !isRecord(right)) {
    return false;
  }

  if (
    !hasExactKeys(left, ["content_digest", "parameter_set_id", "version"]) ||
    !hasExactKeys(right, ["content_digest", "parameter_set_id", "version"])
  ) {
    return false;
  }

  return (
    left.content_digest === right.content_digest &&
    left.parameter_set_id === right.parameter_set_id &&
    left.version === right.version
  );
}

function sameScenarioReference(left: unknown, right: unknown): boolean {
  if (!isRecord(left) || !isRecord(right)) {
    return false;
  }

  if (
    !hasExactKeys(left, ["content_digest", "scenario_package_id", "tenant_id", "version"]) ||
    !hasExactKeys(right, ["content_digest", "scenario_package_id", "tenant_id", "version"])
  ) {
    return false;
  }

  return (
    left.content_digest === right.content_digest &&
    left.scenario_package_id === right.scenario_package_id &&
    left.tenant_id === right.tenant_id &&
    left.version === right.version
  );
}

function sameProvenance(candidate: unknown, expected: TenantBaselineProvenance): boolean {
  if (!isRecord(candidate)) {
    return false;
  }

  if (
    !hasExactKeys(candidate, [
      "idempotency_key_digest",
      "provisioning_request_digest",
      "schema_version",
      "source_parameter_set",
      "source_scenario_package"
    ])
  ) {
    return false;
  }

  const sourceParameter = candidate.source_parameter_set;
  const sourceScenario = candidate.source_scenario_package;
  if (
    !isRecord(sourceParameter) ||
    !isRecord(sourceScenario) ||
    !hasExactKeys(sourceParameter, ["reference", "tenant_id"]) ||
    !hasExactKeys(sourceScenario, ["reference", "tenant_id"]) ||
    !sourceParameter.reference ||
    !sourceScenario.reference
  ) {
    return false;
  }

  return (
    candidate.idempotency_key_digest === expected.idempotency_key_digest &&
    candidate.provisioning_request_digest === expected.provisioning_request_digest &&
    candidate.schema_version === expected.schema_version &&
    sourceParameter.tenant_id === expected.source_parameter_set.tenant_id &&
    sourceScenario.tenant_id === expected.source_scenario_package.tenant_id &&
    sameParameterReference(sourceParameter.reference, expected.source_parameter_set.reference) &&
    sameScenarioReference(sourceScenario.reference, expected.source_scenario_package.reference)
  );
}

function isSelfConsistentParameterVersion(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  if (
    hasExactKeys(value, [
      "baseline_provenance",
      "compatibility_metadata",
      "content_digest",
      "model_version_ref",
      "parameter_set_id",
      "parameter_values",
      "reference",
      "schema_version",
      "status",
      "tenant_id",
      "version"
    ]) &&
    isNonBlankString(value.parameter_set_id) &&
    isParameterVersion(value.version) &&
    isSha256Digest(value.content_digest) &&
    sameParameterReference(value.reference, {
      content_digest: value.content_digest,
      parameter_set_id: value.parameter_set_id,
      version: value.version
    })
  ) {
    try {
      return (
        calculateParameterSetContentDigest(value as unknown as ParameterSetDraftInput) ===
        value.content_digest
      );
    } catch {
      return false;
    }
  }

  return false;
}

function isSelfConsistentScenarioVersion(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  if (
    hasExactKeys(value, [
      "artifact_policy",
      "baseline_provenance",
      "compatibility_metadata",
      "content",
      "content_digest",
      "metadata",
      "parameter_set_reference",
      "plugin_dependencies",
      "reference",
      "scenario_package_id",
      "schema_version",
      "status",
      "tenant_id",
      "version"
    ]) &&
    isNonBlankString(value.scenario_package_id) &&
    isCanonicalTenantId(value.tenant_id) &&
    typeof value.version === "string" &&
    isExactVersion(value.version) &&
    isSha256Digest(value.content_digest) &&
    sameScenarioReference(value.reference, {
      content_digest: value.content_digest,
      scenario_package_id: value.scenario_package_id,
      tenant_id: value.tenant_id,
      version: value.version
    })
  ) {
    try {
      return (
        calculateScenarioPackageContentDigest(value as unknown as ScenarioPackageDraftInput) ===
        value.content_digest
      );
    } catch {
      return false;
    }
  }

  return false;
}

function hasValidParameterLifecyclePrefix(
  snapshots: readonly unknown[],
  tenantId: string,
  parameterSetId: string,
  version: string,
  provenance: TenantBaselineProvenance
): boolean {
  if (snapshots.length > 4) {
    return false;
  }
  if (snapshots.length === 0) return true;

  const first = snapshots[0];
  if (!isRecord(first) || !isSelfConsistentParameterVersion(first)) {
    return false;
  }

  const expectedReference = {
    content_digest: first.content_digest,
    parameter_set_id: parameterSetId,
    version
  };
  const expectedStatuses = ["DRAFT", "VALIDATED", "FROZEN", "APPROVED"] as const;

  return snapshots.every((snapshot, index) => {
    if (
      !isRecord(snapshot) ||
      !isSelfConsistentParameterVersion(snapshot) ||
      snapshot.status !== expectedStatuses[index] ||
      snapshot.tenant_id !== tenantId ||
      snapshot.parameter_set_id !== parameterSetId ||
      snapshot.version !== version ||
      snapshot.content_digest !== expectedReference.content_digest ||
      !sameParameterReference(snapshot.reference, expectedReference)
    ) {
      return false;
    }

    return sameProvenance(snapshot.baseline_provenance, provenance);
  });
}

function hasValidScenarioLifecyclePrefix(
  snapshots: readonly unknown[],
  tenantId: string,
  scenarioPackageId: string,
  version: string,
  parameterReference: unknown,
  provenance: TenantBaselineProvenance
): boolean {
  if (snapshots.length > 4) {
    return false;
  }
  if (snapshots.length === 0) return true;

  const first = snapshots[0];
  if (!isRecord(first) || !isSelfConsistentScenarioVersion(first)) {
    return false;
  }

  const expectedReference = {
    content_digest: first.content_digest,
    scenario_package_id: scenarioPackageId,
    tenant_id: tenantId,
    version
  };
  const expectedStatuses = ["DRAFT", "VALIDATED", "FROZEN", "APPROVED"] as const;

  return snapshots.every((snapshot, index) => {
    if (
      !isRecord(snapshot) ||
      !isSelfConsistentScenarioVersion(snapshot) ||
      snapshot.status !== expectedStatuses[index] ||
      snapshot.tenant_id !== tenantId ||
      snapshot.scenario_package_id !== scenarioPackageId ||
      snapshot.version !== version ||
      snapshot.content_digest !== expectedReference.content_digest ||
      !sameScenarioReference(snapshot.reference, expectedReference) ||
      !sameParameterReference(snapshot.parameter_set_reference, parameterReference)
    ) {
      return false;
    }

    return sameProvenance(snapshot.baseline_provenance, provenance);
  });
}

function hasExpectedParameterApproval(
  records: readonly unknown[],
  approvalId: string,
  tenantId: string,
  reference: unknown
): boolean {
  if (records.some((record) => !isStrictParameterApprovalRecord(record))) {
    return false;
  }

  const approvalIdMatches = records.filter(
    (record) =>
      isRecord(record) && record.tenant_id === tenantId && record.approval_id === approvalId
  );
  if (approvalIdMatches.length !== 1) {
    return false;
  }

  const relevant = records.filter((record) => {
    if (!isRecord(record) || record.tenant_id !== tenantId) {
      return false;
    }

    const candidateReference = record.parameter_set_reference;
    return (
      isRecord(candidateReference) &&
      candidateReference.parameter_set_id ===
        (isRecord(reference) ? reference.parameter_set_id : undefined) &&
      candidateReference.version === (isRecord(reference) ? reference.version : undefined)
    );
  });

  return (
    relevant.length === 1 &&
    isRecord(relevant[0]) &&
    relevant[0].approval_id === approvalId &&
    sameParameterReference(relevant[0].parameter_set_reference, reference)
  );
}

function hasExpectedScenarioApproval(
  records: readonly unknown[],
  approvalId: string,
  tenantId: string,
  reference: unknown
): boolean {
  if (records.some((record) => !isStrictScenarioApprovalRecord(record))) {
    return false;
  }

  const approvalIdMatches = records.filter(
    (record) =>
      isRecord(record) && record.tenant_id === tenantId && record.approval_id === approvalId
  );
  if (approvalIdMatches.length !== 1) {
    return false;
  }

  const relevant = records.filter((record) => {
    if (!isRecord(record) || record.tenant_id !== tenantId) {
      return false;
    }

    const candidateReference = record.scenario_package_reference;
    return (
      isRecord(candidateReference) &&
      candidateReference.scenario_package_id ===
        (isRecord(reference) ? reference.scenario_package_id : undefined) &&
      candidateReference.version === (isRecord(reference) ? reference.version : undefined)
    );
  });

  return (
    relevant.length === 1 &&
    isRecord(relevant[0]) &&
    relevant[0].approval_id === approvalId &&
    sameScenarioReference(relevant[0].scenario_package_reference, reference)
  );
}

function hasMalformedApprovalEvidence(
  records: readonly unknown[],
  validate: (record: unknown) => boolean
): boolean {
  return records.some((record) => !validate(record));
}

function hasApprovalId(records: readonly unknown[], approvalId: string, tenantId: string): boolean {
  return records.some(
    (record) =>
      isRecord(record) && record.tenant_id === tenantId && record.approval_id === approvalId
  );
}

async function isApprovedPair(
  parameterSet: ParameterSetVersion,
  scenarioPackage: ScenarioPackageVersion,
  provenance: TenantBaselineProvenance,
  targetTenantId: string,
  parameterApprovalId: string,
  scenarioApprovalId: string,
  authority: JsonFormalScenarioAuthorityRuntime
): Promise<boolean> {
  if (
    !isRecord(parameterSet) ||
    !isRecord(scenarioPackage) ||
    parameterSet.status !== "APPROVED" ||
    scenarioPackage.status !== "APPROVED" ||
    parameterSet.tenant_id !== targetTenantId ||
    scenarioPackage.tenant_id !== targetTenantId ||
    !isSelfConsistentParameterVersion(parameterSet) ||
    !isSelfConsistentScenarioVersion(scenarioPackage) ||
    !sameProvenance(parameterSet.baseline_provenance, provenance) ||
    !sameProvenance(scenarioPackage.baseline_provenance, provenance) ||
    !sameParameterReference(scenarioPackage.parameter_set_reference, parameterSet.reference)
  ) {
    return false;
  }

  try {
    const [parameterApprovals, scenarioApprovals] = await Promise.all([
      authority.parameterSets.listApprovalRecordsForTenant(parameterSet.tenant_id),
      authority.scenarioPackages.listApprovalRecordsForTenant(scenarioPackage.tenant_id)
    ]);

    return (
      hasExpectedParameterApproval(
        parameterApprovals,
        parameterApprovalId,
        targetTenantId,
        parameterSet.reference
      ) &&
      hasExpectedScenarioApproval(
        scenarioApprovals,
        scenarioApprovalId,
        targetTenantId,
        scenarioPackage.reference
      )
    );
  } catch {
    return false;
  }
}

/**
 * A bounded control-plane orchestrator. It delegates all normal writes to the
 * current formal command services and only invokes the JSON persistence seam's
 * private exact-identity cleanup to compensate a failed two-registry materialization.
 */
export class TenantBaselineProvisioningService {
  private activeProvision: Promise<void> = Promise.resolve();

  constructor(private readonly authority: JsonFormalScenarioAuthorityRuntime) {}

  async provision(
    actor: TenantBaselineProvisioningActor,
    input: TenantBaselineProvisioningRequest,
    afterMaterialization?: TenantBaselineProvisioningAfterMaterialization
  ): Promise<TenantBaselineProvisioningResult> {
    const previous = this.activeProvision;
    let release: (() => void) | undefined;
    this.activeProvision = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await this.provisionExclusively(actor, input, afterMaterialization);
    } finally {
      release?.();
    }
  }

  private async provisionExclusively(
    actor: TenantBaselineProvisioningActor,
    input: TenantBaselineProvisioningRequest,
    afterMaterialization?: TenantBaselineProvisioningAfterMaterialization
  ): Promise<TenantBaselineProvisioningResult> {
    if (
      !isNonBlankString(actor.actor_id) ||
      !isNonBlankString(actor.correlation_id) ||
      !isNonBlankString(input.idempotency_key) ||
      !isCanonicalTenantId(input.target_tenant_id) ||
      !isCanonicalTenantId(input.source_parameter_set.source_tenant_id) ||
      !isCanonicalTenantId(input.source_scenario_package.source_tenant_id) ||
      (input.source_scenario_package.tenant_id !== undefined &&
        (!isCanonicalTenantId(input.source_scenario_package.tenant_id) ||
          input.source_scenario_package.tenant_id !==
            input.source_scenario_package.source_tenant_id))
    ) {
      throw new TenantBaselineProvisioningError("REQUEST_INVALID");
    }

    const sourceParameterReference = exactParameterReference(input);
    const sourceScenarioReference = exactScenarioReference(input);
    if (
      input.source_parameter_set.source_tenant_id !== input.source_scenario_package.source_tenant_id
    ) {
      throw new TenantBaselineProvisioningError("SOURCE_SCOPE_DENIED");
    }

    const idempotencyKeyDigest = digest(input.idempotency_key);
    const provenanceSchemaVersion = "tenant-baseline-provenance.v1" as const;
    const requestDigest = digest({
      idempotency_key_digest: idempotencyKeyDigest,
      provenance_schema_version: provenanceSchemaVersion,
      source_parameter_set: {
        reference: sourceParameterReference,
        tenant_id: input.source_parameter_set.source_tenant_id
      },
      source_scenario_package: {
        reference: sourceScenarioReference,
        tenant_id: input.source_scenario_package.source_tenant_id
      },
      target_tenant_id: input.target_tenant_id
    });
    const provenance: TenantBaselineProvenance = Object.freeze({
      idempotency_key_digest: idempotencyKeyDigest,
      provisioning_request_digest: requestDigest,
      schema_version: provenanceSchemaVersion,
      source_parameter_set: Object.freeze({
        reference: sourceParameterReference,
        tenant_id: input.source_parameter_set.source_tenant_id
      }),
      source_scenario_package: Object.freeze({
        reference: sourceScenarioReference,
        tenant_id: input.source_scenario_package.source_tenant_id
      })
    });
    const identityDigest = digest({
      idempotency_key_digest: idempotencyKeyDigest,
      target_tenant_id: input.target_tenant_id
    });
    const parameterSetId = `tenant_baseline_parameter_${identityDigest.slice(0, 16)}`;
    const scenarioPackageId = `tenant_baseline_scenario_${identityDigest.slice(0, 16)}`;
    const parameterApprovalId = `tenant_baseline_parameter_approval_${identityDigest.slice(0, 16)}`;
    const scenarioApprovalId = `tenant_baseline_scenario_approval_${identityDigest.slice(0, 16)}`;

    const existingParameterHistory = await this.authority.parameterSets.listLifecycleSnapshots(
      input.target_tenant_id,
      parameterSetId
    );
    const existingScenarioHistory = await this.authority.scenarioPackages.listLifecycleSnapshots(
      input.target_tenant_id,
      scenarioPackageId
    );
    const [targetParameterApprovalEvidence, targetScenarioApprovalEvidence] = await Promise.all([
      this.authority.parameterSets.listApprovalRecordsForTenant(input.target_tenant_id),
      this.authority.scenarioPackages.listApprovalRecordsForTenant(input.target_tenant_id)
    ]);
    if (
      hasMalformedApprovalEvidence(
        targetParameterApprovalEvidence,
        isStrictParameterApprovalRecord
      ) ||
      hasMalformedApprovalEvidence(targetScenarioApprovalEvidence, isStrictScenarioApprovalRecord)
    ) {
      throw new TenantBaselineProvisioningError("CONFLICT");
    }
    if (
      (hasApprovalId(
        targetParameterApprovalEvidence,
        parameterApprovalId,
        input.target_tenant_id
      ) &&
        existingParameterHistory.length !== 4) ||
      (hasApprovalId(targetScenarioApprovalEvidence, scenarioApprovalId, input.target_tenant_id) &&
        existingScenarioHistory.length !== 4)
    ) {
      throw new TenantBaselineProvisioningError("CONFLICT");
    }
    const existingParameter = existingParameterHistory.at(-1) ?? null;
    const existingScenario = existingScenarioHistory.at(-1) ?? null;
    if (existingParameterHistory.length > 0 || existingScenarioHistory.length > 0) {
      // A restart may continue a valid lifecycle prefix, but malformed, skipped,
      // reordered, or source-digest-mismatched history remains fail-closed.
      if (
        !hasValidParameterLifecyclePrefix(
          existingParameterHistory,
          input.target_tenant_id,
          parameterSetId,
          sourceParameterReference.version,
          provenance
        ) ||
        !hasValidScenarioLifecyclePrefix(
          existingScenarioHistory,
          input.target_tenant_id,
          scenarioPackageId,
          sourceScenarioReference.version,
          existingParameterHistory[0]?.reference,
          provenance
        )
      ) {
        throw new TenantBaselineProvisioningError("CONFLICT");
      }
      if (
        existingParameter &&
        existingScenario &&
        existingParameterHistory.length === 4 &&
        existingScenarioHistory.length === 4 &&
        (await isApprovedPair(
          existingParameter,
          existingScenario,
          provenance,
          input.target_tenant_id,
          parameterApprovalId,
          scenarioApprovalId,
          this.authority
        ))
      ) {
        const reused = this.result(
          actor,
          "REUSED",
          existingParameter,
          existingScenario,
          provenance
        );
        if (afterMaterialization) {
          try {
            await afterMaterialization(reused);
          } catch {
            // A reused materialization is already complete. Its audit failure
            // must be surfaced without deleting the immutable target history.
            throw new TenantBaselineProvisioningError("AUDIT_FAILED");
          }
        }
        return reused;
      }
      if (
        hasApprovalId(
          targetParameterApprovalEvidence,
          parameterApprovalId,
          input.target_tenant_id
        ) ||
        hasApprovalId(targetScenarioApprovalEvidence, scenarioApprovalId, input.target_tenant_id)
      ) {
        throw new TenantBaselineProvisioningError("CONFLICT");
      }
      if (existingParameterHistory.length === 4 && existingScenarioHistory.length === 4) {
        throw new TenantBaselineProvisioningError("CONFLICT");
      }
    }

    const sourceParameter = await this.authority.parameterSets.getByReference(
      input.source_parameter_set.source_tenant_id,
      sourceParameterReference
    );
    const sourceScenario = await this.authority.scenarioPackages.getByReference(
      input.source_scenario_package.source_tenant_id,
      sourceScenarioReference
    );
    if (!sourceParameter || !sourceScenario) {
      throw new TenantBaselineProvisioningError("SOURCE_NOT_FOUND");
    }
    if (sourceParameter.status !== "APPROVED" || sourceScenario.status !== "APPROVED") {
      throw new TenantBaselineProvisioningError("SOURCE_NOT_APPROVED");
    }
    if (!sameParameterReference(sourceScenario.parameter_set_reference, sourceParameterReference)) {
      throw new TenantBaselineProvisioningError("SOURCE_SCOPE_DENIED");
    }

    const materialization = {
      idempotencyKeyDigest,
      parameterSet: {
        approvalId: parameterApprovalId,
        parameterSetId
      },
      provisioningRequestDigest: requestDigest,
      scenarioPackage: {
        approvalId: scenarioApprovalId,
        scenarioPackageId
      },
      tenantId: input.target_tenant_id
    };
    try {
      const targetActor = {
        actor_id: actor.actor_id,
        capabilities: ["parameter_set:manage", "scenario_package:manage"],
        correlation_id: actor.correlation_id,
        tenant_id: input.target_tenant_id
      };
      let parameterApproved: ParameterSetVersion;
      let parameterCurrent = existingParameterHistory.at(-1) ?? null;
      if (!parameterCurrent) {
        parameterCurrent = await this.authority.parameterSets.createDraft(targetActor, {
          baseline_provenance: provenance,
          compatibility_metadata: structuredClone(sourceParameter.compatibility_metadata),
          model_version_ref: sourceParameter.model_version_ref,
          parameter_set_id: parameterSetId,
          parameter_values: structuredClone(sourceParameter.parameter_values),
          schema_version: sourceParameter.schema_version,
          tenant_id: input.target_tenant_id,
          version: sourceParameter.version
        });
      }
      if (parameterCurrent.status === "DRAFT") {
        parameterCurrent = await this.authority.parameterSets.validate(
          targetActor,
          parameterCurrent.reference
        );
      }
      if (parameterCurrent.status === "VALIDATED") {
        parameterCurrent = await this.authority.parameterSets.freeze(
          targetActor,
          parameterCurrent.reference
        );
      }
      if (parameterCurrent.status === "FROZEN") {
        parameterApproved = (
          await this.authority.parameterSets.approve(
            targetActor,
            parameterCurrent.reference,
            parameterApprovalId
          )
        ).version;
      } else if (parameterCurrent.status === "APPROVED") {
        parameterApproved = parameterCurrent;
      } else {
        throw new TenantBaselineProvisioningError("CONFLICT");
      }

      let scenarioApproved: ScenarioPackageVersion;
      let scenarioCurrent = existingScenarioHistory.at(-1) ?? null;
      if (!scenarioCurrent) {
        scenarioCurrent = await this.authority.scenarioPackages.createDraft(targetActor, {
          artifact_policy: structuredClone(sourceScenario.artifact_policy),
          baseline_provenance: provenance,
          compatibility_metadata: {
            ...structuredClone(sourceScenario.compatibility_metadata),
            parameter_set_id: parameterApproved.reference.parameter_set_id,
            parameter_set_version: parameterApproved.reference.version,
            ...(sourceScenario.plugin_dependencies[0]
              ? {
                  plugin_package_id: sourceScenario.plugin_dependencies[0].plugin_package_id,
                  plugin_version: sourceScenario.plugin_dependencies[0].version
                }
              : {}),
            scenario_package_id: scenarioPackageId,
            scenario_package_version: sourceScenario.version
          },
          content: structuredClone(sourceScenario.content),
          metadata: structuredClone(sourceScenario.metadata),
          parameter_set_reference: parameterApproved.reference,
          plugin_dependencies: structuredClone(sourceScenario.plugin_dependencies),
          scenario_package_id: scenarioPackageId,
          schema_version: sourceScenario.schema_version,
          tenant_id: input.target_tenant_id,
          version: sourceScenario.version
        });
      }
      if (scenarioCurrent.status === "DRAFT") {
        scenarioCurrent = await this.authority.scenarioPackages.validate(
          targetActor,
          scenarioCurrent.reference
        );
      }
      if (scenarioCurrent.status === "VALIDATED") {
        scenarioCurrent = await this.authority.scenarioPackages.freeze(
          targetActor,
          scenarioCurrent.reference
        );
      }
      if (scenarioCurrent.status === "FROZEN") {
        scenarioApproved = (
          await this.authority.scenarioPackages.approve(
            targetActor,
            scenarioCurrent.reference,
            scenarioApprovalId
          )
        ).version;
      } else if (scenarioCurrent.status === "APPROVED") {
        scenarioApproved = scenarioCurrent;
      } else {
        throw new TenantBaselineProvisioningError("CONFLICT");
      }
      const created = this.result(
        actor,
        "CREATED",
        parameterApproved,
        scenarioApproved,
        provenance
      );
      if (afterMaterialization) {
        try {
          await afterMaterialization(created);
        } catch {
          throw new TenantBaselineProvisioningError("AUDIT_FAILED");
        }
      }
      return created;
    } catch (error) {
      await this.authority.removeTenantBaselineMaterialization(materialization);
      if (error instanceof TenantBaselineProvisioningError && error.code === "AUDIT_FAILED") {
        throw error;
      }
      if (isMaterializationConflict(error)) {
        throw new TenantBaselineProvisioningError("CONFLICT");
      }
      throw error;
    }
  }

  private result(
    actor: TenantBaselineProvisioningActor,
    outcome: "CREATED" | "REUSED",
    parameterSet: ParameterSetVersion,
    scenarioPackage: ScenarioPackageVersion,
    provenance: TenantBaselineProvenance
  ): TenantBaselineProvisioningResult {
    return Object.freeze({
      audit_identity: `tenant-baseline:${actor.correlation_id}`,
      outcome,
      parameter_set: Object.freeze({
        content_digest: parameterSet.content_digest,
        reference: parameterSet.reference,
        status: "APPROVED" as const,
        tenant_id: parameterSet.tenant_id,
        version: parameterSet.version
      }),
      provenance,
      scenario_package: Object.freeze({
        content_digest: scenarioPackage.content_digest,
        reference: scenarioPackage.reference,
        status: "APPROVED" as const,
        tenant_id: scenarioPackage.tenant_id,
        version: scenarioPackage.version
      })
    });
  }
}
