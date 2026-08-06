import { expect, test } from "@playwright/test";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;

function envelope(data: unknown) {
  return { code: "OK", data, message: "success", request_id: "req_w019_browser" };
}

test("teacher can load one exact W019 queue and inspect a student-safe preview", async ({
  page
}) => {
  await page.route("**/api/v1/bff/teacher/teaching-closure?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        envelope({
          context: {
            activity_id: "activity_001",
            course_id: "course_001",
            role_key: "marketing",
            run_id: "run_001",
            team_id: "team_001"
          },
          course_report_available: true,
          export_formats: ["json", "markdown"],
          known_limits: ["JSON_INTERNAL_ONLY is the active runtime authority."],
          queue_item: {
            claim_status: "AVAILABLE",
            confirmation_status: "CONFIRMED",
            context: {
              activity_id: "activity_001",
              course_id: "course_001",
              role_key: "marketing",
              run_id: "run_001",
              team_id: "team_001"
            },
            eligible_event_count: 1,
            evidence_count: 1,
            known_limits: ["JSON_INTERNAL_ONLY is the active runtime authority."],
            missing: [],
            outcome_status: "CONFIRMED"
          },
          runtime_authority: "JSON_INTERNAL_ONLY",
          schema_version: "teaching-closure.v1",
          student_safe_preview: {
            criterion_count: 1,
            evidence_count: 1,
            next_focus: "Review the confirmed criterion outcome with the student.",
            status: "CONFIRMED",
            visibility: "student_safe"
          }
        })
      )
    });
  });

  await page.goto(teacherBaseUrl);
  const login = page.getByLabel("teacher login");
  await login.getByLabel("tenant").fill("tenant_demo");
  await login.getByLabel("username").fill("teacher");
  await login.getByLabel("password").fill("teacher");
  await login.getByRole("button", { name: "教师登录" }).click();
  await expect(page.getByRole("heading", { name: "Teaching Closure Workspace" })).toBeVisible();

  await page.getByLabel("W019 course_id").fill("course_001");
  await page.getByLabel("W019 run_id").fill("run_001");
  await page.getByLabel("W019 team_id").fill("team_001");
  await page.getByLabel("W019 role_key").fill("marketing");
  await page.getByLabel("W019 activity_id").fill("activity_001");
  await page.getByRole("button", { name: "Load teaching queue" }).click();
  await expect(page.getByText("Queue item: CONFIRMED")).toBeVisible();
  await page.getByRole("button", { name: "Student-safe preview" }).click();
  await expect(page.getByText("Visibility: student_safe")).toBeVisible();
  await expect(
    page.getByText("Teacher-private, internal evidence, Truth and cross-team fields are excluded.")
  ).toBeVisible();
});
