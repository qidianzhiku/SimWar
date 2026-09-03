import { describe, expect, it } from "vitest";
import type {
  ModelQualification,
  EvidenceAdoptionRecord,
  ValidationEnvironmentLaunch
} from "@simwar/shared-contracts";
import { createP1Store } from "../../services/api/src/store";
import {
  createJsonRepositoryPorts,
  createJsonModelQualificationPersistence
} from "../../services/api/src/json-repository-adapter";
import { ModelQualificationService } from "../../services/api/src/model-qualification-service";
import { FormalRunRuntimeBindingStore } from "../../services/api/src/formal-run-runtime-binding-store";
import { FormalCourseAuthorityBindingStore } from "../../services/api/src/formal-course-authority-binding-store";
import {
  createW025LaunchExecutor,
  type W025LaunchExecutorDependencies
} from "../../services/api/src/w025-launch-executor";
import type { ValidationEnvironmentLaunchInput } from "../../services/api/src/validation-environment-launch";
import { seedO5FormalCourse } from "../helpers/model-qualification-o5-product-fixture";
import {
  EVIDENCE_ADOPTION_SCOPE as scope,
  EVIDENCE_ADOPTION_TEACHER as actor,
  seedApprovedBoundChain,
  adoptionReference
} from "../helpers/model-qualification-evidence-adoption-fixtures";

async function harness() {
  const store = createP1Store();
  const fixture = await seedO5FormalCourse(store);
  const repository = createJsonRepositoryPorts(store);
  let now = "2026-09-03T12:00:00.000Z";
  const service = new ModelQualificationService(
    { now: () => now },
    createJsonModelQualificationPersistence(store)
  );
  const chain = seedApprovedBoundChain(service, scope, actor);
  const courseBindings = new FormalCourseAuthorityBindingStore(store);
  const runBindings = new FormalRunRuntimeBindingStore(store);
  // Only prepareCourseRun is under test; unrelated durable/cohort/session steps are not activated.
  const dependencies = {
    actor: { user_id: "usr_teacher", tenant_id: scope.tenant_id, roles: ["teacher"] },
    requestId: "o5-w025-unit",
    repositoryProvider: { facade: repository },
    formalRunBindingAuthorities: fixture.authorities,
    coursePackageQueries: fixture.coursePackageQueries,
    modelQualification: service,
    formalCourseAuthorityBindingStore: courseBindings,
    formalRunRuntimeBindingStore: runBindings
  } as unknown as W025LaunchExecutorDependencies;
  const executor = createW025LaunchExecutor(dependencies);
  function adopt(q: ModelQualification, id: string, previous: EvidenceAdoptionRecord | null) {
    const proposal = service.requestEvidenceAdoption(actor, scope, {
      command_id: `${id}:request`,
      qualification_id: q.qualification_id,
      expected_adoption: previous ? adoptionReference(previous) : null
    }).proposal;
    const review = service.reviewEvidenceAdoption(actor, scope, {
      command_id: `${id}:review`,
      proposal_id: proposal.proposal_id,
      proposal_digest: proposal.proposal_digest,
      decision: "APPROVED",
      note: "Exact synthetic review"
    }).review;
    const record = service.disposeEvidenceAdoption(actor, scope, {
      command_id: `${id}:dispose`,
      proposal_id: proposal.proposal_id,
      proposal_digest: proposal.proposal_digest,
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
      expires_at: null,
      note: "Explicit future adoption"
    }).adoption;
    expect(record.review_id).toBe(review.review_id);
    expect(record.predecessor).toEqual(previous ? adoptionReference(previous) : null);
    return record;
  }
  const input = (q: ModelQualification, adopted: EvidenceAdoptionRecord) =>
    ({
      target_tenant_id: scope.tenant_id,
      seed: 42,
      course_package_reference: fixture.course_package_reference,
      course_blueprint_reference: fixture.coursePackage.course_blueprint_reference,
      qualified_run_admission: {
        course_id: scope.course_id,
        course_package_reference: fixture.course_package_reference,
        source_package_id: q.source_package_id,
        calibration_dataset_id: q.calibration_dataset_id,
        qualification_id: q.qualification_id,
        model_version_reference: q.model_version_reference,
        model_artifact_reference: q.artifact,
        adoption: adoptionReference(adopted)
      }
    }) as ValidationEnvironmentLaunchInput;
  const launch = (launch_id: string) => ({ launch_id }) as ValidationEnvironmentLaunch;
  const writes = () =>
    JSON.stringify({
      runs: store.runs,
      rounds: store.rounds,
      courseBindings: store.formalCourseAuthorityBindings,
      runBindings: store.formalRunRuntimeBindings
    });
  return {
    store,
    fixture,
    service,
    chain,
    courseBindings,
    executor,
    adopt,
    input,
    launch,
    writes,
    setNow: (value: string) => {
      now = value;
    }
  };
}

