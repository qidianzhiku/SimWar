import { calculateHuffSpatialWeights } from "./huff-spatial.js";
import { calculateIdealLancasterFit } from "./ideal-lancaster.js";
import { digest } from "./stable.js";
import type {
  DemandBindingInput,
  DemandCandidateErrorCode,
  DemandCandidateMarketOutput,
  DemandCandidateProductOutput,
  DemandCoefficients,
  DemandExactBinding,
  DemandMarket,
  DemandModelVersion,
  DemandModelVersionInput,
  GovernedDemandRuntimeInput,
  GovernedDemandRuntimeOutput
} from "./types.js";

export class DemandCandidateError extends Error {
  constructor(readonly code: DemandCandidateErrorCode) {
    super(code);
    this.name = "DemandCandidateError";
  }
}

function fail(code: DemandCandidateErrorCode): never {
  throw new DemandCandidateError(code);
}

function bindingPayload(input: DemandBindingInput): DemandBindingInput {
  const payload = { ...input } as Partial<DemandExactBinding>;
  delete payload.binding_digest;
  return payload as DemandBindingInput;
}

export function createDemandBinding(input: DemandBindingInput): DemandExactBinding {
  if (
    Object.values(input).some((value) => typeof value === "string" && value.trim().length === 0) ||
    !/^\d+\.\d+\.\d+$/.test(input.model_version) ||
    !Number.isSafeInteger(input.round_no) ||
    input.round_no < 1 ||
    !Number.isSafeInteger(input.seed)
  )
    fail("MODEL_VERSION_REFERENCE_INVALID");
  return { ...input, binding_digest: digest(bindingPayload(input)) };
}

export function createDemandModelVersion(input: DemandModelVersionInput): DemandModelVersion {
  if (
    !input.model_version_id.trim() ||
    !/^\d+\.\d+\.\d+$/.test(input.version) ||
    !input.source_ref.trim()
  ) {
    fail("MODEL_VERSION_REFERENCE_INVALID");
  }
  const coefficients: DemandCoefficients = { ...input.coefficients };
  if (Object.values(coefficients).some((value) => !Number.isFinite(value)))
    fail("NUMERIC_OVERFLOW");
  const identity = {
    coefficients,
    model_family: "governed_demand_candidate" as const,
    model_version_id: input.model_version_id,
    source_ref: input.source_ref,
    version: input.version
  };
  const contentDigest = digest(identity);
  return {
    artifact: {
      artifact_id: `artifact:${input.model_version_id}:${input.version}`,
      content_digest: contentDigest,
      format: "governed-demand-typescript-candidate",
      source_ref: input.source_ref
    },
    coefficients,
    content_digest: contentDigest,
    model_family: "governed_demand_candidate",
    model_version_id: input.model_version_id,
    no_implicit_latest: true,
    runtime_activation: false,
    status: "CANDIDATE",
    version: input.version
  };
}

function assertExactBinding(input: GovernedDemandRuntimeInput): void {
  const binding = input.exact_binding;
  if (
    input.model_version.status !== "CANDIDATE" ||
    input.model_version.runtime_activation !== false ||
    input.model_version.no_implicit_latest !== true
  ) {
    fail("MODEL_VERSION_REFERENCE_INVALID");
  }
  if (
    binding.binding_digest !== digest(bindingPayload(binding)) ||
    binding.model_version_id !== input.model_version.model_version_id ||
    binding.model_version !== input.model_version.version ||
    binding.artifact_id !== input.model_version.artifact.artifact_id ||
    binding.artifact_digest !== input.model_version.artifact.content_digest ||
    input.model_version.content_digest !== input.model_version.artifact.content_digest
  )
    fail("WRONG_SCOPE_REF_DIGEST");
}

function validateMarket(market: DemandMarket): void {
  if (!market.market_id || market.products.length === 0 || market.cohorts.length === 0)
    fail("OUT_OF_DOMAIN");
  if (!market.outside_option.available || !Number.isFinite(market.outside_option.utility))
    fail("INVALID_SHARES");
  const instruments = new Map(market.instruments.map((item) => [item.product_id, item]));
  if (
    market.instruments.length === 0 ||
    market.products.some((product) => {
      const instrument = instruments.get(product.product_id);
      return (
        !instrument ||
        instrument.values.length === 0 ||
        instrument.values.some((value) => !Number.isFinite(value))
      );
    })
  )
    fail("NO_INSTRUMENT");
  for (const product of market.products) {
    if (
      !product.product_id ||
      !product.firm_id ||
      !Number.isFinite(product.price) ||
      product.price < 0 ||
      !Number.isFinite(product.distance) ||
      product.distance < 0 ||
      !Number.isFinite(product.attractiveness) ||
      product.attractiveness < 0 ||
      Object.values(product.attributes).some((value) => !Number.isFinite(value))
    ) {
      fail("OUT_OF_DOMAIN");
    }
  }
  for (const cohort of market.cohorts) {
    if (
      !cohort.cohort_id ||
      !Number.isFinite(cohort.size) ||
      cohort.size <= 0 ||
      Object.values(cohort.ideal_attributes).some((value) => !Number.isFinite(value))
    )
      fail("OUT_OF_DOMAIN");
  }
}

