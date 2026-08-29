import { createHash } from "node:crypto";
import {
  buildM4PortabilityCompatibilityPack,
  buildM5RealityQualificationPack,
  buildM6LivingScenarioLifecyclePack,
  resolveM4PackageReference,
  type M4CompiledCityPackage
} from "@simwar/sh-next-support";
import { REGIONAL_TRANSFER_OPERATION_IDS } from "@simwar/shared-contracts";
import type {
  CourseBlueprintReference,
  ParameterSetReference,
  RegionalTransferAdminProjection,
  RegionalTransferCandidate,
  RegionalTransferCandidateInput,
  RegionalTransferCandidateRef,
  RegionalTransferFailureCode,
  RegionalTransferLifecycle,
  RegionalTransferPackageReference,
  RegionalTransferStudentProjection,
  RegionalTransferTeacherProjection,
  ScenarioPackageReference
} from "@simwar/shared-contracts";
import type { SimWarStore } from "./store.js";
import {
  persistRegionalTransferCandidate,
  readRegionalTransferCandidateCollection
} from "./store.js";

export interface RegionalTransferSourcePort {
  getCourse(
    tenantId: string,
    courseId: string
  ): Promise<{
    course_blueprint_reference?: CourseBlueprintReference;
    course_id: string;
    parameter_set_id?: string;
    scenario_package_id?: string;
    tenant_id: string;
  } | null>;
  getCourseBlueprint(
    tenantId: string,
    reference: CourseBlueprintReference
  ): Promise<{ reference: CourseBlueprintReference; status: "APPROVED" } | null>;
  getParameterSet(
    tenantId: string,
    reference: ParameterSetReference
  ): Promise<{
    model_version_ref: string;
    reference: ParameterSetReference;
    status: "APPROVED";
  } | null>;
  getRound(
    tenantId: string,
    runId: string,
    roundNo: number
  ): Promise<{ round_id: string; round_no: number; run_id: string; tenant_id: string } | null>;
  getRun(
    tenantId: string,
    runId: string
  ): Promise<{
    course_id: string;
    parameter_set_id: string;
    run_id: string;
    scenario_package_id: string;
    tenant_id: string;
  } | null>;
  getScenario(
    tenantId: string,
    reference: ScenarioPackageReference
  ): Promise<{
    parameter_set_reference: ParameterSetReference;
    reference: ScenarioPackageReference;
    status: "APPROVED";
  } | null>;
  listTeams(
    tenantId: string,
    runId: string
  ): Promise<ReadonlyArray<{ course_id: string; team_id: string; tenant_id: string }>>;
}

export interface RegionalTransferCandidatePersistencePort {
  get(tenantId: string, candidateId: string): Promise<RegionalTransferCandidate | null>;
  list(tenantId: string): Promise<RegionalTransferCandidate[]>;
  save(candidate: RegionalTransferCandidate): Promise<void>;
}

export interface RegionalTransferActor {
  actor_id: string;
  tenant_id: string;
  team_id?: string;
}

export class RegionalTransferProductError extends Error {
  constructor(readonly code: RegionalTransferFailureCode) {
    super(code);
    this.name = "RegionalTransferProductError";
  }
}

const SUPPORT_PACKS = {
  m4: buildM4PortabilityCompatibilityPack(),
  m5: buildM5RealityQualificationPack(),
  m6: buildM6LivingScenarioLifecyclePack()
} as const;

const KNOWN_LIMITS = [
  "M4/M5/M6 inputs are bounded candidate or reference-only support evidence; no official regional calibration is claimed.",
  "M5 qualification remains NOT_ELIGIBLE for calibration and M6 refresh/rollback remains candidate-only.",
  "The candidate never writes WANT, CAN, REALIZED, settlement, score, rank or replay truth.",
  "Provider is OFF, JSON_INTERNAL_ONLY is the active runtime authority, and PostgreSQL/RLS is not activated.",
  "Student receives only a published role-safe projection; Teacher/Admin provenance is intentionally unavailable to Student.",
  "Focused accessibility evidence is scoped to this journey; full WCAG acceptance and Human Validation are not claimed."
] as const;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function sameRef(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return Object.keys(right).every((key) => left[key] === right[key]);
}

