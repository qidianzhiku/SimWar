import type { ParameterSetReference } from "./parameter-set-authority.js";
import type { ScenarioPackageReference } from "./scenario-package-authority.js";

/**
 * Immutable source evidence carried by a tenant-local baseline materialization.
 *
 * This is control-plane provenance only. It is intentionally not an input to
 * simulation, settlement, score, rank, or replay truth calculations.
 */
export interface TenantBaselineProvenance {
  readonly idempotency_key_digest: string;
  readonly provisioning_request_digest: string;
  readonly schema_version: "tenant-baseline-provenance.v1";
  readonly source_parameter_set: {
    readonly reference: ParameterSetReference;
    readonly tenant_id: string;
  };
  readonly source_scenario_package: {
    readonly reference: ScenarioPackageReference;
    readonly tenant_id: string;
  };
}

export interface TenantBaselineParameterSetSource {
  readonly content_digest: string;
  readonly parameter_set_id: string;
  readonly source_tenant_id: string;
  readonly version: string;
}

export interface TenantBaselineScenarioPackageSource {
  readonly content_digest: string;
  readonly scenario_package_id: string;
  readonly source_tenant_id: string;
  /** Optional redundant source tenant; when supplied it must equal source_tenant_id. */
  readonly tenant_id?: string;
  readonly version: string;
}

export interface TenantBaselineProvisioningRequest {
  readonly idempotency_key: string;
  readonly source_parameter_set: TenantBaselineParameterSetSource;
  readonly source_scenario_package: TenantBaselineScenarioPackageSource;
  readonly target_tenant_id: string;
}

export interface TenantBaselineProvisionedAsset<TReference> {
  readonly content_digest: string;
  readonly reference: TReference;
  readonly status: "APPROVED";
  readonly tenant_id: string;
  readonly version: string;
}

export interface TenantBaselineProvisioningResult {
  readonly audit_identity: string;
  readonly outcome: "CREATED" | "REUSED";
  readonly parameter_set: TenantBaselineProvisionedAsset<ParameterSetReference>;
  readonly provenance: TenantBaselineProvenance;
  readonly scenario_package: TenantBaselineProvisionedAsset<ScenarioPackageReference>;
}
