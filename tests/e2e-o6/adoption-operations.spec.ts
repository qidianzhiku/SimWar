import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type {
  ApiEnvelope,
  AuthSession,
  CoursePackageVersionTeacherListDto,
  EvidenceAdoptionRecord,
  ModelQualification,
  ModelQualificationCalibrationDataset,
  ModelQualificationSourcePackage,
  ModelQualificationTeacherProjection,
  Run
} from "../../packages/shared-contracts/src";
import { cleanupPlaywrightStore } from "../e2e-ui/store-isolation";

const apiBase = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const urls = {
  teacher: `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`,
  admin: `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`,
  student: `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`
};
const root = "/api/v1/bff/teacher/model-qualification";
const courseId = "course_demo";
const tenantId = "tenant_demo";

test.afterAll(() => cleanupPlaywrightStore());

async function api<T>(request: APIRequestContext, path: string, token: string, body?: unknown) {
  const response = await request.fetch(`${apiBase}${path}`, {
    method: body === undefined ? "GET" : "POST",
    ...(body === undefined ? {} : { data: body }),
    headers: {
      authorization: `Bearer ${token}`,
      "x-tenant-id": tenantId,
      "content-type": "application/json"
    }
  });
  return { status: response.status(), body: (await response.json()) as ApiEnvelope<T> };
}

async function login(request: APIRequestContext, role: "teacher" | "admin" | "student") {
  const result = await api<AuthSession>(request, "/api/v1/auth/login", "", {
    username: role,
    password: role
  });
  expect(result.status).toBe(200);
  return result.body.data.access_token;
}

async function signIn(page: Page, role: "teacher" | "admin" | "student", query: string) {
  await page.goto(`${urls[role]}${query}`);
  const panel = page.locator(`section[aria-label="${role} login"]`);
  await panel.getByLabel("tenant").fill(tenantId);
  await panel.getByLabel("username").fill(role);
  await panel.getByLabel("password").fill(role);
  await panel
    .getByRole("button", {
      name: role === "teacher" ? "教师登录" : role === "admin" ? "管理员登录" : "学员登录"
    })
    .click();
}

async function createQualification(
  request: APIRequestContext,
  token: string,
  model: ModelQualificationTeacherProjection["model_catalog"][number],
  suffix: "a" | "b"
) {
  const source = await api<{ source_package: ModelQualificationSourcePackage }>(
    request,
    `${root}/source-packages`,
    token,
    {
      course_id: courseId,
      title: `O6 synthetic epoch ${suffix}`,
      source_ref: `fixture://o6/${suffix}`,
      source_version: suffix === "a" ? "1.0.0" : "2.0.0",
      content_digest: suffix.repeat(64),
      evidence_refs: [`fixture:o6:${suffix}`],
      feature_schema_digest: "f".repeat(64),
      observed_at: new Date(Date.now() - 60_000).toISOString(),
      expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      freshness_status: "FRESH",
      rights_status: "VALID",
      quality: { conflict_count: 0, missingness_rate: 0, record_count: 8 }
    }
  );
  expect(source.status, JSON.stringify(source.body)).toBe(201);
  const dataset = await api<{ calibration_dataset: ModelQualificationCalibrationDataset }>(
    request,
    `${root}/datasets`,
    token,
    {
      course_id: courseId,
      source_package_id: source.body.data.source_package.source_package_id,
      calibration_record_ids: [`calibration-${suffix}`],
      holdout_record_ids: [`holdout-${suffix}`],
      content_digest: suffix === "a" ? "c".repeat(64) : "d".repeat(64)
    }
  );
  expect(dataset.status).toBe(201);
  const qualified = await api<{ qualification: ModelQualification }>(
    request,
    `${root}/qualifications`,
    token,
    {
      course_id: courseId,
      source_package_id: source.body.data.source_package.source_package_id,
      calibration_dataset_id: dataset.body.data.calibration_dataset.calibration_dataset_id,
      model_version_reference: model.model_version_reference,
      deterministic_seed: suffix === "a" ? 41 : 42
    }
  );
  expect(qualified.status).toBe(201);
  const qualificationId = qualified.body.data.qualification.qualification_id;
  expect(
    (
      await api(
        request,
        `${root}/qualifications/${qualificationId}/review?courseId=${courseId}`,
        token,
        {
          decision: "APPROVED",
          note: "O6 exact evidence reviewed"
        }
      )
    ).status
  ).toBe(200);
  const bound = await api<{ qualification: ModelQualification }>(
    request,
    `${root}/qualifications/${qualificationId}/bind?courseId=${courseId}`,
    token,
    {}
  );
  expect(bound.status).toBe(200);
  return bound.body.data.qualification;
}