function exactVersion(value: string): boolean {
  return value.trim().length > 0 && !/^(latest|default|current)$/iu.test(value);
}

function assertInput(input: RegionalTransferCandidateInput): void {
  const strings = [
    input.baseline_region,
    input.baseline_package_reference.package_id,
    input.baseline_package_reference.version,
    input.course_id,
    input.course_blueprint_reference.course_blueprint_id,
    input.course_blueprint_reference.version,
    input.parameter_set_reference.parameter_set_id,
    input.parameter_set_reference.version,
    input.run_id,
    input.scenario_package_reference.scenario_package_id,
    input.scenario_package_reference.version,
    input.target_region,
    input.target_package_reference.package_id,
    input.target_package_reference.version
  ];
  if (strings.some((item) => typeof item !== "string" || item.trim() !== item || item.length === 0))
    throw new RegionalTransferProductError("RT_INPUT_INVALID");
  if (
    !Number.isSafeInteger(input.round_no) ||
    input.round_no < 1 ||
    !/^[a-f0-9]{64}$/u.test(input.baseline_package_reference.digest) ||
    !/^[a-f0-9]{64}$/u.test(input.target_package_reference.digest) ||
    !/^[a-f0-9]{64}$/u.test(input.course_blueprint_reference.content_digest) ||
    !/^[a-f0-9]{64}$/u.test(input.parameter_set_reference.content_digest) ||
    !/^[a-f0-9]{64}$/u.test(input.scenario_package_reference.content_digest)
  ) {
    throw new RegionalTransferProductError("RT_INPUT_INVALID");
  }
  if (
    !exactVersion(input.baseline_package_reference.version) ||
    !exactVersion(input.target_package_reference.version) ||
    !exactVersion(input.course_blueprint_reference.version) ||
    !exactVersion(input.parameter_set_reference.version) ||
    !exactVersion(input.scenario_package_reference.version) ||
    !exactVersion(input.target_region)
  ) {
    throw new RegionalTransferProductError("RT_EXACT_VERSION_REQUIRED");
  }
}

function packageReference(input: RegionalTransferPackageReference): M4CompiledCityPackage {
  try {
    return resolveM4PackageReference(SUPPORT_PACKS.m4, {
      package_id: input.package_id,
      version: input.version,
      digest: input.digest
    });
  } catch (error) {
    if (error instanceof Error && error.message === "M4_PACKAGE_DIGEST_MISMATCH")
      throw new RegionalTransferProductError("RT_PACKAGE_DIGEST_MISMATCH");
    throw new RegionalTransferProductError("RT_PACKAGE_NOT_FOUND");
  }
}

function lifecycleAudit(candidate: RegionalTransferCandidate): RegionalTransferLifecycle[] {
  const lifecycle: RegionalTransferLifecycle[] = ["PREVIEWED"];
  if (candidate.lifecycle === "VALIDATED") lifecycle.push("VALIDATED");
  if (candidate.lifecycle === "FROZEN") lifecycle.push("VALIDATED", "FROZEN");
  if (candidate.lifecycle === "ACTIVATED") lifecycle.push("VALIDATED", "FROZEN", "ACTIVATED");
  return lifecycle.filter((item, index, all) => all.indexOf(item) === index);
}

function teacherProjection(
  candidate: RegionalTransferCandidate,
  operationId: RegionalTransferTeacherProjection["operation_id"]
): RegionalTransferTeacherProjection {
  return { ...clone(candidate), operation_id: operationId };
}

