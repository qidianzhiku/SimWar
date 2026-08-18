import { useEffect, useState } from "react";
import type { ApiEnvelope, W027StudentDecisionExperienceDTO } from "@simwar/shared-contracts";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
type Props = {
  active: boolean;
  courseId?: string | undefined;
  roundId?: string | undefined;
  runId?: string | undefined;
  teamId?: string | undefined;
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
  const [workspace, setWorkspace] = useState<W027StudentDecisionExperienceDTO | null>(null);
  const [kind, setKind] = useState<"value" | "assumption" | "evidence" | "risk" | "tradeoff">(
    "risk"
  );
  const [statement, setStatement] = useState("");
  const [summary, setSummary] = useState("");
  const [notice, setNotice] = useState("等待 W027 工作区");

  async function refresh(): Promise<void> {
    if (!props.active || !props.token || !props.runId || !props.roundId || !props.teamId) return;
    try {
      setWorkspace(
        await request<W027StudentDecisionExperienceDTO>(
          `/api/v1/bff/student/w027/decision-experience?course_id=${encodeURIComponent(props.courseId ?? "course_demo")}&run_id=${encodeURIComponent(props.runId)}&round_id=${encodeURIComponent(props.roundId)}&team_id=${encodeURIComponent(props.teamId)}`,
          props
        )
      );
      setNotice("W027 工作区已同步");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "W027 工作区不可用");
    }
  }

  useEffect(() => {
    void refresh();
  }, [props.active, props.roundId, props.runId, props.teamId, props.token]);

  async function saveJudgment(): Promise<void> {
    if (!props.runId || !props.roundId || !props.teamId || !statement.trim()) return;
    await request("/api/v1/bff/student/w027/private-judgment", props, {
      method: "PUT",
      body: JSON.stringify({
        course_id: props.courseId ?? "course_demo",
        run_id: props.runId,
        round_id: props.roundId,
        team_id: props.teamId,
        kind,
        statement,
        status: "ready"
      })
    });
    setStatement("");
    await refresh();
  }

  async function savePosition(): Promise<void> {
    if (!props.runId || !props.roundId || !props.teamId || !summary.trim()) return;
    await request("/api/v1/bff/student/w027/role-position", props, {
      method: "PUT",
      body: JSON.stringify({
        course_id: props.courseId ?? "course_demo",
        run_id: props.runId,
        round_id: props.roundId,
        team_id: props.teamId,
        summary,
        status: "ready"
      })
    });
    setSummary("");
    await refresh();
  }

  return (
    <section className="panel bff-panel" aria-label="W027 decision experience">
      <div className="panel-title">
        <h2>W027 决策体验</h2>
        <span>{notice}</span>
      </div>
      {workspace ? (
        <>
          <p>
            当前正式角色：<strong>{workspace.context.role_key}</strong>。Quality &amp; Risk 已并入
            COO。
          </p>
          <div className="role-workflow-fields">
            <label>
              私有判断类型
              <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
                <option value="value">价值</option>
                <option value="assumption">假设</option>
                <option value="evidence">证据</option>
                <option value="risk">风险</option>
                <option value="tradeoff">权衡</option>
              </select>
            </label>
            <label>
              仅本角色可见的判断
              <textarea value={statement} onChange={(event) => setStatement(event.target.value)} />
            </label>
            <button type="button" onClick={() => void saveJudgment()}>
              记录私有判断
            </button>
            <label>
              团队安全立场
              <textarea value={summary} onChange={(event) => setSummary(event.target.value)} />
            </label>
            <button type="button" onClick={() => void savePosition()}>
              发布团队安全立场
            </button>
          </div>
          <p>
            trace v2 当前阶段：<strong>{workspace.trace.current_stage}</strong>
          </p>
          {workspace.divergence?.divergences.length ? (
            <div className="table" aria-label="W027 divergence v2">
              {workspace.divergence.divergences.map((row) => (
                <div className="table-row" key={row.divergence_id}>
                  <span>{row.dimension}</span>
                  <span>{row.candidates.length} 个角色候选</span>
                  <strong>{row.status}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p>当前没有可显示的团队分歧。</p>
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
