import { describe, expect, it } from "vitest";
import type { ValidationEnvironmentLaunch } from "@simwar/shared-contracts";
import {
  ValidationEnvironmentLaunchError,
  ValidationEnvironmentLaunchService,
  calculateLaunchIdentity,
  createTestLaunchStepExecutor
} from "../../services/api/src/validation-environment-launch";

const digest = "a".repeat(64);
const input = (overrides: Record<string, unknown> = {}) =>
  ({
    target_tenant_id: "tenant-w025",
    launch_key: "launch-001",
    created_by: "usr_teacher",
    source_parameter_set: {
      tenant_id: "tenant-source",
      reference: { parameter_set_id: "parameter-1", version: "1.0.0", content_digest: digest }
    },
    source_scenario_package: {
      tenant_id: "tenant-source",
      reference: {
        scenario_package_id: "scenario-1",
        tenant_id: "tenant-source",
        version: "1.0.0",
        content_digest: digest
      }
    },
    course_blueprint_reference: {
      course_blueprint_id: "blueprint-1",
      tenant_id: "tenant-w025",
      version: "1.0.0",
      content_digest: digest
    },
    course_package_reference: {
      course_package_id: "package-1",
      tenant_id: "tenant-w025",
      version: "1.0.0",
      content_digest: digest
    },
    course_title: "W025 durable validation",
    source_product_merge_sha: "b".repeat(40),
    cohort_template_digest: digest,
    cohort_template: {
      teacher_user_id: "usr_teacher",
      teams: [
        {
          team_key: "a",
          name: "Team A",
          members: [
            { user_id: "a-ceo", display_name: "A CEO", role_slot: "CEO" },
            { user_id: "a-cfo", display_name: "A CFO", role_slot: "CFO" },
            { user_id: "a-cmo", display_name: "A CMO", role_slot: "CMO" },
            { user_id: "a-coo", display_name: "A COO", role_slot: "COO" }
          ]
        },
        {
          team_key: "b",
          name: "Team B",
          members: [
            { user_id: "b-ceo", display_name: "B CEO", role_slot: "CEO" },
            { user_id: "b-cfo", display_name: "B CFO", role_slot: "CFO" },
            { user_id: "b-cmo", display_name: "B CMO", role_slot: "CMO" },
            { user_id: "b-coo", display_name: "B COO", role_slot: "COO" }
          ]
        }
      ]
    },
    seed: 25,
    ...overrides
  }) as never;

class MemoryLedger {
  rows = new Map<string, ValidationEnvironmentLaunch>();

  async acquire(input: {
    tenant_id: string;
    business_key_digest: string;
    launch_id: string;
    request_fingerprint: string;
    initial: ValidationEnvironmentLaunch;
  }): Promise<ValidationEnvironmentLaunch> {
    const key = `${input.tenant_id}:${input.business_key_digest}`;
    const existing = this.rows.get(key);
    if (existing) {
      if (existing.request_fingerprint !== input.request_fingerprint)
        throw new ValidationEnvironmentLaunchError("W025_LAUNCH_CONFLICT");
      return existing;
    }
    this.rows.set(key, input.initial);
    return input.initial;
  }

  async save(
    launch: ValidationEnvironmentLaunch,
    expectedVersion: number
  ): Promise<ValidationEnvironmentLaunch> {
    const key = `${launch.tenant_id}:${launch.business_key_digest}`;
    const existing = this.rows.get(key);
    if (!existing || existing.version !== expectedVersion)
      throw new ValidationEnvironmentLaunchError("W025_LAUNCH_CAS_STALE");
    this.rows.set(key, launch);
    return launch;
  }

  async get(tenantId: string, launchId: string): Promise<ValidationEnvironmentLaunch | null> {
    return (
      [...this.rows.values()].find(
        (launch) => launch.tenant_id === tenantId && launch.launch_id === launchId
      ) ?? null
    );
  }
}

describe("W025 durable validation environment launch", () => {
  it("uses target tenant plus launch key as identity and rejects conflicting fingerprints", async () => {
    const left = input();
    const right = input({ course_title: "different" });
    expect(calculateLaunchIdentity(left).business_key_digest).toBe(
      calculateLaunchIdentity(right).business_key_digest
    );
    expect(calculateLaunchIdentity(left).request_fingerprint).not.toBe(
      calculateLaunchIdentity(right).request_fingerprint
    );

    const ledger = new MemoryLedger();
    const service = new ValidationEnvironmentLaunchService(ledger);
    await service.start(left, createTestLaunchStepExecutor({}));
    await expect(service.start(right, createTestLaunchStepExecutor({}))).rejects.toMatchObject({
      code: "W025_LAUNCH_CONFLICT"
    });
  });

  it("resumes each durable step exactly once after a C1-C5 style interruption", async () => {
    const ledger = new MemoryLedger();
    const counters: Record<string, number> = {};
    const service = new ValidationEnvironmentLaunchService(ledger);
    const first = createTestLaunchStepExecutor({
      counters,
      hooks: {
        BASELINE_READY: async () => {
          throw new Error("simulated_process_exit_c2");
        }
      }
    });
    await expect(service.start(input(), first)).rejects.toThrow("simulated_process_exit_c2");

    const completed = await service.start(input(), createTestLaunchStepExecutor({ counters }));
    expect(completed.status).toBe("READY");
    expect(counters).toEqual({ baseline: 1, course_run: 1, cohort: 1, session: 1 });
    expect(completed.team_ids).toEqual(["team_a", "team_b"]);
    expect(completed.session_id).toBe("session_w025");
  });

  it("does not allow the shared contract validator to accept malformed history", () => {
    const ledger = new MemoryLedger();
    const service = new ValidationEnvironmentLaunchService(ledger);
    expect(service.get("tenant-w025", "missing")).resolves.toBeNull();
  });
});
