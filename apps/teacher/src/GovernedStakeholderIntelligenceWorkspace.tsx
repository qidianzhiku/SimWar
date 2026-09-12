import { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  GSIExactBinding,
  GSIProposal,
  GSIReceipt,
  GSICrossRoundPairOptions,
  GSICrossRoundTeacherProjection
} from "@simwar/shared-contracts";
import "./gsi-xr.css";

export interface GovernedStakeholderIntelligenceWorkspaceProps {
  apiBase: string;
  binding: GSIExactBinding;
  tenantId: string;
  token: string;
  proposals?: readonly GSIProposal[];
  initialComparison?: GSICrossRoundTeacherProjection;
}

const DEFAULT_PROPOSALS: readonly GSIProposal[] = [
  {
    proposal_id: "proposal_customer_1",
    stakeholder_type: "customer",
    intent: "protect_demand",
    priority: 0.8,
    influence: 0.4,
    summary: "Customers value predictable service."
  },
  {
    proposal_id: "proposal_regulator_1",
    stakeholder_type: "regulator",
    intent: "reduce_regulatory_risk",
    priority: 0.6,
    influence: -0.2,
    summary: "Regulatory review may slow expansion."
  }
];

interface EnvelopeError {
  code?: string;
  message?: string;
}

interface ReceiptEnvelope {
  data?: GSIReceipt | EnvelopeError;
  error?: EnvelopeError;
}

interface ComparisonEnvelope {
  data?: GSICrossRoundTeacherProjection | EnvelopeError;
  error?: EnvelopeError;
}

interface PairOptionsEnvelope {
  data?: GSICrossRoundPairOptions | EnvelopeError;
  error?: EnvelopeError;
}

function isEnvelopeErrorData(value: unknown): value is EnvelopeError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof (value as { code?: unknown }).code === "string"
  );
}

function readEnvelopeError(payload: { data?: unknown; error?: EnvelopeError }): EnvelopeError {
  return payload.error ?? (isEnvelopeErrorData(payload.data) ? payload.data : {});
}

function hasEnvelopeData<T>(payload: { data?: T | EnvelopeError }): payload is { data: T } {
  return payload.data !== undefined && !isEnvelopeErrorData(payload.data);
}

type ComparisonState =
  | { kind: "unavailable"; message: string }
  | { kind: "loading" }
  | { kind: "ready"; data: GSICrossRoundTeacherProjection }
  | { kind: "rebase"; message: string }
  | { kind: "context-unavailable"; message: string }
  | { kind: "error"; message: string };

type PairOptionsState =
  | { kind: "unavailable"; message: string }
  | { kind: "loading" }
  | { kind: "ready"; data: GSICrossRoundPairOptions }
  | { kind: "error"; message: string };

const PAIR_SELECTION_MESSAGE =
  "服务器尚未提供可用的回合配对列表。请选择两个由服务器治理的精确回合，或在高级诊断中提供候选 ID。";

function comparisonStateForError(code: string | undefined, message: string): ComparisonState {
  if (code === "GSI_REBASE_REQUIRED") return { kind: "rebase", message };
  if (code === "GSI_CONTEXT_UNAVAILABLE") return { kind: "context-unavailable", message };
  return { kind: "error", message };
}

function movementLabel(direction: string): string {
  return direction === "NEW"
    ? "新增"
    : direction === "REMOVED"
      ? "移除"
      : direction === "INCREASED"
        ? "上升"
        : direction === "DECREASED"
          ? "下降"
          : "稳定";
}

function valueLabel(value: number | undefined): string {
  return value === undefined ? "未提供（不是数值 0）" : value.toFixed(3);
}

