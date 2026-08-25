import { useCallback, useEffect, useState } from "react";
import type {
  ApiEnvelope,
  RoleId,
  StudentRoleAssignment,
  TeacherRoleWorkflowWorkspaceDTO,
  Team
} from "@simwar/shared-contracts";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

interface RoleWorkflowPanelProps {
  active: boolean;
  courseId: string | undefined;
  disabled: boolean;
  initialTeamId?: string | undefined;
  onTeamChange?: (teamId: string) => void;
  roundId: string | undefined;
  runId: string | undefined;
  teams: Team[];
  tenantId: string;
  token: string | undefined;
}

const LEGACY_ROLE_KEYS: RoleId[] = ["CEO", "CFO", "CMO", "COO"];
const W027_ROLE_KEYS: RoleId[] = ["CEO", "CFO", "CMO", "COO", "CHRO"];

async function roleWorkflowRequest<T>(
  path: string,
  props: Pick<RoleWorkflowPanelProps, "tenantId" | "token">,
  options: { body?: unknown; method?: string } = {}
): Promise<T> {
  const init: RequestInit = {
    headers: {
      "content-type": "application/json",
      "x-tenant-id": props.tenantId,
      ...(props.token ? { authorization: `Bearer ${props.token}` } : {})
    },
    method: options.method ?? "GET"
  };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  const response = await fetch(`${API_BASE}${path}`, init);
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
  return envelope.data;
}

