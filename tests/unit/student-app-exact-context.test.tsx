/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REAUTH_CONTEXT_STORAGE_KEY } from "@simwar/shared-contracts";
import { App, StudentLearningLoadBoundary } from "../../apps/student/src/App";
import { StudentLearningReportPanel } from "../../apps/student/src/StudentLearningReport";
import { W3OfficialConsequenceLearningPanel } from "../../apps/student/src/W3OfficialConsequenceLearningPanel";
import {
  matchesAuthorizedSpine,
  matchesStudentCockpit,
  readStudentRequestContext,
  studentSpineQuery
} from "../../apps/student/src/student-request-context";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const exactR1 =
  "w3=true&tenant_id=tenant-a&course_id=course-a&run_id=run-a&team_id=team-a&round_id=round-1&round_no=1&role_key=CEO&activity_id=activity_consequence";
const recoveryR2 = {
  schema_version: 1,
  tenant_id: "tenant-a",
  user_id: "student-a",
  role: "CEO",
  course_id: "course-a",
  run_id: "run-a",
  team_id: "team-a",
  round_id: "round-2",
  round_no: 2,
  route: "/student",
  view: "student-cockpit"
};
const session = {
  access_token: "test-student-token",
  session_id: "session-a",
  user: {
    display_name: "Student A",
    roles: ["learner"],
    tenant_id: "tenant-a",
    user_id: "student-a"
  }
};
const bootstrap = {
  current_user: { ...session.user, team_id: "team-a" },
  courses: [
    { course_id: "course-a", tenant_id: "tenant-a", title: "Course A", status: "published" }
  ],
  teams: [
    {
      team_id: "team-a",
      tenant_id: "tenant-a",
      course_id: "course-a",
      name: "Team A",
      captain_user_id: "student-a",
      members: [{ user_id: "student-a", role_slot: "CEO" }]
    }
  ],
  runs: [
    {
      run_id: "run-a",
      tenant_id: "tenant-a",
      course_id: "course-a",
      scenario_package_id: "scenario-a",
      parameter_set_id: "parameter-a",
      seed: 1,
      status: "active"
    }
  ],
  rounds: [
    {
      round_id: "round-1",
      tenant_id: "tenant-a",
      run_id: "run-a",
      round_no: 1,
      status: "published"
    },
    { round_id: "round-2", tenant_id: "tenant-a", run_id: "run-a", round_no: 2, status: "open" }
  ],
  decisions: [],
  audit_logs: []
};

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

