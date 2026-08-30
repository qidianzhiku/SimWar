import { createHash } from "node:crypto";
import {
  isShanghaiC0Request,
  SHANGHAI_C0_CONVERSION_SCHEMA_VERSION,
  SHANGHAI_C0_MACRO_DEFINITIONS,
  type CurrentUser,
  type ShanghaiC0AdminProjection,
  type ShanghaiC0EvidenceItem,
  type ShanghaiC0ExactBinding,
  type ShanghaiC0MacroId,
  type ShanghaiC0Request,
  type ShanghaiC0Receipt,
  type ShanghaiC0StudentChoice,
  type ShanghaiC0StudentProjection,
  type ShanghaiC0TeacherProjection
} from "@simwar/shared-contracts";

const KNOWN_LIMITS = [
  "C0 消费收据证明当前产品 seam 已读取并组合候选支持，不把候选升级为正式真值。",
  "WANT、CAN、REALIZED 仍然分离；Settlement、Score、Rank、canonical Decision 和 Replay truth 只由既有 MAIN/Simulation Core authority 管理。",
  "Provider=OFF；当前 JSON runtime 是可运行边界，PostgreSQL/RLS、Pilot、Production 和 Human Validation 均未启用。",
  "模型资格/校准状态没有由本服务推断；MODEL_CALIBRATED 始终 NOT_PROVEN。",
  "收据和学生选择仅保存在当前 API 进程内，不构成第二 Registry、Runtime、Truth Writer 或持久化正式记录。",
  "真实上海私有资料、未脱敏企业数据和未授权来源不会进入学生投影。"
] as const;

type Actor = Pick<CurrentUser, "user_id" | "tenant_id" | "roles" | "team_id">;

interface ShanghaiC0RunReference {
  course_id: string;
  scenario_package_id: string;
  parameter_set_id: string;
}

interface ShanghaiC0RoundReference {
  tenant_id: string;
  run_id: string;
  round_id: string;
  round_no: number;
}

export interface ShanghaiC0ConversionDependencies {
  readonly getRun: (tenantId: string, runId: string) => Promise<ShanghaiC0RunReference | null>;
  readonly getRound: (
    tenantId: string,
    runId: string,
    roundId: string
  ) => Promise<ShanghaiC0RoundReference | null>;
  readonly isStudentEnrolled?: (
    tenantId: string,
    userId: string,
    teamId: string,
    courseId: string
  ) => Promise<boolean>;
  readonly now?: () => string;
}

export class ShanghaiC0ConversionError extends Error {
  constructor(
    readonly code:
      | "SH_C0_INPUT_INVALID"
      | "SH_C0_FORBIDDEN"
      | "SH_C0_EXACT_BINDING_REQUIRED"
      | "SH_C0_EXPERIMENT_INVALID"
      | "SH_C0_RUN_NOT_FOUND"
      | "SH_C0_ROUND_NOT_FOUND"
      | "SH_C0_NOT_FOUND",
    message = code
  ) {
    super(message);
    this.name = "ShanghaiC0ConversionError";
  }
}

