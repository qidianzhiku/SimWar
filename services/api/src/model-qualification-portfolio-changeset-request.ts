import type { ModelQualificationCoursePortfolio } from "./model-qualification-course-portfolio.js";
import type {
  ModelQualificationPortfolioAdoptionIdentity,
  ModelQualificationPortfolioCourseSupersessionPreview,
  ModelQualificationPortfolioSupersessionPreview
} from "./model-qualification-portfolio-supersession-preview.js";
import { stableSha256 } from "./model-qualification-adoption-drift-assessment.js";

export const MODEL_QUALIFICATION_PORTFOLIO_CHANGESET_SCHEMA_VERSION =
  "model-qualification-portfolio-changeset.v1" as const;
export const MODEL_QUALIFICATION_PORTFOLIO_CHANGESET_POLICY_VERSION =
  "model-qualification-portfolio-changeset-policy.v1" as const;

export const PORTFOLIO_CHANGESET_POLICY = Object.freeze({
  schema_version: MODEL_QUALIFICATION_PORTFOLIO_CHANGESET_POLICY_VERSION,
  allowed_readiness: [
    "KEEP_CURRENT",
    "REVIEW_EXISTING",
    "REQUALIFY_CURRENT",
    "REQUEST_GOVERNED_ROLLBACK",
    "REBASE_REQUIRED",
    "BLOCKED",
    "NO_ACTIONABLE_ADOPTION"
  ],
  cross_course_transaction: false,
  bulk_apply: false,
  handoff_execution: false,
  apply: false,
  request_persistence: false,
  writer_effect: "NONE"
} as const);

export type PortfolioChangeSetRequestStatus = "READY" | "BLOCKED" | "REBASE_REQUIRED";

export interface PortfolioChangeSetCourseSelection {
  readonly course_id: string;
  readonly tenant_id: string;
  readonly selected_course_state_digest: string;
  readonly current_adoption: ModelQualificationPortfolioAdoptionIdentity | null;
}

export interface PortfolioChangeSetRequestReadback {
  readonly request_digest: string;
  readonly expected_portfolio_state_digest: string;
  readonly current_portfolio_state_digest: string;
  readonly request_persisted: false;
  readonly handoff_executed: false;
  readonly apply: false;
  readonly bulk_apply: false;
  readonly cross_course_transaction: false;
  readonly writer_effect: "NONE";
  readonly formal_truth_write: false;
}

export interface PortfolioChangeSetRequestEnvelope {
  readonly schema_version: typeof MODEL_QUALIFICATION_PORTFOLIO_CHANGESET_SCHEMA_VERSION;
  readonly request_id: string;
  readonly request_digest: string;
  readonly tenant_id: string;
  readonly portfolio_id: string;
  readonly preview_id: string;
  readonly preview_digest: string;
  readonly expected_portfolio_state_digest: string;
  readonly current_portfolio_state_digest: string;
  readonly changeset_policy_version: typeof MODEL_QUALIFICATION_PORTFOLIO_CHANGESET_POLICY_VERSION;
  readonly changeset_policy_digest: string;
  readonly selected_course_ids: readonly string[];
  readonly selected_courses: readonly PortfolioChangeSetCourseSelection[];
  readonly preview_status: ModelQualificationPortfolioSupersessionPreview["status"];
  readonly status: PortfolioChangeSetRequestStatus;
  readonly requestable: boolean;
  readonly derived: true;
  readonly query_only: true;
  readonly provider: "OFF";
  readonly writer_effect: "NONE";
  readonly request_persisted: false;
  readonly handoff_executed: false;
  readonly apply: false;
  readonly bulk_apply: false;
  readonly cross_course_transaction: false;
  readonly official_truth_write: false;
  readonly formal_truth_write: false;
  readonly known_limits: readonly string[];
  readonly readback: PortfolioChangeSetRequestReadback;
}

export interface PortfolioChangeSetRequestInput {
  readonly portfolio: ModelQualificationCoursePortfolio;
  readonly preview: ModelQualificationPortfolioSupersessionPreview;
  readonly expected_portfolio_state_digest: string;
  readonly expected_changeset_policy_digest: string;
}

