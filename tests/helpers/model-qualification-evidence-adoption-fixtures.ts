import type {
  AuditLog,
  EvidenceAdoptionCommandContext,
  EvidenceAdoptionEpoch,
  EvidenceAdoptionProposal,
  EvidenceAdoptionRecord,
  EvidenceAdoptionReference,
  EvidenceAdoptionReview,
  EvidenceAdoptionState,
  ModelQualification,
  ModelQualificationCalibrationDataset,
  ModelQualificationRecord,
  ModelQualificationSourcePackage
} from "@simwar/shared-contracts";
import {
  ModelQualificationService,
  type ModelQualificationActor,
  type ModelQualificationClock,
  type ModelQualificationPersistence,
  type ModelQualificationScope,
  type ModelQualificationSourceInput
} from "../../services/api/src/model-qualification-service";

export const EVIDENCE_ADOPTION_ACTIVITY_ID = "model-qualification-studio";
export const EVIDENCE_ADOPTION_NOW = "2026-09-03T12:00:00.000Z";
export const EVIDENCE_ADOPTION_AFTER_A_EXPIRES = "2026-09-05T00:00:00.000Z";
export const EVIDENCE_ADOPTION_AFTER_B_EXPIRES = "2027-01-01T00:00:00.000Z";

export const EVIDENCE_ADOPTION_SCOPE = {
  activity_id: EVIDENCE_ADOPTION_ACTIVITY_ID,
  course_id: "course_demo",
  tenant_id: "tenant_demo"
} as const satisfies ModelQualificationScope;

export const EVIDENCE_ADOPTION_OTHER_SCOPE = {
  activity_id: EVIDENCE_ADOPTION_ACTIVITY_ID,
  course_id: "course_other",
  tenant_id: "tenant_demo"
} as const satisfies ModelQualificationScope;

export const EVIDENCE_ADOPTION_FOREIGN_SCOPE = {
  activity_id: EVIDENCE_ADOPTION_ACTIVITY_ID,
  course_id: "course_demo",
  tenant_id: "tenant_foreign"
} as const satisfies ModelQualificationScope;

export const EVIDENCE_ADOPTION_TEACHER: ModelQualificationActor = {
  actor_id: "teacher_demo",
  role: "teacher",
  tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id
};

export const EVIDENCE_ADOPTION_ADMIN: ModelQualificationActor = {
  actor_id: "admin_demo",
  role: "tenant_admin",
  tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id
};

export const EVIDENCE_ADOPTION_STUDENT: ModelQualificationActor = {
  actor_id: "student_demo",
  role: "student",
  tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id
};

export const EVIDENCE_ADOPTION_OTHER_TEACHER: ModelQualificationActor = {
  actor_id: "teacher_other_course",
  role: "teacher",
  tenant_id: EVIDENCE_ADOPTION_OTHER_SCOPE.tenant_id
};

export const EVIDENCE_ADOPTION_FOREIGN_TEACHER: ModelQualificationActor = {
  actor_id: "teacher_foreign_tenant",
  role: "teacher",
  tenant_id: "tenant_foreign"
};

export type ModelQualificationRecordWithEvidenceAdoption = ModelQualificationRecord & {
  evidence_adoption?: EvidenceAdoptionState;
};

export class ModelQualificationEvidenceAdoptionFakePersistence implements ModelQualificationPersistence {
  readonly records: ModelQualificationRecordWithEvidenceAdoption[];
  readonly audits: AuditLog[] = [];

  constructor(seed: readonly ModelQualificationRecordWithEvidenceAdoption[] = []) {
    this.records = seed.map(clone);
  }

  commitRecord(record: ModelQualificationRecord, auditLog: AuditLog): void {
    const next = clone(record) as ModelQualificationRecordWithEvidenceAdoption;
    const index = this.records.findIndex(
      (candidate) =>
        candidate.tenant_id === next.tenant_id && candidate.course_id === next.course_id
    );
    if (index < 0) this.records.push(next);
    else this.records[index] = next;
    this.audits.push(clone(auditLog));
  }

  listRecords(): readonly ModelQualificationRecordWithEvidenceAdoption[] {
    return this.records.map(clone);
  }

  replaceRecord(record: ModelQualificationRecordWithEvidenceAdoption): void {
    const index = this.records.findIndex(
      (candidate) =>
        candidate.tenant_id === record.tenant_id && candidate.course_id === record.course_id
    );
    if (index < 0) this.records.push(clone(record));
    else this.records[index] = clone(record);
  }
}

