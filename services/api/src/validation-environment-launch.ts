import { createHash, randomUUID } from "node:crypto";
import type {
  CourseBlueprintReference,
  CoursePackageVersionReference,
  ParameterSetReference,
  ScenarioPackageReference,
  ValidationEnvironmentLaunch,
  ValidationEnvironmentLaunchStepReceipt
} from "@simwar/shared-contracts";
import {
  isValidationEnvironmentLaunch,
  VALIDATION_ENVIRONMENT_LAUNCH_SCHEMA_VERSION
} from "@simwar/shared-contracts";

export type W025LaunchHook =
  | "DURABLE_ROW"
  | "BASELINE_READY"
  | "COURSE_RUN_READY"
  | "COHORT_READY"
  | "SESSION_PREFLIGHT_READY"
  | "READY";

export interface ValidationEnvironmentLaunchInput {
  readonly target_tenant_id: string;
  readonly launch_key: string;
  readonly created_by: string;
  readonly source_parameter_set: {
    readonly tenant_id: string;
    readonly reference: ParameterSetReference;
  };
  readonly source_scenario_package: {
    readonly tenant_id: string;
    readonly reference: ScenarioPackageReference;
  };
  readonly course_blueprint_reference: CourseBlueprintReference;
  readonly course_package_reference: CoursePackageVersionReference;
  readonly course_title: string;
  readonly source_product_merge_sha: string;
  readonly cohort_template_digest: string;
  readonly cohort_template: Readonly<{
    readonly teacher_user_id: string;
    readonly teams: readonly Readonly<{
      readonly team_key: string;
      readonly name: string;
      readonly members: readonly Readonly<{
        readonly user_id: string;
        readonly display_name: string;
        readonly role_slot: "CEO" | "CFO" | "CMO" | "COO";
      }>[];
    }>[];
  }>;
  readonly seed: number;
}

export interface BaselineStepResult {
  readonly receipt: string;
}

export interface CourseRunStepResult {
  readonly course_id: string;
  readonly run_id: string;
  readonly round_id: string;
  readonly receipt: string;
}

export interface CohortStepResult {
  readonly team_ids: readonly string[];
  readonly receipt: string;
}

export interface SessionStepResult {
  readonly session_id: string;
  readonly receipt: string;
  readonly preflight_status: "PREFLIGHT_READY";
}

export interface ValidationEnvironmentLaunchStepExecutor {
  prepareBaseline(
    input: ValidationEnvironmentLaunchInput,
    launch: ValidationEnvironmentLaunch
  ): Promise<BaselineStepResult>;
  prepareCourseRun(
    input: ValidationEnvironmentLaunchInput,
    launch: ValidationEnvironmentLaunch
  ): Promise<CourseRunStepResult>;
  prepareCohort(
    input: ValidationEnvironmentLaunchInput,
    launch: ValidationEnvironmentLaunch
  ): Promise<CohortStepResult>;
  prepareSession(
    input: ValidationEnvironmentLaunchInput,
    launch: ValidationEnvironmentLaunch
  ): Promise<SessionStepResult>;
  afterStep?(hook: W025LaunchHook, launch: ValidationEnvironmentLaunch): Promise<void>;
}

export interface ValidationEnvironmentLaunchLedger {
  acquire(input: {
    tenant_id: string;
    business_key_digest: string;
    launch_id: string;
    request_fingerprint: string;
    initial: ValidationEnvironmentLaunch;
  }): Promise<ValidationEnvironmentLaunch>;
  save(
    launch: ValidationEnvironmentLaunch,
    expected_version: number
  ): Promise<ValidationEnvironmentLaunch>;
  get(tenant_id: string, launch_id: string): Promise<ValidationEnvironmentLaunch | null>;
}

