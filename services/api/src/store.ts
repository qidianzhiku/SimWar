import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import type {
  ActorRole,
  AuditLog,
  Course,
  CurrentUser,
  Decision,
  ParameterSet,
  Permission,
  PermissionKey,
  Role,
  RolePermission,
  Round,
  Run,
  ScenarioPackage,
  SessionRecord,
  SettlementResult,
  Team,
  Tenant,
  User,
  UserRole
} from "@simwar/shared-contracts";
import { ROLE_PERMISSION_MATRIX, getRolePermissions } from "@simwar/shared-contracts";
import { hashPassword } from "./auth.js";

export interface StoredUser extends User {
  password_hash: string;
}

export interface SimWarStoreSnapshot {
  tenants: Tenant[];
  users: StoredUser[];
  roles: Role[];
  permissions: Permission[];
  userRoles: UserRole[];
  rolePermissions: RolePermission[];
  sessions: SessionRecord[];
  scenarios: ScenarioPackage[];
  parameterSets: ParameterSet[];
  courses: Course[];
  teams: Team[];
  runs: Run[];
  rounds: Round[];
  decisions: Decision[];
  settlementResults: SettlementResult[];
  auditLogs: AuditLog[];
  counters: Record<string, number>;
}

export interface SimWarStore extends SimWarStoreSnapshot {
  persistenceFile?: string;
  persist: () => void;
}

export interface CreateStoreOptions {
  persistenceFile?: string;
  fileSystem?: SnapshotFileSystem;
}

export interface SnapshotFileSystem {
  readFile(path: string): string;
  mkdir(path: string): void;
  open(path: string, flags: string, mode?: number): number;
  writeFile(file: number, data: string): void;
  fsync(file: number): void;
  close(file: number): void;
  rename(source: string, target: string): void;
  unlink(path: string): void;
}

export class StoreSnapshotError extends Error {
  constructor(
    readonly code: string,
    readonly snapshotPath: string,
    readonly cause?: unknown
  ) {
    super(code);
    this.name = "StoreSnapshotError";
  }
}

export type SnapshotInspectionStatus =
  | "valid_v1"
  | "valid_legacy_v0"
  | "file_not_found"
  | "empty_file"
  | "corrupt_json"
  | "invalid_version"
  | "unsupported_version"
  | "invalid_snapshot"
  | "internal_error";

export interface SnapshotInspectionError {
  kind: "read" | "empty" | "parse" | "version" | "validation" | "internal";
  message: string;
  code?: string;
  field?: string;
  received_type?: string;
  received_version?: number;
  supported_versions?: number[];
}

interface SnapshotInspectionBase {
  details: string[];
  path: string;
}

export type SnapshotInspectionResult =
  | (SnapshotInspectionBase & {
      ok: true;
      status: "valid_v1";
      snapshot_version: typeof CURRENT_SNAPSHOT_VERSION;
      legacy: false;
    })
  | (SnapshotInspectionBase & {
      ok: true;
      status: "valid_legacy_v0";
      snapshot_version: null;
      legacy: true;
    })
  | (SnapshotInspectionBase & {
      ok: false;
      status: Exclude<SnapshotInspectionStatus, "valid_v1" | "valid_legacy_v0">;
      error: SnapshotInspectionError;
    });

export interface SnapshotBackupOptions {
  backupDirectory?: string;
  label?: string;
}

export interface SnapshotBackupResult {
  sourcePath: string;
  backupPath: string;
  createdAt: string;
  bytes: number;
}

export interface SnapshotMigrationDryRunOptions {
  targetVersion?: typeof CURRENT_SNAPSHOT_VERSION;
}

export type SnapshotMigrationDryRunStatus = "ready" | "already_current" | "blocked" | "not_found";

export type SnapshotMigrationDryRunAction =
  | "none"
  | "would_migrate_legacy_to_current"
  | "inspect_before_retry"
  | "unsupported";

export interface SnapshotMigrationDryRunPlan {
  sourcePath: string;
  targetVersion: typeof CURRENT_SNAPSHOT_VERSION;
  currentVersion: typeof CURRENT_SNAPSHOT_VERSION | "legacy" | "unknown" | number;
  status: SnapshotMigrationDryRunStatus;
  action: SnapshotMigrationDryRunAction;
  requiresBackupBeforeApply: boolean;
  canApplyInFuture: boolean;
  reasons: string[];
  safeSummary: {
    snapshotVersionLabel: string;
  };
}

export interface SnapshotMigrationApplyOptions {
  backupDirectory?: string;
  fileSystem?: SnapshotFileSystem;
}

export type SnapshotMigrationApplyStatus =
  | "applied"
  | "already_current"
  | "blocked"
  | "not_found"
  | "backup_failed"
  | "write_failed"
  | "post_write_validation_failed";

export type SnapshotMigrationApplyAction = "none" | "migrated_legacy_to_current" | "blocked";

export interface SnapshotMigrationApplyResult {
  sourcePath: string;
  targetVersion: typeof CURRENT_SNAPSHOT_VERSION;
  beforeVersion: typeof CURRENT_SNAPSHOT_VERSION | "legacy" | "unknown" | number;
  afterVersion: typeof CURRENT_SNAPSHOT_VERSION | "unknown" | null;
  status: SnapshotMigrationApplyStatus;
  action: SnapshotMigrationApplyAction;
  canApplyInFuture: boolean;
  backupPath?: string;
  backupBytes?: number;
  sourceBytesBefore?: number;
  sourceBytesAfter?: number | undefined;
  reasons: string[];
  safeSummary: {
    beforeSnapshotVersionLabel: string;
    afterSnapshotVersionLabel?: string;
    entityCounts?: Record<string, number>;
  };
  error?: {
    code: string;
  };
}

export interface SnapshotRestoreFromBackupOptions {
  preRestoreBackupDirectory?: string;
  fileSystem?: SnapshotFileSystem;
}

export type SnapshotRestoreFromBackupStatus =
  | "restored"
  | "blocked"
  | "backup_not_found"
  | "pre_restore_backup_failed"
  | "write_failed"
  | "post_restore_validation_failed";

export type SnapshotRestoreFromBackupAction = "restored_backup_to_target" | "blocked";

export interface SnapshotRestoreFromBackupResult {
  backupPath: string;
  targetPath: string;
  preRestoreBackupPath: string | null;
  backupSnapshotVersion: typeof CURRENT_SNAPSHOT_VERSION | "legacy" | "unknown" | number;
  restoredVersion: typeof CURRENT_SNAPSHOT_VERSION | "unknown" | null;
  status: SnapshotRestoreFromBackupStatus;
  action: SnapshotRestoreFromBackupAction;
  targetExistedBeforeRestore: boolean;
  backupBytes?: number;
  preRestoreBackupBytes?: number | undefined;
  targetBytesAfter?: number | undefined;
  reasons: string[];
  safeSummary: {
    backupSnapshotVersionLabel: string;
    restoredSnapshotVersionLabel?: string;
    entityCounts?: Record<string, number>;
  };
  error?: {
    code: string;
  };
}

const nodeSnapshotFileSystem: SnapshotFileSystem = {
  readFile: (path) => readFileSync(path, "utf8"),
  mkdir: (path) => mkdirSync(path, { recursive: true }),
  open: (path, flags, mode) => openSync(path, flags, mode),
  writeFile: (file, data) => writeFileSync(file, data, "utf8"),
  fsync: (file) => fsyncSync(file),
  close: (file) => closeSync(file),
  rename: (source, target) => renameSync(source, target),
  unlink: (path) => unlinkSync(path)
};

export const DEFAULT_TENANT_ID = "tenant_demo";
export const PLATFORM_TENANT_ID = "tenant_platform";
export const OTHER_TENANT_ID = "tenant_other";

const permissionKeys = [...new Set(Object.values(ROLE_PERMISSION_MATRIX).flat())].sort();
const seedTime = "2026-05-17T00:00:00.000Z";
const SNAPSHOT_VERSION_FIELD = "snapshot_version";
const CURRENT_SNAPSHOT_VERSION = 1;

interface PersistedSimWarStoreSnapshot extends SimWarStoreSnapshot {
  snapshot_version: typeof CURRENT_SNAPSHOT_VERSION;
}

function createPermission(key: PermissionKey, index: number): Permission {
  const [resource, action] = key.split(":");

  return {
    permission_id: `perm_${index.toString().padStart(3, "0")}`,
    key,
    action: action ?? key,
    resource: resource ?? "system",
    description: key
  };
}

function createRole(name: ActorRole): Role {
  return {
    role_id: `role_${name}`,
    name,
    display_name: name
      .split("_")
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" "),
    permission_keys: ROLE_PERMISSION_MATRIX[name] ?? [],
    created_at: seedTime,
    updated_at: seedTime
  };
}

function createStoredUser(input: {
  user_id: string;
  tenant_id: string;
  username: string;
  email: string;
  password: string;
  display_name: string;
  roles: ActorRole[];
  team_id?: string;
}): StoredUser {
  return {
    user_id: input.user_id,
    tenant_id: input.tenant_id,
    username: input.username,
    email: input.email,
    password_hash: hashPassword(input.password, `seed-${input.user_id}`),
    display_name: input.display_name,
    roles: input.roles,
    permissions: getRolePermissions(input.roles),
    status: "active",
    created_at: seedTime,
    updated_at: seedTime,
    ...(input.team_id ? { team_id: input.team_id } : {})
  };
}