function inputFromCandidate(candidate: RegionalTransferCandidate): RegionalTransferCandidateInput {
  return {
    baseline_package_reference: clone(candidate.baseline.package_reference),
    baseline_region: candidate.baseline.region,
    course_blueprint_reference: clone(candidate.formal_references.course_blueprint_reference),
    course_id: candidate.scope.course_id,
    parameter_set_reference: clone(candidate.formal_references.parameter_set_reference),
    round_no: candidate.scope.round_no,
    run_id: candidate.scope.run_id,
    scenario_package_reference: clone(candidate.formal_references.scenario_package_reference),
    target_package_reference: clone(candidate.target.package_reference),
    target_region: candidate.target.region
  };
}

export class RegionalTransferProductService {
  private readonly now: () => string;
  private readonly persistence: RegionalTransferCandidatePersistencePort;
  private readonly sources: RegionalTransferSourcePort;

  constructor(input: {
    now?: () => string;
    persistence: RegionalTransferCandidatePersistencePort;
    sources: RegionalTransferSourcePort;
  }) {
    this.now = input.now ?? (() => new Date().toISOString());
    this.persistence = input.persistence;
    this.sources = input.sources;
  }

  async list(actor: RegionalTransferActor): Promise<RegionalTransferTeacherProjection[]> {
    const candidates = await this.persistence.list(actor.tenant_id);
    return candidates.map((candidate) =>
      teacherProjection(candidate, REGIONAL_TRANSFER_OPERATION_IDS.list)
    );
  }

  async preview(
    actor: RegionalTransferActor,
    input: RegionalTransferCandidateInput
  ): Promise<RegionalTransferTeacherProjection> {
    const candidate = await this.build(actor, input, "PREVIEWED");
    const existing = await this.persistence.get(
      actor.tenant_id,
      candidate.candidate_ref.candidate_id
    );
    if (!existing) await this.persistence.save(candidate);
    return teacherProjection(existing ?? candidate, REGIONAL_TRANSFER_OPERATION_IDS.preview);
  }

  async validate(
    actor: RegionalTransferActor,
    input: RegionalTransferCandidateInput
  ): Promise<RegionalTransferTeacherProjection> {
    const candidate = await this.build(actor, input, "VALIDATED");
    const existing = await this.persistence.get(
      actor.tenant_id,
      candidate.candidate_ref.candidate_id
    );
    if (!existing) throw new RegionalTransferProductError("RT_INVALID_TRANSITION");
    if (existing.lifecycle === "PREVIEWED") {
      await this.persistence.save(candidate);
      return teacherProjection(candidate, REGIONAL_TRANSFER_OPERATION_IDS.validate);
    }
    return teacherProjection(existing, REGIONAL_TRANSFER_OPERATION_IDS.validate);
  }

  async freeze(
    actor: RegionalTransferActor,
    input: RegionalTransferCandidateInput
  ): Promise<RegionalTransferCandidate> {
    const candidate = await this.build(actor, input, "FROZEN");
    const existing = await this.persistence.get(
      actor.tenant_id,
      candidate.candidate_ref.candidate_id
    );
    if (existing?.lifecycle === "FROZEN" || existing?.lifecycle === "ACTIVATED") {
      return clone(existing);
    }
    if (existing?.lifecycle !== "VALIDATED") {
      throw new RegionalTransferProductError("RT_INVALID_TRANSITION");
    }
    await this.persistence.save(candidate);
    return clone(candidate);
  }

  async bind(
    actor: RegionalTransferActor,
    candidateId: string
  ): Promise<RegionalTransferCandidate> {
    const current = await this.getOwned(actor, candidateId);
    if (current.lifecycle === "ACTIVATED" && current.activation.published) return clone(current);
    if (current.lifecycle !== "FROZEN")
      throw new RegionalTransferProductError("RT_INVALID_TRANSITION");
    const revalidated = await this.build(actor, inputFromCandidate(current), "FROZEN");
    if (
      revalidated.candidate_ref.candidate_id !== current.candidate_ref.candidate_id ||
      revalidated.candidate_ref.content_digest !== current.candidate_ref.content_digest
    ) {
      throw new RegionalTransferProductError("RT_SOURCE_NOT_BINDABLE");
    }
    const activated: RegionalTransferCandidate = {
      ...clone(current),
      activation: { published: true, status: "ACTIVATED" },
      lifecycle: "ACTIVATED"
    };
    await this.persistence.save(activated);
    return clone(activated);
  }

