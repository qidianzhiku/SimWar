import type {
  DdtAdminEvidenceSpineResponse,
  DdtEvidenceLedger,
  DdtEvidenceSourceName,
  DdtEvidenceSpineRequestContext,
  DdtEvidenceSpineResponse,
  DdtEvidenceStatus,
  DdtAdminEvidenceSource,
  DdtStudentEvidenceSpineResponse,
  DdtStudentEvidenceSource,
  DdtSurface,
  DdtTeacherEvidenceSpineResponse,
  DdtTeacherEvidenceSource,
  DdtSelectedRoundPair,
  DdtExactContext
} from "@simwar/shared-contracts";

export interface DecisionThreadEvidenceSpineActor {
  readonly user_id: string;
  readonly tenant_id: string;
  readonly roles: readonly string[];
  readonly team_id?: string;
}

export interface DdtSourceRead {
  readonly ledger?: DdtEvidenceLedger;
  readonly status: DdtEvidenceStatus;
  readonly summary: string;
  readonly known_limits: readonly string[];
  readonly source_context: DdtExactContext;
  readonly selected_round_pair?: DdtSelectedRoundPair;
  readonly provenance?: {
    readonly authority_owner: string;
    readonly source_ref: string;
    readonly contract_version: string;
  };
}

export interface DecisionThreadEvidenceSpineReaders {
  readonly authorizeContext: (
    actor: DecisionThreadEvidenceSpineActor,
    context: DdtEvidenceSpineRequestContext,
    surface: DdtSurface
  ) => Promise<boolean>;
  readonly m2p6: (
    actor: DecisionThreadEvidenceSpineActor,
    context: DdtEvidenceSpineRequestContext,
    surface: DdtSurface
  ) => Promise<DdtSourceRead>;
  readonly modelQualification: (
    actor: DecisionThreadEvidenceSpineActor,
    context: DdtEvidenceSpineRequestContext,
    surface: DdtSurface
  ) => Promise<DdtSourceRead>;
  readonly strategicPortfolio: (
    actor: DecisionThreadEvidenceSpineActor,
    context: DdtEvidenceSpineRequestContext,
    surface: DdtSurface
  ) => Promise<DdtSourceRead>;
  readonly industryModel: (
    actor: DecisionThreadEvidenceSpineActor,
    context: DdtEvidenceSpineRequestContext,
    surface: DdtSurface
  ) => Promise<DdtSourceRead>;
  readonly gsi: (
    actor: DecisionThreadEvidenceSpineActor,
    context: DdtEvidenceSpineRequestContext,
    surface: DdtSurface,
    selection: { readonly from_round_id: string; readonly to_round_id: string }
  ) => Promise<DdtSourceRead>;
}

export class DecisionThreadEvidenceSpineError extends Error {
  constructor(
    readonly code:
      | "DDT_CONTEXT_INVALID"
      | "DDT_SCOPE_VIOLATION"
      | "DDT_GSI_PAIR_INVALID"
      | "DDT_OUTPUT_INVALID"
  ) {
    super(code);
    this.name = "DecisionThreadEvidenceSpineError";
  }
}

const SOURCE_LEDGERS: Record<DdtEvidenceSourceName, DdtEvidenceLedger> = {
  M2P6: "OFFICIAL",
  MODEL_QUALIFICATION: "DIAGNOSTIC",
  STRATEGIC_PORTFOLIO: "DIAGNOSTIC",
  INDUSTRY_MODEL: "DIAGNOSTIC",
  GSI: "ADVISORY"
};

const GLOBAL_LIMITS = [
  "This spine composes existing read-only projections; it does not create a second authority.",
  "Diagnostic, counterfactual, advisory, and stakeholder movement evidence is not causal effect or official outcome.",
  "JSON_INTERNAL_ONLY is the active runtime authority; durable PostgreSQL/RLS and Human Validation are not proven.",
  "Provider remains OFF and the spine performs no formal writes."
] as const;

