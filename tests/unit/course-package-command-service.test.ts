import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  CoursePackageVersionDraftInput,
  CoursePackageVersionReference
} from "../../packages/shared-contracts/src/course-package-version";
import {
  CoursePackageCommandError,
  CoursePackageCommandService,
  type CoursePackageSourceReadPorts
} from "../../services/api/src/course-package-command-service";
import {
  CoursePackageJsonRegistry,
  CoursePackageRegistryError,
  createCoursePackageDraftVersion,
  createCoursePackageLifecycleSnapshot
} from "../../services/api/src/course-package-json-registry";
import { createP1Store } from "../../services/api/src/store";

const tenant_id = "tenant_demo";
const digest = (character: string) => character.repeat(64);

const draft: CoursePackageVersionDraftInput = {
  course_blueprint_reference: {
    content_digest: digest("a"),
    course_blueprint_id: "blueprint_wellness_001",
    tenant_id,
    version: "1.0.0"
  },
  course_package_id: "course_package_wellness_001",
  description: "Teaching-only configuration package.",
  parameter_set_reference: {
    content_digest: digest("c"),
    parameter_set_id: "parameter_wellness_001",
    version: "1.0.0"
  },
  scenario_package_reference: {
    content_digest: digest("b"),
    scenario_package_id: "scenario_wellness_001",
    tenant_id,
    version: "1.0.0"
  },
  title: "Wellness package",
  version: "1.0.0"
};

const actor = { actor_id: "usr_admin", tenant_id };

function reference(content_digest: string): CoursePackageVersionReference {
  return {
    content_digest,
    course_package_id: draft.course_package_id,
    tenant_id,
    version: draft.version
  };
}

function sourcePorts(
  overrides: { parameterDigest?: string; scenarioFamily?: string } = {}
): CoursePackageSourceReadPorts {
  const parameterReference = {
    ...draft.parameter_set_reference,
    content_digest: overrides.parameterDigest ?? draft.parameter_set_reference.content_digest
  };
  const courseBlueprint = {
    reference: draft.course_blueprint_reference,
    scenario_compatibility_constraints: { scenario_family: "wellness" },
    status: "APPROVED" as const
  };
  const scenarioPackage = {
    compatibility_metadata: { scenario_family: overrides.scenarioFamily ?? "wellness" },
    parameter_set_reference: parameterReference,
    reference: draft.scenario_package_reference,
    status: "APPROVED" as const
  };
  const parameterSet = { reference: parameterReference, status: "APPROVED" as const };

  return {
    courseBlueprints: {
      assertBindable: async () => undefined,
      getByReference: async () => courseBlueprint
    },
    parameterSets: {
      assertBindable: async () => undefined,
      getByReference: async () => parameterSet
    },
    scenarioPackages: {
      assertBindable: async () => undefined,
      getByReference: async () => scenarioPackage
    }
  } as CoursePackageSourceReadPorts;
}

