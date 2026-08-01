import { expect, test, type Page } from "@playwright/test";
import { cleanupPlaywrightStore } from "./store-isolation";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;

interface InstructorAssetFixture {
  asset_id: string;
  course_blueprint_ref: Record<string, string>;
  course_id: string;
  created_at: string;
  created_by: string;
  fact_digest: string;
  status: "draft" | "teacher_published" | "rejected";
  tenant_id: string;
  title: string;
  updated_at: string;
}

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
  cleanupPlaywrightStore();
});

async function signIn(page: Page): Promise<void> {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill("teacher");
  await page.getByLabel("password").fill("teacher");
  await page.getByRole("button", { name: "教师登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

test("Teacher explicitly creates, publishes, and reads an AI-off C4 debrief kit without a truth mutation", async ({
  page
}) => {
  const assets: InstructorAssetFixture[] = [];
  const endpointCalls: Array<{ method: string; path: string }> = [];
  const immutableReference = {
    content_digest: "a".repeat(64),
    discriminator: "exact_ref",
    resource_id: "blueprint_browser_c4",
    resource_type: "course_blueprint",
    tenant_id: "tenant_demo",
    version: "1.0.0"
  };

  await page.route(/\/api\/v1\/bff\/teacher\/instructor-assets\?course_id=/, async (route) => {
    endpointCalls.push({
      method: route.request().method(),
      path: new URL(route.request().url()).pathname
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: assets,
        message: "success",
        request_id: "req_c4_assets"
      })
    });
  });
  await page.route("**/api/v1/bff/teacher/instructor-assets/drafts", async (route) => {
    endpointCalls.push({
      method: route.request().method(),
      path: new URL(route.request().url()).pathname
    });
    const body = route.request().postDataJSON() as { course_id?: string; title?: string };
    expect(body.course_id).toBeTruthy();
    expect(body.title).toBe("Browser debrief");
    const asset: InstructorAssetFixture = {
      asset_id: "instructor_asset_browser_c4",
      course_blueprint_ref: immutableReference,
      course_id: body.course_id!,
      created_at: "2026-08-01T12:00:00.000Z",
      created_by: "teacher_demo",
      fact_digest: "b".repeat(64),
      status: "draft",
      tenant_id: "tenant_demo",
      title: body.title!,
      updated_at: "2026-08-01T12:00:00.000Z"
    };
    assets.splice(0, assets.length, asset);
    await route.fulfill({
      contentType: "application/json",
      status: 201,
      body: JSON.stringify({
        code: "OK",
        data: asset,
        message: "success",
        request_id: "req_c4_draft"
      })
    });
  });
  await page.route(
    "**/api/v1/bff/teacher/instructor-assets/instructor_asset_browser_c4/publish",
    async (route) => {
      endpointCalls.push({
        method: route.request().method(),
        path: new URL(route.request().url()).pathname
      });
      assets[0]!.status = "teacher_published";
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          code: "OK",
          data: assets[0],
          message: "success",
          request_id: "req_c4_publish"
        })
      });
    }
  );
  await page.route("**/api/v1/bff/teacher/instructor-intelligence?*", async (route) => {
    endpointCalls.push({
      method: route.request().method(),
      path: new URL(route.request().url()).pathname
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: {
          ai_status: "off",
          anomaly_status: "baseline_unavailable",
          causal_evidence_refs: [immutableReference],
          debrief_agenda: ["Review evidence."],
          deterministic_fact_digest: "c".repeat(64),
          discussion_points: ["Discuss a tradeoff."],
          follow_up_questions: ["What changes next?"],
          instructor_asset_id: "instructor_asset_browser_c4",
          known_limits: ["not_postgresql_active_runtime"],
          round: {
            round_id: "round_browser_c4",
            round_no: 1,
            run_id: "run_browser_c4",
            status: "published"
          },
          result_delta: { current_team_count: 0 },
          source_course_blueprint_ref: immutableReference,
          time_guidance: "Reserve time for evidence review."
        },
        message: "success",
        request_id: "req_c4_kit"
      })
    });
  });

  await page.goto(teacherBaseUrl);
  const initialState = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/demo-state") &&
      response.request().method() === "GET" &&
      response.status() === 200
  );
  await signIn(page);
  await initialState;
  const primaryAction = page.locator("header.topbar > button.primary");
  if ((await primaryAction.textContent())?.trim() === "创建 Run") {
    await primaryAction.click();
    await expect(page.getByText("run created")).toBeVisible();
  }

  const panel = page.getByLabel("Instructor intelligence");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: "创建草稿" })).toBeEnabled();
  await panel.getByLabel("教学复盘标题").fill("Browser debrief");
  await panel.getByRole("button", { name: "创建草稿" }).click();
  await panel.getByRole("button", { name: "发布教学资产" }).click();
  await panel.getByRole("button", { name: "读取复盘包" }).click();

  await expect(panel.getByLabel("确定性教学复盘包")).toContainText("AI: off");
  await expect(panel.getByLabel("确定性教学复盘包")).toContainText("not_postgresql_active_runtime");
  expect(endpointCalls.map((call) => call.path)).toEqual(
    expect.arrayContaining([
      "/api/v1/bff/teacher/instructor-assets",
      "/api/v1/bff/teacher/instructor-assets/drafts",
      "/api/v1/bff/teacher/instructor-assets/instructor_asset_browser_c4/publish",
      "/api/v1/bff/teacher/instructor-intelligence"
    ])
  );
  expect(endpointCalls.some((call) => /\/settle|\/rounds\/.*\/publish/.test(call.path))).toBe(
    false
  );
  expect((await panel.innerText()).includes("state_true")).toBe(false);
});
