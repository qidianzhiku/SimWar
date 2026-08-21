import { useEffect, useState } from "react";
import type { W4ProjectionBase } from "@simwar/shared-contracts";

void import("@simwar/ui/w4-commercial.css");

type PanelStatus =
  | "loading"
  | "empty"
  | "partial"
  | "ready"
  | "blocked"
  | "permission"
  | "stale"
  | "conflict"
  | "dependency-missing"
  | "error"
  | "retry";

interface Props {
  token: string;
  tenantId: string;
  courseId?: string | undefined;
  runId?: string | undefined;
  roundId?: string | undefined;
  roundNo?: number | undefined;
  teamId?: string | undefined;
}

interface ProjectionResponse extends W4ProjectionBase {
  process_information: { status: string; activity_id: string };
  outcome_information: { status: string; opening_state_ref: unknown; closing_state_ref: unknown };
}

function statusLabel(status: PanelStatus): string {
  return {
    loading: "加载中",
    empty: "空状态",
    partial: "部分可用",
    ready: "就绪",
    blocked: "存在阻塞",
    permission: "权限受限",
    stale: "上下文过期",
    conflict: "上下文冲突",
    "dependency-missing": "依赖缺失",
    error: "加载失败",
    retry: "可重试"
  }[status];
}

function failureStatus(code: string): PanelStatus {
  if (code.includes("403") || code.includes("PERMISSION")) return "permission";
  if (code.includes("409") || code.includes("CONFLICT")) return "conflict";
  if (code.includes("NOT_FOUND")) return "dependency-missing";
  return "retry";
}

function stateValueLabel(value: string | undefined, fallback = "等待中"): string {
  if (!value) return fallback;
  return (
    (
      {
        ready: "已就绪",
        active: "进行中",
        pending: "待处理",
        blocked: "存在阻塞",
        completed: "已完成",
        available: "可查看"
      } as Record<string, string>
    )[value.toLowerCase()] ?? value
  );
}

