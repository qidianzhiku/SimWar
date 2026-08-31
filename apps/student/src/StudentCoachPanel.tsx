import { useState } from "react";
import type { W020AdvisoryReceipt } from "@simwar/shared-contracts";

export interface StudentCoachPanelProps {
  apiBase: string;
  tenantId: string;
  token: string;
  runId?: string | undefined;
  roundId?: string | undefined;
  teamId?: string | undefined;
  roleKey?: "CEO" | "CFO" | "CMO" | "COO" | undefined;
}

export function StudentCoachPanel({
  apiBase,
  tenantId,
  token,
  runId,
  roundId,
  teamId,
  roleKey = "CEO"
}: StudentCoachPanelProps) {
  const [receipt, setReceipt] = useState<W020AdvisoryReceipt | null>(null);
  const [message, setMessage] = useState("等待精确 Course / Run / Round / Team 上下文");
  const [busy, setBusy] = useState(false);

  async function requestCoach(): Promise<void> {
    if (!runId || !roundId || !teamId) {
      setMessage("等待精确 Course / Run / Round / Team 上下文");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${apiBase}/api/v1/bff/student/intelligence/coach`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-tenant-id": tenantId
        },
        body: JSON.stringify({
          discriminator: "w020_advisory_request",
          idempotency_key: `w6:student_coach:${runId}:${roundId}:${teamId}:${roleKey}`,
          role_key: roleKey,
          round_id: roundId,
          run_id: runId,
          surface: "student_coach",
          team_id: teamId
        })
      });
      const payload = (await response.json()) as { data?: W020AdvisoryReceipt };
      if (!response.ok || !payload.data) throw new Error("student coach request rejected");
      setReceipt(payload.data);
      setMessage(payload.data.status === "reused" ? "已复用有界教练结果" : "已生成有界教练结果");
    } catch (error) {
      setReceipt(null);
      setMessage(error instanceof Error ? error.message : "student coach request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="candidate-surface" aria-label="Student Coach">
      <div className="candidate-heading">
        <div>
          <p className="eyebrow">W6 AI-off-first</p>
          <h3>Student Coach</h3>
        </div>
        <span>Provider OFF · advisory-only</span>
      </div>
      <p className="evidence-note">
        Student Coach 只读取当前团队可见的精确上下文；每条结果都带 evidence citation。Human review
        remains the final authority，正式真值不会被修改。
      </p>
      <p className="lifecycle-status">
        Role scope: {roleKey} · run {runId ?? "未选择"} · round {roundId ?? "未选择"} · team{" "}
        {teamId ?? "未选择"}
      </p>
      <button className="primary" disabled={busy} onClick={() => void requestCoach()}>
        {busy ? "生成中…" : "请求 Student Coach"}
      </button>
      <p role="status">{message}</p>
      {receipt ? (
        <article className="candidate-preview" aria-label="student coach receipt">
          <strong>{receipt.projection.title}</strong>
          <p>{receipt.projection.recommendations[0]}</p>
          <p>
            evaluation: {receipt.projection.evaluation.status} · fallback:{" "}
            {receipt.projection.evaluation.fallback}
          </p>
          <ul aria-label="student coach evidence citations">
            {receipt.projection.evidence_citations.map((citation) => (
              <li key={citation.citation_id}>
                {citation.label} · {citation.source_id}
              </li>
            ))}
          </ul>
          <small>
            Provider OFF · formal_truth_write: false · Human review remains the final authority
          </small>
        </article>
      ) : null}
    </section>
  );
}
