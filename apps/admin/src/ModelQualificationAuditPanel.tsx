import { useEffect, useState } from "react";
import type { ApiEnvelope, ModelQualificationAdminProjection } from "@simwar/shared-contracts";

interface Props {
  apiBase: string;
  courseId: string;
  tenantId: string;
  token: string;
}

export function ModelQualificationAuditPanel({ apiBase, courseId, tenantId, token }: Props) {
  const [projection, setProjection] = useState<ModelQualificationAdminProjection | null>(null);
  const [notice, setNotice] = useState("正在读取模型资格审计");

  useEffect(() => {
    let active = true;
    void fetch(
      `${apiBase}/api/v1/bff/admin/model-qualification?courseId=${encodeURIComponent(courseId)}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-tenant-id": tenantId
        }
      }
    )
      .then(async (response) => {
        const envelope = (await response.json()) as ApiEnvelope<ModelQualificationAdminProjection>;
        if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
        if (active) setProjection(envelope.data);
      })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? error.message : "模型资格审计加载失败");
      });
    return () => {
      active = false;
    };
  }, [apiBase, courseId, tenantId, token]);

  return (
    <section className="summary-panel" aria-label="source-backed model qualification audit">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">R2 · tenant-safe audit</p>
          <h2>模型资格与来源审计</h2>
        </div>
        <strong className="summary-badge">{courseId}</strong>
      </div>
      {projection ? (
        <>
          <div className="summary-grid">
            <article>
              <span>来源包</span>
              <strong>{projection.source_packages.length}</strong>
            </article>
            <article>
              <span>资格候选</span>
              <strong>{projection.qualifications.length}</strong>
            </article>
            <article>
              <span>治理 Writer</span>
              <strong>{projection.authority.model_governance_writer}</strong>
            </article>
            <article>
              <span>正式真值写入</span>
              <strong>{String(projection.authority.writes_formal_truth)}</strong>
            </article>
          </div>
          <p className="evidence-note">
            Provider={projection.authority.ai_provider} · Runtime=
            {projection.authority.repository_provider} · official REALIZED writer=
            {projection.authority.formal_truth_writer}
          </p>
          <ul>
            {projection.qualifications.map((item) => (
              <li key={item.qualification_id}>
                {item.qualification_id} · {item.decision} · review={item.review.status} · binding=
                {item.binding.status}
              </li>
            ))}
          </ul>
          <section aria-label="requalification preview audit">
            <h3>证据重新资格队列</h3>
            {(projection.requalification_previews ?? []).length > 0 ? (
              <ul>
                {(projection.requalification_previews ?? []).map((preview) => (
                  <li key={preview.preview_id}>
                    {preview.preview_id} · {preview.status} · review={preview.review.status} ·
                    resolution={preview.resolution} · baseline=
                    {preview.change_set.baseline.source_package_id} · candidate=
                    {preview.change_set.candidate.source_package_id} · historical_non_overwrite=
                    {String(preview.historical_non_overwrite)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="lifecycle-status">当前没有重新资格预览。</p>
            )}
          </section>
        </>
      ) : (
        <p className="lifecycle-status" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}

export default ModelQualificationAuditPanel;
