import { createHash } from "node:crypto";
import type {
  AuditLog,
  Decision,
  DecisionMergeCommit,
  DecisionAdmissionPolicy,
  RoleDecisionSection,
  Round,
  Run,
  RoleId,
  StudentRoleAssignment,
  Team
} from "@simwar/shared-contracts";
import type {
  RoleWorkflowRepositoryPort,
  RoleWorkflowRepositorySnapshot
} from "./repository-ports.js";
import { SYNTHETIC_JSON_INTERNAL_MARKER } from "./synthetic-run-lifecycle.js";

export type DecisionAdmissionPolicyAuthority =
  | "formal_run_runtime_binding"
  | "synthetic_run_creation_marker"
  | "missing";

export interface DecisionAdmissionPolicyResolution {
  authority: DecisionAdmissionPolicyAuthority;
  policy: DecisionAdmissionPolicy | null;
}

export interface CanonicalDecisionSet {
  admission_digest: string;
  decisions: Decision[];
}

export type CanonicalDecisionAdmissionFailureCode =
  | "DECISION_ADMISSION_CANONICAL_CONFLICT"
  | "DECISION_ADMISSION_CANONICAL_MISSING"
  | "DECISION_ADMISSION_CONFIRMATION_INVALID"
  | "DECISION_ADMISSION_MERGE_INVALID"
  | "DECISION_ADMISSION_POLICY_REQUIRED"
  | "DECISION_ADMISSION_ROLE_ROSTER_INVALID"
  | "DECISION_ADMISSION_SCOPE_INVALID"
  | "DECISION_ADMISSION_SECTION_NOT_READY";

export class CanonicalDecisionAdmissionError extends Error {
  constructor(
    readonly code: CanonicalDecisionAdmissionFailureCode,
    message = code
  ) {
    super(message);
    this.name = "CanonicalDecisionAdmissionError";
  }
}

const LEGACY_REQUIRED_ROLE_KEYS: RoleId[] = ["CEO", "CFO", "CMO", "COO"];
const W027_REQUIRED_ROLE_KEYS: RoleId[] = ["CEO", "CFO", "CMO", "COO", "CHRO"];

function requiredRoleKeysForTeam(team: Team): RoleId[] {
  return team.members.some((member) => member.role_slot === "CHRO")
    ? W027_REQUIRED_ROLE_KEYS
    : LEGACY_REQUIRED_ROLE_KEYS;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nested]) => nested !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)])
    );
  }
  return value;
}

function stableDigest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)), "utf8")
    .digest("hex");
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    [...left].sort().every((value, index) => value === [...right].sort()[index])
  );
}

function exactScope(
  snapshot: RoleWorkflowRepositorySnapshot,
  input: { round: Round; run: Run; team: Team; tenantId: string }
): void {
  if (
    snapshot.run?.tenant_id !== input.tenantId ||
    snapshot.run?.run_id !== input.run.run_id ||
    snapshot.round?.tenant_id !== input.tenantId ||
    snapshot.round?.round_id !== input.round.round_id ||
    snapshot.round?.run_id !== input.run.run_id ||
    snapshot.round?.round_no !== input.round.round_no ||
    snapshot.team?.tenant_id !== input.tenantId ||
    snapshot.team?.team_id !== input.team.team_id ||
    snapshot.team?.course_id !== input.run.course_id
  ) {
    throw new CanonicalDecisionAdmissionError("DECISION_ADMISSION_SCOPE_INVALID");
  }
}

function latestSection(
  sections: readonly RoleDecisionSection[],
  assignment: StudentRoleAssignment,
  roundId: string
): RoleDecisionSection | undefined {
  return sections
    .filter(
      (section) =>
        section.round_id === roundId &&
        section.role_key === assignment.role_key &&
        section.submitted_by === assignment.user_id &&
        (!section.assignment_id || section.assignment_id === assignment.assignment_id)
    )
    .sort(
      (left, right) =>
        left.version - right.version || left.section_id.localeCompare(right.section_id)
    )
    .at(-1);
}

function currentMerge(
  merges: readonly DecisionMergeCommit[],
  sourceSectionIds: readonly string[],
  input: { round: Round; run: Run; team: Team; tenantId: string }
): DecisionMergeCommit | undefined {
  const matches = merges.filter(
    (merge) =>
      merge.tenant_id === input.tenantId &&
      merge.run_id === input.run.run_id &&
      merge.round_id === input.round.round_id &&
      merge.team_id === input.team.team_id &&
      merge.status === "validated" &&
      sameStringSet(merge.source_section_ids, sourceSectionIds)
  );
  if (matches.length > 1) {
    throw new CanonicalDecisionAdmissionError("DECISION_ADMISSION_MERGE_INVALID");
  }
  return matches[0];
}

function canonicalDecisionIdentity(decision: Decision): Record<string, unknown> {
  return {
    canonical_source: decision.canonical_source,
    decision_id: decision.decision_id,
    merge_commit_id: decision.merge_commit_id,
    payload: decision.payload,
    round_id: decision.round_id,
    round_no: decision.round_no,
    status: decision.status,
    submitted_by: decision.submitted_by,
    team_confirmation_id: decision.team_confirmation_id,
    team_id: decision.team_id,
    tenant_id: decision.tenant_id,
    version: decision.version
  };
}

