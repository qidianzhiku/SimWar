/** @vitest-environment jsdom */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TeacherScenarioStudioCatalogDto } from "@simwar/shared-contracts";
import { TeacherScenarioStudio } from "../../apps/teacher/src/TeacherScenarioStudio";
import {
  createTeacherScenarioStudioDraft,
  loadTeacherScenarioStudioCatalog
} from "../../apps/teacher/src/teacher-scenario-studio-client";

vi.mock("../../apps/teacher/src/teacher-scenario-studio-client", () => ({
  activateTeacherScenarioStudio: vi.fn(),
  createTeacherScenarioStudioDraft: vi.fn(),
  freezeTeacherScenarioStudio: vi.fn(),
  loadTeacherScenarioStudioCatalog: vi.fn(),
  previewTeacherScenarioStudio: vi.fn(),
  TeacherScenarioStudioRequestError: class extends Error {
    status = 500;
    code = "TEST_ERROR";
  },
  validateTeacherScenarioStudio: vi.fn()
}));

const baseCatalog = {
  course_blueprints: [
    {
      compatibility_constraints: {},
      course_blueprint_reference: {
        content_digest: "blueprint-digest",
        course_blueprint_id: "blueprint-1",
        tenant_id: "tenant_demo",
        version: "1.0.0"
      },
      title: "Shanghai blueprint"
    }
  ],
  model_versions: [
    { model_version_ref: "model-approved-1", provider: "OFF", status: "APPROVED" as const }
  ],
  operation_id: "TEACHER_SCENARIO_STUDIO_CATALOG_V1" as const,
  scenario_packages: [
    {
      compatibility_metadata: {},
      parameter_set_reference: {
        content_digest: "parameter-digest",
        parameter_set_id: "parameter-1",
        version: "1.0.0"
      },
      plugin_dependencies: [],
      scenario_package_reference: {
        content_digest: "scenario-digest",
        scenario_package_id: "scenario-1",
        tenant_id: "tenant_demo",
        version: "1.0.0"
      }
    }
  ]
} satisfies TeacherScenarioStudioCatalogDto;

function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  return { host, root };
}

