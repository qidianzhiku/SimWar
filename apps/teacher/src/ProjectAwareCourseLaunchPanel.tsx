import { useEffect, useState } from "react";
import type {
  ProjectAwareBlocker,
  ProjectAwareCourseReadiness,
  ProjectAwareLaunchReceipt,
  ProjectAwareTeamReadiness
} from "@simwar/shared-contracts";
import {
  createProjectAwareLaunchIdempotencyKey,
  fetchProjectAwareCourseReadiness,
  launchProjectAwareCourse
} from "./project-aware-launch-client";

void import("@simwar/ui/project-aware.css");

export interface ProjectAwareCourseLaunchPanelProps {
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
  props: ProjectAwareCourseLaunchPanelProps
): props is ProjectAwareCourseLaunchPanelProps & { courseId: string; runId: string } {
  return Boolean(
    props.baseUrl.trim() &&
    props.tenantId.trim() &&
    props.token.trim() &&
    props.courseId?.trim() &&
    props.runId?.trim()
  );
}

export function ProjectAwareCourseLaunchPanel(props: ProjectAwareCourseLaunchPanelProps) {
  const [phase, setPhase] = useState<PanelPhase>("empty");
  const [readiness, setReadiness] = useState<ProjectAwareCourseReadiness | null>(null);
  const [receipt, setReceipt] = useState<ProjectAwareLaunchReceipt | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!scopeReady(props)) {
      setPhase("empty");
      setReadiness(null);
      setReceipt(null);
      setError("");
      return;
    }

    const controller = new AbortController();
    setPhase("loading");
    setReadiness(null);
    setReceipt(null);
    setError("");
    void fetchProjectAwareCourseReadiness({
      baseUrl: props.baseUrl,
      courseId: props.courseId,
      runId: props.runId,
      signal: controller.signal,
      tenantId: props.tenantId,
      token: props.token
    })
      .then((next) => {
        if (controller.signal.aborted) return;
        setReadiness(next);
        setPhase("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setReadiness(null);
        setError("当前页面暂时无法读取开课准备度，请稍后重试。");
        setPhase("error");
      });

    return () => controller.abort();
  }, [props.baseUrl, props.courseId, props.runId, props.tenantId, props.token, reloadKey]);

  async function launch(): Promise<void> {
    if (!scopeReady(props) || !readiness || readiness.state !== "READY" || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await launchProjectAwareCourse({
        baseUrl: props.baseUrl,
        courseId: props.courseId,
        idempotencyKey: createProjectAwareLaunchIdempotencyKey({
          courseId: props.courseId,
          runId: props.runId,
          tenantId: props.tenantId
        }),
        runId: props.runId,
        tenantId: props.tenantId,
        token: props.token
      });
      setReceipt(next);
    } catch {
      setError("开课请求暂未完成，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  const readinessState = readiness ? stateKey(readiness.state) : "unknown";

  return (
    <section className="sw-project-aware" aria-label="项目开课准备">
      <div className="sw-project-aware__heading">
        <div>
          <p className="sw-project-aware__eyebrow">项目开课准备 · 服务端状态</p>
          <h2 className="sw-project-aware__title">项目开课准备</h2>
          <p className="sw-project-aware__subtitle">
            确认当前课程与运行范围后，查看每支队伍的项目准备度。
          </p>
        </div>
        {readiness ? (
          <strong className="sw-project-aware__status" data-state={readinessState}>
            {readinessLabel(readiness.state)}
          </strong>
        ) : null}
      </div>

      {phase === "empty" ? (
        <p className="sw-project-aware__empty">选择课程和运行后，我们会读取服务端的最新准备度。</p>
      ) : null}
      {phase === "loading" ? (
        <p className="sw-project-aware__loading" role="status">
          正在读取开课准备度…
        </p>
      ) : null}
      {phase === "error" ? (
        <div className="sw-project-aware__callout sw-project-aware__callout--error" role="alert">
          <strong>开课准备度读取失败</strong>
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

      {readiness ? (
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
              <span className="sw-project-aware__metric-label">队伍数量</span>
              <strong className="sw-project-aware__metric-value">{readiness.teams.length}</strong>
              <small className="sw-project-aware__metric-detail">
                项目绑定：{bindingLabel(readiness.formal_binding.status)}
              </small>
            </article>
            <article className="sw-project-aware__metric">
              <span className="sw-project-aware__metric-label">权威绑定</span>
              <strong className="sw-project-aware__metric-value">
                {bindingLabel(readiness.formal_binding.status)}
              </strong>
              <code className="sw-project-aware__code">
                {readiness.formal_binding.binding_digest ?? "暂无摘要"}
              </code>
            </article>
          </div>

          {readiness.blockers.length > 0 ? (
            <div
              className="sw-project-aware__callout sw-project-aware__callout--warning"
              role="status"
            >
              <strong>需要先处理的问题</strong>
              <ul className="sw-project-aware__list">
                {readiness.blockers.map((blocker, index) => (
                  <li key={`${blocker.code}-${index}`}>{blockerLabel(blocker)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <section className="sw-project-aware__section" aria-labelledby="teacher-team-readiness">
            <h3 className="sw-project-aware__section-title" id="teacher-team-readiness">
              队伍准备度
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

          <p className="sw-project-aware__note">
            准备度和提醒均来自服务端权威投影；前端不自行计算队伍或总体状态。
          </p>
          <div className="sw-project-aware__actions">
            <button
              type="button"
              className="sw-project-aware__button"
              disabled={busy || readiness.state !== "READY"}
              onClick={() => void launch()}
            >
              {busy ? "正在提交开课请求…" : "确认并开课"}
            </button>
          </div>
        </>
      ) : null}

      {receipt ? (
        <article className="sw-project-aware sw-project-aware--nested" aria-label="开课回执">
          <div className="sw-project-aware__receipt-heading">
            <div>
              <p className="sw-project-aware__eyebrow">开课回执</p>
              <h3 className="sw-project-aware__receipt-title">{readinessLabel(receipt.status)}</h3>
            </div>
            <strong
              className="sw-project-aware__status"
              data-state={stateKey(receipt.readiness_state)}
            >
              {readinessLabel(receipt.readiness_state)}
            </strong>
          </div>
          <div className="sw-project-aware__metrics">
            <article className="sw-project-aware__metric">
              <span className="sw-project-aware__metric-label">请求状态</span>
              <strong className="sw-project-aware__metric-value">
                {readinessLabel(receipt.status)}
              </strong>
            </article>
            <article className="sw-project-aware__metric">
              <span className="sw-project-aware__metric-label">幂等凭证</span>
              <code className="sw-project-aware__code">{receipt.command_idempotency_key}</code>
            </article>
            <article className="sw-project-aware__metric">
              <span className="sw-project-aware__metric-label">当前范围</span>
              <code className="sw-project-aware__code">
                {receipt.tenant_id} · {receipt.course_id} · {receipt.run_id}
              </code>
            </article>
            <article className="sw-project-aware__metric">
              <span className="sw-project-aware__metric-label">审计编号 · 创建时间</span>
              <code className="sw-project-aware__code">
                {receipt.audit_id} · {receipt.created_at}
              </code>
            </article>
          </div>
        </article>
      ) : null}

      {error && phase !== "error" ? (
        <p className="sw-project-aware__callout sw-project-aware__callout--error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
