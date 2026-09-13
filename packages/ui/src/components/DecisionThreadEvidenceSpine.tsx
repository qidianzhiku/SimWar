import { useEffect, useRef, useState } from "react";
import type {
  DdtEvidenceSourceName,
  DdtEvidenceSpineResponse,
  DdtExactContext,
  DdtSelectedRoundPair,
  DdtSurface
} from "@simwar/shared-contracts";
import type { GSICrossRoundPairOptions } from "@simwar/shared-contracts";

const SOURCE_LABELS: Record<DdtEvidenceSourceName, string> = {
  M2P6: "决策学习",
  MODEL_QUALIFICATION: "模型资格",
  STRATEGIC_PORTFOLIO: "战略组合",
  INDUSTRY_MODEL: "行业模型",
  GSI: "利益相关者变化"
};

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "可用",
  LIMITED: "部分可用",
  CONTEXT_UNAVAILABLE: "上下文不可用",
  REBASE_REQUIRED: "需要重新绑定",
  STALE: "数据已过期"
};

const STATUS_MESSAGES: Record<string, string> = {
  CONTEXT_UNAVAILABLE: "当前证据没有足够的精确上下文。请从受控上下文重新选择。",
  REBASE_REQUIRED: "证据绑定已变化，请重新加载当前上下文后再查看。",
  STALE: "这份证据不是当前上下文的最新版本。请重新加载当前上下文。"
};

export interface DecisionThreadEvidenceSpineProps {
  apiBase: string;
  token: string;
  tenantId: string;
  surface: DdtSurface;
  context?: DdtExactContext | undefined;
  heading?: string;
  onRecover?: (() => void) | undefined;
  onReauthenticate?: (() => void) | undefined;
  onRebind?: (() => void) | undefined;
}

type ViewState =
  | { kind: "idle" | "loading" }
  | { kind: "ready" | "stale" | "recovered"; data: DdtEvidenceSpineResponse }
  | { kind: "context-unavailable" | "rebase" | "permission-denied" | "error"; message: string };

type OptionsState =
  | { kind: "idle" | "loading" }
  | { kind: "ready"; data: GSICrossRoundPairOptions }
  | { kind: "error"; message: string };

interface ErrorPayload {
  code?: unknown;
  message?: unknown;
  data?: { code?: unknown; message?: unknown };
}

class DdtHttpError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "DdtHttpError";
  }
}

function contextKey(context: DdtExactContext | undefined): string {
  if (!context) return "missing";
  return JSON.stringify([
    context.tenant_id,
    context.course_id,
    context.run_id,
    context.team_id,
    context.round_id,
    context.round_no,
    context.role_key,
    context.activity_id
  ]);
}

function queryForContext(context: DdtExactContext): string {
  return new URLSearchParams({
    activity_id: context.activity_id,
    course_id: context.course_id,
    role_key: context.role_key,
    round_id: context.round_id,
    round_no: String(context.round_no),
    run_id: context.run_id,
    team_id: context.team_id
  }).toString();
}

function readError(payload: ErrorPayload, fallback: string): { code: string; message: string } {
  const nested = payload.data;
  const code = typeof payload.code === "string" ? payload.code : nested?.code;
  const message = typeof payload.message === "string" ? payload.message : nested?.message;
  return {
    code: typeof code === "string" ? code : "DDT_REQUEST_FAILED",
    message: typeof message === "string" ? message : fallback
  };
}

