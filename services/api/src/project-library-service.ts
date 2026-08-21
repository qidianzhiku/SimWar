import { createHash } from "node:crypto";
import type {
  ProjectAssignment,
  ProjectAssignmentInput,
  ProjectAssignmentResult,
  ProjectLibraryAdminAuditProjection,
  ProjectLibraryErrorCode,
  ProjectProfile,
  ProjectProfileCloneInput,
  ProjectProfileCreateInput,
  ProjectProfileDraftInput,
  ProjectProfileImportInput,
  ProjectProfileProvenance,
  ProjectProfileReadiness,
  ProjectProfileRef,
  ProjectProfileReferenceInput,
  ProjectProfileStudentBrief,
  ProjectProfileSuccessorInput,
  ProjectProfileTeacherProjection
} from "@simwar/shared-contracts";
import { createMarketWorldReference } from "@simwar/shared-contracts";
import {
  assertMarketWorldProductIntegrity,
  getShanghaiMarketWorldReference
} from "./market-world-product.js";
import type { SimWarStore } from "./store.js";

export interface ProjectLibraryActor {
  actor_id: string;
  tenant_id: string;
}

export interface StudentProjectBriefContext {
  course_id: string;
  run_id: string;
  team_id: string;
  tenant_id: string;
  user_id: string;
}

export class ProjectLibraryError extends Error {
  constructor(readonly code: ProjectLibraryErrorCode) {
    super(code);
    this.name = "ProjectLibraryError";
  }
}

const PROFILE_INPUT_KEYS = new Set([
  "customer_segment",
  "description",
  "geography",
  "industry",
  "market_world_reference",
  "positioning",
  "project_profile_id",
  "service_bundle",
  "starting_capacity",
  "starting_cash",
  "template_id",
  "title",
  "version"
]);
const ALIAS_PATTERN = /(?:^|[._:-])(?:latest|current|default|fallback|next|any)(?:$|[._:-])/i;
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,127}$/;
const VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}[.-][A-Za-z0-9][A-Za-z0-9._-]*$/;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function assertActor(actor: ProjectLibraryActor): void {
  if (!actor.actor_id.trim() || !actor.tenant_id.trim()) {
    throw new ProjectLibraryError("PROJECT_PROFILE_TENANT_SCOPE_VIOLATION");
  }
}

function assertSafeString(value: unknown, code: ProjectLibraryErrorCode): asserts value is string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > 2000 ||
    /(?:[A-Za-z]:\\|\/etc\/|raw_source|secret|token|password|private_key|executable)/i.test(value)
  ) {
    throw new ProjectLibraryError(code);
  }
}

function assertProfileIdentity(
  value: unknown,
  code: ProjectLibraryErrorCode
): asserts value is string {
  if (typeof value !== "string" || !ID_PATTERN.test(value) || ALIAS_PATTERN.test(value)) {
    throw new ProjectLibraryError(code);
  }
}

function assertVersion(value: unknown, code: ProjectLibraryErrorCode): asserts value is string {
  if (typeof value !== "string" || !VERSION_PATTERN.test(value) || ALIAS_PATTERN.test(value)) {
    throw new ProjectLibraryError(code);
  }
}

function normalizeReference(reference: ProjectProfileRef): ProjectProfileRef {
  if (!reference || typeof reference !== "object") {
    throw new ProjectLibraryError("PROJECT_PROFILE_IDENTITY_INVALID");
  }
  assertProfileIdentity(reference.project_profile_id, "PROJECT_PROFILE_IDENTITY_INVALID");
  assertVersion(reference.version, "PROJECT_PROFILE_IDENTITY_INVALID");
  if (
    typeof reference.tenant_id !== "string" ||
    reference.tenant_id.trim().length === 0 ||
    ALIAS_PATTERN.test(reference.tenant_id) ||
    typeof reference.content_digest !== "string" ||
    !/^[a-f0-9]{64}$/.test(reference.content_digest)
  ) {
    throw new ProjectLibraryError("PROJECT_PROFILE_IDENTITY_INVALID");
  }
  return {
    content_digest: reference.content_digest,
    project_profile_id: reference.project_profile_id,
    tenant_id: reference.tenant_id,
    version: reference.version
  };
}

