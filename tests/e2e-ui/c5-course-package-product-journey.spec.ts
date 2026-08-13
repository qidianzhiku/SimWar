import { expect, test, type Page } from "@playwright/test";
import { cleanupPlaywrightStore } from "./store-isolation";

const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const digest = "a".repeat(64);

const adminPackage = {
  content_digest: digest,
  course_blueprint_reference: {
    content_digest: "b".repeat(64),
    course_blueprint_id: "blueprint_wellness_001",
    tenant_id: "tenant_demo",
    version: "1.0.0"
  },
  course_package_id: "course_package_wellness_001",
  created_at: "2026-08-02T03:07:00.000Z",
  created_by: "usr_admin",
  description: "Teaching-only package.",
  parameter_set_reference: {
    content_digest: "c".repeat(64),
    parameter_set_id: "parameter_wellness_001",
    version: "1.0.0"
  },
  scenario_package_reference: {
    content_digest: "d".repeat(64),
    scenario_package_id: "scenario_wellness_001",
    tenant_id: "tenant_demo",
    version: "1.0.0"
  },
  schema_version: "course-package-version.v1",
  status: "AVAILABLE",
  tenant_id: "tenant_demo",
  title: "Wellness Teaching Package",
  version: "1.0.0"
};

const teacherPackage = {
  course_blueprint_reference: adminPackage.course_blueprint_reference,
  course_package_reference: {
    content_digest: adminPackage.content_digest,
    course_package_id: adminPackage.course_package_id,
    tenant_id: adminPackage.tenant_id,
    version: adminPackage.version
  },
  description: adminPackage.description,
  parameter_set_reference: adminPackage.parameter_set_reference,
  scenario_package_reference: adminPackage.scenario_package_reference,
  title: adminPackage.title
};

const clonedTeacherPackage = {
  ...teacherPackage,
  course_package_reference: {
    content_digest: "e".repeat(64),
    course_package_id: "course_package_wellness_clone_001",
    tenant_id: "tenant_demo",
    version: "1.1.0"
  },
  description: "Teacher-owned Course Package version.",
  title: "Teacher Wellness Package"
};

function envelope(data: unknown) {
  return { code: "OK", data, message: "success", request_id: "req_c5_browser" };
}

function errorEnvelope(code: string) {
  return { code, message: "server detail is not displayed", request_id: "req_c5_error" };
}

