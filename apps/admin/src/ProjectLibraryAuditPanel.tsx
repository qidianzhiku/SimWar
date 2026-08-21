import { useCallback, useEffect, useState } from "react";
import type { ProjectLibraryAdminAuditProjection } from "@simwar/shared-contracts";

interface ProjectLibraryAuditPanelProps {
  apiBase: string;
  tenantId: string;
  token: string;
}

export function ProjectLibraryAuditPanel({
  apiBase,
  tenantId,
  token
}: ProjectLibraryAuditPanelProps) {
  const [projection, setProjection] = useState<ProjectLibraryAdminAuditProjection | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/v1/bff/admin/project-library`, {
        headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId }
      });
      const envelope = (await response.json()) as {
        data?: ProjectLibraryAdminAuditProjection;
        code?: string;
        message?: string;
      };
      if (!response.ok)
        throw new Error(
          `${envelope.code ?? "PROJECT_LIBRARY_AUDIT_FAILED"}: ${envelope.message ?? ""}`
        );
      setProjection(envelope.data ?? null);
      setState("ready");
    } catch (nextError) {
      setProjection(null);
      setError(nextError instanceof Error ? nextError.message : "Project Library 审计暂不可用");
      setState("error");
    }
  }, [apiBase, tenantId, token]);

  useEffect(() => {
    if (token) void load();
  }, [load, token]);

  return (
    <section className="summary-panel" aria-label="Project Library audit">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">M2-P2 · governance projection</p>
          <h2>Project Library 与 Assignment 审计</h2>
        </div>
        {projection ? <strong className="summary-badge">TENANT SCOPED</strong> : null}
      </div>
      {state === "loading" ? <p role="status">正在读取项目档案审计投影…</p> : null}
      {state === "error" ? (
        <div className="summary-error" role="alert">
          <span>{error}</span>
          <button type="button" className="secondary" onClick={() => void load()}>
            重试
          </button>
        </div>
      ) : null}
      {projection ? (
        <div className="summary-grid">
          <article>
            <span>档案版本</span>
            <strong>{projection.profiles.length}</strong>
          </article>
          <article>
            <span>Assignments</span>
            <strong>{projection.assignments.length}</strong>
          </article>
          <article>
            <span>Runtime writer</span>
            <strong>Kernel / W4</strong>
          </article>
        </div>
      ) : null}
      <p className="evidence-note">
        仅审计来源、精确引用、生命周期和租户范围；不提供 Project Profile
        对运行时企业状态的写入权限。
      </p>
    </section>
  );
}
