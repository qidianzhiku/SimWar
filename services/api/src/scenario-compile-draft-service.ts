import {
  compileGenericScenario,
  type GenericScenarioCompilerInput,
  type GenericScenarioValidationReport
} from "./scenario-compiler.js";
import {
  ScenarioPackageAuthorityError,
  type ScenarioPackageAuthorityActor,
  type ScenarioPackageCommandService,
  type ScenarioPackageVersion
} from "./scenario-package-authority.js";

export interface GenericScenarioCompileDraftResult {
  draft: ScenarioPackageVersion | null;
  report: Readonly<GenericScenarioValidationReport>;
}

/**
 * Coordinates candidate compilation with the existing sole formal writer.
 * It deliberately never performs lifecycle transitions beyond DRAFT.
 */
export async function compileGenericScenarioToDraft(
  commandService: ScenarioPackageCommandService,
  actor: ScenarioPackageAuthorityActor,
  input: GenericScenarioCompilerInput
): Promise<GenericScenarioCompileDraftResult> {
  const compilation = compileGenericScenario(input);

  if (compilation.candidate === null) {
    return Object.freeze({ draft: null, report: compilation.report });
  }

  const draft = await commandService.createDraft(actor, compilation.candidate);
  if (draft.content_digest !== compilation.report.candidate_content_digest) {
    throw new ScenarioPackageAuthorityError("DIGEST_MISMATCH");
  }

  return Object.freeze({ draft, report: compilation.report });
}
