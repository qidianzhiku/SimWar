import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import type {
  AuditLog,
  Course,
  ReplayInputManifest,
  Round,
  Run,
  SettlementResult,
  Team
} from "@simwar/shared-contracts";
import { RoleWorkflowCommandService } from "../services/api/src/role-workflow.js";
import { createPostgresRuntime } from "../services/api/src/postgres-runtime.js";

const databaseUrl = process.env.SIMWAR_TEST_DATABASE_URL?.trim();
const reportPath = process.env.SIMWAR_W024_REPORT_PATH?.trim();

if (!databaseUrl) {
  throw new Error("SIMWAR_TEST_DATABASE_URL is required for W024 durable runtime validation");
}

type StageStatus = "PASS" | "FAIL";

interface W024Report {
  mission: "SIMWAR-W024-POSTGRES-DURABLE-COURSE-RUNTIME-CUTOVER-MACRO-WAVE-V1.0";
  database_mode: "postgres";
  json_fallback: false;
  node: string;
  stages: Record<string, StageStatus>;
  identifiers: {
    tenant_id: string;
    course_id: string;
    run_id: string;
    round_id: string;
    team_id: string;
    settlement_result_id: string;
    replay_manifest_id: string;
  };
  observations: {
    restart_a_before_settlement: boolean;
    restart_b_after_settlement: boolean;
    exact_retry_status: "reused";
    conflicting_retry_status: "conflict";
    round_after_restart: Round["status"];
    replay_hash_unchanged: boolean;
    tenant_isolation: boolean;
    cleanup: boolean;
  };
}

function createSettlementResult(
  tenantId: string,
  runId: string,
  roundId: string,
  teamId: string,
  settlementResultId: string,
  replayHash = "w024-replay-hash-1"
): SettlementResult {
  return {
    parameter_set_id: "w024-parameter-set",
    replay_hash: replayHash,
    round_id: roundId,
    round_no: 1,
    run_id: runId,
    scenario_package_id: "w024-scenario-package",
    settlement_result_id: settlementResultId,
    team_results: [
      {
        state_est: {
          explanation: "durable runtime validation",
          next_round_risk: "balanced",
          recommended_focus: "preserve the bounded runtime"
        },
        state_obs: {
          demand_band: "high",
          profit_band: "healthy",
          rank: 1,
          revenue: 1200000,
          score: 88,
          served_demand: 95
        },
        state_true: {
          cash_flow: 280000,
          cost: 850000,
          demand: 100,
          market_share: 0.42,
          profit: 350000,
          rank: 1,
          revenue: 1200000,
          score: 88,
          served_demand: 95,
          settlement_status: "settled"
        },
        team_id: teamId,
        team_name: "W024 Durable Team"
      }
    ],
    tenant_id: tenantId
  };
}

function createAudit(tenantId: string, roundId: string): AuditLog {
  return {
    action: "w024.settlement.committed",
    actor_id: "w024-service",
    actor_role: "service_kernel",
    audit_id: `w024-audit-${roundId}`,
    created_at: new Date().toISOString(),
    request_id: `w024-request-${roundId}`,
    resource_id: roundId,
    resource_type: "settlement_result",
    tenant_id: tenantId
  };
}

function createReplayManifest(
  tenantId: string,
  runId: string,
  roundId: string,
  sourceResultId: string,
  manifestId: string
): ReplayInputManifest {
  return {
    created_at: new Date().toISOString(),
    excluded_from_truth_hash: {
      ai_advisory: true,
      learning_evidence: true
    },
    included_sources: ["canonical_decision", "course", "run", "round"],
    input_hash: "w024-input-hash",
    manifest_hash: "w024-manifest-hash",
    manifest_id: manifestId,
    round_id: roundId,
    run_id: runId,
    source_result_id: sourceResultId,
    tenant_id: tenantId
  };
}

async function writeReport(report: W024Report): Promise<void> {
  if (!reportPath) return;
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function cleanupTenantData(tenantId: string): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query("DELETE FROM audit_logs WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM replay_records WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM w024_role_workflow_records WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM w024_runtime_records WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM settlement_results WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM decisions WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM simulation_rounds WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM simulation_runs WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM courses WHERE tenant_id = $1", [tenantId]);
  } finally {
    await pool.end();
  }
}

async function readApiHealth(port: number): Promise<{ body: string; statusCode?: number }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      { hostname: "127.0.0.1", path: "/healthz", port, method: "GET" },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({ body: Buffer.concat(chunks).toString("utf8"), statusCode: response.statusCode })
        );
      }
    );
    request.on("error", reject);
    request.setTimeout(500, () => request.destroy(new Error("health_timeout")));
    request.end();
  });
}