function softmax(utilities: readonly number[], outsideUtility: number): number[] {
  const all = [outsideUtility, ...utilities];
  const maximum = Math.max(...all);
  const exponentials = all.map((utility) =>
    Number.isFinite(utility) ? Math.exp(utility - maximum) : 0
  );
  const denominator = exponentials.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(denominator) || denominator <= 0) fail("NUMERIC_OVERFLOW");
  return exponentials.map((value) => value / denominator);
}

function evaluateMarket(
  market: DemandMarket,
  coefficients: DemandCoefficients
): DemandCandidateMarketOutput {
  const spatial = calculateHuffSpatialWeights({ distance_decay: 1, market });
  const spatialByProduct = new Map(spatial.weights.map((item) => [item.product_id, item]));
  const totals = new Map<
    string,
    { fit: number; share: number; spatial: number; utility: number }
  >();
  const totalCohortSize = market.cohorts.reduce((sum, cohort) => sum + cohort.size, 0);
  let outsideShare = 0;
  for (const cohort of market.cohorts) {
    const details = market.products.map((product) => {
      const ideal = calculateIdealLancasterFit({ cohort, product });
      const huff = spatialByProduct.get(product.product_id);
      if (!huff) fail("OUT_OF_DOMAIN");
      const quality = product.attributes.quality ?? 0;
      const utility =
        product.reachable && huff.raw_weight > 0 && spatial.outside_option_weight === 0
          ? coefficients.intercept +
            coefficients.price * product.price +
            coefficients.quality * quality +
            coefficients.spatial * huff.normalized_weight +
            coefficients.ideal_fit * ideal.fit_score
          : Number.NEGATIVE_INFINITY;
      return { huff, ideal, product, utility };
    });
    const probabilities = softmax(
      details.map((item) => item.utility),
      market.outside_option.utility
    );
    const cohortWeight = cohort.size / totalCohortSize;
    outsideShare += (probabilities[0] ?? 0) * cohortWeight;
    details.forEach((detail, index) => {
      const current = totals.get(detail.product.product_id) ?? {
        fit: 0,
        share: 0,
        spatial: 0,
        utility: 0
      };
      const probability = probabilities[index + 1] ?? 0;
      totals.set(detail.product.product_id, {
        fit: current.fit + detail.ideal.fit_score * cohortWeight,
        share: current.share + probability * cohortWeight,
        spatial: current.spatial + detail.huff.normalized_weight * cohortWeight,
        utility:
          current.utility + (Number.isFinite(detail.utility) ? detail.utility * cohortWeight : 0)
      });
    });
  }
  const products: DemandCandidateProductOutput[] = market.products.map((product) => {
    const total = totals.get(product.product_id);
    if (!total || !Number.isFinite(total.share) || total.share < 0) fail("NUMERIC_OVERFLOW");
    return {
      candidate_share: total.share,
      firm_id: product.firm_id,
      huff_spatial_weight: total.spatial,
      ideal_lancaster_fit: total.fit,
      product_id: product.product_id,
      utility: total.utility
    };
  });
  const insideShare = products.reduce((sum, product) => sum + product.candidate_share, 0);
  if (
    !Number.isFinite(outsideShare) ||
    !Number.isFinite(insideShare) ||
    insideShare >= 1 ||
    outsideShare <= 0
  ) {
    fail("NUMERIC_OVERFLOW");
  }
  return { market_id: market.market_id, outside_option_share: outsideShare, products };
}

export function evaluateDemandRuntime(
  input: GovernedDemandRuntimeInput
): GovernedDemandRuntimeOutput {
  assertExactBinding(input);
  input.markets.forEach(validateMarket);
  const common = {
    authority_flags: {
      official_truth_write: false as const,
      provider_calls: 0 as const,
      settlement_write: false as const
    },
    lineage: {
      feature_ownership: ["ideal_lancaster_fit", "huff_spatial_weight"] as const,
      producer: "O3_GOVERNED_DEMAND_CANDIDATE" as const,
      source_classification: "SYNTHETIC_GOLDEN" as const
    },
    model_version_ref: {
      content_digest: input.model_version.content_digest,
      model_version_id: input.model_version.model_version_id,
      version: input.model_version.version
    },
    replay_input_digest: digest(input)
  };
  if (input.plane === "OFF") {
    return {
      ...common,
      fallback: {
        applied: true,
        plane: "CURRENT_W5_SYNTHETIC_WANT",
        reason: "DEMAND_CANDIDATE_PLANE_OFF"
      },
      markets: [],
      status: "FALLBACK"
    };
  }
  return {
    ...common,
    fallback: { applied: false, plane: "NONE", reason: "NONE" },
    markets: input.markets.map((market) =>
      evaluateMarket(market, input.model_version.coefficients)
    ),
    status: "PASS"
  };
}
