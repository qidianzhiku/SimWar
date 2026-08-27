import type { Course, CourseBlueprintReference } from "./index.js";
import type { ParameterSetReference } from "./parameter-set-authority.js";
import type {
  ScenarioPackageAuthorityPluginDependencyProjection,
  ScenarioPackageReference
} from "./scenario-package-authority.js";
import type { W5ExperienceProfile } from "./w5-governed-model.js";

export const TEACHER_SCENARIO_STUDIO_SCHEMA_VERSION = "teacher-scenario-studio.v1" as const;

export const TEACHER_SCENARIO_STUDIO_OPERATION_IDS = {
  activate: "TEACHER_SCENARIO_STUDIO_ACTIVATE_V1",
  catalog: "TEACHER_SCENARIO_STUDIO_CATALOG_V1",
  createDraft: "TEACHER_SCENARIO_STUDIO_DRAFT_CREATE_V1",
  freeze: "TEACHER_SCENARIO_STUDIO_FREEZE_V1",
  preview: "TEACHER_SCENARIO_STUDIO_PREVIEW_V1",
  validate: "TEACHER_SCENARIO_STUDIO_VALIDATE_V1"
} as const;

export type TeacherScenarioStudioStatus = "DRAFT" | "VALIDATED" | "FROZEN" | "ACTIVATED";

export type TeacherScenarioStudioJsonValue =
  | boolean
  | null
  | number
  | string
  | readonly TeacherScenarioStudioJsonValue[]
  | { readonly [key: string]: TeacherScenarioStudioJsonValue };

export interface TeacherScenarioStudioModuleConfiguration {
  capital: Readonly<Record<string, TeacherScenarioStudioJsonValue>>;
  environment: Readonly<Record<string, TeacherScenarioStudioJsonValue>>;
  funding: Readonly<Record<string, TeacherScenarioStudioJsonValue>>;
  policy_shocks: Readonly<Record<string, TeacherScenarioStudioJsonValue>>;
  project_template: Readonly<Record<string, TeacherScenarioStudioJsonValue>>;
  workforce: Readonly<Record<string, TeacherScenarioStudioJsonValue>>;
}

export interface TeacherScenarioStudioCustomParameterDraft {
  mode: "DRAFT_ONLY";
  values: TeacherScenarioStudioJsonValue;
}

export interface TeacherScenarioStudioConfiguration {
  custom_parameters: TeacherScenarioStudioCustomParameterDraft;
  experience_profile: W5ExperienceProfile;
  module_configuration: TeacherScenarioStudioModuleConfiguration;
  model_version_ref: string;
  schema_version: typeof TEACHER_SCENARIO_STUDIO_SCHEMA_VERSION;
}

export interface TeacherScenarioStudioDraftInput {
  course_blueprint_reference: CourseBlueprintReference;
  course_package_id: string;
  description: string;
  parameter_set_reference: ParameterSetReference;
  scenario_package_reference: ScenarioPackageReference;
  studio_configuration: TeacherScenarioStudioConfiguration;
  title: string;
  version: string;
}

export interface TeacherScenarioStudioDraftDto {
  course_package_reference: {
    content_digest: string;
    course_package_id: string;
    tenant_id: string;
    version: string;
  };
  operation_id: string;
  status: TeacherScenarioStudioStatus;
  studio_configuration: TeacherScenarioStudioConfiguration;
  title: string;
}

export interface TeacherScenarioStudioCatalogBlueprint {
  compatibility_constraints: Readonly<Record<string, string>>;
  course_blueprint_reference: CourseBlueprintReference;
  title: string;
}

export interface TeacherScenarioStudioCatalogScenarioPackage {
  compatibility_metadata: Readonly<Record<string, string>>;
  parameter_set_reference: ParameterSetReference;
  plugin_dependencies: readonly ScenarioPackageAuthorityPluginDependencyProjection[];
  scenario_package_reference: ScenarioPackageReference;
}

export interface TeacherScenarioStudioCatalogDto {
  course_blueprints: readonly TeacherScenarioStudioCatalogBlueprint[];
  model_versions: readonly {
    model_version_ref: string;
    provider: "OFF";
    status: "APPROVED";
  }[];
  operation_id: typeof TEACHER_SCENARIO_STUDIO_OPERATION_IDS.catalog;
  scenario_packages: readonly TeacherScenarioStudioCatalogScenarioPackage[];
}

export interface TeacherScenarioStudioValidationDto {
  checks: {
    compatibility: "PASS" | "BLOCKED";
    custom_parameters: "PASS_WITH_LIMITS";
    exact_source_references: "PASS" | "BLOCKED";
    model_version: "PASS" | "BLOCKED";
  };
  operation_id: typeof TEACHER_SCENARIO_STUDIO_OPERATION_IDS.validate;
  status: "VALIDATED" | "BLOCKED";
}

export interface TeacherScenarioStudioPreviewDto {
  operation_id: typeof TEACHER_SCENARIO_STUDIO_OPERATION_IDS.preview;
  role_safe_preview: {
    experience_profile: W5ExperienceProfile;
    module_labels: readonly string[];
    student_visible: false;
    summary: string;
  };
  source_references: {
    course_blueprint_reference: CourseBlueprintReference;
    parameter_set_reference: ParameterSetReference;
    scenario_package_reference: ScenarioPackageReference;
  };
  status: TeacherScenarioStudioStatus;
}

export interface TeacherScenarioStudioActivationDto {
  activation: {
    run_activation: "DEFERRED_TO_EXISTING_RUN_WRITER";
    status: "ACTIVATED";
    writer: "EXISTING_COURSE_AND_FORMAL_AUTHORITY_BINDING_WRITERS";
  };
  course: Course;
  operation_id: typeof TEACHER_SCENARIO_STUDIO_OPERATION_IDS.activate;
  source_references: {
    course_blueprint_reference: CourseBlueprintReference;
    parameter_set_reference: ParameterSetReference;
    scenario_package_reference: ScenarioPackageReference;
  };
}