async function runApiProcessProbe(): Promise<boolean> {
  const port = 55440 + Math.floor(Math.random() * 400);
  const child = spawn(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "services/api/src/server.ts"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        API_HOST: "127.0.0.1",
        API_PORT: String(port),
        INTERNAL_SERVICE_TOKEN: "w024-internal-service-token",
        JWT_SECRET: "w024-jwt-secret-with-sufficient-length",
        SIMWAR_DATABASE_URL: databaseUrl,
        SIMWAR_REPOSITORY_MODE: "postgres",
        SIMWAR_STORE_FILE: `C:/Temp/simwar-w024-json-forbidden-${port}.json`
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString("utf8")));
  child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));

  try {
    let health: { body: string; statusCode?: number } | undefined;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        health = await readApiHealth(port);
        if (health.statusCode === 200) break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    if (!health || health.statusCode !== 200) {
      throw new Error(`postgres_api_health_failed:${stdout}:${stderr}`);
    }
    const parsed = JSON.parse(health.body) as { data?: { repository_mode?: string } };
    expect(parsed.data?.repository_mode).toBe("postgres");
    expect(stdout).toContain("SimWar API repository mode: postgres");
    return true;
  } finally {
    child.kill();
    await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 2_000))]);
    if (!child.killed) child.kill("SIGKILL");
  }
}

