import { expect, test } from "@playwright/test";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const digest = "a".repeat(64);

function envelope<T>(data: T) {
  return { code: "OK", data, message: "success", request_id: "r3-browser-request" };
}

function exactRef(resourceType: string, resourceId: string, version = "1.0.0") {
  return {
    content_digest: digest,
    discriminator: "exact_ref",
    resource_id: resourceId,
    resource_type: resourceType,
    tenant_id: "tenant_demo",
    version
  };
}

function goldenStatus(role: "teacher" | "student") {
  const packageRef = exactRef("course_package_version", "pkg_r3_browser");
  const slices =
    role === "teacher"
      ? ["D1", "R7", "M1", "D2", "D3", "D4", "D5", "D6", "R3"]
      : ["D1", "R7", "M1", "D4", "D5", "D6", "R3"];
  const entries = slices.map((slice) => ({
    exact_refs: [
      exactRef(slice === "D1" ? "course_package_version" : "receipt", `receipt_${slice}`)
    ],
    slice,
    status: slice === "D4" || slice === "D5" || slice === "D6" ? "KNOWN_LIMIT" : "PASS"
  }));
  const context = {
    correlation_id: "corr_r3_browser",
    course_id: "course_demo",
    course_package_ref: packageRef,
    discriminator: "golden_journey_context",
    journey_id: "r3-course_demo-run_demo-team_demo",
    known_limits: ["JSON_INTERNAL_ONLY", "Human Validation not performed"],
    request_id: "req_r3_browser",
    role_keys: ["CEO"],
    run_id: "run_demo",
    runtime_authority: "JSON_INTERNAL_ONLY",
    schema_version: "r3-golden-journey.v1",
    status: "in_progress",
    team_id: "team_demo",
    tenant_id: "tenant_demo"
  };
  return {
    allowed_actions: {
      allowed_actions:
        role === "student"
          ? ["view_context", "view_allowed_actions", "view_receipts", "view_student_safe_report"]
          : [
              "view_context",
              "view_allowed_actions",
              "view_receipts",
              "view_provenance",
              "view_teacher_facts",
              "recover_journey",
              "abort_journey",
              "reset_journey",
              "cleanup_journey"
            ],
      blocked_reasons:
        role === "student" ? ["Teacher-only evidence and private payloads are not exposed."] : [],
      correlation_id: "corr_r3_browser",
      discriminator: "golden_journey_allowed_actions",
      journey_id: context.journey_id,
      request_id: context.request_id,
      role,
      schema_version: "r3-golden-journey.v1"
    },
    context,
    correlation_chain: {
      correlation_id: context.correlation_id,
      discriminator: "correlation_chain",
      journey_id: context.journey_id,
      request_id: context.request_id,
      schema_version: "r3-golden-journey.v1",
      status: "complete",
      steps: entries.map((entry) => ({
        correlation_id: context.correlation_id,
        exact_refs: entry.exact_refs,
        operation: `${entry.slice.toLowerCase()}.receipt.read`,
        request_id: context.request_id,
        slice: entry.slice
      }))
    },
    discriminator: "golden_journey_status",
    formal_truth_write: false,
    receipt_index: {
      chain_digest: digest,
      correlation_id: context.correlation_id,
      discriminator: "cross_slice_receipt_index",
      entries,
      journey_id: context.journey_id,
      request_id: context.request_id,
      schema_version: "r3-golden-journey.v1"
    },
    runtime_authority: "JSON_INTERNAL_ONLY",
    schema_version: "r3-golden-journey.v1",
    student_private_fields_exposed: false
  };
}

async function signIn(page: import("@playwright/test").Page, role: "teacher" | "student") {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill(role);
  await page.getByLabel("password").fill(role);
  await page.getByRole("button", { name: role === "teacher" ? "教师登录" : "学员登录" }).click();
  if (role === "teacher") {
    await expect(
      page.getByRole("status", { name: "教师操作通知" }).getByLabel("技术兼容标签")
    ).toContainText("signed in");
  } else {
    await expect(page.getByText("signed in")).toBeVisible();
  }
}

test("teacher and student can inspect the R3 Golden Journey safely", async ({ page }) => {
  await page.route("**/api/v1/bff/teacher/golden-journey/status*", (route) =>
    route.fulfill({ json: envelope(goldenStatus("teacher")) })
  );
  await page.route("**/api/v1/bff/student/golden-journey/status*", (route) =>
    route.fulfill({ json: envelope(goldenStatus("student")) })
  );
  await page.goto(teacherBaseUrl);
  await signIn(page, "teacher");

  const teacherWorkbench = page.getByTestId("teacher-golden-journey");
  await expect(teacherWorkbench).toBeVisible();
  await expect(teacherWorkbench.getByText("Golden Teaching Journey")).toBeVisible();
  await expect(teacherWorkbench.getByText("Exact CoursePackage")).toBeVisible();
  await expect(teacherWorkbench.getByLabel("Cross-slice receipts")).toBeVisible();
  await expect(teacherWorkbench.getByText("Runtime: JSON_INTERNAL_ONLY")).toBeVisible();

  await page.goto(studentBaseUrl);
  await signIn(page, "student");

  const studentWorkbench = page.getByTestId("student-golden-journey");
  await expect(studentWorkbench).toBeVisible();
  await expect(studentWorkbench.getByText("My Golden Journey")).toBeVisible();
  await expect(
    studentWorkbench.getByText("Exact selection is visible; private evidence is not.")
  ).toBeVisible();
  await expect(studentWorkbench.getByText("Teacher-only fields: hidden")).toBeVisible();
  await expect(studentWorkbench.getByText("private_payload")).toHaveCount(0);
  await expect(studentWorkbench.getByText("state_true")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});
