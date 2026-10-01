import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  it("blocks another graph home from replacing shared receipts or digests in every CLI mode", () => {
    fixture((graphHome) => {
      const evidenceRoot = join(graphHome, "evidence");
      const repoRoot = join(graphHome, "source");
      const otherHome = join(graphHome, "other-home");
      const moduleUrl = pathToFileURL(join(process.cwd(), "scripts/graph-companion.mjs")).href;
      expect(spawnSync("git", ["init", repoRoot]).status).toBe(0);
      expect(
        spawnSync("git", [
          "-C",
          repoRoot,
          "-c",
          "user.name=Lease Test",
          "-c",
          "user.email=lease-test@example.invalid",
          "commit",
          "--allow-empty",
          "-m",
          "fixture"
        ]).status
      ).toBe(0);
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
      mkdirSync(join(evidenceRoot, "graph-companion"), { recursive: true });
      const receipt = join(evidenceRoot, "graph-companion", "graph-state.json");
      const digest = join(evidenceRoot, "99-digests.sha256");
      writeFileSync(receipt, "own receipt");
      writeFileSync(digest, "own digest");
      withGraphCompanionLease({ graphHome, repository, evidenceRoot }, () => {
        for (const mode of ["entry", "refresh", "impact", "plan", "postmerge"]) {
          const child = spawnSync(
            process.execPath,
            [
              "--input-type=module",
              "-e",
              `
            import { runCompanion } from ${JSON.stringify(moduleUrl)};
            runCompanion(${JSON.stringify({
              repoRoot,
              graphHome: otherHome,
              evidenceRoot,
              mode,
              baseSha: "HEAD",
              targetSha: "HEAD"
            })});
          `
            ],
            { encoding: "utf8", timeout: 10_000 }
          );
          expect(child.status).not.toBe(0);
          expect(child.stderr).toContain("GRAPH_COMPANION_LOCK_CONFLICT");
          expect(readFileSync(receipt, "utf8")).toBe("own receipt");
          expect(readFileSync(digest, "utf8")).toBe("own digest");
          expect(existsSync(join(otherHome, "qidianzhiku-SimWar", "writer.lock.json"))).toBe(false);
        }
      });
    });
  });

  it("cleans up a partial acquisition without deleting an unknown evidence lock", () => {
    fixture((graphHome) => {
      const evidenceRoot = join(graphHome, "evidence");
      mkdirSync(evidenceRoot);
      const evidenceLock = join(evidenceRoot, ".graph-companion-writer.lock");
      writeFileSync(evidenceLock, "unknown owner");
      const marker = join(evidenceRoot, "unexpected-write");
      expect(() =>
        withGraphCompanionLease({ graphHome, repository, evidenceRoot }, () => {
          writeFileSync(marker, "unexpected");
        })
      ).toThrow("GRAPH_COMPANION_LOCK_CONFLICT");
      expect(existsSync(marker)).toBe(false);
      expect(readFileSync(evidenceLock, "utf8")).toBe("unknown owner");
      expect(existsSync(join(graphHome, "qidianzhiku-SimWar", "writer.lock.json"))).toBe(false);
      expect(withGraphCompanionLease({ graphHome, repository }, () => "retry")).toBe("retry");
    });
  });

  it("releases both owned resources after failure so another graph home can retry", () => {
    fixture((graphHome) => {
      const evidenceRoot = join(graphHome, "evidence");
      expect(() =>
        withGraphCompanionLease({ graphHome, repository, evidenceRoot }, () => {
          expect(existsSync(join(evidenceRoot, ".graph-companion-writer.lock"))).toBe(true);
          throw new Error("receipt failure");
        })
      ).toThrow("receipt failure");
      expect(existsSync(join(evidenceRoot, ".graph-companion-writer.lock"))).toBe(false);
      expect(existsSync(join(graphHome, "qidianzhiku-SimWar", "writer.lock.json"))).toBe(false);
      expect(
        withGraphCompanionLease(
          { graphHome: join(graphHome, "retry-home"), repository, evidenceRoot },
          () => "retry"
        )
      ).toBe("retry");
    });
  });

  it("preserves a replaced evidence lock while still releasing its graph lock", () => {
    fixture((graphHome) => {
      const evidenceRoot = join(graphHome, "evidence");
      mkdirSync(evidenceRoot);
      const evidenceLock = join(evidenceRoot, ".graph-companion-writer.lock");
      expect(() =>
        withGraphCompanionLease({ graphHome, repository, evidenceRoot }, () => {
          writeFileSync(evidenceLock, "replacement owner");
        })
      ).toThrow("GRAPH_COMPANION_LOCK_OWNERSHIP_LOST");
      expect(readFileSync(evidenceLock, "utf8")).toBe("replacement owner");
      expect(existsSync(join(graphHome, "qidianzhiku-SimWar", "writer.lock.json"))).toBe(false);
    });
  });

  it("coordinates a shared evidence root across repositories but allows disjoint resources", () => {
    fixture((graphHome) => {
      const evidenceRoot = join(graphHome, "evidence");
      const otherRepository = { ...repository, name: "Other" };
      withGraphCompanionLease({ graphHome, repository, evidenceRoot }, () => {
        expect(() =>
          withGraphCompanionLease(
            { graphHome, repository: otherRepository, evidenceRoot },
            () => "unexpected"
          )
        ).toThrow("GRAPH_COMPANION_LOCK_CONFLICT");
        expect(
          withGraphCompanionLease(
            {
              graphHome,
              repository: otherRepository,
              evidenceRoot: join(graphHome, "other-evidence")
            },
            () => "independent"
          )
        ).toBe("independent");
        expect(() =>
          withGraphCompanionLease(
            { graphHome, repository, evidenceRoot: join(graphHome, "other-evidence") },
            () => "unexpected"
          )
        ).toThrow("GRAPH_COMPANION_LOCK_CONFLICT");
      });
    });
  });

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
