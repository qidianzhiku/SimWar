import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ApiEnvelope,
  DecisionPayload,
  DecisionPayloadFieldPath,
  RoleDecisionSection,
  RoleKey,
  StudentDecisionTraceDTO,
  StudentRoleWorkflowMergeDTO,
  StudentRoleWorkflowWorkspaceDTO,
  TeamConfirmation,
  TeamDivergenceValue,
  TeamResolutionSafeDTO
} from "@simwar/shared-contracts";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

const roleWorkflowStatusLabels: Record<string, string> = {
  draft: "草稿",
  ready: "已就绪",
  pending: "待确认",
  validated: "已校验",
  confirmed: "已确认",
  active: "进行中",
  submitted: "已提交",
  rejected: "已驳回",
  merged: "已合并"
};

export function roleWorkflowStatusCopy(status: string): {
  primary: string;
  compatibility: string;
} {
  return {
    primary: roleWorkflowStatusLabels[status.toLowerCase()] ?? "服务端状态",
    compatibility: status
  };
}

export function getRoleWorkflowNoticeCopy(value: string): {
  primary: string;
  compatibility?: string;
} {
  if (value.includes("ROLE_WORKFLOW_STALE_SECTION")) {
    return { primary: "角色草稿已被更新，请刷新后重试。", compatibility: value };
  }
  if (value.includes("ROLE_WORKFLOW_ASSIGNMENT_NOT_FOUND")) {
    return { primary: "当前运行尚未分配角色工作区。", compatibility: value };
  }
  if (value.includes("ROLE_WORKFLOW_UNKNOWN_RECEIPT")) {
    return { primary: "角色工作区返回未知回执，请刷新后重试。", compatibility: value };
  }
  if (/^[A-Z][A-Z0-9_-]+(?:-\d+)*:/.test(value) || /\b(failed|error|denied)\b/i.test(value)) {
    return { primary: "角色工作区请求失败，请刷新后重试。", compatibility: value };
  }
  return { primary: value };
}

export function isCurrentRoleWorkflowRequest(
  requestId: number,
  currentId: number,
  aborted = false
): boolean {
  return !aborted && requestId === currentId;
}

export function canReadStudentRoleWorkspace(
  workspace: Pick<StudentRoleWorkflowWorkspaceDTO, "context"> | null
): boolean {
  return workspace?.context?.permissions?.can_read_role_workspace === true;
}

export function studentDecisionTraceCurrentStageCopy(
  trace: StudentDecisionTraceDTO | null
): string {
  return trace?.trace_stages?.[trace.trace_stages.length - 1]?.safe_label ?? "尚未开始记录";
}

function isStudentDecisionTrace(value: unknown): value is StudentDecisionTraceDTO {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StudentDecisionTraceDTO>;
  return (
    candidate.schema_version === "student-decision-trace.v1" &&
    Array.isArray(candidate.trace_stages) &&
    typeof candidate.current_stage === "string" &&
    typeof candidate.trace_completeness === "string"
  );
}

interface StudentRoleWorkflowPanelProps {
  active: boolean;
  roundId: string | undefined;
  runId: string | undefined;
  teamId: string | undefined;
  tenantId: string;
  token: string | undefined;
  activeRoleKeys?: readonly RoleKey[];
  onAvailabilityChange?: (availability: "checking" | "active" | "inactive" | "error") => void;
}

const initialDraft: DecisionPayload = {
  capacity_plan: "hold",
  cash_buffer_target: 0.1,
  marketing_budget: 0,
  pricing: { base_price: 12800 },
  service_quality_budget: 0,
  strategy_statement: ""
};

export function requiredResolutionRoleKeys(
  workspace: Pick<
    StudentRoleWorkflowWorkspaceDTO,
    "assignment" | "divergence_set" | "resolution_acknowledgements"
  > | null,
  activeRoleKeys: readonly RoleKey[] = []
): RoleKey[] {
  if (!workspace) return [];
  const roles = new Set<RoleKey>([...activeRoleKeys, workspace.assignment.role_key]);
  for (const divergence of workspace.divergence_set?.divergences ?? []) {
    for (const candidate of divergence.candidates) roles.add(candidate.role_key);
  }
  for (const acknowledgement of workspace.resolution_acknowledgements ?? []) {
    roles.add(acknowledgement.role_key);
  }
  return [...roles];
}

