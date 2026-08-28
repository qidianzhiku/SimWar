export interface TeacherTeamIdentity {
  team_id: string;
}

export function resolveActiveTeacherTeamId(
  teams: readonly TeacherTeamIdentity[],
  selectedTeamId?: string | null,
  persistedTeamId?: string | null
): string {
  const availableTeamIds = new Set(teams.map((team) => team.team_id));
  return (
    [selectedTeamId, persistedTeamId].find(
      (teamId): teamId is string => Boolean(teamId && availableTeamIds.has(teamId))
    ) ?? teams[0]?.team_id ?? ""
  );
}