const STUDENT_LIMITS = [
  "仅展示当前精确上下文下允许角色查看的已发布证据摘要。",
  "这份描述性变化不证明因果效应，也不代表正式结果。",
  "证据不可用或过期时，请重新载入当前精确上下文。"
] as const;

const STUDENT_STATUS_TEXT: Record<DdtEvidenceStatus, string> = {
  AVAILABLE: "已提供当前精确上下文下的角色安全证据摘要。",
  LIMITED: "证据可用，但当前范围或发布边界有限。",
  CONTEXT_UNAVAILABLE: "当前精确上下文暂无可用证据，请检查回合与访问范围。",
  REBASE_REQUIRED: "证据上下文已变化，请重新载入当前精确上下文。",
  STALE: "证据不是当前版本，请重新载入当前精确上下文。"
};

function identity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) &&
    !/(?:^|[._:-])(?:any|current|default|fallback|first|last|latest|newest|next|unresolved)(?:$|[._:-])/i.test(
      value
    )
  );
}

function assertContext(context: DdtEvidenceSpineRequestContext): void {
  const identities = [
    context.tenant_id,
    context.course_id,
    context.run_id,
    context.team_id,
    context.round_id,
    context.role_key,
    context.activity_id
  ];
  if (
    identities.some((value) => !identity(value)) ||
    !Number.isSafeInteger(context.round_no) ||
    context.round_no < 1
  ) {
    throw new DecisionThreadEvidenceSpineError("DDT_CONTEXT_INVALID");
  }
}

function assertActorScope(
  actor: DecisionThreadEvidenceSpineActor,
  context: DdtEvidenceSpineRequestContext,
  surface: DdtSurface
): void {
  if (!identity(actor.user_id) || !identity(actor.tenant_id)) {
    throw new DecisionThreadEvidenceSpineError("DDT_SCOPE_VIOLATION");
  }
  const roles = new Set(actor.roles);
  if (surface === "student") {
    if (
      (!roles.has("student") && !roles.has("learner")) ||
      actor.tenant_id !== context.tenant_id ||
      actor.team_id !== context.team_id
    ) {
      throw new DecisionThreadEvidenceSpineError("DDT_SCOPE_VIOLATION");
    }
    return;
  }
  if (surface === "teacher") {
    if (!roles.has("teacher") || actor.tenant_id !== context.tenant_id) {
      throw new DecisionThreadEvidenceSpineError("DDT_SCOPE_VIOLATION");
    }
    return;
  }
  if (
    (!roles.has("admin") && !roles.has("tenant_admin") && !roles.has("platform_admin")) ||
    (actor.tenant_id !== context.tenant_id && !roles.has("platform_admin"))
  ) {
    throw new DecisionThreadEvidenceSpineError("DDT_SCOPE_VIOLATION");
  }
}

function statusFromError(error: unknown): DdtEvidenceStatus | undefined {
  const code = error instanceof Error ? error.message : "";
  if (/REBASE|DIGEST|MISMATCH/u.test(code)) return "REBASE_REQUIRED";
  if (/STALE|FRESHNESS/u.test(code)) return "STALE";
  if (/PUBLISHED|CONTEXT|NOT_FOUND|UNAVAILABLE|SCOPE/u.test(code)) {
    return "CONTEXT_UNAVAILABLE";
  }
  return undefined;
}

function isDdtEvidenceStatus(value: unknown): value is DdtEvidenceStatus {
  return (
    value === "AVAILABLE" ||
    value === "LIMITED" ||
    value === "CONTEXT_UNAVAILABLE" ||
    value === "REBASE_REQUIRED" ||
    value === "STALE"
  );
}

function isDdtEvidenceLedger(value: unknown): value is DdtEvidenceLedger {
  return (
    value === "OFFICIAL" ||
    value === "DIAGNOSTIC" ||
    value === "COUNTERFACTUAL" ||
    value === "ADVISORY"
  );
}

function isStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => typeof item === "string" && item.trim().length > 0 && item === item.trim()
    )
  );
}

function exactContextsEqual(left: DdtExactContext, right: DdtExactContext): boolean {
  return (
    left.tenant_id === right.tenant_id &&
    left.course_id === right.course_id &&
    left.run_id === right.run_id &&
    left.team_id === right.team_id &&
    left.round_id === right.round_id &&
    left.round_no === right.round_no &&
    left.role_key === right.role_key &&
    left.activity_id === right.activity_id
  );
}

function validateSourceRead(
  source: DdtEvidenceSourceName,
  read: DdtSourceRead,
  context: DdtExactContext,
  selection?: DdtSelectedRoundPair
): void {
  if (!read || typeof read !== "object") {
    throw new DecisionThreadEvidenceSpineError("DDT_OUTPUT_INVALID");
  }
  if (!exactContextsEqual(read.source_context, context)) {
    throw new DecisionThreadEvidenceSpineError("DDT_OUTPUT_INVALID");
  }
  if (
    read.ledger !== undefined &&
    (!isDdtEvidenceLedger(read.ledger) || read.ledger !== SOURCE_LEDGERS[source])
  ) {
    throw new DecisionThreadEvidenceSpineError("DDT_OUTPUT_INVALID");
  }
  if (!isDdtEvidenceStatus(read.status)) {
    throw new DecisionThreadEvidenceSpineError("DDT_OUTPUT_INVALID");
  }
  if (
    typeof read.summary !== "string" ||
    read.summary.trim().length === 0 ||
    read.summary !== read.summary.trim() ||
    !isStringArray(read.known_limits) ||
    read.known_limits.length === 0
  ) {
    throw new DecisionThreadEvidenceSpineError("DDT_OUTPUT_INVALID");
  }
  if (read.selected_round_pair !== undefined) {
    if (
      source !== "GSI" ||
      !selection ||
      read.selected_round_pair.from_round_id !== selection.from_round_id ||
      read.selected_round_pair.to_round_id !== selection.to_round_id
    ) {
      throw new DecisionThreadEvidenceSpineError("DDT_OUTPUT_INVALID");
    }
  }
  if (source === "GSI" && selection) {
    if (
      read.selected_round_pair?.from_round_id !== selection.from_round_id ||
      read.selected_round_pair?.to_round_id !== selection.to_round_id
    ) {
      throw new DecisionThreadEvidenceSpineError("DDT_OUTPUT_INVALID");
    }
  }
  if (read.provenance !== undefined) {
    if (
      !read.provenance ||
      typeof read.provenance !== "object" ||
      typeof read.provenance.authority_owner !== "string" ||
      typeof read.provenance.source_ref !== "string" ||
      typeof read.provenance.contract_version !== "string" ||
      read.provenance.authority_owner.trim().length === 0 ||
      read.provenance.source_ref.trim().length === 0 ||
      read.provenance.contract_version.trim().length === 0
    ) {
      throw new DecisionThreadEvidenceSpineError("DDT_OUTPUT_INVALID");
    }
  }
}

function sourceSummary(
  source: DdtEvidenceSourceName,
  status: DdtEvidenceStatus,
  supplied: string
): string {
  if (supplied.trim()) return supplied.trim();
  const labels: Record<DdtEvidenceSourceName, string> = {
    M2P6: "Decision Learning / debrief transfer evidence",
    MODEL_QUALIFICATION: "Model qualification and known-limit evidence",
    STRATEGIC_PORTFOLIO: "Strategic portfolio diagnostic evidence",
    INDUSTRY_MODEL: "Industry model readiness evidence",
    GSI: "Governed stakeholder movement evidence"
  };
  return `${labels[source]}：${status}`;
}