function assertResponseBinding(
  data: DdtEvidenceSpineResponse,
  context: DdtExactContext,
  surface: DdtSurface,
  selection: { from: string; to: string }
): void {
  if (data.surface !== surface) {
    throw new DdtHttpError("DDT_OUTPUT_INVALID", "证据线程角色不匹配。");
  }
  const responseContext = data.exact_context;
  const commonContextMatches =
    responseContext.course_id === context.course_id &&
    responseContext.run_id === context.run_id &&
    responseContext.team_id === context.team_id &&
    responseContext.round_id === context.round_id &&
    responseContext.round_no === context.round_no &&
    responseContext.role_key === context.role_key;
  const exactContextMatches =
    surface === "student" ||
    ((responseContext as DdtExactContext).tenant_id === context.tenant_id &&
      (responseContext as DdtExactContext).activity_id === context.activity_id);
  const sameContext = commonContextMatches && exactContextMatches;
  if (!sameContext) {
    throw new DdtHttpError("DDT_OUTPUT_INVALID", "证据线程上下文与当前选择不一致。");
  }
  if (selection.from && selection.to && surface !== "student") {
    const gsi = data.sources.find((source) => source.source === "GSI");
    const selected =
      gsi && "selected_round_pair" in gsi
        ? (gsi as { selected_round_pair?: DdtSelectedRoundPair }).selected_round_pair
        : undefined;
    if (selected?.from_round_id !== selection.from || selected.to_round_id !== selection.to) {
      throw new DdtHttpError("DDT_OUTPUT_INVALID", "利益相关者变化没有绑定到当前选择的回合对。");
    }
  }
}

function viewStateForError(code: string, message: string): ViewState {
  if (code === "DDT_SCOPE_VIOLATION" || code === "AUTHZ-403-001") {
    return { kind: "permission-denied", message: "当前账号没有查看这份精确上下文证据的权限。" };
  }
  if (code === "DDT_REBASE_REQUIRED" || code === "GSI_REBASE_REQUIRED") {
    return { kind: "rebase", message: STATUS_MESSAGES.REBASE_REQUIRED ?? "请重新加载当前上下文。" };
  }
  if (code === "DDT_CONTEXT_UNAVAILABLE" || code === "GSI_CONTEXT_UNAVAILABLE") {
    return {
      kind: "context-unavailable",
      message: STATUS_MESSAGES.CONTEXT_UNAVAILABLE ?? "当前上下文不可用。"
    };
  }
  return { kind: "error", message: message || "证据暂时不可用，请检查当前上下文。" };
}

function optionQuery(context: DdtExactContext): string {
  return new URLSearchParams({
    activity_id: context.activity_id,
    course_id: context.course_id,
    role_key: context.role_key,
    run_id: context.run_id,
    team_id: context.team_id
  }).toString();
}

function sourceStatusClass(status: string): string {
  return status.toLowerCase().replaceAll("_", "-");
}

function sourceSummary(source: DdtEvidenceSpineResponse["sources"][number]): string {
  return source.summary || STATUS_MESSAGES[source.status] || "这份证据没有可显示摘要。";
}

