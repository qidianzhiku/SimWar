import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const assembler = resolve("scripts/assemble-mod-support-evidence.mjs");

describe("MOD evidence assembler output-root safety", () => {
  it("requires and writes an owned dedicated evidence directory", () => {
    const parent = mkdtempSync(join(tmpdir(), "simwar-mod-support-test-"));
    const output = join(parent, "simwar-mod-support-evidence-run");

    try {
      execFileSync(process.execPath, [assembler, output], { encoding: "utf8" });
      expect(existsSync(join(output, ".simwar-mod-support-evidence-root"))).toBe(true);
      expect(readFileSync(join(output, ".simwar-mod-support-evidence-root"), "utf8")).toBe(
        '{"owner":"simwar-mod-support-evidence-assembler","schema_version":1}\n'
      );
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("rejects the repository root before any recursive cleanup", () => {
    expect(() =>
      execFileSync(process.execPath, [assembler, process.cwd()], { encoding: "utf8" })
    ).toThrow(/MOD_EVIDENCE_OUTPUT_REJECTED_REPOSITORY_ROOT/);
  });

  it("rejects an existing output directory without deleting its contents", () => {
    const parent = mkdtempSync(join(tmpdir(), "simwar-mod-support-test-"));
    const output = join(parent, "simwar-mod-support-evidence-existing");
    const sentinel = join(output, "sentinel.txt");
    mkdirSync(output, { recursive: true });
    writeFileSync(sentinel, "keep", "utf8");

    try {
      expect(() =>
        execFileSync(process.execPath, [assembler, output], { encoding: "utf8" })
      ).toThrow(/MOD_EVIDENCE_OUTPUT_REJECTED_EXISTING_DIRECTORY_USE_NEW_PATH/);
      expect(readFileSync(sentinel, "utf8")).toBe("keep");
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
