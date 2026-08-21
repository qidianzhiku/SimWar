import { expect, test, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = [
  { url: "student", login: "学员登录", panel: "战略项目承诺" },
  { url: "teacher", login: "教师登录", panel: "企业项目演进观察" },
  { url: "admin", login: "管理员登录", panel: "项目组合审计" }
] as const;

const baseUrls = {
  admin: `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`,
  teacher: `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`,
  student: `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`
} as const;

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;

async function seedRound(request: APIRequestContext): Promise<void> {
  const login = await request.post(`${apiBaseUrl}/api/v1/auth/login`, {
    data: { username: "teacher", password: "teacher" },
    headers: { "content-type": "application/json", "x-tenant-id": "tenant_demo" }
  });
  const loginBody = (await login.json()) as { data: { access_token: string } };
  const auth = {
    authorization: `Bearer ${loginBody.data.access_token}`,
    "content-type": "application/json",
    "x-tenant-id": "tenant_demo"
  };
  const created = await request.post(`${apiBaseUrl}/api/v1/courses/course_demo/runs`, {
    headers: auth,
    data: {}
  });
  const createdBody = (await created.json()) as { data: { run: { run_id: string } } };
  await request.post(`${apiBaseUrl}/api/v1/runs/${createdBody.data.run.run_id}/rounds/1/start`, {
    headers: auth,
    data: {}
  });
}

test("W4 commercial surfaces stay responsive and avoid serious accessibility violations", async ({
  page,
  request
}) => {
  await seedRound(request);
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(baseUrls[route.url]);
      await page.getByLabel("tenant").fill("tenant_demo");
      await page.getByLabel("username").fill(route.url === "student" ? "student" : route.url);
      await page.getByLabel("password").fill(route.url === "student" ? "student" : route.url);
      await page.getByRole("button", { name: route.login }).click();
      await expect(page.getByLabel(route.panel)).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflow, `${route.url} overflows at ${viewport.width}px`).toBe(false);

      const results = await new AxeBuilder({ page })
        .include(`[aria-label="${route.panel}"]`)
        .analyze();
      const serious = results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? "")
      );
      expect(serious, `${route.url} has serious accessibility violations`).toEqual([]);
    }
  }
});
