import { createHash } from "node:crypto";
import type {
  ComputationalRunManifestV1,
  Decision,
  ParameterSet,
  PublicRunReplayEvidence,
  Round,
  Run,
  RunReplayEvidence,
  ScenarioPackage,
  SettlementResult,
  Team
} from "@simwar/shared-contracts";
import { previewSettlementReplay } from "./simulation.js";

const JSON_RUNTIME_SOURCE_REVISION =
  "@simwar/api:0.1.0|@simwar/simulation-core:0.1.0|m1-json-runtime:r4-manifest-evidence.v1";
const ENGINE_ID = "toy_logit_wellness_v1";
const ENGINE_VERSION = "0.1.0";
const MAPPER_VERSION = "settlement-to-public-result.v1";
const DECISION_SCHEMA_VERSION = "DecisionPayload.v1";
const EVIDENCE_SEMANTICS_VERSION = "m1-json-replay-evidence.v1";
const EVIDENCE_KIND = "m1_json_runtime_replay_evidence";

export interface CreateM1RunReplayEvidenceInput {
  decisions: Decision[];
  parameterSet: ParameterSet;
  round: Round;
  run: Run;
  scenario: ScenarioPackage;
  settlement: SettlementResult;
  teams: Team[];
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nested]) => nested !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)])
    );
  }

  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export interface M1CanonicalEvidenceDigestInput {
  evidence_kind: typeof EVIDENCE_KIND;
  evidence_semantics_version: typeof EVIDENCE_SEMANTICS_VERSION;
  frozen_input_semantics: {
    decision_batch_hash: string;
    decision_schema_version: string;
    engine_id: string;
    engine_version: string;
    json_runtime_source_digest: string;
    json_runtime_source_revision: string;
    mapper_version: string;
    parameter_model_family: string;
    parameter_set_id: string;
    parameter_version: string;
    plugin_package_ids: string[];
    round_no: number;
    scenario_package_id: string;
    scenario_version: string;
    seed: number;
  };
  replay_comparison: {
    legacy_replay_hash: string;
    replay_result_digest: string;
    replay_result_hash: string;
    replay_status: RunReplayEvidence["replay_status"];
    replay_writes_formal_results: false;
  };
}

export function createM1CanonicalEvidenceDigest(input: M1CanonicalEvidenceDigestInput): string {
  return stableHash({
    evidence_kind: input.evidence_kind,
    evidence_semantics_version: input.evidence_semantics_version,
    frozen_input_semantics: input.frozen_input_semantics,
    replay_comparison: input.replay_comparison
  });
}

function latestDecisionForTeam(decisions: Decision[], teamId: string): Decision {
  const decision = decisions
    .filter((candidate) => candidate.team_id === teamId)
    .sort((left, right) => left.version - right.version)
    .at(-1);

  if (!decision) {
    throw new Error(`missing_decision:${teamId}`);
  }

  return decision;
}

function selectReplayDecisionBatch(input: CreateM1RunReplayEvidenceInput): Decision[] {
  return input.teams.map((team) => latestDecisionForTeam(input.decisions, team.team_id));
}

function createDecisionBatchHash(decisions: Decision[]): string {
  return stableHash(
    decisions.map((decision) => ({
      canonical_source: decision.canonical_source,
      decision_id: decision.decision_id,
      merge_commit_id: decision.merge_commit_id,
      payload: decision.payload,
      round_id: decision.round_id,
      round_no: decision.round_no,
      submitted_by: decision.submitted_by,
      team_confirmation_id: decision.team_confirmation_id,
      team_id: decision.team_id,
      version: decision.version
    }))
  );
}

function createRuntimeSourceDigest(input: {
  parameterSet: ParameterSet;
  scenario: ScenarioPackage;
}): string {
  return stableHash({
    decision_schema_version: DECISION_SCHEMA_VERSION,
    engine_id: ENGINE_ID,
    engine_version: ENGINE_VERSION,
    json_runtime_source_revision: JSON_RUNTIME_SOURCE_REVISION,
    mapper_version: MAPPER_VERSION,
    parameter_model_family: input.parameterSet.model_family,
    plugin_package_ids: input.scenario.plugin_package_ids ?? [],
    scenario_version: input.scenario.version
  });
}

