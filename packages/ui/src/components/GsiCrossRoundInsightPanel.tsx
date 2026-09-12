import { useEffect, useMemo, useState } from "react";
import type {
  ApiEnvelope,
  GSICrossRoundStudentProjection,
  GSICrossRoundTeacherProjection
} from "@simwar/shared-contracts";
import { StatePanel } from "./StatePanel.js";

export type GsiCrossRoundSurface = "teacher" | "student";

export interface GsiCrossRoundSelectors {
  from_candidate_id: string;
  to_candidate_id: string;
  activity_id: string;
  role_key: string;
  expected_comparison_digest?: string;
  expected_context_digest?: string;
}

export type GsiCrossRoundSelectionState = "MISSING" | "INVALID" | "READY";

export interface GsiCrossRoundSelection {
  state: GsiCrossRoundSelectionState;
  selectors?: GsiCrossRoundSelectors;
}

export interface GsiCrossRoundInsightPanelProps {
  apiBase: string;
  surface: GsiCrossRoundSurface;
  tenantId: string;
  token: string;
  selectors?: GsiCrossRoundSelectors | null;
}

type GsiCrossRoundProjection = GSICrossRoundTeacherProjection | GSICrossRoundStudentProjection;

type GsiCrossRoundViewState =
  | "UNAUTHENTICATED"
  | "INSUFFICIENT_EXACT_CONTEXT"
  | "LOADING"
  | "SUCCESS"
  | "CONTEXT_UNAVAILABLE"
  | "REBASE_REQUIRED"
  | "NOT_PUBLISHED"
  | "FORBIDDEN"
  | "ERROR";

interface ErrorEnvelope {
  code?: unknown;
  message?: unknown;
}

interface GsiCrossRoundRequestError extends Error {
  readonly code: string;
  readonly status: number;
}

const RESERVED_SELECTORS = new Set([
  "latest",
  "current",
  "default",
  "fallback",
  "first",
  "last",
  "newest"
]);

function isExactSelector(value: string | null): value is string {
  return Boolean(
    value &&
    value.trim() === value &&
    value.length > 0 &&
    !RESERVED_SELECTORS.has(value.toLowerCase())
  );
}

function optionalDigest(value: string | null): string | undefined {
  return value && /^[a-f0-9]{64}$/u.test(value) ? value : undefined;
}

export function readGsiCrossRoundSelection(search?: string): GsiCrossRoundSelection {
  const query = new URLSearchParams(
    search ?? (typeof window === "undefined" ? "" : window.location.search)
  );
  const names = ["gsiFromCandidateId", "gsiToCandidateId", "gsiActivityId", "gsiRoleKey"] as const;
  const values = names.map((name) => query.get(name));
  if (!values.some((value) => value !== null)) return { state: "MISSING" };
  if (values.some((value) => !isExactSelector(value))) return { state: "INVALID" };
  const [fromCandidateId, toCandidateId, activityId, roleKey] = values as [
    string,
    string,
    string,
    string
  ];
  if (fromCandidateId === toCandidateId) return { state: "INVALID" };
  const expectedComparisonDigest = optionalDigest(query.get("gsiExpectedComparisonDigest"));
  const expectedContextDigest = optionalDigest(query.get("gsiExpectedContextDigest"));
  if (
    (query.has("gsiExpectedComparisonDigest") && !expectedComparisonDigest) ||
    (query.has("gsiExpectedContextDigest") && !expectedContextDigest)
  ) {
    return { state: "INVALID" };
  }
  return {
    state: "READY",
    selectors: {
      from_candidate_id: fromCandidateId,
      to_candidate_id: toCandidateId,
      activity_id: activityId,
      role_key: roleKey,
      ...(expectedComparisonDigest ? { expected_comparison_digest: expectedComparisonDigest } : {}),
      ...(expectedContextDigest ? { expected_context_digest: expectedContextDigest } : {})
    }
  };
}

export function buildGsiCrossRoundComparePath(
  surface: GsiCrossRoundSurface,
  selectors: GsiCrossRoundSelectors
): string {
  const query = new URLSearchParams({
    from_candidate_id: selectors.from_candidate_id,
    to_candidate_id: selectors.to_candidate_id,
    activity_id: selectors.activity_id,
    role_key: selectors.role_key
  });
  if (selectors.expected_comparison_digest) {
    query.set("expected_comparison_digest", selectors.expected_comparison_digest);
  }
  if (selectors.expected_context_digest) {
    query.set("expected_context_digest", selectors.expected_context_digest);
  }
  return `/api/v1/bff/${surface}/gsi/candidates/compare?${query.toString()}`;
}

export function classifyGsiCrossRoundFailure(code: string, status: number): GsiCrossRoundViewState {
  if (code === "GSI_NOT_PUBLISHED") return "NOT_PUBLISHED";
  if (code === "GSI_REBASE_REQUIRED") return "REBASE_REQUIRED";
  if (code === "GSI_FORBIDDEN" || status === 401 || status === 403) return "FORBIDDEN";
  return "ERROR";
}

