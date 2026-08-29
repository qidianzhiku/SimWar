import { createHash } from "node:crypto";
import {
  ESL_SCHEMA_VERSION,
  isESLRequest,
  type CurrentUser,
  type ESLAdminProjection,
  type ESLAlternativePath,
  type ESLAuthority,
  type ESLExactBinding,
  type ESLStudentAlternativePath,
  type ESLMechanism,
  type ESLOfficialBaseline,
  type ESLRequest,
  type ESLAdminResponse,
  type ESLSourceRefs,
  type ESLStudentResponse,
  type ESLStudentProjection,
  type ESLTeacherResponse,
  type ESLTeacherProjection,
  type ESLTransferHypothesis,
  type O4CrossRoundDynamicsResponse,
  type W4ProjectionBase,
  type W4StateRef,
  type W4ScopeContext
} from "@simwar/shared-contracts";
import type { M4TeacherPathProjection } from "@simwar/shared-contracts";
import type { O4CrossRoundDynamicsRequest } from "./o4-cross-round-dynamics.js";
import { projectESLFinance } from "@simwar/simulation-core";
import type { M4MultipathCounterfactualTransferService } from "./m4-multipath-counterfactual-transfer.js";
import type { RoleWorkflowRepositoryPort } from "./repository-ports.js";

const ESL_ACTIVITY_ID = "main-esl-o1-executive-strategy-lab";
const KNOWN_LIMITS = [
  "ESL is a read-only composition over W4 official state, O4 differential, M4 counterfactual, and existing role-safe learning paths.",
  "WANT/CAN/REALIZED remain separate; ESL never writes SettlementResult, REALIZED, canonical Decision, official EnterpriseState, or replay truth.",
  "JSON_INTERNAL_ONLY is the active runtime authority; Provider is OFF and PostgreSQL/RLS is not activated.",
  "NON_OFFICIAL paths describe bounded observed differentials and do not prove causal attribution.",
  "The supplied mission ZIP was structurally readable; historical ESL-O2 finance semantics are not in current master and remain source-reconciled with explicit limits.",
  "Exact-context recovery is a deterministic request replay; no durable ESL-specific store or writer is introduced.",
  "Human Validation, Pilot, Production, and automatic successor require separate lifecycle evidence and are not implied by this candidate."
] as const;

