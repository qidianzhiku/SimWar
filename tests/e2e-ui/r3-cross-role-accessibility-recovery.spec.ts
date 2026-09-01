import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const apps = [
  {
    role: "admin",
    url: `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`,
    loginButton: "管理员登录",
    username: "admin",
    password: "admin"
  },
  {
    role: "teacher",
    url: `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`,
    loginButton: "教师登录",
    username: "teacher",
    password: "teacher"
  },
  {
    role: "student",
    url: `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`,
    loginButton: "学员登录",
    username: "student",
    password: "student"
  }
] as const;

async function signIn(page: Page, app: (typeof apps)[number]): Promise<void> {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill(app.username);
  await page.getByLabel("password").fill(app.password);
  await page.getByRole("button", { name: app.loginButton }).click();
}

function blockingAxeViolations(results: Awaited<ReturnType<AxeBuilder["analyze"]>>) {
  return results.violations.filter(
    (violation) =>
      violation.impact === "serious" ||
      violation.impact === "critical" ||
      (violation.impact === "moderate" &&
        violation.tags.some((tag) => tag.toLowerCase().startsWith("wcag")))
  );
}

test("role roots expose keyboard recovery, 200% reflow guard, and reduced motion", async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const app of apps) {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(app.url);
    const rail = page.locator(`[data-recovery-role="${app.role}"]`);
    await expect(rail).toHaveAttribute("data-recovery-status", "signed-out");
    const recovery = rail.getByRole("button", { name: "前往登录" });
    await expect(recovery).toBeVisible();
    await recovery.focus();
    await expect(recovery).toBeFocused();
    const outlineStyle = await recovery.evaluate(
      (element) => getComputedStyle(element).outlineStyle
    );
    expect(outlineStyle).not.toBe("none");

    const axeResults = await new AxeBuilder({ page })
      .include(`[data-recovery-role="${app.role}"]`)
      .analyze();
    expect(blockingAxeViolations(axeResults)).toEqual([]);

    await recovery.click();
    await expect(page.getByLabel("tenant")).toBeFocused();

    const layout = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      recoveryTransition: getComputedStyle(
        document.querySelector<HTMLElement>("[data-recovery-role]")!
      ).transitionDuration,
      controls: [...document.querySelectorAll<HTMLElement>("button, input, select, textarea")]
        .filter((element) => element.offsetParent !== null)
        .map((element) => element.getBoundingClientRect().height)
    }));
    expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(["0s", "0.001s"]).toContain(layout.recoveryTransition);
    expect(layout.controls.length).toBeGreaterThan(0);
    expect(layout.controls.every((height) => height >= 44)).toBe(true);
  }
});

test("real BFF login retains the role-owned recovery context without route mocks", async ({
  page
}) => {
  for (const app of apps) {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(app.url);
    await signIn(page, app);
    const rail = page.locator(`[data-recovery-role="${app.role}"]`);
    await expect(rail).toHaveAttribute("data-recovery-status", /ready|loading|error|stale/);
    await expect(rail.getByText("tenant_demo", { exact: true })).toBeVisible();
    await expect(rail.getByText("上下文与恢复", { exact: true })).toBeVisible();

    const axeResults = await new AxeBuilder({ page })
      .include(`[data-recovery-role="${app.role}"]`)
      .analyze();
    expect(blockingAxeViolations(axeResults)).toEqual([]);

    if (app.role === "admin") {
      await expect(page.locator('[data-recovery-role="enterprise"]')).toBeVisible();
      await expect(
        page.locator('[data-recovery-role="enterprise"]').getByText("tenant_demo", { exact: true })
      ).toBeVisible();

      const enterpriseAxe = await new AxeBuilder({ page })
        .include('[data-recovery-role="enterprise"]')
        .analyze();
      expect(blockingAxeViolations(enterpriseAxe)).toEqual([]);
    }
  }
});
