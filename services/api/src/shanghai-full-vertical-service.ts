import type {
  ParameterSetReference,
  ScenarioPackageReference,
  W5ExactRuntimeBinding
} from "@simwar/shared-contracts";
import {
  SHANGHAI_FULL_VERTICAL_MISSION_ID,
  SHANGHAI_FULL_VERTICAL_SCHEMA_VERSION,
  type ShanghaiFullVerticalAdminProjection,
  type ShanghaiFullVerticalJourneyState,
  type ShanghaiFullVerticalStudentContext,
  type ShanghaiFullVerticalStudentProjection,
  type ShanghaiFullVerticalTeacherProjection
} from "@simwar/shared-contracts";
import {
  W5GovernedModelService,
  type W5ServiceActor,
  type W5ServiceScope
} from "./w5-governed-model-service.js";

export interface ShanghaiFullVerticalReadContext {
  course_id: string;
  current_parameter_set_reference: ParameterSetReference | null;
  current_scenario_package_reference: ScenarioPackageReference | null;
  draft_id: string | null;
  round_no: number | null;
  run_id: string | null;
  team_id?: string;
}

export type ShanghaiFullVerticalExactReadContext = ShanghaiFullVerticalReadContext & {
  current_parameter_set_reference: ParameterSetReference;
  current_scenario_package_reference: ScenarioPackageReference;
  draft_id: string;
  round_no: number;
  run_id: string;
};

export class ShanghaiFullVerticalError extends Error {
  constructor(
    readonly code:
      | "SHANGHAI_FULL_VERTICAL_EXACT_BINDING_REQUIRED"
      | "SHANGHAI_FULL_VERTICAL_SCOPE_CONFLICT"
  ) {
    super(code);
    this.name = "ShanghaiFullVerticalError";
  }
}

const ACTIVITY_ID = "main-sh-fv-o1-governed-shanghai-full-vertical";
const SYNTHETIC_LIMIT =
  "Shanghai inputs are bounded synthetic teaching assumptions; calibration is not proven.";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sameParameterSet(left: ParameterSetReference, right: ParameterSetReference): boolean {
  return (
    left.content_digest === right.content_digest &&
    left.parameter_set_id === right.parameter_set_id &&
    left.version === right.version
  );
}

function sameScenarioPackage(
  left: ScenarioPackageReference,
  right: ScenarioPackageReference
): boolean {
  return (
    left.content_digest === right.content_digest &&
    left.scenario_package_id === right.scenario_package_id &&
    left.tenant_id === right.tenant_id &&
    left.version === right.version
  );
}

function w5Scope(context: ShanghaiFullVerticalReadContext): W5ServiceScope {
  return {
    activity_id: ACTIVITY_ID,
    course_id: context.course_id,
    ...(context.run_id === null ? {} : { run_id: context.run_id }),
    ...(context.round_no === null ? {} : { round_no: context.round_no }),
    ...(context.team_id === undefined ? {} : { team_id: context.team_id })
  };
}

function exactStudentContext(
  context: ShanghaiFullVerticalExactReadContext,
  modelVersionRef: string
): ShanghaiFullVerticalStudentContext {
  return {
    course_id: context.course_id,
    draft_id: context.draft_id,
    model_version_ref: modelVersionRef,
    round_no: context.round_no,
    run_id: context.run_id
  };
}

function readyJourney(): ShanghaiFullVerticalJourneyState {
  return {
    admin_audit: "READY",
    exact_binding: true,
    student_projection: "READY",
    teacher_preview: "READY"
  };
}

function blockedJourney(exactBinding = false): ShanghaiFullVerticalJourneyState {
  return {
    admin_audit: "BLOCKED",
    exact_binding: exactBinding,
    student_projection: "BLOCKED",
    teacher_preview: "BLOCKED"
  };
}

export class ShanghaiFullVerticalService {
  constructor(private readonly governedModel: W5GovernedModelService) {}