export class ExecutiveStrategyLabError extends Error {
  constructor(
    readonly code:
      | "ESL_INPUT_INVALID"
      | "ESL_FORBIDDEN"
      | "ESL_RUN_NOT_FOUND"
      | "ESL_ROUND_NOT_FOUND"
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
type RoundReference = {
  tenant_id: string;
  run_id: string;
  round_id: string;
  round_no: number;
};
export interface ExecutiveStrategyLabServiceDependencies {
  readonly getRun: (tenantId: string, runId: string) => Promise<RunReference | null>;
  readonly getRound: (
    tenantId: string,
    runId: string,
    roundId: string
  ) => Promise<RoundReference | null>;
  readonly getW4Projection: (scope: W4ScopeContext) => Promise<W4ProjectionBase>;
  readonly getO4Candidate?: (
    request: O4CrossRoundDynamicsRequest
  ) => Promise<O4CrossRoundDynamicsResponse>;
  readonly createM4Candidate: M4MultipathCounterfactualTransferService["create"];
  readonly roleWorkflow: Pick<RoleWorkflowRepositoryPort, "readRoleWorkflow">;
}

interface CanonicalCandidate {
  request: ESLRequest;
  response: ESLTeacherResponse;
  teacher: ESLTeacherProjection;
  student: ESLStudentProjection;
  admin: ESLAdminProjection;
  created_by: string;
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

function stateScope(ref: W4StateRef) {
  return {
    tenant_id: ref.tenant_id,
    course_id: ref.course_id,
    run_id: ref.run_id,
    team_id: ref.team_id,
    round_id: ref.round_id
  } as const;
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

function pathFromM4(
  candidate: M4TeacherPathProjection,
  projection: W4ProjectionBase
): ESLAlternativePath {
  const changedPaths = [...candidate.mechanism_differential.changed_paths].sort();
  const terminalRound = candidate.rounds.at(-1);
  const sourceStateRef = projection.closing_state_ref ?? projection.opening_state_ref;
  if (!projection.state || !sourceStateRef) {
    throw new ExecutiveStrategyLabError("ESL_OFFICIAL_BASELINE_REQUIRED");
  }
  const terminalStateRef = terminalRound?.closing_state_ref ?? null;
  const terminalState = terminalRound?.closing_state ?? null;
  const finance = projectESLFinance({
    path_id: candidate.path_id,
    path_digest: candidate.path_digest,
    source_state_ref: clone(sourceStateRef),
    source_state_scope: stateScope(sourceStateRef),
    source_state: clone(projection.state),
    terminal_state_ref: clone(terminalStateRef),
    terminal_state_scope: terminalStateRef ? stateScope(terminalStateRef) : null,
    terminal_state: clone(terminalState),
    path_cash_delta: candidate.outcome_differential.cash_delta,
    capital_actions: clone(candidate.capital_actions)
  });
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
    ),
    finance_feasibility: finance
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

function redactedStudent(
  response: ESLTeacherResponse,
  roleKey: string | undefined
): ESLStudentResponse {
  const safePaths: ESLStudentAlternativePath[] = response.paths.map((fullPath) => {
    return {
      path_id: fullPath.path_id,
      label: fullPath.label,
      officiality: fullPath.officiality,
      path_digest: fullPath.path_digest,
      changed_paths: [...fullPath.changed_paths],
      outcome: clone(fullPath.outcome),
      finance_feasibility: clone(fullPath.finance_feasibility.student_view)
    };
  });
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
  const result: ESLStudentResponse = {
    schema_version: response.schema_version,
    candidate_id: response.candidate_id,
    surface: "student",
    exact_binding: clone(response.exact_binding),
    official_baseline: {
      officiality: response.official_baseline.officiality,
      outcome_id: response.official_baseline.outcome_id,
      state_ref: null,
      summary: response.official_baseline.summary
    },
    paths: safePaths,
    mechanisms: [],
    transfer: clone(response.transfer),
    source_refs: { official_outcome_id: null, o4_candidate_digest: null, m4_candidate_digests: [] },
    authority: clone(response.authority),
    known_limits: clone(response.known_limits),
    student_projection: student
  };
  return result;
}

function redactedAdmin(response: ESLTeacherResponse, actorId: string): ESLAdminResponse {
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
    },
    finance_models: response.paths.map((path) => {
      const finance = path.finance_feasibility;
      return {
        path_id: path.path_id,
        model: clone(finance.model),
        input_digest: finance.input_digest,
        source_refs: [...finance.source_refs]
      };
    })
  };
  const result: ESLAdminResponse = {
    schema_version: response.schema_version,
    candidate_id: response.candidate_id,
    surface: "admin",
    exact_binding: clone(response.exact_binding),
    official_baseline: clone(response.official_baseline),
    paths: [],
    mechanisms: [],
    transfer: clone(response.transfer),
    source_refs: clone(response.source_refs),
    authority: clone(response.authority),
    known_limits: clone(response.known_limits),
    admin_projection: admin
  };
  return result;
}

export class ExecutiveStrategyLabService {
  private readonly candidates = new Map<string, CanonicalCandidate>();

  constructor(private readonly dependencies: ExecutiveStrategyLabServiceDependencies) {}

  async createCandidate(actor: ESLActor, request: ESLRequest): Promise<ESLTeacherResponse> {
    if (!isESLRequest(request)) throw new ExecutiveStrategyLabError("ESL_INPUT_INVALID");
    assertActorScope(actor, request.exact_binding);
    const run = await this.dependencies.getRun(actor.tenant_id, request.exact_binding.run_id);
    if (!run) throw new ExecutiveStrategyLabError("ESL_RUN_NOT_FOUND");
    const round = await this.dependencies.getRound(
      actor.tenant_id,
      request.exact_binding.run_id,
      request.exact_binding.round_id
    );
    if (!round) throw new ExecutiveStrategyLabError("ESL_ROUND_NOT_FOUND");
    if (
      round.tenant_id !== request.exact_binding.tenant_id ||
      round.run_id !== request.exact_binding.run_id ||
      round.round_id !== request.exact_binding.round_id ||
      round.round_no !== request.exact_binding.round_no
    ) {
      throw new ExecutiveStrategyLabError("ESL_CONTEXT_CONFLICT");
    }
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
    const paths = m4.paths.map((path) => pathFromM4(path as M4TeacherPathProjection, projection));
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
      m4_candidate_digests: paths.map((path) => path.path_digest)
    };
    const responseMechanisms = mechanisms(paths);
    const responseTransfer = transfer(request);
    const teacher: ESLTeacherProjection = {
      surface: "teacher",
      available_actions: [
        "SELECT_OFFICIAL_BASELINE",
        "COMPARE_NON_OFFICIAL_PATHS",
        "INSPECT_MECHANISM_AND_LIMITS",
        "INSPECT_FINANCE_FEASIBILITY_AND_STRESS",
        "FORM_TRANSFER_HYPOTHESIS"
      ],
      official_baseline: clone(baseline),
      paths: clone(paths),
      mechanisms: clone(responseMechanisms),
      transfer: clone(responseTransfer)
    };
    const response: ESLTeacherResponse = {
      schema_version: ESL_SCHEMA_VERSION,
      candidate_id: `esl_candidate_${digest({ request, baseline, paths }).slice(0, 16)}`,
      surface: "teacher",
      exact_binding: clone(request.exact_binding),
      official_baseline: baseline,
      paths,
      mechanisms: responseMechanisms,
      transfer: responseTransfer,
      source_refs: sourceRefs,
      authority: authority(),
      known_limits: [
        ...KNOWN_LIMITS,
        ...new Set(paths.flatMap((path) => path.finance_feasibility.known_limits))
      ],
      teacher_projection: teacher
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
      admin,
      created_by: actor.user_id
    };
    const existing = this.candidates.get(response.candidate_id);
    if (existing && canonicalize(existing.request) !== canonicalize(request)) {
      throw new ExecutiveStrategyLabError("ESL_DUPLICATE_CONFLICT");
    }
    this.candidates.set(response.candidate_id, canonical);
    return clone(response);
  }

  async getTeacher(actor: ESLActor, candidateId: string): Promise<ESLTeacherResponse> {
    const candidate = this.getCandidate(actor.tenant_id, candidateId);
    if (!actor.roles.some((role) => ["teacher", "tenant_admin", "platform_admin"].includes(role))) {
      throw new ExecutiveStrategyLabError("ESL_FORBIDDEN");
    }
    return clone(candidate.response);
  }

  async getStudent(actor: ESLActor, candidateId: string): Promise<ESLStudentResponse> {
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

  async getAdmin(actor: ESLActor, candidateId: string): Promise<ESLAdminResponse> {
    if (!actor.roles.some((role) => ["tenant_admin", "platform_admin"].includes(role))) {
      throw new ExecutiveStrategyLabError("ESL_FORBIDDEN");
    }
    const candidate = this.getCandidate(actor.tenant_id, candidateId);
    return redactedAdmin(candidate.response, candidate.created_by);
  }

  private getCandidate(tenantId: string, candidateId: string): CanonicalCandidate {
    const candidate = this.candidates.get(candidateId);
    if (!candidate || candidate.request.exact_binding.tenant_id !== tenantId) {
      throw new ExecutiveStrategyLabError("ESL_NOT_FOUND");
    }
    return candidate;
  }
}
