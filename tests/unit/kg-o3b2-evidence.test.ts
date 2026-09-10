import { describe, expect, it } from "vitest";

import {
  compareHistoricalCells,
  createHistoricalCell,
  sealHistoricalCell,
  selectForwardPilot
} from "../../scripts/kg-o3b2-evidence.mjs";

const HISTORICAL_TARGET_SHA = "14e577bf9c8745e3b8694812efb88fe3f4188e4a";
const HISTORICAL_TREE_SHA = "a".repeat(40);
const CURRENT_REPAIRED_SOURCE_SHA = "b53de10316b23ce620b1bf311c70feb3c9b971da";

function makeCellInput(cellId: "control" | "treatment", overrides: Record<string, unknown> = {}) {
  return {
    experiment_id: "HC-07",
    task_id: "HC-07",
    cell_id: cellId,
    cell_kind: cellId === "control" ? "SOURCE_ONLY" : "KG_ASSISTED",
    target_sha: HISTORICAL_TARGET_SHA,
    target_tree_sha: HISTORICAL_TREE_SHA,
    source_snapshot: {
      target_sha: HISTORICAL_TARGET_SHA,
      tree_sha: HISTORICAL_TREE_SHA,
      provenance: "HISTORICAL_SNAPSHOT"
    },
    current_repaired_source_sha: CURRENT_REPAIRED_SOURCE_SHA,
    observation: {
      finding_id: cellId === "control" ? "missed-finding" : "lineage-finding",
      finding_correct: cellId === "treatment",
      total_investigation_ms: cellId === "control" ? 120 : 140,
      scope_delta: cellId === "control" ? 0 : 1,
      mandatory_test_delta: cellId === "control" ? 0 : 1,
      authority_delta: 0
    },
    ...overrides
  };
}

