import { describe, expect, it } from "vitest";
import {
  DemandCandidateError,
  createDemandBinding,
  createDemandModelVersion,
  createGenericDemandMarket,
  createShanghaiDemandMarket,
  evaluateDemandRuntime,
  type DemandMarket
} from "../../services/simulation-core/src/model-candidates/governed-demand/index.js";

const model = createDemandModelVersion({
  coefficients: {
    ideal_fit: 2.2,
    intercept: 0.1,
    price: -0.15,
    quality: 0.4,
    spatial: 0.8
  },
  model_version_id: "model-version:o3-golden",
  source_ref: "synthetic-golden://o3-governed-demand/model-v1",
  version: "1.0.0"
});

const binding = createDemandBinding({
  artifact_digest: model.artifact.content_digest,
  artifact_id: model.artifact.artifact_id,
  course_id: "course-o3",
  model_version: model.version,
  model_version_id: model.model_version_id,
  parameter_set_id: "parameter-set:o3-golden",
  round_no: 1,
  run_id: "run:o3-golden",
  scenario_id: "scenario:o3-generic",
  seed: 17,
  team_id: "team-001",
  tenant_id: "tenant-o3"
});

const market: DemandMarket = {
  cohorts: [
    { cohort_id: "cohort-near", ideal_attributes: { quality: 0.8, wellness: 0.7 }, size: 70 },
    { cohort_id: "cohort-far", ideal_attributes: { quality: 0.2, wellness: 0.1 }, size: 30 }
  ],
  instruments: [
    { product_id: "product-near", values: [0.4, 0.8, 0.7] },
    { product_id: "product-far", values: [0.9, 0.2, 0.1] }
  ],
  market_id: "market:o3-generic",
  outside_option: { available: true, utility: -0.4 },
  products: [
    {
      attributes: { quality: 0.8, wellness: 0.7 },
      attractiveness: 1.4,
      distance: 1,
      firm_id: "firm-near",
      product_id: "product-near",
      reachable: true,
      price: 0.3
    },
    {
      attributes: { quality: 0.2, wellness: 0.1 },
      attractiveness: 1.1,
      distance: 3,
      firm_id: "firm-far",
      product_id: "product-far",
      reachable: true,
      price: 0.6
    }
  ]
};

describe("O3 governed demand candidate", () => {
  it("produces deterministic, bounded candidate shares with separate authority flags", () => {
    const input = {
      exact_binding: binding,
      markets: [market],
      model_version: model,
      plane: "ON" as const
    };
    const first = evaluateDemandRuntime(input);
    const second = evaluateDemandRuntime(input);

    expect(second).toEqual(first);
    expect(first.status).toBe("PASS");
    expect(first.authority_flags).toEqual({
      official_truth_write: false,
      provider_calls: 0,
      settlement_write: false
    });
    expect(first.markets[0]?.products).toHaveLength(2);
    const total =
      (first.markets[0]?.outside_option_share ?? 0) +
      (first.markets[0]?.products.reduce((sum, product) => sum + product.candidate_share, 0) ?? 0);
    expect(total).toBeCloseTo(1, 10);
    expect(first.markets[0]?.products[0]?.ideal_lancaster_fit).toBeGreaterThan(
      first.markets[0]?.products[1]?.ideal_lancaster_fit ?? 0
    );
  });

  it("handles unreachable products and explicit plane-off fallback", () => {
    const unreachable = {
      ...market,
      products: market.products.map((product) => ({ ...product, reachable: false }))
    };
    const off = evaluateDemandRuntime({
      exact_binding: binding,
      markets: [unreachable],
      model_version: model,
      plane: "OFF"
    });
    expect(off.status).toBe("FALLBACK");
    expect(off.fallback).toEqual({
      applied: true,
      plane: "CURRENT_W5_SYNTHETIC_WANT",
      reason: "DEMAND_CANDIDATE_PLANE_OFF"
    });
    expect(off.markets).toEqual([]);

    const on = evaluateDemandRuntime({
      exact_binding: binding,
      markets: [unreachable],
      model_version: model,
      plane: "ON"
    });
    expect(on.markets[0]?.outside_option_share).toBe(1);
    expect(on.markets[0]?.products.every((product) => product.candidate_share === 0)).toBe(true);

    const zeroAttractiveness = {
      ...market,
      products: market.products.map((product) => ({ ...product, attractiveness: 0 }))
    };
    const zeroWeight = evaluateDemandRuntime({
      exact_binding: binding,
      markets: [zeroAttractiveness],
      model_version: model,
      plane: "ON"
    });
    expect(zeroWeight.markets[0]?.outside_option_share).toBe(1);
    expect(zeroWeight.markets[0]?.products.every((product) => product.candidate_share === 0)).toBe(
      true
    );

    const partiallyZero = evaluateDemandRuntime({
      exact_binding: binding,
      markets: [
        {
          ...market,
          products: market.products.map((product, index) =>
            index === 1 ? { ...product, attractiveness: 0 } : product
          )
        }
      ],
      model_version: model,
      plane: "ON"
    });
    expect(partiallyZero.markets[0]?.products[1]?.candidate_share).toBe(0);
  });

  it("fails closed when the exact binding digest or instruments are invalid", () => {
    expect(() =>
      evaluateDemandRuntime({
        exact_binding: { ...binding, scenario_id: "scenario-other" },
        markets: [market],
        model_version: model,
        plane: "ON"
      })
    ).toThrowError(new DemandCandidateError("WRONG_SCOPE_REF_DIGEST"));

    expect(() =>
      evaluateDemandRuntime({
        exact_binding: binding,
        markets: [{ ...market, instruments: [] }],
        model_version: model,
        plane: "ON"
      })
    ).toThrowError(new DemandCandidateError("NO_INSTRUMENT"));

    expect(() =>
      evaluateDemandRuntime({
        exact_binding: binding,
        markets: [market],
        model_version: { ...model, status: "ACTIVE" } as never,
        plane: "ON"
      })
    ).toThrowError(new DemandCandidateError("MODEL_VERSION_REFERENCE_INVALID"));
  });

  it("covers both the generic reference case and the Shanghai-limited case", () => {
    for (const referenceMarket of [
      createGenericDemandMarket({ customer_demand: 180, market_id: "market:generic-reference" }),
      createShanghaiDemandMarket({ customer_demand: 180, market_id: "market:shanghai-reference" })
    ]) {
      const result = evaluateDemandRuntime({
        exact_binding: binding,
        markets: [referenceMarket],
        model_version: model,
        plane: "ON"
      });
      expect(result.status).toBe("PASS");
      expect(result.markets[0]?.products.length).toBe(2);
      expect(result.markets[0]?.outside_option_share).toBeGreaterThan(0);
    }
  });
});
