/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { GsiCrossRoundInsightPanel } from "../../packages/ui/src/components/GsiCrossRoundInsightPanel";

describe("legacy GSI cross-round compatibility shell", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("does not expose candidate handoff or selector data", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => {
      root.render(
        <GsiCrossRoundInsightPanel
          apiBase="http://api.test"
          surface="student"
          tenantId="tenant_demo"
          token="test-token"
        >
          <p>Role-local GSI-XR surface owns server-governed round selection.</p>
        </GsiCrossRoundInsightPanel>
      );
    });

    expect(host.textContent).toContain("server-governed round selection");
    expect(host.textContent).not.toContain("candidate_id");
    expect(host.textContent).not.toContain("gsiFromCandidateId");
    expect(host.textContent).not.toContain("gsiToCandidateId");
    act(() => root.unmount());
  });
});
