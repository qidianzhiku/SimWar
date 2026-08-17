import { expect, test, type Page } from "@playwright/test";
import { roleWorkflowTeamId, roleWorkflowUsers } from "./role-workflow-fixture";
import { cleanupPlaywrightStore } from "./store-isolation";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;

test.afterEach(() => {
  cleanupPlaywrightStore();
});

async function signIn(page: Page, app: "student" | "teacher", username: string): Promise<void> {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill(username);
  await page.getByLabel("password").fill(username);
  await page.getByRole("button", { name: app === "teacher" ? "教师登录" : "学员登录" }).click();
  if (app === "teacher") {
    await expect(
      page.getByRole("status", { name: "教师操作通知" }).getByLabel("技术兼容标签")
    ).toContainText("signed in");
  } else {
    await expect(page.getByText("signed in")).toBeVisible();
  }
}

async function installRoleWorkflowBrowserFixture(page: Page): Promise<void> {
  let assigned = false;
  let sectionStatus: "draft" | "ready" | undefined;
  let sectionVersion = 0;
  let merged = false;
  let confirmed = false;
  const assignment = {
    assigned_at: "2026-07-31T02:00:00.000Z",
    assignment_id: "role_assignment_browser",
    course_id: "course_demo",
    role_key: "CEO",
    role_template_id: "role_template_ceo_v1",
    run_id: "run_browser",
    source: "teacher_assigned",
    status: "active",
    team_id: "team_alpha",
    tenant_id: "tenant_demo",
    user_id: "usr_student"
  };
  const envelope = (data: unknown) => ({
    code: "OK",
    data,
    message: "success",
    request_id: "req_role_workflow_browser"
  });

  await page.route("**/api/v1/bff/teacher/role-workflows**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith("/assignments")) {
      const body = request.postDataJSON();
      expect(request.method()).toBe("PUT");
      expect(body).toMatchObject({
        course_id: "course_demo",
        role_key: "CEO",
        team_id: "team_alpha",
        user_id: "usr_student"
      });
      assigned = true;
      await route.fulfill({
        contentType: "application/json",
        status: 201,
        body: JSON.stringify(envelope(assignment))
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        envelope({
          assignments: assigned ? [assignment] : [],
          confirmations: confirmed
            ? [
                {
                  confirmed_at: "2026-07-31T02:03:00.000Z",
                  confirmed_by: "usr_student",
                  merge_commit_id: "merge_browser",
                  round_id: "round_browser",
                  run_id: "run_browser",
                  status: "confirmed",
                  team_confirmation_id: "confirmation_browser",
                  team_id: "team_alpha",
                  tenant_id: "tenant_demo"
                }
              ]
            : [],
          history: [],
          known_limits: ["JSON_INTERNAL_ONLY"],
          merge_commits: [],
          round_id: "round_browser",
          run_id: "run_browser",
          schema_version: "teacher-role-workflow-workspace.v1",
          section_summaries: assigned
            ? [
                {
                  role_key: "CEO",
                  status: sectionStatus ?? "missing",
                  version: sectionVersion
                }
              ]
            : [],
          sections: [],
          team_id: "team_alpha",
          tenant_id: "tenant_demo"
        })
      )
    });
  });

  await page.route("**/api/v1/bff/student/role-workspace**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith("/decision-trace")) {
      const traceStages = [
        {
          occurred_at: "2026-07-31T02:00:00.000Z",
          safe_evidence_reference: "role_assignment",
          safe_label: "角色已分配",
          stage_key: "ROLE_ASSIGNED",
          status: "completed"
        }
      ];
      if (sectionStatus) {
        traceStages.push({
          occurred_at: "2026-07-31T02:01:00.000Z",
          safe_evidence_reference: "role_contribution_revision_1",
          safe_label: "已记录角色贡献",
          stage_key: "ROLE_CONTRIBUTION_DRAFTED",
          status: "completed"
        });
        if (sectionStatus === "ready") {
          traceStages.push({
            occurred_at: "2026-07-31T02:01:30.000Z",
            safe_evidence_reference: "role_contribution_revision_2",
            safe_label: "角色贡献已就绪",
            stage_key: "ROLE_CONTRIBUTION_READY",
            status: "completed"
          });
        }
      }
      if (merged) {
        traceStages.push({
          occurred_at: "2026-07-31T02:02:00.000Z",
          safe_evidence_reference: "team_merge",
          safe_label: "团队合并已校验",
          stage_key: "TEAM_MERGE_MILESTONE",
          status: "completed"
        });
      }
      if (confirmed) {
        traceStages.push(
          {
            occurred_at: "2026-07-31T02:03:00.000Z",
            safe_evidence_reference: "team_confirmation",
            safe_label: "团队已确认",
            stage_key: "TEAM_CONFIRMED",
            status: "completed"
          },
          {
            occurred_at: "2026-07-31T02:03:00.000Z",
            safe_evidence_reference: "canonical_decision",
            safe_label: "正式决策已提交",
            stage_key: "CANONICAL_DECISION_MILESTONE",
            status: "completed"
          }
        );
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(
          envelope({
            current_stage: traceStages.at(-1)?.stage_key ?? "NOT_STARTED",
            known_limits: ["OUTCOME_TRUTH_EXCLUDED"],
            role_key: "CEO",
            round_id: "round_browser",
            round_no: 1,
            run_id: "run_browser",
            schema_version: "student-decision-trace.v1",
            team_id: "team_alpha",
            tenant_id: "tenant_demo",
            trace_completeness: confirmed ? "complete" : "partial",
            trace_stages: traceStages
          })
        )
      });
      return;
    }
    if (pathname.endsWith("/section")) {
      expect(request.method()).toBe("PUT");
      expect(request.postDataJSON()).toMatchObject({
        expected_version: 0,
        payload: { strategy_statement: "Coordinate one safe canonical team decision." }
      });
      sectionStatus = "draft";
      sectionVersion = 1;
    } else if (pathname.endsWith("/ready")) {
      expect(request.postDataJSON()).toMatchObject({ expected_version: 1 });
      sectionStatus = "ready";
      sectionVersion = 2;
    } else if (pathname.endsWith("/merge")) {
      merged = true;
      await route.fulfill({
        contentType: "application/json",
        status: 201,
        body: JSON.stringify(
          envelope({
            created_at: "2026-07-31T02:02:00.000Z",
            merge_commit_id: "merge_browser",
            status: "validated"
          })
        )
      });
      return;
    } else if (pathname.endsWith("/confirm")) {
      expect(request.postDataJSON()).toMatchObject({ merge_commit_id: "merge_browser" });
      confirmed = true;
      await route.fulfill({
        contentType: "application/json",
        status: 201,
        body: JSON.stringify(
          envelope({
            confirmed_at: "2026-07-31T02:03:00.000Z",
            confirmed_by: "usr_student",
            merge_commit_id: "merge_browser",
            round_id: "round_browser",
            run_id: "run_browser",
            status: "confirmed",
            team_confirmation_id: "confirmation_browser",
            team_id: "team_alpha",
            tenant_id: "tenant_demo"
          })
        )
      });
      return;
    }

    const section =
      sectionStatus === undefined
        ? undefined
        : {
            assignment_id: assignment.assignment_id,
            payload: { strategy_statement: "Coordinate one safe canonical team decision." },
            role_key: "CEO",
            round_id: "round_browser",
            run_id: "run_browser",
            section_id: "section_browser",
            status: sectionStatus,
            submitted_at: "2026-07-31T02:01:00.000Z",
            submitted_by: "usr_student",
            team_id: "team_alpha",
            tenant_id: "tenant_demo",
            updated_at: "2026-07-31T02:01:00.000Z",
            version: sectionVersion
          };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        envelope({
          assignment,
          confirmation: confirmed
            ? { confirmed_at: "2026-07-31T02:03:00.000Z", status: "confirmed" }
            : undefined,
          context: {
            advisory_scopes: [],
            assignment_id: assignment.assignment_id,
            course_id: "course_demo",
            expires_at: "2026-07-31T10:00:00.000Z",
            permissions: {
              advisory_scopes: ["strategy"],
              can_confirm_team_decision: true,
              can_create_merge_commit: true,
              can_mark_ready: true,
              can_read_role_workspace: true,
              can_save_section: true,
              can_submit_canonical_decision: true,
              editable_fields: ["strategy_statement"],
              policy_id: "role_policy_ceo_v1",
              role_key: "CEO",
              schema_version: "role-permission-policy.v1",
              visible_scopes: ["team.readiness"]
            },
            role_context_id: "context_browser",
            role_key: "CEO",
            role_template_id: "role_template_ceo_v1",
            round_id: "round_browser",
            round_no: 1,
            run_id: "run_browser",
            source: "resolved_from_assignment",
            team_id: "team_alpha",
            tenant_id: "tenant_demo",
            user_id: "usr_student"
          },
          merge_candidate: merged
            ? {
                created_at: "2026-07-31T02:02:00.000Z",
                merge_commit_id: "merge_browser",
                status: "validated"
              }
            : undefined,
          schema_version: "student-role-workflow-workspace.v1",
          section
        })
      )
    });
  });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflowingElements = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          bounds: { left: bounds.left, right: bounds.right, width: bounds.width },
          className: element.className,
          scrollWidth: element.scrollWidth,
          tagName: element.tagName
        };
      })
      .filter(
        ({ bounds }) => bounds.left < -1 || bounds.right > document.documentElement.clientWidth + 1
      )
      .slice(0, 10)
  );
  expect(overflowingElements).toEqual([]);
}

