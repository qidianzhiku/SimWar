import type { ParameterSetReference } from "./parameter-set-authority.js";
import type {
  ScenarioPackageAuthorityPluginDependencyProjection,
  ScenarioPackageReference
} from "./scenario-package-authority.js";

export const TEACHER_FORMAL_SCENARIO_PACKAGE_CATALOG_OPERATION_ID =
  "TEACHER_FORMAL_SCENARIO_PACKAGE_CATALOG_GET_V1" as const;

export const TEACHER_FORMAL_SCENARIO_PACKAGE_CATALOG_EXPLICIT_NON_PROOFS = [
  "FORMAL_CATALOG_READ_ONLY",
  "LOCAL_DRAFT_SELECTION_DOES_NOT_BIND_A_RUN",
  "SCENARIO_RUNTIME_NOT_ACTIVATED",
  "PARAMETERSET_NOT_MUTATED",
  "REPLAY_NOT_EXECUTED",
  "SETTLEMENT_NOT_EXECUTED"
] as const;

export interface TeacherFormalScenarioPackageCatalogCandidateDto {
  compatibility_metadata: Readonly<Record<string, string>>;
  parameter_set_reference: ParameterSetReference;
  plugin_dependencies: readonly ScenarioPackageAuthorityPluginDependencyProjection[];
  scenario_package_reference: ScenarioPackageReference;
  schema_version: string;
  status: "APPROVED";
}

export interface TeacherFormalScenarioPackageCatalogDto {
  candidates: readonly TeacherFormalScenarioPackageCatalogCandidateDto[];
  explicit_non_proofs: typeof TEACHER_FORMAL_SCENARIO_PACKAGE_CATALOG_EXPLICIT_NON_PROOFS;
  operation_id: typeof TEACHER_FORMAL_SCENARIO_PACKAGE_CATALOG_OPERATION_ID;
}
