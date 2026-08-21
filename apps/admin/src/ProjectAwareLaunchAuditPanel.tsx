import { useEffect, useState } from "react";
import type { ProjectAwareBlocker, ProjectAwareTeamReadiness } from "@simwar/shared-contracts";
import {
  fetchProjectAwareLaunchAudit,
  type ProjectAwareLaunchAuditProjection
} from "./project-aware-launch-audit-client";

void import("@simwar/ui/project-aware.css");

export interface ProjectAwareLaunchAuditPanelProps {
  baseUrl: string;
  courseId?: string | undefined;
  runId?: string | undefined;
  tenantId: string;
  token: string;
}

type PanelPhase = "empty" | "loading" | "ready" | "error";

function stateKey(
  state: string | undefined
): "ready" | "blocked" | "accepted" | "loading" | "unknown" {
  if (state === "READY") return "ready";
  if (state === "BLOCKED") return "blocked";
  if (state === "ACCEPTED") return "accepted";
  if (state === "LOADING") return "loading";
  return "unknown";
}

function readinessLabel(state: string | undefined): string {
  if (state === "READY") return "可开课";
  if (state === "BLOCKED") return "暂不可开课";
  if (state === "ACCEPTED") return "已接受";
  if (state === "LOADING") return "读取中";
  return "状态未知";
}

function bindingLabel(status: string | undefined): string {
  if (status === "VALIDATED" || status === "READY") return "已确认";
  if (status === "BLOCKED") return "待处理";
  return "待确认";
}

function blockerLabel(blocker: ProjectAwareBlocker): string {
  if (blocker.code === "MISSING_ASSIGNMENT") return "缺少项目档案分配";
  return blocker.action || "请联系教师处理当前准备度提醒";
}

function profileReferenceLabel(
  reference: ProjectAwareTeamReadiness["project_profile_reference"]
): string {
  if (!reference) return "暂无项目档案";
  return `${reference.project_profile_id}@${reference.version}`;
}

function profileDigest(reference: ProjectAwareTeamReadiness["project_profile_reference"]): string {
  return reference?.content_digest ?? "暂无档案摘要";
}

function scopeReady(
  props: ProjectAwareLaunchAuditPanelProps
): props is ProjectAwareLaunchAuditPanelProps & { courseId: string; runId: string } {
  return Boolean(
    props.baseUrl.trim() &&
    props.tenantId.trim() &&
    props.token.trim() &&
    props.courseId?.trim() &&
    props.runId?.trim()
  );
}

