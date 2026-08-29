import { createHash } from "node:crypto";
import {
  ESL_SCHEMA_VERSION,
  isESLRequest,
  type CurrentUser,
  type ESLAdminProjection,
  type ESLAlternativePath,
  type ESLAuthority,
  type ESLExactBinding,
  type ESLMechanism,
  type ESLOfficialBaseline,
  type ESLRequest,
  type ESLResponse,
  type ESLSourceRefs,
  type ESLStudentProjection,
  type ESLTeacherProjection,
  type ESLTransferHypothesis,
  type O4CrossRoundDynamicsResponse,
  type W4ProjectionBase,
  type W4ScopeContext
} from "@simwar/shared-contracts";
import type { M4MultipathCounterfactualResponse } from "@simwar/shared-contracts";
import type { O4CrossRoundDynamicsRequest } from "./o4-cross-round-dynamics.js";
import type { M4MultipathCounterfactualTransferService } from "./m4-multipath-counterfactual-transfer.js";
import type { RoleWorkflowRepositoryPort } from "./repository-ports.js";

const ESL_ACTIVITY_ID = "main-esl-o1-executive-strategy-lab";
const KNOWN_LIMITS = [
  "ESL is a read-only composition over W4 official state, O4 differential, M4 counterfactual, and existing role-safe learning paths.",
  "WANT/CAN/REALIZED remain separate; ESL never writes SettlementResult, REALIZED, canonical Decision, official EnterpriseState, or replay truth.",
  "JSON_INTERNAL_ONLY is the active runtime authority; Provider is OFF and PostgreSQL/RLS is not activated.",
  "NON_OFFICIAL paths describe bounded observed differentials and do not prove causal attribution.",
  "The MOD support package supplied for this mission was not a readable ZIP; its MJP is source-reconciled with limits rather than package-proven.",
  "Exact-context recovery is a deterministic request replay; no durable ESL-specific store or writer is introduced.",
  "Human Validation, Pilot, Production, and automatic successor require separate lifecycle evidence and are not implied by this candidate."
] as const;

export class ExecutiveStrategyLabError extends Error {
  constructor(
    readonly code:
      | "ESL_INPUT_INVALID"
      | "ESL_FORBIDDEN"
      | "ESL_RUN_NOT_FOUND"
      | "ESL_CONTEXT_CONFLICT"
      | "ESL_OFFICIAL_BASELINE_REQUIRED"
      | "ESL_PATHS_REQUIRED"
      | "ESL_ROLE_ASSIGNMENT_REQUIRED"
      | "ESL_NOT_FOUND"
      | "ESL_DUPLICATE_CONFLICT"
      | "ESL_OUTPUT_INVALID",
    message = code
  ) {
    super(message);
    this.name = "ExecutiveStrategyLabError";
  }
}

type ESLActor = Pick<CurrentUser, "user_id" | "tenant_id" | "roles" | "team_id">;
type RunReference = {
  course_id: string;
  scenario_package_id?: string;
  parameter_set_id?: string;
};
type M4Paths = Extract<M4MultipathCounterfactualResponse["paths"], readonly unknown[]>;

export interface ExecutiveStrategyLabServiceDependencies {
  readonly getRun: (tenantId: string, runId: string) => Promise<RunReference | null>;
  readonly getW4Projection: (scope: W4ScopeContext) => Promise<W4ProjectionBase>;
  readonly getO4Candidate?: (
    request: O4CrossRoundDynamicsRequest
  ) => Promise<O4CrossRoundDynamicsResponse>;
  readonly createM4Candidate: M4MultipathCounterfactualTransferService["create"];
  readonly roleWorkflow: Pick<RoleWorkflowRepositoryPort, "readRoleWorkflow">;
}

