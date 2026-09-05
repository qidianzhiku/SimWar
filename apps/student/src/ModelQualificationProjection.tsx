import { useEffect, useState } from "react";
import type {
  ApiEnvelope,
  ModelQualificationAdoptionOperationsStudentProjection,
  ModelQualificationRollbackOutcomeStudentSummary,
  ModelQualificationStudentProjection
} from "@simwar/shared-contracts";

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
  const [operations, setOperations] =
    useState<ModelQualificationAdoptionOperationsStudentProjection | null>(null);
  const [rollbackOutcomes, setRollbackOutcomes] = useState<
    readonly ModelQualificationRollbackOutcomeStudentSummary[]
  >([]);
  const contextIdentity = JSON.stringify([apiBase, courseId, qualificationId, tenantId, token]);
  const [projectionIdentity, setProjectionIdentity] = useState("");
  const [notice, setNotice] = useState("等待已绑定模型资格");
  const [operationsNotice, setOperationsNotice] = useState("");

  useEffect(() => {
    setProjection(null);
    setOperations(null);
    setRollbackOutcomes([]);
    setOperationsNotice("");
    if (!courseId || !qualificationId || !token) {
      setProjection(null);
      setRollbackOutcomes([]);
      setNotice("Teacher 绑定后，通过 modelQualificationId 查询已发布解释");
      return;
    }
    let active = true;
    const headers = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-tenant-id": tenantId
    };
    const query = `courseId=${encodeURIComponent(courseId)}&qualificationId=${encodeURIComponent(qualificationId)}`;
    void Promise.allSettled([
      fetch(`${apiBase}/api/v1/bff/student/model-qualification?${query}`, { headers }),
      fetch(`${apiBase}/api/v1/bff/student/model-qualification/adoption-operations?${query}`, {
        headers
      }),
      fetch(
        `${apiBase}/api/v1/bff/student/model-qualification/evidence-adoptions/rollback-outcomes?courseId=${encodeURIComponent(courseId)}`,
        { headers }
      )
    ])
      .then(async ([projectionOutcome, operationsOutcome, rollbackOutcome]) => {
        if (projectionOutcome.status === "rejected") throw projectionOutcome.reason;
        const projectionResponse = projectionOutcome.value;
        const envelope =
          (await projectionResponse.json()) as ApiEnvelope<ModelQualificationStudentProjection>;
        if (!projectionResponse.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
        if (active) {
          setProjection(envelope.data);
          setProjectionIdentity(contextIdentity);
        }
        if (operationsOutcome.status === "rejected") {
          if (active) setOperationsNotice("O6 operations unavailable");
          return;
        }
        const operationsResponse = operationsOutcome.value;
        let operationsEnvelope: ApiEnvelope<ModelQualificationAdoptionOperationsStudentProjection>;
        try {
          operationsEnvelope =
            (await operationsResponse.json()) as ApiEnvelope<ModelQualificationAdoptionOperationsStudentProjection>;
        } catch {
          if (active) setOperationsNotice("O6 operations unavailable");
          return;
        }
        if (!operationsResponse.ok) {
          if (active) setOperationsNotice("O6 operations unavailable");
          return;
        }
        if (active) setOperations(operationsEnvelope.data);
        if (rollbackOutcome.status === "fulfilled") {
          try {
            const rollbackResponse = rollbackOutcome.value;
            const rollbackEnvelope = (await rollbackResponse.json()) as ApiEnvelope<
              readonly ModelQualificationRollbackOutcomeStudentSummary[]
            >;
            if (rollbackResponse.ok && active) setRollbackOutcomes(rollbackEnvelope.data);
          } catch {
            if (active) setOperationsNotice("O8 outcome unavailable");
          }
        } else if (active) {
          setOperationsNotice("O8 outcome unavailable");
        }
      })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? error.message : "学生模型解释加载失败");
      });
    return () => {
      active = false;
    };
  }, [apiBase, courseId, qualificationId, tenantId, token, contextIdentity]);

  return (
    <section className="panel" aria-label="student role-safe model qualification explanation">
      <div className="panel-title">
        <h2>受治理模型解释</h2>
        <span>ROLE_SAFE_STUDENT</span>
      </div>
      {projection && projectionIdentity === contextIdentity ? (
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
          {projection.adoption && (
            <section aria-label="student safe evidence adoption status">
              <h3>未来准入采用状态</h3>
              <p>
                {projection.adoption.applicability} · Provider OFF · historical_non_overwrite=true
              </p>
              <p>采用状态只约束未来新 Run，不改变本 Run 的历史证据或任何正式分数、排名与结算。</p>
            </section>
          )}
          {operations && (
            <section aria-label="student safe adoption operations status">
              <h3>采用健康与未来准入适用性</h3>
              <p data-testid="student-adoption-operations-status">
                applicability={operations.applicability} · freshness={operations.freshness} ·
                requalification={operations.requalification_impact}
              </p>
              <p>
                Provider OFF · advisory-only · rollback_applied=
                {String(operations.rollback_applied)} · official_truth_write=
                {String(operations.official_truth_write)}
              </p>
              <ul>
                {operations.known_limits.map((limit) => (
                  <li key={limit}>{limit}</li>
                ))}
              </ul>
            </section>
          )}
          {operationsNotice && (
            <p className="evidence-note" role="status">
              {operationsNotice}；既有受治理模型解释保持可见
            </p>
          )}
          {rollbackOutcomes.length > 0 && (
            <section aria-label="student safe rollback outcome consistency">
              <h3>回退历史一致性（角色安全摘要）</h3>
              {rollbackOutcomes.map((outcome, index) => (
                <div key={`${outcome.operation_id}-${index}`}>
                  <p data-testid="student-rollback-outcome-status">
                    applicability={outcome.applicability} · qualification_consistency=
                    {outcome.qualification_consistency} · historical_consistency=
                    {outcome.historical_consistency}
                  </p>
                  <p>
                    Provider OFF · advisory-only · rollback_applied=
                    {String(outcome.rollback_applied)} · official_truth_write=
                    {String(outcome.official_truth_write)}
                  </p>
                  <ul>
                    {outcome.known_limits.map((limit) => (
                      <li key={limit}>{limit}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
          <section aria-label="student safe requalification status">
            <h3>证据新鲜度与限制</h3>
            <p data-testid="student-requalification-status">
              requalification={projection.requalification?.status ?? "NO_CHANGE"} · review=
              {projection.requalification?.review_status ?? "PENDING"} · resolution=
              {projection.requalification?.resolution ?? "PENDING"}
            </p>
            <p className="evidence-note">
              historical_non_overwrite=
              {String(projection.requalification?.historical_non_overwrite ?? true)}
              。Teacher 未完成替代证据复核前，Student 只看到当前已发布资格及已知限制。
            </p>
          </section>
          <p className="evidence-note">
            仅显示来源新鲜度、权利状态、诊断摘要和解释；来源定位、模型工件与内容摘要等 内部字段不向
            Student 暴露。
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