export function GovernedStakeholderIntelligenceWorkspace({
  apiBase,
  binding,
  tenantId,
  token,
  proposals = DEFAULT_PROPOSALS,
  initialComparison
}: GovernedStakeholderIntelligenceWorkspaceProps) {
  const [receipt, setReceipt] = useState<GSIReceipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCandidateId, setFromCandidateId] = useState("");
  const [toCandidateId, setToCandidateId] = useState("");
  const [fromRoundId, setFromRoundId] = useState("");
  const [toRoundId, setToRoundId] = useState("");
  const [activityId, setActivityId] = useState("activity_gsi_xr");
  const [roleKey, setRoleKey] = useState("CEO");
  const [pairOptionsState, setPairOptionsState] = useState<PairOptionsState>({
    kind: "unavailable",
    message: PAIR_SELECTION_MESSAGE
  });
  const [comparisonState, setComparisonState] = useState<ComparisonState>(
    initialComparison
      ? { kind: "ready", data: initialComparison }
      : { kind: "unavailable", message: PAIR_SELECTION_MESSAGE }
  );
  const pairOptionsRequestId = useRef(0);
  const pairOptionsController = useRef<AbortController | null>(null);
  const comparisonRequestId = useRef(0);
  const comparisonController = useRef<AbortController | null>(null);

  function invalidateComparison(): void {
    comparisonRequestId.current += 1;
    comparisonController.current?.abort();
    setComparisonState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });
  }

  useEffect(() => {
    const requestId = ++pairOptionsRequestId.current;
    pairOptionsController.current?.abort();
    comparisonRequestId.current += 1;
    comparisonController.current?.abort();
    const controller = new AbortController();
    pairOptionsController.current = controller;
    setFromCandidateId("");
    setToCandidateId("");
    setFromRoundId("");
    setToRoundId("");
    setComparisonState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });
    const query = new URLSearchParams({
      course_id: binding.course_id,
      run_id: binding.run_id,
      team_id: binding.team_id,
      activity_id: activityId.trim(),
      role_key: roleKey.trim()
    });
    setPairOptionsState({ kind: "loading" });
    void fetch(`${apiBase}/api/v1/bff/teacher/gsi/candidates/pair-options?${query.toString()}`, {
      headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
      signal: controller.signal
    })
      .then(async (response) => {
        const payload = (await response.json()) as PairOptionsEnvelope;
        if (controller.signal.aborted || requestId !== pairOptionsRequestId.current) return;
        const details = readEnvelopeError(payload);
        if (!response.ok || !hasEnvelopeData(payload)) {
          setPairOptionsState({
            kind: "error",
            message: details.message ?? "服务器回合配对暂不可用"
          });
          return;
        }
        setPairOptionsState({ kind: "ready", data: payload.data });
      })
      .catch((cause) => {
        if (
          controller.signal.aborted ||
          requestId !== pairOptionsRequestId.current ||
          (cause instanceof DOMException && cause.name === "AbortError")
        )
          return;
        setPairOptionsState({
          kind: "error",
          message: cause instanceof Error ? cause.message : "服务器回合配对暂不可用"
        });
      });
    return () => controller.abort();
  }, [
    activityId,
    apiBase,
    binding.course_id,
    binding.run_id,
    binding.team_id,
    roleKey,
    tenantId,
    token
  ]);

  async function freezeCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/api/v1/bff/teacher/gsi/candidates`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-tenant-id": tenantId
        },
        body: JSON.stringify({
          discriminator: "gsi_stakeholder_shadow_request",
          binding,
          plane_mode: "OFF",
          publication_status: "PUBLISHED",
          proposals: [...proposals],
          idempotency_key: `gsi-ui:${binding.run_id}:${binding.round_id}:${binding.team_id}`
        })
      });
      const payload = (await response.json()) as ReceiptEnvelope;
      const details = readEnvelopeError(payload);
      if (!response.ok || !hasEnvelopeData(payload)) {
        throw new Error(details.message ?? "受控利益相关方候选创建失败");
      }
      setReceipt(payload.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "受控利益相关方候选创建失败");
    } finally {
      setBusy(false);
    }
  }

  async function compareRounds(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fromRound = fromRoundId.trim();
    const toRound = toRoundId.trim();
    const from = fromCandidateId.trim();
    const to = toCandidateId.trim();
    const selectedRounds = Boolean(fromRound && toRound);
    const selectedCandidates = Boolean(from && to);
    if (!selectedRounds && !selectedCandidates) {
      comparisonRequestId.current += 1;
      comparisonController.current?.abort();
      setComparisonState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });
      return;
    }
    if (selectedRounds === selectedCandidates) {
      comparisonRequestId.current += 1;
      comparisonController.current?.abort();
      setComparisonState({
        kind: "error",
        message: "请使用两个服务器回合，或仅在高级诊断中使用两个候选 ID。"
      });
      return;
    }
    const requestId = ++comparisonRequestId.current;
    comparisonController.current?.abort();
    const controller = new AbortController();
    comparisonController.current = controller;
    setComparisonState({ kind: "loading" });
    const query = selectedRounds
      ? new URLSearchParams({
          course_id: binding.course_id,
          run_id: binding.run_id,
          team_id: binding.team_id,
          from_round_id: fromRound,
          to_round_id: toRound,
          activity_id: activityId.trim(),
          role_key: roleKey.trim()
        })
      : new URLSearchParams({
          from_candidate_id: from,
          to_candidate_id: to,
          activity_id: activityId.trim(),
          role_key: roleKey.trim()
        });
    try {
      const response = await fetch(
        `${apiBase}/api/v1/bff/teacher/gsi/candidates/compare?${query.toString()}`,
        {
          headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
          signal: controller.signal
        }
      );
      const payload = (await response.json()) as ComparisonEnvelope;
      if (controller.signal.aborted || requestId !== comparisonRequestId.current) return;
      const details = readEnvelopeError(payload);
      if (!response.ok || !hasEnvelopeData(payload)) {
        setComparisonState(
          comparisonStateForError(details.code, details.message ?? "两个回合的比较暂不可用")
        );
        return;
      }
      setComparisonState({ kind: "ready", data: payload.data });
    } catch (cause) {
      if (
        controller.signal.aborted ||
        requestId !== comparisonRequestId.current ||
        (cause instanceof DOMException && cause.name === "AbortError")
      )
        return;
      setComparisonState({
        kind: "error",
        message: cause instanceof Error ? cause.message : "两个回合的比较暂不可用"
      });
    }
  }

  function resetComparison() {
    comparisonRequestId.current += 1;
    comparisonController.current?.abort();
    setFromCandidateId("");
    setToCandidateId("");
    setFromRoundId("");
    setToRoundId("");
    setComparisonState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });
  }

  return (
    <section className="panel form-panel gsi-xr-panel" aria-label="GSI-XR cross-round workspace">
      <div className="panel-title gsi-xr-panel-title">
        <div>
          <p className="eyebrow">
            GSI-XR · Governed Stakeholder Intelligence · task-first comparison
          </p>
          <h3>对比两个回合</h3>
        </div>
        <span className="technical-compatibility">Provider OFF · read-only</span>
      </div>
      <p className="lifecycle-boundary">
        先确认精确上下文和回合配对，再查看利益相关方压力变化。变化是描述性证据，不是因果结论或正式业务结果。
      </p>
      <div className="gsi-xr-context-strip" aria-label="Exact GSI context">
        <strong>Exact context</strong>
        <span>
          tenant {binding.tenant_id} · course {binding.course_id} · run {binding.run_id} · team{" "}
          {binding.team_id}
        </span>
      </div>
      <form
        className="gsi-xr-pair-form"
        aria-label="GSI exact cross-round comparison"
        onSubmit={compareRounds}
      >
        <div className="gsi-xr-pair-heading">
          <div>
            <p className="eyebrow">Primary action</p>
            <h4>选择两个精确回合</h4>
          </div>
          <span className="gsi-xr-state-badge">READ-ONLY</span>
        </div>
        <p className="gsi-xr-muted">
          回合由服务器按当前 tenant / course / run / team
          上下文筛选；请明确选择起始和目标回合，不使用 latest、默认值或数组顺序推断。
        </p>
        <div className="gsi-xr-field-grid">
          <label>
            From round
            <select
              aria-label="GSI from round"
              value={fromRoundId}
              onChange={(event) => {
                invalidateComparison();
                setFromRoundId(event.target.value);
              }}
            >
              <option value="">选择起始回合</option>
              {pairOptionsState.kind === "ready"
                ? pairOptionsState.data.rounds.map((round) => (
                    <option key={round.round_id} value={round.round_id}>
                      Round {round.round_no}
                    </option>
                  ))
                : null}
            </select>
          </label>
          <label>
            To round
            <select
              aria-label="GSI to round"
              value={toRoundId}
              onChange={(event) => {
                invalidateComparison();
                setToRoundId(event.target.value);
              }}
            >
              <option value="">选择目标回合</option>
              {pairOptionsState.kind === "ready"
                ? pairOptionsState.data.rounds.map((round) => (
                    <option key={round.round_id} value={round.round_id}>
                      Round {round.round_no}
                    </option>
                  ))
                : null}
            </select>
          </label>
        </div>
        {pairOptionsState.kind === "loading" ? (
          <p className="gsi-xr-muted" role="status" aria-live="polite">
            正在读取服务器治理的可比较回合…
          </p>
        ) : null}
        {pairOptionsState.kind === "ready" && pairOptionsState.data.rounds.length < 2 ? (
          <div className="gsi-xr-status gsi-xr-status-warning" role="status" aria-live="polite">
            <strong>PAIR_SELECTION_UNAVAILABLE</strong>
            <p>当前还没有至少两个可比较的唯一回合。</p>
            <span>安全下一步：等待另一个合法候选发布，或重新进入 exact 课程上下文。</span>
          </div>
        ) : null}
        {pairOptionsState.kind === "error" ? (
          <div className="gsi-xr-status gsi-xr-status-warning" role="status" aria-live="polite">
            <strong>PAIR_SELECTION_UNAVAILABLE</strong>
            <p>{pairOptionsState.message}</p>
            <span>安全下一步：重新加载当前受控上下文。</span>
          </div>
        ) : null}
        <details className="gsi-xr-advanced">
          <summary>高级：输入服务器已绑定的精确候选</summary>
          <div className="gsi-xr-field-grid">
            <label>
              From candidate ID
              <input
                aria-label="GSI from candidate ID"
                value={fromCandidateId}
                onChange={(event) => {
                  invalidateComparison();
                  setFromCandidateId(event.target.value);
                }}
                placeholder="candidate_from"
              />
            </label>
            <label>
              To candidate ID
              <input
                aria-label="GSI to candidate ID"
                value={toCandidateId}
                onChange={(event) => {
                  invalidateComparison();
                  setToCandidateId(event.target.value);
                }}
                placeholder="candidate_to"
              />
            </label>
            <label>
              Activity
              <input
                aria-label="GSI activity ID"
                value={activityId}
                onChange={(event) => {
                  invalidateComparison();
                  setActivityId(event.target.value);
                }}
              />
            </label>
            <label>
              Role
              <input
                aria-label="GSI role key"
                value={roleKey}
                onChange={(event) => {
                  invalidateComparison();
                  setRoleKey(event.target.value);
                }}
              />
            </label>
          </div>
        </details>
        <div className="gsi-xr-actions">
          <button type="submit" disabled={comparisonState.kind === "loading"}>
            {comparisonState.kind === "loading" ? "正在读取…" : "读取回合变化"}
          </button>
          <button type="button" className="secondary" onClick={resetComparison}>
            重新选择
          </button>
        </div>
      </form>
      {comparisonState.kind === "unavailable" ? (
        <div className="gsi-xr-status gsi-xr-status-warning" role="status" aria-live="polite">
          <strong>PAIR_SELECTION_UNAVAILABLE</strong>
          <p>{comparisonState.message}</p>
          <p>安全下一步：重新加载服务器回合列表，或由有权限的教师使用高级 exact candidate 诊断。</p>
        </div>
      ) : null}
      {comparisonState.kind === "rebase" ? (
        <div className="gsi-xr-status gsi-xr-status-error" role="alert">
          <strong>REBASE_REQUIRED</strong>
          <p>{comparisonState.message}</p>
          <button type="button" className="secondary" onClick={resetComparison}>
            重新选择精确回合
          </button>
        </div>
      ) : null}
      {comparisonState.kind === "context-unavailable" ? (
        <div className="gsi-xr-status gsi-xr-status-warning" role="status" aria-live="polite">
          <strong>CONTEXT_UNAVAILABLE</strong>
          <p>{comparisonState.message}</p>
          <p>变化仍保持描述性；可等待发布或重新加载 exact context。</p>
        </div>
      ) : null}
      {comparisonState.kind === "error" ? (
        <div className="gsi-xr-status gsi-xr-status-error" role="alert">
          <strong>比较暂不可用</strong>
          <p>{comparisonState.message}</p>
        </div>
      ) : null}
      {comparisonState.kind === "ready" ? (
        <article className="gsi-xr-result" aria-label="GSI cross-round comparison result">
          <div className="gsi-xr-result-heading">
            <div>
              <p className="eyebrow">Movement summary</p>
              <h4>
                Round {comparisonState.data.comparison.pair.from.round_no} ↔ Round{" "}
                {comparisonState.data.comparison.pair.to.round_no}
              </h4>
            </div>
            <span className="gsi-xr-state-badge">{comparisonState.data.context.status}</span>
          </div>
          <p className="gsi-xr-non-causal">
            NON-CAUSAL · causal_proof=false · Provider OFF · official_truth_write=false
          </p>
          <ul className="gsi-xr-movement-list">
            {comparisonState.data.comparison.movements.map((movement) => (
              <li key={movement.signal_key}>
                <div>
                  <strong>{movementLabel(movement.direction)}</strong>
                  <span className="gsi-xr-direction-code">{movement.direction}</span>
                  <span>
                    {movement.stakeholder_type} / {movement.intent}
                  </span>
                </div>
                <span>
                  {valueLabel(movement.from_value)} → {valueLabel(movement.to_value)}
                  {movement.delta === undefined ? "" : ` · Δ ${movement.delta.toFixed(3)}`}
                </span>
              </li>
            ))}
          </ul>
          <div className="gsi-xr-context-note">
            <strong>Context / Evidence</strong>
            <span>
              {comparisonState.data.context.status === "AVAILABLE"
                ? "W3 / M2P5 context is available as read-only evidence."
                : "W3 / M2P5 context is unavailable or waiting for publication."}
            </span>
          </div>
          <details className="gsi-xr-limit-details">
            <summary>查看限制与恢复</summary>
            <ul>
              {comparisonState.data.known_limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </details>
        </article>
      ) : null}
      {error ? (
        <p role="alert" className="lifecycle-error">
          {error}
        </p>
      ) : null}
      <details className="gsi-xr-legacy">
        <summary>高级：生成本轮候选（保留既有只读边界）</summary>
        <p className="gsi-xr-muted">
          此动作只创建 Provider-OFF candidate；不会写入正式状态、结算、评分或回放真值。
        </p>
        <form onSubmit={freezeCandidate}>
          <p className="lifecycle-status">
            本次演示将提交 {proposals.length} 个有界 stakeholder proposal。
          </p>
          <button type="submit" disabled={busy}>
            {busy ? "正在冻结…" : "冻结受控利益相关方候选"}
          </button>
        </form>
      </details>
      {receipt ? (
        <article className="candidate-preview" aria-label="GSI candidate receipt">
          <h4>候选已冻结并可供角色投影</h4>
          <p>
            candidate_id: <code>{receipt.candidate_id}</code>
          </p>
          <p>
            candidate_digest: <code>{receipt.resolver.candidate_digest}</code>
          </p>
          <p>
            Provider: {receipt.provider} · publication: {receipt.publication_status}
          </p>
          <p>不会写入正式状态、结算、评分或回放真值。</p>
          <ul>
            {receipt.resolver.signals.map((signal) => (
              <li key={signal.signal_id}>
                {signal.stakeholder_type} / {signal.intent}: {signal.bounded_value}
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </section>
  );
}
