import { describe, expect, it } from "vitest";
import type {
  CoursePackageReference,
  ExperimentCourseEvidencePartition,
  ExperimentCourseModule,
  ExperimentCourseRole,
  ExperimentRoundDefinition,
  ModelEvidenceBindingInput,
  ModelVersionReference,
  ParameterSetReference,
  ScenarioCatalogEntry,
  ScenarioEditableAssets,
  ScenarioPackageReference
} from "@simwar/shared-contracts";
import {
  ProductizationError,
  ShanghaiProductizationService,
  stableProductizationDigest
} from "../../services/api/src/shanghai-productization-service.js";

const fixedNow = "2026-08-29T00:00:00.000Z";
const digest = (char: string): string => char.repeat(64);

function scenarioReference(
  scenario_package_id: string,
  tenant_id = "tenant-shanghai",
  version = "1.0.0",
  marker = "a"
): ScenarioPackageReference {
  return { content_digest: digest(marker), scenario_package_id, tenant_id, version };
}

function parameterReference(
  parameter_set_id = "parameter-wellness",
  marker = "b"
): ParameterSetReference {
  return { content_digest: digest(marker), parameter_set_id, version: "1.0.0" };
}

function modelReference(model_version_id = "model-spatial", marker = "c"): ModelVersionReference {
  return { content_digest: digest(marker), model_version_id, version: "1.0.0" };
}

function entry(id: string, overrides: Partial<ScenarioCatalogEntry> = {}): ScenarioCatalogEntry {
  const reference = overrides.scenario_reference ?? scenarioReference(id);
  return {
    catalog_entry_id: id,
    compatibility: {
      engine_id: "simulation-core",
      required_schema_version: "scenario-productization.v1",
      status: "COMPATIBLE",
      supported_profiles: ["STANDARD", "ADVANCED"]
    },
    consumer_readiness: "C1_NAMED_FORWARD",
    experience_profiles: ["STANDARD", "ADVANCED"],
    freshness: { collected_at: fixedNow, expires_at: null, status: "FRESH" },
    geography: id.includes("suzhou") ? "Suzhou" : id.includes("stub") ? "Synthetic" : "Shanghai",
    known_limits: ["candidate_only", "no_model_calibrated_claim"],
    qualification: {
      calibrated: false,
      evidence_refs: ["evidence:synthetic-golden"],
      reason: "synthetic evidence only",
      status: id.includes("m5") ? "NOT_ELIGIBLE" : "ELIGIBLE"
    },
    rights: {
      copy_allowed: true,
      expires_at: null,
      fork_allowed: true,
      license_status: "VALID",
      territory: "CN"
    },
    scenario_reference: reference,
    schema_version: "scenario-productization.v1",
    source: {
      confidence: "MEDIUM",
      geography: id.includes("suzhou") ? "Suzhou" : "Shanghai",
      provenance: "SYNTHETIC",
      sensitivity: "PUBLIC_SAFE",
      source_date: "2026-08-29",
      source_ref: "fixture:shanghai-productization",
      source_type: "SYNTHETIC",
      time_scope: "2026",
      usage_status: "APPROVED"
    },
    tenant_id: reference.tenant_id,
    theme: "eldercare operations",
    title: id,
    ...overrides
  };
}

const editable: ScenarioEditableAssets = {
  bundle_refs: ["SH:bundle:base"],
  cohort_refs: ["SH:cohort:eldercare"],
  geo_refs: ["SH:geo:shanghai"],
  policy_refs: ["SH:policy:public"],
  project_refs: ["SH:project:baseline"],
  teaching_refs: ["SH:teaching:executive"]
};