function sameProfileReference(left: ProjectProfileRef, right: ProjectProfileRef): boolean {
  return (
    left.tenant_id === right.tenant_id &&
    left.project_profile_id === right.project_profile_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function sameMarketWorldReference(
  left: NonNullable<ProjectProfile["market_world_reference"]>,
  right: NonNullable<ProjectProfile["market_world_reference"]>
): boolean {
  return (
    left.market_world_id === right.market_world_id &&
    left.version === right.version &&
    left.digest === right.digest
  );
}

function normalizeFutureEffectiveAt(value: unknown): string {
  if (typeof value !== "string" || !value.includes("T")) {
    throw new ProjectLibraryError("PROJECT_PROFILE_INPUT_INVALID");
  }
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime()) || timestamp.getTime() <= Date.now()) {
    throw new ProjectLibraryError("PROJECT_PROFILE_INPUT_INVALID");
  }
  return timestamp.toISOString();
}

function assertClosedDraft(input: ProjectProfileDraftInput, code: ProjectLibraryErrorCode): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ProjectLibraryError(code);
  }
  const keys = Object.keys(input as unknown as Record<string, unknown>);
  if (keys.some((key) => !PROFILE_INPUT_KEYS.has(key)) || keys.length !== PROFILE_INPUT_KEYS.size) {
    throw new ProjectLibraryError(code);
  }
  assertProfileIdentity(input.project_profile_id, code);
  assertVersion(input.version, code);
  for (const value of [
    input.description,
    input.title,
    input.template_id,
    input.customer_segment,
    input.geography,
    input.industry,
    input.positioning,
    input.service_bundle
  ]) {
    assertSafeString(value, code);
  }
  if (
    typeof input.starting_capacity !== "number" ||
    !Number.isFinite(input.starting_capacity) ||
    input.starting_capacity < 0 ||
    typeof input.starting_cash !== "number" ||
    !Number.isFinite(input.starting_cash) ||
    input.starting_cash < 0
  ) {
    throw new ProjectLibraryError(code);
  }
  try {
    createMarketWorldReference(input.market_world_reference);
  } catch {
    throw new ProjectLibraryError(code);
  }
  assertMarketWorldProductIntegrity();
  if (!sameMarketWorldReference(input.market_world_reference, getShanghaiMarketWorldReference())) {
    throw new ProjectLibraryError(code);
  }
}

function latestByIdentity(profiles: readonly ProjectProfile[]): ProjectProfile[] {
  const latest = new Map<string, ProjectProfile>();
  for (const profile of profiles) {
    latest.set(
      `${profile.tenant_id}:${profile.course_id}:${profile.project_profile_id}:${profile.version}`,
      profile
    );
  }
  return [...latest.values()];
}

function profileReference(profile: ProjectProfile): ProjectProfileRef {
  return {
    content_digest: profile.content_digest,
    project_profile_id: profile.project_profile_id,
    tenant_id: profile.tenant_id,
    version: profile.version
  };
}

function profileReadiness(
  profile: ProjectProfile,
  allProfiles: readonly ProjectProfile[],
  course: { market_world_reference?: ProjectProfile["market_world_reference"] }
): ProjectProfileReadiness[] {
  const readiness: ProjectProfileReadiness[] = [];
  if (profile.status === "DRAFT") readiness.push("DRAFT");
  if (profile.status === "VALIDATED") readiness.push("READY");
  if (profile.status === "RETIRED") readiness.push("RETIRED");
  if (
    !course.market_world_reference ||
    !sameMarketWorldReference(course.market_world_reference, profile.market_world_reference)
  ) {
    readiness.push("DEPENDENCY_MISSING");
  }
  if (
    allProfiles.some(
      (candidate) =>
        candidate.course_id === profile.course_id &&
        candidate.successor_of &&
        sameProfileReference(candidate.successor_of, profileReference(profile))
    )
  ) {
    readiness.push("SUCCESSOR_AVAILABLE");
  }
  return readiness;
}