async function signInAdmin(page: Page): Promise<void> {
  const login = page.getByLabel("admin login");
  await login.getByLabel("tenant").fill("tenant_demo");
  await login.getByLabel("username").fill("admin");
  await login.getByLabel("password").fill("admin");
  await login.getByRole("button", { name: "管理员登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

async function signInTeacher(page: Page): Promise<void> {
  const login = page.getByLabel("teacher login");
  await login.getByLabel("tenant").fill("tenant_demo");
  await login.getByLabel("username").fill("teacher");
  await login.getByLabel("password").fill("teacher");
  await login.getByRole("button", { name: "教师登录" }).click();
  await expect(
    page.getByRole("status", { name: "教师操作通知" }).getByLabel("技术兼容标签")
  ).toContainText("signed in");
}

test.afterEach(() => {
  cleanupPlaywrightStore();
});

test("Admin renders frozen CoursePackageVersion states without making compatibility decisions", async ({
  page
}) => {
  let releaseInitialList: (() => void) | undefined;
  const initialList = new Promise<void>((resolve) => {
    releaseInitialList = resolve;
  });
  let listCalls = 0;

  await page.route("**/api/v1/admin/course-package-versions", async (route) => {
    listCalls += 1;
    if (listCalls === 1) {
      await initialList;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(envelope({ course_package_versions: [] }))
      });
      return;
    }
    if (listCalls === 2) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(
          envelope({
            course_package_versions: [
              { ...adminPackage, course_package_id: "package_draft", status: "DRAFT" },
              { ...adminPackage, course_package_id: "package_validated", status: "VALIDATED" },
              adminPackage,
              { ...adminPackage, course_package_id: "package_retired", status: "RETIRED" }
            ]
          })
        )
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      status: 500,
      body: JSON.stringify(errorEnvelope("UNRECOGNIZED_FAILURE"))
    });
  });
  await page.route("**/api/v1/admin/course-package-versions/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/validate")) {
      await route.fulfill({
        contentType: "application/json",
        status: 422,
        body: JSON.stringify(errorEnvelope("COURSE_PACKAGE_DEPENDENCY_NOT_BINDABLE"))
      });
      return;
    }
    if (url.endsWith("/make-available")) {
      await route.fulfill({
        contentType: "application/json",
        status: 422,
        body: JSON.stringify(errorEnvelope("COURSE_PACKAGE_COMPATIBILITY_MISMATCH"))
      });
      return;
    }
    if (url.endsWith("/retire")) {
      await route.fulfill({
        contentType: "application/json",
        status: 403,
        body: JSON.stringify(errorEnvelope("COURSE_PACKAGE_FORBIDDEN"))
      });
      return;
    }
    if (url.includes("/export?")) {
      await route.fulfill({
        contentType: "application/json",
        status: 403,
        body: JSON.stringify(errorEnvelope("COURSE_PACKAGE_FORBIDDEN"))
      });
      return;
    }
    if (url.endsWith("/import")) {
      await route.fulfill({
        contentType: "application/json",
        status: 422,
        body: JSON.stringify(errorEnvelope("COURSE_PACKAGE_IMPORT_DIGEST_INVALID"))
      });
      return;
    }
    throw new Error(`Unexpected CoursePackageVersion request: ${url}`);
  });

  await page.goto(adminBaseUrl);
  await signInAdmin(page);

  const panel = page.getByLabel("CoursePackageVersion administration");
  await expect(panel.getByText("Loading CoursePackageVersions")).toBeVisible();
  releaseInitialList?.();
  await expect(panel.getByText("No CoursePackageVersions are available.")).toBeVisible();

  await panel.getByRole("button", { name: "Refresh CoursePackageVersions" }).click();
  await expect(panel.getByText("Wellness Teaching Package")).toHaveCount(4);
  await expect(panel.getByText("STALE")).toBeVisible();

  await panel.getByRole("button", { name: "Validate package_draft" }).click();
  await expect(panel.getByText("缺少可绑定的依赖", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Make package_validated available" }).click();
  await expect(panel.getByText("依赖不兼容", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Export course_package_wellness_001" }).click();
  await expect(panel.getByText("导出受限", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Retire course_package_wellness_001" }).click();
  await expect(panel.getByText("当前会话无权执行此操作", { exact: true })).toBeVisible();
  await panel.getByLabel("course package import payload").fill(JSON.stringify(adminPackage));
  await panel.getByRole("button", { name: "Import CoursePackageVersion" }).click();
  await expect(panel.getByText("导入失败：摘要不匹配", { exact: true })).toBeVisible();

  await panel.getByRole("button", { name: "Refresh CoursePackageVersions" }).click();
  await expect(panel.getByText("课程包版本状态暂时无法确认", { exact: true })).toBeVisible();
});

test("Teacher clones an exact available Course Package version without creating a Course or Run", async ({
  page
}) => {
  let calls = 0;
  const prohibitedMutations: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" &&
      /\/(courses|runs)(?:\/|$)|\/settle|\/replay/.test(request.url())
    ) {
      prohibitedMutations.push(request.url());
    }
  });
  await page.route("**/api/v1/bff/teacher/course-package-versions", async (route) => {
    calls += 1;
    if (calls === 1) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(envelope({ course_package_versions: [] }))
      });
      return;
    }
    if (calls === 2) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(envelope({ course_package_versions: [teacherPackage] }))
      });
      return;
    }
    throw new Error(`Unexpected CoursePackageVersion list request: ${route.request().url()}`);
  });
  await page.route("**/api/v1/bff/teacher/course-package-versions/clone", async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      course_package_id: "course_package_wellness_clone_001",
      description: "Teacher-owned Course Package version.",
      source_course_package_reference: teacherPackage.course_package_reference,
      title: "Teacher Wellness Package",
      version: "1.1.0"
    });
    await route.fulfill({
      contentType: "application/json",
      status: 201,
      body: JSON.stringify(envelope(clonedTeacherPackage))
    });
  });

  await page.goto(teacherBaseUrl);
  await signInTeacher(page);

  const panel = page.getByLabel("Teacher CoursePackageVersion catalog");
  await expect(panel.getByText("No available CoursePackageVersions.")).toBeVisible();
  await panel.getByRole("button", { name: "Refresh CoursePackageVersions" }).click();
  await expect(panel.getByText("Wellness Teaching Package")).toBeVisible();
  await expect(panel.getByText("usr_admin")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: /Import|Export|Validate|Retire/ })).toHaveCount(0);
  await page.setViewportSize({ height: 812, width: 375 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await panel
    .getByRole("button", {
      name: "Clone course_package_wellness_001 as a new Course Package version"
    })
    .click();
  const cloneForm = panel.getByLabel("Teacher CoursePackageVersion clone");
  await cloneForm.getByLabel("new Course Package ID").fill("course_package_wellness_clone_001");
  await cloneForm.getByLabel("new Course Package version").fill("1.1.0");
  await cloneForm.getByLabel("new Course Package title").fill("Teacher Wellness Package");
  await cloneForm
    .getByLabel("new Course Package description")
    .fill("Teacher-owned Course Package version.");
  await cloneForm.getByRole("button", { name: "Clone Course Package version" }).click();

  const receipt = panel.getByLabel("Teacher CoursePackageVersion clone receipt");
  await expect(receipt.getByText("course_package_wellness_clone_001")).toBeVisible();
  await expect(receipt.getByText("A new immutable CoursePackageVersion was created as a server-owned DRAFT.")).toBeVisible();
  await expect(receipt.getByText("No Course or Run was created.")).toBeVisible();
  expect(prohibitedMutations).toEqual([]);
});

