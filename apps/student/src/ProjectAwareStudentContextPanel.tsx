import { useEffect, useState } from "react";
import type { ProjectAwareStudentContext } from "@simwar/shared-contracts";
import { fetchProjectAwareStudentContext } from "./project-aware-student-context-client";

export interface ProjectAwareStudentContextPanelProps {
  baseUrl: string;
  courseId?: string | undefined;
  runId?: string | undefined;
  teamId?: string | undefined;
  tenantId: string;
  token: string;
}

type PanelPhase = "empty" | "loading" | "ready" | "error";

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
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setContext(null);
        setError(cause instanceof Error ? cause.message : "学生项目上下文暂不可用");
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
    <section className="summary-panel" aria-label="Student project-aware context">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">M2-P3 · student safe projection</p>
          <h2>当前项目与角色上下文</h2>
        </div>
        {context ? <strong className="summary-badge">SERVER_SCOPED</strong> : null}
      </div>

      {phase === "empty" ? (
        <p className="muted">等待服务端提供当前 Course / Run / Team 的学生上下文。</p>
      ) : null}
      {phase === "loading" ? <p role="status">正在读取当前队伍的角色与安全项目简报…</p> : null}
      {phase === "error" ? (
        <div className="summary-error" role="alert">
          <strong>学生项目上下文读取失败</strong>
          <span>{error}</span>
          <button
            type="button"
            className="secondary"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            重试
          </button>
        </div>
      ) : null}

      {context ? (
        <>
          <div className="summary-grid">
            <article>
              <span>Course / Run</span>
              <strong>
                {context.scope.course_id} · {context.scope.run_id}
              </strong>
            </article>
            <article>
              <span>Current Team</span>
              <strong>{context.scope.team_id}</strong>
            </article>
            <article>
              <span>Role</span>
              <strong>{context.role_context.role_key}</strong>
              <small>{context.role_context.role_template_id}</small>
            </article>
            <article>
              <span>Round</span>
              <strong>
                {context.role_context.round_no} · {context.role_context.round_id}
              </strong>
            </article>
          </div>

          <article className="summary-panel" aria-label="Safe project brief">
            <div className="summary-heading">
              <div>
                <p className="eyebrow">Safe project brief</p>
                <h3>{context.project_brief.title}</h3>
              </div>
              <strong className="summary-badge">{context.project_brief.brief_kind}</strong>
            </div>
            <div className="summary-grid">
              <article>
                <span>Industry / Geography</span>
                <strong>
                  {context.project_brief.industry} · {context.project_brief.geography}
                </strong>
              </article>
              <article>
                <span>Customer segment</span>
                <strong>{context.project_brief.customer_segment}</strong>
              </article>
              <article>
                <span>Service bundle</span>
                <strong>{context.project_brief.service_bundle}</strong>
              </article>
              <article>
                <span>Exact profile</span>
                <strong>
                  {context.project_brief.project_profile_reference.project_profile_id}@
                  {context.project_brief.project_profile_reference.version}
                </strong>
                <small>{context.project_brief.project_profile_reference.content_digest}</small>
              </article>
            </div>
            <p>{context.project_brief.description}</p>
            <p>{context.project_brief.positioning}</p>
            <details>
              <summary>查看当前项目说明边界</summary>
              <ul>
                {context.project_brief.known_limits.map((limit) => (
                  <li key={limit}>{limit}</li>
                ))}
              </ul>
            </details>
            <p className="evidence-note">
              角色与项目均由服务端按当前用户和 Team scope 返回；本面板只展示安全投影。
            </p>
          </article>
        </>
      ) : null}
    </section>
  );
}
