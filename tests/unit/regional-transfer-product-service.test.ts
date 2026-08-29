import { describe, expect, it } from "vitest";
import { buildM4PortabilityCompatibilityPack } from "@simwar/sh-next-support";
import {
  RegionalTransferProductService,
  createInMemoryRegionalTransferCandidatePersistence,
  type RegionalTransferSourcePort
} from "../../services/api/src/regional-transfer-product-service.js";

const tenantId = "tenant_demo";
const m4 = buildM4PortabilityCompatibilityPack();
const baseline = m4.compiled_packages.find((item) => item.package_role === "ANCHOR")!;
const target = m4.compiled_packages.find((item) => item.package_role === "SECOND_CITY")!;
const input = () => ({
  baseline_package_reference: {
    digest: baseline.package_digest,
    package_id: baseline.package_id,
    version: baseline.version
  },
  baseline_region: baseline.display_name,
  course_blueprint_reference: {
    content_digest: "a".repeat(64),
    course_blueprint_id: "blueprint_rt_001",
    tenant_id: tenantId,
    version: "1.0.0"
  },
  course_id: "course_rt_001",
  parameter_set_reference: {
    content_digest: "b".repeat(64),
    parameter_set_id: "parameter_rt_001",
    version: "1.0.0"
  },
  round_no: 1,
  run_id: "run_rt_001",
  scenario_package_reference: {
    content_digest: "c".repeat(64),
    scenario_package_id: "scenario_rt_001",
    tenant_id: tenantId,
    version: "1.0.0"
  },
  target_package_reference: {
    digest: target.package_digest,
    package_id: target.package_id,
    version: target.version
  },
  target_region: target.display_name
});

function sources(): RegionalTransferSourcePort {
  return {
    getCourse: async () => ({ course_id: "course_rt_001", tenant_id: tenantId }),
    getRun: async () => ({
      course_id: "course_rt_001",
      parameter_set_id: "parameter_rt_001",
      run_id: "run_rt_001",
      scenario_package_id: "scenario_rt_001",
      tenant_id: tenantId
    }),
    getRound: async () => ({
      round_id: "round_rt_001",
      round_no: 1,
      run_id: "run_rt_001",
      tenant_id: tenantId
    }),
    getScenario: async () => ({
      parameter_set_reference: {
        content_digest: "b".repeat(64),
        parameter_set_id: "parameter_rt_001",
        version: "1.0.0"
      },
      reference: {
        content_digest: "c".repeat(64),
        scenario_package_id: "scenario_rt_001",
        tenant_id: tenantId,
        version: "1.0.0"
      },
      status: "APPROVED"
    }),
    getParameterSet: async () => ({
      model_version_ref: "eldercare_w5_governed_v1@1.1.0",
      reference: {
        content_digest: "b".repeat(64),
        parameter_set_id: "parameter_rt_001",
        version: "1.0.0"
      },
      status: "APPROVED"
    }),
    getCourseBlueprint: async () => ({
      reference: {
        content_digest: "a".repeat(64),
        course_blueprint_id: "blueprint_rt_001",
        tenant_id: tenantId,
        version: "1.0.0"
      },
      status: "APPROVED"
    }),
    listTeams: async () => [
      { course_id: "course_rt_001", team_id: "team_alpha", tenant_id: tenantId },
      { course_id: "course_rt_001", team_id: "team_beta", tenant_id: tenantId }
    ]
  };
}

function service() {
  return new RegionalTransferProductService({
    now: () => "2026-08-29T12:00:00.000Z",
    persistence: createInMemoryRegionalTransferCandidatePersistence(),
    sources: sources()
  });
}

describe("RegionalTransferProductService", () => {
  it("composes, validates, freezes and activates one exact candidate without formal truth writes", async () => {
    const product = service();
    const actor = { actor_id: "usr_teacher", tenant_id: tenantId };
    const preview = await product.preview(actor, input());

    expect(preview.lifecycle).toBe("PREVIEWED");
    expect(preview.qualification.status).toBe("READY_WITH_LIMITS");
    expect(preview.consumer_scope).toEqual({
      minimum_team_count: 2,
      run_id: "run_rt_001",
      status: "SHARED_GOVERNED_SCENARIO",
      team_ids: ["team_alpha", "team_beta"]
    });
    expect(preview.authority).toMatchObject({
      formal_writer_mutations: 0,
      official_truth_write: false,
      provider: "OFF",
      runtime_authority: "JSON_INTERNAL_ONLY"
    });

    const validated = await product.validate(actor, input());
    expect(validated.lifecycle).toBe("VALIDATED");
    const frozen = await product.freeze(actor, input());
    expect(frozen.lifecycle).toBe("FROZEN");

    await expect(product.student(actor, frozen.candidate_ref.candidate_id)).rejects.toMatchObject({
      code: "RT_NOT_PUBLISHED"
    });

    const activated = await product.bind(actor, frozen.candidate_ref.candidate_id);
    expect(activated.lifecycle).toBe("ACTIVATED");
    expect(activated.activation.published).toBe(true);
    expect(activated.authority.official_truth_write).toBe(false);

    const student = await product.student(
      { actor_id: "usr_student", tenant_id: tenantId, team_id: "team_alpha" },
      frozen.candidate_ref.candidate_id
    );
    expect(student.visibility).toBe("ROLE_SAFE_STUDENT");
    expect(JSON.stringify(student)).not.toContain("content_digest");
    expect(JSON.stringify(student)).not.toContain("source_revision");

    const admin = await product.admin(
      { actor_id: "usr_admin", tenant_id: tenantId },
      frozen.candidate_ref.candidate_id
    );
    expect(admin.audit.lifecycle).toEqual(["PREVIEWED", "VALIDATED", "FROZEN", "ACTIVATED"]);
    expect(admin.rollback.version_guard).toBe("EXACT_VERSION_REQUIRED");
  });

  it("fails closed for tenant scope, implicit latest and mismatched run references", async () => {
    const product = service();
    const actor = { actor_id: "usr_teacher", tenant_id: tenantId };
    await expect(
      product.preview(actor, { ...input(), target_region: "latest" })
    ).rejects.toMatchObject({
      code: "RT_EXACT_VERSION_REQUIRED"
    });
    await expect(
      product.preview(actor, {
        ...input(),
        scenario_package_reference: {
          ...input().scenario_package_reference,
          tenant_id: "tenant_other"
        }
      })
    ).rejects.toMatchObject({ code: "RT_SCOPE_CONFLICT" });
    await expect(product.preview(actor, { ...input(), run_id: "run_other" })).rejects.toMatchObject(
      { code: "RT_EXACT_BINDING_REQUIRED" }
    );
  });

  it("fails closed when a governed scenario has fewer than two tenant-safe consumers", async () => {
    const product = new RegionalTransferProductService({
      now: () => "2026-08-29T12:00:00.000Z",
      persistence: createInMemoryRegionalTransferCandidatePersistence(),
      sources: {
        ...sources(),
        listTeams: async () => [
          { course_id: "course_rt_001", team_id: "team_alpha", tenant_id: tenantId },
          { course_id: "course_other", team_id: "team_other", tenant_id: tenantId },
          { course_id: "course_rt_001", team_id: "team_cross_tenant", tenant_id: "tenant_other" }
        ]
      }
    });
    await expect(
      product.preview({ actor_id: "usr_teacher", tenant_id: tenantId }, input())
    ).rejects.toMatchObject({
      code: "RT_MULTI_TEAM_CONSUMPTION_REQUIRED"
    });
  });
});
