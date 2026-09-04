/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModelQualificationAdoptionPanel } from "../../packages/ui/src/components/ModelQualificationAdoptionPanel";

const props = {
  apiBase: "http://fixture",
  courseId: "course_o7",
  tenantId: "tenant_o7",
  token: "fixture-only",
  role: "teacher" as const
};
const digest = (character: string) => character.repeat(64);
const modelVersion = {
  model_version_id: "model-o7",
  version: "7.0.0",
  content_digest: digest("a")
};
const artifact = {
  artifact_id: "artifact-o7",
  content_digest: digest("b"),
  format: "typescript-boundary",
  source_ref: "services/simulation-core"
};
const epochA = {
  tenant_id: props.tenantId,
  course_id: props.courseId,
  source_package_id: "source-a",
  source_content_digest: digest("c"),
  calibration_dataset_id: "dataset-a",
  calibration_dataset_content_digest: digest("d"),
  qualification_id: "qualification-a",
  qualification_content_digest: digest("e"),
  model_version_reference: modelVersion,
  model_artifact_reference: artifact,
  source_expires_at: null,
  epoch_digest: digest("f")
};
const adoptionA = { adoption_id: "adoption-a", adoption_digest: digest("1") };
const adoptionB = { adoption_id: "adoption-b", adoption_digest: digest("2") };
const state = {
  tenant_id: props.tenantId,
  course_id: props.courseId,
  proposals: [],
  reviews: [],
  records: [
    {
      ...adoptionA,
      proposal_id: "proposal-a",
      proposal_digest: digest("3"),
      review_id: "review-a",
      review_digest: digest("4"),
      epoch: epochA,
      predecessor: null,
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
      expires_at: null,
      note: "A",
      decided_by: "teacher",
      decided_at: "2026-09-01T00:00:00.000Z",
      official_truth_write: false,
      provider: "OFF"
    },
    {
      ...adoptionB,
      proposal_id: "proposal-b",
      proposal_digest: digest("5"),
      review_id: "review-b",
      review_digest: digest("6"),
      epoch: { ...epochA, qualification_id: "qualification-b", epoch_digest: digest("7") },
      predecessor: adoptionA,
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
      expires_at: null,
      note: "B",
      decided_by: "teacher",
      decided_at: "2026-09-02T00:00:00.000Z",
      official_truth_write: false,
      provider: "OFF"
    }
  ],
  selections: [
    { ...adoptionB, model_version_reference: modelVersion, model_artifact_reference: artifact }
  ],
  commands: []
};
const projection = {
  calibration_datasets: [],
  known_limits: [],
  model_catalog: [],
  operation_id: "MODEL_QUALIFICATION_TEACHER_STUDIO_GET_V1",
  qualifications: [
    {
      qualification_id: "qualification-a",
      source_package_id: "source-a",
      calibration_dataset_id: "dataset-a",
      model_version_reference: modelVersion,
      artifact,
      review: { status: "APPROVED" },
      binding: { status: "BOUND" }
    }
  ],
  security: { activity: "mqr", course: props.courseId, role: "teacher", tenant: props.tenantId },
  source_packages: [],
  evidence_adoption: state
};
const operations = {
  operation_id: "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_TEACHER_GET_V1",
  current_adoption: adoptionB,
  current_assessment: { status: "HEALTHY", future_admission_impact: "UNCHANGED" },
  rollback_dry_run: null,
  adoption_state_digest: digest("8"),
  operations_policy_digest: digest("9"),
  known_limits: [],
  provider: "OFF",
  advisory_only: true
};
const dryRun = {
  dry_run_id: "dry-run-o7",
  dry_run_digest: digest("a"),
  assessed_at: "2026-09-04T00:00:00.000Z",
  current_adoption: adoptionB,
  predecessor_adoption: adoptionA,
  predecessor_epoch: epochA,
  adoption_state_digest: operations.adoption_state_digest,
  operations_policy_digest: operations.operations_policy_digest,
  status: "READY_WITH_LIMITS",
  predecessor_currently_eligible: true,
  future_admission_impact: "WOULD_SELECT_EXACT_PREDECESSOR",
  blockers: [],
  known_limits: ["request is not apply"],
  provider: "OFF",
  advisory_only: true,
  rollback_applied: false,
  adoption_mutation: false,
  official_truth_write: false,
  history_deleted: false,
  historical_receipt_rewritten: false
};

beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("O7 governed rollback request UI", () => {
  it("creates a request from READY dry-run, preserves request-not-apply cues and disables generic historical bypass", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("rollback-dry-runs") && init?.method === "POST") {
        return { ok: true, status: 200, json: async () => ({ data: dryRun }) };
      }
      if (url.includes("rollback-requests") && init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              request: {
                rollback_request_id: "rollback-request-o7",
                rollback_request_digest: digest("b"),
                current_adoption: adoptionB,
                predecessor_adoption: adoptionA,
                linked_proposal: {
                  proposal_id: "proposal-readopt-a",
                  proposal_digest: digest("c")
                },
                current_selection_changed: false,
                rollback_applied: false
              },
              proposal: { proposal_id: "proposal-readopt-a", proposal_digest: digest("c") },
              reused: false
            }
          })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: url.includes("adoption-operations") ? operations : projection })
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<ModelQualificationAdoptionPanel {...props} />));

    const qualification = host.querySelector(
      '[aria-label="待采用的 exact Qualification"]'
    ) as HTMLSelectElement;
    await act(async () => {
      qualification.value = "qualification-a";
      qualification.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(
      (host.querySelector('[data-testid="request-evidence-adoption"]') as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(host.textContent).toContain("ROLLBACK_REQUEST_REQUIRED");

    await act(async () =>
      (host.querySelector('[data-testid="preview-adoption-rollback"]') as HTMLButtonElement).click()
    );
    const reason = host.querySelector('[aria-label="采用决策理由"]') as HTMLTextAreaElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
        reason,
        "Explicitly request re-adoption of exact historical A."
      );
      reason.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const requestButton = host.querySelector(
      '[data-testid="create-governed-rollback-request"]'
    ) as HTMLButtonElement;
    expect(requestButton.disabled).toBe(false);
    await act(async () => requestButton.click());

    expect(host.textContent).toContain("rollback-request-o7");
    expect(host.textContent).toContain("proposal-readopt-a");
    expect(host.textContent).toContain("请求 != 应用");
    expect(host.textContent).toContain("rollback_applied=false");
    const body = JSON.parse(
      fetchMock.mock.calls.find(([url]) => url.includes("rollback-requests"))![1]!.body as string
    );
    expect(body).toMatchObject({ course_id: props.courseId, dry_run: dryRun });
    expect(body.command_id).toEqual(expect.any(String));
    await act(async () => root.unmount());
  });

  it("clears the request receipt and offers exact-context reload after post-success refresh failure", async () => {
    let requestCount = 0;
    let failNextOperationsRefresh = false;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("rollback-dry-runs") && init?.method === "POST") {
        return { ok: true, status: 200, json: async () => ({ data: dryRun }) };
      }
      if (url.includes("rollback-requests") && init?.method === "POST") {
        requestCount += 1;
        if (requestCount === 1) failNextOperationsRefresh = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              request: { rollback_request_id: "must-not-remain-visible" },
              proposal: { proposal_id: "proposal-recovery" },
              reused: requestCount > 1
            }
          })
        };
      }
      if (failNextOperationsRefresh && url.includes("adoption-operations")) {
        failNextOperationsRefresh = false;
        return {
          ok: false,
          status: 503,
          json: async () => ({ code: "O7_REAUTH_REQUIRED", message: "refresh failed" })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: url.includes("adoption-operations") ? operations : projection })
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<ModelQualificationAdoptionPanel {...props} />));
    await act(async () =>
      (host.querySelector('[data-testid="preview-adoption-rollback"]') as HTMLButtonElement).click()
    );
    const reason = host.querySelector('[aria-label="采用决策理由"]') as HTMLTextAreaElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
        reason,
        "Request governed rollback."
      );
      reason.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      (
        host.querySelector('[data-testid="create-governed-rollback-request"]') as HTMLButtonElement
      ).click()
    );
    expect(host.textContent).not.toContain("must-not-remain-visible");
    expect(host.textContent).toContain("O7_REAUTH_REQUIRED");
    expect(host.querySelector('[data-testid="reload-adoption-projection"]')).not.toBeNull();
    const retryButton = Array.from(host.querySelectorAll("button")).find(
      (button) => button.textContent === "重试同一 exact 命令"
    );
    expect(retryButton).toBeUndefined();
    await act(async () =>
      (
        host.querySelector('[data-testid="reload-adoption-projection"]') as HTMLButtonElement
      ).click()
    );
    const rollbackCalls = fetchMock.mock.calls.filter(([url]) => url.includes("rollback-requests"));
    expect(rollbackCalls).toHaveLength(1);
    expect(host.querySelector('[data-testid="reload-adoption-projection"]')).toBeNull();
    expect(host.textContent).toContain("显式选择资格与采用候选；复核不会自动采用");
    await act(async () => root.unmount());
  });

  it("retries the same exact rollback command only when the transport result is unknown", async () => {
    let requestCount = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("rollback-dry-runs") && init?.method === "POST") {
        return { ok: true, status: 200, json: async () => ({ data: dryRun }) };
      }
      if (url.includes("rollback-requests") && init?.method === "POST") {
        requestCount += 1;
        if (requestCount === 1) throw new TypeError("transport unknown");
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              request: { rollback_request_id: "rollback-request-reused" },
              proposal: { proposal_id: "proposal-reused" },
              reused: true
            }
          })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: url.includes("adoption-operations") ? operations : projection })
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<ModelQualificationAdoptionPanel {...props} />));
    await act(async () =>
      (host.querySelector('[data-testid="preview-adoption-rollback"]') as HTMLButtonElement).click()
    );
    const reason = host.querySelector('[aria-label="采用决策理由"]') as HTMLTextAreaElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
        reason,
        "Retry exact governed rollback after unknown transport."
      );
      reason.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      (
        host.querySelector('[data-testid="create-governed-rollback-request"]') as HTMLButtonElement
      ).click()
    );
    const firstRequest = JSON.parse(
      fetchMock.mock.calls.filter(([url]) => url.includes("rollback-requests"))[0]![1]!
        .body as string
    );
    const retryButton = Array.from(host.querySelectorAll("button")).find(
      (button) => button.textContent === "重试同一 exact 命令"
    );
    expect(retryButton).toBeDefined();
    await act(async () => retryButton!.click());
    const rollbackCalls = fetchMock.mock.calls.filter(([url]) => url.includes("rollback-requests"));
    expect(rollbackCalls).toHaveLength(2);
    const secondRequest = JSON.parse(rollbackCalls[1]![1]!.body as string);
    expect(secondRequest.command_id).toBe(firstRequest.command_id);
    expect(secondRequest).toEqual(firstRequest);
    expect(host.textContent).toContain("REUSED");
    await act(async () => root.unmount());
  });
});