async function adopt(
  request: APIRequestContext,
  token: string,
  qualification: ModelQualification,
  suffix: string,
  predecessor: { adoption_id: string; adoption_digest: string } | null
) {
  const proposal = await api<{ proposal: { proposal_id: string; proposal_digest: string } }>(
    request,
    `${root}/evidence-adoptions/request`,
    token,
    {
      course_id: courseId,
      command_id: `o6-browser-${suffix}-request`,
      qualification_id: qualification.qualification_id,
      expected_adoption: predecessor
    }
  );
  expect(proposal.status).toBe(200);
  const exactProposal = proposal.body.data.proposal;
  expect(
    (
      await api(request, `${root}/evidence-adoptions/review`, token, {
        course_id: courseId,
        command_id: `o6-browser-${suffix}-review`,
        proposal_id: exactProposal.proposal_id,
        proposal_digest: exactProposal.proposal_digest,
        decision: "APPROVED",
        note: "O6 exact adoption review"
      })
    ).status
  ).toBe(200);
  const adopted = await api<{ adoption: EvidenceAdoptionRecord }>(
    request,
    `${root}/evidence-adoptions/disposition`,
    token,
    {
      course_id: courseId,
      command_id: `o6-browser-${suffix}-disposition`,
      proposal_id: exactProposal.proposal_id,
      proposal_digest: exactProposal.proposal_digest,
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
      expires_at: null,
      note: "O6 exact future-admission adoption"
    }
  );
  expect(adopted.status).toBe(200);
  return adopted.body.data.adoption;
}

