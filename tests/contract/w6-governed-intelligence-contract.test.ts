import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
describe("W6 governed intelligence OpenAPI parity", () => {
  it("declares every real-BFF surface and keeps the request bounded", () => {
    const openapi = readFileSync(resolve("contracts/openapi/p0-api.openapi.yaml"), "utf8");
    const expected: Record<string, string> = {
      "/api/v1/bff/student/intelligence/coach": "W6_STUDENT_COACH_POST_V1",
      "/api/v1/bff/teacher/intelligence/copilot": "W6_TEACHER_COPILOT_POST_V1",
      "/api/v1/bff/teacher/intelligence/rubric": "W6_RUBRIC_ASSISTANT_POST_V1",
      "/api/v1/bff/teacher/intelligence/challenge/competitive": "W6_COMPETITIVE_CHALLENGE_POST_V1",
      "/api/v1/bff/teacher/intelligence/challenge/stakeholder": "W6_STAKEHOLDER_CHALLENGE_POST_V1"
    };
    for (const [path, operationId] of Object.entries(expected)) {
      const start = openapi.indexOf(`  ${path}:`);
      expect(start).toBeGreaterThanOrEqual(0);
      const end = openapi.indexOf("\n  /api/", start + 1);
      const operation = openapi.slice(start, end === -1 ? undefined : end);
      expect(operation).toContain(`operationId: ${operationId}`);
      expect(operation).toContain("requestBody:");
    }
    const requestSchema = openapi.slice(
      openapi.indexOf("    W020AdvisoryRequest:"),
      openapi.indexOf("    W020AdvisoryEnvelope:")
    );
    for (const surface of [
      "student_role",
      "student_coach",
      "teacher_copilot",
      "teacher_debrief",
      "rubric_assistant",
      "competitive_challenge",
      "stakeholder_challenge"
    ]) {
      expect(requestSchema).toContain(surface);
    }
    expect(requestSchema).not.toContain("prompt:");
  });
});
