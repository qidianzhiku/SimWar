import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { buildM4PortabilityCompatibilityPack } from "@simwar/sh-next-support";
import {
  RegionalTransferProductService,
  createInMemoryRegionalTransferCandidatePersistence,
  type RegionalTransferSourcePort
} from "../../services/api/src/regional-transfer-product-service.js";

const tenantId = "tenant_demo";
const m4 = buildM4PortabilityCompatibilityPack();
const validateCandidate = new Ajv2020({ allErrors: true, strict: true }).compile(
  JSON.parse(readFileSync("contracts/schemas/regional-transfer.v1.json", "utf8"))
);

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function contentDigest(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}
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
    expect(preview.operation_id).toBe("REGIONAL_TRANSFER_PREVIEW_V1");
    expect(preview.qualification.status).toBe("READY_WITH_LIMITS");
    expect(preview.requalification).toMatchObject({
      status: "REQUALIFICATION_REQUIRED",
      transfer_mode: "CANDIDATE_ONLY",
      model_version_comparison: {
        status: "EXACT_MATCH",
        baseline_model_version_ref: "eldercare_w5_governed_v1@1.1.0",
        target_model_version_ref: "eldercare_w5_governed_v1@1.1.0"
      },
      baseline: {
        region: "Shanghai",
        model_version_ref: "eldercare_w5_governed_v1@1.1.0",
        source: {
          rights_status: "PUBLIC_SAFE",
          freshness_status: "UNKNOWN",
          evidence_status: "NOT_RETRIEVED",
          content_digest: null,
          source_version: null
        },
        reality_gap: { status: "NOT_PROVEN", value: null },
        ood: { status: "NOT_PROVEN", rate: null }
      },
      target: {
        region: "Suzhou",
        model_version_ref: "eldercare_w5_governed_v1@1.1.0",
        source: {
          source_id: "REGIONAL_TRANSFER_TARGET_SOURCE_NOT_RETRIEVED",
          rights_status: "UNKNOWN",
          freshness_status: "UNKNOWN",
          evidence_status: "NOT_RETRIEVED",
          content_digest: null,
          source_version: null
        },
        reality_gap: { status: "NOT_PROVEN", value: null },
        ood: { status: "NOT_PROVEN", rate: null }
      }
    });
    expect(preview.requalification.reason_codes).toEqual([
      "TARGET_SOURCE_NOT_RETRIEVED",
      "SOURCE_FRESHNESS_UNKNOWN",
      "TARGET_RIGHTS_UNKNOWN",
      "REALITY_GAP_NOT_PROVEN",
      "OOD_NOT_PROVEN",
      "CALIBRATION_NOT_ELIGIBLE"
    ]);
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
    expect(validated.operation_id).toBe("REGIONAL_TRANSFER_VALIDATE_V1");
    const frozen = await product.freeze(actor, input());
    expect(frozen.lifecycle).toBe("FROZEN");
    expect(validateCandidate(frozen)).toBe(true);

    await expect(product.student(actor, frozen.candidate_ref.candidate_id)).rejects.toMatchObject({
      code: "RT_NOT_PUBLISHED"
    });

    const activated = await product.bind(actor, frozen.candidate_ref.candidate_id);
    expect(activated.lifecycle).toBe("ACTIVATED");
    expect(activated.activation.published).toBe(true);
    expect(activated.authority.official_truth_write).toBe(false);
    expect(await product.bind(actor, frozen.candidate_ref.candidate_id)).toEqual(activated);

    const listed = await product.list(actor);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.operation_id).toBe("REGIONAL_TRANSFER_TEACHER_LIST_V1");

    const student = await product.student(
      { actor_id: "usr_student", tenant_id: tenantId, team_id: "team_alpha" },
      frozen.candidate_ref.candidate_id
    );
    expect(student.visibility).toBe("ROLE_SAFE_STUDENT");
    expect(student.requalification).toEqual({
      status: "REQUALIFICATION_REQUIRED",
      transfer_mode: "CANDIDATE_ONLY"
    });
    expect(JSON.stringify(student)).not.toContain("content_digest");
    expect(JSON.stringify(student)).not.toContain("source_revision");
    expect(JSON.stringify(student)).not.toContain("model_version_ref");

    const admin = await product.admin(
      { actor_id: "usr_admin", tenant_id: tenantId },
      frozen.candidate_ref.candidate_id
    );
    expect(admin.audit.lifecycle).toEqual(["PREVIEWED", "VALIDATED", "FROZEN", "ACTIVATED"]);
    expect(admin.rollback.version_guard).toBe("EXACT_VERSION_REQUIRED");
  });

  it("requires recorded preview and validation states before freezing", async () => {
    const actor = { actor_id: "usr_teacher", tenant_id: tenantId };
    const directFreeze = service();

    await expect(directFreeze.freeze(actor, input())).rejects.toMatchObject({
      code: "RT_INVALID_TRANSITION"
    });

    const missingValidation = service();
    await missingValidation.preview(actor, input());
    await expect(missingValidation.freeze(actor, input())).rejects.toMatchObject({
      code: "RT_INVALID_TRANSITION"
    });
  });

  it("revalidates exact authorities immediately before first activation", async () => {
    let scenarioBindable = true;
    const sourcePort = sources();
    const getScenario = sourcePort.getScenario;
    sourcePort.getScenario = async (requestedTenantId, reference) =>
      scenarioBindable ? getScenario(requestedTenantId, reference) : null;
    const product = new RegionalTransferProductService({
      now: () => "2026-08-29T12:00:00.000Z",
      persistence: createInMemoryRegionalTransferCandidatePersistence(),
      sources: sourcePort
    });
    const actor = { actor_id: "usr_teacher", tenant_id: tenantId };

    await product.preview(actor, input());
    await product.validate(actor, input());
    const frozen = await product.freeze(actor, input());
    scenarioBindable = false;

    await expect(product.bind(actor, frozen.candidate_ref.candidate_id)).rejects.toMatchObject({
      code: "RT_SOURCE_NOT_BINDABLE"
    });
  });

  it("rebuilds mutable candidate metadata from exact sources before activation", async () => {
    const persistence = createInMemoryRegionalTransferCandidatePersistence();
    const product = new RegionalTransferProductService({
      now: () => "2026-08-29T12:00:00.000Z",
      persistence,
      sources: sources()
    });
    const actor = { actor_id: "usr_teacher", tenant_id: tenantId };

    await product.preview(actor, input());
    await product.validate(actor, input());
    const frozen = await product.freeze(actor, input());
    const tampered = structuredClone(frozen);
    tampered.requalification.status = "TRANSFER_READY_WITH_LIMITS";
    tampered.known_limits = ["tampered-limit"];
    await persistence.save(tampered);

    const activated = await product.bind(actor, frozen.candidate_ref.candidate_id);

    expect(activated.requalification.status).toBe("REQUALIFICATION_REQUIRED");
    expect(activated.known_limits).toEqual(expect.not.arrayContaining(["tampered-limit"]));
  });

  it("activates a pre-requalification frozen candidate after exact current-source revalidation", async () => {
    const persistence = createInMemoryRegionalTransferCandidatePersistence();
    const product = new RegionalTransferProductService({
      now: () => "2026-08-29T12:00:00.000Z",
      persistence,
      sources: sources()
    });
    const actor = { actor_id: "usr_teacher", tenant_id: tenantId };

    await product.preview(actor, input());
    await product.validate(actor, input());
    const currentFrozen = await product.freeze(actor, input());
    const legacyDigest = contentDigest({
      baseline: currentFrozen.baseline.package_reference,
      baseline_region: currentFrozen.baseline.region,
      course_blueprint_reference: currentFrozen.formal_references.course_blueprint_reference,
      course_id: currentFrozen.scope.course_id,
      parameter_set_reference: currentFrozen.formal_references.parameter_set_reference,
      round_no: currentFrozen.scope.round_no,
      run_id: currentFrozen.scope.run_id,
      scenario_package_reference: currentFrozen.formal_references.scenario_package_reference,
      target: currentFrozen.target.package_reference,
      target_region: currentFrozen.target.region,
      consumer_team_ids: [...currentFrozen.consumer_scope.team_ids]
    });
    const legacyFrozen = structuredClone(currentFrozen);
    legacyFrozen.candidate_ref = {
      ...legacyFrozen.candidate_ref,
      candidate_id: `rt_candidate_${legacyDigest.slice(0, 16)}`,
      content_digest: legacyDigest
    };
    delete (legacyFrozen as unknown as { requalification?: unknown }).requalification;

    const forgedFrozen = structuredClone(legacyFrozen);
    forgedFrozen.candidate_ref = {
      ...forgedFrozen.candidate_ref,
      candidate_id: `rt_candidate_${"f".repeat(16)}`,
      content_digest: "f".repeat(64)
    };
    await persistence.save(forgedFrozen);
    await expect(
      product.bind(actor, forgedFrozen.candidate_ref.candidate_id)
    ).rejects.toMatchObject({ code: "RT_SOURCE_NOT_BINDABLE" });

    await persistence.save(legacyFrozen);

    const activated = await product.bind(actor, legacyFrozen.candidate_ref.candidate_id);

    expect(activated.lifecycle).toBe("ACTIVATED");
    expect(activated.candidate_ref).toEqual(legacyFrozen.candidate_ref);
    expect(activated.requalification).toMatchObject({
      status: "REQUALIFICATION_REQUIRED",
      transfer_mode: "CANDIDATE_ONLY"
    });
    expect(activated.known_limits).toContain(
      "Legacy pre-N1 candidate identity is preserved only after exact current-source revalidation."
    );
    expect(await product.bind(actor, legacyFrozen.candidate_ref.candidate_id)).toEqual(activated);
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

  it.each([
    "latest",
    "default",
    "current",
    "fallback",
    "next",
    "unresolved",
    "foo",
    "foo@1",
    "foo@1.2",
    "foo@1.2.3.4",
    "foo@01.2.3",
    "foo@1.02.3",
    "foo@1.2.03",
    "foo.v01",
    "foo@1.2.x"
  ])("fails closed for non-exact ParameterSet model reference %s", async (modelVersionRef) => {
    const product = new RegionalTransferProductService({
      now: () => "2026-08-29T12:00:00.000Z",
      persistence: createInMemoryRegionalTransferCandidatePersistence(),
      sources: {
        ...sources(),
        getParameterSet: async () => ({
          model_version_ref: modelVersionRef,
          reference: input().parameter_set_reference,
          status: "APPROVED"
        })
      }
    });
    await expect(
      product.preview({ actor_id: "usr_teacher", tenant_id: tenantId }, input())
    ).rejects.toMatchObject({ code: "RT_EXACT_VERSION_REQUIRED" });
  });

  it.each(["simulation-core.v1", "toy_logit.v1"])(
    "accepts the repository's exact ParameterSet model reference %s",
    async (modelVersionRef) => {
      const product = new RegionalTransferProductService({
        now: () => "2026-08-29T12:00:00.000Z",
        persistence: createInMemoryRegionalTransferCandidatePersistence(),
        sources: {
          ...sources(),
          getParameterSet: async () => ({
            model_version_ref: modelVersionRef,
            reference: input().parameter_set_reference,
            status: "APPROVED"
          })
        }
      });

      await expect(
        product.preview({ actor_id: "usr_teacher", tenant_id: tenantId }, input())
      ).resolves.toMatchObject({
        requalification: {
          model_version_comparison: {
            baseline_model_version_ref: modelVersionRef,
            target_model_version_ref: modelVersionRef
          }
        }
      });
    }
  );

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
