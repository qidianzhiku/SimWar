import { hashPassword } from "../../services/api/src/auth";
import { createP1Store } from "../../services/api/src/store";

export const ROLE_WORKFLOW_FIXTURE_COUNT = 3;

export function roleWorkflowTeamId(index: number): string {
  return `team_role_workflow_browser_${index}`;
}

export function roleWorkflowUsers(index: number) {
  return [
    [`role_ceo_browser_${index}`, "CEO"],
    [`role_cfo_browser_${index}`, "CFO"],
    [`role_cmo_browser_${index}`, "CMO"],
    [`role_coo_browser_${index}`, "COO"],
    [`role_chro_browser_${index}`, "CHRO"]
  ] as const;
}

export function seedRoleWorkflowFixture(storeFile: string): void {
  const store = createP1Store({ persistenceFile: storeFile });
  if (
    store.teams.some((team) => team.team_id.startsWith("team_role_workflow_browser_")) ||
    store.users.some((user) => user.username.startsWith("role_ceo_browser_"))
  ) {
    throw new Error("Role Workflow fixture must be seeded into a freshly reset store.");
  }

  for (let index = 0; index < ROLE_WORKFLOW_FIXTURE_COUNT; index += 1) {
    const users = roleWorkflowUsers(index);
    const teamId = roleWorkflowTeamId(index);
    for (const [username, role] of users) {
      store.users.push({
        created_at: "2026-07-31T03:00:00.000Z",
        display_name: `Browser ${role} ${index}`,
        email: `${username}@demo.simwar.local`,
        password_hash: hashPassword(username),
        roles: role === "CEO" ? ["learner", "team_captain"] : ["learner"],
        status: "active",
        team_id: teamId,
        tenant_id: "tenant_demo",
        updated_at: "2026-07-31T03:00:00.000Z",
        user_id: username,
        username
      });
    }

    store.teams.push({
      captain_user_id: users[0][0],
      course_id: "course_demo",
      members: users.map(([user_id, role_slot]) => ({
        display_name: `Browser ${role_slot} ${index}`,
        role_slot,
        user_id
      })),
      name: `Role Workflow Browser Team ${index}`,
      team_id: teamId,
      tenant_id: "tenant_demo"
    });
  }
  store.persist();
}