export function createCanonicalDecisionSetDigest(decisions: readonly Decision[]): string {
  return stableDigest(
    [...decisions]
      .sort(
        (left, right) =>
          left.team_id.localeCompare(right.team_id) ||
          left.decision_id.localeCompare(right.decision_id)
      )
      .map(canonicalDecisionIdentity)
  );
}

export function resolveDecisionAdmissionPolicy(input: {
  binding: { decision_admission_policy?: DecisionAdmissionPolicy } | null;
  runCreationAudits: readonly AuditLog[];
}): DecisionAdmissionPolicyResolution {
  if (input.binding) {
    return input.binding.decision_admission_policy
      ? {
          authority: "formal_run_runtime_binding",
          policy: input.binding.decision_admission_policy
        }
      : { authority: "missing", policy: null };
  }

  const explicitSyntheticMarker = input.runCreationAudits.some(
    (audit) =>
      audit.action === "run.create" &&
      audit.resource_type === "run" &&
      audit.after?.synthetic_runtime_classification === SYNTHETIC_JSON_INTERNAL_MARKER
  );

  return explicitSyntheticMarker
    ? { authority: "synthetic_run_creation_marker", policy: "LEGACY_DIRECT_EXPLICIT" }
    : { authority: "missing", policy: null };
}

export async function resolveFormalCanonicalDecisionSet(input: {
  roleWorkflow: RoleWorkflowRepositoryPort;
  round: Round;
  run: Run;
  team: Team;
  tenantId: string;
}): Promise<CanonicalDecisionSet> {
  const snapshot = await input.roleWorkflow.readRoleWorkflow({
    round_id: input.round.round_id,
    run_id: input.run.run_id,
    team_id: input.team.team_id,
    tenant_id: input.tenantId
  });

  if (!snapshot.run || !snapshot.round || !snapshot.team) {
    throw new CanonicalDecisionAdmissionError("DECISION_ADMISSION_SCOPE_INVALID");
  }
  exactScope(snapshot, input);

  const requiredRoleKeys = requiredRoleKeysForTeam(snapshot.team);
  const activeAssignments = snapshot.assignments.filter(
    (assignment) => assignment.status === "active"
  );
  const roleCounts = new Map<string, number>();
  for (const assignment of activeAssignments) {
    roleCounts.set(assignment.role_key, (roleCounts.get(assignment.role_key) ?? 0) + 1);
  }
  if (
    activeAssignments.length !== requiredRoleKeys.length ||
    requiredRoleKeys.some((roleKey) => roleCounts.get(roleKey) !== 1)
  ) {
    throw new CanonicalDecisionAdmissionError("DECISION_ADMISSION_ROLE_ROSTER_INVALID");
  }

  const currentSections = activeAssignments
    .map((assignment) => latestSection(snapshot.sections, assignment, input.round.round_id))
    .sort((left, right) => (left?.role_key ?? "").localeCompare(right?.role_key ?? ""));
  if (currentSections.some((section) => !section || section.status !== "ready")) {
    throw new CanonicalDecisionAdmissionError("DECISION_ADMISSION_SECTION_NOT_READY");
  }
  const sourceSectionIds = currentSections.map((section) => section!.section_id);
  const mergeCommit = currentMerge(snapshot.merge_commits, sourceSectionIds, input);
  if (!mergeCommit) {
    throw new CanonicalDecisionAdmissionError("DECISION_ADMISSION_MERGE_INVALID");
  }

  const confirmations = snapshot.confirmations.filter(
    (confirmation) =>
      confirmation.tenant_id === input.tenantId &&
      confirmation.run_id === input.run.run_id &&
      confirmation.round_id === input.round.round_id &&
      confirmation.team_id === input.team.team_id &&
      confirmation.status === "confirmed" &&
      confirmation.merge_commit_id === mergeCommit.merge_commit_id
  );
  if (confirmations.length !== 1) {
    throw new CanonicalDecisionAdmissionError("DECISION_ADMISSION_CONFIRMATION_INVALID");
  }
  const confirmation = confirmations[0]!;

  const canonicalDecisions = snapshot.decisions.filter(
    (decision) =>
      decision.tenant_id === input.tenantId &&
      decision.run_id === input.run.run_id &&
      decision.round_id === input.round.round_id &&
      decision.round_no === input.round.round_no &&
      decision.team_id === input.team.team_id &&
      decision.status === "submitted" &&
      decision.canonical_source === "role_merge_commit" &&
      decision.merge_commit_id === mergeCommit.merge_commit_id &&
      decision.team_confirmation_id === confirmation.team_confirmation_id
  );
  if (canonicalDecisions.length === 0) {
    throw new CanonicalDecisionAdmissionError("DECISION_ADMISSION_CANONICAL_MISSING");
  }
  if (canonicalDecisions.length !== 1) {
    throw new CanonicalDecisionAdmissionError("DECISION_ADMISSION_CANONICAL_CONFLICT");
  }

  return {
    admission_digest: createCanonicalDecisionSetDigest(canonicalDecisions),
    decisions: canonicalDecisions
  };
}
