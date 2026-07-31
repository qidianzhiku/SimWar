import { beforeEach, describe, expect, it } from "vitest";
import { createJsonRepositoryPorts } from "../../services/api/src/json-repository-adapter";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";
import {
  RoleWorkflowCommandService,
  RoleWorkflowError,
  type RoleWorkflowActor
} from "../../services/api/src/role-workflow";

const teacher: RoleWorkflowActor = {
  actor_id: "teacher_c3",
  actor_role: "teacher",
  tenant_id: "tenant_c3"
};

const studentCeo: RoleWorkflowActor = {
  actor_id: "student_ceo",
  actor_role: "student",
  tenant_id: "tenant_c3"
};

const studentCfo: RoleWorkflowActor = {
  actor_id: "student_cfo",
  actor_role: "student",
  tenant_id: "tenant_c3"
};

const studentCmo: RoleWorkflowActor = {
  actor_id: "student_cmo",
  actor_role: "student",
  tenant_id: "tenant_c3"
};

const studentCoo: RoleWorkflowActor = {
  actor_id: "student_coo",
  actor_role: "student",
  tenant_id: "tenant_c3"
};

function createStore(): SimWarStore {
  const store = createP1Store();
  store.courses = [
    {
      course_id: "course_c3",
      tenant_id: "tenant_c3",
      title: "Role Workflow C3",
      status: "active",
      scenario_package_id: "scenario_demo",
      parameter_set_id: "parameters_demo",
      created_by: teacher.actor_id
    }
  ];
  store.runs = [
    {
      run_id: "run_c3",
      tenant_id: "tenant_c3",
      course_id: "course_c3",
      scenario_package_id: "scenario_demo",
      parameter_set_id: "parameters_demo",
      seed: 42,
      status: "active"
    }
  ];
  store.rounds = [
    {
      round_id: "round_c3_1",
      tenant_id: "tenant_c3",
      run_id: "run_c3",
      round_no: 1,
      status: "open"
    }
  ];
  store.teams = [
    {
      team_id: "team_c3",
      tenant_id: "tenant_c3",
      course_id: "course_c3",
      name: "C3 Team",
      captain_user_id: studentCeo.actor_id,
      members: [
        { user_id: studentCeo.actor_id, display_name: "CEO", role_slot: "CEO" },
        { user_id: studentCfo.actor_id, display_name: "CFO", role_slot: "CFO" },
        { user_id: studentCmo.actor_id, display_name: "CMO", role_slot: "CMO" },
        { user_id: studentCoo.actor_id, display_name: "COO", role_slot: "COO" }
      ]
    }
  ];
  return store;
}

