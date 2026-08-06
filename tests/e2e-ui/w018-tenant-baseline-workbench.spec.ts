import { expect, test } from "@playwright/test";

const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;

test("platform Admin exposes exact tenant baseline provisioning and provenance", async ({
  page
}) => {
  await page.route("**/api/v1/auth/login", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: {
          access_token: "w018-platform-token",
          expires_at: "2099-01-01T00:00:00.000Z",
          user: {
            display_name: "W018 Platform",
            roles: ["platform_admin"],
            tenant_id: "tenant_platform",
            user_id: "w018-platform"
          }
        },
        message: "success",
        request_id: "w018-login"
      })
    });
  });
  await page.route("**/api/v1/bff/admin/platform-authority?scope=platform", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: {
          actor_role: "platform_admin",
          platform_authority: true,
          required_scope: "platform",
          visible_state: { tenant_count: 2, tenant_ids: ["tenant_source", "tenant_a"] }
        },
        message: "success",
        request_id: "w018-platform"
      })
    });
  });
  await page.route("**/api/v1/admin/course-package-versions*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: { course_package_versions: [] },
        message: "success",
        request_id: "w018-packages"
      })
    });
  });
  await page.route("**/api/v1/admin/tenant-baselines/provision", async (route) => {
    const body = route.request().postDataJSON();
    expect(body).toEqual({
      idempotency_key: "w018-tenant-a",
      source_parameter_set: {
        content_digest: "a".repeat(64),
        parameter_set_id: "source-parameter",
        source_tenant_id: "tenant-source",
        version: "1.0.0"
      },
      source_scenario_package: {
        content_digest: "b".repeat(64),
        scenario_package_id: "source-scenario",
        source_tenant_id: "tenant-source",
        version: "1.0.0"
      },
      target_tenant_id: "tenant-a"
    });
    await route.fulfill({
      contentType: "application/json",
      status: 201,
      body: JSON.stringify({
        code: "OK",
        data: {
          audit_identity: "audit-w018",
          outcome: "CREATED",
          parameter_set: {
            reference: { parameter_set_id: "local-parameter", version: "1.0.0" },
            status: "APPROVED",
            tenant_id: "tenant-a",
            version: "1.0.0"
          },
          provenance: {
            provisioning_request_digest: "e".repeat(64),
            source_parameter_set: { tenant_id: "tenant-source" },
            source_scenario_package: { tenant_id: "tenant-source" }
          },
          scenario_package: {
            reference: {
              scenario_package_id: "local-scenario",
              tenant_id: "tenant-a",
              version: "1.0.0"
            },
            status: "APPROVED",
            tenant_id: "tenant-a",
            version: "1.0.0"
          }
        },
        message: "success",
        request_id: "w018-provision"
      })
    });
  });

  await page.goto(adminBaseUrl);
  await page.getByLabel("tenant").fill("tenant_platform");
  await page.getByLabel("username").fill("platform");
  await page.getByLabel("password").fill("platform");
  await page.getByRole("button", { name: "管理员登录" }).click();
  await expect(page.getByRole("heading", { name: "Tenant baseline provisioning" })).toBeVisible();
  await page.getByLabel("target tenant ID").fill("tenant-a");
  await page.getByLabel("idempotency key").fill("w018-tenant-a");
  await page.getByLabel("Source ParameterSet source tenant id").fill("tenant-source");
  await page.getByLabel("Source ParameterSet parameter set id").fill("source-parameter");
  await page.getByLabel("Source ParameterSet version").fill("1.0.0");
  await page.getByLabel("Source ParameterSet content digest").fill("a".repeat(64));
  await page.getByLabel("Source ScenarioPackage source tenant id").fill("tenant-source");
  await page.getByLabel("Source ScenarioPackage scenario package id").fill("source-scenario");
  await page.getByLabel("Source ScenarioPackage version").fill("1.0.0");
  await page.getByLabel("Source ScenarioPackage content digest").fill("b".repeat(64));
  await page.getByRole("button", { name: "Provision exact tenant baseline" }).click();
  await expect(page.getByRole("heading", { name: "CREATED" })).toBeVisible();
  await expect(page.getByText("local-parameter@1.0.0")).toBeVisible();
  await expect(page.getByText("Source tenant: tenant-source")).toBeVisible();
});
