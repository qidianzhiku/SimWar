/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GSICrossRoundStudentProjection } from "@simwar/shared-contracts";
import {
  buildGsiCrossRoundComparePath,
  buildGsiCrossRoundHandoffHref,
  classifyGsiCrossRoundFailure,
  GsiCrossRoundInsightPanel,
  readGsiCrossRoundSelection,
  type GsiCrossRoundCandidateOption,
  type GsiCrossRoundSelectors
} from "../../packages/ui/src/components/GsiCrossRoundInsightPanel";

const selectors: GsiCrossRoundSelectors = {
  from_candidate_id: "gsi_candidate_round_1",
  to_candidate_id: "gsi_candidate_round_2",
  activity_id: "activity_gsi_o3",
  role_key: "CEO"
};

const studentProjection: GSICrossRoundStudentProjection = {
  surface: "student",
  movements: [
    {
      stakeholder_type: "customer",
      intent: "protect_demand",
      from_value: 0.2,
      to_value: 0.8,
      delta: 0.6,
      direction: "INCREASED"
    }
  ],
  context_status: "AVAILABLE",
  non_causal: true,
  causal_proof: false,
  provider: "OFF",
  official_truth_write: false,
  known_limits: ["Role-safe movement summary only."],
  recovery: "RELOAD_EXACT_CONTEXT"
};

const candidateOptions: GsiCrossRoundCandidateOption[] = [
  {
    candidate_id: "gsi_candidate_round_1",
    candidate_digest: "a".repeat(64),
    round_id: "round_1",
    round_no: 1
  },
  {
    candidate_id: "gsi_candidate_round_2",
    candidate_digest: "b".repeat(64),
    round_id: "round_2",
    round_no: 2
  }
];

const teacherProjection = {
  surface: "teacher" as const,
  comparison: {
    discriminator: "gsi_cross_round_comparison" as const,
    pair: {
      tenant_id: "tenant_demo",
      course_id: "course_demo",
      run_id: "run_demo",
      team_id: "team_alpha",
      from: {
        candidate_id: "gsi_candidate_round_1",
        candidate_digest: "a".repeat(64),
        round_id: "round_1",
        round_no: 1
      },
      to: {
        candidate_id: "gsi_candidate_round_2",
        candidate_digest: "b".repeat(64),
        round_id: "round_2",
        round_no: 2
      }
    },
    movements: studentProjection.movements.map((movement) => ({
      ...movement,
      signal_key: "customer:protect_demand"
    })),
    comparison_digest: "c".repeat(64),
    non_causal: true,
    causal_proof: false,
    known_limits: []
  },
  context: {
    status: "AVAILABLE" as const,
    context: {
      activity_id: "activity_gsi_o3",
      course_id: "course_demo",
      role_key: "CEO",
      round_id: "round_2",
      round_no: 2,
      run_id: "run_demo",
      team_id: "team_alpha",
      tenant_id: "tenant_demo"
    },
    anchors: [],
    context_digest: "d".repeat(64),
    non_causal: true,
    causal_proof: false,
    official_outcome_recomputed: false,
    official_truth_write: false,
    recovery: "RELOAD_EXACT_CONTEXT" as const,
    known_limits: []
  },
  provider: "OFF" as const,
  official_truth_write: false,
  known_limits: [],
  recovery: "RELOAD_EXACT_CONTEXT" as const
};