  async student(
    actor: RegionalTransferActor,
    candidateId: string
  ): Promise<RegionalTransferStudentProjection> {
    const candidate = await this.getOwned(actor, candidateId);
    if (candidate.lifecycle !== "ACTIVATED" || !candidate.activation.published)
      throw new RegionalTransferProductError("RT_NOT_PUBLISHED");
    return {
      activation: { published: true, status: "ACTIVATED" },
      authority: { official_truth_write: false, settlement_write: false },
      context: {
        course_id: candidate.scope.course_id,
        round_no: candidate.scope.round_no,
        run_id: candidate.scope.run_id,
        target_region: candidate.target.region
      },
      known_limits: clone(KNOWN_LIMITS),
      operation_id: "REGIONAL_TRANSFER_STUDENT_PROJECTION_GET_V1",
      status: "ACTIVATED",
      visibility: "ROLE_SAFE_STUDENT"
    };
  }

  async admin(
    actor: RegionalTransferActor,
    candidateId: string
  ): Promise<RegionalTransferAdminProjection> {
    const candidate = await this.getOwned(actor, candidateId);
    return {
      audit: {
        candidate_id: candidate.candidate_ref.candidate_id,
        lifecycle: lifecycleAudit(candidate),
        tenant_id: actor.tenant_id
      },
      candidate: clone(candidate),
      operation_id: "REGIONAL_TRANSFER_ADMIN_AUDIT_GET_V1",
      rollback: clone(candidate.rollback),
      visibility: "TENANT_SAFE_ADMIN"
    };
  }

