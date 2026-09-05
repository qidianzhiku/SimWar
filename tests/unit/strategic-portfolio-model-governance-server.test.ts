import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("SP-O2 readiness projection source enumeration", () => {
  it("must enumerate canonical Course, Run, Round, and Team authorities", () => {
    const source = readFileSync("services/api/src/server.ts", "utf8");
    const callbackStart = source.indexOf("getStrategicPortfolioProjections: async (actor) =>");
    const callbackEnd = source.indexOf("return projections;", callbackStart);
    expect(callbackStart).toBeGreaterThanOrEqual(0);
    expect(callbackEnd).toBeGreaterThan(callbackStart);
    const callback = source.slice(callbackStart, callbackEnd);
    expect(callback).toContain("listCoursesForTenant");
    expect(callback).toContain("listRunsForCourse");
    expect(callback).toContain("listRoundsForRun");
    expect(callback).toContain("listTeamsForRun");
  });
});
