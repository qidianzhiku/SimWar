import type {
  EvidenceAdoptionReference,
  FormalRunRuntimeBinding,
  ModelQualificationRecord,
  QualifiedRunAdmissionSnapshot,
  Round,
  Run
} from "@simwar/shared-contracts";
import { resolveAdoptedRunAdmission } from "./model-qualification-adopted-run-admission.js";
import { createQualifiedRunAdmissionSnapshot } from "./qualified-run-admission-snapshot.js";
import {
  createFormalRunRuntimeBinding,
  type FormalRunBindingAuthorityPorts
} from "./formal-run-runtime-binding.js";
import type { FormalRunRuntimeBindingPort } from "./formal-run-runtime-binding-store.js";
import { resolveFormalRuntimeInputsForActiveRun } from "./formal-runtime-input-resolver.js";
import type { FormalCourseAuthorityBinding } from "./formal-course-authority-binding.js";
import {
  resolveQualifiedRunAdmission,
  type QualifiedRunAdmissionInput,
  type QualifiedRunAdmissionReceipt
} from "./model-qualification-run-admission.js";

export interface FormalBoundRunPersistence {
  deleteRound(tenantId: string, roundId: string): Promise<void>;
  deleteRun(tenantId: string, runId: string): Promise<void>;
  saveRound(round: Round): Promise<void>;
  saveRun(run: Run, admission?: QualifiedRunAdmissionSnapshot): Promise<void>;
}

export interface CreateFormalBoundRunInput {
  authorities: FormalRunBindingAuthorityPorts;
  bindingStore: FormalRunRuntimeBindingPort;
  courseBinding: Pick<
    FormalCourseAuthorityBinding,
    "engine_reference" | "parameter_set_reference" | "scenario_package_reference"
  >;
  persistence: FormalBoundRunPersistence;
  round: Round;
  run: Run;
}

export async function createFormalBoundRun(input: CreateFormalBoundRunInput): Promise<void> {
  const binding = await createFormalRunRuntimeBinding({
    authorities: input.authorities,
    engine_reference: input.courseBinding.engine_reference,
    parameter_set_reference: input.courseBinding.parameter_set_reference,
    run_id: input.run.run_id,
    scenario_package_reference: input.courseBinding.scenario_package_reference,
    seed: input.run.seed,
    tenant_id: input.run.tenant_id
  });
  await resolveFormalRuntimeInputsForActiveRun({
    authorities: input.authorities,
    binding,
    run: input.run
  });

  let runPersisted = false;
  let roundPersisted = false;
  try {
    await input.persistence.saveRun(input.run);
    runPersisted = true;
    await input.persistence.saveRound(input.round);
    roundPersisted = true;
    await input.bindingStore.append(binding);
  } catch (error) {
    if (roundPersisted) {
      await input.persistence.deleteRound(input.round.tenant_id, input.round.round_id);
    }
    if (runPersisted) {
      await input.persistence.deleteRun(input.run.tenant_id, input.run.run_id);
    }
    throw error;
  }
}

export interface CreateQualifiedFormalBoundRunInput extends CreateFormalBoundRunInput {
  admission: QualifiedRunAdmissionInput;
}

/**
 * Admit the exact qualification/evidence chain before the existing formal Run
 * writer path is entered. The resolver is pure and runs before saveRun,
 * saveRound, or binding append, so a rejected candidate has no partial write.
 */
export async function createQualifiedFormalBoundRun(
  input: CreateQualifiedFormalBoundRunInput
): Promise<QualifiedRunAdmissionReceipt> {
  const receipt = resolveQualifiedRunAdmission(input.admission);
  await createFormalBoundRun(input);
  return receipt;
}

export interface CreateAdoptedFormalBoundRunInput extends CreateQualifiedFormalBoundRunInput {
  adoption: EvidenceAdoptionReference;
  withAdmissionGuard<T>(
    operation: (record: ModelQualificationRecord, now: () => string) => Promise<T>
  ): Promise<T>;
}

/** O5 extends the existing Run writer, never the formal binding/hash shape. */
export async function createAdoptedFormalBoundRun(
  input: CreateAdoptedFormalBoundRunInput
): Promise<QualifiedRunAdmissionSnapshot> {
  if (!input.adoption?.adoption_id || !input.adoption.adoption_digest)
    throw new Error("QUALIFIED_RUN_ADMISSION_ADOPTION_REQUIRED");
  if (typeof input.withAdmissionGuard !== "function")
    throw new Error("QUALIFIED_RUN_ADMISSION_GUARD_REQUIRED");
  const identity = input.admission.admission;
  if (
    input.run.tenant_id !== identity.tenant_id ||
    input.run.course_id !== identity.course_id ||
    input.round.tenant_id !== input.run.tenant_id ||
    input.round.run_id !== input.run.run_id
  ) {
    throw new Error("QUALIFIED_RUN_ADMISSION_SCOPE_MISMATCH");
  }
  return input.withAdmissionGuard(async (record, now) => {
    const validate = () =>
      resolveAdoptedRunAdmission(
        { ...input.admission, qualification_record: record, now: now() },
        input.adoption
      );
    validate();
    let snapshot: QualifiedRunAdmissionSnapshot | undefined;
    await createFormalBoundRun({
      ...input,
      persistence: {
        ...input.persistence,
        saveRun: async (run) => {
          snapshot = createQualifiedRunAdmissionSnapshot(run, validate());
          await input.persistence.saveRun(run, snapshot);
        }
      }
    });
    if (!snapshot) throw new Error("QUALIFIED_RUN_ADMISSION_SNAPSHOT_MISSING");
    return snapshot;
  });
}

export interface EnsureFormalRunRuntimeBindingInput {
  authorities: FormalRunBindingAuthorityPorts;
  bindingStore: FormalRunRuntimeBindingPort;
  courseBinding: CreateFormalBoundRunInput["courseBinding"];
  run: Run;
}

/**
 * Formalize an already-created active Run without creating a second Run/Round.
 * The existing Course/Run authority owns Run creation; this helper only uses
 * the same formal binding resolver and append-only runtime binding port to
 * complete an explicitly scoped launch command.
 */
export async function ensureFormalRunRuntimeBindingForActiveRun(
  input: EnsureFormalRunRuntimeBindingInput
): Promise<FormalRunRuntimeBinding> {
  const existing = await input.bindingStore.getForRun(input.run.tenant_id, input.run.run_id);
  if (existing) return existing;
  if (input.run.status !== "active") throw new Error("FORMAL_RUN_NOT_ACTIVE");
  const binding = await createFormalRunRuntimeBinding({
    authorities: input.authorities,
    engine_reference: input.courseBinding.engine_reference,
    parameter_set_reference: input.courseBinding.parameter_set_reference,
    run_id: input.run.run_id,
    scenario_package_reference: input.courseBinding.scenario_package_reference,
    seed: input.run.seed,
    tenant_id: input.run.tenant_id
  });
  await resolveFormalRuntimeInputsForActiveRun({
    authorities: input.authorities,
    binding,
    run: input.run
  });
  await input.bindingStore.append(binding);
  return binding;
}
