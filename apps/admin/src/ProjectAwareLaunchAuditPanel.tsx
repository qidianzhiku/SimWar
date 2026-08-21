import { useEffect, useState } from "react";
import type { ProjectAwareBlocker, ProjectAwareTeamReadiness } from "@simwar/shared-contracts";
import {
  fetchProjectAwareLaunchAudit,
  type ProjectAwareLaunchAuditProjection
} from "./project-aware-launch-audit-client";

export interface ProjectAwareLaunchAuditPanelProps {
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
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setProjection(null);
        setError(cause instanceof Error ? cause.message : "Project-aware audit 暂不可用");
        setPhase("error");
      });

    return () => controller.abort();
  }, [props.baseUrl, props.courseId, props.runId, props.tenantId, props.token, reloadKey]);

  return (
    <section className="summary-panel" aria-label="Project-aware launch audit">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">M2-P3 · tenant-scoped audit</p>
          <h2>Project-aware Launch lineage 审计</h2>
        </div>
        {projection ? <strong className="summary-badge">READ ONLY</strong> : null}
      </div>

      {phase === "empty" ? (
        <p className="muted">选择 exact tenant / Course / Run 后读取 readiness 与 lineage 摘要。</p>
      ) : null}
      {phase === "loading" ? <p role="status">正在读取租户范围 project-aware audit…</p> : null}
      {phase === "error" ? (
        <div className="summary-error" role="alert">
          <strong>Project-aware audit 读取失败</strong>
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

      {projection ? (
        <>
          <div className="summary-grid">
            <article>
              <span>Scope</span>
              <strong>{projection.readiness.scope.tenant_id}</strong>
              <small>
                {projection.readiness.scope.course_id} · {projection.readiness.scope.run_id}
              </small>
            </article>
            <article>
              <span>Aggregate readiness</span>
              <strong>{projection.readiness.state}</strong>
              <small>{projection.readiness.generated_at}</small>
            </article>
            <article>
              <span>Team projections</span>
              <strong>{projection.readiness.teams.length}</strong>
              <small>{projection.readiness.formal_binding.status} formal binding</small>
            </article>
            <article>
              <span>Launch receipts</span>
              <strong>{projection.lineage.length}</strong>
              <small>
                {projection.project_library.assignments.length} assignments in tenant audit
              </small>
            </article>
          </div>

          {projection.readiness.blockers.length > 0 ? (
            <div className="summary-error" role="status">
              <strong>Readiness blockers</strong>
              <ul>
                {projection.readiness.blockers.map((blocker, index) => (
                  <li key={`${blocker.code}-${index}`}>{blockerLabel(blocker)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="summary-grid">
            {projection.readiness.teams.map((team) => (
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
                ) : null}
              </article>
            ))}
          </div>

          <section className="summary-panel" aria-label="Project-aware launch lineage receipts">
            <div className="summary-heading">
              <div>
                <p className="eyebrow">Immutable lineage summary</p>
                <h3>Launch receipts</h3>
              </div>
            </div>
            {projection.lineage.length === 0 ? (
              <p className="muted">当前 Course / Run 尚无 launch receipt。</p>
            ) : (
              <div className="summary-grid">
                {projection.lineage.map((receipt) => (
                  <article key={receipt.audit_id}>
                    <span>{receipt.status}</span>
                    <strong>{receipt.audit_id}</strong>
                    <small>Key: {receipt.command_idempotency_key}</small>
                    <small>
                      {receipt.tenant_id} · {receipt.course_id} · {receipt.run_id}
                    </small>
                    <small>Created: {receipt.created_at}</small>
                  </article>
                ))}
              </div>
            )}
          </section>
          <p className="evidence-note">
            仅展示当前 tenant 与 exact Course / Run 的 readiness、profile 引用和 launch
            lineage；本面板不提供写操作。
          </p>
        </>
      ) : null}
    </section>
  );
}
