/** @vitest-environment jsdom */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ESLAdminProjection } from "@simwar/shared-contracts";
import { ExecutiveStrategyLabFinanceModelProvenance } from "../../apps/admin/src/ExecutiveStrategyLabAuditPanel";

const financeModel: ESLAdminProjection["finance_models"][number] = {
  path_id: "path_capital",
  model: {
    source_kind: "BUILT_IN_DETERMINISTIC_CALCULATOR",
    source_ref: "services/simulation-core/src/executive-capital-feasibility.ts",
    model_version_id: "esl-finance-projector",
    model_version: "1.0.0",
    model_artifact_id: "esl-finance-projector",
    model_artifact_version: "1.0.0",
    engine_id: "simulation-core-esl-finance-projector",
    parameter_set_id: "esl-finance-projector-parameters",
    parameter_set_version: "1.0.0"
  },
  input_digest: "a".repeat(64),
  source_refs: ["w4_state:state-close@digest"]
};

describe("Executive Strategy Lab Admin components", () => {
  it("renders every finance model identity field needed for exact audit and rollback", () => {
    const markup = renderToStaticMarkup(
      <ExecutiveStrategyLabFinanceModelProvenance model={financeModel} />
    );

    for (const value of [
      financeModel.model.source_kind,
      financeModel.model.source_ref,
      financeModel.model.model_version_id,
      financeModel.model.model_version,
      financeModel.model.model_artifact_id,
      financeModel.model.model_artifact_version,
      financeModel.model.engine_id,
      financeModel.model.parameter_set_id,
      financeModel.model.parameter_set_version,
      financeModel.input_digest,
      ...financeModel.source_refs
    ]) {
      expect(markup).toContain(value);
    }
  });
});
