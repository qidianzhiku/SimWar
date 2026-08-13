import { expect, test } from "@playwright/test";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;

function session(status: string, evidence_bundle?: unknown) {
  return {
    schema_version: "validation-session.v1",
    session_id: "vsession_w023_browser",
    execution_mode: "SYNTHETIC_REHEARSAL",
    source_product_merge_sha: "31b8c5f5cd3ab0426bb02bc75495b8552e497c48",
    tenant_id: "tenant_demo",
    course_id: "course_demo",
    run_id: "run_w023_browser",
    machine_admission_reference: "w022-browser-admission",
    machine_admission_digest: "a".repeat(64),
    idempotency_key: "w023-browser",
    status,
    created_by: "usr_teacher",
    created_at: "2026-08-12T07:00:00.000Z",
    participants: [],
    transitions: [],
    observations: [],
    incidents: [],
    ...(evidence_bundle ? { evidence_bundle } : {})
  };
}

test("Teacher can rehearse the bounded W023 session-control journey", async ({ page }) => {
  await page.route("**/api/v1/bff/teacher/validation-sessions**", async (route) => {
    const url = new URL(route.request().url());
    const action = url.pathname.split("/").at(-1);
    let data = session("DRAFT");
    if (action === "roster") data = { ...session("DRAFT"), participants: [{ participant_id: "teacher-synthetic", session_duty: "TEACHER" }] };
    if (action === "preflight") data = { ...session("PREFLIGHT_READY"), preflight: { status: "PREFLIGHT_READY", reasons: [] } };
    if (action === "start") data = session("LIVE");
    if (action === "observations") data = { ...session("LIVE"), observations: [{ participant_id: "observer-synthetic", narrative: "bounded synthetic observation" }] };
    if (action === "close") {
      data = {
        ...session("CLOSED"),
        cleanup_receipt: { cleanup_id: "cleanup_vsession_w023_browser", status: "COMPLETED" },
        evidence_bundle: {
          evidence_digest: "b".repeat(64),
          human_validation: "NOT_PERFORMED",
          teaching_effectiveness: "NOT_PROVEN",
          real_human_attestation: "NOT_PROVEN",
          markdown_report: "# Synthetic W023 session\n\nNo human validation was performed."
        }
      };
    }
    await route.fulfill({ json: { code: "OK", data, message: "success", request_id: "w023-browser" } });
  });

  await page.goto(teacherBaseUrl);
  const login = page.getByLabel("teacher login");
  await login.getByLabel("tenant").fill("tenant_demo");
  await login.getByLabel("username").fill("teacher");
  await login.getByLabel("password").fill("teacher");
  await login.getByRole("button", { name: "教师登录" }).click();
  await expect(
    page.getByRole("status", { name: "教师操作通知" }).getByLabel("技术兼容标签")
  ).toContainText("signed in");

  const workbench = page.getByLabel("W023 Validation Session Control Plane");
  await expect(workbench).toBeVisible();
  await workbench.getByLabel("Machine admission digest").fill("a".repeat(64));
  const createSession = workbench.getByRole("button", { name: "Create synthetic session" });
  if (await createSession.isDisabled()) {
    const createRun = page.getByLabel("当前权限边界").getByRole("button", { name: "创建 Run" });
    await expect(createRun).toBeEnabled();
    await createRun.click();
  }
  await expect(createSession).toBeEnabled();
  await createSession.click();
  await workbench.getByRole("button", { name: "Set synthetic roster" }).click();
  await workbench.getByRole("button", { name: "Run preflight" }).click();
  await expect(workbench.getByText(/Preflight: PREFLIGHT_READY/)).toBeVisible();
  await workbench.getByRole("button", { name: "Start LIVE" }).click();
  await expect(workbench.getByText("LIVE", { exact: true })).toBeVisible();
  await workbench.getByLabel("Bounded observation narrative").fill("bounded synthetic observation");
  await workbench.getByRole("button", { name: "Capture observation" }).click();
  await workbench.getByRole("button", { name: "Close and export evidence" }).click();
  await expect(workbench.getByText("Canonical evidence sealed")).toBeVisible();
  await expect(workbench.getByText("HUMAN_VALIDATION_NOT_PERFORMED")).toBeVisible();
  await expect(workbench.getByText("state_true")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
