import { useEffect, useState } from "react";

type Receipt = { projection: { title: string; recommendations: string[]; known_limits: string[] }; status: "generated" | "reused" };
type AuditEntry = { provider: string; model: string; purpose: string; status: string; input_hash: string; output_hash: string; context_digest: string; surface: string };

export function TeacherDebriefAdvisor(props: { apiBase: string; tenantId: string; token: string; runId?: string | undefined; roundId?: string | undefined; teamId?: string | undefined }) {
  const [phase, setPhase] = useState<"IDLE" | "LOADING" | "READY" | "ERROR">("IDLE");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [message, setMessage] = useState("");

  async function requestDebrief(): Promise<void> {
    if (!props.runId || !props.roundId || !props.teamId) {
      setMessage("等待受控 Run / Round / Team 上下文");
      return;
    }
    setPhase("LOADING");
    try {
      const response = await fetch(`${props.apiBase}/api/v1/bff/teacher/advisors/debrief`, {
        body: JSON.stringify({ idempotency_key: `teacher-debrief-${props.runId}-${props.roundId}`, round_id: props.roundId, run_id: props.runId, team_id: props.teamId }),
        headers: { authorization: `Bearer ${props.token}`, "content-type": "application/json", "x-tenant-id": props.tenantId },
        method: "POST"
      });
      const envelope = (await response.json()) as { data?: Receipt; message?: string };
      if (!response.ok || !envelope.data) throw new Error(envelope.message ?? "debrief request failed");
      setReceipt(envelope.data);
      setPhase("READY");
      setMessage(envelope.data.status === "reused" ? "已复用确定性复盘建议" : "已生成复盘建议");
      await loadAudit();
    } catch (error) {
      setPhase("ERROR");
      setMessage(error instanceof Error ? error.message : "debrief request failed");
    }
  }

  async function loadAudit(): Promise<void> {
    const response = await fetch(`${props.apiBase}/api/v1/bff/teacher/advisors/audit`, { headers: { authorization: `Bearer ${props.token}`, "x-tenant-id": props.tenantId } });
    if (!response.ok) return;
    const envelope = (await response.json()) as { data?: { entries: AuditEntry[] } };
    setAudit(envelope.data?.entries ?? []);
  }

  useEffect(() => { if (props.token) void loadAudit(); }, [props.token]);

  return (
    <section className="candidate-surface" aria-label="Teacher Debrief Advisor">
      <div className="candidate-heading"><div><p className="eyebrow">W020 Governed AI</p><h2>Teacher Debrief Advisor</h2></div><span>advisory_only</span></div>
      <p className="evidence-note">教师只看到安全投影和调用审计元数据，不包含原始 prompt 或原始事件 payload。</p>
      <button className="primary" disabled={phase === "LOADING"} onClick={() => void requestDebrief()}>{phase === "LOADING" ? "生成中" : "请求教师复盘建议"}</button>
      <p role="status">{message || "等待请求"}</p>
      {phase === "READY" && receipt ? <article className="candidate-preview" aria-label="teacher advisory receipt"><strong>{receipt.projection.title}</strong><p>{receipt.projection.recommendations[0]}</p><small>{receipt.projection.known_limits.join("; ")}</small></article> : null}
      <div className="candidate-list" aria-label="teacher advisory audit list">{audit.map((entry) => <article className="candidate-card" key={entry.context_digest}><strong>{entry.provider} / {entry.model}</strong><small>{entry.purpose} · {entry.status} · {entry.surface}</small><small>Input {entry.input_hash.slice(0, 12)} · Output {entry.output_hash.slice(0, 12)}</small></article>)}</div>
      {phase === "ERROR" ? <p className="readiness-message" role="alert">{message}</p> : null}
    </section>
  );
}
