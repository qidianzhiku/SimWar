import type {
  AuditLog,
  ProjectAwareBlocker,
  ProjectAwareBlockerAuthority,
  ProjectAwareBlockerCategory,
  ProjectAwareCourseReadiness,
  ProjectAwareLaunchReceipt,
  ProjectAwareReadinessSnapshot,
  ProjectAwareScope,
  ProjectAwareReadinessState,
  ProjectAwareTeamReadiness,
  ProjectAssignment,
  W4StateRef
} from "@simwar/shared-contracts";
import type { ProjectProfile, ProjectProfileRef } from "@simwar/shared-contracts";
import type { FormalCourseAuthorityBindingStore } from "./formal-course-authority-binding-store.js";
import type { ProjectLibraryActor, ProjectLibraryService } from "./project-library-service.js";
import type { RepositoryProvider } from "./repository-provider.js";

function sameReference(
  left: {
    tenant_id: string;
    project_profile_id: string;
    version: string;
    content_digest: string;
  },
  right: {
    tenant_id: string;
    project_profile_id: string;
    version: string;
    content_digest: string;
  }
): boolean {
  return (
    left.tenant_id === right.tenant_id &&
    left.project_profile_id === right.project_profile_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function sameTeamSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const leftSet = new Set(left);
  return leftSet.size === right.length && right.every((teamId) => leftSet.has(teamId));
}

function normalizeRole(role: string): string {
  return role === "risk" || role === "Quality & Risk" ? "COO" : role;
}

const BLOCKER_METADATA: Record<
  ProjectAwareBlocker["code"],
  {
    category: ProjectAwareBlockerCategory;
    reason: string;
    impact: string;
    source_authority: ProjectAwareBlockerAuthority;
  }
> = {
  MISSING_ASSIGNMENT: {
    category: "project_assignment",
    reason: "No exact validated ProjectProfileRef is assigned to this team.",
    impact: "Project-aware launch remains blocked for this team.",
    source_authority: "ProjectAssignment"
  },
  SCOPE_MISMATCH: {
    category: "course",
    reason: "The requested references do not belong to one exact tenant/Course/Run scope.",
    impact: "Launch cannot proceed outside the exact tenant/Course/Run scope.",
    source_authority: "Course"
  },
  CONFLICTING_ASSIGNMENT: {
    category: "project_assignment",
    reason: "More than one active ProjectAssignment matches this team scope.",
    impact: "Launch is blocked until the assignment identity is unambiguous.",
    source_authority: "ProjectAssignment"
  },
  STALE_PROFILE_DIGEST: {
    category: "project_profile",
    reason: "The exact ProjectProfile reference is missing, stale, or not validated.",
    impact:
      "Launch is blocked until the exact profile reference is restored or explicitly rebound.",
    source_authority: "ProjectProfile"
  },
  RETIRED_PROFILE: {
    category: "project_profile",
    reason: "The assigned exact ProjectProfile reference is retired.",
    impact: "Launch is blocked until an explicit approved successor rebind is completed.",
    source_authority: "ProjectProfile"
  },
  MISSING_ROLE: {
    category: "role_workflow",
    reason: "A required active role assignment is missing from the team workflow.",
    impact: "Launch is blocked until every required role seat is assigned.",
    source_authority: "RoleWorkflow"
  },
  ROUND_NOT_OPEN: {
    category: "round",
    reason: "The exact opening Round is missing or not open.",
    impact: "Launch cannot be admitted until the exact opening Round is open.",
    source_authority: "Round"
  },
  UNKNOWN_FORMAL_STATUS: {
    category: "formal_binding",
    reason: "The existing Formal Course authority status cannot be verified.",
    impact: "Launch remains in UNKNOWN_VERIFYING until the formal binding is verified.",
    source_authority: "FormalCourseAuthorityBinding"
  },
  FORMAL_BINDING_MISMATCH: {
    category: "formal_binding",
    reason: "The resolved formal authority does not match the exact launch scope.",
    impact: "Launch is blocked until the exact formal authority is restored.",
    source_authority: "FormalCourseAuthorityBinding"
  },
  RUN_NOT_FOUND: {
    category: "run",
    reason: "The exact Run is missing, inactive, or cannot be verified.",
    impact: "Launch cannot proceed without the exact active Run.",
    source_authority: "Run"
  },
  COURSE_NOT_READY: {
    category: "course",
    reason: "The exact Course is missing, inactive, or has no enrolled team in scope.",
    impact: "Launch cannot proceed until the exact Course is ready.",
    source_authority: "Course"
  }
};

function blocker(
  code: ProjectAwareBlocker["code"],
  owner: ProjectAwareBlocker["owner"],
  action: string,
  detail: string | undefined,
  scope: ProjectAwareScope,
  teamId?: string
): ProjectAwareBlocker {
  const metadata = BLOCKER_METADATA[code];
  const evidenceRef = `project-aware-readiness:${scope.tenant_id}/${scope.course_id}/${scope.run_id}${
    teamId ? `/${teamId}` : ""
  }`;
  return {
    blocker_id: `${code}${teamId ? `:${teamId}` : ""}`,
    category: metadata.category,
    code,
    owner,
    action,
    reason: metadata.reason,
    impact: metadata.impact,
    source_authority: metadata.source_authority,
    recovery_action: action,
    freshness: "FRESH_SNAPSHOT",
    evidence_ref: evidenceRef,
    ...(detail ? { detail } : {})
  };
}

function stateForBlockers(blockers: readonly ProjectAwareBlocker[]): ProjectAwareReadinessState {
  if (
    blockers.some((entry) =>
      [
        "MISSING_ASSIGNMENT",
        "SCOPE_MISMATCH",
        "CONFLICTING_ASSIGNMENT",
        "MISSING_ROLE",
        "ROUND_NOT_OPEN",
        "RUN_NOT_FOUND",
        "COURSE_NOT_READY"
      ].includes(entry.code)
    )
  ) {
    return "BLOCKED";
  }
  if (blockers.some((entry) => ["STALE_PROFILE_DIGEST", "RETIRED_PROFILE"].includes(entry.code))) {
    return "STALE";
  }
  return "READY";
}

function exactScopeIsValid(snapshot: ProjectAwareReadinessSnapshot): boolean {
  return Boolean(
    snapshot.course &&
    snapshot.course.tenant_id === snapshot.scope.tenant_id &&
    snapshot.course.course_id === snapshot.scope.course_id &&
    snapshot.run &&
    snapshot.run.tenant_id === snapshot.scope.tenant_id &&
    snapshot.run.course_id === snapshot.scope.course_id &&
    snapshot.run.run_id === snapshot.scope.run_id
  );
}

function findProfileStatusMismatch(
  snapshot: ProjectAwareReadinessSnapshot,
  reference: ProjectAwareTeamReadiness["project_profile_reference"]
): "scope" | "digest" | undefined {
  if (!reference) return undefined;
  const sameIdentity = snapshot.profiles.filter(
    (profile) =>
      profile.project_profile_id === reference.project_profile_id &&
      profile.version === reference.version
  );
  if (sameIdentity.some((profile) => profile.tenant_id !== snapshot.scope.tenant_id)) {
    return "scope";
  }
  if (sameIdentity.length > 0) return "digest";
  return undefined;
}

export function evaluateProjectAwareReadiness(
  snapshot: ProjectAwareReadinessSnapshot,
  now = new Date().toISOString()
): ProjectAwareCourseReadiness {
  const globalBlockers: ProjectAwareBlocker[] = [];
  const scopedBlocker = (
    code: ProjectAwareBlocker["code"],
    owner: ProjectAwareBlocker["owner"],
    action: string,
    detail?: string,
    teamId?: string
  ): ProjectAwareBlocker => blocker(code, owner, action, detail, snapshot.scope, teamId);
  if (!snapshot.course || snapshot.course.tenant_id !== snapshot.scope.tenant_id) {
    globalBlockers.push(
      scopedBlocker("SCOPE_MISMATCH", "teacher", "Select a Course in the active tenant.")
    );
  }
  if (!snapshot.run) {
    globalBlockers.push(
      scopedBlocker("RUN_NOT_FOUND", "teacher", "Create or select the exact Run for this Course.")
    );
  } else if (
    snapshot.run.tenant_id !== snapshot.scope.tenant_id ||
    snapshot.run.course_id !== snapshot.scope.course_id ||
    snapshot.run.run_id !== snapshot.scope.run_id
  ) {
    globalBlockers.push(
      scopedBlocker(
        "SCOPE_MISMATCH",
        "teacher",
        "Use the exact Course/Run scope without rebinding."
      )
    );
  } else if (snapshot.run.status !== "active") {
    globalBlockers.push(
      scopedBlocker(
        "RUN_NOT_FOUND",
        "teacher",
        "Use an active Run; closed Runs cannot be launched."
      )
    );
  }
  if (!snapshot.opening_round || snapshot.opening_round.status !== "open") {
    globalBlockers.push(
      scopedBlocker(
        "ROUND_NOT_OPEN",
        "teacher",
        "Open the exact first Round before launching the project-aware Course."
      )
    );
  }
  if (snapshot.course && !["active", "published"].includes(snapshot.course.status)) {
    globalBlockers.push(
      scopedBlocker("COURSE_NOT_READY", "teacher", "Publish or activate the exact Course first.")
    );
  }
  if (snapshot.formal_binding.status === "UNKNOWN") {
    globalBlockers.push(
      scopedBlocker(
        "UNKNOWN_FORMAL_STATUS",
        "platform",
        "Verify the existing Formal Course binding before launch."
      )
    );
  }

  const scopedTeams = snapshot.teams.filter(
    (team) =>
      team.tenant_id === snapshot.scope.tenant_id && team.course_id === snapshot.scope.course_id
  );
  const teams: ProjectAwareTeamReadiness[] = scopedTeams.map((team) => {
    const blockers: ProjectAwareBlocker[] = [];
    const requiredRoles = [
      ...new Set(team.members.map((member) => normalizeRole(member.role_slot)))
    ];
    const roleSnapshot = snapshot.role_workflows[team.team_id];
    const assignedRoles = [
      ...new Set(
        (roleSnapshot?.assignments ?? [])
          .filter(
            (assignment) =>
              assignment.status === "active" &&
              assignment.tenant_id === snapshot.scope.tenant_id &&
              assignment.course_id === snapshot.scope.course_id &&
              assignment.run_id === snapshot.scope.run_id &&
              assignment.team_id === team.team_id
          )
          .map((assignment) => normalizeRole(assignment.role_key))
      )
    ];
    const missingRoles = requiredRoles.filter((role) => !assignedRoles.includes(role));
    if (missingRoles.length > 0) {
      blockers.push(
        scopedBlocker(
          "MISSING_ROLE",
          "teacher",
          `Assign the missing role seat(s): ${missingRoles.join(", ")}.`,
          undefined,
          team.team_id
        )
      );
    }
    if (!roleSnapshot?.round && snapshot.run) {
      blockers.push(
        scopedBlocker(
          "RUN_NOT_FOUND",
          "platform",
          "Verify the exact open Round for this team.",
          undefined,
          team.team_id
        )
      );
    }

    const scopedAssignments = snapshot.assignments.filter(
      (assignment) =>
        assignment.tenant_id === snapshot.scope.tenant_id &&
        assignment.course_id === snapshot.scope.course_id &&
        assignment.run_id === snapshot.scope.run_id &&
        assignment.team_id === team.team_id
    );
    if (scopedAssignments.length === 0) {
      blockers.push(
        scopedBlocker(
          "MISSING_ASSIGNMENT",
          "teacher",
          "Assign one exact validated ProjectProfileRef to this team.",
          undefined,
          team.team_id
        )
      );
    }
    if (scopedAssignments.length > 1) {
      blockers.push(
        scopedBlocker(
          "CONFLICTING_ASSIGNMENT",
          "teacher",
          "Resolve the duplicate team assignment without selecting an implicit latest ref.",
          undefined,
          team.team_id
        )
      );
    }

    const assignment = scopedAssignments[0];
    const reference = assignment?.project_profile_reference;
    let successorAvailable = false;
    if (reference) {
      successorAvailable = snapshot.profiles.some(
        (profile) =>
          profile.tenant_id === snapshot.scope.tenant_id &&
          profile.course_id === snapshot.scope.course_id &&
          profile.successor_of &&
          sameReference(profile.successor_of, reference)
      );
      const matchingProfiles = snapshot.profiles.filter(
        (candidate) => reference && sameReference(candidate, reference)
      );
      const profile = matchingProfiles.at(-1);
      if (!profile) {
        const mismatch = findProfileStatusMismatch(snapshot, reference);
        blockers.push(
          scopedBlocker(
            mismatch === "scope" ? "SCOPE_MISMATCH" : "STALE_PROFILE_DIGEST",
            "teacher",
            "Restore the exact profile identity or explicitly rebind to an approved successor.",
            undefined,
            team.team_id
          )
        );
      } else {
        if (profile.status === "RETIRED") {
          blockers.push(
            scopedBlocker(
              "RETIRED_PROFILE",
              "teacher",
              "Explicitly rebind this team to an approved successor; no automatic rebind is allowed.",
              undefined,
              team.team_id
            )
          );
        } else if (profile.status !== "VALIDATED") {
          blockers.push(
            scopedBlocker(
              "STALE_PROFILE_DIGEST",
              "teacher",
              "Validate the exact ProjectProfile before launch.",
              undefined,
              team.team_id
            )
          );
        }
        if (
          snapshot.course?.market_world_reference &&
          JSON.stringify(snapshot.course.market_world_reference) !==
            JSON.stringify(profile.market_world_reference)
        ) {
          blockers.push(
            scopedBlocker(
              "SCOPE_MISMATCH",
              "teacher",
              "Use a ProjectProfile bound to the Course's exact MarketWorldRef.",
              undefined,
              team.team_id
            )
          );
        }
      }
    }

    return {
      team_id: team.team_id,
      team_name: team.name,
      state: stateForBlockers(blockers),
      blockers,
      role_keys: requiredRoles,
      assigned_role_keys: assignedRoles,
      ...(reference ? { project_profile_reference: structuredClone(reference) } : {}),
      successor_available: successorAvailable
    };
  });

  if (!exactScopeIsValid(snapshot) && globalBlockers.length === 0) {
    globalBlockers.push(
      scopedBlocker("SCOPE_MISMATCH", "teacher", "Use the exact tenant/course/run references.")
    );
  }
  if (scopedTeams.length === 0) {
    globalBlockers.push(
      scopedBlocker(
        "COURSE_NOT_READY",
        "teacher",
        "Enroll at least one exact team in this Course/Run."
      )
    );
  }
  const allBlockers = [...globalBlockers, ...teams.flatMap((team) => team.blockers)];
  const teamStates = teams.map((team) => team.state);
  let state: ProjectAwareReadinessState = "READY";
  if (allBlockers.some((entry) => ["BLOCKED"].includes(stateForBlockers([entry])))) {
    state = "BLOCKED";
  } else if (allBlockers.some((entry) => stateForBlockers([entry]) === "STALE")) {
    state = "STALE";
  } else if (snapshot.formal_binding.status === "UNKNOWN") {
    state = "UNKNOWN_VERIFYING";
  } else if (teamStates.some((teamState) => teamState !== "READY")) {
    state = teamStates.includes("BLOCKED") ? "BLOCKED" : "STALE";
  }

  return {
    schema_version: "project-aware-launch.v1",
    scope: structuredClone(snapshot.scope),
    state,
    blockers: allBlockers,
    teams,
    formal_binding: structuredClone(snapshot.formal_binding),
    generated_at: now
  };
}

export interface ProjectAwareCourseLaunchActor extends ProjectLibraryActor {
  actor_role: "teacher" | "tenant_admin" | "platform_admin";
}

export interface ProjectAwareCourseLaunchScope {
  tenant_id: string;
  course_id: string;
  run_id: string;
}

export interface ProjectAwareCourseLaunchDependencies {
  projectLibrary: Pick<
    ProjectLibraryService,
    "getAssignmentsForScope" | "getProfilesForCourse" | "getByReference"
  >;
  repositoryProvider: RepositoryProvider;
  formalCourseAuthorityBindingStore: Pick<FormalCourseAuthorityBindingStore, "getForCourse">;
  ensureFormalRunOpen?: (
    actor: ProjectAwareCourseLaunchActor,
    scope: ProjectAwareCourseLaunchScope
  ) => Promise<{ binding_digest?: string }>;
  ensureTeamInitialState?: (
    actor: ProjectAwareCourseLaunchActor,
    scope: ProjectAwareCourseLaunchScope,
    assignment: ProjectAssignment,
    profile: ProjectProfile
  ) => Promise<{ state_ref?: W4StateRef }>;
  now?: () => string;
}

export class ProjectAwareCourseLaunchError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ProjectAwareCourseLaunchError";
  }
}