interface CanonicalCandidate {
  request: ESLRequest;
  response: ESLResponse;
  teacher: ESLTeacherProjection;
  student: ESLStudentProjection;
  admin: ESLAdminProjection;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function canonicalize(value: unknown): string {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`)
      .join(",")}}`;
  }
  throw new ExecutiveStrategyLabError("ESL_INPUT_INVALID");
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function actorScope(actor: ESLActor, binding: ESLExactBinding): W4ScopeContext {
  return {
    actor_id: actor.user_id,
    tenant_id: binding.tenant_id,
    course_id: binding.course_id,
    run_id: binding.run_id,
    team_id: binding.team_id,
    round_id: binding.round_id,
    round_no: binding.round_no,
    role_key: actor.roles.includes("team_captain") ? "CEO" : (actor.roles[0] ?? "teacher"),
    activity_id: ESL_ACTIVITY_ID
  };
}

function assertActorScope(actor: ESLActor, binding: ESLExactBinding): void {
  if (actor.tenant_id !== binding.tenant_id) throw new ExecutiveStrategyLabError("ESL_FORBIDDEN");
  if (actor.roles.some((role) => ["student", "learner", "team_captain"].includes(role))) {
    if (!actor.team_id || actor.team_id !== binding.team_id) {
      throw new ExecutiveStrategyLabError("ESL_FORBIDDEN");
    }
  }
}

function officialBaseline(projection: W4ProjectionBase): ESLOfficialBaseline {
  const state = projection.state;
  const outcomeId = projection.path_evidence.official_replay_path.official_outcome_id;
  if (!state || !projection.opening_state_ref) {
    throw new ExecutiveStrategyLabError("ESL_OFFICIAL_BASELINE_REQUIRED");
  }
  return {
    officiality: "OFFICIAL",
    outcome_id: outcomeId,
    state_ref: clone(projection.closing_state_ref ?? projection.opening_state_ref),
    summary: "官方 W4 基线已绑定到精确运行上下文。",
    state_summary: {
      cash: state.cash,
      capacity: state.capacity,
      product_line_count: state.product_lines.length,
      operating_unit_count: state.operating_units.length,
      project_count: state.portfolio.projects.length
    },
    changed_paths: projection.path_evidence.opening_vs_closing?.changed_paths ?? []
  };
}

function pathFromM4(path: M4Paths[number]): ESLAlternativePath {
  const candidate = path as {
    path_id: string;
    label: string;
    officiality: "NON_OFFICIAL";
    decision_ids: string[];
    path_digest: string;
    mechanism_differential: { changed_paths: string[] };
    outcome_differential: {
      cash_delta: number;
      capacity_delta: number;
      project_count_delta: number;
      terminal_state_digest: string;
    };
  };
  const changedPaths = [...candidate.mechanism_differential.changed_paths].sort();
  return {
    path_id: candidate.path_id,
    label: candidate.label,
    officiality: "NON_OFFICIAL",
    decision_ids: [...candidate.decision_ids],
    path_digest: candidate.path_digest,
    changed_paths: changedPaths,
    outcome: {
      cash_delta: candidate.outcome_differential.cash_delta,
      capacity_delta: candidate.outcome_differential.capacity_delta,
      project_count_delta: candidate.outcome_differential.project_count_delta,
      terminal_state_digest: candidate.outcome_differential.terminal_state_digest
    },
    mechanism_ids: changedPaths.map(
      (changedPath) => `esl_mechanism_${digest(changedPath).slice(0, 12)}`
    )
  };
}

function mechanisms(paths: readonly ESLAlternativePath[]): ESLMechanism[] {
  const byId = new Map<string, ESLMechanism>();
  for (const path of paths) {
    for (const changedPath of path.changed_paths) {
      const mechanismId = `esl_mechanism_${digest(changedPath).slice(0, 12)}`;
      byId.set(mechanismId, {
        mechanism_id: mechanismId,
        label: changedPath,
        explanation: `该机制来自 ${path.path_id} 的确定性状态差异路径；它是观察到的转移差异，不构成因果证明。`,
        evidence_path_ids: [...(byId.get(mechanismId)?.evidence_path_ids ?? []), path.path_id],
        uncertainty: "OBSERVED_DIFFERENTIAL_ONLY"
      });
    }
  }
  return [...byId.values()].sort((left, right) =>
    left.mechanism_id.localeCompare(right.mechanism_id)
  );
}

function authority(): ESLAuthority {
  return {
    runtime_authority: "JSON_INTERNAL_ONLY",
    official_realized_source: "SIMULATION_CORE",
    writer_authority: "SOLE_W4_ENTERPRISE_STATE_SERVICE",
    formal_truth_write: false,
    settlement_write: false,
    replay_truth_write: false,
    provider: "OFF"
  };
}

function transfer(request: ESLRequest): ESLTransferHypothesis {
  return {
    status: "DRAFT",
    statement: request.transfer_hypothesis,
    evidence_path_ids: request.paths.map((path) => path.path_id),
    applies_to_next_round: false
  };
}

function redactedStudent(response: ESLResponse, roleKey: string | undefined): ESLResponse {
  const safePaths = response.paths.map(({ decision_ids: _decisionIds, ...path }) => path);
  const student: ESLStudentProjection = {
    surface: "student",
    role_safe: true,
    ...(roleKey ? { role_key: roleKey } : {}),
    official_baseline: {
      officiality: response.official_baseline.officiality,
      outcome_id: response.official_baseline.outcome_id,
      summary: response.official_baseline.summary
    },
    paths: safePaths,
    transfer: clone(response.transfer),
    excluded_fields: [
      "private_dissent_notes",
      "decision_ids",
      "raw_counterfactual_state",
      "exact_state_refs",
      "teacher_admin_provenance",
      "official_settlement_write"
    ]
  };
  const result: ESLResponse = {
    ...clone(response),
    surface: "student",
    paths: safePaths.map((path) => ({ ...path, decision_ids: [] })),
    source_refs: { official_outcome_id: null, o4_candidate_digest: null, m4_candidate_digests: [] },
    student_projection: student
  };
  delete result.teacher_projection;
  delete result.admin_projection;
  return result;
}

function redactedAdmin(response: ESLResponse, actorId: string): ESLResponse {
  const admin: ESLAdminProjection = {
    surface: "admin",
    tenant_id: response.exact_binding.tenant_id,
    exact_binding: clone(response.exact_binding),
    source_refs: clone(response.source_refs),
    officiality_counts: { official: 1, non_official: response.paths.length },
    audit: {
      candidate_id: response.candidate_id,
      generated_by: actorId,
      no_write: true,
      recovery: "REPLAY_REQUEST_WITH_EXACT_BINDING"
    }
  };
  const result: ESLResponse = {
    ...clone(response),
    surface: "admin",
    paths: [],
    mechanisms: [],
    admin_projection: admin
  };
  delete result.teacher_projection;
  delete result.student_projection;
  return result;
}

export class ExecutiveStrategyLabService {
  private readonly candidates = new Map<string, CanonicalCandidate>();

