import type {
  ModelQualification,
  ModelQualificationCoursePortfolio,
  W4StrategicPortfolioProjection
} from "@simwar/shared-contracts";
import { stableSha256 } from "./model-qualification-adoption-drift-assessment.js";

export const STRATEGIC_PORTFOLIO_MODEL_GOVERNANCE_READINESS_SCHEMA_VERSION =
  "strategic-portfolio-model-governance-readiness.v1" as const;

export const STRATEGIC_PORTFOLIO_MODEL_GOVERNANCE_READINESS_POLICY = Object.freeze({
  policy_version: "strategic-portfolio-model-governance-readiness.v1",
  rules: [
    "W4 strategic portfolio is read only from the W4 Enterprise State service.",
    "MQR identity is read only from the canonical tenant course portfolio.",
    "A join is exact only when tenant, course, portfolio digest, adoption and qualification identities match.",
    "Any expected digest movement requires REBASE_REQUIRED.",
    "No latest, current, default, fallback, first, last, or newest timestamp selection is allowed.",
    "This readiness projection cannot create adoption, formal truth, settlement, score, rank, or replay state."
  ]
});

export const STRATEGIC_PORTFOLIO_MODEL_GOVERNANCE_READINESS_POLICY_DIGEST = stableSha256(
  STRATEGIC_PORTFOLIO_MODEL_GOVERNANCE_READINESS_POLICY
);

export type StrategicPortfolioModelGovernanceReadinessStatus =
  | "READY"
  | "REVIEW_REQUIRED"
  | "REQUALIFICATION_REQUIRED"
  | "ROLLBACK_CANDIDATE"
  | "REBASE_REQUIRED"
  | "BLOCKED"
  | "NO_QUALIFIED_MODEL";

export interface StrategicPortfolioModelGovernanceReadinessInput {
  readonly tenant_id: string;
  readonly mqr_portfolio: ModelQualificationCoursePortfolio;
  readonly strategic_portfolios: readonly W4StrategicPortfolioProjection[];
  readonly readiness_policy_digest: string;
  readonly expected_portfolio_state_digest?: string;
  readonly expected_strategic_portfolio_digests?: readonly {
    readonly portfolio_id: string;
    readonly portfolio_digest: string;
  }[];
}

export interface StrategicPortfolioModelGovernanceReadinessEntry {
  readonly current_adoption: ModelQualificationCoursePortfolio["courses"][number]["current_adoption"];
  readonly exact_scope: W4StrategicPortfolioProjection["exact_scope"];
  readonly known_limits: readonly string[];
  readonly model_qualification_portfolio_state_digest: string;
  readonly portfolio_id: string;
  readonly portfolio_digest: string;
  readonly blockers: readonly string[];
  readonly qualification: {
    readonly artifact: ModelQualification["artifact"];
    readonly calibration_dataset_id: string;
    readonly content_digest: string;
    readonly model_version_reference: ModelQualification["model_version_reference"];
    readonly qualification_id: string;
    readonly source_package_id: string;
  } | null;
  readonly readiness: StrategicPortfolioModelGovernanceReadinessStatus;
  readonly readiness_digest: string;
  readonly governance_handoff: {
    readonly available: boolean;
    readonly target: "MODEL_QUALIFICATION_GOVERNANCE";
    readonly query_only: true;
  };
  readonly adoption_state_digest: string | null;
  readonly course: ModelQualificationCoursePortfolio["courses"][number]["course"];
}

