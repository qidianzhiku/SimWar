import type {
  Course,
  CurrentUser,
  Round,
  Run,
  Team,
  ValidationSessionParticipant
} from "@simwar/shared-contracts";
import type { ValidationEnvironmentLaunch } from "@simwar/shared-contracts";
import { getActiveJsonRuntimeEngineProfile } from "./formal-runtime-input-resolver.js";
import { createFormalBoundRun } from "./formal-bound-run-creation-service.js";
import { createFormalCourseAuthorityBinding } from "./formal-course-authority-binding.js";
import { createTeacherCourseFromBlueprint } from "./teacher-course-blueprint-service.js";
import type { CourseBlueprintCommandService } from "./course-blueprint-authority.js";
import type { CourseBlueprintBindingPort } from "./course-blueprint-binding-store.js";
import type { FormalCourseAuthorityBindingPort } from "./formal-course-authority-binding-store.js";
import type { FormalRunRuntimeBindingPort } from "./formal-run-runtime-binding-store.js";
import type { FormalRunBindingAuthorityPorts } from "./formal-run-runtime-binding.js";
import type { RepositoryProvider } from "./repository-provider.js";
import type { RoleWorkflowCommandService } from "./role-workflow.js";
import type { TenantBaselineProvisioningService } from "./tenant-baseline-provisioning.js";
import type { ValidationSessionControlPlane } from "./validation-session-control-plane.js";
import type {
  ValidationEnvironmentLaunchStepExecutor,
  W025LaunchHook
} from "./validation-environment-launch.js";
import { digest } from "./validation-environment-launch.js";
import {
  isDeliveryReadyCoursePackage,
  type CoursePackageQueryService
} from "./course-package-query-service.js";

export interface W025LaunchExecutorDependencies {
  readonly actor: CurrentUser;
  readonly requestId: string;
  readonly repositoryProvider: RepositoryProvider;
  readonly formalRunBindingAuthorities: FormalRunBindingAuthorityPorts;
  readonly formalCourseBlueprints: CourseBlueprintCommandService;
  readonly coursePackageQueries: CoursePackageQueryService;
  readonly courseBlueprintBindingStore: CourseBlueprintBindingPort;
  readonly formalCourseAuthorityBindingStore: FormalCourseAuthorityBindingPort;
  readonly formalRunRuntimeBindingStore: FormalRunRuntimeBindingPort;
  readonly tenantBaselineProvisioning: TenantBaselineProvisioningService;
  readonly roleWorkflow: RoleWorkflowCommandService;
  readonly validationSessions: ValidationSessionControlPlane;
  readonly ensureUser: (input: {
    tenant_id: string;
    user_id: string;
    display_name: string;
  }) => Promise<void>;
  readonly afterStep?:
    | ((hook: W025LaunchHook, launch: ValidationEnvironmentLaunch) => Promise<void>)
    | undefined;
}

function sameRef(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return Object.keys(right).every((key) => left[key] === right[key]);
}

function deterministicId(prefix: string, launchId: string, suffix: string): string {
  return `${prefix}_${launchId.slice(-16)}_${suffix}`;
}