export type PortfolioChangeSetRequestErrorCode =
  | "O10_PORTFOLIO_INPUT_INVALID"
  | "O10_PORTFOLIO_STATE_DIGEST_CHANGED"
  | "O10_PREVIEW_INPUT_INVALID"
  | "O10_PREVIEW_PORTFOLIO_MISMATCH"
  | "O10_SELECTED_COURSE_IDENTITY_MISMATCH"
  | "O10_CHANGESET_POLICY_DIGEST_CHANGED";

export class PortfolioChangeSetRequestError extends Error {
  readonly code: PortfolioChangeSetRequestErrorCode;

  constructor(code: PortfolioChangeSetRequestErrorCode) {
    super(code);
    this.name = "PortfolioChangeSetRequestError";
    this.code = code;
  }
}

const DIGEST = /^[a-f0-9]{64}$/u;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

function sameAdoption(
  left: ModelQualificationPortfolioAdoptionIdentity | null,
  right: ModelQualificationPortfolioAdoptionIdentity | null
): boolean {
  return left === null || right === null
    ? left === right
    : left.adoption_id === right.adoption_id && left.adoption_digest === right.adoption_digest;
}

function coursePreview(
  preview: ModelQualificationPortfolioSupersessionPreview,
  courseId: string
): ModelQualificationPortfolioCourseSupersessionPreview | null {
  const matches = preview.course_previews.filter((item) => item.course_id === courseId);
  return matches.length === 1 ? matches[0]! : null;
}

function policyDigest(): string {
  return stableSha256(PORTFOLIO_CHANGESET_POLICY);
}

export function digestPortfolioChangeSetPolicy(): string {
  return policyDigest();
}

function statusForPreview(
  previewStatus: ModelQualificationPortfolioSupersessionPreview["status"]
): PortfolioChangeSetRequestStatus {
  if (previewStatus === "REBASE_REQUIRED") return "REBASE_REQUIRED";
  if (previewStatus === "BLOCKED") return "BLOCKED";
  return "READY";
}

function assertPortfolioEnvelope(portfolio: ModelQualificationCoursePortfolio): void {
  if (
    portfolio.schema_version !== "model-qualification-course-portfolio.v1" ||
    !isDigest(portfolio.portfolio_state_digest) ||
    portfolio.derived !== true ||
    portfolio.query_only !== true ||
    portfolio.provider !== "OFF" ||
    portfolio.no_new_writer !== true ||
    portfolio.no_new_store !== true ||
    portfolio.no_new_registry !== true ||
    portfolio.writer_effect !== "NONE" ||
    portfolio.official_truth_write !== false ||
    portfolio.formal_truth_write !== false ||
    portfolio.rollback_applied !== false ||
    portfolio.adoption_mutation !== false
  ) {
    throw new PortfolioChangeSetRequestError("O10_PORTFOLIO_INPUT_INVALID");
  }
}

function assertPreviewEnvelope(
  portfolio: ModelQualificationCoursePortfolio,
  preview: ModelQualificationPortfolioSupersessionPreview,
  expectedPortfolioStateDigest: string
): void {
  if (
    !isDigest(expectedPortfolioStateDigest) ||
    !isDigest(preview.preview_digest) ||
    preview.tenant_id !== portfolio.tenant_id ||
    preview.portfolio_id !== `model-qualification-course-portfolio:${portfolio.tenant_id}` ||
    preview.expected_portfolio_state_digest !== expectedPortfolioStateDigest ||
    preview.current_portfolio_state_digest !== portfolio.portfolio_state_digest ||
    preview.derived !== true ||
    preview.query_only !== true ||
    preview.preview_applied !== false ||
    preview.writer_effect !== "NONE" ||
    preview.writes_formal_truth !== false ||
    preview.selected_course_ids.length === 0
  ) {
    throw new PortfolioChangeSetRequestError("O10_PREVIEW_INPUT_INVALID");
  }
  if (new Set(preview.selected_course_ids).size !== preview.selected_course_ids.length) {
    throw new PortfolioChangeSetRequestError("O10_SELECTED_COURSE_IDENTITY_MISMATCH");
  }
  if (
    preview.expected_portfolio_state_digest !== preview.current_portfolio_state_digest &&
    preview.status !== "REBASE_REQUIRED"
  ) {
    throw new PortfolioChangeSetRequestError("O10_PORTFOLIO_STATE_DIGEST_CHANGED");
  }
}

