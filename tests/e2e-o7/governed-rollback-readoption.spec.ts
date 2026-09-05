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
  ModelQualificationRollbackOutcomeResolution,
  ModelQualificationRollbackOutcomeStudentSummary,
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
      title: `O7 synthetic epoch ${suffix}`,
      source_ref: `fixture://o7/${suffix}`,
      source_version: suffix === "a" ? "1.0.0" : "2.0.0",
      content_digest: suffix.repeat(64),
      evidence_refs: [`fixture:o7:${suffix}`],
      feature_schema_digest: "f".repeat(64),
      observed_at: new Date(Date.now() - 60_000).toISOString(),
      expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      freshness_status: "FRESH",
      rights_status: "VALID",
      quality: { conflict_count: 0, missingness_rate: 0, record_count: 8 }
    }
  );
  expect(source.status).toBe(201);
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
      deterministic_seed: suffix === "a" ? 71 : 72
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
        { decision: "APPROVED", note: "O7 exact evidence reviewed" }
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
      command_id: `o7-browser-${suffix}-request`,
      qualification_id: qualification.qualification_id,
      expected_adoption: predecessor
    }
  );
  expect(proposal.status).toBe(200);
  const exact = proposal.body.data.proposal;
  expect(
    (
      await api(request, `${root}/evidence-adoptions/review`, token, {
        course_id: courseId,
        command_id: `o7-browser-${suffix}-review`,
        proposal_id: exact.proposal_id,
        proposal_digest: exact.proposal_digest,
        decision: "APPROVED",
        note: "O7 exact adoption review"
      })
    ).status
  ).toBe(200);
  const disposition = await api<{ adoption: EvidenceAdoptionRecord }>(
    request,
    `${root}/evidence-adoptions/disposition`,
    token,
    {
      course_id: courseId,
      command_id: `o7-browser-${suffix}-disposition`,
      proposal_id: exact.proposal_id,
      proposal_digest: exact.proposal_digest,
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
      expires_at: null,
      note: "O7 exact future-admission adoption"
    }
  );
  expect(disposition.status).toBe(200);
  return disposition.body.data.adoption;
}

