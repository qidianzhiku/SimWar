import type { ReactNode } from "react";

/**
 * Compatibility shell for legacy consumers. Cross-round selection is owned by
 * the role-local GSI-XR surfaces, which use server-governed round options.
 * This shell deliberately accepts no candidate selector or handoff data.
 */
export interface GsiCrossRoundInsightPanelProps {
  apiBase: string;
  surface: "teacher" | "student" | "admin";
  tenantId: string;
  token: string;
  children?: ReactNode;
}

export function GsiCrossRoundInsightPanel({ children }: GsiCrossRoundInsightPanelProps) {
  return <>{children ?? null}</>;
}

export default GsiCrossRoundInsightPanel;