/**
 * Compiles an exact O9 portfolio and exact supersession preview into a
 * deterministic, query-only O10 request. It never persists a request and it
 * never executes a per-course handoff or mutation.
 */
export function buildPortfolioChangeSetRequest(
  input: PortfolioChangeSetRequestInput
): PortfolioChangeSetRequestEnvelope {
  const { portfolio, preview } = input;
  assertPortfolioEnvelope(portfolio);
  const currentPolicyDigest = policyDigest();
  if (input.expected_changeset_policy_digest !== currentPolicyDigest) {
    throw new PortfolioChangeSetRequestError("O10_CHANGESET_POLICY_DIGEST_CHANGED");
  }
  assertPreviewEnvelope(portfolio, preview, input.expected_portfolio_state_digest);

  const selectedCourses = preview.selected_course_ids.map((courseId) => {
    const entryMatches = portfolio.courses.filter(
      (candidate) => candidate.course.course_id === courseId
    );
    const item = coursePreview(preview, courseId);
    if (entryMatches.length !== 1 || !item) {
      throw new PortfolioChangeSetRequestError("O10_SELECTED_COURSE_IDENTITY_MISMATCH");
    }
    const entry = entryMatches[0]!;
    if (
      entry.course.tenant_id !== portfolio.tenant_id ||
      item.selected_course_state_digest !== item.current_course_state_digest ||
      !sameAdoption(entry.current_adoption, item.current_adoption)
    ) {
      throw new PortfolioChangeSetRequestError("O10_SELECTED_COURSE_IDENTITY_MISMATCH");
    }
    return {
      course_id: courseId,
      tenant_id: portfolio.tenant_id,
      selected_course_state_digest: item.selected_course_state_digest,
      current_adoption: item.current_adoption ? clone(item.current_adoption) : null
    } satisfies PortfolioChangeSetCourseSelection;
  });

  const status = statusForPreview(preview.status);
  const body = {
    schema_version: MODEL_QUALIFICATION_PORTFOLIO_CHANGESET_SCHEMA_VERSION,
    tenant_id: portfolio.tenant_id,
    portfolio_id: `model-qualification-course-portfolio:${portfolio.tenant_id}`,
    preview_id: preview.preview_id,
    preview_digest: preview.preview_digest,
    expected_portfolio_state_digest: input.expected_portfolio_state_digest,
    current_portfolio_state_digest: portfolio.portfolio_state_digest,
    changeset_policy_version: MODEL_QUALIFICATION_PORTFOLIO_CHANGESET_POLICY_VERSION,
    changeset_policy_digest: currentPolicyDigest,
    selected_course_ids: [...preview.selected_course_ids],
    selected_courses: selectedCourses,
    preview_status: preview.status,
    status,
    requestable: status === "READY",
    derived: true as const,
    query_only: true as const,
    provider: "OFF" as const,
    writer_effect: "NONE" as const,
    request_persisted: false as const,
    handoff_executed: false as const,
    apply: false as const,
    bulk_apply: false as const,
    cross_course_transaction: false as const,
    official_truth_write: false as const,
    formal_truth_write: false as const,
    known_limits: [
      "This O10 envelope is a derived request candidate; it is not persisted and does not execute handoff or apply.",
      "Each course remains an independent handoff to an existing course-scoped governance seam; no cross-course transaction exists.",
      "Course membership and governance identity come from exact O9 source snapshots; stale digests require rebase.",
      "Provider is OFF; no adoption, rollback, requalification, Run, settlement, score, rank, or official truth is changed.",
      "No latest, current, default, fallback, first, last, or newest-timestamp selector is used."
    ] as const
  };
  const requestDigest = stableSha256(body);
  const readback: PortfolioChangeSetRequestReadback = {
    request_digest: requestDigest,
    expected_portfolio_state_digest: input.expected_portfolio_state_digest,
    current_portfolio_state_digest: portfolio.portfolio_state_digest,
    request_persisted: false,
    handoff_executed: false,
    apply: false,
    bulk_apply: false,
    cross_course_transaction: false,
    writer_effect: "NONE",
    formal_truth_write: false
  };
  return {
    ...body,
    request_id: `o10_portfolio_changeset_request_${requestDigest.slice(0, 24)}`,
    request_digest: requestDigest,
    readback
  };
}
