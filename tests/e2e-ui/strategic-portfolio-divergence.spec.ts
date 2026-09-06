import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ESL_API_PORT ?? 3110}`;
const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ESL_ADMIN_PORT ?? 3113}`;
const tenantId = "tenant_demo";

async function loginToken(
  request: APIRequestContext,
  username: "teacher" | "admin"
): Promise<string> {
  const response = await request.post(`${apiBaseUrl}/api/v1/auth/login`, {
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    data: { username, password: username }
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { data: { access_token: string } };
  return body.data.access_token;
}

async function expectNoBlockingA11y(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .include("#admin-strategic-portfolio-divergence")
    .analyze();
  expect(
    results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? "")
    )
  ).toEqual([]);
}

test("SP-O3 Admin real-BFF journey preserves exact comparison and responsive recovery", async ({
  page
}) => {
  const teacherToken = await loginToken(page.request, "teacher");
  const m4Response = await page.request.get(
    `${apiBaseUrl}/api/v1/bff/teacher/w4/runs/m4-browser-run/multipath-counterfactual-transfer?course_id=course_demo&team_id=team_alpha&round_no=1`,
    { headers: { authorization: `Bearer ${teacherToken}`, "x-tenant-id": tenantId } }
  );
  expect(m4Response.status()).toBe(200);
  const m4 = (await m4Response.json()) as {
    data: {
      exact_binding: {
        source_state_ref: Record<string, unknown>;
        source_outcome_id: string;
        scenario_package_id: string;
        parameter_set_id: string;
        engine_id: string;
        plugin_ids: string[];
        seed: number;
      };
      paths: Array<{ path_id: string; label: string; decision_ids: string[] }>;
    };
  };
  const adminToken = await loginToken(page.request, "admin");
  const w4Response = await page.request.get(`${apiBaseUrl}/api/v1/bff/admin/w4/portfolio`, {
    headers: { authorization: `Bearer ${adminToken}`, "x-tenant-id": tenantId }
  });
  expect(w4Response.status()).toBe(200);
  const w4 = (await w4Response.json()) as {
    data: {
      portfolios: Array<{
        team_paths: Array<{ strategic_portfolio: { portfolio_ref: { portfolio_digest: string } } }>;
      }>;
    };
  };
  const portfolio = w4.data.portfolios[0]?.team_paths[0]?.strategic_portfolio;
  expect(portfolio?.portfolio_ref.portfolio_digest).toBeTruthy();

  const source = m4.data.exact_binding;
  const createResponse = await page.request.post(
    `${apiBaseUrl}/api/v1/bff/teacher/sp-o3/strategic-portfolio/divergence`,
    {
      headers: {
        authorization: `Bearer ${teacherToken}`,
        "content-type": "application/json",
        "x-tenant-id": tenantId
      },
      data: {
        discriminator: "strategic_portfolio_divergence_request",
        exact_binding: {
          tenant_id: tenantId,
          course_id: "course_demo",
          run_id: "m4-browser-run",
          team_id: "team_alpha",
          round_id: "m4-browser-round-1",
          round_no: 1
        },
        counterfactual: {
          source_state_ref: source.source_state_ref,
          source_outcome_id: source.source_outcome_id,
          paths: m4.data.paths.slice(0, 2),
          horizon_rounds: 1,
          scenario_package_id: source.scenario_package_id,
          parameter_set_id: source.parameter_set_id,
          engine_id: source.engine_id,
          plugin_ids: source.plugin_ids,
          seed: source.seed
        },
        expected_portfolio_state_digest: portfolio?.portfolio_ref.portfolio_digest,
        divergence_policy_digest: "sp-o3-browser-policy-1",
        idempotency_key: "sp-o3-browser-journey-1"
      }
    }
  );
  expect(createResponse.status()).toBe(201);
  const created = (await createResponse.json()) as { data: { candidate_id: string } };
  expect(created.data.candidate_id).toMatch(/^sp_o3_candidate_[a-f0-9]{16}$/);

  await page.goto(adminBaseUrl);
  await page.getByLabel("tenant").fill(tenantId);
  await page.getByLabel("username").fill("admin");
  await page.getByLabel("password").fill("admin");
  await page.getByRole("button", { name: "管理员登录" }).click();

  const panel = page.getByRole("region", { name: "战略组合差异检查" });
  await expect(panel).toBeVisible();
  await panel.getByLabel("SP-O3 divergence candidate ID").fill(created.data.candidate_id);
  await panel.getByRole("button", { name: "读取差异检查" }).click();
  await expect(panel.getByText("Exact comparison evidence", { exact: true })).toBeVisible();
  await expect(panel.getByText("REFLECTION_ONLY", { exact: false })).toBeVisible();
  await expect(
    panel.getByText("derived=true · query_only=true · provider=OFF", { exact: true })
  ).toBeVisible();
  await expectNoBlockingA11y(page);

  for (const width of [1440, 1280, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(panel).toBeVisible();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await panel.getByRole("button", { name: "读取差异检查" }).focus();
  await expectNoBlockingA11y(page);
});