export class ProjectAwareCourseLaunchService {
  private readonly now: () => string;
  private readonly launchLocks = new Map<string, Promise<void>>();

  constructor(private readonly dependencies: ProjectAwareCourseLaunchDependencies) {
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  async getReadiness(
    actor: ProjectAwareCourseLaunchActor,
    scope: ProjectAwareCourseLaunchScope
  ): Promise<ProjectAwareCourseReadiness> {
    if (
      !["teacher", "tenant_admin", "platform_admin"].includes(actor.actor_role) ||
      actor.tenant_id !== scope.tenant_id
    ) {
      throw new ProjectAwareCourseLaunchError("PROJECT_AWARE_TEACHER_SCOPE_VIOLATION");
    }
    const [course, run, teams, assignments, profiles, rounds] = await Promise.all([
      this.dependencies.repositoryProvider.facade.courses.getCourse(
        scope.tenant_id,
        scope.course_id
      ),
      this.dependencies.repositoryProvider.facade.runs.getRun(scope.tenant_id, scope.run_id),
      this.dependencies.repositoryProvider.facade.teams.listTeamsForRun(
        scope.tenant_id,
        scope.run_id
      ),
      this.dependencies.projectLibrary.getAssignmentsForScope(actor, {
        course_id: scope.course_id,
        run_id: scope.run_id
      }),
      this.dependencies.projectLibrary.getProfilesForCourse(actor, scope.course_id),
      this.dependencies.repositoryProvider.facade.rounds.listRoundsForRun(
        scope.tenant_id,
        scope.run_id
      )
    ]);
    const openingRound = rounds.find((round) => round.round_no === 1) ?? rounds[0];
    const roleEntries = await Promise.all(
      teams.map(async (team) => {
        const workflow =
          await this.dependencies.repositoryProvider.ports.roleWorkflow.readRoleWorkflow({
            run_id: scope.run_id,
            team_id: team.team_id,
            tenant_id: scope.tenant_id,
            ...(openingRound ? { round_id: openingRound.round_id } : {})
          });
        return [
          team.team_id,
          { assignments: workflow.assignments, round: workflow.round }
        ] as const;
      })
    );
    const binding = this.dependencies.formalCourseAuthorityBindingStore.getForCourse(
      scope.tenant_id,
      scope.course_id
    );
    const snapshot: ProjectAwareReadinessSnapshot = {
      scope,
      course,
      run,
      teams,
      assignments,
      profiles,
      opening_round: openingRound ?? null,
      role_workflows: Object.fromEntries(roleEntries),
      formal_binding: binding
        ? { status: "BOUND", binding_digest: binding.binding_digest }
        : { status: "UNKNOWN" }
    };
    return evaluateProjectAwareReadiness(snapshot, this.now());
  }

  async resolveExactProfile(
    actor: ProjectAwareCourseLaunchActor,
    reference: ProjectProfileRef
  ): Promise<ProjectProfile | null> {
    if (actor.actor_role !== "teacher") {
      throw new ProjectAwareCourseLaunchError("PROJECT_AWARE_TEACHER_SCOPE_VIOLATION");
    }
    return this.dependencies.projectLibrary.getByReference(actor.tenant_id, reference);
  }

  async launch(
    actor: ProjectAwareCourseLaunchActor,
    scope: ProjectAwareCourseLaunchScope,
    commandIdempotencyKey: string
  ): Promise<ProjectAwareLaunchReceipt> {
    const key = `${scope.tenant_id}:${commandIdempotencyKey}`;
    const previous = this.launchLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.catch(() => undefined).then(() => current);
    this.launchLocks.set(key, queued);
    await previous.catch(() => undefined);
    try {
      return await this.launchUnlocked(actor, scope, commandIdempotencyKey);
    } finally {
      release();
      if (this.launchLocks.get(key) === queued) this.launchLocks.delete(key);
    }
  }

  private async launchUnlocked(
    actor: ProjectAwareCourseLaunchActor,
    scope: ProjectAwareCourseLaunchScope,
    commandIdempotencyKey: string
  ): Promise<ProjectAwareLaunchReceipt> {
    if (actor.actor_role !== "teacher") {
      throw new ProjectAwareCourseLaunchError("PROJECT_AWARE_TEACHER_SCOPE_VIOLATION");
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(commandIdempotencyKey)) {
      throw new ProjectAwareCourseLaunchError("PROJECT_AWARE_IDEMPOTENCY_KEY_INVALID");
    }
    if (
      /(?:^|[._:-])(?:latest|current|default|fallback|next|any)(?:$|[._:-])/i.test(
        commandIdempotencyKey
      )
    ) {
      throw new ProjectAwareCourseLaunchError("PROJECT_AWARE_IDENTITY_ALIAS_FORBIDDEN");
    }
    const existing = await this.findReceipt(actor.tenant_id, commandIdempotencyKey);
    if (existing) {
      const currentReadiness = await this.getReadiness(actor, scope);
      if (
        existing.course_id !== scope.course_id ||
        existing.run_id !== scope.run_id ||
        existing.tenant_id !== scope.tenant_id ||
        !sameTeamSet(
          existing.team_ids,
          currentReadiness.teams.map((team) => team.team_id)
        )
      ) {
        throw new ProjectAwareCourseLaunchError("PROJECT_AWARE_IDEMPOTENCY_CONFLICT");
      }
      return { ...existing, status: "REUSED" };
    }
    const readiness = await this.getReadiness(actor, scope);
    if (readiness.state !== "READY") {
      throw new ProjectAwareCourseLaunchError(
        `PROJECT_AWARE_READINESS_NOT_READY:${readiness.state}`
      );
    }
    const formal = this.dependencies.ensureFormalRunOpen
      ? await this.dependencies.ensureFormalRunOpen(actor, scope)
      : undefined;
    if (!formal) {
      throw new ProjectAwareCourseLaunchError("PROJECT_AWARE_FORMAL_RUN_NOT_OPEN");
    }
    const assignments = await this.dependencies.projectLibrary.getAssignmentsForScope(actor, {
      course_id: scope.course_id,
      run_id: scope.run_id
    });
    const w4StateRefs: Record<string, string> = {};
    if (this.dependencies.ensureTeamInitialState) {
      const profiles = await this.dependencies.projectLibrary.getProfilesForCourse(
        actor,
        scope.course_id
      );
      for (const team of readiness.teams) {
        const assignment = assignments.find((candidate) => candidate.team_id === team.team_id);
        const profile = profiles.find(
          (candidate) =>
            team.project_profile_reference &&
            sameReference(candidate, team.project_profile_reference)
        );
        if (!assignment || !profile) {
          throw new ProjectAwareCourseLaunchError("PROJECT_AWARE_READINESS_CHANGED");
        }
        const initial = await this.dependencies.ensureTeamInitialState(
          actor,
          scope,
          assignment,
          profile
        );
        if (initial.state_ref) {
          w4StateRefs[team.team_id] = initial.state_ref.enterprise_state_id;
        }
      }
    }
    const createdAt = this.now();
    const audit = await this.appendLaunchAudit(actor, scope, commandIdempotencyKey, {
      created_at: createdAt,
      readiness_generated_at: readiness.generated_at,
      team_ids: readiness.teams.map((team) => team.team_id),
      ...(formal.binding_digest ? { formal_binding_digest: formal.binding_digest } : {})
    });
    const receipt: ProjectAwareLaunchReceipt = {
      schema_version: "project-aware-launch.v1",
      command_idempotency_key: commandIdempotencyKey,
      status: "ACCEPTED",
      tenant_id: scope.tenant_id,
      course_id: scope.course_id,
      run_id: scope.run_id,
      team_ids: readiness.teams.map((team) => team.team_id),
      readiness_state: "READY",
      readiness_generated_at: readiness.generated_at,
      ...(formal.binding_digest ? { formal_binding_digest: formal.binding_digest } : {}),
      ...(Object.keys(w4StateRefs).length > 0 ? { w4_state_refs: w4StateRefs } : {}),
      audit_id: audit.audit_id,
      created_at: createdAt
    };
    return this.replaceAuditReceipt(audit, receipt);
  }

  async getAdminReadiness(
    actor: {
      actor_id: string;
      actor_role: "tenant_admin" | "platform_admin";
      tenant_id: string;
    },
    scope: ProjectAwareCourseLaunchScope
  ): Promise<ProjectAwareCourseReadiness> {
    return this.getReadiness(
      { actor_id: actor.actor_id, actor_role: "teacher", tenant_id: actor.tenant_id },
      scope
    );
  }

  async readLaunchReceipt(
    tenantId: string,
    commandIdempotencyKey: string
  ): Promise<ProjectAwareLaunchReceipt | null> {
    return this.findReceipt(tenantId, commandIdempotencyKey);
  }

  private async findReceipt(
    tenantId: string,
    commandIdempotencyKey: string
  ): Promise<ProjectAwareLaunchReceipt | null> {
    const logs = await this.dependencies.repositoryProvider.facade.auditLogs.listAuditLogs({
      action: "project-aware.launch.receipt",
      scope: "tenant",
      tenant_id: tenantId
    });
    const log = logs.find(
      (candidate) =>
        candidate.request_id === commandIdempotencyKey &&
        candidate.after &&
        typeof candidate.after.receipt === "object"
    );
    if (!log?.after?.receipt) return null;
    const receipt = log.after.receipt as ProjectAwareLaunchReceipt;
    return receipt.schema_version === "project-aware-launch.v1" ? receipt : null;
  }

  private async appendLaunchAudit(
    actor: ProjectAwareCourseLaunchActor,
    scope: ProjectAwareCourseLaunchScope,
    commandIdempotencyKey: string,
    metadata: {
      created_at: string;
      formal_binding_digest?: string;
      readiness_generated_at: string;
      team_ids: readonly string[];
    }
  ): Promise<AuditLog> {
    const audit: AuditLog = {
      audit_id: this.dependencies.repositoryProvider.idGenerator.createAuditLogId(),
      tenant_id: scope.tenant_id,
      actor_id: actor.actor_id,
      actor_role: "teacher",
      action: "project-aware.launch",
      resource_type: "course",
      resource_id: scope.course_id,
      request_id: commandIdempotencyKey,
      created_at: metadata.created_at,
      after: {
        course_id: scope.course_id,
        run_id: scope.run_id,
        team_ids: [...metadata.team_ids],
        readiness_generated_at: metadata.readiness_generated_at,
        ...(metadata.formal_binding_digest
          ? { formal_binding_digest: metadata.formal_binding_digest }
          : {})
      }
    };
    await this.dependencies.repositoryProvider.facade.auditLogs.appendAuditLog(audit);
    return audit;
  }

  private async replaceAuditReceipt(
    audit: AuditLog,
    receipt: ProjectAwareLaunchReceipt
  ): Promise<ProjectAwareLaunchReceipt> {
    // AuditLog is append-only in the repository contract. The receipt is written as
    // a second immutable lineage record with the same command key so retries can
    // read back the exact accepted receipt without creating another Run.
    const receiptAuditId = this.dependencies.repositoryProvider.idGenerator.createAuditLogId();
    const persistedReceipt = { ...receipt, audit_id: receiptAuditId };
    const receiptAudit: AuditLog = {
      ...audit,
      audit_id: receiptAuditId,
      action: "project-aware.launch.receipt",
      after: { receipt: persistedReceipt }
    };
    await this.dependencies.repositoryProvider.facade.auditLogs.appendAuditLog(receiptAudit);
    return persistedReceipt;
  }
}