test("real-BFF adoption health and exact predecessor rollback dry-run remain non-writing", async ({
  page,
  request
}, testInfo) => {
  const teacher = await login(request, "teacher");
  await login(request, "admin");
  await login(request, "student");
  expect((await api(request, `/api/v1/courses/${courseId}/publish`, teacher, {})).status).toBe(200);
  const projection = await api<ModelQualificationTeacherProjection>(
    request,
    `${root}?courseId=${courseId}`,
    teacher
  );
  const model = projection.body.data.model_catalog[0]!;
  const qualificationA = await createQualification(request, teacher, model, "a");
  const qualificationB = await createQualification(request, teacher, model, "b");
  const adoptedA = await adopt(request, teacher, qualificationA, "a", null);
  const refA = { adoption_id: adoptedA.adoption_id, adoption_digest: adoptedA.adoption_digest };
  const adoptedB = await adopt(request, teacher, qualificationB, "b", refA);
  const packageResult = await api<CoursePackageVersionTeacherListDto>(
    request,
    "/api/v1/bff/teacher/course-package-versions",
    teacher
  );
  expect(packageResult.status).toBe(200);
  const coursePackage = packageResult.body.data.course_package_versions.find(
    (candidate) => candidate.course_package_reference.course_package_id === "package_o5"
  )!;
  expect(coursePackage).toBeDefined();
  const run = await api<{ run: Run }>(request, `/api/v1/courses/${courseId}/runs`, teacher, {
    formal_runtime_binding: {
      engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
      parameter_set_reference: coursePackage.parameter_set_reference,
      scenario_package_reference: coursePackage.scenario_package_reference,
      seed: 42
    },
    qualified_run_admission: {
      course_id: courseId,
      course_package_reference: coursePackage.course_package_reference,
      source_package_id: qualificationB.source_package_id,
      calibration_dataset_id: qualificationB.calibration_dataset_id,
      qualification_id: qualificationB.qualification_id,
      model_version_reference: qualificationB.model_version_reference,
      model_artifact_reference: qualificationB.artifact,
      adoption: {
        adoption_id: adoptedB.adoption_id,
        adoption_digest: adoptedB.adoption_digest
      }
    }
  });
  expect(run.status, JSON.stringify(run.body)).toBe(201);
  const before = await api<ModelQualificationTeacherProjection>(
    request,
    `${root}?courseId=${courseId}`,
    teacher
  );

  await signIn(page, "teacher", `?courseId=${courseId}`);
  const teacherPanel = page.getByRole("region", {
    name: "governed multi-epoch evidence adoption"
  });
  await expect(teacherPanel).toBeVisible();
  await expect(teacherPanel.getByTestId("adoption-operations-health")).toContainText(
    "health=HEALTHY"
  );
  await expect(page.getByRole("button", { name: "Apply", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Automatic Rollback", exact: true })).toHaveCount(
    0
  );
  const assess = teacherPanel.getByTestId("assess-adoption-drift");
  await assess.focus();
  await page.keyboard.press("Tab");
  await expect(teacherPanel.getByTestId("preview-adoption-rollback")).toBeFocused();
  await assess.click();
  await expect(teacherPanel.getByRole("status")).toContainText("健康评估完成");
  await teacherPanel.getByTestId("preview-adoption-rollback").click();
  await expect(teacherPanel.getByTestId("rollback-dry-run-receipt")).toContainText(
    "READY_WITH_LIMITS"
  );
  await expect(teacherPanel.getByTestId("rollback-dry-run-receipt")).toContainText(
    '"rollback_applied": false'
  );
  await expect(teacherPanel.getByTestId("rollback-dry-run-receipt")).toContainText(
    adoptedA.adoption_id
  );

  for (const width of [1440, 1280, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await teacherPanel.scrollIntoViewIfNeeded();
    const size = await teacherPanel.evaluate((element) => ({
      scroll: element.scrollWidth,
      client: element.clientWidth
    }));
    expect(size.scroll, `O6 panel overflow at ${width}`).toBeLessThanOrEqual(size.client + 1);
    await teacherPanel.screenshot({ path: testInfo.outputPath(`teacher-o6-${width}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    document.body.style.zoom = "2";
  });
  const zoomSize = await teacherPanel.evaluate((element) => ({
    scroll: element.scrollWidth,
    client: element.clientWidth
  }));
  expect(zoomSize.scroll).toBeLessThanOrEqual(zoomSize.client + 1);
  await page.evaluate(() => {
    document.body.style.zoom = "1";
  });
  const axe = await new AxeBuilder({ page })
    .include('[aria-label="adoption drift operations and rollback dry run"]')
    .analyze();
  expect(
    axe.violations.filter((item) => ["critical", "serious"].includes(item.impact ?? ""))
  ).toEqual([]);

  const after = await api<ModelQualificationTeacherProjection>(
    request,
    `${root}?courseId=${courseId}`,
    teacher
  );
  expect(after.body.data.evidence_adoption).toEqual(before.body.data.evidence_adoption);

  await signIn(page, "admin", `?courseId=${courseId}`);
  const adminPanel = page.getByRole("region", { name: "governed multi-epoch evidence adoption" });
  await expect(adminPanel.getByTestId("adoption-operations-health")).toContainText("HEALTHY");
  await adminPanel.getByTestId("preview-adoption-rollback").click();
  await expect(adminPanel.getByTestId("rollback-dry-run-receipt")).toContainText(
    "READY_WITH_LIMITS"
  );

  await signIn(
    page,
    "student",
    `?courseId=${courseId}&modelQualificationId=${qualificationB.qualification_id}`
  );
  const studentPanel = page.getByRole("region", {
    name: "student role-safe model qualification explanation"
  });
  await expect(studentPanel.getByTestId("student-adoption-operations-status")).toContainText(
    "applicability=HEALTHY"
  );
  await expect(studentPanel).toContainText("rollback_applied=false");
  await expect(studentPanel).not.toContainText(adoptedB.adoption_digest);
  await expect(studentPanel).not.toContainText(adoptedA.adoption_id);

  await testInfo.attach("o6-product-receipt", {
    contentType: "application/json",
    body: Buffer.from(
      JSON.stringify(
        {
          target_route_mocks: 0,
          teacher_health: "HEALTHY",
          rollback_status: "READY_WITH_LIMITS",
          rollback_applied: false,
          adoption_mutation: false,
          official_truth_write: false,
          history_deleted: false,
          historical_receipt_rewritten: false,
          provider: "OFF",
          axe_serious_critical: 0,
          viewport_widths: [1440, 1280, 1024, 390],
          zoom: "200%",
          reduced_motion: true
        },
        null,
        2
      )
    )
  });
});
