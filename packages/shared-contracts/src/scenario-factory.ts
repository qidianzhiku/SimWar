export const R7_SCENARIO_FACTORY_SOURCE_MASTER_SHA =
  "33b0983859d4f01a48d298ee2f23253ffb8455fc" as const;

export const R7_SCENARIO_FACTORY_SOURCE_KINDS = [
  "synthetic_internal_seed",
  "teacher_authored_draft"
] as const;

export const R7_SCENARIO_FACTORY_REQUIRED_FIELDS = [
  "scenario_package_id",
  "scenario_version",
  "parameter_set_id",
  "parameter_set_version",
  "plugin_package_id",
  "plugin_package_version",
  "seed",
  "teaching_objectives",
  "privacy_classification",
  "license_provenance_id",
  "qa_record_id"
] as const;

export const R7_SCENARIO_FACTORY_FORBIDDEN_WRITES = [
  "state_true",
  "SettlementResult",
  "score",
  "rank",
  "truth_hash",
  "replay_hash",
  "manifest_hash",
  "canonical_evidence_digest",
  "official_parameter_set",
  "official_replay_result",
  "plugin_runtime_trace",
  "ai_formal_output"
] as const;

export const R7_SCENARIO_FACTORY_EXPLICIT_NON_PROOFS = [
  "Seed package != Scenario Factory runtime",
  "Seed package != R8-G1 release",
  "Seed package != Teacher rehearsal",
  "Seed package != Pilot readiness",
  "Seed package != Production readiness",
  "Seed package != PostgreSQL runtime readiness",
  "Seed package != durable settlement proof"
] as const;

export type R7ScenarioFactorySourceKind = (typeof R7_SCENARIO_FACTORY_SOURCE_KINDS)[number];
export type R7ScenarioFactoryRequiredField = (typeof R7_SCENARIO_FACTORY_REQUIRED_FIELDS)[number];
export type R7ScenarioFactoryForbiddenWrite = (typeof R7_SCENARIO_FACTORY_FORBIDDEN_WRITES)[number];
export type R7ScenarioFactoryExplicitNonProof =
  (typeof R7_SCENARIO_FACTORY_EXPLICIT_NON_PROOFS)[number];

export interface R7ScenarioFactorySourceRegistry {
  source_kinds: readonly R7ScenarioFactorySourceKind[];
  source_metadata_required: readonly [
    "source_kind",
    "source_owner",
    "source_version",
    "license_provenance_id",
    "qa_record_id"
  ];
  teacher_authored_draft_requires_owner_review: true;
}

export interface R7ScenarioFactoryTemplateManifest {
  template_id: "r7-scenario-factory-mvp-template-v1";
  template_status: "INTERNAL_ONLY_DRAFT";
  required_fields: readonly R7ScenarioFactoryRequiredField[];
  field_dictionary_ref: "docs/architecture/r7-scenario-factory-mvp.md#template-field-dictionary";
  scenario_reference_boundary: {
    scenario_package_id_required: true;
    parameter_set_id_required: true;
    plugin_package_id_required: true;
    seed_required: true;
  };
}

export interface R7ScenarioFactoryEvidenceLedgerEntry {
  evidence_id: string;
  evidence_type: "SOURCE_METADATA" | "TEMPLATE_FIELD" | "QA_RECORD" | "LICENSE_PROVENANCE";
  evidence_label: "CONTRACT_BACKED_EVIDENCE" | "SOURCE_ONLY_INFERENCE";
  status: "PRESENT";
}

export interface R7ScenarioFactoryLicenseProvenanceRecord {
  license_provenance_id: string;
  provenance_status: "INTERNAL_SYNTHETIC_ONLY";
  external_license_review_required_before_release: true;
}

export interface R7ScenarioFactoryQaRecord {
  qa_record_id: string;
  qa_status: "DRAFT_REVIEW_REQUIRED";
  teacher_rehearsal_required_before_release: true;
  hidden_unicode_check_required: true;
}