const learningContext = {
  tenant_id: "tenant-a",
  course_id: "course-a",
  run_id: "run-a",
  team_id: "team-a",
  round_id: "round-1",
  round_no: 1,
  role_key: "CEO",
  activity_id: "activity_consequence"
};
const secondContext = { ...learningContext, round_id: "round-2", round_no: 2 };
function reportList() {
  return {
    report_schema_version: "student-learning-report.public.v1",
    scope: "student_team",
    known_limits: ["Published role-safe projection"],
    reports: [learningContext, secondContext].map((context) => ({
      report_id: `report-${context.round_no}`,
      context: {
        course_id: context.course_id,
        run_id: context.run_id,
        team_id: context.team_id,
        round_id: context.round_id,
        round_no: context.round_no,
        role_key: context.role_key
      },
      status: "CONFIRMED",
      learning_evidence: { criterion_results: [], student_visible_feedback: [] },
      business_outcome: {
        status: "SEPARATE_SAFE_OUTCOME",
        summary: `report outcome round ${context.round_no}`
      }
    }))
  };
}
function consequence(context = learningContext) {
  const ref = (resource_id: string, resource_type = "round") => ({
    resource_id,
    discriminator: "exact_ref",
    content_digest: "a".repeat(64),
    resource_type,
    tenant_id: "tenant-a",
    version: "1.0.0"
  });
  return {
    visibility: "student_safe",
    runtime_authority: "JSON_INTERNAL_ONLY",
    known_limits: ["non-causal"],
    record: {
      context,
      record_id: `record-${context.round_no}`,
      schema_version: "w3-official-consequence-learning.v1",
      runtime_authority: "JSON_INTERNAL_ONLY",
      publication: { status: "PUBLISHED" },
      official_result: {
        outcome_label: "official_published",
        profit_band: "healthy",
        rank: 1,
        score: 80,
        team_id: "team-a"
      },
      decision_story: {
        decision_summary: `story round ${context.round_no}`,
        consequence_summary: "published consequence"
      },
      causal_debrief: {
        label: "model_conditioned_association",
        statements: ["Association is not causal proof"]
      },
      learning: {
        evidence_selection_status: "NOT_SELECTED",
        teacher_confirmation_status: "MISSING",
        next_round_hypothesis_status: "BLOCKED"
      },
      source: {
        canonical_decision_ref: ref("decision", "canonical_decision"),
        round_ref: ref(context.round_id),
        settlement_ref: ref("settlement", "settlement_result")
      },
      known_limits: ["non-causal"]
    }
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
class RenderBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p>renderer failed</p> : this.props.children;
  }
}
async function mountPanel(element: React.ReactNode) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return {
    host,
    render: async (next: React.ReactNode) => {
      await act(async () => root.render(next));
    },
    close: async () => {
      await act(async () => root.unmount());
      host.remove();
    }
  };
}
describe("native runtime structural ingress", () => {
  it.each(["independent error", "non-success code"])(
    "rejects report %s with otherwise valid HTTP2xx data",
    async (kind) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            data: reportList(),
            ...(kind === "independent error"
              ? { error: { message: "private report error" } }
              : { code: "REPORT_ERROR" })
          })
        )
      );
      const panel = await mountPanel(
        <StudentLearningReportPanel
          token="token"
          tenantId="tenant-a"
          published
          context={learningContext}
        />
      );
      try {
        expect(panel.host.querySelector('[role="alert"]')).not.toBeNull();
        expect(panel.host.textContent).not.toContain("report outcome round 1");
        expect(panel.host.textContent).not.toContain("private report error");
      } finally {
        await panel.close();
      }
    }
  );
  it("does not display private W3 HTTP error detail", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "private W3 error detail" }), { status: 503 })
    );
    const panel = await mountPanel(
      <W3OfficialConsequenceLearningPanel
        apiBase="http://api.test"
        token="token"
        tenantId="tenant-a"
        context={learningContext}
      />
    );
    try {
      expect(panel.host.querySelector('[role="alert"]')).not.toBeNull();
      expect(panel.host.textContent).not.toContain("private W3 error detail");
    } finally {
      await panel.close();
    }
  });
  it.each(["decision_form", "published_result", "learning_report", "three_part_feedback"])(
    "rejects contradictory %s even when root cockpit is exact R1",
    (name) => {
      const base = {
        tenant_id: "tenant-a",
        course_id: "course-a",
        run_id: "run-a",
        team_id: "team-a",
        round_id: "round-1",
        round_no: 1
      };
      const dto = {
        student_cockpit: base,
        decision_form: base,
        published_result: base,
        learning_report: base,
        three_part_feedback: base
      };
      expect(
        matchesStudentCockpit(
          { ...learningContext },
          {
            ...dto,
            [name]: { ...base, round_id: "round-2", round_no: 2 }
          } as unknown as Parameters<typeof matchesStudentCockpit>[1],
          "tenant-a"
        )
      ).toBe(false);
    }
  );
  it.each(["publication", "official_result", "decision_story", "known_limits", "source"])(
    "fails closed for malformed W3 %s without renderer exception",
    async (field) => {
      const data = consequence();
      const malformed = { ...data, record: { ...data.record, [field]: null } };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ data: malformed }))
      );
      const panel = await mountPanel(
        <RenderBoundary>
          <W3OfficialConsequenceLearningPanel
            apiBase="http://api.test"
            token="token"
            tenantId="tenant-a"
            context={learningContext}
          />
        </RenderBoundary>
      );
      try {
        expect(panel.host.querySelector('[role="alert"]')).not.toBeNull();
        expect(panel.host.textContent).not.toContain("renderer failed");
        expect(panel.host.textContent).not.toContain("story round 1");
      } finally {
        await panel.close();
      }
    }
  );
  it.each(["wrong source round", "wrong result team", "unpublished result", "independent error"])(
    "rejects W3 %s on HTTP2xx",
    async (kind) => {
      const data = consequence();
      if (kind === "wrong source round") data.record.source.round_ref.resource_id = "round-2";
      if (kind === "wrong result team") data.record.official_result.team_id = "other-team";
      if (kind === "unpublished result") data.record.publication.status = "NOT_PUBLISHED";
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            data,
            ...(kind === "independent error" ? { error: { message: "private error" } } : {})
          })
        )
      );
      const panel = await mountPanel(
        <W3OfficialConsequenceLearningPanel
          apiBase="http://api.test"
          token="token"
          tenantId="tenant-a"
          context={learningContext}
        />
      );
      try {
        expect(panel.host.querySelector('[role="alert"]')).not.toBeNull();
        expect(panel.host.textContent).not.toContain("story round 1");
        expect(panel.host.textContent).not.toContain("private error");
      } finally {
        await panel.close();
      }
    }
  );
  it.each(["learning_evidence", "business_outcome", "status"])(
    "rejects matching report with malformed %s before rendering",
    async (field) => {
      const data = reportList();
      const malformed = { ...data, reports: [{ ...data.reports[0], [field]: null }] };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ data: malformed }))
      );
      const panel = await mountPanel(
        <RenderBoundary>
          <StudentLearningReportPanel
            token="token"
            tenantId="tenant-a"
            published
            context={learningContext}
          />
        </RenderBoundary>
      );
      try {
        expect(panel.host.querySelector('[role="alert"]')).not.toBeNull();
        expect(panel.host.textContent).not.toContain("renderer failed");
        expect(panel.host.textContent).not.toContain("report outcome round 1");
      } finally {
        await panel.close();
      }
    }
  );
});
describe("exact-round report and native W3 lifecycle", () => {
  it("contains a rejected lazy module while preserving admitted siblings and explicit reload", async () => {
    const onReload = vi.fn();
    const failure = deferred<{ default: React.ComponentType }>();
    const Module = React.lazy(() => failure.promise);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const panel = await mountPanel(
      <>
        <p>admitted cockpit remains available</p>
        <StudentLearningLoadBoundary onReload={onReload}>
          <React.Suspense fallback={<p>loading module</p>}>
            <Module />
          </React.Suspense>
        </StudentLearningLoadBoundary>
      </>
    );
    try {
      await act(async () => failure.reject(new Error("private module URL")));
      expect(panel.host.textContent).toContain("admitted cockpit remains available");
      expect(panel.host.textContent).toContain("学习模块暂不可用");
      expect(panel.host.textContent).not.toContain("private module URL");
      await act(async () => panel.host.querySelector("button")!.click());
      expect(onReload).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
      await panel.close();
    }
  });
  it.each(["native W3", "D4 report"])(
    "allows explicit same-identity read recovery for %s without a POST",
    async (kind) => {
      const fetcher = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new Error("private read failure"))
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              data: kind === "native W3" ? consequence(learningContext) : reportList()
            })
          )
        );
      const panel = await mountPanel(
        kind === "native W3" ? (
          <W3OfficialConsequenceLearningPanel
            apiBase=""
            token="token"
            tenantId="tenant-a"
            context={learningContext}
          />
        ) : (
          <StudentLearningReportPanel
            token="token"
            tenantId="tenant-a"
            context={learningContext}
            published
          />
        )
      );
      try {
        expect(panel.host.textContent).not.toContain("private read failure");
        const retry = Array.from(panel.host.querySelectorAll("button")).find((button) =>
          button.textContent?.includes("重新读取")
        );
        expect(retry).toBeDefined();
        await act(async () => retry!.click());
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(
          true
        );
        expect(panel.host.textContent).toContain(
          kind === "native W3" ? "PUBLISHED" : "report outcome round 1"
        );
      } finally {
        await panel.close();
      }
    }
  );
  const Report = StudentLearningReportPanel as React.ComponentType<
    React.ComponentProps<typeof StudentLearningReportPanel> & {
      context?: typeof learningContext | undefined;
      requestIdentity?: string;
    }
  >;
  it("shows only the current round in a server-authorized mixed published report list", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: reportList() }))
    );
    const panel = await mountPanel(
      <Report token="token" tenantId="tenant-a" published context={learningContext} />
    );
    try {
      expect(panel.host.textContent).toContain("report outcome round 1");
      expect(panel.host.textContent).not.toContain("report outcome round 2");
    } finally {
      await panel.close();
    }
  });
  it("does not read or show a report before native source admission and joins only the admitted ID", async () => {
    const admitted = deferred<Response>();
    let reportReads = 0;
    const data = reportList();
    data.reports.push({
      ...data.reports[0]!,
      report_id: "other-activity-report",
      business_outcome: {
        ...data.reports[0]!.business_outcome,
        summary: "same round different source"
      }
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("/w3/consequence")) return admitted.promise;
      reportReads += 1;
      expect(String(input)).toContain("/learning-reports/report-1");
      return new Response(JSON.stringify({ code: "OK", data }));
    });
    const panel = await mountPanel(
      <Report
        token="token"
        tenantId="tenant-a"
        published
        context={learningContext}
        requireExactSourceAdmission
      />
    );
    try {
      expect(reportReads).toBe(0);
      expect(panel.host.textContent).not.toContain("report outcome round 1");
      const native = consequence();
      const source = {
        ...native.record.source.round_ref,
        resource_type: "student_learning_report",
        resource_id: "report-1"
      };
      await act(async () =>
        admitted.resolve(
          new Response(
            JSON.stringify({
              code: "OK",
              data: {
                ...native,
                record: {
                  ...native.record,
                  learning: { ...native.record.learning, student_learning_report_ref: source }
                }
              }
            })
          )
        )
      );
      expect(reportReads).toBe(1);
      expect(panel.host.textContent).toContain("report outcome round 1");
      expect(panel.host.textContent).not.toContain("same round different source");
      expect(panel.host.textContent).not.toContain("report outcome round 2");
    } finally {
      await panel.close();
    }
  });
  it.each(["wrong context", "unpublished", "no source", "error envelope"])(
    "does not read public report data when native source admission has %s",
    async (mode) => {
      const native = consequence();
      const record = {
        ...native.record,
        learning: {
          ...native.record.learning,
          student_learning_report_ref: {
            ...native.record.source.round_ref,
            resource_type: "student_learning_report",
            resource_id: "report-1"
          }
        }
      };
      if (mode === "wrong context") record.context = secondContext;
      if (mode === "unpublished") record.publication.status = "SETTLED_UNPUBLISHED";
      const envelope: Record<string, unknown> = { code: "OK", data: { ...native, record } };
      if (mode === "no source")
        delete (record.learning as Record<string, unknown>).student_learning_report_ref;
      if (mode === "error envelope") envelope.error = "private-source-error";
      let reports = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        if (!String(input).includes("/w3/consequence")) reports += 1;
        return new Response(JSON.stringify(envelope));
      });
      const panel = await mountPanel(
        <Report
          token="token"
          tenantId="tenant-a"
          published
          context={learningContext}
          requireExactSourceAdmission
        />
      );
      try {
        expect(reports).toBe(0);
        expect(panel.host.textContent).toContain("学习报告暂不可用");
        expect(panel.host.textContent).not.toContain("private-source-error");
      } finally {
        await panel.close();
      }
    }
  );
  it("does not restore a late report when publication or exact context becomes unavailable", async () => {
    const old = deferred<Response>();
    vi.spyOn(globalThis, "fetch").mockReturnValue(old.promise);
    const panel = await mountPanel(
      <Report token="token" tenantId="tenant-a" published context={learningContext} />
    );
    try {
      await panel.render(
        <Report token="token" tenantId="tenant-a" published={false} context={undefined} />
      );
      await act(async () => old.resolve(new Response(JSON.stringify({ data: reportList() }))));
      expect(panel.host.textContent).not.toContain("report outcome round 1");
      expect(panel.host.textContent).toContain("正式结果发布后");
    } finally {
      await panel.close();
    }
  });
  it.each(["success", "error"])("ignores native W3 late %s after context switch", async (mode) => {
    const old = deferred<Response>();
    let oldSignal: AbortSignal | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      if (!oldSignal) {
        oldSignal = init?.signal as AbortSignal;
        return old.promise;
      }
      return Promise.resolve(new Response(JSON.stringify({ data: consequence(secondContext) })));
    });
    const props = { apiBase: "http://api.test", token: "token", tenantId: "tenant-a" };
    const panel = await mountPanel(
      <W3OfficialConsequenceLearningPanel {...props} context={learningContext} />
    );
    try {
      await panel.render(<W3OfficialConsequenceLearningPanel {...props} context={secondContext} />);
      expect(oldSignal?.aborted).toBe(true);
      await act(async () =>
        mode === "success"
          ? old.resolve(new Response(JSON.stringify({ data: consequence() })))
          : old.reject(new Error("old request error"))
      );
      expect(panel.host.textContent).toContain("story round 2");
      expect(panel.host.textContent).not.toContain("story round 1");
      expect(panel.host.textContent).not.toContain("old request error");
    } finally {
      await panel.close();
    }
  });
  it.each(["success", "error"])(
    "ignores reflection late %s after reauth and does not replay the POST",
    async (mode) => {
      const post = deferred<Response>();
      let posts = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
        if (init?.method === "POST") {
          posts++;
          return post.promise;
        }
        return Promise.resolve(new Response(JSON.stringify({ data: consequence() })));
      });
      const props = {
        apiBase: "http://api.test",
        token: "token",
        tenantId: "tenant-a",
        context: learningContext
      };
      const panel = await mountPanel(<W3OfficialConsequenceLearningPanel {...props} />);
      try {
        await act(async () => {
          const input = panel.host.querySelector("textarea")!;
          Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
            input,
            "my reflection"
          );
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
        await act(async () =>
          panel.host
            .querySelector("form")!
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
        );
        expect(posts).toBe(1);
        await panel.render(
          <W3OfficialConsequenceLearningPanel {...props} token="new-session-token" />
        );
        await act(async () =>
          mode === "success"
            ? post.resolve(new Response(JSON.stringify({ data: consequence(secondContext) })))
            : post.reject(new Error("old reflection error"))
        );
        expect(panel.host.textContent).toContain("story round 1");
        expect(panel.host.textContent).not.toContain("story round 2");
        expect(panel.host.textContent).not.toContain("反思已记录");
        expect(panel.host.textContent).not.toContain("old reflection error");
        expect(posts).toBe(1);
      } finally {
        await panel.close();
      }
    }
  );
  it("aborts native W3 on unmount without reissuing a request", async () => {
    const old = deferred<Response>();
    let signal: AbortSignal | undefined;
    let count = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      count++;
      signal = init?.signal as AbortSignal;
      return old.promise;
    });
    const panel = await mountPanel(
      <W3OfficialConsequenceLearningPanel
        apiBase="http://api.test"
        token="token"
        tenantId="tenant-a"
        context={learningContext}
      />
    );
    await panel.close();
    expect(signal?.aborted).toBe(true);
    await act(async () => old.resolve(new Response(JSON.stringify({ data: consequence() }))));
    expect(count).toBe(1);
  });
  it("ignores report late errors after navigating to another authorized round", async () => {
    const old = deferred<Response>();
    let calls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      ++calls === 1
        ? old.promise
        : Promise.resolve(new Response(JSON.stringify({ data: reportList() })))
    );
    const panel = await mountPanel(
      <Report token="token" tenantId="tenant-a" published context={learningContext} />
    );
    try {
      await panel.render(
        <Report token="token" tenantId="tenant-a" published context={secondContext} />
      );
      await act(async () => old.reject(new Error("private old error")));
      expect(panel.host.textContent).toContain("report outcome round 2");
      expect(panel.host.textContent).not.toContain("report outcome round 1");
      expect(panel.host.textContent).not.toContain("private old error");
    } finally {
      await panel.close();
    }
  });
});

