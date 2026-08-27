import type { DemandCohort, DemandProduct, IdealLancasterResult } from "./types.js";

export function calculateIdealLancasterFit(input: {
  cohort: DemandCohort;
  product: DemandProduct;
}): IdealLancasterResult {
  const dimensions = Object.keys(input.product.attributes);
  if (dimensions.length === 0) throw new Error("OUT_OF_DOMAIN");
  const squaredDistance = dimensions.reduce((sum, dimension) => {
    const productValue = input.product.attributes[dimension];
    const idealValue = input.cohort.ideal_attributes[dimension] ?? 0;
    if (
      typeof productValue !== "number" ||
      typeof idealValue !== "number" ||
      !Number.isFinite(productValue) ||
      !Number.isFinite(idealValue)
    ) {
      throw new Error("NUMERIC_OVERFLOW");
    }
    return sum + (productValue - idealValue) ** 2;
  }, 0);
  const attributeDistance = Math.sqrt(squaredDistance);
  const fitScore = 1 / (1 + attributeDistance);
  if (!Number.isFinite(attributeDistance) || !Number.isFinite(fitScore)) {
    throw new Error("NUMERIC_OVERFLOW");
  }
  return {
    attribute_distance: attributeDistance,
    fit_score: fitScore,
    lineage: {
      feature_id: "ideal_lancaster_fit",
      source_ref: "synthetic-golden://o3-governed-demand/ideal-lancaster-v1",
      unit: "dimensionless"
    },
    utility_component: fitScore
  };
}
