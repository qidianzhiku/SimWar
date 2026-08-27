import { useEffect, useState } from "react";
import type {
  ApiEnvelope,
  O4CrossRoundDynamicsResponse,
  O4CrossRoundDynamicsSurface
} from "@simwar/shared-contracts";

export interface O4CrossRoundDynamicsPanelProps {
  apiBase: string;
  courseId: string;
  runId: string;
  surface: O4CrossRoundDynamicsSurface;
  teamId?: string;
  tenantId: string;
  token: string;
}

function surfaceLabel(surface: O4CrossRoundDynamicsSurface): string {
  return surface === "teacher" ? "教师" : surface === "student" ? "学员" : "管理员";
}

function loadPath(surface: O4CrossRoundDynamicsSurface, runId: string, courseId: string): string {
  return `/api/v1/bff/${surface}/o4/runs/${encodeURIComponent(runId)}/cross-round-dynamics?course_id=${encodeURIComponent(courseId)}`;
}

async function loadCandidate(
  props: O4CrossRoundDynamicsPanelProps
): Promise<O4CrossRoundDynamicsResponse> {
  const response = await fetch(
    `${props.apiBase}${loadPath(props.surface, props.runId, props.courseId)}`,
    {
      headers: {
        authorization: `Bearer ${props.token}`,
        "content-type": "application/json",
        "x-tenant-id": props.tenantId
      }
    }
  );
  const envelope = (await response.json()) as ApiEnvelope<O4CrossRoundDynamicsResponse>;
  if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
  return envelope.data;
}

export function O4CrossRoundDynamicsPanel(props: O4CrossRoundDynamicsPanelProps) {
  const [response, setResponse] = useState<O4CrossRoundDynamicsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setResponse(null);
    setError(null);
    if (!props.token || !props.courseId || !props.runId) return () => undefined;
    void loadCandidate(props)
      .then((data) => {
        if (active) setResponse(data);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "O4 候选加载失败");
      });
    return () => {
      active = false;
    };
  }, [
    props.apiBase,
    props.courseId,
    props.runId,
    props.surface,
    props.teamId,
    props.tenantId,
    props.token
  ]);

  return (
    <section className="summary-panel o4-cross-round-dynamics" aria-label="O4 cross-round dynamics">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">O4 · governed cross-round dynamics</p>
          <h2>跨回合动力差异</h2>
        </div>
        <strong className="summary-badge">{surfaceLabel(props.surface)} · 只读</strong>
      </div>
      {error ? (
        <p className="summary-error" role="alert" data-testid="o4-cross-round-error">
          {error}
        </p>
      ) : null}
      {response ? (
        <>
          <div className="summary-grid" data-testid="o4-cross-round-summary">
            <article>
              <span>候选状态</span>
              <strong>{response.candidate.status}</strong>
            </article>
            <article>
              <span>精确回合范围</span>
              <strong>
                {response.exact_scope.target_round_no - 2}–{response.exact_scope.target_round_no}
              </strong>
            </article>
            <article>
              <span>队伍路径</span>
              <strong>{response.candidate.source_team_count}</strong>
            </article>
            <article>
              <span>Runtime</span>
              <strong>{response.runtime_authority}</strong>
            </article>
          </div>
          {props.surface === "student" ? (
            <div data-testid="o4-student-dynamics">
              <p className="evidence-note">
                当前队伍：{response.candidate.team_paths[0]?.team_id ?? props.teamId ?? "未确认"} ·
                已隐藏同伴路径、原始指标、精确状态引用和决策溯源。
              </p>
              <ul className="compact-list">
                {response.candidate.team_paths[0]?.rounds.map((round) => (
                  <li key={`${round.round_no}-${round.round_id}`}>
                    第 {round.round_no} 轮 ·{" "}
                    {round.carryover_factors.map((factor) => factor.kind).join("、")}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <details open>
              <summary>查看精确路径与差异因子</summary>
              <ul className="compact-list">
                {response.candidate.pair_differentials.map((pair) => (
                  <li key={`${pair.left_team_id}-${pair.right_team_id}`}>
                    {pair.left_team_id} ↔ {pair.right_team_id} · 当前决策{" "}
                    {pair.current_decision_match} · 历史差异 {pair.history_different ? "是" : "否"}{" "}
                    · cash Δ {pair.outcome_differential.cash}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="lifecycle-boundary">
            候选由 Simulation Core 只读生成；REALIZED、SettlementResult 和 Replay truth 均未被写入。
          </p>
          <details>
            <summary>已知限制</summary>
            <ul className="compact-list">
              {response.known_limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </details>
        </>
      ) : !error ? (
        <p className="lifecycle-status" aria-live="polite">
          正在加载 O4 跨回合候选…
        </p>
      ) : null}
    </section>
  );
}
