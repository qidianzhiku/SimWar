/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type {
  ModelQualification,
  ModelQualificationCalibrationDataset,
  ModelQualificationModelCatalogEntry,
  ModelQualificationSourcePackage,
  ModelQualificationTeacherProjection
} from "@simwar/shared-contracts";
import { buildExactModelQualificationSelection } from "../../apps/teacher/src/model-qualification-evidence-selection";
import { ModelQualificationEvidenceReview } from "../../apps/teacher/src/ModelQualificationEvidenceReview";

const DIGEST = (seed: string): string => `${seed}${"0".repeat(64)}`.slice(0, 64);
const context = {
  activityId: "model-qualification-studio",
  courseId: "course_demo",
  tenantId: "tenant_demo"
};

function model(id: string, version: string): ModelQualificationModelCatalogEntry {
  return {
    artifact: {
      artifact_id: `artifact-${id}`,
      content_digest: DIGEST(`artifact-${id}`),
      format: "json",
      source_ref: `registry://${id}`
    },
    model_family: "toy_logit",
    model_version_reference: { content_digest: DIGEST(`ref-${id}`), model_version_id: id, version },
    status: "APPROVED"
  };
}

function source(id: string): ModelQualificationSourcePackage {
  return {
    content_digest: DIGEST(id),
    course_id: context.courseId,
    evidence_refs: [`evidence-${id}`],
    expires_at: null,
    feature_schema_digest: DIGEST(`${id}-schema`),
    freshness_status: "FRESH",
    observed_at: "2026-08-30T12:00:00.000Z",
    quality: { conflict_count: 0, missingness_rate: 0.01, record_count: 4 },
    rights_status: "VALID",
    source_package_id: id,
    source_ref: `source://${id}`,
    source_version: "1.0.0",
    tenant_id: context.tenantId,
    title: id
  };
}

function dataset(id: string, sourceId: string): ModelQualificationCalibrationDataset {
  return {
    calibration_dataset_id: id,
    calibration_record_ids: [`${id}-calibration`],
    content_digest: DIGEST(id),
    course_id: context.courseId,
    created_at: "2026-08-30T12:00:00.000Z",
    holdout_leakage_count: 0,
    holdout_record_ids: [`${id}-holdout`],
    record_count: 2,
    source_package_id: sourceId,
    status: "READY",
    tenant_id: context.tenantId,
    zero_holdout_leakage: true
  };
}

function qualification(
  id: string,
  modelVersion: ModelQualificationModelCatalogEntry,
  sourcePackage: ModelQualificationSourcePackage,
  calibrationDataset: ModelQualificationCalibrationDataset
): ModelQualification {
  return {
    artifact: {
      artifact_id: `qualification-artifact-${id}`,
      content_digest: DIGEST(id),
      format: "json",
      source_ref: `qualification://${id}`
    },
    authority_flags: { official_truth_write: false, provider_calls: 0 },
    binding: { status: "UNBOUND" },
    calibration_dataset_id: calibrationDataset.calibration_dataset_id,
    content_digest: DIGEST(id),
    course_id: context.courseId,
    created_at: "2026-08-30T12:00:00.000Z",
    decision: "APPROVED",
    deterministic_seed: 42,
    diagnostics: {
      baseline_error: 0.04,
      convergence_status: "CONVERGED",
      differential_error: 0.01,
      drift_score: 0.02,
      ood_rate: 0.01,
      sensitivity_max_delta: 0.03
    },
    known_limits: ["Candidate evidence only."],
    model_version_reference: modelVersion.model_version_reference,
    no_implicit_latest: true,
    qualification_id: id,
    reasons: ["Exact fixture."],
    review: { status: "PENDING" },
    source_package_id: sourcePackage.source_package_id,
    tenant_id: context.tenantId,
    updated_at: "2026-08-30T12:00:00.000Z"
  };
}

