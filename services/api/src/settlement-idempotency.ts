import { createHash } from "node:crypto";
import type { SettlementResult } from "@simwar/shared-contracts";

type SettlementIdentity = Pick<SettlementResult, "tenant_id" | "run_id" | "round_no">;

type FingerprintInput = Pick<
  SettlementResult,
  | "tenant_id"
  | "run_id"
  | "round_no"
  | "round_id"
  | "parameter_set_id"
  | "scenario_package_id"
  | "replay_hash"
  | "team_results"
>;

function sortCanonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortCanonical);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortCanonical(entry)])
    );
  }

  return value;
}

export function createSettlementBusinessKey(identity: SettlementIdentity): string {
  return `${identity.tenant_id}:${identity.run_id}:${identity.round_no}`;
}

export function createSettlementFingerprint(result: FingerprintInput): string {
  const canonicalInput = sortCanonical({
    tenant_id: result.tenant_id,
    run_id: result.run_id,
    round_no: result.round_no,
    round_id: result.round_id,
    parameter_set_id: result.parameter_set_id,
    scenario_package_id: result.scenario_package_id,
    replay_hash: result.replay_hash,
    team_results: result.team_results
  });

  return createHash("sha256").update(JSON.stringify(canonicalInput)).digest("hex");
}