describe("GSI-O3 cross-round insight consumer", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("requires complete exact selectors and rejects implicit selectors", () => {
    expect(readGsiCrossRoundSelection("")).toEqual({ state: "MISSING" });
    expect(readGsiCrossRoundSelection("?gsiFromCandidateId=latest&gsiToCandidateId=to")).toEqual({
      state: "INVALID"
    });
    expect(
      readGsiCrossRoundSelection(
        "?gsiFromCandidateId=from&gsiToCandidateId=to&gsiActivityId=activity&gsiRoleKey=CEO"
      )
    ).toEqual({
      state: "READY",
      selectors: {
        from_candidate_id: "from",
        to_candidate_id: "to",
        activity_id: "activity",
        role_key: "CEO"
      }
    });
  });

  it("builds only the existing compare BFF path", () => {
    expect(buildGsiCrossRoundComparePath("teacher", selectors)).toBe(
      "/api/v1/bff/teacher/gsi/candidates/compare?from_candidate_id=gsi_candidate_round_1&to_candidate_id=gsi_candidate_round_2&activity_id=activity_gsi_o3&role_key=CEO"
    );
    expect(classifyGsiCrossRoundFailure("GSI_NOT_PUBLISHED", 409)).toBe("NOT_PUBLISHED");
    expect(classifyGsiCrossRoundFailure("GSI_REBASE_REQUIRED", 409)).toBe("REBASE_REQUIRED");
    expect(classifyGsiCrossRoundFailure("GSI_FORBIDDEN", 403)).toBe("FORBIDDEN");
    expect(buildGsiCrossRoundHandoffHref("http://student.test", selectors)).toBe(
      "http://student.test/?gsiFromCandidateId=gsi_candidate_round_1&gsiToCandidateId=gsi_candidate_round_2&gsiActivityId=activity_gsi_o3&gsiRoleKey=CEO#student-debrief"
    );
  });

  it("keeps Teacher compare dormant until an exact pair is explicitly selected", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ request_id: "req", code: "OK", message: "ok", data: teacherProjection })
    }));
    vi.stubGlobal("fetch", fetchMock);
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(
          <GsiCrossRoundInsightPanel
            apiBase="http://api.test"
            surface="teacher"
            tenantId="tenant_demo"
            token="teacher-token"
            candidateOptions={candidateOptions}
            activityOptions={["activity_gsi_o3"]}
            roleOptions={["CEO"]}
            studentAppBaseUrl="http://student.test"
          />
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(container.querySelector('[data-state="INSUFFICIENT_EXACT_CONTEXT"]')).not.toBeNull();

      const setSelect = (label: string, value: string) => {
        const select = container.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`);
        if (!select) throw new Error(`missing ${label}`);
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      };
      await act(async () => {
        setSelect("from candidate selector", "gsi_candidate_round_1");
        setSelect("to candidate selector", "gsi_candidate_round_2");
        setSelect("activity selector", "activity_gsi_o3");
        setSelect("role selector", "CEO");
        container
          .querySelector<HTMLButtonElement>('button[type="submit"]')
          ?.dispatchEvent(new Event("submit", { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "http://api.test/api/v1/bff/teacher/gsi/candidates/compare?from_candidate_id=gsi_candidate_round_1&to_candidate_id=gsi_candidate_round_2&activity_id=activity_gsi_o3&role_key=CEO",
        expect.anything()
      );
      expect(container.querySelector('[data-state="SUCCESS"]')).not.toBeNull();
      expect(
        container.querySelector('[data-testid="gsi-o3-student-handoff"] a')?.getAttribute("href")
      ).toBe(
        "http://student.test/?gsiFromCandidateId=gsi_candidate_round_1&gsiToCandidateId=gsi_candidate_round_2&gsiActivityId=activity_gsi_o3&gsiRoleKey=CEO#student-debrief"
      );
    } finally {
      act(() => root.unmount());
      vi.unstubAllGlobals();
    }
  });

  it("renders Student role-safe movement results without privileged comparison identity", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ request_id: "req", code: "OK", message: "ok", data: studentProjection })
    }));
    vi.stubGlobal("fetch", fetchMock);
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(
          <GsiCrossRoundInsightPanel
            apiBase="http://api.test"
            surface="student"
            tenantId="tenant_demo"
            token="student-token"
            selectors={selectors}
          />
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(container.querySelector('[data-state="SUCCESS"]')).not.toBeNull();
      expect(fetchMock).toHaveBeenCalledWith(
        "http://api.test/api/v1/bff/student/gsi/candidates/compare?from_candidate_id=gsi_candidate_round_1&to_candidate_id=gsi_candidate_round_2&activity_id=activity_gsi_o3&role_key=CEO",
        expect.objectContaining({
          headers: expect.objectContaining({ "x-tenant-id": "tenant_demo" })
        })
      );
      expect(container.textContent).toContain("customer / protect_demand");
      expect(container.textContent).toContain("增加");
      expect(container.textContent).not.toContain("gsi_candidate_round_1");
      expect(container.textContent).not.toContain("comparison_digest");
    } finally {
      act(() => root.unmount());
      vi.unstubAllGlobals();
    }
  });

  it("classifies a rebase response as a conflict instead of empty success", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ request_id: "req", code: "GSI_REBASE_REQUIRED", message: "rebase" })
    }));
    vi.stubGlobal("fetch", fetchMock);
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(
          <GsiCrossRoundInsightPanel
            apiBase="http://api.test"
            surface="teacher"
            tenantId="tenant_demo"
            token="teacher-token"
            selectors={selectors}
          />
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(container.querySelector('[data-state="REBASE_REQUIRED"]')).not.toBeNull();
      expect(container.textContent).toContain("请重新选择两个已发布回合");
    } finally {
      act(() => root.unmount());
      vi.unstubAllGlobals();
    }
  });
});
