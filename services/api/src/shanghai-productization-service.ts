import { createHash } from "node:crypto";
import {
  PRODUCTIZATION_EXPLICIT_NON_PROOFS,
  PRODUCTIZATION_FORMAL_WRITER_BOUNDARY,
  PRODUCTIZATION_NO_IMPLICIT_LATEST,
  PRODUCTIZATION_FORBIDDEN_FIELDS,
  type CompatibilityFinding,
  type CoursePackageReference,
  type CourseRightsGrant,
  type DeliveryConfiguration,
  type DeliveryReceipt,
  type EnterpriseCourseCatalogEntry,
  type EnterpriseCourseCopyCandidate,
  type EnterpriseCourseCopyInput,
  type ExperimentCourseEvidencePartition,
  type ExperimentCoursePackageAssemblyInput,
  type ExperimentCoursePackageCandidate,
  type ExperimentCourseProfile,
  type ModelEvidenceBindingCandidate,
  type ModelEvidenceBindingInput,
  type ProductizationGovernanceContext,
  type QualificationEvidenceBinding,
  type PortfolioCreateInput,
  type PortfolioHistoricalResolution,
  type PortfolioRollbackDryRun,
  type ProductizationRole,
  type ScenarioAuthoringDiff,
  type ScenarioAuthoringDraft,
  type ScenarioAuthoringDraftInput,
  type ScenarioAuthoringForkInput,
  type ScenarioAuthoringValidation,
  type ScenarioAuthoringSourceAdmission,
  type ScenarioCatalog,
  type ScenarioCatalogEntry,
  type ScenarioCatalogQuery,
  type ScenarioCatalogSelectionReceipt,
  type ScenarioCatalogSelectionRequest,
  type ScenarioEditableAssets,
  type ScenarioCoursePortfolioCandidate,
  type ScenarioCoursePortfolioStatus,
  type ScenarioPackageReference,
  type SponsorSafeAggregate,
  type StudentExperimentCourseProjection,
  type StudentModelBindingProjection,
  type StudentScenarioCatalogProjection,
  type TeacherAdminModelBindingProjection,
  type TeacherAdminScenarioCatalogProjection
} from "@simwar/shared-contracts";

export type ProductizationErrorCode =
  | "CATALOG_ENTRY_INVALID"
  | "COMPATIBILITY_BLOCKED"
  | "COURSE_PACKAGE_INVALID"
  | "DIGEST_MISMATCH"
  | "EXACT_REFERENCE_REQUIRED"
  | "FRESHNESS_BLOCKED"
  | "INVALID_TRANSITION"
  | "MODEL_BINDING_INVALID"
  | "NOT_FOUND"
  | "QUALIFICATION_BLOCKED"
  | "RIGHTS_BLOCKED"
  | "SPONSOR_DATA_BLOCKED"
  | "TENANT_SCOPE_VIOLATION"
  | "VALIDATION_BLOCKED";

export class ProductizationError extends Error {
  constructor(readonly code: ProductizationErrorCode) {
    super(code);
    this.name = "ProductizationError";
  }
}

export interface ShanghaiProductizationServiceOptions {
  now?: () => string;
}

function fail(code: ProductizationErrorCode): never {
  throw new ProductizationError(code);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`)
      .join(",")}}`;
  }
  fail("CATALOG_ENTRY_INVALID");
}

export function stableProductizationDigest(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

function exactVersion(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value === value.trim() &&
    !/(^|[._:-])(latest|current|default|fallback|next|unresolved|any)([._:-]|$)/i.test(value) &&
    !/[xX*]/.test(value)
  );
}

function digest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value === value.trim();
}

function assertScenarioReference(reference: ScenarioPackageReference, tenantId?: string): void {
  if (
    !reference ||
    !nonBlank(reference.scenario_package_id) ||
    !nonBlank(reference.tenant_id) ||
    !exactVersion(reference.version) ||
    !digest(reference.content_digest)
  )
    fail("EXACT_REFERENCE_REQUIRED");
  if (tenantId !== undefined && reference.tenant_id !== tenantId) fail("TENANT_SCOPE_VIOLATION");
}

function assertParameterReference(reference: {
  parameter_set_id: string;
  version: string;
  content_digest: string;
}): void {
  if (
    !nonBlank(reference.parameter_set_id) ||
    !exactVersion(reference.version) ||
    !digest(reference.content_digest)
  ) {
    fail("MODEL_BINDING_INVALID");
  }
}

function assertModelReference(reference: {
  model_version_id: string;
  version: string;
  content_digest: string;
}): void {
  if (
    !nonBlank(reference.model_version_id) ||
    !exactVersion(reference.version) ||
    !digest(reference.content_digest)
  ) {
    fail("MODEL_BINDING_INVALID");
  }
}

function assertCourseReference(reference: CoursePackageReference, tenantId?: string): void {
  if (
    !reference ||
    !nonBlank(reference.course_package_id) ||
    !nonBlank(reference.tenant_id) ||
    !exactVersion(reference.version) ||
    !digest(reference.content_digest)
  )
    fail("EXACT_REFERENCE_REQUIRED");
  if (tenantId !== undefined && reference.tenant_id !== tenantId) fail("TENANT_SCOPE_VIOLATION");
}

