import { useEffect, useState } from "react";
import type { ApiEnvelope, Team, W027TeacherDecisionExperienceDTO } from "@simwar/shared-contracts";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
type Props = {
  active: boolean;
  courseId?: string | undefined;
  roundId?: string | undefined;
  runId?: string | undefined;
  teams: Team[];
  tenantId: string;
  token?: string | undefined;
};

async function request<T>(path: string, props: Props, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": props.tenantId,
      ...(props.token ? { authorization: `Bearer ${props.token}` } : {}),
      ...(options.headers ?? {})
    }
  });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
  return envelope.data;
}

export function W027DecisionExperiencePanel(props: Props) {
  const [teamId, setTeamId] = useState(props.teams[0]?.team_id ?? "");
  const [workspace, setWorkspace] = useState<W027TeacherDecisionExperienceDTO | null>(null);
  const [notice, setNotice] = useState("等待 W027 工作区");
  const team = props.teams.find((candidate) => candidate.team_id === teamId);

  async function refresh(): Promise<void> {
    if (!props.active || !props.token || !props.runId || !props.roundId || !team) return;
    try {
      setWorkspace(
        await request<W027TeacherDecisionExperienceDTO>(
          `/api/v1/bff/teacher/w027/decision-experience?course_id=${encodeURIComponent(props.courseId ?? "course_demo")}&run_id=${encodeURIComponent(props.runId)}&round_id=${encodeURIComponent(props.roundId)}&team_id=${encodeURIComponent(team.team_id)}`,
          props
        )
      );
      setNotice("W027 教师投影已同步");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "W027 教师投影不可用");
    }
  }

  useEffect(() => {
    setTeamId((current) =>
      props.teams.some((candidate) => candidate.team_id === current)
        ? current
        : (props.teams[0]?.team_id ?? "")
    );
  }, [props.teams]);
  useEffect(() => {
    void refresh();
  }, [props.active, props.roundId, props.runId, props.token, teamId]);

  async function configureRoster(): Promise<void> {
    if (!props.runId || !props.roundId || !team) return;
    await request("/api/v1/bff/teacher/w027/roster", props, {
      method: "PUT",
      body: JSON.stringify({
        course_id: props.courseId ?? "course_demo",
        run_id: props.runId,
        round_id: props.roundId,
        team_id: team.team_id,
        role_keys: ["CEO", "CFO", "CMO", "COO", "CHRO"]
      })
    });
    await refresh();
  }

  return (
    <section
      className="panel bff-panel w027-decision-experience-panel"
      aria-label="W027 teacher decision experience"
    >
      <div className="panel-title">
        <h2>W027 教师决策监控</h2>
        <span>{notice}</span>
      </div>
      <label>
        队伍
        <select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
          {props.teams.map((candidate) => (
            <option key={candidate.team_id} value={candidate.team_id}>
              {candidate.name}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={() => void configureRoster()}>
        配置五角色 roster
      </button>
      {workspace ? (
        <>
          <p>正式角色：{workspace.roster.role_keys.join(" / ")}。Quality &amp; Risk → COO。</p>
          <div className="table" aria-label="W027 decision rights">
            {workspace.roster.decision_right_policies.map((policy) => (
              <div className="table-row" key={policy.role_key}>
                <span>{policy.role_key}</span>
                <span>{policy.operational_capabilities.join(" / ") || "无专属操作能力"}</span>
                <strong>
                  {policy.can_merge_team_decision ? "可合并" : "不可合并"} ·{" "}
                  {policy.can_confirm_team_decision ? "可确认" : "不可确认"}
                </strong>
              </div>
            ))}
          </div>
          <div className="table" aria-label="W027 role positions">
            {workspace.role_positions.map((position) => (
              <div className="table-row" key={position.position_id}>
                <span>{position.role_key}</span>
                <span>{position.summary}</span>
                <strong>{position.status}</strong>
              </div>
            ))}
          </div>
          <p>私有判断记录：{workspace.private_judgment_summary.length} 条，仅显示元数据。</p>
          {workspace.divergence?.divergences.length ? (
            <p>
              分歧 V2：{workspace.divergence.divergences.map((row) => row.dimension).join("、")}
            </p>
          ) : (
            <p>当前没有可显示的分歧。</p>
          )}
          <ul>
            {workspace.known_limits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        </>
      ) : (
        <p>{notice}</p>
      )}
    </section>
  );
}
