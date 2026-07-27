import { createHash } from "node:crypto";
import type {
  Decision,
  ParameterSet,
  Round,
  Run,
  ScenarioPackage,
  Team
} from "@simwar/shared-contracts";
import { describe, expect, it } from "vitest";
import * as simulationCore from "../../services/simulation-core/src/index";
import * as sharedContracts from "../../packages/shared-contracts/src/index";
import { createToyLogitEngine } from "../../services/simulation-core/src/toy-logit-engine";

type HistoricalReference = {
  artifact_digest: string;
  content_digest: string;
  scenario_package_id: string;
  tenant_id: string;
  version: string;
};

type HistoricalArtifact = {
  artifact_digest: string;
  artifact_id: string;
  artifact_media_type: string;
  content_digest: string;
  lifecycle_status: "RETIRED";
  payload: {
    asset?: {
      parameter_set: ParameterSet;
      scenario_package: ScenarioPackage;
    };
    golden_settlement_digest?: string;
  };
  reference: HistoricalReference;
  retention: "IMMUTABLE";
  schema_version: string;
  source_revision: string;
};

type HistoricalCoreApi = {
  HISTORICAL_R7_V1_ARTIFACTS: readonly HistoricalArtifact[];
  assertHistoricalScenarioArtifactNotBindable(reference: HistoricalReference): never;
  projectHistoricalScenarioArtifactForStudent(reference: HistoricalReference): unknown;
  resolveHistoricalScenarioArtifactForRun(
    tenantId: string,
    reference: HistoricalReference
  ): HistoricalArtifact;
};

type HistoricalSharedApi = {
  createHistoricalScenarioArtifactReference(input: HistoricalReference): HistoricalReference;
};

const core = simulationCore as typeof simulationCore & HistoricalCoreApi;
const contracts = sharedContracts as typeof sharedContracts & HistoricalSharedApi;

function requireHistoricalApi(): {
  core: HistoricalCoreApi;
  contracts: HistoricalSharedApi;
} | null {
  expect(core.resolveHistoricalScenarioArtifactForRun).toBeTypeOf("function");
  expect(core.assertHistoricalScenarioArtifactNotBindable).toBeTypeOf("function");
  expect(core.projectHistoricalScenarioArtifactForStudent).toBeTypeOf("function");
  expect(contracts.createHistoricalScenarioArtifactReference).toBeTypeOf("function");

  if (
    typeof core.resolveHistoricalScenarioArtifactForRun !== "function" ||
    typeof core.assertHistoricalScenarioArtifactNotBindable !== "function" ||
    typeof core.projectHistoricalScenarioArtifactForStudent !== "function" ||
    typeof contracts.createHistoricalScenarioArtifactReference !== "function"
  ) {
    return null;
  }

  return { contracts, core };
}