  private async build(
    actor: RegionalTransferActor,
    input: RegionalTransferCandidateInput,
    lifecycle: RegionalTransferLifecycle
  ): Promise<RegionalTransferCandidate> {
    if (!actor.tenant_id) throw new RegionalTransferProductError("RT_SCOPE_CONFLICT");
    assertInput(input);
    if (
      input.course_blueprint_reference.tenant_id !== actor.tenant_id ||
      input.scenario_package_reference.tenant_id !== actor.tenant_id
    )
      throw new RegionalTransferProductError("RT_SCOPE_CONFLICT");

    const [course, run, round, blueprint, scenario, parameter, teams] = await Promise.all([
      this.sources.getCourse(actor.tenant_id, input.course_id),
      this.sources.getRun(actor.tenant_id, input.run_id),
      this.sources.getRound(actor.tenant_id, input.run_id, input.round_no),
      this.sources.getCourseBlueprint(actor.tenant_id, input.course_blueprint_reference),
      this.sources.getScenario(actor.tenant_id, input.scenario_package_reference),
      this.sources.getParameterSet(actor.tenant_id, input.parameter_set_reference),
      this.sources.listTeams(actor.tenant_id, input.run_id)
    ]);
    if (!course || course.tenant_id !== actor.tenant_id || course.course_id !== input.course_id)
      throw new RegionalTransferProductError("RT_SCOPE_CONFLICT");
    if (
      !run ||
      run.tenant_id !== actor.tenant_id ||
      run.run_id !== input.run_id ||
      run.course_id !== input.course_id ||
      run.scenario_package_id !== input.scenario_package_reference.scenario_package_id ||
      run.parameter_set_id !== input.parameter_set_reference.parameter_set_id ||
      !round ||
      round.run_id !== input.run_id ||
      round.round_no !== input.round_no
    )
      throw new RegionalTransferProductError("RT_EXACT_BINDING_REQUIRED");
    if (
      (course.parameter_set_id &&
        course.parameter_set_id !== input.parameter_set_reference.parameter_set_id) ||
      (course.scenario_package_id &&
        course.scenario_package_id !== input.scenario_package_reference.scenario_package_id)
    )
      throw new RegionalTransferProductError("RT_EXACT_BINDING_REQUIRED");
    if (
      course.course_blueprint_reference &&
      !sameRef(
        course.course_blueprint_reference as unknown as Record<string, unknown>,
        input.course_blueprint_reference as unknown as Record<string, unknown>
      )
    )
      throw new RegionalTransferProductError("RT_EXACT_BINDING_REQUIRED");
    if (
      !blueprint ||
      !sameRef(
        blueprint.reference as unknown as Record<string, unknown>,
        input.course_blueprint_reference as unknown as Record<string, unknown>
      ) ||
      !scenario ||
      !sameRef(
        scenario.reference as unknown as Record<string, unknown>,
        input.scenario_package_reference as unknown as Record<string, unknown>
      ) ||
      !parameter ||
      !sameRef(
        parameter.reference as unknown as Record<string, unknown>,
        input.parameter_set_reference as unknown as Record<string, unknown>
      ) ||
      !sameRef(
        scenario.parameter_set_reference as unknown as Record<string, unknown>,
        input.parameter_set_reference as unknown as Record<string, unknown>
      )
    )
      throw new RegionalTransferProductError("RT_SOURCE_NOT_BINDABLE");

    const consumerTeams = teams
      .filter(
        (team) =>
          team.tenant_id === actor.tenant_id &&
          team.course_id === input.course_id &&
          team.team_id.trim().length > 0
      )
      .map((team) => team.team_id)
      .filter((teamId, index, all) => all.indexOf(teamId) === index)
      .sort();
    if (consumerTeams.length < 2)
      throw new RegionalTransferProductError("RT_MULTI_TEAM_CONSUMPTION_REQUIRED");

    const baseline = packageReference(input.baseline_package_reference);
    const target = packageReference(input.target_package_reference);
    if (
      baseline.package_role !== "ANCHOR" ||
      target.package_role !== "SECOND_CITY" ||
      baseline.display_name !== input.baseline_region ||
      target.display_name !== input.target_region
    )
      throw new RegionalTransferProductError("RT_PACKAGE_NOT_FOUND");

    const content = {
      baseline: input.baseline_package_reference,
      baseline_region: input.baseline_region,
      course_blueprint_reference: input.course_blueprint_reference,
      course_id: input.course_id,
      parameter_set_reference: input.parameter_set_reference,
      round_no: input.round_no,
      run_id: input.run_id,
      scenario_package_reference: input.scenario_package_reference,
      target: input.target_package_reference,
      target_region: input.target_region,
      consumer_team_ids: consumerTeams
    };
    const candidateDigest = digest(content);
    const candidateRef: RegionalTransferCandidateRef = {
      candidate_id: `rt_candidate_${candidateDigest.slice(0, 16)}`,
      content_digest: candidateDigest,
      tenant_id: actor.tenant_id,
      version: "1.0.0"
    };
    const candidate: RegionalTransferCandidate = {
      activation: {
        published: lifecycle === "ACTIVATED",
        status: lifecycle === "ACTIVATED" ? "ACTIVATED" : "NOT_ACTIVATED"
      },
      authority: {
        formal_writer_mutations: 0,
        official_truth_write: false,
        provider: "OFF",
        runtime_authority: "JSON_INTERNAL_ONLY",
        settlement_write: false
      },
      baseline: {
        package_reference: clone(input.baseline_package_reference),
        region: baseline.display_name
      },
      candidate_ref: candidateRef,
      consumer_scope: {
        minimum_team_count: 2,
        run_id: input.run_id,
        status: "SHARED_GOVERNED_SCENARIO",
        team_ids: consumerTeams
      },
      diff: {
        changes: [
          { field: "region", from: baseline.display_name, to: target.display_name },
          { field: "package", from: baseline.package_id, to: target.package_id },
          { field: "qualification", from: "M5_NOT_ELIGIBLE", to: "READY_WITH_LIMITS" }
        ],
        status: "DIFF_RECORDED"
      },
      formal_references: {
        course_blueprint_reference: clone(input.course_blueprint_reference),
        parameter_set_reference: clone(input.parameter_set_reference),
        scenario_package_reference: clone(input.scenario_package_reference)
      },
      impact: {
        affected_consumers: ["TSS", "Course", "Run", "Student", "Admin"],
        requalification_required: true,
        rollback_candidate: true
      },
      known_limits: clone(KNOWN_LIMITS),
      lifecycle,
      provenance: {
        current_source_readback: "EXACT_SOURCE_READBACK_REQUIRED",
        support_packs: {
          m4_pack_digest: SUPPORT_PACKS.m4.pack_digest,
          m4_source_revision: "b86150a276e2cfc77fd4714e794a3d33de9d541c",
          m5_pack_digest: SUPPORT_PACKS.m5.pack_digest,
          m5_source_revision: "f3ee70712bbb2ff6f256bcfc007d56e0ee9bebf4",
          m6_pack_digest: SUPPORT_PACKS.m6.pack_digest,
          m6_source_revision: "d573ea20ab352b5cc6f22d6af3de45c68f6d3334"
        }
      },
      qualification: {
        calibration_eligible: false,
        rights_status: "PUBLIC_SAFE",
        status: "READY_WITH_LIMITS",
        source_status: "REFERENCE_ONLY_WITH_SYNTHETIC_FALLBACK"
      },
      rollback: {
        candidate_version: target.version,
        dry_run: true,
        executed: false,
        resolution: "SAFE_DRY_RUN_CANDIDATE",
        rollback_version: baseline.version,
        version_guard: "EXACT_VERSION_REQUIRED"
      },
      schema_version: "regional-transfer.v1",
      scope: {
        course_id: input.course_id,
        round_no: input.round_no,
        run_id: input.run_id,
        tenant_id: actor.tenant_id
      },
      target: {
        package_reference: clone(input.target_package_reference),
        region: target.display_name
      }
    };
    return clone(candidate);
  }

