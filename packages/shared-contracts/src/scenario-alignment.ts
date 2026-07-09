import {
  createR7ScenarioFactorySeedPackage,
  R7_SCENARIO_FACTORY_FORBIDDEN_WRITES,
  R7_SCENARIO_FACTORY_SOURCE_MASTER_SHA,
  type R7ScenarioFactorySeedPackage
} from "./scenario-factory.js";

export const R7_SCENARIO_ALIGNMENT_SOURCE_MASTER_SHA =
  "2038c8f0ebaa762461cd1140565426e37a268b2c" as const;

export const R7_SCENARIO_ALIGNMENT_EXPLICIT_NON_PROOFS = [
  "ParameterSet alignment != official ParameterSet write",
  "Shadow Replay alignment != Shadow Replay execution",
  "Shadow Replay alignment != official result overwrite",
  "Alignment package != Scenario Factory runtime",
  "Alignment package != R8-G1 release",
  "Alignment package != Teacher rehearsal",
  "Alignment package != Pilot readiness",
  "Alignment package != Production readiness"
] as const;

export type R7ScenarioAlignmentExplicitNonProof =
  (typeof R7_SCENARIO_ALIGNMENT_EXPLICIT_NON_PROOFS)[number];

export interface R7ScenarioAlignmentSeedPackageReference {
  seed_package_evidence_version: "r7-scenario-factory-seed-package.v1";
  seed_package_source_master_sha: typeof R7_SCENARIO_FACTORY_SOURCE_MASTER_SHA;
  status: "SEED_PACKAGE_MERGED_AND_POSTMERGE_VALIDATED";
}

export interface R7ScenarioParameterSetCompatibilityEntry {
  status: "COMPATIBLE_BY_REFERENCE_ONLY";
  proof_scope: readonly [
    "scenario_package_id",
    "parameter_set_id",
    "parameter_set_version",
    "plugin_package_id",
    "seed"
  ];
  required_future_gate: "OWNER_AUTHORIZED_PARAMETERSET_VERSION_REVIEW";
  explicit_non_proof: "does_not_write_official_parameter_set";
}

export interface R7ScenarioShadowReplayCompatibilityEntry {
  status: "SHADOW_REPLAY_REFERENCE_ONLY_NON_OVERWRITE";
  proof_scope: readonly [
    "shadow_replay_reference",
    "non_overwrite_boundary",
    "future_execution_guard"
  ];
  required_future_gate: "OWNER_AUTHORIZED_SHADOW_REPLAY_EXECUTION_GUARD";
  explicit_non_proof: "does_not_execute_shadow_replay";
}

export interface R7ScenarioCompatibilityMatrix {
  parameter_set: R7ScenarioParameterSetCompatibilityEntry;
  shadow_replay: R7ScenarioShadowReplayCompatibilityEntry;
}

export interface R7ScenarioAlignmentParameterSetBoundary {
  official_parameter_set_write: false;
  parameter_set_version_mutation: false;
  parameter_set_versioning_required_before_runtime_release: true;
}

export interface R7ScenarioAlignmentShadowReplayBoundary {
  manifest_hash_semantics_changed: false;
  replay_hash_semantics_changed: false;
  replay_writes_formal_results: false;
  shadow_replay_executes: false;
  shadow_replay_overwrites_official_result: false;
  shadow_replay_writes_formal_results: false;
}

export interface R7ScenarioAlignmentCalibrationRegister {
  calibration_register_id: "r7-parameterset-shadow-replay-calibration-register-v1";
  status: "DRAFT_REGISTER_ONLY";
  writes_official_result: false;
  writes_parameter_set: false;
  writes_plugin_package: false;
  writes_scenario_package: false;
}

export interface R7TeacherScenarioSelectionNextSlice {
  allowed_actions: readonly [
    "preview_alignment_matrix",
    "compare_internal_seed_references",
    "request_owner_parameter_review"
  ];
  forbidden_actions: readonly [
    "write_state_true",
    "write_settlement_result",
    "publish_runtime_scenario",
    "modify_official_parameter_set",
    "execute_shadow_replay",
    "overwrite_official_replay_result"
  ];
  direct_store_delta: "NONE";
}

export interface R7ScenarioAlignmentRuntimeAuthorization {
  ai_runtime: "NOT_AUTHORIZED";
  durable_settlement: "NOT_PROVEN";
  pilot: "NOT_AUTHORIZED";
  plugin_runtime: "NOT_AUTHORIZED";
  postgresql_runtime: "NOT_AUTHORIZED";
  production: "NOT_AUTHORIZED";
  scenario_factory_runtime_route: "NOT_AUTHORIZED";
  shadow_replay_runtime: "NOT_AUTHORIZED";
}

