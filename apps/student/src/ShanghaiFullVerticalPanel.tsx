import { useEffect, useState } from "react";
import type { ApiEnvelope, ShanghaiFullVerticalStudentProjection } from "@simwar/shared-contracts";

interface Props {
  apiBase: string;
  courseId?: string | null | undefined;
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
  draftId: string,
  runId: string,
  roundNo: number
): Promise<ShanghaiFullVerticalStudentProjection> {
  const response = await fetch(
    `${apiBase}/api/v1/bff/student/shanghai/full-vertical?draftId=${encodeURIComponent(draftId)}&runId=${encodeURIComponent(runId)}&roundNo=${roundNo}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-tenant-id": tenantId
      }
    }
  );
  const envelope = (await response.json()) as ApiEnvelope<ShanghaiFullVerticalStudentProjection>;
  if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
  return envelope.data;
}

export function ShanghaiFullVerticalStudentPanel({
  apiBase,
  courseId,
  draftId,
  roundNo,
  runId,
  tenantId,
  token
}: Props) {
  const [projection, setProjection] = useState<ShanghaiFullVerticalStudentProjection | null>(null);
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
    void load(apiBase, tenantId, token, draftId!, runId!, roundNo!)
      .then((data) => {
        if (active) setProjection(data);
      })
      .catch((reason: unknown) => {
        if (active) {
          setProjection(null);
          setError(reason instanceof Error ? reason.message : "Student projection 加载失败");
        }
      });
    return () => {
      active = false;
    };
  }, [apiBase, draftId, exact, roundNo, runId, tenantId, token]);

  return (
    <section className="summary-panel" aria-label="Shanghai full vertical Student projection">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">MAIN-SH-FV-O1 · Student</p>
          <h2>上海全链路学习投影</h2>
          <p className="evidence-note">Student role-safe decision / result / learning projection</p>
        </div>
        <strong className="summary-badge">ROLE-SAFE</strong>
      </div>
      {error ? (
        <p className="summary-error" role="alert">
          {error}
        </p>
      ) : null}
      {!exact ? <p className="lifecycle-status">需要 exact draft/run/round 上下文</p> : null}
      {exact && !projection && !error ? (
        <p className="lifecycle-status">等待 Student projection</p>
      ) : null}
      {projection ? (
        <>
          <div className="summary-grid">
            <article>
              <span>状态</span>
              <strong>{projection.status}</strong>
            </article>
            <article>
              <span>可见性</span>
              <strong>{projection.projection.visibility}</strong>
            </article>
            <article>
              <span>Exact model</span>
              <strong>{projection.context.model_version_ref}</strong>
            </article>
            <article>
              <span>REALIZED authority</span>
              <strong>{projection.projection.convergence.realized.authority}</strong>
            </article>
          </div>
          <p className="lifecycle-boundary">
            学生只接收发布后的角色安全投影；不展示参数值、内容摘要或管理审计元数据。
          </p>
          <p className="evidence-note" data-testid="student-shanghai-full-vertical">
            Demand={projection.projection.convergence.demand_realization.candidate.status} · CAN=
            {projection.projection.convergence.can.eligible ? "eligible" : "blocked"} · REALIZED=
            {projection.projection.convergence.realized.authority}
          </p>
        </>
      ) : null}
    </section>
  );
}
