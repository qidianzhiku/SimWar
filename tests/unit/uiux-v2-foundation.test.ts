import { describe, expect, it } from "vitest";
import {
  FOUNDATION_COMPONENTS,
  MIN_INTERACTIVE_TARGET_PX,
  TOKEN_SOURCE_PATH,
  UI_STATE_STATUSES
} from "../../packages/ui/src/design-system-foundation";

describe("UI/UX V2 design-system foundation contract", () => {
  it("binds the shared component catalog to existing high-leverage exports", () => {
    expect(FOUNDATION_COMPONENTS).toEqual([
      "WorkbenchFrame",
      "AuthorityBadge",
      "ContextBar",
      "StatePanel",
      "KnownLimitBanner",
      "ReceiptPanel",
      "RoleNavigation"
    ]);
  });

  it("keeps the production token source explicit", () => {
    expect(TOKEN_SOURCE_PATH).toBe("packages/ui/src/tokens.css");
  });

  it("requires a 44px minimum interactive target", () => {
    expect(MIN_INTERACTIVE_TARGET_PX).toBe(44);
  });

  it("covers the shared state grammar without inventing role-specific truth", () => {
    expect(UI_STATE_STATUSES).toEqual([
      "idle",
      "loading",
      "ready",
      "empty",
      "partial",
      "blocked",
      "stale",
      "conflict",
      "unknown",
      "permission-denied",
      "error",
      "recovered"
    ]);
  });
});
