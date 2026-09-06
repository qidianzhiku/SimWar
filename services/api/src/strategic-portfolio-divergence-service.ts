import { createHash } from "node:crypto";
import type {
  M4MultipathCounterfactualInput,
  M4MultipathCounterfactualResponse,
  M4TeacherPathProjection,
  W4ScopeContext,
  W4StrategicPortfolioProjection,
  StrategicPortfolioDivergenceRequest
} from "@simwar/shared-contracts";
import { isStrategicPortfolioDivergenceRequest } from "@simwar/shared-contracts";
import {
  createStrategicPortfolioDivergenceAnalysis,
  type StrategicPortfolioDivergenceEnvelope
} from "./strategic-portfolio-divergence-analysis.js";
import {
  evaluateStrategicPortfolioDivergenceTransferPolicy,
  type StrategicPortfolioTransferPolicyDecision
} from "./strategic-portfolio-divergence-transfer-policy.js";

export class StrategicPortfolioDivergenceServiceError extends Error {
  constructor(
    readonly code: string,
    message = code
  ) {
    super(message);
    this.name = "StrategicPortfolioDivergenceServiceError";
  }
}

export interface StrategicPortfolioDivergenceActor {
  user_id: string;
  tenant_id: string;
  roles: string[];
  team_id?: string;
}

export interface StrategicPortfolioDivergenceDependencies {
  getPortfolio: (scope: W4ScopeContext) => Promise<W4StrategicPortfolioProjection>;
  createM4Candidate: (
    scope: W4ScopeContext,
    input: M4MultipathCounterfactualInput,
    surface: "teacher"
  ) => Promise<M4MultipathCounterfactualResponse>;
}

interface CanonicalCandidate {
  request: StrategicPortfolioDivergenceRequest;
  envelope: StrategicPortfolioDivergenceEnvelope;
  transfer: StrategicPortfolioTransferPolicyDecision;
  created_by: string;
}

export interface StrategicPortfolioDivergenceTeacherResponse {
  schema_version: "main-sp-o3-strategic-portfolio-divergence.v1";
  candidate_id: string;
  surface: "teacher" | "admin";
  exact_binding: StrategicPortfolioDivergenceRequest["exact_binding"];
  envelope: StrategicPortfolioDivergenceEnvelope;
  transfer: StrategicPortfolioTransferPolicyDecision;
  authority: {
    runtime_authority: "JSON_INTERNAL_ONLY";
    official_source: "W4_ENTERPRISE_STATE_SERVICE";
    writer_authority: "SOLE_W4_ENTERPRISE_STATE_SERVICE";
    derived: true;
    query_only: true;
    provider: "OFF";
    official_truth_write: false;
    settlement_write: false;
    score_write: false;
    rank_write: false;
  };
  known_limits: string[];
}

