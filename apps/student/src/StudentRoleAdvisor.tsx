import { useEffect, useRef, useState } from "react";
import type { W020AdvisoryReceipt } from "@simwar/shared-contracts";

type RoleKey = "CEO" | "CFO" | "CMO" | "COO";

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
  const [receipt, setReceipt] = useState<W020AdvisoryReceipt | null>(null);
  const [message, setMessage] = useState("");
  const contextKey = [
    props.tenantId,
    props.runId ?? "",
    props.roundId ?? "",
    props.teamId ?? ""
  ].join("\u001f");
  const previousContextKey = useRef(contextKey);
  const requestEpoch = useRef(0);

  useEffect(() => {
    if (previousContextKey.current !== contextKey) {
      requestEpoch.current += 1;
      setPhase("IDLE");
      setReceipt(null);
      setMessage("");
    }
    previousContextKey.current = contextKey;
  }, [contextKey]);

  async function requestAdvisory(): Promise<void> {
    if (!props.runId || !props.roundId || !props.teamId) {
      setMessage("等待受控 Run / Round / Team 上下文");
      return;
    }
    const currentRequestEpoch = ++requestEpoch.current;
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
      const envelope = (await response.json()) as { data?: W020AdvisoryReceipt; message?: string };
      if (currentRequestEpoch !== requestEpoch.current) return;
      if (!response.ok || !envelope.data)
        throw new Error(envelope.message ?? "advisor request failed");
      setReceipt(envelope.data);
      setPhase("READY");
      setMessage(envelope.data.status === "reused" ? "已复用确定性建议" : "已生成建议");
    } catch (error) {
      if (currentRequestEpoch !== requestEpoch.current) return;
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
        <span>Provider OFF · advisory-only</span>
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
          <small>
            Exact Course / Run / Round / Team / Role: {receipt.context.course_id} /{" "}
            {receipt.context.run_id} / {receipt.context.round_id} / {receipt.context.team_id} /{" "}
            {receipt.context.role_key ?? roleKey}
          </small>
          <small>
            Evaluation: {receipt.projection.evaluation.status} · Fallback:{" "}
            {receipt.projection.evaluation.fallback} · Provider OFF
          </small>
          <ul aria-label="student advisory evidence citations">
            {receipt.projection.evidence_citations.map((citation) => (
              <li key={citation.citation_id}>
                {citation.label} · {citation.source_id}
              </li>
            ))}
          </ul>
          <small>Context digest: {receipt.context.context_digest}</small>
          <small>Source events: {receipt.context.source_event_ids.length}</small>
          <small>Known Limits: {receipt.projection.known_limits.join("; ")}</small>
          <small>
            advisory-only · formal_truth_write: false · Human review remains the final authority
          </small>
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
