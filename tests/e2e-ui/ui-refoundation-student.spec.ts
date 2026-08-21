import { expect, test } from "@playwright/test";

const studentLocations = [
  ["student-role-mission", "角色任务"],
  ["student-cockpit", "经营驾驶舱"],
  ["student-evidence", "信息与证据"],
  ["student-enterprise-state", "企业状态与战略演进"],
  ["student-private-draft", "个人草稿"],
  ["student-collaboration", "团队协作"],
  ["student-divergence", "分歧冲突"],
  ["student-confirmation", "团队确认"],
  ["student-submission", "最终提交"],
  ["student-results", "结果与因果链"],
  ["student-debrief", "复盘"],
  ["student-learning-report", "学习报告"],
  ["student-learning-path", "学习路径"]
] as const;

async function signIn(page: import("@playwright/test").Page, username: string, password: string) {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill(username);
  await page.getByLabel("password").fill(password);
  await page.getByRole("button", { name: "学员登录" }).click();
}

test("Student executive workspace exposes the thirteen real logical locations", async ({
  page
}) => {
  await page.goto("/");
  await signIn(page, "student", "student");
  await expect(
    page.getByLabel("learner status").getByText("Alpha 康养队", { exact: true })
  ).toBeVisible();
  await expect(page.getByTestId("student-golden-journey")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "学员决策学习旅程" })).toBeVisible();
  await expect(
    page.locator('[data-testid="student-p2b-blocked"], [data-testid="student-p2b-result"]')
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "student learning report" })).toBeVisible();
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);
    const navigation = page.getByRole("navigation", { name: "角色导航" });
    await expect(navigation).toBeVisible();
    for (const [id, label] of studentLocations) {
      const link = navigation.getByRole("link", { name: label, exact: true });
      await expect(link).toHaveAttribute("href", `#${id}`);
      await expect(page.locator(`#${id}`)).toHaveCount(1);
      await expect(link).toHaveCSS("min-height", /48px|44px/);
    }
    const domOrder = await page
      .locator(".student-location[id]")
      .evaluateAll((nodes) => nodes.map((node) => node.id));
    expect(domOrder).toEqual(studentLocations.map(([id]) => id));
    await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  }
});

test("Student app keeps the safe BFF projection and denies non-student identities", async ({
  page
}) => {
  await page.goto("/");
  await signIn(page, "teacher", "teacher");
  await expect(page.getByRole("heading", { name: "无权限" })).toBeVisible();
  await expect(page.getByText("当前账号没有学员工作区权限。", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "角色导航" }).getByRole("link")).toHaveCount(1);
  await expect(page.locator("#student-submission")).toHaveCount(0);
  await expect(page.locator("#student-results")).toHaveCount(0);

  await page.getByLabel("username").fill("student");
  await page.getByLabel("password").fill("student");
  await page.getByRole("button", { name: "学员登录" }).click();
  await expect(
    page.getByLabel("learner status").getByText("Alpha 康养队", { exact: true })
  ).toBeVisible();

  const body = await page.locator("body").innerText();
  for (const forbidden of [
    "state_true",
    "replay_hash",
    "other_team",
    "peer_private",
    "parameter_values"
  ]) {
    expect(body).not.toContain(forbidden);
  }
  const submit = page.locator('[data-action="decision:submit"]');
  await expect(submit).toHaveCount(1);
  await expect(submit).toBeDisabled();
  await expect(page.getByText("当前回合尚未授予正式提交权限。", { exact: true })).toBeVisible();
  for (const field of await page
    .locator("#student-submission input, #student-submission select, #student-submission textarea")
    .all()) {
    await expect(field).toBeDisabled();
  }
});

test("Student workspace keeps stale bootstrap responses from overwriting a changed tenant", async ({
  page
}) => {
  let demoStateRequests = 0;
  let releaseFirst!: () => void;
  const firstHeld = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  await page.route("**/api/v1/demo-state", async (route) => {
    demoStateRequests += 1;
    if (demoStateRequests === 1) await firstHeld;
    await route.continue();
  });
  await page.goto("/");
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill("student");
  await page.getByLabel("password").fill("student");
  await page.getByRole("button", { name: "学员登录" }).click();
  await expect.poll(() => demoStateRequests).toBe(1);
  await page.getByLabel("tenant").fill("tenant_other");
  releaseFirst();
  await expect(page.getByRole("navigation", { name: "角色导航" }).getByRole("link")).toHaveCount(1);
  await expect(page.locator("#student-cockpit")).toHaveCount(0);
  await expect(page.getByText("Alpha 康养队")).toHaveCount(0);
});

test("Student navigation retains keyboard focus and reduced-motion semantics", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const link = page.getByRole("link", { name: "角色任务", exact: true });
  await link.focus();
  await expect(link).toBeFocused();
  const outline = await link.evaluate((node) => getComputedStyle(node).outlineStyle);
  expect(outline).not.toBe("none");
  await signIn(page, "student", "student");
  const controls = page.locator("button:visible, input:visible, select:visible, textarea:visible");
  const count = await controls.count();
  for (let index = 0; index < count; index += 1) {
    const height = await controls
      .nth(index)
      .evaluate((element) => element.getBoundingClientRect().height);
    expect(height).toBeGreaterThanOrEqual(44);
  }
});