function divergenceValueCopy(value: TeamDivergenceValue): string {
  return typeof value === "number" ? value.toLocaleString("zh-CN") : value;
}

async function roleWorkflowRequest<T>(
  path: string,
  props: Pick<StudentRoleWorkflowPanelProps, "tenantId" | "token">,
  options: { body?: unknown; method?: string; signal?: AbortSignal } = {}
): Promise<T> {
  const init: RequestInit = {
    headers: {
      "content-type": "application/json",
      "x-tenant-id": props.tenantId,
      ...(props.token ? { authorization: `Bearer ${props.token}` } : {})
    },
    method: options.method ?? "GET",
    ...(options.signal ? { signal: options.signal } : {})
  };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  const response = await fetch(`${API_BASE}${path}`, init);
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
  if (envelope.data === undefined) {
    throw new Error("ROLE_WORKFLOW_UNKNOWN_RECEIPT: 服务端未返回可验证回执");
  }
  return envelope.data;
}

export function StudentRoleWorkflowPanel(props: StudentRoleWorkflowPanelProps) {
  const [workspace, setWorkspace] = useState<StudentRoleWorkflowWorkspaceDTO | null>(null);
  const [decisionTrace, setDecisionTrace] = useState<StudentDecisionTraceDTO | null>(null);
  const [draft, setDraft] = useState<DecisionPayload>(initialDraft);
  const [notice, setNotice] = useState("等待角色分配");
  const [busy, setBusy] = useState(false);
  const [resolutionSelections, setResolutionSelections] = useState<
    Partial<Record<DecisionPayloadFieldPath, TeamDivergenceValue>>
  >({});
  const [dissentNote, setDissentNote] = useState("");
  const [availability, setAvailability] = useState<"checking" | "active" | "inactive" | "error">(
    "checking"
  );
  const requestIdentity = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const actionIdentity = useRef(0);
  const actionController = useRef<AbortController | null>(null);
  const contextKey = [
    props.active,
    props.roundId,
    props.runId,
    props.teamId,
    props.tenantId,
    props.token
  ].join("|");

  function beginRefresh(): { requestId: number; controller: AbortController } {
    const requestId = ++requestIdentity.current;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    return { requestId, controller };
  }

  function beginAction(): { requestId: number; controller: AbortController } {
    const requestId = ++actionIdentity.current;
    actionController.current?.abort();
    const controller = new AbortController();
    actionController.current = controller;
    return { requestId, controller };
  }

  const refresh = useCallback(
    async (preserveAction = false) => {
      const { requestId, controller } = beginRefresh();
      if (!preserveAction) {
        actionIdentity.current += 1;
        actionController.current?.abort();
        setBusy(false);
      }
      setAvailability("checking");
      if (!props.active || !props.token || !props.runId || !props.roundId || !props.teamId) {
        if (requestId === requestIdentity.current) {
          setWorkspace(null);
          setDecisionTrace(null);
          setAvailability("inactive");
        }
        return;
      }
      try {
        const next = await roleWorkflowRequest<StudentRoleWorkflowWorkspaceDTO>(
          `/api/v1/bff/student/role-workspace?run_id=${encodeURIComponent(
            props.runId
          )}&round_id=${encodeURIComponent(props.roundId)}&team_id=${encodeURIComponent(
            props.teamId
          )}`,
          props,
          { signal: controller.signal }
        );
        if (
          !isCurrentRoleWorkflowRequest(
            requestId,
            requestIdentity.current,
            controller.signal.aborted
          )
        )
          return;
        if (!canReadStudentRoleWorkspace(next)) {
          setWorkspace(null);
          setAvailability("error");
          setNotice("当前服务端权限不允许读取角色工作区");
          return;
        }
        setWorkspace(next);
        setAvailability("active");
        setDraft((current) => ({
          ...current,
          ...next.section?.payload,
          pricing: next.section?.payload.pricing ?? current.pricing
        }));
        void roleWorkflowRequest<StudentDecisionTraceDTO>(
          `/api/v1/bff/student/role-workspace/decision-trace?run_id=${encodeURIComponent(
            props.runId
          )}&round_id=${encodeURIComponent(props.roundId)}&team_id=${encodeURIComponent(
            props.teamId
          )}`,
          props,
          { signal: controller.signal }
        )
          .then((trace) => {
            if (!isStudentDecisionTrace(trace)) {
              throw new Error("STUDENT_DECISION_TRACE_INVALID_RESPONSE");
            }
            if (
              isCurrentRoleWorkflowRequest(
                requestId,
                requestIdentity.current,
                controller.signal.aborted
              )
            ) {
              setDecisionTrace(trace);
            }
          })
          .catch(() => {
            if (
              isCurrentRoleWorkflowRequest(
                requestId,
                requestIdentity.current,
                controller.signal.aborted
              )
            ) {
              setDecisionTrace(null);
            }
          });
        setNotice("当前角色工作区已就绪");
      } catch (error) {
        if (
          !isCurrentRoleWorkflowRequest(
            requestId,
            requestIdentity.current,
            controller.signal.aborted
          )
        )
          return;
        setWorkspace(null);
        setDecisionTrace(null);
        const message = error instanceof Error ? error.message : "角色工作区暂不可用";
        setAvailability(
          message.includes("ROLE_WORKFLOW_ASSIGNMENT_NOT_FOUND") ? "inactive" : "error"
        );
        setNotice(message);
      }
    },
    [props.active, props.roundId, props.runId, props.teamId, props.tenantId, props.token]
  );

  useEffect(() => {
    requestIdentity.current += 1;
    requestController.current?.abort();
    actionIdentity.current += 1;
    actionController.current?.abort();
    setWorkspace(null);
    setDecisionTrace(null);
    setDraft(initialDraft);
    setResolutionSelections({});
    setDissentNote("");
    setBusy(false);
    setAvailability(props.active ? "checking" : "inactive");
    setNotice(props.active ? "正在读取当前角色工作区" : "等待角色分配");
  }, [contextKey, props.active]);

  useEffect(() => {
    const pendingRefresh = refresh();
    return () => {
      requestIdentity.current += 1;
      requestController.current?.abort();
      actionIdentity.current += 1;
      actionController.current?.abort();
      void pendingRefresh;
    };
  }, [refresh]);

  useEffect(() => {
    props.onAvailabilityChange?.(availability);
  }, [availability, props.onAvailabilityChange]);

  useEffect(
    () => () => {
      requestIdentity.current += 1;
      requestController.current?.abort();
      actionIdentity.current += 1;
      actionController.current?.abort();
      props.onAvailabilityChange?.("checking");
    },
    [props.onAvailabilityChange]
  );

  function scope() {
    return {
      round_id: props.roundId,
      run_id: props.runId,
      team_id: props.teamId
    };
  }

  function editablePayload(): Partial<DecisionPayload> {
    const payload: Partial<DecisionPayload> = {};
    for (const field of workspace?.context.permissions.editable_fields ?? []) {
      if (field === "pricing.base_price") payload.pricing = draft.pricing;
      else payload[field] = draft[field] as never;
    }
    return payload;
  }

  async function mutate<T>(
    path: string,
    body: unknown,
    success: string,
    method = "POST"
  ): Promise<T | undefined> {
    const { requestId, controller } = beginAction();
    setBusy(true);
    try {
      const result = await roleWorkflowRequest<T>(path, props, {
        body,
        method,
        signal: controller.signal
      });
      if (
        !isCurrentRoleWorkflowRequest(requestId, actionIdentity.current, controller.signal.aborted)
      )
        return undefined;
      setNotice(success);
      await refresh(true);
      return result;
    } catch (error) {
      if (
        !isCurrentRoleWorkflowRequest(requestId, actionIdentity.current, controller.signal.aborted)
      )
        return undefined;
      setNotice(error instanceof Error ? error.message : "角色工作区操作失败");
      return undefined;
    } finally {
      if (requestId === actionIdentity.current) setBusy(false);
    }
  }

  async function proposeResolution(): Promise<void> {
    const divergenceSet = workspace?.divergence_set;
    if (!divergenceSet?.divergences.length) return;
    const selectedValues: Partial<Record<DecisionPayloadFieldPath, TeamDivergenceValue>> = {};
    for (const divergence of divergenceSet.divergences) {
      const selected = resolutionSelections[divergence.field];
      if (selected === undefined) {
        setNotice("请为每项分歧明确选择一个已有候选值");
        return;
      }
      selectedValues[divergence.field] = selected;
    }
    await mutate<TeamResolutionSafeDTO>(
      "/api/v1/bff/student/role-workspace/resolution",
      {
        ...scope(),
        selected_values: selectedValues,
        source_digest: divergenceSet.source_digest,
        source_section_ids: divergenceSet.source_section_ids
      },
      "团队解决方案已提出"
    );
  }

  async function acknowledgeResolution(status: "ACKNOWLEDGED" | "DISSENT_PRESERVED") {
    if (!workspace?.team_resolution) return;
    await mutate(
      "/api/v1/bff/student/role-workspace/resolution/acknowledgement",
      {
        ...scope(),
        resolution_id: workspace.team_resolution.resolution_id,
        status,
        ...(status === "DISSENT_PRESERVED" ? { dissent_note: dissentNote } : {})
      },
      status === "DISSENT_PRESERVED" ? "本角色异议已保留" : "本角色已确认解决方案"
    );
  }

  const fields = workspace?.context.permissions.editable_fields ?? [];
  const sectionStatus = workspace?.section
    ? {
        ...roleWorkflowStatusCopy(workspace.section.status),
        compatibility: `${workspace.section.status} · v${workspace.section.version}`,
        primary: `${roleWorkflowStatusCopy(workspace.section.status).primary} · v${workspace.section.version}`
      }
    : {
        primary: "草稿 · v0",
        compatibility: "draft · v0"
      };
  const confirmationStatus = roleWorkflowStatusCopy(workspace?.confirmation?.status ?? "pending");
  const mergeStatus = workspace?.merge_candidate
    ? roleWorkflowStatusCopy(workspace.merge_candidate.status)
    : null;
  const noticeCopy = getRoleWorkflowNoticeCopy(notice);
  const divergenceSet = workspace?.divergence_set;
  const teamResolution = workspace?.team_resolution;
  const ownAcknowledgement = workspace?.resolution_acknowledgements?.find(
    (acknowledgement) => acknowledgement.role_key === workspace.context.role_key
  );
  const allResolutionAcknowledged = requiredResolutionRoleKeys(
    workspace,
    props.activeRoleKeys
  ).every((roleKey) =>
    workspace?.resolution_acknowledgements?.some(
      (acknowledgement) => acknowledgement.role_key === roleKey
    )
  );
  const fieldsLocked =
    busy ||
    workspace?.section?.status === "ready" ||
    !workspace?.context.permissions.can_save_section;

  return (
    <section className="role-workflow-panel" aria-label="Student role workflow">
      <div className="panel-title">
        <div>
          <p className="eyebrow">角色决策链</p>
          <h2>角色工作区</h2>
        </div>
        <span role="status">
          {noticeCopy.primary}{" "}
          {noticeCopy.compatibility ? (
            <span className="compatibility-copy">{noticeCopy.compatibility}</span>
          ) : null}
        </span>
      </div>
      {!workspace ? (
        availability === "error" ? (
          <div className="role-workflow-error feedback-block" data-state="error" role="alert">
            <strong>{noticeCopy.primary}</strong>
            {noticeCopy.compatibility ? (
              <span className="compatibility-copy">{noticeCopy.compatibility}</span>
            ) : null}
            <button type="button" onClick={() => void refresh()}>
              重新加载角色工作区
            </button>
          </div>
        ) : (
          <p className="muted">
            {availability === "checking"
              ? "正在读取当前角色工作区"
              : "等待服务端分配当前运行的角色。"}
          </p>
        )
      ) : (
        <>
          <div className="role-workflow-summary">
            <div>
              <span>角色</span>
              <strong>{workspace.context.role_key}</strong>
            </div>
            <div>
              <span>角色草稿</span>
              <strong>
                {sectionStatus.primary}{" "}
                <span className="compatibility-copy">{sectionStatus.compatibility}</span>
              </strong>
            </div>
            <div>
              <span>团队决策</span>
              <strong>
                {confirmationStatus.primary}{" "}
                <span className="compatibility-copy">{confirmationStatus.compatibility}</span>
              </strong>
            </div>
          </div>
          <section
            className="decision-trace market-world-brief"
            aria-label="Shanghai Market World brief"
            data-market-world-visibility={workspace.market_world_visibility ?? "PRE_VISIBILITY"}
          >
            <div className="panel-title">
              <div>
                <p className="eyebrow">角色安全市场上下文</p>
                <h3>上海养老 Market Brief</h3>
              </div>
              <span role="status">
                {workspace.market_world_visibility === "VISIBLE" ? "已开放" : "尚未开放"}
              </span>
            </div>
            {workspace.market_brief ? (
              <>
                <p>{workspace.market_brief.market_structure}</p>
                <div className="summary-grid">
                  <article>
                    <span>客户张力</span>
                    <strong>{workspace.market_brief.customer_tensions.length}</strong>
                  </article>
                  <article>
                    <span>服务组合</span>
                    <strong>{workspace.market_brief.service_landscape.length}</strong>
                  </article>
                  <article>
                    <span>外部替代</span>
                    <strong>{workspace.market_brief.outside_options.length}</strong>
                  </article>
                </div>
                <p className="evidence-note">
                  这是当前角色可用的产品上下文，不是 settlement truth；不包含私有校准、其他队伍数据或正式结果。
                </p>
              </>
            ) : (
              <p className="muted">
                Market World 尚未在已发布 Course 上完成精确绑定，或当前版本处于 stale/unknown；正式角色工作区仍可继续按服务端状态运行。
              </p>
            )}
          </section>
          <div className="decision-trace" aria-label="决策历程">
            <div className="panel-title">
              <div>
                <p className="eyebrow">过程证据</p>
                <h3>决策历程</h3>
              </div>
              <span role="status">{studentDecisionTraceCurrentStageCopy(decisionTrace)}</span>
            </div>
            {decisionTrace?.trace_stages.length ? (
              <ol>
                {decisionTrace.trace_stages.map((stage, index) => (
                  <li key={`${stage.stage_key}-${index}`}>
                    <strong>{stage.safe_label}</strong>
                    <time dateTime={stage.occurred_at}>
                      {new Date(stage.occurred_at).toLocaleString("zh-CN")}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">暂时没有可显示的过程节点。</p>
            )}
            <p className="evidence-note">
              仅显示当前角色可见的过程节点，不显示队友私有内容或正式结果。
            </p>
          </div>
          {divergenceSet?.divergences.length ? (
            <div className="decision-trace" aria-label="团队分歧与解决方案">
              <div className="panel-title">
                <div>
                  <p className="eyebrow">团队协作证据</p>
                  <h3>待解决分歧</h3>
                </div>
                <span role="status">{teamResolution ? "已提出方案" : "等待队长提出方案"}</span>
              </div>
              {divergenceSet.divergences.map((divergence) => (
                <div className="role-workflow-row" key={divergence.divergence_id}>
                  <div>
                    <strong>{divergence.field}</strong>
                    <div className="compatibility-copy">
                      {divergence.candidates
                        .map(
                          (candidate) =>
                            `${candidate.role_key}: ${divergenceValueCopy(candidate.value)}`
                        )
                        .join(" · ")}
                    </div>
                  </div>
                  {!teamResolution && workspace.context.permissions.can_create_merge_commit ? (
                    <label>
                      选择团队值
                      <select
                        aria-label={`选择团队值 ${divergence.field}`}
                        disabled={busy}
                        value={resolutionSelections[divergence.field] ?? ""}
                        onChange={(event) => {
                          const candidate = divergence.candidates.find(
                            (item) =>
                              `${item.role_key}:${item.source_section_id}` === event.target.value
                          );
                          if (candidate) {
                            setResolutionSelections((current) => ({
                              ...current,
                              [divergence.field]: candidate.value
                            }));
                          }
                        }}
                      >
                        <option value="">请选择已有候选值</option>
                        {divergence.candidates.map((candidate) => (
                          <option
                            key={`${candidate.role_key}-${candidate.source_section_id}`}
                            value={`${candidate.role_key}:${candidate.source_section_id}`}
                          >
                            {candidate.role_key}: {divergenceValueCopy(candidate.value)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span>
                      {teamResolution
                        ? divergenceValueCopy(teamResolution.selected_values[divergence.field]!)
                        : "等待队长"}
                    </span>
                  )}
                </div>
              ))}
              {teamResolution ? (
                <>
                  <p className="evidence-note">
                    每个角色都必须确认方案，或明确保留异议后才能创建团队合并。
                  </p>
                  <div className="role-workflow-list">
                    {requiredResolutionRoleKeys(workspace, props.activeRoleKeys).map((roleKey) => {
                      const acknowledgement = workspace.resolution_acknowledgements?.find(
                        (candidate) => candidate.role_key === roleKey
                      );
                      return (
                        <div className="role-workflow-row" key={roleKey}>
                          <span>{roleKey}</span>
                          <strong>{acknowledgement?.status ?? "待确认"}</strong>
                        </div>
                      );
                    })}
                  </div>
                  {!ownAcknowledgement ? (
                    <div className="role-workflow-actions">
                      <button
                        disabled={busy}
                        onClick={() => void acknowledgeResolution("ACKNOWLEDGED")}
                      >
                        确认解决方案
                      </button>
                      <label>
                        异议说明
                        <textarea
                          aria-label="异议说明"
                          maxLength={280}
                          value={dissentNote}
                          onChange={(event) => setDissentNote(event.target.value)}
                        />
                      </label>
                      <button
                        className="secondary"
                        disabled={busy || !dissentNote.trim()}
                        onClick={() => void acknowledgeResolution("DISSENT_PRESERVED")}
                      >
                        保留异议并确认
                      </button>
                    </div>
                  ) : (
                    <p className="evidence-note">本角色已记录：{ownAcknowledgement.status}</p>
                  )}
                </>
              ) : workspace.context.permissions.can_create_merge_commit ? (
                <button disabled={busy} onClick={() => void proposeResolution()}>
                  提出团队解决方案
                </button>
              ) : null}
              <p className="evidence-note">
                仅展示当前 Team 的 READY 候选值；不展示队友私有草稿、actor 标识或正式结果。
              </p>
            </div>
          ) : null}
          <div className="role-workflow-fields">
            {fields.includes("strategy_statement") ? (
              <label>
                策略说明
                <textarea
                  aria-label="策略说明"
                  disabled={fieldsLocked}
                  value={draft.strategy_statement}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      strategy_statement: event.target.value
                    }))
                  }
                />
              </label>
            ) : null}
            {fields.includes("pricing.base_price") ? (
              <label>
                定价
                <input
                  aria-label="角色定价"
                  disabled={fieldsLocked}
                  min="1"
                  type="number"
                  value={draft.pricing.base_price}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      pricing: { base_price: Number(event.target.value) }
                    }))
                  }
                />
              </label>
            ) : null}
            {fields.includes("marketing_budget") ? (
              <label>
                营销预算
                <input
                  aria-label="角色营销预算"
                  disabled={fieldsLocked}
                  min="0"
                  type="number"
                  value={draft.marketing_budget}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      marketing_budget: Number(event.target.value)
                    }))
                  }
                />
              </label>
            ) : null}
            {fields.includes("service_quality_budget") ? (
              <label>
                服务质量预算
                <input
                  aria-label="角色服务质量预算"
                  disabled={fieldsLocked}
                  min="0"
                  type="number"
                  value={draft.service_quality_budget}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      service_quality_budget: Number(event.target.value)
                    }))
                  }
                />
              </label>
            ) : null}
            {fields.includes("capacity_plan") ? (
              <label>
                产能计划
                <select
                  aria-label="角色产能计划"
                  disabled={fieldsLocked}
                  value={draft.capacity_plan}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      capacity_plan: event.target.value as DecisionPayload["capacity_plan"]
                    }))
                  }
                >
                  <option value="contract">收缩</option>
                  <option value="hold">保持</option>
                  <option value="expand">扩张</option>
                </select>
              </label>
            ) : null}
            {fields.includes("cash_buffer_target") ? (
              <label>
                现金缓冲
                <input
                  aria-label="角色现金缓冲"
                  disabled={fieldsLocked}
                  min="0"
                  step="0.01"
                  type="number"
                  value={draft.cash_buffer_target}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      cash_buffer_target: Number(event.target.value)
                    }))
                  }
                />
              </label>
            ) : null}
          </div>
          <div className="role-workflow-actions">
            <button
              disabled={
                busy ||
                workspace.section?.status === "ready" ||
                !workspace.context.permissions.can_save_section
              }
              onClick={() =>
                void mutate<RoleDecisionSection>(
                  "/api/v1/bff/student/role-workspace/section",
                  {
                    ...scope(),
                    expected_version: workspace.section?.version ?? 0,
                    payload: editablePayload()
                  },
                  "角色草稿已保存",
                  "PUT"
                )
              }
            >
              保存角色草稿
            </button>
            <button
              disabled={
                busy ||
                !workspace.section ||
                workspace.section.status === "ready" ||
                !workspace.context.permissions.can_mark_ready
              }
              onClick={() =>
                void mutate<RoleDecisionSection>(
                  "/api/v1/bff/student/role-workspace/ready",
                  {
                    ...scope(),
                    expected_version: workspace.section?.version
                  },
                  "角色草稿已提交"
                )
              }
            >
              提交角色草稿
            </button>
            {workspace.context.permissions.can_create_merge_commit ? (
              <button
                disabled={
                  busy ||
                  workspace.section?.status !== "ready" ||
                  (Boolean(divergenceSet?.divergences.length) &&
                    (!teamResolution || !allResolutionAcknowledged))
                }
                onClick={() =>
                  void mutate<StudentRoleWorkflowMergeDTO>(
                    "/api/v1/bff/student/role-workspace/merge",
                    scope(),
                    "团队合并已校验"
                  )
                }
              >
                创建团队合并
              </button>
            ) : null}
            {workspace.context.permissions.can_confirm_team_decision &&
            workspace.context.permissions.can_submit_canonical_decision ? (
              <button
                className="primary"
                disabled={busy || !workspace.merge_candidate || Boolean(workspace.confirmation)}
                onClick={() =>
                  void mutate<TeamConfirmation>(
                    "/api/v1/bff/student/role-workspace/confirm",
                    {
                      ...scope(),
                      merge_commit_id: workspace.merge_candidate?.merge_commit_id
                    },
                    "团队决策已确认"
                  )
                }
              >
                确认团队决策
              </button>
            ) : null}
          </div>
          <p className="evidence-note">
            {mergeStatus ? (
              <>
                {mergeStatus.primary}{" "}
                <span className="compatibility-copy">{mergeStatus.compatibility}</span>
              </>
            ) : (
              "等待团队合并"
            )}{" "}
            · 队友私有草稿不会显示
          </p>
        </>
      )}
    </section>
  );
}

export default StudentRoleWorkflowPanel;
