import { useEffect, useRef, useState } from "react";
import {
  isW020AdvisoryReceipt,
  type W020AdvisoryReceipt,
  type W020RoleKey,
  type W020StudentRoleAdvisoryRequest
} from "@simwar/shared-contracts";

type Phase = "IDLE" | "LOADING" | "SUCCESS" | "CONFLICT" | "FORBIDDEN" | "FAILED";

class AdvisoryRequestError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

function isRetryPhase(phase: Phase): boolean {
  return phase === "CONFLICT" || phase === "FORBIDDEN" || phase === "FAILED";
}

export function StudentRoleAdvisor(props: {
  apiBase: string;
  tenantId: string;
  token: string;
  runId?: string | undefined;
  roundId?: string | undefined;
  teamId?: string | undefined;
}) {
  const [roleKey, setRoleKey] = useState<W020RoleKey>("CEO");
  const [phase, setPhase] = useState<Phase>("IDLE");
  const [receipt, setReceipt] = useState<W020AdvisoryReceipt | null>(null);
  const [message, setMessage] = useState("");
  const requestSequence = useRef(0);

  useEffect(() => {
    requestSequence.current += 1;
    setPhase("IDLE");
    setReceipt(null);
    setMessage("");
  }, [props.apiBase, props.roundId, props.runId, props.teamId, props.tenantId, props.token]);

  async function requestAdvisory(): Promise<void> {
    const requestId = ++requestSequence.current;
    if (!props.runId || !props.roundId || !props.teamId) {
      setPhase("FAILED");
      setMessage("FAILED · 等待受控 Run / Round / Team 上下文");
      return;
    }
    const request: W020StudentRoleAdvisoryRequest = {
      discriminator: "w020_advisory_request",
      idempotency_key: `student-advisor-${props.runId}-${props.roundId}-${props.teamId}-${roleKey}`,
      role_key: roleKey,
      round_id: props.roundId,
      run_id: props.runId,
      surface: "student_role",
      team_id: props.teamId
    };
    setPhase("LOADING");
    setMessage("LOADING · 正在生成角色建议");
    try {
      const response = await fetch(`${props.apiBase}/api/v1/bff/student/advisors/role`, {
        body: JSON.stringify(request),
        headers: {
          authorization: `Bearer ${props.token}`,
          "content-type": "application/json",
          "x-tenant-id": props.tenantId
        },
        method: "POST"
      });
      const envelope = (await response.json()) as { data?: unknown; message?: string };
      if (requestId !== requestSequence.current) return;
      if (!response.ok)
        throw new AdvisoryRequestError(
          response.status,
          envelope.message ?? "advisor request failed"
        );
      if (
        !isW020AdvisoryReceipt(envelope.data) ||
        envelope.data.projection.surface !== "student_role"
      )
        throw new AdvisoryRequestError(502, "W020_OUTPUT_REJECTED");
      setReceipt(envelope.data);
      setPhase("SUCCESS");
      setMessage(
        envelope.data.status === "reused"
          ? "SUCCESS · 已复用确定性建议"
          : "SUCCESS · 已生成确定性建议"
      );
    } catch (error) {
      if (requestId !== requestSequence.current) return;
      setReceipt(null);
      const status = error instanceof AdvisoryRequestError ? error.status : 0;
      const nextPhase = status === 409 ? "CONFLICT" : status === 403 ? "FORBIDDEN" : "FAILED";
      setPhase(nextPhase);
      setMessage(
        `${nextPhase} · ${error instanceof Error ? error.message : "advisor request failed"}`
      );
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
        Deterministic Mock · Advisory Only · 仅使用当前身份的角色范围和可见工作流元数据。
      </p>
      <label className="field-label">
        <span>Role scope</span>
        <select
          aria-label="advisor role"
          value={roleKey}
          onChange={(event) => {
            requestSequence.current += 1;
            setRoleKey(event.target.value as W020RoleKey);
            setPhase("IDLE");
            setReceipt(null);
            setMessage("");
          }}
        >
          {(["CEO", "CFO", "CMO", "COO"] as W020RoleKey[]).map((role) => (
            <option key={role}>{role}</option>
          ))}
        </select>
      </label>
      <button
        className="primary"
        disabled={phase === "LOADING"}
        onClick={() => void requestAdvisory()}
      >
        {phase === "LOADING" ? "生成中" : isRetryPhase(phase) ? "重试角色建议" : "请求角色建议"}
      </button>
      <p role="status">{message || "IDLE · 等待请求"}</p>
      {phase === "SUCCESS" && receipt ? (
        <article className="candidate-preview" aria-label="student advisory receipt">
          <strong>{receipt.projection.title}</strong>
          <p>{receipt.projection.recommendations[0]}</p>
          <small>Context digest: {receipt.context.context_digest}</small>
          <small>Source events: {receipt.context.source_event_ids.length}</small>
          <small>Known Limits: {receipt.projection.known_limits.join("; ")}</small>
        </article>
      ) : null}
      {isRetryPhase(phase) ? (
        <p className="readiness-message" role="alert">
          {message}
        </p>
      ) : null}
    </section>
  );
}
