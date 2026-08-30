import { useEffect, useState } from "react";
import type { ProjectAwareStudentContext } from "@simwar/shared-contracts";
import { fetchProjectAwareStudentContext } from "./project-aware-student-context-client";

void import("@simwar/ui/project-aware.css");

export interface ProjectAwareStudentContextPanelProps {
  baseUrl: string;
  courseId?: string | undefined;
  runId?: string | undefined;
  teamId?: string | undefined;
  tenantId: string;
  token: string;
}

type PanelPhase = "empty" | "loading" | "ready" | "error";

function briefKindLabel(kind: string | undefined): string {
  if (kind === "SAFE_PROJECTION") return "安全项目简报";
  if (kind === "PROJECT_BRIEF") return "项目简报";
  return "当前项目资料";
}

function scopeReady(
  props: ProjectAwareStudentContextPanelProps
): props is ProjectAwareStudentContextPanelProps & {
  courseId: string;
  runId: string;
  teamId: string;
} {
  return Boolean(
    props.baseUrl.trim() &&
    props.tenantId.trim() &&
    props.token.trim() &&
    props.courseId?.trim() &&
    props.runId?.trim() &&
    props.teamId?.trim()
  );
}

export function ProjectAwareStudentContextPanel(props: ProjectAwareStudentContextPanelProps) {
  const [phase, setPhase] = useState<PanelPhase>("empty");
  const [context, setContext] = useState<ProjectAwareStudentContext | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!scopeReady(props)) {
      setPhase("empty");
      setContext(null);
      setError("");
      return;
    }

    const controller = new AbortController();
    setPhase("loading");
    setContext(null);
    setError("");
    void fetchProjectAwareStudentContext({
      baseUrl: props.baseUrl,
      courseId: props.courseId,
      runId: props.runId,
      signal: controller.signal,
      teamId: props.teamId,
      tenantId: props.tenantId,
      token: props.token
    })
      .then((next) => {
        if (controller.signal.aborted) return;
        setContext(next);
        setPhase("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setContext(null);
        setError("当前页面暂时无法读取项目资料，请稍后重试。");
        setPhase("error");
      });

    return () => controller.abort();
  }, [
    props.baseUrl,
    props.courseId,
    props.runId,
    props.teamId,
    props.tenantId,
    props.token,
    reloadKey
  ]);

  return (
    <section className="sw-project-aware" aria-label="学生项目上下文">
      <div className="sw-project-aware__heading">
        <div>
          <p className="sw-project-aware__eyebrow">当前项目 · 安全投影</p>
          <h2 className="sw-project-aware__title">当前项目与角色</h2>
          <p className="sw-project-aware__subtitle">这里显示与你当前队伍相关的项目与角色信息。</p>
        </div>
        {context ? (
          <strong className="sw-project-aware__status" data-state="readonly">
            安全投影
          </strong>
        ) : null}
      </div>

      {phase === "empty" ? (
        <p className="sw-project-aware__empty">等待服务端提供当前课程、运行和队伍信息。</p>
      ) : null}
      {phase === "loading" ? (
        <p className="sw-project-aware__loading" role="status">
          正在读取当前队伍的角色与项目简报…
        </p>
      ) : null}
      {phase === "error" ? (
        <div className="sw-project-aware__callout sw-project-aware__callout--error" role="alert">
          <strong>项目资料读取失败</strong>
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

      {context ? (
        <>
          <div className="sw-project-aware__metrics">
            <article className="sw-project-aware__metric">
              <span className="sw-project-aware__metric-label">课程与运行</span>
              <code className="sw-project-aware__code">
                {context.scope.course_id} · {context.scope.run_id}
              </code>
            </article>
            <article className="sw-project-aware__metric">
              <span className="sw-project-aware__metric-label">当前队伍</span>
              <strong className="sw-project-aware__metric-value">{context.scope.team_id}</strong>
            </article>
            <article className="sw-project-aware__metric">
              <span className="sw-project-aware__metric-label">角色</span>
              <strong className="sw-project-aware__metric-value">
                {context.role_context.role_key}
              </strong>
              <small className="sw-project-aware__metric-detail">
                {context.role_context.role_template_id}
              </small>
            </article>
            <article className="sw-project-aware__metric">
              <span className="sw-project-aware__metric-label">当前轮次</span>
              <strong className="sw-project-aware__metric-value">
                第 {context.role_context.round_no} 轮
              </strong>
              <code className="sw-project-aware__code">{context.role_context.round_id}</code>
            </article>
          </div>

          <article className="sw-project-aware sw-project-aware--nested" aria-label="项目简报">
            <div className="sw-project-aware__receipt-heading">
              <div>
                <p className="sw-project-aware__eyebrow">项目简报</p>
                <h3 className="sw-project-aware__receipt-title">{context.project_brief.title}</h3>
              </div>
              <strong className="sw-project-aware__badge" data-state="readonly">
                {briefKindLabel(context.project_brief.brief_kind)}
              </strong>
            </div>
            <div className="sw-project-aware__metrics">
              <article className="sw-project-aware__metric">
                <span className="sw-project-aware__metric-label">行业与地区</span>
                <strong className="sw-project-aware__metric-value">
                  {context.project_brief.industry} · {context.project_brief.geography}
                </strong>
              </article>
              <article className="sw-project-aware__metric">
                <span className="sw-project-aware__metric-label">客户群体</span>
                <strong className="sw-project-aware__metric-value">
                  {context.project_brief.customer_segment}
                </strong>
              </article>
              <article className="sw-project-aware__metric">
                <span className="sw-project-aware__metric-label">服务组合</span>
                <strong className="sw-project-aware__metric-value">
                  {context.project_brief.service_bundle}
                </strong>
              </article>
              <article className="sw-project-aware__metric">
                <span className="sw-project-aware__metric-label">项目档案</span>
                <strong className="sw-project-aware__metric-value">
                  {context.project_brief.project_profile_reference.project_profile_id}@
                  {context.project_brief.project_profile_reference.version}
                </strong>
                <code className="sw-project-aware__code">
                  {context.project_brief.project_profile_reference.content_digest}
                </code>
              </article>
            </div>
            <p className="sw-project-aware__description">{context.project_brief.description}</p>
            <p className="sw-project-aware__positioning">{context.project_brief.positioning}</p>
            <details>
              <summary>查看项目边界</summary>
              <ul className="sw-project-aware__list">
                {context.project_brief.known_limits.map((limit) => (
                  <li key={limit}>{limit}</li>
                ))}
              </ul>
            </details>
            <p className="sw-project-aware__note">
              角色与项目由服务端按当前用户和队伍范围返回；本面板只展示安全投影。
            </p>
          </article>
          {context.course_factory_source_evidence ? (
            <article
              className="sw-project-aware sw-project-aware--nested"
              aria-label="上海来源安全上下文"
            >
              <div className="sw-project-aware__receipt-heading">
                <div>
                  <p className="sw-project-aware__eyebrow">来源安全上下文</p>
                  <h3 className="sw-project-aware__receipt-title">上海 → 杭州候选证据</h3>
                </div>
                <strong className="sw-project-aware__badge" data-state="readonly">
                  仅候选
                </strong>
              </div>
              <div className="sw-project-aware__metrics">
                <article className="sw-project-aware__metric">
                  <span className="sw-project-aware__metric-label">目标地区</span>
                  <strong className="sw-project-aware__metric-value">
                    {context.course_factory_source_evidence.target_region}
                  </strong>
                </article>
                <article className="sw-project-aware__metric">
                  <span className="sw-project-aware__metric-label">Epoch</span>
                  <code className="sw-project-aware__code">
                    {context.course_factory_source_evidence.epoch_version}
                  </code>
                </article>
                <article className="sw-project-aware__metric">
                  <span className="sw-project-aware__metric-label">资格状态</span>
                  <strong className="sw-project-aware__metric-value">
                    {context.course_factory_source_evidence.qualification_status}
                  </strong>
                </article>
                <article className="sw-project-aware__metric">
                  <span className="sw-project-aware__metric-label">绑定状态</span>
                  <strong className="sw-project-aware__metric-value">
                    {context.course_factory_source_evidence.consumption_status}
                  </strong>
                </article>
              </div>
              <p className="sw-project-aware__note">
                学生仅获得地区、Epoch、资格和候选状态；源摘录、摘要、digest、结算、评分和排名不下发。
              </p>
            </article>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
