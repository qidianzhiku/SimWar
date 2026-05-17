import type {
  ActorRole,
  AuditLog,
  Course,
  CurrentUser,
  Decision,
  ParameterSet,
  Round,
  Run,
  ScenarioPackage,
  SettlementResult,
  Team
} from "@simwar/shared-contracts";

export interface StoredUser extends CurrentUser {
  username: string;
  password: string;
}

export interface SimWarStore {
  users: StoredUser[];
  sessions: Map<string, string>;
  scenarios: ScenarioPackage[];
  parameterSets: ParameterSet[];
  courses: Course[];
  teams: Team[];
  runs: Run[];
  rounds: Round[];
  decisions: Decision[];
  settlementResults: SettlementResult[];
  auditLogs: AuditLog[];
  counters: {
    course: number;
    team: number;
    run: number;
    round: number;
    decision: number;
    result: number;
    audit: number;
  };
}

export const DEFAULT_TENANT_ID = "tenant_demo";
export const SERVICE_KERNEL_TOKEN = "service-kernel-token";

export function createP0Store(): SimWarStore {
  const users: StoredUser[] = [
    {
      user_id: "usr_teacher",
      username: "teacher",
      password: "teacher",
      tenant_id: DEFAULT_TENANT_ID,
      display_name: "P0 Teacher",
      roles: ["teacher"]
    },
    {
      user_id: "usr_student",
      username: "student",
      password: "student",
      tenant_id: DEFAULT_TENANT_ID,
      display_name: "P0 Student",
      roles: ["learner", "team_captain"],
      team_id: "team_alpha"
    },
    {
      user_id: "usr_admin",
      username: "admin",
      password: "admin",
      tenant_id: DEFAULT_TENANT_ID,
      display_name: "P0 Admin",
      roles: ["tenant_admin"]
    }
  ];

  const sessions = new Map<string, string>([
    ["teacher-token", "usr_teacher"],
    ["student-token", "usr_student"],
    ["admin-token", "usr_admin"]
  ]);

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
    users,
    sessions,
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
      course: 1,
      team: 1,
      run: 0,
      round: 0,
      decision: 0,
      result: 0,
      audit: 0
    }
  };
}

export function nextId(store: SimWarStore, key: keyof SimWarStore["counters"], prefix: string): string {
  store.counters[key] += 1;
  return `${prefix}_${store.counters[key].toString().padStart(3, "0")}`;
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
  }
): AuditLog {
  const log: AuditLog = {
    audit_id: nextId(store, "audit", "audit"),
    tenant_id: input.actor.tenant_id,
    actor_id: input.actor.user_id,
    actor_role: input.actor.roles[0] ?? "learner",
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId,
    request_id: input.requestId,
    created_at: new Date().toISOString()
  };

  store.auditLogs.push(log);
  return log;
}