export interface R7ScenarioFactoryCalibrationBatch {
  calibration_batch_id: "r7-scenario-factory-calibration-draft-v1";
  status: "DRAFT_ONLY";
  writes_parameter_set: false;
  writes_plugin_package: false;
  writes_scenario_package: false;
}

export interface R7ScenarioFactoryParameterShadowReplayBoundary {
  official_parameter_set_write: false;
  shadow_replay_writes_formal_results: false;
  replay_writes_formal_results: false;
  parameter_set_versioning_required_before_runtime_release: true;
}

export interface R7TeacherScenarioSelectionBoundary {
  allowed_actions: readonly [
    "preview_seed_package",
    "select_internal_draft_for_rehearsal",
    "request_owner_review"
  ];
  forbidden_actions: readonly [
    "write_state_true",
    "write_settlement_result",
    "publish_runtime_scenario",
    "modify_official_parameter_set"
  ];
  direct_store_delta: "NONE";
}

export interface R7ScenarioFactoryRuntimeAuthorization {
  ai_runtime: "NOT_AUTHORIZED";
  durable_settlement: "NOT_PROVEN";
  pilot: "NOT_AUTHORIZED";
  plugin_runtime: "NOT_AUTHORIZED";
  postgresql_runtime: "NOT_AUTHORIZED";
  production: "NOT_AUTHORIZED";
  scenario_factory_runtime_route: "NOT_AUTHORIZED";
}

export interface R7ScenarioFactorySeedPackage {
  calibration_batch: R7ScenarioFactoryCalibrationBatch;
  direct_store_delta: "NONE";
  docs: readonly [
    "docs/architecture/r7-scenario-factory-mvp.md",
    "docs/quality/r7-scenario-evidence-ledger.md",
    "docs/quality/r7-scenario-license-provenance-register.md",
    "docs/quality/r7-scenario-qa-register.md",
    "docs/operations/r7-teacher-scenario-selection-boundary.md"
  ];
  evidence_kind: "r7_scenario_factory_seed_package";
  evidence_ledger: readonly R7ScenarioFactoryEvidenceLedgerEntry[];
  evidence_version: "r7-scenario-factory-seed-package.v1";
  explicit_non_proofs: typeof R7_SCENARIO_FACTORY_EXPLICIT_NON_PROOFS;
  forbidden_writes: typeof R7_SCENARIO_FACTORY_FORBIDDEN_WRITES;
  g0_pass: "NOT_GRANTED";
  g0_status: "EXCEPTION";
  l1_status: "NOT_READY";
  license_provenance_register: readonly R7ScenarioFactoryLicenseProvenanceRecord[];
  parameter_shadow_replay_boundary: R7ScenarioFactoryParameterShadowReplayBoundary;
  qa_register: readonly R7ScenarioFactoryQaRecord[];
  r8_g1_status: "INTERNAL_ONLY_DRAFT_NOT_RELEASED";
  runtime_authorization: R7ScenarioFactoryRuntimeAuthorization;
  source_master_sha: typeof R7_SCENARIO_FACTORY_SOURCE_MASTER_SHA;
  source_registry: R7ScenarioFactorySourceRegistry;
  status: "SEED_PACKAGE_ONLY";
  teacher_selection_boundary: R7TeacherScenarioSelectionBoundary;
  template_manifest: R7ScenarioFactoryTemplateManifest;
}