export interface R7ScenarioParameterShadowReplayAlignmentPackage {
  calibration_register: R7ScenarioAlignmentCalibrationRegister;
  compatibility_matrix: R7ScenarioCompatibilityMatrix;
  direct_store_delta: "NONE";
  docs: readonly [
    "docs/architecture/r7-scenario-parameterset-shadow-replay-alignment.md",
    "docs/quality/r7-scenario-compatibility-matrix.md",
    "docs/quality/r7-scenario-evidence-ledger.md",
    "docs/quality/r7-scenario-calibration-register.md",
    "docs/operations/r7-teacher-scenario-selection-boundary.md"
  ];
  evidence_kind: "r7_scenario_parameterset_shadow_replay_alignment";
  evidence_version: "r7-scenario-parameterset-shadow-replay-alignment.v1";
  explicit_non_proofs: typeof R7_SCENARIO_ALIGNMENT_EXPLICIT_NON_PROOFS;
  forbidden_writes: typeof R7_SCENARIO_FACTORY_FORBIDDEN_WRITES;
  g0_pass: "NOT_GRANTED";
  g0_status: "EXCEPTION";
  l1_status: "NOT_READY";
  parameter_set_boundary: R7ScenarioAlignmentParameterSetBoundary;
  r8_g1_status: "INTERNAL_ONLY_DRAFT_NOT_RELEASED";
  runtime_authorization: R7ScenarioAlignmentRuntimeAuthorization;
  seed_package_reference: R7ScenarioAlignmentSeedPackageReference;
  shadow_replay_boundary: R7ScenarioAlignmentShadowReplayBoundary;
  source_master_sha: typeof R7_SCENARIO_ALIGNMENT_SOURCE_MASTER_SHA;
  teacher_selection_next_slice: R7TeacherScenarioSelectionNextSlice;
}

