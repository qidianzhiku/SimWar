import type {
  PermissionKey,
  Round,
  RoundStatus,
  TeacherBffWorkspaceDTO
} from "@simwar/shared-contracts";

export type TeacherRoundCommand =
  | "round:start"
  | "round:lock"
  | "settlement:settle"
  | "round:publish";

export interface TeacherRoundContext {
  tenant_id: string;
  course_id: string;
  run_id: string;
  round_id: string;
  round_no: number;
  round_status: RoundStatus;
  is_actionable: boolean;
  allowed_actions: PermissionKey[];
}

export interface TeacherRoundWorkspaceIdentity {
  tenantId: string;
  courseId: string;
  runId: string;
  roundId: string;
  roundNo: number;
}

const ROUND_STATUS_LABELS: Record<RoundStatus, string> = {
  draft: "待开启",
  open: "进行中",
  locked: "已锁定",
  settled: "已结算",
  published: "已发布"
};

const ROUND_COMMAND_SEGMENTS: Record<TeacherRoundCommand, string> = {
  "round:start": "start",
  "round:lock": "lock",
  "round:publish": "publish",
  "settlement:settle": "settle"
};

export function sortTeacherRounds(rounds: readonly Round[]): Round[] {
  return [...rounds].sort(
    (left, right) => left.round_no - right.round_no || left.round_id.localeCompare(right.round_id)
  );
}

export function getTeacherRunRounds(
  rounds: readonly Round[],
  runId: string,
  tenantId?: string
): Round[] {
  return sortTeacherRounds(
    rounds.filter(
      (round) =>
        round.run_id === runId &&
        (tenantId === undefined || round.tenant_id === undefined || round.tenant_id === tenantId)
    )
  );
}

export function selectTeacherRound(
  rounds: readonly Round[],
  preferredRoundId?: string | null
): Round | undefined {
  const sorted = sortTeacherRounds(rounds);
  if (preferredRoundId) {
    return sorted.find((round) => round.round_id === preferredRoundId);
  }

  return [...sorted].reverse().find((round) => round.status !== "published") ?? sorted.at(-1);
}

export function createTeacherRoundContext(input: {
  tenantId: string;
  courseId: string;
  round: Round;
  allowedActions: readonly PermissionKey[];
}): TeacherRoundContext {
  return {
    tenant_id: input.tenantId,
    course_id: input.courseId,
    run_id: input.round.run_id,
    round_id: input.round.round_id,
    round_no: input.round.round_no,
    round_status: input.round.status,
    is_actionable: input.round.status !== "published",
    allowed_actions: [...input.allowedActions]
  };
}

export function getTeacherRoundCommandPath(
  runId: string,
  roundNo: number,
  command: TeacherRoundCommand
): string {
  return `/api/v1/runs/${encodeURIComponent(runId)}/rounds/${roundNo}/${ROUND_COMMAND_SEGMENTS[command]}`;
}

export function getTeacherRoundStatusLabel(status: RoundStatus): string {
  return ROUND_STATUS_LABELS[status];
}

export function isTeacherRoundWorkspaceForContext(
  workspace: TeacherBffWorkspaceDTO,
  expected: TeacherRoundWorkspaceIdentity
): boolean {
  const roundControl = workspace.round_control;
  return (
    roundControl.tenant_id === expected.tenantId &&
    roundControl.course_id === expected.courseId &&
    roundControl.run_id === expected.runId &&
    roundControl.round_id === expected.roundId &&
    roundControl.round_no === expected.roundNo
  );
}