export interface StrategicPortfolioModelGovernanceReadiness {
  readonly schema_version: typeof STRATEGIC_PORTFOLIO_MODEL_GOVERNANCE_READINESS_SCHEMA_VERSION;
  readonly tenant_id: string;
  readonly readiness_policy_digest: string;
  readonly portfolio_state_digest: string;
  readonly entries: readonly StrategicPortfolioModelGovernanceReadinessEntry[];
  readonly blockers: readonly string[];
  readonly known_limits: readonly string[];
  readonly readiness_digest: string;
  readonly readiness_status: "READY" | "BLOCKED" | "REBASE_REQUIRED";
  readonly derived: true;
  readonly query_only: true;
  readonly no_new_writer: true;
  readonly no_new_store: true;
  readonly no_new_registry: true;
  readonly official_truth_write: false;
  readonly formal_truth_write: false;
  readonly settlement_write: false;
  readonly score_write: false;
  readonly rank_write: false;
  readonly provider: "OFF";
  readonly writer_effect: "NONE";
}

const GLOBAL_LIMITS = Object.freeze([
  "This is a deterministic derived query and does not persist a readiness result.",
  "W4 Enterprise State service remains the only W4 strategic portfolio authority.",
  "ModelQualificationService remains the only model-governance authority; Course membership is never inferred from governance records.",
  "Provider is OFF; no model, network, Writer, Store, Registry, or formal truth call is performed.",
  "No adoption, requalification, rollback, settlement, score, rank, replay, or historical receipt is written.",
  "No latest, current, default, fallback, first, last, or newest-timestamp selection is permitted."
] as const);

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function qualificationIdentity(
  qualification: ModelQualification | null
): StrategicPortfolioModelGovernanceReadinessEntry["qualification"] {
  if (!qualification) return null;
  return {
    artifact: structuredClone(qualification.artifact),
    calibration_dataset_id: qualification.calibration_dataset_id,
    content_digest: qualification.content_digest,
    model_version_reference: structuredClone(qualification.model_version_reference),
    qualification_id: qualification.qualification_id,
    source_package_id: qualification.source_package_id
  };
}

function expectedDigest(
  expected: StrategicPortfolioModelGovernanceReadinessInput["expected_strategic_portfolio_digests"],
  portfolioId: string
): string | null {
  const matches = (expected ?? []).filter((item) => item.portfolio_id === portfolioId);
  if (matches.length !== 1) return matches.length === 0 ? null : "__AMBIGUOUS__";
  return matches[0]!.portfolio_digest;
}

function deriveReadiness(
  entry: ModelQualificationCoursePortfolio["courses"][number],
  portfolio: W4StrategicPortfolioProjection,
  blockers: readonly string[]
): StrategicPortfolioModelGovernanceReadinessStatus {
  if (blockers.some((code) => code === "READINESS_POLICY_DIGEST_INVALID" || code === "READINESS_POLICY_DIGEST_MISMATCH")) {
    return "BLOCKED";
  }
  if (blockers.some((code) => code === "COURSE_NOT_IN_CANONICAL_AUTHORITY" || code === "W4_AUTHORITY_INVALID" || code === "W4_SCOPE_MISMATCH")) {
    return "BLOCKED";
  }
  if (!entry.qualification || !entry.current_adoption) return "NO_QUALIFIED_MODEL";
  if (blockers.length > 0) {
    if (blockers.some((code) => code === "PORTFOLIO_STATE_DIGEST_MISMATCH" || code === "W4_PORTFOLIO_DIGEST_MISMATCH")) {
      return "REBASE_REQUIRED";
    }
    if (blockers.some((code) => code.includes("QUALIFICATION") || code.includes("ADOPTION") || code.includes("EVIDENCE"))) {
      return entry.qualification?.review.status === "APPROVED" ? "REQUALIFICATION_REQUIRED" : "REVIEW_REQUIRED";
    }
    return "BLOCKED";
  }
  if (entry.qualification_consistency !== "CONSISTENT") return "REQUALIFICATION_REQUIRED";
  if (portfolio.constraints.status === "BREACHED") return "BLOCKED";
  if (portfolio.constraints.status === "UNFUNDED") return "REVIEW_REQUIRED";
  if (entry.o8_outcomes.some((outcome) => outcome.current_effect === "CURRENT" && outcome.outcome_status === "READOPTED_FOR_FUTURE_ADMISSION")) {
    return "ROLLBACK_CANDIDATE";
  }
  return "READY";
}