function sameScenarioReference(
  left: ScenarioPackageReference,
  right: ScenarioPackageReference
): boolean {
  return (
    left.tenant_id === right.tenant_id &&
    left.scenario_package_id === right.scenario_package_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function sameCourseReference(left: CoursePackageReference, right: CoursePackageReference): boolean {
  return (
    left.tenant_id === right.tenant_id &&
    left.course_package_id === right.course_package_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function sameParameterReference(
  left: { parameter_set_id: string; version: string; content_digest: string },
  right: { parameter_set_id: string; version: string; content_digest: string }
): boolean {
  return (
    left.parameter_set_id === right.parameter_set_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function sameModelReference(
  left: { model_version_id: string; version: string; content_digest: string },
  right: { model_version_id: string; version: string; content_digest: string }
): boolean {
  return (
    left.model_version_id === right.model_version_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function assertNoForbiddenFields(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoForbiddenFields);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((PRODUCTIZATION_FORBIDDEN_FIELDS as readonly string[]).includes(key))
      fail("COURSE_PACKAGE_INVALID");
    assertNoForbiddenFields(child);
  }
}

function assertEditableAssets(assets: ScenarioEditableAssets): void {
  const fields: (keyof ScenarioEditableAssets)[] = [
    "bundle_refs",
    "cohort_refs",
    "geo_refs",
    "policy_refs",
    "project_refs",
    "teaching_refs"
  ];
  if (
    !assets ||
    fields.some(
      (field) => !Array.isArray(assets[field]) || assets[field].some((item) => !nonBlank(item))
    )
  ) {
    fail("CATALOG_ENTRY_INVALID");
  }
  if (
    fields.some((field) =>
      assets[field].some(
        (item) => !/^SH:(bundle|cohort|geo|policy|project|teaching):.+$/.test(item)
      )
    )
  ) {
    fail("TENANT_SCOPE_VIOLATION");
  }
}

function assertAuthoringSourceAdmission(
  admission: ScenarioAuthoringSourceAdmission,
  baseReference: ScenarioPackageReference,
  tenantId: string,
  now: string
): void {
  if (
    !admission ||
    !nonBlank(admission.catalog_entry_id) ||
    admission.source_owner !== "SH" ||
    admission.qualification_status !== "ELIGIBLE" ||
    admission.freshness_status !== "FRESH" ||
    admission.license_status !== "VALID" ||
    admission.fork_allowed !== true ||
    (admission.expires_at !== null && !isValidTimestamp(admission.expires_at)) ||
    (admission.expires_at !== null && isExpired(admission.expires_at, now)) ||
    baseReference.tenant_id !== tenantId
  )
    fail("RIGHTS_BLOCKED");
}

function compareValues(
  before: unknown,
  after: unknown,
  path: string,
  changes: Array<{ before: unknown; after: unknown; path: string }>
): void {
  if (canonicalize(before) === canonicalize(after)) return;
  if (
    before &&
    after &&
    typeof before === "object" &&
    typeof after === "object" &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  ) {
    const keys = new Set([...Object.keys(before as object), ...Object.keys(after as object)]);
    [...keys]
      .sort()
      .forEach((key) =>
        compareValues(
          (before as Record<string, unknown>)[key],
          (after as Record<string, unknown>)[key],
          `${path}.${key}`,
          changes
        )
      );
    return;
  }
  changes.push({ before, after, path });
}

function isExpired(expiresAt: string | null, now: string): boolean {
  return expiresAt !== null && new Date(expiresAt).getTime() <= new Date(now).getTime();
}

function isValidTimestamp(value: string): boolean {
  return nonBlank(value) && Number.isFinite(new Date(value).getTime());
}

function assertGovernanceContext(context: ProductizationGovernanceContext, tenantId: string): void {
  if (
    !context ||
    context.tenant_id !== tenantId ||
    context.model_authority !== "MAIN_MODEL_GOVERNANCE" ||
    context.model_reference_status !== "EXACT_REFERENCE_PRESENT" ||
    context.parameter_authority !== "MAIN_PARAMETER_SET_AUTHORITY" ||
    context.parameter_reference_status !== "EXACT_REFERENCE_PRESENT"
  )
    fail("MODEL_BINDING_INVALID");
}

function validateQualificationEvidence(
  evidence: QualificationEvidenceBinding,
  expectedStatus: string,
  now: string
): string[] {
  const reasons: string[] = [];
  if (
    !evidence ||
    !nonBlank(evidence.pack_id) ||
    !digest(evidence.pack_digest) ||
    evidence.calibrated !== false ||
    evidence.verification !== "UPSTREAM_PACK_REFERENCE" ||
    !isValidTimestamp(evidence.effective_at) ||
    (evidence.expires_at !== null && !isValidTimestamp(evidence.expires_at)) ||
    evidence.status !== expectedStatus
  ) {
    reasons.push("QUALIFICATION_EVIDENCE_INVALID");
  }
  if (evidence && isExpired(evidence.expires_at, now))
    reasons.push("QUALIFICATION_EVIDENCE_EXPIRED");
  if (evidence && evidence.status !== "ELIGIBLE")
    reasons.push("SCENARIO_QUALIFICATION_NOT_ELIGIBLE");
  return reasons;
}

function assertRightsGrant(
  rights: CourseRightsGrant,
  now: string,
  requiredAction?: CourseRightsGrant["allowed_actions"][number],
  territory?: string
): void {
  const allowedActions = new Set(["VIEW", "COPY", "FORK", "DELIVER"]);
  if (
    !rights ||
    !nonBlank(rights.grant_id) ||
    !nonBlank(rights.tenant_id) ||
    !nonBlank(rights.territory) ||
    rights.allowed_actions.length === 0 ||
    rights.allowed_actions.some((action) => !allowedActions.has(action)) ||
    (rights.expires_at !== null && !isValidTimestamp(rights.expires_at))
  )
    fail("RIGHTS_BLOCKED");
  if (
    requiredAction !== undefined &&
    (rights.license_status !== "VALID" ||
      isExpired(rights.expires_at, now) ||
      !rights.allowed_actions.includes(requiredAction) ||
      (requiredAction === "COPY" && rights.copy_allowed !== true) ||
      (requiredAction === "FORK" && rights.fork_allowed !== true))
  )
    fail("RIGHTS_BLOCKED");
  if (territory !== undefined && rights.territory !== territory) fail("RIGHTS_BLOCKED");
}

function courseProfiles(): Readonly<Record<"STANDARD" | "ADVANCED", ExperimentCourseProfile>> {
  return {
    STANDARD: {
      content_depth: "CORE",
      experience_profile: "STANDARD",
      shared_kernel_id: "simulation-core"
    },
    ADVANCED: {
      content_depth: "EXTENDED",
      experience_profile: "ADVANCED",
      shared_kernel_id: "simulation-core"
    }
  };
}

function courseEvidence(
  value: ExperimentCourseEvidencePartition
): ExperimentCourseEvidencePartition {
  return {
    advisory: [...value.advisory],
    counterfactual: [...value.counterfactual],
    learning: [...value.learning],
    outcome: [...value.outcome],
    process: [...value.process]
  };
}

export class ShanghaiProductizationService {
  private readonly now: () => string;

  constructor(options: ShanghaiProductizationServiceOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  compileScenarioCatalog(entries: readonly ScenarioCatalogEntry[]): ScenarioCatalog {
    if (entries.length === 0) fail("CATALOG_ENTRY_INVALID");
    const tenantId = entries[0]?.tenant_id;
    if (!tenantId) fail("CATALOG_ENTRY_INVALID");
    entries.forEach((entry) => {
      if (
        entry.schema_version !== "scenario-productization.v1" ||
        entry.tenant_id !== tenantId ||
        !nonBlank(entry.catalog_entry_id) ||
        !nonBlank(entry.title) ||
        !nonBlank(entry.geography) ||
        !nonBlank(entry.theme) ||
        entry.experience_profiles.length === 0 ||
        entry.known_limits.length === 0 ||
        !["C1_NAMED_FORWARD", "C2_PLATFORM_REUSE"].includes(entry.consumer_readiness) ||
        !["ELIGIBLE", "NOT_ELIGIBLE", "STALE", "UNKNOWN"].includes(entry.qualification.status) ||
        !["VALID", "EXPIRED", "WITHDRAWN", "UNKNOWN"].includes(entry.rights.license_status) ||
        !["FRESH", "STALE", "UNKNOWN"].includes(entry.freshness.status) ||
        !["COMPATIBLE", "INCOMPATIBLE", "UNKNOWN"].includes(entry.compatibility.status) ||
        !["HIGH", "MEDIUM", "LOW", "UNKNOWN"].includes(entry.source.confidence) ||
        !["PRIMARY", "SECONDARY", "SYNTHETIC", "INTERNAL", "UNKNOWN"].includes(
          entry.source.provenance
        ) ||
        !["PUBLIC_SAFE", "INTERNAL_ONLY", "RESTRICTED"].includes(entry.source.sensitivity) ||
        !["OFFICIAL", "RESEARCH", "PROJECT", "SYNTHETIC", "UNKNOWN"].includes(
          entry.source.source_type
        ) ||
        !["APPROVED", "REVIEW_REQUIRED", "UNKNOWN"].includes(entry.source.usage_status) ||
        !isValidTimestamp(entry.source.source_date) ||
        (entry.rights.expires_at !== null && !isValidTimestamp(entry.rights.expires_at)) ||
        (entry.freshness.collected_at !== null &&
          !isValidTimestamp(entry.freshness.collected_at)) ||
        (entry.freshness.expires_at !== null && !isValidTimestamp(entry.freshness.expires_at))
      )
        fail("CATALOG_ENTRY_INVALID");
      assertScenarioReference(entry.scenario_reference, tenantId);
      if (
        !nonBlank(entry.source.source_ref) ||
        !nonBlank(entry.source.time_scope) ||
        !nonBlank(entry.source.geography)
      ) {
        fail("CATALOG_ENTRY_INVALID");
      }
    });
    const identity = new Set<string>();
    for (const entry of entries) {
      const key = `${entry.catalog_entry_id}:${entry.scenario_reference.version}`;
      if (identity.has(key)) fail("CATALOG_ENTRY_INVALID");
      identity.add(key);
    }
    return deepFreeze({
      entries: entries
        .map(clone)
        .sort((left, right) => left.catalog_entry_id.localeCompare(right.catalog_entry_id)),
      no_implicit_latest: PRODUCTIZATION_NO_IMPLICIT_LATEST,
      schema_version: "scenario-productization.v1",
      tenant_id: tenantId
    });
  }

  filterScenarioCatalog(
    catalog: ScenarioCatalog,
    query: ScenarioCatalogQuery
  ): ScenarioCatalogEntry[] {
    return catalog.entries
      .filter((entry) => {
        const haystack = `${entry.title} ${entry.theme} ${entry.geography}`.toLowerCase();
        return (
          (query.query === undefined || haystack.includes(query.query.toLowerCase())) &&
          (query.geography === undefined || entry.geography === query.geography) &&
          (query.experience_profile === undefined ||
            entry.experience_profiles.includes(query.experience_profile)) &&
          (query.qualification_status === undefined ||
            entry.qualification.status === query.qualification_status) &&
          (query.rights_status === undefined ||
            entry.rights.license_status === query.rights_status) &&
          (query.freshness_status === undefined ||
            entry.freshness.status === query.freshness_status) &&
          (query.compatibility_status === undefined ||
            entry.compatibility.status === query.compatibility_status)
        );
      })
      .map(clone);
  }

  selectScenarioCatalogEntry(
    catalog: ScenarioCatalog,
    request: ScenarioCatalogSelectionRequest
  ): ScenarioCatalogSelectionReceipt {
    if (!request || !request.catalog_entry_id || !request.expected_reference)
      fail("EXACT_REFERENCE_REQUIRED");
    if (request.tenant_id !== catalog.tenant_id) fail("TENANT_SCOPE_VIOLATION");
    assertScenarioReference(request.expected_reference, request.tenant_id);
    const candidates = catalog.entries.filter(
      (candidate) => candidate.catalog_entry_id === request.catalog_entry_id
    );
    if (candidates.length === 0) fail("NOT_FOUND");
    const entry = candidates.find((candidate) =>
      sameScenarioReference(candidate.scenario_reference, request.expected_reference)
    );
    if (!entry) fail("DIGEST_MISMATCH");
    if (entry.tenant_id !== request.tenant_id) fail("TENANT_SCOPE_VIOLATION");
    if (!isValidTimestamp(request.selected_at)) fail("CATALOG_ENTRY_INVALID");
    const now = this.now();
    if (entry.qualification.status !== "ELIGIBLE") fail("QUALIFICATION_BLOCKED");
    if (entry.rights.license_status !== "VALID" || isExpired(entry.rights.expires_at, now))
      fail("RIGHTS_BLOCKED");
    if (entry.freshness.status !== "FRESH" || isExpired(entry.freshness.expires_at, now))
      fail("FRESHNESS_BLOCKED");
    if (entry.compatibility.status !== "COMPATIBLE") fail("COMPATIBILITY_BLOCKED");
    return deepFreeze({
      catalog_entry_id: entry.catalog_entry_id,
      consumer_readiness: entry.consumer_readiness,
      formal_binding: false,
      no_implicit_latest: true as const,
      selected_at: request.selected_at,
      selected_by: request.selected_by,
      selected_reference: clone(entry.scenario_reference),
      selection_id: `selection:${entry.catalog_entry_id}:${stableProductizationDigest(request).slice(0, 16)}`,
      tenant_id: request.tenant_id
    });
  }

  projectScenarioCatalog(
    catalog: ScenarioCatalog,
    role: ProductizationRole
  ): TeacherAdminScenarioCatalogProjection | StudentScenarioCatalogProjection {
    if (role === "STUDENT") {
      return {
        entries: catalog.entries.map((entry) => ({
          catalog_entry_id: entry.catalog_entry_id,
          experience_profiles: [...entry.experience_profiles],
          geography: entry.geography,
          known_limits: [...entry.known_limits],
          qualification_status: entry.qualification.status,
          scenario_package_id: entry.scenario_reference.scenario_package_id,
          theme: entry.theme,
          title: entry.title,
          version: entry.scenario_reference.version
        })),
        role,
        tenant_id: catalog.tenant_id
      };
    }
    return { entries: catalog.entries.map(clone), role, tenant_id: catalog.tenant_id };
  }

  createScenarioDraft(input: ScenarioAuthoringDraftInput): ScenarioAuthoringDraft {
    assertScenarioReference(input.base_reference, input.tenant_id);
    assertEditableAssets(input.editable_assets);
    assertAuthoringSourceAdmission(
      input.source_admission,
      input.base_reference,
      input.tenant_id,
      this.now()
    );
    if (!nonBlank(input.created_by) || !nonBlank(input.draft_id)) fail("CATALOG_ENTRY_INVALID");
    const draftPayload = {
      base_reference: clone(input.base_reference),
      created_by: input.created_by,
      draft_id: input.draft_id,
      editable_assets: clone(input.editable_assets),
      known_limits: [...(input.known_limits ?? ["qualification_recheck_required"])],
      source_admission: clone(input.source_admission),
      tenant_id: input.tenant_id
    };
    return deepFreeze({
      ...draftPayload,
      content_digest: stableProductizationDigest(draftPayload),
      formal_activation: false as const,
      lineage: { parent_draft_id: null, root_reference: clone(input.base_reference) },
      no_implicit_latest: true,
      schema_version: "scenario-productization.v1",
      status: "DRAFT"
    });
  }

  forkScenarioDraft(
    parent: ScenarioAuthoringDraft,
    input: ScenarioAuthoringForkInput
  ): ScenarioAuthoringDraft {
    if (parent.tenant_id !== input.tenant_id) fail("TENANT_SCOPE_VIOLATION");
    if (parent.content_digest !== input.parent_expected_digest) fail("DIGEST_MISMATCH");
    const fork = this.createScenarioDraft({
      base_reference: parent.base_reference,
      created_by: input.created_by,
      draft_id: input.draft_id,
      editable_assets: input.editable_assets,
      known_limits: input.known_limits ?? parent.known_limits,
      source_admission: parent.source_admission,
      tenant_id: input.tenant_id
    });
    return deepFreeze({
      ...clone(fork),
      lineage: {
        parent_draft_id: parent.draft_id,
        root_reference: clone(parent.lineage.root_reference)
      }
    });
  }

  compareScenarioDrafts(
    left: ScenarioAuthoringDraft,
    right: ScenarioAuthoringDraft
  ): ScenarioAuthoringDiff {
    if (left.tenant_id !== right.tenant_id) fail("TENANT_SCOPE_VIOLATION");
    if (!sameScenarioReference(left.base_reference, right.base_reference)) fail("DIGEST_MISMATCH");
    const changes: Array<{ before: unknown; after: unknown; path: string }> = [];
    compareValues(left.editable_assets, right.editable_assets, "editable_assets", changes);
    return deepFreeze({
      base_reference: clone(left.base_reference),
      changes,
      left_digest: left.content_digest,
      qualification_impact: changes.some((change) =>
        /geo_refs|cohort_refs|policy_refs/.test(change.path)
      )
        ? "REVIEW_REQUIRED"
        : "UNCHANGED",
      right_digest: right.content_digest
    });
  }

  validateScenarioDraft(draft: ScenarioAuthoringDraft): ScenarioAuthoringValidation {
    const issues: string[] = [];
    try {
      assertScenarioReference(draft.base_reference, draft.tenant_id);
      assertEditableAssets(draft.editable_assets);
      assertAuthoringSourceAdmission(
        draft.source_admission,
        draft.base_reference,
        draft.tenant_id,
        this.now()
      );
      if (!sameScenarioReference(draft.base_reference, draft.lineage.root_reference))
        fail("DIGEST_MISMATCH");
    } catch (error) {
      issues.push(error instanceof ProductizationError ? error.code : "DRAFT_INVALID");
    }
    const expectedDigest = stableProductizationDigest({
      base_reference: draft.base_reference,
      created_by: draft.created_by,
      draft_id: draft.draft_id,
      editable_assets: draft.editable_assets,
      known_limits: draft.known_limits,
      source_admission: draft.source_admission,
      tenant_id: draft.tenant_id
    });
    if (expectedDigest !== draft.content_digest) issues.push("DRAFT_DIGEST_MISMATCH");
    return {
      editable_fields: [
        "bundle_refs",
        "cohort_refs",
        "geo_refs",
        "policy_refs",
        "project_refs",
        "teaching_refs"
      ],
      issues,
      known_limits: [...draft.known_limits],
      ok: issues.length === 0,
      qualification_impact:
        draft.editable_assets.geo_refs.length > 0 ||
        draft.editable_assets.policy_refs.length > 0 ||
        draft.editable_assets.cohort_refs.length > 0
          ? "REVIEW_REQUIRED"
          : "UNCHANGED",
      status: issues.length === 0 ? "VALID" : "BLOCKED"
    };
  }

  freezeScenarioDraft(draft: ScenarioAuthoringDraft): ScenarioAuthoringDraft {
    if (draft.status !== "DRAFT") fail("VALIDATION_BLOCKED");
    if (!sameScenarioReference(draft.base_reference, draft.lineage.root_reference))
      fail("DIGEST_MISMATCH");
    const validation = this.validateScenarioDraft(draft);
    if (!validation.ok) fail("VALIDATION_BLOCKED");
    return deepFreeze({ ...clone(draft), status: "FROZEN_CANDIDATE" });
  }

  bindModelEvidence(input: ModelEvidenceBindingInput): ModelEvidenceBindingCandidate {
    assertScenarioReference(input.scenario_reference);
    assertGovernanceContext(input.governance_context, input.scenario_reference.tenant_id);
    assertParameterReference(input.parameter_set_reference);
    assertModelReference(input.model_version_reference);
    const findings: CompatibilityFinding[] = [];
    const whyNotBind: string[] = [];
    const qualificationReasons = validateQualificationEvidence(
      input.qualification_evidence,
      input.scenario_qualification,
      this.now()
    );
    for (const reason of qualificationReasons) {
      if (reason === "SCENARIO_QUALIFICATION_NOT_ELIGIBLE") {
        findings.push({
          code: "QUALIFICATION_NOT_ELIGIBLE",
          message: "Scenario qualification is not eligible for model binding.",
          severity: "ERROR"
        });
      } else {
        findings.push({
          code: "QUALIFICATION_EVIDENCE_INVALID",
          message: `Qualification evidence is not a current exact upstream pack reference: ${reason}.`,
          severity: "ERROR"
        });
      }
      whyNotBind.push(reason);
    }
    if (
      input.scenario_qualification !== "ELIGIBLE" &&
      !whyNotBind.includes("SCENARIO_QUALIFICATION_NOT_ELIGIBLE")
    ) {
      findings.push({
        code: "QUALIFICATION_NOT_ELIGIBLE",
        message: "Scenario qualification is not eligible for model binding.",
        severity: "ERROR"
      });
      whyNotBind.push("SCENARIO_QUALIFICATION_NOT_ELIGIBLE");
    }
    if (input.evidence.length === 0) {
      findings.push({
        code: "EVIDENCE_MISSING",
        message: "At least one exact feature evidence record is required.",
        severity: "ERROR"
      });
      whyNotBind.push("EVIDENCE_MISSING");
    }
    const evidenceFeatureIds = new Set(input.evidence.map((evidence) => evidence.feature_id));
    for (const featureId of Object.keys(input.unit_requirements)) {
      if (!evidenceFeatureIds.has(featureId)) {
        findings.push({
          code: "EVIDENCE_MISSING",
          message: `Evidence for required feature ${featureId} is missing.`,
          severity: "ERROR"
        });
        whyNotBind.push(`EVIDENCE_MISSING:${featureId}`);
      }
    }
    for (const evidence of input.evidence) {
      if (
        !nonBlank(evidence.source_ref) ||
        !nonBlank(evidence.unit) ||
        !nonBlank(evidence.period) ||
        !isValidTimestamp(evidence.source_date) ||
        !digest(evidence.source_digest) ||
        !digest(evidence.value_digest)
      ) {
        findings.push({
          code: "EVIDENCE_MISSING",
          message: `Evidence ${evidence.feature_id} is incomplete.`,
          severity: "ERROR"
        });
        whyNotBind.push(`EVIDENCE_INCOMPLETE:${evidence.feature_id}`);
      }
      if (isExpired(evidence.source_expires_at, this.now())) {
        findings.push({
          code: "EVIDENCE_STALE",
          message: `Evidence ${evidence.feature_id} is expired for the current binding time.`,
          severity: "ERROR"
        });
        whyNotBind.push(`EVIDENCE_STALE:${evidence.feature_id}`);
      }
      if (
        evidence.geography !== input.geography ||
        !input.supported_geographies.includes(evidence.geography)
      ) {
        findings.push({
          code: "GEOGRAPHY_MISMATCH",
          message: `Evidence ${evidence.feature_id} geography is outside the supported scope.`,
          severity: "ERROR"
        });
        whyNotBind.push("EVIDENCE_GEOGRAPHY_MISMATCH");
      }
      if (
        evidence.period !== input.effective_period ||
        !input.supported_periods.includes(evidence.period)
      ) {
        findings.push({
          code: "PERIOD_MISMATCH",
          message: `Evidence ${evidence.feature_id} period is outside the effective model period.`,
          severity: "ERROR"
        });
        whyNotBind.push("EVIDENCE_PERIOD_MISMATCH");
      }
      const expectedUnit = input.unit_requirements[evidence.feature_id];
      if (expectedUnit !== undefined && expectedUnit !== evidence.unit) {
        findings.push({
          code: "UNIT_MISMATCH",
          message: `Evidence ${evidence.feature_id} unit does not match the model requirement.`,
          severity: "ERROR"
        });
        whyNotBind.push(`EVIDENCE_UNIT_MISMATCH:${evidence.feature_id}`);
      }
    }
    const uniqueReasons = [...new Set(whyNotBind)];
    const status =
      uniqueReasons.length === 0 ? ("ELIGIBLE_CANDIDATE" as const) : ("NOT_ELIGIBLE" as const);
    const candidate = {
      calibration_status: "NOT_CALIBRATED" as const,
      candidate_writer: "SH_PRODUCTIZATION_CANDIDATE_COMPILER" as const,
      diagnostics: {
        ood: findings.some(
          (finding) => finding.code === "GEOGRAPHY_MISMATCH" || finding.code === "PERIOD_MISMATCH"
        ),
        uq: {
          confidence: uniqueReasons.length === 0 ? 0.8 : 0,
          interval: "candidate-only; no calibrated interval"
        },
        why_not_bind: uniqueReasons
      },
      evidence: clone(input.evidence),
      findings,
      formal_activation: false as const,
      formal_join: false as const,
      governance_context: clone(input.governance_context),
      model_version_reference: clone(input.model_version_reference),
      no_implicit_latest: true as const,
      parameter_set_reference: clone(input.parameter_set_reference),
      provider_calls: 0 as const,
      qualification_evidence: clone(input.qualification_evidence),
      scenario_reference: clone(input.scenario_reference),
      status,
      truth_write: false as const,
      replay_truth_write: false as const
    };
    return deepFreeze({
      ...candidate,
      binding_digest: stableProductizationDigest(candidate)
    });
  }

  projectModelBinding(
    binding: ModelEvidenceBindingCandidate,
    role: ProductizationRole
  ): TeacherAdminModelBindingProjection | StudentModelBindingProjection {
    if (role === "STUDENT") {
      return {
        known_limits: [...PRODUCTIZATION_EXPLICIT_NON_PROOFS],
        mechanism:
          "The scenario uses a qualification-aware candidate model binding; calibration is not asserted.",
        role,
        status: binding.status
      };
    }
    return { binding: clone(binding), role };
  }

  assembleExperimentCoursePackage(
    input: ExperimentCoursePackageAssemblyInput
  ): ExperimentCoursePackageCandidate {
    if (
      !nonBlank(input.package_id) ||
      !nonBlank(input.title) ||
      !exactVersion(input.version) ||
      input.modules.length < 2 ||
      input.rounds.length < 3
    ) {
      fail("COURSE_PACKAGE_INVALID");
    }
    if (
      input.roles.length === 0 ||
      input.debrief_prompts.length === 0 ||
      input.what_if_prompts.length === 0 ||
      input.transfer_prompts.length === 0
    ) {
      fail("COURSE_PACKAGE_INVALID");
    }
    if (!input.model_evidence_binding) fail("COURSE_PACKAGE_INVALID");
    const readinessReasons: string[] = [];
    if (input.model_evidence_binding.status !== "ELIGIBLE_CANDIDATE") {
      readinessReasons.push("MODEL_EVIDENCE_BINDING_NOT_ELIGIBLE");
    }
    if (input.model_evidence_binding.governance_context.tenant_id !== input.tenant_id) {
      readinessReasons.push("MODEL_GOVERNANCE_TENANT_MISMATCH");
    }
    input.rounds.forEach((round) => {
      if (
        !nonBlank(round.round_id) ||
        !Number.isSafeInteger(round.round_no) ||
        round.round_no < 1 ||
        !Number.isSafeInteger(round.seed) ||
        round.seed < 0
      )
        fail("COURSE_PACKAGE_INVALID");
      assertScenarioReference(round.scenario_reference, input.tenant_id);
      assertParameterReference(round.parameter_set_reference);
      assertModelReference(round.model_version_reference);
      if (
        !sameScenarioReference(
          round.scenario_reference,
          input.model_evidence_binding.scenario_reference
        )
      ) {
        readinessReasons.push(`ROUND_SCENARIO_REFERENCE_MISMATCH:${round.round_id}`);
      }
      if (
        !sameParameterReference(
          round.parameter_set_reference,
          input.model_evidence_binding.parameter_set_reference
        )
      ) {
        readinessReasons.push(`ROUND_PARAMETER_REFERENCE_MISMATCH:${round.round_id}`);
      }
      if (
        !sameModelReference(
          round.model_version_reference,
          input.model_evidence_binding.model_version_reference
        )
      ) {
        readinessReasons.push(`ROUND_MODEL_REFERENCE_MISMATCH:${round.round_id}`);
      }
    });
    const roundIds = new Set(input.rounds.map((round) => round.round_id));
    if (
      roundIds.size !== input.rounds.length ||
      input.modules.some((module) => module.round_ids.some((roundId) => !roundIds.has(roundId)))
    )
      fail("COURSE_PACKAGE_INVALID");
    assertNoForbiddenFields(input);
    const profiles = input.profiles ?? courseProfiles();
    if (profiles.STANDARD.shared_kernel_id !== profiles.ADVANCED.shared_kernel_id)
      fail("COURSE_PACKAGE_INVALID");
    const base = {
      debrief_prompts: [...input.debrief_prompts],
      evidence_partition: courseEvidence(input.evidence_partition),
      known_limits: [
        ...(input.known_limits ?? [
          "candidate_design_bundle_not_runtime_authority",
          ...PRODUCTIZATION_EXPLICIT_NON_PROOFS
        ])
      ],
      modules: clone(input.modules),
      package_id: input.package_id,
      profiles: clone(profiles),
      roles: clone(input.roles),
      rounds: clone(input.rounds),
      tenant_id: input.tenant_id,
      title: input.title,
      transfer_prompts: [...input.transfer_prompts],
      what_if_prompts: [...input.what_if_prompts],
      version: input.version
    };
    const contentDigest = stableProductizationDigest(base);
    const courseReference: import("@simwar/shared-contracts").CoursePackageReference = {
      content_digest: contentDigest,
      course_package_id: input.package_id,
      tenant_id: input.tenant_id,
      version: input.version
    };
    return deepFreeze({
      ...base,
      content_digest: contentDigest,
      formal_course_package_activation: false,
      main_binding_request: {
        authority: "MAIN_COURSE_PACKAGE_AUTHORITY",
        exact_course_package_reference: courseReference,
        formal_activation: false,
        model_evidence_binding_digest: input.model_evidence_binding.binding_digest,
        status: "CANDIDATE_ONLY"
      },
      model_evidence_binding_digest: input.model_evidence_binding.binding_digest,
      no_implicit_latest: true,
      readiness: {
        reasons: [...new Set(readinessReasons)],
        status: readinessReasons.length === 0 ? "READY" : "BLOCKED"
      },
      schema_version: "scenario-productization.v1"
    });
  }

  projectCoursePackage(
    course: ExperimentCoursePackageCandidate,
    role: ProductizationRole
  ): ExperimentCoursePackageCandidate | StudentExperimentCourseProjection {
    if (role !== "STUDENT") return clone(course);
    return {
      modules: clone(course.modules),
      role,
      rounds: course.rounds.map((round) => ({
        decision_fields: [...round.decision_fields],
        round_id: round.round_id,
        round_no: round.round_no,
        scenario_reference: {
          scenario_package_id: round.scenario_reference.scenario_package_id,
          version: round.scenario_reference.version
        },
        teaching_prompt: round.teaching_prompt
      })),
      tenant_id: course.tenant_id
    };
  }

  registerEnterpriseCourse(entry: EnterpriseCourseCatalogEntry): EnterpriseCourseCatalogEntry {
    assertCourseReference(entry.course_package_reference);
    if (
      !nonBlank(entry.catalog_entry_id) ||
      entry.tenant_id !== entry.rights.tenant_id ||
      entry.known_limits.length === 0 ||
      entry.sponsor_safe !== true
    )
      fail("CATALOG_ENTRY_INVALID");
    assertRightsGrant(entry.rights, this.now());
    return deepFreeze(clone(entry));
  }

  copyCoursePackage(
    entry: EnterpriseCourseCatalogEntry,
    input: EnterpriseCourseCopyInput
  ): EnterpriseCourseCopyCandidate {
    return this.createEnterpriseCourseCopyCandidate(entry, input, "COPY");
  }

  forkCoursePackage(
    entry: EnterpriseCourseCatalogEntry,
    input: EnterpriseCourseCopyInput
  ): EnterpriseCourseCopyCandidate {
    return this.createEnterpriseCourseCopyCandidate(entry, input, "FORK");
  }

  private createEnterpriseCourseCopyCandidate(
    entry: EnterpriseCourseCatalogEntry,
    input: EnterpriseCourseCopyInput,
    operation: "COPY" | "FORK"
  ): EnterpriseCourseCopyCandidate {
    if (entry.catalog_entry_id !== input.catalog_entry_id) fail("NOT_FOUND");
    if (
      input.actor_tenant_id !== entry.tenant_id ||
      input.destination_tenant_id !== entry.tenant_id
    )
      fail("TENANT_SCOPE_VIOLATION");
    if (!isValidTimestamp(input.copied_at)) fail("CATALOG_ENTRY_INVALID");
    assertRightsGrant(entry.rights, this.now(), operation);
    assertCourseReference(entry.course_package_reference);
    if (!nonBlank(input.new_course_package_id) || !exactVersion(input.new_version))
      fail("EXACT_REFERENCE_REQUIRED");
    const newReference: CoursePackageReference = {
      content_digest: stableProductizationDigest({
        source: entry.course_package_reference,
        new_course_package_id: input.new_course_package_id,
        new_version: input.new_version
      }),
      course_package_id: input.new_course_package_id,
      tenant_id: input.destination_tenant_id,
      version: input.new_version
    };
    return deepFreeze({
      copied_at: input.copied_at,
      destination_tenant_id: input.destination_tenant_id,
      lineage: {
        source_catalog_entry_id: entry.catalog_entry_id,
        source_reference: clone(entry.course_package_reference)
      },
      new_reference: newReference,
      operation,
      raw_source_data_copied: false,
      status: operation === "COPY" ? "COPY_CANDIDATE" : "FORK_CANDIDATE"
    });
  }

  createDeliveryConfiguration(input: DeliveryConfiguration): DeliveryConfiguration {
    assertCourseReference(input.course_package_reference, input.tenant_id);
    if (
      !nonBlank(input.delivery_id) ||
      !nonBlank(input.sponsor_id) ||
      !nonBlank(input.territory) ||
      !Number.isSafeInteger(input.participant_count) ||
      input.participant_count < 1 ||
      (input.expires_at !== null && !isValidTimestamp(input.expires_at))
    )
      fail("CATALOG_ENTRY_INVALID");
    if (input.rights.tenant_id !== input.tenant_id) fail("TENANT_SCOPE_VIOLATION");
    assertRightsGrant(input.rights, this.now(), "DELIVER", input.territory);
    if (input.expires_at !== null && isExpired(input.expires_at, this.now()))
      fail("RIGHTS_BLOCKED");
    return deepFreeze(clone(input));
  }

  createSponsorSafeAggregate(
    configuration: DeliveryConfiguration,
    metrics: Readonly<Record<string, number>>
  ): SponsorSafeAggregate {
    assertCourseReference(configuration.course_package_reference, configuration.tenant_id);
    if (configuration.participant_count < 5) fail("SPONSOR_DATA_BLOCKED");
    for (const [key, value] of Object.entries(metrics)) {
      if (
        (PRODUCTIZATION_FORBIDDEN_FIELDS as readonly string[]).includes(key) ||
        !Number.isFinite(value)
      )
        fail("SPONSOR_DATA_BLOCKED");
    }
    return deepFreeze({
      allowed_metrics: clone(metrics),
      delivery_id: configuration.delivery_id,
      forbidden_fields: ["state_true", "private_judgment", "other_team_data", "model_coefficients"],
      participant_count: configuration.participant_count,
      privacy_status: "SMALL_CELL_SAFE",
      sponsor_id: configuration.sponsor_id,
      tenant_id: configuration.tenant_id
    });
  }

  createDeliveryReceipt(
    configuration: DeliveryConfiguration,
    aggregate: SponsorSafeAggregate
  ): DeliveryReceipt {
    assertCourseReference(configuration.course_package_reference, configuration.tenant_id);
    assertRightsGrant(configuration.rights, this.now(), "DELIVER", configuration.territory);
    if (
      aggregate.tenant_id !== configuration.tenant_id ||
      aggregate.delivery_id !== configuration.delivery_id ||
      aggregate.participant_count !== configuration.participant_count ||
      aggregate.sponsor_id !== configuration.sponsor_id
    )
      fail("TENANT_SCOPE_VIOLATION");
    if (
      !aggregate.allowed_metrics ||
      typeof aggregate.allowed_metrics !== "object" ||
      Array.isArray(aggregate.allowed_metrics)
    )
      fail("SPONSOR_DATA_BLOCKED");
    const validatedAggregate = this.createSponsorSafeAggregate(
      configuration,
      aggregate.allowed_metrics
    );
    if (
      aggregate.privacy_status !== validatedAggregate.privacy_status ||
      stableProductizationDigest(aggregate.allowed_metrics) !==
        stableProductizationDigest(validatedAggregate.allowed_metrics) ||
      stableProductizationDigest(aggregate.forbidden_fields) !==
        stableProductizationDigest(validatedAggregate.forbidden_fields)
    )
      fail("SPONSOR_DATA_BLOCKED");
    return deepFreeze({
      audit_event_id: `delivery-audit:${stableProductizationDigest({ configuration, aggregate }).slice(0, 16)}`,
      delivery_id: configuration.delivery_id,
      formal_entitlement_activation: false,
      sponsor_safe_aggregate: clone(aggregate),
      status: aggregate.privacy_status === "SMALL_CELL_SAFE" ? "READY" : "BLOCKED",
      tenant_id: configuration.tenant_id
    });
  }

  createPortfolioCandidate(input: PortfolioCreateInput): ScenarioCoursePortfolioCandidate {
    assertCourseReference(input.package_reference, input.tenant_id);
    if (!nonBlank(input.portfolio_id)) fail("CATALOG_ENTRY_INVALID");
    const initialStatus: ScenarioCoursePortfolioStatus =
      input.compatibility_impact.status === "BLOCKED" ? "DRAFT" : "READY";
    const historical = [
      {
        content_digest: input.package_reference.content_digest,
        package_id: input.package_reference.course_package_id,
        status: initialStatus,
        version: input.package_reference.version
      }
    ];
    const base = {
      compatibility_impact: clone(input.compatibility_impact),
      historical_references: historical,
      package_reference: clone(input.package_reference),
      portfolio_id: input.portfolio_id,
      tenant_id: input.tenant_id
    };
    return deepFreeze({
      ...base,
      content_digest: stableProductizationDigest(base),
      current_status: input.compatibility_impact.status === "BLOCKED" ? "DRAFT" : "READY",
      no_implicit_latest: true,
      release_gate: "FORMAL_RELEASE_REQUIRED",
      rollback: { dry_run: true, target_reference: null },
      schema_version: "scenario-productization.v1",
      withdrawn: false,
      withdrawal_deletes_history: false
    });
  }

  transitionPortfolio(
    portfolio: ScenarioCoursePortfolioCandidate,
    next: ScenarioCoursePortfolioStatus
  ): ScenarioCoursePortfolioCandidate {
    const allowed: Readonly<
      Record<ScenarioCoursePortfolioStatus, readonly ScenarioCoursePortfolioStatus[]>
    > = {
      DRAFT: ["QUALIFIED", "WITHDRAWN"],
      QUALIFIED: ["READY", "WITHDRAWN"],
      READY: ["RELEASE_CANDIDATE", "DEPRECATED", "WITHDRAWN"],
      RELEASE_CANDIDATE: ["DEPRECATED", "WITHDRAWN"],
      DEPRECATED: ["WITHDRAWN", "RETIRED"],
      WITHDRAWN: ["RETIRED"],
      RETIRED: []
    };
    if (!allowed[portfolio.current_status].includes(next)) fail("INVALID_TRANSITION");
    if (
      portfolio.current_status === "DRAFT" &&
      portfolio.compatibility_impact.status === "BLOCKED" &&
      next !== "WITHDRAWN"
    )
      fail("COMPATIBILITY_BLOCKED");
    const history = [
      ...portfolio.historical_references,
      {
        content_digest: portfolio.package_reference.content_digest,
        package_id: portfolio.package_reference.course_package_id,
        status: next,
        version: portfolio.package_reference.version
      }
    ];
    return deepFreeze({
      ...clone(portfolio),
      content_digest: stableProductizationDigest({
        ...clone(portfolio),
        current_status: next,
        historical_references: history
      }),
      current_status: next,
      historical_references: history,
      rollback: { dry_run: true, target_reference: null },
      withdrawn: portfolio.withdrawn || next === "WITHDRAWN"
    });
  }

  resolveHistoricalPortfolioVersion(
    portfolio: ScenarioCoursePortfolioCandidate,
    reference: CoursePackageReference
  ): PortfolioHistoricalResolution {
    assertCourseReference(reference, portfolio.tenant_id);
    const found = portfolio.historical_references.some(
      (item) =>
        item.package_id === reference.course_package_id &&
        item.version === reference.version &&
        item.content_digest === reference.content_digest
    );
    return {
      exact_reference: clone(reference),
      found,
      historical: true,
      status: found
        ? ([...portfolio.historical_references]
            .reverse()
            .find(
              (item) =>
                item.package_id === reference.course_package_id &&
                item.version === reference.version &&
                item.content_digest === reference.content_digest
            )?.status ?? "NOT_FOUND")
        : "NOT_FOUND"
    };
  }

  rollbackPortfolioDryRun(
    portfolio: ScenarioCoursePortfolioCandidate,
    target: CoursePackageReference
  ): PortfolioRollbackDryRun {
    assertCourseReference(target, portfolio.tenant_id);
    if (sameCourseReference(portfolio.package_reference, target)) {
      return {
        changed_references: [],
        formal_rollback: false,
        from_reference: clone(portfolio.package_reference),
        status: "NOOP",
        to_reference: clone(target)
      };
    }
    const historicalResolution = this.resolveHistoricalPortfolioVersion(portfolio, target);
    if (!historicalResolution.found) {
      return {
        changed_references: [],
        formal_rollback: false,
        from_reference: clone(portfolio.package_reference),
        status: "BLOCKED",
        to_reference: clone(target)
      };
    }
    return {
      changed_references: ["course_package_reference"],
      formal_rollback: false,
      from_reference: clone(portfolio.package_reference),
      status: portfolio.current_status === "RETIRED" ? "BLOCKED" : "CANDIDATE",
      to_reference: clone(target)
    };
  }

  authorityBoundary(): typeof PRODUCTIZATION_FORMAL_WRITER_BOUNDARY {
    return PRODUCTIZATION_FORMAL_WRITER_BOUNDARY;
  }
}

export function isProductizationForbiddenField(value: string): boolean {
  return (PRODUCTIZATION_FORBIDDEN_FIELDS as readonly string[]).includes(value);
}

export function productizationKnownLimits(): readonly string[] {
  return PRODUCTIZATION_EXPLICIT_NON_PROOFS;
}
