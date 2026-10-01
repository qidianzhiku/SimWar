import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { runCompanion, withGraphCompanionLease } from "../../scripts/graph-companion.mjs";

const repository = { owner: "qidianzhiku", name: "SimWar" };

function fixture(run: (graphHome: string) => void) {
  const graphHome = mkdtempSync(join(tmpdir(), "simwar-graph-lease-test-"));
  try {
    run(graphHome);
  } finally {
    rmSync(graphHome, { recursive: true, force: true });
  }
}

describe("Graph Companion local lease", () => {
  it("holds every CLI mode before shared worktree, evidence or registry work", () => {
    fixture((graphHome) => {
      const repoRoot = mkdtempSync(join(tmpdir(), "simwar-graph-source-test-"));
      try {
        expect(spawnSync("git", ["init", repoRoot]).status).toBe(0);
        expect(
          spawnSync("git", [
            "-C",
            repoRoot,
            "remote",
            "add",
            "origin",
            "https://github.com/qidianzhiku/SimWar.git"
          ]).status
        ).toBe(0);
        withGraphCompanionLease({ graphHome, repository }, () => {
          for (const mode of ["entry", "refresh", "impact", "plan", "postmerge"]) {
            expect(() => runCompanion({ repoRoot, graphHome, mode })).toThrow(
              "GRAPH_COMPANION_LOCK_CONFLICT"
            );
          }
        });
      } finally {
        rmSync(repoRoot, { recursive: true, force: true });
      }
    });
  });
  it("rejects a competing process before its callback can write", () => {
    fixture((graphHome) => {
      const moduleUrl = pathToFileURL(join(process.cwd(), "scripts/graph-companion.mjs")).href;
      const marker = join(graphHome, "competing-write.txt");
      withGraphCompanionLease({ graphHome, repository }, (owner) => {
        const child = spawnSync(
          process.execPath,
          [
            "--input-type=module",
            "-e",
            `
          import { withGraphCompanionLease } from ${JSON.stringify(moduleUrl)};
          import { writeFileSync } from "node:fs";
          withGraphCompanionLease(${JSON.stringify({ graphHome, repository })}, () => {
            writeFileSync(${JSON.stringify(marker)}, "unexpected write");
          });
        `
          ],
          { encoding: "utf8" }
        );
        expect(child.status).not.toBe(0);
        expect(child.stderr).toContain("GRAPH_COMPANION_LOCK_CONFLICT");
        expect(existsSync(marker)).toBe(false);
        expect(JSON.parse(readFileSync(owner.lock_path, "utf8")).token).toBe(owner.token);
      });
    });
  });

  it("releases its lease after failure and allows a retry", () => {
    fixture((graphHome) => {
      let lockPath = "";
      expect(() =>
        withGraphCompanionLease({ graphHome, repository }, (owner) => {
          lockPath = owner.lock_path;
          throw new Error("index failure");
        })
      ).toThrow("index failure");
      expect(existsSync(lockPath)).toBe(false);
      expect(withGraphCompanionLease({ graphHome, repository }, () => "retry")).toBe("retry");
    });
  });

  it("does not remove an unknown or replaced lock", () => {
    fixture((graphHome) => {
      let lockPath = "";
      expect(() =>
        withGraphCompanionLease({ graphHome, repository }, (owner) => {
          lockPath = owner.lock_path;
          writeFileSync(lockPath, "unknown owner");
        })
      ).toThrow("GRAPH_COMPANION_LOCK_OWNERSHIP_LOST");
      expect(readFileSync(lockPath, "utf8")).toBe("unknown owner");
      expect(() =>
        withGraphCompanionLease({ graphHome, repository }, () => {
          throw new Error("must not run");
        })
      ).toThrow("GRAPH_COMPANION_LOCK_CONFLICT");
      expect(readFileSync(lockPath, "utf8")).toBe("unknown owner");
    });
  });

  it("keeps distinct repository leases independent", () => {
    fixture((graphHome) => {
      withGraphCompanionLease({ graphHome, repository }, (owner) => {
        expect(
          withGraphCompanionLease(
            { graphHome, repository: { ...repository, name: "Other" } },
            () => "other"
          )
        ).toBe("other");
        expect(existsSync(owner.lock_path)).toBe(true);
        expect(owner.ownership_proof).toBe("LOCAL_EXCLUSIVE_FILE");
        expect(owner.automatic_next_start).toBe(false);
      });
    });
  });
});