async function renderStudio(catalog: TeacherScenarioStudioCatalogDto) {
  vi.mocked(loadTeacherScenarioStudioCatalog).mockResolvedValue(catalog);
  const view = mount();
  await act(async () => {
    view.root.render(
      <TeacherScenarioStudio apiBase="http://fixture" tenantId="tenant_demo" token="token" />
    );
  });
  return view;
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("Teacher Scenario Studio target contract", () => {
  it("blocks Create DRAFT when the approved model catalog is empty", async () => {
    const view = await renderStudio({ ...baseCatalog, model_versions: [] });

    expect(view.host.textContent).toContain("没有可用的 approved ModelVersion source");
    expect(
      (view.host.querySelector('button[data-testid="tss-primary-action"]') as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it("requires explicit model selection and exposes one dominant initial action", async () => {
    const view = await renderStudio(baseCatalog);
    const modelSelect = view.host.querySelector(
      '[aria-label="Teacher Scenario Studio ModelVersion"]'
    ) as HTMLSelectElement;
    const createButton = view.host.querySelector(
      'button[data-testid="tss-primary-action"]'
    ) as HTMLButtonElement;

    expect(modelSelect.value).toBe("");
    expect(view.host.textContent).toContain("model-approved-1");
    expect(createButton.disabled).toBe(true);
    expect(view.host.querySelectorAll('button[data-testid="tss-primary-action"]')).toHaveLength(1);
    expect(view.host.textContent).not.toContain("验证兼容性");

    await act(async () => {
      modelSelect.value = "model-approved-1";
      modelSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(createButton.disabled).toBe(false);
  });

  it("requires an explicit editable package version for each immutable candidate", async () => {
    const view = await renderStudio(baseCatalog);
    const modelSelect = view.host.querySelector(
      '[aria-label="Teacher Scenario Studio ModelVersion"]'
    ) as HTMLSelectElement;
    const versionInput = view.host.querySelector(
      '[aria-label="Teacher Scenario Studio version"]'
    ) as HTMLInputElement;

    expect(versionInput).not.toBeNull();
    await act(async () => {
      modelSelect.value = "model-approved-1";
      modelSelect.dispatchEvent(new Event("change", { bubbles: true }));
      const setVersionValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setVersionValue?.call(versionInput, "1.0.1");
      versionInput.dispatchEvent(new Event("input", { bubbles: true }));
      versionInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    vi.mocked(createTeacherScenarioStudioDraft).mockResolvedValue({
      course_package_reference: {
        content_digest: "course-digest",
        course_package_id: "candidate",
        tenant_id: "tenant_demo",
        version: "1.0.1"
      },
      operation_id: "TEACHER_SCENARIO_STUDIO_DRAFT_CREATE_V1",
      status: "DRAFT",
      studio_configuration: {} as never,
      title: "Candidate"
    });
    await act(async () => {
      (
        view.host.querySelector('button[data-testid="tss-primary-action"]') as HTMLButtonElement
      ).click();
    });

    expect(createTeacherScenarioStudioDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({ version: "1.0.1" })
      })
    );
  });

  it("does not duplicate the generic current-context landmark", async () => {
    const view = await renderStudio(baseCatalog);
    expect(view.host.querySelectorAll('[aria-label="当前上下文"]')).toHaveLength(0);
  });

  it("moves the dominant action through the lifecycle without exposing competing primaries", async () => {
    const view = await renderStudio(baseCatalog);
    const modelSelect = view.host.querySelector(
      '[aria-label="Teacher Scenario Studio ModelVersion"]'
    ) as HTMLSelectElement;
    await act(async () => {
      modelSelect.value = "model-approved-1";
      modelSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    vi.mocked(createTeacherScenarioStudioDraft).mockResolvedValue({
      course_package_reference: {
        content_digest: "course-digest",
        course_package_id: "candidate",
        tenant_id: "tenant_demo",
        version: "1.0.0"
      },
      operation_id: "TEACHER_SCENARIO_STUDIO_DRAFT_CREATE_V1",
      status: "DRAFT",
      studio_configuration: {} as never,
      title: "Candidate"
    });
    await act(async () => {
      (
        view.host.querySelector('button[data-testid="tss-primary-action"]') as HTMLButtonElement
      ).click();
    });
    expect(view.host.textContent).toContain("下一步：验证兼容性");
    expect(view.host.querySelectorAll('button[data-testid="tss-primary-action"]')).toHaveLength(1);
    expect(view.host.textContent).not.toContain("冻结候选");
  });
  it("does not commit a catalog response from a previous tenant/token context", async () => {
    let resolveA!: (catalog: TeacherScenarioStudioCatalogDto) => void;
    let resolveB!: (catalog: TeacherScenarioStudioCatalogDto) => void;
    vi.mocked(loadTeacherScenarioStudioCatalog).mockImplementation(({ token }) => {
      return new Promise((resolve) => {
        if (token === "token-a") resolveA = resolve;
        else resolveB = resolve;
      });
    });

    const view = mount();
    await act(async () => {
      view.root.render(
        <TeacherScenarioStudio apiBase="http://fixture" tenantId="tenant-a" token="token-a" />
      );
    });
    await act(async () => {
      view.root.render(
        <TeacherScenarioStudio apiBase="http://fixture" tenantId="tenant-b" token="token-b" />
      );
    });
    await act(async () => {
      resolveA({
        ...baseCatalog,
        course_blueprints: [{ ...baseCatalog.course_blueprints[0], title: "STALE" }]
      });
      resolveB(baseCatalog);
    });

    expect(view.host.textContent).not.toContain("STALE");
    await act(async () => view.root.unmount());
  });
});
