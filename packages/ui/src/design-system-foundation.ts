/**
 * Source-bound Phase 1 contract for the shared SimWar UI foundation.
 *
 * These are implementation-facing descriptors, not a second domain model.
 * Product state and authority remain owned by the existing app contracts and
 * server-backed flows.
 */

export const TOKEN_SOURCE_PATH = "packages/ui/src/tokens.css" as const;

export const MIN_INTERACTIVE_TARGET_PX = 44 as const;

export const FOUNDATION_COMPONENTS = [
  "WorkbenchFrame",
  "AuthorityBadge",
  "ContextBar",
  "StatePanel",
  "KnownLimitBanner",
  "ReceiptPanel",
  "RoleNavigation"
] as const;

export const UI_STATE_STATUSES = [
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
] as const;

export type FoundationComponent = (typeof FOUNDATION_COMPONENTS)[number];
export type UiStateStatus = (typeof UI_STATE_STATUSES)[number];