export function getGsiCrossRoundContextStatus(
  projection: GsiCrossRoundProjection
): "AVAILABLE" | "CONTEXT_UNAVAILABLE" | "REBASE_REQUIRED" {
  return projection.surface === "student" ? projection.context_status : projection.context.status;
}

async function loadProjection(
  props: GsiCrossRoundInsightPanelProps,
  selectors: GsiCrossRoundSelectors
): Promise<GsiCrossRoundProjection> {
  const response = await fetch(
    `${props.apiBase}${buildGsiCrossRoundComparePath(props.surface, selectors)}`,
    {
      headers: {
        authorization: `Bearer ${props.token}`,
        "content-type": "application/json",
        "x-tenant-id": props.tenantId
      }
    }
  );
  const envelope = (await response.json()) as Partial<ApiEnvelope<GsiCrossRoundProjection>> &
    ErrorEnvelope;
  if (!response.ok || !envelope.data) {
    const error = new Error(
      typeof envelope.message === "string" ? envelope.message : "GSI 跨轮洞察加载失败"
    ) as GsiCrossRoundRequestError;
    Object.assign(error, {
      code: typeof envelope.code === "string" ? envelope.code : "GSI_REQUEST_FAILED",
      status: response.status
    });
    throw error;
  }
  return envelope.data;
}

function statePanelStatus(state: GsiCrossRoundViewState) {
  switch (state) {
    case "LOADING":
      return "loading" as const;
    case "FORBIDDEN":
      return "permission-denied" as const;
    case "REBASE_REQUIRED":
      return "conflict" as const;
    case "NOT_PUBLISHED":
      return "blocked" as const;
    case "ERROR":
      return "error" as const;
    case "CONTEXT_UNAVAILABLE":
      return "partial" as const;
    case "UNAUTHENTICATED":
    case "INSUFFICIENT_EXACT_CONTEXT":
      return "empty" as const;
    case "SUCCESS":
      return "ready" as const;
  }
}

function stateMessage(state: GsiCrossRoundViewState): string {
  switch (state) {
    case "UNAUTHENTICATED":
      return "请先登录；跨轮洞察不会在无角色会话时发起请求。";
    case "INSUFFICIENT_EXACT_CONTEXT":
      return "需要明确的 from/to candidate、activity 和 role selector；不会自动选择 latest/current/default。";
    case "LOADING":
      return "正在读取现有 GSI 跨轮比较 BFF…";
    case "CONTEXT_UNAVAILABLE":
      return "比较结果已返回，但 W3/M2P5 精确已发布上下文不可用；仅保留描述性 movement。";
    case "REBASE_REQUIRED":
      return "精确候选或上下文已变化，请重新选择两个已发布回合后重试。";
    case "NOT_PUBLISHED":
      return "跨轮比较需要两个已发布候选；服务端已拒绝未发布上下文。";
    case "FORBIDDEN":
      return "当前角色无权读取该跨轮比较；未降级到其他路径。";
    case "ERROR":
      return "跨轮洞察读取失败；请根据服务端错误进行精确恢复。";
    case "SUCCESS":
      return "跨轮 movement 已由现有 GSI BFF 返回；该结果是非因果、只读描述。";
  }
}

function movementLabel(direction: string): string {
  return (
    {
      NEW: "新增",
      REMOVED: "移除",
      INCREASED: "增加",
      DECREASED: "减少",
      STABLE: "稳定"
    }[direction] ?? direction
  );
}

function movementDetails(movement: {
  stakeholder_type: string;
  intent: string;
  from_value?: number;
  to_value?: number;
  delta?: number;
  direction: string;
}): string {
  const values = [
    movement.from_value === undefined ? null : `from ${movement.from_value}`,
    movement.to_value === undefined ? null : `to ${movement.to_value}`,
    movement.delta === undefined ? null : `delta ${movement.delta}`
  ].filter((value): value is string => value !== null);
  return `${movement.stakeholder_type} / ${movement.intent} · ${movementLabel(movement.direction)}${values.length ? ` · ${values.join(" · ")}` : ""}`;
}