function studentBrief(profile: ProjectProfile): ProjectProfileStudentBrief {
  return {
    brief_kind: "PROJECT_BRIEF",
    customer_segment: profile.customer_segment,
    description: profile.description,
    geography: profile.geography,
    industry: profile.industry,
    known_limits: [
      "Project Profile is provenance/configuration context, not Runtime Authority.",
      "Runtime behavior is determined by the exact CoursePackage and FormalRunRuntimeBinding.",
      "Only the assigned role-safe teaching fields are exposed."
    ],
    market_world_reference: clone(profile.market_world_reference),
    positioning: profile.positioning,
    project_profile_reference: profileReference(profile),
    service_bundle: profile.service_bundle,
    title: profile.title
  };
}

export class ProjectLibraryService {
  private readonly assignmentLocks = new Map<string, Promise<void>>();

  constructor(private readonly store: SimWarStore) {}

  async getByReference(
    tenantId: string,
    reference: ProjectProfileRef
  ): Promise<ProjectProfile | null> {
    const normalized = normalizeReference(reference);
    if (normalized.tenant_id !== tenantId) return null;
    const matches = this.store.projectProfiles.filter(
      (profile) =>
        profile.tenant_id === tenantId &&
        sameProfileReference(profileReference(profile), normalized)
    );
    const latest = matches[matches.length - 1];
    return latest ? clone(latest) : null;
  }

  async createDraft(
    actor: ProjectLibraryActor,
    input: ProjectProfileCreateInput
  ): Promise<ProjectProfile> {
    assertActor(actor);
    const course = this.requireCourse(actor.tenant_id, input.course_id);
    assertProfileIdentity(
      input.project_profile.project_profile_id,
      "PROJECT_PROFILE_IDENTITY_INVALID"
    );
    assertVersion(input.project_profile.version, "PROJECT_PROFILE_IDENTITY_INVALID");
    assertClosedDraft(input.project_profile, "PROJECT_PROFILE_INPUT_INVALID");
    return this.appendNewProfile(actor, course.course_id, input.project_profile, {
      kind: "APPROVED_SAFE_TEMPLATE"
    });
  }

  async import(
    actor: ProjectLibraryActor,
    input: ProjectProfileImportInput
  ): Promise<ProjectProfile> {
    assertActor(actor);
    const course = this.requireCourse(actor.tenant_id, input.course_id);
    assertClosedDraft(input.project_profile, "PROJECT_PROFILE_IMPORT_INVALID");
    return this.appendNewProfile(actor, course.course_id, input.project_profile, {
      kind: "NORMALIZED_IMPORT"
    });
  }

  async validate(
    actor: ProjectLibraryActor,
    input: ProjectProfileReferenceInput
  ): Promise<ProjectProfile> {
    assertActor(actor);
    const course = this.requireCourse(actor.tenant_id, input.course_id);
    const current = await this.requireOwned(actor, input.project_profile_ref, course.course_id);
    if (current.status !== "DRAFT") {
      throw new ProjectLibraryError("PROJECT_PROFILE_LIFECYCLE_INVALID");
    }
    const next: ProjectProfile = { ...current, status: "VALIDATED" };
    return this.appendProfile(next);
  }

  async retire(
    actor: ProjectLibraryActor,
    input: ProjectProfileReferenceInput
  ): Promise<ProjectProfile> {
    assertActor(actor);
    const course = this.requireCourse(actor.tenant_id, input.course_id);
    const current = await this.requireOwned(actor, input.project_profile_ref, course.course_id);
    if (current.status !== "VALIDATED") {
      throw new ProjectLibraryError("PROJECT_PROFILE_LIFECYCLE_INVALID");
    }
    return this.appendProfile({ ...current, status: "RETIRED" });
  }

