import { describe, expect, it } from "vitest";
import {
  createM2P5ContextDigest,
  type GSIContextBinding
} from "../../services/api/src/gsi-cross-round-context-adapter.js";

const context: GSIContextBinding = {
  activity_id: "activity_demo",
  course_id: "course_demo",
  role_key: "CEO",
  round_id: "round_2",
  round_no: 2,
  run_id: "run_demo",
  team_id: "team_demo",
  tenant_id: "tenant_demo"
};

describe("M2P5 context digest", () => {
  it("moves when role-safe learning state changes", () => {
    const base = {
      context,
      publication: { status: "PUBLISHED" },
      record_id: "w3_record_demo",
      source: { canonical_decision_ref: "decision_demo" },
      learning: {
        gate: "BLOCKED",
        reflection_status: "MISSING",
        teacher_confirmation_status: "PENDING",
        evidence_selection_status: "MISSING",
        student_learning_report_status: "MISSING",
        next_round_hypothesis_status: "MISSING"
      }
    } as const;
    const changed = {
      ...base,
      learning: { ...base.learning, gate: "READY", reflection_status: "SUBMITTED" }
    };

    expect(createM2P5ContextDigest(base)).not.toBe(createM2P5ContextDigest(changed));
  });
});
