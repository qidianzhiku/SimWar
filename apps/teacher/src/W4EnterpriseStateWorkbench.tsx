import { useEffect, useRef, useState } from "react";
import type { W4MatchedProjectArena, W4ProjectionBase } from "@simwar/shared-contracts";

void import("@simwar/ui/w4-commercial.css");

interface Props {
  token: string;
  tenantId: string;
  courseId?: string | undefined;
  runId?: string | undefined;
  roundId?: string | undefined;
  roundNo?: number | undefined;
  teamId?: string | undefined;
}

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

type Projection = W4ProjectionBase & {
  process_information: { status: string; activity_id: string };
  outcome_information: { status: string; opening_state_ref: unknown; closing_state_ref: unknown };
};

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
        in_progress: "进行中",
        draft: "待开始",
        pending: "待处理",
        blocked: "存在阻塞",
        completed: "已完成",
        failed: "处理失败",
        cancelled: "已取消",
        available: "可查看",
        empty: "暂无记录",
        official: "正式结果",
        proven: "已验证",
        not_observed: "尚未观察",
        approved: "已批准",
        construction: "建设中",
        activated: "已启用"
      } as Record<string, string>
    )[value.toLowerCase()] ?? value
  );
}

export function W4EnterpriseStateWorkbench({
  token,
  tenantId,
  courseId = "course_demo",
  runId,
  roundId,
  roundNo,
  teamId
}: Props) {
  const [projection, setProjection] = useState<Projection | null>(null);
  const [status, setStatus] = useState<PanelStatus>("dependency-missing");
  const [arena, setArena] = useState<W4MatchedProjectArena | null>(null);
  const [arenaStatus, setArenaStatus] = useState<PanelStatus>("dependency-missing");
  const [arenaError, setArenaError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [selectedProjectEntryId, setSelectedProjectEntryId] = useState("");
  const arenaRequestVersion = useRef(0);
  const selectedProjectId =
    projection?.project_portfolio.find((entry) => entry.project_entry_id === selectedProjectEntryId)
      ?.project_entry_id ??
    projection?.project_portfolio[0]?.project_entry_id ??
    "";
  const selectedProject = projection?.project_portfolio.find(
    (entry) => entry.project_entry_id === selectedProjectId
  );

  useEffect(() => {
    arenaRequestVersion.current += 1;
    setArena(null);
    setArenaError("");
    setArenaStatus("dependency-missing");
  }, [courseId, roundId, roundNo, runId, selectedProjectId, teamId, tenantId, token]);

  useEffect(() => {
    if (!token || !runId || !roundNo || !teamId) {
      setStatus(token ? "dependency-missing" : "permission");
      setProjection(null);
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    fetch(
      `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"}/api/v1/bff/teacher/w4/runs/${runId}/rounds/${roundNo}/portfolio?course_id=${encodeURIComponent(courseId)}&team_id=${encodeURIComponent(teamId)}&round_id=${encodeURIComponent(roundId ?? `round_${runId}_${roundNo}`)}`,
      {
        headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
        signal: controller.signal
      }
    )
      .then(async (response) => {
        const envelope = (await response.json()) as { data?: Projection; code?: string };
        if (!response.ok) {
          const code = envelope.code ?? "W4-TEACHER-ERROR";
          setStatus(failureStatus(code));
          throw new Error(code);
        }
        setProjection(envelope.data ?? null);
        setStatus(
          envelope.data?.state
            ? envelope.data.initiatives.some((initiative) => initiative.status === "blocked")
              ? "blocked"
              : envelope.data.closing_state_ref
                ? "ready"
                : "partial"
            : "empty"
        );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setStatus((current) => (current === "loading" ? "error" : current));
      });
    return () => controller.abort();
  }, [courseId, reloadVersion, roundId, runId, roundNo, teamId, tenantId, token]);

  async function loadMatchedArena(): Promise<void> {
    const reference = selectedProject?.project_profile_reference;
    if (!runId || !reference) {
      setArena(null);
      setArenaError("当前回合还没有绑定 Project Profile，暂不能比较匹配项目路径。");
      setArenaStatus("dependency-missing");
      return;
    }
    const requestVersion = ++arenaRequestVersion.current;
    setArenaStatus("loading");
    setArenaError("");
    try {
      const query = new URLSearchParams({
        course_id: courseId,
        project_profile_id: reference.project_profile_id,
        version: reference.version,
        content_digest: reference.content_digest
      });
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
      const response = await fetch(
        apiBase + "/api/v1/bff/teacher/w4/runs/" + runId + "/matched-arena?" + query.toString(),
        { headers: { authorization: "Bearer " + token, "x-tenant-id": tenantId } }
      );
      const envelope = (await response.json()) as {
        data?: W4MatchedProjectArena;
        code?: string;
      };
      if (!response.ok || !envelope.data) {
        throw new Error(envelope.code ?? "W4-MATCHED-ARENA-ERROR");
      }
      if (requestVersion !== arenaRequestVersion.current) return;
      setArena(envelope.data);
      setArenaStatus(envelope.data.different_history_observed ? "ready" : "partial");
    } catch (error) {
      if (requestVersion !== arenaRequestVersion.current) return;
      const code = error instanceof Error ? error.message : "W4-MATCHED-ARENA-ERROR";
      setArenaError(code);
      setArenaStatus(failureStatus(code));
    }
  }

  return (
    <article className="sw-w4-panel" aria-label="企业项目演进观察">
      <div className="sw-w4-panel__header">
        <div>
          <p className="sw-w4-panel__eyebrow">教师 · 课堂观察</p>
          <h2 className="sw-w4-panel__title">战略演进观察</h2>
        </div>
        <strong className="sw-w4-panel__status" data-status={status}>
          {statusLabel(status)}
        </strong>
      </div>
      <p className="sw-w4-panel__description">
        聚焦阻塞、里程碑与阶段迁移，帮助教师在课堂中解释变化，而不是修改正式结果。
      </p>
      <div className="sw-w4-metric-grid">
        <div className="sw-w4-metric">
          <span className="sw-w4-metric__label">起始状态</span>
          <strong className="sw-w4-metric__value">
            {projection?.opening_state_ref?.enterprise_state_id ?? "待建立"}
          </strong>
        </div>
        <div className="sw-w4-metric">
          <span className="sw-w4-metric__label">结算状态</span>
          <strong className="sw-w4-metric__value">
            {projection?.closing_state_ref?.enterprise_state_id ?? "等待结算"}
          </strong>
        </div>
        <div className="sw-w4-metric">
          <span className="sw-w4-metric__label">承诺 / 影响</span>
          <strong className="sw-w4-metric__value">
            {projection?.commitments.length ?? 0} / {projection?.effects.length ?? 0}
          </strong>
        </div>
        <div className="sw-w4-metric">
          <span className="sw-w4-metric__label">处理状态</span>
          <strong className="sw-w4-metric__value">
            {stateValueLabel(projection?.process_information.status)}
          </strong>
        </div>
        <div className="sw-w4-metric">
          <span className="sw-w4-metric__label">结果状态</span>
          <strong className="sw-w4-metric__value">
            {stateValueLabel(projection?.outcome_information.status)}
          </strong>
        </div>
      </div>
      <ul className="sw-w4-list" aria-label="项目里程碑">
        {(projection?.initiatives ?? []).map((initiative) => (
          <li key={initiative.initiative_id}>
            {initiative.project?.project_name ?? "通用战略项目"} ·{" "}
            {stateValueLabel(initiative.status)} · {initiative.current_milestone} · 剩余{" "}
            {initiative.remaining_lead_time_rounds} 回合
          </li>
        ))}
      </ul>
      <div className="sw-w4-panel__note">
        <div>
          起始与结束差异：
          {projection?.path_evidence.opening_vs_closing?.changed_paths.join("、") || "等待官方结算"}
        </div>
        <div>
          官方回放证据：{projection?.path_evidence.official_replay_path.replay_ids.length ?? 0} 条 ·
          影子应用是否写入正式结果：
          {projection?.path_evidence.official_replay_path.replay_writes_formal_results === false
            ? "否"
            : "未证明"}
        </div>
        <div>
          同一决策意图的历史差异：
          {stateValueLabel(
            projection?.path_evidence.same_current_decision_different_history.status,
            "未观察"
          )}
        </div>
      </div>
      {projection?.strategic_portfolio ? (
        <section className="sw-w4-panel__note" aria-label="治理战略项目组合">
          <strong>治理战略项目组合</strong>
          <p>
            {projection.strategic_portfolio.portfolio_id} ·{" "}
            {projection.strategic_portfolio.members.length} 个项目 ·{" "}
            {stateValueLabel(projection.strategic_portfolio.constraints.status)}
          </p>
          <ul className="sw-w4-list" aria-label="项目组合成员">
            {projection.strategic_portfolio.members.map((member) => (
              <li key={member.project_entry_id}>
                {member.project_name} · {member.project_profile_reference.project_profile_id} ·{" "}
                {member.lifecycle_status} · ramp {member.ramp ?? "—"} · 激活回合{" "}
                {member.activation_round_no ?? "—"} · 前置{" "}
                {member.dependency_project_entry_ids.join("、") || "无"}
              </li>
            ))}
          </ul>
          <div>
            计划成本 {projection.strategic_portfolio.constraints.total_project_cost} · 已分配资本{" "}
            {projection.strategic_portfolio.constraints.allocated_capital_principal} · 未覆盖成本{" "}
            {projection.strategic_portfolio.constraints.unfunded_project_cost}
          </div>
          <div>
            正式状态权威：{projection.strategic_portfolio.persistence.official_state_authority} ·
            历史决策不重入：否 · 组合为 derived projection
          </div>
        </section>
      ) : null}
      <section className="sw-w4-panel__note" aria-label="教师策略工作台">
        <div>
          <strong>教师策略工作台</strong> · 只读连接过程、结果与可解释的路径证据。
        </div>
        <ol className="sw-w4-list" aria-label="过程与结果时间线">
          <li>
            决策承诺 {projection?.commitments.length ?? 0} 条 · 已产生影响{" "}
            {projection?.effects.length ?? 0} 条
          </li>
          {(projection?.initiatives ?? []).map((initiative) => (
            <li key={"timeline-" + initiative.initiative_id}>
              {initiative.project?.project_name ?? "战略项目"} ·{" "}
              {stateValueLabel(initiative.status)} · {initiative.current_milestone} · 还需{" "}
              {initiative.remaining_lead_time_rounds} 回合
            </li>
          ))}
          <li>
            官方结果 · {stateValueLabel(projection?.outcome_information.status, "等待官方结算")}
          </li>
        </ol>
        {projection?.project_portfolio.length ? (
          <label>
            比较项目
            <select
              aria-label="匹配项目选择"
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectEntryId(event.target.value)}
            >
              {projection.project_portfolio.map((entry) => (
                <option key={entry.project_entry_id} value={entry.project_entry_id}>
                  {entry.project_name} · {entry.project_profile_reference.project_profile_id} ·{" "}
                  {entry.project_profile_reference.version}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          className="sw-w4-panel__action"
          type="button"
          onClick={() => void loadMatchedArena()}
          disabled={arenaStatus === "loading" || !projection?.project_portfolio.length}
        >
          {arenaStatus === "loading" ? "正在载入匹配路径" : "查看匹配项目路径"}
        </button>
        {arenaError ? (
          <p className="sw-w4-panel__notice" role="status">
            {arenaError}
          </p>
        ) : null}
        {arena ? (
          <section aria-label="匹配项目路径">
            <p>
              Project Profile {arena.project_profile_reference.project_profile_id} ·{" "}
              {arena.different_history_observed ? "已观察到不同历史" : "尚未观察到不同历史"}
            </p>
            <ul className="sw-w4-list">
              {arena.teams.map((team) => (
                <li key={team.team_id}>
                  <strong>{team.team_id}</strong> · 路径 {team.path_digest.slice(0, 12)} ·{" "}
                  {team.path_evidence?.opening_vs_closing?.changed_paths.join("、") ||
                    (team.closing_state_ref ? "已结算（详细路径证据不可用）" : "等待结果")}
                </li>
              ))}
            </ul>
            <ul className="sw-w4-list" aria-label="匹配路径限制">
              {arena.known_limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </section>
        ) : null}
        <section aria-label="教师复盘">
          <strong>教师复盘</strong>
          <p>
            当前决策与历史的差异：
            {stateValueLabel(
              projection?.path_evidence.same_current_decision_different_history.status,
              "未观察"
            )}
            。复盘只解释正式回放与路径证据，不修改官方状态、结算或排名。
          </p>
        </section>
      </section>
      {status === "retry" ||
      status === "dependency-missing" ||
      status === "error" ||
      status === "conflict" ? (
        <button
          className="sw-w4-panel__action"
          type="button"
          onClick={() => setReloadVersion((value) => value + 1)}
        >
          重新加载项目演进
        </button>
      ) : null}
      <p className="sw-w4-panel__note">
        教师侧只读：可查看阻塞、里程碑和状态迁移，不修改正式结果。
      </p>
    </article>
  );
}