function createSeedSnapshot(): SimWarStoreSnapshot {
  const permissions = permissionKeys.map((key, index) =>
    createPermission(key as PermissionKey, index + 1)
  );
  const roles = Object.keys(ROLE_PERMISSION_MATRIX).map((role) => createRole(role as ActorRole));
  const rolePermissions = roles.flatMap((role) =>
    role.permission_keys.map((key) => {
      const permission = permissions.find((candidate) => candidate.key === key);

      return {
        role_id: role.role_id,
        permission_id: permission?.permission_id ?? `perm_missing_${key}`
      };
    })
  );

  const tenants: Tenant[] = [
    {
      tenant_id: PLATFORM_TENANT_ID,
      name: "SimWar Platform",
      domain: "platform.simwar.local",
      status: "active",
      created_at: seedTime,
      updated_at: seedTime
    },
    {
      tenant_id: DEFAULT_TENANT_ID,
      name: "Demo Business School",
      domain: "demo.simwar.local",
      status: "active",
      created_at: seedTime,
      updated_at: seedTime
    },
    {
      tenant_id: OTHER_TENANT_ID,
      name: "Other Tenant",
      domain: "other.simwar.local",
      status: "active",
      created_at: seedTime,
      updated_at: seedTime
    }
  ];

  const users: StoredUser[] = [
    createStoredUser({
      user_id: "usr_platform",
      tenant_id: PLATFORM_TENANT_ID,
      username: "platform",
      email: "platform@simwar.local",
      password: "platform",
      display_name: "Platform Admin",
      roles: ["platform_admin"]
    }),
    createStoredUser({
      user_id: "usr_teacher",
      tenant_id: DEFAULT_TENANT_ID,
      username: "teacher",
      email: "teacher@demo.simwar.local",
      password: "teacher",
      display_name: "P0 Teacher",
      roles: ["teacher"]
    }),
    createStoredUser({
      user_id: "usr_student",
      tenant_id: DEFAULT_TENANT_ID,
      username: "student",
      email: "student@demo.simwar.local",
      password: "student",
      display_name: "P0 Student",
      roles: ["learner", "team_captain"],
      team_id: "team_alpha"
    }),
    createStoredUser({
      user_id: "usr_admin",
      tenant_id: DEFAULT_TENANT_ID,
      username: "admin",
      email: "admin@demo.simwar.local",
      password: "admin",
      display_name: "P0 Admin",
      roles: ["tenant_admin"]
    }),
    createStoredUser({
      user_id: "usr_other_teacher",
      tenant_id: OTHER_TENANT_ID,
      username: "other_teacher",
      email: "teacher@other.simwar.local",
      password: "teacher",
      display_name: "Other Teacher",
      roles: ["teacher"]
    })
  ];

  const userRoles: UserRole[] = users.flatMap((user) =>
    user.roles.map((role) => ({
      user_id: user.user_id,
      role_id: `role_${role}`,
      tenant_id: user.tenant_id
    }))
  );

  const scenarios: ScenarioPackage[] = [
    {
      scenario_package_id: "scenario_eldercare_demo",
      tenant_id: DEFAULT_TENANT_ID,
      name: "康养商战 P0 默认场景",
      version: "1.0.0",
      status: "approved",
      plugin_package_ids: ["plugin_wellness_stub"]
    }
  ];

  const parameterSets: ParameterSet[] = [
    {
      parameter_set_id: "param_toy_approved_1",
      tenant_id: DEFAULT_TENANT_ID,
      version: "1.0.0",
      status: "approved",
      model_family: "toy_logit",
      seed: 20260517,
      base_market_size: 240,
      base_capacity: 120,
      unit_cost: 4200,
      fixed_cost: 120000
    }
  ];

  const courses: Course[] = [
    {
      course_id: "course_demo",
      tenant_id: DEFAULT_TENANT_ID,
      title: "P0 闭环演示课程",
      status: "published",
      scenario_package_id: scenarios[0]?.scenario_package_id ?? "scenario_eldercare_demo",
      parameter_set_id: parameterSets[0]?.parameter_set_id ?? "param_toy_approved_1",
      created_by: "usr_teacher"
    }
  ];

  const teams: Team[] = [
    {
      team_id: "team_alpha",
      tenant_id: DEFAULT_TENANT_ID,
      course_id: "course_demo",
      name: "Alpha 康养队",
      captain_user_id: "usr_student",
      members: [
        {
          user_id: "usr_student",
          display_name: "P0 Student",
          role_slot: "CEO"
        }
      ]
    }
  ];

  return {
    tenants,
    users,
    roles,
    permissions,
    userRoles,
    rolePermissions,
    sessions: [],
    scenarios,
    parameterSets,
    courses,
    teams,
    runs: [],
    rounds: [],
    decisions: [],
    settlementResults: [],
    auditLogs: [],
    counters: {
      tenant: 3,
      user: 5,
      course: 1,
      team: 1,
      run: 0,
      round: 0,
      decision: 0,
      result: 0,
      audit: 0,
      session: 0
    }
  };
}

function toSnapshot(store: SimWarStore): SimWarStoreSnapshot {
  return {
    tenants: store.tenants,
    users: store.users,
    roles: store.roles,
    permissions: store.permissions,
    userRoles: store.userRoles,
    rolePermissions: store.rolePermissions,
    sessions: store.sessions,
    scenarios: store.scenarios,
    parameterSets: store.parameterSets,
    courses: store.courses,
    teams: store.teams,
    runs: store.runs,
    rounds: store.rounds,
    decisions: store.decisions,
    settlementResults: store.settlementResults,
    auditLogs: store.auditLogs,
    counters: store.counters
  };
}

function toPersistedSnapshot(snapshot: SimWarStoreSnapshot): PersistedSimWarStoreSnapshot {
  return {
    [SNAPSHOT_VERSION_FIELD]: CURRENT_SNAPSHOT_VERSION,
    ...snapshot
  };
}

