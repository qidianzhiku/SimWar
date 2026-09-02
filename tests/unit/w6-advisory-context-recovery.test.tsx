/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { W020AdvisoryReceipt } from "@simwar/shared-contracts";
import { StudentRoleAdvisor } from "../../apps/student/src/StudentRoleAdvisor";
import { TeacherDebriefAdvisor } from "../../apps/teacher/src/TeacherDebriefAdvisor";
import { GovernedIntelligenceWorkspace } from "../../apps/teacher/src/GovernedIntelligenceWorkspace";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const receipt = {
  discriminator: "w020_advisory_receipt",
  status: "generated",
  request_id: "request-1",
  request_digest: "digest-1",
  context: {
    discriminator: "w020_role_safe_context",
    actor_role: "student",
    actor_id_hash: "actor-hash",
    tenant_id: "tenant-a",
    course_id: "course-a",
    run_id: "run-a",
    round_id: "round-a",
    team_id: "team-a",
    role_key: "CEO",
    advisory_scopes: ["role_contribution"],
    source_event_ids: ["event-a"],
    source_event_types: ["section_saved"],
    context_digest: "context-a",
    transformation_version: "w020-role-safe-context-v1"
  },
  coach_output: {},
  model_call_log: {},
  projection: {
    advisory_only: true,
    evidence_citations: [
      {
        citation_id: "citation-a",
        label: "Saved contribution",
        source_id: "event-a",
        source_type: "workflow_event"
      }
    ],
    evaluation: { checks: ["exact_binding"], fallback: "deterministic_rule", status: "passed" },
    policy: {
      formal_truth_write: false,
      human_final_authority: true,
      pre_publish_student_exposure: false,
      provider: "OFF"
    },
    surface: "student_role",
    title: "Exact-context recommendation",
    recommendations: ["Recommendation from run-a"],
    evidence_refs: ["event:event-a"],
    known_limits: ["Bounded"]
  },
  formal_truth_write: false,
  known_limits: ["Bounded"]
} as unknown as W020AdvisoryReceipt;

function responseFor(input: string): Response {
  if (input.includes("/audit")) {
    return new Response(JSON.stringify({ data: { entries: [] } }), { status: 200 });
  }
  return new Response(JSON.stringify({ data: receipt }), { status: 200 });
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("W6 advisory context recovery", () => {
  afterEach(() => vi.restoreAllMocks());

  it("clears a Student Role Advisor receipt when the exact context changes", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => responseFor(String(input)));
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <StudentRoleAdvisor
          apiBase="http://api.test"
          tenantId="tenant-a"
          token="token"
          runId="run-a"
          roundId="round-a"
          teamId="team-a"
        />
      );
    });
    await act(async () => {
      host.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await settle();
    });
    expect(host.textContent).toContain("Recommendation from run-a");

    await act(async () => {
      root.render(
        <StudentRoleAdvisor
          apiBase="http://api.test"
          tenantId="tenant-a"
          token="token"
          runId="run-b"
          roundId="round-b"
          teamId="team-b"
        />
      );
      await settle();
    });
    expect(host.textContent).not.toContain("Recommendation from run-a");
    expect(host.textContent).toContain("等待请求");
    expect(fetchSpy).toHaveBeenCalled();
    root.unmount();
    host.remove();
  });

  it("clears a Teacher Debrief Advisor receipt when the exact round changes", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => responseFor(String(input)));
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <TeacherDebriefAdvisor
          apiBase="http://api.test"
          tenantId="tenant-a"
          token="token"
          runId="run-a"
          roundId="round-a"
          teamId="team-a"
          teamIds={["team-a"]}
        />
      );
      await settle();
    });
    await act(async () => {
      host
        .querySelector("button:not([disabled])")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await settle();
    });
    expect(host.textContent).toContain("Recommendation from run-a");

    await act(async () => {
      root.render(
        <TeacherDebriefAdvisor
          apiBase="http://api.test"
          tenantId="tenant-a"
          token="token"
          runId="run-a"
          roundId="round-b"
          teamId="team-a"
          teamIds={["team-a"]}
        />
      );
      await settle();
    });
    expect(host.textContent).not.toContain("Recommendation from run-a");
    expect(fetchSpy).toHaveBeenCalled();
    root.unmount();
    host.remove();
  });

  it("clears the governed Teacher workspace receipt when the exact team changes", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => responseFor(String(input)));
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <GovernedIntelligenceWorkspace
          apiBase="http://api.test"
          tenantId="tenant-a"
          token="token"
          runId="run-a"
          roundId="round-a"
          teamId="team-a"
          teamIds={["team-a", "team-b"]}
        />
      );
      await settle();
    });
    await act(async () => {
      host
        .querySelector("button:not([disabled])")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await settle();
    });
    expect(host.textContent).toContain("Exact-context recommendation");

    await act(async () => {
      root.render(
        <GovernedIntelligenceWorkspace
          apiBase="http://api.test"
          tenantId="tenant-a"
          token="token"
          runId="run-a"
          roundId="round-a"
          teamId="team-b"
          teamIds={["team-a", "team-b"]}
        />
      );
      await settle();
    });
    expect(host.textContent).not.toContain("Exact-context recommendation");
    expect(fetchSpy).toHaveBeenCalled();
    root.unmount();
    host.remove();
  });
});