function createManifest(input: CreateM1RunReplayEvidenceInput): ComputationalRunManifestV1 {
  const decisionBatch = selectReplayDecisionBatch(input);
  const decisionBatchHash = createDecisionBatchHash(decisionBatch);
  const manifestIdentity = {
    round_id: input.round.round_id,
    run_id: input.run.run_id,
    source_result_id: input.settlement.settlement_result_id,
    tenant_id: input.run.tenant_id
  };

  return {
    schema_version: "run-manifest.v1",
    evidence_semantics_version: EVIDENCE_SEMANTICS_VERSION,
    evidence_kind: EVIDENCE_KIND,
    manifest_id: `manifest_${stableHash(manifestIdentity).slice(0, 16)}`,
    tenant_id: input.run.tenant_id,
    course_id: input.run.course_id,
    run_id: input.run.run_id,
    round_id: input.round.round_id,
    round_no: input.round.round_no,
    source_result_id: input.settlement.settlement_result_id,
    scenario_package_id: input.scenario.scenario_package_id,
    scenario_version: input.scenario.version,
    parameter_set_id: input.parameterSet.parameter_set_id,
    parameter_version: input.parameterSet.version,
    parameter_model_family: input.parameterSet.model_family,
    plugin_package_ids: [...(input.scenario.plugin_package_ids ?? [])],
    engine_id: ENGINE_ID,
    engine_version: ENGINE_VERSION,
    mapper_version: MAPPER_VERSION,
    decision_schema_version: DECISION_SCHEMA_VERSION,
    seed: input.run.seed,
    ...(input.round.decision_batch_id ? { decision_batch_id: input.round.decision_batch_id } : {}),
    decision_batch_hash: decisionBatchHash,
    json_runtime_source_revision: JSON_RUNTIME_SOURCE_REVISION,
    json_runtime_source_digest: createRuntimeSourceDigest(input),
    replay_hash: input.settlement.replay_hash,
    excluded_from_truth_hash: [
      "ai_advisory",
      "learning_evidence",
      "role_drafts",
      "billing_entitlement",
      "teacher_private_notes"
    ]
  };
}

function toPublicEvidence(
  manifest: ComputationalRunManifestV1,
  evidence: Omit<RunReplayEvidence, "public_view">
): PublicRunReplayEvidence {
  return {
    evidence_semantics_version: manifest.evidence_semantics_version,
    evidence_kind: manifest.evidence_kind,
    manifest_id: manifest.manifest_id,
    manifest_hash: evidence.manifest_hash,
    manifest_version: manifest.schema_version,
    source_result_id: manifest.source_result_id,
    canonical_evidence_digest: evidence.canonical_evidence_digest,
    replay_status: evidence.replay_status,
    replay_result_hash: evidence.replay_result_hash,
    replay_writes_formal_results: false,
    frozen_inputs: {
      course_id: manifest.course_id,
      run_id: manifest.run_id,
      round_id: manifest.round_id,
      round_no: manifest.round_no,
      scenario_package_id: manifest.scenario_package_id,
      parameter_set_id: manifest.parameter_set_id,
      seed: manifest.seed,
      engine_id: manifest.engine_id,
      decision_batch_hash: manifest.decision_batch_hash
    }
  };
}

function createCanonicalEvidenceDigestInput(
  manifest: ComputationalRunManifestV1,
  evidence: Omit<RunReplayEvidence, "public_view" | "canonical_evidence_digest">
): M1CanonicalEvidenceDigestInput {
  return {
    evidence_kind: manifest.evidence_kind,
    evidence_semantics_version: manifest.evidence_semantics_version,
    frozen_input_semantics: {
      decision_batch_hash: manifest.decision_batch_hash,
      decision_schema_version: manifest.decision_schema_version,
      engine_id: manifest.engine_id,
      engine_version: manifest.engine_version,
      json_runtime_source_digest: manifest.json_runtime_source_digest,
      json_runtime_source_revision: manifest.json_runtime_source_revision,
      mapper_version: manifest.mapper_version,
      parameter_model_family: manifest.parameter_model_family,
      parameter_set_id: manifest.parameter_set_id,
      parameter_version: manifest.parameter_version,
      plugin_package_ids: manifest.plugin_package_ids,
      round_no: manifest.round_no,
      scenario_package_id: manifest.scenario_package_id,
      scenario_version: manifest.scenario_version,
      seed: manifest.seed
    },
    replay_comparison: {
      legacy_replay_hash: manifest.replay_hash,
      replay_result_digest: evidence.replay_result_digest,
      replay_result_hash: evidence.replay_result_hash,
      replay_status: evidence.replay_status,
      replay_writes_formal_results: evidence.replay_writes_formal_results
    }
  };
}

