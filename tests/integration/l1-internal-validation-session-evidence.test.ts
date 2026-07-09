import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CURRENT_MASTER = "19d662f51e25301cd60fe9fa2965b3fd538e5fab";
const RELATION_ONLY_ISSUES = ["Relates to #111", "Relates to #114", "Relates to #115"];

const evidenceDocs = [
  "docs/quality/l1-session-evidence-pack.md",
  "docs/quality/l1-observed-failure-log.md",
  "docs/quality/l1-known-limits-delta.md",
  "docs/quality/l1-validation-issue-candidate-register.md",
  "docs/operations/l1-abort-recovery-result.md",
  "docs/operations/l1-synthetic-cleanup-proof.md",
  "docs/operations/l1-replay-evidence-review-result.md"
] as const;

const requiredSections = [
  "Evidence Type:",
  "Source SHA:",
  "Branch / PR:",
  "File / Command:",
  "Result:",
  "Scope of Proof:",
  "Explicit Non-Proof:",
  "Owner:",
  "Collected At:",
  "Expiry Trigger:",
  "Revalidation Command:",
  "No-Go Trigger:"
] as const;

const forbiddenStudentMarkers = [
  "state_true",
  "private_replay",
  "private trace",
  "canonical_evidence_digest",
  "decision_batch_hash",
  "json_runtime_source_digest",
  "other team data",
  "other tenant data"
] as const;

function readRequired(path: string): string {
  expect(existsSync(path), `${path} must exist`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("L1 internal validation synthetic session evidence pack", () => {
  it("creates every evidence document with the current source anchor and status boundary", () => {
    for (const path of evidenceDocs) {
      const doc = readRequired(path);

      expect(doc).toContain(CURRENT_MASTER);
      expect(doc).toContain("G0 Status:");
      expect(doc).toContain("EXCEPTION");
      expect(doc).toContain("G0 PASS:");
      expect(doc).toContain("NOT_GRANTED");
      expect(doc).toContain("L1 Status:");
      expect(doc).toContain("NOT_READY");
      expect(doc).toContain("Phase 7 Status:");
      expect(doc).toContain("SYNTHETIC_SESSION_EVIDENCE_PR_CREATED");
      expect(doc).toContain("PostgreSQL Runtime:");
      expect(doc).toContain("NOT_AUTHORIZED");
      expect(doc).toContain("Pilot / Production:");
      expect(doc).toContain("NOT_AUTHORIZED");

      for (const issue of RELATION_ONLY_ISSUES) {
        expect(doc).toContain(issue);
      }
    }
  });

  it("records evidence handoff fields, explicit non-proofs, and no-go triggers", () => {
    const combined = evidenceDocs.map(readRequired).join("\n");

    for (const section of requiredSections) {
      expect(combined).toContain(section);
    }

    expect(combined).toContain("Synthetic validation evidence PR != human teacher rehearsal");
    expect(combined).toContain("Synthetic validation evidence PR != L1 READY");
    expect(combined).toContain("Session Evidence Pack != Controlled Pilot");
    expect(combined).toContain("Cleanup Proof != durable backup / restore proof");
    expect(combined).toContain("Replay Evidence Review Result != durable recovery");
    expect(combined).toContain("Security audit pass != complete security proof");
    expect(combined).toContain("JSON runtime != durable settlement");
    expect(combined).toContain("real customer data: NOT_USED");
    expect(combined).toContain("actual human teacher rehearsal: NOT_RUN");
    expect(combined).toContain("replay_writes_formal_results = false");
  });

  it("preserves session evidence coverage, student visibility no-go markers, and issue queue boundaries", () => {
    const sessionPack = readRequired("docs/quality/l1-session-evidence-pack.md");
    const issueRegister = readRequired("docs/quality/l1-validation-issue-candidate-register.md");

    for (const phrase of [
      "Teacher path",
      "Student path",
      "Tenant Admin path",
      "Platform Admin path",
      "Replay Evidence Review",
      "Abort / Recovery Result",
      "Synthetic Data Cleanup Proof",
      "Known Limits Delta",
      "Issue Queue Candidate Register"
    ]) {
      expect(sessionPack).toContain(phrase);
    }

    for (const marker of forbiddenStudentMarkers) {
      expect(sessionPack).toContain(marker);
      expect(issueRegister).toContain(marker);
    }

    expect(issueRegister).toContain("Issue mutation: NOT_AUTHORIZED");
    expect(issueRegister).toContain("Issue closeout: NOT_AUTHORIZED");
    expect(issueRegister).not.toMatch(/\b(Fixes|Closes|Resolves)\s+#(111|114|115)\b/i);
  });
});