function buildStudentSource(
  source: DdtEvidenceSourceName,
  status: DdtEvidenceStatus,
  context: DdtEvidenceSpineRequestContext,
  knownLimits: readonly string[]
): DdtStudentEvidenceSource {
  return {
    source,
    ledger: SOURCE_LEDGERS[source],
    status,
    summary: STUDENT_STATUS_TEXT[status],
    known_limits: knownLimits,
    exact_context: {
      course_id: context.course_id,
      run_id: context.run_id,
      team_id: context.team_id,
      round_id: context.round_id,
      round_no: context.round_no,
      role_key: context.role_key
    }
  };
}

function exactContext(context: DdtEvidenceSpineRequestContext) {
  return {
    tenant_id: context.tenant_id,
    course_id: context.course_id,
    run_id: context.run_id,
    team_id: context.team_id,
    round_id: context.round_id,
    round_no: context.round_no,
    role_key: context.role_key,
    activity_id: context.activity_id
  };
}

function readSource(
  source: DdtEvidenceSourceName,
  surface: DdtSurface,
  read: DdtSourceRead
): DdtTeacherEvidenceSource | DdtStudentEvidenceSource | DdtAdminEvidenceSource {
  const status = read.status;
  if (surface === "student") {
    return buildStudentSource(
      source,
      status,
      read.source_context,
      status === "AVAILABLE" ? [STUDENT_LIMITS[0]] : [STUDENT_LIMITS[2]]
    );
  }
  const base = {
    source,
    ledger: SOURCE_LEDGERS[source],
    status,
    summary: sourceSummary(source, status, read.summary),
    known_limits: [...new Set([...read.known_limits, ...GLOBAL_LIMITS])],
    exact_context: exactContext(read.source_context),
    ...(source === "GSI" && read.selected_round_pair
      ? { selected_round_pair: read.selected_round_pair }
      : {})
  };
  return read.provenance ? { ...base, provenance: read.provenance } : base;
}

async function safeRead(
  source: DdtEvidenceSourceName,
  reader: () => Promise<DdtSourceRead>,
  context: DdtEvidenceSpineRequestContext,
  surface: DdtSurface,
  selection?: DdtSelectedRoundPair
): Promise<DdtTeacherEvidenceSource | DdtStudentEvidenceSource | DdtAdminEvidenceSource> {
  try {
    const read = await reader();
    validateSourceRead(source, read, exactContext(context), selection);
    return readSource(source, surface, read);
  } catch (error) {
    if (error instanceof DecisionThreadEvidenceSpineError) throw error;
    const status = statusFromError(error);
    if (!status) throw new DecisionThreadEvidenceSpineError("DDT_OUTPUT_INVALID");
    return readSource(source, surface, {
      status,
      summary: "",
      known_limits: ["源能力当前未提供可用的精确上下文证据。"],
      source_context: exactContext(context),
      ...(selection ? { selected_round_pair: selection } : {})
    });
  }
}

export class DecisionThreadEvidenceSpineService {
  constructor(private readonly readers: DecisionThreadEvidenceSpineReaders) {}

