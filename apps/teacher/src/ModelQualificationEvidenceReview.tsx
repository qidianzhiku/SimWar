import { useEffect, useMemo, useState, type ReactElement } from "react";
import type {
  ModelQualification,
  ModelQualificationCalibrationDataset,
  ModelQualificationModelCatalogEntry,
  ModelQualificationSourcePackage,
  ModelQualificationTeacherProjection
} from "@simwar/shared-contracts";
import {
  createEmptyModelQualificationSelection,
  resolveModelQualificationEvidenceSelection,
  type ModelQualificationEvidenceSelection,
  type ModelQualificationEvidenceSelectionContext,
  type ModelQualificationEvidenceSelectionResult
} from "./model-qualification-evidence-selection";
import "./model-qualification-evidence-review.css";

export type ModelQualificationFetchState =
  | "idle"
  | "loading"
  | "ready"
  | "error"
  | "unauthorized"
  | "reauth-required"
  | "conflict"
  | "unknown"
  | "recovered";

export interface ModelQualificationEvidenceReviewProps {
  context: ModelQualificationEvidenceSelectionContext;
  fetchState: ModelQualificationFetchState;
  projection: ModelQualificationTeacherProjection | null;
  errorMessage?: string | undefined;
  onSelectionChange?: (
    selection: ModelQualificationEvidenceSelection,
    resolution: ModelQualificationEvidenceSelectionResult | null
  ) => void;
}

const FETCH_STATE_LABELS: Record<ModelQualificationFetchState, string> = {
  idle: "等待课程上下文",
  loading: "正在读取资格证据",
  ready: "来源资格证据已读取",
  error: "资格证据读取失败",
  unauthorized: "无权查看资格证据",
  "reauth-required": "需要重新登录后重新读取",
  conflict: "课程或租户上下文冲突",
  unknown: "无法确认资格证据",
  recovered: "资格证据已恢复"
};

const RESOLUTION_STATE_LABELS: Record<string, string> = {
  selected: "审阅就绪",
  empty: "暂无资格证据",
  "no-selection": "请选择 exact 证据链",
  stale: "选择已失效，请重新读取",
  "missing-linked-item": "关联证据缺失，已安全阻断",
  mismatch: "证据链不一致，已安全阻断",
  "invalid-context": "租户、课程或角色上下文无效",
  duplicate: "存在重复 exact 证据，已安全阻断",
  conflict: "存在冲突证据，已安全阻断",
  unknown: "资格状态无法确认"
};

function modelKey(model: ModelQualificationModelCatalogEntry): string {
  const reference = model.model_version_reference;
  return `${reference.model_version_id}@${reference.version}#${reference.content_digest}`;
}

function sourceKey(source: ModelQualificationSourcePackage): string {
  return `${source.source_package_id}#${source.content_digest}`;
}

function datasetKey(dataset: ModelQualificationCalibrationDataset): string {
  return `${dataset.calibration_dataset_id}#${dataset.content_digest}`;
}

function qualificationKey(qualification: ModelQualification): string {
  return `${qualification.qualification_id}#${qualification.content_digest}`;
}

function setModelSelection(
  selection: ModelQualificationEvidenceSelection,
  modelVersionKey: string
): ModelQualificationEvidenceSelection {
  return {
    calibration_dataset_key: null,
    model_version_key: modelVersionKey || selection.model_version_key,
    qualification_key: null,
    source_package_key: null
  };
}

function setSourceSelection(
  selection: ModelQualificationEvidenceSelection,
  sourcePackageKey: string
): ModelQualificationEvidenceSelection {
  return {
    calibration_dataset_key: null,
    model_version_key: selection.model_version_key,
    qualification_key: null,
    source_package_key: sourcePackageKey || selection.source_package_key
  };
}

function setDatasetSelection(
  selection: ModelQualificationEvidenceSelection,
  calibrationDatasetKey: string
): ModelQualificationEvidenceSelection {
  return {
    calibration_dataset_key: calibrationDatasetKey || selection.calibration_dataset_key,
    model_version_key: selection.model_version_key,
    qualification_key: null,
    source_package_key: selection.source_package_key
  };
}

