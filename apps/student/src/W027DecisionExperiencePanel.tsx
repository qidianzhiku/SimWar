import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ApiEnvelope,
  W027JudgmentKind,
  W027PrivateJudgment,
  W027StudentDecisionExperienceDTO
} from "@simwar/shared-contracts";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const KINDS: W027JudgmentKind[] = ["value", "assumption", "evidence", "risk", "tradeoff"];
type Props = {
  active: boolean;
  courseId?: string | undefined;
  roundId?: string | undefined;
  runId?: string | undefined;
  teamId?: string | undefined;
  tenantId: string;
  token?: string | undefined;
};
type Phase = "idle" | "loading" | "ready" | "missing" | "denied" | "error";
type SaveState = "draft" | "saving" | "saved" | "stale" | "denied" | "failed_retryable";
type Draft = {
  kind: W027JudgmentKind;
  problemFrame: string;
  assumptions: string;
  options: string;
  tradeOffs: string;
  prediction: string;
  confidence: string;
  rationale: string;
  statement: string;
  evidenceRefs: string;
  status: W027PrivateJudgment["status"];
};

class W027RequestError extends Error {
  code: string;
  retryable: boolean;
  constructor(code: string, message: string, retryable = true) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}
const emptyDraft = (kind: W027JudgmentKind = "risk"): Draft => ({
  kind,
  problemFrame: "",
  assumptions: "",
  options: "",
  tradeOffs: "",
  prediction: "",
  confidence: "0.5",
  rationale: "",
  statement: "",
  evidenceRefs: "",
  status: "draft"
});
const splitLines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
const joinLines = (value: string[] | undefined) => (value ?? []).join("\n");
const draftFrom = (value?: W027PrivateJudgment): Draft =>
  value
    ? {
        kind: value.kind,
        problemFrame: value.problem_frame,
        assumptions: joinLines(value.assumptions),
        options: joinLines(value.options_considered),
        tradeOffs: joinLines(value.trade_offs),
        prediction: value.prediction,
        confidence: String(value.confidence),
        rationale: value.rationale,
        statement: value.statement,
        evidenceRefs: joinLines(value.evidence_refs),
        status: value.status
      }
    : emptyDraft();
const latest = (workspace: W027StudentDecisionExperienceDTO, kind: W027JudgmentKind) =>
  workspace.private_judgments
    .filter((item) => item.kind === kind)
    .sort((a, b) => b.version - a.version)[0];
const hasTrace = (workspace: W027StudentDecisionExperienceDTO, key: string) =>
  workspace.trace.stages.some((stage) => stage.stage_key === key);

async function request<T>(
  path: string,
  props: Props,
  init: RequestInit = {},
  signal?: AbortSignal
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(API_BASE + path, {
      ...init,
      ...(signal ? { signal } : {}),
      headers: {
        "content-type": "application/json",
        "x-tenant-id": props.tenantId,
        ...(props.token ? { authorization: "Bearer " + props.token } : {}),
        ...(init.headers ?? {})
      }
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new W027RequestError("W027_NETWORK_ERROR", "network");
  }
  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new W027RequestError("W027_INVALID_RESPONSE", "invalid response");
  }
  if (!response.ok)
    throw new W027RequestError(
      String(envelope.code ?? "HTTP_" + response.status),
      String(envelope.message ?? "request failed"),
      response.status >= 500
    );
  if (envelope.data === undefined)
    throw new W027RequestError("W027_UNKNOWN_RECEIPT", "unknown receipt");
  return envelope.data;
}
function noticeFor(error: unknown) {
  if (
    error instanceof W027RequestError &&
    (error.code.includes("403") ||
      error.code.includes("DENIED") ||
      error.code.includes("PERMISSION"))
  )
    return ["当前角色没有访问这段决策工作区的权限。", error.code] as const;
  if (
    error instanceof W027RequestError &&
    (error.code.includes("STALE") || error.code.includes("CONFLICT"))
  )
    return ["服务端发现工作区已更新，请先刷新并核对当前内容。", error.code] as const;
  return [
    error instanceof W027RequestError && error.retryable
      ? "工作区暂时不可用，可以重试。"
      : "工作区请求被拒绝。",
    error instanceof W027RequestError ? error.code : "W027_REQUEST_FAILED"
  ] as const;
}