function normalizeSnapshot(snapshot: SimWarStoreSnapshot): SimWarStoreSnapshot {
  const seed = createSeedSnapshot();

  return {
    ...seed,
    ...snapshot,
    tenants: snapshot.tenants ?? seed.tenants,
    users: snapshot.users ?? seed.users,
    roles: snapshot.roles ?? seed.roles,
    permissions: snapshot.permissions ?? seed.permissions,
    userRoles: snapshot.userRoles ?? seed.userRoles,
    rolePermissions: snapshot.rolePermissions ?? seed.rolePermissions,
    sessions: snapshot.sessions ?? [],
    counters: { ...seed.counters, ...(snapshot.counters ?? {}) }
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function failCorruptedSnapshot(snapshotPath: string, fieldPath?: string): never {
  throw new StoreSnapshotError(
    "store_snapshot_corrupted",
    snapshotPath,
    fieldPath ? { field: fieldPath } : undefined
  );
}

function assertRecordValue(
  value: unknown,
  snapshotPath: string,
  fieldPath?: string
): Record<string, unknown> {
  if (!isRecord(value)) {
    failCorruptedSnapshot(snapshotPath, fieldPath);
  }

  return value;
}

function assertStringField(
  value: Record<string, unknown>,
  field: string,
  snapshotPath: string,
  fieldPath?: string
): string {
  const candidate = value[field];

  if (typeof candidate !== "string" || candidate.length === 0) {
    failCorruptedSnapshot(snapshotPath, fieldPath ?? field);
  }

  return candidate;
}

function assertOptionalStringField(
  value: Record<string, unknown>,
  field: string,
  snapshotPath: string,
  fieldPath?: string
): string | undefined {
  const candidate = value[field];

  if (candidate === undefined) {
    return undefined;
  }

  if (typeof candidate !== "string" || candidate.length === 0) {
    failCorruptedSnapshot(snapshotPath, fieldPath ?? field);
  }

  return candidate;
}

function assertNumberField(
  value: Record<string, unknown>,
  field: string,
  snapshotPath: string,
  fieldPath?: string
): number {
  const candidate = value[field];

  if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
    failCorruptedSnapshot(snapshotPath, fieldPath ?? field);
  }

  return candidate;
}

function assertRecordField(
  value: Record<string, unknown>,
  field: string,
  snapshotPath: string,
  fieldPath?: string
): Record<string, unknown> {
  return assertRecordValue(value[field], snapshotPath, fieldPath ?? field);
}

function assertRecordArray(
  value: unknown[],
  snapshotPath: string,
  fieldPath?: string
): Record<string, unknown>[] {
  return value.map((item, index) =>
    assertRecordValue(item, snapshotPath, fieldPath ? `${fieldPath}[${index}]` : undefined)
  );
}

function assertStringArrayField(
  value: Record<string, unknown>,
  field: string,
  snapshotPath: string,
  fieldPath?: string
): string[] {
  const candidate = value[field];
  const path = fieldPath ?? field;

  if (!Array.isArray(candidate)) {
    failCorruptedSnapshot(snapshotPath, path);
  }

  for (const [index, item] of candidate.entries()) {
    if (typeof item !== "string" || item.length === 0) {
      failCorruptedSnapshot(snapshotPath, `${path}[${index}]`);
    }
  }

  return candidate;
}

function assertRecordArrayField(
  value: Record<string, unknown>,
  field: string,
  snapshotPath: string,
  fieldPath?: string
): Record<string, unknown>[] {
  const candidate = value[field];
  const path = fieldPath ?? field;

  if (!Array.isArray(candidate)) {
    failCorruptedSnapshot(snapshotPath, path);
  }

  return assertRecordArray(candidate, snapshotPath, path);
}

function assertEnumField<T extends string>(
  value: Record<string, unknown>,
  field: string,
  allowed: ReadonlySet<T>,
  snapshotPath: string,
  fieldPath?: string
): T {
  const candidate = assertStringField(value, field, snapshotPath, fieldPath);

  if (!allowed.has(candidate as T)) {
    failCorruptedSnapshot(snapshotPath, fieldPath ?? field);
  }

  return candidate as T;
}

function assertOptionalEnumField<T extends string>(
  value: Record<string, unknown>,
  field: string,
  allowed: ReadonlySet<T>,
  snapshotPath: string,
  fieldPath?: string
): T | undefined {
  const candidate = assertOptionalStringField(value, field, snapshotPath, fieldPath);

  if (candidate === undefined) {
    return undefined;
  }

  if (!allowed.has(candidate as T)) {
    failCorruptedSnapshot(snapshotPath, fieldPath ?? field);
  }

  return candidate as T;
}

function assertValidationReport(value: unknown, snapshotPath: string, fieldPath: string): void {
  if (!Array.isArray(value)) {
    failCorruptedSnapshot(snapshotPath, fieldPath);
  }

  for (const [index, detail] of value.entries()) {
    const detailPath = `${fieldPath}[${index}]`;
    const record = assertRecordValue(detail, snapshotPath, detailPath);
    assertStringField(record, "reason", snapshotPath, `${detailPath}.reason`);
    assertOptionalStringField(record, "field", snapshotPath, `${detailPath}.field`);
  }
}

function assertDecisionPayload(value: unknown, snapshotPath: string, fieldPath: string): void {
  const payload = assertRecordValue(value, snapshotPath, fieldPath);
  const pricing = assertRecordField(payload, "pricing", snapshotPath, `${fieldPath}.pricing`);
  assertNumberField(pricing, "base_price", snapshotPath, `${fieldPath}.pricing.base_price`);
  assertNumberField(payload, "marketing_budget", snapshotPath, `${fieldPath}.marketing_budget`);
  assertNumberField(
    payload,
    "service_quality_budget",
    snapshotPath,
    `${fieldPath}.service_quality_budget`
  );

  assertEnumField(
    payload,
    "capacity_plan",
    new Set(["contract", "hold", "expand"] as const),
    snapshotPath,
    `${fieldPath}.capacity_plan`
  );

  assertNumberField(payload, "cash_buffer_target", snapshotPath, `${fieldPath}.cash_buffer_target`);
  assertStringField(payload, "strategy_statement", snapshotPath, `${fieldPath}.strategy_statement`);
}

function assertTeamSettlement(value: unknown, snapshotPath: string, fieldPath: string): void {
  const settlement = assertRecordValue(value, snapshotPath, fieldPath);
  assertStringField(settlement, "team_id", snapshotPath, `${fieldPath}.team_id`);
  assertStringField(settlement, "team_name", snapshotPath, `${fieldPath}.team_name`);

  const stateTrue = assertRecordField(
    settlement,
    "state_true",
    snapshotPath,
    `${fieldPath}.state_true`
  );
  for (const field of [
    "market_share",
    "demand",
    "served_demand",
    "revenue",
    "cost",
    "profit",
    "cash_flow",
    "score",
    "rank"
  ]) {
    assertNumberField(stateTrue, field, snapshotPath, `${fieldPath}.state_true.${field}`);
  }
  assertEnumField(
    stateTrue,
    "settlement_status",
    new Set(["settled"] as const),
    snapshotPath,
    `${fieldPath}.state_true.settlement_status`
  );

  const stateObs = assertRecordField(
    settlement,
    "state_obs",
    snapshotPath,
    `${fieldPath}.state_obs`
  );
  assertEnumField(
    stateObs,
    "demand_band",
    new Set(["low", "medium", "high"] as const),
    snapshotPath,
    `${fieldPath}.state_obs.demand_band`
  );
  assertNumberField(
    stateObs,
    "served_demand",
    snapshotPath,
    `${fieldPath}.state_obs.served_demand`
  );
  assertNumberField(stateObs, "revenue", snapshotPath, `${fieldPath}.state_obs.revenue`);
  assertEnumField(
    stateObs,
    "profit_band",
    new Set(["loss", "thin", "healthy"] as const),
    snapshotPath,
    `${fieldPath}.state_obs.profit_band`
  );
  assertNumberField(stateObs, "score", snapshotPath, `${fieldPath}.state_obs.score`);
  assertNumberField(stateObs, "rank", snapshotPath, `${fieldPath}.state_obs.rank`);

  const stateEst = assertRecordField(
    settlement,
    "state_est",
    snapshotPath,
    `${fieldPath}.state_est`
  );
  assertEnumField(
    stateEst,
    "next_round_risk",
    new Set(["capacity", "cash", "demand", "balanced"] as const),
    snapshotPath,
    `${fieldPath}.state_est.next_round_risk`
  );
  assertStringField(stateEst, "explanation", snapshotPath, `${fieldPath}.state_est.explanation`);
  assertStringField(
    stateEst,
    "recommended_focus",
    snapshotPath,
    `${fieldPath}.state_est.recommended_focus`
  );
}

function assertWellnessParameters(value: unknown, snapshotPath: string, fieldPath: string): void {
  const parameters = assertRecordValue(value, snapshotPath, fieldPath);
  assertEnumField(
    parameters,
    "schema_version",
    new Set(["wellness.parameters.v1"] as const),
    snapshotPath,
    `${fieldPath}.schema_version`
  );

  const demandCurve = assertRecordField(
    parameters,
    "demand_curve",
    snapshotPath,
    `${fieldPath}.demand_curve`
  );
  for (const field of [
    "reference_price",
    "price_friction_scale",
    "quality_budget_per_utility",
    "max_quality_lift",
    "quality_lift_weight",
    "price_sensitivity"
  ]) {
    assertNumberField(demandCurve, field, snapshotPath, `${fieldPath}.demand_curve.${field}`);
  }

  const costStructure = assertRecordField(
    parameters,
    "cost_structure",
    snapshotPath,
    `${fieldPath}.cost_structure`
  );
  assertNumberField(
    costStructure,
    "partnership_discount_threshold",
    snapshotPath,
    `${fieldPath}.cost_structure.partnership_discount_threshold`
  );
  assertNumberField(
    costStructure,
    "partnership_discount_rate",
    snapshotPath,
    `${fieldPath}.cost_structure.partnership_discount_rate`
  );

  const operationsConstraints = assertRecordField(
    parameters,
    "operations_constraints",
    snapshotPath,
    `${fieldPath}.operations_constraints`
  );
  assertNumberField(
    operationsConstraints,
    "max_capacity_modifier",
    snapshotPath,
    `${fieldPath}.operations_constraints.max_capacity_modifier`
  );
  assertNumberField(
    operationsConstraints,
    "min_service_quality_budget",
    snapshotPath,
    `${fieldPath}.operations_constraints.min_service_quality_budget`
  );

  const scoringWeights = assertRecordField(
    parameters,
    "scoring_weights",
    snapshotPath,
    `${fieldPath}.scoring_weights`
  );
  assertNumberField(
    scoringWeights,
    "service_quality_bonus_per_budget",
    snapshotPath,
    `${fieldPath}.scoring_weights.service_quality_bonus_per_budget`
  );
  assertNumberField(
    scoringWeights,
    "max_service_quality_bonus",
    snapshotPath,
    `${fieldPath}.scoring_weights.max_service_quality_bonus`
  );
  assertNumberField(
    scoringWeights,
    "underfunded_service_penalty",
    snapshotPath,
    `${fieldPath}.scoring_weights.underfunded_service_penalty`
  );
}

function assertSnapshotEntities(snapshot: SimWarStoreSnapshot, snapshotPath: string): void {
  const tenantStatuses = new Set(["active", "suspended", "archived"] as const);
  const userStatuses = new Set(["active", "invited", "disabled"] as const);
  const courseStatuses = new Set(["draft", "published", "active", "archived"] as const);
  const runStatuses = new Set(["draft", "active", "completed"] as const);
  const roundStatuses = new Set(["draft", "open", "locked", "settled", "published"] as const);
  const decisionStatuses = new Set(["draft", "submitted", "validated", "rejected"] as const);
  const parameterSetStatuses = new Set([
    "draft",
    "candidate",
    "shadow_passed",
    "approved",
    "deprecated"
  ] as const);
  const actorRoles = new Set(
    Object.keys(ROLE_PERMISSION_MATRIX).concat(["student", "admin", "service"])
  );
  const roleSlots = new Set(["CEO", "CFO", "CMO", "COO", "risk"] as const);
  const permissionKeySet = new Set<string>(permissionKeys);

  for (const [index, tenant] of assertRecordArray(
    snapshot.tenants,
    snapshotPath,
    "tenants"
  ).entries()) {
    const path = `tenants[${index}]`;
    assertStringField(tenant, "tenant_id", snapshotPath, `${path}.tenant_id`);
    assertStringField(tenant, "name", snapshotPath, `${path}.name`);
    assertStringField(tenant, "domain", snapshotPath, `${path}.domain`);
    assertEnumField(tenant, "status", tenantStatuses, snapshotPath, `${path}.status`);
    assertStringField(tenant, "created_at", snapshotPath, `${path}.created_at`);
    assertStringField(tenant, "updated_at", snapshotPath, `${path}.updated_at`);
  }

  for (const [index, user] of assertRecordArray(snapshot.users, snapshotPath, "users").entries()) {
    const path = `users[${index}]`;
    assertStringField(user, "user_id", snapshotPath, `${path}.user_id`);
    assertStringField(user, "tenant_id", snapshotPath, `${path}.tenant_id`);
    assertStringField(user, "username", snapshotPath, `${path}.username`);
    assertStringField(user, "email", snapshotPath, `${path}.email`);
    assertStringField(user, "display_name", snapshotPath, `${path}.display_name`);
    assertStringField(user, "password_hash", snapshotPath, `${path}.password_hash`);
    assertEnumField(user, "status", userStatuses, snapshotPath, `${path}.status`);
    assertStringField(user, "created_at", snapshotPath, `${path}.created_at`);
    assertStringField(user, "updated_at", snapshotPath, `${path}.updated_at`);
    assertOptionalStringField(user, "team_id", snapshotPath, `${path}.team_id`);
    for (const [roleIndex, role] of assertStringArrayField(
      user,
      "roles",
      snapshotPath,
      `${path}.roles`
    ).entries()) {
      if (!actorRoles.has(role)) {
        failCorruptedSnapshot(snapshotPath, `${path}.roles[${roleIndex}]`);
      }
    }
    const permissions = user.permissions;
    if (permissions !== undefined) {
      if (!Array.isArray(permissions)) {
        failCorruptedSnapshot(snapshotPath, `${path}.permissions`);
      }
      for (const [permissionIndex, permission] of permissions.entries()) {
        if (typeof permission !== "string" || !permissionKeySet.has(permission)) {
          failCorruptedSnapshot(snapshotPath, `${path}.permissions[${permissionIndex}]`);
        }
      }
    }
  }

  for (const [index, role] of assertRecordArray(snapshot.roles, snapshotPath, "roles").entries()) {
    const path = `roles[${index}]`;
    assertStringField(role, "role_id", snapshotPath, `${path}.role_id`);
    assertOptionalStringField(role, "tenant_id", snapshotPath, `${path}.tenant_id`);
    const roleName = assertStringField(role, "name", snapshotPath, `${path}.name`);
    if (!actorRoles.has(roleName)) {
      failCorruptedSnapshot(snapshotPath, `${path}.name`);
    }
    assertStringField(role, "display_name", snapshotPath, `${path}.display_name`);
    assertStringField(role, "created_at", snapshotPath, `${path}.created_at`);
    assertStringField(role, "updated_at", snapshotPath, `${path}.updated_at`);
    for (const [keyIndex, key] of assertStringArrayField(
      role,
      "permission_keys",
      snapshotPath,
      `${path}.permission_keys`
    ).entries()) {
      if (!permissionKeySet.has(key)) {
        failCorruptedSnapshot(snapshotPath, `${path}.permission_keys[${keyIndex}]`);
      }
    }
  }

  for (const [index, permission] of assertRecordArray(
    snapshot.permissions,
    snapshotPath,
    "permissions"
  ).entries()) {
    const path = `permissions[${index}]`;
    assertStringField(permission, "permission_id", snapshotPath, `${path}.permission_id`);
    const key = assertStringField(permission, "key", snapshotPath, `${path}.key`);
    if (!permissionKeySet.has(key)) {
      failCorruptedSnapshot(snapshotPath, `${path}.key`);
    }
    assertStringField(permission, "action", snapshotPath, `${path}.action`);
    assertStringField(permission, "resource", snapshotPath, `${path}.resource`);
    assertStringField(permission, "description", snapshotPath, `${path}.description`);
  }

  for (const [index, userRole] of assertRecordArray(
    snapshot.userRoles,
    snapshotPath,
    "userRoles"
  ).entries()) {
    const path = `userRoles[${index}]`;
    assertStringField(userRole, "user_id", snapshotPath, `${path}.user_id`);
    assertStringField(userRole, "role_id", snapshotPath, `${path}.role_id`);
    assertStringField(userRole, "tenant_id", snapshotPath, `${path}.tenant_id`);
  }

  for (const [index, rolePermission] of assertRecordArray(
    snapshot.rolePermissions,
    snapshotPath,
    "rolePermissions"
  ).entries()) {
    const path = `rolePermissions[${index}]`;
    assertStringField(rolePermission, "role_id", snapshotPath, `${path}.role_id`);
    assertStringField(rolePermission, "permission_id", snapshotPath, `${path}.permission_id`);
  }

  for (const [index, session] of assertRecordArray(
    snapshot.sessions,
    snapshotPath,
    "sessions"
  ).entries()) {
    const path = `sessions[${index}]`;
    assertStringField(session, "session_id", snapshotPath, `${path}.session_id`);
    assertStringField(session, "user_id", snapshotPath, `${path}.user_id`);
    assertStringField(session, "tenant_id", snapshotPath, `${path}.tenant_id`);
    assertStringField(session, "token_hash", snapshotPath, `${path}.token_hash`);
    assertStringField(session, "expires_at", snapshotPath, `${path}.expires_at`);
    assertStringField(session, "created_at", snapshotPath, `${path}.created_at`);
    assertOptionalStringField(session, "revoked_at", snapshotPath, `${path}.revoked_at`);
  }

  for (const [index, scenario] of assertRecordArray(
    snapshot.scenarios,
    snapshotPath,
    "scenarios"
  ).entries()) {
    const path = `scenarios[${index}]`;
    assertStringField(scenario, "scenario_package_id", snapshotPath, `${path}.scenario_package_id`);
    assertStringField(scenario, "tenant_id", snapshotPath, `${path}.tenant_id`);
    assertStringField(scenario, "name", snapshotPath, `${path}.name`);
    assertStringField(scenario, "version", snapshotPath, `${path}.version`);
    assertEnumField(
      scenario,
      "status",
      new Set(["approved"] as const),
      snapshotPath,
      `${path}.status`
    );
    assertStringArrayField(
      scenario,
      "plugin_package_ids",
      snapshotPath,
      `${path}.plugin_package_ids`
    );
  }

  for (const [index, parameterSet] of assertRecordArray(
    snapshot.parameterSets,
    snapshotPath,
    "parameterSets"
  ).entries()) {
    const path = `parameterSets[${index}]`;
    assertStringField(parameterSet, "parameter_set_id", snapshotPath, `${path}.parameter_set_id`);
    assertStringField(parameterSet, "tenant_id", snapshotPath, `${path}.tenant_id`);
    assertStringField(parameterSet, "version", snapshotPath, `${path}.version`);
    assertEnumField(parameterSet, "status", parameterSetStatuses, snapshotPath, `${path}.status`);
    assertEnumField(
      parameterSet,
      "model_family",
      new Set(["toy_logit"] as const),
      snapshotPath,
      `${path}.model_family`
    );
    assertNumberField(parameterSet, "seed", snapshotPath, `${path}.seed`);
    assertNumberField(parameterSet, "base_market_size", snapshotPath, `${path}.base_market_size`);
    assertNumberField(parameterSet, "base_capacity", snapshotPath, `${path}.base_capacity`);
    assertNumberField(parameterSet, "unit_cost", snapshotPath, `${path}.unit_cost`);
    assertNumberField(parameterSet, "fixed_cost", snapshotPath, `${path}.fixed_cost`);
    if (parameterSet.parameters !== undefined) {
      assertWellnessParameters(parameterSet.parameters, snapshotPath, `${path}.parameters`);
    }
  }

  for (const [index, course] of assertRecordArray(
    snapshot.courses,
    snapshotPath,
    "courses"
  ).entries()) {
    const path = `courses[${index}]`;
    assertStringField(course, "course_id", snapshotPath, `${path}.course_id`);
    assertStringField(course, "tenant_id", snapshotPath, `${path}.tenant_id`);
    assertStringField(course, "title", snapshotPath, `${path}.title`);
    assertEnumField(course, "status", courseStatuses, snapshotPath, `${path}.status`);
    assertStringField(course, "scenario_package_id", snapshotPath, `${path}.scenario_package_id`);
    assertStringField(course, "parameter_set_id", snapshotPath, `${path}.parameter_set_id`);
    assertStringField(course, "created_by", snapshotPath, `${path}.created_by`);
  }

  for (const [index, team] of assertRecordArray(snapshot.teams, snapshotPath, "teams").entries()) {
    const path = `teams[${index}]`;
    assertStringField(team, "team_id", snapshotPath, `${path}.team_id`);
    assertStringField(team, "tenant_id", snapshotPath, `${path}.tenant_id`);
    assertStringField(team, "course_id", snapshotPath, `${path}.course_id`);
    assertStringField(team, "name", snapshotPath, `${path}.name`);
    assertStringField(team, "captain_user_id", snapshotPath, `${path}.captain_user_id`);
    for (const [memberIndex, member] of assertRecordArrayField(
      team,
      "members",
      snapshotPath,
      `${path}.members`
    ).entries()) {
      const memberPath = `${path}.members[${memberIndex}]`;
      assertStringField(member, "user_id", snapshotPath, `${memberPath}.user_id`);
      assertStringField(member, "display_name", snapshotPath, `${memberPath}.display_name`);
      assertEnumField(member, "role_slot", roleSlots, snapshotPath, `${memberPath}.role_slot`);
    }
  }

  for (const [index, run] of assertRecordArray(snapshot.runs, snapshotPath, "runs").entries()) {
    const path = `runs[${index}]`;
    assertStringField(run, "run_id", snapshotPath, `${path}.run_id`);
    assertStringField(run, "tenant_id", snapshotPath, `${path}.tenant_id`);
    assertStringField(run, "course_id", snapshotPath, `${path}.course_id`);
    assertStringField(run, "scenario_package_id", snapshotPath, `${path}.scenario_package_id`);
    assertStringField(run, "parameter_set_id", snapshotPath, `${path}.parameter_set_id`);
    assertNumberField(run, "seed", snapshotPath, `${path}.seed`);
    assertEnumField(run, "status", runStatuses, snapshotPath, `${path}.status`);
  }

  for (const [index, round] of assertRecordArray(
    snapshot.rounds,
    snapshotPath,
    "rounds"
  ).entries()) {
    const path = `rounds[${index}]`;
    assertStringField(round, "round_id", snapshotPath, `${path}.round_id`);
    assertStringField(round, "tenant_id", snapshotPath, `${path}.tenant_id`);
    assertStringField(round, "run_id", snapshotPath, `${path}.run_id`);
    assertNumberField(round, "round_no", snapshotPath, `${path}.round_no`);
    assertEnumField(round, "status", roundStatuses, snapshotPath, `${path}.status`);
    assertOptionalStringField(
      round,
      "decision_batch_id",
      snapshotPath,
      `${path}.decision_batch_id`
    );
    assertOptionalStringField(round, "replay_hash", snapshotPath, `${path}.replay_hash`);
  }

  for (const [index, decision] of assertRecordArray(
    snapshot.decisions,
    snapshotPath,
    "decisions"
  ).entries()) {
    const path = `decisions[${index}]`;
    assertStringField(decision, "decision_id", snapshotPath, `${path}.decision_id`);
    assertStringField(decision, "tenant_id", snapshotPath, `${path}.tenant_id`);
    assertStringField(decision, "run_id", snapshotPath, `${path}.run_id`);
    assertStringField(decision, "round_id", snapshotPath, `${path}.round_id`);
    assertNumberField(decision, "round_no", snapshotPath, `${path}.round_no`);
    assertStringField(decision, "team_id", snapshotPath, `${path}.team_id`);
    assertEnumField(decision, "status", decisionStatuses, snapshotPath, `${path}.status`);
    assertNumberField(decision, "version", snapshotPath, `${path}.version`);
    assertDecisionPayload(decision.payload, snapshotPath, `${path}.payload`);
    assertValidationReport(decision.validation_report, snapshotPath, `${path}.validation_report`);
    assertStringField(decision, "submitted_by", snapshotPath, `${path}.submitted_by`);
    assertOptionalEnumField(
      decision,
      "canonical_source",
      new Set(["legacy_direct", "role_merge_commit"] as const),
      snapshotPath,
      `${path}.canonical_source`
    );
    assertOptionalStringField(decision, "merge_commit_id", snapshotPath, `${path}.merge_commit_id`);
    assertOptionalStringField(
      decision,
      "team_confirmation_id",
      snapshotPath,
      `${path}.team_confirmation_id`
    );
  }

  for (const [index, result] of assertRecordArray(
    snapshot.settlementResults,
    snapshotPath,
    "settlementResults"
  ).entries()) {
    const path = `settlementResults[${index}]`;
    assertStringField(result, "settlement_result_id", snapshotPath, `${path}.settlement_result_id`);
    assertStringField(result, "tenant_id", snapshotPath, `${path}.tenant_id`);
    assertStringField(result, "run_id", snapshotPath, `${path}.run_id`);
    assertStringField(result, "round_id", snapshotPath, `${path}.round_id`);
    assertNumberField(result, "round_no", snapshotPath, `${path}.round_no`);
    assertStringField(result, "parameter_set_id", snapshotPath, `${path}.parameter_set_id`);
    assertStringField(result, "scenario_package_id", snapshotPath, `${path}.scenario_package_id`);
    assertStringField(result, "replay_hash", snapshotPath, `${path}.replay_hash`);
    for (const [teamResultIndex, teamResult] of assertRecordArrayField(
      result,
      "team_results",
      snapshotPath,
      `${path}.team_results`
    ).entries()) {
      assertTeamSettlement(teamResult, snapshotPath, `${path}.team_results[${teamResultIndex}]`);
    }
  }

  for (const [index, auditLog] of assertRecordArray(
    snapshot.auditLogs,
    snapshotPath,
    "auditLogs"
  ).entries()) {
    const path = `auditLogs[${index}]`;
    assertStringField(auditLog, "audit_id", snapshotPath, `${path}.audit_id`);
    assertStringField(auditLog, "tenant_id", snapshotPath, `${path}.tenant_id`);
    assertStringField(auditLog, "actor_id", snapshotPath, `${path}.actor_id`);
    const actorRole = assertStringField(auditLog, "actor_role", snapshotPath, `${path}.actor_role`);
    if (!actorRoles.has(actorRole)) {
      failCorruptedSnapshot(snapshotPath, `${path}.actor_role`);
    }
    assertStringField(auditLog, "action", snapshotPath, `${path}.action`);
    assertStringField(auditLog, "resource_type", snapshotPath, `${path}.resource_type`);
    assertStringField(auditLog, "resource_id", snapshotPath, `${path}.resource_id`);
    assertStringField(auditLog, "request_id", snapshotPath, `${path}.request_id`);
    assertStringField(auditLog, "created_at", snapshotPath, `${path}.created_at`);
    if (auditLog.before !== undefined) {
      assertRecordValue(auditLog.before, snapshotPath, `${path}.before`);
    }
    if (auditLog.after !== undefined) {
      assertRecordValue(auditLog.after, snapshotPath, `${path}.after`);
    }
  }

  for (const [key, value] of Object.entries(snapshot.counters)) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      failCorruptedSnapshot(snapshotPath, `counters.${key}`);
    }
  }
}

