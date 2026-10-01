import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatePanel } from "../../packages/ui/src/components/StatePanel";

describe("shared state recovery grammar", () => {
  it("renders recovered as a first-class state", () => {
    const markup = renderToStaticMarkup(
      <StatePanel status="recovered" message="已恢复到当前 exact context。" />
    );

    expect(markup).toContain('data-state="recovered"');
    expect(markup).toMatch(/<h2[^>]*>已恢复<\/h2>/);
  });
});
