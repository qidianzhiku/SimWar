import { useEffect, useState } from "react";

interface Props {
  token: string;
  tenantId: string;
  courseId?: string | undefined;
  runId?: string | undefined;
  roundNo?: number | undefined;
  teamId?: string | undefined;
}

type Projection = {
  opening_state_ref: { enterprise_state_id: string; state_digest: string } | null;
  closing_state_ref: { enterprise_state_id: string; state_digest: string } | null;
  initiatives: Array<{
    initiative_id: string;
    status: string;
    current_milestone: string;
    remaining_lead_time_rounds: number;
    project: { project_name: string } | null;
  }>;
  commitments: Array<{ commitment_id: string; kind: string; status: string; cost: number }>;
  effects: Array<{ effect_id: string; status: string; effective_round_no: number }>;
};

export function W4EnterpriseStateWorkbench({
  token,
  tenantId,
  courseId = "course_demo",
  runId,
  roundNo,
  teamId
}: Props) {
  const [projection, setProjection] = useState<Projection | null>(null);
  const [status, setStatus] = useState("等待上下文");
  useEffect(() => {
    if (!token || !runId || !roundNo || !teamId) return;
    const controller = new AbortController();
    setStatus("加载中");
    fetch(
      `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"}/api/v1/bff/teacher/w4/runs/${runId}/rounds/${roundNo}/portfolio?course_id=${encodeURIComponent(courseId)}&team_id=${encodeURIComponent(teamId)}`,
      {
        headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
        signal: controller.signal
      }
    )
      .then(async (response) => {
        const envelope = (await response.json()) as { data?: Projection; code?: string };
        if (!response.ok) throw new Error(envelope.code ?? "W4-TEACHER-ERROR");
        setProjection(envelope.data ?? null);
        setStatus(envelope.data?.initiatives.length ? "就绪" : "空状态");
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setStatus(error instanceof Error ? error.message : "加载失败");
      });
    return () => controller.abort();
  }, [courseId, runId, roundNo, teamId, tenantId, token]);

  return (
    <article className="panel bff-panel" aria-label="W4 教师 Enterprise State 工作台">
      <div className="panel-title">
        <h2>W4 Strategic Evolution 监控</h2>
        <span>{status}</span>
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
      </div>
      <ul className="compact-list">
        {(projection?.initiatives ?? []).map((initiative) => (
          <li key={initiative.initiative_id}>
            {initiative.project?.project_name ?? "通用战略 Initiative"} · {initiative.status} ·{" "}
            {initiative.current_milestone} · 剩余 {initiative.remaining_lead_time_rounds} 回合
          </li>
        ))}
      </ul>
      <p className="evidence-note">
        教师侧只读：可查看阻塞、里程碑和状态迁移，不成为第二个 Enterprise State writer。
      </p>
    </article>
  );
}