function setQualificationSelection(
  selection: ModelQualificationEvidenceSelection,
  qualificationKey: string
): ModelQualificationEvidenceSelection {
  return {
    calibration_dataset_key: selection.calibration_dataset_key,
    model_version_key: selection.model_version_key,
    qualification_key: qualificationKey || selection.qualification_key,
    source_package_key: selection.source_package_key
  };
}

function ReferenceValue({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="model-qualification-reference-value">
      <dt>{label}</dt>
      <dd>{value || "未提供"}</dd>
    </div>
  );
}

function EvidenceSelect({
  label,
  value,
  options,
  disabled,
  onChange
}: {
  label: string;
  value: string;
  options: readonly { key: string; label: string; detail?: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <label className="model-qualification-select">
      <span>{label}</span>
      <select
        aria-label={label}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">请选择 exact {label}</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
            {option.detail ? ` · ${option.detail}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatJson(value: unknown): string {
  return JSON.stringify(value);
}

export function ModelQualificationEvidenceReview({
  context,
  errorMessage,
  fetchState,
  projection,
  onSelectionChange
}: ModelQualificationEvidenceReviewProps): ReactElement {
  const [selection, setSelection] = useState<ModelQualificationEvidenceSelection | null>(null);
  const safeSelection = useMemo(
    () => selection ?? createEmptyModelQualificationSelection(),
    [selection]
  );

  const resolution = useMemo(
    () =>
      projection && (fetchState === "ready" || fetchState === "recovered")
        ? resolveModelQualificationEvidenceSelection({ context, projection, selection })
        : null,
    [context, fetchState, projection, selection]
  );

  const effectiveState =
    resolution?.state ?? (fetchState === "error" && projection ? "unknown" : null);
  const stateLabel =
    fetchState === "ready" || fetchState === "recovered"
      ? RESOLUTION_STATE_LABELS[effectiveState ?? "empty"]
      : FETCH_STATE_LABELS[fetchState];
  const selected = resolution?.selected;
  const models = projection?.model_catalog ?? [];
  const sources = projection?.source_packages ?? [];
  const datasets = projection?.calibration_datasets ?? [];
  const qualifications = projection?.qualifications ?? [];

  useEffect(() => {
    if (onSelectionChange) onSelectionChange(safeSelection, resolution);
  }, [onSelectionChange, resolution, safeSelection]);

  return (
    <section
      aria-label="teacher exact model qualification evidence review"
      className="model-qualification-evidence-review"
      data-evidence-state={resolution?.status ?? fetchState.toUpperCase()}
    >
      <header>
        <p className="eyebrow">Teacher · exact evidence review</p>
        <h2>模型资格证据与课程绑定审阅</h2>
        <p className="model-qualification-context">
          tenant={context.tenantId} · course={context.courseId} · activity={context.activityId}
        </p>
      </header>
      <p className="model-qualification-state" role="status" data-evidence-state-label>
        {stateLabel}
      </p>
      {errorMessage ? (
        <p className="model-qualification-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {fetchState === "idle" ||
      fetchState === "loading" ||
      fetchState === "error" ||
      fetchState === "unauthorized" ||
      fetchState === "reauth-required" ||
      fetchState === "conflict" ||
      fetchState === "unknown" ? (
        <p className="model-qualification-safe-message" role="alert">
          当前仅展示安全状态，不会根据客户端状态推断资格、批准或课程绑定。
        </p>
      ) : null}
      {projection ? (
        <>
          <div className="model-qualification-choice-grid">
            <EvidenceSelect
              label="ModelVersion"
              options={models.map((model) => ({
                key: modelKey(model),
                label: `${model.model_version_reference.model_version_id}@${model.model_version_reference.version}`,
                detail: model.model_version_reference.content_digest
              }))}
              value={safeSelection.model_version_key ?? ""}
              onChange={(value) => setSelection(setModelSelection(safeSelection, value))}
            />
            <EvidenceSelect
              label="SourcePackage"
              disabled={!safeSelection.model_version_key}
              options={sources.map((source) => ({
                key: sourceKey(source),
                label: source.source_package_id,
                detail: source.content_digest
              }))}
              value={safeSelection.source_package_key ?? ""}
              onChange={(value) => setSelection(setSourceSelection(safeSelection, value))}
            />
            <EvidenceSelect
              label="Calibration/Holdout Dataset"
              disabled={!safeSelection.source_package_key}
              options={datasets.map((dataset) => ({
                key: datasetKey(dataset),
                label: dataset.calibration_dataset_id,
                detail: dataset.content_digest
              }))}
              value={safeSelection.calibration_dataset_key ?? ""}
              onChange={(value) => setSelection(setDatasetSelection(safeSelection, value))}
            />
            <EvidenceSelect
              label="Qualification"
              disabled={!safeSelection.calibration_dataset_key}
              options={qualifications.map((qualification) => ({
                key: qualificationKey(qualification),
                label: qualification.qualification_id,
                detail: `${qualification.decision}/${qualification.review.status}/${qualification.binding.status}`
              }))}
              value={safeSelection.qualification_key ?? ""}
              onChange={(value) => setSelection(setQualificationSelection(safeSelection, value))}
            />
          </div>
          {selected ? (
            <div className="model-qualification-inspector" data-testid="exact-evidence-inspector">
              <h3>Exact evidence inspector</h3>
              <dl className="model-qualification-reference-grid">
                <ReferenceValue
                  label="qualification_id"
                  value={selected.qualification.qualification_id}
                />
                <ReferenceValue
                  label="qualification_digest"
                  value={selected.qualification.content_digest}
                />
                <ReferenceValue
                  label="model_version_id"
                  value={selected.model.model_version_reference.model_version_id}
                />
                <ReferenceValue
                  label="model_version"
                  value={selected.model.model_version_reference.version}
                />
                <ReferenceValue
                  label="model_reference_digest"
                  value={selected.model.model_version_reference.content_digest}
                />
                <ReferenceValue
                  label="model_artifact_id"
                  value={selected.model.artifact.artifact_id}
                />
                <ReferenceValue
                  label="model_artifact_digest"
                  value={selected.model.artifact.content_digest}
                />
                <ReferenceValue
                  label="source_package_id"
                  value={selected.source.source_package_id}
                />
                <ReferenceValue
                  label="source_package_digest"
                  value={selected.source.content_digest}
                />
                <ReferenceValue label="source_observed_at" value={selected.source.observed_at} />
                <ReferenceValue label="source_freshness" value={selected.source.freshness_status} />
                <ReferenceValue label="source_rights" value={selected.source.rights_status} />
                <ReferenceValue
                  label="calibration_dataset_id"
                  value={selected.dataset.calibration_dataset_id}
                />
                <ReferenceValue
                  label="calibration_dataset_digest"
                  value={selected.dataset.content_digest}
                />
                <ReferenceValue label="dataset_created_at" value={selected.dataset.created_at} />
                <ReferenceValue
                  label="dataset_source_package_id"
                  value={selected.dataset.source_package_id}
                />
                <ReferenceValue
                  label="holdout_leakage_count"
                  value={String(selected.dataset.holdout_leakage_count)}
                />
                <ReferenceValue label="decision" value={selected.qualification.decision} />
                <ReferenceValue
                  label="review_status"
                  value={selected.qualification.review.status}
                />
                <ReferenceValue
                  label="binding_status"
                  value={selected.qualification.binding.status}
                />
                <ReferenceValue
                  label="qualification_created_at"
                  value={selected.qualification.created_at}
                />
                <ReferenceValue
                  label="qualification_updated_at"
                  value={selected.qualification.updated_at}
                />
              </dl>
              <p data-testid="exact-diagnostics">
                diagnostics={formatJson(selected.qualification.diagnostics)}
              </p>
              <p data-testid="exact-known-limits">
                known_limits={selected.qualification.known_limits.join(" · ")}
              </p>
              <p data-testid="exact-reasons">
                reasons={selected.qualification.reasons.join(" · ")}
              </p>
              <p className="model-qualification-read-only">
                read_only=true · official_truth_write=false · no_implicit_latest=true
              </p>
            </div>
          ) : (
            <p className="model-qualification-placeholder">
              选择同一租户、课程下的四项 exact
              证据后，系统才会展示可审阅详情；不会自动选择最新或第一项。
            </p>
          )}
          <aside className="model-qualification-known-limits">
            <h3>已知限制</h3>
            <ul>
              {projection.known_limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </aside>
        </>
      ) : null}
    </section>
  );
}

export default ModelQualificationEvidenceReview;
