import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "simwar-hidden-unicode-"));
  tempDirs.push(dir);
  return dir;
}

function writeFixture(name: string, contents: string | Buffer): string {
  const path = join(createTempDir(), name);
  writeFileSync(path, contents);
  return path;
}

function runScanner(files: string[]) {
  return spawnSync(process.execPath, ["scripts/check-hidden-unicode.mjs", "--files", ...files], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

describe("hidden Unicode scanner", () => {
  it("allows ASCII, Chinese text, Chinese punctuation, emoji, and accented characters", () => {
    const fixture = writeFixture(
      "safe.ts",
      [
        "const ascii = 'safe';",
        "const chinese = '正常中文，保留全角标点。';",
        "const emoji = 'strategy ✅';",
        "const accent = 'café';"
      ].join("\n")
    );

    const result = runScanner([fixture]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No hidden Unicode control characters found.");
    expect(result.stderr).toBe("");
  });

  it.each([
    [0x202a, "U+202A"],
    [0x202b, "U+202B"],
    [0x202c, "U+202C"],
    [0x202e, "U+202E"],
    [0x202d, "U+202D"],
    [0x2066, "U+2066"],
    [0x2067, "U+2067"],
    [0x2068, "U+2068"],
    [0x2069, "U+2069"],
    [0x200b, "U+200B"],
    [0x200c, "U+200C"],
    [0x200d, "U+200D"],
    [0x2060, "U+2060"],
    [0xfeff, "U+FEFF"]
  ])("rejects hidden Unicode code point %s", (codePoint, label) => {
    const fixture = writeFixture(
      "danger.ts",
      `const visible = 'ok';\nconst dangerous = 'a${String.fromCodePoint(codePoint)}b';\n`
    );

    const result = runScanner([fixture]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Hidden Unicode control characters detected:");
    expect(result.stdout).toContain("danger.ts");
    expect(result.stdout).toContain("line 2");
    expect(result.stdout).toContain(label);
  });

  it("rejects a UTF-8 BOM at the start of a file", () => {
    const fixture = writeFixture(
      "bom.ts",
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("const value = 1;\n")])
    );

    const result = runScanner([fixture]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("bom.ts");
    expect(result.stdout).toContain("line 1");
    expect(result.stdout).toContain("column 1");
    expect(result.stdout).toContain("UTF-8-BOM");
  });
});
