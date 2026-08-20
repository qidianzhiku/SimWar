import { useEffect, useState } from "react";
import type {
  ApiEnvelope,
  W5GovernedModelStudentProjection
} from "@simwar/shared-contracts";

interface Props {
  apiBase: string;
  courseId?: string | undefined;
  roundNo?: number | undefined;
  runId?: string | undefined;
  tenantId: string;
  token: string;
}

export function W5GovernedModelProjection({
  apiBase,
  courseId,
  roundNo,
  runId,
  tenantId,
  token
}: Props) {
  const [projection, setProjection] = useState<W5GovernedModelStudentProjection | null>(null);
  const [notice, setNotice] = useState("等待教师显式绑定的 W5 draftId");
  const draftId = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("w5DraftId") ?? "";

  useEffect(() => {
    if (!token || !courseId || !runId || roundNo === undefined || !draftId) {
      setProjection(null);
      setNotice("学生投影需要显式 w5DraftId、runId 和 roundNo；不会选择 latest");
      return;
    }
    const controller = new AbortController();
    void fetch(
      `${apiBase}/api/v1/bff/student/w5/convergence?draftId=${encodeURIComponent(draftId)}&runId=${encodeURIComponent(runId)}&roundNo=${roundNo}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          "x-tenant-id": tenantId
        },
        signal: controller.signal
      }
    )
      .then(async (response) => {
        const envelope = (await response.json()) as ApiEnvelope<W5GovernedModelStudentProjection>;
        if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
        setProjection(envelope.data);
        setNotice("学生安全投影已加载");
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setProjection(null);
          setNotice(error instanceof Error ? error.message : "学生投影加载失败");
        }
      });
    return () => controller.abort();
  }, [apiBase, courseId, draftId, roundNo, runId, tenantId, token]);

  const convergence = projection?.convergence;
  return (
    <section className="w5-student-projection" aria-label="W5 governed model convergence">
      <p className="eyebrow">W5 · role-safe student projection</p>
      <h2>受控模型收敛视图</h2>
      <p className="evidence-note">{notice}</p>
      {convergence ? (
        <>
          <div className="w5-student-grid">
            <article><span>WANT</span><strong>{convergence.want.candidate_value} · 非正式候选</strong></article>
            <article><span>CAN</span><strong>{convergence.can.eligible ? "eligible" : "blocked"} · 非正式约束</strong></article>
            <article><span>REALIZED</span><strong>{convergence.realized.authority} · 正式投影</strong></article>
            <article><span>Replay</span><strong>{convergence.replay.exact_identity}</strong></article>
            <article><span>Fallback</span><strong>{convergence.fallback.applied ? "PLANE_OFF · core continues" : "PLANE_ON"}</strong></article>
          </div>
          <p className="evidence-note">ModelVersion: {convergence.model_version_ref} · {projection.visibility}</p>
          <p className="evidence-note">W5 学生投影仅呈现角色安全字段，不包含私有参数值或内容摘要。</p>
        </>
      ) : null}
    </section>
  );
}