  constructor(private readonly dependencies: ExecutiveStrategyLabServiceDependencies) {}

  async createCandidate(actor: ESLActor, request: ESLRequest): Promise<ESLResponse> {
    if (!isESLRequest(request)) throw new ExecutiveStrategyLabError("ESL_INPUT_INVALID");
    assertActorScope(actor, request.exact_binding);
    const run = await this.dependencies.getRun(actor.tenant_id, request.exact_binding.run_id);
    if (!run) throw new ExecutiveStrategyLabError("ESL_RUN_NOT_FOUND");
    if (
      run.course_id !== request.exact_binding.course_id ||
      (run.scenario_package_id &&
        run.scenario_package_id !== request.exact_binding.scenario_package_id) ||
      (run.parameter_set_id && run.parameter_set_id !== request.exact_binding.parameter_set_id)
    ) {
      throw new ExecutiveStrategyLabError("ESL_CONTEXT_CONFLICT");
    }
    const scope = actorScope(actor, request.exact_binding);
    const projection = await this.dependencies.getW4Projection(scope);
    const baseline = officialBaseline(projection);
    if (!baseline.outcome_id || !baseline.state_ref) {
      throw new ExecutiveStrategyLabError("ESL_OFFICIAL_BASELINE_REQUIRED");
    }
    const m4 = await this.dependencies.createM4Candidate(
      scope,
      {
        source_state_ref: clone(baseline.state_ref),
        source_outcome_id: baseline.outcome_id,
        paths: clone(request.paths),
        horizon_rounds: 1,
        scenario_package_id: request.exact_binding.scenario_package_id,
        parameter_set_id: request.exact_binding.parameter_set_id,
        engine_id: request.exact_binding.engine_id,
        plugin_ids: [...request.exact_binding.plugin_ids],
        seed: request.exact_binding.seed
      },
      "teacher"
    );
    const paths = m4.paths.map(pathFromM4);
    if (paths.length < 2 || paths.length > 3) {
      throw new ExecutiveStrategyLabError("ESL_PATHS_REQUIRED");
    }
    let o4CandidateDigest: string | null = null;
    if (this.dependencies.getO4Candidate && request.exact_binding.round_no >= 3) {
      try {
        const o4 = await this.dependencies.getO4Candidate({
          actor: {
            tenant_id: actor.tenant_id,
            user_id: actor.user_id,
            roles: actor.roles,
            ...(actor.team_id ? { team_id: actor.team_id } : {})
          },
          surface: "teacher",
          course_id: request.exact_binding.course_id,
          run_id: request.exact_binding.run_id,
          target_round_no: request.exact_binding.round_no
        });
        o4CandidateDigest = digest(o4.candidate);
      } catch {
        o4CandidateDigest = null;
      }
    }
    const sourceRefs: ESLSourceRefs = {
      official_outcome_id: baseline.outcome_id,
      o4_candidate_digest: o4CandidateDigest,
      m4_candidate_digests: [
        m4.exact_binding.source_outcome_id,
        ...paths.map((path) => path.path_digest)
      ]
    };
    const response: ESLResponse = {
      schema_version: ESL_SCHEMA_VERSION,
      candidate_id: `esl_candidate_${digest({ request, baseline, paths }).slice(0, 16)}`,
      surface: "teacher",
      exact_binding: clone(request.exact_binding),
      official_baseline: baseline,
      paths,
      mechanisms: mechanisms(paths),
      transfer: transfer(request),
      source_refs: sourceRefs,
      authority: authority(),
      known_limits: [...KNOWN_LIMITS]
    };
    const teacher: ESLTeacherProjection = {
      surface: "teacher",
      available_actions: [
        "SELECT_OFFICIAL_BASELINE",
        "COMPARE_NON_OFFICIAL_PATHS",
        "INSPECT_MECHANISM_AND_LIMITS",
        "FORM_TRANSFER_HYPOTHESIS"
      ],
      official_baseline: clone(baseline),
      paths: clone(paths),
      mechanisms: clone(response.mechanisms),
      transfer: clone(response.transfer)
    };
    const workflow = await this.dependencies.roleWorkflow.readRoleWorkflow({
      tenant_id: actor.tenant_id,
      run_id: request.exact_binding.run_id,
      round_id: request.exact_binding.round_id,
      team_id: request.exact_binding.team_id
    });
    const assignment = workflow.assignments.find(
      (candidate) => candidate.status === "active" && candidate.user_id
    );
    const student = redactedStudent(response, assignment?.role_key).student_projection!;
    const admin = redactedAdmin(response, actor.user_id).admin_projection!;
    const canonical: CanonicalCandidate = {
      request: clone(request),
      response,
      teacher,
      student,
      admin
    };
    const existing = this.candidates.get(response.candidate_id);
    if (existing && canonicalize(existing.request) !== canonicalize(request)) {
      throw new ExecutiveStrategyLabError("ESL_DUPLICATE_CONFLICT");
    }
    this.candidates.set(response.candidate_id, canonical);
    return { ...clone(response), teacher_projection: clone(teacher) };
  }

