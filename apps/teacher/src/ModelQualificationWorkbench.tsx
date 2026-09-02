import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiEnvelope, ModelQualificationTeacherProjection } from "@simwar/shared-contracts";
import {
  calibrationDatasetIdentity,
  hasExactModelQualificationEvidence,
  modelVersionIdentity,
  qualificationIdentity,
  sourcePackageIdentity,
  type ModelQualificationEvidenceSelection,
  type ModelQualificationEvidenceSelectionResult
} from "./model-qualification-evidence-selection";
import {
  ModelQualificationEvidenceReview,
  type ModelQualificationFetchState
} from "./ModelQualificationEvidenceReview";

interface Props {
  apiBase: string;
  courseId?: string | null;
  tenantId: string;
  token: string;
}

async function request<T>(
  apiBase: string,
  tenantId: string,
  token: string,
  path: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-tenant-id": tenantId
    },
    method
  });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
  return envelope.data;
}

function findByKey<T>(
  entries: readonly T[],
  key: string | null | undefined,
  identity: (entry: T) => string
): T | undefined {
  return key ? entries.find((entry) => identity(entry) === key) : undefined;
}

export function ModelQualificationWorkbench({ apiBase, courseId, tenantId, token }: Props) {
  const [projection, setProjection] = useState<ModelQualificationTeacherProjection | null>(null);
  const [fetchState, setFetchState] = useState<ModelQualificationFetchState>("idle");
  const [selection, setSelection] = useState<ModelQualificationEvidenceSelection | null>(null);
  const [resolution, setResolution] = useState<ModelQualificationEvidenceSelectionResult | null>(
    null
  );
  const [notice, setNotice] = useState("等待模型资格治理上下文");
  const [busy, setBusy] = useState(false);

  const context = useMemo(
    () => ({
      activityId: "model-qualification-studio",
      courseId: courseId ?? "",
      tenantId
    }),
    [courseId, tenantId]
  );

  const refresh = useCallback(async () => {
    if (!courseId || !token) {
      setProjection(null);
      setFetchState("idle");
      setNotice("选择课程并登录后加载来源资格治理");
      return;
    }
    setFetchState("loading");
    try {
      const next = await request<ModelQualificationTeacherProjection>(
        apiBase,
        tenantId,
        token,
        `/api/v1/bff/teacher/model-qualification?courseId=${encodeURIComponent(courseId)}`
      );
      setProjection(next);
      setFetchState("ready");
      setNotice("来源资格治理工作台已加载");
    } catch (error) {
      setProjection(null);
      setResolution(null);
      setFetchState("error");
      setNotice(error instanceof Error ? error.message : "来源资格治理加载失败");
    }
  }, [apiBase, courseId, tenantId, token]);

  useEffect(() => {
    setSelection(null);
    setResolution(null);
    void refresh();
  }, [courseId, refresh, tenantId, token]);

  const handleSelectionChange = useCallback(
    (
      nextSelection: ModelQualificationEvidenceSelection,
      nextResolution: ModelQualificationEvidenceSelectionResult | null
    ) => {
      setSelection(nextSelection);
      setResolution(nextResolution);
    },
    []
  );

  const selectedModel = findByKey(
    projection?.model_catalog ?? [],
    selection?.model_version_key,
    (entry) => modelVersionIdentity(entry.model_version_reference)
  );
  const selectedSource = findByKey(
    projection?.source_packages ?? [],
    selection?.source_package_key,
    sourcePackageIdentity
  );
  const selectedDataset = findByKey(
    projection?.calibration_datasets ?? [],
    selection?.calibration_dataset_key,
    calibrationDatasetIdentity
  );
  const selectedQualification = findByKey(
    projection?.qualifications ?? [],
    selection?.qualification_key,
    qualificationIdentity
  );
  const exactEvidence = hasExactModelQualificationEvidence(resolution) ? resolution.selected : null;
  const partialSelectionSafe =
    resolution?.state !== "invalid-context" &&
    resolution?.state !== "duplicate" &&
    resolution?.state !== "conflict" &&
    resolution?.state !== "stale";
  const exactSourceSelected =
    Boolean(selectedSource) &&
    selection?.source_package_key === sourcePackageIdentity(selectedSource!);
  const exactDatasetSelected =
    Boolean(selectedDataset) &&
    selection?.calibration_dataset_key === calibrationDatasetIdentity(selectedDataset!) &&
    exactSourceSelected &&
    selectedDataset?.source_package_id === selectedSource?.source_package_id;
  const exactModelSelected =
    Boolean(selectedModel) &&
    selection?.model_version_key === modelVersionIdentity(selectedModel!.model_version_reference);
  const hasSourcePackages = (projection?.source_packages.length ?? 0) > 0;
  const hasCalibrationDatasets = (projection?.calibration_datasets.length ?? 0) > 0;
  const hasQualifications = (projection?.qualifications.length ?? 0) > 0;

  async function mutate(path: string, body?: unknown) {
    if (!courseId || busy) return;
    setBusy(true);
    try {
      await request(apiBase, tenantId, token, path, "POST", body);
      await refresh();
      setNotice("操作已完成；请重新确认 exact 证据链");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "治理操作失败");
    } finally {
      setBusy(false);
    }
  }

  const digestA = "a".repeat(64);
  const digestB = "b".repeat(64);
  const digestC = "c".repeat(64);

  return (
    <section className="summary-panel" aria-label="source-backed model qualification workbench">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">R2 · offline qualification governance</p>
          <h2>来源证据与模型资格治理</h2>
        </div>
        <strong className="summary-badge">{courseId ?? "未选择课程"}</strong>
      </div>
      <p className="evidence-note">
        先登记可追溯来源，再建立无 holdout
        泄漏的数据集，最后运行确定性资格检查并显式复核；该平面只产生候选治理证据，不写入官方
        REALIZED。
      </p>
      <p className="lifecycle-status" role="status">
        {notice}
      </p>
      <ModelQualificationEvidenceReview
        context={context}
        errorMessage={fetchState === "error" ? notice : undefined}
        fetchState={fetchState}
        onSelectionChange={handleSelectionChange}
        projection={projection}
      />
      {projection ? (
        <>
          <div className="summary-grid">
            <article>
              <span>ModelVersion</span>
              <strong>
                {selectedModel
                  ? `${selectedModel.model_version_reference.model_version_id}@${selectedModel.model_version_reference.version}`
                  : "未选择 exact ModelVersion"}
              </strong>
            </article>
            <article>
              <span>来源包</span>
              <strong>{selectedSource?.source_package_id ?? "未选择 exact SourcePackage"}</strong>
            </article>
            <article>
              <span>数据集</span>
              <strong>{selectedDataset?.status ?? "未选择 exact Dataset"}</strong>
            </article>
            <article>
              <span>资格</span>
              <strong>{selectedQualification?.decision ?? "未选择 exact Qualification"}</strong>
            </article>
          </div>
          <div className="workspace-actions">
            <button
              type="button"
              disabled={busy || hasSourcePackages || Boolean(selectedSource)}
              onClick={() =>
                void mutate("/api/v1/bff/teacher/model-qualification/source-packages", {
                  content_digest: digestA,
                  course_id: courseId,
                  evidence_refs: ["fixture:generic-source:1"],
                  feature_schema_digest: digestB,
                  freshness_status: "FRESH",
                  observed_at: "2026-08-30T12:00:00.000Z",
                  quality: { conflict_count: 0, missingness_rate: 0.02, record_count: 4 },
                  rights_status: "VALID",
                  source_ref: "fixture://generic-source",
                  source_version: "1.0.0",
                  title: "Generic source-backed demand fixture"
                })
              }
            >
              {hasSourcePackages ? "来源已登记，请选择 exact" : "登记来源与证据"}
            </button>
            <button
              type="button"
              disabled={
                busy ||
                !partialSelectionSafe ||
                !exactSourceSelected ||
                hasCalibrationDatasets ||
                Boolean(selectedDataset)
              }
              onClick={() =>
                void mutate("/api/v1/bff/teacher/model-qualification/datasets", {
                  calibration_record_ids: ["cal-1", "cal-2"],
                  content_digest: digestC,
                  course_id: courseId,
                  holdout_record_ids: ["holdout-1", "holdout-2"],
                  source_package_id: selectedSource?.source_package_id
                })
              }
            >
              {hasCalibrationDatasets ? "数据集已登记，请选择 exact" : "创建 Calibration / Holdout"}
            </button>
            <button
              type="button"
              disabled={
                busy ||
                !partialSelectionSafe ||
                !exactModelSelected ||
                !exactSourceSelected ||
                !exactDatasetSelected ||
                hasQualifications ||
                Boolean(selectedQualification)
              }
              onClick={() =>
                void mutate("/api/v1/bff/teacher/model-qualification/qualifications", {
                  calibration_dataset_id: selectedDataset?.calibration_dataset_id,
                  course_id: courseId,
                  deterministic_seed: 42,
                  model_version_reference: selectedModel?.model_version_reference,
                  source_package_id: selectedSource?.source_package_id
                })
              }
            >
              {hasQualifications ? "资格已登记，请选择 exact" : "运行确定性资格检查"}
            </button>
            <button
              type="button"
              disabled={
                busy ||
                !exactEvidence ||
                exactEvidence.qualification.decision !== "APPROVED" ||
                exactEvidence.qualification.review.status !== "PENDING"
              }
              onClick={() =>
                void mutate(
                  `/api/v1/bff/teacher/model-qualification/qualifications/${exactEvidence?.qualification.qualification_id}/review?courseId=${encodeURIComponent(courseId ?? "")}`,
                  { decision: "APPROVED", note: "Reviewed against the exact offline fixture." }
                )
              }
            >
              {selectedQualification?.review.status === "APPROVED" ? "已复核" : "批准资格候选"}
            </button>
            <button
              type="button"
              disabled={
                busy ||
                !exactEvidence ||
                exactEvidence.qualification.review.status !== "APPROVED" ||
                exactEvidence.qualification.binding.status === "BOUND"
              }
              onClick={() =>
                void mutate(
                  `/api/v1/bff/teacher/model-qualification/qualifications/${exactEvidence?.qualification.qualification_id}/bind?courseId=${encodeURIComponent(courseId ?? "")}`
                )
              }
            >
              {exactEvidence?.qualification.binding.status === "BOUND"
                ? "已绑定课程"
                : "绑定到课程治理"}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default ModelQualificationWorkbench;
