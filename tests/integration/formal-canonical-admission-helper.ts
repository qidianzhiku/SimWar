import type { RoleId } from "../../packages/shared-contracts/src";
import { createJsonRepositoryPorts } from "../../services/api/src/json-repository-adapter";
import { RoleWorkflowCommandService } from "../../services/api/src/role-workflow";
import type { SimWarStore } from "../../services/api/src/store";

/**
 * Builds the formal role-workflow admission required by a FormalRun.
 *
 * These golden journeys intentionally exercise the business writer instead of
 * bypassing it with the compatibility Decision POST route.
 */
export async function createFormalCanonicalDecision(
  store: SimWarStore,
  runId: string,
  teamId: string,
  ceoUserId: string
): Promise<void> {
  const run = store.runs.find((candidate) => candidate.run_id === runId);
  const round = store.rounds.find(
    (candidate) => candidate.run_id === runId && candidate.round_no === 1
  );
  const team = store.teams.find((candidate) => candidate.team_id === teamId);
  if (!run || !round || !team) throw new Error("formal workflow fixture missing");

  const roleMembers = [
    [ceoUserId, "CEO"],
    [`${runId}_cfo`, "CFO"],
    [`${runId}_cmo`, "CMO"],
    [`${runId}_coo`, "COO"]
  ] as const;
  const ceoMember = team.members.find((member) => member.user_id === ceoUserId) ?? {
    display_name: "CEO",
    role_slot: "CEO" as const,
    user_id: ceoUserId
  };
  team.members = [
    ceoMember,
    ...roleMembers.slice(1).map(([user_id, role_slot]) => ({
      display_name: role_slot,
      role_slot,
      user_id
    }))
  ];
  team.captain_user_id = ceoUserId;

  let id = 0;
  const workflow = new RoleWorkflowCommandService(createJsonRepositoryPorts(store).roleWorkflow, {
    createId: (kind) => `${kind}_${runId}_${++id}`,
    now: () => "2026-08-16T05:00:00.000Z"
  });
  const teacher = {
    actor_id: "usr_teacher",
    actor_role: "teacher" as const,
    tenant_id: run.tenant_id
  };
  const actors = new Map<string, { actor_id: string; actor_role: "student"; tenant_id: string }>([
    ["CEO", { actor_id: ceoUserId, actor_role: "student", tenant_id: run.tenant_id }],
    ["CFO", { actor_id: `${runId}_cfo`, actor_role: "student", tenant_id: run.tenant_id }],
    ["CMO", { actor_id: `${runId}_cmo`, actor_role: "student", tenant_id: run.tenant_id }],
    ["COO", { actor_id: `${runId}_coo`, actor_role: "student", tenant_id: run.tenant_id }]
  ]);
  const payloads: Record<RoleId, Record<string, unknown>> = {
    CEO: { strategy_statement: "Formal role workflow canonical plan." },
    CFO: { cash_buffer_target: 0.16, service_quality_budget: 160000 },
    CMO: { marketing_budget: 180000, pricing: { base_price: 12800 } },
    COO: { capacity_plan: "expand" }
  };

  for (const [user_id, role_key] of roleMembers) {
    await workflow.assignRole(teacher, {
      course_id: run.course_id,
      role_key: role_key as RoleId,
      run_id: run.run_id,
      team_id: team.team_id,
      user_id
    });
    const actor = actors.get(role_key)!;
    const section = await workflow.saveSection(actor, {
      expected_version: 0,
      payload: payloads[role_key as RoleId],
      round_id: round.round_id,
      run_id: run.run_id,
      team_id: team.team_id
    });
    await workflow.markSectionReady(actor, {
      expected_version: section.version,
      round_id: round.round_id,
      run_id: run.run_id,
      team_id: team.team_id
    });
  }

  const ceo = actors.get("CEO")!;
  const merge = await workflow.createMergeCommit(ceo, {
    round_id: round.round_id,
    run_id: run.run_id,
    team_id: team.team_id
  });
  await workflow.confirmTeamDecision(ceo, {
    merge_commit_id: merge.merge_commit_id,
    round_id: round.round_id,
    run_id: run.run_id,
    team_id: team.team_id
  });
}
