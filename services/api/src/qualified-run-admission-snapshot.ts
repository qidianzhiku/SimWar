import { createHash } from "node:crypto";
import type {
  AdoptedQualifiedRunAdmissionReceipt,
  QualifiedRunAdmissionSnapshot,
  Run
} from "@simwar/shared-contracts";

export type StoredQualifiedRun = Run & {
  readonly qualified_admission_snapshot?: QualifiedRunAdmissionSnapshot;
};

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(",")}}`;
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

/** Standard Run consumers must never receive the private governance snapshot. */
export function publicRun(run: Run): Run {
  return {
    tenant_id: run.tenant_id,
    course_id: run.course_id,
    run_id: run.run_id,
    parameter_set_id: run.parameter_set_id,
    scenario_package_id: run.scenario_package_id,
    seed: run.seed,
    status: run.status
  };
}

export function createQualifiedRunAdmissionSnapshot(
  run: Run,
  admission: AdoptedQualifiedRunAdmissionReceipt
): QualifiedRunAdmissionSnapshot {
  const body = {
    snapshot_schema_version: "qualified-run-admission-snapshot.v1" as const,
    tenant_id: run.tenant_id,
    course_id: run.course_id,
    run_id: run.run_id,
    admission: structuredClone(admission)
  };
  const snapshot = { ...body, snapshot_digest: digest(body) };
  assertQualifiedRunAdmissionSnapshot(run, snapshot);
  return structuredClone(snapshot);
}

export function assertQualifiedRunAdmissionSnapshot(
  run: Run,
  snapshot: QualifiedRunAdmissionSnapshot
): void {
  const fail = () => {
    throw new Error("QUALIFIED_RUN_ADMISSION_SNAPSHOT_INVALID");
  };
  if (!snapshot || typeof snapshot !== "object") return fail();
  const { snapshot_digest, ...body } = snapshot;
  const receipt = snapshot.admission;
  const epoch = receipt?.evidence_epoch;
  if (
    snapshot.snapshot_schema_version !== "qualified-run-admission-snapshot.v1" ||
    snapshot.tenant_id !== run.tenant_id ||
    snapshot.course_id !== run.course_id ||
    snapshot.run_id !== run.run_id ||
    !/^[a-f0-9]{64}$/.test(snapshot_digest) ||
    digest(body) !== snapshot_digest ||
    receipt?.schema_version !== "qualified-run-admission.v2" ||
    receipt.status !== "ADMITTED" ||
    receipt.tenant_id !== run.tenant_id ||
    receipt.course_id !== run.course_id ||
    receipt.official_truth_write !== false ||
    receipt.writer_effect !== "NONE" ||
    receipt.provider !== "OFF" ||
    !Number.isFinite(Date.parse(receipt.admitted_at)) ||
    !receipt.adoption?.adoption_id ||
    !/^[a-f0-9]{64}$/.test(receipt.adoption.adoption_digest) ||
    epoch?.tenant_id !== run.tenant_id ||
    epoch.course_id !== run.course_id ||
    receipt.source_package_id !== epoch.source_package_id ||
    receipt.calibration_dataset_id !== epoch.calibration_dataset_id ||
    receipt.qualification_id !== epoch.qualification_id ||
    receipt.qualification_content_digest !== epoch.qualification_content_digest ||
    canonical(receipt.model_version_reference) !== canonical(epoch.model_version_reference) ||
    canonical(receipt.model_artifact_reference) !== canonical(epoch.model_artifact_reference) ||
    receipt.scenario_package_reference?.scenario_package_id !== run.scenario_package_id ||
    receipt.parameter_set_reference?.parameter_set_id !== run.parameter_set_id
  )
    return fail();
}

/** Ordinary status updates preserve history; caller attempts to replace it fail closed. */
export function preserveQualifiedRunAdmissionSnapshot(
  run: Run,
  previous: StoredQualifiedRun | undefined,
  supplied?: QualifiedRunAdmissionSnapshot
): StoredQualifiedRun {
  const current = previous?.qualified_admission_snapshot;
  if (previous && !current && supplied) {
    throw new Error("QUALIFIED_RUN_ADMISSION_HISTORY_IMMUTABLE");
  }
  if (current) {
    assertQualifiedRunAdmissionSnapshot(run, current);
    if (supplied && canonical(current) !== canonical(supplied)) {
      throw new Error("QUALIFIED_RUN_ADMISSION_HISTORY_IMMUTABLE");
    }
  }
  if (supplied) assertQualifiedRunAdmissionSnapshot(run, supplied);
  const snapshot = current ?? supplied;
  return {
    ...publicRun(run),
    ...(snapshot ? { qualified_admission_snapshot: structuredClone(snapshot) } : {})
  };
}
