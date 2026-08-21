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

export interface ProjectAwareCourseLaunchPanelProps {
  baseUrl: string;
  courseId?: string | undefined;
  runId?: string | undefined;
  tenantId: string;
  token: string;
}

type PanelPhase = "empty" | "loading" | "ready" | "error";

function profileReferenceLabel(
  reference: ProjectAwareTeamReadiness["project_profile_reference"]
): string {
  if (!reference) return "未绑定 exact ProjectProfile";
  return `${reference.project_profile_id}@${reference.version} · ${reference.content_digest}`;
}

function blockerLabel(blocker: ProjectAwareBlocker): string {
  return `${blocker.code} · owner=${blocker.owner} · ${blocker.action}`;
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
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setReadiness(null);
        setError(cause instanceof Error ? cause.message : "Project-aware readiness 暂不可用");
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
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Project-aware launch failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="summary-panel" aria-label="Project-aware Course launch">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">M2-P3 · project-aware launch</p>
          <h2>Project-aware Course 开课准备</h2>
        </div>
        {readiness ? <strong className="summary-badge">{readiness.state}</strong> : null}
      </div>

      {phase === "empty" ? (
        <p className="muted">选择 exact tenant / Course / Run 并完成登录后读取服务端 readiness。</p>
      ) : null}
      {phase === "loading" ? <p role="status">正在读取服务端 project-aware readiness…</p> : null}
      {phase === "error" ? (
        <div className="summary-error" role="alert">
          <strong>Project-aware readiness 读取失败</strong>
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

      {readiness ? (
        <>
          <div className="summary-grid">
            <article>
              <span>Scope</span>
              <strong>{readiness.scope.tenant_id}</strong>
              <small>
                {readiness.scope.course_id} · {readiness.scope.run_id}
              </small>
            </article>
            <article>
              <span>Aggregate readiness</span>
              <strong>{readiness.state}</strong>
              <small>{readiness.generated_at}</small>
            </article>
            <article>
              <span>Teams</span>
              <strong>{readiness.teams.length}</strong>
              <small>{readiness.formal_binding.status} formal binding</small>
            </article>
            <article>
              <span>Formal binding digest</span>
              <strong>{readiness.formal_binding.binding_digest ?? "UNKNOWN"}</strong>
            </article>
          </div>

          {readiness.blockers.length > 0 ? (
            <div className="summary-error" role="status">
              <strong>Aggregate blockers</strong>
              <ul>
                {readiness.blockers.map((blocker, index) => (
                  <li key={`${blocker.code}-${index}`}>{blockerLabel(blocker)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="summary-grid">
            {readiness.teams.map((team) => (
              <article key={team.team_id}>
                <span>
                  {team.team_name} · {team.team_id}
                </span>
                <strong>{team.state}</strong>
                <small>Profile: {profileReferenceLabel(team.project_profile_reference)}</small>
                <small>Successor available: {team.successor_available ? "YES" : "NO"}</small>
                {team.blockers.length > 0 ? (
                  <ul>
                    {team.blockers.map((blocker, index) => (
                      <li key={`${team.team_id}-${blocker.code}-${index}`}>
                        {blockerLabel(blocker)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <small>当前 team blockers: none</small>
                )}
              </article>
            ))}
          </div>

          <p className="evidence-note">
            readiness 与 blocker 均来自服务端权威投影；前端不重算 team 或 aggregate 状态。
          </p>
          <button
            type="button"
            className="primary"
            disabled={busy || readiness.state !== "READY"}
            onClick={() => void launch()}
          >
            {busy ? "正在通过 Formal Run authority 开课…" : "Launch project-aware Course"}
          </button>
        </>
      ) : null}

      {receipt ? (
        <article className="summary-panel" aria-label="Project-aware launch receipt">
          <div className="summary-heading">
            <div>
              <p className="eyebrow">Launch receipt</p>
              <h3>{receipt.status}</h3>
            </div>
            <strong className="summary-badge">{receipt.readiness_state}</strong>
          </div>
          <div className="summary-grid">
            <article>
              <span>Idempotency key</span>
              <strong>{receipt.command_idempotency_key}</strong>
            </article>
            <article>
              <span>Scope</span>
              <strong>
                {receipt.tenant_id} · {receipt.course_id} · {receipt.run_id}
              </strong>
            </article>
            <article>
              <span>Audit</span>
              <strong>{receipt.audit_id}</strong>
            </article>
            <article>
              <span>Created</span>
              <strong>{receipt.created_at}</strong>
            </article>
          </div>
        </article>
      ) : null}

      {error && phase !== "error" ? (
        <p className="summary-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