export interface R7ScenarioParameterShadowReplayAlignmentValidationResult {
  issues: string[];
  ok: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requireCondition(issues: string[], condition: boolean, issue: string): void {
  if (!condition) {
    issues.push(issue);
  }
}

export function createR7ScenarioParameterShadowReplayAlignmentPackage(
  seedPackage: R7ScenarioFactorySeedPackage = createR7ScenarioFactorySeedPackage()
): R7ScenarioParameterShadowReplayAlignmentPackage {
  return {
    calibration_register: {
      calibration_register_id: "r7-parameterset-shadow-replay-calibration-register-v1",
      status: "DRAFT_REGISTER_ONLY",
      writes_official_result: false,
      writes_parameter_set: false,
      writes_plugin_package: false,
      writes_scenario_package: false
    },
    compatibility_matrix: {
      parameter_set: {
        explicit_non_proof: "does_not_write_official_parameter_set",
        proof_scope: [
          "scenario_package_id",
          "parameter_set_id",
          "parameter_set_version",
          "plugin_package_id",
          "seed"
        ],
        required_future_gate: "OWNER_AUTHORIZED_PARAMETERSET_VERSION_REVIEW",
        status: "COMPATIBLE_BY_REFERENCE_ONLY"
      },
      shadow_replay: {
        explicit_non_proof: "does_not_execute_shadow_replay",
        proof_scope: [
          "shadow_replay_reference",
          "non_overwrite_boundary",
          "future_execution_guard"
        ],
        required_future_gate: "OWNER_AUTHORIZED_SHADOW_REPLAY_EXECUTION_GUARD",
        status: "SHADOW_REPLAY_REFERENCE_ONLY_NON_OVERWRITE"
      }
    },
    direct_store_delta: "NONE",
    docs: [
      "docs/architecture/r7-scenario-parameterset-shadow-replay-alignment.md",
      "docs/quality/r7-scenario-compatibility-matrix.md",
      "docs/quality/r7-scenario-evidence-ledger.md",
      "docs/quality/r7-scenario-calibration-register.md",
      "docs/operations/r7-teacher-scenario-selection-boundary.md"
    ],
    evidence_kind: "r7_scenario_parameterset_shadow_replay_alignment",
    evidence_version: "r7-scenario-parameterset-shadow-replay-alignment.v1",
    explicit_non_proofs: R7_SCENARIO_ALIGNMENT_EXPLICIT_NON_PROOFS,
    forbidden_writes: R7_SCENARIO_FACTORY_FORBIDDEN_WRITES,
    g0_pass: "NOT_GRANTED",
    g0_status: "EXCEPTION",
    l1_status: "NOT_READY",
    parameter_set_boundary: {
      official_parameter_set_write: false,
      parameter_set_version_mutation: false,
      parameter_set_versioning_required_before_runtime_release: true
    },
    r8_g1_status: "INTERNAL_ONLY_DRAFT_NOT_RELEASED",
    runtime_authorization: {
      ai_runtime: "NOT_AUTHORIZED",
      durable_settlement: "NOT_PROVEN",
      pilot: "NOT_AUTHORIZED",
      plugin_runtime: "NOT_AUTHORIZED",
      postgresql_runtime: "NOT_AUTHORIZED",
      production: "NOT_AUTHORIZED",
      scenario_factory_runtime_route: "NOT_AUTHORIZED",
      shadow_replay_runtime: "NOT_AUTHORIZED"
    },
    seed_package_reference: {
      seed_package_evidence_version: seedPackage.evidence_version,
      seed_package_source_master_sha: seedPackage.source_master_sha,
      status: "SEED_PACKAGE_MERGED_AND_POSTMERGE_VALIDATED"
    },
    shadow_replay_boundary: {
      manifest_hash_semantics_changed: false,
      replay_hash_semantics_changed: false,
      replay_writes_formal_results: false,
      shadow_replay_executes: false,
      shadow_replay_overwrites_official_result: false,
      shadow_replay_writes_formal_results: false
    },
    source_master_sha: R7_SCENARIO_ALIGNMENT_SOURCE_MASTER_SHA,
    teacher_selection_next_slice: {
      allowed_actions: [
        "preview_alignment_matrix",
        "compare_internal_seed_references",
        "request_owner_parameter_review"
      ],
      direct_store_delta: "NONE",
      forbidden_actions: [
        "write_state_true",
        "write_settlement_result",
        "publish_runtime_scenario",
        "modify_official_parameter_set",
        "execute_shadow_replay",
        "overwrite_official_replay_result"
      ]
    }
  };
}

export function validateR7ScenarioParameterShadowReplayAlignmentPackage(
  value: unknown
): R7ScenarioParameterShadowReplayAlignmentValidationResult {
  const issues: string[] = [];

  if (!isRecord(value)) {
    return {
      issues: ["R7_ALIGNMENT_PACKAGE_NOT_OBJECT"],
      ok: false
    };
  }

  const candidate = value as Partial<R7ScenarioParameterShadowReplayAlignmentPackage>;

  requireCondition(
    issues,
    candidate.evidence_kind === "r7_scenario_parameterset_shadow_replay_alignment",
    "R7_ALIGNMENT_EVIDENCE_KIND_INVALID"
  );
  requireCondition(
    issues,
    candidate.source_master_sha === R7_SCENARIO_ALIGNMENT_SOURCE_MASTER_SHA,
    "R7_ALIGNMENT_SOURCE_MASTER_SHA_INVALID"
  );
  requireCondition(
    issues,
    candidate.seed_package_reference?.status === "SEED_PACKAGE_MERGED_AND_POSTMERGE_VALIDATED" &&
      candidate.seed_package_reference?.seed_package_source_master_sha ===
        R7_SCENARIO_FACTORY_SOURCE_MASTER_SHA,
    "R7_ALIGNMENT_SEED_PACKAGE_REFERENCE_INVALID"
  );
  requireCondition(
    issues,
    candidate.g0_status === "EXCEPTION" &&
      candidate.g0_pass === "NOT_GRANTED" &&
      candidate.l1_status === "NOT_READY" &&
      candidate.r8_g1_status === "INTERNAL_ONLY_DRAFT_NOT_RELEASED",
    "R7_ALIGNMENT_STATUS_BOUNDARY_DRIFT"
  );
  requireCondition(
    issues,
    candidate.direct_store_delta === "NONE",
    "R7_ALIGNMENT_DIRECT_STORE_DELTA_NOT_ALLOWED"
  );
  requireCondition(
    issues,
    candidate.parameter_set_boundary?.official_parameter_set_write === false &&
      candidate.parameter_set_boundary?.parameter_set_version_mutation === false,
    "R7_ALIGNMENT_PARAMETERSET_WRITE_DRIFT"
  );
  requireCondition(
    issues,
    candidate.shadow_replay_boundary?.shadow_replay_executes === false &&
      candidate.shadow_replay_boundary?.shadow_replay_overwrites_official_result === false &&
      candidate.shadow_replay_boundary?.shadow_replay_writes_formal_results === false &&
      candidate.shadow_replay_boundary?.replay_writes_formal_results === false,
    "R7_ALIGNMENT_REPLAY_OVERWRITE_DRIFT"
  );
  requireCondition(
    issues,
    candidate.shadow_replay_boundary?.replay_hash_semantics_changed === false &&
      candidate.shadow_replay_boundary?.manifest_hash_semantics_changed === false,
    "R7_ALIGNMENT_REPLAY_HASH_SEMANTICS_DRIFT"
  );
  requireCondition(
    issues,
    candidate.runtime_authorization?.scenario_factory_runtime_route === "NOT_AUTHORIZED" &&
      candidate.runtime_authorization?.shadow_replay_runtime === "NOT_AUTHORIZED" &&
      candidate.runtime_authorization?.ai_runtime === "NOT_AUTHORIZED" &&
      candidate.runtime_authorization?.plugin_runtime === "NOT_AUTHORIZED" &&
      candidate.runtime_authorization?.postgresql_runtime === "NOT_AUTHORIZED" &&
      candidate.runtime_authorization?.durable_settlement === "NOT_PROVEN",
    "R7_ALIGNMENT_RUNTIME_AUTHORIZATION_DRIFT"
  );
  requireCondition(
    issues,
    R7_SCENARIO_FACTORY_FORBIDDEN_WRITES.every((write) =>
      candidate.forbidden_writes?.includes(write)
    ),
    "R7_ALIGNMENT_FORBIDDEN_WRITE_LIST_INCOMPLETE"
  );

  return {
    issues,
    ok: issues.length === 0
  };
}
