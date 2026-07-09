import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CURRENT_MASTER = "26be81a7f89bcba883e20ab80894d5284e39e681";
const RELATION_ONLY_ISSUES = ["Relates to #111", "Relates to #114", "Relates to #115"];
const FORBIDDEN_STUDENT_MARKERS = [
  "state_true",
  "private_replay",
  "private trace",
  "ReplayManifest",
  "replay_manifest",
  "decision_batch_hash",
  "json_runtime_source_digest",
  "canonical_evidence_digest",
  "tenant_other",
  "other team data",
  "Teacher private evidence"
];

const phase7Docs = [
  "docs/operations/l1-internal-validation-entry-package.md",
  "docs/operations/l1-internal-validation-dry-run-harness.md",
  "docs/quality/l1-internal-validation-evidence-pack.md"
] as const;

const requiredPackLinks = [
  "docs/operations/l1-teacher-kit-internal-only.md",
  "docs/operations/l1-session-runbook-lite.md",
  "docs/operations/l1-synthetic-data-reset-and-abort.md",
  "docs/operations/l1-replay-evidence-review-checklist.md",
  "docs/operations/l1-issue-escalation-procedure.md",
  "docs/operations/r8-g1-internal-application-pack-index.md",
  "docs/quality/l1-known-limits-and-release-note.md",
  "tests/integration/l1-internal-validation-rehearsal-gate.test.ts",
  "tests/integration/l1-session-abort-reset-recovery.test.ts",
  "tests/integration/teacher-student-bff-dto-productization.test.ts"
] as const;

function readRequiredDocument(path: string): string {
  expect(existsSync(path), `${path} must exist`).toBe(true);
  return readFileSync(path, "utf8");
}

function assertStatusBoundary(document: string): void {
  expect(document).toContain("G0 Status:");
  expect(document).toContain("EXCEPTION");
  expect(document).toContain("G0 PASS:");
  expect(document).toContain("NOT_GRANTED");
  expect(document).toContain("L1 Status:");
  expect(document).toContain("NOT_READY");
  expect(document).toContain("R8-G1 Status:");
  expect(document).toContain("MERGED_AND_POSTMERGE_VALIDATED");
  expect(document).toContain("PostgreSQL Runtime:");
  expect(document).toContain("NOT_AUTHORIZED");
  expect(document).toContain("Pilot / Production:");
  expect(document).toContain("NOT_AUTHORIZED");
  expect(document).toContain("Durable Settlement:");
  expect(document).toContain("NOT_PROVEN");
}

function assertRelationOnlyGovernance(document: string): void {
  for (const issue of RELATION_ONLY_ISSUES) {
    expect(document).toContain(issue);
  }

  expect(document).not.toMatch(/\b(?:Closes|Fixes|Resolves)\s+#(?:111|114|115)\b/i);
}

describe("L1 internal validation dry-run harness package", () => {
  it("binds Phase 7 dry-run documentation to the merged R8-G1 pack without release claims", () => {
    for (const path of phase7Docs) {
      const document = readRequiredDocument(path);

      expect(document).toContain(CURRENT_MASTER);
      expect(document).toContain("PR #217");
      expect(document).toContain("Phase 7");
      expect(document).toContain("L1 Internal Application Validation");
      expect(document).toContain("internal-only");
      expect(document).toContain("dry-run");
      expect(document).toContain("evidence pack");
      assertStatusBoundary(document);
      assertRelationOnlyGovernance(document);

      for (const link of requiredPackLinks) {
        expect(document).toContain(link);
      }
    }
  });

  it("records Student visibility, replay, reset, cleanup, and escalation no-go triggers", () => {
    const entryPackage = readRequiredDocument(
      "docs/operations/l1-internal-validation-entry-package.md"
    );
    const dryRunHarness = readRequiredDocument(
      "docs/operations/l1-internal-validation-dry-run-harness.md"
    );
    const evidencePack = readRequiredDocument(
      "docs/quality/l1-internal-validation-evidence-pack.md"
    );
    const combined = [entryPackage, dryRunHarness, evidencePack].join("\n");

    for (const marker of FORBIDDEN_STUDENT_MARKERS) {
      expect(combined).toContain(marker);
    }

    expect(combined).toContain("Teacher path");
    expect(combined).toContain("Student path");
    expect(combined).toContain("Tenant Admin path");
    expect(combined).toContain("Platform Admin path");
    expect(combined).toContain("Replay Review path");
    expect(combined).toContain("Abort / Reset path");
    expect(combined).toContain("Cleanup path");
    expect(combined).toContain("Issue Escalation path");
    expect(combined).toContain("replay_writes_formal_results = false");
    expect(combined).toContain("No-Go Trigger");
    expect(combined).toContain("Expiry Trigger");
    expect(combined).toContain("Explicit Non-Proof");
    expect(combined).toContain("Actual L1 Internal Validation: NOT_RUN");
    expect(combined).toContain("real teacher rehearsal: NOT_AUTHORIZED");
  });

  it("updates the evidence ledger with Phase 7 dry-run harness reviewability", () => {
    const ledger = readRequiredDocument("docs/quality/l1-g0-g7-current-evidence-ledger.md");

    expect(ledger).toContain("Program 041A Phase 7 Dry-run Harness Addendum");
    expect(ledger).toContain(CURRENT_MASTER);
    expect(ledger).toContain("PHASE7_ENTRY_PACKAGE_EVIDENCE");
    expect(ledger).toContain("L1_DRY_RUN_HARNESS_EVIDENCE");
    expect(ledger).toContain("L1_EVIDENCE_PACK_EVIDENCE");
    expect(ledger).toContain(
      "PROGRAM_COMPLETED_L1_DRY_RUN_HARNESS_PR_CREATED_PENDING_INDEPENDENT_EVIDENCE_REVIEW"
    );
    expect(ledger).toContain("L1 Status: NOT_READY");
    expect(ledger).toContain("Dry-run harness PR created != L1 Internal Validation completed");
  });
});
