import { useEffect, useRef, useState } from "react";
import {
  isW020AdvisoryReceipt,
  type W020AdvisoryAuditDto,
  type W020AdvisoryReceipt,
  type W020RoleKey,
  type W020TeacherDebriefAdvisoryRequest
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

function isExactId(value: string): boolean {
  return (
    /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) &&
    !/(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(value)
  );
}

export function TeacherDebriefAdvisor(props: {
  apiBase: string;
  tenantId: string;
  token: string;
  runId?: string | undefined;
  roundId?: string | undefined;
  teamId?: string | undefined;
  teamIds?: string[] | undefined;
}) {
  const [phase, setPhase] = useState<Phase>("IDLE");
  const [receipt, setReceipt] = useState<W020AdvisoryReceipt | null>(null);
  const [audit, setAudit] = useState<W020AdvisoryAuditDto[]>([]);
  const [message, setMessage] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState(props.teamId ?? "");
  const [roleKey, setRoleKey] = useState<W020RoleKey>("CEO");
  const [activityId, setActivityId] = useState("");
  const advisoryRequestSequence = useRef(0);
  const auditRequestSequence = useRef(0);

  useEffect(() => {
    advisoryRequestSequence.current += 1;
    auditRequestSequence.current += 1;
    setSelectedTeamId(props.teamId ?? "");
    setActivityId("");
    setReceipt(null);
    setPhase("IDLE");
    setMessage("");
  }, [props.apiBase, props.roundId, props.runId, props.teamId, props.tenantId, props.token]);

  async function requestDebrief(): Promise<void> {
    const requestId = ++advisoryRequestSequence.current;
    if (!props.runId || !props.roundId || !selectedTeamId || !isExactId(activityId)) {
      setPhase("FAILED");
      setMessage("FAILED · 请选择受控 Run / Round / Team 并填写 exact Activity ID");
      return;
    }
    const request: W020TeacherDebriefAdvisoryRequest = {
      activity_id: activityId,
      discriminator: "w020_advisory_request",
      idempotency_key: `teacher-debrief-${props.runId}-${props.roundId}-${selectedTeamId}-${roleKey}-${activityId}`,
      role_key: roleKey,
      round_id: props.roundId,
      run_id: props.runId,
      surface: "teacher_debrief",
      team_id: selectedTeamId
    };
    setPhase("LOADING");
    setMessage("LOADING · 正在生成教师复盘建议");
    try {
      const response = await fetch(`${props.apiBase}/api/v1/bff/teacher/advisors/debrief`, {
        body: JSON.stringify(request),
        headers: {
          authorization: `Bearer ${props.token}`,
          "content-type": "application/json",
          "x-tenant-id": props.tenantId
        },
        method: "POST"
      });
      const envelope = (await response.json()) as { data?: unknown; message?: string };
      if (requestId !== advisoryRequestSequence.current) return;
      if (!response.ok)
        throw new AdvisoryRequestError(
          response.status,
          envelope.message ?? "debrief request failed"
        );
      if (
        !isW020AdvisoryReceipt(envelope.data) ||
        envelope.data.projection.surface !== "teacher_debrief" ||
        !envelope.data.projection.teacher_debrief
      )
        throw new AdvisoryRequestError(502, "W020_OUTPUT_REJECTED");
      setReceipt(envelope.data);
      setPhase("SUCCESS");
      setMessage(
        envelope.data.status === "reused"
          ? "SUCCESS · 已复用确定性复盘建议"
          : "SUCCESS · 已生成确定性复盘建议"
      );
      await loadAudit();
    } catch (error) {
      if (requestId !== advisoryRequestSequence.current) return;
      setReceipt(null);
      const status = error instanceof AdvisoryRequestError ? error.status : 0;
      const nextPhase = status === 409 ? "CONFLICT" : status === 403 ? "FORBIDDEN" : "FAILED";
      setPhase(nextPhase);
      setMessage(
        `${nextPhase} · ${error instanceof Error ? error.message : "debrief request failed"}`
      );
    }
  }

  async function loadAudit(): Promise<void> {
    const requestId = ++auditRequestSequence.current;
    try {
      const response = await fetch(`${props.apiBase}/api/v1/bff/teacher/advisors/audit`, {
        headers: { authorization: `Bearer ${props.token}`, "x-tenant-id": props.tenantId }
      });
      const envelope = (await response.json()) as { data?: { entries?: W020AdvisoryAuditDto[] } };
      if (requestId !== auditRequestSequence.current || !response.ok) return;
      setAudit(Array.isArray(envelope.data?.entries) ? envelope.data.entries : []);
    } catch {
      if (requestId !== auditRequestSequence.current) return;
    }
  }

  useEffect(() => {
    auditRequestSequence.current += 1;
    setAudit([]);
    if (props.token) void loadAudit();
    return () => {
      auditRequestSequence.current += 1;
    };
  }, [props.apiBase, props.tenantId, props.token]);

  const debrief = receipt?.projection.teacher_debrief;

  return (
    <section className="candidate-surface" aria-label="Teacher Debrief Advisor">
      <div className="candidate-heading">
        <div>
          <p className="eyebrow">W020 Governed AI</p>
          <h2>Teacher Debrief Advisor</h2>
        </div>
        <span>advisory_only</span>
      </div>
      <p className="evidence-note">
        Deterministic Mock · Advisory Only · 仅使用 exact W019 Teacher-safe
        projection，不读取原始事件 payload。
      </p>
      {props.teamIds && props.teamIds.length > 0 ? (
        <label className="field-label">
          <span>Team scope</span>
          <select
            aria-label="advisor team"
            value={selectedTeamId}
            onChange={(event) => {
              advisoryRequestSequence.current += 1;
              auditRequestSequence.current += 1;
              setSelectedTeamId(event.target.value);
              setReceipt(null);
              setPhase("IDLE");
              setMessage("");
            }}
          >
            {props.teamIds.map((teamId) => (
              <option key={teamId}>{teamId}</option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="field-label">
        <span>Exact role</span>
        <select
          aria-label="advisor role"
          value={roleKey}
          onChange={(event) => {
            advisoryRequestSequence.current += 1;
            auditRequestSequence.current += 1;
            setRoleKey(event.target.value as W020RoleKey);
            setReceipt(null);
            setPhase("IDLE");
            setMessage("");
          }}
        >
          {(["CEO", "CFO", "CMO", "COO"] as W020RoleKey[]).map((role) => (
            <option key={role}>{role}</option>
          ))}
        </select>
      </label>
      <label className="field-label">
        <span>Exact activity ID</span>
        <input
          aria-label="advisor activity"
          value={activityId}
          onChange={(event) => {
            advisoryRequestSequence.current += 1;
            auditRequestSequence.current += 1;
            setActivityId(event.target.value);
            setReceipt(null);
            setPhase("IDLE");
            setMessage("");
          }}
        />
      </label>
      <button
        className="primary"
        disabled={phase === "LOADING"}
        onClick={() => void requestDebrief()}
      >
        {phase === "LOADING"
          ? "生成中"
          : isRetryPhase(phase)
            ? "重试教师复盘建议"
            : "请求教师复盘建议"}
      </button>
      <p role="status">{message || "IDLE · 等待 exact W019 source"}</p>
      {phase === "SUCCESS" && receipt && debrief ? (
        <article className="candidate-preview" aria-label="teacher advisory receipt">
          <strong>{receipt.projection.title}</strong>
          <small>
            Exact source: {debrief.role_key} · {debrief.activity_id}
          </small>
          <h3>Discussion prompts</h3>
          <ul>
            {debrief.discussion_prompts.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3>Explanation candidates</h3>
          <ul>
            {debrief.explanations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3>Tradeoffs</h3>
          <ul>
            {debrief.tradeoffs.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3>Next focus</h3>
          <p>{debrief.next_focus}</p>
          <small>Known Limits: {receipt.projection.known_limits.join("; ")}</small>
        </article>
      ) : null}
      <div className="candidate-list" aria-label="teacher advisory audit list">
        {audit.map((entry) => (
          <article className="candidate-card" key={entry.model_call_log_id}>
            <strong>
              {entry.provider} / {entry.model}
            </strong>
            <small>
              {entry.purpose} · {entry.status} · {entry.surface}
            </small>
            <small>
              Input {entry.input_hash.slice(0, 12)} · Output {entry.output_hash.slice(0, 12)}
            </small>
          </article>
        ))}
      </div>
      {isRetryPhase(phase) ? (
        <p className="readiness-message" role="alert">
          {message}
        </p>
      ) : null}
    </section>
  );
}
