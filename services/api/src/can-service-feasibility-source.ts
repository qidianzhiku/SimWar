import { createHash } from "node:crypto";
import type {
  CanServiceFeasibilityActor,
  CanServiceFeasibilitySource
} from "./can-service-feasibility-service.js";
import type { CanServiceFeasibilityDomainInput } from "@simwar/shared-contracts";
import type { RepositoryFacade } from "./repository-facade.js";
import { W5GovernedModelError, type W5ServiceActor } from "./w5-governed-model-service.js";
import type { W5ExactRuntimeBinding } from "@simwar/shared-contracts";

export interface CanServiceFeasibilitySourceDependencies {
  readonly repository: Pick<RepositoryFacade, "courses" | "rounds" | "runs">;
  readonly w5: {
    evaluate: W5CanEvaluate;
    getDraft: W5CanGetDraft;
  };
}

type W5CanEvaluate = (
  actor: W5ServiceActor,
  scope: {
    activity_id: string;
    course_id: string;
    round_no?: number;
    run_id?: string;
    team_id?: string;
  },
  draftId: string,
  experienceProfile: "STANDARD" | "ADVANCED"
) => {
  can: { constraints: readonly string[]; eligible: boolean };
};

type W5CanGetDraft = (
  actor: W5ServiceActor,
  scope: {
    activity_id: string;
    course_id: string;
    round_no?: number;
    run_id?: string;
    team_id?: string;
  },
  draftId: string
) => {
  course_id: string;
  exact_runtime_binding: W5ExactRuntimeBinding | null;
  model_version_ref: string;
  parameter_values: Readonly<Record<string, boolean | number | string>>;
};

const ACTIVITY_ID = "r1_can_service_feasibility";
const MINIMUM_WORKFORCE = 1;
const MINIMUM_QUALITY_BUDGET = 120000;

function stable(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number")
    return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  throw new Error("R1_SOURCE_UNSERIALIZABLE");
}

function digest(value: unknown): string {
  return createHash("sha256").update(stable(value), "utf8").digest("hex");
}

function numericParameter(
  values: Readonly<Record<string, boolean | number | string>>,
  key: string
): number | null {
  const value = values[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function parseConstraint(constraints: readonly string[], name: string): number | undefined {
  const raw = constraints
    .find((constraint) => constraint.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  if (raw === undefined || raw.length === 0) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function actorForW5(actor: CanServiceFeasibilityActor): W5ServiceActor {
  const role = actor.roles.includes("teacher")
    ? "teacher"
    : actor.roles.includes("platform_admin")
      ? "platform_admin"
      : actor.roles.includes("tenant_admin") || actor.roles.includes("admin")
        ? "tenant_admin"
        : "student";
  return { actor_id: actor.user_id, role, tenant_id: actor.tenant_id };
}

function exactBinding(
  draftBinding: W5ExactRuntimeBinding,
  roundId: string
): CanServiceFeasibilityDomainInput["binding"] {
  const withoutDigest = {
    course_id: draftBinding.course_id,
    model_version_ref: draftBinding.model_version_ref,
    no_implicit_latest: true as const,
    parameter_set_reference: { ...draftBinding.parameter_set_reference },
    round_id: roundId,
    round_no: draftBinding.round_no,
    run_id: draftBinding.run_id,
    scenario_package_reference: { ...draftBinding.scenario_package_reference },
    seed: draftBinding.seed,
    tenant_id: draftBinding.tenant_id
  };
  return { ...withoutDigest, binding_digest: digest(withoutDigest) };
}

export function createW5CanServiceFeasibilitySource(
  dependencies: CanServiceFeasibilitySourceDependencies
): CanServiceFeasibilitySource {
  return {
    async readExactInput(request, actor) {
      if (!actor) return null;
      try {
        const [course, run, rounds] = await Promise.all([
          dependencies.repository.courses.getCourse(request.tenant_id, request.course_id),
          dependencies.repository.runs.getRun(request.tenant_id, request.run_id),
          dependencies.repository.rounds.listRoundsForRun(request.tenant_id, request.run_id)
        ]);
        const round = rounds.find(
          (candidate) =>
            candidate.round_id === request.round_id &&
            candidate.round_no === request.round_no &&
            candidate.tenant_id === request.tenant_id
        );
        if (
          !course ||
          !run ||
          !round ||
          course.tenant_id !== request.tenant_id ||
          run.tenant_id !== request.tenant_id ||
          run.course_id !== request.course_id ||
          run.run_id !== request.run_id
        ) {
          return null;
        }
        const w5Actor = actorForW5(actor);
        const scope = {
          activity_id: ACTIVITY_ID,
          course_id: request.course_id,
          round_no: request.round_no,
          run_id: request.run_id,
          ...(actor.team_id ? { team_id: actor.team_id } : { team_id: "shared-governed-market" })
        };
        const draft = dependencies.w5.getDraft(w5Actor, scope, request.draft_id);
        const draftBinding = draft.exact_runtime_binding;
        if (
          !draftBinding ||
          draftBinding.course_id !== request.course_id ||
          draftBinding.run_id !== request.run_id ||
          draftBinding.round_no !== request.round_no ||
          draftBinding.tenant_id !== request.tenant_id ||
          draftBinding.parameter_set_reference.parameter_set_id !== run.parameter_set_id ||
          draftBinding.scenario_package_reference.scenario_package_id !== run.scenario_package_id
        ) {
          return null;
        }
        const projection = dependencies.w5.evaluate(w5Actor, scope, request.draft_id, "STANDARD");
        const demand = numericParameter(draft.parameter_values, "customer_demand");
        const workforce = numericParameter(draft.parameter_values, "caregiver_supply");
        const quality = demand === null ? null : 120000 + demand * 250;
        if (demand === null || workforce === null || quality === null) return null;
        const capacity = parseConstraint(projection.can.constraints, "capacity");
        const binding = exactBinding(draftBinding, request.round_id);
        const combinedEligibilityRef = `w5:${request.draft_id}:can.eligible:license_and_staffing`;
        return {
          ...(capacity === undefined
            ? {}
            : {
                available_capacity_units: {
                  source_ref: `w5:${request.draft_id}:can.capacity`,
                  unit: "service_units" as const,
                  value: capacity
                }
              }),
          binding,
          demand_units: {
            source_ref: `w5:${request.draft_id}:customer_demand`,
            unit: "households",
            value: demand
          },
          eligibility: {
            licensed: { source_ref: combinedEligibilityRef, value: projection.can.eligible },
            staffing_compliant: {
              source_ref: combinedEligibilityRef,
              value: projection.can.eligible
            }
          },
          minimum_service_quality_budget: {
            source_ref: "r1:minimum_service_quality_budget_v1",
            unit: "CNY",
            value: MINIMUM_QUALITY_BUDGET
          },
          minimum_workforce_units: {
            source_ref: "r1:minimum_workforce_units_v1",
            unit: "people",
            value: MINIMUM_WORKFORCE
          },
          service_quality_budget: {
            source_ref: `w5:${request.draft_id}:service_quality_budget_formula_v1`,
            unit: "CNY",
            value: quality
          },
          workforce_units: {
            source_ref: `w5:${request.draft_id}:caregiver_supply`,
            unit: "people",
            value: workforce
          }
        };
      } catch (error) {
        if (error instanceof W5GovernedModelError) return null;
        throw error;
      }
    }
  };
}
