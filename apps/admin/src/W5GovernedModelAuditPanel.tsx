import { useEffect, useState } from "react";
import type { ApiEnvelope, W5GovernedModelAdminProjection } from "@simwar/shared-contracts";

interface Props {
  apiBase: string;
  courseId: string;
  tenantId: string;
  token: string;
}

async function loadAudit(
  apiBase: string,
  courseId: string,
  tenantId: string,
  token: string
): Promise<W5GovernedModelAdminProjection> {
  const response = await fetch(
    `${apiBase}/api/v1/bff/admin/w5/governed-model?courseId=${encodeURIComponent(courseId)}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-tenant-id": tenantId
      }
    }
  );
  const envelope = (await response.json()) as ApiEnvelope<W5GovernedModelAdminProjection>;
  if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
  return envelope.data;
}

export function W5GovernedModelAuditPanel({ apiBase, courseId, tenantId, token }: Props) {
  const [projection, setProjection] = useState<W5GovernedModelAdminProjection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    void loadAudit(apiBase, courseId, tenantId, token)
      .then((data) => {
        if (active) setProjection(data);
      })
      .catch((reason: unknown) => {
        if (active) {
          setProjection(null);
          setError(reason instanceof Error ? reason.message : "W5 模型审计加载失败");
        }
      });
    return () => {
      active = false;
    };
  }, [apiBase, courseId, tenantId, token]);

  return (
    <section className="summary-panel" aria-label="W5 governed model audit">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">W5 · read-only governance projection</p>
          <h2>需求实现模型审计</h2>
        </div>
        <strong className="summary-badge">{courseId}</strong>
      </div>
      {error ? (
        <p className="summary-error" role="alert">
          {error}
        </p>
      ) : null}
      {projection ? (
        <>
          <div className="summary-grid">
            <article>
              <span>ModelVersion</span>
              <strong>{projection.model_version.model_version_ref}</strong>
            </article>
            <article>
              <span>正式真值写入者</span>
              <strong>{projection.authority.formal_truth_writer}</strong>
            </article>
            <article>
              <span>Runtime</span>
              <strong>{projection.authority.repository_provider}</strong>
            </article>
            <article>
              <span>Provider</span>
              <strong>{projection.authority.ai_provider}</strong>
            </article>
          </div>
          <p className="lifecycle-boundary">
            只读审计：WANT/CAN 仍是候选与约束；REALIZED 继续经过 Simulation
            Core，当前投影不写入正式结算。
          </p>
          <details>
            <summary>查看模型家族与已绑定草稿</summary>
            <ul>
              {projection.model_version.model_family_readiness.map((family) => (
                <li key={family.family}>
                  {family.family} · {family.classification} · {family.known_limit}
                </li>
              ))}
              {projection.drafts.map((draft) => (
                <li key={draft.draft_id}>
                  {draft.draft_id} · {draft.status} ·{" "}
                  {draft.exact_runtime_binding?.run_id ?? "未绑定"}
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : !error ? (
        <p className="lifecycle-status">正在加载 W5 模型审计…</p>
      ) : null}
    </section>
  );
}
