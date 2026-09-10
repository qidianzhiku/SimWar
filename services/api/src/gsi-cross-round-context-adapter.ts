import { createHash } from "node:crypto";

export interface GSIContextBinding {
  readonly activity_id: string;
  readonly course_id: string;
  readonly role_key: string;
  readonly round_id: string;
  readonly round_no: number;
  readonly run_id: string;
  readonly team_id: string;
  readonly tenant_id: string;
}
export interface GSIContextObservation {
  readonly source: "W3" | "M2P5";
  readonly status: "PUBLISHED" | "UNPUBLISHED";
  readonly context: GSIContextBinding;
  readonly context_digest: string;
}
export interface GSICrossRoundContext {
  readonly status: "AVAILABLE" | "CONTEXT_UNAVAILABLE" | "REBASE_REQUIRED";
  readonly context: GSIContextBinding;
  readonly anchors: readonly {
    readonly source: "W3" | "M2P5";
    readonly context_digest: string;
    readonly status: "PUBLISHED";
  }[];
  readonly context_digest: string;
  readonly non_causal: true;
  readonly causal_proof: false;
  readonly official_outcome_recomputed: false;
  readonly official_truth_write: false;
  readonly recovery: "RELOAD_EXACT_CONTEXT" | "WAIT_FOR_PUBLICATION";
  readonly known_limits: readonly string[];
}
export interface GSICrossRoundContextAdapterDependencies {
  readonly readW3: (context: GSIContextBinding) => Promise<GSIContextObservation | null>;
  readonly readM2P5: (context: GSIContextBinding) => Promise<GSIContextObservation | null>;
}
export class GSICrossRoundContextError extends Error {
  constructor(readonly code: "GSI_CONTEXT_INVALID" | "GSI_CONTEXT_REBASE_REQUIRED") {
    super(code);
    this.name = "GSICrossRoundContextError";
  }
}
const KNOWN_LIMITS = [
  "W3 and M2P5 are read-only contextual anchors; this adapter does not recompute official outcomes.",
  "Context availability requires an exact published source; unpublished or missing context remains unavailable.",
  "Context correlation does not prove that a decision caused stakeholder movement."
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
  throw new GSICrossRoundContextError("GSI_CONTEXT_INVALID");
}
function digest(value: unknown): string {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

export function createM2P5ContextDigest(input: {
  readonly context: GSIContextBinding;
  readonly publication: unknown;
  readonly record_id: string;
  readonly source: unknown;
  readonly learning: unknown;
}): string {
  return digest(input);
}
function identity(value: string): boolean {
  return (
    value.length > 0 &&
    value.trim() === value &&
    /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/u.test(value) &&
    !/(?:^|[._:-])(?:latest|current|default|fallback|first|last|newest)(?:$|[._:-])/iu.test(value)
  );
}
function assertContext(context: GSIContextBinding): void {
  if (
    !identity(context.activity_id) ||
    !identity(context.course_id) ||
    !identity(context.role_key) ||
    !identity(context.round_id) ||
    !Number.isInteger(context.round_no) ||
    context.round_no < 1 ||
    !identity(context.run_id) ||
    !identity(context.team_id) ||
    !identity(context.tenant_id)
  )
    throw new GSICrossRoundContextError("GSI_CONTEXT_INVALID");
}
function sameContext(left: GSIContextBinding, right: GSIContextBinding): boolean {
  return canonicalize(left) === canonicalize(right);
}
export class GSICrossRoundContextAdapter {
  constructor(private readonly dependencies: GSICrossRoundContextAdapterDependencies) {}
  async read(input: {
    readonly context: GSIContextBinding;
    readonly expected_context_digest?: string;
  }): Promise<GSICrossRoundContext> {
    assertContext(input.context);
    const observations = (
      await Promise.all([
        this.dependencies.readW3(input.context),
        this.dependencies.readM2P5(input.context)
      ])
    ).filter((observation): observation is GSIContextObservation => observation !== null);
    if (observations.some((observation) => !sameContext(observation.context, input.context)))
      throw new GSICrossRoundContextError("GSI_CONTEXT_REBASE_REQUIRED");
    const currentContextDigest = digest(
      observations.map((observation) => ({
        source: observation.source,
        status: observation.status,
        context: observation.context,
        context_digest: observation.context_digest
      }))
    );
    if (input.expected_context_digest && input.expected_context_digest !== currentContextDigest)
      throw new GSICrossRoundContextError("GSI_CONTEXT_REBASE_REQUIRED");
    const published = observations.filter((observation) => observation.status === "PUBLISHED");
    if (published.length === 0)
      return {
        status: "CONTEXT_UNAVAILABLE",
        context: structuredClone(input.context),
        anchors: [],
        context_digest: currentContextDigest,
        non_causal: true,
        causal_proof: false,
        official_outcome_recomputed: false,
        official_truth_write: false,
        recovery: "WAIT_FOR_PUBLICATION",
        known_limits: [...KNOWN_LIMITS]
      };
    return {
      status: "AVAILABLE",
      context: structuredClone(input.context),
      anchors: published.map((observation) => ({
        source: observation.source,
        context_digest: observation.context_digest,
        status: "PUBLISHED" as const
      })),
      context_digest: currentContextDigest,
      non_causal: true,
      causal_proof: false,
      official_outcome_recomputed: false,
      official_truth_write: false,
      recovery: "RELOAD_EXACT_CONTEXT",
      known_limits: [...KNOWN_LIMITS]
    };
  }
}
