import { createHash } from "node:crypto";

const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const RESERVED_SELECTORS = new Set([
  "current",
  "default",
  "fallback",
  "first",
  "last",
  "latest",
  "newest"
]);

/** Read-only states that this preview may derive; none is a mutation command. */
export type ModelQualificationPortfolioSupersessionReadiness =
  | "KEEP_CURRENT"
  | "REVIEW_EXISTING"
  | "REQUALIFY_CURRENT"
  | "REQUEST_GOVERNED_ROLLBACK"
  | "REBASE_REQUIRED"
  | "BLOCKED"
  | "NO_ACTIONABLE_ADOPTION";

export interface ModelQualificationPortfolioAdoptionIdentity {
  readonly adoption_id: string;
  readonly adoption_digest: string;
}

export interface ModelQualificationPortfolioCourseState {
  readonly current_adoption: ModelQualificationPortfolioAdoptionIdentity | null;
  readonly governed_rollback_available: boolean;
  readonly requalification_required: boolean;
  readonly review_required: boolean;
  readonly blocked_reasons: readonly string[];
}

export interface ModelQualificationPortfolioCourse {
  readonly authorized: boolean;
  readonly course_id: string;
  readonly state: ModelQualificationPortfolioCourseState;
  readonly tenant_id: string;
}

export interface ModelQualificationPortfolio {
  readonly courses: readonly ModelQualificationPortfolioCourse[];
  readonly portfolio_id: string;
  /** Canonical O9 portfolio digest supplied by the integrator when available. */
  readonly portfolio_state_digest?: string;
  readonly tenant_id: string;
}

/**
 * A selected identity is a caller-owned snapshot, not a lookup instruction.
 * The state digest and adoption reference make a stale selection observable.
 */
export interface ModelQualificationPortfolioCourseIdentity {
  readonly course_id: string;
  readonly course_state_digest: string;
  readonly current_adoption: ModelQualificationPortfolioAdoptionIdentity | null;
  readonly tenant_id: string;
}

export interface ModelQualificationPortfolioSupersessionPreviewInput {
  readonly expected_portfolio_state_digest: string;
  readonly portfolio: ModelQualificationPortfolio;
  readonly selected_course_identities: readonly ModelQualificationPortfolioCourseIdentity[];
}

export interface ModelQualificationPortfolioCourseSupersessionPreview {
  readonly course_id: string;
  readonly current_adoption: ModelQualificationPortfolioAdoptionIdentity | null;
  readonly current_course_state_digest: string;
  readonly reasons: readonly string[];
  readonly selected_course_state_digest: string;
  readonly status: Exclude<ModelQualificationPortfolioSupersessionReadiness, "REBASE_REQUIRED">;
}

