import { describe, expect, it } from "vitest";
import type { CoursePackageVersionDraftInput } from "../../packages/shared-contracts/src";
import {
  CourseFactoryError,
  CourseFactoryService,
  type CourseFactoryDraftInput,
  type CourseFactorySourcePorts
} from "../../services/api/src/course-factory";
import {
  CoursePackageCommandService,
  type CoursePackageSourceReadPorts
} from "../../services/api/src/course-package-command-service";
import {
  CoursePackageRegistryError,
  CoursePackageJsonRegistry,
  createCoursePackageDraftVersion,
  createCoursePackageVersionReference
} from "../../services/api/src/course-package-json-registry";
import {
  CoursePackageQueryService,
  isDeliveryReadyCoursePackage
} from "../../services/api/src/course-package-query-service";
import { buildM30CourseFactorySourceEvidence } from "@simwar/sh-next-support";

const tenantId = "tenant_demo";
const digest = (character: string) => character.repeat(64);

const packageDraft: CoursePackageVersionDraftInput = {
  course_blueprint_reference: {
    content_digest: digest("a"),
    course_blueprint_id: "blueprint_demo",
    tenant_id: tenantId,
    version: "1.0.0"
  },
  course_package_id: "course_factory_demo",
  description: "Governed reusable course package.",
  parameter_set_reference: {
    content_digest: digest("c"),
    parameter_set_id: "parameter_demo",
    version: "1.0.0"
  },
  scenario_package_reference: {
    content_digest: digest("b"),
    scenario_package_id: "scenario_demo",
    tenant_id: tenantId,
    version: "1.0.0"
  },
  title: "Governed course",
  version: "1.0.0"
};

const sources: CourseFactorySourcePorts = {
  courseBlueprints: {
    assertBindable: async () => undefined,
    getByReference: async () => ({
      reference: packageDraft.course_blueprint_reference,
      scenario_compatibility_constraints: { scenario_family: "demo" },
      status: "APPROVED"
    })
  },
  parameterSets: {
    assertBindable: async () => undefined,
    getByReference: async () => ({
      reference: packageDraft.parameter_set_reference,
      status: "APPROVED"
    })
  },
  scenarioPackages: {
    assertBindable: async () => undefined,
    getByReference: async () => ({
      compatibility_metadata: { scenario_family: "demo" },
      parameter_set_reference: packageDraft.parameter_set_reference,
      reference: packageDraft.scenario_package_reference,
      status: "APPROVED"
    })
  }
} as CoursePackageSourceReadPorts;

function createService() {
  const registry = new CoursePackageJsonRegistry({ now: () => "2026-08-30T10:00:00.000Z" });
  const packages = new CoursePackageCommandService(registry, sources);
  return {
    registry,
    service: new CourseFactoryService({ packageCommands: packages, packageRegistry: registry })
  };
}

function factoryDraft(overrides: Partial<CourseFactoryDraftInput> = {}): CourseFactoryDraftInput {
  return {
    ...packageDraft,
    factory_metadata: {
      known_limits: ["synthetic source only"],
      rights: {
        allowed_tenant_ids: [tenantId],
        copy_allowed: true,
        export_allowed: true,
        expires_at: "2027-08-30T00:00:00.000Z",
        owner_tenant_id: tenantId
      },
      provenance: { kind: "ORIGINAL" },
      schema_version: "course-factory.v1",
      source_manifest: {
        course_blueprint_reference: packageDraft.course_blueprint_reference,
        parameter_set_reference: packageDraft.parameter_set_reference,
        scenario_package_reference: packageDraft.scenario_package_reference
      },
      user_data_policy: {
        copied_private_data: false,
        copied_user_decisions: false,
        copied_user_results: false
      }
    },
    ...overrides
  };
}

const actor = { actor_id: "admin_demo", tenant_id: tenantId, roles: ["tenant_admin"] as const };

