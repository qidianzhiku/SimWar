import { useEffect, useState } from "react";
import type { ProjectProfileStudentBrief } from "@simwar/shared-contracts";

interface ProjectBriefPanelProps {
  courseId?: string | undefined;
  runId?: string | undefined;
  teamId?: string | undefined;
  tenantId: string;
  token: string;
}

export function ProjectBriefPanel({
  courseId,
  runId,
  teamId,
  tenantId,
  token
}: ProjectBriefPanelProps) {
  const [brief, setBrief] = useState<ProjectProfileStudentBrief | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || !courseId || !runId || !teamId) {
      setState(token ? "empty" : "idle");
      setBrief(null);
      return;
    }
    const controller = new AbortController();
    setState("loading");
    setError("");
    fetch(
      `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"}/api/v1/bff/student/project-brief?course_id=${encodeURIComponent(courseId)}&run_id=${encodeURIComponent(runId)}&team_id=${encodeURIComponent(teamId)}`,
      {
        headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
        signal: controller.signal
      }
    )
      .then(async (response) => {
        const envelope = (await response.json()) as {
          data?: ProjectProfileStudentBrief;
          code?: string;
        };
        if (!response.ok) throw new Error(envelope.code ?? "PROJECT_BRIEF_LOAD_FAILED");
        setBrief(envelope.data ?? null);
        setState(envelope.data ? "ready" : "empty");
      })
      .catch((nextError: unknown) => {
        if (controller.signal.aborted) return;
        setBrief(null);
        setError(nextError instanceof Error ? nextError.message : "项目简报暂不可用");
        setState("error");
      });
    return () => controller.abort();
  }, [courseId, runId, teamId, tenantId, token]);

  return (
    <article className="panel bff-panel" aria-label="学生项目安全简报">
      <div className="panel-title">
        <h2>当前 Playable Company · 项目简报</h2>
        <span>{state === "ready" ? "ASSIGNED" : state}</span>
      </div>
      <p className="evidence-note">
        这是当前 Course / Run / Team 的角色安全投影。项目档案是来源与配置说明，不是运行时真值
        authority。
      </p>
      {state === "loading" ? <p role="status">正在读取当前队伍的精确 Assignment…</p> : null}
      {state === "empty" ? <p className="muted">当前上下文尚未形成项目 Assignment。</p> : null}
      {state === "error" ? <p role="alert">{error}</p> : null}
      {brief ? (
        <>
          <div className="status-grid">
            <div>
              <span>项目</span>
              <strong>{brief.title}</strong>
            </div>
            <div>
              <span>行业 / 地域</span>
              <strong>
                {brief.industry} · {brief.geography}
              </strong>
            </div>
            <div>
              <span>客户段</span>
              <strong>{brief.customer_segment}</strong>
            </div>
            <div>
              <span>来源版本</span>
              <strong>
                {brief.project_profile_reference.project_profile_id} ·{" "}
                {brief.project_profile_reference.version}
              </strong>
            </div>
          </div>
          <p>{brief.description}</p>
          <p>{brief.positioning}</p>
          <details>
            <summary>查看当前安全边界</summary>
            <ul>
              {brief.known_limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </article>
  );
}
