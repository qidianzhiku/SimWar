import type { DemandMarket } from "./types.js";

function boundedDemand(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.min(value, 10000) : 180;
}

export function createGenericDemandMarket(input: {
  market_id: string;
  customer_demand: number;
}): DemandMarket {
  const demand = boundedDemand(input.customer_demand);
  return {
    cohorts: [
      {
        cohort_id: "generic-fit",
        ideal_attributes: { quality: 0.8, wellness: 0.7 },
        size: demand * 0.7
      },
      {
        cohort_id: "generic-value",
        ideal_attributes: { quality: 0.3, wellness: 0.2 },
        size: demand * 0.3
      }
    ],
    instruments: [
      { product_id: "generic-neighborhood", values: [0.4, 0.8, 0.7] },
      { product_id: "generic-community", values: [0.9, 0.3, 0.2] }
    ],
    market_id: input.market_id,
    outside_option: { available: true, utility: -0.4 },
    products: [
      {
        attributes: { quality: 0.8, wellness: 0.7 },
        attractiveness: 1.4,
        distance: 1,
        firm_id: "firm-neighborhood",
        product_id: "generic-neighborhood",
        reachable: true,
        price: 0.3
      },
      {
        attributes: { quality: 0.3, wellness: 0.2 },
        attractiveness: 1.1,
        distance: 3,
        firm_id: "firm-community",
        product_id: "generic-community",
        reachable: true,
        price: 0.6
      }
    ]
  };
}

export function createShanghaiDemandMarket(input: {
  market_id: string;
  customer_demand: number;
}): DemandMarket {
  const demand = boundedDemand(input.customer_demand);
  return {
    cohorts: [
      {
        cohort_id: "shanghai-urban-core",
        ideal_attributes: { quality: 0.85, wellness: 0.75 },
        size: demand * 0.6
      },
      {
        cohort_id: "shanghai-community",
        ideal_attributes: { quality: 0.55, wellness: 0.45 },
        size: demand * 0.4
      }
    ],
    instruments: [
      { product_id: "shanghai-urban-care", values: [0.35, 0.85, 0.75] },
      { product_id: "shanghai-community-care", values: [0.75, 0.55, 0.45] }
    ],
    market_id: input.market_id,
    outside_option: { available: true, utility: -0.25 },
    products: [
      {
        attributes: { quality: 0.85, wellness: 0.75 },
        attractiveness: 1.3,
        distance: 1.2,
        firm_id: "firm-shanghai-urban",
        product_id: "shanghai-urban-care",
        reachable: true,
        price: 0.45
      },
      {
        attributes: { quality: 0.55, wellness: 0.45 },
        attractiveness: 1.05,
        distance: 2.2,
        firm_id: "firm-shanghai-community",
        product_id: "shanghai-community-care",
        reachable: true,
        price: 0.35
      }
    ]
  };
}
