export const LEARNING_DESIGN_SCHEMA_VERSION = "learning-design.v1" as const;
export const LEARNING_DESIGN_STATUSES = ["DRAFT", "VALIDATED", "PUBLISHED", "REJECTED"] as const;
export type LearningDesignStatus = (typeof LEARNING_DESIGN_STATUSES)[number];

export const LEARNING_DESIGN_FAILURE_CODES = [
  "LEARNING_DESIGN_INPUT_INVALID",
  "LEARNING_DESIGN_NOT_FOUND",
  "LEARNING_DESIGN_TENANT_SCOPE_VIOLATION",
  "LEARNING_DESIGN_COURSE_PACKAGE_NOT_AVAILABLE",
  "LEARNING_DESIGN_DUPLICATE_VERSION",
  "LEARNING_DESIGN_INVALID_TRANSITION",
  "LEARNING_DESIGN_DEPENDENCY_NOT_PUBLISHED",
  "LEARNING_DESIGN_REFERENCE_DIGEST_MISMATCH",
  "LEARNING_DESIGN_FORBIDDEN",
  "LEARNING_DESIGN_AUDIT_FAILED"
] as const;
export type LearningDesignFailureCode = (typeof LEARNING_DESIGN_FAILURE_CODES)[number];

export interface LearningDesignExactReference {
  content_digest: string;
  tenant_id: string;
  version: string;
}

export interface LearningGoalVersionReference extends LearningDesignExactReference {
  goal_id: string;
}

export interface RubricVersionReference extends LearningDesignExactReference {
  rubric_id: string;
}

export interface LearningDesignActivityReference {
  activity_id: string;
  content_digest: string;
  version: string;
}

export interface LearningGoalVersion {
  activity_refs: LearningDesignActivityReference[];
  content_digest: string;
  course_package_reference: LearningDesignExactReference & { course_package_id: string };
  created_at: string;
  created_by: string;
  expected_evidence_classes: string[];
  goal_id: string;
  observable_behaviors: string[];
  role_scope: string[];
  schema_version: typeof LEARNING_DESIGN_SCHEMA_VERSION;
  statement: string;
  status: LearningDesignStatus;
  supersedes_ref?: LearningGoalVersionReference;
  tenant_id: string;
  title: string;
  version: string;
}

export interface RubricLevel {
  description: string;
  label: string;
  ordinal: number;
}

export interface RubricCriterion {
  criterion_id: string;
  levels: RubricLevel[];
  prompt: string;
}

export interface RubricVersion {
  content_digest: string;
  course_package_reference: LearningDesignExactReference & { course_package_id: string };
  created_at: string;
  created_by: string;
  criteria: RubricCriterion[];
  learning_goal_references: LearningGoalVersionReference[];
  rubric_id: string;
  schema_version: typeof LEARNING_DESIGN_SCHEMA_VERSION;
  scoring_policy: "NOT_ACTIVE_D1";
  status: LearningDesignStatus;
  supersedes_ref?: RubricVersionReference;
  tenant_id: string;
  title: string;
  version: string;
}

export interface LearningGoalDraftInput {
  activity_refs: LearningDesignActivityReference[];
  course_package_reference: LearningGoalVersion["course_package_reference"];
  expected_evidence_classes: string[];
  goal_id: string;
  observable_behaviors: string[];
  role_scope: string[];
  statement: string;
  title: string;
  version: string;
}

export interface RubricDraftInput {
  course_package_reference: RubricVersion["course_package_reference"];
  criteria: RubricCriterion[];
  learning_goal_references: LearningGoalVersionReference[];
  rubric_id: string;
  title: string;
  version: string;
}

export interface LearningGoalRevisionInput {
  source_reference: LearningGoalVersionReference;
  version: string;
}

export interface RubricRevisionInput {
  source_reference: RubricVersionReference;
  version: string;
}

