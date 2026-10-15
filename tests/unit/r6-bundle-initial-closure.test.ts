import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { build } from "vite";

// A renamed/shared chunk must not let bytes escape the unchanged initial budget.
// Exercise the actual application build, not only index-* filename conventions.
describe("R6 complete initial bundle transfer", () => {
  for (const [app, rawLimit, gzipLimit, priorInitialBytes] of [
    ["admin", 329538, 99770, 361781],
    ["teacher", 466169, 133639, 497899],
    ["student", 321101, 98747, 345795]
  ] as const) {
    it(`${app} preserves the entry budget and accounts for complete transfer`, async () => {
      const cssOnly = new Map<string, string[]>();
      // Vitest sets NODE_ENV=test; the transfer contract is the production build.
      vi.stubEnv("NODE_ENV", "production");
      let result: Awaited<ReturnType<typeof build>>;
      try {
        result = await build({
          root: resolve(`apps/${app}`),
          configFile: resolve(`apps/${app}/vite.config.ts`),
          logLevel: "silent",
          build: { write: false },
          plugins: [
            {
              name: "record-elided-css-only-chunks",
              generateBundle(_options, bundle) {
                for (const [name, item] of Object.entries(bundle)) {
                  if (item.type !== "chunk" || item.code.length !== 0) continue;
                  const metadata = item as typeof item & {
                    viteMetadata?: { importedCss: Set<string> };
                  };
                  const css = [...(metadata.viteMetadata?.importedCss ?? [])];
                  if (css.length > 0) cssOnly.set(name, css);
                }
              }
            }
          ]
        });
      } finally {
        vi.unstubAllEnvs();
      }
      if (Array.isArray(result) || !("output" in result))
        throw new Error("Unexpected build output");
      const output = new Map(result.output.map((item) => [item.fileName, item]));
      const html = output.get("index.html");
      if (!html || html.type !== "asset") throw new Error("Missing actual HTML entry");
      const htmlText = String(html.source);
      const initial = new Set<string>();
      const reachable = new Set<string>();
      const add = (name: string, files: Set<string>, includeDynamic: boolean) => {
        if (files.has(name)) return;
        const item = output.get(name);
        // Vite removes empty JS placeholders for CSS-only imports after this
        // hook. Follow their recorded CSS; never ignore an arbitrary missing JS.
        if (!item && cssOnly.has(name)) {
          for (const css of cssOnly.get(name)!) add(css, files, includeDynamic);
          return;
        }
        if (!item) throw new Error(`Missing emitted dependency: ${name}`);
        files.add(name);
        if (item.type === "chunk") {
          for (const child of item.imports) add(child, files, includeDynamic);
          const metadata = item as typeof item & { viteMetadata?: { importedCss: Set<string> } };
          for (const css of metadata.viteMetadata?.importedCss ?? [])
            add(css, files, includeDynamic);
          if (includeDynamic) for (const child of item.dynamicImports) add(child, files, true);
        }
      };
      const htmlRefs = [...htmlText.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((match) =>
        match[1].replace(/^\//, "")
      );
      expect(htmlRefs.some((name) => name.endsWith(".js"))).toBe(true);
      for (const name of htmlRefs) {
        add(name, initial, false);
        add(name, reachable, true);
      }
      let raw = 0;
      let gzip = 0;
      for (const name of initial) {
        const item = output.get(name)!;
        if (item.type !== "chunk") continue;
        raw += Buffer.byteLength(item.code);
        gzip += gzipSync(item.code).byteLength;
      }
      const orphan = result.output
        .filter((item) => /\.(js|css)$/.test(item.fileName))
        .filter((item) => item.type !== "chunk" || item.code.length > 0)
        .filter((item) => !reachable.has(item.fileName))
        .map((item) => item.fileName);
      expect(orphan, "Every runtime output must remain reachable and accounted for").toEqual([]);
      const entries = result.output.filter((item) => item.type === "chunk" && item.isEntry);
      const entryRaw = entries.reduce((sum, item) => sum + Buffer.byteLength(item.code), 0);
      const entryGzip = entries.reduce((sum, item) => sum + gzipSync(item.code).byteLength, 0);
      // Preserve the original ENTRY-only numerical contract. It is not a
      // historical full-closure baseline. Separately prove actual initial bytes
      // decrease from the exact failing 1f860dc candidate, including shared JS.
      expect(entryRaw, "Unchanged original entry raw cap").toBeLessThanOrEqual(rawLimit);
      expect(entryGzip, "Unchanged original entry gzip cap").toBeLessThanOrEqual(gzipLimit);
      expect(raw, "No shift into uncounted static shared chunks").toBeLessThan(priorInitialBytes);
      const transfer = (names: Iterable<string>) => {
        let bytes = 0;
        let compressed = 0;
        for (const name of names) {
          if (!/\.(js|css)$/.test(name)) continue;
          const item = output.get(name)!;
          const data = item.type === "chunk" ? item.code : item.source;
          bytes += typeof data === "string" ? Buffer.byteLength(data) : data.byteLength;
          compressed += gzipSync(data).byteLength;
        }
        return { raw: bytes, gzip: compressed };
      };
      console.log(
        JSON.stringify({
          app,
          entryBudget: { raw: entryRaw, gzip: entryGzip },
          completeStaticClosure: { jsRaw: raw, jsGzip: gzip, allRuntime: transfer(initial) },
          incrementalLazy: transfer([...reachable].filter((name) => !initial.has(name))),
          totalRuntime: transfer(reachable),
          totalRuntimeFiles: [...reachable],
          orphan
        })
      );
    }, 30000);
  }
});