async function observeMountedApp(query: string, saved = true, admitted = false) {
  window.history.replaceState(null, "", query ? `/?${query}` : "/");
  if (saved) window.sessionStorage.setItem(REAUTH_CONTEXT_STORAGE_KEY, JSON.stringify(recoveryR2));
  const requests: string[] = [];
  let reads = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    requests.push(url);
    if (url.includes("/auth/login"))
      return new Response(JSON.stringify({ data: session }), { status: 200 });
    if (url.includes("/demo-state")) {
      reads++;
      return new Response(JSON.stringify({ data: bootstrap }), { status: 200 });
    }
    if (admitted && url.endsWith("/cockpit")) {
      const base = {
        actor_role: "learner",
        advisory_slots: [],
        allowed_actions: [],
        course_id: "course-a",
        explicit_non_proof: [],
        forbidden_fields: [],
        round_id: "round-1",
        round_no: 1,
        run_id: "run-a",
        team_id: "team-a",
        tenant_id: "tenant-a",
        source_runtime_path: ["student_bff"],
        evidence_label: "STUDENT_PROJECTION_EVIDENCE"
      };
      return new Response(
        JSON.stringify({
          data: {
            student_cockpit: {
              ...base,
              visible_state: {
                course_status: "published",
                round_status: "published",
                team_name: "Team A"
              }
            },
            decision_form: {
              ...base,
              editable_fields: [],
              decision_schema_version: "m1-decision-form.v1"
            },
            published_result: { ...base, result_label: "M1 official result" },
            three_part_feedback: { ...base, feedback: {} },
            learning_report: {
              ...base,
              learning_evidence: { advisory_only: true, formal_grade: false, prompts: [] }
            }
          }
        }),
        { status: 200 }
      );
    }
    if (admitted && url.includes("/student/decision-thread/evidence-spine")) {
      return new Response(
        JSON.stringify({
          data: {
            schema_version: "decision-thread-evidence-spine.v1",
            surface: "student",
            exact_context: {
              course_id: "course-a",
              run_id: "run-a",
              team_id: "team-a",
              round_id: "round-1",
              round_no: 1,
              role_key: "CEO"
            },
            provider: "OFF",
            non_causal: true,
            causal_proof: false,
            official_truth_write: false,
            formal_write_count: 0,
            sources: [],
            known_limits: ["fixture"]
          }
        }),
        { status: 200 }
      );
    }
    // Characterization observes the real App's endpoint choice. No fake child
    // component stands in for the cockpit; unavailable BFF remains an error.
    return new Response(
      JSON.stringify({ code: "STUDENT_BFF_UNAVAILABLE", message: "unavailable" }),
      { status: 503 }
    );
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<App />));
    await act(async () => {
      for (const [label, value] of [
        ["tenant", "tenant-a"],
        ["username", "student-a"],
        ["password", "test-password"]
      ]) {
        const input = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
        expect(input).not.toBeNull();
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
          input,
          value
        );
        input?.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await act(async () => {
      const button = [...host.querySelectorAll("button")].find((b) =>
        b.textContent?.includes("学员登录")
      );
      expect(button).toBeDefined();
      button?.click();
    });
    await act(async () => {
      await vi.waitFor(() => expect(reads).toBe(1));
    });
    if (admitted)
      await act(async () => {
        await vi.waitFor(() =>
          expect(requests.some((u) => u.includes("/student/decision-thread/evidence-spine"))).toBe(
            true
          )
        );
      });
    return {
      cockpit: requests.filter((u) => u.endsWith("/cockpit")),
      text: host.textContent ?? "",
      cockpitVisible: host.querySelector("#student-cockpit") !== null
    };
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
}

describe("mounted Student exact-round entry", () => {
  it("opens the actual Student cockpit after exact R1 admission despite saved R2 reauth state", async () => {
    const result = await observeMountedApp(exactR1, true, true);
    expect(result.cockpitVisible).toBe(true);
  });
  it.each(["w3", "%63ourse_id=course-a"])(
    "does not use latest for bare or encoded invalid markers %s",
    async (query) => {
      expect((await observeMountedApp(query, false)).cockpit).toEqual([]);
    }
  );
  it("uses explicit R1 for the cockpit instead of saved unpublished R2", async () => {
    const result = await observeMountedApp(exactR1);
    expect(result.cockpit).toEqual([
      "http://localhost:3000/api/v1/bff/student/runs/run-a/rounds/1/cockpit"
    ]);
    expect(result.cockpit.some((u) => u.includes("/rounds/2/"))).toBe(false);
  });
  it("does not repair an invalid explicit URL from saved R2", async () => {
    const result = await observeMountedApp(exactR1.replace("round_id=round-1&", ""));
    expect(result.cockpit).toEqual([]);
  });
  it("revalidates saved R2 when the exact URL is absent", async () => {
    const result = await observeMountedApp("");
    expect(result.cockpit).toEqual([
      "http://localhost:3000/api/v1/bff/student/runs/run-a/rounds/2/cockpit"
    ]);
  });
  it("rejects explicit foreign tenant rather than reading the saved tenant", async () => {
    const result = await observeMountedApp(
      exactR1.replace("tenant_id=tenant-a", "tenant_id=foreign")
    );
    expect(result.cockpit).toEqual([]);
  });
  it.each([
    ["team", "team_id=team-a", "team_id=other-team"],
    ["role", "role_key=CEO", "role_key=CFO"],
    ["activity", "activity_id=activity_consequence", "activity_id=other-activity"],
    ["round binding", "round_no=1", "round_no=2"]
  ])("rejects wrong %s without using saved R2", async (_name, from, to) => {
    expect((await observeMountedApp(exactR1.replace(from, to))).cockpit).toEqual([]);
  });
  it.each([
    exactR1 + "&round_no=2",
    exactR1.replace("round_no=1", "round_no=0"),
    exactR1.replace("round_no=1", "round_no=1.5"),
    exactR1.replace("run_id=run-a", "run_id=latest"),
    exactR1.replace("role_key=CEO", "role_key=%20CEO"),
    exactR1.replace("w3=true", "w3=false")
  ])("rejects ambiguous or implicit exact entry %s", (search) => {
    expect(readStudentRequestContext(search).kind).toBe("INVALID");
  });
  it.each(["course_first_aid", "course_last_aid", "course_newest_aid"])(
    "admits canonical W3 identity %s without treating its segment as an implicit selector",
    (courseId) => {
      const parsed = readStudentRequestContext(
        exactR1.replace("course_id=course-a", `course_id=${courseId}`)
      );
      expect(parsed.kind).toBe("EXACT");
      if (parsed.kind !== "EXACT") throw new Error("fixture must be exact");
      expect(parsed.context.course_id).toBe(courseId);
    }
  );
  it("keeps GSI's five-field handoff separate from exact-round context", () => {
    expect(
      readStudentRequestContext(
        "gsi_course_id=c&gsi_run_id=r&gsi_team_id=t&gsi_role_key=CEO&gsi_activity_id=a"
      ).kind
    ).toBe("ABSENT");
  });
  it("requires the server's exact Student role/assignment proof before learning readiness", () => {
    const parsed = readStudentRequestContext(exactR1);
    expect(parsed.kind).toBe("EXACT");
    if (parsed.kind !== "EXACT") throw new Error("fixture must be exact");
    const spine = {
      schema_version: "decision-thread-evidence-spine.v1",
      surface: "student",
      exact_context: {
        course_id: "course-a",
        run_id: "run-a",
        team_id: "team-a",
        round_id: "round-1",
        round_no: 1,
        role_key: "CEO"
      },
      provider: "OFF",
      non_causal: true,
      causal_proof: false,
      official_truth_write: false,
      formal_write_count: 0
    };
    expect(matchesAuthorizedSpine(spine, parsed.context)).toBe(true);
    expect(
      matchesAuthorizedSpine(
        { ...spine, exact_context: { ...spine.exact_context, round_no: 2 } },
        parsed.context
      )
    ).toBe(false);
    expect(
      matchesAuthorizedSpine(
        { ...spine, exact_context: { ...spine.exact_context, role_key: "CFO" } },
        parsed.context
      )
    ).toBe(false);
    expect(matchesAuthorizedSpine({ ...spine, surface: "teacher" }, parsed.context)).toBe(false);
    expect(matchesAuthorizedSpine({ ...spine, official_truth_write: true }, parsed.context)).toBe(
      false
    );
    expect(matchesAuthorizedSpine({ ...spine, provider: "ON" }, parsed.context)).toBe(false);
    expect(studentSpineQuery(parsed.context)).toBe(
      "course_id=course-a&run_id=run-a&team_id=team-a&round_id=round-1&round_no=1&role_key=CEO&activity_id=activity_consequence"
    );
  });
});
