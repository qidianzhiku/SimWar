import { createHash } from "node:crypto";
import {
  createParameterSetReference,
  createScenarioPackageReference,
  type TenantBaselineProvisioningRequest,
  type TenantBaselineProvisioningResult,
  type TenantBaselineProvenance
} from "@simwar/shared-contracts";
import type { JsonFormalScenarioAuthorityRuntime } from "./formal-scenario-authority-runtime.js";
import { ParameterSetAuthorityError, type ParameterSetVersion } from "./parameter-set-authority.js";
import {
  ScenarioPackageAuthorityError,
  type ScenarioPackageVersion
} from "./scenario-package-authority.js";

export interface TenantBaselineProvisioningActor {
  readonly actor_id: string;
  readonly correlation_id: string;
}

export type TenantBaselineProvisioningFailureCode =
  | "CONFLICT"
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

function isNonBlankString(value: string): boolean {
  return value.trim().length > 0;
}

function isCanonicalTenantId(value: string): boolean {
  return isNonBlankString(value) && value === value.trim();
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

function sameParameterReference(
  left: { content_digest: string; parameter_set_id: string; version: string },
  right: { content_digest: string; parameter_set_id: string; version: string }
): boolean {
  return (
    left.content_digest === right.content_digest &&
    left.parameter_set_id === right.parameter_set_id &&
    left.version === right.version
  );
}

function sameScenarioReference(
  left: { content_digest: string; scenario_package_id: string; tenant_id: string; version: string },
  right: { content_digest: string; scenario_package_id: string; tenant_id: string; version: string }
): boolean {
  return (
    left.content_digest === right.content_digest &&
    left.scenario_package_id === right.scenario_package_id &&
    left.tenant_id === right.tenant_id &&
    left.version === right.version
  );
}

function sameProvenance(
  candidate: TenantBaselineProvenance | undefined,
  expected: TenantBaselineProvenance
): boolean {
  const sourceParameter = candidate?.source_parameter_set;
  const sourceScenario = candidate?.source_scenario_package;
  if (
    !candidate ||
    !sourceParameter ||
    !sourceScenario ||
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

function hasExpectedApproval(
  records: readonly { readonly approval_id: string }[],
  approvalId: string
): boolean {
  return records.some((record) => record.approval_id === approvalId);
}

function containsOnlyVersion(
  snapshots: readonly { readonly version: string }[],
  expectedVersion: string
): boolean {
  return snapshots.every((snapshot) => snapshot.version === expectedVersion);
}

function containsOnlyMatchingProvenance(
  snapshots: readonly { readonly baseline_provenance?: TenantBaselineProvenance }[],
  expected: TenantBaselineProvenance
): boolean {
  return snapshots.every((snapshot) => sameProvenance(snapshot.baseline_provenance, expected));
}

async function isApprovedPair(
  parameterSet: ParameterSetVersion | null,
  scenarioPackage: ScenarioPackageVersion | null,
  provenance: TenantBaselineProvenance,
  parameterApprovalId: string,
  scenarioApprovalId: string,
  authority: JsonFormalScenarioAuthorityRuntime
): Promise<boolean> {
  if (
    !parameterSet ||
    !scenarioPackage ||
    parameterSet.status !== "APPROVED" ||
    scenarioPackage.status !== "APPROVED" ||
    !sameProvenance(parameterSet.baseline_provenance, provenance) ||
    !sameProvenance(scenarioPackage.baseline_provenance, provenance) ||
    !sameParameterReference(scenarioPackage.parameter_set_reference, parameterSet.reference)
  ) {
    return false;
  }

  const [parameterApprovals, scenarioApprovals] = await Promise.all([
    authority.parameterSets.listApprovalRecords(parameterSet.tenant_id, parameterSet.reference),
    authority.scenarioPackages.listApprovalRecords(
      scenarioPackage.tenant_id,
      scenarioPackage.reference
    )
  ]);

  return (
    hasExpectedApproval(parameterApprovals, parameterApprovalId) &&
    hasExpectedApproval(scenarioApprovals, scenarioApprovalId)
  );
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
    input: TenantBaselineProvisioningRequest
  ): Promise<TenantBaselineProvisioningResult> {
    const previous = this.activeProvision;
    let release: (() => void) | undefined;
    this.activeProvision = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await this.provisionExclusively(actor, input);
    } finally {
      release?.();
    }
  }

  private async provisionExclusively(
    actor: TenantBaselineProvisioningActor,
    input: TenantBaselineProvisioningRequest
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
    const existingParameter = existingParameterHistory.at(-1) ?? null;
    const existingScenario = existingScenarioHistory.at(-1) ?? null;
    if (existingParameter || existingScenario) {
      // A deterministic target identity must represent one exact source-version
      // materialization. Looking up every version prevents a legacy partial or
      // mismatched version from being hidden by a later retry.
      if (
        !containsOnlyVersion(existingParameterHistory, sourceParameterReference.version) ||
        !containsOnlyVersion(existingScenarioHistory, sourceScenarioReference.version) ||
        !containsOnlyMatchingProvenance(existingParameterHistory, provenance) ||
        !containsOnlyMatchingProvenance(existingScenarioHistory, provenance)
      ) {
        throw new TenantBaselineProvisioningError("CONFLICT");
      }
      if (
        existingParameter &&
        existingScenario &&
        (await isApprovedPair(
          existingParameter,
          existingScenario,
          provenance,
          parameterApprovalId,
          scenarioApprovalId,
          this.authority
        )) &&
        existingScenario !== null
      ) {
        return this.result(actor, "REUSED", existingParameter, existingScenario, provenance);
      }
      throw new TenantBaselineProvisioningError("CONFLICT");
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
      const parameterDraft = await this.authority.parameterSets.createDraft(targetActor, {
        baseline_provenance: provenance,
        compatibility_metadata: structuredClone(sourceParameter.compatibility_metadata),
        model_version_ref: sourceParameter.model_version_ref,
        parameter_set_id: parameterSetId,
        parameter_values: structuredClone(sourceParameter.parameter_values),
        schema_version: sourceParameter.schema_version,
        tenant_id: input.target_tenant_id,
        version: sourceParameter.version
      });
      const parameterValidated = await this.authority.parameterSets.validate(
        targetActor,
        parameterDraft.reference
      );
      const parameterFrozen = await this.authority.parameterSets.freeze(
        targetActor,
        parameterValidated.reference
      );
      const parameterApproved = await this.authority.parameterSets.approve(
        targetActor,
        parameterFrozen.reference,
        parameterApprovalId
      );
      const scenarioDraft = await this.authority.scenarioPackages.createDraft(targetActor, {
        artifact_policy: structuredClone(sourceScenario.artifact_policy),
        baseline_provenance: provenance,
        compatibility_metadata: structuredClone(sourceScenario.compatibility_metadata),
        content: structuredClone(sourceScenario.content),
        metadata: structuredClone(sourceScenario.metadata),
        parameter_set_reference: parameterApproved.version.reference,
        plugin_dependencies: structuredClone(sourceScenario.plugin_dependencies),
        scenario_package_id: scenarioPackageId,
        schema_version: sourceScenario.schema_version,
        tenant_id: input.target_tenant_id,
        version: sourceScenario.version
      });
      const scenarioValidated = await this.authority.scenarioPackages.validate(
        targetActor,
        scenarioDraft.reference
      );
      const scenarioFrozen = await this.authority.scenarioPackages.freeze(
        targetActor,
        scenarioValidated.reference
      );
      const scenarioApproved = await this.authority.scenarioPackages.approve(
        targetActor,
        scenarioFrozen.reference,
        scenarioApprovalId
      );
      return this.result(
        actor,
        "CREATED",
        parameterApproved.version,
        scenarioApproved.version,
        provenance
      );
    } catch (error) {
      this.authority.removeTenantBaselineMaterialization(materialization);
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
