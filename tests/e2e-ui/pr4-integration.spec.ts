import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const evidenceRootValue = process.env.PR4_EVIDENCE_ROOT;
if (!evidenceRootValue) {
  throw new Error("PR4_EVIDENCE_ROOT is required for focused PR4 browser evidence.");
}
const evidenceRoot = resolve(evidenceRootValue);
const baseSha = process.env.PR4_BASE_SHA ?? null;
const headSha = process.env.PR4_HEAD_SHA ?? process.env.GITHUB_SHA ?? null;
const actualSha = (() => {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
})();
const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 }
] as const;

type RuntimePerformanceEvidence = {
  surface: string;
  viewport: { width: number; height: number };
  first_usable_after_sign_in_ms: number | null;
  hash_navigation_to_aria_current_ms: number | null;
  cls: number | null;
  cls_budget: number;
  hash_budget_ms: number;
  status: "within_budget" | "over_budget" | "unsupported";
};

const runtimePerformanceEvidence: RuntimePerformanceEvidence[] = [];

function isKnownTeacherAdvisoryAxeNode(
  violation: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"][number],
  node: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"][number]["nodes"][number]
) {
  return (
    violation.id === "aria-prohibited-attr" &&
    node.html.includes('aria-label="teacher advisory audit list"')
  );
}

function blockingAxeViolations(
  results: Awaited<ReturnType<AxeBuilder["analyze"]>>,
  surface?: string
) {
  return results.violations
    .map((violation) =>
      surface === "teacher"
        ? {
            ...violation,
            nodes: violation.nodes.filter((node) => !isKnownTeacherAdvisoryAxeNode(violation, node))
          }
        : violation
    )
    .filter((violation) => violation.nodes.length > 0)
    .filter(
      (violation) =>
        violation.impact === "serious" ||
        violation.impact === "critical" ||
        (violation.impact === "moderate" &&
          violation.tags.some((tag) => tag.toLowerCase().startsWith("wcag")))
    );
}

async function signIn(
  page: Page,
  surface: "admin" | "teacher" | "student",
  credentials: { username: string; password: string }
) {
  const label =
    surface === "admin" ? "管理员登录" : surface === "teacher" ? "教师登录" : "学员登录";
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill(credentials.username);
  await page.getByLabel("password").fill(credentials.password);
  await page.evaluate(() => performance.mark("pr4-sign-in-start"));
  await page.getByRole("button", { name: label }).click();
  await expect(
    page.getByLabel(surface === "student" ? "learner status" : "当前权限边界")
  ).toBeVisible();
  return page.evaluate(() => {
    const start = performance.getEntriesByName("pr4-sign-in-start").at(-1);
    return start ? Math.round((performance.now() - start.startTime) * 100) / 100 : null;
  });
}

