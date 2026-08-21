import { describe, expect, it } from "vitest";
import type {
  ProjectProfileDraftInput,
  ProjectProfileRef,
  ProjectProfileSafePayload
} from "../../packages/shared-contracts/src";
import { getShanghaiMarketWorldReference } from "../../services/api/src/market-world-product";
import {
  ProjectLibraryError,
  ProjectLibraryService
} from "../../services/api/src/project-library-service";
import { createP1Store } from "../../services/api/src/store";

const actor = { actor_id: "usr_teacher", tenant_id: "tenant_demo" };
const marketWorldReference = getShanghaiMarketWorldReference();

function seedRunAndSecondTeam() {
  const store = createP1Store();
  store.runs.push({
    course_id: "course_demo",
    parameter_set_id: "param_toy_approved_1",
    run_id: "run_project_library",
    scenario_package_id: "scenario_eldercare_demo",
    seed: 7,
    status: "active",
    tenant_id: "tenant_demo"
  });
  store.rounds.push({
    round_id: "round_project_library",
    round_no: 1,
    run_id: "run_project_library",
    status: "draft",
    tenant_id: "tenant_demo"
  });
  store.teams.push({
    captain_user_id: "usr_other_student",
    course_id: "course_demo",
    members: [],
    name: "Team Beta",
    team_id: "team_beta",
    tenant_id: "tenant_demo"
  });
  return store;
}

function draftInput(
  projectProfileId = "shanghai-project-alpha",
  version = "2026-08-21.1"
): ProjectProfileDraftInput {
  const safe: ProjectProfileSafePayload = {
    customer_segment: "上海城市养老照护家庭",
    geography: "Shanghai",
    industry: "eldercare",
    positioning: "可及、连续、可信的照护服务",
    service_bundle: "社区照护与居家支持",
    starting_capacity: 100,
    starting_cash: 100000
  };
  return {
    description: "Safe normalized starting template for a teaching project.",
    market_world_reference: marketWorldReference,
    project_profile_id: projectProfileId,
    template_id: "shanghai-eldercare-safe-v1",
    title: "Shanghai Care Pilot",
    version,
    ...safe
  };
}

function ref(profile: {
  project_profile_id: string;
  version: string;
  content_digest: string;
}): ProjectProfileRef {
  return {
    content_digest: profile.content_digest,
    project_profile_id: profile.project_profile_id,
    tenant_id: "tenant_demo",
    version: profile.version
  };
}