export interface SeededEvidenceQualificationChain {
  readonly actor: ModelQualificationActor;
  readonly scope: ModelQualificationScope;
  readonly sourceA: ModelQualificationSourcePackage;
  readonly datasetA: ModelQualificationCalibrationDataset;
  readonly qualificationA: ModelQualification;
  readonly sourceB: ModelQualificationSourcePackage;
  readonly datasetB: ModelQualificationCalibrationDataset;
  readonly qualificationB: ModelQualification;
  readonly record: ModelQualificationRecord;
  readonly originalSerializedA: string;
}

export type EvidenceAdoptionEpochInput = Omit<EvidenceAdoptionEpoch, "epoch_digest">;

export interface EvidenceAdoptionServiceRequestInput {
  readonly command_id: string;
  readonly qualification_id: string;
  readonly expected_adoption: EvidenceAdoptionReference | null;
}

export interface EvidenceAdoptionServiceReviewInput {
  readonly command_id: string;
  readonly proposal_id: string;
  readonly proposal_digest: string;
  readonly decision: "APPROVED" | "REJECTED";
  readonly note: string;
}

export interface EvidenceAdoptionServiceDisposeInput {
  readonly command_id: string;
  readonly proposal_id: string;
  readonly proposal_digest: string;
  readonly disposition: EvidenceAdoptionRecord["disposition"];
  readonly expires_at: string | null;
  readonly note: string;
}

export interface EvidenceAdoptionServiceSurface {
  requestEvidenceAdoption(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    input: EvidenceAdoptionServiceRequestInput
  ): { proposal: EvidenceAdoptionProposal; reused: boolean };
  reviewEvidenceAdoption(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    input: EvidenceAdoptionServiceReviewInput
  ): { review: EvidenceAdoptionReview; reused: boolean };
  disposeEvidenceAdoption(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    input: EvidenceAdoptionServiceDisposeInput
  ): { adoption: EvidenceAdoptionRecord; reused: boolean };
  getEvidenceAdoptionState(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope
  ): EvidenceAdoptionState;
}

export interface EvidenceAdoptionServiceFixture {
  readonly service: ModelQualificationService;
  readonly persistence: ModelQualificationEvidenceAdoptionFakePersistence;
  readonly primary: SeededEvidenceQualificationChain;
  readonly secondary: SeededEvidenceQualificationChain;
  readonly foreign: SeededEvidenceQualificationChain;
}

export function asEvidenceAdoptionService(
  service: ModelQualificationService
): EvidenceAdoptionServiceSurface {
  // R1's frozen methods are intentionally absent on the base source. This
  // assertion describes the pending service API without adding a production
  // shim or a conditional test skip.
  return service as unknown as EvidenceAdoptionServiceSurface;
}

export function createEvidenceAdoptionClock(): ModelQualificationClock {
  return { now: () => EVIDENCE_ADOPTION_NOW };
}

export function createEvidenceAdoptionServiceFixture(): EvidenceAdoptionServiceFixture {
  const persistence = new ModelQualificationEvidenceAdoptionFakePersistence();
  const service = new ModelQualificationService(createEvidenceAdoptionClock(), persistence);
  const primary = seedApprovedBoundChain(
    service,
    EVIDENCE_ADOPTION_SCOPE,
    EVIDENCE_ADOPTION_TEACHER
  );
  const secondary = seedApprovedBoundChain(
    service,
    EVIDENCE_ADOPTION_OTHER_SCOPE,
    EVIDENCE_ADOPTION_OTHER_TEACHER
  );
  const foreign = seedApprovedBoundChain(
    service,
    EVIDENCE_ADOPTION_FOREIGN_SCOPE,
    EVIDENCE_ADOPTION_FOREIGN_TEACHER
  );
  return { foreign, persistence, primary, secondary, service };
}