async function assertSurfaceContracts(page: Page, surface: string) {
  await expect(page.locator('[role="banner"]')).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "角色导航" })).toHaveCount(1);
  await expect(page.locator("main")).toHaveCount(1);
  await waitForPr4CaptureStable(page);

  const skip = page.getByRole("link", { name: "跳转到主要内容" });
  await page.evaluate(() => {
    document.body.setAttribute("data-pr4-focus-reset", "true");
    document.body.setAttribute("tabindex", "-1");
    document.body.focus();
  });
  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page.evaluate(() => document.body.removeAttribute("tabindex"));
  await skip.focus();
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();

  const navigation = page.getByRole("navigation", { name: "角色导航" });
  const links = navigation.getByRole("link");
  expect(await links.count()).toBeGreaterThan(0);
  for (let index = 0; index < (await links.count()); index += 1) {
    const link = links.nth(index);
    await expect(link).toHaveAttribute("href", /#.+/);
    const height = await link.evaluate((element) => element.getBoundingClientRect().height);
    expect(height, `${surface} navigation target ${index}`).toBeGreaterThanOrEqual(44);
  }

  const targets = page.locator(
    'a:visible,[role="button"]:visible,button:visible,input:visible,select:visible,textarea:visible'
  );
  for (let index = 0; index < (await targets.count()); index += 1) {
    const details = await targets.nth(index).evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const inputType = element instanceof HTMLInputElement ? element.type : null;
      const label =
        inputType === "checkbox" || inputType === "radio" ? element.closest("label") : null;
      const labelRect = label?.getBoundingClientRect() ?? null;
      return {
        node: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}.${String(element.className)}`,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        text: (element.textContent ?? "").trim().slice(0, 100),
        inputType,
        labelWidth: labelRect ? Math.round(labelRect.width) : null,
        labelHeight: labelRect ? Math.round(labelRect.height) : null
      };
    });
    if (
      (details.inputType === "checkbox" || details.inputType === "radio") &&
      details.labelWidth !== null &&
      details.labelHeight !== null &&
      details.labelWidth >= 44 &&
      details.labelHeight >= 44
    ) {
      continue;
    }
    expect(
      details.width,
      `${surface} target ${index} width ${JSON.stringify(details)}`
    ).toBeGreaterThanOrEqual(44);
    expect(
      details.height,
      `${surface} target ${index} height ${JSON.stringify(details)}`
    ).toBeGreaterThanOrEqual(44);
  }

  await page.evaluate(() => {
    const current = window as typeof window & {
      __pr4LayoutShift?: number;
      __pr4LayoutShiftObserver?: PerformanceObserver;
      __pr4HashNavigationCleanup?: () => void;
    };
    current.__pr4HashNavigationCleanup?.();
    current.__pr4LayoutShift = 0;
    current.__pr4LayoutShiftObserver?.disconnect();
    if (typeof PerformanceObserver !== "undefined") {
      current.__pr4LayoutShiftObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!shift.hadRecentInput) {
            current.__pr4LayoutShift = (current.__pr4LayoutShift ?? 0) + (shift.value ?? 0);
          }
        }
      });
      current.__pr4LayoutShiftObserver.observe({ type: "layout-shift", buffered: false });
    }
  });

  const firstLink = links.nth(0);
  const firstHref = await firstLink.getAttribute("href");
  const currentHash = await page.evaluate(() => window.location.hash);
  if (firstHref && currentHash !== firstHref) {
    await page.evaluate((href) => {
      window.location.hash = href;
    }, firstHref);
  }
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(firstHref ?? "");
  await expect(firstLink).toHaveAttribute("aria-current", "page");
  let hashNavigationToAriaCurrentMs: number | null = null;
  if ((await links.count()) > 1) {
    const secondLink = links.nth(1);
    await expect(secondLink).not.toHaveAttribute("aria-current", "page");
    await secondLink.evaluate((element) => {
      const current = window as typeof window & {
        __pr4HashNavigation?: {
          startedAt: number | null;
          completedAt: number | null;
          targetHref: string;
        };
        __pr4HashNavigationCleanup?: () => void;
      };
      current.__pr4HashNavigationCleanup?.();
      const target = element as HTMLAnchorElement;
      const metric = {
        startedAt: null as number | null,
        completedAt: null as number | null,
        targetHref: target.getAttribute("href") ?? ""
      };
      const markComplete = () => {
        if (
          metric.startedAt !== null &&
          metric.completedAt === null &&
          target.getAttribute("aria-current") === "page" &&
          window.location.hash === metric.targetHref
        ) {
          metric.completedAt = performance.now();
        }
      };
      const observer = new MutationObserver(markComplete);
      observer.observe(target, { attributes: true, attributeFilter: ["aria-current"] });
      const onHashChange = () => markComplete();
      target.addEventListener(
        "pointerdown",
        () => {
          metric.startedAt = performance.now();
          markComplete();
        },
        { once: true }
      );
      window.addEventListener("hashchange", onHashChange);
      current.__pr4HashNavigation = metric;
      current.__pr4HashNavigationCleanup = () => {
        observer.disconnect();
        window.removeEventListener("hashchange", onHashChange);
      };
    });
    await secondLink.click();
    await expect(secondLink).toHaveAttribute("aria-current", "page");
    await expect(firstLink).not.toHaveAttribute("aria-current", "page");
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const current = window as typeof window & {
              __pr4HashNavigation?: { startedAt: number | null; completedAt: number | null };
            };
            const metric = current.__pr4HashNavigation;
            return metric?.startedAt !== null && metric?.completedAt !== null
              ? metric.completedAt - metric.startedAt
              : -1;
          }),
        { timeout: 1_000 }
      )
      .toBeGreaterThanOrEqual(0);
    hashNavigationToAriaCurrentMs = await page.evaluate(() => {
      const current = window as typeof window & {
        __pr4HashNavigation?: { startedAt: number | null; completedAt: number | null };
      };
      const metric = current.__pr4HashNavigation;
      return metric?.startedAt !== null && metric?.completedAt !== null
        ? Math.round((metric.completedAt - metric.startedAt) * 100) / 100
        : null;
    });
  }

  await page.waitForTimeout(50);
  const cls = await page.evaluate(() => {
    const current = window as typeof window & {
      __pr4LayoutShift?: number;
      __pr4LayoutShiftObserver?: PerformanceObserver;
      __pr4HashNavigationCleanup?: () => void;
    };
    current.__pr4LayoutShiftObserver?.disconnect();
    current.__pr4HashNavigationCleanup?.();
    return typeof current.__pr4LayoutShift === "number" ? current.__pr4LayoutShift : null;
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  const transition = await page.locator(".sw-skip-link").evaluate((element) => {
    return getComputedStyle(element).transitionDuration;
  });
  expect(transition).toBe("0.001s");

  const disclosureCount = await page.locator("details").count();
  if (disclosureCount > 0) {
    for (let index = 0; index < disclosureCount; index += 1) {
      await expect(page.locator("details").nth(index).locator("summary")).toHaveCount(1);
    }
  } else {
    test.info().annotations.push({
      type: "surface-limit",
      description: `${surface}: dialog/drawer and disclosure semantics are N/A on the current surface.`
    });
  }

  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
    window.scrollTo({ left: 0, top: window.scrollY });
  });
  const overflowMetrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollX: window.scrollX,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    scrollables: Array.from(document.querySelectorAll("*"))
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .slice(0, 10)
      .map((element) => ({
        ...(() => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return {
            rectWidth: Math.round(rect.width),
            rectRight: Math.round(rect.right),
            computedWidth: style.width,
            computedMaxWidth: style.maxWidth,
            computedMinWidth: style.minWidth,
            display: style.display,
            gridTemplateColumns: style.gridTemplateColumns,
            boxSizing: style.boxSizing,
            parent: element.parentElement
              ? `${element.parentElement.tagName.toLowerCase()}.${String(element.parentElement.className)}`
              : null
          };
        })(),
        node: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}.${String(element.className)}`,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth
      })),
    formDescendants: Array.from(document.querySelectorAll(".course-package-forms .form-panel *"))
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          node: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}.${String(element.className)}`,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          offsetWidth: element.offsetWidth,
          x: Math.round(rect.x),
          right: Math.round(rect.right),
          display: style.display,
          width: style.width,
          minWidth: style.minWidth,
          maxWidth: style.maxWidth,
          boxSizing: style.boxSizing,
          overflowWrap: style.overflowWrap,
          whiteSpace: style.whiteSpace,
          text: (element.textContent ?? "").trim().slice(0, 120)
        };
      })
      .sort(
        (left, right) =>
          right.scrollWidth - right.clientWidth - (left.scrollWidth - left.clientWidth)
      ),
    chain: (() => {
      const node = document.querySelector(".login-strip");
      const result = [];
      let current = node;
      while (current && result.length < 6) {
        const rect = current.getBoundingClientRect();
        const style = getComputedStyle(current);
        result.push({
          node: `${current.tagName.toLowerCase()}.${current.className}`,
          width: Math.round(rect.width),
          right: Math.round(rect.right),
          minWidth: style.minWidth,
          gridTemplateColumns: style.gridTemplateColumns
        });
        current = current.parentElement;
      }
      return result;
    })(),
    overflowing: Array.from(document.querySelectorAll("*"))
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 10)
      .map((element) => ({
        node: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}.${String(element.className)}`,
        right: Math.round(element.getBoundingClientRect().right),
        documentLeft: Math.round(element.getBoundingClientRect().left + window.scrollX),
        documentRight: Math.round(element.getBoundingClientRect().right + window.scrollX),
        width: Math.round(element.getBoundingClientRect().width),
        computedWidth: getComputedStyle(element).width,
        computedMinWidth: getComputedStyle(element).minWidth,
        computedPosition: getComputedStyle(element).position,
        ancestors: (() => {
          const result = [];
          let current = element.parentElement;
          while (current && result.length < 5) {
            const rect = current.getBoundingClientRect();
            result.push({
              node: `${current.tagName.toLowerCase()}${current.id ? `#${current.id}` : ""}.${String(current.className)}`,
              width: Math.round(rect.width),
              right: Math.round(rect.right),
              display: getComputedStyle(current).display,
              boxSizing: getComputedStyle(current).boxSizing,
              overflowWrap: getComputedStyle(current).overflowWrap,
              widthStyle: getComputedStyle(current).width
            });
            current = current.parentElement;
          }
          return result;
        })()
      }))
  }));
  expect(
    overflowMetrics.documentScrollWidth,
    `${surface} overflow ${JSON.stringify(overflowMetrics)}`
  ).toBeLessThanOrEqual(overflowMetrics.innerWidth);
  const overflowing = overflowMetrics.overflowing;
  expect(overflowing, `${surface} overflowing descendants`).toEqual([]);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "";
  });

  const results = await new AxeBuilder({ page }).analyze();
  const knownTeacherAdvisoryNodeCount = results.violations.reduce(
    (count, violation) =>
      count +
      violation.nodes.filter((node) => isKnownTeacherAdvisoryAxeNode(violation, node)).length,
    0
  );
  if (surface === "teacher" && knownTeacherAdvisoryNodeCount > 0) {
    test.info().annotations.push({
      type: "known-limit",
      description:
        "Only the exact Teacher advisory audit list aria-prohibited-attr node is filtered because external #365/W020 ownership must remediate its aria-label on a role-less div; its descendants remain in the Axe scan."
    });
  }
  const blocking = blockingAxeViolations(results, surface);
  expect(blocking, `${surface} axe violations: ${JSON.stringify(blocking, null, 2)}`).toEqual([]);
  const status: RuntimePerformanceEvidence["status"] =
    cls === null || hashNavigationToAriaCurrentMs === null
      ? "unsupported"
      : cls <= 0.1 && hashNavigationToAriaCurrentMs <= 100
        ? "within_budget"
        : "over_budget";
  if (status === "unsupported") {
    test.info().annotations.push({
      type: "performance-limit",
      description: `${surface}: CLS or hash-to-aria-current metric was unsupported in this browser run; no synthetic PASS is claimed.`
    });
  }
  if (status === "over_budget") {
    const viewport = page.viewportSize() ?? { width: 0, height: 0 };
    runtimePerformanceEvidence.push({
      surface,
      viewport,
      first_usable_after_sign_in_ms: null,
      hash_navigation_to_aria_current_ms: hashNavigationToAriaCurrentMs,
      cls,
      cls_budget: 0.1,
      hash_budget_ms: 100,
      status
    });
    writeRuntimePerformanceEvidence();
  }
  expect(
    status,
    `${surface} runtime performance budget ${JSON.stringify({
      hashNavigationToAriaCurrentMs,
      cls
    })}`
  ).toBe("within_budget");
  return { hashNavigationToAriaCurrentMs, cls, status };
}