  async clone(
    actor: ProjectLibraryActor,
    input: ProjectProfileCloneInput
  ): Promise<ProjectProfile> {
    assertActor(actor);
    const course = this.requireCourse(actor.tenant_id, input.course_id);
    const source = await this.requireOwned(
      actor,
      input.source_project_profile_ref,
      course.course_id
    );
    if (source.status !== "VALIDATED") {
      throw new ProjectLibraryError("PROJECT_PROFILE_LIFECYCLE_INVALID");
    }
    const draft: ProjectProfileDraftInput = {
      customer_segment: source.customer_segment,
      description: input.description,
      geography: source.geography,
      industry: source.industry,
      market_world_reference: clone(source.market_world_reference),
      positioning: source.positioning,
      project_profile_id: input.project_profile_id,
      service_bundle: source.service_bundle,
      starting_capacity: source.starting_capacity,
      starting_cash: source.starting_cash,
      template_id: source.template_id,
      title: input.title,
      version: input.version
    };
    assertClosedDraft(draft, "PROJECT_PROFILE_INPUT_INVALID");
    return this.appendNewProfile(actor, course.course_id, draft, {
      kind: "CLONED",
      source_project_profile_reference: profileReference(source)
    });
  }

  async createSuccessor(
    actor: ProjectLibraryActor,
    input: ProjectProfileSuccessorInput
  ): Promise<ProjectProfile> {
    assertActor(actor);
    const course = this.requireCourse(actor.tenant_id, input.course_id);
    const source = await this.requireOwned(
      actor,
      input.source_project_profile_ref,
      course.course_id
    );
    if (source.status !== "VALIDATED") {
      throw new ProjectLibraryError("PROJECT_PROFILE_LIFECYCLE_INVALID");
    }
    const draft: ProjectProfileDraftInput = {
      customer_segment: source.customer_segment,
      description: input.description,
      geography: source.geography,
      industry: source.industry,
      market_world_reference: clone(source.market_world_reference),
      positioning: source.positioning,
      project_profile_id: input.project_profile_id,
      service_bundle: source.service_bundle,
      starting_capacity: source.starting_capacity,
      starting_cash: source.starting_cash,
      template_id: source.template_id,
      title: input.title,
      version: input.version
    };
    assertClosedDraft(draft, "PROJECT_PROFILE_INPUT_INVALID");
    const replacement: ProjectProfile = {
      ...this.buildProfile(actor, course.course_id, draft, {
        kind: "SUCCESSOR",
        source_project_profile_reference: profileReference(source)
      }),
      future_effective_at: normalizeFutureEffectiveAt(input.future_effective_at),
      provenance: {
        kind: "SUCCESSOR",
        source_project_profile_reference: profileReference(source)
      },
      successor_of: profileReference(source)
    };
    return this.appendProfile(replacement);
  }