function entryDigestBody(entry: Omit<StrategicPortfolioModelGovernanceReadinessEntry, "readiness_digest">) {
  return {
    adoption_state_digest: entry.adoption_state_digest,
    blockers: entry.blockers,
    course: entry.course,
    current_adoption: entry.current_adoption,
    exact_scope: entry.exact_scope,
    model_qualification_portfolio_state_digest: entry.model_qualification_portfolio_state_digest,
    portfolio_digest: entry.portfolio_digest,
    portfolio_id: entry.portfolio_id,
    qualification: entry.qualification,
    readiness: entry.readiness,
    governance_handoff: entry.governance_handoff
  };
}

/**
 * Join the canonical W4 strategic portfolio projection to the canonical MQR
 * course portfolio. This is pure, query-only, and never discovers or writes
 * authority state.
 */
export function buildStrategicPortfolioModelGovernanceReadiness(
  input: StrategicPortfolioModelGovernanceReadinessInput
): StrategicPortfolioModelGovernanceReadiness {
  const tenantId = input.tenant_id;
  const mqr = input.mqr_portfolio;
  const globalBlockers: string[] = [];
  if (mqr.tenant_id !== tenantId) globalBlockers.push("MQR_TENANT_SCOPE_MISMATCH");
  if (mqr.portfolio_status !== "READY") globalBlockers.push("MQR_PORTFOLIO_BLOCKED");
  if (!isDigest(input.readiness_policy_digest)) globalBlockers.push("READINESS_POLICY_DIGEST_INVALID");
  if (input.readiness_policy_digest !== STRATEGIC_PORTFOLIO_MODEL_GOVERNANCE_READINESS_POLICY_DIGEST) {
    globalBlockers.push("READINESS_POLICY_DIGEST_MISMATCH");
  }
  if (input.expected_portfolio_state_digest && input.expected_portfolio_state_digest !== mqr.portfolio_state_digest) {
    globalBlockers.push("PORTFOLIO_STATE_DIGEST_MISMATCH");
  }

  const entries: StrategicPortfolioModelGovernanceReadinessEntry[] = [];
  for (const portfolio of [...input.strategic_portfolios].sort((left, right) =>
    left.portfolio_id.localeCompare(right.portfolio_id)
  )) {
    const entryBlockers: string[] = [];
    const scope = portfolio.exact_scope;
    if (
      portfolio.portfolio_ref.tenant_id !== tenantId ||
      scope.tenant_id !== tenantId ||
      portfolio.portfolio_ref.course_id !== scope.course_id ||
      portfolio.portfolio_ref.run_id !== scope.run_id ||
      portfolio.portfolio_ref.team_id !== scope.team_id ||
      portfolio.portfolio_ref.round_no !== scope.round_no
    ) {
      entryBlockers.push("W4_SCOPE_MISMATCH");
    }
    if (portfolio.writer_authority !== "SOLE_W4_ENTERPRISE_STATE_SERVICE" || portfolio.persistence.official_state_authority !== "W4_ENTERPRISE_STATE_SERVICE") {
      entryBlockers.push("W4_AUTHORITY_INVALID");
    }
    const expectedW4Digest = expectedDigest(input.expected_strategic_portfolio_digests, portfolio.portfolio_id);
    if (expectedW4Digest === "__AMBIGUOUS__") entryBlockers.push("W4_PORTFOLIO_DIGEST_AMBIGUOUS");
    else if (expectedW4Digest !== null && expectedW4Digest !== portfolio.portfolio_ref.portfolio_digest) entryBlockers.push("W4_PORTFOLIO_DIGEST_MISMATCH");

    const courseEntry = mqr.courses.find((candidate) => candidate.course.course_id === scope.course_id);
    if (!courseEntry || courseEntry.course.tenant_id !== tenantId) entryBlockers.push("COURSE_NOT_IN_CANONICAL_AUTHORITY");
    const selected = courseEntry ?? {
      adoption_state_digest: null,
      blockers: [],
      course: { course_id: scope.course_id, tenant_id: tenantId, title: "" },
      current_adoption: null,
      current_adoption_candidates: [],
      current_adoption_epoch: null,
      known_limits: [],
      o8_outcomes: [],
      qualification: null,
      qualification_candidates: [],
      qualification_consistency: "BLOCKED" as const,
      writer_effect: "NONE" as const
    };
    entryBlockers.push(...selected.blockers.map((blocker) => blocker.code));
    const blockers = uniqueSorted([...globalBlockers, ...entryBlockers]);
    const readiness = globalBlockers.some((code) => code === "PORTFOLIO_STATE_DIGEST_MISMATCH") || blockers.some((code) => code === "W4_PORTFOLIO_DIGEST_MISMATCH")
      ? "REBASE_REQUIRED"
      : deriveReadiness(selected, portfolio, blockers);
    const base: Omit<StrategicPortfolioModelGovernanceReadinessEntry, "readiness_digest"> = {
      current_adoption: selected.current_adoption ? structuredClone(selected.current_adoption) : null,
      exact_scope: structuredClone(scope),
      known_limits: uniqueSorted([...GLOBAL_LIMITS, ...selected.known_limits, ...portfolio.known_limits]),
      model_qualification_portfolio_state_digest: mqr.portfolio_state_digest,
      portfolio_id: portfolio.portfolio_id,
      portfolio_digest: portfolio.portfolio_ref.portfolio_digest,
      blockers,
      qualification: qualificationIdentity(selected.qualification),
      readiness,
      governance_handoff: { available: true, target: "MODEL_QUALIFICATION_GOVERNANCE", query_only: true },
      adoption_state_digest: selected.adoption_state_digest,
      course: structuredClone(selected.course)
    };
    entries.push({ ...base, readiness_digest: stableSha256(entryDigestBody(base)) });
  }

  if (entries.length === 0) globalBlockers.push("W4_STRATEGIC_PORTFOLIO_MISSING");
  const blockers = uniqueSorted(globalBlockers);
  const readinessStatus = blockers.some((code) => code.includes("DIGEST_MISMATCH")) || entries.some((entry) => entry.readiness === "REBASE_REQUIRED")
    ? "REBASE_REQUIRED"
    : blockers.length > 0 || entries.some((entry) => entry.readiness !== "READY")
      ? "BLOCKED"
      : "READY";
  const digestBody = {
    blockers,
    entries: entries.map(({ readiness_digest: _digest, ...entry }) => entry),
    portfolio_state_digest: mqr.portfolio_state_digest,
    readiness_policy_digest: input.readiness_policy_digest,
    readiness_status: readinessStatus,
    schema_version: STRATEGIC_PORTFOLIO_MODEL_GOVERNANCE_READINESS_SCHEMA_VERSION,
    tenant_id: tenantId
  };
  return {
    schema_version: STRATEGIC_PORTFOLIO_MODEL_GOVERNANCE_READINESS_SCHEMA_VERSION,
    tenant_id: tenantId,
    readiness_policy_digest: input.readiness_policy_digest,
    portfolio_state_digest: mqr.portfolio_state_digest,
    entries,
    blockers,
    known_limits: [...GLOBAL_LIMITS],
    readiness_digest: stableSha256(digestBody),
    readiness_status: readinessStatus,
    derived: true,
    query_only: true,
    no_new_writer: true,
    no_new_store: true,
    no_new_registry: true,
    official_truth_write: false,
    formal_truth_write: false,
    settlement_write: false,
    score_write: false,
    rank_write: false,
    provider: "OFF",
    writer_effect: "NONE"
  };
}
