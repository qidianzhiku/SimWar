import type { StrategicPortfolioModelGovernanceReadinessStatus } from "./strategic-portfolio-model-governance-readiness.js";

export type StrategicPortfolioModelGovernanceRole = "admin" | "teacher" | "student";

export interface StrategicPortfolioModelGovernanceRoleProjectionInput {
  readonly tenant_id: string;
  readonly readiness_policy_digest: string;
  readonly portfolio_state_digest: string;
  readonly readiness_digest: string;
  readonly readiness_status: "READY" | "BLOCKED" | "REBASE_REQUIRED";
  readonly known_limits: readonly string[];
  readonly entries: readonly {
    readonly course: { readonly course_id: string; readonly tenant_id: string; readonly title: string };
    readonly exact_scope: { readonly tenant_id: string; readonly course_id: string; readonly run_id: string; readonly team_id: string; readonly round_no: number };
    readonly portfolio_id: string;
    readonly portfolio_digest: string;
    readonly model_qualification_portfolio_state_digest: string;
    readonly adoption_state_digest: string | null;
    readonly current_adoption: { readonly adoption_id: string; readonly adoption_digest: string } | null;
    readonly qualification: { readonly qualification_id: string; readonly content_digest: string } | null;
    readonly blockers: readonly string[];
    readonly known_limits: readonly string[];
    readonly readiness: StrategicPortfolioModelGovernanceReadinessStatus;
    readonly readiness_digest: string;
  }[];
}

export interface StrategicPortfolioModelGovernanceDetailedEntry {
  readonly course: StrategicPortfolioModelGovernanceRoleProjectionInput["entries"][number]["course"];
  readonly exact_scope: StrategicPortfolioModelGovernanceRoleProjectionInput["entries"][number]["exact_scope"];
  readonly portfolio_id: string;
  readonly portfolio_digest: string;
  readonly model_qualification_portfolio_state_digest: string;
  readonly adoption_state_digest: string | null;
  readonly current_adoption: StrategicPortfolioModelGovernanceRoleProjectionInput["entries"][number]["current_adoption"];
  readonly qualification: StrategicPortfolioModelGovernanceRoleProjectionInput["entries"][number]["qualification"];
  readonly blockers: readonly string[];
  readonly known_limits: readonly string[];
  readonly readiness: StrategicPortfolioModelGovernanceReadinessStatus;
  readonly readiness_digest: string;
}

export interface StrategicPortfolioModelGovernanceStudentEntry {
  readonly exact_scope: {
    readonly course_id: string;
    readonly run_id: string;
    readonly team_id: string;
    readonly round_no: number;
  };
  readonly readiness: StrategicPortfolioModelGovernanceReadinessStatus;
  readonly applicability: "READY" | "LIMITED" | "UNAVAILABLE";
  readonly known_limits: readonly string[];
  readonly advisory_only: true;
  readonly provider: "OFF";
}

export type StrategicPortfolioModelGovernanceRoleProjection =
  | {
      readonly role: "admin" | "teacher";
      readonly visibility: "TENANT_GOVERNANCE_DETAIL";
      readonly tenant_id: string;
      readonly readiness_policy_digest: string;
      readonly portfolio_state_digest: string;
      readonly readiness_digest: string;
      readonly readiness_status: "READY" | "BLOCKED" | "REBASE_REQUIRED";
      readonly entries: readonly StrategicPortfolioModelGovernanceDetailedEntry[];
      readonly known_limits: readonly string[];
      readonly derived: true;
      readonly query_only: true;
      readonly no_new_writer: true;
      readonly no_new_store: true;
      readonly no_new_registry: true;
      readonly provider: "OFF";
      readonly writer_effect: "NONE";
    }
  | {
      readonly role: "student";
      readonly visibility: "ROLE_SAFE_STUDENT";
      readonly readiness_status: "READY" | "BLOCKED" | "REBASE_REQUIRED";
      readonly entries: readonly StrategicPortfolioModelGovernanceStudentEntry[];
      readonly known_limits: readonly string[];
      readonly derived: true;
      readonly query_only: true;
      readonly no_new_writer: true;
      readonly no_new_store: true;
      readonly no_new_registry: true;
      readonly provider: "OFF";
      readonly writer_effect: "NONE";
    };

function clone<T>(value: T): T {
  return structuredClone(value);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function applicability(readiness: StrategicPortfolioModelGovernanceReadinessStatus): "READY" | "LIMITED" | "UNAVAILABLE" {
  if (readiness === "READY") return "READY";
  if (readiness === "REVIEW_REQUIRED" || readiness === "ROLLBACK_CANDIDATE" || readiness === "REQUALIFICATION_REQUIRED") return "LIMITED";
  return "UNAVAILABLE";
}

/**
 * Project the exact readiness join to a role without adding a second
 * authority. Student projections deliberately omit tenant portfolio and
 * governance identities; teacher/admin projections retain them for audit.
 */
export function projectStrategicPortfolioModelGovernanceReadiness(
  input: StrategicPortfolioModelGovernanceRoleProjectionInput,
  role: StrategicPortfolioModelGovernanceRole
): StrategicPortfolioModelGovernanceRoleProjection {
  if (role === "student") {
    return {
      role,
      visibility: "ROLE_SAFE_STUDENT",
      readiness_status: input.readiness_status,
      entries: input.entries.map((entry) => ({
        exact_scope: {
          course_id: entry.exact_scope.course_id,
          run_id: entry.exact_scope.run_id,
          team_id: entry.exact_scope.team_id,
          round_no: entry.exact_scope.round_no
        },
        readiness: entry.readiness,
        applicability: applicability(entry.readiness),
        known_limits: uniqueSorted([
          ...entry.known_limits,
          "Student view omits tenant portfolio membership, governance IDs, digests, and internal blocker reasons.",
          "This is advisory/readiness information only; it is not a decision, settlement, score, rank, or formal truth projection."
        ]),
        advisory_only: true,
        provider: "OFF"
      })),
      known_limits: uniqueSorted([
        ...input.known_limits,
        "Student view is limited to exact contextual applicability and known limits; privileged governance details are withheld."
      ]),
      derived: true,
      query_only: true,
      no_new_writer: true,
      no_new_store: true,
      no_new_registry: true,
      provider: "OFF",
      writer_effect: "NONE"
    };
  }

  return {
    role,
    visibility: "TENANT_GOVERNANCE_DETAIL",
    tenant_id: input.tenant_id,
    readiness_policy_digest: input.readiness_policy_digest,
    portfolio_state_digest: input.portfolio_state_digest,
    readiness_digest: input.readiness_digest,
    readiness_status: input.readiness_status,
    entries: input.entries.map((entry) => ({
      course: clone(entry.course),
      exact_scope: clone(entry.exact_scope),
      portfolio_id: entry.portfolio_id,
      portfolio_digest: entry.portfolio_digest,
      model_qualification_portfolio_state_digest: entry.model_qualification_portfolio_state_digest,
      adoption_state_digest: entry.adoption_state_digest,
      current_adoption: entry.current_adoption ? clone(entry.current_adoption) : null,
      qualification: entry.qualification ? clone(entry.qualification) : null,
      blockers: [...entry.blockers],
      known_limits: [...entry.known_limits],
      readiness: entry.readiness,
      readiness_digest: entry.readiness_digest
    })),
    known_limits: [...input.known_limits],
    derived: true,
    query_only: true,
    no_new_writer: true,
    no_new_store: true,
    no_new_registry: true,
    provider: "OFF",
    writer_effect: "NONE"
  };
}
