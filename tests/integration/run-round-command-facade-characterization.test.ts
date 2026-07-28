import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const serverSource = readFileSync(resolve(process.cwd(), "services/api/src/server.ts"), "utf8");

describe("Run and Round facade command paths", () => {
  it("reads Run and Round through the facade and persists a started Round", () => {
    expect(
      serverSource.match(/await getRunForRead\(runtime, context, runId \?\? ""\)/g)
    ).toHaveLength(3);
    expect(
      serverSource.match(
        /await getRoundForRead\(runtime, context, run\.run_id, Number\(roundNoRaw\)\)/g
      )
    ).toHaveLength(3);
    expect(serverSource).toContain(
      "await runtime.repositoryProvider.facade.rounds.saveRound(round);"
    );
    expect(serverSource).not.toContain("getRun(store, context");
    expect(serverSource).not.toContain("getRound(store, context");
    expect(serverSource).not.toContain("function getRun(store: SimWarStore");
    expect(serverSource).not.toContain("function getRound(store: SimWarStore");
  });
});