describe("R3 CourseFactoryService", () => {
  it("rejects unknown fields on the factory metadata container", async () => {
    const { service } = createService();
    const metadataWithUnknownField = {
      ...factoryDraft().factory_metadata,
      private_note: "must not cross the persistence boundary"
    } as CourseFactoryDraftInput["factory_metadata"];

    await expect(
      service.createDraft(
        actor,
        factoryDraft({ factory_metadata: metadataWithUnknownField })
      )
    ).rejects.toEqual(new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID"));
  });

  it("rejects source lineage on ORIGINAL drafts", async () => {
    const { service } = createService();
    await expect(
      service.createDraft(
        actor,
        factoryDraft({
          factory_metadata: {
            ...factoryDraft().factory_metadata,
            provenance: {
              kind: "ORIGINAL",
              source_course_package_reference: {
                content_digest: digest("f"),
                course_package_id: "source_course",
                tenant_id: tenantId,
                version: "1.0.0"
              }
            }
          }
        })
      )
    ).rejects.toEqual(new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID"));
  });

  it("rejects malformed factory metadata at persistence and delivery boundaries", () => {
    const malformedDraft = {
      ...packageDraft,
      factory_metadata: { schema_version: "course-factory.v1" }
    } as unknown as CoursePackageVersionDraftInput;

    expect(() =>
      createCoursePackageDraftVersion({
        actor_id: "usr_admin",
        draft: malformedDraft,
        now: "2026-08-30T10:00:00.000Z",
        tenant_id: tenantId
      })
    ).toThrow(new CoursePackageRegistryError("COURSE_PACKAGE_INPUT_INVALID"));
  });

  it("rejects ORIGINAL metadata that carries source lineage at the persistence boundary", () => {
    const originalWithLineage = {
      ...packageDraft,
      factory_metadata: {
        ...factoryDraft().factory_metadata,
        provenance: {
          kind: "ORIGINAL",
          source_course_package_reference: {
            content_digest: digest("a"),
            course_package_id: "source_course",
            tenant_id: tenantId,
            version: "1.0.0"
          }
        }
      }
    } as unknown as CoursePackageVersionDraftInput;

    expect(() =>
      createCoursePackageDraftVersion({
        actor_id: "usr_admin",
        draft: originalWithLineage,
        now: "2026-08-30T10:00:00.000Z",
        tenant_id: tenantId
      })
    ).toThrow(new CoursePackageRegistryError("COURSE_PACKAGE_INPUT_INVALID"));
  });

  it("rejects malformed factory metadata at the delivery boundary", () => {
    expect(
      isDeliveryReadyCoursePackage({
        factory_metadata: {
          schema_version: "course-factory.v1"
        },
        status: "PUBLISHED",
        tenant_id: tenantId
      })
    ).toBe(false);
  });

  it("runs one exact package through Draft, Validated, Approved and Published", async () => {
    const { registry, service } = createService();

    const draft = await service.createDraft(actor, factoryDraft());
    const reference = createCoursePackageVersionReference(draft);
    const validated = await service.validate(actor, reference);
    const approved = await service.approve(actor, reference);
    const published = await service.publish(actor, reference);

    expect([draft.status, validated.status, approved.status, published.status]).toEqual([
      "DRAFT",
      "VALIDATED",
      "APPROVED",
      "PUBLISHED"
    ]);
    expect(published.factory_metadata.user_data_policy).toEqual({
      copied_private_data: false,
      copied_user_decisions: false,
      copied_user_results: false
    });
    const teacherPackages = await new CoursePackageQueryService(registry).listTeacher(tenantId);
    expect(teacherPackages.course_package_versions).toHaveLength(1);
  });

  it("rejects impossible expiry timestamps and hides published packages after expiry", async () => {
    let now = "2026-08-30T10:00:00.000Z";
    const registry = new CoursePackageJsonRegistry({ now: () => now });
    const packages = new CoursePackageCommandService(registry, sources);
    const service = new CourseFactoryService({
      packageCommands: packages,
      packageRegistry: registry
    });

    for (const expires_at of [
      "2026-13-40T00:00:00.000Z",
      "2026-02-30T00:00:00.000Z",
      "2026-01-01T24:00:00.000Z"
    ]) {
      await expect(
        service.createDraft(
          actor,
          factoryDraft({
            factory_metadata: {
              ...factoryDraft().factory_metadata,
              rights: { ...factoryDraft().factory_metadata.rights, expires_at }
            }
          })
        )
      ).rejects.toEqual(new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID"));
    }

    const draft = await service.createDraft(
      actor,
      factoryDraft({
        factory_metadata: {
          ...factoryDraft().factory_metadata,
          rights: {
            ...factoryDraft().factory_metadata.rights,
            expires_at: "2026-08-31T00:00:00.000Z"
          }
        }
      })
    );
    const reference = createCoursePackageVersionReference(draft);
    await service.validate(actor, reference);
    await service.approve(actor, reference);
    await service.publish(actor, reference);
    expect((await service.getTeacherCatalog(actor)).catalog).toHaveLength(1);

    now = "2026-09-01T10:00:00.000Z";
    expect((await service.getTeacherCatalog(actor)).catalog).toHaveLength(0);
    expect(
      (await new CoursePackageQueryService(registry).listTeacher(tenantId)).course_package_versions
    ).toHaveLength(0);
  });

  it("requires the student's formal run references to match the published package exactly", async () => {
    let now = "2026-08-30T10:00:00.000Z";
    const registry = new CoursePackageJsonRegistry({ now: () => now });
    const packages = new CoursePackageCommandService(registry, sources);
    const service = new CourseFactoryService({
      packageCommands: packages,
      packageRegistry: registry
    });
    const draft = await service.createDraft(
      actor,
      factoryDraft({
        factory_metadata: {
          ...factoryDraft().factory_metadata,
          source_evidence_reference: buildM30CourseFactorySourceEvidence()
        }
      })
    );
    const reference = createCoursePackageVersionReference(draft);
    await service.validate(actor, reference);
    await service.approve(actor, reference);
    await service.publish(actor, reference);

    const exact = {
      parameter_set_reference: packageDraft.parameter_set_reference,
      scenario_package_reference: packageDraft.scenario_package_reference
    };
    expect(await service.getStudentSourceEvidence(tenantId, exact)).toEqual({
      consumption_status: "LOOKAHEAD_READY",
      epoch_version: "epoch-b.2026-08-30",
      exact_binding_required: true,
      qualification_status: "LIMITED",
      target_region: "Hangzhou"
    });
    expect(
      await service.getStudentSourceEvidence(tenantId, {
        ...exact,
        parameter_set_reference: {
          ...exact.parameter_set_reference,
          content_digest: digest("f")
        }
      })
    ).toBeUndefined();

    now = "2026-12-01T00:00:00.000Z";
    expect(await service.getStudentSourceEvidence(tenantId, exact)).toBeUndefined();
    expect((await service.getTeacherCatalog(actor)).catalog[0]?.source_context).toBeUndefined();
    const sponsor = await service.getSponsorProjection(actor, tenantId);
    expect(sponsor.catalog[0]?.source_context).toBeUndefined();
    expect(sponsor.evidence_pack.source_evidence_count).toBe(0);
  });

  it("rejects malformed optional model references at the runtime metadata boundary", async () => {
    const { service } = createService();
    const unknownMetadataField = factoryDraft({
      factory_metadata: {
        ...factoryDraft().factory_metadata,
        unexpected: true
      }
    });
    await expect(service.createDraft(actor, unknownMetadataField)).rejects.toEqual(
      new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID")
    );

    const nestedUnknownFieldCandidates = [
      factoryDraft({
        factory_metadata: {
          ...factoryDraft().factory_metadata,
          rights: { ...factoryDraft().factory_metadata.rights, unexpected: true }
        }
      }),
      factoryDraft({
        factory_metadata: {
          ...factoryDraft().factory_metadata,
          provenance: { ...factoryDraft().factory_metadata.provenance, unexpected: true }
        }
      }),
      factoryDraft({
        factory_metadata: {
          ...factoryDraft().factory_metadata,
          source_manifest: { ...factoryDraft().factory_metadata.source_manifest, unexpected: true }
        }
      }),
      factoryDraft({
        factory_metadata: {
          ...factoryDraft().factory_metadata,
          user_data_policy: { ...factoryDraft().factory_metadata.user_data_policy, unexpected: true }
        }
      })
    ];
    for (const candidate of nestedUnknownFieldCandidates) {
      await expect(service.createDraft(actor, candidate)).rejects.toEqual(
        new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID")
      );
    }

    const evidence = buildM30CourseFactorySourceEvidence();
    const evidenceUnknownFieldCandidates = [
      { ...evidence, unexpected: true },
      { ...evidence, source_epoch: { ...evidence.source_epoch, unexpected: true } },
      { ...evidence, regional_transfer: { ...evidence.regional_transfer, unexpected: true } },
      { ...evidence, living_operations: { ...evidence.living_operations, unexpected: true } }
    ];
    for (const sourceEvidence of evidenceUnknownFieldCandidates) {
      const candidate = factoryDraft({
        factory_metadata: {
          ...factoryDraft().factory_metadata,
          source_evidence_reference: sourceEvidence
        }
      });
      await expect(service.createDraft(actor, candidate)).rejects.toEqual(
        new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID")
      );
    }

    for (const field of ["model_artifact_reference", "model_version_reference"] as const) {
      const candidate = factoryDraft({
        factory_metadata: {
          ...factoryDraft().factory_metadata,
          source_manifest: {
            ...factoryDraft().factory_metadata.source_manifest,
            [field]: {}
          }
        }
      });
      await expect(service.createDraft(actor, candidate)).rejects.toEqual(
        new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID")
      );
    }

    const validReferences = factoryDraft().factory_metadata.source_manifest;
    for (const field of [
      "course_blueprint_reference",
      "scenario_package_reference",
      "project_profile_reference"
    ] as const) {
      const reference = validReferences[field];
      if (!reference) continue;
      const candidate = factoryDraft({
        factory_metadata: {
          ...factoryDraft().factory_metadata,
          source_manifest: {
            ...validReferences,
            [field]: { ...reference, unexpected: true }
          }
        }
      });
      await expect(service.createDraft(actor, candidate)).rejects.toEqual(
        new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID")
      );
    }

    const parameterCandidate = factoryDraft({
      factory_metadata: {
        ...factoryDraft().factory_metadata,
        source_manifest: {
          ...validReferences,
          parameter_set_reference: {
            ...validReferences.parameter_set_reference,
            unexpected: true
          }
        }
      }
    });
    await expect(service.createDraft(actor, parameterCandidate)).rejects.toEqual(
      new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID")
    );

    const provenanceCandidate = factoryDraft({
      factory_metadata: {
        ...factoryDraft().factory_metadata,
        provenance: {
          ...factoryDraft().factory_metadata.provenance,
          source_course_package_reference: {
            content_digest: digest("c"),
            course_package_id: "source_course_demo",
            tenant_id: tenantId,
            version: "1.0.0",
            unexpected: true
          }
        }
      }
    });
    await expect(service.createDraft(actor, provenanceCandidate)).rejects.toEqual(
      new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID")
    );

    const validModelReferences = {
      model_artifact_reference: {
        artifact_id: "artifact_demo",
        content_digest: digest("a"),
        format: "json",
        source_ref: "source:artifact_demo"
      },
      model_version_reference: {
        content_digest: digest("b"),
        model_version_id: "model_demo",
        version: "1.0.0"
      }
    };
    await expect(
      service.createDraft(
        actor,
        factoryDraft({
          factory_metadata: {
            ...factoryDraft().factory_metadata,
            source_manifest: {
              ...factoryDraft().factory_metadata.source_manifest,
              ...validModelReferences
            }
          }
        })
      )
    ).resolves.toBeDefined();

    for (const field of ["model_artifact_reference", "model_version_reference"] as const) {
      const candidate = factoryDraft({
        factory_metadata: {
          ...factoryDraft().factory_metadata,
          source_manifest: {
            ...factoryDraft().factory_metadata.source_manifest,
            ...validModelReferences,
            [field]: { ...validModelReferences[field], unexpected: true }
          }
        }
      });
      await expect(service.createDraft(actor, candidate)).rejects.toEqual(
        new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID")
      );
    }
  });

  it("clones only an unexpired published source and preserves exact refs without user data", async () => {
    const { service } = createService();
    const source = await service.createDraft(actor, factoryDraft());
    const sourceReference = createCoursePackageVersionReference(source);
    await service.validate(actor, sourceReference);
    await service.approve(actor, sourceReference);
    const published = await service.publish(actor, sourceReference);
    const publishedReference = createCoursePackageVersionReference(published);

    const cloned = await service.clone(actor, {
      course_package_id: "course_factory_clone",
      description: "A safe derived delivery package.",
      source_course_package_reference: publishedReference,
      title: "Derived governed course",
      version: "2.0.0"
    });

    expect(cloned.status).toBe("DRAFT");
    expect(cloned.factory_metadata.provenance).toMatchObject({
      kind: "CLONED",
      source_course_package_reference: publishedReference
    });
    expect(cloned.course_blueprint_reference).toEqual(published.course_blueprint_reference);
    expect(cloned.scenario_package_reference).toEqual(published.scenario_package_reference);
    expect(cloned.parameter_set_reference).toEqual(published.parameter_set_reference);
  });

  it("rejects a project profile reference owned by another tenant", async () => {
    const { service } = createService();
    const candidate = factoryDraft({
      factory_metadata: {
        ...factoryDraft().factory_metadata,
        source_manifest: {
          ...factoryDraft().factory_metadata.source_manifest,
          project_profile_reference: {
            content_digest: digest("a"),
            project_profile_id: "profile_other_tenant",
            tenant_id: "tenant_other",
            version: "1.0.0"
          }
        }
      }
    });

    await expect(service.createDraft(actor, candidate)).rejects.toEqual(
      new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID")
    );
  });

  it("fails closed for an expired source and for a tenant outside the rights allowlist", async () => {
    const { service } = createService();
    const expired = await service.createDraft(
      actor,
      factoryDraft({
        factory_metadata: {
          ...factoryDraft().factory_metadata,
          rights: {
            ...factoryDraft().factory_metadata.rights,
            expires_at: "2026-08-29T00:00:00.000Z"
          }
        }
      })
    );
    const expiredReference = createCoursePackageVersionReference(expired);
    await service.validate(actor, expiredReference);
    await service.approve(actor, expiredReference);
    await expect(service.publish(actor, expiredReference)).rejects.toEqual(
      new CourseFactoryError("COURSE_FACTORY_RIGHTS_EXPIRED")
    );

    const restricted = await service.createDraft(
      actor,
      factoryDraft({
        course_package_id: "course_factory_restricted"
      })
    );
    const restrictedReference = createCoursePackageVersionReference(restricted);
    await service.validate(actor, restrictedReference);
    await service.approve(actor, restrictedReference);
    const restrictedPublished = await service.publish(actor, restrictedReference);
    await expect(
      service.clone(
        { actor_id: "other_admin", tenant_id: "tenant_other", roles: ["tenant_admin"] },
        {
          course_package_id: "course_factory_denied_clone",
          description: "Should not be copied outside the allowlist.",
          source_course_package_reference: createCoursePackageVersionReference(restrictedPublished),
          title: "Denied clone",
          version: "1.0.0"
        }
      )
    ).rejects.toEqual(new CourseFactoryError("COURSE_FACTORY_RIGHTS_SCOPE_VIOLATION"));

    const nonCopyable = await service.createDraft(
      actor,
      factoryDraft({
        course_package_id: "course_factory_non_copyable",
        factory_metadata: {
          ...factoryDraft().factory_metadata,
          rights: { ...factoryDraft().factory_metadata.rights, copy_allowed: false }
        }
      })
    );
    const nonCopyableReference = createCoursePackageVersionReference(nonCopyable);
    await service.validate(actor, nonCopyableReference);
    await service.approve(actor, nonCopyableReference);
    const nonCopyablePublished = await service.publish(actor, nonCopyableReference);
    await expect(
      service.rollback(actor, {
        course_package_id: "course_factory_non_copyable_rollback",
        description: "Should not be copied.",
        source_course_package_reference: createCoursePackageVersionReference(nonCopyablePublished),
        title: "Denied rollback",
        version: "1.0.0"
      })
    ).rejects.toEqual(new CourseFactoryError("COURSE_FACTORY_RIGHTS_SCOPE_VIOLATION"));
  });

  it("creates a rollback draft with a lineage edge and produces an audit diff", async () => {
    const { service } = createService();
    const source = await service.createDraft(actor, factoryDraft());
    const sourceReference = createCoursePackageVersionReference(source);
    await service.validate(actor, sourceReference);
    await service.approve(actor, sourceReference);
    const published = await service.publish(actor, sourceReference);
    const publishedReference = createCoursePackageVersionReference(published);
    await service.supersede(actor, publishedReference);

    const rollback = await service.rollback(actor, {
      course_package_id: "course_factory_rollback",
      description: "Rollback to the known governed version.",
      source_course_package_reference: publishedReference,
      title: "Rollback governed course",
      version: "3.0.0"
    });

    expect(rollback.factory_metadata.provenance).toMatchObject({
      kind: "ROLLBACK",
      source_course_package_reference: publishedReference
    });
    const audit = await service.getAudit(actor, publishedReference);
    expect(audit.lineage).toEqual(expect.arrayContaining([publishedReference]));
    expect(audit.diff).toEqual(expect.any(Array));
  });

  it("projects a sponsor-safe catalog without raw user or private fields", async () => {
    const { service } = createService();
    const source = await service.createDraft(actor, factoryDraft());
    const projection = await service.getSponsorProjection(actor, tenantId);

    expect(projection.catalog).toHaveLength(1);
    expect(projection.catalog[0]).toMatchObject({
      course_package_reference: createCoursePackageVersionReference(source),
      status: "DRAFT"
    });
    expect(projection.evidence_pack.private_data_included).toBe(false);
    expect(projection).not.toHaveProperty("user_decisions");
    expect(projection).not.toHaveProperty("private_data");
    expect(projection).not.toHaveProperty("state_true");
    expect(projection.known_limits.length).toBeGreaterThan(0);
  });

  it("does not claim exact references when the sponsor catalog is empty", async () => {
    const { service } = createService();
    const projection = await service.getSponsorProjection(actor, tenantId);

    expect(projection.catalog).toHaveLength(0);
    expect(projection.evidence_pack.exact_refs_present).toBe(false);
  });

  it("rejects a factory manifest that does not match the package's exact source bindings", async () => {
    const { service } = createService();
    const candidate = factoryDraft({
      factory_metadata: {
        ...factoryDraft().factory_metadata,
        source_manifest: {
          ...factoryDraft().factory_metadata.source_manifest,
          course_blueprint_reference: {
            ...packageDraft.course_blueprint_reference,
            content_digest: digest("d")
          }
        }
      }
    });

    await expect(service.createDraft(actor, candidate)).rejects.toEqual(
      new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID")
    );
  });
});
