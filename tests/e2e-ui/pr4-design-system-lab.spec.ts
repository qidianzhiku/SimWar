import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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
if (!headSha || !actualSha || headSha !== actualSha) {
  throw new Error(
    `PR4 Lab head SHA must match actual checkout: expected ${headSha}, actual ${actualSha}`
  );
}
const labUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_LAB_PORT ?? 3004}`;
const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 }
] as const;
const expectedStates = [
  "loading",
  "empty",
  "partial",
  "ready",
  "blocked",
  "stale",
  "conflict",
  "unknown",
  "permission-denied",
  "error"
].sort();
const runtimeEvidence: Array<{
  surface: "design-system-lab";
  viewport: { width: number; height: number };
  first_usable_ms: number;
  hash_to_destination_ms: number;
  cls: number;
  status: "within_budget" | "over_budget";
}> = [];

function blockingAxeViolations(results: Awaited<ReturnType<AxeBuilder["analyze"]>>) {
  return results.violations.filter(
    (violation) =>
      violation.impact === "serious" ||
      violation.impact === "critical" ||
      (violation.impact === "moderate" &&
        violation.tags.some((tag) => tag.toLowerCase().startsWith("wcag")))
  );
}

async function waitForLabSettled(page: Page, viewport: { width: number; height: number }) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    window.scrollTo({ left: 0, top: 0, behavior: "auto" });
  });
  const loadingCount = await page.locator('[data-state="loading"]:visible').count();
  if (loadingCount > 0) {
    test.info().annotations.push({
      type: "capture-state",
      description: `DesignSystemLab deliberately renders ${loadingCount} loading panel; this screenshot is explicitly labeled state-matrix.`
    });
  }
  await expect(page.locator('[role="banner"]')).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "角色导航" })).toHaveCount(1);
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "组件画廊", exact: true })).toBeVisible();
  const navigationLinks = page.getByRole("navigation", { name: "角色导航" }).getByRole("link");
  expect(await navigationLinks.count()).toBe(4);
  for (let index = 0; index < (await navigationLinks.count()); index += 1) {
    const link = navigationLinks.nth(index);
    const rect = await link.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height };
    });
    expect(
      rect.height,
      `Lab navigation target ${index} at ${viewport.width}`
    ).toBeGreaterThanOrEqual(44);
  }
  await waitForPr4CaptureStable(page);
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

test.describe.serial("Product PR4 DesignSystemLab surface", () => {
  test.afterAll(() => {
    const output = resolve(evidenceRoot, "performance-lab.json");
    mkdirSync(evidenceRoot, { recursive: true });
    writeFileSync(
      output,
      JSON.stringify(
        {
          schema_version: "pr4-runtime-performance.v1",
          base_sha: baseSha,
          head_sha: headSha,
          actual_sha: actualSha,
          surface: "design-system-lab",
          budgets: {
            first_usable_ms: 2_000,
            hash_to_destination_ms: 100,
            cls: 0.1
          },
          evidence: runtimeEvidence
        },
        null,
        2
      )
    );
  });

  test("covers the real Lab at every required viewport and state", async ({ page }) => {
    mkdirSync(resolve(evidenceRoot, "candidate"), { recursive: true });
    await page.goto(labUrl);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await waitForLabSettled(page, viewport);

      const firstUsableMs = await page.evaluate(() => {
        const navigation = performance.getEntriesByType("navigation")[0] as
          | PerformanceNavigationTiming
          | undefined;
        return Math.round((navigation?.domContentLoadedEventEnd ?? performance.now()) * 100) / 100;
      });
      expect(firstUsableMs).toBeLessThanOrEqual(2_000);

      const stateValues = await page.locator("[data-state]").evaluateAll((elements) =>
        elements
          .map((element) => element.getAttribute("data-state"))
          .filter(Boolean)
          .sort()
      );
      expect(stateValues).toEqual(expectedStates);

      const disabledAction = page.locator('button[data-action="unavailable"]:disabled');
      await expect(disabledAction).toHaveCount(1);
      await expect(disabledAction).toHaveAttribute("aria-describedby", /.+/);
      const disabledWrapper = page.locator(
        '.sw-allowed-action-wrap:has(button[data-action="unavailable"])'
      );
      await expect(disabledWrapper).toHaveCount(1);
      await expect(disabledWrapper.getByRole("status")).toHaveText("服务端未提供该动作");

      const visibleControls = page.locator(
        'a:visible,button:visible,input:visible,select:visible,textarea:visible,[role="button"]:visible'
      );
      for (let index = 0; index < (await visibleControls.count()); index += 1) {
        const control = visibleControls.nth(index);
        const rect = await control.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return { width: box.width, height: box.height };
        });
        expect(rect.width, `Lab target ${index} width at ${viewport.width}`).toBeGreaterThanOrEqual(
          44
        );
        expect(
          rect.height,
          `Lab target ${index} height at ${viewport.width}`
        ).toBeGreaterThanOrEqual(44);
      }

      const skipLink = page.getByRole("link", { name: "跳转到主要内容" });
      await page.evaluate(() => {
        document.body.setAttribute("data-pr4-focus-reset", "true");
        document.body.setAttribute("tabindex", "-1");
        document.body.focus();
      });
      await page.keyboard.press("Tab");
      await expect(skipLink).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.locator("main")).toBeFocused();
      await page.evaluate(() => document.body.removeAttribute("tabindex"));
      await skipLink.focus();
      await expect(skipLink).toBeFocused();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(skipLink).toHaveCSS("transition-duration", "0.001s");

      const clsObserverStarted = await page.evaluate(() => {
        const current = window as typeof window & {
          __pr4LabCls?: number;
          __pr4LabObserver?: PerformanceObserver;
          __pr4LabHash?: { startedAt: number | null; completedAt: number | null };
        };
        current.__pr4LabCls = 0;
        current.__pr4LabObserver?.disconnect();
        if (typeof PerformanceObserver === "undefined") {
          current.__pr4LabCls = undefined;
          return false;
        }
        current.__pr4LabObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & {
              hadRecentInput?: boolean;
              value?: number;
            };
            if (!shift.hadRecentInput)
              current.__pr4LabCls = (current.__pr4LabCls ?? 0) + (shift.value ?? 0);
          }
        });
        current.__pr4LabObserver.observe({ type: "layout-shift", buffered: false });
        return true;
      });
      expect(clsObserverStarted).toBe(true);

      const targetLink = page.getByRole("link", { name: "动作与回执" });
      await targetLink.evaluate((element) => {
        const current = window as typeof window & {
          __pr4LabHash?: { startedAt: number | null; completedAt: number | null };
        };
        const metric = { startedAt: null as number | null, completedAt: null as number | null };
        const target = element as HTMLAnchorElement;
        const complete = () => {
          if (metric.startedAt !== null && window.location.hash === target.hash) {
            metric.completedAt = performance.now();
          }
        };
        target.addEventListener(
          "pointerdown",
          () => {
            metric.startedAt = performance.now();
            complete();
          },
          { once: true }
        );
        window.addEventListener("hashchange", complete, { once: true });
        current.__pr4LabHash = metric;
      });
      await targetLink.click();
      await expect(page).toHaveURL(/#sw-lab-actions$/);
      await expect
        .poll(() =>
          page.evaluate(() => {
            const metric = (
              window as typeof window & {
                __pr4LabHash?: { startedAt: number | null; completedAt: number | null };
              }
            ).__pr4LabHash;
            return metric?.startedAt !== null && metric?.completedAt !== null
              ? metric.completedAt - metric.startedAt
              : -1;
          })
        )
        .toBeGreaterThanOrEqual(0);
      const hashLatency = await page.evaluate(() => {
        const metric = (
          window as typeof window & {
            __pr4LabHash?: { startedAt: number | null; completedAt: number | null };
          }
        ).__pr4LabHash;
        return metric?.startedAt !== null && metric?.completedAt !== null
          ? Math.round((metric.completedAt - metric.startedAt) * 100) / 100
          : null;
      });
      expect(hashLatency).not.toBeNull();
      expect(hashLatency ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(100);

      const cls = await page.evaluate(() => {
        const current = window as typeof window & {
          __pr4LabCls?: number;
          __pr4LabObserver?: PerformanceObserver;
        };
        current.__pr4LabObserver?.disconnect();
        return current.__pr4LabCls ?? null;
      });
      expect(cls).not.toBeNull();
      if (cls === null) throw new Error("DesignSystemLab CLS metric is unsupported.");
      expect(cls).toBeLessThanOrEqual(0.1);

      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
        window.scrollTo({ left: 0, top: 0 });
      });
      const overflow = await page.evaluate(() => ({
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        innerWidth: window.innerWidth,
        descendants: Array.from(document.querySelectorAll("*"))
          .filter((element) => element.scrollWidth > element.clientWidth + 1)
          .slice(0, 10)
          .map((element) => ({
            tag: element.tagName,
            className: element.className,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth
          }))
      }));
      expect(
        overflow.documentScrollWidth,
        `Lab page overflow at ${viewport.width}`
      ).toBeLessThanOrEqual(overflow.innerWidth);
      expect(
        overflow.bodyScrollWidth,
        `Lab body overflow at ${viewport.width}`
      ).toBeLessThanOrEqual(overflow.innerWidth);
      expect(overflow.descendants, JSON.stringify(overflow.descendants)).toEqual([]);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "";
        window.scrollTo({ left: 0, top: 0 });
      });
      await waitForPr4CaptureStable(page);

      const axeResults = await new AxeBuilder({ page }).analyze();
      const blocking = blockingAxeViolations(axeResults);
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);

      const hashMs = hashLatency ?? Number.POSITIVE_INFINITY;
      runtimeEvidence.push({
        surface: "design-system-lab",
        viewport,
        first_usable_ms: firstUsableMs,
        hash_to_destination_ms: hashMs,
        cls,
        status:
          firstUsableMs <= 2_000 && hashMs <= 100 && cls <= 0.1 ? "within_budget" : "over_budget"
      });
      expect(cls).toBeLessThanOrEqual(0.1);
      await page.screenshot({
        path: resolve(
          evidenceRoot,
          "candidate",
          `lab-lab-state-matrix-state-matrix-${viewport.width}x${viewport.height}.png`
        ),
        fullPage: false
      });
    }
  });
});
