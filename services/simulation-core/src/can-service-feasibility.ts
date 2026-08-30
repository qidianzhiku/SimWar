import { createHash } from "node:crypto";
import type {
  CanConstraintEvidence,
  CanServiceFeasibilityCandidate,
  CanServiceFeasibilityDomainInput,
  CanServiceFeasibilityExactBinding,
  CanServiceFeasibilityStatus,
  CanWhyNotReason
} from "@simwar/shared-contracts";

export class CanServiceFeasibilityError extends Error {
  constructor(
    readonly code: "R1_EXACT_BINDING_REQUIRED" | "R1_INPUT_INVALID" | "R1_OUTPUT_INVALID"
  ) {
    super(code);
    this.name = "CanServiceFeasibilityError";
  }
}

const EXACT_ID = /^[A-Za-z0-9]+(?:[._:@+-][A-Za-z0-9]+)*$/u;
const BANNED_ID =
  /(?:^|[._:@+-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:@+-])/iu;

function exactId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    EXACT_ID.test(value) &&
    !BANNED_ID.test(value)
  );
}

function exactDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function exactReference(value: unknown, withTenant: boolean): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const reference = value as Record<string, unknown>;
  return (
    exactId(reference[withTenant ? "scenario_package_id" : "parameter_set_id"]) &&
    exactId(reference.version) &&
    exactDigest(reference.content_digest) &&
    (!withTenant || exactId(reference.tenant_id))
  );
}

function assertBinding(binding: CanServiceFeasibilityExactBinding): void {
  if (
    !exactDigest(binding.binding_digest) ||
    !exactId(binding.course_id) ||
    !exactId(binding.model_version_ref) ||
    binding.no_implicit_latest !== true ||
    !exactReference(binding.parameter_set_reference, false) ||
    !exactId(binding.round_id) ||
    !Number.isSafeInteger(binding.round_no) ||
    binding.round_no < 1 ||
    !exactId(binding.run_id) ||
    !exactReference(binding.scenario_package_reference, true) ||
    !Number.isSafeInteger(binding.seed) ||
    binding.seed < 0 ||
    !exactId(binding.tenant_id)
  ) {
    throw new CanServiceFeasibilityError("R1_EXACT_BINDING_REQUIRED");
  }
  if (binding.scenario_package_reference.tenant_id !== binding.tenant_id) {
    throw new CanServiceFeasibilityError("R1_EXACT_BINDING_REQUIRED");
  }
}

function assertNumberSignal(
  value: { source_ref: string; unit: string; value: number } | undefined,
  expectedUnit: string,
  required: boolean
): void {
  if (!value && !required) return;
  if (
    !value ||
    !exactId(value.source_ref) ||
    value.unit !== expectedUnit ||
    !Number.isFinite(value.value) ||
    value.value < 0
  ) {
    throw new CanServiceFeasibilityError("R1_INPUT_INVALID");
  }
}

function assertBooleanSignal(value: { source_ref: string; value: boolean }): void {
  if (!exactId(value.source_ref) || typeof value.value !== "boolean") {
    throw new CanServiceFeasibilityError("R1_INPUT_INVALID");
  }
}

function stable(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  throw new CanServiceFeasibilityError("R1_OUTPUT_INVALID");
}

function digest(value: unknown): string {
  return createHash("sha256").update(stable(value), "utf8").digest("hex");
}

function numericConstraint(input: {
  constraint_id: string;
  explanation: string;
  kind: CanConstraintEvidence["kind"];
  observed: { unit: string; value: number | null };
  source_ref: string;
  status: CanConstraintEvidence["status"];
  threshold?: { unit: string; value: number };
}): CanConstraintEvidence {
  return input;
}

function booleanConstraint(input: {
  constraint_id: string;
  explanation: string;
  observed: boolean;
  source_ref: string;
  status: CanConstraintEvidence["status"];
}): CanConstraintEvidence {
  return {
    constraint_id: input.constraint_id,
    explanation: input.explanation,
    kind: "ELIGIBILITY",
    observed: { unit: "boolean", value: input.observed },
    source_ref: input.source_ref,
    status: input.status,
    threshold: { unit: "boolean", value: true }
  };
}

function makeWhyNot(
  code: CanWhyNotReason["code"],
  constraint_kind: CanWhyNotReason["constraint_kind"],
  summary: string,
  source_ref?: string
): CanWhyNotReason {
  return { code, constraint_kind, summary, ...(source_ref ? { source_ref } : {}) };
}

function statusOf(constraints: readonly CanConstraintEvidence[]): CanServiceFeasibilityStatus {
  if (constraints.some((constraint) => constraint.status === "UNKNOWN")) return "UNKNOWN";
  return constraints.some((constraint) => constraint.status === "FAIL") ? "INFEASIBLE" : "FEASIBLE";
}