describe("O5 W025 existing executor, without durable runtime activation", () => {
  it.each([false, true])(
    "leaves no partial formal state if Course finalization fails (consumed token: %s)",
    async (consume) => {
      const h = await harness();
      const a = h.adopt(h.chain.qualificationA, "a-finalization", null);
      const before = h.writes();
      const originalCourse = structuredClone(h.store.courses);
      const original = h.courseBindings.commitPending.bind(h.courseBindings);
      h.courseBindings.commitPending = (pending) => {
        if (consume) original(pending);
        throw new Error("injected-course-finalization-failure");
      };
      await expect(
        h.executor.prepareCourseRun(
          h.input(h.chain.qualificationA, a),
          h.launch("launch-finalize-fail")
        )
      ).rejects.toThrow();
      expect(h.writes()).toBe(before);
      expect(h.store.courses).toEqual(originalCourse);
    }
  );
  it("new launch consumes explicit B while retry of an existing A launch preserves original A", async () => {
    const h = await harness();
    const a = h.adopt(h.chain.qualificationA, "a", null);
    const first = await h.executor.prepareCourseRun(
      h.input(h.chain.qualificationA, a),
      h.launch("launch-epoch-a")
    );
    expect(first.qualified_run_admission_receipt).toMatchObject({
      adoption: adoptionReference(a),
      schema_version: "qualified-run-admission.v2"
    });
    const b = h.adopt(h.chain.qualificationB, "b", a);
    const before = h.writes();
    await expect(
      h.executor.prepareCourseRun(h.input(h.chain.qualificationA, a), h.launch("launch-stale-a"))
    ).rejects.toThrow("EVIDENCE_ADOPTION_NOT_CURRENT");
    expect(h.writes()).toBe(before);
    const next = await h.executor.prepareCourseRun(
      h.input(h.chain.qualificationB, b),
      h.launch("launch-epoch-b")
    );
    expect(next.qualified_run_admission_receipt).toMatchObject({ adoption: adoptionReference(b) });
    h.setNow("2026-09-05T00:00:00.000Z");
    const beforeRetry = h.writes();
    const retry = await h.executor.prepareCourseRun(
      h.input(h.chain.qualificationA, a),
      h.launch("launch-epoch-a")
    );
    expect(retry.qualified_run_admission_receipt).toEqual(first.qualified_run_admission_receipt);
    expect(h.writes()).toBe(beforeRetry);
    await expect(
      h.executor.prepareCourseRun(h.input(h.chain.qualificationB, b), h.launch("launch-epoch-a"))
    ).rejects.toThrow("HISTORICAL_REFERENCE_UNAVAILABLE");
    expect(h.writes()).toBe(beforeRetry);
  });

  it("does not retain partial Course binding when evidence expires during asynchronous binding preparation", async () => {
    const h = await harness();
    const a = h.adopt(h.chain.qualificationA, "a-expiry", null);
    const before = h.writes();
    const original = h.courseBindings.append.bind(h.courseBindings);
    h.courseBindings.append = (binding) => {
      original(binding);
      h.setNow("2026-09-05T00:00:00.000Z");
    };
    const originalPending = h.courseBindings.appendPending.bind(h.courseBindings);
    h.courseBindings.appendPending = (binding, options) => {
      const token = originalPending(binding, options);
      h.setNow("2026-09-05T00:00:00.000Z");
      return token;
    };
    await expect(
      h.executor.prepareCourseRun(h.input(h.chain.qualificationA, a), h.launch("launch-expired"))
    ).rejects.toThrow("QUALIFIED_RUN_ADMISSION_SOURCE_EXPIRED");
    expect(h.writes()).toBe(before);
  });
});
