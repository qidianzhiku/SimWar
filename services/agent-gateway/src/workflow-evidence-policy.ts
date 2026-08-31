import type { W020AdvisoryContext } from "@simwar/shared-contracts";

export type WorkflowEvidenceContext = W020AdvisoryContext;

export const QUALIFIED_WORKFLOW_EVENT_TYPES = [
  "role_assigned",
  "section_saved",
  "section_ready",
  "merge_created",
  "team_confirmed",
  "resolution_proposed",
  "resolution_acknowledged",
  "workflow_reset"
] as const;

export type QualifiedWorkflowEventType = (typeof QUALIFIED_WORKFLOW_EVENT_TYPES)[number];

export type WorkflowEvidenceStage =
  | "NOT_STARTED"
  | "ROLE_ASSIGNED"
  | "ROLE_CONTRIBUTION_DRAFTED"
  | "ROLE_CONTRIBUTION_READY"
  | "TEAM_MERGE_MILESTONE"
  | "TEAM_CONFIRMED"
  | "RESOLUTION_PROPOSED"
  | "RESOLUTION_ACKNOWLEDGED";

export interface WorkflowEvidenceResult {
  status: "eligible" | "abstained";
  current_stage: WorkflowEvidenceStage;
  qualified_event_ids: string[];
  qualified_event_types: QualifiedWorkflowEventType[];
  reset_applied: boolean;
}

export class WorkflowEvidenceError extends Error {
  constructor(
    readonly reason:
      | "EVENT_EVIDENCE_INCOHERENT"
      | "EVENT_ID_INVALID"
      | "EVENT_TYPE_UNSUPPORTED"
      | "EVENT_SEQUENCE_INVALID"
  ) {
    super(reason);
    this.name = "WorkflowEvidenceError";
  }
}

const EVENT_STAGE: Record<
  Exclude<QualifiedWorkflowEventType, "workflow_reset">,
  Exclude<WorkflowEvidenceStage, "NOT_STARTED">
> = {
  role_assigned: "ROLE_ASSIGNED",
  section_saved: "ROLE_CONTRIBUTION_DRAFTED",
  section_ready: "ROLE_CONTRIBUTION_READY",
  merge_created: "TEAM_MERGE_MILESTONE",
  team_confirmed: "TEAM_CONFIRMED",
  resolution_proposed: "RESOLUTION_PROPOSED",
  resolution_acknowledged: "RESOLUTION_ACKNOWLEDGED"
};

const EVENT_TYPE_SET = new Set<string>(QUALIFIED_WORKFLOW_EVENT_TYPES);

function isQualifiedEventType(value: string): value is QualifiedWorkflowEventType {
  return EVENT_TYPE_SET.has(value);
}

function validateIds(ids: string[]): void {
  if (
    ids.some((id) => typeof id !== "string" || id.trim() !== id || id.length === 0) ||
    new Set(ids).size !== ids.length
  ) {
    throw new WorkflowEvidenceError("EVENT_ID_INVALID");
  }
}

export function qualifyWorkflowEvidence(context: WorkflowEvidenceContext): WorkflowEvidenceResult {
  const ids = context.source_event_ids;
  const types = context.source_event_types;
  if (!Array.isArray(ids) || !Array.isArray(types) || ids.length !== types.length) {
    throw new WorkflowEvidenceError("EVENT_EVIDENCE_INCOHERENT");
  }
  if (ids.length === 0) {
    return {
      current_stage: "NOT_STARTED",
      qualified_event_ids: [],
      qualified_event_types: [],
      reset_applied: false,
      status: "abstained"
    };
  }
  if (ids.length > 50) throw new WorkflowEvidenceError("EVENT_EVIDENCE_INCOHERENT");
  validateIds(ids);
  if (types.some((type) => !isQualifiedEventType(type))) {
    throw new WorkflowEvidenceError("EVENT_TYPE_UNSUPPORTED");
  }

  const lastReset = types.lastIndexOf("workflow_reset");
  const resetApplied = lastReset >= 0;
  const start = lastReset >= 0 ? lastReset + 1 : 0;
  const qualifiedIds = ids.slice(start);
  const qualifiedTypes = types.slice(start).map((type) => {
    if (!isQualifiedEventType(type)) {
      throw new WorkflowEvidenceError("EVENT_TYPE_UNSUPPORTED");
    }
    return type;
  });
  if (qualifiedTypes.length === 0) {
    return {
      current_stage: "NOT_STARTED",
      qualified_event_ids: [],
      qualified_event_types: [],
      reset_applied: resetApplied,
      status: "abstained"
    };
  }
  const lastType = qualifiedTypes.at(-1);
  if (!lastType || lastType === "workflow_reset") {
    return {
      current_stage: "NOT_STARTED",
      qualified_event_ids: [],
      qualified_event_types: [],
      reset_applied: true,
      status: "abstained"
    };
  }
  return {
    current_stage: EVENT_STAGE[lastType],
    qualified_event_ids: qualifiedIds,
    qualified_event_types: qualifiedTypes,
    reset_applied: resetApplied,
    status: "eligible"
  };
}

export function workflowStageLabel(stage: WorkflowEvidenceStage): string {
  return stage === "NOT_STARTED" ? "not started" : stage.toLowerCase().replaceAll("_", " ");
}
