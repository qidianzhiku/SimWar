import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ExactRef } from "../../packages/shared-contracts/src/a5-compatibility";
import {
  assertValidInstructorAsset,
  InstructorAssetRegistry,
  InstructorAssetRegistryError
} from "../../services/api/src/instructor-asset-registry";
import type { InstructorAsset } from "../../services/api/src/instructor-asset-registry";
import {
  createP1Store,
  readInstructorAssetCollection,
  persistInstructorAssetCollection
} from "../../services/api/src/store";

const digest = "a".repeat(64);

function courseBlueprintRef(overrides: Partial<ExactRef> = {}): ExactRef {
  return {
    content_digest: digest,
    discriminator: "exact_ref",
    resource_id: "blueprint_course_001",
    resource_type: "course_blueprint",
    tenant_id: "tenant_demo",
    version: "1.0.0",
    ...overrides
  };
}

describe("InstructorAssetRegistry", () => {
  it("requires an exact, tenant-scoped CourseBlueprint reference before creating a draft", () => {
    const registry = new InstructorAssetRegistry({ now: () => "2026-08-01T12:00:00.000Z" });

    expect(() =>
      registry.createDraft({
        actor_id: "teacher_demo",
        course_id: "course_demo",
        course_blueprint_ref: { ...courseBlueprintRef(), version: "latest" },
        tenant_id: "tenant_demo",
        title: "Debrief plan"
      })
    ).toThrowError(new InstructorAssetRegistryError("INSTRUCTOR_ASSET_EXACT_REFERENCE_REQUIRED"));
    expect(registry.list("tenant_demo")).toEqual([]);
  });

  it("rejects malformed and digest-tampered persisted assets before they can become JSON-runtime authority", () => {
    expect(() =>
      assertValidInstructorAsset({
        asset_id: "asset_bad",
        course_blueprint_ref: courseBlueprintRef(),
        course_id: "course_demo",
        created_at: "2026-02-29T12:00:00Z",
        created_by: "teacher_demo",
        fact_digest: digest,
        status: "teacher_published",
        tenant_id: "tenant_demo",
        title: "Malformed timestamp",
        updated_at: "2026-02-29T12:00:00Z"
      })
    ).toThrowError(new InstructorAssetRegistryError("INSTRUCTOR_ASSET_INVALID"));
    expect(() =>
      assertValidInstructorAsset({
        asset_id: "asset_digest_bad",
        course_blueprint_ref: courseBlueprintRef(),
        course_id: "course_demo",
        created_at: "2026-08-01T12:00:00.000Z",
        created_by: "teacher_demo",
        fact_digest: digest,
        status: "teacher_published",
        tenant_id: "tenant_demo",
        title: "Digest tampered",
        updated_at: "2026-08-01T12:00:00.000Z"
      })
    ).toThrowError(new InstructorAssetRegistryError("INSTRUCTOR_ASSET_INVALID"));
  });

  it("publishes only through the explicit teacher transition and keeps published revisions immutable", () => {
    let idSequence = 0;
    const registry = new InstructorAssetRegistry({
      createId: () => `instructor_asset_${++idSequence}`,
      now: () => "2026-08-01T12:00:00.000Z"
    });
    const draft = registry.createDraft({
      actor_id: "teacher_demo",
      course_id: "course_demo",
      course_blueprint_ref: courseBlueprintRef(),
      tenant_id: "tenant_demo",
      title: "Round 1 debrief"
    });

    expect(draft.status).toBe("draft");
    expect(
      registry.publish({
        actor_id: "teacher_demo",
        asset_id: draft.asset_id,
        tenant_id: "tenant_demo"
      }).status
    ).toBe("teacher_published");
    expect(() =>
      registry.reject({
        actor_id: "teacher_demo",
        asset_id: draft.asset_id,
        tenant_id: "tenant_demo"
      })
    ).toThrowError(new InstructorAssetRegistryError("INSTRUCTOR_ASSET_IMMUTABLE"));

    const revision = registry.createRevision({
      actor_id: "teacher_demo",
      asset_id: draft.asset_id,
      tenant_id: "tenant_demo",
      title: "Round 1 debrief revision"
    });
    expect(revision.revision_of_asset_id).toBe(draft.asset_id);
    expect(revision.asset_id).not.toBe(draft.asset_id);
    expect(revision.status).toBe("draft");
    expect(registry.list("tenant_demo")).toHaveLength(2);
  });

  it("keeps all records tenant-isolated and exposes no runtime or student fields", () => {
    const registry = new InstructorAssetRegistry({ createId: () => "instructor_asset_002" });
    const draft = registry.createDraft({
      actor_id: "teacher_demo",
      course_id: "course_demo",
      course_blueprint_ref: courseBlueprintRef(),
      tenant_id: "tenant_demo",
      title: "Teacher kit"
    });

    expect(() =>
      registry.publish({
        actor_id: "other_teacher",
        asset_id: draft.asset_id,
        tenant_id: "tenant_other"
      })
    ).toThrowError(new InstructorAssetRegistryError("INSTRUCTOR_ASSET_NOT_FOUND"));
    expect(JSON.stringify(registry.list("tenant_demo"))).not.toContain("state_true");
    expect(JSON.stringify(registry.list("tenant_demo"))).not.toContain("student");
  });

  it("rejects generated IDs that would make revisions ambiguous", () => {
    const registry = new InstructorAssetRegistry({ createId: () => "instructor_asset_duplicate" });
    registry.createDraft({
      actor_id: "teacher_demo",
      course_id: "course_demo",
      course_blueprint_ref: courseBlueprintRef(),
      tenant_id: "tenant_demo",
      title: "First kit"
    });
    expect(() =>
      registry.createDraft({
        actor_id: "teacher_demo",
        course_id: "course_demo",
        course_blueprint_ref: courseBlueprintRef(),
        tenant_id: "tenant_demo",
        title: "Ambiguous second kit"
      })
    ).toThrowError(new InstructorAssetRegistryError("INSTRUCTOR_ASSET_ID_COLLISION"));
  });

  it("persists every state transition and rolls back failed JSON-runtime writes", () => {
    let writes = 0;
    const assets: InstructorAsset[] = [];
    const registry = new InstructorAssetRegistry(
      {
        createId: (() => {
          let index = 0;
          return () => `instructor_asset_00${++index}`;
        })(),
        persist: () => {
          writes += 1;
        }
      },
      assets
    );
    const draft = registry.createDraft({
      actor_id: "teacher_demo",
      course_id: "course_demo",
      course_blueprint_ref: courseBlueprintRef(),
      tenant_id: "tenant_demo",
      title: "Persisted kit"
    });
    registry.publish({
      actor_id: "teacher_demo",
      asset_id: draft.asset_id,
      tenant_id: "tenant_demo"
    });
    expect(writes).toBe(2);

    let failPersist = false;
    let nextId = 0;
    const recoverable = new InstructorAssetRegistry({
      createId: () => `instructor_asset_recoverable_${++nextId}`,
      persist: () => {
        if (failPersist) throw new Error("write failed");
      }
    });
    const publishDraft = recoverable.createDraft({
      actor_id: "teacher_demo",
      course_id: "course_demo",
      course_blueprint_ref: courseBlueprintRef(),
      tenant_id: "tenant_demo",
      title: "Publish rollback"
    });
    failPersist = true;
    expect(() =>
      recoverable.publish({
        actor_id: "teacher_demo",
        asset_id: publishDraft.asset_id,
        tenant_id: "tenant_demo"
      })
    ).toThrowError("write failed");
    expect(recoverable.get("tenant_demo", publishDraft.asset_id).status).toBe("draft");
    failPersist = false;
    recoverable.publish({
      actor_id: "teacher_demo",
      asset_id: publishDraft.asset_id,
      tenant_id: "tenant_demo"
    });
    failPersist = true;
    expect(() =>
      recoverable.createRevision({
        actor_id: "teacher_demo",
        asset_id: publishDraft.asset_id,
        tenant_id: "tenant_demo",
        title: "Revision rollback"
      })
    ).toThrowError("write failed");
    expect(recoverable.list("tenant_demo")).toHaveLength(1);
    failPersist = false;
    const rejectDraft = recoverable.createDraft({
      actor_id: "teacher_demo",
      course_id: "course_demo",
      course_blueprint_ref: courseBlueprintRef(),
      tenant_id: "tenant_demo",
      title: "Reject rollback"
    });
    failPersist = true;
    expect(() =>
      recoverable.reject({
        actor_id: "teacher_demo",
        asset_id: rejectDraft.asset_id,
        tenant_id: "tenant_demo"
      })
    ).toThrowError("write failed");
    expect(recoverable.get("tenant_demo", rejectDraft.asset_id).status).toBe("draft");

    const failing = new InstructorAssetRegistry(
      {
        createId: () => "instructor_asset_failure",
        persist: () => {
          throw new Error("write failed");
        }
      },
      []
    );
    expect(() =>
      failing.createDraft({
        actor_id: "teacher_demo",
        course_id: "course_demo",
        course_blueprint_ref: courseBlueprintRef(),
        tenant_id: "tenant_demo",
        title: "Unpersisted kit"
      })
    ).toThrowError("write failed");
    expect(failing.list("tenant_demo")).toEqual([]);
  });

  it("survives a JSON-runtime restart without reading or writing truth state", () => {
    const directory = mkdtempSync(join(tmpdir(), "simwar-instructor-assets-"));
    const persistenceFile = join(directory, "store.json");
    try {
      const store = createP1Store({ persistenceFile });
      const registry = new InstructorAssetRegistry(
        { persist: (assets) => persistInstructorAssetCollection(store, assets) },
        readInstructorAssetCollection(store)
      );
      const draft = registry.createDraft({
        actor_id: "teacher_demo",
        course_id: "course_demo",
        course_blueprint_ref: courseBlueprintRef(),
        tenant_id: "tenant_demo",
        title: "Restart-safe kit"
      });
      registry.publish({
        actor_id: "teacher_demo",
        asset_id: draft.asset_id,
        tenant_id: "tenant_demo"
      });

      const reloaded = createP1Store({ persistenceFile });
      expect(reloaded.instructorAssets).toEqual([
        expect.objectContaining({ asset_id: draft.asset_id, status: "teacher_published" })
      ]);
      expect(reloaded.decisions).toEqual(store.decisions);
      expect(reloaded.settlementResults).toEqual(store.settlementResults);
      const snapshot = JSON.parse(readFileSync(persistenceFile, "utf8")) as {
        instructorAssets: Array<{ course_id: string }>;
      };
      snapshot.instructorAssets[0]!.course_id = "course_tampered";
      writeFileSync(persistenceFile, JSON.stringify(snapshot));
      expect(() => createP1Store({ persistenceFile })).toThrowError("store_snapshot_corrupted");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("keeps the store collection private behind a copied read and controlled persistence port", () => {
    const store = createP1Store();
    const collection = readInstructorAssetCollection(store);
    collection.push({} as InstructorAsset);
    expect(store.instructorAssets).toEqual([]);

    expect(() => persistInstructorAssetCollection(store, collection)).toThrowError(
      "INSTRUCTOR_ASSET_INVALID"
    );
    expect(store.instructorAssets).toEqual([]);
  });

  it("does not let a persistence callback mutate the registry's private asset snapshot", () => {
    const registry = new InstructorAssetRegistry({
      createId: () => "instructor_asset_callback_copy",
      persist: (assets) => {
        (assets as InstructorAsset[])[0]!.status = "teacher_published";
      }
    });

    const draft = registry.createDraft({
      actor_id: "teacher_demo",
      course_id: "course_demo",
      course_blueprint_ref: courseBlueprintRef(),
      tenant_id: "tenant_demo",
      title: "Copied persistence snapshot"
    });

    expect(draft.status).toBe("draft");
    expect(registry.get("tenant_demo", draft.asset_id).status).toBe("draft");
  });
});
