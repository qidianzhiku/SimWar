import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const floors = new Map([
  ["@babel/core", [7, 29, 6]],
  ["@vitest/mocker", [4, 1, 11]],
  ["vitest", [4, 1, 11]],
  ["baseline-browser-mapping", [2, 11, 0]],
  ["browserslist", [4, 28, 7]],
  ["fast-uri", [3, 1, 8]],
  ["js-yaml", [4, 3, 2]]
]);

function atLeast(actual, floor) {
  const parsed = /^(\d+)\.(\d+)\.(\d+)$/.exec(actual);
  assert.ok(parsed, `Expected stable version, received ${actual}`);
  const value = parsed.slice(1).map(Number);
  assert.equal(value[0], floor[0], "No implicit major migration");
  return value[1] > floor[1] || (value[1] === floor[1] && value[2] >= floor[2]);
}

for (const [name, floor] of floors) {
  test(`locked ${name} instances exclude the admitted affected range`, () => {
    const instances = Object.entries(lock.packages).filter(([path]) =>
      path.endsWith(`node_modules/${name}`)
    );
    assert.ok(instances.length > 0, `Missing required tooling ${name}`);
    for (const [path, pkg] of instances) {
      assert.ok(atLeast(pkg.version, floor), `${path}@${pkg.version} is below ${floor.join(".")}`);
      assert.match(pkg.integrity, /^sha512-/);
      assert.ok(pkg.resolved.startsWith("https://registry.npmjs.org/"));
    }
  });
}

test("both brace-expansion parent lines exclude their admitted affected ranges", () => {
  const majors = new Set();
  for (const [path, pkg] of Object.entries(lock.packages)) {
    if (!path.endsWith("node_modules/brace-expansion")) continue;
    const major = Number(pkg.version.split(".")[0]);
    majors.add(major);
    assert.ok(major === 1 || major === 5, `Unexpected major at ${path}`);
    assert.ok(atLeast(pkg.version, major === 1 ? [1, 1, 21] : [5, 0, 12]), path);
    assert.match(pkg.integrity, /^sha512-/);
  }
  assert.deepEqual([...majors].sort(), [1, 5]);
});

// esbuild remains separately blocked on cross-platform artifact/lock admission.
// This guard does not declare all nine audit findings or PA12 closed.