function artifactFor(scenarioPackageId: string): HistoricalArtifact {
  const api = requireHistoricalApi();
  if (!api) {
    throw new Error("HISTORICAL_SCENARIO_ARTIFACT_RESOLVER_NOT_IMPLEMENTED");
  }

  const artifact = api.core.HISTORICAL_R7_V1_ARTIFACTS.find(
    (candidate) => candidate.reference.scenario_package_id === scenarioPackageId
  );
  expect(artifact).toBeDefined();
  return artifact!;
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

function team(team_id: string, name: string): Team {
  return {
    captain_user_id: `${team_id}_captain`,
    course_id: "course_r7b_synthetic",
    members: [],
    name,
    team_id,
    tenant_id: "tenant_r7b_synthetic"
  };
}

function decision(team_id: string, price: number, serviceQualityBudget: number): Decision {
  return {
    decision_id: `decision_${team_id}`,
    payload: {
      capacity_plan: "expand",
      cash_buffer_target: 0.2,
      marketing_budget: 165000,
      pricing: { base_price: price },
      service_quality_budget: serviceQualityBudget,
      strategy_statement: `R7-B lifecycle compatibility decision for ${team_id}.`
    },
    round_id: "round_r7b_1",
    round_no: 1,
    run_id: "run_r7b_synthetic_001",
    status: "validated",
    submitted_by: `${team_id}_captain`,
    team_id,
    tenant_id: "tenant_r7b_synthetic",
    validation_report: [],
    version: 1
  };
}

describe("R7 historical ScenarioPackage artifact resolution", () => {
  it("exposes a historical-only exact artifact resolver from the simulation core boundary", () => {
    expect(requireHistoricalApi()).not.toBeNull();
  });

  it("resolves an immutable retired R7-B artifact only from its exact reference", () => {
    const api = requireHistoricalApi();
    if (!api) return;
    const expected = artifactFor("scenario_r7b_beijing_yanjiao_eldercare_lifecycle_v1");
    const reference = api.contracts.createHistoricalScenarioArtifactReference(expected.reference);

    const first = api.core.resolveHistoricalScenarioArtifactForRun(reference.tenant_id, reference);
    const second = api.core.resolveHistoricalScenarioArtifactForRun(reference.tenant_id, reference);

    expect(first).toBe(expected);
    expect(second).toBe(first);
    expect(first.lifecycle_status).toBe("RETIRED");
    expect(first.retention).toBe("IMMUTABLE");
    expect(first.source_revision).toBe("0760055145f9626b3751c2e3b9b45d5b5b2a24ec");
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.payload)).toBe(true);
  });

  it("accepts an opaque legacy R7-C version only through the historical contract", () => {
    const api = requireHistoricalApi();
    if (!api) return;
    const expected = artifactFor("scenario_r7c_base_operations");
    const legacyReference = api.contracts.createHistoricalScenarioArtifactReference(
      expected.reference
    );

    expect(legacyReference.version).toBe("r7c.base_operations.v1");
    expect(
      api.core.resolveHistoricalScenarioArtifactForRun(legacyReference.tenant_id, legacyReference)
    ).toBe(expected);
  });

  it("rejects floating and range-style versions while preserving opaque legacy identities", () => {
    const api = requireHistoricalApi();
    if (!api) return;
    const reference = artifactFor("scenario_r7c_base_operations").reference;

    for (const version of ["latest", "next", "*", "^1.0.0", "~1.0.0", "1.x", "1.0.0 || 2.0.0"]) {
      expect(() =>
        api.contracts.createHistoricalScenarioArtifactReference({ ...reference, version })
      ).toThrow("HISTORICAL_REFERENCE_INVALID");
    }
    expect(api.contracts.createHistoricalScenarioArtifactReference(reference).version).toBe(
      "r7c.base_operations.v1"
    );
  });

  it("fails closed for unknown, wrong-version, wrong-digest, and wrong-tenant references", () => {
    const api = requireHistoricalApi();
    if (!api) return;
    const reference = artifactFor("scenario_r7b_beijing_yanjiao_eldercare_lifecycle_v1").reference;

    expect(() =>
      api.core.resolveHistoricalScenarioArtifactForRun(reference.tenant_id, {
        ...reference,
        scenario_package_id: "scenario_unknown"
      })
    ).toThrow("NOT_FOUND");
    expect(() =>
      api.core.resolveHistoricalScenarioArtifactForRun(reference.tenant_id, {
        ...reference,
        version: "1.0.1"
      })
    ).toThrow("NOT_FOUND");
    expect(() =>
      api.core.resolveHistoricalScenarioArtifactForRun(reference.tenant_id, {
        ...reference,
        content_digest: "0".repeat(64)
      })
    ).toThrow("CONTENT_DIGEST_MISMATCH");
    expect(() =>
      api.core.resolveHistoricalScenarioArtifactForRun(reference.tenant_id, {
        ...reference,
        artifact_digest: "f".repeat(64)
      })
    ).toThrow("ARTIFACT_DIGEST_MISMATCH");
    expect(() =>
      api.core.resolveHistoricalScenarioArtifactForRun("tenant_other", reference)
    ).toThrow("TENANT_SCOPE_VIOLATION");
  });

  it("blocks retired artifacts from new binding without selecting a replacement version", () => {
    const api = requireHistoricalApi();
    if (!api) return;
    const reference = artifactFor("scenario_r7b_beijing_yanjiao_eldercare_lifecycle_v1").reference;

    expect(() => api.core.assertHistoricalScenarioArtifactNotBindable(reference)).toThrow(
      "RETIRED_FOR_NEW_BINDING"
    );
    expect(() =>
      api.core.resolveHistoricalScenarioArtifactForRun(reference.tenant_id, {
        ...reference,
        scenario_package_id: "scenario_r7b_shanghai_eldercare_lifecycle_v2",
        version: "2.0.0"
      })
    ).toThrow("NOT_FOUND");
  });

  it("replays the sealed R7-B v1 inputs deterministically without official-result writes", () => {
    const api = requireHistoricalApi();
    if (!api) return;
    const artifact = artifactFor("scenario_r7b_beijing_yanjiao_eldercare_lifecycle_v1");
    const payload = artifact.payload.asset;
    expect(payload).toBeDefined();
    if (!payload) return;
    const parameterSet = payload.parameter_set;
    const scenario = payload.scenario_package;
    const run: Run = {
      course_id: "course_r7b_synthetic",
      parameter_set_id: parameterSet.parameter_set_id,
      run_id: "run_r7b_synthetic_001",
      scenario_package_id: scenario.scenario_package_id,
      seed: parameterSet.seed,
      status: "active",
      tenant_id: "tenant_r7b_synthetic"
    };
    const round: Round = {
      round_id: "round_r7b_1",
      round_no: 1,
      run_id: run.run_id,
      status: "locked",
      tenant_id: run.tenant_id
    };

    const settle = () =>
      createToyLogitEngine().settle({
        decisions: [
          decision("team_alpha_r7b", 13200, 180000),
          decision("team_beta_r7b", 11800, 130000)
        ],
        parameterSet,
        round,
        run,
        scenario,
        teams: [
          team("team_alpha_r7b", "Alpha Eldercare Team"),
          team("team_beta_r7b", "Beta Eldercare Team")
        ]
      });
    const first = settle();
    const second = settle();

    expect(second).toEqual(first);
    expect(sha256(first)).toBe("c6510204f7dd98571f510734f47aad3be77a76f323d5148eb79b301b4354b39d");
    expect(artifact.payload.golden_settlement_digest).toBe(
      "c6510204f7dd98571f510734f47aad3be77a76f323d5148eb79b301b4354b39d"
    );
  });

  it("keeps artifact and source digests out of the student projection", () => {
    const api = requireHistoricalApi();
    if (!api) return;
    const reference = artifactFor("scenario_r7b_beijing_yanjiao_eldercare_lifecycle_v1").reference;
    const projection = api.core.projectHistoricalScenarioArtifactForStudent(reference);
    const serialized = JSON.stringify(projection);

    expect(serialized).not.toContain("content_digest");
    expect(serialized).not.toContain("artifact_digest");
    expect(serialized).not.toContain("source_revision");
    expect(serialized).not.toContain("private");
    expect(serialized).not.toContain("state_true");
  });

  it("contains only immutable static artifacts and no Store, Git, or writer behavior", () => {
    const api = requireHistoricalApi();
    if (!api) return;
    const serialized = JSON.stringify(api.core.HISTORICAL_R7_V1_ARTIFACTS).toLowerCase();

    expect(api.core.HISTORICAL_R7_V1_ARTIFACTS).toHaveLength(7);
    expect(serialized).not.toContain(".git");
    expect(serialized).not.toContain("repository");
    expect(serialized).not.toContain("store");
    expect(serialized).not.toContain("state_true");
  });
});