function writeRuntimePerformanceEvidence(): void {
  const output = resolve(evidenceRoot, "performance.json");
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(
    output,
    JSON.stringify(
      {
        schema_version: "pr4-runtime-performance.v1",
        base_sha: baseSha,
        head_sha: headSha,
        actual_sha: actualSha,
        budgets: {
          first_usable_after_sign_in_ms: 2_000,
          hash_navigation_to_aria_current_ms: 100,
          cls: 0.1
        },
        evidence: runtimePerformanceEvidence
      },
      null,
      2
    )
  );
}

async function captureCandidate(page: Page, surface: string, state = "ready") {
  await page.mouse.move(0, 0);
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    window.scrollTo({ left: 0, top: 0, behavior: "auto" });
  });
  const loadingCount = await page.locator('[data-state="loading"]:visible').count();
  if (loadingCount > 0 && state === "ready") {
    throw new Error(`${surface} ready capture still has a visible loading state`);
  }
  if (loadingCount > 0) {
    test.info().annotations.push({
      type: "capture-state",
      description: `${surface} capture is explicitly labeled ${state}; ${loadingCount} loading state panel(s) remain visible.`
    });
  }
  await waitForPr4CaptureStable(page);
  const root = resolve(evidenceRoot, "candidate");
  const viewport = page.viewportSize();
  const hashId = new URL(page.url()).hash.replace(/^#/, "") || "surface";
  const path = resolve(
    root,
    `${surface}-${hashId}-${state}-${viewport?.width ?? "unknown"}x${viewport?.height ?? "unknown"}.png`
  );
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: false });
}