function createSnapshotVersionErrorCause(
  reason: "invalid" | "unsupported",
  snapshotVersion: unknown
): Record<string, unknown> {
  return {
    field: SNAPSHOT_VERSION_FIELD,
    reason,
    received_type: Array.isArray(snapshotVersion) ? "array" : typeof snapshotVersion,
    supported_versions: [CURRENT_SNAPSHOT_VERSION],
    ...(typeof snapshotVersion === "number" && Number.isSafeInteger(snapshotVersion)
      ? { received_version: snapshotVersion }
      : {})
  };
}

function assertSupportedSnapshotVersion(
  snapshotVersion: unknown,
  snapshotPath: string
): asserts snapshotVersion is typeof CURRENT_SNAPSHOT_VERSION {
  if (
    typeof snapshotVersion !== "number" ||
    !Number.isSafeInteger(snapshotVersion) ||
    snapshotVersion <= 0
  ) {
    throw new StoreSnapshotError(
      "store_snapshot_invalid_version",
      snapshotPath,
      createSnapshotVersionErrorCause("invalid", snapshotVersion)
    );
  }

  if (snapshotVersion !== CURRENT_SNAPSHOT_VERSION) {
    throw new StoreSnapshotError(
      "store_snapshot_unsupported_version",
      snapshotPath,
      createSnapshotVersionErrorCause("unsupported", snapshotVersion)
    );
  }
}