interface StoredConversion {
  actor_id: string;
  request: ShanghaiC0Request;
  receipt: ShanghaiC0Receipt;
  teacher: ShanghaiC0TeacherProjection;
  student: ShanghaiC0StudentProjection;
  admin: ShanghaiC0AdminProjection;
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
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
      .join(",")}}`;
  }
  throw new ShanghaiC0ConversionError("SH_C0_INPUT_INVALID");
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function actorIs(actor: Actor, role: "teacher" | "student" | "admin"): boolean {
  if (role === "teacher") return actor.roles.includes("teacher");
  if (role === "student")
    return actor.roles.some((item) => ["student", "learner", "team_captain"].includes(item));
  return actor.roles.some((item) => ["admin", "tenant_admin", "platform_admin"].includes(item));
}

function assertExactBinding(request: ShanghaiC0Request, tenantId: string): ShanghaiC0ExactBinding {
  if (!isShanghaiC0Request(request)) throw new ShanghaiC0ConversionError("SH_C0_INPUT_INVALID");
  if (request.exact_binding.tenant_id !== tenantId) {
    throw new ShanghaiC0ConversionError("SH_C0_FORBIDDEN");
  }
  return request.exact_binding;
}

function assertExperiment(request: ShanghaiC0Request): void {
  const experiment = request.experiment;
  const definition = SHANGHAI_C0_MACRO_DEFINITIONS[request.macro_id];
  const allowedActions: Record<ShanghaiC0MacroId, readonly string[]> = {
    M13: ["loan", "refinance", "expansion"],
    M14: ["positioning"],
    M15: ["service_shock"],
    M16: ["qualification", "requalification"],
    M17: ["episode"],
    M18: ["refresh", "diff", "rollback_dry_run"]
  };
  if (!allowedActions[request.macro_id].includes(experiment.action)) {
    throw new ShanghaiC0ConversionError("SH_C0_EXPERIMENT_INVALID");
  }
  if (
    request.macro_id === "M14" &&
    (!experiment.region ||
      !experiment.cohort ||
      !experiment.service_bundle ||
      !experiment.positioning)
  ) {
    throw new ShanghaiC0ConversionError("SH_C0_EXPERIMENT_INVALID");
  }
  if (request.macro_id === "M15") {
    const shocks = [experiment.staffing_shock, experiment.capacity_shock, experiment.quality_shock];
    if (
      shocks.some((value) => value === undefined || value < -1 || value > 1) ||
      experiment.horizon_rounds === undefined ||
      experiment.horizon_rounds < 2
    ) {
      throw new ShanghaiC0ConversionError("SH_C0_EXPERIMENT_INVALID");
    }
  }
  if (
    request.macro_id === "M17" &&
    (experiment.episode_no === undefined || experiment.episode_no < 1 || experiment.episode_no > 6)
  ) {
    throw new ShanghaiC0ConversionError("SH_C0_EXPERIMENT_INVALID");
  }
  if (request.macro_id === "M18" && !experiment.target_version) {
    throw new ShanghaiC0ConversionError("SH_C0_EXPERIMENT_INVALID");
  }
  if (!definition) throw new ShanghaiC0ConversionError("SH_C0_INPUT_INVALID");
}

function evidenceFor(request: ShanghaiC0Request): ShanghaiC0EvidenceItem[] {
  const binding = request.exact_binding;
  const definition = SHANGHAI_C0_MACRO_DEFINITIONS[request.macro_id];
  return [
    {
      evidence_id: `${request.macro_id.toLowerCase()}-exact-binding`,
      label: "当前运行精确绑定",
      status: "CURRENT_BOUND",
      source_ref: `run:${binding.run_id}/round:${binding.round_id}`,
      model_ref: binding.model_version_id,
      unit: "bound-reference",
      temporal_scope: `round-${binding.round_no}`,
      confidence: "HIGH"
    },
    {
      evidence_id: `${request.macro_id.toLowerCase()}-candidate-support`,
      label: "前置候选支持",
      status: "CANDIDATE_SUPPORT",
      source_ref: definition.candidate_support_refs.join(","),
      model_ref: binding.model_version_id,
      unit: "candidate-evidence",
      temporal_scope: "mission-scoped",
      confidence: "MEDIUM"
    },
    {
      evidence_id: `${request.macro_id.toLowerCase()}-qualification-limit`,
      label: "资格与校准状态",
      status: "NOT_PROVEN",
      source_ref: "qualification-registry-not-consumed",
      model_ref: binding.model_version_id,
      unit: "qualification-state",
      temporal_scope: "current-request",
      confidence: "NOT_PROVEN"
    }
  ];
}

function studentReceipt(receipt: ShanghaiC0Receipt): ShanghaiC0StudentProjection["receipt"] {
  return {
    schema_version: receipt.schema_version,
    receipt_id: receipt.receipt_id,
    macro_id: receipt.macro_id,
    title: receipt.title,
    consumer_status: receipt.consumer_status,
    state_a: receipt.state_a,
    state_b: receipt.state_b,
    current_surface_ref: receipt.current_surface_ref,
    experience_profile: receipt.experience_profile,
    created_at: receipt.created_at,
    replay_truth_unchanged: receipt.replay_truth_unchanged,
    official_truth_write: receipt.official_truth_write,
    settlement_write: receipt.settlement_write,
    parameter_formal_write: receipt.parameter_formal_write
  };
}

export class ShanghaiC0ConversionService {
  private readonly records = new Map<string, StoredConversion>();
  private readonly now: () => string;

  constructor(private readonly dependencies: ShanghaiC0ConversionDependencies) {
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  async createTeacher(
    actor: Actor,
    request: ShanghaiC0Request
  ): Promise<ShanghaiC0TeacherProjection> {
    if (!actorIs(actor, "teacher")) throw new ShanghaiC0ConversionError("SH_C0_FORBIDDEN");
    const binding = assertExactBinding(request, actor.tenant_id);
    assertExperiment(request);
    const run = await this.dependencies.getRun(actor.tenant_id, binding.run_id);
    if (
      !run ||
      run.course_id !== binding.course_id ||
      run.scenario_package_id !== binding.scenario_package_id ||
      run.parameter_set_id !== binding.parameter_set_id
    ) {
      throw new ShanghaiC0ConversionError("SH_C0_EXACT_BINDING_REQUIRED");
    }
    const round = await this.dependencies.getRound(
      actor.tenant_id,
      binding.run_id,
      binding.round_id
    );
    if (
      !round ||
      round.tenant_id !== actor.tenant_id ||
      round.run_id !== binding.run_id ||
      round.round_no !== binding.round_no
    ) {
      throw new ShanghaiC0ConversionError("SH_C0_EXACT_BINDING_REQUIRED");
    }

    const definition = SHANGHAI_C0_MACRO_DEFINITIONS[request.macro_id];
    const bindingDigest = digest(binding);
    const receiptId = `sh-c0-${request.macro_id.toLowerCase()}-${digest({ binding, idempotency_key: request.idempotency_key }).slice(0, 16)}`;
    const existing = this.records.get(receiptId);
    if (existing) return structuredClone(existing.teacher);
    const receipt: ShanghaiC0Receipt = {
      schema_version: SHANGHAI_C0_CONVERSION_SCHEMA_VERSION,
      receipt_id: receiptId,
      macro_id: request.macro_id,
      title: definition.title,
      consumer_status: "C0_CONSUMED",
      state_a: "C1_SUPPORT",
      state_b: "C0_CURRENT_PRODUCT_CONSUMPTION",
      current_surface_ref: definition.current_surface_refs[0]!,
      current_surface_refs: [...definition.current_surface_refs],
      candidate_support_refs: [...definition.candidate_support_refs],
      exact_binding_digest: bindingDigest,
      created_at: this.now(),
      experience_profile: request.experience_profile,
      official_truth_write: false,
      settlement_write: false,
      parameter_formal_write: false,
      provider: "OFF",
      replay_truth_unchanged: true
    };
    const evidence = evidenceFor(request);
    const teacher: ShanghaiC0TeacherProjection = {
      surface: "TEACHER",
      operation_id: "SHANGHAI_C0_TEACHER_CONVERSION_GET_V1",
      receipt,
      exact_binding: structuredClone(binding),
      experiment: structuredClone(request.experiment),
      evidence,
      available_actions: ["inspect_evidence", "compare_candidate", "export_receipt"],
      known_limits: [...KNOWN_LIMITS]
    };
    const student: ShanghaiC0StudentProjection = {
      surface: "STUDENT",
      operation_id: "SHANGHAI_C0_STUDENT_CONVERSION_GET_V1",
      receipt: studentReceipt(receipt),
      student_context: {
        course_id: binding.course_id,
        run_id: binding.run_id,
        round_no: binding.round_no,
        team_id: binding.team_id
      },
      mechanism: definition.student_mechanism,
      constraints: [
        "当前输出是角色安全的候选机制证据，不是正式结算结果。",
        "官方状态、评分、排名和 Settlement 仍由 MAIN/Simulation Core 计算。"
      ],
      why_not: [
        "候选支持未自动升级为正式 ParameterSet 或 MODEL_CALIBRATED。",
        "未满足的来源、资格或权利条件必须保持 NOT_PROVEN/UNKNOWN。"
      ],
      known_limits: [...KNOWN_LIMITS]
    };
    const admin: ShanghaiC0AdminProjection = {
      surface: "ADMIN",
      operation_id: "SHANGHAI_C0_ADMIN_CONVERSION_AUDIT_GET_V1",
      receipt,
      exact_binding: structuredClone(binding),
      evidence,
      lineage: {
        source_refs: [...definition.candidate_support_refs],
        model_ref: `${binding.model_version_id}@${binding.model_version}`,
        scenario_ref: `${binding.scenario_package_id}@${binding.scenario_package_version}`,
        parameter_ref: `${binding.parameter_set_id}@${binding.parameter_set_version}`,
        transaction_ref: `sh-c0-transaction-${bindingDigest.slice(0, 16)}`,
        rights_status: "CANDIDATE_ONLY",
        qualification_status: "NOT_PROVEN",
        calibration_status: "NOT_PROVEN"
      },
      known_limits: [...KNOWN_LIMITS]
    };
    this.records.set(receiptId, {
      actor_id: actor.user_id,
      request: structuredClone(request),
      receipt,
      teacher,
      student,
      admin
    });
    return structuredClone(teacher);
  }

  private getRecord(receiptId: string): StoredConversion {
    const record = this.records.get(receiptId);
    if (!record) throw new ShanghaiC0ConversionError("SH_C0_NOT_FOUND");
    return record;
  }

  async getTeacher(actor: Actor, receiptId: string): Promise<ShanghaiC0TeacherProjection> {
    if (!actorIs(actor, "teacher")) throw new ShanghaiC0ConversionError("SH_C0_FORBIDDEN");
    const record = this.getRecord(receiptId);
    if (
      record.receipt.current_surface_refs.length === 0 ||
      record.request.exact_binding.tenant_id !== actor.tenant_id
    ) {
      throw new ShanghaiC0ConversionError("SH_C0_FORBIDDEN");
    }
    return structuredClone(record.teacher);
  }

  async getStudent(actor: Actor, receiptId: string): Promise<ShanghaiC0StudentProjection> {
    if (!actorIs(actor, "student")) throw new ShanghaiC0ConversionError("SH_C0_FORBIDDEN");
    const record = this.getRecord(receiptId);
    const binding = record.request.exact_binding;
    if (binding.tenant_id !== actor.tenant_id || binding.team_id !== actor.team_id) {
      throw new ShanghaiC0ConversionError("SH_C0_FORBIDDEN");
    }
    if (
      this.dependencies.isStudentEnrolled &&
      !(await this.dependencies.isStudentEnrolled(
        actor.tenant_id,
        actor.user_id,
        binding.team_id,
        binding.course_id
      ))
    ) {
      throw new ShanghaiC0ConversionError("SH_C0_FORBIDDEN");
    }
    return structuredClone(record.student);
  }

  async submitStudentChoice(
    actor: Actor,
    receiptId: string,
    choice: ShanghaiC0StudentChoice
  ): Promise<ShanghaiC0StudentProjection> {
    if (
      !actorIs(actor, "student") ||
      typeof choice.option_id !== "string" ||
      choice.option_id.trim().length === 0
    ) {
      throw new ShanghaiC0ConversionError("SH_C0_INPUT_INVALID");
    }
    await this.getStudent(actor, receiptId);
    const record = this.getRecord(receiptId);
    record.student = {
      ...record.student,
      choice: { option_id: choice.option_id.trim(), status: "NON_OFFICIAL_DRAFT" }
    };
    return structuredClone(studentWithChoice(record.student, choice));
  }

  async getAdmin(actor: Actor, receiptId: string): Promise<ShanghaiC0AdminProjection> {
    if (!actorIs(actor, "admin")) throw new ShanghaiC0ConversionError("SH_C0_FORBIDDEN");
    const record = this.getRecord(receiptId);
    if (
      record.request.exact_binding.tenant_id !== actor.tenant_id &&
      !actor.roles.includes("platform_admin")
    ) {
      throw new ShanghaiC0ConversionError("SH_C0_FORBIDDEN");
    }
    return structuredClone(record.admin);
  }
}

function studentWithChoice(
  student: ShanghaiC0StudentProjection,
  choice: ShanghaiC0StudentChoice
): ShanghaiC0StudentProjection {
  return {
    ...student,
    choice: { option_id: choice.option_id.trim(), status: "NON_OFFICIAL_DRAFT" }
  };
}