export interface StrategicPortfolioDivergenceStudentResponse {
  schema_version: "main-sp-o3-strategic-portfolio-divergence.v1";
  candidate_id: string;
  surface: "student";
  role_safe: true;
  exact_context: {
    course_id: string;
    run_id: string;
    team_id: string;
    round_no: number;
  };
  reflection: {
    status: "AVAILABLE" | "REBASE_REQUIRED";
    path_count: number;
    proven_dimensions: string[];
  };
  transfer: {
    status: StrategicPortfolioTransferPolicyDecision["status"];
    advisory_only: true;
    applies_to_next_round: false;
  };
  known_limits: string[];
  excluded_fields: string[];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function assertTeacher(actor: StrategicPortfolioDivergenceActor): void {
  if (!actor.roles.some((role) => ["teacher", "tenant_admin", "platform_admin"].includes(role))) {
    throw new StrategicPortfolioDivergenceServiceError("SP_O3_FORBIDDEN");
  }
}

function scopeForRequest(
  actor: StrategicPortfolioDivergenceActor,
  request: StrategicPortfolioDivergenceRequest
): W4ScopeContext {
  if (actor.tenant_id !== request.exact_binding.tenant_id) {
    throw new StrategicPortfolioDivergenceServiceError("SP_O3_TENANT_SCOPE_CONFLICT");
  }
  return {
    actor_id: actor.user_id,
    tenant_id: request.exact_binding.tenant_id,
    course_id: request.exact_binding.course_id,
    run_id: request.exact_binding.run_id,
    team_id: request.exact_binding.team_id,
    round_id: request.exact_binding.round_id,
    round_no: request.exact_binding.round_no,
    role_key: "teacher",
    activity_id: "strategic-portfolio-divergence"
  };
}

function assertPortfolioScope(
  portfolio: W4StrategicPortfolioProjection,
  request: StrategicPortfolioDivergenceRequest
): void {
  const expected = request.exact_binding;
  const actual = portfolio.exact_scope;
  if (
    actual.tenant_id !== expected.tenant_id ||
    actual.course_id !== expected.course_id ||
    actual.run_id !== expected.run_id ||
    actual.team_id !== expected.team_id ||
    actual.round_no !== expected.round_no ||
    portfolio.portfolio_ref.tenant_id !== expected.tenant_id ||
    portfolio.portfolio_ref.course_id !== expected.course_id ||
    portfolio.portfolio_ref.run_id !== expected.run_id ||
    portfolio.portfolio_ref.team_id !== expected.team_id ||
    portfolio.portfolio_ref.round_no !== expected.round_no
  ) {
    throw new StrategicPortfolioDivergenceServiceError("SP_O3_PORTFOLIO_SCOPE_CONFLICT");
  }
  if (portfolio.exact_scope.round_no < 1) {
    throw new StrategicPortfolioDivergenceServiceError("SP_O3_ROUND_REQUIRED");
  }
}

function assertCounterfactualScope(request: StrategicPortfolioDivergenceRequest): void {
  const expected = request.exact_binding;
  const source = request.counterfactual.source_state_ref;
  if (
    source.tenant_id !== expected.tenant_id ||
    source.course_id !== expected.course_id ||
    source.run_id !== expected.run_id ||
    source.team_id !== expected.team_id ||
    source.round_id !== expected.round_id
  ) {
    throw new StrategicPortfolioDivergenceServiceError("SP_O3_INPUT_SCOPE_CONFLICT");
  }
}

function teacherResponse(
  candidateId: string,
  candidate: CanonicalCandidate,
  surface: "teacher" | "admin"
) {
  return {
    schema_version: "main-sp-o3-strategic-portfolio-divergence.v1" as const,
    candidate_id: candidateId,
    surface,
    exact_binding: clone(candidate.request.exact_binding),
    envelope: clone(candidate.envelope),
    transfer: clone(candidate.transfer),
    authority: {
      runtime_authority: "JSON_INTERNAL_ONLY" as const,
      official_source: "W4_ENTERPRISE_STATE_SERVICE" as const,
      writer_authority: "SOLE_W4_ENTERPRISE_STATE_SERVICE" as const,
      derived: true as const,
      query_only: true as const,
      provider: "OFF" as const,
      official_truth_write: false as const,
      settlement_write: false as const,
      score_write: false as const,
      rank_write: false as const
    },
    known_limits: [
      ...candidate.envelope.known_limits,
      ...candidate.transfer.known_limits,
      "Teacher/Admin detail is comparison evidence only; no path is an official recommendation."
    ]
  };
}

export class StrategicPortfolioDivergenceService {
  private readonly candidates = new Map<string, CanonicalCandidate>();
  private readonly idempotency = new Map<string, { fingerprint: string; candidate_id: string }>();

  constructor(private readonly dependencies: StrategicPortfolioDivergenceDependencies) {}