  async assign(
    actor: ProjectLibraryActor,
    input: ProjectAssignmentInput
  ): Promise<ProjectAssignmentResult> {
    return this.withAssignmentLock(
      `${actor.tenant_id}:${input.course_id}:${input.run_id}:${input.team_id}`,
      async () => {
        assertActor(actor);
        const course = this.requireCourse(actor.tenant_id, input.course_id);
        const run = this.store.runs.find(
          (candidate) =>
            candidate.run_id === input.run_id &&
            candidate.tenant_id === actor.tenant_id &&
            candidate.course_id === course.course_id
        );
        const team = this.store.teams.find(
          (candidate) =>
            candidate.team_id === input.team_id &&
            candidate.tenant_id === actor.tenant_id &&
            candidate.course_id === course.course_id
        );
        if (!run || !team) throw new ProjectLibraryError("PROJECT_ASSIGNMENT_SCOPE_VIOLATION");
        const existing = this.store.projectAssignments.find(
          (assignment) =>
            assignment.tenant_id === actor.tenant_id &&
            assignment.course_id === course.course_id &&
            assignment.run_id === input.run_id &&
            assignment.team_id === input.team_id
        );
        if (
          existing &&
          !sameProfileReference(
            existing.project_profile_reference,
            normalizeReference(input.project_profile_ref)
          )
        ) {
          throw new ProjectLibraryError("PROJECT_ASSIGNMENT_CONFLICT");
        }
        const profile = await this.requireOwned(actor, input.project_profile_ref, course.course_id);
        if (profile.status === "RETIRED")
          throw new ProjectLibraryError("PROJECT_ASSIGNMENT_RETIRED");
        if (profile.status !== "VALIDATED")
          throw new ProjectLibraryError("PROJECT_ASSIGNMENT_DEPENDENCY_MISSING");
        if (
          !course.market_world_reference ||
          !sameMarketWorldReference(course.market_world_reference, profile.market_world_reference)
        ) {
          throw new ProjectLibraryError("PROJECT_ASSIGNMENT_DEPENDENCY_MISSING");
        }
        if (existing) {
          return {
            assignment: clone(existing),
            idempotent: true,
            readiness: profileReadiness(profile, this.store.projectProfiles, course)
          };
        }
        const assignment: ProjectAssignment = {
          assigned_at: new Date().toISOString(),
          assigned_by: actor.actor_id,
          assignment_id: `project-assignment-${digest({
            course_id: course.course_id,
            project_profile_reference: profileReference(profile),
            run_id: input.run_id,
            team_id: input.team_id
          }).slice(0, 24)}`,
          course_id: course.course_id,
          project_profile_reference: profileReference(profile),
          run_id: input.run_id,
          schema_version: "project-assignment.v1",
          team_id: input.team_id,
          tenant_id: actor.tenant_id
        };
        this.store.projectAssignments.push(assignment);
        try {
          this.store.persist();
        } catch (error) {
          this.store.projectAssignments.pop();
          throw error;
        }
        return {
          assignment: clone(assignment),
          idempotent: false,
          readiness: profileReadiness(profile, this.store.projectProfiles, course)
        };
      }
    );
  }

  async getTeacherLibrary(
    actor: ProjectLibraryActor,
    courseId: string
  ): Promise<ProjectProfileTeacherProjection[]> {
    assertActor(actor);
    const course = this.requireCourse(actor.tenant_id, courseId);
    return latestByIdentity(
      this.store.projectProfiles.filter(
        (profile) => profile.tenant_id === actor.tenant_id && profile.course_id === course.course_id
      )
    ).map((profile) => ({
      description: profile.description,
      market_world_reference: clone(profile.market_world_reference),
      project_profile_reference: profileReference(profile),
      readiness: profileReadiness(profile, this.store.projectProfiles, course),
      status: profile.status,
      ...(profile.successor_of ? { successor_of: clone(profile.successor_of) } : {}),
      title: profile.title,
      version: profile.version
    }));
  }

  async getStudentBrief(context: StudentProjectBriefContext): Promise<ProjectProfileStudentBrief> {
    const course = this.store.courses.find(
      (candidate) => candidate.course_id === context.course_id
    );
    if (!course || course.tenant_id !== context.tenant_id) {
      throw new ProjectLibraryError("PROJECT_ASSIGNMENT_SCOPE_VIOLATION");
    }
    const team = this.store.teams.find(
      (candidate) =>
        candidate.team_id === context.team_id &&
        candidate.course_id === course.course_id &&
        candidate.tenant_id === context.tenant_id
    );
    if (!team || !team.members.some((member) => member.user_id === context.user_id)) {
      throw new ProjectLibraryError("PROJECT_ASSIGNMENT_SCOPE_VIOLATION");
    }
    const assignment = this.store.projectAssignments.find(
      (candidate) =>
        candidate.tenant_id === context.tenant_id &&
        candidate.course_id === context.course_id &&
        candidate.run_id === context.run_id &&
        candidate.team_id === context.team_id
    );
    if (!assignment) throw new ProjectLibraryError("PROJECT_ASSIGNMENT_NOT_FOUND");
    const profile = await this.getByReference(
      context.tenant_id,
      assignment.project_profile_reference
    );
    if (!profile) throw new ProjectLibraryError("PROJECT_PROFILE_NOT_FOUND");
    return studentBrief(profile);
  }

