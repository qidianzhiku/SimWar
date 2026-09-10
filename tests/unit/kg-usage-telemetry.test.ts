import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import {
  buildGraphSupportEnvelopeV12,
  compileUsageReceipt,
  createUsageEvent,
  finalizeUsageEvent,
  reconcileValue,
  sealPreReviewDecision
} from "../../scripts/kg-usage-telemetry.mjs";

const TARGET_SHA = "a".repeat(40);
const TARGET_TREE = "b".repeat(40);
const productRepoRoot = resolve(process.cwd());
const temporaryRoots: string[] = [];

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "simwar-kg-o3b2-"));
  temporaryRoots.push(root);
  return root;
}

function makeEvent(eventId: string, overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "SIMWAR_KG_USAGE_EVENT_V2",
    event_id: eventId,
    event_type: "graph_query",
    occurred_at: "2026-09-10T00:00:00.000Z",
    actor: { type: "agent", id: "worker-001" },
    mission_id: "SIMWAR_KG_O3B2_USAGE_VALUE_TELEMETRY",
    lane: "MAIN",
    target_sha: TARGET_SHA,
    target_tree: TARGET_TREE,
    parents: [],
    payload: { question_id: eventId, outcome: "SOURCE_FALLBACK" },
    ...overrides
  };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("KG-O3B2 usage event DAG", () => {
  it("EV-001 stages an event in an external append-only root", () => {
    const eventRoot = makeRoot();
    const staged = createUsageEvent({
      eventRoot,
      productRepoRoot,
      event: makeEvent("event-001")
    });

    expect(staged.status).toBe("STAGED");
    expect(staged.event_id).toBe("event-001");
    expect(staged.staging_path.startsWith(eventRoot)).toBe(true);
    expect(existsSync(staged.staging_path)).toBe(true);
    expect(existsSync(staged.complete_path)).toBe(false);
    expect(existsSync(staged.final_path)).toBe(false);
    expect(resolve(staged.staging_path).startsWith(productRepoRoot)).toBe(false);
  });

  it("EV-002 completes, hashes, and exclusively finalizes a staged event", () => {
    const eventRoot = makeRoot();
    const staged = createUsageEvent({ eventRoot, productRepoRoot, event: makeEvent("event-002") });
    const finalized = finalizeUsageEvent({ eventRoot, eventId: staged.event_id });

    expect(finalized.status).toBe("FINALIZED");
    expect(finalized.event_hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(existsSync(finalized.complete_path)).toBe(true);
    expect(existsSync(finalized.final_path)).toBe(true);
    expect(JSON.parse(readFileSync(finalized.final_path, "utf8"))).toMatchObject({
      event_id: "event-002",
      storage_status: "FINALIZED",
      event_hash: finalized.event_hash
    });
  });

  it("EV-003 rejects an event root inside or equal to the Product repository", () => {
    expect(() =>
      createUsageEvent({
        eventRoot: productRepoRoot,
        productRepoRoot,
        event: makeEvent("event-003")
      })
    ).toThrow(/external|product repository|outside/iu);
    expect(() =>
      createUsageEvent({
        eventRoot: join(productRepoRoot, "tmp", "kg-events"),
        productRepoRoot,
        event: makeEvent("event-003-nested")
      })
    ).toThrow(/external|product repository|outside/iu);
  });

  it("EV-004 rejects traversal identifiers and symlinked event roots", () => {
    const eventRoot = makeRoot();
    expect(() =>
      createUsageEvent({ eventRoot, productRepoRoot, event: makeEvent("../escape") })
    ).toThrow(/event_id|path|unsafe/iu);

    const symlinkTarget = makeRoot();
    const symlinkRoot = join(makeRoot(), "events-link");
    try {
      symlinkSync(symlinkTarget, symlinkRoot, "junction");
    } catch {
      return;
    }
    expect(() =>
      createUsageEvent({ eventRoot: symlinkRoot, productRepoRoot, event: makeEvent("event-004") })
    ).toThrow(/symlink|reparse|unsafe|external/iu);
  });

  it("EV-005 rejects secret-bearing fields by default and supports explicit redaction", () => {
    const eventRoot = makeRoot();
    expect(() =>
      createUsageEvent({
        eventRoot,
        productRepoRoot,
        event: makeEvent("event-005-reject", { payload: { api_token: "secret-value" } })
      })
    ).toThrow(/secret|redact/iu);

    const redacted = createUsageEvent({
      eventRoot,
      productRepoRoot,
      secretPolicy: "redact",
      event: makeEvent("event-005-redact", {
        payload: { api_token: "secret-value", note: "Bearer abc.def.ghi" }
      })
    });
    const stored = JSON.parse(readFileSync(redacted.staging_path, "utf8"));
    expect(JSON.stringify(stored)).not.toContain("secret-value");
    expect(JSON.stringify(stored)).not.toContain("abc.def.ghi");
    expect(redacted.redactions.length).toBeGreaterThan(0);
  });

  it("EV-006 rejects a duplicate event id whose immutable content conflicts", () => {
    const eventRoot = makeRoot();
    createUsageEvent({ eventRoot, productRepoRoot, event: makeEvent("event-006") });
    expect(() =>
      createUsageEvent({
        eventRoot,
        productRepoRoot,
        event: makeEvent("event-006", { payload: { question_id: "changed" } })
      })
    ).toThrow(/duplicate|conflict|immutable/iu);
  });

  it("EV-007 reuses an identical event without overwriting the final artifact", () => {
    const eventRoot = makeRoot();
    const first = createUsageEvent({ eventRoot, productRepoRoot, event: makeEvent("event-007") });
    const finalized = finalizeUsageEvent({ eventRoot, eventId: first.event_id });
    const reused = createUsageEvent({ eventRoot, productRepoRoot, event: makeEvent("event-007") });

    expect(reused.status).toBe("REUSED");
    expect(reused.event_hash).toBe(finalized.event_hash);
    expect(reused.final_path).toBe(finalized.final_path);
  });

  it("EV-008 retains unresolved parent references explicitly", () => {
    const eventRoot = makeRoot();
    const staged = createUsageEvent({
      eventRoot,
      productRepoRoot,
      event: makeEvent("event-008", { parents: ["missing-parent"] })
    });
    const finalized = finalizeUsageEvent({ eventRoot, eventId: staged.event_id });
    const receipt = compileUsageReceipt({ eventRoot, productRepoRoot });

    expect(finalized.unresolved_parents).toEqual(["missing-parent"]);
    expect(receipt.unresolved_parents).toEqual([
      { event_id: "event-008", parent_id: "missing-parent" }
    ]);
    expect(receipt.status).toBe("PASS_WITH_LIMITS");
  });

  it("EV-009 compiles known parents before children with stable tie-breaking", () => {
    const eventRoot = makeRoot();
    const parent = createUsageEvent({
      eventRoot,
      productRepoRoot,
      event: makeEvent("event-009-parent")
    });
    const child = createUsageEvent({
      eventRoot,
      productRepoRoot,
      event: makeEvent("event-009-child", { parents: [parent.event_id] })
    });
    finalizeUsageEvent({ eventRoot, eventId: child.event_id });
    finalizeUsageEvent({ eventRoot, eventId: parent.event_id });

    const receipt = compileUsageReceipt({ eventRoot, productRepoRoot });
    expect(receipt.event_ids).toEqual(["event-009-parent", "event-009-child"]);
    expect(receipt.events.map((event) => event.event_id)).toEqual(receipt.event_ids);
  });

  it("EV-010 emits an external receipt that records source-bound event evidence", () => {
    const eventRoot = makeRoot();
    const staged = createUsageEvent({ eventRoot, productRepoRoot, event: makeEvent("event-010") });
    finalizeUsageEvent({ eventRoot, eventId: staged.event_id });
    const receipt = compileUsageReceipt({ eventRoot, productRepoRoot });

    expect(receipt.schema_version).toBe("SIMWAR_KG_USAGE_RECEIPT_V2");
    expect(receipt.event_root_external).toBe(true);
    expect(receipt.events).toHaveLength(1);
    expect(receipt.receipt_hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(receipt.authority).toBe("DERIVED_ENGINEERING_EVIDENCE_ONLY");
  });
});

describe("KG-O3B2 receipt determinism and review boundary", () => {
  it("keeps receipt hashes and event order deterministic across repeated compilation", () => {
    const eventRoot = makeRoot();
    for (const id of ["event-b", "event-a", "event-c"]) {
      const staged = createUsageEvent({ eventRoot, productRepoRoot, event: makeEvent(id) });
      finalizeUsageEvent({ eventRoot, eventId: staged.event_id });
    }

    const first = compileUsageReceipt({ eventRoot, productRepoRoot });
    const second = compileUsageReceipt({ eventRoot, productRepoRoot });
    expect(second).toEqual(first);
    expect(first.event_ids).toEqual(["event-a", "event-b", "event-c"]);
  });

  it("seals a pre-review decision without granting Product or formal approval", () => {
    const eventRoot = makeRoot();
    const staged = createUsageEvent({ eventRoot, productRepoRoot, event: makeEvent("seal-event") });
    finalizeUsageEvent({ eventRoot, eventId: staged.event_id });
    const receipt = compileUsageReceipt({ eventRoot, productRepoRoot });
    const seal = sealPreReviewDecision({
      receipt,
      decision: { outcome: "READY_FOR_REVIEW", reviewer: "human-001" }
    });

    expect(seal.status).toBe("PRE_REVIEW_SEALED");
    expect(seal.receipt_hash).toBe(receipt.receipt_hash);
    expect(seal.approval).toBe("NOT_GRANTED");
    expect(seal.product_truth_write).toBe(false);
  });
});

describe("KG-O3B2 value reconciliation", () => {
  it("does not prove value from recommendations or shadow observations alone", () => {
    const result = reconcileValue({
      knowledge_card: { id: "card-1", claim: "graph finds the canonical writer" },
      source: { ref: "services/api/src/routes/example.ts", digest: "source-digest" },
      before_judgement: { result: "uncertain" },
      after_judgement: { result: "confident" },
      recommendation: { id: "recommendation-1" },
      shadow_observation: { outcome: "candidate" }
    });

    expect(result.status).toBe("DEVELOPMENT_VALUE_NOT_PROVEN");
    expect(result.missing).toEqual(expect.arrayContaining(["changed_artifact", "actual_action"]));
    expect(result.statistics).toBe("NOT_COMPUTED");
  });

  it("proves development value only when the full source-to-action chain reconciles", () => {
    const result = reconcileValue({
      knowledge_card: { id: "card-2", claim: "graph finds the canonical writer" },
      source: { ref: "services/api/src/routes/example.ts", digest: "source-digest" },
      before_judgement: { result: "uncertain" },
      after_judgement: { result: "correct", evidence_ref: "changed-1" },
      changed_artifact: { ref: "tests/unit/example.test.ts", digest: "artifact-digest" },
      actual_action: { action_id: "action-1", outcome: "test-added" },
      counterfactual: { available: true, result: "without-graph-missed" }
    });

    expect(result.status).toBe("DEVELOPMENT_VALUE_PROVEN");
    expect(result.chain_complete).toBe(true);
    expect(result.missing).toEqual([]);
  });
});

describe("KG-O3B2 Graph Support Envelope V1.2", () => {
  it("extends the compact envelope with usage receipt and value limits", () => {
    const envelope = buildGraphSupportEnvelopeV12({
      mission_id: "SIMWAR_KG_O3B2_USAGE_VALUE_TELEMETRY",
      lane: "MAIN",
      target_sha: TARGET_SHA,
      target_tree: TARGET_TREE,
      risk_class: "G2",
      risk_reasons: ["external telemetry evidence"],
      canonical_seam: "scripts/kg-usage-telemetry.mjs",
      decision_needed: "review graph support and development value",
      tool_route: { codegraph: "REQUIRED", graphify: "OPTIONAL_BY_APPLICABILITY" },
      source_anchors: ["scripts/kg-usage-telemetry.mjs"],
      mandatory_tests: ["tests/unit/kg-usage-telemetry.test.ts"],
      usage_receipt: { receipt_hash: "c".repeat(64), event_count: 1 },
      value_reconciliation: { status: "DEVELOPMENT_VALUE_NOT_PROVEN" },
      admission: "SOURCE_FALLBACK"
    });

    expect(envelope.schema_version).toBe("SIMWAR_GRAPH_SUPPORT_ENVELOPE_V1_2");
    expect(envelope.authority).toBe("DERIVED_ENGINEERING_EVIDENCE_ONLY");
    expect(envelope.usage_receipt).toMatchObject({ receipt_hash: "c".repeat(64) });
    expect(envelope.value_reconciliation.status).toBe("DEVELOPMENT_VALUE_NOT_PROVEN");
    expect(envelope.non_goals).toContain("product truth");
  });
});
