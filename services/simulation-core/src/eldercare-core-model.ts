export type EldercareEvidenceLabel = "SOURCE_ONLY_INFERENCE" | "CONTRACT_BACKED_EVIDENCE";

export type EldercareRegionId = "beijing" | "yanjiao";

export type EldercareLicenseScope =
  | "community_daycare_only"
  | "eldercare_service"
  | "eldercare_medical";

export interface EldercareRegionProfile {
  region_id: EldercareRegionId;
  display_name: string;
  demand_weight: number;
  income_index: number;
  distance_friction: number;
}

export interface EldercareSegmentProfile {
  segment_id: "active_senior" | "assisted_living" | "medical_rehab";
  display_name: string;
  base_demand: number;
  price_sensitivity: number;
  care_quality_weight: number;
  medical_license_required: boolean;
}

export interface EldercareFacilityPlan {
  beds: number;
  day_care_slots: number;
  staff_count: number;
  nurse_ratio: number;
}

export interface EldercarePayerMix {
  self_pay: number;
  commercial_insurance: number;
  public_subsidy: number;
}

export interface EldercareDecisionProfile {
  monthly_price: number;
  service_quality_budget: number;
  community_outreach_budget: number;
  facility: EldercareFacilityPlan;
  license_scope: EldercareLicenseScope;
  medical_care_expansion: boolean;
  payer_mix: EldercarePayerMix;
}

export interface EldercareModelInput {
  scenario_id: "r7a-beijing-yanjiao-eldercare-core-scenario-v1";
  seed: number;
  regions: EldercareRegionProfile[];
  segments: EldercareSegmentProfile[];
  decision: EldercareDecisionProfile;
}

export interface EldercarePluginTrace {
  hook: "segmentDemand" | "capacityGuardrail" | "payerMix" | "serviceQualityRisk";
  evidence_label: EldercareEvidenceLabel;
  formula_ref: string;
  input_ref: string;
  output_delta: number;
}

export interface EldercareControlledFailure {
  code: "ELDERCARE_LICENSE_SCOPE_DENIED" | "ELDERCARE_CAPACITY_STAFFING_DENIED";
  evidence_label: "CONTRACT_BACKED_EVIDENCE";
  message: string;
}

export interface EldercareRoundMetrics {
  market: {
    demand_index: number;
    qualified_demand: number;
    price_friction: number;
  };
  operations: {
    service_capacity: number;
    staffed_capacity: number;
    utilization: number;
  };
  finance: {
    expected_revenue: number;
    expected_cost: number;
    operating_margin: number;
  };
  quality: {
    staffing_safety_index: number;
    care_quality_index: number;
    payer_resilience_index: number;
  };
}

export interface EldercareRoundEvaluation {
  model_family: "eldercare_core_model_v1";
  scenario_id: EldercareModelInput["scenario_id"];
  formal_truth_write: false;
  postgresql_runtime_required: false;
  replay_writes_formal_results: false;
  round_metrics: EldercareRoundMetrics;
  plugin_trace: EldercarePluginTrace[];
  controlled_failures: EldercareControlledFailure[];
}

export interface EldercareLearnerBrief {
  visibility: "learner_safe_summary";
  replay_writes_formal_results: false;
  demand_band: "low" | "medium" | "high";
  capacity_band: "tight" | "balanced" | "surplus";
  quality_signal: "watch" | "stable" | "strong";
  suggested_discussion: string[];
}

const DEFAULT_REGIONS: EldercareRegionProfile[] = [
  {
    region_id: "beijing",
    display_name: "Beijing urban eldercare demand",
    demand_weight: 0.62,
    distance_friction: 0.08,
    income_index: 1.18
  },
  {
    region_id: "yanjiao",
    display_name: "Yanjiao commuter-family eldercare demand",
    demand_weight: 0.38,
    distance_friction: 0.18,
    income_index: 0.92
  }
];

const DEFAULT_SEGMENTS: EldercareSegmentProfile[] = [
  {
    base_demand: 88,
    care_quality_weight: 0.7,
    display_name: "Active senior community services",
    medical_license_required: false,
    price_sensitivity: 0.48,
    segment_id: "active_senior"
  },
  {
    base_demand: 64,
    care_quality_weight: 1.05,
    display_name: "Assisted living residential care",
    medical_license_required: false,
    price_sensitivity: 0.36,
    segment_id: "assisted_living"
  },
  {
    base_demand: 28,
    care_quality_weight: 1.26,
    display_name: "Medical rehabilitation support",
    medical_license_required: true,
    price_sensitivity: 0.29,
    segment_id: "medical_rehab"
  }
];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function demandBand(demand: number): EldercareLearnerBrief["demand_band"] {
  if (demand >= 160) {
    return "high";
  }

  if (demand >= 105) {
    return "medium";
  }

  return "low";
}

