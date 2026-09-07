/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IndustryModelRealityJoinPanel } from "../../packages/ui/src/components/IndustryModelRealityJoinPanel";

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
  w5DraftId: "w5-draft-a",
  tenantId: "tenant-a",
  token: "token-a"
};

const teacherData = {
  schema_version: "industry-model-reality-join.v1" as const,
  operation_id: "INDUSTRY_MODEL_REALITY_JOIN_TEACHER_GET_V1" as const,
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
  provability: [],
  support_evidence: {
    availability: "BOUND" as const,
    applicability_digest: "f".repeat(64),
    upstream_pack_digests: {
      m4: "a".repeat(64),
      m5: "b".repeat(64),
      m29: "c".repeat(64)
    },
    portability: {
      status: "PORTABILITY_EVIDENCE_WITH_LIMITS" as const,
      compatibility_status: "NON_BREAKING" as const,
      external_validity: "NOT_PROVEN" as const,
      package_identity: "m4-package"
    },
    holdout: {
      status: "NOT_ELIGIBLE" as const,
      leakage_count: 0,
      eligibility: "NOT_ELIGIBLE" as const
    },
    shanghai: {
      consumption_status: "LOOKAHEAD_READY" as const,
      qualification_status: "LIMITED" as const,
      calibration_evidence: "NOT_PROVEN" as const,
      formal_binding_eligible: false as const
    }
  },
  known_limits: ["M4 portability compatibility is not external validity."],
  provider: "OFF" as const,
  official_truth_write: false as const,
  readiness_digest: "1".repeat(64)
};

describe("IM-O2 Reality Join consumer", () => {
  it("does not request a non-exact join", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <IndustryModelRealityJoinPanel
          apiBase="http://fixture"
          courseId="course-a"
          tenantId="tenant-a"
          token="token-a"
          role="teacher"
        />
      )
    );
    expect(host.textContent).toContain("等待完整");
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it("renders support limits for Teacher and sends the exact selector", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ code: "OK", message: "ok", request_id: "r", data: teacherData })
    }));
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<IndustryModelRealityJoinPanel {...exact} role="teacher" />));
    expect(host.querySelector('[data-testid="industry-reality-join"]')).not.toBeNull();
    expect(host.textContent).toContain("PORTABILITY_EVIDENCE_WITH_LIMITS");
    expect(host.textContent).toContain("NOT_ELIGIBLE");
    expect(host.textContent).toContain("LOOKAHEAD_READY");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("qualificationId=qualification-a");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("w5DraftId=w5-draft-a");
    await act(async () => root.unmount());
  });

  it("clears the cached digest before requesting a different exact selector", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ code: "OK", message: "ok", request_id: "r", data: teacherData })
    }));
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<IndustryModelRealityJoinPanel {...exact} role="teacher" />));
    await act(async () =>
      root.render(<IndustryModelRealityJoinPanel {...exact} runId="run-b" role="teacher" />)
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).not.toContain("expectedRealityJoinDigest");
    await act(async () => root.unmount());
  });

  it("does not render Teacher/Admin identifiers for Student", async () => {
    const studentData = {
      ...teacherData,
      operation_id: "INDUSTRY_MODEL_REALITY_JOIN_STUDENT_GET_V1" as const,
      role: "student" as const,
      exact_context: {
        course_id: "course-a",
        run_id: "run-a",
        team_id: "team-a",
        round_id: "round-a"
      },
      readiness_class: "BLOCKED" as const,
      evidence_classes: ["NOT_PROVEN" as const],
      portability_status: "PORTABILITY_EVIDENCE_WITH_LIMITS" as const,
      holdout_status: "NOT_ELIGIBLE" as const,
      shanghai_status: "LOOKAHEAD_READY" as const,
      recovery: "NONE" as const
    };
    delete (studentData as Partial<typeof studentData>).model_version_reference;
    delete (studentData as Partial<typeof studentData>).model_artifact_reference;
    delete (studentData as Partial<typeof studentData>).qualification;
    delete (studentData as Partial<typeof studentData>).adoption;
    delete (studentData as Partial<typeof studentData>).diagnostic_evidence_digest;
    delete (studentData as Partial<typeof studentData>).interpretation_policy_digest;
    delete (studentData as Partial<typeof studentData>).provability;
    delete (studentData as Partial<typeof studentData>).support_evidence;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ code: "OK", message: "ok", request_id: "r", data: studentData })
    }));
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<IndustryModelRealityJoinPanel {...exact} role="student" />));
    expect(host.textContent).toContain("NOT_PROVEN");
    expect(host.textContent).not.toContain("qualification-a");
    expect(host.textContent).not.toContain("m4-package");
    await act(async () => root.unmount());
  });
});