export function ProjectAwareLaunchAuditPanel(props: ProjectAwareLaunchAuditPanelProps) {
  const [phase, setPhase] = useState<PanelPhase>("empty");
  const [projection, setProjection] = useState<ProjectAwareLaunchAuditProjection | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!scopeReady(props)) {
      setPhase("empty");
      setProjection(null);
      setError("");
      return;
    }

    const controller = new AbortController();
    setPhase("loading");
    setProjection(null);
    setError("");
    void fetchProjectAwareLaunchAudit({
      baseUrl: props.baseUrl,
      courseId: props.courseId,
      runId: props.runId,
      signal: controller.signal,
      tenantId: props.tenantId,
      token: props.token
    })
      .then((next) => {
        if (controller.signal.aborted) return;
        setProjection(next);
        setPhase("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setProjection(null);
        setError("当前页面暂时无法读取审计摘要，请稍后重试。");
        setPhase("error");
      });

    return () => controller.abort();
  }, [props.baseUrl, props.courseId, props.runId, props.tenantId, props.token, reloadKey]);

  const readiness = projection?.readiness;

  return (
    <section className="sw-project-aware" aria-label="项目开课审计">
      <div className="sw-project-aware__heading">
        <div>
          <p className="sw-project-aware__eyebrow">只读审计 · 项目开课</p>
          <h2 className="sw-project-aware__title">项目开课与回执审计</h2>
          <p className="sw-project-aware__subtitle">查看当前租户、课程与运行的准备度和历史回执。</p>
        </div>
        {projection ? (
          <strong className="sw-project-aware__status" data-state="readonly">
            只读
          </strong>
        ) : null}
      </div>

      {phase === "empty" ? (
        <p className="sw-project-aware__empty">选择课程和运行后，我们会读取准备度与回执摘要。</p>
      ) : null}
      {phase === "loading" ? (
        <p className="sw-project-aware__loading" role="status">
          正在读取审计摘要…
        </p>
      ) : null}
      {phase === "error" ? (
        <div className="sw-project-aware__callout sw-project-aware__callout--error" role="alert">
          <strong>审计摘要读取失败</strong>
          <span>{error}</span>
          <div className="sw-project-aware__actions">
            <button
              type="button"
              className="sw-project-aware__button"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              重试
            </button>
          </div>
        </div>
      ) : null}

      {projection && readiness ? (
        <>
          <div className="sw-project-aware__metrics">
            <article className="sw-project-aware__metric">
              <span className="sw-project-aware__metric-label">当前范围</span>
              <strong className="sw-project-aware__metric-value">
                {readiness.scope.tenant_id}
              </strong>
              <code className="sw-project-aware__code">
                {readiness.scope.course_id} · {readiness.scope.run_id}
              </code>
            </article>
            <article className="sw-project-aware__metric">
              <span className="sw-project-aware__metric-label">总体准备度</span>
              <strong className="sw-project-aware__metric-value">
                {readinessLabel(readiness.state)}
              </strong>
              <small className="sw-project-aware__metric-detail">
                更新于 {readiness.generated_at}
              </small>
            </article>
            <article className="sw-project-aware__metric">
              <span className="sw-project-aware__metric-label">队伍投影</span>
              <strong className="sw-project-aware__metric-value">{readiness.teams.length}</strong>
              <small className="sw-project-aware__metric-detail">
                项目绑定：{bindingLabel(readiness.formal_binding.status)}
              </small>
            </article>
            <article className="sw-project-aware__metric">
              <span className="sw-project-aware__metric-label">开课回执</span>
              <strong className="sw-project-aware__metric-value">
                {projection.lineage.length}
              </strong>
              <small className="sw-project-aware__metric-detail">当前范围内的历史记录</small>
            </article>
          </div>

          {readiness.blockers.length > 0 ? (
            <div
              className="sw-project-aware__callout sw-project-aware__callout--warning"
              role="status"
            >
              <strong>准备度提醒</strong>
              <ul className="sw-project-aware__list">
                {readiness.blockers.map((blocker, index) => (
                  <li key={`${blocker.code}-${index}`}>{blockerLabel(blocker)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <section className="sw-project-aware__section" aria-labelledby="admin-team-readiness">
            <h3 className="sw-project-aware__section-title" id="admin-team-readiness">
              各队伍准备度
            </h3>
            <div className="sw-project-aware__team-grid">
              {readiness.teams.map((team) => (
                <article className="sw-project-aware__team" key={team.team_id}>
                  <div className="sw-project-aware__team-heading">
                    <span>
                      {team.team_name} ·{" "}
                      <code className="sw-project-aware__code">{team.team_id}</code>
                    </span>
                    <strong
                      className="sw-project-aware__team-status"
                      data-state={stateKey(team.state)}
                    >
                      {readinessLabel(team.state)}
                    </strong>
                  </div>
                  <span className="sw-project-aware__team-detail">
                    项目档案：{profileReferenceLabel(team.project_profile_reference)}
                  </span>
                  <code className="sw-project-aware__code">
                    {profileDigest(team.project_profile_reference)}
                  </code>
                  {team.blockers.length > 0 ? (
                    <ul className="sw-project-aware__list">
                      {team.blockers.map((blocker, index) => (
                        <li key={`${team.team_id}-${blocker.code}-${index}`}>
                          {blockerLabel(blocker)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="sw-project-aware__team-detail">当前没有待处理提醒</span>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="sw-project-aware sw-project-aware--nested" aria-label="开课回执">
            <div className="sw-project-aware__receipt-heading">
              <div>
                <p className="sw-project-aware__eyebrow">开课回执</p>
                <h3 className="sw-project-aware__receipt-title">历史回执</h3>
              </div>
            </div>
            {projection.lineage.length === 0 ? (
              <p className="sw-project-aware__empty">当前课程与运行还没有开课回执。</p>
            ) : (
              <div className="sw-project-aware__receipts">
                {projection.lineage.map((receipt) => (
                  <article className="sw-project-aware__receipt" key={receipt.audit_id}>
                    <div className="sw-project-aware__receipt-heading">
                      <span className="sw-project-aware__receipt-label">请求状态</span>
                      <strong
                        className="sw-project-aware__status"
                        data-state={stateKey(receipt.readiness_state)}
                      >
                        {readinessLabel(receipt.status)}
                      </strong>
                    </div>
                    <span className="sw-project-aware__receipt-label">审计编号</span>
                    <code className="sw-project-aware__code">{receipt.audit_id}</code>
                    <span className="sw-project-aware__receipt-label">幂等凭证</span>
                    <code className="sw-project-aware__code">
                      {receipt.command_idempotency_key}
                    </code>
                    <span className="sw-project-aware__receipt-label">创建时间</span>
                    <code className="sw-project-aware__code">{receipt.created_at}</code>
                  </article>
                ))}
              </div>
            )}
          </section>
          <p className="sw-project-aware__note">
            仅展示当前租户和课程范围内的安全投影；本面板不提供写操作。
          </p>
        </>
      ) : null}
    </section>
  );
}
