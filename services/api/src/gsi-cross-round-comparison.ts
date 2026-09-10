import { createHash } from "node:crypto";
import type { GSIExactBinding, GSIIntent, GSIStakeholderType } from "@simwar/shared-contracts";

export type GSICrossRoundMovementDirection =
  | "NEW"
  | "REMOVED"
  | "INCREASED"
  | "DECREASED"
  | "STABLE";

export interface GSIComparisonCandidate {
  readonly candidate_id: string;
  readonly binding: GSIExactBinding;
  readonly round_no: number;
  readonly candidate_digest: string;
  readonly signals: readonly {
    readonly stakeholder_type: GSIStakeholderType;
    readonly intent: GSIIntent;
    readonly bounded_value: number;
  }[];
}

export interface GSICrossRoundComparison {
  readonly discriminator: "gsi_cross_round_comparison";
  readonly pair: {
    readonly tenant_id: string;
    readonly course_id: string;
    readonly run_id: string;
    readonly team_id: string;
    readonly from: {
      readonly candidate_id: string;
      readonly candidate_digest: string;
      readonly round_id: string;
      readonly round_no: number;
    };
    readonly to: {
      readonly candidate_id: string;
      readonly candidate_digest: string;
      readonly round_id: string;
      readonly round_no: number;
    };
  };
  readonly movements: readonly {
    readonly signal_key: string;
    readonly stakeholder_type: GSIStakeholderType;
    readonly intent: GSIIntent;
    readonly from_value?: number;
    readonly to_value?: number;
    readonly delta?: number;
    readonly direction: GSICrossRoundMovementDirection;
  }[];
  readonly comparison_digest: string;
  readonly non_causal: true;
  readonly causal_proof: false;
  readonly known_limits: readonly string[];
}

export class GSICrossRoundComparisonError extends Error {
  constructor(readonly code: "GSI_COMPARISON_INVALID" | "GSI_REBASE_REQUIRED") {
    super(code);
    this.name = "GSICrossRoundComparisonError";
  }
}

const KNOWN_LIMITS = [
  "Cross-round movement is descriptive evidence only; it is not causal proof or official outcome.",
  "A signal missing on one side is not interpreted as business-value zero.",
  "W3 and M2P5 outcome context is read-only and does not change Decision, Settlement, Score, or Rank."
] as const;

function canonicalize(value: unknown): string {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  )
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`)
      .join(",")}}`;
  }
  throw new GSICrossRoundComparisonError("GSI_COMPARISON_INVALID");
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function isExactString(value: string): boolean {
  return (
    value.length > 0 &&
    value.trim() === value &&
    !["latest", "current", "default", "fallback", "first", "last", "newest"].includes(
      value.toLowerCase()
    )
  );
}

function assertCandidate(candidate: GSIComparisonCandidate): void {
  if (
    !isExactString(candidate.candidate_id) ||
    Object.values(candidate.binding).some((value) => !isExactString(value)) ||
    !Number.isInteger(candidate.round_no) ||
    candidate.round_no < 1 ||
    !/^[a-f0-9]{64}$/u.test(candidate.candidate_digest)
  )
    throw new GSICrossRoundComparisonError("GSI_COMPARISON_INVALID");
  for (const signal of candidate.signals)
    if (
      !Number.isFinite(signal.bounded_value) ||
      signal.bounded_value < -1 ||
      signal.bounded_value > 1
    )
      throw new GSICrossRoundComparisonError("GSI_COMPARISON_INVALID");
}

function sameLineage(left: GSIExactBinding, right: GSIExactBinding): boolean {
  return [
    "scenario_package_id",
    "scenario_version",
    "parameter_set_id",
    "parameter_set_version",
    "model_version_id",
    "model_version",
    "model_artifact_id",
    "model_artifact_version"
  ].every((key) => left[key as keyof GSIExactBinding] === right[key as keyof GSIExactBinding]);
}

function assertPair(left: GSIComparisonCandidate, right: GSIComparisonCandidate): void {
  const sameScope = ["tenant_id", "course_id", "run_id", "team_id"].every(
    (key) =>
      left.binding[key as keyof GSIExactBinding] === right.binding[key as keyof GSIExactBinding]
  );
  if (
    !sameScope ||
    left.binding.round_id === right.binding.round_id ||
    left.round_no === right.round_no ||
    !sameLineage(left.binding, right.binding)
  )
    throw new GSICrossRoundComparisonError("GSI_COMPARISON_INVALID");
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareGSICandidates(input: {
  readonly from: GSIComparisonCandidate;
  readonly to: GSIComparisonCandidate;
  readonly expected_comparison_digest?: string;
}): GSICrossRoundComparison {
  assertCandidate(input.from);
  assertCandidate(input.to);
  assertPair(input.from, input.to);
  const fromSignals = new Map(
    input.from.signals.map(
      (signal) => [`${signal.stakeholder_type}:${signal.intent}`, signal] as const
    )
  );
  const toSignals = new Map(
    input.to.signals.map(
      (signal) => [`${signal.stakeholder_type}:${signal.intent}`, signal] as const
    )
  );
  const keys = [...new Set([...fromSignals.keys(), ...toSignals.keys()])].sort(compareStrings);
  const movements = keys.map((signalKey) => {
    const from = fromSignals.get(signalKey);
    const to = toSignals.get(signalKey);
    const [stakeholder_type, intent] = signalKey.split(":") as [GSIStakeholderType, GSIIntent];
    if (!from && to)
      return {
        signal_key: signalKey,
        stakeholder_type,
        intent,
        to_value: to.bounded_value,
        direction: "NEW" as const
      };
    if (from && !to)
      return {
        signal_key: signalKey,
        stakeholder_type,
        intent,
        from_value: from.bounded_value,
        direction: "REMOVED" as const
      };
    const delta = Math.round((to!.bounded_value - from!.bounded_value) * 1_000_000) / 1_000_000;
    return {
      signal_key: signalKey,
      stakeholder_type,
      intent,
      from_value: from!.bounded_value,
      to_value: to!.bounded_value,
      delta,
      direction:
        delta > 0
          ? ("INCREASED" as const)
          : delta < 0
            ? ("DECREASED" as const)
            : ("STABLE" as const)
    };
  });
  const pair = {
    tenant_id: input.from.binding.tenant_id,
    course_id: input.from.binding.course_id,
    run_id: input.from.binding.run_id,
    team_id: input.from.binding.team_id,
    from: {
      candidate_id: input.from.candidate_id,
      candidate_digest: input.from.candidate_digest,
      round_id: input.from.binding.round_id,
      round_no: input.from.round_no
    },
    to: {
      candidate_id: input.to.candidate_id,
      candidate_digest: input.to.candidate_digest,
      round_id: input.to.binding.round_id,
      round_no: input.to.round_no
    }
  };
  const comparison_digest = digest({ pair, movements });
  if (input.expected_comparison_digest && input.expected_comparison_digest !== comparison_digest)
    throw new GSICrossRoundComparisonError("GSI_REBASE_REQUIRED");
  return {
    discriminator: "gsi_cross_round_comparison",
    pair,
    movements,
    comparison_digest,
    non_causal: true,
    causal_proof: false,
    known_limits: [...KNOWN_LIMITS]
  };
}
