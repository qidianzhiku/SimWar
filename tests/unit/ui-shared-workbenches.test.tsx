/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CourseReportWorkbench,
  D5ExportWorkbenchView,
  WorkbenchFrame,
  type CourseReportData,
  type D5ExportList,
  type D5ExactReference,
  type D5ReportSummary
} from "../../packages/ui/src/index";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const report: CourseReportData = {
  rows: [
    {
      course_id: "course_001",
      metrics: [{ kpi: "revenue", value: 10800 }],
      round_no: 1,
      run_id: "run_001",
      team_id: "team_001",
      team_name: "North Team"
    }
  ],
  known_limits: ["JSON_INTERNAL_ONLY"]
};

const exact = (id: string, digest: string): D5ExactReference => ({
  content_digest: digest,
  discriminator: "exact_ref",
  resource_id: id,
  resource_type: "student_learning_report",
  tenant_id: "tenant_demo",
  version: "1.0.0"
});

const reports: readonly D5ReportSummary[] = [
  {
    context: { course_id: "course_d5", role_key: "CEO", run_id: "run_d5", team_id: "team_d5" },
    report_ref: exact("report_d5", "a".repeat(64)),
    status: "CONFIRMED"
  },
  {
    context: { course_id: "course_d5", role_key: "CEO", run_id: "run_d5", team_id: "team_d5" },
    report_ref: exact("report_d5", "b".repeat(64)),
    status: "AMENDED"
  }
];

const list: D5ExportList = {
  bundles: [],
  jobs: [],
  receipts: [],
  known_limits: []
};

function mount(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return {
    container,
    root,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    }
  };
}

describe("shared workbench presentation", () => {
  it("renders only supplied frame semantics and leaves authority/business copy to the caller", () => {
    const markup = renderToStaticMarkup(
      <WorkbenchFrame
        ariaLabel="Admin Course Report Builder"
        eyebrow="Server-safe projection"
        title="Course Report Builder"
        badge="Admin BFF"
        boundary="Reports are read-only server projections."
        state={<p role="status">Loading safe Course Report</p>}
        actions={<button type="button">Preview Course Report</button>}
      >
        <article aria-label="Course report preview">Report content</article>
      </WorkbenchFrame>
    );

    expect(markup).toContain('aria-label="Admin Course Report Builder"');
    expect(markup).toContain("Server-safe projection");
    expect(markup).toContain("Course Report Builder");
    expect(markup).toContain("Admin BFF");
    expect(markup).toContain("Reports are read-only server projections.");
    expect(markup).toContain("Loading safe Course Report");
    expect(markup).toContain("Preview Course Report");
    expect(markup).toContain("Report content");
    expect(markup).not.toMatch(/permission|authority|truth|score/i);
  });

  it("uses injected Course Report operations, preserves filters, and ignores stale responses", async () => {
    let releaseOld: (() => void) | undefined;
    const oldReport = new Promise<CourseReportData>((resolve) => {
      releaseOld = () =>
        resolve({ ...report, rows: [{ ...report.rows[0], team_name: "Old Team" }] });
    });
    const filters: Array<Record<string, unknown>> = [];
    const loadReport = vi.fn((filter: Record<string, unknown>) => {
      filters.push(filter);
      return filters.length === 1
        ? oldReport
        : Promise.resolve({ ...report, rows: [{ ...report.rows[0], team_name: "Current Team" }] });
    });
    const exportReport = vi.fn(() =>
      Promise.resolve({ export_format: "json", file_name: "report.json", report })
    );
    const view = mount(
      <CourseReportWorkbench
        ariaLabel="Teacher Course Report Builder"
        eyebrow="Teacher-safe projection"
        title="Course Report Builder"
        badge="Teacher BFF"
        boundary="Reports are read-only server projections."
        roles={["CEO", "CFO"]}
        kpis={["revenue", "score"]}
        initialFilter={{ course_id: "course_001", role: "CEO", kpis: ["revenue"] }}
        loadReport={loadReport}
        exportReport={exportReport}
        mapError={() => ({ phase: "ERROR", message: "mapped" })}
      />
    );

    expect(
      (view.container.querySelector('[aria-label="report course"]') as HTMLInputElement).value
    ).toBe("course_001");
    expect(
      (view.container.querySelector('[aria-label="report role"]') as HTMLSelectElement).value
    ).toBe("CEO");
    expect(
      (view.container.querySelector('[aria-label="KPI revenue"]') as HTMLInputElement).checked
    ).toBe(true);

    const preview = [...view.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Preview Course Report"
    );
    const course = view.container.querySelector('[aria-label="report course"]') as HTMLInputElement;
    expect(preview).toBeTruthy();
    await act(async () => {
      preview?.click();
      await Promise.resolve();
    });
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(course, "course_002");
      course.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      preview?.click();
      await Promise.resolve();
    });
    expect(filters).toEqual([
      { course_id: "course_001", role: "CEO", kpis: ["revenue"] },
      { course_id: "course_002", role: "CEO", kpis: ["revenue"] }
    ]);
    expect(view.container.textContent).toContain("Current Team");
    releaseOld?.();
    await act(async () => oldReport);
    expect(view.container.textContent).not.toContain("Old Team");

    const exportButton = [...view.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Export report as JSON"
    );
    await act(async () => {
      exportButton?.click();
      await Promise.resolve();
    });
    expect(exportReport).toHaveBeenCalledWith(
      { course_id: "course_002", role: "CEO", kpis: ["revenue"] },
      "json"
    );
    expect(view.container.textContent).toContain("report.json");
    view.cleanup();
  });

  it("keeps D5 exact-reference selection and delegates preview/seal operations", async () => {
    const loadList = vi.fn(() => Promise.resolve({ reports, list }));
    const generate = vi.fn((selected: readonly D5ExactReference[]) =>
      Promise.resolve({
        aol_dataset: { rows: [{ group_key: "course_d5", sample_size: 2, suppressed: true }] },
        known_limits: [],
        source_report_refs: selected,
        statements: [{}]
      })
    );
    const submit = vi.fn((selected: readonly D5ExactReference[]) =>
      Promise.resolve({
        bundle_digest: "c".repeat(64),
        bundle_ref: exact("bundle_d5", "c".repeat(64)),
        selected
      })
    );
    const view = mount(
      <D5ExportWorkbenchView
        ariaLabel="D5 teacher evidence export workbench"
        eyebrow="L1+ Program D · D5"
        title="Evidence Export Workbench"
        badge="Teacher BFF"
        boundary="Tenant-safe export only."
        loadList={loadList}
        generate={generate}
        submit={submit}
        mapError={() => "D5 error"}
      />
    );

    await act(async () => undefined);
    const checkboxes = [
      ...view.container.querySelectorAll('input[type="checkbox"]')
    ] as HTMLInputElement[];
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes.every((checkbox) => checkbox.checked)).toBe(true);
    act(() => checkboxes[0]?.click());
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(false);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
    act(() => checkboxes[1]?.click());
    const preview = [...view.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Preview"
    );
    await act(async () => {
      preview?.click();
      await Promise.resolve();
    });
    expect(generate).toHaveBeenCalledWith([reports[1]?.report_ref]);
    expect(view.container.textContent).toContain("Preview ready");

    act(() => checkboxes[0]?.click());
    const seal = [...view.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Seal immutable bundle"
    );
    await act(async () => {
      seal?.click();
      await Promise.resolve();
    });
    expect(submit).toHaveBeenCalledWith([reports[1]?.report_ref, reports[0]?.report_ref]);
    expect(view.container.textContent).toContain("Bundle sealed");
    view.cleanup();
  });
});
