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
  const [resolutionRationale, setResolutionRationale] = useState("");
  const [dissentNote, setDissentNote] = useState("");
  const [mergeCommitId, setMergeCommitId] = useState<string | null>(null);
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

  async function createMerge(): Promise<void> {
    if (!props.runId || !props.roundId || !props.teamId) return;
    const merge = await request<{ merge_commit_id: string }>(
      "/api/v1/bff/student/w027/merge",
      props,
      {
        method: "POST",
        body: JSON.stringify({
          run_id: props.runId,
          round_id: props.roundId,
          team_id: props.teamId
        })
      }
    );
    setMergeCommitId(merge.merge_commit_id);
    await refresh();
  }

  async function proposeResolution(): Promise<void> {
    if (!props.runId || !props.roundId || !props.teamId || !workspace?.divergence) return;
    const selectedPosition = workspace.team_safe_positions[0];
    if (!selectedPosition) return;
    await request("/api/v1/bff/student/w027/resolution", props, {
      method: "POST",
      body: JSON.stringify({
        course_id: props.courseId ?? "course_demo",
        run_id: props.runId,
        round_id: props.roundId,
        team_id: props.teamId,
        source_digest: workspace.divergence.source_digest,
        selected_position_ids: [selectedPosition.position_id],
        selected_option: selectedPosition.summary,
        rationale: resolutionRationale.trim() || "基于当前团队安全立场选择观察到的候选方案。",
        supporting_evidence_refs: [
          `w027_divergence_${workspace.divergence.source_digest.slice(0, 16)}`
        ],
        trade_off: "在当前分歧中平衡团队安全立场。",
        risk: "保留异议仍属于过程证据，不改变正式真值。",
        affected_divergence_ids: workspace.divergence.divergences.map(
          (divergence) => divergence.divergence_id
        )
      })
    });
    setResolutionRationale("");
    await refresh();
  }

  async function acknowledgeResolution(
    status: "ACKNOWLEDGED" | "DISSENT_PRESERVED"
  ): Promise<void> {
    if (!props.runId || !props.roundId || !props.teamId || !workspace?.resolution) return;
    await request("/api/v1/bff/student/w027/resolution/acknowledgement", props, {
      method: "POST",
      body: JSON.stringify({
        course_id: props.courseId ?? "course_demo",
        run_id: props.runId,
        round_id: props.roundId,
        team_id: props.teamId,
        resolution_id: workspace.resolution.resolution_id,
        status,
        ...(status === "DISSENT_PRESERVED" ? { dissent_note: dissentNote.trim() } : {})
      })
    });
    setDissentNote("");
    await refresh();
  }

  async function confirmMerge(): Promise<void> {
    if (!props.runId || !props.roundId || !props.teamId || !mergeCommitId) return;
    await request("/api/v1/bff/student/w027/confirm", props, {
      method: "POST",
      body: JSON.stringify({
        run_id: props.runId,
        round_id: props.roundId,
        team_id: props.teamId,
        merge_commit_id: mergeCommitId
      })
    });
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
          </div>
          <p>团队安全立场由已准备的角色贡献确定性生成，当前页面只读展示。</p>
          <div className="table" aria-label="W027 team-safe role positions">
            {workspace.team_safe_positions.map((position) => (
              <div className="table-row" key={position.position_id}>
                <span>{position.role_key}</span>
                <span>{position.summary}</span>
                <strong>{position.status}</strong>
              </div>
            ))}
          </div>
          {workspace.context.permissions.can_merge_team_decision ? (
            <button type="button" onClick={() => void createMerge()}>
              创建团队合并候选
            </button>
          ) : null}
          {workspace.context.permissions.can_confirm_team_decision && mergeCommitId ? (
            <button type="button" onClick={() => void confirmMerge()}>
              确认团队决策
            </button>
          ) : null}
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
          {workspace.context.permissions.can_propose_resolution &&
          workspace.divergence?.divergences.length ? (
            <div className="role-workflow-fields">
              <label>
                解决方案理由
                <textarea
                  value={resolutionRationale}
                  onChange={(event) => setResolutionRationale(event.target.value)}
                  placeholder="说明选择候选方案的依据、权衡和风险"
                />
              </label>
              <button type="button" onClick={() => void proposeResolution()}>
                提出观察到的候选解决方案
              </button>
            </div>
          ) : null}
          {workspace.resolution ? (
            <div className="table" aria-label="W027 resolution v2">
              <div className="table-row">
                <span>解决模式</span>
                <span>{workspace.resolution.resolution_mode}</span>
                <strong>{workspace.resolution.status}</strong>
              </div>
              <div className="table-row">
                <span>候选方案</span>
                <span>{workspace.resolution.selected_option}</span>
                <strong>{workspace.resolution.authority_role_key}</strong>
              </div>
              <div className="role-workflow-fields">
                <label>
                  保留异议说明
                  <textarea
                    value={dissentNote}
                    onChange={(event) => setDissentNote(event.target.value)}
                  />
                </label>
                {workspace.context.permissions.can_acknowledge_resolution ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => void acknowledgeResolution("ACKNOWLEDGED")}
                    >
                      确认解决方案
                    </button>
                    <button
                      type="button"
                      onClick={() => void acknowledgeResolution("DISSENT_PRESERVED")}
                    >
                      保留我的异议
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
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
