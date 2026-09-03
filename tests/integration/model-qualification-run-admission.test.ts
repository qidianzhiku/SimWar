import { describe, expect, it, vi } from "vitest";
import { createQualifiedFormalBoundRun } from "../../services/api/src/formal-bound-run-creation-service";
import {
  createFormalRunAuthorityFixture,
  createQualifiedRunAdmissionFixture
} from "../helpers/model-qualification-run-admission-fixtures";

describe("qualified Run admission integration boundary", () => {
  it("does not persist Run, Round, or binding when qualification admission fails", async () => {
    const fixture = createQualifiedRunAdmissionFixture();
    fixture.admission.qualification_id = "qualification_missing";
    const calls: string[] = [];
    const binding = {
      binding_digest: "d".repeat(64),
      binding_schema_version: "formal-course-authority-binding.v1" as const,
      course_id: "course_demo",
      engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
      parameter_set_reference: fixture.admission.parameter_set_reference,
      scenario_package_reference: fixture.admission.scenario_package_reference,
      tenant_id: "tenant_demo"
    };
    await expect(
      createQualifiedFormalBoundRun({
        admission: fixture,
        authorities: createFormalRunAuthorityFixture(),
        bindingStore: { append: vi.fn(async () => calls.push("binding")) },
        courseBinding: binding,
        persistence: {
          deleteRound: vi.fn(async () => calls.push("delete-round")),
          deleteRun: vi.fn(async () => calls.push("delete-run")),
          saveRound: vi.fn(async () => calls.push("round")),
          saveRun: vi.fn(async () => calls.push("run"))
        },
        round: {
          round_id: "round_demo",
          round_no: 1,
          run_id: "run_demo",
          status: "draft",
          tenant_id: "tenant_demo"
        },
        run: {
          course_id: "course_demo",
          parameter_set_id: "parameter_demo",
          run_id: "run_demo",
          scenario_package_id: "scenario_demo",
          seed: 42,
          status: "active",
          tenant_id: "tenant_demo"
        }
      })
    ).rejects.toThrow("QUALIFIED_RUN_ADMISSION_QUALIFICATION_NOT_FOUND");
    expect(calls).toEqual([]);
  });
});
