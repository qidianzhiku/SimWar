import { describe, expect, it } from "vitest";
import type { TeacherScenarioStudioCatalogDto } from "@simwar/shared-contracts";
import {
  getTeacherScenarioStudioModelSelection,
  getTeacherScenarioStudioPrimaryAction,
  getTeacherScenarioStudioRecoveryState,
  TeacherScenarioStudioRequestCoordinator
} from "../../apps/teacher/src/teacher-scenario-studio-client";

const catalog = (modelRefs: string[]) =>
  ({
    course_blueprints: [],
    model_versions: modelRefs.map((model_version_ref) => ({
      model_version_ref,
      provider: "OFF",
      status: "APPROVED"
    })),
    operation_id: "TEACHER_SCENARIO_STUDIO_CATALOG_V1",
    scenario_packages: []
  }) satisfies TeacherScenarioStudioCatalogDto;

describe("FE-TSR / FE-TCH target contract", () => {
  it("keeps 0/1/N model authority explicit", () => {
    expect(getTeacherScenarioStudioModelSelection(catalog([]), "")).toEqual({
      kind: "SOURCE_UNAVAILABLE"
    });
    expect(getTeacherScenarioStudioModelSelection(catalog(["model@1"]), "")).toEqual({
      kind: "REQUIRES_SELECTION",
      options: ["model@1"]
    });
    expect(getTeacherScenarioStudioModelSelection(catalog(["model@1", "model@2"]), "")).toEqual({
      kind: "REQUIRES_SELECTION",
      options: ["model@1", "model@2"]
    });
    expect(getTeacherScenarioStudioModelSelection(catalog(["model@1"]), "model@1")).toEqual({
      kind: "SELECTED",
      modelVersionRef: "model@1"
    });
  });

  it("maps each lifecycle state to one legal next action", () => {
    expect(getTeacherScenarioStudioPrimaryAction({ status: "DRAFT" })).toBe(
      "VALIDATE_COMPATIBILITY"
    );
    expect(getTeacherScenarioStudioPrimaryAction({ status: "BLOCKED" })).toBe(
      "INSPECT_AND_RECOVER"
    );
    expect(getTeacherScenarioStudioPrimaryAction({ status: "VALIDATED" })).toBe("FREEZE_CANDIDATE");
    expect(getTeacherScenarioStudioPrimaryAction({ status: "FROZEN" })).toBe(
      "PREVIEW_TEACHING_SCENARIO"
    );
    expect(getTeacherScenarioStudioPrimaryAction({ status: "ACTIVATED" })).toBe("NONE");
  });

  it("preserves truthful recovery boundaries", () => {
    expect(
      getTeacherScenarioStudioRecoveryState({
        status: 401,
        code: "AUTH",
        message: "reauth"
      })
    ).toBe("REAUTH_REQUIRED");
    expect(
      getTeacherScenarioStudioRecoveryState({
        status: 403,
        code: "DENIED",
        message: "denied"
      })
    ).toBe("PERMISSION_DENIED");
    expect(
      getTeacherScenarioStudioRecoveryState({
        status: 404,
        code: "MISSING",
        message: "stale"
      })
    ).toBe("STALE_OR_OUT_OF_SCOPE");
    expect(
      getTeacherScenarioStudioRecoveryState({
        status: 409,
        code: "CONFLICT",
        message: "conflict"
      })
    ).toBe("CONFLICT");
    expect(
      getTeacherScenarioStudioRecoveryState({
        status: 0,
        code: "NETWORK",
        message: "unknown",
        mutation: true,
        transport: "NETWORK"
      })
    ).toBe("UNKNOWN_COMMAND_RESULT");
    expect(
      getTeacherScenarioStudioRecoveryState({
        status: 200,
        code: "MALFORMED",
        message: "malformed",
        transport: "MALFORMED"
      })
    ).toBe("ERROR_FAIL_CLOSED");
  });

  it("invalidates superseded requests and context changes", () => {
    const coordinator = new TeacherScenarioStudioRequestCoordinator();
    const first = coordinator.begin("tenant-a/token-a");
    const second = coordinator.begin("tenant-a/token-a");
    const third = coordinator.begin("tenant-b/token-b");

    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(true);
    expect(first.isCurrent()).toBe(false);
    expect(second.isCurrent()).toBe(false);
    expect(third.isCurrent()).toBe(true);

    coordinator.invalidate("tenant-c/token-c");
    expect(third.signal.aborted).toBe(true);
    expect(third.isCurrent()).toBe(false);
  });
});
