import {
  isW3OfficialConsequenceContext,
  normalizeW027RoleKey,
  validateReauthIdentity,
  type AuthSession,
  type P0DemoState,
  type ReauthContext,
  type StudentBffCockpitDTO,
  type W3OfficialConsequenceContext
} from "@simwar/shared-contracts";

export type StudentRequestContext =
  | { kind: "ABSENT" }
  | { kind: "INVALID" }
  | { kind: "EXACT"; context: W3OfficialConsequenceContext };

/** URL is intent only. App must bind it to the authenticated server projection. */
export function readStudentRequestContext(search: string): StudentRequestContext {
  const params = new URLSearchParams(search);
  const keys = [
    "tenant_id",
    "course_id",
    "run_id",
    "team_id",
    "round_id",
    "round_no",
    "role_key",
    "activity_id"
  ] as const;
  if (!params.has("w3") && !keys.some((key) => params.has(key))) return { kind: "ABSENT" };
  if (params.getAll("w3").length !== 1 || params.get("w3") !== "true") return { kind: "INVALID" };
  const values = Object.fromEntries(keys.map((key) => [key, params.get(key)]));
  if (
    keys.some(
      (key) =>
        params.getAll(key).length !== 1 || !values[key] || values[key]?.trim() !== values[key]
    )
  )
    return { kind: "INVALID" };
  const round = Number(values.round_no);
  if (!Number.isSafeInteger(round) || round < 1 || !/^\d+$/.test(values.round_no!))
    return { kind: "INVALID" };
  const context = { ...values, round_no: round };
  if (!isW3OfficialConsequenceContext(context)) return { kind: "INVALID" };
  return {
    kind: "EXACT",
    context
  };
}

export function resolveStudentSelection(
  source: P0DemoState,
  selected: W3OfficialConsequenceContext | ReauthContext | undefined,
  exact: W3OfficialConsequenceContext | undefined,
  session: AuthSession,
  tenant: string
): {
  error?: "CONTEXT_NOT_FOUND" | "CONTEXT_UNAUTHORIZED" | undefined;
  run?: P0DemoState["runs"][number] | undefined;
  round?: P0DemoState["rounds"][number] | undefined;
  team?: P0DemoState["teams"][number] | undefined;
  context?: W3OfficialConsequenceContext | undefined;
} {
  const run = selected
    ? source.runs.find((r) => r.run_id === selected.run_id && r.course_id === selected.course_id)
    : source.runs.at(-1);
  const round = run
    ? source.rounds.find(
        (r) =>
          r.run_id === run.run_id &&
          (!selected || (r.round_id === selected.round_id && r.round_no === selected.round_no))
      )
    : undefined;
  const team = source.teams.find(
    (t) => t.tenant_id === tenant && t.team_id === source.current_user.team_id
  );
  if (selected && (!run || !round)) return { error: "CONTEXT_NOT_FOUND" } as const;
  if (selected && (!team || team.team_id !== selected.team_id))
    return { error: "CONTEXT_UNAUTHORIZED" } as const;
  const member = team?.members.find((m) => m.user_id === session.user.user_id);
  if (
    exact &&
    (exact.tenant_id !== tenant ||
      exact.tenant_id !== session.user.tenant_id ||
      source.current_user.user_id !== session.user.user_id ||
      !member ||
      normalizeW027RoleKey(member.role_slot) !== exact.role_key ||
      exact.activity_id !== "activity_consequence")
  )
    return { error: "CONTEXT_UNAUTHORIZED" } as const;
  if (
    selected &&
    !exact &&
    validateReauthIdentity(selected as ReauthContext, {
      tenant_id: source.current_user.tenant_id,
      user_id: source.current_user.user_id,
      roles: session.user.roles,
      role_slots:
        team?.members.filter((m) => m.user_id === session.user.user_id).map((m) => m.role_slot) ??
        []
    }).status !== "RESTORE_ALLOWED"
  )
    return { error: "CONTEXT_UNAUTHORIZED" } as const;
  const context =
    run && round && team && member
      ? (exact ?? {
          tenant_id: tenant,
          course_id: run.course_id,
          run_id: run.run_id,
          team_id: team.team_id,
          round_id: round.round_id,
          round_no: round.round_no,
          role_key: normalizeW027RoleKey(member.role_slot),
          activity_id: "activity_consequence"
        })
      : undefined;
  return { error: undefined, run, round, team, context };
}

export function matchesStudentCockpit(
  selected: W3OfficialConsequenceContext | ReauthContext,
  cockpit: StudentBffCockpitDTO,
  tenant: string
): boolean {
  return (
    [
      cockpit?.student_cockpit,
      cockpit?.decision_form,
      cockpit?.published_result,
      cockpit?.learning_report,
      cockpit?.three_part_feedback
    ].every(
      (projection) =>
        projection?.tenant_id === tenant &&
        (["course_id", "run_id", "team_id", "round_id", "round_no"] as const).every(
          (key) => selected[key] === projection[key]
        ) &&
        Array.isArray(projection.allowed_actions) &&
        projection.allowed_actions.every((x) => typeof x === "string") &&
        Array.isArray(projection.forbidden_fields) &&
        Array.isArray(projection.advisory_slots)
    ) &&
    typeof cockpit.student_cockpit.visible_state?.team_name === "string" &&
    ["draft", "open", "locked", "settled", "published"].includes(
      cockpit.student_cockpit.visible_state.round_status
    ) &&
    Array.isArray(cockpit.decision_form.editable_fields) &&
    cockpit.decision_form.editable_fields.every((x) => typeof x === "string") &&
    cockpit.decision_form.decision_schema_version === "m1-decision-form.v1" &&
    typeof cockpit.published_result.result_label === "string" &&
    Boolean(
      cockpit.three_part_feedback.feedback &&
      typeof cockpit.three_part_feedback.feedback === "object"
    ) &&
    cockpit.learning_report.learning_evidence?.advisory_only === true &&
    cockpit.learning_report.learning_evidence.formal_grade === false &&
    Array.isArray(cockpit.learning_report.learning_evidence.prompts) &&
    cockpit.learning_report.learning_evidence.prompts.every((x) => typeof x === "string")
  );
}

/** DDT success proves the server checked the active assignment and activity.
 * Its Student projection deliberately does not echo tenant/activity. */
export function matchesAuthorizedSpine(
  value: unknown,
  context: W3OfficialConsequenceContext
): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const scope = v.exact_context as Record<string, unknown> | undefined;
  return (
    v.schema_version === "decision-thread-evidence-spine.v1" &&
    v.surface === "student" &&
    v.provider === "OFF" &&
    v.non_causal === true &&
    v.causal_proof === false &&
    v.official_truth_write === false &&
    v.formal_write_count === 0 &&
    Boolean(scope) &&
    (["course_id", "run_id", "team_id", "round_id", "round_no", "role_key"] as const).every(
      (key) => scope?.[key] === context[key]
    )
  );
}

export function studentSpineQuery(context: W3OfficialConsequenceContext): string {
  return new URLSearchParams(
    Object.fromEntries(
      (
        [
          "course_id",
          "run_id",
          "team_id",
          "round_id",
          "round_no",
          "role_key",
          "activity_id"
        ] as const
      ).map((key) => [key, String(context[key])])
    )
  ).toString();
}