export interface ModelQualificationPortfolioSupersessionPreview {
  readonly blockers: readonly string[];
  readonly course_previews: readonly ModelQualificationPortfolioCourseSupersessionPreview[];
  readonly current_portfolio_state_digest: string;
  readonly derived: true;
  readonly expected_portfolio_state_digest: string;
  readonly portfolio_id: string;
  readonly preview_applied: false;
  readonly preview_digest: string;
  readonly preview_id: string;
  readonly query_only: true;
  readonly selected_course_ids: readonly string[];
  readonly status: ModelQualificationPortfolioSupersessionReadiness;
  readonly tenant_id: string;
  readonly writer_effect: "NONE";
  readonly writes_formal_truth: false;
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Canonical JSON with sorted object keys and explicitly preserved array semantics. */
function canonical(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("O9_PORTFOLIO_CANONICAL_VALUE_INVALID");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(",")}]`;
  if (!isPlainRecord(value)) throw new Error("O9_PORTFOLIO_CANONICAL_VALUE_INVALID");
  return `{${Object.keys(value)
    .sort(compareStrings)
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(",")}}`;
}

function stableSha256(value: unknown): string {
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST_PATTERN.test(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isReservedSelector(value: string): boolean {
  return RESERVED_SELECTORS.has(value.trim().toLowerCase());
}

function sameAdoption(
  left: ModelQualificationPortfolioAdoptionIdentity | null | undefined,
  right: ModelQualificationPortfolioAdoptionIdentity | null | undefined
): boolean {
  if (left === null || left === undefined || right === null || right === undefined) {
    return left === right;
  }
  return left.adoption_id === right.adoption_id && left.adoption_digest === right.adoption_digest;
}

function isAdoptionIdentity(value: unknown): value is ModelQualificationPortfolioAdoptionIdentity {
  return (
    isPlainRecord(value) && isNonBlankString(value.adoption_id) && isDigest(value.adoption_digest)
  );
}

function normalizeAdoption(
  value: ModelQualificationPortfolioAdoptionIdentity | null
): ModelQualificationPortfolioAdoptionIdentity | null {
  return value === null
    ? null
    : { adoption_id: value.adoption_id, adoption_digest: value.adoption_digest };
}

function normalizeCourseState(
  state: ModelQualificationPortfolioCourseState
): ModelQualificationPortfolioCourseState {
  return {
    blocked_reasons: [...state.blocked_reasons].sort(compareStrings),
    current_adoption: normalizeAdoption(state.current_adoption),
    governed_rollback_available: state.governed_rollback_available,
    requalification_required: state.requalification_required,
    review_required: state.review_required
  };
}

function normalizePortfolio(portfolio: ModelQualificationPortfolio): ModelQualificationPortfolio {
  return {
    courses: [...portfolio.courses]
      .map((course) => ({
        authorized: course.authorized,
        course_id: course.course_id,
        state: normalizeCourseState(course.state),
        tenant_id: course.tenant_id
      }))
      .sort((left, right) =>
        compareStrings(
          `${left.tenant_id}\u0000${left.course_id}`,
          `${right.tenant_id}\u0000${right.course_id}`
        )
      ),
    portfolio_id: portfolio.portfolio_id,
    ...(portfolio.portfolio_state_digest
      ? { portfolio_state_digest: portfolio.portfolio_state_digest }
      : {}),
    tenant_id: portfolio.tenant_id
  };
}

/** Computes the exact digest that a selected course identity must carry. */
export function digestModelQualificationPortfolioCourseState(
  state: ModelQualificationPortfolioCourseState
): string {
  return stableSha256(normalizeCourseState(state));
}

/** Computes the current exact portfolio digest without changing the portfolio. */
export function digestModelQualificationPortfolioState(
  portfolio: ModelQualificationPortfolio
): string {
  if (isDigest(portfolio.portfolio_state_digest)) return portfolio.portfolio_state_digest;
  return stableSha256(normalizePortfolio(portfolio));
}

function onlyMatch<T>(items: readonly T[]): T | undefined {
  if (items.length !== 1) return undefined;
  for (const item of items) return item;
  return undefined;
}

function addUnique(blockers: string[], blocker: string): void {
  if (!blockers.includes(blocker)) blockers.push(blocker);
}

function validCourseState(value: unknown): value is ModelQualificationPortfolioCourseState {
  if (!isPlainRecord(value) || !Array.isArray(value.blocked_reasons)) return false;
  return (
    (value.current_adoption === null || isAdoptionIdentity(value.current_adoption)) &&
    typeof value.governed_rollback_available === "boolean" &&
    typeof value.requalification_required === "boolean" &&
    typeof value.review_required === "boolean" &&
    value.blocked_reasons.every((reason) => isNonBlankString(reason))
  );
}

function validCourse(value: unknown): value is ModelQualificationPortfolioCourse {
  return (
    isPlainRecord(value) &&
    isNonBlankString(value.course_id) &&
    isNonBlankString(value.tenant_id) &&
    typeof value.authorized === "boolean" &&
    validCourseState(value.state)
  );
}

function validPortfolio(value: unknown): value is ModelQualificationPortfolio {
  return (
    isPlainRecord(value) &&
    isNonBlankString(value.portfolio_id) &&
    isNonBlankString(value.tenant_id) &&
    (value.portfolio_state_digest === undefined || isDigest(value.portfolio_state_digest)) &&
    Array.isArray(value.courses) &&
    value.courses.every((course) => validCourse(course))
  );
}

function validCourseIdentity(value: unknown): value is ModelQualificationPortfolioCourseIdentity {
  return (
    isPlainRecord(value) &&
    isNonBlankString(value.course_id) &&
    isNonBlankString(value.tenant_id) &&
    isDigest(value.course_state_digest) &&
    (value.current_adoption === null || isAdoptionIdentity(value.current_adoption))
  );
}

function courseStatus(
  state: ModelQualificationPortfolioCourseState
): Exclude<ModelQualificationPortfolioSupersessionReadiness, "REBASE_REQUIRED"> {
  if (state.blocked_reasons.length > 0) return "BLOCKED";
  if (state.current_adoption === null) return "NO_ACTIONABLE_ADOPTION";
  if (state.requalification_required) return "REQUALIFY_CURRENT";
  if (state.review_required) return "REVIEW_EXISTING";
  if (state.governed_rollback_available) return "REQUEST_GOVERNED_ROLLBACK";
  return "KEEP_CURRENT";
}

function overallStatus(
  coursePreviews: readonly ModelQualificationPortfolioCourseSupersessionPreview[],
  blockers: readonly string[]
): ModelQualificationPortfolioSupersessionReadiness {
  if (blockers.length > 0) return "REBASE_REQUIRED";
  if (coursePreviews.length === 0) return "NO_ACTIONABLE_ADOPTION";
  if (coursePreviews.some((preview) => preview.status === "BLOCKED")) return "BLOCKED";
  if (coursePreviews.some((preview) => preview.status === "REQUALIFY_CURRENT")) {
    return "REQUALIFY_CURRENT";
  }
  if (coursePreviews.some((preview) => preview.status === "REVIEW_EXISTING")) {
    return "REVIEW_EXISTING";
  }
  if (coursePreviews.some((preview) => preview.status === "REQUEST_GOVERNED_ROLLBACK")) {
    return "REQUEST_GOVERNED_ROLLBACK";
  }
  if (coursePreviews.some((preview) => preview.status === "KEEP_CURRENT")) return "KEEP_CURRENT";
  return "NO_ACTIONABLE_ADOPTION";
}

function previewBody(
  input: ModelQualificationPortfolioSupersessionPreviewInput,
  currentPortfolioStateDigest: string,
  selectedCourseIds: readonly string[],
  coursePreviews: readonly ModelQualificationPortfolioCourseSupersessionPreview[],
  blockers: readonly string[],
  status: ModelQualificationPortfolioSupersessionReadiness
) {
  return {
    blockers: [...blockers],
    course_previews: coursePreviews.map((preview) => clone(preview)),
    current_portfolio_state_digest: currentPortfolioStateDigest,
    derived: true as const,
    expected_portfolio_state_digest: input.expected_portfolio_state_digest,
    portfolio_id: input.portfolio.portfolio_id,
    preview_applied: false as const,
    query_only: true as const,
    selected_course_ids: [...selectedCourseIds],
    status,
    tenant_id: input.portfolio.tenant_id,
    writer_effect: "NONE" as const,
    writes_formal_truth: false as const
  };
}

/**
 * Pure O9 A2 supersession preview. It only evaluates materialized exact input;
 * it never reads a store, selects a predecessor, applies a preview, or writes
 * formal truth.
 */
export function buildModelQualificationPortfolioSupersessionPreview(
  input: ModelQualificationPortfolioSupersessionPreviewInput
): ModelQualificationPortfolioSupersessionPreview {
  const blockers: string[] = [];
  const portfolio = input?.portfolio;
  const selected = Array.isArray(input?.selected_course_identities)
    ? input.selected_course_identities
    : [];
  const currentPortfolioStateDigest = validPortfolio(portfolio)
    ? digestModelQualificationPortfolioState(portfolio)
    : "";

  if (!validPortfolio(portfolio)) addUnique(blockers, "PORTFOLIO_INVALID");
  if (!isDigest(input?.expected_portfolio_state_digest)) {
    addUnique(blockers, "EXPECTED_PORTFOLIO_STATE_DIGEST_INVALID");
  } else if (input.expected_portfolio_state_digest !== currentPortfolioStateDigest) {
    addUnique(blockers, "PORTFOLIO_STATE_DIGEST_CHANGED");
  }

  if (validPortfolio(portfolio)) {
    const courseIds = new Set<string>();
    for (const course of portfolio.courses) {
      if (courseIds.has(course.course_id)) {
        addUnique(blockers, "PORTFOLIO_COURSE_ID_DUPLICATE");
      }
      courseIds.add(course.course_id);
      if (course.tenant_id !== portfolio.tenant_id) {
        addUnique(blockers, "PORTFOLIO_SCOPE_INVALID");
      }
    }
  }

  const selectedCourseIds = selected
    .map((identity) =>
      isPlainRecord(identity) && typeof identity.course_id === "string" ? identity.course_id : ""
    )
    .sort(compareStrings);
  const selectedIdCounts = new Map<string, number>();
  for (const identity of selected) {
    const courseId =
      isPlainRecord(identity) && typeof identity.course_id === "string" ? identity.course_id : "";
    selectedIdCounts.set(courseId, (selectedIdCounts.get(courseId) ?? 0) + 1);
  }

  const coursePreviews: ModelQualificationPortfolioCourseSupersessionPreview[] = [];
  if (validPortfolio(portfolio)) {
    for (const selectedIdentity of selected) {
      if (!validCourseIdentity(selectedIdentity)) {
        addUnique(blockers, "SELECTED_COURSE_IDENTITY_INVALID");
        continue;
      }
      if (isReservedSelector(selectedIdentity.course_id)) {
        addUnique(blockers, "SELECTED_COURSE_SELECTOR_FORBIDDEN");
      }
      if ((selectedIdCounts.get(selectedIdentity.course_id) ?? 0) > 1) {
        addUnique(blockers, "SELECTED_COURSE_ID_DUPLICATE");
        continue;
      }

      const matches = portfolio.courses.filter(
        (course) => course.course_id === selectedIdentity.course_id
      );
      if (matches.length === 0) {
        addUnique(blockers, "SELECTED_COURSE_NOT_FOUND");
        continue;
      }
      if (matches.length !== 1) {
        addUnique(blockers, "SELECTED_COURSE_ID_DUPLICATE");
        continue;
      }
      const currentCourse = onlyMatch(matches);
      if (!currentCourse) {
        addUnique(blockers, "SELECTED_COURSE_NOT_FOUND");
        continue;
      }
      if (
        selectedIdentity.tenant_id !== portfolio.tenant_id ||
        currentCourse.tenant_id !== portfolio.tenant_id ||
        currentCourse.authorized !== true
      ) {
        addUnique(blockers, "SELECTED_COURSE_NOT_AUTHORIZED");
        continue;
      }

      const currentCourseStateDigest = digestModelQualificationPortfolioCourseState(
        currentCourse.state
      );
      let selectedCourseChanged = false;
      if (selectedIdentity.course_state_digest !== currentCourseStateDigest) {
        addUnique(blockers, "SELECTED_COURSE_STATE_CHANGED");
        selectedCourseChanged = true;
      }
      if (!sameAdoption(selectedIdentity.current_adoption, currentCourse.state.current_adoption)) {
        addUnique(blockers, "SELECTED_COURSE_ADOPTION_CHANGED");
        selectedCourseChanged = true;
      }
      if (selectedCourseChanged) {
        continue;
      }

      coursePreviews.push({
        course_id: currentCourse.course_id,
        current_adoption: clone(currentCourse.state.current_adoption),
        current_course_state_digest: currentCourseStateDigest,
        reasons: [...currentCourse.state.blocked_reasons].sort(compareStrings),
        selected_course_state_digest: selectedIdentity.course_state_digest,
        status: courseStatus(currentCourse.state)
      });
    }
  }

  coursePreviews.sort((left, right) => compareStrings(left.course_id, right.course_id));
  const status = overallStatus(coursePreviews, blockers);
  const body = previewBody(
    input,
    currentPortfolioStateDigest,
    selectedCourseIds,
    coursePreviews,
    blockers,
    status
  );
  const previewDigest = stableSha256(body);
  return clone({
    ...body,
    preview_digest: previewDigest,
    preview_id: `model-qualification-portfolio-supersession-preview-${previewDigest}`
  });
}
