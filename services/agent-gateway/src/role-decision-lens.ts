import type { W020AdvisoryContext, W020RoleKey } from "@simwar/shared-contracts";

export interface RoleDecisionLens {
  role_key: W020RoleKey;
  required_scopes: readonly string[];
  guidance: string;
}

const ROLE_LENSES: Record<W020RoleKey, RoleDecisionLens> = {
  CEO: {
    role_key: "CEO",
    required_scopes: ["strategy", "cross_functional_alignment"],
    guidance:
      "Focus on strategic coherence, cross-functional trade-offs, and reversibility questions."
  },
  CFO: {
    role_key: "CFO",
    required_scopes: ["finance", "cash_risk"],
    guidance:
      "Focus on liquidity, budget discipline, and funding assumption questions; make no numeric claim."
  },
  CMO: {
    role_key: "CMO",
    required_scopes: ["market", "pricing"],
    guidance: "Focus on demand, positioning, and customer evidence questions."
  },
  COO: {
    role_key: "COO",
    required_scopes: ["operations", "service_delivery", "quality_control", "risk_register"],
    guidance: "Focus on capacity, delivery, and service-quality feasibility questions."
  }
};

export function getRoleDecisionLens(
  roleKey: W020RoleKey | undefined,
  advisoryScopes: readonly string[]
): RoleDecisionLens | undefined {
  if (!roleKey) return undefined;
  const lens = ROLE_LENSES[roleKey];
  if (!lens) return undefined;
  return lens.required_scopes.some((scope) => advisoryScopes.includes(scope)) ? lens : undefined;
}

export function hasRoleDecisionLens(context: W020AdvisoryContext): boolean {
  return getRoleDecisionLens(context.role_key, context.advisory_scopes) !== undefined;
}
