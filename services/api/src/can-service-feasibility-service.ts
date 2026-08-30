import type {
  ActorRole,
  CanServiceFeasibilityDomainInput,
  CanServiceFeasibilityResponse,
  CanServiceFeasibilitySurface
} from "@simwar/shared-contracts";
import {
  evaluateCanServiceFeasibility,
  CanServiceFeasibilityError as CoreCanServiceFeasibilityError
} from "@simwar/simulation-core";

export interface CanServiceFeasibilityActor {
  roles: readonly ActorRole[];
  tenant_id: string;
  team_id?: string;
  user_id: string;
}

export interface CanServiceFeasibilityRequest {
  course_id: string;
  draft_id: string;
  round_id: string;
  round_no: number;
  run_id: string;
  surface: CanServiceFeasibilitySurface;
  tenant_id: string;
}

export interface CanServiceFeasibilitySource {
  readExactInput(
    request: CanServiceFeasibilityRequest,
    actor?: CanServiceFeasibilityActor
  ): Promise<CanServiceFeasibilityDomainInput | null>;
}

export class CanServiceFeasibilityServiceError extends Error {
  constructor(
    readonly code:
      | "R1_CONTEXT_INVALID"
      | "R1_EXACT_CONTEXT_REQUIRED"
      | "R1_SCOPE_CONFLICT"
      | "R1_SOURCE_NOT_READY"
      | "R1_OUTPUT_INVALID"
  ) {
    super(code);
    this.name = "CanServiceFeasibilityServiceError";
  }
}

const EXACT_ID = /^[A-Za-z0-9]+(?:[._:@+-][A-Za-z0-9]+)*$/u;
const BANNED_ID =
  /(?:^|[._:@+-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:@+-])/iu;

const KNOWN_LIMITS = [
  "This is a candidate-only CAN feasibility projection; it does not write official truth, settlement, score, rank, or replay truth.",
  "Queue and waitlist behavior is not claimed because an exact queue input is not available in this product surface.",
  "Missing exact numeric inputs remain UNKNOWN; no zero, default, current, latest, or fallback value is substituted."
] as const;

function exactId(value: string): boolean {
  return (
    value.length > 0 && value.trim() === value && EXACT_ID.test(value) && !BANNED_ID.test(value)
  );
}

function assertRequest(request: CanServiceFeasibilityRequest): void {
  if (
    request.surface !== "teacher" &&
    request.surface !== "student" &&
    request.surface !== "admin"
  ) {
    throw new CanServiceFeasibilityServiceError("R1_CONTEXT_INVALID");
  }
  for (const value of [
    request.course_id,
    request.draft_id,
    request.round_id,
    request.run_id,
    request.tenant_id
  ]) {
    if (!exactId(value)) throw new CanServiceFeasibilityServiceError("R1_EXACT_CONTEXT_REQUIRED");
  }
  if (!Number.isSafeInteger(request.round_no) || request.round_no < 1) {
    throw new CanServiceFeasibilityServiceError("R1_EXACT_CONTEXT_REQUIRED");
  }
}

function hasRole(actor: CanServiceFeasibilityActor, roles: readonly ActorRole[]): boolean {
  return actor.roles.some((role) => roles.includes(role));
}

function assertSurfaceScope(
  actor: CanServiceFeasibilityActor,
  request: CanServiceFeasibilityRequest
): void {
  if (
    !exactId(actor.user_id) ||
    !exactId(actor.tenant_id) ||
    actor.tenant_id !== request.tenant_id
  ) {
    throw new CanServiceFeasibilityServiceError("R1_SCOPE_CONFLICT");
  }
  if (request.surface === "teacher" && !hasRole(actor, ["teacher"])) {
    throw new CanServiceFeasibilityServiceError("R1_SCOPE_CONFLICT");
  }
  if (
    request.surface === "student" &&
    (!hasRole(actor, ["learner", "student", "team_captain"]) ||
      !actor.team_id ||
      !exactId(actor.team_id))
  ) {
    throw new CanServiceFeasibilityServiceError("R1_SCOPE_CONFLICT");
  }
  if (request.surface === "admin" && !hasRole(actor, ["tenant_admin", "admin", "platform_admin"])) {
    throw new CanServiceFeasibilityServiceError("R1_SCOPE_CONFLICT");
  }
}

