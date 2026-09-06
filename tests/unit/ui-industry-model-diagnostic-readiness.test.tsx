/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IndustryModelDiagnosticReadinessPanel } from "../../packages/ui/src/components/IndustryModelDiagnosticReadinessPanel";

beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const exact = {
  apiBase: "http://fixture",
  courseId: "course-a",
  runId: "run-a",
  teamId: "team-a",
  roundId: "round-a",
  scenarioPackageId: "scenario-a",
  parameterSetId: "params-a",
  qualificationId: "qualification-a",
  tenantId: "tenant-a",
  token: "token-a"
};

const teacherData = {
  schema_version: "industry-model-diagnostic-readiness.v1" as const,
  operation_id: "INDUSTRY_MODEL_DIAGNOSTIC_TEACHER_GET_V1" as const,
  role: "teacher" as const,
  readiness_status: "BLOCKED" as const,
  rebase_required: false,
  exact_context: {
    tenant_id: "tenant-a",
    course_id: "course-a",
    run_id: "run-a",
    team_id: "team-a",
    round_id: "round-a",
    scenario_package_id: "scenario-a",
    parameter_set_id: "params-a"
  },
  model_version_reference: {
    model_version_id: "model-a",
    version: "1.0.0",
    content_digest: "a".repeat(64)
  },
  model_artifact_reference: {
    artifact_id: "artifact-a",
    content_digest: "b".repeat(64),
    format: "typescript-boundary",
    source_ref: "artifact://model-a"
  },
  qualification: {
    qualification_id: "qualification-a",
    qualification_digest: "c".repeat(64),
    decision: "APPROVED" as const,
    review_status: "APPROVED" as const,
    binding_status: "BOUND" as const
  },
  adoption: null,
  diagnostic_evidence_digest: "d".repeat(64),
  interpretation_policy_digest: "e".repeat(64),
  provability: [
    {
      producer_id: "producer-a",
      diagnostic_family: "quality",
      classification: "NOT_PROVEN" as const,
      evidence_identity: "f".repeat(64),
      authority_owner: "MODEL_QUALIFICATION",
      source: { path: "source.ts", symbol: "diagnostics" },
      freshness: "FRESH" as const
    }
  ],
  known_limits: ["DIAGNOSTIC_PASS_IS_NOT_BUSINESS_TRUTH"],
  provider: "OFF" as const,
  official_truth_write: false as const,
  readiness_digest: "1".repeat(64)
};

describe("IM-O1 diagnostic readiness consumer", () => {
  it("does not request a server value until the full exact context exists", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <IndustryModelDiagnosticReadinessPanel
          apiBase="http://fixture"
          courseId="course-a"
          tenantId="tenant-a"
          token="token-a"
          role="teacher"
        />
      )
    );
    expect(host.textContent).toContain("等待完整 Course / Run / Round / Team");
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it("renders detailed Teacher provenance and exact query without fallback selection", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ code: "OK", message: "ok", request_id: "request-a", data: teacherData })
    }));
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(<IndustryModelDiagnosticReadinessPanel {...exact} role="teacher" />)
    );
    expect(host.querySelector('[data-testid="industry-diagnostic-readiness"]')).not.toBeNull();
    expect(host.textContent).toContain("NOT_PROVEN");
    expect(host.textContent).toContain("qualification-a");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("runId=run-a");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("qualificationId=qualification-a");
    await act(async () => root.unmount());
  });

  it("renders only the aggregate Student summary", async () => {
    const studentData = {
      ...teacherData,
      operation_id: "INDUSTRY_MODEL_DIAGNOSTIC_STUDENT_GET_V1" as const,
      role: "student" as const,
      student_summary: {
        visibility: "ROLE_SAFE_STUDENT" as const,
        readiness_class: "BLOCKED" as const,
        evidence_classes: ["NOT_PROVEN" as const],
        known_limits: ["DIAGNOSTIC_PASS_IS_NOT_BUSINESS_TRUTH"]
      }
    };
    delete (studentData as Partial<typeof studentData>).model_version_reference;
    delete (studentData as Partial<typeof studentData>).qualification;
    delete (studentData as Partial<typeof studentData>).provability;
    delete (studentData as Partial<typeof studentData>).diagnostic_evidence_digest;
    delete (studentData as Partial<typeof studentData>).interpretation_policy_digest;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ code: "OK", message: "ok", request_id: "request-s", data: studentData })
    }));
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(<IndustryModelDiagnosticReadinessPanel {...exact} role="student" />)
    );
    expect(host.textContent).toContain("ROLE_SAFE_STUDENT");
    expect(host.textContent).not.toContain("qualification-a");
    expect(host.textContent).not.toContain("producer-a");
    expect(host.textContent).not.toContain("diagnostic_evidence_digest");
    await act(async () => root.unmount());
  });
});