function renderTeacherBody(projection: GSICrossRoundTeacherProjection) {
  const contextStatus = getGsiCrossRoundContextStatus(projection);
  return (
    <>
      <div className="summary-grid" data-testid="gsi-o3-teacher-summary">
        <article>
          <span>比较回合</span>
          <strong>
            {projection.comparison.pair.from.round_no} → {projection.comparison.pair.to.round_no}
          </strong>
        </article>
        <article>
          <span>Movement 数量</span>
          <strong>{projection.comparison.movements.length}</strong>
        </article>
        <article>
          <span>上下文</span>
          <strong>{contextStatus}</strong>
        </article>
        <article>
          <span>Provider / 真值写入</span>
          <strong>
            {projection.provider} / {projection.official_truth_write ? "是" : "否"}
          </strong>
        </article>
      </div>
      <ul className="compact-list" data-testid="gsi-o3-movements">
        {projection.comparison.movements.map((movement) => (
          <li key={movement.signal_key}>{movementDetails(movement)}</li>
        ))}
      </ul>
      <p className="lifecycle-boundary">{stateMessage("SUCCESS")}</p>
      <details>
        <summary>已知限制</summary>
        <ul className="compact-list">
          {projection.known_limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </details>
    </>
  );
}

function renderStudentBody(projection: GSICrossRoundStudentProjection) {
  return (
    <>
      <div className="summary-grid" data-testid="gsi-o3-student-summary">
        <article>
          <span>Movement 数量</span>
          <strong>{projection.movements.length}</strong>
        </article>
        <article>
          <span>上下文</span>
          <strong>{projection.context_status}</strong>
        </article>
        <article>
          <span>Provider / 真值写入</span>
          <strong>
            {projection.provider} / {projection.official_truth_write ? "是" : "否"}
          </strong>
        </article>
      </div>
      <ul className="compact-list" data-testid="gsi-o3-movements">
        {projection.movements.map((movement, index) => (
          <li key={`${movement.stakeholder_type}-${movement.intent}-${index}`}>
            {movementDetails(movement)}
          </li>
        ))}
      </ul>
      <p className="lifecycle-boundary">{stateMessage("SUCCESS")}</p>
      <details>
        <summary>已知限制</summary>
        <ul className="compact-list">
          {projection.known_limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </details>
    </>
  );
}

export function GsiCrossRoundInsightPanel(props: GsiCrossRoundInsightPanelProps) {
  const selection = useMemo(
    () =>
      props.selectors === undefined
        ? readGsiCrossRoundSelection()
        : props.selectors
          ? { state: "READY" as const, selectors: props.selectors }
          : { state: "MISSING" as const },
    [props.selectors]
  );
  const [projection, setProjection] = useState<GsiCrossRoundProjection | null>(null);
  const [failure, setFailure] = useState<{ code: string; status: number } | null>(null);

  useEffect(() => {
    let active = true;
    setProjection(null);
    setFailure(null);
    if (selection.state !== "READY" || !selection.selectors || !props.token) return () => undefined;
    void loadProjection(props, selection.selectors)
      .then((nextProjection) => {
        if (active) setProjection(nextProjection);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        const error = reason as Partial<GsiCrossRoundRequestError>;
        setFailure({
          code: typeof error.code === "string" ? error.code : "GSI_REQUEST_FAILED",
          status: typeof error.status === "number" ? error.status : 0
        });
      });
    return () => {
      active = false;
    };
  }, [
    props.apiBase,
    props.surface,
    props.tenantId,
    props.token,
    selection.state,
    selection.selectors
  ]);

  const state: GsiCrossRoundViewState = !props.token
    ? "UNAUTHENTICATED"
    : selection.state === "MISSING" || selection.state === "INVALID"
      ? "INSUFFICIENT_EXACT_CONTEXT"
      : failure
        ? classifyGsiCrossRoundFailure(failure.code, failure.status)
        : projection
          ? getGsiCrossRoundContextStatus(projection) === "CONTEXT_UNAVAILABLE"
            ? "CONTEXT_UNAVAILABLE"
            : getGsiCrossRoundContextStatus(projection) === "REBASE_REQUIRED"
              ? "REBASE_REQUIRED"
              : "SUCCESS"
          : "LOADING";

  return (
    <section
      className="summary-panel gsi-o3-cross-round-insight"
      aria-label={
        props.surface === "teacher"
          ? "Teacher GSI cross-round insight"
          : "Student GSI cross-round insight"
      }
      data-testid="gsi-o3-cross-round-insight"
      data-state={state}
    >
      <div className="summary-heading">
        <div>
          <p className="eyebrow">GSI-O3 · existing compare BFF</p>
          <h2>跨回合利益相关方洞察</h2>
        </div>
        <strong className="summary-badge">
          {props.surface === "teacher" ? "教师" : "学员"} · 只读
        </strong>
      </div>
      {state !== "SUCCESS" && state !== "CONTEXT_UNAVAILABLE" ? (
        <StatePanel status={statePanelStatus(state)} message={stateMessage(state)} />
      ) : null}
      {state === "CONTEXT_UNAVAILABLE" ? (
        <StatePanel status="partial" message={stateMessage(state)} />
      ) : null}
      {projection && state !== "REBASE_REQUIRED" && state !== "FORBIDDEN" && state !== "ERROR"
        ? props.surface === "teacher" && projection.surface === "teacher"
          ? renderTeacherBody(projection)
          : props.surface === "student" && projection.surface === "student"
            ? renderStudentBody(projection)
            : null
        : null}
    </section>
  );
}

export default GsiCrossRoundInsightPanel;
