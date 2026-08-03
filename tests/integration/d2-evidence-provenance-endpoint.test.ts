import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession, RoleWorkflowEvent } from "@simwar/shared-contracts";
import {
  createCoursePackageDraftVersion,
  createCoursePackageLifecycleSnapshot
} from "../../services/api/src/course-package-json-registry.js";
import {
  LearningDesignCommandService,
  LearningDesignJsonRegistry
} from "../../services/api/src/learning-design.js";
import { createApiServer } from "../../services/api/src/server.js";
import { createP1Store, type SimWarStore } from "../../services/api/src/store.js";

const tenantId = "tenant_demo";
const packageDigest = "a".repeat(64);
const goalDigest = "b".repeat(64);
const packageReference = {
  content_digest: packageDigest,
  course_package_id: "package_d2",
  tenant_id: tenantId,
  version: "1.0.0"
};

async function startServer(store: SimWarStore): Promise<{ baseUrl: string; server: Server }> {
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

async function login(baseUrl: string, username: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    body: JSON.stringify({ password: username, username }),
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as ApiEnvelope<AuthSession>).data.access_token;
}

async function seedD2Authority(): Promise<SimWarStore> {
  const store = createP1Store();
  const packageDraft = createCoursePackageDraftVersion({
    actor_id: "usr_teacher",
    draft: {
      course_blueprint_reference: {
        content_digest: packageDigest,
        course_blueprint_id: "blueprint_d2",
        tenant_id: tenantId,
        version: "1.0.0"
      },
      course_package_id: packageReference.course_package_id,
      description: "D2 package",
      parameter_set_reference: {
        content_digest: packageDigest,
        parameter_set_id: "param_toy_approved_1",
        version: "1.0.0"
      },
      scenario_package_reference: {
        content_digest: packageDigest,
        scenario_package_id: "scenario_eldercare_demo",
        tenant_id: tenantId,
        version: "1.0.0"
      },
      title: "D2 package",
      version: "1.0.0"
    },
    now: "2026-08-03T00:00:00.000Z",
    tenant_id: tenantId
  });
  store.coursePackageLifecycleSnapshots.push(
    packageDraft,
    createCoursePackageLifecycleSnapshot(packageDraft, "VALIDATED"),
    createCoursePackageLifecycleSnapshot(packageDraft, "AVAILABLE")
  );
  const publishedPackageReference = {
    ...packageReference,
    content_digest: packageDraft.content_digest
  };

  const designRegistry = new LearningDesignJsonRegistry({ now: () => "2026-08-03T00:00:00.000Z" });
  const design = new LearningDesignCommandService(designRegistry, {
    getByReference: async () => ({ status: "AVAILABLE" })
  });
  const actor = { actor_id: "usr_teacher", tenant_id: tenantId };
  const goalDraft = await design.createGoalDraft(actor, {
    activity_refs: [{ activity_id: "activity_d2", content_digest: goalDigest, version: "1.0.0" }],
    course_package_reference: publishedPackageReference,
    expected_evidence_classes: ["observation"],
    goal_id: "goal_d2",
    observable_behaviors: ["connect an event to an exact source"],
    role_scope: ["CEO"],
    statement: "Connect an event to an exact source.",
    title: "D2 goal",
    version: "1.0.0"
  });
  const goalValidated = await design.validateGoal(actor, {
    content_digest: goalDraft.content_digest,
    goal_id: goalDraft.goal_id,
    tenant_id: tenantId,
    version: goalDraft.version
  });
  const goal = await design.publishGoal(actor, {
    content_digest: goalValidated.content_digest,
    goal_id: goalValidated.goal_id,
    tenant_id: tenantId,
    version: goalValidated.version
  });
  const rubricDraft = await design.createRubricDraft(actor, {
    course_package_reference: publishedPackageReference,
    criteria: [{ criterion_id: "criterion_d2", levels: [{ description: "traceable", label: "ready", ordinal: 1 }], prompt: "Trace?" }],
    learning_goal_references: [{ content_digest: goal.content_digest, goal_id: goal.goal_id, tenant_id: tenantId, version: goal.version }],
    rubric_id: "rubric_d2",
    title: "D2 rubric",
    version: "1.0.0"
  });
  const rubricValidated = await design.validateRubric(actor, {
    content_digest: rubricDraft.content_digest,
    rubric_id: rubricDraft.rubric_id,
    tenant_id: tenantId,
    version: rubricDraft.version
  });
  const rubric = await design.publishRubric(actor, {
    content_digest: rubricValidated.content_digest,
    rubric_id: rubricValidated.rubric_id,
    tenant_id: tenantId,
    version: rubricValidated.version
  });
  store.learningGoalVersions.push(goalDraft, goalValidated, goal);
  store.rubricVersions.push(rubricDraft, rubricValidated, rubric);

  store.runs.push({
    course_id: "course_demo",
    parameter_set_id: "param_toy_approved_1",
    run_id: "run_d2",
    scenario_package_id: "scenario_eldercare_demo",
    seed: 7,
    status: "active",
    tenant_id: tenantId
  });
  store.studentRoleAssignments.push({
    assigned_at: "2026-08-03T00:00:00.000Z",
    assigned_by: "usr_teacher",
    assignment_id: "assignment_d2",
    role_key: "CEO",
    run_id: "run_d2",
    status: "active",
    team_id: "team_alpha",
    tenant_id: tenantId,
    user_id: "usr_student"
  });
  const event: RoleWorkflowEvent = {
    actor_id: "usr_student",
    created_at: "2026-08-03T00:00:00.000Z",
    event_id: "event_d2_ready",
    event_type: "section_ready",
    resource_id: "section_d2",
    run_id: "run_d2",
    team_id: "team_alpha",
    tenant_id: tenantId
  };
  store.roleWorkflowEvents.push(event);
  return store;
}

