import { useEffect, useState } from "react";
import type { ApiEnvelope, ShanghaiFullVerticalAdminProjection } from "@simwar/shared-contracts";

interface Props {
  apiBase: string;
  courseId: string;
  draftId?: string | null | undefined;
  roundNo?: number | undefined;
  runId?: string | null | undefined;
  tenantId: string;
  token: string;
}

async function load(
  apiBase: string,
  tenantId: string,
  token: string,
  courseId: string,
  draftId: string,
  runId: string,
  roundNo: number
): Promise<ShanghaiFullVerticalAdminProjection> {
  const query = new URLSearchParams({
    courseId,
    draftId,
    runId,
    roundNo: String(roundNo)
  });
  const response = await fetch(`${apiBase}/api/v1/bff/admin/shanghai/full-vertical?${query}`, {
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-tenant-id": tenantId
    }
  });
  const envelope = (await response.json()) as ApiEnvelope<ShanghaiFullVerticalAdminProjection>;
  if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
  return envelope.data;
}

export function ShanghaiFullVerticalAdminPanel({
  apiBase,
  courseId,
  draftId,
  roundNo,
  runId,
  tenantId,
  token
}: Props) {
  const [projection, setProjection] = useState<ShanghaiFullVerticalAdminProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const exact = Boolean(courseId && draftId && runId && roundNo !== undefined && token);

  useEffect(() => {
    let active = true;
    if (!exact) {
      setProjection(null);
      setError(null);
      return () => {
        active = false;
      };
    }
    setError(null);
    void load(apiBase, tenantId, token, courseId, draftId!, runId!, roundNo!)
      .then((data) => {
        if (active) setProjection(data);
      })
      .catch((reason: unknown) => {
        if (active) {
          setProjection(null);
          setError(reason instanceof Error ? reason.message : "Admin audit projection 加载失败");
        }
      });
    return () => {
      active = false;
    };
  }, [apiBase, courseId, draftId, exact, roundNo, runId, tenantId, token]);

  return (
    <section className="summary-panel" aria-label="Shanghai full vertical Admin projection">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">MAIN-SH-FV-O1 · Admin</p>
          <h2>上海全链路治理审计</h2>
          <p className="evidence-note">Admin tenant-safe audit projection</p>
        </div>
        <strong className="summary-badge">只读</strong>
      </div>
      {error ? (
        <p className="summary-error" role="alert">
          {error}
        </p>
      ) : null}
      {!exact ? <p className="lifecycle-status">需要 exact draft/run/round 上下文</p> : null}
      {exact && !projection && !error ? (
        <p className="lifecycle-status">等待 Admin audit projection</p>
      ) : null}
      {projection ? (
        <>
          <div className="summary-grid">
            <article>
              <span>状态</span>
              <strong>{projection.status}</strong>
            </article>
            <article>
              <span>Binding</span>
              <strong>{projection.binding.status}</strong>
            </article>
            <article>
              <span>ModelVersion</span>
              <strong>{projection.binding.model_version_ref}</strong>
            </article>
            <article>
              <span>REALIZED authority</span>
              <strong>{projection.preview.realized.authority}</strong>
            </article>
          </div>
          <p className="lifecycle-boundary">
            只读租户审计：正式 writer 仍是 Simulation Core；本面板不修改 scenario、settlement 或
            replay truth。
          </p>
          <details>
            <summary>查看已知限制</summary>
            <ul>
              {projection.known_limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </section>
  );
}

export default ShanghaiFullVerticalAdminPanel;
