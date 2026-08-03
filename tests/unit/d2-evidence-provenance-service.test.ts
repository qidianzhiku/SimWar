import { describe, expect, it } from "vitest";
import type {
  Course,
  RoleWorkflowEvent,
  Run,
  StudentRoleAssignment,
  Team
} from "@simwar/shared-contracts";
import {
  EvidenceCaptureCommandService,
  D2EvidenceError
} from "../../services/api/src/evidence-provenance.js";
import type {
  EvidenceProvenanceCaptureCommand,
  EvidenceProvenanceRepositoryPort,
  RoleWorkflowRepositoryPort
} from "../../services/api/src/repository-ports.js";

const digest = "a".repeat(64);
const tenantId = "tenant_d2";
const courseId = "course_d2";
const runId = "run_d2";
const teamId = "team_d2";
const roleKey = "CMO";
const coursePackageRef = {
  content_digest: digest,
  discriminator: "exact_ref" as const,
  resource_id: "package_d2",
  resource_type: "course_package_version" as const,
  tenant_id: tenantId,
  version: "1.0.0"
};
const learningGoalRef = {
  content_digest: digest,
  discriminator: "exact_ref" as const,
  resource_id: "goal_d2",
  resource_type: "learning_goal_version" as const,
  tenant_id: tenantId,
  version: "1.0.0"
};
const rubricRef = {
  content_digest: digest,
  discriminator: "exact_ref" as const,
  resource_id: "rubric_d2",
  resource_type: "rubric_version" as const,
  tenant_id: tenantId,
  version: "1.0.0"
};

const course: Course = {
  course_id: courseId,
  created_by: "usr_teacher",
  parameter_set_id: "parameters_demo",
  scenario_package_id: "scenario_demo",
  status: "active",
  tenant_id: tenantId,
  title: "D2 course"
};
const run: Run = {
  course_id: courseId,
  parameter_set_id: "parameters_demo",
  run_id: runId,
  scenario_package_id: "scenario_demo",
  seed: 7,
  status: "active",
  tenant_id: tenantId
};
const team: Team = {
  captain_user_id: "usr_teacher",
  course_id: courseId,
  members: [{ display_name: "Teacher", role_slot: roleKey, user_id: "usr_student" }],
  name: "D2 team",
  team_id: teamId,
  tenant_id: tenantId
};
const assignment: StudentRoleAssignment = {
  assigned_at: "2026-08-03T00:00:00.000Z",
  assigned_by: "usr_teacher",
  assignment_id: "assignment_d2",
  role_key: roleKey,
  run_id: runId,
  status: "active",
  team_id: teamId,
  tenant_id: tenantId,
  user_id: "usr_student"
};
const event: RoleWorkflowEvent = {
  actor_id: "usr_student",
  created_at: "2026-08-03T00:00:00.000Z",
  event_id: "event_ready_d2",
  event_type: "section_ready",
  resource_id: "section_d2",
  run_id: runId,
  team_id: teamId,
  tenant_id: tenantId
};

function input() {
  return {
    activity_id: "activity_d2",
    course_id: courseId,
    course_package_ref: coursePackageRef,
    learning_goal_ref: learningGoalRef,
    role_key: roleKey,
    rubric_ref: rubricRef,
    run_id: runId,
    source_event_id: event.event_id,
    team_id: teamId
  };
}

