import { expect, test, type Page } from "@playwright/test";
import { getShanghaiMarketWorldReference } from "../../services/api/src/market-world-product";
import { cleanupPlaywrightStore } from "./store-isolation";

const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;

test.afterEach(() => {
  cleanupPlaywrightStore();
});

async function signIn(
  page: Page,
  app: "admin" | "student" | "teacher",
  username: string
): Promise<void> {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill(username);
  await page.getByLabel("password").fill(username);
  await page
    .getByRole("button", {
      name: app === "admin" ? "管理员登录" : app === "teacher" ? "教师登录" : "学员登录"
    })
    .click();
  if (app === "teacher") {
    await expect(
      page.getByRole("status", { name: "教师操作通知" }).getByLabel("技术兼容标签")
    ).toContainText("signed in");
  } else {
    await expect(page.getByText("signed in").first()).toBeVisible();
  }
}

test("@m2-p1-real joins the exact MarketWorldRef across Teacher, Student, and Admin", async ({
  page
}) => {
  test.skip(
    process.env.SIMWAR_PLAYWRIGHT_M2_MARKET_WORLD !== "true",
    "M2 Market World fixture is enabled only for the dedicated real-BFF run"
  );
  await page.goto(teacherBaseUrl);
  const teacherProjectionResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/api/v1/bff/teacher/courses/course_demo/market-world"
  );
  await signIn(page, "teacher", "teacher");
  const teacherProjection = (await (await teacherProjectionResponse).json()) as {
    data: {
      available_market_worlds: Array<{ market_world_reference: unknown }>;
      binding_state: string;
    };
  };
  expect(teacherProjection.data.binding_state).toBe("UNBOUND");
  expect(teacherProjection.data.available_market_worlds[0]?.market_world_reference).toEqual(
    getShanghaiMarketWorldReference()
  );

  const teacherPanel = page.getByRole("region", { name: "Shanghai Market World binding" });
  await expect(teacherPanel).toContainText("2026-08-20.m2.1");
  await expect(teacherPanel).toContainText("UNBOUND");
  await teacherPanel.getByRole("button", { name: "绑定到当前 Course" }).click();
  await expect(teacherPanel).toContainText("BOUND");
  await expect(teacherPanel.getByRole("button", { name: "已绑定精确版本" })).toBeDisabled();

  await page.goto(studentBaseUrl);
  const studentWorkspaceResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/api/v1/bff/student/role-workspace"
  );
  await signIn(page, "student", "student");
  const studentWorkspace = (await (await studentWorkspaceResponse).json()) as {
    data: Record<string, unknown>;
  };
  expect(studentWorkspace.data.market_world_visibility).toBe("VISIBLE");
  expect(studentWorkspace.data.market_brief).toMatchObject({
    brief_kind: "SHANGHAI_MARKET_BRIEF",
    market_world_reference: getShanghaiMarketWorldReference(),
    visibility_state: "VISIBLE"
  });
  expect(JSON.stringify(studentWorkspace.data)).not.toMatch(
    /state_true|raw_source_path|private_coefficient|other_team_data|score|rank|settlement_result/i
  );

  const studentBrief = page.getByRole("region", { name: "Shanghai Market World brief" });
  await expect(studentBrief).toHaveAttribute("data-market-world-visibility", "VISIBLE");
  await expect(studentBrief).toContainText("已开放");
  await expect(studentBrief).toContainText("上海养老 Market Brief");

  await page.goto(adminBaseUrl);
  const adminProjectionResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/api/v1/bff/admin/market-world-bindings"
  );
  await signIn(page, "admin", "admin");
  const adminProjection = (await (await adminProjectionResponse).json()) as {
    data: { courses: Array<Record<string, unknown>> };
  };
  expect(adminProjection.data.courses).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        binding_state: "BOUND",
        course_id: "course_demo",
        market_world_reference: getShanghaiMarketWorldReference()
      })
    ])
  );

  const adminPanel = page.getByRole("region", { name: "Market World audit readiness" });
  const adminCourse = adminPanel.locator('[data-market-world-course="course_demo"]');
  await expect(adminCourse).toContainText("BOUND");
  await expect(adminCourse).not.toContainText(
    /state_true|raw_source_path|private_coefficient|other_team_data|score|rank|settlement result/i
  );
});
