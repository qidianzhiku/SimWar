import { useRef, useState, type FormEvent } from "react";
import type {
  GSIAdminProjection,
  GSICrossRoundAdminProjection,
  GSICrossRoundPairOptions
} from "@simwar/shared-contracts";
import "./gsi-xr.css";

export const GSI_AUDIT_PATH = "/api/v1/bff/admin/gsi/audit";
const PAIR_SELECTION_MESSAGE =
  "服务器尚未提供可用的回合配对列表。请先提供受控课程、运行和队伍上下文，再选择两个精确回合。";

export interface GovernedStakeholderIntelligenceAuditPanelProps {
  apiBase: string;
  tenantId: string;
  token: string;
  initialCandidateId?: string;
  initialComparison?: GSICrossRoundAdminProjection;
}

interface EnvelopeError {
  code?: string;
  message?: string;
}

interface AuditEnvelope {
  data?: GSIAdminProjection | EnvelopeError;
  error?: EnvelopeError;
}

interface ComparisonEnvelope {
  data?: GSICrossRoundAdminProjection | EnvelopeError;
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
  | { kind: "ready"; data: GSICrossRoundAdminProjection }
  | { kind: "rebase"; message: string }
  | { kind: "context-unavailable"; message: string }
  | { kind: "error"; message: string };

type PairOptionsState =
  | { kind: "unavailable"; message: string }
  | { kind: "loading" }
  | { kind: "ready"; data: GSICrossRoundPairOptions }
  | { kind: "error"; message: string };

function stateForError(code: string | undefined, message: string): ComparisonState {
  if (code === "GSI_REBASE_REQUIRED") return { kind: "rebase", message };
  if (code === "GSI_CONTEXT_UNAVAILABLE") return { kind: "context-unavailable", message };
  return { kind: "error", message };
}

function directionLabel(direction: string): string {
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

function renderValue(value: number | undefined): string {
  return value === undefined ? "未提供（不是数值 0）" : value.toFixed(3);
}

export function GovernedStakeholderIntelligenceAuditPanel({
  apiBase,
  tenantId,
  token,
  initialCandidateId = "",
  initialComparison
}: GovernedStakeholderIntelligenceAuditPanelProps) {
  const [candidateId, setCandidateId] = useState(initialCandidateId);
  const [projection, setProjection] = useState<GSIAdminProjection | null>(null);
  const [courseId, setCourseId] = useState("");
  const [runId, setRunId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [fromCandidateId, setFromCandidateId] = useState("");
  const [toCandidateId, setToCandidateId] = useState("");
  const [fromRoundId, setFromRoundId] = useState("");
  const [toRoundId, setToRoundId] = useState("");
  const [activityId, setActivityId] = useState("activity_gsi_xr");
  const [roleKey, setRoleKey] = useState("CEO");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparisonState, setComparisonState] = useState<ComparisonState>(
    initialComparison
      ? { kind: "ready", data: initialComparison }
      : { kind: "unavailable", message: PAIR_SELECTION_MESSAGE }
  );
  const [pairOptionsState, setPairOptionsState] = useState<PairOptionsState>({
    kind: "unavailable",
    message: PAIR_SELECTION_MESSAGE
  });
  const pairOptionsRequestId = useRef(0);
  const pairOptionsController = useRef<AbortController | null>(null);
  const comparisonRequestId = useRef(0);
  const comparisonController = useRef<AbortController | null>(null);

  function invalidateComparisonSelection(): void {
    comparisonRequestId.current += 1;
    comparisonController.current?.abort();
    setComparisonState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });
  }