export interface R7ScenarioFactorySeedPackageValidationResult {
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

export function createR7ScenarioFactorySeedPackage(): R7ScenarioFactorySeedPackage {
  return {
    calibration_batch: {
      calibration_batch_id: "r7-scenario-factory-calibration-draft-v1",
      status: "DRAFT_ONLY",
      writes_parameter_set: false,
      writes_plugin_package: false,
      writes_scenario_package: false
    },
    direct_store_delta: "NONE",
    docs: [
      "docs/architecture/r7-scenario-factory-mvp.md",
      "docs/quality/r7-scenario-evidence-ledger.md",
      "docs/quality/r7-scenario-license-provenance-register.md",
      "docs/quality/r7-scenario-qa-register.md",
      "docs/operations/r7-teacher-scenario-selection-boundary.md"
    ],
    evidence_kind: "r7_scenario_factory_seed_package",
    evidence_ledger: [
      {
        evidence_id: "r7-source-metadata",
        evidence_label: "CONTRACT_BACKED_EVIDENCE",
        evidence_type: "SOURCE_METADATA",
        status: "PRESENT"
      },
      {
        evidence_id: "r7-template-field-dictionary",
        evidence_label: "CONTRACT_BACKED_EVIDENCE",
        evidence_type: "TEMPLATE_FIELD",
        status: "PRESENT"
      },
      {
        evidence_id: "r7-license-provenance",
        evidence_label: "SOURCE_ONLY_INFERENCE",
        evidence_type: "LICENSE_PROVENANCE",
        status: "PRESENT"
      },
      {
        evidence_id: "r7-qa-record",
        evidence_label: "SOURCE_ONLY_INFERENCE",
        evidence_type: "QA_RECORD",
        status: "PRESENT"
      }
    ],
    evidence_version: "r7-scenario-factory-seed-package.v1",
    explicit_non_proofs: R7_SCENARIO_FACTORY_EXPLICIT_NON_PROOFS,
    forbidden_writes: R7_SCENARIO_FACTORY_FORBIDDEN_WRITES,
    g0_pass: "NOT_GRANTED",
    g0_status: "EXCEPTION",
    l1_status: "NOT_READY",
    license_provenance_register: [
      {
        external_license_review_required_before_release: true,
        license_provenance_id: "r7-license-provenance-internal-synthetic-v1",
        provenance_status: "INTERNAL_SYNTHETIC_ONLY"
      }
    ],
    parameter_shadow_replay_boundary: {
      official_parameter_set_write: false,
      parameter_set_versioning_required_before_runtime_release: true,
      replay_writes_formal_results: false,
      shadow_replay_writes_formal_results: false
    },
    qa_register: [
      {
        hidden_unicode_check_required: true,
        qa_record_id: "r7-qa-internal-draft-v1",
        qa_status: "DRAFT_REVIEW_REQUIRED",
        teacher_rehearsal_required_before_release: true
      }
    ],
    r8_g1_status: "INTERNAL_ONLY_DRAFT_NOT_RELEASED",
    runtime_authorization: {
      ai_runtime: "NOT_AUTHORIZED",
      durable_settlement: "NOT_PROVEN",
      pilot: "NOT_AUTHORIZED",
      plugin_runtime: "NOT_AUTHORIZED",
      postgresql_runtime: "NOT_AUTHORIZED",
      production: "NOT_AUTHORIZED",
      scenario_factory_runtime_route: "NOT_AUTHORIZED"
    },
    source_master_sha: R7_SCENARIO_FACTORY_SOURCE_MASTER_SHA,
    source_registry: {
      source_kinds: R7_SCENARIO_FACTORY_SOURCE_KINDS,
      source_metadata_required: [
        "source_kind",
        "source_owner",
        "source_version",
        "license_provenance_id",
        "qa_record_id"
      ],
      teacher_authored_draft_requires_owner_review: true
    },
    status: "SEED_PACKAGE_ONLY",
    teacher_selection_boundary: {
      allowed_actions: [
        "preview_seed_package",
        "select_internal_draft_for_rehearsal",
        "request_owner_review"
      ],
      direct_store_delta: "NONE",
      forbidden_actions: [
        "write_state_true",
        "write_settlement_result",
        "publish_runtime_scenario",
        "modify_official_parameter_set"
      ]
    },
    template_manifest: {
      field_dictionary_ref:
        "docs/architecture/r7-scenario-factory-mvp.md#template-field-dictionary",
      required_fields: R7_SCENARIO_FACTORY_REQUIRED_FIELDS,
      scenario_reference_boundary: {
        parameter_set_id_required: true,
        plugin_package_id_required: true,
        scenario_package_id_required: true,
        seed_required: true
      },
      template_id: "r7-scenario-factory-mvp-template-v1",
      template_status: "INTERNAL_ONLY_DRAFT"
    }
  };
}

export function validateR7ScenarioFactorySeedPackage(
  value: unknown
): R7ScenarioFactorySeedPackageValidationResult {
  const issues: string[] = [];

  if (!isRecord(value)) {
    return {
      issues: ["R7_SCENARIO_FACTORY_SEED_PACKAGE_NOT_OBJECT"],
      ok: false
    };
  }

  const candidate = value as Partial<R7ScenarioFactorySeedPackage>;

  requireCondition(
    issues,
    candidate.evidence_kind === "r7_scenario_factory_seed_package",
    "R7_SCENARIO_FACTORY_EVIDENCE_KIND_INVALID"
  );
  requireCondition(
    issues,
    candidate.source_master_sha === R7_SCENARIO_FACTORY_SOURCE_MASTER_SHA,
    "R7_SCENARIO_FACTORY_SOURCE_MASTER_SHA_INVALID"
  );
  requireCondition(
    issues,
    candidate.status === "SEED_PACKAGE_ONLY" &&
      candidate.g0_status === "EXCEPTION" &&
      candidate.g0_pass === "NOT_GRANTED" &&
      candidate.l1_status === "NOT_READY",
    "R7_SCENARIO_FACTORY_STATUS_BOUNDARY_DRIFT"
  );
  requireCondition(
    issues,
    candidate.direct_store_delta === "NONE",
    "R7_SCENARIO_FACTORY_DIRECT_STORE_DELTA_NOT_ALLOWED"
  );
  requireCondition(
    issues,
    candidate.runtime_authorization?.scenario_factory_runtime_route === "NOT_AUTHORIZED" &&
      candidate.runtime_authorization?.ai_runtime === "NOT_AUTHORIZED" &&
      candidate.runtime_authorization?.plugin_runtime === "NOT_AUTHORIZED" &&
      candidate.runtime_authorization?.postgresql_runtime === "NOT_AUTHORIZED" &&
      candidate.runtime_authorization?.durable_settlement === "NOT_PROVEN",
    "R7_SCENARIO_FACTORY_RUNTIME_AUTHORIZATION_DRIFT"
  );
  requireCondition(
    issues,
    candidate.parameter_shadow_replay_boundary?.official_parameter_set_write === false &&
      candidate.parameter_shadow_replay_boundary?.shadow_replay_writes_formal_results === false &&
      candidate.parameter_shadow_replay_boundary?.replay_writes_formal_results === false,
    "R7_SCENARIO_FACTORY_PARAMETER_OR_REPLAY_WRITE_DRIFT"
  );
  requireCondition(
    issues,
    R7_SCENARIO_FACTORY_FORBIDDEN_WRITES.every((write) =>
      candidate.forbidden_writes?.includes(write)
    ),
    "R7_SCENARIO_FACTORY_FORBIDDEN_WRITE_LIST_INCOMPLETE"
  );
  requireCondition(
    issues,
    R7_SCENARIO_FACTORY_REQUIRED_FIELDS.every((field) =>
      candidate.template_manifest?.required_fields.includes(field)
    ),
    "R7_SCENARIO_FACTORY_REQUIRED_FIELD_LIST_INCOMPLETE"
  );
  requireCondition(
    issues,
    candidate.teacher_selection_boundary?.direct_store_delta === "NONE" &&
      candidate.teacher_selection_boundary?.forbidden_actions.includes("write_state_true") === true,
    "R7_SCENARIO_FACTORY_TEACHER_SELECTION_BOUNDARY_DRIFT"
  );

  return {
    issues,
    ok: issues.length === 0
  };
}