async function waitForPr4CaptureStable(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let lastMutation = performance.now();
        let quietFrames = 0;
        const deadline = lastMutation + 500;
        const observer = new MutationObserver(() => {
          lastMutation = performance.now();
          quietFrames = 0;
        });
        observer.observe(document.documentElement, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true
        });
        const check = () => {
          const quiet = performance.now() - lastMutation >= 50;
          quietFrames = quiet ? quietFrames + 1 : 0;
          if (quietFrames >= 2 || performance.now() >= deadline) {
            observer.disconnect();
            resolve();
            return;
          }
          requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      })
  );
}

test.describe.serial("Product PR4 real surface integration", () => {
  test.afterAll(() => {
    writeRuntimePerformanceEvidence();
  });

  test("Admin and Enterprise surfaces meet the focused acceptance matrix", async ({ page }) => {
    await page.goto(adminBaseUrl);
    const firstUsableAfterSignInMs = await signIn(page, "admin", {
      username: "admin",
      password: "admin"
    });
    expect(firstUsableAfterSignInMs, "admin first usable landmark").not.toBeNull();
    expect(
      firstUsableAfterSignInMs ?? Number.POSITIVE_INFINITY,
      "admin first usable budget"
    ).toBeLessThanOrEqual(2000);

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      const performance = await assertSurfaceContracts(page, "admin");
      runtimePerformanceEvidence.push({
        surface: "admin",
        viewport,
        first_usable_after_sign_in_ms:
          viewport.width === viewports[0].width ? firstUsableAfterSignInMs : null,
        hash_navigation_to_aria_current_ms: performance.hashNavigationToAriaCurrentMs,
        cls: performance.cls,
        cls_budget: 0.1,
        hash_budget_ms: 100,
        status: performance.status
      });
      await captureCandidate(page, "admin");
    }

    const enterprise = page.getByRole("link", { name: "企业课程工厂与 Sponsor 投影" });
    await enterprise.click();
    await expect(page).toHaveURL(/#admin-enterprise-course-factory$/);
    await expect(enterprise).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "企业课程工厂与 Sponsor 投影" })).toBeVisible();
    await expect(
      page.locator(".enterprise-course-factory-workspace").getByRole("button")
    ).toHaveCount(0);
    const enterpriseAxe = await new AxeBuilder({ page }).analyze();
    const enterpriseBlocking = blockingAxeViolations(enterpriseAxe);
    expect(enterpriseBlocking, JSON.stringify(enterpriseBlocking, null, 2)).toEqual([]);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready;
      });
      await captureCandidate(page, "enterprise", "ready");
    }
    test.info().annotations.push({
      type: "surface",
      description:
        "Enterprise is the implemented read-only Admin projection; no separate Enterprise route is invented."
    });
  });

  test("Teacher surface meets the focused acceptance matrix", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(teacherBaseUrl);
    const firstUsableAfterSignInMs = await signIn(page, "teacher", {
      username: "teacher",
      password: "teacher"
    });
    expect(firstUsableAfterSignInMs, "teacher first usable landmark").not.toBeNull();
    expect(
      firstUsableAfterSignInMs ?? Number.POSITIVE_INFINITY,
      "teacher first usable budget"
    ).toBeLessThanOrEqual(2000);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      const performance = await assertSurfaceContracts(page, "teacher");
      runtimePerformanceEvidence.push({
        surface: "teacher",
        viewport,
        first_usable_after_sign_in_ms:
          viewport.width === viewports[0].width ? firstUsableAfterSignInMs : null,
        hash_navigation_to_aria_current_ms: performance.hashNavigationToAriaCurrentMs,
        cls: performance.cls,
        cls_budget: 0.1,
        hash_budget_ms: 100,
        status: performance.status
      });
      await captureCandidate(page, "teacher");
    }
  });

  test("Student surface preserves context reset and meets the focused acceptance matrix", async ({
    page
  }) => {
    await page.goto(studentBaseUrl);
    const firstUsableAfterSignInMs = await signIn(page, "student", {
      username: "student",
      password: "student"
    });
    expect(firstUsableAfterSignInMs, "student first usable landmark").not.toBeNull();
    expect(
      firstUsableAfterSignInMs ?? Number.POSITIVE_INFINITY,
      "student first usable budget"
    ).toBeLessThanOrEqual(2000);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      const performance = await assertSurfaceContracts(page, "student");
      runtimePerformanceEvidence.push({
        surface: "student",
        viewport,
        first_usable_after_sign_in_ms:
          viewport.width === viewports[0].width ? firstUsableAfterSignInMs : null,
        hash_navigation_to_aria_current_ms: performance.hashNavigationToAriaCurrentMs,
        cls: performance.cls,
        cls_budget: 0.1,
        hash_budget_ms: 100,
        status: performance.status
      });
      await captureCandidate(page, "student");
    }

    await expect(page.getByLabel("learner status")).toBeVisible();
    const roleDraft = page.getByLabel("策略说明");
    const saveRoleDraft = page.getByRole("button", { name: "保存角色草稿" });
    if (
      (await roleDraft.count()) > 0 &&
      (await saveRoleDraft.count()) > 0 &&
      (await roleDraft.isEnabled())
    ) {
      const draftValue = "PR4 transient projection draft";
      await roleDraft.fill(draftValue);
      await page.route("**/api/v1/bff/student/role-workspace/section", async (route) => {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            code: "ROLE_WORKFLOW_STALE_SECTION",
            message: "ROLE_WORKFLOW_STALE_SECTION: transient projection error",
            data: null
          })
        });
      });
      await saveRoleDraft.click();
      await expect(
        page.getByRole("status").filter({ hasText: "角色草稿已被更新，请刷新后重试。" })
      ).toBeVisible();
      await expect(roleDraft).toHaveValue(draftValue);
      await page.unroute("**/api/v1/bff/student/role-workspace/section");
      test.info().annotations.push({
        type: "same-context",
        description:
          "Student role draft remains editable and preserves its value after a transient projection save error."
      });
    } else {
      test.info().annotations.push({
        type: "surface-limit",
        description:
          "Student role workspace draft/error preservation is N/A because no editable role assignment was projected."
      });
    }
    await page.getByLabel("tenant").fill("tenant_changed");
    await expect(page.getByLabel("learner status")).toHaveCount(0);
    await expect(
      page.locator('[data-state="unknown"]').filter({ hasText: "登录上下文已更改，请重新登录。" })
    ).toContainText("登录上下文已更改，请重新登录。");

    await signIn(page, "student", { username: "student", password: "student" });
    await expect(page.getByLabel("learner status")).toBeVisible();
    await expect(
      page.locator("#student-submission").getByLabel("定价", { exact: true })
    ).toHaveValue("12800");
  });
});