function capacityBand(utilization: number): EldercareLearnerBrief["capacity_band"] {
  if (utilization > 0.9) {
    return "tight";
  }

  if (utilization >= 0.6) {
    return "balanced";
  }

  return "surplus";
}

function qualitySignal(careQualityIndex: number): EldercareLearnerBrief["quality_signal"] {
  if (careQualityIndex >= 0.78) {
    return "strong";
  }

  if (careQualityIndex >= 0.58) {
    return "stable";
  }

  return "watch";
}

function payerMixTotal(payerMix: EldercarePayerMix): number {
  return payerMix.self_pay + payerMix.commercial_insurance + payerMix.public_subsidy;
}

function licenseAllowsMedicalCare(input: EldercareModelInput): boolean {
  return (
    !input.decision.medical_care_expansion || input.decision.license_scope === "eldercare_medical"
  );
}

export function createDefaultEldercareModelInput(): EldercareModelInput {
  return {
    decision: {
      community_outreach_budget: 88000,
      facility: {
        beds: 96,
        day_care_slots: 42,
        nurse_ratio: 0.24,
        staff_count: 58
      },
      license_scope: "eldercare_medical",
      medical_care_expansion: true,
      monthly_price: 13800,
      payer_mix: {
        commercial_insurance: 0.18,
        public_subsidy: 0.22,
        self_pay: 0.6
      },
      service_quality_budget: 168000
    },
    regions: DEFAULT_REGIONS,
    scenario_id: "r7a-beijing-yanjiao-eldercare-core-scenario-v1",
    seed: 70707,
    segments: DEFAULT_SEGMENTS
  };
}