test("@role-workflow-real Teacher assigns a role and Student confirms one safe team decision", async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "role-workflow",
    "the real workflow runs after the complete chromium baseline"
  );
  const fixtureIndex = testInfo.repeatEachIndex;
  const fixtureTeamId = roleWorkflowTeamId(fixtureIndex);
  const fixtureUsers = roleWorkflowUsers(fixtureIndex);
  await page.goto(teacherBaseUrl);
  await signIn(page, "teacher", "teacher");
  const teacherWorkflow = page.getByLabel("Role workflow monitor");
  const createRun = page.getByRole("button", { name: "创建 Run" });
  const runSelector = page.getByLabel("run selector");
  await expect
    .poll(async () => (await createRun.isVisible()) || (await runSelector.isVisible()))
    .toBe(true);
  if (await createRun.isVisible()) {
    await createRun.click();
    await expect(
      page.getByRole("status", { name: "教师操作通知" }).getByLabel("技术兼容标签")
    ).toContainText("run created");
  }
  const teamSelector = teacherWorkflow.getByLabel("角色流程队伍");
  if (!(await teamSelector.isVisible())) {
    await page.getByRole("button", { name: "开启回合" }).click();
    await expect(
      page.getByRole("status", { name: "教师操作通知" }).getByLabel("技术兼容标签")
    ).toContainText("round opened");
  }
  await expect(teacherWorkflow.getByRole("heading", { name: "角色协作进度" })).toBeVisible();
  await teamSelector.selectOption(fixtureTeamId);
  for (const [, role] of fixtureUsers) {
    await teacherWorkflow.getByRole("button", { name: `分配 ${role}` }).click();
    await expect(teacherWorkflow.getByText(`${role} · draft pending`)).toBeVisible();
  }

  for (const [username, role] of [
    fixtureUsers[1],
    fixtureUsers[2],
    fixtureUsers[3],
    fixtureUsers[0]
  ] as const) {
    await page.goto(studentBaseUrl);
    await signIn(page, "student", username);
    const studentWorkflow = page.getByLabel("Student role workflow");
    await expect(studentWorkflow.getByRole("heading", { name: "角色工作区" })).toBeVisible();
    await expect(studentWorkflow.getByRole("heading", { name: "决策历程" })).toBeVisible();
    await expect(studentWorkflow.getByLabel("决策历程").getByRole("status")).toHaveText(
      "角色已分配"
    );
    await expect(studentWorkflow.getByText(role, { exact: true })).toBeVisible();
    if (role === "CEO") {
      await studentWorkflow
        .getByLabel("策略说明")
        .fill("Coordinate one safe canonical team decision.");
    } else if (role === "CFO") {
      await studentWorkflow.getByLabel("角色现金缓冲").fill("0.18");
      await studentWorkflow.getByLabel("角色服务质量预算").fill("122000");
    } else if (role === "CMO") {
      await studentWorkflow.getByLabel("角色定价").fill("12900");
      await studentWorkflow.getByLabel("角色营销预算").fill("145000");
    } else {
      await studentWorkflow.getByLabel("角色产能计划").selectOption("hold");
      await studentWorkflow.getByLabel("角色服务质量预算").fill("122000");
    }
    await studentWorkflow.getByRole("button", { name: "保存角色草稿" }).click();
    await expect(studentWorkflow.getByText("draft · v1")).toBeVisible();
    await studentWorkflow.getByRole("button", { name: "提交角色草稿" }).click();
    await expect(studentWorkflow.getByText("ready · v2")).toBeVisible();

    if (role === "CEO") {
      await studentWorkflow.getByRole("button", { name: "创建团队合并" }).click();
      await expect(studentWorkflow.getByText("validated")).toBeVisible();
      await studentWorkflow.getByRole("button", { name: "确认团队决策" }).click();
      await expect(studentWorkflow.getByText("confirmed")).toBeVisible();
      await expect(studentWorkflow.getByLabel("决策历程").getByRole("status")).toHaveText(
        "正式决策已提交"
      );
      await expect(page.getByRole("button", { name: "提交正式决策" })).toBeDisabled();
    } else {
      await expect(studentWorkflow.getByText("validated")).toHaveCount(0);
    }

    const studentText = await studentWorkflow.innerText();
    for (const marker of [
      "state_true",
      "replay_hash",
      "full_manifest",
      "canonical_evidence_digest",
      "decision_batch_hash"
    ]) {
      expect(studentText).not.toContain(marker);
    }
  }

  await page.goto(teacherBaseUrl);
  await signIn(page, "teacher", "teacher");
  const finalTeacherWorkflow = page.getByLabel("Role workflow monitor");
  await finalTeacherWorkflow.getByLabel("角色流程队伍").selectOption(fixtureTeamId);
  await expect(
    finalTeacherWorkflow.getByText("Team confirmation: confirmed", { exact: true })
  ).toBeVisible();
});