function captureBody(packageDigestValue: string, goalDigestValue: string, rubricDigestValue: string) {
  return {
    activity_id: "activity_d2",
    course_id: "course_demo",
    course_package_ref: {
      content_digest: packageDigestValue,
      discriminator: "exact_ref",
      resource_id: "package_d2",
      resource_type: "course_package_version",
      tenant_id: tenantId,
      version: "1.0.0"
    },
    learning_goal_ref: {
      content_digest: goalDigestValue,
      discriminator: "exact_ref",
      resource_id: "goal_d2",
      resource_type: "learning_goal_version",
      tenant_id: tenantId,
      version: "1.0.0"
    },
    role_key: "CEO",
    rubric_ref: {
      content_digest: rubricDigestValue,
      discriminator: "exact_ref",
      resource_id: "rubric_d2",
      resource_type: "rubric_version",
      tenant_id: tenantId,
      version: "1.0.0"
    },
    run_id: "run_d2",
    source_event_id: "event_d2_ready",
    team_id: "team_alpha"
  };
}

describe("D2 evidence provenance endpoint", () => {
  it("captures only eligible events, returns safe provenance, and is idempotent", async () => {
    const store = await seedD2Authority();
    const { baseUrl, server } = await startServer(store);
    try {
      const teacher = await login(baseUrl, "teacher");
      const student = await login(baseUrl, "student");
      const packageDigestValue = store.coursePackageLifecycleSnapshots.at(-1)?.content_digest;
      const goalDigestValue = store.learningGoalVersions.at(-1)?.content_digest;
      const rubricDigestValue = store.rubricVersions.at(-1)?.content_digest;
      if (!packageDigestValue || !goalDigestValue || !rubricDigestValue) throw new Error("D2 seed incomplete");
      const headers = {
        authorization: `Bearer ${teacher}`,
        "content-type": "application/json",
        "x-tenant-id": tenantId
      };
      const listed = await fetch(
        `${baseUrl}/api/v1/bff/teacher/evidence?activity_id=activity_d2&course_id=course_demo&role_key=CEO&run_id=run_d2&team_id=team_alpha`,
        { headers }
      );
      expect(listed.status).toBe(200);
      const listBody = (await listed.json()) as ApiEnvelope<{ eligible_events: unknown[]; artifacts: unknown[] }>;
      expect(listBody.data.eligible_events).toHaveLength(1);
      expect(listBody.data.artifacts).toHaveLength(0);

      const first = await fetch(`${baseUrl}/api/v1/bff/teacher/evidence-artifacts/capture`, {
        body: JSON.stringify(captureBody(packageDigestValue, goalDigestValue, rubricDigestValue)),
        headers,
        method: "POST"
      });
      expect(first.status).toBe(201);
      const firstBody = await first.json();
      expect(firstBody.data.data.status).toBe("generated");
      expect(firstBody.data.data.artifact.visibility).toBe("teacher_only");
      expect(firstBody.data.data.artifact.private_payload).toBeUndefined();
      expect(firstBody.data.formal_truth_write).toBe(false);

      const second = await fetch(`${baseUrl}/api/v1/bff/teacher/evidence-artifacts/capture`, {
        body: JSON.stringify(captureBody(packageDigestValue, goalDigestValue, rubricDigestValue)),
        headers,
        method: "POST"
      });
      expect(second.status).toBe(201);
      expect((await second.json()).data.data.status).toBe("reused");

      const studentRoute = await fetch(`${baseUrl}/api/v1/bff/student/evidence`, {
        headers: { authorization: `Bearer ${student}`, "x-tenant-id": tenantId }
      });
      expect(studentRoute.status).toBe(404);
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  it("fails closed on extra body fields and wrong tenant refs", async () => {
    const store = await seedD2Authority();
    const { baseUrl, server } = await startServer(store);
    try {
      const teacher = await login(baseUrl, "teacher");
      const packageDigestValue = store.coursePackageLifecycleSnapshots.at(-1)?.content_digest;
      const goalDigestValue = store.learningGoalVersions.at(-1)?.content_digest;
      const rubricDigestValue = store.rubricVersions.at(-1)?.content_digest;
      if (!packageDigestValue || !goalDigestValue || !rubricDigestValue) throw new Error("D2 seed incomplete");
      const headers = {
        authorization: `Bearer ${teacher}`,
        "content-type": "application/json",
        "x-tenant-id": tenantId
      };
      const extraField = await fetch(`${baseUrl}/api/v1/bff/teacher/evidence-artifacts/capture`, {
        body: JSON.stringify({ ...captureBody(packageDigestValue, goalDigestValue, rubricDigestValue), private_payload: { secret: true } }),
        headers,
        method: "POST"
      });
      expect(extraField.status).toBe(422);
      const wrongTenant = captureBody(packageDigestValue, goalDigestValue, rubricDigestValue);
      wrongTenant.learning_goal_ref.tenant_id = "tenant_other";
      const tenantResponse = await fetch(`${baseUrl}/api/v1/bff/teacher/evidence-artifacts/capture`, {
        body: JSON.stringify(wrongTenant),
        headers,
        method: "POST"
      });
      expect(tenantResponse.status).toBe(422);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