export function evaluateCanServiceFeasibility(
  input: CanServiceFeasibilityDomainInput
): CanServiceFeasibilityCandidate {
  assertBinding(input.binding);
  assertNumberSignal(input.demand_units, "households", true);
  assertNumberSignal(input.available_capacity_units, "service_units", false);
  assertNumberSignal(input.workforce_units, "people", true);
  assertNumberSignal(input.minimum_workforce_units, "people", true);
  assertNumberSignal(input.service_quality_budget, "CNY", true);
  assertNumberSignal(input.minimum_service_quality_budget, "CNY", true);
  assertBooleanSignal(input.eligibility.licensed);
  assertBooleanSignal(input.eligibility.staffing_compliant);

  const demand = input.demand_units;
  const capacity = input.available_capacity_units;
  const workforce = input.workforce_units;
  const minimumWorkforce = input.minimum_workforce_units;
  const quality = input.service_quality_budget;
  const minimumQuality = input.minimum_service_quality_budget;
  const constraints: CanConstraintEvidence[] = [
    numericConstraint({
      constraint_id: "r1_demand_observed",
      explanation:
        "Demand is an explicit exact-context observation used as the requested service volume.",
      kind: "DEMAND",
      observed: { unit: demand.unit, value: demand.value },
      source_ref: demand.source_ref,
      status: "PASS",
      threshold: { unit: demand.unit, value: 0 }
    }),
    numericConstraint({
      constraint_id: "r1_capacity_guard",
      explanation: capacity
        ? "Available service capacity is compared with the exact requested service volume."
        : "Available service capacity was not supplied for this exact context.",
      kind: "CAPACITY",
      observed: { unit: "service_units", value: capacity?.value ?? null },
      source_ref: capacity?.source_ref ?? "r1:capacity-input-unavailable",
      status: capacity ? (capacity.value >= demand.value ? "PASS" : "FAIL") : "UNKNOWN",
      ...(capacity ? { threshold: { unit: demand.unit, value: demand.value } } : {})
    }),
    numericConstraint({
      constraint_id: "r1_workforce_guard",
      explanation: "Workforce supply must meet the explicit minimum workforce requirement.",
      kind: "WORKFORCE",
      observed: { unit: workforce.unit, value: workforce.value },
      source_ref: workforce.source_ref,
      status: workforce.value >= minimumWorkforce.value ? "PASS" : "FAIL",
      threshold: { unit: minimumWorkforce.unit, value: minimumWorkforce.value }
    }),
    numericConstraint({
      constraint_id: "r1_quality_budget_guard",
      explanation: "The explicit service-quality budget must meet the configured minimum.",
      kind: "QUALITY",
      observed: { unit: quality.unit, value: quality.value },
      source_ref: quality.source_ref,
      status: quality.value >= minimumQuality.value ? "PASS" : "FAIL",
      threshold: { unit: minimumQuality.unit, value: minimumQuality.value }
    }),
    booleanConstraint({
      constraint_id: "r1_license_guard",
      explanation: "Service eligibility requires the exact licensed flag to be true.",
      observed: input.eligibility.licensed.value,
      source_ref: input.eligibility.licensed.source_ref,
      status: input.eligibility.licensed.value ? "PASS" : "FAIL"
    }),
    booleanConstraint({
      constraint_id: "r1_staffing_compliance_guard",
      explanation: "Service eligibility requires exact staffing compliance to be true.",
      observed: input.eligibility.staffing_compliant.value,
      source_ref: input.eligibility.staffing_compliant.source_ref,
      status: input.eligibility.staffing_compliant.value ? "PASS" : "FAIL"
    })
  ];
  const status = statusOf(constraints);
  const whyNotReasons: CanWhyNotReason[] = [];
  const capacityConstraint = constraints[1];
  const workforceConstraint = constraints[2];
  const qualityConstraint = constraints[3];
  if (!capacityConstraint || !workforceConstraint || !qualityConstraint) {
    throw new CanServiceFeasibilityError("R1_OUTPUT_INVALID");
  }
  if (capacityConstraint.status === "UNKNOWN") {
    whyNotReasons.push(
      makeWhyNot(
        "INPUT_UNAVAILABLE",
        "CAPACITY",
        "Exact available capacity input is unavailable.",
        capacityConstraint.source_ref
      )
    );
  } else if (capacityConstraint.status === "FAIL") {
    whyNotReasons.push(
      makeWhyNot(
        "CAPACITY_INSUFFICIENT",
        "CAPACITY",
        "Available service capacity is below requested service volume.",
        capacityConstraint.source_ref
      )
    );
  }
  if (workforceConstraint.status === "FAIL") {
    whyNotReasons.push(
      makeWhyNot(
        "WORKFORCE_INSUFFICIENT",
        "WORKFORCE",
        "Workforce supply is below the explicit minimum.",
        workforceConstraint.source_ref
      )
    );
  }
  if (qualityConstraint.status === "FAIL") {
    whyNotReasons.push(
      makeWhyNot(
        "QUALITY_BUDGET_INSUFFICIENT",
        "QUALITY",
        "Service-quality budget is below the explicit minimum.",
        qualityConstraint.source_ref
      )
    );
  }
  for (const constraint of constraints.slice(4)) {
    if (constraint.status === "FAIL") {
      whyNotReasons.push(
        makeWhyNot(
          "ELIGIBILITY_FAILED",
          "ELIGIBILITY",
          "An exact eligibility guard is false.",
          constraint.source_ref
        )
      );
    }
  }

  const candidateWithoutDigest = {
    authority: {
      candidate_writer: "SIMULATION_CORE_READ_ONLY" as const,
      official_truth_write: false as const,
      provider_calls: 0 as const,
      replay_truth_write: false as const,
      settlement_write: false as const
    },
    binding: input.binding,
    constraints,
    queue: { claim: "NOT_CLAIMED" as const, reason: "EXACT_QUEUE_INPUT_NOT_AVAILABLE" as const },
    status,
    why_not: whyNotReasons
  };
  const candidateId = `r1_can_candidate_${digest(input.binding).slice(0, 16)}`;
  return {
    authority: candidateWithoutDigest.authority,
    candidate_digest: digest(candidateWithoutDigest),
    candidate_id: candidateId,
    constraints,
    exact_binding: input.binding,
    queue: candidateWithoutDigest.queue,
    status,
    why_not: whyNotReasons
  };
}