function assertSnapshotShape(
  value: unknown,
  snapshotPath: string
): asserts value is SimWarStoreSnapshot {
  const requiredArrayFields: Array<keyof Omit<SimWarStoreSnapshot, "counters">> = [
    "tenants",
    "users",
    "roles",
    "permissions",
    "userRoles",
    "rolePermissions",
    "sessions",
    "scenarios",
    "parameterSets",
    "courses",
    "teams",
    "runs",
    "rounds",
    "decisions",
    "settlementResults",
    "auditLogs"
  ];

  if (!isRecord(value)) {
    throw new StoreSnapshotError("store_snapshot_corrupted", snapshotPath);
  }

  for (const field of requiredArrayFields) {
    if (!Array.isArray(value[field])) {
      throw new StoreSnapshotError("store_snapshot_corrupted", snapshotPath);
    }
  }

  if (!isRecord(value.counters)) {
    throw new StoreSnapshotError("store_snapshot_corrupted", snapshotPath);
  }

  assertSnapshotEntities(value as unknown as SimWarStoreSnapshot, snapshotPath);
}

function toRuntimeSnapshot(value: unknown, snapshotPath: string): SimWarStoreSnapshot {
  if (!isRecord(value)) {
    throw new StoreSnapshotError("store_snapshot_corrupted", snapshotPath);
  }

  if (!Object.prototype.hasOwnProperty.call(value, SNAPSHOT_VERSION_FIELD)) {
    assertSnapshotShape(value, snapshotPath);
    return value;
  }

  assertSupportedSnapshotVersion(value[SNAPSHOT_VERSION_FIELD], snapshotPath);

  const snapshot = { ...value };
  delete snapshot[SNAPSHOT_VERSION_FIELD];

  assertSnapshotShape(snapshot, snapshotPath);
  return snapshot;
}

function createInspectionFailure(
  path: string,
  status: Exclude<SnapshotInspectionStatus, "valid_v1" | "valid_legacy_v0">,
  error: SnapshotInspectionError
): SnapshotInspectionResult {
  return {
    details: [],
    error,
    ok: false,
    path,
    status
  };
}

function createStoreSnapshotInspectionFailure(
  path: string,
  error: StoreSnapshotError
): SnapshotInspectionResult {
  const cause = isRecord(error.cause) ? error.cause : {};
  const safeError: SnapshotInspectionError = {
    kind:
      error.code === "store_snapshot_invalid_version" ||
      error.code === "store_snapshot_unsupported_version"
        ? "version"
        : error.code === "store_snapshot_corrupted"
          ? "validation"
          : "internal",
    message:
      error.code === "store_snapshot_invalid_version"
        ? "Snapshot inspection found an invalid explicit snapshot version"
        : error.code === "store_snapshot_unsupported_version"
          ? "Snapshot inspection found an unsupported snapshot version"
          : error.code === "store_snapshot_corrupted"
            ? "Snapshot inspection failed during validation"
            : "Snapshot inspection failed internally",
    ...(error.code !== "store_snapshot_corrupted" ? { code: error.code } : {})
  };

  if (typeof cause.field === "string") {
    safeError.field = cause.field;
  }
  if (typeof cause.received_type === "string") {
    safeError.received_type = cause.received_type;
  }
  if (typeof cause.received_version === "number" && Number.isSafeInteger(cause.received_version)) {
    safeError.received_version = cause.received_version;
  }
  if (
    Array.isArray(cause.supported_versions) &&
    cause.supported_versions.every((version) => typeof version === "number")
  ) {
    safeError.supported_versions = cause.supported_versions;
  }

  if (error.code === "store_snapshot_invalid_version") {
    return createInspectionFailure(path, "invalid_version", safeError);
  }

  if (error.code === "store_snapshot_unsupported_version") {
    return createInspectionFailure(path, "unsupported_version", safeError);
  }

  if (error.code === "store_snapshot_corrupted") {
    return createInspectionFailure(path, "invalid_snapshot", safeError);
  }

  return createInspectionFailure(path, "internal_error", safeError);
}

export function inspectPersistedSnapshotText(
  rawSnapshot: string,
  snapshotPath = "<inline>"
): SnapshotInspectionResult {
  if (rawSnapshot.trim().length === 0) {
    return createInspectionFailure(snapshotPath, "empty_file", {
      kind: "empty",
      message: "Snapshot inspection found an empty file"
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawSnapshot) as unknown;
  } catch {
    return createInspectionFailure(snapshotPath, "corrupt_json", {
      kind: "parse",
      message: "Snapshot inspection failed during parse"
    });
  }

  try {
    const legacy =
      isRecord(parsed) && !Object.prototype.hasOwnProperty.call(parsed, SNAPSHOT_VERSION_FIELD);
    toRuntimeSnapshot(parsed, snapshotPath);

    if (legacy) {
      return {
        details: [],
        legacy: true,
        ok: true,
        path: snapshotPath,
        snapshot_version: null,
        status: "valid_legacy_v0"
      };
    }

    return {
      details: [],
      legacy: false,
      ok: true,
      path: snapshotPath,
      snapshot_version: CURRENT_SNAPSHOT_VERSION,
      status: "valid_v1"
    };
  } catch (error) {
    if (error instanceof StoreSnapshotError) {
      return createStoreSnapshotInspectionFailure(snapshotPath, error);
    }

    return createInspectionFailure(snapshotPath, "internal_error", {
      kind: "internal",
      message: "Snapshot inspection failed internally"
    });
  }
}

export function inspectPersistedSnapshotFile(snapshotPath: string): SnapshotInspectionResult {
  const absolutePath = resolve(snapshotPath);

  try {
    return inspectPersistedSnapshotText(readFileSync(absolutePath, "utf8"), absolutePath);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return createInspectionFailure(absolutePath, "file_not_found", {
        kind: "read",
        message: "Snapshot inspection could not find the file"
      });
    }

    return createInspectionFailure(absolutePath, "internal_error", {
      kind: "read",
      message: "Snapshot inspection failed while reading the file",
      ...(isNodeError(error) && error.code ? { code: error.code } : {})
    });
  }
}

