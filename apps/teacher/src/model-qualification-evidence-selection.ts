import type {
  ModelQualification,
  ModelQualificationCalibrationDataset,
  ModelQualificationModelCatalogEntry,
  ModelQualificationSourcePackage,
  ModelQualificationTeacherProjection,
  ModelVersionReference
} from "@simwar/shared-contracts";

export interface ModelQualificationEvidenceSelectionContext {
  readonly activityId: string;
  readonly courseId: string;
  readonly tenantId: string;
}

export interface ModelQualificationEvidenceSelection {
  readonly model_version_key: string | null;
  readonly source_package_key: string | null;
  readonly calibration_dataset_key: string | null;
  readonly qualification_key: string | null;
}

type CompleteModelQualificationEvidenceSelection = {
  readonly model_version_key: string;
  readonly source_package_key: string;
  readonly calibration_dataset_key: string;
  readonly qualification_key: string;
};

export type ModelQualificationEvidenceSelectionState =
  | "selected"
  | "empty"
  | "no-selection"
  | "stale"
  | "missing-linked-item"
  | "mismatch"
  | "invalid-context"
  | "duplicate"
  | "conflict"
  | "unknown";

export type ModelQualificationEvidenceSelectionStatus =
  | "SELECTED"
  | "EMPTY"
  | "NO_SELECTION"
  | "STALE"
  | "MISSING_LINKED_ITEM"
  | "MISMATCH"
  | "INVALID_CONTEXT"
  | "DUPLICATE"
  | "CONFLICT"
  | "UNKNOWN";

export interface ModelQualificationEvidenceSelectionResult {
  readonly state: ModelQualificationEvidenceSelectionState;
  readonly status: ModelQualificationEvidenceSelectionStatus;
  readonly selected: {
    readonly model: ModelQualificationModelCatalogEntry;
    readonly source: ModelQualificationSourcePackage;
    readonly dataset: ModelQualificationCalibrationDataset;
    readonly qualification: ModelQualification;
  } | null;
}

export interface ResolveModelQualificationEvidenceSelectionInput {
  readonly context: ModelQualificationEvidenceSelectionContext;
  readonly projection: ModelQualificationTeacherProjection;
  readonly selection: ModelQualificationEvidenceSelection | null;
}

const EMPTY_SELECTION: ModelQualificationEvidenceSelection = {
  model_version_key: null,
  source_package_key: null,
  calibration_dataset_key: null,
  qualification_key: null
};

type CollectionIssue = "duplicate" | "conflict";
type ResolutionKind = "selected" | "stale" | "unknown";

type EntryResolution<T> =
  | { readonly kind: "selected"; readonly value: T }
  | { readonly kind: "stale" | "unknown" };

type LinkedEntryResolution<T> =
  | { readonly kind: "selected"; readonly value: T }
  | { readonly kind: "missing" };

function modelVersionKey(reference: ModelVersionReference): string {
  return `${reference.model_version_id}@${reference.version}#${reference.content_digest}`;
}

function modelVersionIdentityKey(reference: ModelVersionReference): string {
  return `${reference.model_version_id}@${reference.version}`;
}

export function modelVersionIdentity(reference: ModelVersionReference): string {
  return modelVersionKey(reference);
}

export function sourcePackageIdentity(sourcePackage: ModelQualificationSourcePackage): string {
  return sourcePackageKey(sourcePackage);
}

export function calibrationDatasetIdentity(dataset: ModelQualificationCalibrationDataset): string {
  return calibrationDatasetKey(dataset);
}

export function qualificationIdentity(qualification: ModelQualification): string {
  return qualificationKey(qualification);
}

function modelCatalogEntryKey(model: ModelQualificationModelCatalogEntry): string {
  return modelVersionKey(model.model_version_reference);
}

function modelCatalogEntryIdentityKey(model: ModelQualificationModelCatalogEntry): string {
  return modelVersionIdentityKey(model.model_version_reference);
}

function sourcePackageKey(sourcePackage: ModelQualificationSourcePackage): string {
  return `${sourcePackage.source_package_id}#${sourcePackage.content_digest}`;
}

function sourcePackageIdentityKey(sourcePackage: ModelQualificationSourcePackage): string {
  return sourcePackage.source_package_id;
}

function calibrationDatasetKey(dataset: ModelQualificationCalibrationDataset): string {
  return `${dataset.calibration_dataset_id}#${dataset.content_digest}`;
}

function calibrationDatasetIdentityKey(dataset: ModelQualificationCalibrationDataset): string {
  return dataset.calibration_dataset_id;
}

function qualificationKey(qualification: ModelQualification): string {
  return `${qualification.qualification_id}#${qualification.content_digest}`;
}

function qualificationIdentityKey(qualification: ModelQualification): string {
  return qualification.qualification_id;
}

