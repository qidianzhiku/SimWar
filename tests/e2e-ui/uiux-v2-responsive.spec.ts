import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { cleanupPlaywrightStore } from "./store-isolation";

const teacherBaseUrl = "http://127.0.0.1:" + (process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? "3101");
const requiresFixture = process.env.SIMWAR_PLAYWRIGHT_TSS === "true";

test.afterEach(() => {
  cleanupPlaywrightStore();
});

async function signInTeacher(page: Page): Promise<void> {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill("teacher");
  await page.getByLabel("password").fill("teacher");
  await page.getByRole("button", { name: "教师登录" }).click();
  await expect(
    page.getByRole("status", { name: "教师操作通知" }).getByLabel("技术兼容标签")
  ).toContainText("signed in");
}

async function captureAndCheck(
  page: Page,
  surface: Locator,
  width: number,
  zoom: "" | "2",
  name: string
): Promise<void> {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate((value) => {
    document.body.style.zoom = value;
  }, zoom);
  await page.waitForTimeout(100);

  const metrics = await surface.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    renderedWidth: Math.round(element.getBoundingClientRect().width)
  }));
  expect(metrics.scrollWidth, name + ": TSS surface overflow").toBeLessThanOrEqual(
    metrics.clientWidth
  );

  await surface.screenshot({
    path: "tmp/playwright/uiux-v2/tss-" + name + ".png"
  });
}

test("UI/UX V2 TSS responsive and a11y evidence uses the real BFF", async ({ page }) => {
  test.skip(!requiresFixture, "run with SIMWAR_PLAYWRIGHT_TSS=true for the real fixture");

  await page.goto(teacherBaseUrl);
  await signInTeacher(page);

  const studio = page.getByRole("region", { name: "Teacher Scenario Studio" });
  await expect(studio).toBeVisible();
  await studio
    .getByLabel("Teacher Scenario Studio ModelVersion")
    .selectOption("toy_logit_wellness_v1@0.1.0");
  await studio.getByLabel("Teacher Scenario Studio version").fill("1.0.1");

  for (const width of [375, 390, 1024, 1440]) {
    await captureAndCheck(page, studio, width, "", String(width));
  }
  await captureAndCheck(page, studio, 1280, "2", "1280-200");

  const axe = await new AxeBuilder({ page })
    .include('[aria-label="Teacher Scenario Studio"]')
    .analyze();
  const seriousOrCritical = axe.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? "")
  );
  expect(seriousOrCritical, "serious/critical accessibility violations").toEqual([]);
});
