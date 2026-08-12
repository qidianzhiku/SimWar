import type {
  FreshLearnerAdmissionReadiness,
  FreshLearnerAdmissionTeamReadiness,
  RoleId,
  StudentRoleAssignment,
  Team
} from "@simwar/shared-contracts";
import { FRESH_LEARNER_ADMISSION_REQUIRED_ROLES } from "@simwar/shared-contracts";

export interface FreshLearnerAdmissionTeamInput {
  team: Pick<Team, "team_id" | "name" | "captain_user_id" | "members">;
  users: Array<{ user_id: string; status: string | undefined }>;
  assignments: Array<Pick<StudentRoleAssignment, "role_key" | "status" | "user_id">>;
}

export interface FreshLearnerAdmissionInput {
  tenant_id: string;
  course_id: string;
  run_id: string;
  teacher_ready: boolean;
  teams: FreshLearnerAdmissionTeamInput[];
}

const requiredRoles = [...FRESH_LEARNER_ADMISSION_REQUIRED_ROLES];

function roleCounts(values: RoleId[]): Map<RoleId, number> {
  return values.reduce(
    (counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1),
    new Map()
  );
}

function evaluateTeam(input: FreshLearnerAdmissionTeamInput): FreshLearnerAdmissionTeamReadiness {
  const memberRoles = input.team.members
    .map((member) => member.role_slot)
    .filter((role): role is RoleId => requiredRoles.includes(role as RoleId));
  const counts = roleCounts(memberRoles);
  const missingRoles = requiredRoles.filter((role) => !counts.has(role));
  const duplicateRoles = requiredRoles.filter((role) => (counts.get(role) ?? 0) > 1);
  const knownUserIds = new Set(input.users.map((user) => user.user_id));
  const invalidMemberships = input.team.members.flatMap((member) => {
    const user = input.users.find((candidate) => candidate.user_id === member.user_id);
    return [
      ...(knownUserIds.has(member.user_id) ? [] : ["MEMBER_NOT_FOUND"]),
      ...(user?.status === "active" ? [] : ["MEMBER_AUTH_NOT_READY"])
    ];
  });
  const authReadyMemberCount = input.team.members.filter((member) =>
    input.users.some((user) => user.user_id === member.user_id && user.status === "active")
  ).length;
  const assignedRoles = input.assignments
    .filter((assignment) => assignment.status === "active")
    .map((assignment) => assignment.role_key)
    .filter((role): role is RoleId => requiredRoles.includes(role));
  const assignedCounts = roleCounts(assignedRoles);
  const assignedRoleCount = assignedRoles.length;
  const assignmentsComplete =
    assignedRoleCount === requiredRoles.length &&
    requiredRoles.every((role) => assignedCounts.get(role) === 1) &&
    input.team.members.every((member) =>
      input.assignments.some(
        (assignment) =>
          assignment.status === "active" &&
          assignment.user_id === member.user_id &&
          assignment.role_key === member.role_slot
      )
    );
  const ready =
    input.team.members.length === requiredRoles.length &&
    missingRoles.length === 0 &&
    duplicateRoles.length === 0 &&
    invalidMemberships.length === 0 &&
    input.team.captain_user_id ===
      input.team.members.find((member) => member.role_slot === "CEO")?.user_id &&
    authReadyMemberCount === requiredRoles.length &&
    assignmentsComplete;

  return {
    assigned_role_count: assignedRoleCount,
    assigned_roles: assignedRoles,
    auth_ready: authReadyMemberCount === input.team.members.length && input.team.members.length > 0,
    auth_ready_member_count: authReadyMemberCount,
    captain_user_id: input.team.captain_user_id,
    duplicate_roles: duplicateRoles,
    invalid_memberships: [...new Set(invalidMemberships)],
    member_count: input.team.members.length,
    missing_roles: missingRoles,
    ready,
    required_member_count: requiredRoles.length,
    team_id: input.team.team_id,
    team_name: input.team.name
  };
}

export function buildFreshLearnerAdmissionReadiness(
  input: FreshLearnerAdmissionInput
): FreshLearnerAdmissionReadiness {
  const teams = input.teams.map(evaluateTeam);
  const freshLearnerCount = input.teams.reduce(
    (total, team) => total + team.team.members.length,
    0
  );
  const requiredRosterCount = input.teams.length * requiredRoles.length;
  const assignedRosterCount = teams.reduce((total, team) => total + team.assigned_role_count, 0);
  const authReady = teams.length > 0 && teams.every((team) => team.auth_ready);
  const readyForMachine =
    teams.length === 2 && input.teacher_ready && authReady && teams.every((team) => team.ready);

  return {
    admission_status: readyForMachine ? "READY_FOR_MACHINE_E4" : "BLOCKED",
    assigned_roster_count: assignedRosterCount,
    auth_ready: authReady,
    course_id: input.course_id,
    fresh_learner_count: freshLearnerCount,
    known_limits: [
      "JSON_INTERNAL_ONLY",
      "HUMAN_VALIDATION_NOT_PERFORMED",
      "FRESH_IDENTITY_PROOF_REQUIRES_E4_JOURNEY_RECEIPT",
      "DURABLE_RECOVERY_NOT_PROVEN"
    ],
    required_roster_count: requiredRosterCount,
    run_id: input.run_id,
    schema_version: "fresh-learner-admission.v1",
    team_count: teams.length,
    teams,
    teacher_ready: input.teacher_ready,
    tenant_id: input.tenant_id
  };
}
