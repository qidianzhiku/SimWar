import { describe, expect, it } from "vitest";
import {
  createEnterpriseStateStrategicEvolutionService,
  createInMemoryW4Repository,
  createW4DecisionPayloadDigest
} from "../../services/api/src/w4-enterprise-state";
import {
  createM4MultipathCounterfactualTransferService,
  M4MultipathCounterfactualTransferError
} from "../../services/api/src/m4-multipath-counterfactual-transfer";
import type { M4MultipathCounterfactualInput } from "../../packages/shared-contracts/src/m4-multipath-counterfactual-transfer";
import type {
  RoleWorkflowRepositorySnapshot,
  W4CanonicalStrategicDecision,
  W4EnterpriseState,
  W4ReplayInputManifest,
  W4ScopeContext,
  W4StateRef
} from "../../packages/shared-contracts/src";
import type { RoleWorkflowRepositorySnapshot } from "../../services/api/src/repository-ports";

const tenantId = "tenant_demo";
const courseId = "course_demo";
const runId = "m4_div_run";
const teamId = "team_alpha";

function scope(roundNo = 1, roundId = `round_${roundNo}`): W4ScopeContext {
  return {
    actor_id: "teacher_001",
    activity_id: "w4-enterprise-state-strategic-evolution",
    course_id: courseId,
    role_key: "CEO",
    round_id: roundId,
    round_no: roundNo,
    run_id: runId,
    team_id: teamId,
    tenant_id: tenantId
  };
}

function initialState(): W4EnterpriseState {
  return {
    enterprise_state_id: "state_initial",
    tenant_id: tenantId,
    course_id: courseId,
    run_id: runId,
    team_id: teamId,
    round_id: "round_1",
    round_no: 1,
    version: 1,
    parent_state_ref: null,
    state_digest: "",
    state: {
      cash: 1_000,
      capacity: 100,
      product_lines: ["core-care"],
      positioning: "trusted-care",
      organization: { team_size: 4 },
      operating_units: [],
      portfolio: { projects: [], facilities: [] }
    }
  };
}

function decision(
  decisionId: string,
  projectName: string,
  cost: number,
  roundNo = 2,
  roundId = `round_${roundNo}`
): W4CanonicalStrategicDecision {
  const payload = {
    area: 1_000,
    bed_mix: { standard: 10 },
    beds: 10,
    cost,
    cycle_rounds: 2,
    lead_time_rounds: 0,
    project_name: projectName,
    ramp: 0.5
  };
  return {
    decision_id: decisionId,
    tenant_id: tenantId,
    course_id: courseId,
    run_id: runId,
    team_id: teamId,
    round_id: roundId,
    round_no: roundNo,
    kind: "new_project",
    version: 1,
    status: "canonical",
    payload,
    admission: {
      policy: "LEGACY_DIRECT_EXPLICIT",
      authority: "synthetic_run_creation_marker",
      canonical_decision_id: null,
      merge_commit_id: null,
      team_confirmation_id: null,
      decision_payload_digest: createW4DecisionPayloadDigest("new_project", payload)
    }
  };
}

function replayManifest(
  openingStateRef: W4StateRef,
  decisionIds: string[],
  decisionDigests: string[]
): W4ReplayInputManifest {
  return {
    manifest_id: "manifest_round_1",
    tenant_id: tenantId,
    course_id: courseId,
    run_id: runId,
    team_id: teamId,
    round_id: "round_1",
    opening_state_ref: structuredClone(openingStateRef),
    decision_ids: decisionIds,
    decision_payload_bindings: decisionIds.map((decisionId, index) => ({
      decision_id: decisionId,
      decision_payload_digest: decisionDigests[index] ?? "0".repeat(64)
    })),
    scenario_package_id: "scenario_m4",
    parameter_set_id: "parameters_m4",
    engine_id: "toy_logit_wellness_v1",
    plugin_ids: ["plugin_wellness_stub"],
    seed: 77
  };
}

