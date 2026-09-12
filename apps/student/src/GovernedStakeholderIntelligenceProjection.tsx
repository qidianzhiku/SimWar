import { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  GSIStudentProjection,
  GSICrossRoundPairOptions,
  GSICrossRoundSelectionContext,
  GSICrossRoundStudentProjection
} from "@simwar/shared-contracts";
import "./gsi-xr.css";

export interface GovernedStakeholderIntelligenceProjectionProps {
  apiBase: string;
  tenantId: string;
  token: string;
  /** The server-authorized context used to obtain safe round options. */
  selectionContext?:
    | Pick<
        GSICrossRoundSelectionContext,
        "course_id" | "run_id" | "team_id" | "activity_id" | "role_key"
      >
    | undefined;
  initialProjection?: GSIStudentProjection;
  initialComparison?: GSICrossRoundStudentProjection;
}

interface EnvelopeError {
  code?: string;
  message?: string;
}

interface PairOptionsEnvelope {
  data?: GSICrossRoundPairOptions | EnvelopeError;
  error?: EnvelopeError;
}

interface ComparisonEnvelope {
  data?: GSICrossRoundStudentProjection | EnvelopeError;
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

type PairOptionsState =
  | { kind: "unavailable"; message: string }
  | { kind: "loading" }
  | { kind: "ready"; data: GSICrossRoundPairOptions }
  | { kind: "error"; message: string };

type ComparisonState =
  | { kind: "unavailable"; message: string }
  | { kind: "loading" }
  | { kind: "ready"; data: GSICrossRoundStudentProjection }
  | { kind: "rebase"; message: string }
  | { kind: "context-unavailable"; message: string }
  | { kind: "error"; message: string };

const PAIR_SELECTION_MESSAGE = "当前还没有可比较的已发布回合。请返回课程上下文后再查看本轮变化。";

function statusCopy(status: GSICrossRoundStudentProjection["context_status"]): string {
  switch (status) {
    case "AVAILABLE":
      return "上下文已就绪";
    case "CONTEXT_UNAVAILABLE":
      return "业务上下文暂不可用";
    case "REBASE_REQUIRED":
      return "上下文已变化，需要重新进入课程";
    default:
      return status;
  }
}

function comparisonStateForError(code: string | undefined, message: string): ComparisonState {
  if (code === "GSI_REBASE_REQUIRED") return { kind: "rebase", message };
  if (code === "GSI_CONTEXT_UNAVAILABLE") return { kind: "context-unavailable", message };
  if (code === "GSI_PAIR_NOT_AVAILABLE" || code === "GSI_PAIR_AMBIGUOUS") {
    return { kind: "unavailable", message: PAIR_SELECTION_MESSAGE };
  }
  return { kind: "error", message };
}

function ComparisonTimeline({ comparison }: { comparison: GSICrossRoundStudentProjection }) {
  return (
    <>
      <div className="gsi-xr-context-strip" role="status" aria-live="polite">
        <span>{statusCopy(comparison.context_status)}</span>
        <span className="gsi-xr-badge">NON-CAUSAL</span>
      </div>
      <ol className="gsi-xr-timeline" aria-label="Stakeholder pressure movement">
        {comparison.movements.map((movement, index) => (
          <li
            key={`${movement.stakeholder_type}-${movement.intent}-${index}`}
            className="gsi-xr-timeline-item"
          >
            <div className="gsi-xr-timeline-marker" aria-hidden="true" />
            <div>
              <strong>{movement.stakeholder_type} 的压力变化</strong>
              <p>{movement.intent}</p>
              <span className="gsi-xr-direction">{movement.direction}</span>
              {movement.from_value !== undefined && movement.to_value !== undefined ? (
                <span className="gsi-xr-value-change">
                  {movement.from_value} → {movement.to_value}
                  {movement.delta !== undefined ? `（变化 ${movement.delta}）` : ""}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <aside className="gsi-xr-reflection" aria-label="Reflection prompt">
        <strong>想一想</strong>
        <p>哪些压力变了，它会怎样影响你的下一步判断？</p>
      </aside>
      <div className="gsi-xr-boundary-grid">
        <div>
          <span className="eyebrow">学习边界</span>
          <ul>
            {comparison.known_limits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
            <li>不会写入正式 Truth、Settlement、Score 或 Rank</li>
          </ul>
        </div>
        <div>
          <span className="eyebrow">下一步</span>
          <p>
            {comparison.recovery === "WAIT_FOR_PUBLICATION"
              ? "等待课程内容发布后再查看。"
              : "回到当前课程上下文后重新查看。"}
          </p>
        </div>
      </div>
    </>
  );
}

export function GovernedStakeholderIntelligenceProjection({
  apiBase,
  tenantId,
  token,
  selectionContext,
  initialProjection,
  initialComparison
}: GovernedStakeholderIntelligenceProjectionProps) {
  const [fromRoundId, setFromRoundId] = useState("");
  const [toRoundId, setToRoundId] = useState("");
  const [pairOptionsState, setPairOptionsState] = useState<PairOptionsState>(
    selectionContext
      ? { kind: "loading" }
      : { kind: "unavailable", message: PAIR_SELECTION_MESSAGE }
  );
  const [comparisonState, setComparisonState] = useState<ComparisonState>(
    initialComparison
      ? { kind: "ready", data: initialComparison }
      : { kind: "unavailable", message: PAIR_SELECTION_MESSAGE }
  );
  const comparisonRequestId = useRef(0);
  const comparisonController = useRef<AbortController | null>(null);
  const pairOptionsRequestId = useRef(0);
  const pairOptionsController = useRef<AbortController | null>(null);

  useEffect(() => {
    const requestId = ++pairOptionsRequestId.current;
    pairOptionsController.current?.abort();
    comparisonRequestId.current += 1;
    comparisonController.current?.abort();
    if (initialComparison || !selectionContext) {
      setPairOptionsState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });
      setFromRoundId("");
      setToRoundId("");
      setComparisonState(
        initialComparison
          ? { kind: "ready", data: initialComparison }
          : { kind: "unavailable", message: PAIR_SELECTION_MESSAGE }
      );
      return;
    }

    const controller = new AbortController();
    pairOptionsController.current = controller;
    const query = new URLSearchParams(selectionContext);
    setPairOptionsState({ kind: "loading" });
    setFromRoundId("");
    setToRoundId("");
    setComparisonState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });

    void fetch(`${apiBase}/api/v1/bff/student/gsi/candidates/pair-options?${query.toString()}`, {
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
    apiBase,
    initialComparison,
    selectionContext?.activity_id,
    selectionContext?.course_id,
    selectionContext?.role_key,
    selectionContext?.run_id,
    selectionContext?.team_id,
    tenantId,
    token
  ]);

  async function compareRounds(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const from = fromRoundId.trim();
    const to = toRoundId.trim();
    if (!selectionContext || !from || !to) {
      setComparisonState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });
      return;
    }
    if (from === to) {
      setComparisonState({
        kind: "error",
        message: "请选择两个不同的服务器治理回合。"
      });
      return;
    }

    const requestId = ++comparisonRequestId.current;
    comparisonController.current?.abort();
    const controller = new AbortController();
    comparisonController.current = controller;
    setComparisonState({ kind: "loading" });
    const query = new URLSearchParams({
      ...selectionContext,
      from_round_id: from,
      to_round_id: to
    });

    try {
      const response = await fetch(
        `${apiBase}/api/v1/bff/student/gsi/candidates/compare?${query.toString()}`,
        {
          headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
          signal: controller.signal
        }
      );
      const payload = (await response.json()) as ComparisonEnvelope;
      if (requestId !== comparisonRequestId.current) return;
      const details = readEnvelopeError(payload);
      if (!response.ok || !hasEnvelopeData(payload)) {
        setComparisonState(
          comparisonStateForError(details.code, details.message ?? "两个回合的变化暂不可用")
        );
        return;
      }
      setComparisonState({ kind: "ready", data: payload.data });
    } catch (cause) {
      if (controller.signal.aborted || requestId !== comparisonRequestId.current) return;
      setComparisonState({
        kind: "error",
        message: cause instanceof Error ? cause.message : "两个回合的变化暂不可用"
      });
    }
  }

  function resetComparison(): void {
    comparisonRequestId.current += 1;
    comparisonController.current?.abort();
    setFromRoundId("");
    setToRoundId("");
    setComparisonState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });
  }

  function invalidateComparisonSelection(): void {
    comparisonRequestId.current += 1;
    comparisonController.current?.abort();
    setComparisonState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });
  }

  if (initialComparison) {
    return (
      <section
        className="panel form-panel gsi-xr-panel"
        aria-label="Student cross-round stakeholder reflection"
      >
        <div className="panel-title">
          <div>
            <p className="eyebrow">Student · decision-learning timeline</p>
            <h3>查看本轮变化</h3>
          </div>
          <span className="technical-compatibility">Provider OFF</span>
        </div>
        <p className="lifecycle-boundary">
          这里只显示已发布、按当前角色裁剪的变化摘要。它用于帮助你反思下一步，不代表正式决策、结果或因果结论。
        </p>
        <ComparisonTimeline comparison={initialComparison} />
      </section>
    );
  }

  if (initialProjection) {
    return (
      <section
        className="panel form-panel gsi-xr-panel"
        aria-label="Student governed stakeholder projection"
      >
        <div className="panel-title">
          <div>
            <p className="eyebrow">Student · role-safe view</p>
            <h3>利益相关方信号学习投影</h3>
          </div>
          <span className="technical-compatibility">Provider OFF</span>
        </div>
        <p className="lifecycle-boundary">
          学员只接收已发布、按角色裁剪的 bounded signal；proposal 原文和教师/管理员 provenance
          不在此投影中。
        </p>
        <article className="candidate-preview" aria-label="Student GSI projection">
          <h4>角色：{initialProjection.role_key ?? "已授权角色"}</h4>
          <p>{initialProjection.summary}</p>
          <ul>
            {initialProjection.signals.map((signal) => (
              <li key={`${signal.stakeholder_type}-${signal.intent}`}>
                {signal.stakeholder_type} / {signal.intent}: {signal.bounded_value}
              </li>
            ))}
          </ul>
          {initialProjection.abstentions.length ? (
            <p className="lifecycle-status">
              有 {initialProjection.abstentions.length} 项信号在有界规则下未采纳。
            </p>
          ) : null}
          <details>
            <summary>查看学习边界</summary>
            <ul>
              {initialProjection.known_limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </details>
        </article>
      </section>
    );
  }

  const pairOptions = pairOptionsState.kind === "ready" ? pairOptionsState.data.rounds : [];
  const pairUnavailable = pairOptionsState.kind === "error" || pairOptions.length < 2;

  return (
    <section
      className="panel form-panel gsi-xr-panel"
      aria-label="Student cross-round stakeholder reflection"
    >
      <div className="panel-title">
        <div>
          <p className="eyebrow">Student · decision-learning timeline</p>
          <h3>查看本轮变化</h3>
        </div>
        <span className="technical-compatibility">Provider OFF · read-only</span>
      </div>
      <p className="lifecycle-boundary">
        这里只显示服务器确认发布且匹配当前角色的变化摘要。它用于帮助你反思下一步，不代表正式决策、结果或因果结论。
      </p>
      <form
        className="gsi-xr-pair-form"
        aria-label="Student exact cross-round comparison"
        onSubmit={compareRounds}
      >
        <div className="gsi-xr-pair-heading">
          <div>
            <p className="eyebrow">Reflection action</p>
            <h4>选择两个已发布回合</h4>
          </div>
          <span className="gsi-xr-state-badge">READ-ONLY</span>
        </div>
        <p className="gsi-xr-muted">
          回合由服务器按当前课程、运行、队伍和角色筛选；请明确选择起始和目标回合，不使用默认顺序推断。
        </p>
        <div className="gsi-xr-field-grid">
          <label>
            From round
            <select
              aria-label="Student from round"
              value={fromRoundId}
              onChange={(event) => {
                invalidateComparisonSelection();
                setFromRoundId(event.target.value);
              }}
              disabled={pairOptionsState.kind !== "ready" || pairOptions.length < 2}
            >
              <option value="">选择起始回合</option>
              {pairOptions.map((round) => (
                <option key={round.round_id} value={round.round_id}>
                  Round {round.round_no}
                </option>
              ))}
            </select>
          </label>
          <label>
            To round
            <select
              aria-label="Student to round"
              value={toRoundId}
              onChange={(event) => {
                invalidateComparisonSelection();
                setToRoundId(event.target.value);
              }}
              disabled={pairOptionsState.kind !== "ready" || pairOptions.length < 2}
            >
              <option value="">选择目标回合</option>
              {pairOptions.map((round) => (
                <option key={round.round_id} value={round.round_id}>
                  Round {round.round_no}
                </option>
              ))}
            </select>
          </label>
        </div>
        {pairOptionsState.kind === "loading" ? (
          <p className="gsi-xr-muted" role="status" aria-live="polite">
            正在读取已发布的可比较回合…
          </p>
        ) : null}
        {pairUnavailable ? (
          <div className="gsi-xr-status gsi-xr-status-warning" role="status" aria-live="polite">
            <strong>PAIR_SELECTION_UNAVAILABLE</strong>
            <p>
              {pairOptionsState.kind === "error"
                ? pairOptionsState.message
                : PAIR_SELECTION_MESSAGE}
            </p>
            <span>安全下一步：返回课程上下文并等待两个已发布、角色匹配的回合。</span>
          </div>
        ) : null}
        <div className="gsi-xr-actions">
          <button type="submit" disabled={comparisonState.kind === "loading" || pairUnavailable}>
            {comparisonState.kind === "loading" ? "正在读取…" : "查看变化"}
          </button>
          <button type="button" className="secondary" onClick={resetComparison}>
            重新选择
          </button>
        </div>
      </form>
      {comparisonState.kind === "unavailable" && !pairUnavailable ? (
        <div className="gsi-xr-status gsi-xr-status-warning" role="status" aria-live="polite">
          <strong>PAIR_SELECTION_UNAVAILABLE</strong>
          <p>{comparisonState.message}</p>
        </div>
      ) : null}
      {comparisonState.kind === "rebase" ? (
        <div className="gsi-xr-status gsi-xr-status-error" role="alert">
          <strong>REBASE_REQUIRED</strong>
          <p>课程上下文或内容已经变化，请重新选择回合。</p>
          <button type="button" className="secondary" onClick={resetComparison}>
            重新选择精确回合
          </button>
        </div>
      ) : null}
      {comparisonState.kind === "context-unavailable" ? (
        <div className="gsi-xr-status gsi-xr-status-warning" role="status" aria-live="polite">
          <strong>CONTEXT_UNAVAILABLE</strong>
          <p>当前课程上下文暂不可用，变化摘要不会被当作空结果展示。</p>
          <button type="button" className="secondary" onClick={resetComparison}>
            返回并重新进入课程
          </button>
        </div>
      ) : null}
      {comparisonState.kind === "error" ? (
        <div className="gsi-xr-status gsi-xr-status-error" role="alert">
          <strong>暂时无法读取变化</strong>
          <p>{comparisonState.message}</p>
          <button type="button" className="secondary" onClick={resetComparison}>
            安全恢复
          </button>
        </div>
      ) : null}
      {comparisonState.kind === "ready" ? (
        <ComparisonTimeline comparison={comparisonState.data} />
      ) : null}
    </section>
  );
}
