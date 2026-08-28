import { useState, type FormEvent } from "react";
import type { GSIAdminProjection } from "@simwar/shared-contracts";

export interface GovernedStakeholderIntelligenceAuditPanelProps {
  apiBase: string;
  tenantId: string;
  token: string;
  initialCandidateId?: string;
}

interface AuditEnvelope {
  data?: GSIAdminProjection;
  error?: { message?: string };
}

export function GovernedStakeholderIntelligenceAuditPanel({
  apiBase,
  tenantId,
  token,
  initialCandidateId = ""
}: GovernedStakeholderIntelligenceAuditPanelProps) {
  const [candidateId, setCandidateId] = useState(initialCandidateId);
  const [projection, setProjection] = useState<GSIAdminProjection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAudit(event: FormEvent<HTMLFormElement>) {
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
        `${apiBase}/api/v1/bff/admin/gsi/audit?candidate_id=${encodeURIComponent(id)}`,
        { headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId } }
      );
      const payload = (await response.json()) as AuditEnvelope;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "利益相关方审计加载失败");
      }
      setProjection(payload.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "利益相关方审计加载失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel form-panel" aria-label="Governed stakeholder intelligence audit">
      <div className="panel-title">
        <div>
          <p className="eyebrow">Admin · tenant-safe provenance</p>
          <h3>利益相关方候选审计</h3>
        </div>
        <span className="technical-compatibility">read-only</span>
      </div>
      <p className="lifecycle-boundary">
        管理员可按候选 ID读取绑定、解析摘要和真值保护标记；此面板仅提供读取能力，不执行任何写入。
        审计字段 writes_official_truth 必须保持 false。
      </p>
      <form onSubmit={loadAudit}>
        <label>
          候选 ID
          <input
            aria-label="GSI audit candidate ID"
            value={candidateId}
            onChange={(event) => setCandidateId(event.target.value)}
            placeholder="gsi_candidate_…"
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "正在查询…" : "查询候选审计"}
        </button>
      </form>
      {error ? (
        <p role="alert" className="lifecycle-error">
          {error}
        </p>
      ) : null}
      {projection ? (
        <article className="candidate-preview" aria-label="GSI audit projection">
          <h4>候选审计摘要</h4>
          <dl>
            <div>
              <dt>provider</dt>
              <dd>{projection.provider}</dd>
            </div>
            <div>
              <dt>plane_mode</dt>
              <dd>{projection.plane_mode}</dd>
            </div>
            <div>
              <dt>writes_official_truth</dt>
              <dd>{String(projection.writes_official_truth)}</dd>
            </div>
            <div>
              <dt>resolver_digest</dt>
              <dd>
                <code>{projection.resolver_digest}</code>
              </dd>
            </div>
            <div>
              <dt>signal_digest</dt>
              <dd>
                <code>{projection.signal_digest}</code>
              </dd>
            </div>
            <div>
              <dt>candidate_digest</dt>
              <dd>
                <code>{projection.candidate_digest}</code>
              </dd>
            </div>
          </dl>
          <details>
            <summary>查看 exact binding</summary>
            <pre>{JSON.stringify(projection.binding, null, 2)}</pre>
          </details>
          <details>
            <summary>查看已知限制</summary>
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