export interface LearningDesignListDto {
  learning_goals: LearningGoalVersion[];
  rubrics: RubricVersion[];
  runtime_authority: "JSON_INTERNAL_ONLY";
  explicit_non_proofs: string[];
}

export interface LearningDesignCommandReceipt<TData> {
  data: TData;
  formal_truth_write: false;
  request_id: string;
  status: LearningDesignStatus;
}

const exactIdentityPattern = /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/;
const exactVersionPattern = /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/;
const digestPattern = /^[a-f0-9]{64}$/;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function isExactIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    exactIdentityPattern.test(value) &&
    !/(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(value)
  );
}

function isExactVersion(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    exactVersionPattern.test(value) &&
    !/^[xX*]$/.test(value) &&
    !/(?:^|[._:-])[xX*](?:$|[._:-])/.test(value)
  );
}

function isNonBlankText(value: unknown): value is string {
  return typeof value === "string" && value === value.trim() && value.trim().length > 0;
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && digestPattern.test(value);
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    timestampPattern.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function assertTextList(value: unknown, allowEmpty = false): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    value.some((item) => typeof item !== "string" || !item.trim() || item !== item.trim())
  ) {
    throw new Error("LEARNING_DESIGN_INPUT_INVALID");
  }
}

function assertExactReference(
  value: unknown,
  key: string
): asserts value is LearningDesignExactReference {
  if (!value || typeof value !== "object") throw new Error("LEARNING_DESIGN_INPUT_INVALID");
  const reference = value as Record<string, unknown>;
  const required = [key, "tenant_id", "version", "content_digest"];
  if (
    Object.keys(reference).some((field) => !required.includes(field)) ||
    Object.keys(reference).length !== required.length ||
    !isExactIdentity(reference[key]) ||
    !isExactIdentity(reference.tenant_id) ||
    !isExactVersion(reference.version) ||
    !isDigest(reference.content_digest)
  ) {
    throw new Error("LEARNING_DESIGN_INPUT_INVALID");
  }
}

function assertCoursePackageReference(
  value: unknown
): asserts value is LearningGoalVersion["course_package_reference"] {
  assertExactReference(value, "course_package_id");
}

function assertActivityReferences(
  value: unknown
): asserts value is LearningDesignActivityReference[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => {
      if (!item || typeof item !== "object") return true;
      const reference = item as Record<string, unknown>;
      return (
        Object.keys(reference).length !== 3 ||
        !isExactIdentity(reference.activity_id) ||
        !isExactVersion(reference.version) ||
        !isDigest(reference.content_digest)
      );
    })
  )
    throw new Error("LEARNING_DESIGN_INPUT_INVALID");
}

export function assertValidLearningGoalVersion(value: Readonly<LearningGoalVersion>): void {
  if (!value || typeof value !== "object") throw new Error("LEARNING_DESIGN_INPUT_INVALID");
  const keys = Object.keys(value);
  const allowed = [
    "activity_refs",
    "content_digest",
    "course_package_reference",
    "created_at",
    "created_by",
    "expected_evidence_classes",
    "goal_id",
    "observable_behaviors",
    "role_scope",
    "schema_version",
    "statement",
    "status",
    "supersedes_ref",
    "tenant_id",
    "title",
    "version"
  ];
  if (keys.some((key) => !allowed.includes(key))) {
    throw new Error("LEARNING_DESIGN_INPUT_INVALID");
  }
  if (
    !isExactIdentity(value.goal_id) ||
    !isExactIdentity(value.tenant_id) ||
    !isExactVersion(value.version) ||
    !isDigest(value.content_digest) ||
    !isExactIdentity(value.created_by) ||
    !isTimestamp(value.created_at) ||
    !isNonBlankText(value.title) ||
    !isNonBlankText(value.statement) ||
    value.schema_version !== LEARNING_DESIGN_SCHEMA_VERSION ||
    !LEARNING_DESIGN_STATUSES.includes(value.status) ||
    value.course_package_reference.tenant_id !== value.tenant_id
  )
    throw new Error("LEARNING_DESIGN_INPUT_INVALID");
  assertCoursePackageReference(value.course_package_reference);
  assertActivityReferences(value.activity_refs);
  assertTextList(value.expected_evidence_classes);
  assertTextList(value.observable_behaviors);
  assertTextList(value.role_scope);
  if (value.supersedes_ref !== undefined) {
    assertExactReference(value.supersedes_ref, "goal_id");
    if (value.supersedes_ref.tenant_id !== value.tenant_id)
      throw new Error("LEARNING_DESIGN_INPUT_INVALID");
  }
}

