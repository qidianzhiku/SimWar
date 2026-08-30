import { useEffect, useState } from "react";
import type { ApiEnvelope, ModelQualificationStudentProjection } from "@simwar/shared-contracts";

interface Props {
  apiBase: string;
  courseId?: string | undefined;
  qualificationId?: string | undefined;
  tenantId: string;
  token: string;
}

export function ModelQualificationProjection({
  apiBase,
  courseId,
  qualificationId,
  tenantId,
  token
}: Props) {
  const [projection, setProjection] = useState<ModelQualificationStudentProjection | null>(null);
  const [notice, setNotice] = useState("等待已绑定模型资格");

  useEffect(() => {
    if (!courseId || !qualificationId || !token) {
      setProjection(null);
      setNotice("Teacher 绑定后，通过 modelQualificationId 查询已发布解释");
      return;
    }
    let active = true;
    void fetch(
      `${apiBase}/api/v1/bff/student/model-qualification?courseId=${encodeURIComponent(courseId)}&qualificationId=${encodeURIComponent(qualificationId)}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-tenant-id": tenantId
        }
      }
    )
      .then(async (response) => {
        const envelope =
          (await response.json()) as ApiEnvelope<ModelQualificationStudentProjection>;
        if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
        if (active) setProjection(envelope.data);
      })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? error.message : "学生模型解释加载失败");
      });
    return () => {
      active = false;
    };
  }, [apiBase, courseId, qualificationId, tenantId, token]);

  return (
    <section className="panel" aria-label="student role-safe model qualification explanation">
      <div className="panel-title">
        <h2>受治理模型解释</h2>
        <span>ROLE_SAFE_STUDENT</span>
      </div>
      {projection ? (
        <>
          <div className="status-grid">
            <div>
              <span>模型版本</span>
              <strong>{projection.qualification.model_version}</strong>
            </div>
            <div>
              <span>状态</span>
              <strong>{projection.qualification.decision}</strong>
            </div>
            <div>
              <span>绑定</span>
              <strong>{projection.qualification.binding_status}</strong>
            </div>
          </div>
          <ul>
            {projection.qualification.explanation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="evidence-note">
            仅显示来源新鲜度、权利状态、诊断摘要和解释；来源定位、模型工件与内容摘要等
            内部字段不向 Student 暴露。
          </p>
        </>
      ) : (
        <p className="evidence-note" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}

export default ModelQualificationProjection;