function createBlockedMigrationPlan(
  inspection: Extract<SnapshotInspectionResult, { ok: false }>,
  targetVersion: typeof CURRENT_SNAPSHOT_VERSION
): SnapshotMigrationDryRunPlan {
  if (inspection.status === "file_not_found") {
    return {
      action: "inspect_before_retry",
      canApplyInFuture: false,
      currentVersion: "unknown",
      reasons: ["Snapshot file was not found."],
      requiresBackupBeforeApply: false,
      safeSummary: { snapshotVersionLabel: "unknown" },
      sourcePath: inspection.path,
      status: "not_found",
      targetVersion
    };
  }

  if (inspection.status === "unsupported_version") {
    return {
      action: "unsupported",
      canApplyInFuture: false,
      currentVersion: inspection.error.received_version ?? "unknown",
      reasons: ["Unsupported future snapshot version."],
      requiresBackupBeforeApply: false,
      safeSummary: {
        snapshotVersionLabel:
          inspection.error.received_version !== undefined
            ? `v${inspection.error.received_version}`
            : "unknown"
      },
      sourcePath: inspection.path,
      status: "blocked",
      targetVersion
    };
  }

  if (inspection.status === "invalid_version") {
    return {
      action: "unsupported",
      canApplyInFuture: false,
      currentVersion: "unknown",
      reasons: ["Invalid explicit snapshot version."],
      requiresBackupBeforeApply: false,
      safeSummary: { snapshotVersionLabel: "unknown" },
      sourcePath: inspection.path,
      status: "blocked",
      targetVersion
    };
  }

  const reason =
    inspection.status === "corrupt_json"
      ? "Snapshot JSON is malformed."
      : inspection.status === "empty_file"
        ? "Snapshot file is empty."
        : inspection.status === "invalid_snapshot"
          ? "Snapshot failed shape or deep entity validation."
          : "Snapshot could not be planned for migration.";

  return {
    action: "inspect_before_retry",
    canApplyInFuture: false,
    currentVersion: "unknown",
    reasons: [reason],
    requiresBackupBeforeApply: false,
    safeSummary: { snapshotVersionLabel: "unknown" },
    sourcePath: inspection.path,
    status: "blocked",
    targetVersion
  };
}

export function planSnapshotMigrationDryRun(
  snapshotPath: string,
  options: SnapshotMigrationDryRunOptions = {}
): SnapshotMigrationDryRunPlan {
  const targetVersion = options.targetVersion ?? CURRENT_SNAPSHOT_VERSION;
  const inspection = inspectPersistedSnapshotFile(snapshotPath);

  if (!inspection.ok) {
    return createBlockedMigrationPlan(inspection, targetVersion);
  }

  if (inspection.status === "valid_legacy_v0") {
    return {
      action: "would_migrate_legacy_to_current",
      canApplyInFuture: true,
      currentVersion: "legacy",
      reasons: ["Legacy v0 snapshot can be migrated by future explicit apply tooling."],
      requiresBackupBeforeApply: true,
      safeSummary: { snapshotVersionLabel: "legacy v0" },
      sourcePath: inspection.path,
      status: "ready",
      targetVersion
    };
  }

  return {
    action: "none",
    canApplyInFuture: false,
    currentVersion: inspection.snapshot_version,
    reasons: ["Snapshot is already at the current version."],
    requiresBackupBeforeApply: false,
    safeSummary: { snapshotVersionLabel: `v${inspection.snapshot_version}` },
    sourcePath: inspection.path,
    status: "already_current",
    targetVersion
  };
}

function countSnapshotEntities(snapshot: SimWarStoreSnapshot): Record<string, number> {
  return Object.fromEntries(
    Object.entries(snapshot)
      .filter(([, value]) => Array.isArray(value))
      .map(([key, value]) => [key, value.length])
  );
}

function createApplyResultFromPlan(
  plan: SnapshotMigrationDryRunPlan
): SnapshotMigrationApplyResult {
  if (plan.status === "already_current") {
    return {
      action: "none",
      afterVersion: CURRENT_SNAPSHOT_VERSION,
      beforeVersion: CURRENT_SNAPSHOT_VERSION,
      canApplyInFuture: false,
      reasons: ["Snapshot is already at the current version."],
      safeSummary: {
        afterSnapshotVersionLabel: `v${CURRENT_SNAPSHOT_VERSION}`,
        beforeSnapshotVersionLabel: plan.safeSummary.snapshotVersionLabel
      },
      sourcePath: plan.sourcePath,
      status: "already_current",
      targetVersion: plan.targetVersion
    };
  }

  if (plan.status === "not_found") {
    return {
      action: "none",
      afterVersion: null,
      beforeVersion: "unknown",
      canApplyInFuture: false,
      reasons: plan.reasons,
      safeSummary: {
        beforeSnapshotVersionLabel: plan.safeSummary.snapshotVersionLabel
      },
      sourcePath: plan.sourcePath,
      status: "not_found",
      targetVersion: plan.targetVersion
    };
  }

  return {
    action: "blocked",
    afterVersion: null,
    beforeVersion: plan.currentVersion,
    canApplyInFuture: false,
    reasons: plan.reasons,
    safeSummary: {
      beforeSnapshotVersionLabel: plan.safeSummary.snapshotVersionLabel
    },
    sourcePath: plan.sourcePath,
    status: "blocked",
    targetVersion: plan.targetVersion
  };
}

function safeSnapshotErrorCode(error: unknown, fallback: string): string {
  return error instanceof StoreSnapshotError ? error.code : fallback;
}

export function applySnapshotMigrationToCurrentVersion(
  snapshotPath: string,
  options: SnapshotMigrationApplyOptions = {}
): SnapshotMigrationApplyResult {
  const plan = planSnapshotMigrationDryRun(snapshotPath);

  if (plan.status !== "ready" || plan.action !== "would_migrate_legacy_to_current") {
    return createApplyResultFromPlan(plan);
  }

  const fileSystem = options.fileSystem ?? nodeSnapshotFileSystem;
  let backup: SnapshotBackupResult;
  const backupOptions: SnapshotBackupOptions = { label: "migration-apply" };
  if (options.backupDirectory !== undefined) {
    backupOptions.backupDirectory = options.backupDirectory;
  }

  try {
    backup = createSnapshotBackupBeforeWrite(plan.sourcePath, backupOptions);
  } catch (error) {
    return {
      action: "blocked",
      afterVersion: null,
      beforeVersion: "legacy",
      canApplyInFuture: false,
      error: { code: safeSnapshotErrorCode(error, "store_snapshot_backup_failed") },
      reasons: ["Backup-before-write failed; source snapshot was not modified."],
      safeSummary: {
        beforeSnapshotVersionLabel: plan.safeSummary.snapshotVersionLabel
      },
      sourcePath: plan.sourcePath,
      status: "backup_failed",
      targetVersion: plan.targetVersion
    };
  }

  let rawSource: string;
  try {
    rawSource = fileSystem.readFile(plan.sourcePath);
  } catch (error) {
    return {
      action: "blocked",
      afterVersion: null,
      backupBytes: backup.bytes,
      backupPath: backup.backupPath,
      beforeVersion: "legacy",
      canApplyInFuture: false,
      error: { code: safeSnapshotErrorCode(error, "store_snapshot_read_failed") },
      reasons: ["Snapshot could not be reread after backup; write-back was not attempted."],
      safeSummary: {
        beforeSnapshotVersionLabel: plan.safeSummary.snapshotVersionLabel
      },
      sourcePath: plan.sourcePath,
      status: "blocked",
      targetVersion: plan.targetVersion
    };
  }

  const secondInspection = inspectPersistedSnapshotText(rawSource, plan.sourcePath);
  if (!secondInspection.ok || secondInspection.status !== "valid_legacy_v0") {
    return {
      action: "blocked",
      afterVersion: null,
      backupBytes: backup.bytes,
      backupPath: backup.backupPath,
      beforeVersion: "unknown",
      canApplyInFuture: false,
      reasons: ["Snapshot changed after backup and is no longer a valid legacy v0 candidate."],
      safeSummary: {
        beforeSnapshotVersionLabel: "unknown"
      },
      sourceBytesBefore: Buffer.byteLength(rawSource),
      sourcePath: plan.sourcePath,
      status: "blocked",
      targetVersion: plan.targetVersion
    };
  }

  let runtimeSnapshot: SimWarStoreSnapshot;
  try {
    runtimeSnapshot = normalizeSnapshot(
      toRuntimeSnapshot(JSON.parse(rawSource) as unknown, plan.sourcePath)
    );
  } catch (error) {
    return {
      action: "blocked",
      afterVersion: null,
      backupBytes: backup.bytes,
      backupPath: backup.backupPath,
      beforeVersion: "unknown",
      canApplyInFuture: false,
      error: { code: safeSnapshotErrorCode(error, "store_snapshot_corrupted") },
      reasons: ["Snapshot validation failed after backup; write-back was not attempted."],
      safeSummary: {
        beforeSnapshotVersionLabel: "unknown"
      },
      sourceBytesBefore: Buffer.byteLength(rawSource),
      sourcePath: plan.sourcePath,
      status: "blocked",
      targetVersion: plan.targetVersion
    };
  }

  const migratedSnapshot = `${JSON.stringify(toPersistedSnapshot(runtimeSnapshot), null, 2)}\n`;

  try {
    persistSnapshotAtomically(plan.sourcePath, migratedSnapshot, fileSystem);
  } catch (error) {
    return {
      action: "blocked",
      afterVersion: null,
      backupBytes: backup.bytes,
      backupPath: backup.backupPath,
      beforeVersion: "legacy",
      canApplyInFuture: false,
      error: { code: safeSnapshotErrorCode(error, "store_snapshot_write_failed") },
      reasons: ["Atomic write-back failed after backup; no rollback was attempted."],
      safeSummary: {
        beforeSnapshotVersionLabel: plan.safeSummary.snapshotVersionLabel,
        entityCounts: countSnapshotEntities(runtimeSnapshot)
      },
      sourceBytesBefore: Buffer.byteLength(rawSource),
      sourcePath: plan.sourcePath,
      status: "write_failed",
      targetVersion: plan.targetVersion
    };
  }

  const postInspection = inspectPersistedSnapshotFile(plan.sourcePath);
  let sourceBytesAfter: number | undefined;
  try {
    sourceBytesAfter = Buffer.byteLength(fileSystem.readFile(plan.sourcePath));
  } catch {
    sourceBytesAfter = undefined;
  }

  if (!postInspection.ok || postInspection.status !== "valid_v1") {
    return {
      action: "blocked",
      afterVersion: "unknown",
      backupBytes: backup.bytes,
      backupPath: backup.backupPath,
      beforeVersion: "legacy",
      canApplyInFuture: false,
      reasons: [
        "Post-write validation failed; backup path is available for future recovery tooling."
      ],
      safeSummary: {
        beforeSnapshotVersionLabel: plan.safeSummary.snapshotVersionLabel,
        entityCounts: countSnapshotEntities(runtimeSnapshot)
      },
      sourceBytesAfter,
      sourceBytesBefore: Buffer.byteLength(rawSource),
      sourcePath: plan.sourcePath,
      status: "post_write_validation_failed",
      targetVersion: plan.targetVersion
    };
  }

  return {
    action: "migrated_legacy_to_current",
    afterVersion: CURRENT_SNAPSHOT_VERSION,
    backupBytes: backup.bytes,
    backupPath: backup.backupPath,
    beforeVersion: "legacy",
    canApplyInFuture: false,
    reasons: ["Legacy v0 snapshot was migrated to the current snapshot version."],
    safeSummary: {
      afterSnapshotVersionLabel: `v${CURRENT_SNAPSHOT_VERSION}`,
      beforeSnapshotVersionLabel: plan.safeSummary.snapshotVersionLabel,
      entityCounts: countSnapshotEntities(runtimeSnapshot)
    },
    sourceBytesAfter,
    sourceBytesBefore: Buffer.byteLength(rawSource),
    sourcePath: plan.sourcePath,
    status: "applied",
    targetVersion: plan.targetVersion
  };
}