function roleWorkflowSnapshot(sourceRoundId: string): RoleWorkflowRepositorySnapshot {
  return {
    course: null,
    run: null,
    round: null,
    team: null,
    assignments: [
      {
        assignment_id: "assignment_ceo",
        assigned_at: "2026-08-28T00:00:00.000Z",
        course_id: courseId,
        role_key: "CEO",
        role_template_id: "template_ceo",
        run_id: runId,
        source: "teacher_assigned",
        status: "active",
        team_id: teamId,
        tenant_id: tenantId,
        user_id: "student_ceo"
      }
    ],
    sections: [
      {
        section_id: "section_ceo",
        assignment_id: "assignment_ceo",
        tenant_id: tenantId,
        course_id: courseId,
        run_id: runId,
        round_id: sourceRoundId,
        team_id: teamId,
        role_key: "CEO",
        version: 1,
        status: "ready",
        payload: { private_note: "do not expose" },
        submitted_by: "student_ceo",
        updated_at: "2026-08-28T00:01:00.000Z"
      }
    ],
    merge_commits: [
      {
        merge_commit_id: "merge_1",
        tenant_id: tenantId,
        course_id: courseId,
        run_id: runId,
        round_id: sourceRoundId,
        team_id: teamId,
        source_section_ids: ["section_ceo"],
        status: "ready",
        created_at: "2026-08-28T00:02:00.000Z"
      }
    ],
    confirmations: [],
    decisions: [],
    events: [
      {
        event_id: "event_resolution",
        tenant_id: tenantId,
        run_id: runId,
        round_id: sourceRoundId,
        team_id: teamId,
        actor_id: "teacher_001",
        event_type: "resolution_proposed",
        resource_id: "resolution_1",
        created_at: "2026-08-28T00:03:00.000Z"
      }
    ],
    resolutions: [
      {
        resolution_id: "resolution_1",
        tenant_id: tenantId,
        run_id: runId,
        round_id: sourceRoundId,
        team_id: teamId,
        status: "PROPOSED",
        source_section_ids: ["section_ceo"],
        source_digest: "d".repeat(64),
        selected_values: {},
        proposed_by: "teacher_001",
        proposed_at: "2026-08-28T00:03:00.000Z"
      }
    ],
    acknowledgements: [
      {
        acknowledgement_id: "ack_1",
        resolution_id: "resolution_1",
        tenant_id: tenantId,
        run_id: runId,
        round_id: sourceRoundId,
        team_id: teamId,
        role_key: "CFO",
        status: "DISSENT_PRESERVED",
        dissent_note: "private dissent note",
        acknowledged_by: "student_cfo",
        acknowledged_at: "2026-08-28T00:04:00.000Z"
      }
    ]
  } as unknown as RoleWorkflowRepositorySnapshot;
}

async function arrange() {
  const repository = createInMemoryW4Repository();
  const w4 = createEnterpriseStateStrategicEvolutionService(repository);
  const firstScope = scope();
  const initial = await w4.createInitialState(firstScope, initialState());
  const sourceDecision = decision("official_source_decision", "official", 100, 1, "round_1");
  await w4.commitStrategicDecision(firstScope, sourceDecision);
  const sourceManifest = replayManifest(
    initial.state_ref,
    [sourceDecision.decision_id],
    [sourceDecision.admission.decision_payload_digest]
  );
  const official = await w4.settleRound(firstScope, {
    opening_state_ref: initial.state_ref,
    decision_id: sourceDecision.decision_id,
    replay_input_manifest: sourceManifest
  });
  const secondScope = scope(2, "round_2");
  const pathA = decision("counter_path_a", "alternative-a", 125);
  const pathB = decision("counter_path_b", "alternative-b", 275);
  await w4.commitStrategicDecision(secondScope, pathA);
  await w4.commitStrategicDecision(secondScope, pathB);
  const roleSnapshot = roleWorkflowSnapshot(official.closing_state_ref.round_id);
  const roleWorkflow = {
    async readRoleWorkflow() {
      return structuredClone(roleSnapshot);
    },
    async commitRoleWorkflow() {
      throw new Error("M4_TEST_MUST_NOT_WRITE_ROLE_WORKFLOW");
    }
  };
  const service = createM4MultipathCounterfactualTransferService({
    roleWorkflow,
    w4Repository: repository,
    w4Service: w4
  });
  const input: M4MultipathCounterfactualInput = {
    source_state_ref: official.closing_state_ref,
    source_outcome_id: official.outcome_id,
    horizon_rounds: 1,
    scenario_package_id: sourceManifest.scenario_package_id,
    parameter_set_id: sourceManifest.parameter_set_id,
    engine_id: sourceManifest.engine_id,
    plugin_ids: sourceManifest.plugin_ids,
    seed: sourceManifest.seed,
    paths: [
      {
        path_id: "path_a",
        label: "成本受控路径",
        decision_ids: [pathA.decision_id]
      },
      {
        path_id: "path_b",
        label: "扩张优先路径",
        decision_ids: [pathB.decision_id]
      }
    ]
  };
  return { input, official, repository, roleSnapshot, secondScope, service, w4Service: w4 };
}