export function seedApprovedBoundChain(
  service: ModelQualificationService,
  scope: ModelQualificationScope,
  actor: ModelQualificationActor
): SeededEvidenceQualificationChain {
  const sourceA = service.registerSourcePackage(actor, scope, sourceInput("A")).source_package;
  const datasetA = service.createCalibrationDataset(actor, scope, {
    calibration_record_ids: ["calibration-a"],
    content_digest: "c".repeat(64),
    holdout_record_ids: ["holdout-a"],
    source_package_id: sourceA.source_package_id
  }).calibration_dataset;
  const qualificationA = service.runQualification(actor, scope, {
    calibration_dataset_id: datasetA.calibration_dataset_id,
    deterministic_seed: 42,
    model_version_reference: service.modelCatalog[0].model_version_reference,
    source_package_id: sourceA.source_package_id
  }).qualification;
  const reviewedA = service.reviewQualification(actor, scope, qualificationA.qualification_id, {
    decision: "APPROVED",
    note: "A exact fixture reviewed."
  }).qualification;
  const boundA = service.bindQualification(actor, scope, reviewedA.qualification_id).qualification;

  const sourceB = service.registerSourcePackage(actor, scope, sourceInput("B")).source_package;
  const datasetB = service.createCalibrationDataset(actor, scope, {
    calibration_record_ids: ["calibration-b"],
    content_digest: "d".repeat(64),
    holdout_record_ids: ["holdout-b"],
    source_package_id: sourceB.source_package_id
  }).calibration_dataset;
  const qualificationB = service.runQualification(actor, scope, {
    calibration_dataset_id: datasetB.calibration_dataset_id,
    deterministic_seed: 43,
    model_version_reference: service.modelCatalog[0].model_version_reference,
    source_package_id: sourceB.source_package_id
  }).qualification;
  const reviewedB = service.reviewQualification(actor, scope, qualificationB.qualification_id, {
    decision: "APPROVED",
    note: "B exact fixture reviewed."
  }).qualification;
  const boundB = service.bindQualification(actor, scope, reviewedB.qualification_id).qualification;

  const record = service.getRecordForScope(scope);
  if (!record) throw new Error(`seeded record missing for ${scope.tenant_id}/${scope.course_id}`);
  return {
    actor,
    datasetA,
    datasetB,
    originalSerializedA: JSON.stringify({
      dataset: datasetA,
      qualification: boundA,
      source: sourceA
    }),
    qualificationA: boundA,
    qualificationB: boundB,
    record,
    scope,
    sourceA,
    sourceB
  };
}

export function createEvidenceAdoptionEpochInput(
  chain: SeededEvidenceQualificationChain,
  version: "A" | "B"
): EvidenceAdoptionEpochInput {
  const source = version === "A" ? chain.sourceA : chain.sourceB;
  const dataset = version === "A" ? chain.datasetA : chain.datasetB;
  const qualification = version === "A" ? chain.qualificationA : chain.qualificationB;
  return {
    calibration_dataset_content_digest: dataset.content_digest,
    calibration_dataset_id: dataset.calibration_dataset_id,
    course_id: chain.scope.course_id,
    model_artifact_reference: { ...qualification.artifact },
    model_version_reference: { ...qualification.model_version_reference },
    qualification_content_digest: qualification.content_digest,
    qualification_id: qualification.qualification_id,
    source_content_digest: source.content_digest,
    source_expires_at: source.expires_at,
    source_package_id: source.source_package_id,
    tenant_id: chain.scope.tenant_id
  };
}

export function createEvidenceAdoptionContext(
  scope: ModelQualificationScope,
  actor: ModelQualificationActor,
  command_id: string,
  now = EVIDENCE_ADOPTION_NOW
): EvidenceAdoptionCommandContext {
  return {
    actor_id: actor.actor_id,
    command_id,
    course_id: scope.course_id,
    now,
    role: actor.role as "teacher" | "tenant_admin",
    tenant_id: scope.tenant_id
  };
}

export function adoptionReference(record: EvidenceAdoptionRecord): EvidenceAdoptionReference {
  return {
    adoption_digest: record.adoption_digest,
    adoption_id: record.adoption_id
  };
}

export function recordForScope(
  persistence: ModelQualificationEvidenceAdoptionFakePersistence,
  scope: Pick<ModelQualificationScope, "tenant_id" | "course_id">
): ModelQualificationRecordWithEvidenceAdoption {
  const record = persistence.records.find(
    (candidate) =>
      candidate.tenant_id === scope.tenant_id && candidate.course_id === scope.course_id
  );
  if (!record)
    throw new Error(`persisted record missing for ${scope.tenant_id}/${scope.course_id}`);
  return clone(record);
}

function sourceInput(version: "A" | "B"): ModelQualificationSourceInput {
  const isA = version === "A";
  return {
    content_digest: isA ? "a".repeat(64) : "b".repeat(64),
    evidence_refs: [`fixture:model-qualification-adoption:${version.toLowerCase()}`],
    expires_at: isA ? "2026-09-04T00:00:00.000Z" : "2026-12-31T00:00:00.000Z",
    feature_schema_digest: isA ? "e".repeat(64) : "f".repeat(64),
    freshness_status: "FRESH",
    observed_at: "2026-09-01T00:00:00.000Z",
    quality: { conflict_count: 0, missingness_rate: 0, record_count: 4 },
    rights_status: "VALID",
    source_ref: `fixture://model-qualification-adoption/${version.toLowerCase()}`,
    source_version: `${version === "A" ? "1" : "2"}.0.0`,
    title: `Model qualification evidence ${version}`
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
