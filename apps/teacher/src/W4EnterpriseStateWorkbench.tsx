import { useEffect, useState } from "react";
import type { W4ProjectionBase } from "@simwar/shared-contracts";

interface Props {
  token: string;
  tenantId: string;
  courseId?: string | undefined;
  runId?: string | undefined;
  roundId?: string | undefined;
  roundNo?: number | undefined;
  teamId?: string | undefined;
}

type PanelStatus =
  | "loading"
  | "empty"
  | "partial"
  | "ready"
  | "blocked"
  | "permission"
  | "stale"
  | "conflict"
  | "dependency-missing"
  | "error"
  | "retry";

type Projection = W4ProjectionBase & {
  process_information: { status: string; activity_id: string };
  outcome_information: { status: string; opening_state_ref: unknown; closing_state_ref: unknown };
};

function statusLabel(status: PanelStatus): string {
  return {
    loading: "加载中",
    empty: "空状态",
    partial: "部分可用",
    ready: "就绪",
    blocked: "存在阻塞",
    permission: "权限受限",
    stale: "上下文过期",
    conflict: "上下文冲突",
    "dependency-missing": "依赖缺失",
    error: "加载失败",
    retry: "可重试"
  }[status];
}

function failureStatus(code: string): PanelStatus {
  if (code.includes("403") || code.includes("PERMISSION")) return "permission";
  if (code.includes("409") || code.includes("CONFLICT")) return "conflict";
  if (code.includes("NOT_FOUND")) return "dependency-missing";
  return "retry";
}

export function W4EnterpriseStateWorkbench({
  token,
  tenantId,
  courseId = "course_demo",
  runId,
  roundId,
  roundNo,
  teamId
}: Props) {
  const [projection, setProjection] = useState<Projection | null>(null);
  const [status, setStatus] = useState<PanelStatus>("dependency-missing");
  const [reloadVersion, setReloadVersion] = useState(0);
  useEffect(() => {
    if (!token || !runId || !roundNo || !teamId) {
      setStatus(token ? "dependency-missing" : "permission");
      setProjection(null);
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    fetch(
      `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"}/api/v1/bff/teacher/w4/runs/${runId}/rounds/${roundNo}/portfolio?course_id=${encodeURIComponent(courseId)}&team_id=${encodeURIComponent(teamId)}&round_id=${encodeURIComponent(roundId ?? `round_${runId}_${roundNo}`)}`,
      {
        headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
        signal: controller.signal
      }
    )
      .then(async (response) => {
        const envelope = (await response.json()) as { data?: Projection; code?: string };
        if (!response.ok) {
          const code = envelope.code ?? "W4-TEACHER-ERROR";
          setStatus(failureStatus(code));
          throw new Error(code);
        }
        setProjection(envelope.data ?? null);
        setStatus(
          envelope.data?.state
            ? envelope.data.initiatives.some((initiative) => initiative.status === "blocked")
              ? "blocked"
              : envelope.data.closing_state_ref
                ? "ready"
                : "partial"
            : "empty"
        );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setStatus((current) => (current === "loading" ? "error" : current));
      });
    return () => controller.abort();
  }, [courseId, reloadVersion, roundId, runId, roundNo, teamId, tenantId, token]);

  return (
    <article className="panel bff-panel" aria-label="W4 教师 Enterprise State 工作台">
      <div className="panel-title">
        <h2>W4 Strategic Evolution 监控</h2>
        <span>{statusLabel(status)}</span>
      </div>
      <div className="status-grid">
        <div>
          <span>Opening State</span>
          <strong>{projection?.opening_state_ref?.enterprise_state_id ?? "未建立"}</strong>
        </div>
        <div>
          <span>Closing State</span>
          <strong>{projection?.closing_state_ref?.enterprise_state_id ?? "等待结算"}</strong>
        </div>
        <div>
          <span>Commitment / Effect</span>
          <strong>
            {projection?.commitments.length ?? 0} / {projection?.effects.length ?? 0}
          </strong>
        </div>
        <div>
          <span>Process Information</span>
          <strong>{projection?.process_information.status ?? "等待中"}</strong>
        </div>
        <div>
          <span>Outcome Information</span>
          <strong>{projection?.outcome_information.status ?? "等待中"}</strong>
        </div>
      </div>
      <ul className="compact-list">
        {(projection?.initiatives ?? []).map((initiative) => (
          <li key={initiative.initiative_id}>
            {initiative.project?.project_name ?? "通用战略 Initiative"} · {initiative.status} ·{" "}
            {initiative.current_milestone} · 剩余 {initiative.remaining_lead_time_rounds} 回合
          </li>
        ))}
      </ul>
      <div className="evidence-note">
        <div>
          Opening / Closing diff：
          {projection?.path_evidence.opening_vs_closing?.changed_paths.join(", ") || "等待官方结算"}
        </div>
        <div>
          Replay path：{projection?.path_evidence.official_replay_path.replay_ids.length ?? 0}{" "}
          条证据； Shadow apply ={" "}
          {projection?.path_evidence.official_replay_path.replay_writes_formal_results === false
            ? "否"
            : "未证明"}
        </div>
        <div>
          同一决策意图 / 不同历史：
          {projection?.path_evidence.same_current_decision_different_history.status ?? "未观察"}
        </div>
      </div>
      {status === "retry" ||
      status === "dependency-missing" ||
      status === "error" ||
      status === "conflict" ? (
        <button type="button" onClick={() => setReloadVersion((value) => value + 1)}>
          重新加载 W4 状态
        </button>
      ) : null}
      <p className="evidence-note">
        教师侧只读：可查看阻塞、里程碑和状态迁移，不成为第二个 Enterprise State writer。
      </p>
    </article>
  );
}