describe("M4 governed multi-path counterfactual transfer", () => {
  it("returns two deterministic non-official paths, preserves lineage, and never writes truth", async () => {
    const arranged = await arrange();
    const before = arranged.repository.snapshot();
    const teacher = await arranged.service.create(arranged.secondScope, arranged.input, "teacher");
    const repeated = await arranged.service.create(arranged.secondScope, arranged.input, "teacher");

    expect(teacher.schema_version).toBe("m4-multipath-counterfactual-transfer.v1");
    expect(teacher.visibility).toBe("teacher_safe");
    expect(teacher.official_path.outcome_id).toBe(arranged.official.outcome_id);
    expect(teacher.official_path.officiality).toBe("OFFICIAL");
    expect(teacher.paths).toHaveLength(2);
    expect(teacher.paths.every((path) => path.officiality === "NON_OFFICIAL")).toBe(true);
    expect(teacher.paths.map((path) => path.path_id)).toEqual(["path_a", "path_b"]);
    expect(teacher.paths[0]?.path_digest).not.toBe(teacher.paths[1]?.path_digest);
    expect(teacher.lineage.preserved_dissent_role_keys).toEqual(["CFO"]);
    expect(teacher.lineage.resolution_id).toBe("resolution_1");
    expect(teacher.official_path.unchanged).toBe(true);
    expect(teacher.invariants).toEqual({
      official_decision_writes: false,
      official_settlement_writes: false,
      official_state_writes: false,
      apply_to_next_round: false,
      replay_writes_formal_results: false
    });
    expect(teacher).toEqual(repeated);
    expect(arranged.repository.snapshot()).toEqual(before);
  });

  it("returns a role-safe student explanation without private dissent or raw state payloads", async () => {
    const arranged = await arrange();
    const student = await arranged.service.create(arranged.secondScope, arranged.input, "student");

    expect(student.visibility).toBe("student_safe");
    expect(student.student_transfer.role_safe).toBe(true);
    expect(student.student_transfer.visible_path_ids).toEqual(["path_a", "path_b"]);
    expect(student.student_transfer.excluded_fields).toContain("private_dissent_notes");
    expect(student.student_transfer.excluded_fields).toContain("raw_counterfactual_state");
    expect(JSON.stringify(student)).not.toContain("private dissent note");
    expect(JSON.stringify(student)).not.toContain("do not expose");
    expect(student.paths[0]).not.toHaveProperty("rounds");
    expect(student.transfer.apply_to_next_round).toBe(false);
  });

  it("fails closed for path-count, official re-entry, runtime, and role-lineage mismatches", async () => {
    const arranged = await arrange();
    const cases: Array<[string, M4MultipathCounterfactualInput, string]> = [
      [
        "one path",
        { ...arranged.input, paths: [arranged.input.paths[0]!] },
        "M4_PATH_COUNT_INVALID"
      ],
      [
        "four paths",
        {
          ...arranged.input,
          paths: [
            ...arranged.input.paths,
            { path_id: "path_c", label: "third", decision_ids: ["counter_path_a"] },
            { path_id: "path_d", label: "fourth", decision_ids: ["counter_path_b"] }
          ]
        },
        "M4_PATH_COUNT_INVALID"
      ],
      [
        "official decision re-entry",
        {
          ...arranged.input,
          paths: arranged.input.paths.map((path) => ({
            ...path,
            decision_ids: ["official_source_decision"]
          }))
        },
        "M4_OFFICIAL_DECISION_REENTRY_BLOCKED"
      ],
      [
        "runtime mismatch",
        { ...arranged.input, seed: arranged.input.seed + 1 },
        "M4_RUNTIME_BINDING_CONFLICT"
      ]
    ];

    for (const [label, input, code] of cases) {
      await expect(
        arranged.service.create(arranged.secondScope, input, "teacher"),
        label
      ).rejects.toMatchObject<M4MultipathCounterfactualTransferError>({ code });
    }

    const noLineageService = createM4MultipathCounterfactualTransferService({
      roleWorkflow: {
        async readRoleWorkflow() {
          return {
            ...arranged.roleSnapshot,
            sections: [],
            resolutions: [],
            acknowledgements: []
          };
        },
        async commitRoleWorkflow() {
          throw new Error("M4_TEST_MUST_NOT_WRITE_ROLE_WORKFLOW");
        }
      },
      w4Repository: arranged.repository,
      w4Service: arranged.w4Service
    });
    await expect(
      noLineageService.create(arranged.secondScope, arranged.input, "teacher")
    ).rejects.toMatchObject<M4MultipathCounterfactualTransferError>({
      code: "M4_ROLE_LINEAGE_REQUIRED"
    });
  });
});
