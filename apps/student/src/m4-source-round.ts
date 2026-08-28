export interface M4SourceRoundCandidate {
  run_id: string;
  round_no: number;
  status: string;
}

export function resolveM4SourceRoundNo(
  rounds: readonly M4SourceRoundCandidate[],
  runId: string | undefined
): number | undefined {
  if (!runId) return undefined;

  let sourceRoundNo: number | undefined;
  for (const round of rounds) {
    if (
      round.run_id !== runId ||
      round.status !== "published" ||
      !Number.isSafeInteger(round.round_no)
    ) {
      continue;
    }
    if (sourceRoundNo === undefined || round.round_no > sourceRoundNo) {
      sourceRoundNo = round.round_no;
    }
  }
  return sourceRoundNo;
}
