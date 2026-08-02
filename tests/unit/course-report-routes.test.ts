import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isCourseReportRoute } from "../../services/api/src/course-report-routes.js";

describe("Course Report route module", () => {
  it("owns the four BFF paths and rejects other methods or Student paths", () => {
    expect(
      [
        "/api/v1/bff/admin/course-reports",
        "/api/v1/bff/admin/course-reports/export",
        "/api/v1/bff/teacher/course-reports",
        "/api/v1/bff/teacher/course-reports/export"
      ].every((path) => isCourseReportRoute("GET", new URL(`http://localhost${path}`)))
    ).toBe(true);
    expect(
      isCourseReportRoute("POST", new URL("http://localhost/api/v1/bff/teacher/course-reports"))
    ).toBe(false);
    expect(
      isCourseReportRoute("GET", new URL("http://localhost/api/v1/bff/student/course-reports"))
    ).toBe(false);
  });

  it("keeps Course Report HTTP parsing out of the global server module", () => {
    const serverSource = readFileSync("services/api/src/server.ts", "utf8");
    const routeSource = readFileSync("services/api/src/course-report-routes.ts", "utf8");

    expect(serverSource).toContain('from "./course-report-routes.js"');
    expect(serverSource).not.toContain("function parseCourseReportQuery");
    expect(serverSource).not.toContain("function requireCourseReportAdmin");
    expect(routeSource).toContain("function parseCourseReportQuery");
    expect(routeSource).toContain("function requireCourseReportAdmin");
  });
});