export function RoleWorkflowPanel(props: RoleWorkflowPanelProps) {
  const [selectedTeamId, setSelectedTeamId] = useState(
    props.initialTeamId && props.teams.some((team) => team.team_id === props.initialTeamId)
      ? props.initialTeamId
      : (props.teams[0]?.team_id ?? "")
  );
  const [workspace, setWorkspace] = useState<TeacherRoleWorkflowWorkspaceDTO | null>(null);
  const [notice, setNotice] = useState("ready");
  const [busy, setBusy] = useState(false);
  const selectedTeam = props.teams.find((team) => team.team_id === selectedTeamId);
  const teamIdentity = props.teams.map((team) => team.team_id).join("|");
  const teamMembers = (selectedTeam?.members ?? []).filter((member) => member.role_slot !== "risk");
  const requiredRoleKeys = teamMembers.some((member) => member.role_slot === "CHRO")
    ? W027_ROLE_KEYS
    : LEGACY_ROLE_KEYS;
  const roleMemberIds = requiredRoleKeys.flatMap((roleKey) =>
    teamMembers.filter((member) => member.role_slot === roleKey).map((member) => member.user_id)
  );
  const ceoMember = teamMembers.find((member) => member.role_slot === "CEO");
  const teamPreconditionReady = Boolean(
    selectedTeam &&
    requiredRoleKeys.every(
      (roleKey) => teamMembers.filter((member) => member.role_slot === roleKey).length === 1
    ) &&
    new Set(roleMemberIds).size === requiredRoleKeys.length &&
    ceoMember?.user_id === selectedTeam.captain_user_id
  );
  const scopeReady = Boolean(
    props.active && props.token && props.runId && props.roundId && selectedTeam
  );

  useEffect(() => {
    setSelectedTeamId((current) =>
      props.teams.some((team) => team.team_id === current)
        ? current
        : props.initialTeamId && props.teams.some((team) => team.team_id === props.initialTeamId)
          ? props.initialTeamId
          : (props.teams[0]?.team_id ?? "")
    );
  }, [teamIdentity, props.initialTeamId, props.teams]);

  useEffect(() => {
    if (selectedTeamId) props.onTeamChange?.(selectedTeamId);
  }, [props.onTeamChange, selectedTeamId]);

  const refresh = useCallback(async () => {
    if (!props.active || !props.token || !props.runId || !props.roundId || !selectedTeam) {
      setWorkspace(null);
      return;
    }
    try {
      setWorkspace(
        await roleWorkflowRequest<TeacherRoleWorkflowWorkspaceDTO>(
          `/api/v1/bff/teacher/role-workflows?run_id=${encodeURIComponent(
            props.runId
          )}&round_id=${encodeURIComponent(props.roundId)}&team_id=${encodeURIComponent(
            selectedTeam.team_id
          )}`,
          props
        )
      );
      setNotice("current");
    } catch (error) {
      setWorkspace(null);
      setNotice(error instanceof Error ? error.message : "role workflow unavailable");
    }
  }, [props.active, props.roundId, props.runId, props.tenantId, props.token, selectedTeam]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function assignRole(userId: string, roleKey: RoleId): Promise<void> {
    if (!props.courseId || !props.runId || !props.roundId || !selectedTeam) return;
    setBusy(true);
    try {
      await roleWorkflowRequest<StudentRoleAssignment>(
        "/api/v1/bff/teacher/role-workflows/assignments",
        props,
        {
          body: {
            course_id: props.courseId,
            role_key: roleKey,
            run_id: props.runId,
            team_id: selectedTeam.team_id,
            user_id: userId
          },
          method: "PUT"
        }
      );
      setNotice(`${roleKey} assigned`);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "assignment failed");
    } finally {
      setBusy(false);
    }
  }

  async function resetWorkflow(): Promise<void> {
    if (!props.runId || !props.roundId || !selectedTeam) return;
    setBusy(true);
    try {
      await roleWorkflowRequest("/api/v1/bff/teacher/role-workflows/reset", props, {
        body: {
          round_id: props.roundId,
          run_id: props.runId,
          team_id: selectedTeam.team_id
        },
        method: "POST"
      });
      setNotice("workflow reset");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="role-workflow-panel" aria-label="Role workflow monitor">
      <div className="panel-title">
        <div>
          <p className="eyebrow">C3 Role Workflow</p>
          <h2>角色协作进度</h2>
        </div>
        <span>{notice}</span>
      </div>
      {!scopeReady ? (
        <p className="muted">创建并开启 Run 后可分配角色。</p>
      ) : (
        <>
          <label className="role-workflow-team-selector">
            <span>Team</span>
            <select
              aria-label="角色流程队伍"
              disabled={busy || props.disabled}
              onChange={(event) => setSelectedTeamId(event.target.value)}
              value={selectedTeamId}
            >
              {props.teams.map((team) => (
                <option key={team.team_id} value={team.team_id}>
                  {team.name} · {team.team_id}
                </option>
              ))}
            </select>
          </label>
          <div className="role-workflow-list">
            {teamMembers.map((member) => {
              const assignment = workspace?.assignments.find(
                (candidate) => candidate.user_id === member.user_id
              );
              const summary = workspace?.section_summaries.find(
                (candidate) => candidate.role_key === member.role_slot
              );
              return (
                <div className="role-workflow-row" key={member.user_id}>
                  <span>
                    {member.display_name} · {member.role_slot}
                  </span>
                  {assignment ? (
                    <strong>
                      {assignment.role_key} ·{" "}
                      {summary?.status === "missing"
                        ? "draft pending"
                        : `${summary?.status ?? "draft pending"} v${summary?.version ?? 0}`}
                    </strong>
                  ) : (
                    <button
                      disabled={busy || props.disabled || !teamPreconditionReady}
                      onClick={() => void assignRole(member.user_id, member.role_slot as RoleId)}
                    >
                      分配 {member.role_slot}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {workspace?.divergence_summary ? (
            <div className="decision-trace" aria-label="团队分歧只读摘要">
              <div className="panel-title">
                <div>
                  <p className="eyebrow">Divergence evidence</p>
                  <h3>团队分歧摘要</h3>
                </div>
                <span role="status">{workspace.divergence_summary.status}</span>
              </div>
              <p>
                分歧 {workspace.divergence_summary.divergence_count} 项 · 已解决{" "}
                {workspace.divergence_summary.resolved_count} 项
              </p>
              <p className="evidence-note">
                已确认角色：
                {workspace.divergence_summary.acknowledged_role_keys.join(", ") || "暂无"}；
                教师端仅可查看摘要，不提供解决或确认写入入口。
              </p>
            </div>
          ) : null}
          {!teamPreconditionReady ? (
            <p className="evidence-note" role="status">
              角色分配前置条件：Team 必须各有一名 {requiredRoleKeys.join("、")}，且 CEO 必须是队长。
            </p>
          ) : null}
          <div className="role-workflow-footer">
            <span>Team confirmation: {workspace?.confirmations.at(-1)?.status ?? "pending"}</span>
            <button
              className="secondary"
              disabled={
                busy ||
                props.disabled ||
                !workspace?.assignments.length ||
                Boolean(workspace.confirmations.length)
              }
              onClick={() => void resetWorkflow()}
            >
              重置角色流程
            </button>
          </div>
          <p className="evidence-note">
            JSON_INTERNAL_ONLY · confirmed history is immutable · teacher projection only
          </p>
        </>
      )}
    </section>
  );
}