export class ValidationEnvironmentLaunchError extends Error {
  constructor(
    readonly code:
      | "W025_INPUT_INVALID"
      | "W025_POSTGRES_REQUIRED"
      | "W025_LAUNCH_CONFLICT"
      | "W025_LAUNCH_ABORTED"
      | "W025_LAUNCH_CAS_STALE"
      | "W025_LAUNCH_HISTORY_INVALID",
    message: string = code
  ) {
    super(message);
    this.name = "ValidationEnvironmentLaunchError";
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function digest(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function sha(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function sourceRefValid(reference: Record<string, unknown>, tenantId: string): boolean {
  return (
    reference.tenant_id === tenantId &&
    nonBlank(reference.version) &&
    nonBlank(reference.content_digest) &&
    sha(reference.content_digest)
  );
}

function parameterRefValid(reference: ParameterSetReference): boolean {
  return (
    nonBlank(reference.parameter_set_id) &&
    nonBlank(reference.version) &&
    sha(reference.content_digest)
  );
}

function validateInput(input: ValidationEnvironmentLaunchInput): void {
  if (
    !nonBlank(input.target_tenant_id) ||
    !nonBlank(input.launch_key) ||
    !nonBlank(input.created_by) ||
    !nonBlank(input.course_title) ||
    !/^[a-f0-9]{40}$/.test(input.source_product_merge_sha) ||
    !sha(input.cohort_template_digest) ||
    !Number.isSafeInteger(input.seed) ||
    input.source_parameter_set.tenant_id === input.target_tenant_id ||
    input.source_scenario_package.tenant_id === input.target_tenant_id ||
    input.source_parameter_set.reference.parameter_set_id.trim().length === 0 ||
    input.source_parameter_set.reference.version.trim().length === 0 ||
    input.course_blueprint_reference.tenant_id !== input.target_tenant_id ||
    input.course_package_reference.tenant_id !== input.target_tenant_id ||
    input.source_scenario_package.reference.tenant_id !== input.source_scenario_package.tenant_id ||
    !parameterRefValid(input.source_parameter_set.reference) ||
    !sourceRefValid(
      input.source_scenario_package.reference as unknown as Record<string, unknown>,
      input.source_scenario_package.reference.tenant_id
    ) ||
    !sourceRefValid(
      input.course_blueprint_reference as unknown as Record<string, unknown>,
      input.course_blueprint_reference.tenant_id
    ) ||
    !sourceRefValid(
      input.course_package_reference as unknown as Record<string, unknown>,
      input.course_package_reference.tenant_id
    ) ||
    input.cohort_template.teams.length !== 2 ||
    input.cohort_template.teams.some(
      (team) =>
        !nonBlank(team.team_key) ||
        !nonBlank(team.name) ||
        team.members.length !== 4 ||
        team.members.some((member) => !nonBlank(member.user_id) || !nonBlank(member.display_name))
    )
  ) {
    throw new ValidationEnvironmentLaunchError("W025_INPUT_INVALID");
  }
  const firstTeam = input.cohort_template.teams[0];
  if (!firstTeam) throw new ValidationEnvironmentLaunchError("W025_INPUT_INVALID");
  const roleKeys = new Set(
    firstTeam.members.map(
      (member: { role_slot: "CEO" | "CFO" | "CMO" | "COO" | "risk" }) => member.role_slot
    )
  );
  if (roleKeys.size !== 4 || !roleKeys.has("CEO")) {
    throw new ValidationEnvironmentLaunchError("W025_INPUT_INVALID", "incomplete role template");
  }
}

function receipt(summary: string, source: unknown): ValidationEnvironmentLaunchStepReceipt {
  return {
    completed_at: new Date().toISOString(),
    digest: digest(source),
    status: "PASS",
    summary
  };
}

function initialLaunch(
  input: ValidationEnvironmentLaunchInput,
  businessKeyDigest: string,
  requestFingerprint: string,
  launchId: string
): ValidationEnvironmentLaunch {
  const now = new Date().toISOString();
  return {
    schema_version: VALIDATION_ENVIRONMENT_LAUNCH_SCHEMA_VERSION,
    launch_id: launchId,
    tenant_id: input.target_tenant_id,
    business_key_digest: businessKeyDigest,
    request_fingerprint: requestFingerprint,
    status: "REQUESTED",
    source_parameter_set: clone(input.source_parameter_set),
    source_scenario_package: clone(input.source_scenario_package),
    course_blueprint_reference: clone(input.course_blueprint_reference),
    course_package_reference: clone(input.course_package_reference),
    step_receipts: {},
    version: 0,
    created_by: input.created_by,
    created_at: now,
    updated_at: now,
    known_limits: [
      "JSON_INTERNAL_ONLY_NOT_USED_BY_W025",
      "HUMAN_VALIDATION_NOT_PERFORMED",
      "DURABLE_RECOVERY_BOUND_TO_THIS_POSTGRES_LAUNCH_LEDGER",
      "RLS_NOT_AUTHORIZED",
      "PILOT_PRODUCTION_NOT_AUTHORIZED"
    ]
  };
}

export function calculateLaunchIdentity(input: ValidationEnvironmentLaunchInput): {
  business_key_digest: string;
  request_fingerprint: string;
} {
  validateInput(input);
  const businessKey = { target_tenant_id: input.target_tenant_id, launch_key: input.launch_key };
  const request = {
    target_tenant_id: input.target_tenant_id,
    source_parameter_set: input.source_parameter_set,
    source_scenario_package: input.source_scenario_package,
    course_blueprint_reference: input.course_blueprint_reference,
    course_package_reference: input.course_package_reference,
    course_title: input.course_title,
    source_product_merge_sha: input.source_product_merge_sha,
    cohort_template_digest: input.cohort_template_digest,
    cohort_template: input.cohort_template,
    seed: input.seed
  };
  return { business_key_digest: digest(businessKey), request_fingerprint: digest(request) };
}

function ensureHistory(launch: ValidationEnvironmentLaunch): void {
  if (!isValidationEnvironmentLaunch(launch))
    throw new ValidationEnvironmentLaunchError("W025_LAUNCH_HISTORY_INVALID");
}

export class ValidationEnvironmentLaunchService {
  constructor(private readonly ledger: ValidationEnvironmentLaunchLedger) {}

  async get(tenantId: string, launchId: string): Promise<ValidationEnvironmentLaunch | null> {
    return this.ledger.get(tenantId, launchId);
  }

  async start(
    input: ValidationEnvironmentLaunchInput,
    executor: ValidationEnvironmentLaunchStepExecutor
  ): Promise<ValidationEnvironmentLaunch> {
    const identity = calculateLaunchIdentity(input);
    const launchId = `vlaunch_${identity.business_key_digest.slice(0, 24)}`;
    let launch = await this.ledger.acquire({
      tenant_id: input.target_tenant_id,
      ...identity,
      launch_id: launchId,
      initial: initialLaunch(
        input,
        identity.business_key_digest,
        identity.request_fingerprint,
        launchId
      )
    });
    ensureHistory(launch);
    if (launch.version === 0 && launch.status === "REQUESTED") {
      await executor.afterStep?.("DURABLE_ROW", clone(launch));
    }
    if (launch.request_fingerprint !== identity.request_fingerprint)
      throw new ValidationEnvironmentLaunchError(
        "W025_LAUNCH_CONFLICT",
        "conflicting launch retry"
      );
    if (launch.status === "CONFLICT")
      throw new ValidationEnvironmentLaunchError("W025_LAUNCH_CONFLICT");
    if (launch.status === "ABORTED")
      throw new ValidationEnvironmentLaunchError("W025_LAUNCH_ABORTED");
    if (launch.status === "READY") return clone(launch);

    const advance = async (
      status: ValidationEnvironmentLaunch["status"],
      update: Partial<ValidationEnvironmentLaunch>,
      hook: W025LaunchHook
    ) => {
      const next: ValidationEnvironmentLaunch = {
        ...launch,
        ...update,
        status,
        version: launch.version + 1,
        updated_at: new Date().toISOString(),
        last_error: undefined
      };
      launch = await this.ledger.save(next, launch.version);
      await executor.afterStep?.(hook, clone(launch));
    };

    if (launch.status === "REQUESTED") {
      const result = await executor.prepareBaseline(input, launch);
      await advance(
        "BASELINE_READY",
        {
          step_receipts: {
            ...launch.step_receipts,
            baseline: receipt("baseline materialized", result)
          }
        },
        "BASELINE_READY"
      );
    }
    if (launch.status === "BASELINE_READY") {
      const result = await executor.prepareCourseRun(input, launch);
      await advance(
        "COURSE_RUN_READY",
        {
          course_id: result.course_id,
          run_id: result.run_id,
          round_id: result.round_id,
          step_receipts: {
            ...launch.step_receipts,
            course_run: receipt("course and run ready", result)
          }
        },
        "COURSE_RUN_READY"
      );
    }
    if (launch.status === "COURSE_RUN_READY") {
      const result = await executor.prepareCohort(input, launch);
      await advance(
        "COHORT_READY",
        {
          team_ids: [...result.team_ids],
          step_receipts: { ...launch.step_receipts, cohort: receipt("fresh cohort ready", result) }
        },
        "COHORT_READY"
      );
    }
    if (launch.status === "COHORT_READY") {
      const result = await executor.prepareSession(input, launch);
      await advance(
        "SESSION_PREFLIGHT_READY",
        {
          session_id: result.session_id,
          step_receipts: {
            ...launch.step_receipts,
            session: receipt("validation preflight ready", result)
          }
        },
        "SESSION_PREFLIGHT_READY"
      );
    }
    if (launch.status === "SESSION_PREFLIGHT_READY") {
      await advance("READY", {}, "READY");
    }
    return clone(launch);
  }
}

export function createTestLaunchStepExecutor(options: {
  hooks?: Partial<Record<W025LaunchHook, () => Promise<void>>>;
  counters?: Record<string, number>;
}): ValidationEnvironmentLaunchStepExecutor {
  const count = (name: string) => {
    if (options.counters) options.counters[name] = (options.counters[name] ?? 0) + 1;
  };
  return {
    async prepareBaseline() {
      count("baseline");
      return { receipt: randomUUID() };
    },
    async prepareCourseRun(input) {
      count("course_run");
      return {
        course_id: `course_${input.launch_key}`,
        run_id: `run_${input.launch_key}`,
        round_id: `round_${input.launch_key}`,
        receipt: randomUUID()
      };
    },
    async prepareCohort() {
      count("cohort");
      return { team_ids: ["team_a", "team_b"], receipt: randomUUID() };
    },
    async prepareSession() {
      count("session");
      return {
        session_id: "session_w025",
        preflight_status: "PREFLIGHT_READY",
        receipt: randomUUID()
      };
    },
    async afterStep(hook) {
      await options.hooks?.[hook]?.();
    }
  };
}

export interface PostgresLaunchQueryExecutor {
  (sql: string, params?: readonly unknown[]): Promise<{ rowCount: number; rows: unknown[] }>;
}

export interface PostgresLaunchTransactionExecutor {
  <T>(callback: (execute: PostgresLaunchQueryExecutor) => Promise<T>): Promise<T>;
}

export function createPostgresValidationEnvironmentLaunchLedger(options: {
  queryExecutor: PostgresLaunchQueryExecutor;
  transactionExecutor: PostgresLaunchTransactionExecutor;
}): ValidationEnvironmentLaunchLedger {
  const parse = (row: unknown): ValidationEnvironmentLaunch => {
    const payload = (row as { payload?: unknown }).payload;
    if (!isValidationEnvironmentLaunch(payload))
      throw new ValidationEnvironmentLaunchError("W025_LAUNCH_HISTORY_INVALID");
    return payload;
  };
  return {
    async acquire(input) {
      return options.transactionExecutor(async (execute) => {
        await execute("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
          `${input.tenant_id}:${input.business_key_digest}`
        ]);
        const existing = await execute(
          "SELECT payload FROM w025_validation_environment_launches WHERE tenant_id = $1 AND business_key_digest = $2 FOR UPDATE",
          [input.tenant_id, input.business_key_digest]
        );
        if (existing.rowCount === 1) {
          const launch = parse(existing.rows[0]);
          if (launch.request_fingerprint !== input.request_fingerprint)
            throw new ValidationEnvironmentLaunchError(
              "W025_LAUNCH_CONFLICT",
              "conflicting launch retry"
            );
          return launch;
        }
        await execute(
          `INSERT INTO w025_validation_environment_launches
            (tenant_id, business_key_digest, launch_id, request_fingerprint, status, version, created_by, payload)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
          [
            input.tenant_id,
            input.business_key_digest,
            input.launch_id,
            input.request_fingerprint,
            input.initial.status,
            input.initial.version,
            input.initial.created_by,
            JSON.stringify(input.initial)
          ]
        );
        return input.initial;
      });
    },
    async save(launch, expectedVersion) {
      ensureHistory(launch);
      const result = await options.queryExecutor(
        `UPDATE w025_validation_environment_launches
            SET status = $1, version = $2, payload = $3::jsonb, last_error = $4, updated_at = now()
          WHERE tenant_id = $5 AND business_key_digest = $6 AND version = $7
          RETURNING payload`,
        [
          launch.status,
          launch.version,
          JSON.stringify(launch),
          launch.last_error ?? null,
          launch.tenant_id,
          launch.business_key_digest,
          expectedVersion
        ]
      );
      if (result.rowCount !== 1)
        throw new ValidationEnvironmentLaunchError("W025_LAUNCH_CAS_STALE");
      return parse(result.rows[0]);
    },
    async get(tenantId, launchId) {
      const result = await options.queryExecutor(
        "SELECT payload FROM w025_validation_environment_launches WHERE tenant_id = $1 AND launch_id = $2",
        [tenantId, launchId]
      );
      return result.rowCount === 0 ? null : parse(result.rows[0]);
    }
  };
}
