import type { W020AdvisoryContext } from "@simwar/shared-contracts";
import type { WorkflowEvidenceResult } from "./workflow-evidence-policy.js";

export type TeacherDebriefContext = W020AdvisoryContext;

export interface TeacherDebriefIntelligence {
  output_type: "advisory";
  advisory_text: string;
}

const STAGE_FOCUS: Record<string, string> = {
  ROLE_ASSIGNED: "whether the assigned role has a concrete evidence contribution",
  ROLE_CONTRIBUTION_DRAFTED:
    "which assumption should be tested before the contribution is marked ready",
  ROLE_CONTRIBUTION_READY:
    "how the ready contribution will be compared with other role perspectives",
  TEAM_MERGE_MILESTONE: "which disagreement remains visible in the merge candidate",
  TEAM_CONFIRMED: "what rationale was shared before the team milestone",
  RESOLUTION_PROPOSED: "which unresolved tension the proposed resolution addresses",
  RESOLUTION_ACKNOWLEDGED: "what was acknowledged and what dissent remains"
};

const STAGE_BOUNDARY: Record<string, string> = {
  ROLE_ASSIGNED:
    "Role contribution is still being established; do not infer a decision or outcome.",
  ROLE_CONTRIBUTION_DRAFTED:
    "A saved contribution is process information, not an accepted team position.",
  ROLE_CONTRIBUTION_READY: "Ready status is process information, not a canonical decision.",
  TEAM_MERGE_MILESTONE:
    "A merge candidate is not a canonical decision; keep visible divergence available for review.",
  TEAM_CONFIRMED:
    "Team Confirm is not Round Lock; confirmation does not establish an official result.",
  RESOLUTION_PROPOSED:
    "Resolution Proposal is not a Canonical Decision; keep the unresolved disagreement and dissent visible.",
  RESOLUTION_ACKNOWLEDGED:
    "Acknowledgement is not Acceptance or Truth; record what remains unresolved without re-entering a historical Decision."
};

export function buildTeacherDebriefIntelligence(
  _context: TeacherDebriefContext,
  evidence: WorkflowEvidenceResult
): TeacherDebriefIntelligence {
  if (evidence.status === "abstained") {
    return {
      advisory_text:
        "No qualified workflow evidence is available; teacher debrief is withheld until a valid process sequence is visible.",
      output_type: "advisory"
    };
  }
  const focus =
    STAGE_FOCUS[evidence.current_stage] ?? "which process question should be examined next";
  const boundary =
    STAGE_BOUNDARY[evidence.current_stage] ??
    "The visible process step does not establish an official result.";
  const recovery = evidence.reset_applied
    ? "Workflow reset recovery: only post-reset selected-team process evidence is in scope; historical Decision data is not re-entered."
    : "Scope: selected-team process evidence only; no multi-team synthesis is performed.";
  return {
    advisory_text: [
      `Debrief [${evidence.current_stage}]: Process Evidence is not Outcome/Causality.`,
      boundary,
      recovery,
      `Mechanism question: examine ${focus}.`,
      "Assumption: identify the learner or team assumption that the visible process step leaves untested.",
      "Risk: a process milestone may be over-read as proof of a business result.",
      "Alternative: compare another defensible process explanation using only the visible evidence.",
      "Contradiction challenge: record evidence that would weaken the leading explanation.",
      "This is an advisory draft for teacher review and does not establish official causality."
    ].join(" "),
    output_type: "advisory"
  };
}