export function W4EnterpriseStatePanel({
  token,
  tenantId,
  courseId = "course_demo",
  runId,
  roundId,
  roundNo,
  teamId
}: Props) {
  const [status, setStatus] = useState<PanelStatus>("loading");
  const [projection, setProjection] = useState<ProjectionResponse | null>(null);
  const [notice, setNotice] = useState("");
  const [projectName, setProjectName] = useState("新区康养中心");
  const [cost, setCost] = useState("300");
  const [beds, setBeds] = useState("120");
  const [leadTime, setLeadTime] = useState("2");
  const [busy, setBusy] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    if (!token || !runId || !roundNo || !teamId) {
      setStatus(token ? "dependency-missing" : "permission");
      setProjection(null);
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    fetch(
      `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"}/api/v1/bff/student/w4/runs/${runId}/rounds/${roundNo}/portfolio?course_id=${encodeURIComponent(courseId)}&team_id=${encodeURIComponent(teamId)}&round_id=${encodeURIComponent(roundId ?? `round_${runId}_${roundNo}`)}`,
      {
        headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
        signal: controller.signal
      }
    )
      .then(async (response) => {
        const envelope = (await response.json()) as { data?: ProjectionResponse; code?: string };
        if (!response.ok) {
          const code = envelope.code ?? "W4-LOAD-ERROR";
          setStatus(failureStatus(code));
          throw new Error(code);
        }
        setProjection(envelope.data ?? null);
        const nextStatus = envelope.data?.state
          ? envelope.data.initiatives.some((initiative) => initiative.status === "blocked")
            ? "blocked"
            : envelope.data.closing_state_ref
              ? "ready"
              : "partial"
          : "empty";
        setStatus(nextStatus);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setNotice(error instanceof Error ? error.message : "W4 状态暂时不可用");
        setStatus((current) => (current === "loading" ? "error" : current));
      });
    return () => controller.abort();
  }, [courseId, reloadVersion, roundNo, runId, teamId, tenantId, token]);

  async function submitProject(): Promise<void> {
    if (!runId || !roundId || !roundNo || !teamId) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"}/api/v1/w4/runs/${runId}/rounds/${roundNo}/strategic-decisions`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            "x-tenant-id": tenantId
          },
          body: JSON.stringify({
            course_id: courseId,
            team_id: teamId,
            decision: {
              decision_id: `w4-project-${runId}-${roundNo}-${Date.now()}`,
              tenant_id: tenantId,
              course_id: courseId,
              run_id: runId,
              round_id: roundId,
              round_no: roundNo,
              team_id: teamId,
              kind: "new_project",
              version: 1,
              status: "canonical",
              payload: {
                project_name: projectName,
                cost: Number(cost),
                cycle_rounds: Number(leadTime) + 1,
                area: Number(beds) * 100,
                beds: Number(beds),
                bed_mix: {
                  standard: Math.round(Number(beds) * 0.6),
                  memory_care: Math.round(Number(beds) * 0.3),
                  premium: Math.round(Number(beds) * 0.1)
                },
                ramp: 0.4,
                lead_time_rounds: Number(leadTime)
              }
            }
          })
        }
      );
      const envelope = (await response.json()) as { code?: string };
      if (!response.ok) throw new Error(envelope.code ?? "W4-DECISION-ERROR");
      setNotice("项目承诺已提交，正在进入后续计划流程");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "提交失败");
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="sw-w4-panel" aria-label="战略项目承诺">
      <div className="sw-w4-panel__header">
        <div>
          <p className="sw-w4-panel__eyebrow">学员 · 当前回合</p>
          <h2 className="sw-w4-panel__title">提交项目承诺</h2>
        </div>
        <strong className="sw-w4-panel__status" data-status={status}>
          {statusLabel(status)}
        </strong>
      </div>
      <p className="sw-w4-panel__description">
        只填写当前回合需要的项目参数，系统会继续维护承诺、计划与正式结果之间的边界。
      </p>
      {projection?.opening_state_ref ? (
        <div className="sw-w4-metric-grid">
          <div className="sw-w4-metric">
            <span className="sw-w4-metric__label">起始状态</span>
            <strong className="sw-w4-metric__value">
              {projection.opening_state_ref.enterprise_state_id}
            </strong>
          </div>
          <div className="sw-w4-metric">
            <span className="sw-w4-metric__label">项目承诺</span>
            <strong className="sw-w4-metric__value">{projection.commitments.length}</strong>
          </div>
          <div className="sw-w4-metric">
            <span className="sw-w4-metric__label">行动计划</span>
            <strong className="sw-w4-metric__value">{projection.initiatives.length}</strong>
          </div>
          <div className="sw-w4-metric">
            <span className="sw-w4-metric__label">结算状态</span>
            <strong className="sw-w4-metric__value">
              {projection.closing_state_ref?.enterprise_state_id ?? "待结算"}
            </strong>
          </div>
        </div>
      ) : null}
      {projection ? (
        <div className="sw-w4-metric-grid">
          <div className="sw-w4-metric">
            <span className="sw-w4-metric__label">处理状态</span>
            <strong className="sw-w4-metric__value">
              {stateValueLabel(projection.process_information.status)}
            </strong>
          </div>
          <div className="sw-w4-metric">
            <span className="sw-w4-metric__label">结果状态</span>
            <strong className="sw-w4-metric__value">
              {stateValueLabel(projection.outcome_information.status)}
            </strong>
          </div>
        </div>
      ) : null}
      {projection ? (
        <div className="sw-w4-panel__note">
          <div>
            起始与结束差异：
            {projection.path_evidence.opening_vs_closing?.changed_paths.join("、") ||
              "等待官方结算"}
          </div>
          <div>
            官方回放证据：{projection.path_evidence.official_replay_path.replay_ids.length} 条 ·
            是否写入正式结果：
            {projection.path_evidence.official_replay_path.replay_writes_formal_results === false
              ? "否"
              : "未证明"}
          </div>
          <div>
            同一决策意图的历史差异：
            {stateValueLabel(
              projection.path_evidence.same_current_decision_different_history.status,
              "未观察"
            )}
          </div>
        </div>
      ) : null}
      {projection?.latest_strategic_action ? (
        <div className="sw-w4-panel__note" aria-label="项目承诺回执">
          <div>
            来源角色：{projection.latest_strategic_action.admission.authority} · 处理规则：
            {projection.latest_strategic_action.admission.policy}
          </div>
          <div>
            团队合并回执：{projection.latest_strategic_action.admission.merge_commit_id ?? "未确认"}{" "}
            · 团队确认：
            {projection.latest_strategic_action.admission.team_confirmation_id ?? "未确认"}
          </div>
          <div>
            成本：{projection.latest_strategic_action.cost} · 预计周期：
            {projection.latest_strategic_action.lead_time_rounds} 回合 · 是否可撤回：
            {projection.latest_strategic_action.reversible ? "是" : "否"}
          </div>
          <div>
            前置条件：{projection.latest_strategic_action.dependencies.join("、") || "无"} ·
            目标假设：{projection.latest_strategic_action.kpi_hypothesis}
          </div>
          {projection.latest_strategic_action.known_limits.map((limit) => (
            <div key={limit}>当前限制：{limit}</div>
          ))}
        </div>
      ) : null}
      {projection?.initiatives.length ? (
        <ul className="sw-w4-list" aria-label="行动计划">
          {projection.initiatives.map((initiative) => (
            <li key={initiative.initiative_id}>
              {initiative.project?.project_name ?? initiative.kind} ·{" "}
              {stateValueLabel(initiative.status)} · 剩余 {initiative.remaining_lead_time_rounds}{" "}
              回合
            </li>
          ))}
        </ul>
      ) : null}
      <fieldset className="sw-w4-form" disabled={busy || !token || !runId || !roundNo || !teamId}>
        <legend className="sw-w4-form__legend">新建战略项目</legend>
        <div className="sw-w4-form__grid">
          <label>
            项目名称
            <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
          </label>
          <label>
            预计成本
            <input type="number" value={cost} onChange={(event) => setCost(event.target.value)} />
          </label>
          <label>
            床位数量
            <input type="number" value={beds} onChange={(event) => setBeds(event.target.value)} />
          </label>
          <label>
            预计周期（回合）
            <input
              type="number"
              min="0"
              value={leadTime}
              onChange={(event) => setLeadTime(event.target.value)}
            />
          </label>
        </div>
        <button className="sw-w4-panel__action" type="button" onClick={() => void submitProject()}>
          提交项目承诺
        </button>
      </fieldset>
      {status === "retry" || status === "dependency-missing" || status === "error" ? (
        <button
          className="sw-w4-panel__action"
          type="button"
          onClick={() => setReloadVersion((value) => value + 1)}
        >
          重新加载项目状态
        </button>
      ) : null}
      {notice ? (
        <p className="sw-w4-panel__notice" role="status">
          {notice}
        </p>
      ) : null}
    </article>
  );
}