  function invalidateContextSelection(): void {
    pairOptionsRequestId.current += 1;
    pairOptionsController.current?.abort();
    invalidateComparisonSelection();
    setPairOptionsState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });
    setFromRoundId("");
    setToRoundId("");
  }

  async function loadPairOptions() {
    const requestId = ++pairOptionsRequestId.current;
    pairOptionsController.current?.abort();
    const context = {
      course_id: courseId.trim(),
      run_id: runId.trim(),
      team_id: teamId.trim(),
      activity_id: activityId.trim(),
      role_key: roleKey.trim()
    };
    if (Object.values(context).some((value) => !value)) {
      comparisonRequestId.current += 1;
      comparisonController.current?.abort();
      setPairOptionsState({
        kind: "unavailable",
        message: "请先提供完整的受控课程、运行、队伍、活动和角色上下文。"
      });
      return;
    }
    comparisonRequestId.current += 1;
    comparisonController.current?.abort();
    setFromRoundId("");
    setToRoundId("");
    setComparisonState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });
    setPairOptionsState({ kind: "loading" });
    const controller = new AbortController();
    pairOptionsController.current = controller;
    try {
      const query = new URLSearchParams(context);
      const response = await fetch(
        `${apiBase}/api/v1/bff/admin/gsi/candidates/pair-options?${query.toString()}`,
        {
          headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
          signal: controller.signal
        }
      );
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
      setFromRoundId("");
      setToRoundId("");
      setComparisonState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });
    } catch (cause) {
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
    }
  }

  async function loadAudit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = candidateId.trim();
    if (!id) {
      setError("请输入候选 ID。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `${apiBase}${GSI_AUDIT_PATH}?candidate_id=${encodeURIComponent(id)}`,
        { headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId } }
      );
      const payload = (await response.json()) as AuditEnvelope;
      const details = readEnvelopeError(payload);
      if (!response.ok || !hasEnvelopeData(payload)) {
        throw new Error(details.message ?? "利益相关方审计加载失败");
      }
      setProjection(payload.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "利益相关方审计加载失败");
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
          course_id: courseId.trim(),
          run_id: runId.trim(),
          team_id: teamId.trim(),
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
        `${apiBase}/api/v1/bff/admin/gsi/candidates/compare?${query.toString()}`,
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
          stateForError(details.code, details.message ?? "两个回合的审计比较暂不可用")
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
        message: cause instanceof Error ? cause.message : "两个回合的审计比较暂不可用"
      });
    }
  }

  function resetComparison() {
    comparisonRequestId.current += 1;
    comparisonController.current?.abort();
    pairOptionsRequestId.current += 1;
    pairOptionsController.current?.abort();
    setFromCandidateId("");
    setToCandidateId("");
    setFromRoundId("");
    setToRoundId("");
    setComparisonState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });
  }

  return (
    <section className="panel form-panel gsi-xr-panel" aria-label="GSI-XR admin audit workspace">
      <div className="panel-title gsi-xr-panel-title">
        <div>
          <p className="eyebrow">GSI-XR · admin audit / secondary evidence</p>
          <h3>审计两个回合</h3>
        </div>
        <span className="technical-compatibility">read-only · Provider OFF</span>
      </div>
      <p className="lifecycle-boundary">
        管理员先查看选定租户和比较状态，再展开技术来源。此面板只读，不写入正式 Decision / Settlement
        / Outcome。
      </p>
      <div className="gsi-xr-context-strip" aria-label="Admin selected tenant context">
        <strong>Selected tenant</strong>
        <span>{tenantId} · tenant echo must match the authorized request context</span>
      </div>
      <form
        className="gsi-xr-pair-form"
        aria-label="GSI admin exact cross-round comparison"
        onSubmit={compareRounds}
      >
        <div className="gsi-xr-pair-heading">
          <div>
            <p className="eyebrow">Primary audit task</p>
            <span className="gsi-xr-legacy-heading">利益相关方候选审计</span>
            <h4>选择两个精确回合</h4>
          </div>
          <span className="gsi-xr-state-badge">NO-WRITE · writes_official_truth=false</span>
        </div>
        <p className="gsi-xr-muted">
          先提交明确的课程、运行和队伍上下文，再由服务器返回可比较回合；不会根据
          latest、默认值或缓存顺序选择。
        </p>
        <div className="gsi-xr-field-grid">
          <label>
            Course context
            <input
              aria-label="GSI admin course context"
              value={courseId}
              onChange={(event) => {
                invalidateContextSelection();
                setCourseId(event.target.value);
              }}
              placeholder="course_id"
            />
          </label>
          <label>
            Run context
            <input
              aria-label="GSI admin run context"
              value={runId}
              onChange={(event) => {
                invalidateContextSelection();
                setRunId(event.target.value);
              }}
              placeholder="run_id"
            />
          </label>
          <label>
            Team context
            <input
              aria-label="GSI admin team context"
              value={teamId}
              onChange={(event) => {
                invalidateContextSelection();
                setTeamId(event.target.value);
              }}
              placeholder="team_id"
            />
          </label>
        </div>
        <div className="gsi-xr-actions">
          <button type="button" onClick={() => void loadPairOptions()}>
            {pairOptionsState.kind === "loading" ? "正在加载回合…" : "加载可比较回合"}
          </button>
        </div>
        {pairOptionsState.kind === "ready" ? (
          <div className="gsi-xr-field-grid">
            <label>
              From round
              <select
                aria-label="GSI admin from round"
                value={fromRoundId}
                onChange={(event) => {
                  invalidateComparisonSelection();
                  setFromRoundId(event.target.value);
                }}
              >
                <option value="">选择起始回合</option>
                {pairOptionsState.data.rounds.map((round) => (
                  <option key={round.round_id} value={round.round_id}>
                    Round {round.round_no}
                  </option>
                ))}
              </select>
            </label>
            <label>
              To round
              <select
                aria-label="GSI admin to round"
                value={toRoundId}
                onChange={(event) => {
                  invalidateComparisonSelection();
                  setToRoundId(event.target.value);
                }}
              >
                <option value="">选择目标回合</option>
                {pairOptionsState.data.rounds.map((round) => (
                  <option key={round.round_id} value={round.round_id}>
                    Round {round.round_no}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        {pairOptionsState.kind === "ready" && pairOptionsState.data.rounds.length < 2 ? (
          <div className="gsi-xr-status gsi-xr-status-warning" role="status" aria-live="polite">
            <strong>PAIR_SELECTION_UNAVAILABLE</strong>
            <p>当前上下文没有至少两个唯一可比较回合。</p>
          </div>
        ) : null}
        {pairOptionsState.kind === "error" ? (
          <div className="gsi-xr-status gsi-xr-status-warning" role="status" aria-live="polite">
            <strong>PAIR_SELECTION_UNAVAILABLE</strong>
            <p>{pairOptionsState.message}</p>
          </div>
        ) : null}
        <details className="gsi-xr-advanced">
          <summary>高级：输入精确候选配对</summary>
          <div className="gsi-xr-field-grid">
            <label>
              From candidate ID
              <input
                aria-label="GSI admin from candidate ID"
                value={fromCandidateId}
                onChange={(event) => {
                  invalidateComparisonSelection();
                  setFromCandidateId(event.target.value);
                }}
                placeholder="candidate_from"
              />
            </label>
            <label>
              To candidate ID
              <input
                aria-label="GSI admin to candidate ID"
                value={toCandidateId}
                onChange={(event) => {
                  invalidateComparisonSelection();
                  setToCandidateId(event.target.value);
                }}
                placeholder="candidate_to"
              />
            </label>
            <label>
              Activity
              <input
                aria-label="GSI admin activity ID"
                value={activityId}
                onChange={(event) => {
                  invalidateContextSelection();
                  setActivityId(event.target.value);
                }}
              />
            </label>
            <label>
              Role
              <input
                aria-label="GSI admin role key"
                value={roleKey}
                onChange={(event) => {
                  invalidateContextSelection();
                  setRoleKey(event.target.value);
                }}
              />
            </label>
          </div>
        </details>
        <div className="gsi-xr-actions">
          <button type="submit" disabled={comparisonState.kind === "loading"}>
            {comparisonState.kind === "loading" ? "正在读取…" : "读取审计变化"}
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
          <p>
            安全下一步：先加载当前授权上下文的回合列表，或由有权限的管理员使用高级 exact candidate
            诊断。
          </p>
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
        </div>
      ) : null}
      {comparisonState.kind === "error" ? (
        <div className="gsi-xr-status gsi-xr-status-error" role="alert">
          <strong>比较暂不可用</strong>
          <p>{comparisonState.message}</p>
        </div>
      ) : null}
      {comparisonState.kind === "ready" ? (
        <article className="gsi-xr-result" aria-label="GSI admin cross-round comparison result">
          <div className="gsi-xr-result-heading">
            <div>
              <p className="eyebrow">Movement evidence</p>
              <h4>
                Round {comparisonState.data.comparison.pair.from.round_no} ↔ Round{" "}
                {comparisonState.data.comparison.pair.to.round_no}
              </h4>
            </div>
            <span className="gsi-xr-state-badge">{comparisonState.data.context.status}</span>
          </div>
          <p className="gsi-xr-non-causal">
            NON-CAUSAL · causal_proof=false · official_truth_write=false
          </p>
          <div className="gsi-xr-admin-provenance">
            <strong>Exact pair provenance</strong>
            <span>
              {comparisonState.data.comparison.pair.from.candidate_id} →{" "}
              {comparisonState.data.comparison.pair.to.candidate_id}
            </span>
            <span>tenant echo: {comparisonState.data.tenant_id}</span>
            <span>
              context_binding: {JSON.stringify(comparisonState.data.context.context_binding)}
            </span>
          </div>
          <ul className="gsi-xr-movement-list">
            {comparisonState.data.comparison.movements.map((movement) => (
              <li key={movement.signal_key}>
                <div>
                  <strong>{directionLabel(movement.direction)}</strong>
                  <span>
                    {movement.stakeholder_type} / {movement.intent}
                  </span>
                </div>
                <span>
                  {renderValue(movement.from_value)} → {renderValue(movement.to_value)}
                  {movement.delta === undefined ? "" : ` · Δ ${movement.delta.toFixed(3)}`}
                </span>
              </li>
            ))}
          </ul>
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
        <summary>高级：单候选审计回退</summary>
        <p className="gsi-xr-muted">保留既有 exact candidate 审计读取；此路径仍为只读。</p>
        <form onSubmit={loadAudit}>
          <label>
            候选 ID
            <input
              aria-label="GSI audit candidate ID"
              value={candidateId}
              onChange={(event) => setCandidateId(event.target.value)}
              placeholder="gsi_candidate_…"
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "正在查询…" : "查询候选审计"}
          </button>
        </form>
      </details>
      {projection ? (
        <article className="candidate-preview" aria-label="GSI audit projection">
          <h4>候选审计摘要</h4>
          <dl>
            <div>
              <dt>provider</dt>
              <dd>{projection.provider}</dd>
            </div>
            <div>
              <dt>plane_mode</dt>
              <dd>{projection.plane_mode}</dd>
            </div>
            <div>
              <dt>writes_official_truth</dt>
              <dd>{String(projection.writes_official_truth)}</dd>
            </div>
            <div>
              <dt>resolver_digest</dt>
              <dd>
                <code>{projection.resolver_digest}</code>
              </dd>
            </div>
            <div>
              <dt>signal_digest</dt>
              <dd>
                <code>{projection.signal_digest}</code>
              </dd>
            </div>
            <div>
              <dt>candidate_digest</dt>
              <dd>
                <code>{projection.candidate_digest}</code>
              </dd>
            </div>
          </dl>
        </article>
      ) : null}
    </section>
  );
}
