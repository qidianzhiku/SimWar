import type { W3OfficialConsequenceContext } from "@simwar/shared-contracts";

/**
 * A query-driven W3 surface must have its complete context before it can read
 * or present the official learning projection. An explicit environment flag
 * remains the opt-in for the local/demo surface, where App supplies the
 * current safe context from the server projection.
 */
export function isW3ContextAvailable(
  context: W3OfficialConsequenceContext | undefined,
  environmentFeatureEnabled: boolean
): boolean {
  return Boolean(context || environmentFeatureEnabled);
}