function statusForState(
  state: ModelQualificationEvidenceSelectionState
): ModelQualificationEvidenceSelectionStatus {
  switch (state) {
    case "selected":
      return "SELECTED";
    case "empty":
      return "EMPTY";
    case "no-selection":
      return "NO_SELECTION";
    case "stale":
      return "STALE";
    case "missing-linked-item":
      return "MISSING_LINKED_ITEM";
    case "mismatch":
      return "MISMATCH";
    case "invalid-context":
      return "INVALID_CONTEXT";
    case "duplicate":
      return "DUPLICATE";
    case "conflict":
      return "CONFLICT";
    case "unknown":
      return "UNKNOWN";
  }
}

function result(
  state: ModelQualificationEvidenceSelectionState,
  selected: ModelQualificationEvidenceSelectionResult["selected"] = null
): ModelQualificationEvidenceSelectionResult {
  return { selected, state, status: statusForState(state) };
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isCompleteSelection(value: unknown): value is CompleteModelQualificationEvidenceSelection {
  if (value === null || typeof value !== "object") return false;

  const selection = value as Partial<ModelQualificationEvidenceSelection>;
  return (
    isNonBlankString(selection.model_version_key) &&
    isNonBlankString(selection.source_package_key) &&
    isNonBlankString(selection.calibration_dataset_key) &&
    isNonBlankString(selection.qualification_key) &&
    Object.keys(selection).length === 4
  );
}

function hasValidProjectionContext(
  projection: ModelQualificationTeacherProjection,
  context: ModelQualificationEvidenceSelectionContext
): boolean {
  if (
    !isNonBlankString(context.activityId) ||
    !isNonBlankString(context.courseId) ||
    !isNonBlankString(context.tenantId) ||
    !projection ||
    projection.operation_id !== "MODEL_QUALIFICATION_TEACHER_STUDIO_GET_V1" ||
    !projection.security ||
    projection.security.activity !== context.activityId ||
    projection.security.course !== context.courseId ||
    projection.security.tenant !== context.tenantId ||
    projection.security.role !== "teacher" ||
    !Array.isArray(projection.model_catalog) ||
    !Array.isArray(projection.source_packages) ||
    !Array.isArray(projection.calibration_datasets) ||
    !Array.isArray(projection.qualifications)
  ) {
    return false;
  }

  for (const sourcePackage of projection.source_packages) {
    if (
      sourcePackage.course_id !== context.courseId ||
      sourcePackage.tenant_id !== context.tenantId
    ) {
      return false;
    }
  }

  for (const dataset of projection.calibration_datasets) {
    if (dataset.course_id !== context.courseId || dataset.tenant_id !== context.tenantId) {
      return false;
    }
  }

  for (const qualification of projection.qualifications) {
    if (
      qualification.course_id !== context.courseId ||
      qualification.tenant_id !== context.tenantId ||
      (qualification.binding.course_id !== undefined &&
        qualification.binding.course_id !== context.courseId)
    ) {
      return false;
    }
  }

  return true;
}

function collectionIssue<T>(
  entries: readonly T[],
  identityKey: (entry: T) => string,
  exactKey: (entry: T) => string
): CollectionIssue | undefined {
  const exactCounts = new Map<string, number>();
  const exactKeysByIdentity = new Map<string, Set<string>>();

  for (const entry of entries) {
    const exact = exactKey(entry);
    const identity = identityKey(entry);
    exactCounts.set(exact, (exactCounts.get(exact) ?? 0) + 1);
    const identityKeys = exactKeysByIdentity.get(identity) ?? new Set<string>();
    identityKeys.add(exact);
    exactKeysByIdentity.set(identity, identityKeys);
  }

  for (const keys of exactKeysByIdentity.values()) {
    if (keys.size > 1) return "conflict";
  }

  for (const count of exactCounts.values()) {
    if (count > 1) return "duplicate";
  }

  return undefined;
}

function projectionCollectionIssue(
  projection: ModelQualificationTeacherProjection
): CollectionIssue | undefined {
  const issues = [
    collectionIssue(projection.model_catalog, modelCatalogEntryIdentityKey, modelCatalogEntryKey),
    collectionIssue(projection.source_packages, sourcePackageIdentityKey, sourcePackageKey),
    collectionIssue(
      projection.calibration_datasets,
      calibrationDatasetIdentityKey,
      calibrationDatasetKey
    ),
    collectionIssue(projection.qualifications, qualificationIdentityKey, qualificationKey)
  ];

  for (const issue of issues) {
    if (issue === "conflict") return issue;
  }
  for (const issue of issues) {
    if (issue === "duplicate") return issue;
  }
  return undefined;
}

function resolveExactEntry<T>(
  entries: readonly T[],
  requestedKey: string,
  identityKey: (entry: T) => string,
  exactKey: (entry: T) => string
): EntryResolution<T> {
  let exactMatch: T | undefined;
  let exactCount = 0;

  for (const entry of entries) {
    if (exactKey(entry) === requestedKey) {
      exactMatch = entry;
      exactCount += 1;
    }
  }

  if (exactCount === 1 && exactMatch !== undefined) {
    return { kind: "selected", value: exactMatch };
  }
  if (exactCount > 1) return { kind: "unknown" };

  for (const entry of entries) {
    if (requestedKey.startsWith(`${identityKey(entry)}#`)) {
      return { kind: "stale" };
    }
  }

  return { kind: "unknown" };
}

function resolveLinkedEntry<T>(
  entries: readonly T[],
  matches: (entry: T) => boolean
): LinkedEntryResolution<T> {
  let linkedEntry: T | undefined;
  let linkedCount = 0;

  for (const entry of entries) {
    if (matches(entry)) {
      linkedEntry = entry;
      linkedCount += 1;
    }
  }

  if (linkedCount === 1 && linkedEntry !== undefined) {
    return { kind: "selected", value: linkedEntry };
  }
  return { kind: "missing" };
}

function nonSelectedState(kind: ResolutionKind): "stale" | "unknown" {
  return kind === "stale" ? "stale" : "unknown";
}

export function createEmptyModelQualificationSelection(): ModelQualificationEvidenceSelection {
  return { ...EMPTY_SELECTION };
}

export function buildExactModelQualificationSelection(
  model: ModelQualificationModelCatalogEntry,
  source: ModelQualificationSourcePackage,
  dataset: ModelQualificationCalibrationDataset,
  qualification: ModelQualification
): ModelQualificationEvidenceSelection {
  return {
    calibration_dataset_key: calibrationDatasetKey(dataset),
    model_version_key: modelVersionKey(model.model_version_reference),
    qualification_key: qualificationKey(qualification),
    source_package_key: sourcePackageKey(source)
  };
}

export function resolveModelQualificationEvidenceSelection(
  input: ResolveModelQualificationEvidenceSelectionInput
): ModelQualificationEvidenceSelectionResult {
  const { context, projection, selection } = input;

  if (!hasValidProjectionContext(projection, context)) return result("invalid-context");

  if (selection === null || selection === undefined) {
    const isEmpty =
      projection.model_catalog.length === 0 &&
      projection.source_packages.length === 0 &&
      projection.calibration_datasets.length === 0 &&
      projection.qualifications.length === 0;
    return result(isEmpty ? "empty" : "no-selection");
  }

  if (!isCompleteSelection(selection)) return result("unknown");

  const issue = projectionCollectionIssue(projection);
  if (issue) return result(issue);

  const model = resolveExactEntry(
    projection.model_catalog,
    selection.model_version_key,
    modelCatalogEntryIdentityKey,
    modelCatalogEntryKey
  );
  if (model.kind !== "selected") return result(nonSelectedState(model.kind));

  const source = resolveExactEntry(
    projection.source_packages,
    selection.source_package_key,
    sourcePackageIdentityKey,
    sourcePackageKey
  );
  if (source.kind !== "selected") return result(nonSelectedState(source.kind));

  const dataset = resolveExactEntry(
    projection.calibration_datasets,
    selection.calibration_dataset_key,
    calibrationDatasetIdentityKey,
    calibrationDatasetKey
  );
  if (dataset.kind !== "selected") return result(nonSelectedState(dataset.kind));

  const qualification = resolveExactEntry(
    projection.qualifications,
    selection.qualification_key,
    qualificationIdentityKey,
    qualificationKey
  );
  if (qualification.kind !== "selected") return result(nonSelectedState(qualification.kind));

  if (qualification.value.no_implicit_latest !== true) return result("unknown");

  const linkedSource = resolveLinkedEntry(
    projection.source_packages,
    (candidate) => candidate.source_package_id === qualification.value.source_package_id
  );
  if (linkedSource.kind !== "selected") return result("missing-linked-item");

  const linkedDataset = resolveLinkedEntry(
    projection.calibration_datasets,
    (candidate) => candidate.calibration_dataset_id === qualification.value.calibration_dataset_id
  );
  if (linkedDataset.kind !== "selected") return result("missing-linked-item");

  const linkedModel = resolveExactEntry(
    projection.model_catalog,
    modelVersionKey(qualification.value.model_version_reference),
    modelCatalogEntryIdentityKey,
    modelCatalogEntryKey
  );
  if (linkedModel.kind === "stale") return result("stale");
  if (linkedModel.kind !== "selected") return result("missing-linked-item");

  if (
    sourcePackageKey(linkedSource.value) !== selection.source_package_key ||
    calibrationDatasetKey(linkedDataset.value) !== selection.calibration_dataset_key ||
    modelCatalogEntryKey(linkedModel.value) !== selection.model_version_key ||
    linkedDataset.value.source_package_id !== source.value.source_package_id
  ) {
    return result("mismatch");
  }

  return result("selected", {
    dataset: dataset.value,
    model: model.value,
    qualification: qualification.value,
    source: source.value
  });
}