describe("CoursePackageCommandService", () => {
  it("creates immutable lifecycle snapshots from server-derived identity without mutating source records", async () => {
    const sources = sourcePorts();
    const beforeSources = await Promise.all([
      sources.courseBlueprints.getByReference(tenant_id, draft.course_blueprint_reference),
      sources.scenarioPackages.getByReference(tenant_id, draft.scenario_package_reference),
      sources.parameterSets.getByReference(tenant_id, draft.parameter_set_reference)
    ]);
    const registry = new CoursePackageJsonRegistry({ now: () => "2026-08-02T03:20:00.000Z" });
    const service = new CoursePackageCommandService(registry, sources);

    const created = await service.createDraft(actor, draft);
    const validated = await service.validate(actor, reference(created.content_digest));
    const available = await service.makeAvailable(actor, reference(created.content_digest));

    expect([created.status, validated.status, available.status]).toEqual([
      "DRAFT",
      "VALIDATED",
      "AVAILABLE"
    ]);
    expect(available.created_by).toBe(actor.actor_id);
    expect(available.tenant_id).toBe(actor.tenant_id);
    expect(available.content_digest).toBe(created.content_digest);
    expect(
      await registry.listLifecycleSnapshots(tenant_id, draft.course_package_id, draft.version)
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "DRAFT" }),
        expect.objectContaining({ status: "VALIDATED" }),
        expect.objectContaining({ status: "AVAILABLE" })
      ])
    );
    await expect(
      Promise.all([
        sources.courseBlueprints.getByReference(tenant_id, draft.course_blueprint_reference),
        sources.scenarioPackages.getByReference(tenant_id, draft.scenario_package_reference),
        sources.parameterSets.getByReference(tenant_id, draft.parameter_set_reference)
      ])
    ).resolves.toEqual(beforeSources);
  });

  it("rejects a mismatched approved ScenarioPackage ParameterSet reference without advancing the package", async () => {
    const registry = new CoursePackageJsonRegistry();
    const service = new CoursePackageCommandService(
      registry,
      sourcePorts({ parameterDigest: digest("f") })
    );
    const created = await service.createDraft(actor, draft);

    await expect(service.validate(actor, reference(created.content_digest))).rejects.toEqual(
      new CoursePackageCommandError("COURSE_PACKAGE_COMPATIBILITY_MISMATCH")
    );
    expect(
      await registry.listLifecycleSnapshots(tenant_id, draft.course_package_id, draft.version)
    ).toEqual([expect.objectContaining({ status: "DRAFT" })]);
  });

  it("rejects an open version at the command boundary with a stable input error", async () => {
    const service = new CoursePackageCommandService(new CoursePackageJsonRegistry(), sourcePorts());

    await expect(
      service.createDraft(actor, {
        ...draft,
        version: "latest"
      })
    ).rejects.toEqual(new CoursePackageCommandError("COURSE_PACKAGE_INPUT_INVALID"));
  });

  it("rejects persisted lifecycle history that skips validation", () => {
    const draftSnapshot = createCoursePackageDraftVersion({
      actor_id: actor.actor_id,
      draft,
      now: "2026-08-02T03:20:00.000Z",
      tenant_id
    });

    expect(
      () =>
        new CoursePackageJsonRegistry({}, [
          draftSnapshot,
          createCoursePackageLifecycleSnapshot(draftSnapshot, "AVAILABLE")
        ])
    ).toThrow(new CoursePackageRegistryError("COURSE_PACKAGE_LIFECYCLE_INVALID"));
  });

  it("fails closed when a persisted JSON snapshot skips the package lifecycle", () => {
    const directory = mkdtempSync(join(tmpdir(), "simwar-course-package-history-"));
    const snapshotPath = join(directory, "store.json");
    const draftSnapshot = createCoursePackageDraftVersion({
      actor_id: actor.actor_id,
      draft,
      now: "2026-08-02T03:20:00.000Z",
      tenant_id
    });
    try {
      createP1Store({ persistenceFile: snapshotPath });
      const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as Record<string, unknown>;
      snapshot.coursePackageLifecycleSnapshots = [
        draftSnapshot,
        createCoursePackageLifecycleSnapshot(draftSnapshot, "AVAILABLE")
      ];
      writeFileSync(snapshotPath, JSON.stringify(snapshot), "utf8");

      expect(() => createP1Store({ persistenceFile: snapshotPath })).toThrow(
        "store_snapshot_corrupted"
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("keeps distinct colon-containing package identities independent", async () => {
    const registry = new CoursePackageJsonRegistry();
    const service = new CoursePackageCommandService(registry, sourcePorts());

    await service.createDraft(actor, {
      ...draft,
      course_package_id: "course:a",
      version: "b"
    });
    await service.createDraft(actor, {
      ...draft,
      course_package_id: "course",
      version: "a:b"
    });

    expect(await registry.listForTenant(tenant_id)).toEqual([
      expect.objectContaining({ course_package_id: "course", version: "a:b" }),
      expect.objectContaining({ course_package_id: "course:a", version: "b" })
    ]);
  });

  it("exports only an exact AVAILABLE package and clones it into an independent DRAFT", async () => {
    const registry = new CoursePackageJsonRegistry();
    const service = new CoursePackageCommandService(registry, sourcePorts());
    const created = await service.createDraft(actor, draft);
    await service.validate(actor, reference(created.content_digest));
    await service.makeAvailable(actor, reference(created.content_digest));

    const exported = await service.export(actor, reference(created.content_digest));
    const cloned = await service.clone(actor, {
      course_package_id: "course_package_wellness_clone",
      description: "Cloned teaching-only configuration package.",
      source_course_package_reference: reference(created.content_digest),
      title: "Wellness package clone",
      version: "1.0.0"
    });

    expect(exported.course_package_version).toMatchObject({ status: "AVAILABLE" });
    expect(cloned).toMatchObject({
      course_package_id: "course_package_wellness_clone",
      status: "DRAFT"
    });
    expect(cloned.course_blueprint_reference).toEqual(created.course_blueprint_reference);
    expect(cloned.scenario_package_reference).toEqual(created.scenario_package_reference);
    expect(cloned.parameter_set_reference).toEqual(created.parameter_set_reference);
  });

  it("rejects a tampered import digest before it can create a DRAFT", async () => {
    const sourceRegistry = new CoursePackageJsonRegistry();
    const sourceService = new CoursePackageCommandService(sourceRegistry, sourcePorts());
    const created = await sourceService.createDraft(actor, draft);
    await sourceService.validate(actor, reference(created.content_digest));
    await sourceService.makeAvailable(actor, reference(created.content_digest));
    const exported = await sourceService.export(actor, reference(created.content_digest));
    const destinationRegistry = new CoursePackageJsonRegistry();
    const destinationService = new CoursePackageCommandService(destinationRegistry, sourcePorts());

    await expect(
      destinationService.import(actor, {
        source_course_package_version: {
          ...exported.course_package_version,
          content_digest: digest("f")
        }
      })
    ).rejects.toEqual(new CoursePackageCommandError("COURSE_PACKAGE_IMPORT_DIGEST_INVALID"));
    expect(
      await destinationRegistry.listLifecycleSnapshots(
        tenant_id,
        draft.course_package_id,
        draft.version
      )
    ).toEqual([]);
  });
});
