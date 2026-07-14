import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SOURCE_ANCHOR = "695cf955b3c9ab1d96b7fb59ac92671cf82dfdcf";
const EXCEPTION_EXPIRY = "2026-07-21T23:59:59+08:00";

const packFiles = [
  "docs/operations/l1-teacher-kit-internal-only.md",
  "docs/operations/l1-session-runbook-lite.md",
  "docs/operations/l1-synthetic-data-reset-and-abort.md",
  "docs/operations/l1-replay-evidence-review-checklist.md",
  "docs/operations/l1-issue-escalation-procedure.md",
  "docs/operations/r8-g1-internal-application-pack-index.md",
  "docs/operations/phase6-limited-internal-evidence-capture-template.md",
  "docs/quality/l1-known-limits-and-release-note.md"
] as const;

function readRepositoryFile(path: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");
}

describe("Phase 6 limited internal application pack contract", () => {
  it("binds every pack document to the fixed source and status boundary", () => {
    for (const path of packFiles) {
      const content = readRepositoryFile(path);

      expect(content, path).toContain(SOURCE_ANCHOR);
      expect(content, path).toContain("G0 Status:");
      expect(content, path).toContain("EXCEPTION");
      expect(content, path).toContain("G0 PASS:");
      expect(content, path).toContain("NOT_GRANTED");
      expect(content, path).toContain("L1 Status:");
      expect(content, path).toContain("NOT_READY");
      expect(content, path).toContain("Phase 7:");
      expect(content, path).toContain("NOT_AUTHORIZED");
    }
  });

  it("publishes one complete, expiring internal-only manifest", () => {
    const manifest = readRepositoryFile("docs/operations/r8-g1-internal-application-pack-index.md");

    expect(manifest).toContain("PHASE6_PACK_PR_CANDIDATE");
    expect(manifest).toContain(EXCEPTION_EXPIRY);
    expect(manifest).toContain("G5 = PASS_WITH_LIMITS");
    expect(manifest).toContain("G6 = PASS_WITH_LIMITS");
    expect(manifest).toContain("POSTMERGE_PHASE6_CLOSURE_REQUIRED");
    for (const path of packFiles) {
      expect(manifest).toContain(path);
    }
  });

  it("keeps the evidence form synthetic, role-scoped, and non-authoritative", () => {
    const template = readRepositoryFile(
      "docs/operations/phase6-limited-internal-evidence-capture-template.md"
    );

    for (const field of [
      "source_sha",
      "actor_role",
      "tenant_id",
      "run_id",
      "round_no",
      "request_id",
      "evidence_label",
      "explicit_non_proof",
      "expiry_trigger",
      "no_go_trigger"
    ]) {
      expect(template).toContain(field);
    }
    expect(template).toContain("SYNTHETIC_DATA_ONLY");
    expect(template).toContain("DO_NOT_RECORD_SECRETS_OR_PRIVATE_PAYLOADS");
  });

  it("does not promote the limited pack to a later gate", () => {
    const allContent = packFiles.map(readRepositoryFile).join("\n");

    expect(allContent).not.toMatch(/G0 PASS:\s*(?:GRANTED|PASS)/);
    expect(allContent).not.toMatch(/L1 Status:\s*READY/);
    expect(allContent).not.toMatch(/Phase 7:\s*AUTHORIZED/);
    expect(allContent).not.toMatch(/PostgreSQL runtime:\s*(?:AUTHORIZED|ACTIVATED)/);
    expect(allContent).not.toMatch(/Controlled Pilot:\s*AUTHORIZED/);
    expect(allContent).not.toMatch(/Production:\s*AUTHORIZED/);
  });
});
