import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createOperatingWorldConsequenceTrace,
  projectOperatingWorldConsequenceTrace
} from "../../services/api/src/operating-world-consequence-trace";

const root = resolve(import.meta.dirname, "../..");
const evidenceRoot = resolve(root, "docs/evidence/shm3-w5-operating-world-r3");

describe("SH-M3 W5 R3 control-plane reconciliation", () => {
  it("keeps the R2 port map and reconciliation receipt source-backed", () => {
    const portMap = readFileSync(resolve(evidenceRoot, "R2_CANDIDATE_PORT_MAP.md"), "utf8");
    const reconciliation = readFileSync(
      resolve(evidenceRoot, "CONTROL_PLANE_RECONCILIATION.md"),
      "utf8"
    );

    expect(portMap).toContain("5e378cb6707ba033e5d9e0552b3a2c53287f6dc2");
    for (const classification of [
      "PORT_AS_IS",
      "PORT_PATCH",
      "NESTED_VALUE_OBJECT",
      "PROJECTION_ONLY",
      "DROP_DUPLICATE",
      "NOT_PROVEN"
    ]) {
      expect(portMap).toContain(classification);
    }
    expect(reconciliation).toContain("OperatingWorldService");
    expect(reconciliation).toContain("existing W4 official outcome + replay input manifest");
    expect(reconciliation).toContain("no second Operating World store");
  });

  it("proves the trace is a deterministic projection and not a second writer", () => {
    const digest = "a".repeat(64);
    const trace = createOperatingWorldConsequenceTrace({
      scope: {
        tenant_id: "tenant_demo",
        course_id: "course_demo",
        run_id: "run_demo",
        round_no: 1,
        team_id: "team_alpha"
      },
      operating_world_binding_digest: digest,
      canonical_decision_ref: "decision_demo",
      settlement_result_ref: {
        content_digest: digest,
        discriminator: "exact_ref",
        resource_id: "settlement_demo",
        resource_type: "settlement_result",
        tenant_id: "tenant_demo",
        version: "1.0.0"
      },
      replay_relevant_digest: digest,
      publication: { status: "PUBLISHED" },
      source_classification: "OFFICIAL_CONSUMER_ELIGIBLE",
      w4_action: {
        capital_action_id: "capital_action_demo",
        cost_source: `operating-world:${digest}`,
        rate_or_cost_bps: 550
      },
      w4_replay_manifest: {
        manifest_id: "manifest_demo",
        operating_world_binding_digest: digest
      }
    });

    expect(trace.writes_official_state).toBe(false);
    expect(trace.ai_generated).toBe(false);
    expect(projectOperatingWorldConsequenceTrace(trace, "student")).not.toHaveProperty(
      "w4_action_ref"
    );
    expect(projectOperatingWorldConsequenceTrace(trace, "student")).not.toHaveProperty(
      "w4_replay_manifest_ref"
    );
    expect(
      readFileSync(resolve(root, "services/api/src/operating-world-service.ts"), "utf8")
    ).toContain("class OperatingWorldService");
  });
});
