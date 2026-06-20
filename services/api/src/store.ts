import {
  closeSync,
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
    assertSnapshotShape(parsed, absolutePath);
    return normalizeSnapshot(parsed);
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

      const snapshotJson = `${JSON.stringify(toSnapshot(store), null, 2)}\n`;
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
