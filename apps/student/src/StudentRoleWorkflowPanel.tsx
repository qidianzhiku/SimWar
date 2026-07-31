import { useCallback, useEffect, useState } from "react";
import type {
  ApiEnvelope,
  DecisionPayload,
  RoleDecisionSection,
  StudentRoleWorkflowMergeDTO,
  StudentRoleWorkflowWorkspaceDTO,
  TeamConfirmation
} from "@simwar/shared-contracts";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

interface StudentRoleWorkflowPanelProps {
  active: boolean;
  roundId: string | undefined;
  runId: string | undefined;
  teamId: string | undefined;
  tenantId: string;
  token: string | undefined;
  onActiveChange?: (active: boolean) => void;
}

const initialDraft: DecisionPayload = {
  capacity_plan: "hold",
  cash_buffer_target: 0.1,
  marketing_budget: 0,
  pricing: { base_price: 12800 },
  service_quality_budget: 0,
  strategy_statement: ""
};

async function roleWorkflowRequest<T>(
  path: string,
  props: Pick<StudentRoleWorkflowPanelProps, "tenantId" | "token">,
  options: { body?: unknown; method?: string } = {}
): Promise<T> {
  const init: RequestInit = {
    headers: {
      "content-type": "application/json",
      "x-tenant-id": props.tenantId,
      ...(props.token ? { authorization: `Bearer ${props.token}` } : {})
    },
    method: options.method ?? "GET"
  };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  const response = await fetch(`${API_BASE}${path}`, init);
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
  return envelope.data;
}

export function StudentRoleWorkflowPanel(props: StudentRoleWorkflowPanelProps) {
  const [workspace, setWorkspace] = useState<StudentRoleWorkflowWorkspaceDTO | null>(null);
  const [draft, setDraft] = useState<DecisionPayload>(initialDraft);
  const [notice, setNotice] = useState("waiting for assignment");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!props.active || !props.token || !props.runId || !props.roundId || !props.teamId) {
      setWorkspace(null);
      return;
    }
    try {
      const next = await roleWorkflowRequest<StudentRoleWorkflowWorkspaceDTO>(
        `/api/v1/bff/student/role-workspace?run_id=${encodeURIComponent(
          props.runId
        )}&round_id=${encodeURIComponent(props.roundId)}&team_id=${encodeURIComponent(
          props.teamId
        )}`,
        props
      );
      setWorkspace(next);
      setDraft((current) => ({
        ...current,
        ...next.section?.payload,
        pricing: next.section?.payload.pricing ?? current.pricing
      }));
      setNotice("current");
    } catch (error) {
      setWorkspace(null);
      setNotice(error instanceof Error ? error.message : "role workspace unavailable");
    }
  }, [props.active, props.roundId, props.runId, props.teamId, props.tenantId, props.token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    props.onActiveChange?.(Boolean(workspace));
  }, [props.onActiveChange, workspace]);

  useEffect(
    () => () => {
      props.onActiveChange?.(false);
    },
    [props.onActiveChange]
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
    setBusy(true);
    try {
      const result = await roleWorkflowRequest<T>(path, props, { body, method });
      setNotice(success);
      await refresh();
      return result;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "role workflow action failed");
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  const fields = workspace?.context.permissions.editable_fields ?? [];
  const sectionStatus = workspace?.section
    ? `${workspace.section.status} · v${workspace.section.version}`
    : "draft · v0";

  return (
    <section className="role-workflow-panel" aria-label="Student role workflow">
      <div className="panel-title">
        <div>
          <p className="eyebrow">C3 Role Workflow</p>
          <h2>角色工作区</h2>
        </div>
        <span>{notice}</span>
      </div>
      {!workspace ? (
        <p className="muted">等待教师分配当前 Run 的角色。</p>
      ) : (
        <>
          <div className="role-workflow-summary">
            <div>
              <span>Role</span>
              <strong>{workspace.context.role_key}</strong>
            </div>
            <div>
              <span>Section</span>
              <strong>{sectionStatus}</strong>
            </div>
            <div>
              <span>Team decision</span>
              <strong>{workspace.confirmation?.status ?? "pending"}</strong>
            </div>
          </div>
          <div className="role-workflow-fields">
            {fields.includes("strategy_statement") ? (
              <label>
                策略说明
                <textarea
                  aria-label="策略说明"
                  disabled={busy || workspace.section?.status === "ready"}
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
              disabled={busy || workspace.section?.status === "ready"}
              onClick={() =>
                void mutate<RoleDecisionSection>(
                  "/api/v1/bff/student/role-workspace/section",
                  {
                    ...scope(),
                    expected_version: workspace.section?.version ?? 0,
                    payload: editablePayload()
                  },
                  "role draft saved",
                  "PUT"
                )
              }
            >
              保存角色草稿
            </button>
            <button
              disabled={busy || !workspace.section || workspace.section.status === "ready"}
              onClick={() =>
                void mutate<RoleDecisionSection>(
                  "/api/v1/bff/student/role-workspace/ready",
                  {
                    ...scope(),
                    expected_version: workspace.section?.version
                  },
                  "role draft ready"
                )
              }
            >
              提交角色草稿
            </button>
            {workspace.context.permissions.can_create_merge_commit ? (
              <button
                disabled={busy || workspace.section?.status !== "ready"}
                onClick={() =>
                  void mutate<StudentRoleWorkflowMergeDTO>(
                    "/api/v1/bff/student/role-workspace/merge",
                    scope(),
                    "merge validated"
                  )
                }
              >
                创建团队合并
              </button>
            ) : null}
            {workspace.context.permissions.can_submit_canonical_decision ? (
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
                    "team decision confirmed"
                  )
                }
              >
                确认团队决策
              </button>
            ) : null}
          </div>
          <p className="evidence-note">
            {workspace.merge_candidate?.status ?? "merge pending"} · private peer drafts hidden
          </p>
        </>
      )}
    </section>
  );
}