describe("ProjectProfile / ProjectAssignment authority", () => {
  it("creates an exact immutable profile and rejects aliases", async () => {
    const service = new ProjectLibraryService(seedRunAndSecondTeam());
    const created = await service.createDraft(actor, {
      course_id: "course_demo",
      project_profile: draftInput()
    });

    expect(created.status).toBe("DRAFT");
    expect(created.content_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(created.market_world_reference).toEqual(marketWorldReference);

    await expect(
      service.createDraft(actor, {
        course_id: "course_demo",
        project_profile: draftInput("latest-project", "2026-08-21.1")
      })
    ).rejects.toMatchObject({ code: "PROJECT_PROFILE_IDENTITY_INVALID" });
  });

  it("validates, clones with a unique identity, and imports only closed safe objects", async () => {
    const service = new ProjectLibraryService(seedRunAndSecondTeam());
    const source = await service.createDraft(actor, {
      course_id: "course_demo",
      project_profile: draftInput()
    });
    const validated = await service.validate(actor, {
      course_id: "course_demo",
      project_profile_ref: ref(source)
    });

    expect(validated.status).toBe("VALIDATED");
    const cloned = await service.clone(actor, {
      course_id: "course_demo",
      description: "Cloned teaching profile",
      project_profile_id: "shanghai-project-beta",
      source_project_profile_ref: ref(validated),
      title: "Shanghai Care Clone",
      version: "2026-08-21.2"
    });
    expect(cloned.project_profile_id).toBe("shanghai-project-beta");
    expect(cloned.content_digest).not.toBe(validated.content_digest);

    await expect(
      service.import(actor, {
        course_id: "course_demo",
        project_profile: { ...draftInput(), raw_source_path: "D:/restricted" } as never
      })
    ).rejects.toMatchObject({ code: "PROJECT_PROFILE_IMPORT_INVALID" });
  });

  it("assigns exactly once, rejects conflicting refs, and supports matched arena isolation", async () => {
    const store = seedRunAndSecondTeam();
    const service = new ProjectLibraryService(store);
    const profile = await service.createDraft(actor, {
      course_id: "course_demo",
      project_profile: draftInput()
    });
    await service.validate(actor, { course_id: "course_demo", project_profile_ref: ref(profile) });

    const first = await service.assign(actor, {
      course_id: "course_demo",
      project_profile_ref: ref(profile),
      run_id: "run_project_library",
      team_id: "team_alpha"
    });
    const repeated = await service.assign(actor, {
      course_id: "course_demo",
      project_profile_ref: ref(profile),
      run_id: "run_project_library",
      team_id: "team_alpha"
    });
    const secondTeam = await service.assign(actor, {
      course_id: "course_demo",
      project_profile_ref: ref(profile),
      run_id: "run_project_library",
      team_id: "team_beta"
    });

    expect(first.idempotent).toBe(false);
    expect(repeated.idempotent).toBe(true);
    expect(secondTeam.assignment.team_id).toBe("team_beta");
    expect(store.projectAssignments).toHaveLength(2);
    await expect(
      service.assign(actor, {
        course_id: "course_demo",
        project_profile_ref: ref({
          ...profile,
          project_profile_id: "does-not-exist",
          content_digest: "a".repeat(64)
        }),
        run_id: "run_project_library",
        team_id: "team_alpha"
      })
    ).rejects.toMatchObject({ code: "PROJECT_ASSIGNMENT_CONFLICT" });
  });

  it("keeps historical profiles immutable and resolves successors without rewriting refs", async () => {
    const service = new ProjectLibraryService(seedRunAndSecondTeam());
    const source = await service.createDraft(actor, {
      course_id: "course_demo",
      project_profile: draftInput()
    });
    const validated = await service.validate(actor, {
      course_id: "course_demo",
      project_profile_ref: ref(source)
    });
    const successor = await service.createSuccessor(actor, {
      course_id: "course_demo",
      description: "Future-effective successor",
      future_effective_at: "2026-09-01T00:00:00.000Z",
      project_profile_id: "shanghai-project-alpha-successor",
      source_project_profile_ref: ref(validated),
      title: "Shanghai Care Successor",
      version: "2026-09-01.1"
    });

    expect(successor.successor_of).toEqual(ref(validated));
    expect((await service.getByReference(actor.tenant_id, ref(validated)))?.content_digest).toBe(
      validated.content_digest
    );
    expect((await service.getTeacherLibrary(actor, "course_demo"))[0]?.readiness).toContain(
      "SUCCESSOR_AVAILABLE"
    );
  });

  it("retires only a validated future version and blocks new assignment", async () => {
    const store = seedRunAndSecondTeam();
    const service = new ProjectLibraryService(store);
    const source = await service.createDraft(actor, {
      course_id: "course_demo",
      project_profile: draftInput()
    });
    const validated = await service.validate(actor, {
      course_id: "course_demo",
      project_profile_ref: ref(source)
    });
    const retired = await service.retire(actor, {
      course_id: "course_demo",
      project_profile_ref: ref(validated)
    });
    expect(retired.status).toBe("RETIRED");
    await expect(
      service.assign(actor, {
        course_id: "course_demo",
        project_profile_ref: ref(retired),
        run_id: "run_project_library",
        team_id: "team_alpha"
      })
    ).rejects.toMatchObject({ code: "PROJECT_ASSIGNMENT_RETIRED" });
  });

  it("returns only the assigned safe brief and never writes W4 state", async () => {
    const store = seedRunAndSecondTeam();
    const service = new ProjectLibraryService(store);
    const profile = await service.createDraft(actor, {
      course_id: "course_demo",
      project_profile: draftInput()
    });
    await service.validate(actor, { course_id: "course_demo", project_profile_ref: ref(profile) });
    await service.assign(actor, {
      course_id: "course_demo",
      project_profile_ref: ref(profile),
      run_id: "run_project_library",
      team_id: "team_alpha"
    });

    const brief = await service.getStudentBrief({
      course_id: "course_demo",
      run_id: "run_project_library",
      team_id: "team_alpha",
      tenant_id: "tenant_demo",
      user_id: "usr_student"
    });
    expect(brief.project_profile_reference).toEqual(ref(profile));
    expect(JSON.stringify(brief)).not.toMatch(
      /raw_source|private|state_true|score|rank|settlement/i
    );
    expect(store.w4.states).toHaveLength(0);

    await expect(
      service.getStudentBrief({
        course_id: "course_demo",
        run_id: "run_project_library",
        team_id: "team_beta",
        tenant_id: "tenant_other",
        user_id: "usr_student"
      })
    ).rejects.toMatchObject({ code: "PROJECT_ASSIGNMENT_SCOPE_VIOLATION" });
  });

  it("exposes typed domain errors instead of accepting unknown refs", () => {
    expect(new ProjectLibraryError("PROJECT_PROFILE_NOT_FOUND")).toBeInstanceOf(Error);
  });
});
