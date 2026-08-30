import { useEffect, useState } from "react";
import type { ApiEnvelope, ShanghaiC0AdminProjection } from "@simwar/shared-contracts";

interface Props {
  apiBase: string;
  receiptId?: string | null;
  tenantId: string;
  token: string;
}

export function ShanghaiC0ConversionAuditPanel({ apiBase, receiptId, tenantId, token }: Props) {
  const [projection, setProjection] = useState<ShanghaiC0AdminProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!receiptId || !token) {
      setProjection(null);
      setError(null);
      return () => {
        active = false;
      };
    }
    void fetch(
      `${apiBase}/api/v1/bff/admin/shanghai-c0/conversions/${encodeURIComponent(receiptId)}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-tenant-id": tenantId
        }
      }
    )
      .then(async (response) => {
        const envelope = (await response.json()) as ApiEnvelope<ShanghaiC0AdminProjection>;
        if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
        return envelope.data;
      })
      .then((data) => {
        if (active) setProjection(data);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Admin C0 审计加载失败");
      });
    return () => {
      active = false;
    };
  }, [apiBase, receiptId, tenantId, token]);

  return (
    <section className="summary-panel" aria-label="Shanghai C0 conversion Admin audit">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">SH-M13-M18 · C0 · Admin</p>
          <h2>上海 C0 来源与资格审计</h2>
        </div>
        <strong className="summary-badge">只读</strong>
      </div>
      {!receiptId ? <p className="lifecycle-status">需要 exact C0 receipt 上下文</p> : null}
      {error ? (
        <p className="summary-error" role="alert">
          {error}
        </p>
      ) : null}
      {projection ? (
        <>
          <div className="summary-grid">
            <article>
              <span>Receipt</span>
              <strong>{projection.receipt.receipt_id}</strong>
            </article>
            <article>
              <span>Rights</span>
              <strong>{projection.lineage.rights_status}</strong>
            </article>
            <article>
              <span>Qualification</span>
              <strong>{projection.lineage.qualification_status}</strong>
            </article>
            <article>
              <span>Calibration</span>
              <strong>{projection.lineage.calibration_status}</strong>
            </article>
          </div>
          <p className="lifecycle-boundary">
            只读 lineage：{projection.lineage.model_ref} · {projection.lineage.scenario_ref} ·{" "}
            {projection.lineage.parameter_ref}
          </p>
          <details open>
            <summary>来源与证据</summary>
            <ul>
              {projection.evidence.map((item) => (
                <li key={item.evidence_id}>
                  {item.source_ref} · {item.status} · {item.temporal_scope}
                </li>
              ))}
            </ul>
          </details>
          <details>
            <summary>已知限制</summary>
            <ul>
              {projection.known_limits.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </section>
  );
}

export default ShanghaiC0ConversionAuditPanel;
