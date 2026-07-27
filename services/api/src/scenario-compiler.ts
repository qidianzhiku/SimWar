import { createHash } from "node:crypto";
import { isExactVersion, type ParameterSetReference } from "@simwar/shared-contracts";
import {
  ScenarioPackageAuthorityError,
  type ScenarioPackageArtifactPolicy,
  type ScenarioPackageDraftInput,
  type ScenarioPackageJsonValue,
  type ScenarioPackagePluginDependency,
  validateScenarioPackageDraftInput
} from "./scenario-package-authority.js";

export const GENERIC_SCENARIO_COMPILER_VERSION = "scenario-compiler.v1" as const;

export type GenericScenarioSourceKind = "SYNTHETIC_INTERNAL" | "TEACHER_AUTHORED_DRAFT";

const SCENARIO_SOURCE_KINDS = new Set<GenericScenarioSourceKind>([
  "SYNTHETIC_INTERNAL",
  "TEACHER_AUTHORED_DRAFT"
]);

export interface GenericScenarioSourceReference {
  license_provenance_id: string;
  source_digest: string;
  source_id: string;
  source_kind: GenericScenarioSourceKind;
  source_version: string;
  status: "REGISTERED" | "RETIRED";
  tenant_id: string;
}

export interface GenericScenarioTemplate {
  content: ScenarioPackageJsonValue;
  template_id: string;
  template_version: string;
}

export interface GenericScenarioCompilerInput {
  artifact_policy: ScenarioPackageArtifactPolicy;
  compatibility_metadata: Readonly<Record<string, string>>;
  metadata: Readonly<Record<string, ScenarioPackageJsonValue>>;
  parameter_set_reference: ParameterSetReference;
  plugin_dependencies: readonly ScenarioPackagePluginDependency[];
  scenario_package_id: string;
  schema_version: string;
  source_reference: GenericScenarioSourceReference;
  template: GenericScenarioTemplate;
  tenant_id: string;
  version: string;
}

export interface GenericScenarioValidationReport {
  candidate_content_digest: string | null;
  compiler_version: typeof GENERIC_SCENARIO_COMPILER_VERSION;
  errors: readonly string[];
  input_digest: string;
  source_reference: Readonly<
    Pick<
      GenericScenarioSourceReference,
      "source_digest" | "source_id" | "source_kind" | "source_version" | "status"
    >
  >;
  status: "INVALID" | "VALID";
  template_reference: Readonly<Pick<GenericScenarioTemplate, "template_id" | "template_version">>;
  warnings: readonly string[];
}

export interface GenericScenarioCompileResult {
  candidate: Readonly<ScenarioPackageDraftInput> | null;
  report: Readonly<GenericScenarioValidationReport>;
}

const CANDIDATE_WARNINGS = [
  "SCENARIO_CANDIDATE_NOT_PERSISTED",
  "SCENARIO_CANDIDATE_NOT_PUBLISHED",
  "SCENARIO_RUNTIME_NOT_ACTIVATED",
  "RUN_BINDING_NOT_AUTHORIZED"
] as const;

