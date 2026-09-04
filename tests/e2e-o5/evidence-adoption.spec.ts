import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type {
  ApiEnvelope,
  AuthSession,
  CoursePackageVersionTeacherListDto,
  EvidenceAdoptionRecord,
  EvidenceAdoptionState,
  ModelQualificationTeacherProjection,
  ModelQualification,
  ModelQualificationSourcePackage,
  ModelQualificationCalibrationDataset,
  QualifiedRunAdmissionSnapshot,
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
const course_id = "course_demo",
  tenant = "tenant_demo";
test.afterAll(() => cleanupPlaywrightStore());

async function api<T>(
  request: APIRequestContext,
  path: string,
  token: string,
  body?: unknown,
  tenantId = tenant
) {
  const response = await request.fetch(`${apiBase}${path}`, {
    method: body === undefined ? "GET" : "POST",
    ...(body === undefined ? {} : { data: body }),
    headers: {
      authorization: `Bearer ${token}`,
      "x-tenant-id": tenantId,
      "content-type": "application/json"
    }
  });
  return { status: response.status(), data: (await response.json()) as ApiEnvelope<T> };
}
async function login(request: APIRequestContext, role: "teacher" | "admin" | "student") {
  const result = await api<AuthSession>(request, "/api/v1/auth/login", "", {
    username: role,
    password: role
  });
  expect(result.status).toBe(200);
  return result.data.data.access_token;
}
async function signIn(page: Page, role: "teacher" | "admin" | "student", query: string) {
  await page.goto(`${urls[role]}${query}`);
  const panel = page.locator(`section[aria-label="${role} login"]`);
  await panel.getByLabel("tenant").fill(tenant);
  await panel.getByLabel("username").fill(role);
  await panel.getByLabel("password").fill(role);
  await panel
    .getByRole("button", {
      name: role === "teacher" ? "教师登录" : role === "admin" ? "管理员登录" : "学员登录"
    })
    .click();
}

test("explicit A/B adoption, real Run admission, retained history and role-safe consumers", async ({
  page,
  request
}, testInfo) => {
  const teacher = await login(request, "teacher"),
    admin = await login(request, "admin"),
    student = await login(request, "student");
  const published = await api(request, `/api/v1/courses/${course_id}/publish`, teacher, {});
  expect(published.status, JSON.stringify(published.data)).toBe(200);
  const projection = await api<ModelQualificationTeacherProjection>(
    request,
    `${root}?courseId=${course_id}`,
    teacher
  );
  expect(projection.status).toBe(200);
  const model = projection.data.data.model_catalog.find(
    (m) =>
      m.model_version_reference.model_version_id === "toy_logit_wellness_v2" &&
      m.model_version_reference.version === "2.0.0"
  )!;
  expect(model).toBeDefined();
  const seeded: ModelQualification[] = [];
  for (const letter of ["a", "b"]) {
    const source = await api<{ source_package: ModelQualificationSourcePackage }>(
      request,
      `${root}/source-packages`,
      teacher,
      {
        course_id,
        title: `Synthetic epoch ${letter}`,
        source_ref: `fixture://o5/${letter}`,
        source_version: letter === "a" ? "1.0.0" : "2.0.0",
        content_digest: letter.repeat(64),
        evidence_refs: [`fixture:o5:${letter}`],
        feature_schema_digest: "f".repeat(64),
        observed_at: new Date(Date.now() - 60_000).toISOString(),
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        freshness_status: "FRESH",
        rights_status: "VALID",
        quality: { conflict_count: 0, missingness_rate: 0, record_count: 4 }
      }
    );
    expect(source.status, JSON.stringify(source.data)).toBe(201);
    const dataset = await api<{ calibration_dataset: ModelQualificationCalibrationDataset }>(
      request,
      `${root}/datasets`,
      teacher,
      {
        course_id,
        source_package_id: source.data.data.source_package.source_package_id,
        calibration_record_ids: [`calibration-${letter}`],
        holdout_record_ids: [`holdout-${letter}`],
        content_digest: letter === "a" ? "c".repeat(64) : "d".repeat(64)
      }
    );
    expect(dataset.status).toBe(201);
    const qualified = await api<{ qualification: ModelQualification }>(
      request,
      `${root}/qualifications`,
      teacher,
      {
        course_id,
        source_package_id: source.data.data.source_package.source_package_id,
        calibration_dataset_id: dataset.data.data.calibration_dataset.calibration_dataset_id,
        model_version_reference: model.model_version_reference,
        deterministic_seed: 42
      }
    );
    expect(qualified.status).toBe(201);
    const id = qualified.data.data.qualification.qualification_id;
    expect(
      (
        await api(request, `${root}/qualifications/${id}/review?courseId=${course_id}`, teacher, {
          decision: "APPROVED",
          note: "Exact synthetic epoch reviewed"
        })
      ).status
    ).toBe(200);
    const bound = await api<{ qualification: ModelQualification }>(
      request,
      `${root}/qualifications/${id}/bind?courseId=${course_id}`,
      teacher,
      {}
    );
    expect(bound.status).toBe(200);
    seeded.push(bound.data.data.qualification);
  }
  const qualificationA = seeded[0]!,
    qualificationB = seeded[1]!;
  const packageResult = await api<CoursePackageVersionTeacherListDto>(
    request,
    "/api/v1/bff/teacher/course-package-versions",
    teacher
  );
  expect(packageResult.status, JSON.stringify(packageResult.data)).toBe(200);
  const coursePackage = packageResult.data.data.course_package_versions.find(
    (p) => p.course_package_reference.course_package_id === "package_o5"
  )!;
  expect(coursePackage).toBeDefined();
  const formal = {
    engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
    parameter_set_reference: coursePackage.parameter_set_reference,
    scenario_package_reference: coursePackage.scenario_package_reference,
    seed: 42
  };
  const admission = (q: ModelQualification, adopted: EvidenceAdoptionRecord) => ({
    course_id,
    course_package_reference: coursePackage.course_package_reference,
    source_package_id: q.source_package_id,
    calibration_dataset_id: q.calibration_dataset_id,
    qualification_id: q.qualification_id,
    model_version_reference: q.model_version_reference,
    model_artifact_reference: q.artifact,
    adoption: { adoption_id: adopted.adoption_id, adoption_digest: adopted.adoption_digest }
  });
  await signIn(page, "teacher", `?courseId=${course_id}`);
  let panel = page.getByRole("region", { name: "governed multi-epoch evidence adoption" });
  await expect(panel).toBeVisible();
  const uiAdopt = async (qualification: ModelQualification) => {
    await panel
      .getByLabel("待采用的 exact Qualification", { exact: true })
      .selectOption(qualification.qualification_id);
    await panel.getByTestId("request-evidence-adoption").click();
    await expect(panel.getByTestId("adoption-proposal-inspector")).toContainText(
      qualification.qualification_id
    );
    await panel
      .getByLabel("采用决策理由", { exact: true })
      .fill("Exact epoch review and explicit future admission; no truth mutation");
    await panel.getByRole("button", { name: "批准候选复核（不采用）", exact: true }).click();
    await expect(
      panel.getByRole("button", { name: "明确采用到未来准入", exact: true })
    ).toBeEnabled();
    await panel.getByRole("button", { name: "明确采用到未来准入", exact: true }).click();
    await expect(panel.getByRole("status")).toContainText("命令已完成");
    const state = (
      await api<ModelQualificationTeacherProjection>(
        request,
        `${root}?courseId=${course_id}`,
        teacher
      )
    ).data.data.evidence_adoption!;
    const selectedId = JSON.parse(
      await panel.getByTestId("future-admission-selection").innerText()
    )[0].adoption_id;
    return state.records.find((r) => r.adoption_id === selectedId)!;
  };
  const a = await uiAdopt(qualificationA);
  expect(a.epoch.qualification_id).toBe(qualificationA.qualification_id);
  const runA = await api<{ run: Run }>(request, `/api/v1/courses/${course_id}/runs`, teacher, {
    formal_runtime_binding: formal,
    qualified_run_admission: admission(qualificationA, a)
  });
  expect(runA.status, JSON.stringify(runA.data)).toBe(201);
  const historicalAPath = `${root}/run-admissions/${runA.data.data.run.run_id}?courseId=${course_id}`;
  const beforeA = await api<QualifiedRunAdmissionSnapshot>(request, historicalAPath, teacher);
  expect(beforeA.status).toBe(200);
  const current = { adoption_id: a.adoption_id, adoption_digest: a.adoption_digest };
  for (const disposition of [
    "DEFERRED_WITH_EXPIRY",
    "REJECTED_CANDIDATE",
    "REBASE_REQUIRED"
  ] as const) {
    const requestBody = {
      course_id,
      command_id: `browser-${disposition}-request`,
      qualification_id: qualificationB.qualification_id,
      expected_adoption: current
    };
    const proposed = await api<{
      proposal: EvidenceAdoptionState["proposals"][number];
      reused: boolean;
    }>(request, `${root}/evidence-adoptions/request`, teacher, requestBody);
    expect(proposed.status).toBe(200);
    const p = proposed.data.data.proposal;
    const retried = await api<{ reused: boolean }>(
      request,
      `${root}/evidence-adoptions/request`,
      teacher,
      requestBody
    );
    expect(retried.data.data.reused).toBe(true);
    const conflicting = await api(request, `${root}/evidence-adoptions/request`, teacher, {
      ...requestBody,
      qualification_id: qualificationA.qualification_id
    });
    expect(conflicting.status).toBe(409);
    expect(
      (
        await api(request, `${root}/evidence-adoptions/review`, teacher, {
          course_id,
          command_id: `browser-${disposition}-review`,
          proposal_id: p.proposal_id,
          proposal_digest: p.proposal_digest,
          decision: "APPROVED",
          note: "Separate review only"
        })
      ).status
    ).toBe(200);
    expect(
      (
        await api(request, `${root}/evidence-adoptions/disposition`, teacher, {
          course_id,
          command_id: `browser-${disposition}-dispose`,
          proposal_id: p.proposal_id,
          proposal_digest: p.proposal_digest,
          disposition,
          expires_at:
            disposition === "DEFERRED_WITH_EXPIRY"
              ? new Date(Date.now() + 3600_000).toISOString()
              : null,
          note: "Retain prior adoption"
        })
      ).status
    ).toBe(200);
    const state = (
      await api<ModelQualificationTeacherProjection>(
        request,
        `${root}?courseId=${course_id}`,
        teacher
      )
    ).data.data.evidence_adoption!;
    expect(state.selections[0]!.adoption_id).toBe(a.adoption_id);
  }
  await signIn(page, "teacher", `?courseId=${course_id}`);
  panel = page.getByRole("region", { name: "governed multi-epoch evidence adoption" });
  const b = await uiAdopt(qualificationB);
  expect(b.adoption_id).not.toBe(a.adoption_id);
  const stale = await api(request, `/api/v1/courses/${course_id}/runs`, teacher, {
    formal_runtime_binding: formal,
    qualified_run_admission: admission(qualificationA, a)
  });
  expect(stale.status).toBe(422);
  const runB = await api<{ run: Run }>(request, `/api/v1/courses/${course_id}/runs`, teacher, {
    formal_runtime_binding: formal,
    qualified_run_admission: admission(qualificationB, b)
  });
  expect(runB.status, JSON.stringify(runB.data)).toBe(201);
  expect(
    (await api<QualifiedRunAdmissionSnapshot>(request, historicalAPath, teacher)).data.data
  ).toEqual(beforeA.data.data);
  await panel.getByLabel("历史 Run ID", { exact: true }).fill(runA.data.data.run.run_id);
  await panel.getByRole("button", { name: "读取该 Run 原始证据" }).click();
  await expect(panel.getByTestId("historical-admission-receipt")).toContainText(a.adoption_id);
  for (const width of [1440, 1280, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await panel.scrollIntoViewIfNeeded();
    const size = await panel.evaluate((element) => ({
      scroll: element.scrollWidth,
      client: element.clientWidth
    }));
    expect(size.scroll, `O5 panel overflow at ${width}`).toBeLessThanOrEqual(size.client + 1);
    await panel.screenshot({ path: testInfo.outputPath(`teacher-${width}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  const axe = await new AxeBuilder({ page })
    .include('[aria-label="governed multi-epoch evidence adoption"]')
    .analyze();
  expect(axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""))).toEqual(
    []
  );
  expect((await api(request, historicalAPath, student)).status).toBe(403);
  expect((await api(request, historicalAPath, teacher, undefined, "tenant_other")).status).toBe(
    403
  );
  await signIn(page, "admin", `?courseId=${course_id}`);
  const adminPanel = page.getByRole("region", { name: "governed multi-epoch evidence adoption" });
  await expect(adminPanel).toBeVisible();
  await adminPanel.getByLabel("历史 Run ID", { exact: true }).fill(runB.data.data.run.run_id);
  await adminPanel.getByRole("button", { name: "读取该 Run 原始证据" }).click();
  await expect(adminPanel.getByTestId("historical-admission-receipt")).toContainText(b.adoption_id);
  const adminRead = await api<QualifiedRunAdmissionSnapshot>(
    request,
    `/api/v1/bff/admin/model-qualification/run-admissions/${runB.data.data.run.run_id}?courseId=${course_id}`,
    admin
  );
  expect(adminRead.status).toBe(200);
  await signIn(page, "student", `?modelQualificationId=${qualificationB.qualification_id}`);
  const safe = page.getByRole("region", {
    name: "student role-safe model qualification explanation"
  });
  await expect(safe).toContainText("ADOPTED_FOR_FUTURE_ADMISSION");
  await expect(safe).not.toContainText(b.adoption_digest);
  await testInfo.attach("product-receipt", {
    contentType: "application/json",
    body: Buffer.from(
      JSON.stringify(
        {
          target_route_mocks: 0,
          run_a: runA.data.data.run.run_id,
          run_b: runB.data.data.run.run_id,
          adoption_a: a,
          adoption_b: b,
          historical_a: beforeA.data.data,
          axe_serious_critical: 0,
          provider: "OFF",
          non_proofs: [
            "Human validation",
            "Full WCAG",
            "Durable multi-process runtime",
            "Production"
          ]
        },
        null,
        2
      )
    )
  });
});
