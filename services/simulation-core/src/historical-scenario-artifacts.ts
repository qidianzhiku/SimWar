import { createHash } from "node:crypto";
import {
  createHistoricalScenarioArtifactReference,
  type HistoricalScenarioArtifactReference,
  type ParameterSet,
  type ScenarioPackage
} from "@simwar/shared-contracts";

export const HISTORICAL_R7_V1_SOURCE_REVISION = "0760055145f9626b3751c2e3b9b45d5b5b2a24ec" as const;

export type HistoricalScenarioArtifactKind = "R7A_CORE" | "R7B_LIFECYCLE" | "R7C_FAMILY_VARIANT";

export interface HistoricalScenarioRuntimePayload {
  artifact_kind: HistoricalScenarioArtifactKind;
  asset: {
    asset_hash: string;
    asset_id: string;
    parameter_set: ParameterSet;
    scenario_package: ScenarioPackage;
    source_r7a_asset_hash?: string;
  };
  golden_settlement_digest?: string;
  scenario_family?: {
    family_id: string;
    template_version: string;
    variant_id: string;
  };
  synthetic_data_classification: readonly string[];
}

export interface HistoricalScenarioArtifact {
  artifact_digest: string;
  artifact_id: string;
  artifact_media_type: "application/vnd.simwar.historical-scenario-artifact+json";
  content_digest: string;
  lifecycle_status: "RETIRED";
  payload: HistoricalScenarioRuntimePayload;
  reference: HistoricalScenarioArtifactReference;
  retention: "IMMUTABLE";
  schema_version: "simwar.historical-scenario-artifact.v1";
  source_revision: typeof HISTORICAL_R7_V1_SOURCE_REVISION;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

const R7A_PARAMETER_SET: ParameterSet = {
  base_capacity: 138,
  base_market_size: 210,
  fixed_cost: 260000,
  model_family: "toy_logit",
  parameter_set_id: "parameter_r7a_eldercare_v1",
  parameters: {
    cost_structure: {
      partnership_discount_rate: 0.015,
      partnership_discount_threshold: 150000
    },
    demand_curve: {
      max_quality_lift: 9,
      price_friction_scale: 3500,
      price_sensitivity: 1,
      quality_budget_per_utility: 40000,
      quality_lift_weight: 1,
      reference_price: 15000
    },
    operations_constraints: {
      max_capacity_modifier: 1.2,
      min_service_quality_budget: 60000
    },
    schema_version: "wellness.parameters.v1",
    scoring_weights: {
      max_service_quality_bonus: 3,
      service_quality_bonus_per_budget: 0.00001,
      underfunded_service_penalty: 3
    }
  },
  seed: 70707,
  status: "candidate",
  tenant_id: "tenant_r7a_synthetic",
  unit_cost: 6200,
  version: "r7a.eldercare.parameters.v1"
};

const R7B_PARAMETER_SET: ParameterSet = {
  ...R7A_PARAMETER_SET,
  parameter_set_id: "parameter_r7b_eldercare_lifecycle_v1",
  seed: 7070714,
  tenant_id: "tenant_r7b_synthetic",
  version: "r7b.eldercare.parameters.v1"
};

const R7A_SCENARIO_PACKAGE: ScenarioPackage = {
  name: "R7-A Beijing-Yanjiao Eldercare Core Scenario Asset",
  plugin_package_ids: ["plugin_wellness_eldercare_v1"],
  scenario_package_id: "scenario_r7a_beijing_yanjiao_eldercare_v1",
  status: "approved",
  tenant_id: "tenant_r7a_synthetic",
  version: "1.0.0"
};

const R7B_SCENARIO_PACKAGE: ScenarioPackage = {
  name: "R7-B Beijing-Yanjiao Eldercare Scenario Lifecycle Asset",
  plugin_package_ids: ["plugin_wellness_eldercare_v1"],
  scenario_package_id: "scenario_r7b_beijing_yanjiao_eldercare_lifecycle_v1",
  status: "approved",
  tenant_id: "tenant_r7b_synthetic",
  version: "1.0.0"
};

const R7A_ASSET_HASH = "563863f007ba344dcc1c9eeed403a0bc2cf420ad3032a8bf63a7d447ad60023f";
const R7B_ASSET_HASH = "1ffc6985abc6034112336af21839b2547388121604d6df256e0057a41bd0a50a";
const R7B_GOLDEN_SETTLEMENT_DIGEST =
  "c6510204f7dd98571f510734f47aad3be77a76f323d5148eb79b301b4354b39d";

function sealArtifact(input: {
  artifact_id: string;
  payload: HistoricalScenarioRuntimePayload;
  scenario_package_id: string;
  tenant_id: string;
  version: string;
}): HistoricalScenarioArtifact {
  const payload = deepFreeze(input.payload);
  const content_digest = sha256(payload);
  const artifact_digest = sha256({
    artifact_id: input.artifact_id,
    artifact_media_type: "application/vnd.simwar.historical-scenario-artifact+json",
    content_digest,
    lifecycle_status: "RETIRED",
    retention: "IMMUTABLE",
    schema_version: "simwar.historical-scenario-artifact.v1",
    source_revision: HISTORICAL_R7_V1_SOURCE_REVISION
  });
  const reference = createHistoricalScenarioArtifactReference({
    artifact_digest,
    content_digest,
    scenario_package_id: input.scenario_package_id,
    tenant_id: input.tenant_id,
    version: input.version
  });

  return deepFreeze({
    artifact_digest,
    artifact_id: input.artifact_id,
    artifact_media_type: "application/vnd.simwar.historical-scenario-artifact+json",
    content_digest,
    lifecycle_status: "RETIRED",
    payload,
    reference,
    retention: "IMMUTABLE",
    schema_version: "simwar.historical-scenario-artifact.v1",
    source_revision: HISTORICAL_R7_V1_SOURCE_REVISION
  });
}

const R7C_VARIANTS = [
  {
    deterministic_seed: 7070715,
    title: "Base operations pressure",
    variant_id: "base_operations"
  },
  {
    deterministic_seed: 7070716,
    title: "Payer policy shift",
    variant_id: "payer_policy_shift"
  },
  {
    deterministic_seed: 7070717,
    title: "Regional migration friction",
    variant_id: "regional_migration"
  },
  {
    deterministic_seed: 7070718,
    title: "Competition entry",
    variant_id: "competition_entry"
  },
  {
    deterministic_seed: 7070719,
    title: "Crisis shock",
    variant_id: "crisis_shock"
  }
] as const;

function sealR7CVariant(
  variant: (typeof R7C_VARIANTS)[number],
  ordinal: number
): HistoricalScenarioArtifact {
  const version = `r7c.${variant.variant_id}.v1`;
  const scenario_package_id = `scenario_r7c_${variant.variant_id}`;

  return sealArtifact({
    artifact_id: `r7c-beijing-yanjiao-eldercare-${variant.variant_id}-v1`,
    payload: {
      artifact_kind: "R7C_FAMILY_VARIANT",
      asset: {
        asset_hash: R7B_ASSET_HASH,
        asset_id: "r7b-beijing-yanjiao-eldercare-scenario-lifecycle-v1",
        parameter_set: {
          ...R7B_PARAMETER_SET,
          seed: variant.deterministic_seed,
          version: `r7c.eldercare.parameters.${ordinal}.v1`
        },
        scenario_package: {
          name: `R7-C ${variant.title}`,
          plugin_package_ids: ["plugin_wellness_eldercare_v1"],
          scenario_package_id,
          status: "approved",
          tenant_id: "tenant_r7c_synthetic",
          version
        },
        source_r7a_asset_hash: R7A_ASSET_HASH
      },
      scenario_family: {
        family_id: "r7c-beijing-yanjiao-eldercare-family-v1",
        template_version: "r7c.beijing-yanjiao.scenario-family.v1",
        variant_id: variant.variant_id
      },
      synthetic_data_classification: [
        "SYNTHETIC_TEACHING_SCENARIO",
        "UN_CALIBRATED",
        "NOT_FOR_REAL_OPERATING_DECISION",
        "NOT_FOR_PUBLIC_POLICY_DECISION",
        "NOT_FOR_INVESTMENT_DECISION"
      ]
    },
    scenario_package_id,
    tenant_id: "tenant_r7c_synthetic",
    version
  });
}

export const HISTORICAL_R7_V1_ARTIFACTS = deepFreeze([
  sealArtifact({
    artifact_id: "r7a-beijing-yanjiao-eldercare-core-scenario-v1",
    payload: {
      artifact_kind: "R7A_CORE",
      asset: {
        asset_hash: R7A_ASSET_HASH,
        asset_id: "r7a-beijing-yanjiao-eldercare-core-scenario-v1",
        parameter_set: R7A_PARAMETER_SET,
        scenario_package: R7A_SCENARIO_PACKAGE
      },
      synthetic_data_classification: [
        "SYNTHETIC_TEACHING_SCENARIO",
        "UN_CALIBRATED",
        "NOT_FOR_REAL_OPERATING_DECISION"
      ]
    },
    scenario_package_id: R7A_SCENARIO_PACKAGE.scenario_package_id,
    tenant_id: R7A_SCENARIO_PACKAGE.tenant_id,
    version: R7A_SCENARIO_PACKAGE.version
  }),
  sealArtifact({
    artifact_id: "r7b-beijing-yanjiao-eldercare-scenario-lifecycle-v1",
    payload: {
      artifact_kind: "R7B_LIFECYCLE",
      asset: {
        asset_hash: R7B_ASSET_HASH,
        asset_id: "r7b-beijing-yanjiao-eldercare-scenario-lifecycle-v1",
        parameter_set: R7B_PARAMETER_SET,
        scenario_package: R7B_SCENARIO_PACKAGE,
        source_r7a_asset_hash: R7A_ASSET_HASH
      },
      golden_settlement_digest: R7B_GOLDEN_SETTLEMENT_DIGEST,
      synthetic_data_classification: [
        "SYNTHETIC_TEACHING_SCENARIO",
        "UN_CALIBRATED",
        "NOT_FOR_REAL_OPERATING_DECISION",
        "NOT_FOR_PUBLIC_POLICY_DECISION",
        "NOT_FOR_INVESTMENT_DECISION"
      ]
    },
    scenario_package_id: R7B_SCENARIO_PACKAGE.scenario_package_id,
    tenant_id: R7B_SCENARIO_PACKAGE.tenant_id,
    version: R7B_SCENARIO_PACKAGE.version
  }),
  ...R7C_VARIANTS.map((variant, index) => sealR7CVariant(variant, index + 1))
]);
