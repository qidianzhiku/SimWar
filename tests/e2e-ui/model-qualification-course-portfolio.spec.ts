import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { cleanupPlaywrightStore } from "./store-isolation.js";

const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;

test.afterAll(() => cleanupPlaywrightStore());

async function signInAdmin(page: Page): Promise<void> {
  await page.goto(adminBaseUrl);
  const login = page.locator('section[aria-label="admin login"]');
  await login.getByLabel("tenant").fill("tenant_demo");
  await login.getByLabel("username").fill("admin");
  await login.getByLabel("password").fill("admin");
  await login.getByRole("button", { name: "管理员登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

for (const viewport of [
  { name: "desktop-1440", width: 1440, height: 1000 },
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "tablet-1024", width: 1024, height: 900 },
  { name: "mobile-390", width: 390, height: 844 }
]) {
  test(`O9/O10 Admin portfolio real-BFF journey ${viewport.name} @o10`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const targetRequests: Array<{ method: string; url: string }> = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/bff/admin/model-qualification/")) {
        targetRequests.push({ method: request.method(), url: request.url() });
      }
    });

    await signInAdmin(page);
    await page.getByRole("link", { name: "模型资格课程组合" }).click();
    const panel = page.locator("#admin-model-qualification-portfolio");
    await expect(panel).toBeVisible();
    await expect(panel.locator(".o9-query-badge").first()).toHaveText(
      "derived · query-only · Provider OFF"
    );
    await expect(panel.getByRole("heading", { name: "模型治理就绪度连接" })).toBeVisible();
    await expect(panel.getByText("course_demo", { exact: true })).toBeVisible();

    await panel.getByRole("button", { name: /生成选中课程的只读 Supersession Preview/u }).click();
    await expect(panel.getByRole("heading", { name: /只读预览/u })).toBeVisible();
    await expect(
      panel.getByText("preview_applied=false · 不写入治理或正式真值。", { exact: true })
    ).toBeVisible();
    await panel.getByRole("button", { name: /编译 O10 逐课变更集请求（只读）/u }).click();
    await expect(panel.getByRole("heading", { name: /逐课治理 handoff/u })).toBeVisible();
    await expect(
      panel.getByText(
        "request != approval · handoff != execution · apply=false · bulk_apply=false · cross_course_transaction=false",
        { exact: true }
      )
    ).toBeVisible();
    await expect(
      panel.getByText("handoff_executed=false · apply=false", { exact: false })
    ).toBeVisible();

    expect(targetRequests.length).toBeGreaterThanOrEqual(3);
    expect(targetRequests.every(({ url }) => !url.includes("student"))).toBe(true);
    expect(targetRequests.some(({ method }) => method === "GET")).toBe(true);
    expect(targetRequests.some(({ url }) => url.includes("strategic-portfolio-readiness"))).toBe(
      true
    );
    expect(targetRequests.some(({ method }) => method === "POST")).toBe(true);
    expect(targetRequests.filter(({ method }) => method === "POST")).toHaveLength(2);
    expect(
      targetRequests.some(({ url }) => url.endsWith("/course-portfolio/changeset-request"))
    ).toBe(true);

    const overflow = await panel.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      offenders: Array.from(element.querySelectorAll<HTMLElement>("*"))
        .filter((candidate) => candidate.scrollWidth > candidate.clientWidth + 1)
        .map((candidate) => ({
          tag: candidate.tagName,
          className: candidate.className,
          clientWidth: candidate.clientWidth,
          scrollWidth: candidate.scrollWidth,
          text: candidate.textContent?.slice(0, 120)
        }))
    }));
    expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(
      overflow.clientWidth + 1
    );

    const accessibility = await new AxeBuilder({ page })
      .include("#admin-model-qualification-portfolio")
      .analyze();
    const seriousOrCritical = accessibility.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? "")
    );
    expect(seriousOrCritical, JSON.stringify(seriousOrCritical)).toEqual([]);
  });
}
