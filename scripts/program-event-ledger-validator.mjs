#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const PROGRAM_EVENT_LEDGER_REQUIRED_FIELDS = [
  "cycle_id",
  "macro_id",
  "lane",
  "source_epoch",
  "prepared_at",
  "delivered_at",
  "acknowledged_at",
  "decided_at",
  "consumed_at",
  "integration_requested_at",
  "integration_started_at",
  "integration_completed_at",
  "main_wait_reason",
  "rebase_count",
  "requalification_count",
  "review_repair_count",
  "focused_validation_count",
  "heavy_validation_count",
  "fresh_reality_rebuild_count",
  "consumer_id",
  "consumer_status",
  "shared_seam",
  "hot_files",
  "final_disposition",
  "evidence_status"
];

const REQUIRED_CLOSURE_FIELDS = [
  "prepared_at",
  "delivered_at",
  "decided_at",
  "consumed_at",
  "integration_requested_at",
  "integration_completed_at"
];

export const PROGRAM_EVENT_LEDGER_REQUIRED_COMPLETE_CYCLES = 6;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validateProgramEventLedger(ledger) {
  const errors = [];
  let completeCycles = 0;
  let unknownFieldCount = 0;

  if (!isRecord(ledger)) {
    return {
      valid: false,
      completeCycles,
      unknownFieldCount,
      errors: ["ledger must be an object"]
    };
  }

  if (!Array.isArray(ledger.cycles)) {
    errors.push("ledger.cycles must be an array");
  }

  const cycles = Array.isArray(ledger.cycles) ? ledger.cycles : [];
  const cycleIds = new Set();
  for (const [index, cycle] of cycles.entries()) {
    const label =
      isRecord(cycle) && typeof cycle.cycle_id === "string" ? cycle.cycle_id : `cycles[${index}]`;

    if (!isRecord(cycle)) {
      errors.push(`${label} must be an object`);
      continue;
    }

    if (typeof cycle.cycle_id === "string") {
      if (cycleIds.has(cycle.cycle_id)) {
        errors.push(`${label} duplicates cycle_id ${cycle.cycle_id}`);
      } else {
        cycleIds.add(cycle.cycle_id);
      }
    }

    for (const field of PROGRAM_EVENT_LEDGER_REQUIRED_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(cycle, field)) {
        errors.push(`${label} is missing required field ${field}`);
      } else if (cycle[field] === null) {
        unknownFieldCount += 1;
      }
    }

    const evidenceRefs = cycle.evidence_refs ?? cycle.source_refs;
    if (evidenceRefs === undefined) {
      errors.push(`${label} is missing required field evidence_refs or source_refs`);
    } else if (evidenceRefs === null) {
      unknownFieldCount += 1;
    } else if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0) {
      errors.push(`${label} evidence_refs or source_refs must be a non-empty array`);
    }

    const closureComplete = REQUIRED_CLOSURE_FIELDS.every(
      (field) => cycle[field] !== null && cycle[field] !== undefined
    );
    const evidenceComplete =
      typeof cycle.evidence_status === "string" && cycle.evidence_status.startsWith("COMPLETE");
    const dispositionClosed =
      typeof cycle.final_disposition === "string" && cycle.final_disposition !== "OPEN";

    if (closureComplete && evidenceComplete && dispositionClosed) {
      completeCycles += 1;
    } else {
      errors.push(
        `${label} does not have complete closure evidence (required closure timestamps, COMPLETE evidence_status, and a closed final_disposition)`
      );
    }
  }

  const completeness = isRecord(ledger.completeness) ? ledger.completeness : null;
  const requiredCompleteCycles =
    ledger.required_complete_cycles ?? completeness?.required_complete_cycles;
  if (
    typeof requiredCompleteCycles !== "number" ||
    !Number.isInteger(requiredCompleteCycles) ||
    requiredCompleteCycles !== PROGRAM_EVENT_LEDGER_REQUIRED_COMPLETE_CYCLES
  ) {
    errors.push(
      `required_complete_cycles must equal schema minimum ${PROGRAM_EVENT_LEDGER_REQUIRED_COMPLETE_CYCLES}`
    );
  } else if (completeCycles < requiredCompleteCycles) {
    errors.push(
      `complete cycle count ${completeCycles} is below required_complete_cycles ${requiredCompleteCycles}`
    );
  }

  if (
    completeness?.complete_cycles !== undefined &&
    completeness.complete_cycles !== completeCycles
  ) {
    errors.push(
      `completeness.complete_cycles ${completeness.complete_cycles} does not match observed complete cycles ${completeCycles}`
    );
  }

  return {
    valid: errors.length === 0,
    completeCycles,
    unknownFieldCount,
    errors
  };
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: node scripts/program-event-ledger-validator.mjs <ledger.json>");
    process.exitCode = 2;
    return;
  }

  let ledger;
  try {
    ledger = JSON.parse(await readFile(inputPath, "utf8"));
  } catch (error) {
    console.error(`Unable to read or parse ${inputPath}: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  const result = validateProgramEventLedger(ledger);
  console.log(JSON.stringify({ input: inputPath, ...result }, null, 2));
  if (!result.valid) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