export function createM1RunReplayEvidence(
  input: CreateM1RunReplayEvidenceInput
): RunReplayEvidence {
  const replayDecisions = selectReplayDecisionBatch(input);
  const preview = previewSettlementReplay({
    decisions: replayDecisions,
    parameterSet: input.parameterSet,
    round: input.round,
    run: input.run,
    scenario: input.scenario,
    teams: input.teams
  });
  const manifest = createManifest(input);
  const manifestHash = stableHash(manifest);
  const replayResultDigest = stableHash({
    replay_hash: preview.replay_hash,
    team_results: preview.team_results
  });
  const sourceResultDigest = stableHash({
    replay_hash: input.settlement.replay_hash,
    team_results: input.settlement.team_results
  });
  const replayMatched =
    preview.replay_hash === input.settlement.replay_hash &&
    replayResultDigest === sourceResultDigest;
  const evidenceWithoutDigest: Omit<
    RunReplayEvidence,
    "canonical_evidence_digest" | "public_view"
  > = {
    manifest,
    manifest_hash: manifestHash,
    source_result_id: input.settlement.settlement_result_id,
    replay_status: replayMatched ? "matched" : "mismatched",
    replay_result_hash: preview.replay_hash,
    replay_result_digest: replayResultDigest,
    replay_writes_formal_results: false
  };
  const canonicalEvidenceDigest = createM1CanonicalEvidenceDigest(
    createCanonicalEvidenceDigestInput(manifest, evidenceWithoutDigest)
  );
  const evidenceWithoutPublicView: Omit<RunReplayEvidence, "public_view"> = {
    ...evidenceWithoutDigest,
    canonical_evidence_digest: canonicalEvidenceDigest
  };

  return {
    ...evidenceWithoutPublicView,
    public_view: toPublicEvidence(manifest, evidenceWithoutPublicView)
  };
}

export function selectM1RunReplayEvidenceGolden(evidence: RunReplayEvidence) {
  return {
    manifest: {
      schema_version: evidence.manifest.schema_version,
      evidence_semantics_version: evidence.manifest.evidence_semantics_version,
      evidence_kind: evidence.manifest.evidence_kind,
      course_id: evidence.manifest.course_id,
      round_no: evidence.manifest.round_no,
      scenario_package_id: evidence.manifest.scenario_package_id,
      scenario_version: evidence.manifest.scenario_version,
      parameter_set_id: evidence.manifest.parameter_set_id,
      parameter_version: evidence.manifest.parameter_version,
      parameter_model_family: evidence.manifest.parameter_model_family,
      plugin_package_ids: evidence.manifest.plugin_package_ids,
      engine_id: evidence.manifest.engine_id,
      engine_version: evidence.manifest.engine_version,
      mapper_version: evidence.manifest.mapper_version,
      decision_schema_version: evidence.manifest.decision_schema_version,
      seed: evidence.manifest.seed,
      decision_batch_hash: evidence.manifest.decision_batch_hash,
      json_runtime_source_revision: evidence.manifest.json_runtime_source_revision,
      json_runtime_source_digest: evidence.manifest.json_runtime_source_digest,
      replay_hash: evidence.manifest.replay_hash,
      excluded_from_truth_hash: evidence.manifest.excluded_from_truth_hash
    },
    replay: {
      replay_status: evidence.replay_status,
      replay_result_hash: evidence.replay_result_hash,
      replay_result_digest: evidence.replay_result_digest,
      canonical_evidence_digest: evidence.canonical_evidence_digest,
      replay_writes_formal_results: evidence.replay_writes_formal_results
    }
  };
}