test("real-BFF B to governed request and explicit C re-adoption preserves A/B history", async ({
  page,
  request
}, testInfo) => {
  const teacher = await login(request, "teacher");
  await login(request, "admin");
  await login(request, "student");
  expect((await api(request, `/api/v1/courses/${courseId}/publish`, teacher, {})).status).toBe(200);
  const initial = await api<ModelQualificationTeacherProjection>(
    request,
    `${root}?courseId=${courseId}`,
    teacher
  );
  const qualificationA = await createQualification(
    request,
    teacher,
    initial.body.data.model_catalog[0]!,
    "a"
  );
  const qualificationB = await createQualification(
    request,
    teacher,
    initial.body.data.model_catalog[0]!,
    "b"
  );
  const adoptedA = await adopt(request, teacher, qualificationA, "a", null);
  const refA = { adoption_id: adoptedA.adoption_id, adoption_digest: adoptedA.adoption_digest };
  const adoptedB = await adopt(request, teacher, qualificationB, "b", refA);
  const refB = { adoption_id: adoptedB.adoption_id, adoption_digest: adoptedB.adoption_digest };

  await signIn(page, "teacher", `?courseId=${courseId}`);
  const teacherPanel = page.getByRole("region", { name: "governed multi-epoch evidence adoption" });
  await expect(teacherPanel).toBeVisible();
  await teacherPanel.getByTestId("preview-adoption-rollback").click();
  await expect(teacherPanel.getByTestId("rollback-dry-run-receipt")).toContainText(
    "READY_WITH_LIMITS"
  );
  await teacherPanel.getByLabel("采用决策理由").fill("Governed re-adoption request for exact A.");
  await teacherPanel.getByTestId("create-governed-rollback-request").click();
  const requestReceipt = teacherPanel.getByTestId("governed-rollback-request-receipt");
  await expect(requestReceipt).toContainText("LINKED_PROPOSAL_PENDING_REVIEW");
  await expect(requestReceipt).toContainText(adoptedA.adoption_id);
  await expect(requestReceipt).toContainText(adoptedB.adoption_id);
  await expect(teacherPanel).toContainText("请求 != 应用");

  const pending = await api<ModelQualificationTeacherProjection>(
    request,
    `${root}?courseId=${courseId}`,
    teacher
  );
  expect(pending.body.data.evidence_adoption?.selections[0]).toMatchObject(refB);
  const governed = pending.body.data.governed_rollback_requests?.[0];
  expect(governed).toBeDefined();
  expect(governed?.rollback_applied).toBe(false);
  expect(governed?.current_selection_changed).toBe(false);

  const pendingOutcome = await api<ModelQualificationRollbackOutcomeResolution>(
    request,
    `${root}/evidence-adoptions/rollback-requests/${governed!.rollback_request_id}/outcome?courseId=${courseId}`,
    teacher
  );
  expect(pendingOutcome.status).toBe(200);
  expect(pendingOutcome.body.data).toMatchObject({
    outcome_status: "PENDING_REVIEW",
    immutable_request_status: "LINKED_PROPOSAL_PENDING_REVIEW",
    rollback_request_id: governed!.rollback_request_id,
    historical_consistency: "CONSISTENT",
    current_effect: "CURRENT",
    rollback_applied: false,
    official_truth_write: false,
    visibility: "TEACHER_ADMIN_DETAIL"
  });
  await expect(teacherPanel.getByTestId("rollback-outcome-timeline")).toContainText(
    "PENDING_REVIEW"
  );

  for (const width of [1440, 1280, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await teacherPanel.scrollIntoViewIfNeeded();
    const size = await teacherPanel.evaluate((element) => ({
      scroll: element.scrollWidth,
      client: element.clientWidth
    }));
    expect(size.scroll, `O7 panel overflow at ${width}`).toBeLessThanOrEqual(size.client + 1);
    await teacherPanel.screenshot({ path: testInfo.outputPath(`teacher-o7-${width}.png`) });
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

  await signIn(page, "admin", `?courseId=${courseId}`);
  const adminPanel = page.getByRole("region", { name: "governed multi-epoch evidence adoption" });
  await expect(adminPanel.getByTestId("governed-rollback-request-history")).toContainText(
    governed!.rollback_request_id
  );
  await adminPanel.getByLabel("采用候选").selectOption(governed!.linked_proposal.proposal_id);
  await adminPanel.getByLabel("采用决策理由").fill("Explicit Admin review and re-adoption.");
  await adminPanel.getByRole("button", { name: "批准候选复核（不采用）" }).click();
  await expect(adminPanel.getByRole("status")).toContainText("命令已完成");
  await adminPanel.getByRole("button", { name: "明确采用到未来准入" }).click();
  await expect(adminPanel.getByRole("status")).toContainText("命令已完成");

  const final = await api<ModelQualificationTeacherProjection>(
    request,
    `${root}?courseId=${courseId}`,
    teacher
  );
  const records = final.body.data.evidence_adoption!.records;
  const adoptedC = records.find(
    (record) =>
      record.adoption_id !== adoptedA.adoption_id && record.adoption_id !== adoptedB.adoption_id
  )!;
  expect(adoptedC).toBeDefined();
  expect(adoptedC.predecessor).toEqual(refB);
  expect(adoptedC.epoch).toEqual(adoptedA.epoch);
  expect(final.body.data.evidence_adoption?.selections[0]).toMatchObject({
    adoption_id: adoptedC.adoption_id,
    adoption_digest: adoptedC.adoption_digest
  });
  expect(records.find((record) => record.adoption_id === adoptedA.adoption_id)).toEqual(adoptedA);
  expect(records.find((record) => record.adoption_id === adoptedB.adoption_id)).toEqual(adoptedB);

  const readoptedOutcome = await api<ModelQualificationRollbackOutcomeResolution>(
    request,
    `${root}/evidence-adoptions/rollback-requests/${governed!.rollback_request_id}/outcome?courseId=${courseId}`,
    teacher
  );
  expect(readoptedOutcome.status).toBe(200);
  expect(readoptedOutcome.body.data).toMatchObject({
    outcome_status: "READOPTED_FOR_FUTURE_ADMISSION",
    immutable_request_status: "LINKED_PROPOSAL_PENDING_REVIEW",
    resulting_adoption: {
      adoption_id: adoptedC.adoption_id,
      adoption_digest: adoptedC.adoption_digest
    },
    current_effect: "CURRENT",
    rollback_applied: false,
    adoption_mutation: false,
    historical_receipt_rewritten: false
  });

  const studentOutcomes = await api<readonly ModelQualificationRollbackOutcomeStudentSummary[]>(
    request,
    "/api/v1/bff/student/model-qualification/evidence-adoptions/rollback-outcomes?courseId=" +
      courseId,
    await login(request, "student")
  );
  expect(studentOutcomes.status).toBe(200);
  expect(studentOutcomes.body.data).toHaveLength(1);
  expect(studentOutcomes.body.data[0]).toMatchObject({
    applicability: "CURRENT",
    visibility: "ROLE_SAFE_STUDENT",
    provider: "OFF",
    rollback_applied: false,
    official_truth_write: false
  });
  expect(JSON.stringify(studentOutcomes.body.data)).not.toContain(governed!.rollback_request_id);
  expect(JSON.stringify(studentOutcomes.body.data)).not.toContain(adoptedC.adoption_id);

  const packageResult = await api<CoursePackageVersionTeacherListDto>(
    request,
    "/api/v1/bff/teacher/course-package-versions",
    teacher
  );
  expect(packageResult.status).toBe(200);
  const coursePackage = packageResult.body.data.course_package_versions.find(
    (candidate) => candidate.course_package_reference.course_package_id === "package_o5"
  );
  expect(coursePackage).toBeDefined();
  const futureRun = await api<{ run: Run }>(request, `/api/v1/courses/${courseId}/runs`, teacher, {
    formal_runtime_binding: {
      engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
      parameter_set_reference: coursePackage!.parameter_set_reference,
      scenario_package_reference: coursePackage!.scenario_package_reference,
      seed: 73
    },
    qualified_run_admission: {
      course_id: courseId,
      course_package_reference: coursePackage!.course_package_reference,
      source_package_id: qualificationA.source_package_id,
      calibration_dataset_id: qualificationA.calibration_dataset_id,
      qualification_id: qualificationA.qualification_id,
      model_version_reference: qualificationA.model_version_reference,
      model_artifact_reference: qualificationA.artifact,
      adoption: {
        adoption_id: adoptedC.adoption_id,
        adoption_digest: adoptedC.adoption_digest
      }
    }
  });
  expect(futureRun.status, JSON.stringify(futureRun.body)).toBe(201);

  await signIn(
    page,
    "student",
    `?courseId=${courseId}&modelQualificationId=${qualificationA.qualification_id}`
  );
  await expect
    .poll(() =>
      page.evaluate(() => new URLSearchParams(location.search).get("modelQualificationId"))
    )
    .toBe(qualificationA.qualification_id);
  const studentPanel = page.getByRole("region", {
    name: "student role-safe model qualification explanation"
  });
  await expect(studentPanel).toContainText("rollback_applied=false");
  await expect(page.getByTestId("create-governed-rollback-request")).toHaveCount(0);
  await expect(studentPanel).not.toContainText(governed!.rollback_request_id);
  await expect(studentPanel).not.toContainText(adoptedC.adoption_digest);

  await testInfo.attach("o7-product-receipt", {
    contentType: "application/json",
    body: Buffer.from(
      JSON.stringify(
        {
          target_route_mocks: 0,
          initial_adoption: refB,
          rollback_request_id: governed!.rollback_request_id,
          linked_proposal_id: governed!.linked_proposal.proposal_id,
          readoption: {
            adoption_id: adoptedC.adoption_id,
            predecessor: refB,
            epoch: "A"
          },
          historical_receipt_rewritten: false,
          rollback_applied: false,
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