  async getTeacher(actor: ESLActor, candidateId: string): Promise<ESLResponse> {
    const candidate = this.getCandidate(actor.tenant_id, candidateId);
    if (!actor.roles.some((role) => ["teacher", "tenant_admin", "platform_admin"].includes(role))) {
      throw new ExecutiveStrategyLabError("ESL_FORBIDDEN");
    }
    return { ...clone(candidate.response), teacher_projection: clone(candidate.teacher) };
  }

  async getStudent(actor: ESLActor, candidateId: string): Promise<ESLResponse> {
    if (
      !actor.team_id ||
      !actor.roles.some((role) => ["student", "learner", "team_captain"].includes(role))
    ) {
      throw new ExecutiveStrategyLabError("ESL_FORBIDDEN");
    }
    const candidate = this.getCandidate(actor.tenant_id, candidateId);
    if (candidate.request.exact_binding.team_id !== actor.team_id) {
      throw new ExecutiveStrategyLabError("ESL_FORBIDDEN");
    }
    const workflow = await this.dependencies.roleWorkflow.readRoleWorkflow({
      tenant_id: actor.tenant_id,
      run_id: candidate.request.exact_binding.run_id,
      round_id: candidate.request.exact_binding.round_id,
      team_id: actor.team_id
    });
    const assignment = workflow.assignments.find(
      (item) => item.status === "active" && item.user_id === actor.user_id
    );
    if (!assignment) throw new ExecutiveStrategyLabError("ESL_ROLE_ASSIGNMENT_REQUIRED");
    return redactedStudent(candidate.response, assignment.role_key);
  }

  async getAdmin(actor: ESLActor, candidateId: string): Promise<ESLResponse> {
    if (!actor.roles.some((role) => ["tenant_admin", "platform_admin"].includes(role))) {
      throw new ExecutiveStrategyLabError("ESL_FORBIDDEN");
    }
    const candidate = this.getCandidate(actor.tenant_id, candidateId);
    return redactedAdmin(candidate.response, actor.user_id);
  }

  private getCandidate(tenantId: string, candidateId: string): CanonicalCandidate {
    const candidate = this.candidates.get(candidateId);
    if (!candidate || candidate.request.exact_binding.tenant_id !== tenantId) {
      throw new ExecutiveStrategyLabError("ESL_NOT_FOUND");
    }
    return candidate;
  }
}