test("Role workflow stays within the mobile Teacher and Student viewports", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await installRoleWorkflowBrowserFixture(page);
  await page.goto(teacherBaseUrl);
  await signIn(page, "teacher", "teacher");
  const createRun = page.getByRole("button", { name: "创建 Run" });
  const runSelector = page.getByLabel("run selector");
  await expect
    .poll(async () => (await createRun.isVisible()) || (await runSelector.isVisible()))
    .toBe(true);
  if (await createRun.isVisible()) {
    await createRun.click();
    await expect(
      page.getByRole("status", { name: "教师操作通知" }).getByLabel("技术兼容标签")
    ).toContainText("run created");
  }
  const teacherWorkflow = page.getByLabel("Role workflow monitor");
  const teamSelector = teacherWorkflow.getByLabel("角色流程队伍");
  const openRound = page.getByRole("button", { name: "开启回合" });
  if (!(await teamSelector.isVisible())) {
    await expect(openRound).toBeVisible();
    await openRound.click();
    await expect(
      page.getByRole("status", { name: "教师操作通知" }).getByLabel("技术兼容标签")
    ).toContainText("round opened");
  }

  await expect(teamSelector).toBeVisible();
  await teacherWorkflow.getByRole("button", { name: "分配 CEO" }).click();
  await expect(teacherWorkflow.getByText("CEO · draft pending")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto(studentBaseUrl);
  await signIn(page, "student", "student");
  const studentWorkflow = page.getByLabel("Student role workflow");
  await expect(studentWorkflow.getByRole("heading", { name: "角色工作区" })).toBeVisible();
  await expect(studentWorkflow.getByRole("heading", { name: "决策历程" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
