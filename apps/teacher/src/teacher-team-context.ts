import type { W3OfficialConsequenceContext } from "@simwar/shared-contracts";

export interface TeacherTeamIdentity {
  team_id: string;
}

export type TeacherW3Selection = {
  activity_id?: string | undefined;
  course_id: string;
  role_key: string;
  round_id: string;
  round_no: number;
  run_id: string;
  team_id: string;
  tenant_id: string;
};

export function resolveActiveTeacherTeamId(
  teams: readonly TeacherTeamIdentity[],
  selectedTeamId?: string | null,
  persistedTeamId?: string | null
): string {
  const availableTeamIds = new Set(teams.map((team) => team.team_id));
  return (
    [selectedTeamId, persistedTeamId].find((teamId): teamId is string =>
      Boolean(teamId && availableTeamIds.has(teamId))
    ) ??
    teams[0]?.team_id ??
    ""
  );
}

export function buildTeacherW3Context(
  selection: TeacherW3Selection | undefined,
  queryContext?: W3OfficialConsequenceContext | undefined
): W3OfficialConsequenceContext | undefined {
  if (!selection) return queryContext;

  return {
    activity_id: selection.activity_id ?? queryContext?.activity_id ?? "activity_consequence",
    course_id: selection.course_id,
    role_key: selection.role_key,
    round_id: selection.round_id,
    round_no: selection.round_no,
    run_id: selection.run_id,
    team_id: selection.team_id,
    tenant_id: selection.tenant_id
  };
}