describe("KG-O3B2 historical evidence isolation", () => {
  it("rejects a blind cell whose source snapshot is not the exact historical target", () => {
    expect(() =>
      createHistoricalCell(
        makeCellInput("control", {
          source_snapshot: {
            target_sha: CURRENT_REPAIRED_SOURCE_SHA,
            tree_sha: HISTORICAL_TREE_SHA,
            provenance: "CURRENT_REPAIRED_SOURCE"
          }
        })
      )
    ).toThrow(/historical|current|target|source/i);
  });

  it("rejects a non-exact historical target instead of accepting a branch or short SHA", () => {
    expect(() =>
      createHistoricalCell(
        makeCellInput("control", { target_sha: "14e577b", target_tree_sha: HISTORICAL_TREE_SHA })
      )
    ).toThrow(/exact|sha|target/i);
  });

  it("keeps the answer key withheld until both blind cells are sealed", () => {
    const control = createHistoricalCell(makeCellInput("control"));
    const treatment = createHistoricalCell(makeCellInput("treatment"));
    const answerKey = { finding_id: "lineage-finding", category: "context_propagation_gap" };

    const beforeSeals = compareHistoricalCells({ control, treatment, answer_key: answerKey });
    expect(beforeSeals.status).toBe("WAITING_FOR_BOTH_CELLS_TO_SEAL");
    expect(beforeSeals.answer_key_status).toBe("WITHHELD");
    expect(beforeSeals).not.toHaveProperty("answer_key");

    const controlSealed = sealHistoricalCell({ cell: control, sealed_at: "2026-09-10T00:00:00.000Z" });
    const afterOneSeal = compareHistoricalCells({
      control: controlSealed,
      treatment,
      answer_key: answerKey
    });
    expect(afterOneSeal.status).toBe("WAITING_FOR_BOTH_CELLS_TO_SEAL");
    expect(afterOneSeal).not.toHaveProperty("answer_key");

    const treatmentSealed = sealHistoricalCell({ cell: treatment, sealed_at: "2026-09-10T00:01:00.000Z" });
    const compared = compareHistoricalCells({
      control: controlSealed,
      treatment: treatmentSealed,
      answer_key: answerKey
    });
    expect(compared.status).toBe("COMPARED");
    expect(compared.answer_key_status).toBe("REVEALED_AFTER_BOTH_CELLS_SEALED");
    expect(compared.answer_key).toEqual(answerKey);
  });

  it("rejects a sealed cell whose seal hash does not match its contents", () => {
    const control = sealHistoricalCell({ cell: createHistoricalCell(makeCellInput("control")) });
    const treatment = sealHistoricalCell({ cell: createHistoricalCell(makeCellInput("treatment")) });
    const tampered = { ...control, observation: { ...control.observation, scope_delta: 99 } };

    const result = compareHistoricalCells({
      control: tampered,
      treatment,
      answer_key: { finding_id: "lineage-finding", category: "context_propagation_gap" }
    });

    expect(result.status).toBe("SEALED_HASH_MISMATCH");
    expect(result).not.toHaveProperty("answer_key");
  });

  it("derives finding correctness from the sealed answer key, not a cell self-report", () => {
    const control = sealHistoricalCell({ cell: createHistoricalCell(makeCellInput("control")) });
    const treatment = sealHistoricalCell({
      cell: createHistoricalCell(
        makeCellInput("treatment", {
          observation: {
            finding_id: "wrong-finding",
            finding_correct: true,
            total_investigation_ms: 140,
            scope_delta: 1,
            mandatory_test_delta: 1,
            authority_delta: 0
          }
        })
      )
    });

    const result = compareHistoricalCells({
      control,
      treatment,
      answer_key: { finding_id: "lineage-finding", category: "context_propagation_gap" }
    });

    expect(result.finding_correct).toBe(false);
    expect(result.finding_missed).toBe(true);
    expect(result.contribution).toBe("FN");
  });

  it("classifies HC-07 from the historical cells without treating the repaired source as input", () => {
    const control = sealHistoricalCell({ cell: createHistoricalCell(makeCellInput("control")) });
    const treatment = sealHistoricalCell({ cell: createHistoricalCell(makeCellInput("treatment")) });
    const result = compareHistoricalCells({
      control,
      treatment,
      answer_key: { finding_id: "lineage-finding", category: "context_propagation_gap" }
    });

    expect(result).toMatchObject({
      experiment_id: "HC-07",
      task_id: "HC-07",
      historical_only: true,
      target_sha: HISTORICAL_TARGET_SHA,
      current_repaired_source_used: false,
      finding_correct: true,
      finding_missed: false,
      contribution: "MATERIAL",
      statistics: "NOT_COMPUTED"
    });
    expect(result.target_sha).not.toBe(CURRENT_REPAIRED_SOURCE_SHA);
  });

  it("returns the exact waiting state when HC-07 is the only candidate and cannot become a forward pilot", () => {
    const result = selectForwardPilot({
      current_repaired_source_sha: CURRENT_REPAIRED_SOURCE_SHA,
      tasks: [
        {
          task_id: "HC-07",
          kind: "HISTORICAL_COMPARISON",
          pre_review: true,
          target_sha: HISTORICAL_TARGET_SHA
        }
      ]
    });

    expect(result.state).toBe("WAITING_FOR_NEXT_PRE_REVIEW_PRODUCT_TASK");
    expect(result.selected_task).toBeNull();
    expect(result.excluded_tasks[0]).toMatchObject({
      task_id: "HC-07",
      reason: "HISTORICAL_COMPARISON_NOT_FORWARD_ELIGIBLE"
    });
  });

  it("selects an explicitly eligible pre-review Product task and excludes completed or historical work", () => {
    const result = selectForwardPilot({
      current_repaired_source_sha: CURRENT_REPAIRED_SOURCE_SHA,
      tasks: [
        { task_id: "post-review", kind: "PRODUCT", pre_review: false, status: "MERGED" },
        { task_id: "historical-509", kind: "PRODUCT", pre_review: true, historical: true },
        { task_id: "PRODUCT-001", kind: "PRODUCT", pre_review: true, status: "OPEN", priority: 2 },
        { task_id: "PRODUCT-002", kind: "PRODUCT", pre_review: true, status: "OPEN", priority: 1 }
      ]
    });

    expect(result.state).toBe("SELECTED_PRE_REVIEW_PRODUCT_TASK");
    expect(result.selected_task).toMatchObject({ task_id: "PRODUCT-002" });
    expect(result.eligible_count).toBe(2);
  });
});