  async getAdminAudit(actor: ProjectLibraryActor): Promise<ProjectLibraryAdminAuditProjection> {
    assertActor(actor);
    return {
      assignments: clone(
        this.store.projectAssignments.filter(
          (assignment) => assignment.tenant_id === actor.tenant_id
        )
      ),
      profiles: await this.getTeacherLibraryForTenant(actor),
      tenant_id: actor.tenant_id
    };
  }

  private async getTeacherLibraryForTenant(
    actor: ProjectLibraryActor
  ): Promise<ProjectProfileTeacherProjection[]> {
    const profiles = latestByIdentity(
      this.store.projectProfiles.filter((profile) => profile.tenant_id === actor.tenant_id)
    );
    return profiles.map((profile) => {
      const course = this.store.courses.find(
        (candidate) =>
          candidate.course_id === profile.course_id && candidate.tenant_id === actor.tenant_id
      );
      return {
        description: profile.description,
        market_world_reference: clone(profile.market_world_reference),
        project_profile_reference: profileReference(profile),
        readiness: profileReadiness(profile, this.store.projectProfiles, course ?? {}),
        status: profile.status,
        ...(profile.successor_of ? { successor_of: clone(profile.successor_of) } : {}),
        title: profile.title,
        version: profile.version
      };
    });
  }

  private requireCourse(tenantId: string, courseId: string) {
    const course = this.store.courses.find((candidate) => candidate.course_id === courseId);
    if (!course || course.tenant_id !== tenantId) {
      throw new ProjectLibraryError("PROJECT_PROFILE_TENANT_SCOPE_VIOLATION");
    }
    return course;
  }

  private async requireOwned(
    actor: ProjectLibraryActor,
    reference: ProjectProfileRef,
    courseId: string
  ): Promise<ProjectProfile> {
    const normalized = normalizeReference(reference);
    if (normalized.tenant_id !== actor.tenant_id) {
      throw new ProjectLibraryError("PROJECT_PROFILE_TENANT_SCOPE_VIOLATION");
    }
    const profile = await this.getByReference(actor.tenant_id, normalized);
    if (!profile) throw new ProjectLibraryError("PROJECT_PROFILE_NOT_FOUND");
    if (profile.course_id !== courseId)
      throw new ProjectLibraryError("PROJECT_PROFILE_TENANT_SCOPE_VIOLATION");
    return profile;
  }

  private async appendNewProfile(
    actor: ProjectLibraryActor,
    courseId: string,
    draft: ProjectProfileDraftInput,
    provenance: ProjectProfileProvenance
  ): Promise<ProjectProfile> {
    return this.appendProfile(this.buildProfile(actor, courseId, draft, provenance));
  }

  private async withAssignmentLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.assignmentLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    this.assignmentLocks.set(key, queued);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.assignmentLocks.get(key) === queued) this.assignmentLocks.delete(key);
    }
  }

  private buildProfile(
    actor: ProjectLibraryActor,
    courseId: string,
    draft: ProjectProfileDraftInput,
    provenance: ProjectProfileProvenance
  ): ProjectProfile {
    const identityExists = this.store.projectProfiles.some(
      (profile) =>
        profile.tenant_id === actor.tenant_id &&
        profile.course_id === courseId &&
        profile.project_profile_id === draft.project_profile_id &&
        profile.version === draft.version
    );
    if (identityExists) throw new ProjectLibraryError("PROJECT_PROFILE_DUPLICATE_VERSION");
    const profile: ProjectProfile = {
      ...clone(draft),
      content_digest: digest({
        course_id: courseId,
        provenance,
        tenant_id: actor.tenant_id,
        ...draft
      }),
      course_id: courseId,
      created_at: new Date().toISOString(),
      created_by: actor.actor_id,
      provenance: clone(provenance),
      schema_version: "project-profile.v1",
      status: "DRAFT",
      tenant_id: actor.tenant_id
    };
    return profile;
  }

  private async appendProfile(profile: ProjectProfile): Promise<ProjectProfile> {
    this.store.projectProfiles.push(profile);
    try {
      this.store.persist();
    } catch (error) {
      this.store.projectProfiles.pop();
      throw error;
    }
    return clone(profile);
  }
}