function round(round_no: number, scenario: ScenarioPackageReference): ExperimentRoundDefinition {
  return {
    decision_fields: ["price", "capacity", "service_quality"],
    model_version_reference: modelReference(),
    outcome_evidence_refs: [`outcome:r${round_no}`],
    parameter_set_reference: parameterReference(),
    process_evidence_refs: [`process:r${round_no}`],
    round_id: `round-${round_no}`,
    round_no,
    scenario_reference: scenario,
    seed: 100 + round_no,
    teaching_prompt: `Explain round ${round_no}`
  };
}

describe("Shanghai M7–M12 productization spine", () => {
  it("compiles and filters a qualified catalog, selects exact refs, and redacts students", () => {
    const service = new ShanghaiProductizationService({ now: () => fixedNow });
    const shanghai = entry("scenario-shanghai");
    const suzhou = entry("scenario-suzhou");
    const synthetic = entry("scenario-stub", {
      geography: "Synthetic",
      source: { ...entry("source").source, source_ref: "fixture:synthetic-stub" }
    });
    const catalog = service.compileScenarioCatalog([shanghai, suzhou, synthetic]);

    expect(service.filterScenarioCatalog(catalog, { geography: "Shanghai" })).toHaveLength(1);
    expect(
      service.selectScenarioCatalogEntry(catalog, {
        catalog_entry_id: shanghai.catalog_entry_id,
        expected_reference: shanghai.scenario_reference,
        selected_at: fixedNow,
        selected_by: "teacher-1",
        tenant_id: "tenant-shanghai"
      }).selected_reference
    ).toEqual(shanghai.scenario_reference);

    const student = service.projectScenarioCatalog(catalog, "STUDENT");
    expect(student.entries[0]).not.toHaveProperty("source");
    expect(student.entries[0]).not.toHaveProperty("content_digest");
    expect(JSON.stringify(student)).not.toContain("fixture:shanghai-productization");
  });

  it("keeps NOT_ELIGIBLE, expired, and digest-mismatched selections fail-closed", () => {
    const service = new ShanghaiProductizationService({ now: () => fixedNow });
    const blocked = entry("scenario-m5", {
      rights: { ...entry("rights").rights, expires_at: "2026-01-01T00:00:00.000Z" }
    });
    const catalog = service.compileScenarioCatalog([blocked]);
    expect(() =>
      service.selectScenarioCatalogEntry(catalog, {
        catalog_entry_id: blocked.catalog_entry_id,
        expected_reference: blocked.scenario_reference,
        selected_at: fixedNow,
        selected_by: "teacher-1",
        tenant_id: blocked.tenant_id
      })
    ).toThrowError(new ProductizationError("QUALIFICATION_BLOCKED"));

    const eligibleExpired = entry("scenario-expired", {
      rights: { ...entry("rights").rights, expires_at: "2026-01-01T00:00:00.000Z" }
    });
    const expiredCatalog = service.compileScenarioCatalog([eligibleExpired]);
    expect(() =>
      service.selectScenarioCatalogEntry(expiredCatalog, {
        catalog_entry_id: eligibleExpired.catalog_entry_id,
        expected_reference: eligibleExpired.scenario_reference,
        selected_at: fixedNow,
        selected_by: "teacher-1",
        tenant_id: eligibleExpired.tenant_id
      })
    ).toThrowError(new ProductizationError("RIGHTS_BLOCKED"));

    expect(() =>
      service.selectScenarioCatalogEntry(
        service.compileScenarioCatalog([entry("scenario-digest")]),
        {
          catalog_entry_id: "scenario-digest",
          expected_reference: scenarioReference("scenario-digest", "tenant-shanghai", "1.0.0", "f"),
          selected_at: fixedNow,
          selected_by: "teacher-1",
          tenant_id: "tenant-shanghai"
        }
      )
    ).toThrowError(new ProductizationError("DIGEST_MISMATCH"));
  });

  it("matches catalog versions by exact reference and uses the service clock for expiry", () => {
    const service = new ShanghaiProductizationService({ now: () => fixedNow });
    const versionOne = entry("scenario-versioned", {
      scenario_reference: scenarioReference("scenario-versioned", "tenant-shanghai", "1.0.0", "a")
    });
    const versionTwo = entry("scenario-versioned", {
      scenario_reference: scenarioReference("scenario-versioned", "tenant-shanghai", "2.0.0", "b")
    });
    const catalog = service.compileScenarioCatalog([versionOne, versionTwo]);
    expect(
      service.selectScenarioCatalogEntry(catalog, {
        catalog_entry_id: versionTwo.catalog_entry_id,
        expected_reference: versionTwo.scenario_reference,
        selected_at: fixedNow,
        selected_by: "teacher-1",
        tenant_id: "tenant-shanghai"
      }).selected_reference
    ).toEqual(versionTwo.scenario_reference);

    const expiredService = new ShanghaiProductizationService({
      now: () => "2026-10-01T00:00:00.000Z"
    });
    const expiring = entry("scenario-clock", {
      rights: { ...entry("rights").rights, expires_at: "2026-09-01T00:00:00.000Z" }
    });
    expect(() =>
      expiredService.selectScenarioCatalogEntry(expiredService.compileScenarioCatalog([expiring]), {
        catalog_entry_id: expiring.catalog_entry_id,
        expected_reference: expiring.scenario_reference,
        selected_at: "2026-08-01T00:00:00.000Z",
        selected_by: "teacher-1",
        tenant_id: "tenant-shanghai"
      })
    ).toThrowError(new ProductizationError("RIGHTS_BLOCKED"));
    expect(() =>
      service.selectScenarioCatalogEntry(catalog, {
        catalog_entry_id: versionOne.catalog_entry_id,
        expected_reference: versionOne.scenario_reference,
        selected_at: "not-a-timestamp",
        selected_by: "teacher-1",
        tenant_id: "tenant-shanghai"
      })
    ).toThrowError(new ProductizationError("CATALOG_ENTRY_INVALID"));
  });

  it("creates exact-base drafts, forks without overwrite, compares, validates, and freezes", () => {
    const service = new ShanghaiProductizationService({ now: () => fixedNow });
    const base = entry("scenario-shanghai");
    const draft = service.createScenarioDraft({
      base_reference: base.scenario_reference,
      created_by: "teacher-1",
      draft_id: "draft-base",
      editable_assets: editable,
      source_admission: {
        catalog_entry_id: base.catalog_entry_id,
        expires_at: null,
        fork_allowed: true,
        freshness_status: "FRESH",
        license_status: "VALID",
        qualification_status: "ELIGIBLE",
        source_owner: "SH"
      },
      tenant_id: base.tenant_id
    });
    expect(Object.isFrozen(base.scenario_reference)).toBe(false);
    expect(Object.isFrozen(editable)).toBe(false);
    const fork = service.forkScenarioDraft(draft, {
      created_by: "teacher-1",
      draft_id: "draft-fork",
      editable_assets: { ...editable, geo_refs: ["SH:geo:shanghai:suburb"] },
      parent_expected_digest: draft.content_digest,
      tenant_id: base.tenant_id
    });
    const diff = service.compareScenarioDrafts(draft, fork);
    expect(diff.changes.some((change) => change.path === "editable_assets.geo_refs")).toBe(true);
    expect(service.validateScenarioDraft(fork).qualification_impact).toBe("REVIEW_REQUIRED");
    const frozen = service.freezeScenarioDraft(fork);
    expect(frozen.status).toBe("FROZEN_CANDIDATE");
    expect(draft.status).toBe("DRAFT");
    expect(() =>
      service.createScenarioDraft({
        base_reference: { ...base.scenario_reference, version: "latest" },
        created_by: "teacher-1",
        draft_id: "draft-latest",
        editable_assets: editable,
        source_admission: {
          catalog_entry_id: base.catalog_entry_id,
          expires_at: null,
          fork_allowed: true,
          freshness_status: "FRESH",
          license_status: "VALID",
          qualification_status: "ELIGIBLE",
          source_owner: "SH"
        },
        tenant_id: base.tenant_id
      })
    ).toThrowError(new ProductizationError("EXACT_REFERENCE_REQUIRED"));
  });

  it("rejects non-SH assets and non-forkable source admission", () => {
    const service = new ShanghaiProductizationService({ now: () => fixedNow });
    const base = entry("scenario-shanghai");
    expect(() =>
      service.createScenarioDraft({
        base_reference: base.scenario_reference,
        created_by: "teacher-1",
        draft_id: "draft-foreign-asset",
        editable_assets: { ...editable, bundle_refs: ["FOREIGN:bundle:1"] },
        source_admission: {
          catalog_entry_id: base.catalog_entry_id,
          expires_at: null,
          fork_allowed: true,
          freshness_status: "FRESH",
          license_status: "VALID",
          qualification_status: "ELIGIBLE",
          source_owner: "SH"
        },
        tenant_id: base.tenant_id
      })
    ).toThrowError(new ProductizationError("TENANT_SCOPE_VIOLATION"));
    expect(() =>
      service.createScenarioDraft({
        base_reference: base.scenario_reference,
        created_by: "teacher-1",
        draft_id: "draft-no-fork",
        editable_assets: editable,
        source_admission: {
          catalog_entry_id: base.catalog_entry_id,
          expires_at: null,
          fork_allowed: false,
          freshness_status: "FRESH",
          license_status: "VALID",
          qualification_status: "ELIGIBLE",
          source_owner: "SH"
        },
        tenant_id: base.tenant_id
      })
    ).toThrowError(new ProductizationError("RIGHTS_BLOCKED"));
  });

  it("binds model evidence with UQ/OOD diagnostics and keeps formal writes off", () => {
    const service = new ShanghaiProductizationService({ now: () => fixedNow });
    const scenario = scenarioReference("scenario-shanghai");
    const input: ModelEvidenceBindingInput = {
      effective_period: "2026",
      evidence: [
        {
          feature_id: "demand",
          geography: "Shanghai",
          period: "2026",
          provenance: "SYNTHETIC",
          source_date: fixedNow,
          source_digest: digest("a"),
          source_expires_at: null,
          source_ref: "evidence:synthetic",
          unit: "people",
          value_digest: digest("d")
        }
      ],
      geography: "Shanghai",
      governance_context: {
        model_authority: "MAIN_MODEL_GOVERNANCE",
        model_reference_status: "EXACT_REFERENCE_PRESENT",
        parameter_authority: "MAIN_PARAMETER_SET_AUTHORITY",
        parameter_reference_status: "EXACT_REFERENCE_PRESENT",
        tenant_id: "tenant-shanghai"
      },
      model_version_reference: modelReference(),
      parameter_set_reference: parameterReference(),
      qualification_evidence: {
        calibrated: false,
        effective_at: fixedNow,
        expires_at: null,
        pack_digest: digest("e"),
        pack_id: "m5-reality-qualification-candidate",
        status: "ELIGIBLE",
        verification: "UPSTREAM_PACK_REFERENCE"
      },
      scenario_qualification: "ELIGIBLE",
      scenario_reference: scenario,
      supported_geographies: ["Shanghai"],
      supported_periods: ["2026"],
      unit_requirements: { demand: "people" }
    };
    const binding = service.bindModelEvidence(input);
    expect(binding.status).toBe("ELIGIBLE_CANDIDATE");
    expect(binding.formal_activation).toBe(false);
    expect(binding.provider_calls).toBe(0);
    expect(service.projectModelBinding(binding, "STUDENT")).not.toHaveProperty("binding");

    const blocked = service.bindModelEvidence({ ...input, scenario_qualification: "NOT_ELIGIBLE" });
    expect(blocked.status).toBe("NOT_ELIGIBLE");
    expect(blocked.diagnostics.why_not_bind).toContain("SCENARIO_QUALIFICATION_NOT_ELIGIBLE");
    expect(
      service.bindModelEvidence({
        ...input,
        geography: "Beijing"
      }).diagnostics.why_not_bind
    ).toContain("EVIDENCE_GEOGRAPHY_MISMATCH");
    const missingRequiredFeature = service.bindModelEvidence({
      ...input,
      unit_requirements: { demand: "people", capacity: "beds" }
    });
    expect(missingRequiredFeature.status).toBe("NOT_ELIGIBLE");
    expect(missingRequiredFeature.diagnostics.why_not_bind).toContain("EVIDENCE_MISSING:capacity");
  });

  it("assembles a two-module three-round package and keeps Standard/Advanced on one kernel", () => {
    const service = new ShanghaiProductizationService({ now: () => fixedNow });
    const scenario = scenarioReference("scenario-shanghai");
    const binding = service.bindModelEvidence({
      effective_period: "2026",
      evidence: [
        {
          feature_id: "demand",
          geography: "Shanghai",
          period: "2026",
          provenance: "SYNTHETIC",
          source_date: fixedNow,
          source_digest: digest("a"),
          source_expires_at: null,
          source_ref: "evidence:synthetic",
          unit: "people",
          value_digest: digest("d")
        }
      ],
      geography: "Shanghai",
      governance_context: {
        model_authority: "MAIN_MODEL_GOVERNANCE",
        model_reference_status: "EXACT_REFERENCE_PRESENT",
        parameter_authority: "MAIN_PARAMETER_SET_AUTHORITY",
        parameter_reference_status: "EXACT_REFERENCE_PRESENT",
        tenant_id: "tenant-shanghai"
      },
      model_version_reference: modelReference(),
      parameter_set_reference: parameterReference(),
      qualification_evidence: {
        calibrated: false,
        effective_at: fixedNow,
        expires_at: null,
        pack_digest: digest("e"),
        pack_id: "m5-reality-qualification-candidate",
        status: "ELIGIBLE",
        verification: "UPSTREAM_PACK_REFERENCE"
      },
      scenario_qualification: "ELIGIBLE",
      scenario_reference: scenario,
      supported_geographies: ["Shanghai"],
      supported_periods: ["2026"],
      unit_requirements: { demand: "people" }
    });
    const modules: ExperimentCourseModule[] = [
      {
        module_id: "module-1",
        objective: "read the market",
        round_ids: ["round-1", "round-2"],
        title: "Market"
      },
      {
        module_id: "module-2",
        objective: "operate safely",
        round_ids: ["round-3"],
        title: "Operations"
      }
    ];
    const roles: ExperimentCourseRole[] = [
      { role_id: "teacher", role_label: "Teacher", visibility: "TEACHER" },
      { role_id: "student", role_label: "Student", visibility: "STUDENT" },
      { role_id: "admin", role_label: "Admin", visibility: "ADMIN" }
    ];
    const evidence_partition: ExperimentCourseEvidencePartition = {
      advisory: ["advisory:1"],
      counterfactual: ["what-if:1"],
      learning: ["learning:1"],
      outcome: ["outcome:1"],
      process: ["process:1"]
    };
    const course = service.assembleExperimentCoursePackage({
      debrief_prompts: ["what happened?", "why?"],
      evidence_partition,
      modules,
      model_evidence_binding: binding,
      package_id: "course-shanghai-executive",
      roles,
      rounds: [round(1, scenario), round(2, scenario), round(3, scenario)],
      tenant_id: "tenant-shanghai",
      title: "Shanghai Executive Lab",
      transfer_prompts: ["transfer to Suzhou"],
      what_if_prompts: ["what if capacity is constrained?"],
      version: "1.0.0"
    });
    expect(course.readiness.status).toBe("READY");
    expect(course.profiles.STANDARD.shared_kernel_id).toBe(
      course.profiles.ADVANCED.shared_kernel_id
    );
    expect(service.projectCoursePackage(course, "STUDENT").rounds[0]).not.toHaveProperty(
      "model_version_reference"
    );
  });

  it("copies only with tenant-scoped rights, produces sponsor-safe delivery, and rejects leaks", () => {
    const service = new ShanghaiProductizationService({ now: () => fixedNow });
    const packageReference: CoursePackageReference = {
      content_digest: digest("e"),
      course_package_id: "course-shanghai-executive",
      tenant_id: "tenant-source",
      version: "1.0.0"
    };
    const catalog = service.registerEnterpriseCourse({
      catalog_entry_id: "catalog-shanghai",
      course_package_reference: packageReference,
      known_limits: ["candidate-only"],
      rights: {
        allowed_actions: ["VIEW", "COPY", "FORK", "DELIVER"],
        copy_allowed: true,
        expires_at: null,
        fork_allowed: true,
        grant_id: "grant-1",
        license_status: "VALID",
        territory: "CN",
        tenant_id: "tenant-destination"
      },
      sponsor_safe: true,
      tenant_id: "tenant-destination",
      title: "Shanghai Executive Lab"
    });
    const copy = service.copyCoursePackage(catalog, {
      actor_tenant_id: "tenant-destination",
      catalog_entry_id: "catalog-shanghai",
      copied_at: fixedNow,
      destination_tenant_id: "tenant-destination",
      new_course_package_id: "course-shanghai-copy",
      new_version: "1.0.0"
    });
    expect(copy.raw_source_data_copied).toBe(false);
    expect(copy.lineage.source_reference).toEqual(packageReference);
    const config = service.createDeliveryConfiguration({
      course_package_reference: copy.new_reference,
      delivery_id: "delivery-1",
      expires_at: null,
      participant_count: 8,
      rights: catalog.rights,
      sponsor_id: "sponsor-1",
      tenant_id: "tenant-destination",
      territory: "CN"
    });
    const aggregate = service.createSponsorSafeAggregate(config, {
      completion_rate: 0.8,
      scenario_count: 1
    });
    expect(aggregate.forbidden_fields).toContain("state_true");
    expect(() =>
      service.createSponsorSafeAggregate(config, {
        state_true: 1
      } as unknown as Record<string, number>)
    ).toThrowError(new ProductizationError("SPONSOR_DATA_BLOCKED"));
    expect(service.createDeliveryReceipt(config, aggregate).formal_entitlement_activation).toBe(
      false
    );
    expect(() =>
      service.createDeliveryReceipt(config, { ...aggregate, sponsor_id: "sponsor-other" })
    ).toThrowError(new ProductizationError("TENANT_SCOPE_VIOLATION"));
    expect(() =>
      service.createDeliveryReceipt(config, {
        ...aggregate,
        allowed_metrics: { state_true: 1 }
      })
    ).toThrowError(new ProductizationError("SPONSOR_DATA_BLOCKED"));
    expect(() =>
      service.copyCoursePackage(catalog, {
        actor_tenant_id: "tenant-other",
        catalog_entry_id: "catalog-shanghai",
        copied_at: fixedNow,
        destination_tenant_id: "tenant-destination",
        new_course_package_id: "course-other-copy",
        new_version: "1.0.0"
      })
    ).toThrowError(new ProductizationError("TENANT_SCOPE_VIOLATION"));

    const expiredRightsService = new ShanghaiProductizationService({
      now: () => "2026-10-01T00:00:00.000Z"
    });
    const expiredRightsCatalog = expiredRightsService.registerEnterpriseCourse({
      ...catalog,
      rights: { ...catalog.rights, expires_at: "2026-09-01T00:00:00.000Z" }
    });
    expect(() =>
      expiredRightsService.copyCoursePackage(expiredRightsCatalog, {
        actor_tenant_id: "tenant-destination",
        catalog_entry_id: "catalog-shanghai",
        copied_at: "2026-08-01T00:00:00.000Z",
        destination_tenant_id: "tenant-destination",
        new_course_package_id: "course-expired-copy",
        new_version: "1.0.0"
      })
    ).toThrowError(new ProductizationError("RIGHTS_BLOCKED"));

    expect(() =>
      service.createDeliveryConfiguration({
        course_package_reference: copy.new_reference,
        delivery_id: "delivery-small-cell",
        expires_at: null,
        participant_count: 4,
        rights: catalog.rights,
        sponsor_id: "sponsor-1",
        tenant_id: "tenant-destination",
        territory: "CN"
      })
    ).not.toThrow();
    expect(() =>
      service.createSponsorSafeAggregate(
        service.createDeliveryConfiguration({
          course_package_reference: copy.new_reference,
          delivery_id: "delivery-small-cell",
          expires_at: null,
          participant_count: 4,
          rights: catalog.rights,
          sponsor_id: "sponsor-1",
          tenant_id: "tenant-destination",
          territory: "CN"
        }),
        { completion_rate: 0.8 }
      )
    ).toThrowError(new ProductizationError("SPONSOR_DATA_BLOCKED"));
  });

  it("manages portfolio lifecycle, withdraws without deletion, resolves exact history, and dry-runs rollback", () => {
    const service = new ShanghaiProductizationService({ now: () => fixedNow });
    const ref: CoursePackageReference = {
      content_digest: digest("a"),
      course_package_id: "course-shanghai-executive",
      tenant_id: "tenant-shanghai",
      version: "1.0.0"
    };
    const portfolio = service.createPortfolioCandidate({
      compatibility_impact: {
        affected_consumers: ["MAIN Course Factory"],
        changed_references: [],
        status: "NONE"
      },
      package_reference: ref,
      portfolio_id: "portfolio-shanghai",
      tenant_id: ref.tenant_id
    });
    const release = service.transitionPortfolio(portfolio, "RELEASE_CANDIDATE");
    const withdrawn = service.transitionPortfolio(release, "WITHDRAWN");
    expect(withdrawn.withdrawn).toBe(true);
    expect(withdrawn.withdrawal_deletes_history).toBe(false);
    expect(service.resolveHistoricalPortfolioVersion(withdrawn, ref).found).toBe(true);
    expect(() =>
      service.resolveHistoricalPortfolioVersion(withdrawn, { ...ref, version: "latest" })
    ).toThrowError(new ProductizationError("EXACT_REFERENCE_REQUIRED"));
    const rollback = service.rollbackPortfolioDryRun(withdrawn, {
      ...ref,
      version: "0.9.0",
      content_digest: digest("b")
    });
    expect(rollback.formal_rollback).toBe(false);
    expect(rollback.status).toBe("BLOCKED");
    expect(service.resolveHistoricalPortfolioVersion(withdrawn, ref).status).toBe("WITHDRAWN");
    expect(
      service.rollbackPortfolioDryRun(withdrawn, {
        ...ref,
        version: "0.8.0",
        content_digest: digest("c")
      }).status
    ).toBe("BLOCKED");
    expect(withdrawn.current_status).toBe("WITHDRAWN");

    const blocked = service.createPortfolioCandidate({
      compatibility_impact: {
        affected_consumers: ["MAIN Course Factory"],
        changed_references: ["model:changed"],
        status: "BLOCKED"
      },
      package_reference: ref,
      portfolio_id: "portfolio-blocked",
      tenant_id: ref.tenant_id
    });
    expect(blocked.current_status).toBe("DRAFT");
    expect(service.resolveHistoricalPortfolioVersion(blocked, ref).status).toBe("DRAFT");
  });

  it("uses canonical ordering for deterministic candidate digests", () => {
    expect(stableProductizationDigest({ b: 2, a: ["x", 1] })).toBe(
      stableProductizationDigest({ a: ["x", 1], b: 2 })
    );
  });
});
