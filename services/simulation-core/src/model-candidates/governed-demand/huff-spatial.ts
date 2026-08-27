import type { DemandMarket, HuffSpatialResult } from "./types.js";

export function calculateHuffSpatialWeights(input: {
  distance_decay: number;
  market: DemandMarket;
}): HuffSpatialResult {
  if (!Number.isFinite(input.distance_decay) || input.distance_decay <= 0) {
    throw new Error("OUT_OF_DOMAIN");
  }
  const rawWeights = input.market.products.map((product) => {
    if (
      !Number.isFinite(product.distance) ||
      product.distance < 0 ||
      !Number.isFinite(product.attractiveness) ||
      product.attractiveness < 0
    ) {
      throw new Error("NUMERIC_OVERFLOW");
    }
    if (!product.reachable)
      return { product_id: product.product_id, reachable: false, raw_weight: 0 };
    const rawWeight =
      product.attractiveness / Math.max(product.distance, Number.EPSILON) ** input.distance_decay;
    if (!Number.isFinite(rawWeight)) throw new Error("NUMERIC_OVERFLOW");
    return { product_id: product.product_id, reachable: true, raw_weight: rawWeight };
  });
  const totalWeight = rawWeights.reduce((sum, item) => sum + item.raw_weight, 0);
  if (!Number.isFinite(totalWeight)) throw new Error("NUMERIC_OVERFLOW");
  const anyReachable = rawWeights.some((item) => item.reachable && item.raw_weight > 0);
  return {
    lineage: {
      feature_id: "huff_spatial_weight",
      source_ref: "synthetic-golden://o3-governed-demand/huff-spatial-v1",
      unit: "normalized_weight"
    },
    outside_option_weight: anyReachable ? 0 : 1,
    weights: rawWeights.map((item) => ({
      ...item,
      normalized_weight: anyReachable ? item.raw_weight / totalWeight : 0
    }))
  };
}