function snapshotInspectionVersion(
  inspection: Extract<SnapshotInspectionResult, { ok: true }>
): typeof CURRENT_SNAPSHOT_VERSION | "legacy" {
  return inspection.status === "valid_legacy_v0" ? "legacy" : inspection.snapshot_version;
}

function snapshotInspectionVersionLabel(inspection: SnapshotInspectionResult): string {
  if (!inspection.ok) {
    if (
      inspection.status === "unsupported_version" &&
      inspection.error.received_version !== undefined
    ) {
      return `v${inspection.error.received_version}`;
    }

    return "unknown";
  }

  return inspection.status === "valid_legacy_v0" ? "legacy v0" : `v${inspection.snapshot_version}`;
}

export function restoreSnapshotFromBackup(
  backupPath: string,
  targetPath: string,
  options: SnapshotRestoreFromBackupOptions = {}
): SnapshotRestoreFromBackupResult {
  const absoluteBackupPath = resolve(backupPath);
  const absoluteTargetPath = resolve(targetPath);
  const fileSystem = options.fileSystem ?? nodeSnapshotFileSystem;
  const targetExistedBeforeRestore = existsSync(absoluteTargetPath);
  const backupInspection = inspectPersistedSnapshotFile(absoluteBackupPath);

  if (!backupInspection.ok) {
    return {
      action: "blocked",
      backupPath: absoluteBackupPath,
      backupSnapshotVersion:
        backupInspection.status === "unsupported_version" &&
        backupInspection.error.received_version !== undefined
          ? backupInspection.error.received_version
          : "unknown",
      preRestoreBackupPath: null,
      reasons: [
        backupInspection.status === "file_not_found"
          ? "Backup snapshot file was not found; target was not modified."
          : `Backup snapshot is ${backupInspection.status}; target was not modified.`
      ],
      restoredVersion: null,
      safeSummary: {
        backupSnapshotVersionLabel: snapshotInspectionVersionLabel(backupInspection)
      },
      status: backupInspection.status === "file_not_found" ? "backup_not_found" : "blocked",
      targetExistedBeforeRestore,
      targetPath: absoluteTargetPath
    };
  }

  let rawBackup: string;
  try {
    rawBackup = fileSystem.readFile(absoluteBackupPath);
  } catch (error) {
    return {
      action: "blocked",
      backupPath: absoluteBackupPath,
      backupSnapshotVersion: snapshotInspectionVersion(backupInspection),
      error: { code: safeSnapshotErrorCode(error, "store_snapshot_read_failed") },
      preRestoreBackupPath: null,
      reasons: ["Backup snapshot could not be reread; target was not modified."],
      restoredVersion: null,
      safeSummary: {
        backupSnapshotVersionLabel: snapshotInspectionVersionLabel(backupInspection)
      },
      status: "blocked",
      targetExistedBeforeRestore,
      targetPath: absoluteTargetPath
    };
  }

  let runtimeSnapshot: SimWarStoreSnapshot;
  try {
    runtimeSnapshot = normalizeSnapshot(
      toRuntimeSnapshot(JSON.parse(rawBackup) as unknown, absoluteBackupPath)
    );
  } catch (error) {
    return {
      action: "blocked",
      backupBytes: Buffer.byteLength(rawBackup),
      backupPath: absoluteBackupPath,
      backupSnapshotVersion: "unknown",
      error: { code: safeSnapshotErrorCode(error, "store_snapshot_corrupted") },
      preRestoreBackupPath: null,
      reasons: ["Backup snapshot validation failed; target was not modified."],
      restoredVersion: null,
      safeSummary: {
        backupSnapshotVersionLabel: "unknown"
      },
      status: "blocked",
      targetExistedBeforeRestore,
      targetPath: absoluteTargetPath
    };
  }

  let preRestoreBackup: SnapshotBackupResult | undefined;
  if (targetExistedBeforeRestore) {
    const backupOptions: SnapshotBackupOptions = { label: "restore" };
    if (options.preRestoreBackupDirectory !== undefined) {
      backupOptions.backupDirectory = options.preRestoreBackupDirectory;
    }

    try {
      preRestoreBackup = createSnapshotBackupBeforeWrite(absoluteTargetPath, backupOptions);
    } catch (error) {
      return {
        action: "blocked",
        backupBytes: Buffer.byteLength(rawBackup),
        backupPath: absoluteBackupPath,
        backupSnapshotVersion: snapshotInspectionVersion(backupInspection),
        error: { code: safeSnapshotErrorCode(error, "store_snapshot_backup_failed") },
        preRestoreBackupPath: null,
        reasons: ["Pre-restore backup failed; target was not modified."],
        restoredVersion: null,
        safeSummary: {
          backupSnapshotVersionLabel: snapshotInspectionVersionLabel(backupInspection),
          entityCounts: countSnapshotEntities(runtimeSnapshot)
        },
        status: "pre_restore_backup_failed",
        targetExistedBeforeRestore,
        targetPath: absoluteTargetPath
      };
    }
  }

  const restoredSnapshot = `${JSON.stringify(toPersistedSnapshot(runtimeSnapshot), null, 2)}\n`;

  try {
    persistSnapshotAtomically(absoluteTargetPath, restoredSnapshot, fileSystem);
  } catch (error) {
    return {
      action: "blocked",
      backupBytes: Buffer.byteLength(rawBackup),
      backupPath: absoluteBackupPath,
      backupSnapshotVersion: snapshotInspectionVersion(backupInspection),
      error: { code: safeSnapshotErrorCode(error, "store_snapshot_write_failed") },
      preRestoreBackupBytes: preRestoreBackup?.bytes,
      preRestoreBackupPath: preRestoreBackup?.backupPath ?? null,
      reasons: ["Atomic restore write-back failed; no rollback was attempted."],
      restoredVersion: null,
      safeSummary: {
        backupSnapshotVersionLabel: snapshotInspectionVersionLabel(backupInspection),
        entityCounts: countSnapshotEntities(runtimeSnapshot)
      },
      status: "write_failed",
      targetExistedBeforeRestore,
      targetPath: absoluteTargetPath
    };
  }

  const postInspection = inspectPersistedSnapshotFile(absoluteTargetPath);
  let targetBytesAfter: number | undefined;
  try {
    targetBytesAfter = Buffer.byteLength(fileSystem.readFile(absoluteTargetPath));
  } catch {
    targetBytesAfter = undefined;
  }

  if (!postInspection.ok || postInspection.status !== "valid_v1") {
    return {
      action: "blocked",
      backupBytes: Buffer.byteLength(rawBackup),
      backupPath: absoluteBackupPath,
      backupSnapshotVersion: snapshotInspectionVersion(backupInspection),
      preRestoreBackupBytes: preRestoreBackup?.bytes,
      preRestoreBackupPath: preRestoreBackup?.backupPath ?? null,
      reasons: [
        "Post-restore validation failed; pre-restore backup path is available for manual operator review."
      ],
      restoredVersion: "unknown",
      safeSummary: {
        backupSnapshotVersionLabel: snapshotInspectionVersionLabel(backupInspection),
        entityCounts: countSnapshotEntities(runtimeSnapshot)
      },
      status: "post_restore_validation_failed",
      targetBytesAfter,
      targetExistedBeforeRestore,
      targetPath: absoluteTargetPath
    };
  }

  return {
    action: "restored_backup_to_target",
    backupBytes: Buffer.byteLength(rawBackup),
    backupPath: absoluteBackupPath,
    backupSnapshotVersion: snapshotInspectionVersion(backupInspection),
    preRestoreBackupBytes: preRestoreBackup?.bytes,
    preRestoreBackupPath: preRestoreBackup?.backupPath ?? null,
    reasons: ["Backup snapshot was restored to the target snapshot file."],
    restoredVersion: CURRENT_SNAPSHOT_VERSION,
    safeSummary: {
      backupSnapshotVersionLabel: snapshotInspectionVersionLabel(backupInspection),
      entityCounts: countSnapshotEntities(runtimeSnapshot),
      restoredSnapshotVersionLabel: `v${CURRENT_SNAPSHOT_VERSION}`
    },
    status: "restored",
    targetBytesAfter,
    targetExistedBeforeRestore,
    targetPath: absoluteTargetPath
  };
}

function formatSnapshotBackupTimestamp(createdAt: string): string {
  return createdAt.replace(/[^0-9A-Za-z-]/g, "-");
}

