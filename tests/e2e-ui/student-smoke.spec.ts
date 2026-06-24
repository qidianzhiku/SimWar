import { expect, test } from "@playwright/test";
import { cleanupPlaywrightStore } from "./store-isolation";

test.afterAll(() => {
  cleanupPlaywrightStore();
});

test("loads the seeded student dashboard through real API login", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "SimWar P1 学员驾驶舱" })).toBeVisible();
  await expect(page.getByText("learner / team_captain · tenant_demo")).toBeVisible();
  await expect(page.getByText("P0 闭环演示课程")).toBeVisible();
  await expect(page.getByText("Alpha 康养队")).toBeVisible();
});

test("rejects seeded student login with an invalid password", async ({ request }) => {
  const response = await request.post("http://127.0.0.1:3100/api/v1/auth/login", {
    data: {
      password: "not-the-seeded-password",
      username: "student"
    },
    headers: {
      "content-type": "application/json",
      "x-tenant-id": "tenant_demo"
    }
  });

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({ code: "AUTH-401-002" });
});
