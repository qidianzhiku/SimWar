import type { W020AdvisoryContext } from "@simwar/shared-contracts";
import type { WorkflowEvidenceResult } from "./workflow-evidence-policy.js";

export type StudentChallengeContext = W020AdvisoryContext;

export interface StudentDecisionChallenge {
  output_type: "advisory" | "explanation";
  advisory_text: string;
}

const DECISION_LAYER_NOTICE =
  "Private judgment remains distinct from Team position and the canonical decision; preserve dissent for human review.";

export function buildStudentDecisionChallenge(
  _context: StudentChallengeContext,
  evidence: WorkflowEvidenceResult
): StudentDecisionChallenge {
  if (evidence.status === "abstained") {
    return {
      advisory_text:
        "No qualified workflow evidence is available; student coaching is withheld until a valid workflow sequence is visible.",
      output_type: "advisory"
    };
  }

  switch (evidence.current_stage) {
    case "ROLE_ASSIGNED":
      return {
        advisory_text: `Coach [ROLE_ASSIGNED]: identify the evidence your role will contribute before drafting. ${DECISION_LAYER_NOTICE}`,
        output_type: "advisory"
      };
    case "ROLE_CONTRIBUTION_DRAFTED":
      return {
        advisory_text: `Challenge [ROLE_CONTRIBUTION_DRAFTED]: test the assumptions in the saved contribution before marking it ready. ${DECISION_LAYER_NOTICE}`,
        output_type: "advisory"
      };
    case "ROLE_CONTRIBUTION_READY":
      return {
        advisory_text: `Coach [ROLE_CONTRIBUTION_READY]: compare the ready contribution with the team's open questions before a merge. ${DECISION_LAYER_NOTICE}`,
        output_type: "advisory"
      };
    case "TEAM_MERGE_MILESTONE":
      return {
        advisory_text: `Challenge [TEAM_MERGE_MILESTONE]: review the merge candidate and record any dissent before the canonical decision is formed. ${DECISION_LAYER_NOTICE}`,
        output_type: "advisory"
      };
    case "TEAM_CONFIRMED":
      return {
        advisory_text: `Explain [TEAM_CONFIRMED]: team confirmation is not a round lock. Re-check the visible rationale and preserve dissent before the canonical decision proceeds. ${DECISION_LAYER_NOTICE}`,
        output_type: "explanation"
      };
    case "RESOLUTION_PROPOSED":
      return {
        advisory_text: `Challenge [RESOLUTION_PROPOSED]: compare the proposed resolution with the recorded disagreement and state what remains unresolved. ${DECISION_LAYER_NOTICE}`,
        output_type: "advisory"
      };
    case "RESOLUTION_ACKNOWLEDGED":
      return {
        advisory_text: `Explain [RESOLUTION_ACKNOWLEDGED]: describe what was acknowledged and what dissent remains without treating the acknowledgement as an official outcome. ${DECISION_LAYER_NOTICE}`,
        output_type: "explanation"
      };
    case "NOT_STARTED":
      return {
        advisory_text:
          "No qualified workflow evidence is available; student coaching is withheld until a valid workflow sequence is visible.",
        output_type: "advisory"
      };
  }
}