export function createW025LaunchExecutor(
  dependencies: W025LaunchExecutorDependencies
): ValidationEnvironmentLaunchStepExecutor {
  const { actor } = dependencies;
  return {
    async afterStep(hook, launch) {
      await dependencies.afterStep?.(hook, launch);
    },
    async prepareBaseline(input, launch) {
      const parameter = await dependencies.formalRunBindingAuthorities.parameterSets.getByReference(
        input.source_parameter_set.tenant_id,
        input.source_parameter_set.reference
      );
      const scenario = await dependencies.formalRunBindingAuthorities.scenarios.getByReference(
        input.source_scenario_package.tenant_id,
        input.source_scenario_package.reference
      );
      if (!parameter || !scenario) throw new Error("W025_BASELINE_SOURCE_NOT_FOUND");
      const parameterRecord = parameter as unknown as {
        parameter_set_id: string;
        version: string;
        content_digest: string;
      };
      const scenarioRecord = scenario as unknown as {
        scenario_package_id: string;
        version: string;
        content_digest: string;
        tenant_id: string;
      };
      const result = await dependencies.tenantBaselineProvisioning.provision(
        { actor_id: actor.user_id, correlation_id: dependencies.requestId },
        {
          idempotency_key: `w025:${launch.business_key_digest}`,
          target_tenant_id: input.target_tenant_id,
          source_parameter_set: {
            content_digest: parameterRecord.content_digest,
            parameter_set_id: parameterRecord.parameter_set_id,
            source_tenant_id: input.source_parameter_set.tenant_id,
            version: parameterRecord.version
          },
          source_scenario_package: {
            content_digest: scenarioRecord.content_digest,
            scenario_package_id: scenarioRecord.scenario_package_id,
            source_tenant_id: input.source_scenario_package.tenant_id,
            tenant_id: input.source_scenario_package.tenant_id,
            version: scenarioRecord.version
          }
        },
        async (materialized) => {
          await dependencies.repositoryProvider.facade.auditLogs.appendAuditLog({
            audit_id: dependencies.repositoryProvider.idGenerator.createAuditLogId(),
            tenant_id: input.target_tenant_id,
            actor_id: actor.user_id,
            actor_role: actor.roles[0] ?? "learner",
            action: "tenant_baseline.provision",
            resource_type: "tenant_baseline_provisioning",
            resource_id: materialized.audit_identity,
            request_id: dependencies.requestId,
            created_at: new Date().toISOString(),
            after: JSON.parse(JSON.stringify(materialized)) as Record<string, unknown>
          });
        }
      );
      return {
        receipt: JSON.stringify({
          audit_identity: result.audit_identity,
          outcome: result.outcome,
          parameter_set: result.parameter_set.reference,
          provenance: result.provenance,
          scenario_package: result.scenario_package.reference
        })
      };
    },

    async prepareCourseRun(input, launch) {
      const courseId = deterministicId("w025_course", launch.launch_id, "formal");
      const runId = deterministicId("w025_run", launch.launch_id, "formal");
      const roundId = deterministicId("w025_round", launch.launch_id, "01");
      let course = await dependencies.repositoryProvider.facade.courses.getCourse(
        input.target_tenant_id,
        courseId
      );
      const coursePackage = await dependencies.coursePackageQueries.getByReference(
        input.target_tenant_id,
        input.course_package_reference
      );
      if (!isDeliveryReadyCoursePackage(coursePackage))
        throw new Error("W025_COURSE_PACKAGE_NOT_AVAILABLE");
      if (
        !sameRef(
          coursePackage.course_blueprint_reference as unknown as Record<string, unknown>,
          input.course_blueprint_reference as unknown as Record<string, unknown>
        )
      )
        throw new Error("W025_COURSE_BLUEPRINT_REFERENCE_MISMATCH");

      if (!course) {
        course = {
          course_id: courseId,
          created_by: actor.user_id,
          parameter_set_id: coursePackage.parameter_set_reference.parameter_set_id,
          scenario_package_id: coursePackage.scenario_package_reference.scenario_package_id,
          status: "draft",
          tenant_id: input.target_tenant_id,
          title: input.course_title
        } satisfies Course;
        await createTeacherCourseFromBlueprint(dependencies.formalCourseBlueprints, {
          bindingStore: dependencies.courseBlueprintBindingStore,
          course,
          course_blueprint_reference: input.course_blueprint_reference,
          formalCourse: {
            authorities: dependencies.formalRunBindingAuthorities,
            bindingStore: dependencies.formalCourseAuthorityBindingStore,
            persistence: dependencies.repositoryProvider.facade.courses,
            scenario_package_reference: coursePackage.scenario_package_reference,
            tenant_id: input.target_tenant_id
          },
          formal_course: {
            authorities: dependencies.formalRunBindingAuthorities,
            scenario_package_reference: coursePackage.scenario_package_reference,
            tenant_id: input.target_tenant_id
          }
        });
        course.status = "published";
        await dependencies.repositoryProvider.facade.courses.saveCourse(course);
      } else if (course.status !== "published" && course.status !== "active") {
        course.status = "published";
        await dependencies.repositoryProvider.facade.courses.saveCourse(course);
      }

      let binding = await dependencies.formalCourseAuthorityBindingStore.getForCourse(
        input.target_tenant_id,
        courseId
      );
      if (!binding) {
        const profile = getActiveJsonRuntimeEngineProfile();
        binding = await createFormalCourseAuthorityBinding({
          authorities: dependencies.formalRunBindingAuthorities,
          course_id: courseId,
          engine_reference: { engine_id: profile.engine_id, version: profile.version },
          parameter_set_reference: coursePackage.parameter_set_reference,
          scenario_package_reference: coursePackage.scenario_package_reference,
          tenant_id: input.target_tenant_id
        });
        await dependencies.formalCourseAuthorityBindingStore.append(binding);
      }

      let run = await dependencies.repositoryProvider.facade.runs.getRun(
        input.target_tenant_id,
        runId
      );
      let round = await dependencies.repositoryProvider.facade.rounds.getRound(
        input.target_tenant_id,
        roundId
      );
      if (!run || !round) {
        run = {
          course_id: courseId,
          parameter_set_id: course.parameter_set_id,
          run_id: runId,
          scenario_package_id: course.scenario_package_id,
          seed: input.seed,
          status: "active",
          tenant_id: input.target_tenant_id
        } satisfies Run;
        round = {
          round_id: roundId,
          round_no: 1,
          run_id: runId,
          status: "draft",
          tenant_id: input.target_tenant_id
        } satisfies Round;
        await createFormalBoundRun({
          authorities: dependencies.formalRunBindingAuthorities,
          bindingStore: dependencies.formalRunRuntimeBindingStore,
          courseBinding: binding,
          persistence: {
            deleteRound: dependencies.repositoryProvider.facade.rounds.deleteRound,
            deleteRun: dependencies.repositoryProvider.facade.runs.deleteRun,
            saveRound: dependencies.repositoryProvider.facade.rounds.saveRound,
            saveRun: dependencies.repositoryProvider.facade.runs.saveRun
          },
          round,
          run
        });
      }
      return {
        course_id: courseId,
        run_id: runId,
        round_id: roundId,
        receipt: JSON.stringify({ binding, course, run, round })
      };
    },

    async prepareCohort(input, launch) {
      const runId = launch.run_id;
      const courseId = launch.course_id;
      if (!runId || !courseId) throw new Error("W025_COURSE_RUN_HISTORY_MISSING");
      const workflowActor = {
        actor_id: actor.user_id,
        actor_role: "teacher" as const,
        tenant_id: input.target_tenant_id
      };
      const teamIds: string[] = [];
      for (const template of input.cohort_template.teams) {
        const teamId = deterministicId("w025_team", launch.launch_id, template.team_key);
        teamIds.push(teamId);
        for (const member of template.members) {
          await dependencies.ensureUser({
            tenant_id: input.target_tenant_id,
            user_id: member.user_id,
            display_name: member.display_name
          });
        }
        let team = await dependencies.repositoryProvider.facade.teams.getTeam(
          input.target_tenant_id,
          teamId
        );
        if (!team) {
          team = {
            captain_user_id: template.members.find((member) => member.role_slot === "CEO")!.user_id,
            course_id: courseId,
            members: template.members.map((member) => ({ ...member })),
            name: template.name,
            team_id: teamId,
            tenant_id: input.target_tenant_id
          } satisfies Team;
          await dependencies.repositoryProvider.facade.teams.createTeamWithCaptain(team);
        }
        const workflow = await dependencies.repositoryProvider.ports.roleWorkflow.readRoleWorkflow({
          tenant_id: input.target_tenant_id,
          run_id: runId,
          team_id: teamId
        });
        for (const member of team.members) {
          if (member.role_slot === "risk") throw new Error("W025_UNSUPPORTED_ROLE_SLOT");
          if (
            workflow.assignments.some(
              (assignment) =>
                assignment.status === "active" &&
                assignment.user_id === member.user_id &&
                assignment.role_key === member.role_slot
            )
          )
            continue;
          await dependencies.roleWorkflow.assignRole(workflowActor, {
            course_id: courseId,
            role_key: member.role_slot,
            run_id: runId,
            team_id: teamId,
            user_id: member.user_id
          });
        }
      }
      return {
        team_ids: teamIds,
        receipt: JSON.stringify({
          team_ids: teamIds,
          cohort_template_digest: input.cohort_template_digest
        })
      };
    },

    async prepareSession(input, launch) {
      if (!launch.course_id || !launch.run_id || !launch.team_ids?.length)
        throw new Error("W025_COHORT_HISTORY_MISSING");
      const firstTeamId = launch.team_ids[0];
      if (!firstTeamId) throw new Error("W025_COHORT_HISTORY_MISSING");
      await dependencies.ensureUser({
        tenant_id: input.target_tenant_id,
        user_id: actor.user_id,
        display_name: actor.display_name
      });
      const machineAdmissionReference = `w025:${launch.business_key_digest}`;
      const machineAdmissionDigest = digest({
        launch,
        cohort_template_digest: input.cohort_template_digest
      });
      const session = await dependencies.validationSessions.create(
        actor,
        input.target_tenant_id,
        {
          source_product_merge_sha: input.source_product_merge_sha,
          course_id: launch.course_id,
          run_id: launch.run_id,
          machine_admission_reference: machineAdmissionReference,
          machine_admission_digest: machineAdmissionDigest,
          idempotency_key: machineAdmissionReference
        },
        dependencies.requestId
      );
      const firstMember = input.cohort_template.teams[0]!.members[0]!;
      const participants: ValidationSessionParticipant[] = [
        {
          participant_id: actor.user_id,
          participant_kind: "SYNTHETIC",
          product_user_id: actor.user_id,
          session_duty: "TEACHER"
        },
        {
          participant_id: firstMember.user_id,
          participant_kind: "SYNTHETIC",
          product_user_id: firstMember.user_id,
          role_key: firstMember.role_slot,
          session_duty: "LEARNER",
          team_id: firstTeamId
        },
        {
          participant_id: `${launch.launch_id}:moderator`,
          participant_kind: "SYNTHETIC",
          session_duty: "MODERATOR"
        },
        {
          participant_id: `${launch.launch_id}:observer`,
          participant_kind: "SYNTHETIC",
          session_duty: "OBSERVER"
        },
        {
          participant_id: `${launch.launch_id}:recorder`,
          participant_kind: "SYNTHETIC",
          session_duty: "RECORDER"
        }
      ];
      const rostered = await dependencies.validationSessions.setRoster(
        actor,
        input.target_tenant_id,
        session.session_id,
        participants,
        dependencies.requestId
      );
      const preflight = await dependencies.validationSessions.preflight(
        actor,
        input.target_tenant_id,
        rostered.session_id,
        dependencies.requestId
      );
      if (preflight.status !== "PREFLIGHT_READY") throw new Error("W025_PREFLIGHT_BLOCKED");
      return {
        session_id: preflight.session_id,
        preflight_status: "PREFLIGHT_READY",
        receipt: JSON.stringify({
          session_id: preflight.session_id,
          preflight: preflight.preflight
        })
      };
    }
  };
}
