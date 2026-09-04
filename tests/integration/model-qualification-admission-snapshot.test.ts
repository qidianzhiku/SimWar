import { describe, expect, it } from "vitest";
import { createJsonRepositoryPorts } from "../../services/api/src/json-repository-adapter";
import { createP1Store } from "../../services/api/src/store";
import type { Run } from "@simwar/shared-contracts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createQualifiedRunAdmissionFixture } from "../helpers/model-qualification-run-admission-fixtures";
import { resolveQualifiedRunAdmission } from "../../services/api/src/model-qualification-run-admission";
import { createQualifiedRunAdmissionSnapshot } from "../../services/api/src/qualified-run-admission-snapshot";
import * as formalRunCreation from "../../services/api/src/formal-bound-run-creation-service";
import { ModelQualificationService } from "../../services/api/src/model-qualification-service";

const run: Run = {
  run_id: "run_o5_history",
  tenant_id: "tenant_demo",
  course_id: "course_demo",
  scenario_package_id: "scenario_demo",
  parameter_set_id: "parameter_demo",
  seed: 42,
  status: "active"
};

function snapshotFor(target: Run, suffix: "a" | "b") {
  const fixture = createQualifiedRunAdmissionFixture();
  const receipt = resolveQualifiedRunAdmission(fixture);
  const source = fixture.qualification_record!.source_packages[0]!;
  const dataset = fixture.calibration_dataset!;
  return createQualifiedRunAdmissionSnapshot(target, {
    ...receipt,
    schema_version: "qualified-run-admission.v2",
    admitted_at: fixture.now,
    adoption: { adoption_id: `adoption_${suffix}`, adoption_digest: suffix.repeat(64) },
    evidence_epoch: {
      tenant_id: target.tenant_id,
      course_id: target.course_id,
      source_package_id: receipt.source_package_id,
      source_content_digest: source.content_digest,
      calibration_dataset_id: receipt.calibration_dataset_id,
      calibration_dataset_content_digest: dataset.content_digest,
      qualification_id: receipt.qualification_id,
      qualification_content_digest: receipt.qualification_content_digest,
      model_version_reference: receipt.model_version_reference,
      model_artifact_reference: receipt.model_artifact_reference,
      source_expires_at: source.expires_at,
      epoch_digest: suffix.repeat(64)
    }
  });
}

describe("O5 existing Run payload historical carrier", () => {
  it("denies Student access to the private adoption state before a scoped lookup", () => {
    const service = new ModelQualificationService({
      listRecords: () => [],
      commitRecord: () => undefined
    });
    expect(() =>
      service.getEvidenceAdoptionState(
        { actor_id: "student", role: "student", tenant_id: run.tenant_id },
        {
          tenant_id: run.tenant_id,
          course_id: run.course_id,
          activity_id: "model-qualification-studio"
        }
      )
    ).toThrow("EVIDENCE_ADOPTION_ROLE_DENIED");
  });
  it("requires an explicit adoption identity before an O5 Run can be written", async () => {
    const saved: unknown[] = [];
    await expect(
      formalRunCreation.createAdoptedFormalBoundRun({
        admission: createQualifiedRunAdmissionFixture(),
        run,
        persistence: {
          saveRun: async (value: unknown) => {
            saved.push(value);
          }
        }
      } as never)
    ).rejects.toThrow("QUALIFIED_RUN_ADMISSION_ADOPTION_REQUIRED");
    expect(saved).toEqual([]);
  });
  it("never silently drops a supplied qualification admission snapshot", async () => {
    const store = createP1Store();
    const repository = createJsonRepositoryPorts(store);
    // Invalid snapshots must fail closed, never become an unqualified Run.
    await expect(repository.runs.saveRun(run, {} as never)).rejects.toThrow();
    expect(await repository.runs.getRun(run.tenant_id, run.run_id)).toBeNull();
  });

  it("keeps private admission A immutable across updates, reload, and creation of B", async () => {
    const dir = mkdtempSync(join(tmpdir(), "simwar-o5-run-history-"));
    try {
      const path = join(dir, "snapshot.json");
      const store = createP1Store({ persistenceFile: path });
      const repository = createJsonRepositoryPorts(store);
      const a = snapshotFor(run, "a");
      const original = JSON.stringify(a);
      await repository.runs.saveRun(run, a);
      await repository.runs.saveRun({ ...run, status: "completed" });
      expect(await repository.runs.getRun(run.tenant_id, run.run_id)).not.toHaveProperty(
        "qualified_admission_snapshot"
      );
      expect(
        await repository.runs.listRunsForCourse(run.tenant_id, run.course_id)
      ).not.toContainEqual(
        expect.objectContaining({ qualified_admission_snapshot: expect.anything() })
      );
      await expect(repository.runs.saveRun(run, snapshotFor(run, "b"))).rejects.toThrow(
        "HISTORY_IMMUTABLE"
      );
      const nextRun = { ...run, run_id: "run_o5_next" };
      await repository.runs.saveRun(nextRun, snapshotFor(nextRun, "b"));
      const reloaded = createJsonRepositoryPorts(createP1Store({ persistenceFile: path }));
      expect(
        JSON.stringify(await reloaded.runs.getQualifiedRunAdmission(run.tenant_id, run.run_id))
      ).toBe(original);
      expect(
        (await reloaded.runs.getQualifiedRunAdmission(nextRun.tenant_id, nextRun.run_id))?.admission
          .adoption.adoption_id
      ).toBe("adoption_b");
      expect(await reloaded.runs.getQualifiedRunAdmission("wrong_tenant", run.run_id)).toBeNull();
      const readback = (await reloaded.runs.getQualifiedRunAdmission(run.tenant_id, run.run_id))!;
      (readback as { run_id: string }).run_id = "forged";
      expect(
        (await reloaded.runs.getQualifiedRunAdmission(run.tenant_id, run.run_id))?.run_id
      ).toBe(run.run_id);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("does not backfill a legacy Run or rewrite its original v1 receipt", async () => {
    const repository = createJsonRepositoryPorts(createP1Store());
    const oldReceipt = resolveQualifiedRunAdmission(createQualifiedRunAdmissionFixture());
    const before = JSON.stringify(oldReceipt);
    await repository.runs.saveRun(run);
    await expect(repository.runs.saveRun(run, snapshotFor(run, "a"))).rejects.toThrow(
      "QUALIFIED_RUN_ADMISSION_HISTORY_IMMUTABLE"
    );
    expect(await repository.runs.getQualifiedRunAdmission(run.tenant_id, run.run_id)).toBeNull();
    expect(JSON.stringify(oldReceipt)).toBe(before);
    expect(oldReceipt).not.toHaveProperty("adoption");
    expect(oldReceipt).not.toHaveProperty("schema_version");
  });
});