export function assertValidRubricVersion(value: Readonly<RubricVersion>): void {
  if (!value || typeof value !== "object") throw new Error("LEARNING_DESIGN_INPUT_INVALID");
  const allowed = [
    "content_digest",
    "course_package_reference",
    "created_at",
    "created_by",
    "criteria",
    "learning_goal_references",
    "rubric_id",
    "schema_version",
    "scoring_policy",
    "status",
    "supersedes_ref",
    "tenant_id",
    "title",
    "version"
  ];
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new Error("LEARNING_DESIGN_INPUT_INVALID");
  if (
    !isExactIdentity(value.rubric_id) ||
    !isExactIdentity(value.tenant_id) ||
    !isExactVersion(value.version) ||
    !isDigest(value.content_digest) ||
    !isExactIdentity(value.created_by) ||
    !isTimestamp(value.created_at) ||
    !isNonBlankText(value.title) ||
    value.schema_version !== LEARNING_DESIGN_SCHEMA_VERSION ||
    value.scoring_policy !== "NOT_ACTIVE_D1" ||
    !LEARNING_DESIGN_STATUSES.includes(value.status) ||
    value.course_package_reference.tenant_id !== value.tenant_id ||
    !Array.isArray(value.criteria) ||
    value.criteria.length === 0 ||
    !Array.isArray(value.learning_goal_references) ||
    value.learning_goal_references.length === 0
  )
    throw new Error("LEARNING_DESIGN_INPUT_INVALID");
  assertCoursePackageReference(value.course_package_reference);
  const criterionIds = new Set<string>();
  for (const criterion of value.criteria) {
    if (
      !criterion ||
      typeof criterion !== "object" ||
      Object.keys(criterion).some((key) => !["criterion_id", "levels", "prompt"].includes(key)) ||
      !isExactIdentity(criterion.criterion_id) ||
      criterionIds.has(criterion.criterion_id) ||
      !isNonBlankText(criterion.prompt) ||
      !Array.isArray(criterion.levels) ||
      criterion.levels.length === 0
    )
      throw new Error("LEARNING_DESIGN_INPUT_INVALID");
    criterionIds.add(criterion.criterion_id);
    const ordinals = new Set<number>();
    for (const level of criterion.levels) {
      if (
        !level ||
        typeof level !== "object" ||
        Object.keys(level).some((key) => !["description", "label", "ordinal"].includes(key)) ||
        !isNonBlankText(level.label) ||
        !isNonBlankText(level.description) ||
        !Number.isInteger(level.ordinal) ||
        level.ordinal < 1 ||
        ordinals.has(level.ordinal)
      )
        throw new Error("LEARNING_DESIGN_INPUT_INVALID");
      ordinals.add(level.ordinal);
    }
  }
  for (const reference of value.learning_goal_references) {
    assertExactReference(reference, "goal_id");
    if (reference.tenant_id !== value.tenant_id) throw new Error("LEARNING_DESIGN_INPUT_INVALID");
  }
  if (value.supersedes_ref !== undefined) {
    assertExactReference(value.supersedes_ref, "rubric_id");
    if (value.supersedes_ref.tenant_id !== value.tenant_id)
      throw new Error("LEARNING_DESIGN_INPUT_INVALID");
  }
}
