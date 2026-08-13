import { expect, test, type Page } from "@playwright/test";
import { cleanupPlaywrightStore } from "./store-isolation";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const sourceDigest = "a".repeat(64);
const draftDigest = "b".repeat(64);
const sourceReference = {
  content_digest: sourceDigest,
  course_blueprint_id: "blueprint_studio_browser",
  tenant_id: "tenant_demo",
  version: "1.0.0"
};
const draftReference = {
  ...sourceReference,
  content_digest: draftDigest,
  version: "1.1.0"
};
const editableContent = {
  activity_plan: [{ activity_id: "studio_activity", phase_id: "studio_phase" }],
  description: "Approved Studio source.",
  duration_minutes: 60,
  instructor_guidance_reference: "guide://studio-browser",
  objectives: ["Edit and submit an immutable Blueprint version."],
  ordered_phases: [
    {
      activity_type: "briefing",
      duration_minutes: 60,
      order: 1,
      phase_id: "studio_phase",
      student_instruction: "Read the exercise.",
      teacher_guidance: "Keep the exercise bounded.",
      title: "Briefing"
    }
  ],
  required_product_capabilities: ["course:create"],
  scenario_compatibility_constraints: { scenario_family: "wellness" },
  schema_version: "course-blueprint.v1",
  title: "Approved Studio Blueprint",
  version: "1.0.0"
};

test.afterEach(() => {
  cleanupPlaywrightStore();
});

async function signIn(page: Page, buttonName: "教师登录" | "学员登录", username: string) {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill(username);
  await page.getByLabel("password").fill(username);
  await page.getByRole("button", { name: buttonName }).click();
  if (buttonName === "教师登录") {
    await expect(
      page.getByRole("status", { name: "教师操作通知" }).getByLabel("技术兼容标签")
    ).toContainText("signed in");
  } else {
    await expect(page.getByText("signed in")).toBeVisible();
  }
}

test("Teacher edits an exact approved Blueprint into a server-digested draft and explicitly submits it", async ({
  page
}) => {
  const mutations: string[] = [];
  await page.route("**/api/v1/bff/teacher/course-blueprints", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: {
          candidates: [
            {
              compatibility_constraints: { scenario_family: "wellness" },
              content_digest_summary: sourceDigest.slice(0, 12),
              course_blueprint_reference: sourceReference,
              duration_minutes: 60,
              objectives_summary: editableContent.objectives,
              phases_summary: [{ duration_minutes: 60, order: 1, title: "Briefing" }],
              status: "APPROVED",
              title: editableContent.title
            }
          ],
          operation_id: "TEACHER_COURSE_BLUEPRINT_CATALOG_V1"
        },
        message: "success",
        request_id: "req_studio_catalog"
      })
    });
  });
  await page.route("**/api/v1/bff/teacher/course-blueprints/studio/preview", async (route) => {
    const request = route.request();
    const reference = request.postDataJSON().course_blueprint_reference;
    const isDraft = reference.content_digest === draftDigest;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: {
          content_digest: isDraft ? draftDigest : sourceDigest,
          course_blueprint_reference: isDraft ? draftReference : sourceReference,
          editable_content: {
            ...editableContent,
            title: isDraft ? "Teacher Studio Draft" : editableContent.title,
            version: isDraft ? "1.1.0" : "1.0.0"
          },
          status: isDraft ? "DRAFT" : "APPROVED"
        },
        message: "success",
        request_id: "req_studio_preview"
      })
    });
  });
  await page.route("**/api/v1/bff/teacher/course-blueprints/studio/drafts", async (route) => {
    mutations.push("studio.draft.create");
    const body = route.request().postDataJSON();
    expect(body.source_course_blueprint_reference).toEqual(sourceReference);
    expect(body.draft).toMatchObject({
      description: "Teacher edited description.",
      title: "Teacher Studio Draft",
      version: "1.1.0"
    });
    await route.fulfill({
      contentType: "application/json",
      status: 201,
      body: JSON.stringify({
        code: "OK",
        data: {
          content_digest: draftDigest,
          course_blueprint_reference: draftReference,
          source_course_blueprint_reference: sourceReference,
          status: "DRAFT",
          title: "Teacher Studio Draft",
          version: "1.1.0"
        },
        message: "success",
        request_id: "req_studio_draft"
      })
    });
  });
  await page.route("**/api/v1/bff/teacher/course-blueprints/studio/submissions", async (route) => {
    mutations.push("studio.draft.submit");
    expect(route.request().postDataJSON()).toEqual({
      course_blueprint_reference: draftReference
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: {
          course_blueprint_reference: draftReference,
          status: "VALIDATED"
        },
        message: "success",
        request_id: "req_studio_submission"
      })
    });
  });
  page.on("request", (request) => {
    if (
      request.method() !== "GET" &&
      /course-blueprint-courses|\/courses\/.*\/runs|replay|settle/.test(request.url())
    ) {
      mutations.push(request.url());
    }
  });

  await page.goto(teacherBaseUrl);
  await signIn(page, "教师登录", "teacher");
  const studio = page.getByLabel("Teacher Blueprint Studio");
  await expect(studio).toBeVisible();
  await studio.getByRole("button", { name: "Edit new version" }).click();
  await studio.getByLabel("Blueprint version").fill("1.1.0");
  await studio.getByLabel("Blueprint title").fill("Teacher Studio Draft");
  await studio.getByLabel("Blueprint description").fill("Teacher edited description.");
  await studio.getByRole("button", { name: "Save immutable draft" }).click();
  await expect(studio.locator(".studio-receipt strong")).toHaveText("DRAFT");
  await expect(studio.getByText(draftDigest)).toBeVisible();
  await studio.getByRole("button", { name: "Submit draft for validation" }).click();
  await expect(studio.locator(".studio-receipt strong")).toHaveText("VALIDATED");
  expect(mutations).toEqual(["studio.draft.create", "studio.draft.submit"]);
});

test("Student has no Teacher Blueprint Studio entry point", async ({ page }) => {
  const studioRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/course-blueprints/studio/")) {
      studioRequests.push(request.url());
    }
  });

  await page.goto(studentBaseUrl);
  await signIn(page, "学员登录", "student");
  await expect(page.getByLabel("Teacher Blueprint Studio")).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toContain("Save immutable draft");
  expect(studioRequests).toEqual([]);
});