const oldModel = model("model-old", "1.0.0");
const targetModel = model("model-target", "2.0.0");
const newestModel = model("model-newest", "3.0.0");
const oldSource = source("source-old");
const targetSource = source("source-target");
const newestSource = source("source-newest");
const oldDataset = dataset("dataset-old", oldSource.source_package_id);
const targetDataset = dataset("dataset-target", targetSource.source_package_id);
const newestDataset = dataset("dataset-newest", newestSource.source_package_id);
const oldQualification = qualification("qualification-old", oldModel, oldSource, oldDataset);
const targetQualification = qualification(
  "qualification-target",
  targetModel,
  targetSource,
  targetDataset
);
const newestQualification = qualification(
  "qualification-newest",
  newestModel,
  newestSource,
  newestDataset
);

function projection(
  overrides: Partial<ModelQualificationTeacherProjection> = {}
): ModelQualificationTeacherProjection {
  return {
    calibration_datasets: [oldDataset, targetDataset, newestDataset],
    known_limits: ["JSON runtime only"],
    model_catalog: [oldModel, targetModel, newestModel],
    operation_id: "MODEL_QUALIFICATION_TEACHER_STUDIO_GET_V1",
    qualifications: [oldQualification, targetQualification, newestQualification],
    security: {
      activity: context.activityId,
      course: context.courseId,
      role: "teacher",
      tenant: context.tenantId
    },
    source_packages: [oldSource, targetSource, newestSource],
    ...overrides
  };
}

async function renderReview(value: {
  projection: ModelQualificationTeacherProjection | null;
  fetchState: "ready" | "conflict" | "error";
}): Promise<{ host: HTMLDivElement; root: ReturnType<typeof createRoot> }> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<ModelQualificationEvidenceReview context={context} {...value} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return { host, root };
}

describe("Teacher exact model qualification evidence review", () => {
  it("requires an explicit four-part chain and can inspect a target that is not first or last", async () => {
    const { host, root } = await renderReview({ fetchState: "ready", projection: projection() });
    expect(host.querySelector("[data-evidence-state='NO_SELECTION']")).not.toBeNull();

    const exact = buildExactModelQualificationSelection(
      targetModel,
      targetSource,
      targetDataset,
      targetQualification
    );
    const selections = [...host.querySelectorAll("select")];
    await act(async () => {
      for (const [index, key] of [
        exact.model_version_key,
        exact.source_package_key,
        exact.calibration_dataset_key,
        exact.qualification_key
      ].entries()) {
        const select = selections[index] as HTMLSelectElement;
        select.value = key;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    expect(host.querySelector("[data-testid='exact-evidence-inspector']")).not.toBeNull();
    expect(host.querySelector("[data-testid='exact-evidence-inspector']")?.textContent).toContain(
      "qualification-target"
    );
    expect(host.querySelector("[data-testid='exact-evidence-inspector']")?.textContent).toContain(
      "model-target"
    );
    expect(
      host.querySelector("[data-testid='exact-evidence-inspector']")?.textContent
    ).not.toContain("qualification-newest");
    expect(host.querySelector("button")).toBeNull();
    root.unmount();
    host.remove();
  });

  it("renders fail-closed conflict and error states without inferring qualification", async () => {
    const conflict = { ...targetSource, content_digest: DIGEST("source-target-conflict") };
    const conflictView = await renderReview({
      fetchState: "ready",
      projection: projection({ source_packages: [oldSource, targetSource, conflict, newestSource] })
    });
    expect(conflictView.host.querySelector("[data-evidence-state='NO_SELECTION']")).not.toBeNull();
    expect(conflictView.host.textContent).toContain("请选择 exact 证据链");
    conflictView.root.unmount();
    conflictView.host.remove();

    const errorView = await renderReview({ fetchState: "error", projection: projection() });
    expect(errorView.host.querySelector("[data-evidence-state='ERROR']")).not.toBeNull();
    expect(errorView.host.textContent).toContain("不会根据客户端状态推断资格");
    errorView.root.unmount();
    errorView.host.remove();
  });

  it("shows empty evidence explicitly and preserves read-only source data", async () => {
    const emptyView = await renderReview({
      fetchState: "ready",
      projection: projection({
        model_catalog: [],
        source_packages: [],
        calibration_datasets: [],
        qualifications: []
      })
    });
    expect(emptyView.host.querySelector("[data-evidence-state='EMPTY']")).not.toBeNull();
    expect(emptyView.host.querySelectorAll("button")).toHaveLength(0);
    emptyView.root.unmount();
    emptyView.host.remove();
  });
});
