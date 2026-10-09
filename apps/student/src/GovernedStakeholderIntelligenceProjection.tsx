import { createElement, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
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
  code?: string;
  data?: GSICrossRoundPairOptions | EnvelopeError;
  error?: EnvelopeError;
}

interface ComparisonEnvelope {
  code?: string;
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

function readEnvelope<T>(payload: { data?: T | EnvelopeError; error?: EnvelopeError }): {
  data: T | undefined;
  error: EnvelopeError;
} {
  const data = payload.data;
  return isEnvelopeErrorData(data)
    ? { data: undefined, error: payload.error ?? data }
    : { data, error: payload.error ?? {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type FieldRule = string | boolean | ((value: unknown) => boolean);
function matchesShape(value: unknown, shape: Record<string, FieldRule>): boolean {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) => Object.hasOwn(shape, key)) &&
    Object.entries(shape).every(([key, rule]) =>
      typeof rule === "function" ? rule(value[key]) : value[key] === rule
    )
  );
}
const oneOf =
  (...values: string[]) =>
  (value: unknown) =>
    values.includes(value as string);
const optionalNumber = (limit: number) => (value: unknown) =>
  value === undefined || (typeof value === "number" && Math.abs(value) <= limit);
const movementShape = {
  stakeholder_type: oneOf("customer", "regulator", "bank", "employee", "media"),
  intent: oneOf(
    "protect_demand",
    "reduce_regulatory_risk",
    "preserve_liquidity",
    "retain_workforce",
    "protect_reputation"
  ),
  direction: oneOf("NEW", "REMOVED", "INCREASED", "DECREASED", "STABLE"),
  from_value: optionalNumber(1),
  to_value: optionalNumber(1),
  delta: optionalNumber(2)
};
const comparisonShape = {
  surface: "student",
  provider: "OFF",
  non_causal: true,
  causal_proof: false,
  official_truth_write: false,
  context_status: oneOf("AVAILABLE", "CONTEXT_UNAVAILABLE", "REBASE_REQUIRED"),
  recovery: oneOf("RELOAD_EXACT_CONTEXT", "WAIT_FOR_PUBLICATION"),
  known_limits: (value: unknown) =>
    Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string"),
  movements: (value: unknown) =>
    Array.isArray(value) && value.every((item) => matchesShape(item, movementShape))
};
/** Runtime admission for the existing public projection, not a new response contract. */
function isStudentComparison(value: unknown): value is GSICrossRoundStudentProjection {
  return matchesShape(value, comparisonShape);
}

function matchesSelection(
  context: GSICrossRoundSelectionContext,
  selected: NonNullable<GovernedStakeholderIntelligenceProjectionProps["selectionContext"]>
): boolean {
  return Object.entries(selected).every(
    ([key, value]) => context[key as keyof GSICrossRoundSelectionContext] === value
  );
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
function unavailableState(): { kind: "unavailable"; message: string } {
  return { kind: "unavailable", message: PAIR_SELECTION_MESSAGE };
}

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

function comparisonStateForError(code?: string, message = "两个回合的变化暂不可用"): ComparisonState {
  if (code === "GSI_REBASE_REQUIRED") return { kind: "rebase", message };
  if (code === "GSI_CONTEXT_UNAVAILABLE") return { kind: "context-unavailable", message };
  if (code === "GSI_PAIR_NOT_AVAILABLE" || code === "GSI_PAIR_AMBIGUOUS") {
    return unavailableState();
  }
  return { kind: "error", message };
}

// Share intrinsic leaf construction without adding a component or changing DOM/escaping.
function leaf(
  tag: "span" | "p" | "strong" | "li" | "h3" | "h4" | "summary",
  children: ReactNode,
  className?: string,
  key?: string | number
) {
  return createElement(tag, { className, key }, children);
}

function ComparisonTimeline({ comparison }: { comparison: GSICrossRoundStudentProjection }) {
  return (
    <>
      <div className="gsi-xr-context-strip" role="status" aria-live="polite">
        {leaf("span", statusCopy(comparison.context_status))}
        {leaf("span", "NON-CAUSAL", "gsi-xr-badge")}
      </div>
      <ol className="gsi-xr-timeline" aria-label="Stakeholder pressure movement">
        {comparison.movements.map((movement, index) => (
          <li
            key={`${movement.stakeholder_type}-${movement.intent}-${index}`}
            className="gsi-xr-timeline-item"
          >
            <div className="gsi-xr-timeline-marker" aria-hidden="true" />
            <div>
              {leaf("strong", [movement.stakeholder_type, " 的压力变化"])}
              {leaf("p", movement.intent)}
              {leaf("span", movement.direction, "gsi-xr-direction")}
              {movement.from_value !== undefined && movement.to_value !== undefined
                ? leaf(
                    "span",
                    [
                      movement.from_value,
                      " → ",
                      movement.to_value,
                      movement.delta !== undefined ? `（变化 ${movement.delta}）` : ""
                    ],
                    "gsi-xr-value-change"
                  )
                : null}
            </div>
          </li>
        ))}
      </ol>
      <aside className="gsi-xr-reflection" aria-label="Reflection prompt">
        {leaf("strong", "想一想")}
        {leaf("p", "哪些压力变了，它会怎样影响你的下一步判断？")}
      </aside>
      <div className="gsi-xr-boundary-grid">
        <div>
          {leaf("span", "学习边界", "eyebrow")}
          <ul>
            {comparison.known_limits.map((limit) => leaf("li", limit, undefined, limit))}
            {leaf("li", "不会写入正式 Truth、Settlement、Score 或 Rank")}
          </ul>
        </div>
        <div>
          {leaf("span", "下一步", "eyebrow")}
          {leaf(
            "p",
            comparison.recovery === "WAIT_FOR_PUBLICATION"
              ? "等待课程内容发布后再查看。"
              : "回到当前课程上下文后重新查看。"
          )}
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
  initialComparison: bootstrap
}: GovernedStakeholderIntelligenceProjectionProps) {
  const initialComparison = isStudentComparison(bootstrap) ? bootstrap : undefined;
  const initialState =
    bootstrap !== undefined && !initialComparison ? comparisonStateForError() : unavailableState();
  const [fromRoundId, setFromRoundId] = useState("");
  const [toRoundId, setToRoundId] = useState("");
  const [pairOptionsState, setPairOptionsState] = useState<PairOptionsState>(
    selectionContext ? { kind: "loading" } : unavailableState()
  );
  const [comparisonState, setComparisonState] = useState<ComparisonState>(initialState);
  const comparisonRequestId = useRef(0);
  const comparisonController = useRef<AbortController | null>(null);
  const pairOptionsRequestId = useRef(0);
  const pairOptionsController = useRef<AbortController | null>(null);
  const reflectionTarget = useRef<HTMLElement | null>(null);
  function fetchGsi(route: string, signal: AbortSignal): Promise<Response> {
    return fetch(`${apiBase}/api/v1/bff/student/gsi/candidates/${route}`, {
      headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
      signal
    });
  }
  function invalidateComparisonRequest(): number {
    const requestId = ++comparisonRequestId.current;
    comparisonController.current?.abort();
    return requestId;
  }
  const handoffFocus = useRef<{
    href: string;
    initialFocus: Element | null;
    cancelled: boolean;
    handled: boolean;
  } | null>(null);

  useEffect(() => {
    const href = window.location.href;
    if (handoffFocus.current?.href === href && handoffFocus.current.handled) return;
    const params = new URLSearchParams(window.location.search);
    const matchesContext =
      selectionContext !== undefined &&
      Object.entries(selectionContext).every(
        ([key, value]) => params.get(`gsi_${key}`)?.trim() === value
      );
    const initialFocus = document.activeElement;
    const loginEntry =
      initialFocus instanceof HTMLButtonElement && initialFocus.textContent?.trim() === "学员登录";
    const entry = {
      href,
      initialFocus,
      cancelled:
        window.location.hash !== "#gsi-student-reflection" ||
        !matchesContext ||
        (initialFocus !== document.body && initialFocus !== null && !loginEntry),
      handled: false
    };
    handoffFocus.current = entry;
    const preserveUserFocus = (event: FocusEvent) => {
      if (event.target !== entry.initialFocus && event.target !== reflectionTarget.current) {
        entry.cancelled = true;
        entry.handled = true;
      }
    };
    document.addEventListener("focusin", preserveUserFocus);
    return () => {
      entry.cancelled = true;
      document.removeEventListener("focusin", preserveUserFocus);
    };
  }, [
    selectionContext?.course_id,
    selectionContext?.run_id,
    selectionContext?.team_id,
    selectionContext?.activity_id,
    selectionContext?.role_key,
    tenantId,
    token
  ]);

  useEffect(() => {
    const entry = handoffFocus.current;
    if (
      !entry ||
      entry.handled ||
      entry.cancelled ||
      entry.href !== window.location.href ||
      !selectionContext ||
      pairOptionsState.kind !== "ready" ||
      pairOptionsState.data.context.tenant_id !== tenantId ||
      !matchesSelection(pairOptionsState.data.context, selectionContext)
    )
      return;
    entry.handled = true;
    reflectionTarget.current?.focus();
  }, [pairOptionsState, selectionContext, tenantId]);

  useEffect(() => {
    const requestId = ++pairOptionsRequestId.current;
    pairOptionsController.current?.abort();
    invalidateComparisonRequest();
    if (initialComparison || !selectionContext) {
      setPairOptionsState(unavailableState());
      setFromRoundId("");
      setToRoundId("");
      setComparisonState(initialState);
      return;
    }

    const controller = new AbortController();
    const isStale = () => controller.signal.aborted || requestId !== pairOptionsRequestId.current;
    pairOptionsController.current = controller;
    const query = new URLSearchParams(selectionContext);
    setPairOptionsState({ kind: "loading" });
    setFromRoundId("");
    setToRoundId("");
    setComparisonState(initialState);

    void fetchGsi(`pair-options?${query.toString()}`, controller.signal)
      .then(async (response) => {
        const payload = (await response.json()) as PairOptionsEnvelope;
        if (isStale()) return;
        // Keep the existing runtime schema guard off the initial entry transfer.
        // Loading never grants readiness: identity must still match after it settles.
        const { isGSICrossRoundPairOptions } =
          await import("../../../packages/shared-contracts/src/gsi-governed-stakeholder-shadow-plane");
        if (isStale()) return;
        const { data: options } = readEnvelope(payload);
        if (
          !response.ok ||
          Object.hasOwn(payload, "error") ||
          (payload.code !== undefined && payload.code !== "OK") ||
          options === undefined ||
          !isGSICrossRoundPairOptions(options) ||
          options.surface !== "student" ||
          options.context.tenant_id !== tenantId ||
          !matchesSelection(options.context, selectionContext)
        ) {
          setPairOptionsState({
            kind: "error",
            message: "服务器回合配对暂不可用"
          });
          return;
        }
        setPairOptionsState({ kind: "ready", data: options });
      })
      .catch((cause) => {
        if (isStale() || (cause instanceof DOMException && cause.name === "AbortError")) return;
        setPairOptionsState({
          kind: "error",
          message: "服务器回合配对暂不可用"
        });
      });

    return () => controller.abort();
  }, [
    apiBase,
    bootstrap,
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
      setComparisonState(unavailableState());
      return;
    }
    if (from === to) {
      setComparisonState({
        kind: "error",
        message: "请选择两个不同的服务器治理回合。"
      });
      return;
    }

    const requestId = invalidateComparisonRequest();
    const controller = new AbortController();
    comparisonController.current = controller;
    setComparisonState({ kind: "loading" });
    const query = new URLSearchParams({
      ...selectionContext,
      from_round_id: from,
      to_round_id: to
    });

    try {
      const response = await fetchGsi(`compare?${query.toString()}`, controller.signal);
      const payload = (await response.json()) as ComparisonEnvelope;
      if (requestId !== comparisonRequestId.current) return;
      const { data, error: details } = readEnvelope(payload);
      if (
        !response.ok ||
        !isStudentComparison(data) ||
        Object.hasOwn(payload, "error") ||
        (payload.code !== undefined && payload.code !== "OK")
      ) {
        setComparisonState(comparisonStateForError(details.code ?? payload.code));
        return;
      }
      setComparisonState({ kind: "ready", data });
    } catch {
      if (controller.signal.aborted || requestId !== comparisonRequestId.current) return;
      setComparisonState(comparisonStateForError());
    }
  }

  function resetComparison(): void {
    invalidateComparisonRequest();
    setFromRoundId("");
    setToRoundId("");
    setComparisonState(unavailableState());
  }

  function invalidateComparisonSelection(): void {
    invalidateComparisonRequest();
    setComparisonState(unavailableState());
  }

  const projection = bootstrap === undefined ? initialProjection : undefined;
  const pairOptions = pairOptionsState.kind === "ready" ? pairOptionsState.data.rounds : [];
  const pairUnavailable = pairOptionsState.kind === "error" || pairOptions.length < 2;
  const recoveryPanel =
    comparisonState.kind === "rebase"
      ? [
          "error",
          "REBASE_REQUIRED",
          "课程上下文或内容已经变化，请重新选择回合。",
          "重新选择精确回合"
        ]
      : comparisonState.kind === "context-unavailable"
        ? [
            "warning",
            "CONTEXT_UNAVAILABLE",
            "当前课程上下文暂不可用，变化摘要不会被当作空结果展示。",
            "返回并重新进入课程"
          ]
        : comparisonState.kind === "error"
          ? ["error", "暂时无法读取变化", comparisonState.message, "安全恢复"]
          : undefined;

  return (
    <section
      id={projection ? undefined : "gsi-student-reflection"}
      ref={projection ? undefined : reflectionTarget}
      tabIndex={projection ? undefined : -1}
      className="panel form-panel gsi-xr-panel"
      aria-label={
        projection
          ? "Student governed stakeholder projection"
          : "Student cross-round stakeholder reflection"
      }
    >
      <div className="panel-title">
        <div>
          {leaf(
            "p",
            projection ? "Student · role-safe view" : "Student · decision-learning timeline",
            "eyebrow"
          )}
          {leaf("h3", projection ? "利益相关方信号学习投影" : "查看本轮变化")}
        </div>
        {leaf(
          "span",
          projection || initialComparison ? "Provider OFF" : "Provider OFF · read-only",
          "technical-compatibility"
        )}
      </div>
      {leaf(
        "p",
        projection
          ? "学员只接收已发布、按角色裁剪的 bounded signal；proposal 原文和教师/管理员 provenance 不在此投影中。"
          : `这里只显示${initialComparison ? "已发布、按当前角色裁剪" : "服务器确认发布且匹配当前角色"}的变化摘要。它用于帮助你反思下一步，不代表正式决策、结果或因果结论。`,
        "lifecycle-boundary"
      )}
      {initialComparison ? (
        <ComparisonTimeline comparison={initialComparison} />
      ) : projection ? (
        <article className="candidate-preview" aria-label="Student GSI projection">
          {leaf("h4", ["角色：", projection.role_key ?? "已授权角色"])}
          {leaf("p", projection.summary)}
          <ul>
            {projection.signals.map((signal) =>
              leaf(
                "li",
                [signal.stakeholder_type, " / ", signal.intent, ": ", signal.bounded_value],
                undefined,
                `${signal.stakeholder_type}-${signal.intent}`
              )
            )}
          </ul>
          {projection.abstentions.length
            ? leaf(
                "p",
                ["有 ", projection.abstentions.length, " 项信号在有界规则下未采纳。"],
                "lifecycle-status"
              )
            : null}
          <details>
            {leaf("summary", "查看学习边界")}
            <ul>{projection.known_limits.map((limit) => leaf("li", limit, undefined, limit))}</ul>
          </details>
        </article>
      ) : (
        <>
          <form
            className="gsi-xr-pair-form"
            aria-label="Student exact cross-round comparison"
            onSubmit={compareRounds}
          >
            <div className="gsi-xr-pair-heading">
              <div>
                {leaf("p", "Reflection action", "eyebrow")}
                {leaf("h4", "选择两个已发布回合")}
              </div>
              {leaf("span", "READ-ONLY", "gsi-xr-state-badge")}
            </div>
            {leaf(
              "p",
              "回合由服务器按当前课程、运行、队伍和角色筛选；请明确选择起始和目标回合，不使用默认顺序推断。",
              "gsi-xr-muted"
            )}
            <div className="gsi-xr-field-grid">
              {(
                [
                  ["From round", "Student from round", fromRoundId, setFromRoundId, "选择起始回合"],
                  ["To round", "Student to round", toRoundId, setToRoundId, "选择目标回合"]
                ] as const
              ).map(([label, ariaLabel, value, setValue, placeholder]) => (
                <label key={ariaLabel}>
                  {label}
                  <select
                    aria-label={ariaLabel}
                    value={value}
                    onChange={(event) => {
                      invalidateComparisonSelection();
                      setValue(event.target.value);
                    }}
                    disabled={pairOptionsState.kind !== "ready" || pairOptions.length < 2}
                  >
                    <option value="">{placeholder}</option>
                    {pairOptions.map((round) => (
                      <option key={round.round_id} value={round.round_id}>
                        Round {round.round_no}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {pairOptionsState.kind === "loading" ? (
              <p className="gsi-xr-muted" role="status" aria-live="polite">
                正在读取已发布的可比较回合…
              </p>
            ) : null}
            {pairUnavailable ? (
              <div className="gsi-xr-status gsi-xr-status-warning" role="status" aria-live="polite">
                {leaf("strong", "PAIR_SELECTION_UNAVAILABLE")}
                {leaf(
                  "p",
                  pairOptionsState.kind === "error"
                    ? pairOptionsState.message
                    : PAIR_SELECTION_MESSAGE
                )}
                {leaf("span", "安全下一步：返回课程上下文并等待两个已发布、角色匹配的回合。")}
              </div>
            ) : null}
            <div className="gsi-xr-actions">
              <button
                type="submit"
                disabled={comparisonState.kind === "loading" || pairUnavailable}
              >
                {comparisonState.kind === "loading" ? "正在读取…" : "查看变化"}
              </button>
              <button type="button" className="secondary" onClick={resetComparison}>
                重新选择
              </button>
            </div>
          </form>
          {comparisonState.kind === "unavailable" && !pairUnavailable ? (
            <div className="gsi-xr-status gsi-xr-status-warning" role="status" aria-live="polite">
              {leaf("strong", "PAIR_SELECTION_UNAVAILABLE")}
              {leaf("p", comparisonState.message)}
            </div>
          ) : null}
          {recoveryPanel ? (
            <div
              className={`gsi-xr-status gsi-xr-status-${recoveryPanel[0]}`}
              role={recoveryPanel[0] === "error" ? "alert" : "status"}
              aria-live={recoveryPanel[0] === "warning" ? "polite" : undefined}
            >
              {leaf("strong", recoveryPanel[1])}
              {leaf("p", recoveryPanel[2])}
              <button type="button" className="secondary" onClick={resetComparison}>
                {recoveryPanel[3]}
              </button>
            </div>
          ) : null}
          {comparisonState.kind === "ready" ? (
            <ComparisonTimeline comparison={comparisonState.data} />
          ) : null}
        </>
      )}
    </section>
  );
}