  private async getOwned(
    actor: RegionalTransferActor,
    candidateId: string
  ): Promise<RegionalTransferCandidate> {
    const candidate = await this.persistence.get(actor.tenant_id, candidateId);
    if (!candidate || candidate.scope.tenant_id !== actor.tenant_id)
      throw new RegionalTransferProductError("RT_CANDIDATE_NOT_FOUND");
    return candidate;
  }
}

export function createInMemoryRegionalTransferCandidatePersistence(): RegionalTransferCandidatePersistencePort {
  const candidates = new Map<string, RegionalTransferCandidate>();
  return {
    async get(tenantId, candidateId) {
      const candidate = candidates.get(`${tenantId}:${candidateId}`);
      return candidate ? clone(candidate) : null;
    },
    async list(tenantId) {
      return [...candidates.values()]
        .filter((candidate) => candidate.scope.tenant_id === tenantId)
        .map(clone);
    },
    async save(candidate) {
      candidates.set(
        `${candidate.scope.tenant_id}:${candidate.candidate_ref.candidate_id}`,
        clone(candidate)
      );
    }
  };
}

/** Adapts RT-O1 candidate persistence to the repository's existing JSON runtime store. */
export function createJsonRegionalTransferCandidatePersistence(
  store: SimWarStore
): RegionalTransferCandidatePersistencePort {
  return {
    async get(tenantId, candidateId) {
      return (
        readRegionalTransferCandidateCollection(store).find(
          (candidate) =>
            candidate.scope.tenant_id === tenantId &&
            candidate.candidate_ref.candidate_id === candidateId
        ) ?? null
      );
    },
    async list(tenantId) {
      return readRegionalTransferCandidateCollection(store).filter(
        (candidate) => candidate.scope.tenant_id === tenantId
      );
    },
    async save(candidate) {
      persistRegionalTransferCandidate(store, candidate);
    }
  };
}
