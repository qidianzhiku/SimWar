import { useState } from "react";

type RoleKey = "CEO" | "CFO" | "CMO" | "COO";
type Receipt = {
  projection: { title: string; recommendations: string[]; known_limits: string[] };
  status: "generated" | "reused";
  context: { role_key?: RoleKey; context_digest: string; source_event_ids: string[] };
};

export function StudentRoleAdvisor(props: {
  apiBase: string;
  tenantId: string;
  token: string;
  runId?: string | undefined;
  roundId?: string | undefined;
  teamId?: string | undefined;
}) {
  const [roleKey, setRoleKey] = useState<RoleKey>("CEO");
  const [phase, setPhase] = useState<"IDLE" | "LOADING" | "READY" | "ERROR">("IDLE");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [message, setMessage] = useState("");

  async function requestAdvisory(): Promise<void> {
    if (!props.runId || !props.roundId || !props.teamId) {
      setMessage("等待受控 Run / Round / Team 上下文");
      return;
    }
    setPhase("LOADING");
    try {
      const response = await fetch(`${props.apiBase}/api/v1/bff/student/advisors/role`, {
        body: JSON.stringify({
          discriminator: "w020_advisory_request",
          idempotency_key: `student-advisor-${props.runId}-${props.roundId}-${roleKey}`,
          role_key: roleKey,
          round_id: props.roundId,
          run_id: props.runId,
          surface: "student_role",
          team_id: props.teamId
        }),
        headers: {
          authorization: `Bearer ${props.token}`,
          "content-type": "application/json",
          "x-tenant-id": props.tenantId
        },
        method: "POST"
      });
      const envelope = (await response.json()) as { data?: Receipt; message?: string };
      if (!response.ok || !envelope.data)
        throw new Error(envelope.message ?? "advisor request failed");
      setReceipt(envelope.data);
      setPhase("READY");
      setMessage(envelope.data.status === "reused" ? "已复用确定性建议" : "已生成建议");
    } catch (error) {
      setPhase("ERROR");
      setMessage(error instanceof Error ? error.message : "advisor request failed");
    }
  }

  return (
    <section className="candidate-surface" aria-label="Student Role Advisor">
      <div className="candidate-heading">
        <div>
          <p className="eyebrow">W020 Governed AI</p>
          <h2>Student Role Advisor</h2>
        </div>
        <span>advisory_only</span>
      </div>
      <p className="evidence-note">
        仅使用当前身份的角色范围和可见工作流元数据，不展示原始事件或正式真值。
      </p>
      <label className="field-label">
        <span>Role scope</span>
        <select
          aria-label="advisor role"
          value={roleKey}
          onChange={(event) => setRoleKey(event.target.value as RoleKey)}
        >
          {(["CEO", "CFO", "CMO", "COO"] as RoleKey[]).map((role) => (
            <option key={role}>{role}</option>
          ))}
        </select>
      </label>
      <button
        className="primary"
        disabled={phase === "LOADING"}
        onClick={() => void requestAdvisory()}
      >
        {phase === "LOADING" ? "生成中" : "请求角色建议"}
      </button>
      <p role="status">{message || "等待请求"}</p>
      {phase === "READY" && receipt ? (
        <article className="candidate-preview" aria-label="student advisory receipt">
          <strong>{receipt.projection.title}</strong>
          <p>{receipt.projection.recommendations[0]}</p>
          <small>Context digest: {receipt.context.context_digest}</small>
          <small>Source events: {receipt.context.source_event_ids.length}</small>
          <small>Known Limits: {receipt.projection.known_limits.join("; ")}</small>
        </article>
      ) : null}
      {phase === "ERROR" ? (
        <p className="readiness-message" role="alert">
          {message}
        </p>
      ) : null}
    </section>
  );
}
