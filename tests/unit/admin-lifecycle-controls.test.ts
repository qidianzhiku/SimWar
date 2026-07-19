import { describe, expect, it, vi } from "vitest";
import type {
  ApiEnvelope,
  SyntheticRunLifecycleControlDTO,
  SyntheticRunLifecycleOperationResultDTO
} from "@simwar/shared-contracts";
import {
  RUN_LIFECYCLE_CONTROLS_PATH,
  executeRunLifecycleOperation,
  loadRunLifecycleControls
} from "../../apps/admin/src/admin-bff";
import {
  isSyntheticJsonInternalRuntime,
  SYNTHETIC_JSON_INTERNAL_MARKER
} from "../../services/api/src/synthetic-run-lifecycle";

const control: SyntheticRunLifecycleControlDTO = {
  allowed_operations: ["abort"],
  audit_reference: null,
  blocked_reasons: [],
  course_id: "course_demo",
  evidence_frozen: false,
  ephemeral_artifact_allowlist: ["round_lock_control"],
  explicit_non_proofs: ["abort_is_not_rollback"],
  lifecycle_state: "ACTIVE",
  pre_publication: true,
  pre_settlement: true,
  preserved_state: ["decision_evidence"],
  run_id: "run_001",
  runtime_boundary: "JSON_INTERNAL_ONLY",
  synthetic_marker: true,
  tenant_id: "tenant_demo"
};

function jsonResponse<T>(data: T, status = 200): Response {
  const envelope: ApiEnvelope<T> = {
    code: "OK",
    data,
    message: "success",
    request_id: "req_admin_lifecycle"
  };
  return new Response(JSON.stringify(envelope), {
    headers: { "content-type": "application/json" },
    status
  });
}

describe("Admin synthetic lifecycle BFF client", () => {
  it("loads validated controls without a client tenant header", async () => {
    const fetcher = vi.fn(async () => jsonResponse([control]));

    await expect(loadRunLifecycleControls("admin-token", fetcher)).resolves.toEqual([control]);
    expect(fetcher).toHaveBeenCalledWith(
      RUN_LIFECYCLE_CONTROLS_PATH,
      expect.objectContaining({
        headers: expect.not.objectContaining({ "x-tenant-id": expect.anything() }),
        method: "GET"
      })
    );
  });

  it("sends exact run confirmation and validates the operation result", async () => {
    const result: SyntheticRunLifecycleOperationResultDTO = {
      control: { ...control, allowed_operations: ["reset", "cleanup"], lifecycle_state: "ABORTED" },
      ephemeral_artifacts_changed: [],
      idempotent: false,
      operation: "abort"
    };
    const fetcher = vi.fn(async () => jsonResponse(result));

    await expect(
      executeRunLifecycleOperation(control, "abort", "admin-token", fetcher)
    ).resolves.toEqual(result);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/bff/admin/courses/course_demo/runs/run_001/lifecycle/abort",
      expect.objectContaining({
        body: JSON.stringify({ confirmation: "ABORT run_001" }),
        method: "POST"
      })
    );
  });

  it("rejects malformed lifecycle DTOs", async () => {
    const fetcher = vi.fn(async () => jsonResponse([{ run_id: "run_001" }]));
    await expect(loadRunLifecycleControls("admin-token", fetcher)).rejects.toThrow(
      "Admin summary request failed"
    );
  });

  it("keeps runtime activation limited to JSON development and test", () => {
    expect(isSyntheticJsonInternalRuntime("json", "development")).toBe(true);
    expect(isSyntheticJsonInternalRuntime("json", "test")).toBe(true);
    expect(isSyntheticJsonInternalRuntime("json", "production")).toBe(false);
    expect(isSyntheticJsonInternalRuntime("json", "staging")).toBe(false);
    expect(isSyntheticJsonInternalRuntime("custom", "test")).toBe(false);
    expect(SYNTHETIC_JSON_INTERNAL_MARKER).toBe("synthetic_json_internal.v1");
  });
});
