import { useEffect, useState } from "react";
import type { W020AdvisoryAuditDto } from "@simwar/shared-contracts";

export function GovernedIntelligenceAuditPanel(props: {
  apiBase: string;
  tenantId: string;
  token: string;
}) {
  const [entries, setEntries] = useState<W020AdvisoryAuditDto[]>([]);
  const [message, setMessage] = useState("等待审计读取");

  useEffect(() => {
    let active = true;
    void fetch(`${props.apiBase}/api/v1/bff/teacher/advisors/audit`, {
      headers: { authorization: `Bearer ${props.token}`, "x-tenant-id": props.tenantId }
    })
      .then(async (response) => {
        const payload = (await response.json()) as { data?: { entries?: W020AdvisoryAuditDto[] } };
        if (!response.ok) throw new Error("governed intelligence audit rejected");
        if (active) {
          setEntries(payload.data?.entries ?? []);
          setMessage("审计投影已加载");
        }
      })
      .catch((error: unknown) => {
        if (active)
          setMessage(error instanceof Error ? error.message : "governed intelligence audit failed");
      });
    return () => {
      active = false;
    };
  }, [props.apiBase, props.tenantId, props.token]);

  return (
    <section className="panel form-panel" aria-label="Governed Intelligence Audit">
      <div className="panel-title">
        <div>
          <p className="eyebrow">Admin · tenant-safe provenance</p>
          <h3>Governed Intelligence Audit</h3>
        </div>
        <span className="technical-compatibility">read-only · Provider OFF</span>
      </div>
      <p className="lifecycle-boundary">
        仅展示租户范围内的 provider/model/hash/surface 元数据，不提供生成或修改操作；formal truth
        remains outside this audit projection。
      </p>
      <p role="status">{message}</p>
      <div className="candidate-list" aria-label="governed intelligence audit entries">
        {entries.map((entry) => (
          <article
            className="candidate-card"
            key={`${entry.model_call_log_id}:${entry.context_digest}`}
          >
            <strong>
              {entry.surface} · {entry.provider}
            </strong>
            <small>
              {entry.model} · {entry.status} · {entry.purpose}
            </small>
            <small>
              context {entry.context_digest.slice(0, 16)} · output {entry.output_hash.slice(0, 16)}
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}