function createHarness(options: { persist?: () => void } = {}) {
  const artifacts: EvidenceProvenanceCaptureCommand["artifact"][] = [];
  const edges: EvidenceProvenanceCaptureCommand["provenance_edges"] = [];
  const audits: EvidenceProvenanceCaptureCommand["audit_log"][] = [];
  const repository: EvidenceProvenanceRepositoryPort = {
    async listEvidenceArtifacts() {
      return structuredClone(artifacts);
    },
    async listProvenanceEdges() {
      return structuredClone(edges);
    },
    async appendEvidenceCapture(command) {
      artifacts.push(structuredClone(command.artifact));
      edges.push(...structuredClone(command.provenance_edges));
      audits.push(structuredClone(command.audit_log));
      try {
        options.persist?.();
      } catch (error) {
        artifacts.splice(0, artifacts.length);
        edges.splice(0, edges.length);
        audits.splice(0, audits.length);
        throw error;
      }
    }
  };
  const roleWorkflow: RoleWorkflowRepositoryPort = {
    readRoleWorkflow: () => ({
      assignments: [assignment],
      confirmations: [],
      course,
      decisions: [],
      events: [event],
      merge_commits: [],
      round: null,
      run,
      sections: [],
      team
    })
  };
  const service = new EvidenceCaptureCommandService({
    coursePackages: {
      getByReference: async () => ({
        content_digest: digest,
        course_package_id: coursePackageRef.resource_id,
        status: "AVAILABLE",
        tenant_id: tenantId,
        version: coursePackageRef.version
      })
    },
    learningDesign: {
      getGoal: async () => ({
        course_package_reference: { ...coursePackageRef, course_package_id: coursePackageRef.resource_id },
        content_digest: digest,
        goal_id: learningGoalRef.resource_id,
        status: "PUBLISHED",
        tenant_id: tenantId,
        version: learningGoalRef.version
      } as never),
      getRubric: async () => ({
        course_package_reference: { ...coursePackageRef, course_package_id: coursePackageRef.resource_id },
        content_digest: digest,
        rubric_id: rubricRef.resource_id,
        status: "PUBLISHED",
        tenant_id: tenantId,
        version: rubricRef.version
      } as never)
    },
    now: () => "2026-08-03T00:00:00.000Z",
    repository,
    roleWorkflow
  });
  return { artifacts, audits, edges, roleWorkflow, service };
}

describe("D2 EvidenceCaptureCommandService", () => {
  it("generates an immutable artifact and provenance edges, then reuses it", async () => {
    const { artifacts, audits, edges, service } = createHarness();
    const actor = { actor_id: "usr_teacher", tenant_id: tenantId };
    const first = await service.capture(actor, input(), "request_1");
    const second = await service.capture(actor, input(), "request_2");
    expect(first.data.status).toBe("generated");
    expect(second.data.status).toBe("reused");
    expect(artifacts).toHaveLength(1);
    expect(edges).toHaveLength(3);
    expect(audits).toHaveLength(1);
    expect(first.formal_truth_write).toBe(false);
    expect(first.data.artifact.visibility).toBe("teacher_only");
    expect("private_payload" in first.data.artifact).toBe(false);
  });

  it("rejects unsupported events and cross-tenant references before writing", async () => {
    const harness = createHarness();
    const originalRead = harness.roleWorkflow.readRoleWorkflow;
    harness.roleWorkflow.readRoleWorkflow = () => ({
      ...originalRead({ run_id: runId, team_id: teamId, tenant_id: tenantId }),
      events: [{ ...event, event_type: "section_saved" }]
    });
    await expect(harness.service.capture({ actor_id: "usr_teacher", tenant_id: tenantId }, input(), "request_1"))
      .rejects.toMatchObject({ code: "D2_EVIDENCE_EVENT_NOT_ELIGIBLE" });
    await expect(
      harness.service.capture(
        { actor_id: "usr_teacher", tenant_id: tenantId },
        { ...input(), learning_goal_ref: { ...learningGoalRef, tenant_id: "tenant_other" } },
        "request_2"
      )
    ).rejects.toBeInstanceOf(D2EvidenceError);
    expect(harness.artifacts).toHaveLength(0);
  });

  it("compensates in-memory state when audit persistence fails", async () => {
    const harness = createHarness({ persist: () => { throw new Error("audit unavailable"); } });
    await expect(
      harness.service.capture({ actor_id: "usr_teacher", tenant_id: tenantId }, input(), "request_1")
    ).rejects.toThrow("audit unavailable");
    expect(harness.artifacts).toHaveLength(0);
    expect(harness.edges).toHaveLength(0);
    expect(harness.audits).toHaveLength(0);
  });
});