test("Admin keeps a successful immutable export available for controlled import", async ({ page }) => {
  await page.route("**/api/v1/admin/course-package-versions", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope({ course_package_versions: [adminPackage] }))
    });
  });
  await page.route("**/api/v1/admin/course-package-versions/**", async (route) => {
    if (!route.request().url().includes("/export?")) {
      throw new Error(`Unexpected CoursePackageVersion request: ${route.request().url()}`);
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope({ course_package_version: adminPackage }))
    });
  });

  await page.goto(adminBaseUrl);
  await signInAdmin(page);

  const panel = page.getByLabel("CoursePackageVersion administration");
  await expect(panel.getByText("Wellness Teaching Package")).toBeVisible();
  await panel.getByRole("button", { name: "Export course_package_wellness_001" }).click();
  await expect(panel.getByLabel("course package export payload")).toHaveValue(
    JSON.stringify(adminPackage, null, 2)
  );
});

test("Admin ignores an earlier CoursePackageVersion response after a later session refresh", async ({
  page
}) => {
  let releaseOldResponse: (() => void) | undefined;
  const oldResponse = new Promise<void>((resolve) => {
    releaseOldResponse = resolve;
  });
  let listCalls = 0;
  const oldPackage = { ...adminPackage, title: "Old tenant package" };
  const currentPackage = { ...adminPackage, title: "Current tenant package" };

  await page.route("**/api/v1/admin/course-package-versions", async (route) => {
    listCalls += 1;
    if (listCalls === 1) {
      await oldResponse;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(envelope({ course_package_versions: [oldPackage] }))
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope({ course_package_versions: [currentPackage] }))
    });
  });

  await page.goto(adminBaseUrl);
  await signInAdmin(page);
  const login = page.getByLabel("admin login");
  await login.getByLabel("tenant").fill("tenant_other");
  await login.getByLabel("tenant").fill("tenant_demo");
  await login.getByRole("button", { name: "管理员登录" }).click();
  await expect(page.getByText("signed in", { exact: true })).toBeVisible();
  await expect(page.getByText("Current tenant package")).toBeVisible();

  releaseOldResponse?.();
  await expect(page.getByText("Old tenant package")).toHaveCount(0);
  await expect(page.getByText("Current tenant package")).toBeVisible();
});

test("Teacher ignores an earlier CoursePackageVersion response after a later session refresh", async ({
  page
}) => {
  let releaseOldResponse: (() => void) | undefined;
  const oldResponse = new Promise<void>((resolve) => {
    releaseOldResponse = resolve;
  });
  let listCalls = 0;
  const oldPackage = { ...teacherPackage, title: "Old teacher package" };
  const currentPackage = { ...teacherPackage, title: "Current teacher package" };

  await page.route("**/api/v1/bff/teacher/course-package-versions", async (route) => {
    listCalls += 1;
    if (listCalls === 1) {
      await oldResponse;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(envelope({ course_package_versions: [oldPackage] }))
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope({ course_package_versions: [currentPackage] }))
    });
  });

  await page.goto(teacherBaseUrl);
  await signInTeacher(page);
  await expect.poll(() => listCalls).toBe(1);
  const login = page.getByLabel("teacher login");
  await login.getByLabel("tenant").fill("tenant_other");
  await login.getByLabel("tenant").fill("tenant_demo");
  await login.getByRole("button", { name: "教师登录" }).click();
  await expect(
    page.getByRole("status", { name: "教师操作通知" }).getByLabel("技术兼容标签")
  ).toContainText("signed in");
  await expect(page.getByText("Current teacher package")).toBeVisible();

  releaseOldResponse?.();
  await expect(page.getByText("Old teacher package")).toHaveCount(0);
  await expect(page.getByText("Current teacher package")).toBeVisible();
});