function canonicalize(value: unknown): string {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("NON_FINITE_VALUE");
  }

  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;

    return `{${Object.keys(objectValue)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(objectValue[key])}`)
      .join(",")}}`;
  }

  throw new Error("UNSUPPORTED_VALUE");
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }

    Object.freeze(value);
  }

  return value;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isDigest(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function isNonBlankString(value: string): boolean {
  return value.trim().length > 0;
}

function createInputDigest(input: GenericScenarioCompilerInput): string {
  return createHash("sha256").update(canonicalize(input), "utf8").digest("hex");
}

function validateSourceReference(input: GenericScenarioCompilerInput): string[] {
  const source = input.source_reference;

  if (
    !isNonBlankString(source.license_provenance_id) ||
    !isDigest(source.source_digest) ||
    !isNonBlankString(source.source_id) ||
    !SCENARIO_SOURCE_KINDS.has(source.source_kind) ||
    !["REGISTERED", "RETIRED"].includes(source.status) ||
    !isExactVersion(source.source_version) ||
    !isNonBlankString(source.tenant_id)
  ) {
    return ["SCENARIO_SOURCE_REFERENCE_INVALID"];
  }

  if (source.tenant_id !== input.tenant_id) {
    return ["SCENARIO_SOURCE_TENANT_MISMATCH"];
  }

  if (source.status === "RETIRED") {
    return ["SCENARIO_SOURCE_RETIRED"];
  }

  if (
    !isNonBlankString(input.template.template_id) ||
    !isExactVersion(input.template.template_version) ||
    Object.prototype.hasOwnProperty.call(input.compatibility_metadata, "compiler_version")
  ) {
    return ["SCENARIO_TEMPLATE_INVALID"];
  }

  const provenance = input.metadata.license_provenance_id;
  if (provenance !== undefined && provenance !== source.license_provenance_id) {
    return ["SCENARIO_PROVENANCE_MISMATCH"];
  }

  return [];
}

function createCandidate(input: GenericScenarioCompilerInput): ScenarioPackageDraftInput {
  return {
    artifact_policy: cloneValue(input.artifact_policy),
    compatibility_metadata: {
      ...cloneValue(input.compatibility_metadata),
      compiler_version: GENERIC_SCENARIO_COMPILER_VERSION
    },
    content: {
      definition: cloneValue(input.template.content),
      scenario_source: {
        source_digest: input.source_reference.source_digest,
        source_id: input.source_reference.source_id,
        source_kind: input.source_reference.source_kind,
        source_version: input.source_reference.source_version
      },
      template: {
        template_id: input.template.template_id,
        template_version: input.template.template_version
      }
    },
    metadata: {
      ...cloneValue(input.metadata),
      license_provenance_id: input.source_reference.license_provenance_id
    },
    parameter_set_reference: cloneValue(input.parameter_set_reference),
    plugin_dependencies: cloneValue(input.plugin_dependencies),
    scenario_package_id: input.scenario_package_id,
    schema_version: input.schema_version,
    tenant_id: input.tenant_id,
    version: input.version
  };
}

function createReport(
  input: GenericScenarioCompilerInput,
  inputDigest: string,
  errors: readonly string[],
  candidateContentDigest: string | null
): Readonly<GenericScenarioValidationReport> {
  return deepFreeze({
    candidate_content_digest: candidateContentDigest,
    compiler_version: GENERIC_SCENARIO_COMPILER_VERSION,
    errors: [...errors],
    input_digest: inputDigest,
    source_reference: {
      source_digest: input.source_reference.source_digest,
      source_id: input.source_reference.source_id,
      source_kind: input.source_reference.source_kind,
      source_version: input.source_reference.source_version,
      status: input.source_reference.status
    },
    status: errors.length === 0 ? "VALID" : "INVALID",
    template_reference: {
      template_id: input.template.template_id,
      template_version: input.template.template_version
    },
    warnings: errors.length === 0 ? [...CANDIDATE_WARNINGS] : []
  });
}

/**
 * Builds a generic ScenarioPackage candidate without writing lifecycle state,
 * activating runtime composition, or binding a Run.
 */
export function compileGenericScenario(
  input: GenericScenarioCompilerInput
): GenericScenarioCompileResult {
  const inputDigest = createInputDigest(input);
  const sourceErrors = validateSourceReference(input);

  if (sourceErrors.length > 0) {
    return deepFreeze({
      candidate: null,
      report: createReport(input, inputDigest, sourceErrors, null)
    });
  }

  const candidate = createCandidate(input);

  try {
    const validation = validateScenarioPackageDraftInput(candidate);

    return deepFreeze({
      candidate: deepFreeze(candidate),
      report: createReport(input, inputDigest, [], validation.content_digest)
    });
  } catch (error) {
    const code =
      error instanceof ScenarioPackageAuthorityError
        ? error.code
        : "SCENARIO_PACKAGE_VALIDATION_FAILED";

    return deepFreeze({
      candidate: null,
      report: createReport(input, inputDigest, [code], null)
    });
  }
}
