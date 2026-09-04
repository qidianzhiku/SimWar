import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { EvidenceAdoptionRecord, ModelQualification, Run } from "@simwar/shared-contracts";
import { createP1Store } from "../../services/api/src/store";
import {
  createJsonModelQualificationPersistence,
  createJsonRepositoryPorts
} from "../../services/api/src/json-repository-adapter";
import { ModelQualificationService } from "../../services/api/src/model-qualification-service";
import { FormalRunRuntimeBindingStore } from "../../services/api/src/formal-run-runtime-binding-store";
import { resolveFormalRuntimeInputsForActiveRun } from "../../services/api/src/formal-runtime-input-resolver";
import { createAdoptedFormalBoundRun } from "../../services/api/src/formal-bound-run-creation-service";
import { createQualifiedRunAdmissionFixture } from "../helpers/model-qualification-run-admission-fixtures";
import {
  EVIDENCE_ADOPTION_SCOPE as scope,
  EVIDENCE_ADOPTION_TEACHER as actor,
  seedApprovedBoundChain,
  adoptionReference
} from "../helpers/model-qualification-evidence-adoption-fixtures";

describe("O5 adopted evidence to real existing formal Run writer", () => {
  it("creates A then B, retains A through JSON reload and expiry, with no historical backfill", async () => {
    const directory = mkdtempSync(join(tmpdir(), "simwar-o5-formal-history-"));
    try {
      const persistenceFile = join(directory, "store.json");
      const store = createP1Store({ persistenceFile });
      const repository = createJsonRepositoryPorts(store);
      let now = "2026-09-03T12:00:00.000Z";
      const service = new ModelQualificationService(
        { now: () => now },
        createJsonModelQualificationPersistence(store)
      );
      const chain = seedApprovedBoundChain(service, scope, actor);
      const base = createQualifiedRunAdmissionFixture();
      const parameter = {
        ...base.parameter_set!,
        model_version_ref: `${chain.qualificationA.model_version_reference.model_version_id}@${chain.qualificationA.model_version_reference.version}`
      };
      const authorities = {
        parameterSets: {
          assertBindable: async () => undefined,
          getByReference: async () => parameter
        },
        scenarios: {
          assertBindable: async () => undefined,
          getByReference: async () => base.scenario_package
        },
        plugins: {
          getByReference: async () => null,
          resolveAvailableForNewBinding: async () => null
        }
      };
      const bindingStore = new FormalRunRuntimeBindingStore(store);
      function adopt(
        q: ModelQualification,
        command: string,
        previous: EvidenceAdoptionRecord | null
      ) {
        const proposal = service.requestEvidenceAdoption(actor, scope, {
          command_id: `${command}:request`,
          qualification_id: q.qualification_id,
          expected_adoption: previous ? adoptionReference(previous) : null
        }).proposal;
        service.reviewEvidenceAdoption(actor, scope, {
          command_id: `${command}:review`,
          proposal_id: proposal.proposal_id,
          proposal_digest: proposal.proposal_digest,
          decision: "APPROVED",
          note: "Exact epoch review"
        });
        return service.disposeEvidenceAdoption(actor, scope, {
          command_id: `${command}:dispose`,
          proposal_id: proposal.proposal_id,
          proposal_digest: proposal.proposal_digest,
          disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
          expires_at: null,
          note: "Explicit future adoption"
        }).adoption;
      }
      function createRun(q: ModelQualification, adopted: EvidenceAdoptionRecord, runId: string) {
        const record = service.getRecordForScope(scope)!;
        const run: Run = {
          tenant_id: scope.tenant_id,
          course_id: scope.course_id,
          run_id: runId,
          parameter_set_id: "parameter_demo",
          scenario_package_id: "scenario_demo",
          seed: 42,
          status: "active"
        };
        return createAdoptedFormalBoundRun({
          run,
          round: {
            tenant_id: scope.tenant_id,
            run_id: runId,
            round_id: `round_${runId}`,
            round_no: 1,
            status: "draft"
          },
          adoption: adoptionReference(adopted),
          withAdmissionGuard: (operation) => service.withEvidenceAdmission(actor, scope, operation),
          admission: {
            ...base,
            now,
            parameter_set: parameter,
            model: service.modelCatalog[0],
            qualification_record: record,
            calibration_dataset: record.calibration_datasets.find(
              (d) => d.calibration_dataset_id === q.calibration_dataset_id
            )!,
            admission: {
              ...base.admission,
              qualification_id: q.qualification_id,
              calibration_dataset_id: q.calibration_dataset_id,
              source_package_id: q.source_package_id,
              model_version_reference: q.model_version_reference,
              model_artifact_reference: q.artifact
            }
          },
          authorities,
          bindingStore,
          courseBinding: {
            engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
            parameter_set_reference: base.admission.parameter_set_reference,
            scenario_package_reference: base.admission.scenario_package_reference
          },
          persistence: {
            saveRun: repository.runs.saveRun,
            deleteRun: repository.runs.deleteRun,
            saveRound: repository.rounds.saveRound,
            deleteRound: repository.rounds.deleteRound
          }
        });
      }
      const a = adopt(chain.qualificationA, "epoch_a", null);
      const snapshotA = await createRun(chain.qualificationA, a, "run_adoption_a");
      const original = JSON.stringify(snapshotA);
      const privateRunA = store.runs.find((run) => run.run_id === snapshotA.run_id)!;
      const publicRunA = (await repository.runs.getRun(scope.tenant_id, snapshotA.run_id))!;
      const exactBindingA = bindingStore.getForRun(scope.tenant_id, snapshotA.run_id)!;
      const resolutionWithGovernance = await resolveFormalRuntimeInputsForActiveRun({
        authorities,
        binding: exactBindingA,
        run: privateRunA
      });
      const resolutionWithoutGovernance = await resolveFormalRuntimeInputsForActiveRun({
        authorities,
        binding: exactBindingA,
        run: publicRunA
      });
      expect(resolutionWithGovernance).toEqual(resolutionWithoutGovernance);
      expect(JSON.stringify(resolutionWithGovernance)).not.toContain(
        snapshotA.admission.adoption.adoption_id
      );
      expect(resolutionWithGovernance.formal_resolution_digest).toBe(
        resolutionWithoutGovernance.formal_resolution_digest
      );
      const bindingA = JSON.stringify(bindingStore.getForRun(scope.tenant_id, snapshotA.run_id));
      const b = adopt(chain.qualificationB, "epoch_b", a);
      const before = [
        store.runs.length,
        store.rounds.length,
        store.formalRunRuntimeBindings.length
      ];
      await expect(createRun(chain.qualificationA, a, "run_stale_a")).rejects.toThrow(
        "EVIDENCE_ADOPTION_NOT_CURRENT"
      );
      expect([
        store.runs.length,
        store.rounds.length,
        store.formalRunRuntimeBindings.length
      ]).toEqual(before);
      const snapshotB = await createRun(chain.qualificationB, b, "run_adoption_b");
      expect(snapshotB.admission.adoption).toEqual(adoptionReference(b));
      expect(snapshotB.admission.source_package_id).toBe(chain.sourceB.source_package_id);
      expect(snapshotA.admission.source_package_id).toBe(chain.sourceA.source_package_id);
      expect(JSON.stringify(bindingStore.getForRun(scope.tenant_id, snapshotA.run_id))).toBe(
        bindingA
      );
      expect(bindingStore.getForRun(scope.tenant_id, snapshotB.run_id)).not.toHaveProperty(
        "adoption"
      );
      now = "2026-09-05T00:00:00.000Z";
      const reloaded = createP1Store({ persistenceFile });
      const loadedService = new ModelQualificationService(
        { now: () => now },
        createJsonModelQualificationPersistence(reloaded)
      );
      const loadedRepository = createJsonRepositoryPorts(reloaded);
      const saved = (await loadedRepository.runs.getQualifiedRunAdmission(
        scope.tenant_id,
        snapshotA.run_id
      ))!;
      expect(JSON.stringify(loadedService.resolveHistoricalAdmission(actor, scope, saved))).toBe(
        original
      );
      expect(
        loadedService.getStudentProjection(
          { ...actor, role: "student" },
          scope,
          chain.qualificationA.qualification_id
        ).adoption?.applicability
      ).toBe("HISTORICAL_ONLY");
      expect(
        loadedService.getStudentProjection(
          { ...actor, role: "student" },
          scope,
          chain.qualificationB.qualification_id
        ).adoption?.applicability
      ).toBe("ADOPTED_FOR_FUTURE_ADMISSION");
      expect(
        await loadedRepository.runs.getRun(scope.tenant_id, snapshotA.run_id)
      ).not.toHaveProperty("qualified_admission_snapshot");
      expect(() =>
        loadedService.resolveHistoricalAdmission(
          { ...actor, tenant_id: "tenant_wrong" },
          scope,
          saved
        )
      ).toThrow("MODEL_QUALIFICATION_SCOPE_CONFLICT");
      expect(loadedService.getEvidenceAdoptionState(actor, scope).records).toHaveLength(2);
    } finally {
      rmSync(directory, { recursive: true });
    }
  });
});
