export const REAUTH_CONTEXT_STORAGE_KEY = "simwar.reauth-context.v1";

export interface ReauthContext {
  schema_version: 1;
  tenant_id: string;
  user_id: string;
  role: string;
  course_id: string;
  run_id: string;
  team_id: string;
  round_id: string;
  round_no: number;
  route: string;
  view: string;
}

export interface ReauthIdentity {
  tenant_id: string;
  user_id: string;
  roles: readonly string[];
  role_slots?: readonly string[];
}

export type ReauthIdentityValidation =
  | { status: "RESTORE_ALLOWED" }
  | { status: "CONTEXT_UNAUTHORIZED"; reason: "TENANT_MISMATCH" | "USER_OR_ROLE_MISMATCH" };

export interface ReauthBusinessContext {
  course_id: string;
  run_id: string;
  team_id: string;
  round_id: string;
  round_no: number;
}

const REAUTH_CONTEXT_KEYS = new Set<keyof ReauthContext>([
  "schema_version",
  "tenant_id",
  "user_id",
  "role",
  "course_id",
  "run_id",
  "team_id",
  "round_id",
  "round_no",
  "route",
  "view"
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512;
}

export function parseReauthContext(serialized: string | null | undefined): ReauthContext | null {
  if (!serialized) return null;

  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    return null;
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some((key) => !REAUTH_CONTEXT_KEYS.has(key as keyof ReauthContext)) ||
    record.schema_version !== 1 ||
    !isNonEmptyString(record.tenant_id) ||
    !isNonEmptyString(record.user_id) ||
    !isNonEmptyString(record.role) ||
    !isNonEmptyString(record.course_id) ||
    !isNonEmptyString(record.run_id) ||
    !isNonEmptyString(record.team_id) ||
    !isNonEmptyString(record.round_id) ||
    !Number.isSafeInteger(record.round_no) ||
    !isNonEmptyString(record.route) ||
    !isNonEmptyString(record.view)
  ) {
    return null;
  }

  return record as unknown as ReauthContext;
}

export function serializeReauthContext(context: ReauthContext): string {
  return JSON.stringify(context);
}

export function validateReauthIdentity(
  context: ReauthContext,
  identity: ReauthIdentity
): ReauthIdentityValidation {
  if (context.tenant_id !== identity.tenant_id) {
    return { status: "CONTEXT_UNAUTHORIZED", reason: "TENANT_MISMATCH" };
  }

  const roleMatches =
    context.role === "teacher"
      ? identity.roles.includes("teacher")
      : context.role === "student" || context.role === "learner"
        ? identity.roles.some(
            (role) => role === "student" || role === "learner" || role === "team_captain"
          )
        : identity.role_slots === undefined || identity.role_slots.includes(context.role);

  if (context.user_id !== identity.user_id || !roleMatches) {
    return { status: "CONTEXT_UNAUTHORIZED", reason: "USER_OR_ROLE_MISMATCH" };
  }

  return { status: "RESTORE_ALLOWED" };
}

/**
 * Re-auth navigation state belongs only to the same authenticated principal.
 * A same-tenant login as a different user is an explicit identity switch, not
 * a request to restore the previous user's business context.
 */
export function isSameReauthPrincipal(
  context: ReauthContext,
  identity: Pick<ReauthIdentity, "tenant_id" | "user_id">
): boolean {
  return context.tenant_id === identity.tenant_id && context.user_id === identity.user_id;
}

export function isSameReauthBusinessContext(
  context: ReauthContext,
  observed: ReauthBusinessContext
): boolean {
  return (
    context.course_id === observed.course_id &&
    context.run_id === observed.run_id &&
    context.team_id === observed.team_id &&
    context.round_id === observed.round_id &&
    context.round_no === observed.round_no
  );
}
