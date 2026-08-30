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
  return {
    advisory_text: [
      `Debrief [${evidence.current_stage}]: Process Evidence is not Outcome/Causality.`,
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