  async getSpine(input: {
    readonly actor: DecisionThreadEvidenceSpineActor;
    readonly context: DdtEvidenceSpineRequestContext;
    readonly surface: DdtSurface;
  }): Promise<DdtEvidenceSpineResponse> {
    assertContext(input.context);
    assertActorScope(input.actor, input.context, input.surface);
    if (!(await this.readers.authorizeContext(input.actor, input.context, input.surface))) {
      throw new DecisionThreadEvidenceSpineError("DDT_SCOPE_VIOLATION");
    }
    const hasFrom = input.context.gsi_from_round_id !== undefined;
    const hasTo = input.context.gsi_to_round_id !== undefined;
    if (hasFrom !== hasTo) {
      throw new DecisionThreadEvidenceSpineError("DDT_GSI_PAIR_INVALID");
    }
    if (hasFrom && hasTo) {
      if (
        !identity(input.context.gsi_from_round_id) ||
        !identity(input.context.gsi_to_round_id) ||
        input.context.gsi_from_round_id === input.context.gsi_to_round_id
      ) {
        throw new DecisionThreadEvidenceSpineError("DDT_GSI_PAIR_INVALID");
      }
      if (input.context.gsi_to_round_id !== input.context.round_id) {
        throw new DecisionThreadEvidenceSpineError("DDT_GSI_PAIR_INVALID");
      }
    }
    const sourceReaders: Array<[DdtEvidenceSourceName, () => Promise<DdtSourceRead>]> = [
      ["M2P6", () => this.readers.m2p6(input.actor, input.context, input.surface)],
      [
        "MODEL_QUALIFICATION",
        () => this.readers.modelQualification(input.actor, input.context, input.surface)
      ],
      [
        "STRATEGIC_PORTFOLIO",
        () => this.readers.strategicPortfolio(input.actor, input.context, input.surface)
      ],
      [
        "INDUSTRY_MODEL",
        () => this.readers.industryModel(input.actor, input.context, input.surface)
      ]
    ];
    const sources = await Promise.all(
      sourceReaders.map(([source, reader]) =>
        safeRead(source, reader, input.context, input.surface)
      )
    );
    const gsi =
      hasFrom && hasTo
        ? await safeRead(
            "GSI",
            () =>
              this.readers.gsi(input.actor, input.context, input.surface, {
                from_round_id: input.context.gsi_from_round_id!,
                to_round_id: input.context.gsi_to_round_id!
              }),
            input.context,
            input.surface,
            {
              from_round_id: input.context.gsi_from_round_id!,
              to_round_id: input.context.gsi_to_round_id!
            }
          )
        : readSource("GSI", input.surface, {
            status: "CONTEXT_UNAVAILABLE",
            summary: "",
            known_limits: ["GSI 需要用户明确选择两个不同回合；服务不会选择默认回合。"],
            source_context: exactContext(input.context)
          });
    sources.push(gsi);
    const policy = {
      provider: "OFF" as const,
      non_causal: true as const,
      causal_proof: false as const,
      official_truth_write: false as const,
      formal_write_count: 0 as const
    };
    const knownLimits =
      input.surface === "student"
        ? [...STUDENT_LIMITS]
        : [...new Set([...GLOBAL_LIMITS, ...sources.flatMap((source) => source.known_limits)])];
    if (input.surface === "student") {
      const response: DdtStudentEvidenceSpineResponse = {
        schema_version: "decision-thread-evidence-spine.v1",
        surface: "student",
        exact_context: {
          course_id: input.context.course_id,
          run_id: input.context.run_id,
          team_id: input.context.team_id,
          round_id: input.context.round_id,
          round_no: input.context.round_no,
          role_key: input.context.role_key
        },
        sources: sources as DdtStudentEvidenceSource[],
        known_limits: knownLimits,
        ...policy
      };
      return response;
    }
    if (input.surface === "teacher") {
      const response: DdtTeacherEvidenceSpineResponse = {
        schema_version: "decision-thread-evidence-spine.v1",
        surface: "teacher",
        exact_context: {
          tenant_id: input.context.tenant_id,
          course_id: input.context.course_id,
          run_id: input.context.run_id,
          team_id: input.context.team_id,
          round_id: input.context.round_id,
          round_no: input.context.round_no,
          role_key: input.context.role_key,
          activity_id: input.context.activity_id
        },
        sources: sources as DdtTeacherEvidenceSource[],
        known_limits: knownLimits,
        ...policy
      };
      return response;
    }
    const response: DdtAdminEvidenceSpineResponse = {
      schema_version: "decision-thread-evidence-spine.v1",
      surface: "admin",
      exact_context: {
        tenant_id: input.context.tenant_id,
        course_id: input.context.course_id,
        run_id: input.context.run_id,
        team_id: input.context.team_id,
        round_id: input.context.round_id,
        round_no: input.context.round_no,
        role_key: input.context.role_key,
        activity_id: input.context.activity_id
      },
      sources: sources as DdtAdminEvidenceSpineResponse["sources"],
      known_limits: knownLimits,
      ...policy
    };
    return response;
  }
}
