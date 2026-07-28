import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve("services/api/src/server.ts"), "utf8");

function routeSection(start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);

  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe("course command repository facade characterization", () => {
  it("reads course state through the facade before publish, team, and run commands", () => {
    const publish = routeSection(
      'if (request.method === "POST" && /^\\/api\\/v1\\/courses\\/[^/]+\\/publish$/.test(url.pathname))',
      'if (request.method === "POST" && /^\\/api\\/v1\\/courses\\/[^/]+\\/teams$/.test(url.pathname))'
    );
    const team = routeSection(
      'if (request.method === "POST" && /^\\/api\\/v1\\/courses\\/[^/]+\\/teams$/.test(url.pathname))',
      'if (request.method === "POST" && /^\\/api\\/v1\\/courses\\/[^/]+\\/runs$/.test(url.pathname))'
    );
    const run = routeSection(
      'if (request.method === "POST" && /^\\/api\\/v1\\/courses\\/[^/]+\\/runs$/.test(url.pathname))',
      "const [, runId, roundNoRaw] = matchPath("
    );

    for (const command of [publish, team, run]) {
      expect(command).toContain(
        'const course = await getCourseForRead(runtime, context, courseId ?? "");'
      );
      expect(command).not.toContain("getCourse(store, context");
    }

    expect(publish).toContain(
      "await runtime.repositoryProvider.facade.courses.saveCourse(course);"
    );

    expect(source).not.toContain("function getCourse(store: SimWarStore");
  });
});
