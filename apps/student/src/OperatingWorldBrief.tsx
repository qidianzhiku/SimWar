import { useEffect, useState } from "react";
import type { ApiEnvelope, OperatingWorldStudentProjection } from "@simwar/shared-contracts";

interface Props {
  apiBase: string;
  courseId?: string | undefined;
  draftId: string;
  roundNo?: number | undefined;
  runId?: string | undefined;
  tenantId: string;
  token: string;
}

export function OperatingWorldBrief({
  apiBase,
  courseId,
  draftId,
  roundNo,
  runId,
  tenantId,
  token
}: Props) {
  const [projection, setProjection] = useState<OperatingWorldStudentProjection | null>(null);
  const [notice, setNotice] = useState("等待精确 Operating World 上下文");
  useEffect(() => {
    setProjection(null);
    if (!courseId || !draftId || !runId || roundNo === undefined || !token) {
      setNotice("等待精确 Operating World 上下文");
      return;
    }
    let active = true;
    setNotice("正在加载精确 Operating World Brief");
    const path = `/api/v1/bff/student/operating-world/brief?courseId=${encodeURIComponent(courseId)}&draftId=${encodeURIComponent(draftId)}&runId=${encodeURIComponent(runId)}&roundNo=${roundNo}`;
    void fetch(`${apiBase}${path}`, {
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-tenant-id": tenantId
      }
    })
      .then(async (response) => {
        const envelope = (await response.json()) as ApiEnvelope<OperatingWorldStudentProjection>;
        if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
        if (active) setProjection(envelope.data);
      })
      .catch(
        (error: unknown) =>
          active && setNotice(error instanceof Error ? error.message : "Student Brief 加载失败")
      );
    return () => {
      active = false;
    };
  }, [apiBase, courseId, draftId, roundNo, runId, tenantId, token]);
  return (
    <section id="student-operating-world" aria-label="Student Operating World Brief">
      <p className="eyebrow">SH-M3 · {projection?.visibility ?? "role-safe"}</p>
      <h2>Operating World Brief</h2>
      {projection ? (
        <>
          <p>绑定摘要：{projection.binding_digest}</p>
          <div className="status-grid">
            <article>
              <span>劳动力供给</span>
              <strong>{projection.brief.workforce_supply}</strong>
            </article>
            <article>
              <span>工资压力</span>
              <strong>{projection.brief.wage_pressure}</strong>
            </article>
            <article>
              <span>服务能力</span>
              <strong>{projection.brief.service_capacity}</strong>
            </article>
            <article>
              <span>融资环境</span>
              <strong>{projection.brief.financing_environment}</strong>
            </article>
            <article>
              <span>建设成本范围</span>
              <strong>{projection.brief.construction_cost_range.join(" – ")}</strong>
            </article>
          </div>
          <p className="evidence-note">Known Limits: {projection.brief.known_limits.join(" · ")}</p>
        </>
      ) : (
        <p className="evidence-note">{notice}</p>
      )}
    </section>
  );
}