function sanitizeSnapshotBackupLabel(label?: string): string | undefined {
  if (!label) {
    return undefined;
  }

  const sanitized = label
    .trim()
    .replace(/[^0-9A-Za-z._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return sanitized.length > 0 ? sanitized : undefined;
}

export function createSnapshotBackupBeforeWrite(
  snapshotPath: string,
  options: SnapshotBackupOptions = {}
): SnapshotBackupResult {
  const absoluteSourcePath = resolve(snapshotPath);
  const backupDirectory = resolve(
    options.backupDirectory ?? join(dirname(absoluteSourcePath), ".snapshot-backups")
  );
  const createdAt = new Date().toISOString();
  const label = sanitizeSnapshotBackupLabel(options.label);
  const backupFileName = [
    basename(absoluteSourcePath),
    formatSnapshotBackupTimestamp(createdAt),
    ...(label ? [label] : []),
    randomUUID(),
    "bak"
  ].join(".");
  const backupPath = join(backupDirectory, backupFileName);
  let backupDescriptor: number | undefined;
  let rawSnapshot: Buffer;

  try {
    rawSnapshot = readFileSync(absoluteSourcePath);
  } catch (error) {
    throw new StoreSnapshotError("store_snapshot_backup_failed", absoluteSourcePath, error);
  }

  try {
    mkdirSync(backupDirectory, { recursive: true });
    backupDescriptor = openSync(backupPath, "wx", 0o600);
    writeFileSync(backupDescriptor, rawSnapshot);
    fsyncSync(backupDescriptor);
    closeSync(backupDescriptor);
    backupDescriptor = undefined;
  } catch (error) {
    if (backupDescriptor !== undefined) {
      try {
        closeSync(backupDescriptor);
      } catch {
        // Preserve the original failure; closing a failed backup handle is best-effort.
      }
    }

    throw new StoreSnapshotError("store_snapshot_backup_failed", absoluteSourcePath, error);
  }

  return {
    backupPath,
    bytes: rawSnapshot.byteLength,
    createdAt,
    sourcePath: absoluteSourcePath
  };
}

function loadSnapshot(
  absolutePath: string,
  fileSystem: SnapshotFileSystem
): SimWarStoreSnapshot | undefined {
  let rawSnapshot: string;

  try {
    rawSnapshot = fileSystem.readFile(absolutePath);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }

    throw new StoreSnapshotError("store_snapshot_read_failed", absolutePath, error);
  }

  try {
    const parsed = JSON.parse(rawSnapshot) as unknown;
    return normalizeSnapshot(toRuntimeSnapshot(parsed, absolutePath));
  } catch (error) {
    if (error instanceof StoreSnapshotError) {
      throw error;
    }

    throw new StoreSnapshotError("store_snapshot_corrupted", absolutePath, error);
  }
}

function cleanupTempFile(path: string, fileSystem: SnapshotFileSystem): void {
  try {
    fileSystem.unlink(path);
  } catch {
    // Best effort: preserve the authoritative snapshot even when temp cleanup fails.
  }
}

function syncDirectoryBestEffort(path: string, fileSystem: SnapshotFileSystem): void {
  let directoryDescriptor: number | undefined;

  try {
    directoryDescriptor = fileSystem.open(path, "r");
    fileSystem.fsync(directoryDescriptor);
  } catch {
    // Directory fsync is best-effort because Windows commonly rejects directory handles.
  } finally {
    if (directoryDescriptor !== undefined) {
      try {
        fileSystem.close(directoryDescriptor);
      } catch {
        // Closing a best-effort directory handle must not turn a completed rename into failure.
      }
    }
  }
}

function closeTempFile(
  tempFileDescriptor: number | undefined,
  snapshotPath: string,
  fileSystem: SnapshotFileSystem
): number | undefined {
  if (tempFileDescriptor === undefined) {
    return undefined;
  }

  try {
    fileSystem.close(tempFileDescriptor);
    return undefined;
  } catch (error) {
    throw new StoreSnapshotError("store_snapshot_sync_failed", snapshotPath, error);
  }
}

function persistSnapshotAtomically(
  absolutePath: string,
  contents: string,
  fileSystem: SnapshotFileSystem
): void {
  const targetDirectory = dirname(absolutePath);
  const tempPath = join(
    targetDirectory,
    `${basename(absolutePath)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`
  );
  let tempFileDescriptor: number | undefined;
  let tempFileCreated = false;

  try {
    fileSystem.mkdir(targetDirectory);
  } catch (error) {
    throw new StoreSnapshotError("store_snapshot_write_failed", absolutePath, error);
  }

  try {
    try {
      tempFileDescriptor = fileSystem.open(tempPath, "wx", 0o600);
      tempFileCreated = true;
      fileSystem.writeFile(tempFileDescriptor, contents);
    } catch (error) {
      throw new StoreSnapshotError("store_snapshot_write_failed", absolutePath, error);
    }

    try {
      fileSystem.fsync(tempFileDescriptor);
      tempFileDescriptor = closeTempFile(tempFileDescriptor, absolutePath, fileSystem);
    } catch (error) {
      if (error instanceof StoreSnapshotError) {
        throw error;
      }

      throw new StoreSnapshotError("store_snapshot_sync_failed", absolutePath, error);
    }

    try {
      fileSystem.rename(tempPath, absolutePath);
      tempFileCreated = false;
    } catch (error) {
      throw new StoreSnapshotError("store_snapshot_rename_failed", absolutePath, error);
    }

    syncDirectoryBestEffort(targetDirectory, fileSystem);
  } catch (error) {
    if (tempFileDescriptor !== undefined) {
      try {
        fileSystem.close(tempFileDescriptor);
      } catch {
        // Keep the original failure as the observable cause.
      }
    }

    if (tempFileCreated) {
      cleanupTempFile(tempPath, fileSystem);
    }

    throw error;
  }
}

export function createP1Store(options: CreateStoreOptions = {}): SimWarStore {
  const fileSystem = options.fileSystem ?? nodeSnapshotFileSystem;
  const absolutePath = options.persistenceFile ? resolve(options.persistenceFile) : undefined;
  const loadedSnapshot = absolutePath ? loadSnapshot(absolutePath, fileSystem) : undefined;
  const snapshot = loadedSnapshot ?? createSeedSnapshot();

  const store: SimWarStore = {
    ...snapshot,
    ...(absolutePath ? { persistenceFile: absolutePath } : {}),
    persist: () => {
      if (!absolutePath) {
        return;
      }

      const snapshotJson = `${JSON.stringify(toPersistedSnapshot(toSnapshot(store)), null, 2)}\n`;
      persistSnapshotAtomically(absolutePath, snapshotJson, fileSystem);
    }
  };

  if (absolutePath && !loadedSnapshot) {
    store.persist();
  }

  return store;
}

export function createP0Store(options: CreateStoreOptions = {}): SimWarStore {
  return createP1Store(options);
}

export function nextId(
  store: SimWarStore,
  key: keyof SimWarStore["counters"] | string,
  prefix: string
): string {
  store.counters[key] = (store.counters[key] ?? 0) + 1;
  return `${prefix}_${store.counters[key].toString().padStart(3, "0")}`;
}

export function sanitizeUser(user: StoredUser): User {
  return {
    user_id: user.user_id,
    tenant_id: user.tenant_id,
    username: user.username,
    email: user.email,
    display_name: user.display_name,
    roles: user.roles,
    permissions: user.permissions ?? getRolePermissions(user.roles),
    status: user.status,
    created_at: user.created_at,
    updated_at: user.updated_at,
    ...(user.team_id ? { team_id: user.team_id } : {})
  };
}

export function toCurrentUser(user: StoredUser): CurrentUser {
  const userRoleNames = getUserRoles({ user_id: user.user_id, fallbackRoles: user.roles });

  return {
    user_id: user.user_id,
    tenant_id: user.tenant_id,
    display_name: user.display_name,
    roles: userRoleNames,
    permissions: getRolePermissions(userRoleNames),
    ...(user.team_id ? { team_id: user.team_id } : {})
  };
}

function getUserRoles(input: {
  user_id: string;
  store?: SimWarStore;
  fallbackRoles?: ActorRole[];
}): ActorRole[] {
  if (!input.store) {
    return input.fallbackRoles ?? [];
  }

  const roles = input.store.userRoles
    .filter((userRole) => userRole.user_id === input.user_id)
    .map((userRole) => input.store?.roles.find((role) => role.role_id === userRole.role_id)?.name)
    .filter((role): role is ActorRole => Boolean(role));

  return roles.length > 0 ? roles : (input.fallbackRoles ?? []);
}

export function getActorFromUser(store: SimWarStore, user: StoredUser): CurrentUser {
  const roles = getUserRoles({ user_id: user.user_id, store, fallbackRoles: user.roles });

  return {
    user_id: user.user_id,
    tenant_id: user.tenant_id,
    display_name: user.display_name,
    roles,
    permissions: getRolePermissions(roles),
    ...(user.team_id ? { team_id: user.team_id } : {})
  };
}

export function setUserRoles(store: SimWarStore, user: StoredUser, roles: ActorRole[]): void {
  const allowedRoles = roles.filter((role) =>
    store.roles.some((candidate) => candidate.name === role)
  );

  store.userRoles = store.userRoles.filter((userRole) => userRole.user_id !== user.user_id);
  store.userRoles.push(
    ...allowedRoles.map((role) => ({
      user_id: user.user_id,
      role_id: `role_${role}`,
      tenant_id: user.tenant_id
    }))
  );
  user.roles = allowedRoles;
  user.permissions = getRolePermissions(allowedRoles);
  user.updated_at = new Date().toISOString();
}

export function actorHasAnyRole(actor: CurrentUser, allowedRoles: ActorRole[]): boolean {
  return actor.roles.some((role) => allowedRoles.includes(role));
}

export function appendAudit(
  store: SimWarStore,
  input: {
    actor: CurrentUser;
    action: string;
    resourceType: string;
    resourceId: string;
    requestId: string;
    tenantId?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  }
): AuditLog {
  const log: AuditLog = {
    audit_id: nextId(store, "audit", "audit"),
    tenant_id: input.tenantId ?? input.actor.tenant_id,
    actor_id: input.actor.user_id,
    actor_role: input.actor.roles[0] ?? "learner",
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId,
    request_id: input.requestId,
    created_at: new Date().toISOString(),
    ...(input.before ? { before: input.before } : {}),
    ...(input.after ? { after: input.after } : {})
  };

  store.auditLogs.push(log);
  store.persist();
  return log;
}