  getTeacher(
    actor: W5ServiceActor,
    context: ShanghaiFullVerticalReadContext
  ): ShanghaiFullVerticalTeacherProjection {
    if (!context.course_id || actor.tenant_id.length === 0) {
      throw new ShanghaiFullVerticalError("SHANGHAI_FULL_VERTICAL_SCOPE_CONFLICT");
    }
    const teacherProjection = this.governedModel.getTeacherProjection(actor, w5Scope(context));
    const selectedDraft = context.draft_id
      ? this.governedModel.getDraft(actor, w5Scope(context), context.draft_id)
      : null;
    const canEvaluate =
      selectedDraft !== null &&
      context.run_id !== null &&
      context.round_no !== null &&
      context.current_parameter_set_reference !== null &&
      context.current_scenario_package_reference !== null;
    let binding: W5ExactRuntimeBinding | null = null;
    let preview = null;
    let ready = false;
    if (canEvaluate && selectedDraft) {
      const exact = this.requireExactBinding(
        selectedDraft.exact_runtime_binding,
        context as ShanghaiFullVerticalExactReadContext
      );
      binding = clone(exact);
      preview = this.governedModel.evaluate(
        actor,
        w5Scope(context),
        selectedDraft.draft_id,
        "STANDARD"
      );
      ready = true;
    }
    return {
      binding,
      exact_context: {
        course_id: context.course_id,
        draft_id: context.draft_id,
        round_no: context.round_no,
        run_id: context.run_id
      },
      journey: ready ? readyJourney() : blockedJourney(false),
      known_limits: [...new Set([...teacherProjection.known_limits, SYNTHETIC_LIMIT])],
      mission_id: SHANGHAI_FULL_VERTICAL_MISSION_ID,
      preview,
      schema_version: SHANGHAI_FULL_VERTICAL_SCHEMA_VERSION,
      status: ready ? "READY_WITH_LIMITS" : "NOT_READY",
      surface: "TEACHER",
      teacher_projection: teacherProjection
    };
  }

  getStudent(
    actor: W5ServiceActor,
    context: ShanghaiFullVerticalExactReadContext
  ): ShanghaiFullVerticalStudentProjection {
    const binding = this.requireDraftBinding(actor, context);
    if (!context.team_id) {
      throw new ShanghaiFullVerticalError("SHANGHAI_FULL_VERTICAL_SCOPE_CONFLICT");
    }
    const projection = this.governedModel.projectStudent(
      actor,
      w5Scope(context),
      context.draft_id,
      "STANDARD"
    );
    return {
      context: exactStudentContext(context, binding.model_version_ref),
      journey: readyJourney(),
      known_limits: [...new Set([...projection.convergence.known_limits, SYNTHETIC_LIMIT])],
      mission_id: SHANGHAI_FULL_VERTICAL_MISSION_ID,
      projection,
      schema_version: SHANGHAI_FULL_VERTICAL_SCHEMA_VERSION,
      status: "READY_WITH_LIMITS",
      surface: "STUDENT"
    };
  }

  getAdmin(
    actor: W5ServiceActor,
    context: ShanghaiFullVerticalExactReadContext
  ): ShanghaiFullVerticalAdminProjection {
    const binding = this.requireDraftBinding(actor, context);
    const adminProjection = this.governedModel.getAdminProjection(actor, w5Scope(context));
    const convergence = this.governedModel.evaluate(
      actor,
      { ...w5Scope(context), team_id: "tenant-admin-audit" },
      context.draft_id,
      "STANDARD"
    );
    return {
      admin_projection: adminProjection,
      binding: clone(binding),
      exact_context: {
        course_id: context.course_id,
        draft_id: context.draft_id,
        round_no: context.round_no,
        run_id: context.run_id
      },
      journey: readyJourney(),
      known_limits: [...new Set([...adminProjection.known_limits, SYNTHETIC_LIMIT])],
      mission_id: SHANGHAI_FULL_VERTICAL_MISSION_ID,
      preview: {
        can: convergence.can,
        demand_realization: convergence.demand_realization,
        known_limits: convergence.known_limits,
        realized: convergence.realized,
        replay: convergence.replay,
        want: convergence.want
      },
      schema_version: SHANGHAI_FULL_VERTICAL_SCHEMA_VERSION,
      status: "READY_WITH_LIMITS",
      surface: "ADMIN"
    };
  }

  private requireDraftBinding(
    actor: W5ServiceActor,
    context: ShanghaiFullVerticalExactReadContext
  ): W5ExactRuntimeBinding {
    const draft = this.governedModel.getDraft(actor, w5Scope(context), context.draft_id);
    return this.requireExactBinding(draft.exact_runtime_binding, context);
  }

  private requireExactBinding(
    binding: W5ExactRuntimeBinding | null,
    context: ShanghaiFullVerticalExactReadContext
  ): W5ExactRuntimeBinding {
    if (
      !binding ||
      binding.status !== "BOUND" ||
      binding.course_id !== context.course_id ||
      binding.run_id !== context.run_id ||
      binding.round_no !== context.round_no ||
      binding.tenant_id !== context.current_scenario_package_reference.tenant_id ||
      !sameParameterSet(binding.parameter_set_reference, context.current_parameter_set_reference) ||
      !sameScenarioPackage(
        binding.scenario_package_reference,
        context.current_scenario_package_reference
      )
    ) {
      throw new ShanghaiFullVerticalError("SHANGHAI_FULL_VERTICAL_EXACT_BINDING_REQUIRED");
    }
    return binding;
  }
}