  async createCandidate(
    actor: StrategicPortfolioDivergenceActor,
    request: StrategicPortfolioDivergenceRequest
  ): Promise<StrategicPortfolioDivergenceTeacherResponse> {
    assertTeacher(actor);
    if (!isStrategicPortfolioDivergenceRequest(request)) {
      throw new StrategicPortfolioDivergenceServiceError("SP_O3_INPUT_INVALID");
    }
    assertCounterfactualScope(request);
    const scope = scopeForRequest(actor, request);
    const fingerprint = digest(request);
    const idempotencyScope = `${actor.tenant_id}\u001f${request.exact_binding.course_id}\u001f${request.exact_binding.run_id}\u001f${request.idempotency_key}`;
    const previous = this.idempotency.get(idempotencyScope);
    if (previous && previous.fingerprint !== fingerprint) {
      throw new StrategicPortfolioDivergenceServiceError("SP_O3_IDEMPOTENCY_CONFLICT");
    }
    if (previous) {
      const existing = this.candidates.get(previous.candidate_id);
      if (existing) return teacherResponse(previous.candidate_id, existing, "teacher");
    }
    const portfolio = await this.dependencies.getPortfolio(scope);
    assertPortfolioScope(portfolio, request);
    const m4 = await this.dependencies.createM4Candidate(scope, request.counterfactual, "teacher");
    const paths = m4.paths as M4TeacherPathProjection[];
    const envelope = createStrategicPortfolioDivergenceAnalysis({
      baseline: portfolio,
      paths,
      divergence_policy_digest: request.divergence_policy_digest,
      expected_portfolio_state_digest: request.expected_portfolio_state_digest
    });
    const transfer = evaluateStrategicPortfolioDivergenceTransferPolicy({
      portfolio_state_digest: portfolio.portfolio_ref.portfolio_digest,
      expected_portfolio_state_digest: request.expected_portfolio_state_digest,
      divergence_policy_digest: request.divergence_policy_digest,
      paths: paths.map((path) => ({
        path_id: path.path_id,
        path_digest: path.path_digest,
        officiality: path.officiality
      }))
    });
    const candidateId = `sp_o3_candidate_${digest({ request, envelope, transfer }).slice(0, 16)}`;
    const candidate: CanonicalCandidate = {
      request: clone(request),
      envelope,
      transfer,
      created_by: actor.user_id
    };
    this.candidates.set(candidateId, candidate);
    this.idempotency.set(idempotencyScope, { fingerprint, candidate_id: candidateId });
    return teacherResponse(candidateId, candidate, "teacher");
  }

  async getTeacher(actor: StrategicPortfolioDivergenceActor, candidateId: string) {
    assertTeacher(actor);
    const candidate = this.getCandidate(actor.tenant_id, candidateId);
    return teacherResponse(candidateId, candidate, "teacher");
  }

  async getAdmin(actor: StrategicPortfolioDivergenceActor, candidateId: string) {
    if (!actor.roles.some((role) => ["tenant_admin", "platform_admin"].includes(role))) {
      throw new StrategicPortfolioDivergenceServiceError("SP_O3_FORBIDDEN");
    }
    const candidate = this.getCandidate(actor.tenant_id, candidateId);
    return teacherResponse(candidateId, candidate, "admin");
  }

  async getStudent(
    actor: StrategicPortfolioDivergenceActor,
    candidateId: string
  ): Promise<StrategicPortfolioDivergenceStudentResponse> {
    if (
      !actor.team_id ||
      !actor.roles.some((role) => ["student", "learner", "team_captain"].includes(role))
    ) {
      throw new StrategicPortfolioDivergenceServiceError("SP_O3_FORBIDDEN");
    }
    const candidate = this.getCandidate(actor.tenant_id, candidateId);
    if (candidate.request.exact_binding.team_id !== actor.team_id) {
      throw new StrategicPortfolioDivergenceServiceError("SP_O3_FORBIDDEN");
    }
    return {
      schema_version: "main-sp-o3-strategic-portfolio-divergence.v1",
      candidate_id: candidateId,
      surface: "student",
      role_safe: true,
      exact_context: {
        course_id: candidate.request.exact_binding.course_id,
        run_id: candidate.request.exact_binding.run_id,
        team_id: candidate.request.exact_binding.team_id,
        round_no: candidate.request.exact_binding.round_no
      },
      reflection: {
        status: candidate.transfer.status === "REBASE_REQUIRED" ? "REBASE_REQUIRED" : "AVAILABLE",
        path_count: candidate.envelope.non_official_paths.length,
        proven_dimensions: candidate.envelope.dimension_evidence
          .filter((item) => item.status === "PROVEN")
          .map((item) => item.dimension)
      },
      transfer: {
        status: candidate.transfer.status,
        advisory_only: true,
        applies_to_next_round: false
      },
      known_limits: [
        "Student receives bounded reflection only; official portfolio, path, tenant and governance identities are withheld.",
        "No comparison result changes the official baseline, decision, settlement, score, or rank.",
        ...candidate.transfer.known_limits
      ],
      excluded_fields: [
        "portfolio_id",
        "portfolio_digest",
        "path_id",
        "path_digest",
        "decision_ids",
        "tenant_governance_details",
        "winner",
        "score",
        "rank"
      ]
    };
  }

  private getCandidate(tenantId: string, candidateId: string): CanonicalCandidate {
    const candidate = this.candidates.get(candidateId);
    if (!candidate || candidate.request.exact_binding.tenant_id !== tenantId) {
      throw new StrategicPortfolioDivergenceServiceError("SP_O3_NOT_FOUND");
    }
    return candidate;
  }
}
