/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { CourseFactoryTeacherCatalogProjection } from "@simwar/shared-contracts";
import { CourseFactoryCatalogPanel } from "../../apps/teacher/src/CourseFactoryCatalogPanel";

const projection: CourseFactoryTeacherCatalogProjection = {
  catalog: [
    {
      course_package_reference: {
        content_digest: "a".repeat(64),
        course_package_id: "course_factory_demo",
        tenant_id: "tenant_demo",
        version: "1.0.0"
      },
      description: "Governed course package.",
      status: "PUBLISHED",
      title: "Governed course",
      version: "1.0.0"
    }
  ],
  known_limits: ["JSON runtime only"],
  tenant_id: "tenant_demo"
};

describe("Teacher Course Factory catalog", () => {
  it("does not render source references when the entry has no source context", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ code: 0, message: "ok", data: projection }),
        ok: true
      }))
    );
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <CourseFactoryCatalogPanel
          apiBase="http://api.test"
          tenantId="tenant_demo"
          token="token"
        />
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(host.textContent).not.toContain("source refs:");

    root.unmount();
    host.remove();
    vi.unstubAllGlobals();
  });
});
