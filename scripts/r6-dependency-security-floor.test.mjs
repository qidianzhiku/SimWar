import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const floors = new Map([
  ["@babel/core", [7, 29, 6]],
  ["@babel/generator", [7, 29, 6]],
  ["@vitest/mocker", [4, 1, 11]],
  ...["expect", "pretty-format", "runner", "snapshot", "spy", "utils"].map((name) => [
    `@vitest/${name}`,
    [4, 1, 11]
  ]),
  ["vitest", [4, 1, 11]],
  ["baseline-browser-mapping", [2, 11, 0]],
  ["browserslist", [4, 28, 7]],
  ["fast-uri", [3, 1, 8]],
  ["js-yaml", [4, 3, 2]]
]);

// Frozen from admitted official metadata and SRI-verified package bytes.
// A future tooling update must explicitly update these independent expectations.
const admitted = new Map([
  [
    "@babel/core@7.29.6",
    "QdxmAo/ikZqqRGA8s43ww8lcql6naWRvEz0FFrl6MIlc7Gi6TroXnSdWa5U/kq6fzcpqpHesicQxFZIieZbyIA=="
  ],
  [
    "@babel/generator@7.29.6",
    "J3gJ6S0Bqi9kJMaFCs6Q6eYeM1MmI+n6QN7ooL5nXlrT4P/DmDaNcmbexMyleewHlVI4nzuukYjEE7muiNOUNQ=="
  ],
  [
    "@vitest/mocker@4.1.11",
    "2XJVD55d1o5AZous5CCGKS74g/riOj9odEt2bQpCVZeblHyHdnMeFl4jl0XjU21stf4mbjUkew2eXQZt65g5CQ=="
  ],
  [
    "@vitest/expect@4.1.11",
    "VX2x5vNJXET47KAFzwERI+KRMtTTCSWTfSMKsW7JsUsXV4psq++e3DvZpuTDOpHcxytiDs6p2nhVb2tVDiiUYw=="
  ],
  [
    "@vitest/pretty-format@4.1.11",
    "yiZzPbGTS9Sr/JpFl8zHrcIkAofNbFV6k21vIgQN/cY/oxZeXhJv5sc/MBJ5jFKWmWs+oJHw0UXLZjmf931+Vw=="
  ],
  [
    "@vitest/runner@4.1.11",
    "LztvUgdwMNJMIkj3hQnnxiC2Xy1zNxq928W/xhjCLaNCzqTZOudjwbQf6v9IntZGPw132i2Lq2rgTRZHD3JHNw=="
  ],
  [
    "@vitest/snapshot@4.1.11",
    "pN7ikn1ON7h8ee4gIAp4AzyK+zBtJPzVbqOgu5LCEh4VaJVbPQcgYQYJIMGQPXVeJJq1fnfazis7a5pFNPahog=="
  ],
  [
    "@vitest/spy@4.1.11",
    "apNa/prQy2qCeywhnixOHPRCgGNhvg7T4Dapfl1GahLp/R+uhBm5cPyFoNVyqsNd2h1nJxL6BqqdIjiABL60YA=="
  ],
  [
    "@vitest/utils@4.1.11",
    "zTCVGpyFsGWBhllOyKlTw/vnr6D9qxsfSDyfbyZmTyjHw5N/VuvzHpHoQjm2ZJzn4RJgx5w4r7V0er69CmLgPQ=="
  ],
  [
    "vitest@4.1.11",
    "fhACrNXUidIbGSBr5FlbuBkO7VWC1ZyLl0DO4CU2DrQoAPxX84Ysxs+HeGQpii5lZWV1Q4gBZTTu49mF+A6Edw=="
  ],
  [
    "baseline-browser-mapping@2.11.0",
    "oCu2wfipvX3AePSgmOuKkIywOu+8n9psz7hXYmk56ghpu3+7KzNIBopaOs4c9BrtdnTtW30unG9GTfHo7EwERQ=="
  ],
  [
    "brace-expansion@5.0.12",
    "YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ=="
  ],
  [
    "brace-expansion@1.1.21",
    "9zeA+KLZNNzglF2TPKRQEDyx6Yby7daAkuy8MiPzpXPsYDWi/DRM8jmwUDxokQjYqBpv5DgPiwD4h4ZZSy1Ujw=="
  ],
  [
    "browserslist@4.28.7",
    "JxV13hNrFxqjOc8alRbq9dK1MM79NEXYpma2B2J4wAtpWS5zIEIKqWPGCl7N4o7Uc7B7itylh7SuDujATRyyTw=="
  ],
  [
    "fast-uri@3.1.8",
    "GZMtZUTNRpOVIECoXwLNZS5xUGE+mVNbTB8h/7Rwh2TFWcBQiPzTgyZi05BF9UMZKkLJv8XBRJTlU7zg8+ZfMg=="
  ],
  [
    "js-yaml@4.3.2",
    "SFNOvSJ+Dgf/9An904Yx+CgSlIPCkIpao4qo51lpee25TIRejdH3rhR4EZMGoNx3/TP3O+wzWuiTFl4sqbltzA=="
  ]
]);

function assertBinding(name, pkg) {
  const digest = admitted.get(`${name}@${pkg.version}`);
  assert.ok(digest, `Unadmitted tuple ${name}@${pkg.version}`);
  assert.equal(pkg.integrity, `sha512-${digest}`);
  assert.equal(Buffer.from(digest, "base64").length, 64);
  const basename = name.split("/").at(-1);
  assert.equal(pkg.resolved, `https://registry.npmjs.org/${name}/-/${basename}-${pkg.version}.tgz`);
}

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
      assertBinding(name, pkg);
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
    assertBinding("brace-expansion", pkg);
  }
  assert.deepEqual([...majors].sort(), [1, 5]);
});

// esbuild remains separately blocked on cross-platform artifact/lock admission.
// This guard does not declare all nine audit findings or PA12 closed.