export function W027DecisionExperiencePanel(props: Props) {
  const [workspace, setWorkspace] = useState<W027StudentDecisionExperienceDTO | null>(null);
  const workspaceRef = useRef<W027StudentDecisionExperienceDTO | null>(null);
  const [phase, setPhase] = useState<Phase>(props.active ? "loading" : "idle");
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const draftRef = useRef(draft);
  const dirtyRef = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("draft");
  const [resolutionRationale, setResolutionRationale] = useState("");
  const [dissentNote, setDissentNote] = useState("");
  const [commandBusy, setCommandBusy] = useState(false);
  const [notice, setNotice] = useState("等待 W027 工作区");
  const [technical, setTechnical] = useState("");
  const [retry, setRetry] = useState(0);
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const contextKey = [
    props.tenantId,
    props.courseId,
    props.runId,
    props.roundId,
    props.teamId,
    props.token
  ].join("|");
  const updateDraft = useCallback((field: keyof Omit<Draft, "kind" | "status">, value: string) => {
    setDraft((current) => {
      const next = { ...current, [field]: value };
      draftRef.current = next;
      return next;
    });
    dirtyRef.current = true;
    setDirty(true);
    setSaveState("draft");
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    const id = ++requestId.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (!props.active) {
      setPhase("idle");
      setNotice("当前回合未开放编辑");
      return false;
    }
    if (!props.token || !props.runId || !props.roundId || !props.teamId) {
      setPhase("missing");
      setNotice("等待服务端返回当前角色工作区");
      return false;
    }
    if (!workspaceRef.current) setPhase("loading");
    try {
      const next = await request<W027StudentDecisionExperienceDTO>(
        "/api/v1/bff/student/w027/decision-experience?course_id=" +
          encodeURIComponent(props.courseId ?? "course_demo") +
          "&run_id=" +
          encodeURIComponent(props.runId) +
          "&round_id=" +
          encodeURIComponent(props.roundId) +
          "&team_id=" +
          encodeURIComponent(props.teamId),
        props,
        {},
        controller.signal
      );
      if (id !== requestId.current) return false;
      workspaceRef.current = next;
      setWorkspace(next);
      if (!next.context.permissions.can_read_role_workspace) {
        setPhase("denied");
        setNotice("当前角色没有读取权限");
        setTechnical("W027_READ_PERMISSION_DENIED");
        return false;
      }
      setPhase("ready");
      setNotice(dirtyRef.current ? "服务端已同步；正在保留你的编辑" : "W027 工作区已同步");
      setTechnical("");
      if (!dirtyRef.current) {
        const nextDraft = draftFrom(latest(next, draftRef.current.kind));
        draftRef.current = nextDraft;
        setDraft(nextDraft);
        setSaveState(nextDraft.status === "ready" ? "saved" : "draft");
      }
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
      if (id !== requestId.current) return false;
      workspaceRef.current = null;
      setWorkspace(null);
      const [message, code] = noticeFor(error);
      setPhase(code.includes("PERMISSION") ? "denied" : "error");
      setNotice(message);
      setTechnical(code);
      return false;
    }
  }, [
    props.active,
    props.courseId,
    props.roundId,
    props.runId,
    props.teamId,
    props.tenantId,
    props.token
  ]);

  useEffect(() => {
    workspaceRef.current = null;
    dirtyRef.current = false;
    draftRef.current = emptyDraft();
    setWorkspace(null);
    setDraft(emptyDraft());
    setDirty(false);
    setSaveState("draft");
    setResolutionRationale("");
    setDissentNote("");
    setCommandBusy(false);
    setTechnical("");
    setPhase(props.active ? "loading" : "idle");
    setNotice(props.active ? "正在读取当前角色工作区" : "当前回合未开放编辑");
  }, [contextKey, props.active]);
  useEffect(() => {
    void refresh();
    return () => abortRef.current?.abort();
  }, [refresh, retry]);

  async function save(status: W027PrivateJudgment["status"]) {
    if (
      !workspace?.context.permissions.can_write_private_judgment ||
      !props.runId ||
      !props.roundId ||
      !props.teamId
    )
      return;
    if (!draft.problemFrame.trim() || !draft.statement.trim()) {
      setNotice("请先填写问题框架和判断陈述");
      setSaveState("failed_retryable");
      return;
    }
    setSaveState("saving");
    setNotice(status === "ready" ? "正在准备角色判断" : "正在保存私有判断");
    try {
      await request("/api/v1/bff/student/w027/private-judgment", props, {
        method: "PUT",
        body: JSON.stringify({
          course_id: props.courseId ?? "course_demo",
          run_id: props.runId,
          round_id: props.roundId,
          team_id: props.teamId,
          kind: draft.kind,
          problem_frame: draft.problemFrame.trim(),
          assumptions: splitLines(draft.assumptions),
          options_considered: splitLines(draft.options),
          trade_offs: splitLines(draft.tradeOffs),
          prediction: draft.prediction.trim(),
          confidence: Math.max(0, Math.min(1, Number(draft.confidence) || 0)),
          rationale: draft.rationale.trim(),
          statement: draft.statement.trim(),
          evidence_refs: splitLines(draft.evidenceRefs),
          status
        })
      });
      dirtyRef.current = false;
      setDirty(false);
      setDraft((current) => ({ ...current, status }));
      setSaveState("saved");
      const refreshed = await refresh();
      setNotice(
        refreshed
          ? status === "ready"
            ? "角色判断已准备，可进入安全立场协作"
            : "私有判断已保存"
          : status === "ready"
            ? "角色判断已保存；工作区刷新失败，请重试"
            : "私有判断已保存；工作区刷新失败，请重试"
      );
    } catch (error) {
      const [message, code] = noticeFor(error);
      setNotice(message);
      setTechnical(code);
      setSaveState(
        code.includes("STALE")
          ? "stale"
          : code.includes("PERMISSION")
            ? "denied"
            : "failed_retryable"
      );
    }
  }
  async function proposeResolution() {
    if (
      !workspace?.divergence ||
      !workspace.context.permissions.can_propose_resolution ||
      !props.runId ||
      !props.roundId ||
      !props.teamId ||
      !workspace.team_safe_positions[0]
    )
      return;
    setCommandBusy(true);
    setNotice("正在提交分歧解决提案");
    try {
      const position = workspace.team_safe_positions[0];
      await request("/api/v1/bff/student/w027/resolution", props, {
        method: "POST",
        body: JSON.stringify({
          course_id: props.courseId ?? "course_demo",
          run_id: props.runId,
          round_id: props.roundId,
          team_id: props.teamId,
          source_digest: workspace.divergence.source_digest,
          selected_position_ids: [position.position_id],
          selected_option: position.summary,
          resolution_mode: "OBSERVED_CANDIDATE_SELECTION",
          rationale: resolutionRationale.trim() || "基于当前团队安全立场选择观察到的候选方案。",
          supporting_evidence_refs: [
            "w027_divergence_" + workspace.divergence.source_digest.slice(0, 16)
          ],
          trade_off: "在当前分歧中平衡团队安全立场。",
          risk: "保留异议仍属于过程证据，不改变正式真值。",
          affected_divergence_ids: workspace.divergence.divergences.map(
            (item) => item.divergence_id
          )
        })
      });
      setResolutionRationale("");
      setCommandBusy(false);
      setNotice("分歧解决提案已记录");
      const refreshed = await refresh();
      if (!refreshed) setNotice("分歧解决提案已记录；工作区刷新失败，请重试");
    } catch (error) {
      const [message, code] = noticeFor(error);
      setCommandBusy(false);
      setNotice(message);
      setTechnical(code);
    }
  }
  async function acknowledge(status: "ACKNOWLEDGED" | "DISSENT_PRESERVED") {
    if (
      !workspace?.resolution ||
      !workspace.context.permissions.can_acknowledge_resolution ||
      !props.runId ||
      !props.roundId ||
      !props.teamId
    )
      return;
    setCommandBusy(true);
    setNotice(status === "DISSENT_PRESERVED" ? "正在保存保留异议" : "正在确认解决提案");
    try {
      await request("/api/v1/bff/student/w027/resolution/acknowledgement", props, {
        method: "POST",
        body: JSON.stringify({
          course_id: props.courseId ?? "course_demo",
          run_id: props.runId,
          round_id: props.roundId,
          team_id: props.teamId,
          resolution_id: workspace.resolution.resolution_id,
          status,
          ...(status === "DISSENT_PRESERVED" ? { dissent_note: dissentNote.trim() } : {})
        })
      });
      setDissentNote("");
      setCommandBusy(false);
      setNotice(status === "DISSENT_PRESERVED" ? "异议已保留并进入服务端证据" : "解决提案已确认");
      const refreshed = await refresh();
      if (!refreshed)
        setNotice(
          status === "DISSENT_PRESERVED"
            ? "异议已保留；工作区刷新失败，请重试"
            : "解决提案已确认；工作区刷新失败，请重试"
        );
    } catch (error) {
      const [message, code] = noticeFor(error);
      setCommandBusy(false);
      setNotice(message);
      setTechnical(code);
    }
  }

  const readOnly = phase === "denied" || !workspace?.context.permissions.can_write_private_judgment;
  const stages = workspace
    ? [
        [
          "Role READY",
          draft.status === "ready" || hasTrace(workspace, "ROLE_POSITION_PUBLISHED")
            ? "READY"
            : "未准备"
        ],
        [
          "Team Confirm",
          hasTrace(workspace, "TEAM_CONFIRMED") ||
          hasTrace(workspace, "CANONICAL_DECISION_MILESTONE")
            ? "已确认"
            : "等待角色工作区"
        ],
        ["Round Lock", props.active ? "OPEN" : "由服务端决定"],
        [
          "Settlement",
          hasTrace(workspace, "CANONICAL_DECISION_MILESTONE") ? "服务端已读回" : "尚未结算"
        ]
      ]
    : [];
  const field = (
    label: string,
    aria: string,
    key: keyof Omit<Draft, "kind" | "status">,
    placeholder?: string,
    wide = false
  ) => (
    <label className={wide ? "w027-field-wide" : ""}>
      {label}
      <textarea
        aria-label={aria}
        value={draft[key] as string}
        disabled={readOnly || saveState === "saving"}
        onChange={(event) => updateDraft(key, event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );

  return (
    <section className="panel bff-panel w027-journey" aria-label="学生团队决策旅程">
      <div className="panel-title">
        <div>
          <span className="eyebrow">P2-A · STUDENT TEAM DECISION</span>
          <h2>从个人判断到正式 readback</h2>
        </div>
        <div className="w027-title-actions">
          <span role="status" aria-live="polite">
            {notice}
          </span>
          <button
            className="secondary w027-refresh-button"
            type="button"
            onClick={() => void refresh()}
            disabled={phase === "loading" || commandBusy}
          >
            刷新 W027 工作区
          </button>
        </div>
      </div>
      {technical ? <span className="compatibility-copy w027-technical">{technical}</span> : null}
      {phase === "loading" ? (
        <div className="w027-state" data-state="loading">
          正在读取当前角色工作区…
        </div>
      ) : null}
      {phase === "missing" ? (
        <div className="w027-state" data-state="unknown">
          等待服务端返回当前角色工作区。
        </div>
      ) : null}
      {phase === "idle" ? (
        <div className="w027-state" data-state="unknown">
          当前回合未开放编辑；已保留只读边界。
        </div>
      ) : null}
      {phase === "error" || phase === "denied" ? (
        <div
          className="w027-state w027-state-error"
          data-state={phase === "denied" ? "denied" : "error"}
          role="alert"
        >
          <strong>
            {phase === "denied" ? "当前角色无法读取该工作区" : "W027 工作区暂时不可用"}
          </strong>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            重新加载 W027 工作区
          </button>
        </div>
      ) : null}
      {dirty && (phase === "error" || phase === "denied" || phase === "missing") ? (
        <div className="w027-draft-recovery" data-testid="w027-local-draft-recovery" role="status">
          本地私有编辑已保留；恢复服务端投影后才能继续同步，不会展示给其他角色。
        </div>
      ) : null}
      {workspace && phase !== "denied" ? (
        <>
          <div className="w027-context-strip">
            <span>
              当前正式角色：<strong>{workspace.context.role_key}</strong>
            </span>
            <span>仅当前租户 / 队伍 / 回合</span>
            <span>私有全文：SELF_ONLY</span>
          </div>
          <div className="w027-status-grid" aria-label="决策链状态">
            {stages.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="w027-journey-section">
            <div className="w027-section-heading">
              <div>
                <span className="eyebrow">01 · PRIVATE JUDGMENT</span>
                <h3>仅本角色可见的完整判断</h3>
              </div>
              <span className={"w027-save-state w027-save-state-" + saveState}>
                {saveState.toUpperCase()}
              </span>
            </div>
            <p className="w027-boundary">
              队友只会看到后续 role-safe position；教师不会看到这段私有全文。
            </p>
            <div className="w027-form-grid">
              <label>
                判断类型
                <select
                  value={draft.kind}
                  disabled={readOnly || saveState === "saving"}
                  onChange={(event) => {
                    const next = { ...draft, kind: event.target.value as W027JudgmentKind };
                    draftRef.current = next;
                    setDraft(next);
                    dirtyRef.current = true;
                    setDirty(true);
                  }}
                >
                  {KINDS.map((kind) => (
                    <option value={kind} key={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                信心（0–1）
                <input
                  aria-label="判断信心"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={draft.confidence}
                  disabled={readOnly || saveState === "saving"}
                  onChange={(event) => updateDraft("confidence", event.target.value)}
                />
              </label>
              {field("问题框架", "问题框架", "problemFrame", "你正在解决什么问题？", true)}
              {field("关键假设", "关键假设", "assumptions", "每行一个假设")}
              {field("考虑过的选项", "考虑过的选项", "options", "每行一个选项")}
              {field("权衡与取舍", "权衡与取舍", "tradeOffs", "每行一个取舍")}
              {field("预测", "预测", "prediction")}
              {field("我的判断陈述", "我的判断陈述", "statement", "写下你愿意承担的判断", true)}
              {field("判断理由", "判断理由", "rationale")}
              {field("证据引用", "证据引用", "evidenceRefs", "每行一个引用")}
            </div>
            <div className="w027-action-row">
              <button
                type="button"
                disabled={readOnly || saveState === "saving"}
                onClick={() => void save("draft")}
              >
                保存私有判断
              </button>
              <button
                type="button"
                className="primary"
                disabled={readOnly || saveState === "saving"}
                onClick={() => void save("ready")}
              >
                准备我的判断
              </button>
              {dirty ? <span role="status">本地编辑尚未保存</span> : null}
            </div>
          </div>
          <div className="w027-journey-section">
            <div className="w027-section-heading">
              <div>
                <span className="eyebrow">02 · ROLE-SAFE POSITION</span>
                <h3>团队安全立场</h3>
              </div>
              <span className="w027-readonly-badge">服务端只读投影</span>
            </div>
            <p className="w027-boundary">
              这里不展示任何成员的完整私有判断，只展示允许团队协作的安全位置、证据缺口与风险。
            </p>
            {workspace.own_role_position ? (
              <div className="w027-own-position">
                <strong>我的安全立场</strong>
                <span>{workspace.own_role_position.summary}</span>
                <small>
                  {workspace.own_role_position.status} · v{workspace.own_role_position.version}
                </small>
              </div>
            ) : (
              <div className="w027-state" data-state="empty">
                尚未发布当前角色的安全立场。
              </div>
            )}
            <div className="w027-safe-positions" aria-label="团队安全立场列表">
              {workspace.team_safe_positions.map((position) => (
                <div className="w027-safe-position" key={position.position_id}>
                  <span className="role-key">{position.role_key}</span>
                  <span>{position.summary}</span>
                  <small>
                    {position.status} · v{position.version}
                  </small>
                </div>
              ))}
            </div>
          </div>
          <div className="w027-journey-section">
            <div className="w027-section-heading">
              <div>
                <span className="eyebrow">03 · DIVERGENCE + DISSENT</span>
                <h3>关键分歧与保留异议</h3>
              </div>
              <strong className="w027-status-chip">{workspace.divergence?.status ?? "NONE"}</strong>
            </div>
            {workspace.divergence?.divergences.length ? (
              <div className="w027-divergences" aria-label="关键分歧列表">
                {workspace.divergence.divergences.map((item) => (
                  <div className="w027-divergence" key={item.divergence_id}>
                    <span>{item.dimension}</span>
                    <span>
                      {item.candidates
                        .map((candidate) => candidate.role_key + ": " + candidate.value)
                        .join(" · ")}
                    </span>
                    <strong>{item.status}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w027-state" data-state="empty">
                当前没有可显示的团队分歧。
              </div>
            )}
            {workspace.context.permissions.can_propose_resolution &&
            workspace.divergence?.divergences.length ? (
              <div className="w027-resolution-editor">
                <label>
                  解决提案理由
                  <textarea
                    aria-label="分歧解决理由"
                    value={resolutionRationale}
                    disabled={commandBusy}
                    onChange={(event) => setResolutionRationale(event.target.value)}
                    placeholder="共同事实、角色立场、护栏、理由与风险"
                  />
                </label>
                <button
                  type="button"
                  disabled={commandBusy}
                  onClick={() => void proposeResolution()}
                >
                  提出观察到的候选解决方案
                </button>
              </div>
            ) : (
              <p className="w027-boundary">
                当前角色没有提出解决提案的权限；正式合并与确认由角色工作区唯一负责。
              </p>
            )}
            {workspace.resolution ? (
              <div className="w027-resolution-card">
                <div>
                  <span>解决模式</span>
                  <strong>{workspace.resolution.resolution_mode}</strong>
                </div>
                <div>
                  <span>候选方案</span>
                  <strong>{workspace.resolution.selected_option}</strong>
                </div>
                <div>
                  <span>权威角色</span>
                  <strong>{workspace.resolution.authority_role_key}</strong>
                </div>
                <div>
                  <span>状态</span>
                  <strong>{workspace.resolution.status}</strong>
                </div>
                {workspace.context.permissions.can_acknowledge_resolution ? (
                  <>
                    <label>
                      我的保留异议
                      <textarea
                        aria-label="保留异议说明"
                        value={dissentNote}
                        disabled={commandBusy}
                        onChange={(event) => setDissentNote(event.target.value)}
                        placeholder="如果不同意，说明仍需保留的异议"
                      />
                    </label>
                    <div className="w027-action-row">
                      <button
                        type="button"
                        disabled={commandBusy}
                        onClick={() => void acknowledge("ACKNOWLEDGED")}
                      >
                        确认解决方案
                      </button>
                      <button
                        type="button"
                        disabled={commandBusy}
                        onClick={() => void acknowledge("DISSENT_PRESERVED")}
                      >
                        保留我的异议
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="w027-journey-section w027-readback">
            <div className="w027-section-heading">
              <div>
                <span className="eyebrow">04 · TEAM DECISION READBACK</span>
                <h3>团队草案、确认与正式结果</h3>
              </div>
              <span className="w027-readonly-badge">不在此重复写入</span>
            </div>
            <div className="w027-readback-grid">
              {stages.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>
                    {label === "Role READY"
                      ? "个人判断与安全立场"
                      : label === "Team Confirm"
                        ? "角色工作区唯一确认入口"
                        : label === "Round Lock"
                          ? "服务端回合状态"
                          : "正式结果只读 readback"}
                  </small>
                </div>
              ))}
            </div>
            <p className="w027-boundary">
              Confirm 不等于 Round Lock，Round Lock 不等于 Settlement；完整 merge / confirm 写入由
              StudentRoleWorkflowPanel 唯一负责。
            </p>
          </div>
          <details className="w027-known-limits">
            <summary>已知限制与证据边界</summary>
            <ul>
              {[
                ...workspace.known_limits,
                ...workspace.trace.known_limits,
                ...(workspace.divergence?.known_limits ?? [])
              ]
                .filter((value, index, values) => values.indexOf(value) === index)
                .map((limit) => (
                  <li key={limit}>{limit}</li>
                ))}
            </ul>
          </details>
        </>
      ) : null}
    </section>
  );
}
