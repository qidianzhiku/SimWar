import { expect, test, type Page } from "@playwright/test";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;

async function signIn(page: Page) {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill("teacher");
  await page.getByLabel("password").fill("teacher");
  await page.getByRole("button", { name: "教师登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

test("Teacher can see D3 exact-reference and confirmation states without student exposure", async ({
  page
}) => {
  await page.route("**/api/v1/bff/teacher/confirmations", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: {
          confirmations: [],
          known_limits: ["teacher-only"],
          runtime_authority: "JSON_INTERNAL_ONLY"
        },
        message: "success",
        request_id: "d3-list"
      })
    });
  });
  await page.route("**/api/v1/bff/teacher/course-package-versions", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: { course_package_versions: [] },
        message: "success",
        request_id: "d3-packages"
      })
    });
  });
  await page.route("**/api/v1/bff/teacher/learning-designs", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: {
          explicit_non_proofs: [],
          learning_goals: [],
          rubrics: [],
          runtime_authority: "JSON_INTERNAL_ONLY"
        },
        message: "success",
        request_id: "d3-design"
      })
    });
  });
  await page.goto(teacherBaseUrl);
  await signIn(page);
  const workbench = page.getByLabel("Teacher D3 Confirmation Workbench");
  await expect(workbench).toBeVisible();
  await expect(workbench.getByLabel("D3 exact course package")).toBeVisible();
  await expect(workbench.getByLabel("D3 exact learning goal")).toBeVisible();
  await expect(workbench.getByLabel("D3 exact rubric")).toBeVisible();
  await expect(page.getByLabel("Student D3 Confirmation Workbench")).toHaveCount(0);
});