export function evaluateEldercareCoreRound(input: EldercareModelInput): EldercareRoundEvaluation {
  const payerTotal = payerMixTotal(input.decision.payer_mix);
  const normalizedPayerMix =
    payerTotal > 0
      ? {
          commercial_insurance: input.decision.payer_mix.commercial_insurance / payerTotal,
          public_subsidy: input.decision.payer_mix.public_subsidy / payerTotal,
          self_pay: input.decision.payer_mix.self_pay / payerTotal
        }
      : { commercial_insurance: 0, public_subsidy: 0, self_pay: 1 };
  const priceFriction = clamp((input.decision.monthly_price - 11800) / 9000, 0, 0.8);
  const qualityLift = clamp(input.decision.service_quality_budget / 240000, 0, 1.1);
  const outreachLift = clamp(input.decision.community_outreach_budget / 180000, 0, 0.7);
  const regionDemand = input.regions.reduce(
    (sum, region) =>
      sum +
      region.demand_weight *
        region.income_index *
        (1 - region.distance_friction) *
        input.segments.reduce((segmentSum, segment) => segmentSum + segment.base_demand, 0),
    0
  );
  const medicalLicensePenalty = licenseAllowsMedicalCare(input) ? 1 : 0.72;
  const segmentDemand = input.segments.reduce((sum, segment) => {
    const licenseModifier =
      segment.medical_license_required && !licenseAllowsMedicalCare(input) ? 0 : 1;
    const qualityModifier = 1 + qualityLift * segment.care_quality_weight;
    const priceModifier = 1 - priceFriction * segment.price_sensitivity;
    return sum + segment.base_demand * qualityModifier * priceModifier * licenseModifier;
  }, 0);
  const demandIndex = round2(
    (regionDemand * 0.36 + segmentDemand * 0.64 + outreachLift * 42) * medicalLicensePenalty
  );
  const staffedCapacity = round2(
    Math.min(
      input.decision.facility.beds + input.decision.facility.day_care_slots * 0.56,
      input.decision.facility.staff_count * (1.6 + input.decision.facility.nurse_ratio)
    )
  );
  const serviceCapacity = round2(
    Math.min(
      input.decision.facility.beds + input.decision.facility.day_care_slots * 0.65,
      staffedCapacity
    )
  );
  const qualifiedDemand = round2(Math.min(demandIndex, serviceCapacity));
  const utilization = serviceCapacity === 0 ? 0 : round2(qualifiedDemand / serviceCapacity);
  const staffingSafetyIndex = round2(
    clamp(
      input.decision.facility.staff_count / Math.max(1, input.decision.facility.beds * 0.52),
      0,
      1.2
    )
  );
  const careQualityIndex = round2(clamp(qualityLift * 0.62 + staffingSafetyIndex * 0.38, 0, 1));
  const payerResilienceIndex = round2(
    clamp(
      normalizedPayerMix.self_pay * 0.52 +
        normalizedPayerMix.commercial_insurance * 0.3 +
        normalizedPayerMix.public_subsidy * 0.18,
      0,
      1
    )
  );
  const expectedRevenue = round2(qualifiedDemand * input.decision.monthly_price);
  const expectedCost = round2(
    input.decision.service_quality_budget +
      input.decision.community_outreach_budget +
      serviceCapacity * 6200 +
      input.decision.facility.staff_count * 7800
  );
  const operatingMargin =
    expectedRevenue === 0 ? -1 : round2((expectedRevenue - expectedCost) / expectedRevenue);
  const controlledFailures: EldercareControlledFailure[] = [];

  if (!licenseAllowsMedicalCare(input)) {
    controlledFailures.push({
      code: "ELDERCARE_LICENSE_SCOPE_DENIED",
      evidence_label: "CONTRACT_BACKED_EVIDENCE",
      message: "medical care expansion requires an authorized eldercare medical license scope"
    });
  }

  if (input.decision.facility.staff_count < input.decision.facility.beds * 0.35) {
    controlledFailures.push({
      code: "ELDERCARE_CAPACITY_STAFFING_DENIED",
      evidence_label: "CONTRACT_BACKED_EVIDENCE",
      message: "staffing level is insufficient for the declared eldercare bed plan"
    });
  }

  return {
    controlled_failures: controlledFailures,
    formal_truth_write: false,
    model_family: "eldercare_core_model_v1",
    plugin_trace: [
      {
        evidence_label: "SOURCE_ONLY_INFERENCE",
        formula_ref: "eldercare.segment-demand.v1",
        hook: "segmentDemand",
        input_ref: "regions+segments+price+quality+outreach",
        output_delta: demandIndex
      },
      {
        evidence_label: "SOURCE_ONLY_INFERENCE",
        formula_ref: "eldercare.capacity-guardrail.v1",
        hook: "capacityGuardrail",
        input_ref: "beds+day_care_slots+staff_count+nurse_ratio",
        output_delta: serviceCapacity - staffedCapacity
      },
      {
        evidence_label: "SOURCE_ONLY_INFERENCE",
        formula_ref: "eldercare.payer-mix-resilience.v1",
        hook: "payerMix",
        input_ref: "self_pay+commercial_insurance+public_subsidy",
        output_delta: payerResilienceIndex
      },
      {
        evidence_label: "SOURCE_ONLY_INFERENCE",
        formula_ref: "eldercare.service-quality-risk.v1",
        hook: "serviceQualityRisk",
        input_ref: "service_quality_budget+staffing_safety_index",
        output_delta: careQualityIndex
      }
    ],
    postgresql_runtime_required: false,
    replay_writes_formal_results: false,
    round_metrics: {
      finance: {
        expected_cost: expectedCost,
        expected_revenue: expectedRevenue,
        operating_margin: operatingMargin
      },
      market: {
        demand_index: demandIndex,
        price_friction: round2(priceFriction),
        qualified_demand: qualifiedDemand
      },
      operations: {
        service_capacity: serviceCapacity,
        staffed_capacity: staffedCapacity,
        utilization
      },
      quality: {
        care_quality_index: careQualityIndex,
        payer_resilience_index: payerResilienceIndex,
        staffing_safety_index: staffingSafetyIndex
      }
    },
    scenario_id: input.scenario_id
  };
}

export function projectEldercareLearnerBrief(
  evaluation: EldercareRoundEvaluation
): EldercareLearnerBrief {
  return {
    capacity_band: capacityBand(evaluation.round_metrics.operations.utilization),
    demand_band: demandBand(evaluation.round_metrics.market.demand_index),
    quality_signal: qualitySignal(evaluation.round_metrics.quality.care_quality_index),
    replay_writes_formal_results: false,
    suggested_discussion: [
      "Compare demand band with capacity band before changing price.",
      "Discuss whether staffing and service quality support the promised eldercare model.",
      "Use payer resilience as a classroom planning signal, not as production proof."
    ],
    visibility: "learner_safe_summary"
  };
}