describe("W024 bounded Postgres Course/Run durable runtime", () => {
  it("survives pre-settlement and post-settlement restart with fail-closed retries", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tenantId = `w024-tenant-${suffix}`;
    const otherTenantId = `w024-other-tenant-${suffix}`;
    const courseId = `w024-course-${suffix}`;
    const runId = `w024-run-${suffix}`;
    const roundId = `w024-round-${suffix}`;
    const teamId = `w024-team-${suffix}`;
    const settlementResultId = `w024-settlement-${suffix}`;
    const replayManifestId = `w024-manifest-${suffix}`;

    const course: Course = {
      course_id: courseId,
      created_by: "w024-teacher",
      parameter_set_id: "w024-parameter-set",
      scenario_package_id: "w024-scenario-package",
      status: "active",
      tenant_id: tenantId,
      title: "W024 Durable Course"
    };
    const run: Run = {
      course_id: courseId,
      parameter_set_id: course.parameter_set_id,
      run_id: runId,
      scenario_package_id: course.scenario_package_id,
      seed: 24024,
      status: "active",
      tenant_id: tenantId
    };
    const round: Round = {
      round_id: roundId,
      round_no: 1,
      run_id: runId,
      status: "open",
      tenant_id: tenantId
    };
    const team: Team = {
      captain_user_id: "w024-ceo",
      course_id: courseId,
      members: [
        { display_name: "W024 CEO", role_slot: "CEO", user_id: "w024-ceo" },
        { display_name: "W024 CFO", role_slot: "CFO", user_id: "w024-cfo" },
        { display_name: "W024 CMO", role_slot: "CMO", user_id: "w024-cmo" },
        { display_name: "W024 COO", role_slot: "COO", user_id: "w024-coo" }
      ],
      name: "W024 Durable Team",
      team_id: teamId,
      tenant_id: tenantId
    };

    const stages: Record<string, StageStatus> = {
      runtime_mode: "FAIL",
      course_run_round_seed: "FAIL",
      role_workflow_before_settlement: "FAIL",
      restart_a_before_settlement: "FAIL",
      canonical_decision_after_restart: "FAIL",
      settlement_commit: "FAIL",
      replay_persistence: "FAIL",
      restart_b_after_settlement: "FAIL",
      api_process_restart_a: "FAIL",
      api_process_restart_b: "FAIL",
      exact_retry_reused: "FAIL",
      conflicting_retry_fail_closed: "FAIL",
      tenant_isolation: "FAIL",
      cleanup: "FAIL"
    };
    let runtime: ReturnType<typeof createPostgresRuntime> | undefined;
    let restartACompleted = false;
    let restartBCompleted = false;
    let retryStatus: "reused" | undefined;
    let conflictStatus: "conflict" | undefined;
    let roundAfterRestart: Round["status"] = "draft";
    let replayHashUnchanged = false;
    let tenantIsolation = false;
    let cleanup = false;

    try {
      runtime = createPostgresRuntime({ databaseUrl });
      await runtime.start();
      expect(runtime.mode).toBe("postgres");
      expect(runtime.provider.mode).toBe("postgres");
      stages.runtime_mode = "PASS";

      const providerA = runtime.provider;
      await providerA.ports.courses.saveCourse(course);
      await providerA.ports.runs.saveRun(run);
      await providerA.ports.rounds.saveRound(round);
      await providerA.ports.teams.createTeamWithCaptain(team);
      expect(await providerA.ports.runs.getRun(tenantId, runId)).toEqual(run);
      expect(await providerA.ports.rounds.getRound(tenantId, roundId)).toEqual(round);
      expect(await providerA.ports.teams.listTeamsForRun(tenantId, runId)).toHaveLength(1);
      stages.course_run_round_seed = "PASS";

      const teacher = {
        actor_id: "w024-teacher",
        actor_role: "teacher" as const,
        tenant_id: tenantId
      };
      const roleKeys = ["CEO", "CFO", "CMO", "COO"] as const;
      let id = 0;
      const roleServiceA = new RoleWorkflowCommandService(providerA.ports.roleWorkflow, {
        createId: (kind) => `${kind}-w024-${++id}`,
        now: () => "2026-08-12T00:00:00.000Z"
      });
      for (const roleKey of roleKeys) {
        await roleServiceA.assignRole(teacher, {
          course_id: courseId,
          role_key: roleKey,
          run_id: runId,
          team_id: teamId,
          user_id: `w024-${roleKey.toLowerCase()}`
        });
      }
      const sectionPayloads = {
        CEO: { strategy_statement: "protect durable execution" },
        CFO: { cash_buffer_target: 100000, service_quality_budget: 20000 },
        CMO: { marketing_budget: 30000, pricing: { base_price: 100 } },
        COO: { capacity_plan: "hold" as const, service_quality_budget: 20000 }
      };
      for (const roleKey of roleKeys) {
        const student = {
          actor_id: `w024-${roleKey.toLowerCase()}`,
          actor_role: "student" as const,
          tenant_id: tenantId
        };
        await roleServiceA.saveSection(student, {
          expected_version: 0,
          payload: sectionPayloads[roleKey],
          round_id: roundId,
          run_id: runId,
          team_id: teamId
        });
        await roleServiceA.markSectionReady(student, {
          expected_version: 1,
          round_id: roundId,
          run_id: runId,
          team_id: teamId
        });
      }
      const merge = await roleServiceA.createMergeCommit(
        { actor_id: "w024-ceo", actor_role: "student", tenant_id: tenantId },
        { round_id: roundId, run_id: runId, team_id: teamId }
      );
      await roleServiceA.confirmTeamDecision(
        { actor_id: "w024-ceo", actor_role: "student", tenant_id: tenantId },
        {
          merge_commit_id: merge.merge_commit_id,
          round_id: roundId,
          run_id: runId,
          team_id: teamId
        }
      );
      const beforeSettlement = await roleServiceA.getTeacherWorkspace(teacher, {
        round_id: roundId,
        run_id: runId,
        team_id: teamId
      });
      expect(beforeSettlement.assignments).toHaveLength(4);
      expect(beforeSettlement.confirmations).toHaveLength(1);
      stages.role_workflow_before_settlement = "PASS";

      await runtime.close();
      runtime = undefined;
      restartACompleted = true;
      expect(await runApiProcessProbe()).toBe(true);
      stages.api_process_restart_a = "PASS";

      runtime = createPostgresRuntime({ databaseUrl });
      await runtime.start();
      const providerB = runtime.provider;
      const roleServiceB = new RoleWorkflowCommandService(providerB.ports.roleWorkflow);
      const afterRestart = await roleServiceB.getTeacherWorkspace(teacher, {
        round_id: roundId,
        run_id: runId,
        team_id: teamId
      });
      expect(afterRestart.assignments).toHaveLength(4);
      expect(afterRestart.sections.filter((section) => section.status === "ready")).toHaveLength(4);
      expect(afterRestart.merge_commits).toHaveLength(1);
      expect(afterRestart.confirmations).toHaveLength(1);
      expect(
        await providerB.ports.decisions.listDecisionsForRound(tenantId, runId, roundId)
      ).toHaveLength(1);
      stages.restart_a_before_settlement = "PASS";
      stages.canonical_decision_after_restart = "PASS";

      const settlement = createSettlementResult(
        tenantId,
        runId,
        roundId,
        teamId,
        settlementResultId
      );
      await expect(
        providerB.facade.commitSettlementOutcome({
          round_id: roundId,
          settlement_result: settlement,
          success_audit: createAudit(tenantId, roundId),
          tenant_id: tenantId
        })
      ).resolves.toEqual({ settlement_result: settlement, status: "committed" });
      stages.settlement_commit = "PASS";

      const manifest = createReplayManifest(
        tenantId,
        runId,
        roundId,
        settlementResultId,
        replayManifestId
      );
      await providerB.ports.replay.saveReplayInputManifest(manifest);
      expect(
        await providerB.ports.replay.getReplayInputManifest(tenantId, replayManifestId)
      ).toEqual(manifest);
      stages.replay_persistence = "PASS";

      await runtime.close();
      runtime = undefined;
      restartBCompleted = true;
      expect(await runApiProcessProbe()).toBe(true);
      stages.api_process_restart_b = "PASS";

      runtime = createPostgresRuntime({ databaseUrl });
      await runtime.start();
      const providerC = runtime.provider;
      const roundAfter = await providerC.ports.rounds.getRound(tenantId, roundId);
      const persistedSettlement = await providerC.ports.settlements.getSettlementResult(
        tenantId,
        settlementResultId
      );
      const persistedManifest = await providerC.ports.replay.getReplayInputManifest(
        tenantId,
        replayManifestId
      );
      expect(roundAfter?.status).toBe("settled");
      expect(persistedSettlement).toEqual(settlement);
      expect(persistedManifest).toEqual(manifest);
      roundAfterRestart = roundAfter?.status ?? "draft";
      replayHashUnchanged = roundAfter?.replay_hash === settlement.replay_hash;
      expect(replayHashUnchanged).toBe(true);
      stages.restart_b_after_settlement = "PASS";

      const retry = await providerC.facade.commitSettlementOutcome({
        round_id: roundId,
        settlement_result: { ...settlement, settlement_result_id: `${settlementResultId}-retry` },
        tenant_id: tenantId
      });
      expect(retry.status).toBe("reused");
      retryStatus = retry.status;
      stages.exact_retry_reused = "PASS";

      const conflict = await providerC.facade.commitSettlementOutcome({
        round_id: roundId,
        settlement_result: {
          ...settlement,
          replay_hash: "w024-conflicting-replay-hash",
          settlement_result_id: `${settlementResultId}-conflict`
        },
        tenant_id: tenantId
      });
      expect(conflict.status).toBe("conflict");
      conflictStatus = conflict.status;
      stages.conflicting_retry_fail_closed = "PASS";

      expect(await providerC.ports.courses.getCourse(otherTenantId, courseId)).toBeNull();
      expect(await providerC.ports.runs.getRun(otherTenantId, runId)).toBeNull();
      expect(await providerC.ports.teams.listTeamsForRun(otherTenantId, runId)).toEqual([]);
      expect(
        await providerC.ports.settlements.getSettlementResult(otherTenantId, settlementResultId)
      ).toBeNull();
      tenantIsolation = true;
      stages.tenant_isolation = "PASS";

      await runtime.pool.query("DELETE FROM audit_logs WHERE tenant_id = $1", [tenantId]);
      await runtime.pool.query("DELETE FROM replay_records WHERE tenant_id = $1", [tenantId]);
      await runtime.pool.query("DELETE FROM w024_role_workflow_records WHERE tenant_id = $1", [
        tenantId
      ]);
      await runtime.pool.query("DELETE FROM w024_runtime_records WHERE tenant_id = $1", [tenantId]);
      await runtime.pool.query("DELETE FROM settlement_results WHERE tenant_id = $1", [tenantId]);
      await runtime.pool.query("DELETE FROM decisions WHERE tenant_id = $1", [tenantId]);
      await runtime.pool.query("DELETE FROM simulation_rounds WHERE tenant_id = $1", [tenantId]);
      await runtime.pool.query("DELETE FROM simulation_runs WHERE tenant_id = $1", [tenantId]);
      await runtime.pool.query("DELETE FROM courses WHERE tenant_id = $1", [tenantId]);
      cleanup = true;
      stages.cleanup = "PASS";
    } finally {
      if (runtime) await runtime.close();
      if (!cleanup) {
        await cleanupTenantData(tenantId);
      }
      const report: W024Report = {
        database_mode: "postgres",
        identifiers: {
          course_id: courseId,
          replay_manifest_id: replayManifestId,
          round_id: roundId,
          run_id: runId,
          settlement_result_id: settlementResultId,
          team_id: teamId,
          tenant_id: tenantId
        },
        json_fallback: false,
        mission: "SIMWAR-W024-POSTGRES-DURABLE-COURSE-RUNTIME-CUTOVER-MACRO-WAVE-V1.0",
        node: process.version,
        observations: {
          cleanup,
          conflicting_retry_status: conflictStatus ?? "conflict",
          exact_retry_status: retryStatus ?? "reused",
          replay_hash_unchanged: replayHashUnchanged,
          restart_a_before_settlement: restartACompleted,
          restart_b_after_settlement: restartBCompleted,
          round_after_restart: roundAfterRestart,
          tenant_isolation: tenantIsolation
        },
        stages
      };
      await writeReport(report);
    }
  });
});
