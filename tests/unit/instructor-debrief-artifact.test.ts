import { describe, expect, it } from "vitest";
import type {
  InstructorAssetDTO,
  PublicResultView,
  Round,
  SettlementResult
} from "../../packages/shared-contracts/src";
import {
  createInstructorDebriefArtifact,
  renderInstructorDebriefMarkdown,
  serializeInstructorDebriefArtifactJson
} from "../../services/api/src/instructor-intelligence";

const asset: InstructorAssetDTO = {
  asset_id: "asset_001",
  course_blueprint_ref: {
    content_digest: "a".repeat(64),
    discriminator: "exact_ref",
    resource_id: "blueprint_001",
    resource_type: "course_blueprint",
    tenant_id: "tenant_demo",
    version: "1.0.0"
  },
  course_id: "course_demo",
  created_at: "2026-08-01T12:00:00.000Z",
  created_by: "teacher_demo",
  fact_digest: "b".repeat(64),
  status: "teacher_published",
  tenant_id: "tenant_demo",
  title: "Debrief",
  updated_at: "2026-08-01T12:00:00.000Z"
};

const round: Round = {
  round_id: "round_001",
  round_no: 1,
  run_id: "run_001",
  status: "published",
  tenant_id: "tenant_demo"
};

const resultView: PublicResultView = {
  classroom_debrief_prompts: [],
  replay_hash: "c".repeat(64),
  result_label: "M1 Teaching-Official Result under Current JSON Active Runtime",
  results: [],
  round_no: 1,
  run_id: "run_001",
  runtime_boundary: "current_json_active_runtime",
  runtime_limitations: [],
  status: "published"
};

const settlement: SettlementResult = {
  parameter_set_id: "param_001",
  replay_hash: "c".repeat(64),
  round_id: "round_001",
  round_no: 1,
  run_id: "run_001",
  scenario_package_id: "scenario_001",
  settlement_result_id: "settlement_001",
  team_results: [],
  tenant_id: "tenant_demo"
};

describe("InstructorDebriefArtifact", () => {
  it("binds the official source, is deterministic, and renders a derived markdown projection", () => {
    const input = { asset, result_view: resultView, round, settlement };
    const first = createInstructorDebriefArtifact(input);
    const second = createInstructorDebriefArtifact(input);

    expect(first).toEqual(second);
    expect(first.artifact_schema_version).toBe("instructor-debrief-artifact.v1");
    expect(first.authority_class).toBe("ADVISORY_ONLY");
    expect(first.ai_status).toBe("off");
    expect(first.source_binding.settlement_result_id).toBe("settlement_001");
    expect(first.source_binding.replay_hash).toBe("c".repeat(64));
    expect(first.source_binding.baseline.status).toBe("baseline_unavailable");
    expect(first.artifact_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(serializeInstructorDebriefArtifactJson(first)).toBe(
      serializeInstructorDebriefArtifactJson(second)
    );
    expect(renderInstructorDebriefMarkdown(first)).toContain(first.artifact_digest);
    expect(JSON.stringify(first)).not.toContain("state_true");
    expect(JSON.stringify(first)).not.toContain("decision_batch_hash");
  });

  it("rejects absent official results, invalid replay hashes, and source scope mismatches", () => {
    expect(() =>
      createInstructorDebriefArtifact({ asset, result_view: resultView, round })
    ).toThrow("INSTRUCTOR_DEBRIEF_SETTLEMENT_RESULT_REQUIRED");
    expect(() =>
      createInstructorDebriefArtifact({
        asset,
        result_view: resultView,
        round,
        settlement: { ...settlement, replay_hash: "invalid" }
      })
    ).toThrow("INSTRUCTOR_DEBRIEF_REPLAY_HASH_INVALID");
    expect(() =>
      createInstructorDebriefArtifact({
        asset,
        result_view: resultView,
        round,
        settlement: { ...settlement, tenant_id: "tenant_other" }
      })
    ).toThrow("INSTRUCTOR_DEBRIEF_SOURCE_SCOPE_MISMATCH");
  });
});