export function DecisionThreadEvidenceSpine({
  apiBase,
  token,
  tenantId,
  surface,
  context,
  heading = "决策线程证据",
  onRecover,
  onReauthenticate,
  onRebind
}: DecisionThreadEvidenceSpineProps) {
  const [selection, setSelection] = useState({ from: "", to: "" });
  const [options, setOptions] = useState<OptionsState>({ kind: "idle" });
  const [recoveryNonce, setRecoveryNonce] = useState(0);
  const [view, setView] = useState<ViewState>(
    context
      ? { kind: "idle" }
      : { kind: "context-unavailable", message: "请先打开一个受控的课程、运行、队伍和回合上下文。" }
  );
  const optionsGeneration = useRef(0);
  const viewGeneration = useRef(0);
  const contextRef = useRef(context);
  const recoveryRef = useRef(false);
  const contextIdentity = contextKey(context);

  const recover = (handler?: () => void): void => {
    recoveryRef.current = true;
    handler?.();
    setRecoveryNonce((current) => current + 1);
  };

  useEffect(() => {
    contextRef.current = context;
    recoveryRef.current = false;
  }, [contextIdentity]);

  useEffect(() => {
    const currentContext = contextRef.current;
    setSelection({ from: "", to: "" });
    setOptions({ kind: currentContext ? "loading" : "idle" });
    setView(
      currentContext
        ? { kind: "idle" }
        : {
            kind: "context-unavailable",
            message: "请先打开一个受控的课程、运行、队伍和回合上下文。"
          }
    );
  }, [contextIdentity]);

  useEffect(() => {
    const requestContext = contextRef.current;
    if (!requestContext) return;
    const generation = ++optionsGeneration.current;
    const controller = new AbortController();
    setOptions({ kind: "loading" });

    void fetch(
      `${apiBase}/api/v1/bff/${surface}/gsi/candidates/pair-options?${optionQuery(requestContext)}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          "x-tenant-id": tenantId
        },
        signal: controller.signal
      }
    )
      .then(async (response) => {
        const payload = (await response.json()) as {
          data?: GSICrossRoundPairOptions;
        } & ErrorPayload;
        if (!response.ok) {
          const detail = readError(payload, "服务器没有返回可用的回合选项。");
          throw new DdtHttpError(detail.code, detail.message);
        }
        if (generation !== optionsGeneration.current) return;
        if (!payload.data) throw new Error("回合选项响应缺少数据。");
        setOptions({ kind: "ready", data: payload.data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || generation !== optionsGeneration.current) return;
        const message = error instanceof Error ? error.message : "回合选项暂时不可用。";
        setOptions({ kind: "error", message });
      });

    return () => controller.abort();
  }, [apiBase, recoveryNonce, surface, tenantId, token, contextIdentity]);

  useEffect(() => {
    const requestContext = contextRef.current;
    if (!requestContext) return;
    const generation = ++viewGeneration.current;
    const controller = new AbortController();
    const query = new URLSearchParams(queryForContext(requestContext));
    if (selection.from && selection.to) {
      query.set("gsi_from_round_id", selection.from);
      query.set("gsi_to_round_id", selection.to);
    }
    setView({ kind: "loading" });

    void fetch(
      `${apiBase}/api/v1/bff/${surface}/decision-thread/evidence-spine?${query.toString()}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          "x-tenant-id": tenantId
        },
        signal: controller.signal
      }
    )
      .then(async (response) => {
        const payload = (await response.json()) as {
          data?: DdtEvidenceSpineResponse;
        } & ErrorPayload;
        if (!response.ok) {
          const detail = readError(payload, "证据线程暂时不可用。");
          throw new DdtHttpError(detail.code, detail.message);
        }
        if (generation !== viewGeneration.current) return;
        if (!payload.data) {
          throw new DdtHttpError("DDT_OUTPUT_INVALID", "证据线程响应缺少数据。");
        }
        assertResponseBinding(payload.data, requestContext, surface, selection);
        const sourceStatuses = payload.data.sources.map((source) => source.status);
        if (sourceStatuses.includes("REBASE_REQUIRED")) {
          setView({
            kind: "rebase",
            message: STATUS_MESSAGES.REBASE_REQUIRED ?? "请重新加载当前上下文。"
          });
          return;
        }
        if (sourceStatuses.includes("STALE")) {
          setView({ kind: "stale", data: payload.data });
          return;
        }
        setView({ kind: recoveryRef.current ? "recovered" : "ready", data: payload.data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || generation !== viewGeneration.current) return;
        const detail =
          error instanceof DdtHttpError
            ? { code: error.code, message: error.message }
            : error instanceof Error
              ? { code: "DDT_REQUEST_FAILED", message: error.message }
              : readError({}, "证据线程暂时不可用。");
        recoveryRef.current = true;
        setView(viewStateForError(detail.code, detail.message));
      });

    return () => controller.abort();
  }, [
    apiBase,
    contextIdentity,
    recoveryNonce,
    selection.from,
    selection.to,
    surface,
    tenantId,
    token
  ]);

  const rounds = options.kind === "ready" ? options.data.rounds : [];
  const canCompare = Boolean(selection.from && selection.to && selection.from !== selection.to);
  const isStudent = surface === "student";

  return (
    <section
      className="sw-ui ddt-evidence-spine"
      data-testid="decision-thread-evidence-spine"
      aria-labelledby="ddt-evidence-heading"
    >
      <header className="ddt-evidence-spine__header">
        <div>
          <p className="ddt-evidence-spine__eyebrow">Decision Digital Thread</p>
          <h2 id="ddt-evidence-heading">{heading}</h2>
          <p className="ddt-evidence-spine__lede">
            当前上下文中的可追溯证据汇总。它不会重新计算正式结果，也不会写入决策或结算。
          </p>
        </div>
        <span className="ddt-evidence-spine__boundary">只读 · Provider OFF</span>
      </header>

      <div className="ddt-evidence-spine__context" aria-label="证据线程上下文">
        {context ? (
          isStudent ? (
            <span>当前课程、运行、队伍、回合和角色已受控绑定</span>
          ) : (
            <>
              <span>课程：{context.course_id}</span>
              <span>运行：{context.run_id}</span>
              <span>队伍：{context.team_id}</span>
              <span>回合：{context.round_no}</span>
              <span>角色：{context.role_key}</span>
            </>
          )
        ) : (
          <span>尚未选择精确上下文</span>
        )}
      </div>

      <div className="ddt-evidence-spine__pair" aria-describedby="ddt-pair-help">
        <div>
          <h3>对比两个明确回合</h3>
          <p id="ddt-pair-help">
            回合选项由服务器按当前权限和上下文筛选；页面不会替你选择最新或默认回合。
          </p>
        </div>
        <div className="ddt-evidence-spine__pair-fields">
          <label>
            起始回合
            <select
              aria-label="起始回合"
              disabled={!context || options.kind !== "ready"}
              value={selection.from}
              onChange={(event) =>
                setSelection((current) => ({ ...current, from: event.target.value }))
              }
            >
              <option value="">请选择</option>
              {rounds.map((round) => (
                <option key={round.round_id} value={round.round_id}>
                  回合 {round.round_no}
                </option>
              ))}
            </select>
          </label>
          <label>
            目标回合
            <select
              aria-label="目标回合"
              disabled={!context || options.kind !== "ready"}
              value={selection.to}
              onChange={(event) =>
                setSelection((current) => ({ ...current, to: event.target.value }))
              }
            >
              <option value="">请选择</option>
              {rounds.map((round) => (
                <option key={round.round_id} value={round.round_id}>
                  回合 {round.round_no}
                </option>
              ))}
            </select>
          </label>
        </div>
        {options.kind === "loading" ? <p role="status">正在读取可比较回合…</p> : null}
        {options.kind === "error" ? (
          <p className="ddt-evidence-spine__error" role="alert">
            {options.message}
          </p>
        ) : null}
        {options.kind === "ready" && rounds.length < 2 ? (
          <p role="status">当前权限和上下文下没有两条可比较的合法回合；这不是空数据的替代说法。</p>
        ) : null}
        {selection.from && selection.to && selection.from === selection.to ? (
          <p className="ddt-evidence-spine__error" role="alert">
            请选择两个不同的回合。
          </p>
        ) : null}
        {canCompare ? <p role="status">已选择两个精确回合，正在刷新变化证据。</p> : null}
      </div>

      {view.kind === "loading" ? (
        <p className="ddt-evidence-spine__status" role="status">
          正在整理当前证据…
        </p>
      ) : null}
      {view.kind === "context-unavailable" ||
      view.kind === "rebase" ||
      view.kind === "permission-denied" ||
      view.kind === "error" ? (
        <div className="ddt-evidence-spine__status" data-state={view.kind} role="alert">
          <strong>
            {view.kind === "permission-denied"
              ? "无权限"
              : view.kind === "rebase"
                ? "需要重新绑定"
                : "证据不可用"}
          </strong>
          <p>{view.message}</p>
          <span>
            安全下一步：
            {view.kind === "permission-denied"
              ? "重新验证身份或切换到有权限的上下文。"
              : view.kind === "rebase"
                ? "重新绑定当前上下文；不会自动重试旧请求。"
                : "重新加载当前上下文；不会自动重试旧请求。"}
          </span>
          {view.kind === "permission-denied" && onReauthenticate ? (
            <button
              type="button"
              className="ddt-evidence-spine__recovery"
              data-action="ddt:reauthenticate"
              onClick={() => recover(onReauthenticate)}
            >
              重新验证身份
            </button>
          ) : null}
          {view.kind !== "permission-denied" ? (
            <button
              type="button"
              className="ddt-evidence-spine__recovery"
              data-action={view.kind === "rebase" ? "ddt:rebind" : "ddt:reload"}
              onClick={() => recover(view.kind === "rebase" ? onRebind ?? onRecover : onRecover)}
            >
              {view.kind === "rebase" ? "重新加载当前精确上下文" : "重新加载当前上下文"}
            </button>
          ) : null}
        </div>
      ) : null}
      {view.kind === "ready" || view.kind === "stale" || view.kind === "recovered" ? (
        <>
          <div className="ddt-evidence-spine__status" data-state={view.kind} role="status">
            <strong>
              {view.kind === "stale"
                ? "证据已过期"
                : view.kind === "recovered"
                  ? "证据线程已恢复"
                  : "证据线程已就绪"}
            </strong>
            <p>
              {view.data.non_causal
                ? "变化仅作描述，不证明因果效应。"
                : "请以当前权限可见范围理解这份证据。"}
            </p>
            {view.kind === "stale" ? (
              <>
                <p>安全下一步：重新加载当前精确上下文后再继续查看。</p>
                <button
                  type="button"
                  className="ddt-evidence-spine__recovery"
                  data-action="ddt:refresh"
                  onClick={() => recover(onRecover)}
                >
                  刷新当前精确上下文
                </button>
              </>
            ) : null}
          </div>
          <div className="ddt-evidence-spine__sources">
            {view.data.sources.map((source) => (
              <article
                className="ddt-evidence-spine__source"
                data-source={source.source}
                key={source.source}
              >
                <div className="ddt-evidence-spine__source-heading">
                  <h3>{SOURCE_LABELS[source.source]}</h3>
                  <span
                    className={`ddt-evidence-spine__source-status ddt-evidence-spine__source-status--${sourceStatusClass(source.status)}`}
                  >
                    {STATUS_LABELS[source.status] ?? source.status}
                  </span>
                </div>
                <p>{sourceSummary(source)}</p>
                <p className="ddt-evidence-spine__scope" data-testid="ddt-source-context-scope">
                  证据绑定范围：
                  {source.context_scope === "TENANT_COURSE_ACTIVITY"
                    ? "租户、课程与活动"
                    : "当前精确上下文"}
                </p>
                <ul>
                  {source.known_limits.map((limit) => (
                    <li key={limit}>{limit}</li>
                  ))}
                </ul>
                {!isStudent && "provenance" in source && source.provenance ? (
                  <details>
                    <summary>查看审计证据</summary>
                    <dl>
                      <div>
                        <dt>权威来源</dt>
                        <dd>{source.provenance.authority_owner}</dd>
                      </div>
                      <div>
                        <dt>契约版本</dt>
                        <dd>{source.provenance.contract_version}</dd>
                      </div>
                      <div>
                        <dt>来源引用</dt>
                        <dd>{source.provenance.source_ref}</dd>
                      </div>
                    </dl>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
          <p className="ddt-evidence-spine__limits">
            已保留各来源的可用性、限制和证据账本边界；这份线程不会生成正式 Outcome。
          </p>
        </>
      ) : null}
    </section>
  );
}

export default DecisionThreadEvidenceSpine;