function sourceRefs(input: CanServiceFeasibilityDomainInput): readonly string[] {
  return [
    input.demand_units.source_ref,
    ...(input.available_capacity_units ? [input.available_capacity_units.source_ref] : []),
    input.workforce_units.source_ref,
    input.minimum_workforce_units.source_ref,
    input.service_quality_budget.source_ref,
    input.minimum_service_quality_budget.source_ref,
    input.eligibility.licensed.source_ref,
    input.eligibility.staffing_compliant.source_ref
  ];
}

function buildResponse(
  surface: CanServiceFeasibilitySurface,
  input: CanServiceFeasibilityDomainInput
): CanServiceFeasibilityResponse {
  const evaluated = evaluateCanServiceFeasibility(input);
  const refs = sourceRefs(input);
  const base = {
    authority: evaluated.authority,
    candidate_id: evaluated.candidate_id,
    known_limits: KNOWN_LIMITS,
    product_receipt: {
      exact_binding_digest: input.binding.binding_digest,
      no_write: true as const,
      operation_id: "R1_CAN_SERVICE_FEASIBILITY_GET_V1" as const,
      state_transition: "STATE_A_TO_STATE_B" as const
    },
    schema_version: "r1-can-service-feasibility.v1" as const,
    surface
  };

  if (surface === "student") {
    return {
      ...base,
      source_refs: [],
      student_projection: {
        candidate_id: evaluated.candidate_id,
        excluded_fields: ["candidate", "exact_binding", "source_refs"],
        role_safe: true,
        status: evaluated.status,
        surface: "student",
        why_not: evaluated.why_not.map(({ code, constraint_kind, summary }) => ({
          code,
          constraint_kind,
          summary
        }))
      }
    };
  }

  const candidate = evaluated;
  const response: CanServiceFeasibilityResponse = {
    ...base,
    candidate,
    candidate_id: candidate.candidate_id,
    exact_binding: candidate.exact_binding,
    source_refs: refs
  };
  if (surface === "teacher") {
    response.teacher_projection = {
      candidate_id: candidate.candidate_id,
      constraints: candidate.constraints,
      exact_binding: candidate.exact_binding,
      status: candidate.status,
      surface: "teacher",
      why_not: candidate.why_not
    };
  } else {
    response.admin_projection = {
      candidate_id: candidate.candidate_id,
      exact_inputs: input,
      limits: KNOWN_LIMITS,
      no_write: true,
      source_refs: refs,
      status: candidate.status,
      surface: "admin"
    };
  }
  return response;
}

export class CanServiceFeasibilityService {
  constructor(private readonly source: CanServiceFeasibilitySource) {}

  async get(input: {
    actor: CanServiceFeasibilityActor;
    request: CanServiceFeasibilityRequest;
  }): Promise<CanServiceFeasibilityResponse> {
    assertRequest(input.request);
    assertSurfaceScope(input.actor, input.request);
    const domainInput = await this.source.readExactInput(input.request, input.actor);
    if (!domainInput) throw new CanServiceFeasibilityServiceError("R1_SOURCE_NOT_READY");
    if (
      domainInput.binding.tenant_id !== input.request.tenant_id ||
      domainInput.binding.course_id !== input.request.course_id ||
      domainInput.binding.round_id !== input.request.round_id ||
      domainInput.binding.round_no !== input.request.round_no ||
      domainInput.binding.run_id !== input.request.run_id
    ) {
      throw new CanServiceFeasibilityServiceError("R1_EXACT_CONTEXT_REQUIRED");
    }
    try {
      const response = buildResponse(input.request.surface, domainInput);
      return response;
    } catch (error) {
      if (error instanceof CoreCanServiceFeasibilityError) {
        throw new CanServiceFeasibilityServiceError("R1_OUTPUT_INVALID");
      }
      throw error;
    }
  }
}
