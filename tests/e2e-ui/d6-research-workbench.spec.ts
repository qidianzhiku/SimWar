import { expect, test } from "@playwright/test";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const ref = (id: string, type: string, fill: string) => ({
  content_digest: fill.repeat(64),
  discriminator: "exact_ref",
  resource_id: id,
  resource_type: type,
  tenant_id: "tenant_demo",
  version: "1.0.0"
});
const studyRef = ref("study_d6_browser", "transfer_study_definition_version", "a");

async function signIn(page: import("@playwright/test").Page) {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill("teacher");
  await page.getByLabel("password").fill("teacher");
  await page.getByRole("button", { name: "教师登录" }).click();
}

test("Teacher D6 workbench preserves exact refs and synthetic-only boundary", async ({ page }) => {
  await page.route("**/api/v1/bff/teacher/transfer-research-designs", async (route) => {
    await route.fulfill({
      json: {
        code: "OK",
        data: {
          known_limits: ["synthetic-only"],
          runtime_authority: "JSON_INTERNAL_ONLY",
          studies: [],
          synthetic_previews: []
        },
        message: "success",
        request_id: "d6-list"
      }
    });
  });
  await page.route("**/api/v1/bff/teacher/transfer-research-designs/preview", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.course_package_ref.resource_type).toBe("course_package_version");
    expect(body.d4_source_ref.resource_type).toBe("student_learning_report");
    expect(body.d5_source_ref.resource_type).toBe("learning_export_bundle_version");
    await route.fulfill({
      json: {
        code: "OK",
        data: {
          study: {
            lifecycle: "READY_WITH_LIMITS",
            study_ref: studyRef,
            content_digest: "a".repeat(64)
          },
          receipt: { status: "PREVIEWED" },
          synthetic_preview: {
            runtime_status: "SYNTHETIC_ONLY",
            transfer_state: "ATTEMPTED_APPLICATION"
          }
        },
        message: "success",
        request_id: "d6-preview"
      }
    });
  });
  await page.route("**/api/v1/bff/teacher/transfer-research-designs/freeze", async (route) => {
    await route.fulfill({
      json: {
        code: "OK",
        data: {
          study: { lifecycle: "FROZEN", study_ref: studyRef, content_digest: "a".repeat(64) },
          receipt: { status: "FROZEN" },
          synthetic_preview: {
            runtime_status: "SYNTHETIC_ONLY",
            transfer_state: "ATTEMPTED_APPLICATION"
          }
        },
        message: "created",
        request_id: "d6-freeze"
      }
    });
  });
  await page.goto(teacherBaseUrl);
  await signIn(page);
  const workbench = page.getByLabel("teacher D6 transfer research design workbench");
  await expect(workbench).toBeVisible();
  await expect(workbench.getByText("No frozen D6 design exists yet.")).toBeVisible();
  await workbench.getByRole("button", { name: "Preview" }).click();
  await expect(workbench.getByText("Preview ready")).toBeVisible();
  await expect(workbench.getByText("synthetic-only", { exact: true })).toBeVisible();
  await workbench.getByRole("button", { name: "Freeze synthetic design" }).click();
  await expect(workbench.getByText("Frozen", { exact: true })).toBeVisible();
  await expect(workbench.getByText("formal_transfer_claim_write=false")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});
