import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { describe, expect, it } from "vitest";
import { resolveConfig } from "vite";

describe("R6 Vite migration application boundaries", () => {
  for (const [app, port] of [
    ["admin", 3003],
    ["teacher", 3001],
    ["student", 3002]
  ] as const) {
    it(`keeps ${app} dev and preview CLI overrides on the loopback port`, () => {
      const manifest = JSON.parse(readFileSync(resolve(`apps/${app}/package.json`), "utf8"));
      for (const operation of ["dev", "preview"]) {
        const { values } = parseArgs({
          args: manifest.scripts[operation].trim().split(/\s+/),
          allowPositionals: true,
          options: { host: { type: "string" }, port: { type: "string" } }
        });
        expect(values.host).toBe("127.0.0.1");
        expect(values.port).toBe(String(port));
      }
    });

    it(`preserves ${app} browser support and loopback development defaults`, async () => {
      const config = await resolveConfig(
        { configFile: resolve(`apps/${app}/vite.config.ts`), mode: "test", logLevel: "silent" },
        "build"
      );

      // Vite 8 raises its defaults. The application contract retains Vite 7's floors.
      expect(config.build.target).toEqual(["chrome107", "edge107", "firefox104", "safari16"]);
      expect(config.server.host).toBe("127.0.0.1");
      expect(config.server.port).toBe(port);
      expect(config.resolve.alias).toContainEqual(
        expect.objectContaining({
          find: "@simwar/shared-contracts",
          replacement: resolve("packages/shared-contracts/src/index.ts")
        })
      );
    });
  }
});
