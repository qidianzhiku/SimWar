import { useState, type FormEvent } from "react";
import type { GSIStudentProjection } from "@simwar/shared-contracts";

export interface GovernedStakeholderIntelligenceProjectionProps {
  apiBase: string;
  tenantId: string;
  token: string;
  candidateId?: string;
  initialProjection?: GSIStudentProjection;
}

interface ProjectionEnvelope {
  data?: GSIStudentProjection;
  error?: { message?: string };
}

export function GovernedStakeholderIntelligenceProjection({
  apiBase,
  tenantId,
  token,
  candidateId: initialCandidateId = "",
  initialProjection
}: GovernedStakeholderIntelligenceProjectionProps) {
  const [candidateId, setCandidateId] = useState(initialCandidateId);
  const [projection, setProjection] = useState<GSIStudentProjection | null>(
    initialProjection ?? null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadProjection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = candidateId.trim();
    if (!id) {
      setError("请输入候选 ID。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `${apiBase}/api/v1/bff/student/gsi/candidates/${encodeURIComponent(id)}`,
        { headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId } }
      );
      const payload = (await response.json()) as ProjectionEnvelope;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "利益相关方学习投影加载失败");
      }
      setProjection(payload.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "利益相关方学习投影加载失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel form-panel" aria-label="Student governed stakeholder projection">
      <div className="panel-title">
        <div>
          <p className="eyebrow">Student · role-safe view</p>
          <h3>利益相关方信号学习投影</h3>
        </div>
        <span className="technical-compatibility">Provider OFF</span>
      </div>
      <p className="lifecycle-boundary">
        学员只接收已发布、按角色裁剪的 bounded signal；proposal 原文和教师/管理员 provenance
        不在此投影中。
      </p>
      <form onSubmit={loadProjection}>
        <label>
          候选 ID
          <input
            aria-label="GSI candidate ID"
            value={candidateId}
            onChange={(event) => setCandidateId(event.target.value)}
            placeholder="gsi_candidate_…"
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "正在加载…" : "查看我的学习投影"}
        </button>
      </form>
      {error ? (
        <p role="alert" className="lifecycle-error">
          {error}
        </p>
      ) : null}
      {projection ? (
        <article className="candidate-preview" aria-label="Student GSI projection">
          <h4>角色：{projection.role_key ?? "已授权角色"}</h4>
          <p>{projection.summary}</p>
          <ul>
            {projection.signals.map((signal) => (
              <li key={`${signal.stakeholder_type}-${signal.intent}`}>
                {signal.stakeholder_type} / {signal.intent}: {signal.bounded_value}
              </li>
            ))}
          </ul>
          {projection.abstentions.length ? (
            <p className="lifecycle-status">
              有 {projection.abstentions.length} 项信号在有界规则下未采纳。
            </p>
          ) : null}
          <details>
            <summary>查看学习边界</summary>
            <ul>
              {projection.known_limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </details>
        </article>
      ) : null}
    </section>
  );
}