describe("RoleWorkflowCommandService", () => {
  let idSequence: number;
  let store: SimWarStore;
  let service: RoleWorkflowCommandService;

  beforeEach(() => {
    idSequence = 0;
    store = createStore();
    service = new RoleWorkflowCommandService(createJsonRepositoryPorts(store).roleWorkflow, {
      createId: (kind) => `${kind}_${++idSequence}`,
      now: () => "2026-07-31T02:00:00.000Z"
    });
  });

  function assignAllRoles(): void {
    for (const [actor, role_key] of [
      [studentCeo, "CEO"],
      [studentCfo, "CFO"],
      [studentCmo, "CMO"],
      [studentCoo, "COO"]
    ] as const) {
      service.assignRole(teacher, {
        course_id: "course_c3",
        role_key,
        run_id: "run_c3",
        team_id: "team_c3",
        user_id: actor.actor_id
      });
    }
  }

  function saveAndReadyAllSections(): void {
    const payloads = new Map<RoleWorkflowActor, object>([
      [studentCeo, { strategy_statement: "Grow with discipline." }],
      [studentCfo, { cash_buffer_target: 0.2, service_quality_budget: 125000 }],
      [studentCmo, { marketing_budget: 150000, pricing: { base_price: 12800 } }],
      [studentCoo, { capacity_plan: "expand" }]
    ]);
    for (const actor of [studentCeo, studentCfo, studentCmo, studentCoo]) {
      service.saveSection(actor, {
        expected_version: 0,
        payload: payloads.get(actor)!,
        round_id: "round_c3_1",
        run_id: "run_c3",
        team_id: "team_c3"
      });
      service.markSectionReady(actor, {
        expected_version: 1,
        round_id: "round_c3_1",
        run_id: "run_c3",
        team_id: "team_c3"
      });
    }
  }

  it("assigns an exact approved role template and resolves only the student's safe context", () => {
    const assignment = service.assignRole(teacher, {
      course_id: "course_c3",
      role_key: "CEO",
      run_id: "run_c3",
      team_id: "team_c3",
      user_id: studentCeo.actor_id
    });

    expect(assignment.role_template_id).toBe("role_template_ceo_v1");
    expect(assignment.source).toBe("teacher_assigned");

    const workspace = service.getStudentWorkspace(studentCeo, {
      round_id: "round_c3_1",
      run_id: "run_c3",
      team_id: "team_c3"
    });

    expect(workspace.context.assignment_id).toBe(assignment.assignment_id);
    expect(workspace.context.permissions.editable_fields).toEqual(["strategy_statement"]);
    expect(workspace).not.toHaveProperty("team_sections");
    expect(JSON.stringify(workspace)).not.toContain("state_true");
    expect(JSON.stringify(workspace)).not.toContain(studentCfo.actor_id);
    expect(JSON.stringify(workspace)).not.toContain(teacher.actor_id);
    expect(workspace.assignment).not.toHaveProperty("assigned_by");
  });

  it("rejects every nonviable team topology before activation and keeps direct Decision available", () => {
    const cases: Array<{
      configure: (candidateStore: SimWarStore) => void;
      name: string;
    }> = [
      {
        name: "missing required roles",
        configure: (candidateStore) => {
          candidateStore.teams[0]!.members = [
            { user_id: studentCeo.actor_id, display_name: "CEO", role_slot: "CEO" }
          ];
        }
      },
      {
        name: "duplicate required role",
        configure: (candidateStore) => {
          candidateStore.teams[0]!.members.push({
            user_id: "student_ceo_alternate",
            display_name: "Alternate CEO",
            role_slot: "CEO"
          });
        }
      },
      {
        name: "one owner occupies multiple roles",
        configure: (candidateStore) => {
          candidateStore.teams[0]!.members[1] = {
            user_id: studentCeo.actor_id,
            display_name: "CEO acting as CFO",
            role_slot: "CFO"
          };
        }
      },
      {
        name: "captain is not the CEO owner",
        configure: (candidateStore) => {
          candidateStore.teams[0]!.captain_user_id = studentCfo.actor_id;
        }
      }
    ];

    for (const testCase of cases) {
      const candidateStore = createStore();
      testCase.configure(candidateStore);
      const candidateService = new RoleWorkflowCommandService(
        createJsonRepositoryPorts(candidateStore).roleWorkflow,
        {
          createId: (kind) => `${kind}_${testCase.name}`,
          now: () => "2026-07-31T02:00:00.000Z"
        }
      );

      expect(
        () =>
          candidateService.assignRole(teacher, {
            course_id: "course_c3",
            role_key: "CEO",
            run_id: "run_c3",
            team_id: "team_c3",
            user_id: studentCeo.actor_id
          }),
        testCase.name
      ).toThrowError(expect.objectContaining({ code: "ROLE_WORKFLOW_TEAM_INCOMPLETE" }));

      expect(candidateStore.studentRoleAssignments, testCase.name).toEqual([]);
      expect(candidateStore.roleWorkflowEvents, testCase.name).toEqual([]);
      expect(() =>
        candidateService.assertDirectDecisionSubmissionAllowed(studentCeo, {
          round_id: "round_c3_1",
          run_id: "run_c3",
          team_id: "team_c3"
        })
      ).not.toThrow();
    }
  });

  it("rejects duplicate active assignments and cross-tenant assignment attempts", () => {
    const input = {
      course_id: "course_c3",
      role_key: "CEO" as const,
      run_id: "run_c3",
      team_id: "team_c3",
      user_id: studentCeo.actor_id
    };
    service.assignRole(teacher, input);

    expect(() => service.assignRole(teacher, input)).toThrowError(
      expect.objectContaining({ code: "ROLE_WORKFLOW_ASSIGNMENT_EXISTS" })
    );
    expect(() => service.assignRole({ ...teacher, tenant_id: "tenant_other" }, input)).toThrowError(
      expect.objectContaining({ code: "ROLE_WORKFLOW_TENANT_DENIED" })
    );

    store.teams[0]!.members.push({
      display_name: "Alternate CEO",
      role_slot: "CEO",
      user_id: "student_ceo_alternate"
    });
    expect(() =>
      service.assignRole(teacher, {
        ...input,
        user_id: "student_ceo_alternate"
      })
    ).toThrowError(expect.objectContaining({ code: "ROLE_WORKFLOW_ASSIGNMENT_EXISTS" }));
  });

  it("persists only role-owned draft fields and rejects stale updates", () => {
    service.assignRole(teacher, {
      course_id: "course_c3",
      role_key: "CFO",
      run_id: "run_c3",
      team_id: "team_c3",
      user_id: studentCfo.actor_id
    });

    const created = service.saveSection(studentCfo, {
      expected_version: 0,
      payload: { cash_buffer_target: 0.2, service_quality_budget: 125000 },
      round_id: "round_c3_1",
      run_id: "run_c3",
      team_id: "team_c3"
    });
    expect(created.version).toBe(1);

    expect(() =>
      service.saveSection(studentCfo, {
        expected_version: 0,
        payload: { cash_buffer_target: 0.3 },
        round_id: "round_c3_1",
        run_id: "run_c3",
        team_id: "team_c3"
      })
    ).toThrowError(expect.objectContaining({ code: "ROLE_WORKFLOW_STALE_SECTION" }));

    expect(() =>
      service.saveSection(studentCfo, {
        expected_version: 1,
        payload: { marketing_budget: 999999 },
        round_id: "round_c3_1",
        run_id: "run_c3",
        team_id: "team_c3"
      })
    ).toThrowError(expect.objectContaining({ code: "ROLE_WORKFLOW_FIELD_DENIED" }));
  });

  it("denies students access to another member's role workspace", () => {
    service.assignRole(teacher, {
      course_id: "course_c3",
      role_key: "CEO",
      run_id: "run_c3",
      team_id: "team_c3",
      user_id: studentCeo.actor_id
    });

    let failure: unknown;
    try {
      service.getStudentWorkspace(studentCfo, {
        round_id: "round_c3_1",
        run_id: "run_c3",
        team_id: "team_c3"
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(RoleWorkflowError);
    expect(failure).toMatchObject({ code: "ROLE_WORKFLOW_ASSIGNMENT_NOT_FOUND" });
  });

  it("requires every assigned role to be ready before creating one validated merge commit", () => {
    assignAllRoles();
    service.saveSection(studentCeo, {
      expected_version: 0,
      payload: { strategy_statement: "Not enough sections." },
      round_id: "round_c3_1",
      run_id: "run_c3",
      team_id: "team_c3"
    });
    service.markSectionReady(studentCeo, {
      expected_version: 1,
      round_id: "round_c3_1",
      run_id: "run_c3",
      team_id: "team_c3"
    });

    expect(() =>
      service.createMergeCommit(studentCeo, {
        round_id: "round_c3_1",
        run_id: "run_c3",
        team_id: "team_c3"
      })
    ).toThrowError(expect.objectContaining({ code: "ROLE_WORKFLOW_SECTIONS_NOT_READY" }));
  });

  it("rejects conflicting values when two roles own the same merge field", () => {
    assignAllRoles();
    const payloads = new Map<RoleWorkflowActor, object>([
      [studentCeo, { strategy_statement: "One plan." }],
      [studentCfo, { cash_buffer_target: 0.2, service_quality_budget: 125000 }],
      [studentCmo, { marketing_budget: 150000, pricing: { base_price: 12800 } }],
      [studentCoo, { capacity_plan: "expand", service_quality_budget: 130000 }]
    ]);
    for (const actor of [studentCeo, studentCfo, studentCmo, studentCoo]) {
      service.saveSection(actor, {
        expected_version: 0,
        payload: payloads.get(actor)!,
        round_id: "round_c3_1",
        run_id: "run_c3",
        team_id: "team_c3"
      });
      service.markSectionReady(actor, {
        expected_version: 1,
        round_id: "round_c3_1",
        run_id: "run_c3",
        team_id: "team_c3"
      });
    }

    expect(() =>
      service.createMergeCommit(studentCeo, {
        round_id: "round_c3_1",
        run_id: "run_c3",
        team_id: "team_c3"
      })
    ).toThrowError(expect.objectContaining({ code: "ROLE_WORKFLOW_MERGE_CONFLICT" }));
    expect(store.decisionMergeCommits).toEqual([]);
  });

  it("merges ready role sections and confirms exactly one canonical decision idempotently", () => {
    store.decisions.push({
      decision_id: "decision_historical",
      payload: {
        capacity_plan: "hold",
        cash_buffer_target: 0.1,
        marketing_budget: 100000,
        pricing: { base_price: 12000 },
        service_quality_budget: 100000,
        strategy_statement: "Historical canonical decision."
      },
      round_id: "round_c3_1",
      round_no: 1,
      run_id: "run_c3",
      status: "validated",
      submitted_by: studentCeo.actor_id,
      team_id: "team_c3",
      tenant_id: "tenant_c3",
      validation_report: [],
      version: 1
    });
    const historicalDecision = structuredClone(store.decisions[0]);
    const settlementBefore = structuredClone(store.settlementResults);
    assignAllRoles();
    saveAndReadyAllSections();

    const firstMerge = service.createMergeCommit(studentCeo, {
      round_id: "round_c3_1",
      run_id: "run_c3",
      team_id: "team_c3"
    });
    const repeatedMerge = service.createMergeCommit(studentCeo, {
      round_id: "round_c3_1",
      run_id: "run_c3",
      team_id: "team_c3"
    });
    expect(repeatedMerge).toEqual(firstMerge);
    expect(store.decisionMergeCommits[0]?.merged_payload).toEqual({
      capacity_plan: "expand",
      cash_buffer_target: 0.2,
      marketing_budget: 150000,
      pricing: { base_price: 12800 },
      service_quality_budget: 125000,
      strategy_statement: "Grow with discipline."
    });
    expect(
      service.getStudentWorkspace(studentCfo, {
        round_id: "round_c3_1",
        run_id: "run_c3",
        team_id: "team_c3"
      }).merge_candidate
    ).toBeUndefined();
    expect(
      service.getStudentWorkspace(studentCeo, {
        round_id: "round_c3_1",
        run_id: "run_c3",
        team_id: "team_c3"
      }).merge_candidate?.merge_commit_id
    ).toBe(firstMerge.merge_commit_id);

    const firstConfirmation = service.confirmTeamDecision(studentCeo, {
      merge_commit_id: firstMerge.merge_commit_id,
      round_id: "round_c3_1",
      run_id: "run_c3",
      team_id: "team_c3"
    });
    const repeatedConfirmation = service.confirmTeamDecision(studentCeo, {
      merge_commit_id: firstMerge.merge_commit_id,
      round_id: "round_c3_1",
      run_id: "run_c3",
      team_id: "team_c3"
    });

    expect(repeatedConfirmation).toEqual(firstConfirmation);
    expect(store.teamConfirmations).toHaveLength(1);
    expect(store.decisions).toHaveLength(2);
    expect(store.decisions[0]).toEqual(historicalDecision);
    expect(store.decisions.at(-1)).toMatchObject({
      canonical_source: "role_merge_commit",
      merge_commit_id: firstMerge.merge_commit_id,
      status: "validated",
      team_confirmation_id: firstConfirmation.team_confirmation_id,
      version: 2
    });
    expect(store.settlementResults).toEqual(settlementBefore);
  });

  it("rejects a stale merge after reset creates a new assignment generation", () => {
    assignAllRoles();
    saveAndReadyAllSections();
    const staleMerge = service.createMergeCommit(studentCeo, {
      round_id: "round_c3_1",
      run_id: "run_c3",
      team_id: "team_c3"
    });
    service.resetWorkflow(teacher, {
      round_id: "round_c3_1",
      run_id: "run_c3",
      team_id: "team_c3"
    });
    assignAllRoles();

    expect(
      service.getStudentWorkspace(studentCeo, {
        round_id: "round_c3_1",
        run_id: "run_c3",
        team_id: "team_c3"
      }).merge_candidate
    ).toBeUndefined();
    expect(() =>
      service.confirmTeamDecision(studentCeo, {
        merge_commit_id: staleMerge.merge_commit_id,
        round_id: "round_c3_1",
        run_id: "run_c3",
        team_id: "team_c3"
      })
    ).toThrowError(expect.objectContaining({ code: "ROLE_WORKFLOW_STALE_MERGE" }));
    expect(store.teamConfirmations).toEqual([]);
    expect(store.decisions).toEqual([]);
  });

  it("disables the direct Decision writer while an active role workflow exists", () => {
    expect(() =>
      service.assertDirectDecisionSubmissionAllowed(studentCeo, {
        round_id: "round_c3_1",
        run_id: "run_c3",
        team_id: "team_c3"
      })
    ).not.toThrow();
    service.assignRole(teacher, {
      course_id: "course_c3",
      role_key: "CEO",
      run_id: "run_c3",
      team_id: "team_c3",
      user_id: studentCeo.actor_id
    });

    expect(() =>
      service.assertDirectDecisionSubmissionAllowed(studentCeo, {
        round_id: "round_c3_1",
        run_id: "run_c3",
        team_id: "team_c3"
      })
    ).toThrowError(expect.objectContaining({ code: "ROLE_WORKFLOW_DIRECT_DECISION_DISABLED" }));

    service.resetWorkflow(teacher, {
      round_id: "round_c3_1",
      run_id: "run_c3",
      team_id: "team_c3"
    });

    expect(() =>
      service.assertDirectDecisionSubmissionAllowed(studentCeo, {
        round_id: "round_c3_1",
        run_id: "run_c3",
        team_id: "team_c3"
      })
    ).toThrowError(expect.objectContaining({ code: "ROLE_WORKFLOW_DIRECT_DECISION_DISABLED" }));
  });

  it("compensates all in-memory workflow writes when JSON persistence fails", () => {
    store.persist = () => {
      throw new Error("disk unavailable");
    };

    expect(() =>
      service.assignRole(teacher, {
        course_id: "course_c3",
        role_key: "CEO",
        run_id: "run_c3",
        team_id: "team_c3",
        user_id: studentCeo.actor_id
      })
    ).toThrow("disk unavailable");
    expect(store.studentRoleAssignments).toEqual([]);
    expect(store.roleWorkflowEvents).toEqual([]);
  });

  it("compensates confirmation, canonical Decision, and audit event together", () => {
    assignAllRoles();
    saveAndReadyAllSections();
    const merge = service.createMergeCommit(studentCeo, {
      round_id: "round_c3_1",
      run_id: "run_c3",
      team_id: "team_c3"
    });
    const eventCount = store.roleWorkflowEvents.length;
    store.persist = () => {
      throw new Error("disk unavailable");
    };

    expect(() =>
      service.confirmTeamDecision(studentCeo, {
        merge_commit_id: merge.merge_commit_id,
        round_id: "round_c3_1",
        run_id: "run_c3",
        team_id: "team_c3"
      })
    ).toThrow("disk unavailable");
    expect(store.teamConfirmations).toEqual([]);
    expect(store.decisions).toEqual([]);
    expect(store.roleWorkflowEvents).toHaveLength(eventCount);
  });

  it("serializes duplicate merge attempts and preserves append-only workflow history", async () => {
    assignAllRoles();
    saveAndReadyAllSections();

    const [left, right] = await Promise.all([
      Promise.resolve(
        service.createMergeCommit(studentCeo, {
          round_id: "round_c3_1",
          run_id: "run_c3",
          team_id: "team_c3"
        })
      ),
      Promise.resolve(
        service.createMergeCommit(studentCeo, {
          round_id: "round_c3_1",
          run_id: "run_c3",
          team_id: "team_c3"
        })
      )
    ]);

    expect(left.merge_commit_id).toBe(right.merge_commit_id);
    expect(store.decisionMergeCommits).toHaveLength(1);
    expect(store.roleWorkflowEvents.map((event) => event.event_type)).toEqual([
      "role_assigned",
      "role_assigned",
      "role_assigned",
      "role_assigned",
      "section_saved",
      "section_ready",
      "section_saved",
      "section_ready",
      "section_saved",
      "section_ready",
      "section_saved",
      "section_ready",
      "merge_created"
    ]);
  });

  it("allows only the teacher to reset active workflow state while retaining audit history", () => {
    assignAllRoles();
    service.saveSection(studentCeo, {
      expected_version: 0,
      payload: { strategy_statement: "Reset me." },
      round_id: "round_c3_1",
      run_id: "run_c3",
      team_id: "team_c3"
    });

    expect(() =>
      service.resetWorkflow(studentCeo, {
        round_id: "round_c3_1",
        run_id: "run_c3",
        team_id: "team_c3"
      })
    ).toThrowError(expect.objectContaining({ code: "ROLE_WORKFLOW_TEACHER_REQUIRED" }));

    const reset = service.resetWorkflow(teacher, {
      round_id: "round_c3_1",
      run_id: "run_c3",
      team_id: "team_c3"
    });
    expect(reset.deactivated_assignments).toBe(4);
    expect(
      store.studentRoleAssignments.every((assignment) => assignment.status === "inactive")
    ).toBe(true);
    expect(store.roleDecisionSections).toHaveLength(1);
    expect(store.roleWorkflowEvents.at(-1)?.event_type).toBe("workflow_reset");
  });
});
