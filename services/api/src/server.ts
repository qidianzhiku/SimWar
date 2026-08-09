import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import type {
  ActorRole,
  AdminState,
  ApiErrorEnvelope,
  ApiEnvelope,
  AuditLog,
  AuthSession,
  CurrentUser,
  CoursePackageVersion,
  CoursePackageVersionCloneInput,
  CoursePackageVersionDraftInput,
  CoursePackageVersionImportInput,
  CoursePackageVersionReference,
  D2EvidenceCaptureInput,
  D2EvidenceQuery,
  LearningGoalDraftInput,
  LearningGoalVersionReference,
  RubricDraftInput,
  RubricVersionReference,
  Decision,
  ExactRef,
  DecisionPayload,
  M1DecisionSubmitRequest,
  ParameterSet,
  ParameterSetReference,
  PermissionKey,
  PluginReleaseReference,
  PublicRunReplayEvidence,
  PublicResultView,
  RoleId,
  Round,
  RoundStatus,
  Run,
  ScenarioPackage,
  ScenarioPackageAuthorityReadProjection,
  ScenarioPackageReference,
  SettlementResult,
  SyntheticRunLifecycleOperation,
  TeacherFormalCourseBindingPreviewDto,
  TeacherCourseBlueprintCatalogDto,
  TeacherCourseBlueprintCourseCreateDto,
  TeacherCourseBlueprintReadinessDto,
  TeacherFormalCourseCreateDto,
  TeacherFormalScenarioPackageCatalogDto,
  Team,
  Tenant,
  TenantBaselineProvisioningRequest,
  User
} from "@simwar/shared-contracts";
import {
  M1_CLASSROOM_DEBRIEF_PROMPTS,
  M1_JSON_RUNTIME_BOUNDARY,
  M1_JSON_RUNTIME_LIMITATIONS,
  M1_TEACHING_OFFICIAL_RESULT_LABEL,
  ROLE_PERMISSION_MATRIX,
  actorHasPermission,
  createParameterSetReference,
  createPluginReleaseReference,
  createScenarioPackageReference,
  isTruthProtectedField
} from "@simwar/shared-contracts";
import {
  createSignedToken,
  hashPassword,
  hashToken,
  verifyPassword,
  verifySignedToken
} from "./auth.js";
import { getApiHealthPayload } from "./health.js";
import {
  createJsonFormalScenarioAuthorityPersistence,
  createJsonGovernedAdvisoryRepositoryPort
} from "./json-repository-adapter.js";
import { createSettlementBusinessKey } from "./settlement-idempotency.js";
import { createJsonTeacherConfirmationRepositoryPort } from "./teacher-confirmation-registry.js";
import { createJsonRepositoryProvider, type RepositoryProvider } from "./repository-provider.js";
import {
  RoleWorkflowCommandService,
  RoleWorkflowError,
  type RoleWorkflowActor
} from "./role-workflow.js";
import {
  InstructorAssetRegistry,
  InstructorAssetRegistryError
} from "./instructor-asset-registry.js";
import {
  createInstructorDebriefArtifact,
  createInstructorIntelligenceKit,
  renderInstructorDebriefMarkdown,
  serializeInstructorDebriefArtifactJson
} from "./instructor-intelligence.js";
import { D2EvidenceError, EvidenceCaptureCommandService } from "./evidence-provenance.js";
import { TeacherConfirmationCommandService } from "./teacher-confirmation.js";
import { TeacherConfirmationQueryService } from "./teacher-confirmation-query.js";
import { TeacherConfirmationWorkClaimService } from "./teacher-confirmation-work-claim.js";
import { handleTeacherConfirmationRoute } from "./routes/teacher-confirmation-routes.js";
import { handleTeachingClosureRoute } from "./routes/teaching-closure-routes.js";
import {
  handleStudentLearningReportRoute,
  isStudentLearningReportRoute
} from "./routes/student-learning-report-routes.js";
import { StudentLearningReportProjectionService } from "./student-learning-report-projection.js";
import { TeachingClosureQueryService } from "./teaching-closure-query.js";
import { D5ExportAssembler } from "./d5-export-assembler.js";
import { D5DeliveryService } from "./d5-delivery.js";
import { InMemoryD5ExportRegistry } from "./d5-export-registry.js";
import { handleD5ExportRoute } from "./routes/d5-export-routes.js";
import { TransferResearchDesignCommandService } from "./transfer-research-design.js";
import { InMemoryTransferResearchDesignRegistry } from "./transfer-research-design-registry.js";
import { handleTransferResearchDesignRoute } from "./routes/transfer-research-design-routes.js";
import { handleGoldenJourneyRoute } from "./routes/golden-journey-routes.js";
import { handleW020AdvisoryRoute } from "./routes/w020-advisory-routes.js";
import { GovernedAdvisoryService } from "./w020-advisory-service.js";
import { GoldenJourneyIntegrationService } from "./golden-journey-integration.js";
import { createJsonFormalScenarioAuthorityRuntime } from "./formal-scenario-authority-runtime.js";
import {
  createFormalCourseAuthorityBinding,
  type FormalCourseAuthorityBinding
} from "./formal-course-authority-binding.js";
import { FormalCourseAuthorityBindingStore } from "./formal-course-authority-binding-store.js";
import { CourseBlueprintBindingStore } from "./course-blueprint-binding-store.js";
import {
  CoursePackageCommandError,
  CoursePackageCommandService
} from "./course-package-command-service.js";
import { CoursePackageJsonRegistry } from "./course-package-json-registry.js";
import {
  CoursePackageQueryService,
  toTeacherCoursePackageVersionDto
} from "./course-package-query-service.js";
import {
  LearningDesignCommandError,
  LearningDesignCommandService,
  LearningDesignJsonRegistry,
  LearningDesignQueryService
} from "./learning-design.js";
import {
  CourseReportQueryService,
  CourseReportQueryServiceError
} from "./course-report-query-service.js";
import { handleCourseReportRoute, isCourseReportRoute } from "./course-report-routes.js";
import {
  CourseBlueprintAuthorityError,
  CourseBlueprintCommandService,
  type CourseBlueprintAuthorityActor,
  type CourseBlueprintDraftInput,
  type CourseBlueprintVersion
} from "./course-blueprint-authority.js";
import {
  createTeacherCourseBlueprintDraft,
  createTeacherCourseFromBlueprint,
  listTeacherCourseBlueprintCatalog,
  previewTeacherCourseBlueprint,
  resolveTeacherCourseBlueprintReadiness,
  submitTeacherCourseBlueprintDraft,
  TeacherCourseBlueprintError
} from "./teacher-course-blueprint-service.js";
import {
  ParameterSetAuthorityError,
  type ParameterSetAuthorityActor,
  type ParameterSetCommandService,
  type ParameterSetDraftInput,
  type ParameterSetJsonValue,
  type ParameterSetVersion
} from "./parameter-set-authority.js";
import type { ScenarioPackageAuthorityReadFacade } from "./repository-facade.js";
import {
  PluginReleaseAuthorityError,
  type PluginReleaseAuthorityActor,
  type PluginReleaseCommandService,
  type PluginReleaseDraftInput,
  type PluginReleaseVersion
} from "./plugin-release-authority.js";
import {
  ScenarioPackageAuthorityError,
  type ScenarioPackageAuthorityActor,
  type ScenarioPackageCommandService,
  type ScenarioPackageDraftInput,
  type ScenarioPackageJsonValue,
  type ScenarioPackageVersion
} from "./scenario-package-authority.js";
import { compileGenericScenarioToDraft } from "./scenario-compile-draft-service.js";
import {
  TenantBaselineProvisioningError,
  TenantBaselineProvisioningService
} from "./tenant-baseline-provisioning.js";
import type { GenericScenarioCompilerInput } from "./scenario-compiler.js";
import {
  resolveRuntimeSecurityConfig,
  validateRuntimeSecurityConfig,
  type RuntimeEnvironment,
  type RuntimeSecurityConfig,
  type RuntimeSecurityConfigEnv
} from "./runtime-security-config.js";
import { createM1RunReplayEvidence } from "./run-manifest-replay-evidence.js";
import type { FormalRunBindingAuthorityPorts } from "./formal-run-runtime-binding.js";
import { FormalRunRuntimeBindingStore } from "./formal-run-runtime-binding-store.js";
import { resolveFormalRuntimeInputsForActiveRun } from "./formal-runtime-input-resolver.js";
import { createFormalBoundRun } from "./formal-bound-run-creation-service.js";
import {
  createTeacherFormalCourse,
  resolveTeacherFormalCourseBindingPreview,
  TeacherFormalCourseBindingError
} from "./teacher-formal-course-binding-service.js";
import {
  R7TeacherScenarioSelectionGateBlockedError,
  createR7TeacherScenarioPackageCandidatesProjection,
  createR7TeacherScenarioSelectionReadinessProjection
} from "./r7-teacher-scenario-selection-readiness.js";
import { prepareSettlementOutcome, validateDecisionPayload } from "./simulation.js";
import {
  SyntheticRunLifecycleError,
  assertRunLifecycleAllowsProgress,
  createSyntheticRunCreationAuditMarker,
  executeSyntheticRunLifecycleOperation,
  listSyntheticRunLifecycleControls
} from "./synthetic-run-lifecycle.js";
import {
  DEFAULT_TENANT_ID,
  PLATFORM_TENANT_ID,
  actorHasAnyRole,
  createP1Store,
  captureInstructorAssetAuditCheckpoint,
  readCoursePackageLifecycleSnapshots,
  persistLearningDesignSnapshots,
  readLearningDesignSnapshots,
  readInstructorAssetCollection,
  persistCoursePackageLifecycleSnapshots,
  persistInstructorAssetCollection,
  restoreInstructorAssetAuditCheckpoint,
  getActorFromUser,
  nextId,
  sanitizeUser,
  setUserRoles,
  type SimWarStore,
  type StoredUser
} from "./store.js";
import {
  createPlatformAdminAuthorityDto,
  createStudentBffCockpitDto,
  createTeacherBffWorkspaceDto,
  createTenantAdminSummaryDto
} from "./teacher-student-bff-dto.js";

const DEFAULT_PORT = 3000;
const SESSION_TTL_SECONDS = 60 * 60 * 8;

export function resolveApiHost(value = process.env.API_HOST): string | undefined {
  return value?.trim() || undefined;
}

interface RequestContext {
  requestId: string;
  tenantId: string;
  actor?: CurrentUser;
  token?: string;
}

interface ApiRuntime {
  courseBlueprintBindingStore: CourseBlueprintBindingStore;
  formalCourseAuthorityBindingStore: FormalCourseAuthorityBindingStore;
  formalCourseBlueprints: CourseBlueprintCommandService;
  coursePackageCommands: CoursePackageCommandService;
  coursePackageQueries: CoursePackageQueryService;
  courseReports: CourseReportQueryService;
  learningDesignCommands: LearningDesignCommandService;
  learningDesignQueries: LearningDesignQueryService;
  evidenceCapture: EvidenceCaptureCommandService;
  teacherConfirmations: TeacherConfirmationCommandService;
  teacherConfirmationQueries: TeacherConfirmationQueryService;
  teacherConfirmationClaims: TeacherConfirmationWorkClaimService;
  studentLearningReports: StudentLearningReportProjectionService;
  teachingClosure: TeachingClosureQueryService;
  d5ExportAssembler: D5ExportAssembler;
  d5Delivery: D5DeliveryService;
  transferResearchDesign: TransferResearchDesignCommandService;
  formalParameterSets: ParameterSetCommandService;
  formalPluginReleases: PluginReleaseCommandService;
  formalScenarioPackages: ScenarioPackageCommandService;
  formalScenarioPackageCatalog: ScenarioPackageAuthorityReadFacade;
  tenantBaselineProvisioning: TenantBaselineProvisioningService;
  formalRunBindingAuthorities: FormalRunBindingAuthorityPorts;
  formalRunRuntimeBindingStore: FormalRunRuntimeBindingStore;
  createCourseId(): string;
  store: SimWarStore;
  repositoryProvider: RepositoryProvider;
  roleWorkflow: RoleWorkflowCommandService;
  instructorAssets: InstructorAssetRegistry;
  goldenJourney: GoldenJourneyIntegrationService;
  governedAdvisory: GovernedAdvisoryService;
  securityConfig: RuntimeSecurityConfig;
  runMutationLocks: Map<string, Promise<void>>;
}

export interface CreateApiServerOptions {
  env?: RuntimeSecurityConfigEnv;
  formalRunBindingAuthorities?: FormalRunBindingAuthorityPorts;
  formalScenarioPackageCatalog?: ScenarioPackageAuthorityReadFacade;
  repositoryProvider?: RepositoryProvider;
  securityConfig?: RuntimeSecurityConfig;
}

type DecisionSubmitBody = Partial<M1DecisionSubmitRequest>;

interface FormalRunCreateBody {
  engine_reference?: {
    engine_id?: unknown;
    version?: unknown;
  };
  parameter_set_reference?: {
    content_digest?: unknown;
    parameter_set_id?: unknown;
    version?: unknown;
  };
  scenario_package_reference?: {
    content_digest?: unknown;
    scenario_package_id?: unknown;
    tenant_id?: unknown;
    version?: unknown;
  };
  seed?: unknown;
}

interface FormalCourseAuthorityBindingBody {
  engine_reference?: {
    engine_id?: unknown;
    version?: unknown;
  };
  parameter_set_reference?: {
    content_digest?: unknown;
    parameter_set_id?: unknown;
    version?: unknown;
  };
  scenario_package_reference?: {
    content_digest?: unknown;
    scenario_package_id?: unknown;
    tenant_id?: unknown;
    version?: unknown;
  };
}

interface CourseCreateBody {
  formal_authority_binding?: FormalCourseAuthorityBindingBody;
  title?: unknown;
}

interface RunCreateBody {
  formal_runtime_binding?: FormalRunCreateBody;
  formal_runtime_seed?: unknown;
}

interface TeacherFormalCourseSelectionBody {
  scenario_package_reference?: {
    content_digest?: unknown;
    scenario_package_id?: unknown;
    tenant_id?: unknown;
    version?: unknown;
  };
  title?: unknown;
}

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details: ApiErrorEnvelope["details"] = []
  ) {
    super(message);
  }
}

const defaultStore = createP1Store({
  persistenceFile: process.env.SIMWAR_STORE_FILE ?? "tmp/simwar-store.json"
});
const sharedRuntimeEnvironments = new Set<RuntimeEnvironment>(["production", "staging"]);
const seededDemoUserIds = new Set([
  "usr_platform",
  "usr_teacher",
  "usr_student",
  "usr_admin",
  "usr_other_teacher"
]);

function isSharedRuntime(environment: RuntimeEnvironment): boolean {
  return sharedRuntimeEnvironments.has(environment);
}

function isSeededDemoUser(user: StoredUser): boolean {
  return seededDemoUserIds.has(user.user_id);
}

function createRuntimeRepositoryProvider(
  store: SimWarStore,
  options: Pick<CreateApiServerOptions, "repositoryProvider"> = {}
): RepositoryProvider {
  return options.repositoryProvider ?? createJsonRepositoryProvider({ store });
}

function createApiRuntime(store: SimWarStore, options: CreateApiServerOptions = {}): ApiRuntime {
  const formalAuthorityPersistence = createJsonFormalScenarioAuthorityPersistence(store);
  const formalAuthorityRuntime = createJsonFormalScenarioAuthorityRuntime(
    formalAuthorityPersistence
  );
  const formalRunBindingAuthorities = options.formalRunBindingAuthorities ?? {
    parameterSets: formalAuthorityRuntime.parameterSets,
    plugins: formalAuthorityRuntime.pluginReleases,
    scenarios: formalAuthorityRuntime.scenarioPackages
  };
  const formalScenarioPackageCatalog =
    options.formalScenarioPackageCatalog ?? formalAuthorityRuntime.catalog;
  const tenantBaselineProvisioning = new TenantBaselineProvisioningService(formalAuthorityRuntime);
  const repositoryProvider = createRuntimeRepositoryProvider(store, options);
  const formalCourseBlueprints = new CourseBlueprintCommandService(
    formalAuthorityPersistence.createCourseBlueprintRegistry()
  );
  const coursePackageRegistry = new CoursePackageJsonRegistry(
    {
      persist: (snapshots) => persistCoursePackageLifecycleSnapshots(store, snapshots)
    },
    readCoursePackageLifecycleSnapshots(store)
  );
  const coursePackageCommands = new CoursePackageCommandService(coursePackageRegistry, {
    courseBlueprints: formalCourseBlueprints,
    parameterSets: formalAuthorityRuntime.parameterSets,
    scenarioPackages: formalAuthorityRuntime.scenarioPackages
  });
  const learningDesignRegistry = new LearningDesignJsonRegistry(
    {
      persist: (goals, rubrics) => persistLearningDesignSnapshots(store, goals, rubrics)
    },
    readLearningDesignSnapshots(store).goals,
    readLearningDesignSnapshots(store).rubrics
  );
  const learningDesignCommands = new LearningDesignCommandService(learningDesignRegistry, {
    getByReference: (tenantId, reference) =>
      coursePackageRegistry.getByReference(tenantId, reference)
  });
  const evidenceCapture = new EvidenceCaptureCommandService({
    coursePackages: coursePackageRegistry,
    learningDesign: learningDesignRegistry,
    repository: repositoryProvider.ports.evidenceProvenance,
    roleWorkflow: repositoryProvider.ports.roleWorkflow
  });
  const teacherConfirmationRepository =
    repositoryProvider.ports.teacherConfirmations ??
    createJsonTeacherConfirmationRepositoryPort(store);
  const teacherConfirmationClaims = new TeacherConfirmationWorkClaimService();
  const teacherConfirmations = new TeacherConfirmationCommandService({
    coursePackages: {
      getByReference: (tenantId, reference) =>
        coursePackageRegistry.getByReference(tenantId, {
          content_digest: reference.content_digest,
          course_package_id: reference.resource_id,
          tenant_id: reference.tenant_id,
          version: reference.version
        })
    },
    learningDesign: {
      getGoal: (reference) => learningDesignRegistry.getGoal(reference),
      getRubric: (reference) => learningDesignRegistry.getRubric(reference)
    },
    evidence: {
      async getByReference(tenantId, reference) {
        const artifact = (
          await repositoryProvider.ports.evidenceProvenance.listEvidenceArtifacts(tenantId)
        ).find(
          (candidate) =>
            candidate.artifact_ref.resource_id === reference.resource_id &&
            candidate.artifact_ref.version === reference.version &&
            candidate.artifact_ref.content_digest === reference.content_digest &&
            candidate.artifact_ref.tenant_id === reference.tenant_id
        );
        return artifact
          ? {
              artifact_ref:
                artifact.artifact_ref as unknown as import("@simwar/shared-contracts").TeacherConfirmationExactRef,
              context: artifact.context,
              visibility: "teacher_only" as const
            }
          : null;
      }
    },
    repository: teacherConfirmationRepository,
    claims: teacherConfirmationClaims
  });
  const studentLearningReports = new StudentLearningReportProjectionService({
    confirmations: teacherConfirmations,
    evidence: repositoryProvider.ports.evidenceProvenance
  });
  const teachingClosure = new TeachingClosureQueryService({
    courseReports: new CourseReportQueryService(
      repositoryProvider.facade,
      repositoryProvider.capabilities
    ),
    evidence: evidenceCapture,
    confirmations: new TeacherConfirmationQueryService(teacherConfirmations),
    studentReports: studentLearningReports,
    claims: teacherConfirmationClaims
  });
  const d5ExportRepository = new InMemoryD5ExportRegistry();
  const d5ExportAssembler = new D5ExportAssembler({
    reports: studentLearningReports,
    repository: d5ExportRepository
  });
  const d5Delivery = new D5DeliveryService({
    assembler: d5ExportAssembler,
    repository: d5ExportRepository
  });
  const transferResearchDesign = new TransferResearchDesignCommandService(
    new InMemoryTransferResearchDesignRegistry()
  );
  const governedAdvisory = new GovernedAdvisoryService({
    repository:
      repositoryProvider.ports.governedAdvisories ??
      createJsonGovernedAdvisoryRepositoryPort(store),
    roleWorkflow: repositoryProvider.ports.roleWorkflow
  });

  return {
    courseBlueprintBindingStore: new CourseBlueprintBindingStore(store),
    formalCourseAuthorityBindingStore: new FormalCourseAuthorityBindingStore(store),
    formalCourseBlueprints,
    coursePackageCommands,
    coursePackageQueries: new CoursePackageQueryService(coursePackageRegistry),
    learningDesignCommands,
    learningDesignQueries: new LearningDesignQueryService(learningDesignRegistry),
    evidenceCapture,
    teacherConfirmations,
    teacherConfirmationQueries: new TeacherConfirmationQueryService(teacherConfirmations),
    teacherConfirmationClaims,
    studentLearningReports,
    teachingClosure,
    d5ExportAssembler,
    d5Delivery,
    transferResearchDesign,
    courseReports: new CourseReportQueryService(
      repositoryProvider.facade,
      repositoryProvider.capabilities
    ),
    formalParameterSets: formalAuthorityRuntime.parameterSets,
    formalPluginReleases: formalAuthorityRuntime.pluginReleases,
    formalScenarioPackages: formalAuthorityRuntime.scenarioPackages,
    tenantBaselineProvisioning,
    formalRunBindingAuthorities,
    formalRunRuntimeBindingStore: new FormalRunRuntimeBindingStore(store),
    createCourseId: () => nextId(store, "course", "course"),
    formalScenarioPackageCatalog,
    store,
    repositoryProvider,
    roleWorkflow: new RoleWorkflowCommandService(repositoryProvider.ports.roleWorkflow),
    instructorAssets: new InstructorAssetRegistry(
      {
        captureAuditCheckpoint: () => captureInstructorAssetAuditCheckpoint(store),
        persist: (assets) => persistInstructorAssetCollection(store, assets),
        restoreAuditCheckpoint: (checkpoint) =>
          restoreInstructorAssetAuditCheckpoint(
            store,
            checkpoint as ReturnType<typeof captureInstructorAssetAuditCheckpoint>
          )
      },
      readInstructorAssetCollection(store)
    ),
    goldenJourney: new GoldenJourneyIntegrationService({ repositoryProvider, store }),
    governedAdvisory,
    securityConfig: options.securityConfig
      ? validateRuntimeSecurityConfig(options.securityConfig)
      : resolveRuntimeSecurityConfig(options.env ?? process.env),
    runMutationLocks: new Map()
  };
}

function createTeacherFormalScenarioPackageCatalogProjection(
  candidates: ScenarioPackageAuthorityReadProjection[]
): TeacherFormalScenarioPackageCatalogDto {
  return {
    candidates: candidates.map((candidate) => ({
      compatibility_metadata: { ...candidate.compatibility_metadata },
      parameter_set_reference: { ...candidate.parameter_set_reference },
      plugin_dependencies: candidate.plugin_dependencies.map((dependency) => ({ ...dependency })),
      scenario_package_reference: { ...candidate.reference },
      schema_version: candidate.schema_version,
      status: "APPROVED"
    })),
    explicit_non_proofs: [
      "FORMAL_CATALOG_READ_ONLY",
      "LOCAL_DRAFT_SELECTION_DOES_NOT_BIND_A_RUN",
      "SCENARIO_RUNTIME_NOT_ACTIVATED",
      "PARAMETERSET_NOT_MUTATED",
      "REPLAY_NOT_EXECUTED",
      "SETTLEMENT_NOT_EXECUTED"
    ],
    operation_id: "TEACHER_FORMAL_SCENARIO_PACKAGE_CATALOG_GET_V1"
  };
}

interface RunSettlementOutcome {
  settlement: SettlementResult;
  committed: boolean;
  responseSemantics: "committed" | "reused";
}

function runMutationBusinessKey(tenantId: string, runId: string): string {
  return `${tenantId}:${runId}`;
}

async function acquireRunMutationLock(runtime: ApiRuntime, key: string): Promise<() => void> {
  const previous = runtime.runMutationLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.catch(() => undefined).then(() => current);

  runtime.runMutationLocks.set(key, queued);

  await previous.catch(() => undefined);

  return () => {
    release();

    if (runtime.runMutationLocks.get(key) === queued) {
      runtime.runMutationLocks.delete(key);
    }
  };
}

type AuditLogInput = {
  actor: CurrentUser;
  action: string;
  resourceType: string;
  resourceId: string;
  requestId: string;
  tenantId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

function createAuditLog(
  runtime: ApiRuntime,
  input: AuditLogInput,
  auditId = runtime.repositoryProvider.idGenerator.createAuditLogId()
): AuditLog {
  return {
    audit_id: auditId,
    tenant_id: input.tenantId ?? input.actor.tenant_id,
    actor_id: input.actor.user_id,
    actor_role: input.actor.roles[0] ?? "learner",
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId,
    request_id: input.requestId,
    created_at: new Date().toISOString(),
    ...(input.before ? { before: input.before } : {}),
    ...(input.after ? { after: input.after } : {})
  };
}

async function appendAudit(runtime: ApiRuntime, input: AuditLogInput): Promise<AuditLog> {
  const log = createAuditLog(
    runtime,
    input,
    runtime.repositoryProvider.idGenerator.createAuditLogId()
  );

  await runtime.repositoryProvider.facade.auditLogs.appendAuditLog(log);
  return log;
}

async function submitDecisionWithRunLock(
  runtime: ApiRuntime,
  context: RequestContext,
  request: IncomingMessage,
  runId: string,
  roundNo: number
): Promise<Decision> {
  const release = await acquireRunMutationLock(
    runtime,
    runMutationBusinessKey(context.tenantId, runId)
  );
  try {
    return await submitDecision(runtime, context, request, runId, roundNo);
  } finally {
    release();
  }
}

async function submitDecision(
  runtime: ApiRuntime,
  context: RequestContext,
  request: IncomingMessage,
  runId: string,
  roundNo: number
): Promise<Decision> {
  const actor = requirePermission(context, "decision:submit");
  const run = await runtime.repositoryProvider.facade.runs.getRun(context.tenantId, runId);
  if (!run) {
    throw new HttpError(404, "RUN-404-001", "run not found");
  }
  await assertRunLifecycleAllowsProgress({
    provider: runtime.repositoryProvider,
    runId: run.run_id,
    tenantId: context.tenantId
  });
  const round = await getRoundForRead(runtime, context, run.run_id, roundNo);
  assertRoundStatus(round, "open", "ROUND-409-002");
  const body = await readJson<DecisionSubmitBody>(request);
  assertNoTruthProtectedFields(body);
  assertNoUnexpectedDecisionPayloadFields(body.decision_payload);
  const teamId = body.team_id ?? actor.team_id;

  if (!teamId || teamId !== actor.team_id) {
    throw new HttpError(403, "TEAM-403-001", "learners can only submit for their own team");
  }

  const team = await runtime.repositoryProvider.facade.teams.getTeam(context.tenantId, teamId);
  if (!team || team.course_id !== run.course_id) {
    throw new HttpError(404, "TEAM-404-001", "team not found");
  }

  if (!isActorMemberOfTeam(actor, team)) {
    throw new HttpError(403, "TEAM-403-001", "learners can only submit for their own team");
  }

  executeRoleWorkflow(() =>
    runtime.roleWorkflow.assertDirectDecisionSubmissionAllowed(
      roleWorkflowActor(context, "student"),
      {
        round_id: round.round_id,
        run_id: run.run_id,
        team_id: team.team_id
      }
    )
  );

  const validationErrors = validateDecisionPayload(body.decision_payload);
  if (validationErrors.length > 0) {
    throw new HttpError(422, "DEC-422-001", "decision validation failed", validationErrors);
  }
  const decisionPayload = body.decision_payload as DecisionPayload;
  const idempotentDecision = await findIdempotentDecisionSubmission(runtime, context, {
    actor,
    payload: decisionPayload,
    roundNo: round.round_no,
    runId: run.run_id,
    teamId: team.team_id
  });
  if (idempotentDecision) {
    return idempotentDecision;
  }

  const decisionVersions = await runtime.repositoryProvider.facade.decisions.listDecisionsForRound(
    context.tenantId,
    run.run_id,
    round.round_id
  );
  const priorVersions = decisionVersions.filter(
    (decision) =>
      decision.run_id === run.run_id &&
      decision.round_no === round.round_no &&
      decision.team_id === team.team_id &&
      decision.tenant_id === context.tenantId
  );
  const decision: Decision = {
    decision_id: runtime.repositoryProvider.idGenerator.createDecisionId(),
    tenant_id: context.tenantId,
    run_id: run.run_id,
    round_id: round.round_id,
    round_no: round.round_no,
    team_id: team.team_id,
    status: "validated",
    version: priorVersions.length + 1,
    payload: decisionPayload,
    validation_report: [],
    submitted_by: actor.user_id
  };

  await runtime.repositoryProvider.facade.decisions.saveCanonicalDecision(decision);
  await appendAudit(runtime, {
    actor,
    action: "decision.submit",
    resourceType: "decision",
    resourceId: decision.decision_id,
    requestId: context.requestId,
    after: clonePublic(decision)
  });

  return decision;
}

async function lockRoundWithRunLock(
  runtime: ApiRuntime,
  context: RequestContext,
  runId: string,
  roundNo: number
): Promise<Round> {
  const release = await acquireRunMutationLock(
    runtime,
    runMutationBusinessKey(context.tenantId, runId)
  );
  try {
    return await lockRound(runtime, context, runId, roundNo);
  } finally {
    release();
  }
}

async function lockRound(
  runtime: ApiRuntime,
  context: RequestContext,
  runId: string,
  roundNo: number
): Promise<Round> {
  const actor = requirePermission(context, "round:lock");
  const run = await runtime.repositoryProvider.facade.runs.getRun(context.tenantId, runId);
  if (!run) {
    throw new HttpError(404, "RUN-404-001", "run not found");
  }
  await assertRunLifecycleAllowsProgress({
    provider: runtime.repositoryProvider,
    runId: run.run_id,
    tenantId: context.tenantId
  });
  const round = await getRoundForRead(runtime, context, run.run_id, roundNo);
  if (round.status === "locked") {
    return round;
  }
  assertRoundStatus(round, "open", "ROUND-409-003");
  const before = clonePublic(round);

  const lockedRound: Round = {
    ...round,
    status: "locked",
    decision_batch_id: `batch_${run.run_id}_${round.round_no}`
  };

  await runtime.repositoryProvider.facade.rounds.saveRound(lockedRound);

  await appendAudit(runtime, {
    actor,
    action: "round.lock",
    resourceType: "round",
    resourceId: lockedRound.round_id,
    requestId: context.requestId,
    before,
    after: clonePublic(lockedRound)
  });

  return lockedRound;
}

async function publishRoundWithRunLock(
  runtime: ApiRuntime,
  context: RequestContext,
  runId: string,
  roundNo: number
): Promise<Round> {
  const release = await acquireRunMutationLock(
    runtime,
    runMutationBusinessKey(context.tenantId, runId)
  );
  try {
    return await publishRound(runtime, context, runId, roundNo);
  } finally {
    release();
  }
}

async function publishRound(
  runtime: ApiRuntime,
  context: RequestContext,
  runId: string,
  roundNo: number
): Promise<Round> {
  const actor = requirePermission(context, "round:publish");
  const run = await runtime.repositoryProvider.facade.runs.getRun(context.tenantId, runId);
  if (!run) {
    throw new HttpError(404, "RUN-404-001", "run not found");
  }
  await assertRunLifecycleAllowsProgress({
    provider: runtime.repositoryProvider,
    runId: run.run_id,
    tenantId: context.tenantId
  });
  const round = await getRoundForRead(runtime, context, run.run_id, roundNo);
  if (round.status === "published") {
    return round;
  }
  assertRoundStatus(round, "settled", "ROUND-409-005");
  const before = clonePublic(round);

  const publishedRound: Round = {
    ...round,
    status: "published"
  };

  await runtime.repositoryProvider.facade.rounds.saveRound(publishedRound);

  await appendAudit(runtime, {
    actor,
    action: "round.publish",
    resourceType: "round",
    resourceId: publishedRound.round_id,
    requestId: context.requestId,
    before,
    after: clonePublic(publishedRound)
  });

  return publishedRound;
}

function createEnvelope<TData>(
  context: RequestContext,
  data: TData,
  message = "success"
): ApiEnvelope<TData> {
  return {
    request_id: context.requestId,
    code: "OK",
    message,
    data
  };
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "access-control-allow-headers":
      "authorization, content-type, idempotency-key, x-request-id, x-service-principal, x-tenant-id",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,OPTIONS",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

function sendInstructorDebriefDownload(
  response: ServerResponse,
  content: string,
  contentType: string,
  filename: string
): void {
  response.writeHead(200, {
    "access-control-allow-headers":
      "authorization, content-type, idempotency-key, x-request-id, x-service-principal, x-tenant-id",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,OPTIONS",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
    "content-disposition": 'attachment; filename="' + filename + '"',
    "access-control-expose-headers": "content-disposition",
    "content-type": contentType + "; charset=utf-8"
  });
  response.end(content);
}

function sendError(response: ServerResponse, context: RequestContext, error: HttpError): void {
  sendJson(response, error.statusCode, {
    request_id: context.requestId,
    code: error.code,
    message: error.message,
    details: error.details
  });
}

function sendR7ScenarioSelectionReadinessError(
  response: ServerResponse,
  statusCode: number,
  code: string,
  message: string,
  correlationId: string | null
): void {
  sendJson(response, statusCode, {
    error: {
      code,
      message,
      correlation_id: correlationId
    }
  });
}

function parseR7ScenarioSelectionIdentifier(rawValue: string | undefined): string | undefined {
  try {
    const value = decodeURIComponent(rawValue ?? "").trim();
    return /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function getBearerToken(request: IncomingMessage): string | undefined {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }

  return header.slice("Bearer ".length);
}

function isExpired(isoDate: string): boolean {
  return new Date(isoDate).getTime() <= Date.now();
}

function createContext(runtime: ApiRuntime, request: IncomingMessage): RequestContext {
  const { store } = runtime;
  const requestId = request.headers["x-request-id"]?.toString() ?? `req_${Date.now()}`;
  const requestedTenantId = request.headers["x-tenant-id"]?.toString();
  const bearerToken = getBearerToken(request);
  const token = bearerToken ?? "";
  const payload = verifySignedToken(token, runtime.securityConfig.jwtSecret);
  const tokenHash = hashToken(token);
  const session = store.sessions.find(
    (candidate) =>
      candidate.session_id === (payload?.session_id ?? "") &&
      candidate.user_id === (payload?.sub ?? "") &&
      candidate.token_hash === tokenHash &&
      !candidate.revoked_at &&
      !isExpired(candidate.expires_at)
  );
  const user = session
    ? store.users.find(
        (candidate) => candidate.user_id === session.user_id && candidate.status === "active"
      )
    : undefined;
  const actor = user ? getActorFromUser(store, user) : undefined;

  const tenantId = requestedTenantId ?? actor?.tenant_id ?? DEFAULT_TENANT_ID;

  if (
    actor &&
    requestedTenantId &&
    actor.tenant_id !== requestedTenantId &&
    !actorHasAnyRole(actor, ["platform_admin"])
  ) {
    throw new HttpError(403, "TENANT-403-001", "tenant boundary violation");
  }

  return {
    requestId,
    tenantId,
    ...(actor ? { actor } : {}),
    ...(bearerToken ? { token: bearerToken } : {})
  };
}

function requireActor(context: RequestContext): CurrentUser {
  if (!context.actor) {
    throw new HttpError(401, "AUTH-401-001", "authentication required");
  }

  return context.actor;
}

function requirePermission(context: RequestContext, permission: PermissionKey): CurrentUser {
  const actor = requireActor(context);

  if (!actorHasPermission(actor, permission)) {
    throw new HttpError(403, "AUTHZ-403-001", `missing permission: ${permission}`);
  }

  return actor;
}

async function handleR7TeacherScenarioSelectionReadiness(
  runtime: ApiRuntime,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL
): Promise<void> {
  let context: RequestContext | undefined;
  const correlationId = () =>
    context?.requestId ?? request.headers["x-request-id"]?.toString() ?? null;

  try {
    context = createContext(runtime, request);
    const actor = requirePermission(context, "course:read");

    if (!actorHasAnyRole(actor, ["teacher"]) || actor.tenant_id !== context.tenantId) {
      throw new HttpError(403, "AUTHZ-403-001", "teacher authority required");
    }

    const match = url.pathname.match(
      /^\/api\/v1\/bff\/teacher\/runs\/([^/]*)\/scenario-selection-readiness$/
    );
    const runId = parseR7ScenarioSelectionIdentifier(match?.[1]);
    const scenarioPackageIds = url.searchParams.getAll("scenarioPackageId");
    const parameterSetIds = url.searchParams.getAll("parameterSetId");
    const scenarioPackageId = parseR7ScenarioSelectionIdentifier(scenarioPackageIds[0]);
    const parameterSetId = parseR7ScenarioSelectionIdentifier(parameterSetIds[0]);

    if (
      !runId ||
      !scenarioPackageId ||
      !parameterSetId ||
      scenarioPackageIds.length !== 1 ||
      parameterSetIds.length !== 1
    ) {
      sendR7ScenarioSelectionReadinessError(
        response,
        400,
        "R7_BFF_INVALID_REQUEST",
        "runId, scenarioPackageId and parameterSetId are required",
        correlationId()
      );
      return;
    }

    const run = await runtime.repositoryProvider.facade.runs.getRun(context.tenantId, runId);
    if (!run) {
      sendR7ScenarioSelectionReadinessError(
        response,
        404,
        "R7_BFF_SCENARIO_SELECTION_CONTEXT_NOT_FOUND",
        "scenario selection context not found",
        correlationId()
      );
      return;
    }

    const [scenarioPackage, parameterSet] = await Promise.all([
      runtime.repositoryProvider.facade.scenarios.getScenarioPackage(
        context.tenantId,
        scenarioPackageId
      ),
      runtime.repositoryProvider.facade.parameterSets.getParameterSet(
        context.tenantId,
        parameterSetId
      )
    ]);

    if (
      !scenarioPackage ||
      !parameterSet ||
      run.tenant_id !== context.tenantId ||
      scenarioPackage.tenant_id !== context.tenantId ||
      parameterSet.tenant_id !== context.tenantId ||
      run.scenario_package_id !== scenarioPackage.scenario_package_id ||
      run.parameter_set_id !== parameterSet.parameter_set_id
    ) {
      sendR7ScenarioSelectionReadinessError(
        response,
        404,
        "R7_BFF_SCENARIO_SELECTION_CONTEXT_NOT_FOUND",
        "scenario selection context not found",
        correlationId()
      );
      return;
    }

    sendJson(
      response,
      200,
      createR7TeacherScenarioSelectionReadinessProjection({
        parameterSet,
        run,
        scenarioPackage,
        tenantId: context.tenantId
      })
    );
  } catch (error: unknown) {
    if (error instanceof R7TeacherScenarioSelectionGateBlockedError) {
      sendR7ScenarioSelectionReadinessError(
        response,
        409,
        "R7_BFF_SCENARIO_SELECTION_GATE_BLOCKED",
        "scenario selection readiness gate blocked",
        correlationId()
      );
      return;
    }
    if (error instanceof HttpError && error.statusCode === 401) {
      sendR7ScenarioSelectionReadinessError(
        response,
        401,
        "R7_BFF_AUTHENTICATION_REQUIRED",
        "authentication required",
        correlationId()
      );
      return;
    }
    if (error instanceof HttpError && error.statusCode === 403) {
      sendR7ScenarioSelectionReadinessError(
        response,
        403,
        "R7_BFF_TEACHER_AUTHORITY_REQUIRED",
        "teacher authority required",
        correlationId()
      );
      return;
    }

    sendR7ScenarioSelectionReadinessError(
      response,
      500,
      "R7_BFF_INTERNAL_ERROR",
      "internal server error",
      correlationId()
    );
  }
}

async function handleTeacherFormalScenarioPackageCatalog(
  runtime: ApiRuntime,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  let context: RequestContext | undefined;
  const correlationId = () =>
    context?.requestId ?? request.headers["x-request-id"]?.toString() ?? null;

  try {
    context = createContext(runtime, request);
    const actor = requirePermission(context, "course:read");

    if (!actorHasAnyRole(actor, ["teacher"]) || actor.tenant_id !== context.tenantId) {
      throw new HttpError(403, "AUTHZ-403-001", "teacher authority required");
    }

    const candidates = await runtime.formalScenarioPackageCatalog.listApprovedForTenant(
      context.tenantId
    );
    sendJson(response, 200, createTeacherFormalScenarioPackageCatalogProjection(candidates));
  } catch (error: unknown) {
    if (error instanceof HttpError && error.statusCode === 401) {
      sendR7ScenarioSelectionReadinessError(
        response,
        401,
        "TEACHER_FORMAL_SCENARIO_PACKAGE_CATALOG_AUTHENTICATION_REQUIRED",
        "authentication required",
        correlationId()
      );
      return;
    }
    if (error instanceof HttpError && error.statusCode === 403) {
      sendR7ScenarioSelectionReadinessError(
        response,
        403,
        "TEACHER_FORMAL_SCENARIO_PACKAGE_CATALOG_AUTHORITY_REQUIRED",
        "teacher authority required",
        correlationId()
      );
      return;
    }

    sendR7ScenarioSelectionReadinessError(
      response,
      500,
      "TEACHER_FORMAL_SCENARIO_PACKAGE_CATALOG_INTERNAL_ERROR",
      "internal server error",
      correlationId()
    );
  }
}

function toTeacherFormalCourseBindingHttpError(error: unknown): HttpError {
  if (error instanceof TeacherFormalCourseBindingError) {
    return new HttpError(422, "COURSE-422-002", "formal course selection is invalid");
  }
  return new HttpError(422, "COURSE-422-002", "formal course selection is invalid");
}

async function handleTeacherFormalCourseBindingPreview(
  runtime: ApiRuntime,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const context = createContext(runtime, request);
  requirePermission(context, "course:create");
  const body = parseTeacherFormalCourseSelectionBody(
    await readJson<TeacherFormalCourseSelectionBody>(request),
    { requireTitle: false }
  );
  try {
    const preview: TeacherFormalCourseBindingPreviewDto =
      await resolveTeacherFormalCourseBindingPreview({
        authorities: runtime.formalRunBindingAuthorities,
        scenario_package_reference: body.scenario_package_reference,
        tenant_id: context.tenantId
      });
    sendJson(response, 200, createEnvelope(context, preview));
  } catch (error) {
    throw toTeacherFormalCourseBindingHttpError(error);
  }
}

async function handleTeacherFormalCourseCreate(
  runtime: ApiRuntime,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const context = createContext(runtime, request);
  const actor = requirePermission(context, "course:create");
  const body = parseTeacherFormalCourseSelectionBody(
    await readJson<TeacherFormalCourseSelectionBody>(request),
    { requireTitle: true }
  );
  if (!body.title) {
    throw new HttpError(422, "COURSE-422-002", "formal course selection is invalid");
  }
  try {
    const preview = await resolveTeacherFormalCourseBindingPreview({
      authorities: runtime.formalRunBindingAuthorities,
      scenario_package_reference: body.scenario_package_reference,
      tenant_id: context.tenantId
    });
    const course = {
      course_id: runtime.createCourseId(),
      created_by: actor.user_id,
      parameter_set_id: preview.parameter_set_reference.parameter_set_id,
      scenario_package_id: preview.scenario_package_reference.scenario_package_id,
      status: "draft" as const,
      tenant_id: context.tenantId,
      title: body.title
    };
    const created = await createTeacherFormalCourse({
      authorities: runtime.formalRunBindingAuthorities,
      bindingStore: runtime.formalCourseAuthorityBindingStore,
      course,
      persistence: runtime.repositoryProvider.facade.courses,
      scenario_package_reference: body.scenario_package_reference,
      tenant_id: context.tenantId
    });
    await appendAudit(runtime, {
      actor,
      action: "course.create",
      resourceId: course.course_id,
      resourceType: "course",
      requestId: context.requestId,
      after: clonePublic({ ...course, formal_authority_binding: created.binding })
    });
    const payload: TeacherFormalCourseCreateDto = {
      binding_summary: created.summary,
      course,
      operation_id: "TEACHER_FORMAL_COURSE_CREATE_V1"
    };
    sendJson(response, 201, createEnvelope(context, payload));
  } catch (error) {
    throw toTeacherFormalCourseBindingHttpError(error);
  }
}

async function handleR7TeacherScenarioPackageCandidates(
  runtime: ApiRuntime,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL
): Promise<void> {
  let context: RequestContext | undefined;
  const correlationId = () =>
    context?.requestId ?? request.headers["x-request-id"]?.toString() ?? null;

  try {
    context = createContext(runtime, request);
    const actor = requirePermission(context, "course:read");

    if (!actorHasAnyRole(actor, ["teacher"]) || actor.tenant_id !== context.tenantId) {
      throw new HttpError(403, "AUTHZ-403-001", "teacher authority required");
    }

    const match = url.pathname.match(
      /^\/api\/v1\/bff\/teacher\/runs\/([^/]*)\/scenario-package-candidates$/
    );
    const runId = parseR7ScenarioSelectionIdentifier(match?.[1]);
    if (!runId) {
      sendR7ScenarioSelectionReadinessError(
        response,
        400,
        "R7_BFF_INVALID_REQUEST",
        "runId is required",
        correlationId()
      );
      return;
    }

    const run = await runtime.repositoryProvider.facade.runs.getRun(context.tenantId, runId);
    if (!run || run.tenant_id !== context.tenantId) {
      sendR7ScenarioSelectionReadinessError(
        response,
        404,
        "R7_BFF_SCENARIO_SELECTION_CONTEXT_NOT_FOUND",
        "scenario selection context not found",
        correlationId()
      );
      return;
    }

    const scenarioFacade = runtime.repositoryProvider.facade.scenarios;
    if (typeof scenarioFacade.listScenarioPackagesForTenant !== "function") {
      sendR7ScenarioSelectionReadinessError(
        response,
        503,
        "R7_BFF_SCENARIO_CANDIDATE_PROVIDER_UNAVAILABLE",
        "scenario candidate provider unavailable",
        correlationId()
      );
      return;
    }

    const candidates = (
      await scenarioFacade.listScenarioPackagesForTenant(context.tenantId)
    ).filter((candidate) => candidate.tenant_id === context?.tenantId);
    sendJson(
      response,
      200,
      createR7TeacherScenarioPackageCandidatesProjection({ candidates, run })
    );
  } catch (error: unknown) {
    if (error instanceof HttpError && error.statusCode === 401) {
      sendR7ScenarioSelectionReadinessError(
        response,
        401,
        "R7_BFF_AUTHENTICATION_REQUIRED",
        "authentication required",
        correlationId()
      );
      return;
    }
    if (error instanceof HttpError && error.statusCode === 403) {
      sendR7ScenarioSelectionReadinessError(
        response,
        403,
        "R7_BFF_TEACHER_AUTHORITY_REQUIRED",
        "teacher authority required",
        correlationId()
      );
      return;
    }

    sendR7ScenarioSelectionReadinessError(
      response,
      500,
      "R7_BFF_INTERNAL_ERROR",
      "internal server error",
      correlationId()
    );
  }
}

function requireServiceKernel(
  runtime: ApiRuntime,
  request: IncomingMessage,
  context: RequestContext
): CurrentUser {
  const token = getBearerToken(request);
  const servicePrincipal = request.headers["x-service-principal"]?.toString();

  if (
    token !== runtime.securityConfig.internalServiceToken ||
    servicePrincipal !== "service_kernel"
  ) {
    throw new HttpError(403, "AUTHZ-403-002", "service kernel credential required");
  }

  return {
    user_id: "service_kernel",
    tenant_id: context.tenantId,
    display_name: "Service Kernel",
    roles: ["service_kernel"],
    permissions: ["internal:settle"]
  };
}

async function readJson<TBody>(
  request: IncomingMessage,
  options: { requiredObject?: boolean } = {}
): Promise<TBody> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    if (options.requiredObject) {
      throw new HttpError(422, "INSTRUCTOR_ASSET-422-001", "instructor asset request invalid");
    }
    return {} as TBody;
  }

  const body = JSON.parse(raw) as unknown;
  if (
    options.requiredObject &&
    (body === null || typeof body !== "object" || Array.isArray(body))
  ) {
    throw new HttpError(422, "INSTRUCTOR_ASSET-422-001", "instructor asset request invalid");
  }
  return body as TBody;
}

function matchPath(pathname: string, pattern: RegExp): RegExpMatchArray {
  const match = pathname.match(pattern);

  if (!match) {
    throw new HttpError(404, "ROUTE-404-001", "not found");
  }

  return match;
}

function clonePublic(input: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireBodyString(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(422, "RUN-422-002", "formal runtime binding is invalid");
  }

  return value;
}

function requireBodySeed(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new HttpError(422, "RUN-422-002", "formal runtime binding is invalid");
  }

  return value;
}

function parseFormalRunCreateBody(value: unknown): {
  engine_reference: { engine_id: string; version: string };
  parameter_set_reference: { content_digest: string; parameter_set_id: string; version: string };
  scenario_package_reference: {
    content_digest: string;
    scenario_package_id: string;
    tenant_id: string;
    version: string;
  };
  seed: number;
} {
  if (!isRecord(value)) {
    throw new HttpError(422, "RUN-422-002", "formal runtime binding is invalid");
  }

  const engineReference = value.engine_reference;
  const parameterSetReference = value.parameter_set_reference;
  const scenarioPackageReference = value.scenario_package_reference;
  if (
    !isRecord(engineReference) ||
    !isRecord(parameterSetReference) ||
    !isRecord(scenarioPackageReference)
  ) {
    throw new HttpError(422, "RUN-422-002", "formal runtime binding is invalid");
  }

  return {
    engine_reference: {
      engine_id: requireBodyString(engineReference.engine_id),
      version: requireBodyString(engineReference.version)
    },
    parameter_set_reference: {
      content_digest: requireBodyString(parameterSetReference.content_digest),
      parameter_set_id: requireBodyString(parameterSetReference.parameter_set_id),
      version: requireBodyString(parameterSetReference.version)
    },
    scenario_package_reference: {
      content_digest: requireBodyString(scenarioPackageReference.content_digest),
      scenario_package_id: requireBodyString(scenarioPackageReference.scenario_package_id),
      tenant_id: requireBodyString(scenarioPackageReference.tenant_id),
      version: requireBodyString(scenarioPackageReference.version)
    },
    seed: requireBodySeed(value.seed)
  };
}

function parseFormalCourseAuthorityBindingBody(value: unknown): {
  engine_reference: { engine_id: string; version: string };
  parameter_set_reference: { content_digest: string; parameter_set_id: string; version: string };
  scenario_package_reference: {
    content_digest: string;
    scenario_package_id: string;
    tenant_id: string;
    version: string;
  };
} {
  if (!isRecord(value)) {
    throw new HttpError(422, "COURSE-422-002", "formal course authority binding is invalid");
  }

  const engineReference = value.engine_reference;
  const parameterSetReference = value.parameter_set_reference;
  const scenarioPackageReference = value.scenario_package_reference;
  if (
    !isRecord(engineReference) ||
    !isRecord(parameterSetReference) ||
    !isRecord(scenarioPackageReference)
  ) {
    throw new HttpError(422, "COURSE-422-002", "formal course authority binding is invalid");
  }

  return {
    engine_reference: {
      engine_id: requireBodyString(engineReference.engine_id),
      version: requireBodyString(engineReference.version)
    },
    parameter_set_reference: {
      content_digest: requireBodyString(parameterSetReference.content_digest),
      parameter_set_id: requireBodyString(parameterSetReference.parameter_set_id),
      version: requireBodyString(parameterSetReference.version)
    },
    scenario_package_reference: {
      content_digest: requireBodyString(scenarioPackageReference.content_digest),
      scenario_package_id: requireBodyString(scenarioPackageReference.scenario_package_id),
      tenant_id: requireBodyString(scenarioPackageReference.tenant_id),
      version: requireBodyString(scenarioPackageReference.version)
    }
  };
}

function parseTeacherFormalCourseSelectionBody(
  value: unknown,
  options: { requireTitle: boolean }
): {
  scenario_package_reference: {
    content_digest: string;
    scenario_package_id: string;
    tenant_id: string;
    version: string;
  };
  title?: string;
} {
  if (!isRecord(value) || !isRecord(value.scenario_package_reference)) {
    throw new HttpError(422, "COURSE-422-002", "formal course selection is invalid");
  }
  const reference = value.scenario_package_reference;
  if (
    options.requireTitle &&
    (typeof value.title !== "string" || value.title.trim().length === 0)
  ) {
    throw new HttpError(422, "COURSE-422-002", "formal course selection is invalid");
  }
  return {
    scenario_package_reference: {
      content_digest: requireBodyString(reference.content_digest),
      scenario_package_id: requireBodyString(reference.scenario_package_id),
      tenant_id: requireBodyString(reference.tenant_id),
      version: requireBodyString(reference.version)
    },
    ...(typeof value.title === "string" ? { title: value.title.trim() } : {})
  };
}

function toTeacherCourseBlueprintHttpError(error: unknown): HttpError {
  if (
    error instanceof TeacherCourseBlueprintError ||
    error instanceof TeacherFormalCourseBindingError
  ) {
    return new HttpError(
      422,
      "COURSE_BLUEPRINT-422-002",
      "formal CourseBlueprint selection is invalid"
    );
  }
  return courseBlueprintAuthorityHttpError(error);
}

async function handleTeacherCourseBlueprintCatalog(
  runtime: ApiRuntime,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const context = createContext(runtime, request);
  const actor = requirePermission(context, "course:read");
  if (!actorHasAnyRole(actor, ["teacher"]) || actor.tenant_id !== context.tenantId) {
    throw new HttpError(403, "AUTHZ-403-001", "teacher authority required");
  }
  const payload: TeacherCourseBlueprintCatalogDto = await listTeacherCourseBlueprintCatalog(
    runtime.formalCourseBlueprints,
    context.tenantId
  );
  sendJson(response, 200, createEnvelope(context, payload));
}

async function handleTeacherCourseBlueprintReadiness(
  runtime: ApiRuntime,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const context = createContext(runtime, request);
  const actor = requirePermission(context, "course:create");
  if (!actorHasAnyRole(actor, ["teacher"]) || actor.tenant_id !== context.tenantId) {
    throw new HttpError(403, "AUTHZ-403-001", "teacher authority required");
  }
  const body = parseTeacherCourseBlueprintSelectionBody(await readJson(request), {
    requireTitle: false
  });
  try {
    const payload: TeacherCourseBlueprintReadinessDto =
      await resolveTeacherCourseBlueprintReadiness(runtime.formalCourseBlueprints, {
        course_blueprint_reference: body.course_blueprint_reference,
        formal_course: {
          authorities: runtime.formalRunBindingAuthorities,
          scenario_package_reference: body.scenario_package_reference,
          tenant_id: context.tenantId
        }
      });
    sendJson(response, 200, createEnvelope(context, payload));
  } catch (error) {
    throw toTeacherCourseBlueprintHttpError(error);
  }
}

async function handleTeacherCourseBlueprintCourseCreate(
  runtime: ApiRuntime,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const context = createContext(runtime, request);
  const actor = requirePermission(context, "course:create");
  if (!actorHasAnyRole(actor, ["teacher"]) || actor.tenant_id !== context.tenantId) {
    throw new HttpError(403, "AUTHZ-403-001", "teacher authority required");
  }
  const body = parseTeacherCourseBlueprintSelectionBody(await readJson(request), {
    requireTitle: true
  });
  if (!body.title) throw courseBlueprintRequestError();
  try {
    const readiness = await resolveTeacherCourseBlueprintReadiness(runtime.formalCourseBlueprints, {
      course_blueprint_reference: body.course_blueprint_reference,
      formal_course: {
        authorities: runtime.formalRunBindingAuthorities,
        scenario_package_reference: body.scenario_package_reference,
        tenant_id: context.tenantId
      }
    });
    const course = {
      course_id: runtime.createCourseId(),
      created_by: actor.user_id,
      parameter_set_id: readiness.formal_course_binding.parameter_set_reference.parameter_set_id,
      scenario_package_id:
        readiness.formal_course_binding.scenario_package_reference.scenario_package_id,
      status: "draft" as const,
      tenant_id: context.tenantId,
      title: body.title
    };
    const created = await createTeacherCourseFromBlueprint(runtime.formalCourseBlueprints, {
      beforeCommit: async () => {
        await appendAudit(runtime, {
          actor,
          action: "course.create",
          resourceId: course.course_id,
          resourceType: "course",
          requestId: context.requestId,
          after: clonePublic({
            ...course,
            course_blueprint_reference: body.course_blueprint_reference
          })
        });
      },
      bindingStore: runtime.courseBlueprintBindingStore,
      course,
      course_blueprint_reference: body.course_blueprint_reference,
      formalCourse: {
        authorities: runtime.formalRunBindingAuthorities,
        bindingStore: runtime.formalCourseAuthorityBindingStore,
        persistence: runtime.repositoryProvider.facade.courses,
        scenario_package_reference: body.scenario_package_reference,
        tenant_id: context.tenantId
      },
      formal_course: {
        authorities: runtime.formalRunBindingAuthorities,
        scenario_package_reference: body.scenario_package_reference,
        tenant_id: context.tenantId
      }
    });
    sendJson(
      response,
      201,
      createEnvelope(context, created as TeacherCourseBlueprintCourseCreateDto)
    );
  } catch (error) {
    throw toTeacherCourseBlueprintHttpError(error);
  }
}

function requireTeacherCourseBlueprintStudioActor(context: RequestContext): {
  actor: CurrentUser;
  commandActor: CourseBlueprintAuthorityActor;
} {
  const actor = requirePermission(context, "course:create");
  if (!actorHasAnyRole(actor, ["teacher"]) || actor.tenant_id !== context.tenantId) {
    throw new HttpError(403, "AUTHZ-403-001", "teacher authority required");
  }
  return {
    actor,
    commandActor: createCourseBlueprintActor(context, actor)
  };
}

async function handleTeacherCourseBlueprintStudioPreview(
  runtime: ApiRuntime,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const context = createContext(runtime, request);
  requireTeacherCourseBlueprintStudioActor(context);
  const body = await readJson(request);
  if (!isRecord(body) || !isRecord(body.course_blueprint_reference)) {
    throw courseBlueprintRequestError();
  }
  assertOnlyCourseBlueprintKeys(body, ["course_blueprint_reference"]);
  try {
    const payload = await previewTeacherCourseBlueprint(
      runtime.formalCourseBlueprints,
      context.tenantId,
      parseCourseBlueprintReference(body.course_blueprint_reference, context.tenantId)
    );
    sendJson(response, 200, createEnvelope(context, payload));
  } catch (error) {
    throw toTeacherCourseBlueprintHttpError(error);
  }
}

async function handleTeacherCourseBlueprintStudioDraftCreate(
  runtime: ApiRuntime,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const context = createContext(runtime, request);
  const { actor, commandActor } = requireTeacherCourseBlueprintStudioActor(context);
  const body = await readJson(request);
  if (
    !isRecord(body) ||
    !isRecord(body.source_course_blueprint_reference) ||
    !isRecord(body.draft)
  ) {
    throw courseBlueprintRequestError();
  }
  assertOnlyCourseBlueprintKeys(body, ["draft", "source_course_blueprint_reference"]);
  assertOnlyCourseBlueprintKeys(body.draft, [
    "activity_plan",
    "description",
    "duration_minutes",
    "instructor_guidance_reference",
    "objectives",
    "ordered_phases",
    "required_product_capabilities",
    "scenario_compatibility_constraints",
    "schema_version",
    "title",
    "version"
  ]);
  if (
    !Array.isArray(body.draft.ordered_phases) ||
    body.draft.ordered_phases.some((phase) => {
      if (!isRecord(phase)) return true;
      try {
        assertOnlyCourseBlueprintKeys(phase, [
          "activity_type",
          "duration_minutes",
          "order",
          "phase_id",
          "student_instruction",
          "teacher_guidance",
          "title"
        ]);
        return false;
      } catch {
        return true;
      }
    })
  ) {
    throw courseBlueprintRequestError();
  }
  const sourceReference = parseCourseBlueprintReference(
    body.source_course_blueprint_reference,
    context.tenantId
  );
  const parsed = parseCourseBlueprintDraft(
    {
      ...body.draft,
      course_blueprint_id: sourceReference.course_blueprint_id,
      tenant_id: context.tenantId
    },
    context.tenantId
  );
  const draft = {
    activity_plan: parsed.activity_plan,
    description: parsed.description,
    duration_minutes: parsed.duration_minutes,
    instructor_guidance_reference: parsed.instructor_guidance_reference,
    objectives: parsed.objectives,
    ordered_phases: parsed.ordered_phases,
    required_product_capabilities: parsed.required_product_capabilities,
    scenario_compatibility_constraints: parsed.scenario_compatibility_constraints,
    schema_version: parsed.schema_version,
    title: parsed.title,
    version: parsed.version
  };
  try {
    const created = await createTeacherCourseBlueprintDraft(
      runtime.formalCourseBlueprints,
      commandActor,
      {
        draft,
        source_course_blueprint_reference: sourceReference
      },
      async (pending) => {
        await appendAudit(runtime, {
          actor,
          action: "course_blueprint.teacher_draft_create",
          after: clonePublic(pending),
          requestId: context.requestId,
          resourceId: `${pending.course_blueprint_reference.course_blueprint_id}:${pending.course_blueprint_reference.version}`,
          resourceType: "formal_course_blueprint",
          tenantId: context.tenantId
        });
      }
    );
    sendJson(response, 201, createEnvelope(context, created));
  } catch (error) {
    throw toTeacherCourseBlueprintHttpError(error);
  }
}

async function handleTeacherCourseBlueprintStudioSubmission(
  runtime: ApiRuntime,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const context = createContext(runtime, request);
  const { actor, commandActor } = requireTeacherCourseBlueprintStudioActor(context);
  const body = await readJson(request);
  if (!isRecord(body) || !isRecord(body.course_blueprint_reference)) {
    throw courseBlueprintRequestError();
  }
  assertOnlyCourseBlueprintKeys(body, ["course_blueprint_reference"]);
  const reference = parseCourseBlueprintReference(
    body.course_blueprint_reference,
    context.tenantId
  );
  try {
    const submitted = await submitTeacherCourseBlueprintDraft(
      runtime.formalCourseBlueprints,
      commandActor,
      reference,
      async (pending) => {
        await appendAudit(runtime, {
          actor,
          action: "course_blueprint.teacher_draft_submit",
          after: clonePublic(pending),
          requestId: context.requestId,
          resourceId: `${reference.course_blueprint_id}:${reference.version}`,
          resourceType: "formal_course_blueprint",
          tenantId: context.tenantId
        });
      }
    );
    sendJson(response, 200, createEnvelope(context, submitted));
  } catch (error) {
    throw toTeacherCourseBlueprintHttpError(error);
  }
}

function courseBlueprintRequestError(): HttpError {
  return new HttpError(
    422,
    "COURSE_BLUEPRINT-422-001",
    "formal course blueprint request is invalid"
  );
}

function assertOnlyCourseBlueprintKeys(
  value: Record<string, unknown>,
  allowed: readonly string[]
): void {
  const allowedKeys = new Set(allowed);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    throw courseBlueprintRequestError();
  }
}

function parseCourseBlueprintReference(
  value: unknown,
  tenantId: string
): import("@simwar/shared-contracts").CourseBlueprintReference {
  if (!isRecord(value) || requireBodyString(value.tenant_id) !== tenantId) {
    throw courseBlueprintRequestError();
  }
  return {
    content_digest: requireBodyString(value.content_digest),
    course_blueprint_id: requireBodyString(value.course_blueprint_id),
    tenant_id: tenantId,
    version: requireBodyString(value.version)
  };
}

function parseCourseBlueprintDraft(value: unknown, tenantId: string): CourseBlueprintDraftInput {
  if (!isRecord(value) || requireBodyString(value.tenant_id) !== tenantId) {
    throw courseBlueprintRequestError();
  }
  const stringArray = (candidate: unknown): string[] => {
    if (!Array.isArray(candidate) || candidate.some((item) => typeof item !== "string")) {
      throw courseBlueprintRequestError();
    }
    return candidate.map((item) => item.trim());
  };
  if (
    !Array.isArray(value.ordered_phases) ||
    !Array.isArray(value.activity_plan) ||
    !isRecord(value.scenario_compatibility_constraints)
  ) {
    throw courseBlueprintRequestError();
  }
  return {
    activity_plan: value.activity_plan as CourseBlueprintDraftInput["activity_plan"],
    course_blueprint_id: requireBodyString(value.course_blueprint_id),
    description: requireBodyString(value.description),
    duration_minutes: Number(value.duration_minutes),
    instructor_guidance_reference: requireBodyString(value.instructor_guidance_reference),
    objectives: stringArray(value.objectives),
    ordered_phases: value.ordered_phases.map((phase) => {
      if (!isRecord(phase)) throw courseBlueprintRequestError();
      return {
        activity_type: requireBodyString(phase.activity_type),
        duration_minutes: Number(phase.duration_minutes),
        order: Number(phase.order),
        phase_id: requireBodyString(phase.phase_id),
        student_instruction: requireBodyString(phase.student_instruction),
        teacher_guidance: requireBodyString(phase.teacher_guidance),
        title: requireBodyString(phase.title)
      };
    }),
    required_product_capabilities: stringArray(value.required_product_capabilities),
    scenario_compatibility_constraints: Object.fromEntries(
      Object.entries(value.scenario_compatibility_constraints).map(([key, item]) => [
        key,
        requireBodyString(item)
      ])
    ),
    schema_version: requireBodyString(value.schema_version),
    tenant_id: tenantId,
    title: requireBodyString(value.title),
    version: requireBodyString(value.version)
  };
}

function parseTeacherCourseBlueprintSelectionBody(
  value: unknown,
  options: { requireTitle: boolean }
): {
  course_blueprint_reference: import("@simwar/shared-contracts").CourseBlueprintReference;
  scenario_package_reference: ScenarioPackageReference;
  title?: string;
} {
  const formal = parseTeacherFormalCourseSelectionBody(value, options);
  if (!isRecord(value) || !isRecord(value.course_blueprint_reference)) {
    throw courseBlueprintRequestError();
  }
  return {
    course_blueprint_reference: parseCourseBlueprintReference(
      value.course_blueprint_reference,
      formal.scenario_package_reference.tenant_id
    ),
    scenario_package_reference: {
      content_digest: requireBodyString(formal.scenario_package_reference.content_digest),
      scenario_package_id: requireBodyString(formal.scenario_package_reference.scenario_package_id),
      tenant_id: requireBodyString(formal.scenario_package_reference.tenant_id),
      version: requireBodyString(formal.scenario_package_reference.version)
    },
    ...(formal.title ? { title: formal.title } : {})
  };
}

function createCourseBlueprintActor(
  context: RequestContext,
  actor: CurrentUser
): CourseBlueprintAuthorityActor {
  return {
    actor_id: actor.user_id,
    capabilities: ["course_blueprint:manage"],
    correlation_id: context.requestId,
    tenant_id: context.tenantId
  };
}

function courseBlueprintAuthorityHttpError(error: unknown): HttpError {
  if (!(error instanceof CourseBlueprintAuthorityError)) {
    throw error;
  }
  switch (error.code) {
    case "NOT_FOUND":
      return new HttpError(
        404,
        "COURSE_BLUEPRINT-404-001",
        "formal course blueprint version not found"
      );
    case "TENANT_SCOPE_VIOLATION":
    case "COURSE_BLUEPRINT_CAPABILITY_REQUIRED":
      return new HttpError(
        403,
        "COURSE_BLUEPRINT-403-001",
        "formal course blueprint authority required"
      );
    case "COURSE_BLUEPRINT_INVALID_TRANSITION":
    case "COURSE_BLUEPRINT_VERSION_ALREADY_EXISTS":
    case "DIGEST_MISMATCH":
    case "NOT_APPROVED":
    case "RETIRED_FOR_NEW_BINDING":
      return new HttpError(
        409,
        "COURSE_BLUEPRINT-409-001",
        "formal course blueprint lifecycle conflict"
      );
    default:
      return courseBlueprintRequestError();
  }
}

async function executeCourseBlueprintCommand<T>(command: () => Promise<T>): Promise<T> {
  try {
    return await command();
  } catch (error) {
    throw courseBlueprintAuthorityHttpError(error);
  }
}

function formalParameterSetRequestError(): HttpError {
  return new HttpError(422, "PARAMETER_SET-422-001", "formal parameter set request is invalid");
}

function parseFormalParameterSetString(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw formalParameterSetRequestError();
  }

  return value;
}

function parseFormalParameterSetStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    throw formalParameterSetRequestError();
  }

  const entries = Object.entries(value);
  if (entries.some(([key, entry]) => key.trim().length === 0 || typeof entry !== "string")) {
    throw formalParameterSetRequestError();
  }

  return entries.reduce<Record<string, string>>((record, [key, entry]) => {
    record[key] = entry as string;
    return record;
  }, {});
}

function parseFormalParameterSetReference(value: unknown, tenantId: string): ParameterSetReference {
  if (!isRecord(value) || parseFormalParameterSetString(value.tenant_id) !== tenantId) {
    throw formalParameterSetRequestError();
  }

  try {
    return createParameterSetReference({
      content_digest: parseFormalParameterSetString(value.content_digest),
      parameter_set_id: parseFormalParameterSetString(value.parameter_set_id),
      version: parseFormalParameterSetString(value.version)
    });
  } catch {
    throw formalParameterSetRequestError();
  }
}

function parseFormalParameterSetDraft(value: unknown, tenantId: string): ParameterSetDraftInput {
  if (!isRecord(value) || parseFormalParameterSetString(value.tenant_id) !== tenantId) {
    throw formalParameterSetRequestError();
  }

  if (value.parameter_values === undefined) {
    throw formalParameterSetRequestError();
  }

  return {
    compatibility_metadata: parseFormalParameterSetStringRecord(value.compatibility_metadata),
    model_version_ref: parseFormalParameterSetString(value.model_version_ref),
    parameter_set_id: parseFormalParameterSetString(value.parameter_set_id),
    parameter_values: value.parameter_values as ParameterSetJsonValue,
    ...(value.parent_reference === undefined
      ? {}
      : { parent_reference: parseFormalParameterSetReference(value.parent_reference, tenantId) }),
    schema_version: parseFormalParameterSetString(value.schema_version),
    tenant_id: tenantId,
    version: parseFormalParameterSetString(value.version)
  };
}

function createFormalParameterSetActor(
  context: RequestContext,
  actor: CurrentUser
): ParameterSetAuthorityActor {
  return {
    actor_id: actor.user_id,
    capabilities: ["parameter_set:manage"],
    correlation_id: context.requestId,
    tenant_id: context.tenantId
  };
}

function parameterSetAuthorityHttpError(error: unknown): HttpError {
  if (!(error instanceof ParameterSetAuthorityError)) {
    throw error;
  }

  switch (error.code) {
    case "NOT_FOUND":
      return new HttpError(404, "PARAMETER_SET-404-001", "formal parameter set version not found");
    case "TENANT_SCOPE_VIOLATION":
    case "PARAMETER_SET_CAPABILITY_REQUIRED":
      return new HttpError(403, "PARAMETER_SET-403-001", "formal parameter set authority required");
    case "PARAMETER_SET_INVALID_TRANSITION":
    case "PARAMETER_SET_VERSION_ALREADY_EXISTS":
    case "DIGEST_MISMATCH":
    case "NOT_APPROVED":
    case "RETIRED_FOR_NEW_BINDING":
      return new HttpError(409, "PARAMETER_SET-409-001", "formal parameter set lifecycle conflict");
    default:
      return formalParameterSetRequestError();
  }
}

async function executeFormalParameterSetCommand<T>(command: () => Promise<T>): Promise<T> {
  try {
    return await command();
  } catch (error) {
    throw parameterSetAuthorityHttpError(error);
  }
}

function formalParameterSetResourceId(reference: ParameterSetReference): string {
  return `${reference.parameter_set_id}@${reference.version}:${reference.content_digest}`;
}

function assertFormalParameterSetPathReference(
  reference: ParameterSetReference,
  parameterSetId: string,
  version: string
): void {
  if (reference.parameter_set_id !== parameterSetId || reference.version !== version) {
    throw formalParameterSetRequestError();
  }
}

function formalScenarioPackageRequestError(): HttpError {
  return new HttpError(
    422,
    "SCENARIO_PACKAGE-422-001",
    "formal scenario package request is invalid"
  );
}

function parseFormalScenarioPackageString(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw formalScenarioPackageRequestError();
  }

  return value;
}

function parseFormalScenarioPackageStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    throw formalScenarioPackageRequestError();
  }

  const entries = Object.entries(value);
  if (entries.some(([key, entry]) => key.trim().length === 0 || typeof entry !== "string")) {
    throw formalScenarioPackageRequestError();
  }

  return entries.reduce<Record<string, string>>((record, [key, entry]) => {
    record[key] = entry as string;
    return record;
  }, {});
}

function parseFormalScenarioPackageJsonRecord(
  value: unknown
): Record<string, ScenarioPackageJsonValue> {
  if (!isRecord(value)) {
    throw formalScenarioPackageRequestError();
  }

  return value as Record<string, ScenarioPackageJsonValue>;
}

function parseFormalScenarioPackageParameterSetReference(value: unknown): ParameterSetReference {
  if (!isRecord(value)) {
    throw formalScenarioPackageRequestError();
  }

  try {
    return createParameterSetReference({
      content_digest: parseFormalScenarioPackageString(value.content_digest),
      parameter_set_id: parseFormalScenarioPackageString(value.parameter_set_id),
      version: parseFormalScenarioPackageString(value.version)
    });
  } catch {
    throw formalScenarioPackageRequestError();
  }
}

function parseFormalScenarioPackageReference(
  value: unknown,
  tenantId: string
): ScenarioPackageReference {
  if (!isRecord(value) || parseFormalScenarioPackageString(value.tenant_id) !== tenantId) {
    throw formalScenarioPackageRequestError();
  }

  try {
    return createScenarioPackageReference({
      content_digest: parseFormalScenarioPackageString(value.content_digest),
      scenario_package_id: parseFormalScenarioPackageString(value.scenario_package_id),
      tenant_id: tenantId,
      version: parseFormalScenarioPackageString(value.version)
    });
  } catch {
    throw formalScenarioPackageRequestError();
  }
}

function parseFormalScenarioPackageArtifactPolicy(
  value: unknown
): ScenarioPackageDraftInput["artifact_policy"] {
  if (!isRecord(value)) {
    throw formalScenarioPackageRequestError();
  }

  const mode = value.mode;
  const retention = value.retention;
  if ((mode !== "INLINE" && mode !== "IMMUTABLE_REFERENCE") || retention !== "IMMUTABLE") {
    throw formalScenarioPackageRequestError();
  }

  const optionalString = (entry: unknown): string | undefined =>
    entry === undefined ? undefined : parseFormalScenarioPackageString(entry);
  const artifactDigest = optionalString(value.artifact_digest);
  const artifactMediaType = optionalString(value.artifact_media_type);
  const artifactReference = optionalString(value.artifact_reference);

  return {
    ...(artifactDigest === undefined ? {} : { artifact_digest: artifactDigest }),
    ...(artifactMediaType === undefined ? {} : { artifact_media_type: artifactMediaType }),
    ...(artifactReference === undefined ? {} : { artifact_reference: artifactReference }),
    mode,
    retention
  };
}

function parseFormalScenarioPackagePluginDependencies(
  value: unknown
): ScenarioPackageDraftInput["plugin_dependencies"] {
  if (!Array.isArray(value)) {
    throw formalScenarioPackageRequestError();
  }

  return value.map((entry) => {
    if (!isRecord(entry)) {
      throw formalScenarioPackageRequestError();
    }

    return {
      plugin_package_id: parseFormalScenarioPackageString(entry.plugin_package_id),
      version: parseFormalScenarioPackageString(entry.version)
    };
  });
}

function parseFormalScenarioPackageDraft(
  value: unknown,
  tenantId: string
): ScenarioPackageDraftInput {
  if (!isRecord(value) || parseFormalScenarioPackageString(value.tenant_id) !== tenantId) {
    throw formalScenarioPackageRequestError();
  }

  if (value.content === undefined) {
    throw formalScenarioPackageRequestError();
  }

  return {
    artifact_policy: parseFormalScenarioPackageArtifactPolicy(value.artifact_policy),
    compatibility_metadata: parseFormalScenarioPackageStringRecord(value.compatibility_metadata),
    content: value.content as ScenarioPackageJsonValue,
    metadata: parseFormalScenarioPackageJsonRecord(value.metadata),
    parameter_set_reference: parseFormalScenarioPackageParameterSetReference(
      value.parameter_set_reference
    ),
    plugin_dependencies: parseFormalScenarioPackagePluginDependencies(value.plugin_dependencies),
    scenario_package_id: parseFormalScenarioPackageString(value.scenario_package_id),
    schema_version: parseFormalScenarioPackageString(value.schema_version),
    tenant_id: tenantId,
    version: parseFormalScenarioPackageString(value.version)
  };
}

function tenantBaselineRequestError(): HttpError {
  return new HttpError(
    422,
    "TENANT_BASELINE-422-001",
    "tenant baseline provisioning request is invalid"
  );
}

function assertOnlyTenantBaselineFields(
  value: Record<string, unknown>,
  allowed: readonly string[]
): void {
  const allowedFields = new Set(allowed);
  if (Object.keys(value).some((key) => !allowedFields.has(key))) {
    throw tenantBaselineRequestError();
  }
}

function parseTenantBaselineTenantId(value: unknown): string {
  const tenantId = parseFormalParameterSetString(value);
  if (tenantId !== tenantId.trim()) throw tenantBaselineRequestError();
  return tenantId;
}

function parseTenantBaselineProvisioningRequest(value: unknown): TenantBaselineProvisioningRequest {
  if (!isRecord(value)) throw tenantBaselineRequestError();
  assertOnlyTenantBaselineFields(value, [
    "idempotency_key",
    "source_parameter_set",
    "source_scenario_package",
    "target_tenant_id"
  ]);
  if (!isRecord(value.source_parameter_set) || !isRecord(value.source_scenario_package)) {
    throw tenantBaselineRequestError();
  }
  assertOnlyTenantBaselineFields(value.source_parameter_set, [
    "content_digest",
    "parameter_set_id",
    "source_tenant_id",
    "version"
  ]);
  assertOnlyTenantBaselineFields(value.source_scenario_package, [
    "content_digest",
    "scenario_package_id",
    "source_tenant_id",
    "tenant_id",
    "version"
  ]);
  const request: TenantBaselineProvisioningRequest = {
    idempotency_key: parseFormalParameterSetString(value.idempotency_key),
    source_parameter_set: {
      content_digest: parseFormalParameterSetString(value.source_parameter_set.content_digest),
      parameter_set_id: parseFormalParameterSetString(value.source_parameter_set.parameter_set_id),
      source_tenant_id: parseTenantBaselineTenantId(value.source_parameter_set.source_tenant_id),
      version: parseFormalParameterSetString(value.source_parameter_set.version)
    },
    source_scenario_package: {
      content_digest: parseFormalScenarioPackageString(
        value.source_scenario_package.content_digest
      ),
      scenario_package_id: parseFormalScenarioPackageString(
        value.source_scenario_package.scenario_package_id
      ),
      source_tenant_id: parseTenantBaselineTenantId(value.source_scenario_package.source_tenant_id),
      ...(value.source_scenario_package.tenant_id === undefined
        ? {}
        : { tenant_id: parseTenantBaselineTenantId(value.source_scenario_package.tenant_id) }),
      version: parseFormalScenarioPackageString(value.source_scenario_package.version)
    },
    target_tenant_id: parseTenantBaselineTenantId(value.target_tenant_id)
  };
  if (
    request.source_scenario_package.tenant_id !== undefined &&
    request.source_scenario_package.tenant_id !== request.source_scenario_package.source_tenant_id
  ) {
    throw tenantBaselineRequestError();
  }
  try {
    createParameterSetReference(request.source_parameter_set);
    createScenarioPackageReference({
      content_digest: request.source_scenario_package.content_digest,
      scenario_package_id: request.source_scenario_package.scenario_package_id,
      tenant_id: request.source_scenario_package.source_tenant_id,
      version: request.source_scenario_package.version
    });
  } catch {
    throw tenantBaselineRequestError();
  }
  return request;
}

function tenantBaselineProvisioningHttpError(error: unknown): HttpError {
  if (!(error instanceof TenantBaselineProvisioningError)) throw error;
  switch (error.code) {
    case "SOURCE_NOT_FOUND":
      return new HttpError(404, "TENANT_BASELINE-404-001", "approved source baseline not found");
    case "SOURCE_SCOPE_DENIED":
      return new HttpError(403, "TENANT_BASELINE-403-001", "tenant baseline scope denied");
    case "CONFLICT":
      return new HttpError(409, "TENANT_BASELINE-409-001", "tenant baseline conflict");
    case "AUDIT_FAILED":
      return new HttpError(
        500,
        "TENANT_BASELINE-500-001",
        "tenant baseline audit could not be persisted"
      );
    case "SOURCE_NOT_APPROVED":
      return new HttpError(422, "TENANT_BASELINE-422-001", "source baseline is not approved");
    case "REQUEST_INVALID":
      return tenantBaselineRequestError();
  }
}

async function executeTenantBaselineProvisioning<T>(command: () => Promise<T>): Promise<T> {
  try {
    return await command();
  } catch (error) {
    throw tenantBaselineProvisioningHttpError(error);
  }
}

function parseGenericScenarioCompileDraft(
  value: unknown,
  tenantId: string
): GenericScenarioCompilerInput {
  if (!isRecord(value) || parseFormalScenarioPackageString(value.tenant_id) !== tenantId) {
    throw formalScenarioPackageRequestError();
  }

  if (!isRecord(value.source_reference) || !isRecord(value.template)) {
    throw formalScenarioPackageRequestError();
  }

  const source = value.source_reference;
  const sourceKind = parseFormalScenarioPackageString(source.source_kind);
  const sourceStatus = parseFormalScenarioPackageString(source.status);
  if (
    (sourceKind !== "SYNTHETIC_INTERNAL" && sourceKind !== "TEACHER_AUTHORED_DRAFT") ||
    (sourceStatus !== "REGISTERED" && sourceStatus !== "RETIRED") ||
    parseFormalScenarioPackageString(source.tenant_id) !== tenantId ||
    value.template.content === undefined
  ) {
    throw formalScenarioPackageRequestError();
  }

  return {
    artifact_policy: parseFormalScenarioPackageArtifactPolicy(value.artifact_policy),
    compatibility_metadata: parseFormalScenarioPackageStringRecord(value.compatibility_metadata),
    metadata: parseFormalScenarioPackageJsonRecord(value.metadata),
    parameter_set_reference: parseFormalScenarioPackageParameterSetReference(
      value.parameter_set_reference
    ),
    plugin_dependencies: parseFormalScenarioPackagePluginDependencies(value.plugin_dependencies),
    scenario_package_id: parseFormalScenarioPackageString(value.scenario_package_id),
    schema_version: parseFormalScenarioPackageString(value.schema_version),
    source_reference: {
      license_provenance_id: parseFormalScenarioPackageString(source.license_provenance_id),
      source_digest: parseFormalScenarioPackageString(source.source_digest),
      source_id: parseFormalScenarioPackageString(source.source_id),
      source_kind: sourceKind,
      source_version: parseFormalScenarioPackageString(source.source_version),
      status: sourceStatus,
      tenant_id: tenantId
    },
    template: {
      content: value.template.content as ScenarioPackageJsonValue,
      template_id: parseFormalScenarioPackageString(value.template.template_id),
      template_version: parseFormalScenarioPackageString(value.template.template_version)
    },
    tenant_id: tenantId,
    version: parseFormalScenarioPackageString(value.version)
  };
}

function createFormalScenarioPackageActor(
  context: RequestContext,
  actor: CurrentUser
): ScenarioPackageAuthorityActor {
  return {
    actor_id: actor.user_id,
    capabilities: ["scenario_package:manage"],
    correlation_id: context.requestId,
    tenant_id: context.tenantId
  };
}

function scenarioPackageAuthorityHttpError(error: unknown): HttpError {
  if (!(error instanceof ScenarioPackageAuthorityError)) {
    throw error;
  }

  switch (error.code) {
    case "NOT_FOUND":
      return new HttpError(
        404,
        "SCENARIO_PACKAGE-404-001",
        "formal scenario package version not found"
      );
    case "TENANT_SCOPE_VIOLATION":
    case "SCENARIO_PACKAGE_CAPABILITY_REQUIRED":
      return new HttpError(
        403,
        "SCENARIO_PACKAGE-403-001",
        "formal scenario package authority required"
      );
    case "SCENARIO_PACKAGE_INVALID_TRANSITION":
    case "SCENARIO_PACKAGE_VERSION_ALREADY_EXISTS":
    case "SCENARIO_PACKAGE_DIGEST_CONFLICT":
    case "SCENARIO_PACKAGE_PARAMETER_SET_NOT_BINDABLE":
    case "DIGEST_MISMATCH":
    case "NOT_APPROVED":
    case "RETIRED_FOR_NEW_BINDING":
      return new HttpError(
        409,
        "SCENARIO_PACKAGE-409-001",
        "formal scenario package lifecycle conflict"
      );
    default:
      return formalScenarioPackageRequestError();
  }
}

async function executeFormalScenarioPackageCommand<T>(command: () => Promise<T>): Promise<T> {
  try {
    return await command();
  } catch (error) {
    throw scenarioPackageAuthorityHttpError(error);
  }
}

function formalScenarioPackageResourceId(reference: ScenarioPackageReference): string {
  return `${reference.scenario_package_id}@${reference.version}:${reference.content_digest}`;
}

function assertFormalScenarioPackagePathReference(
  reference: ScenarioPackageReference,
  scenarioPackageId: string,
  version: string
): void {
  if (reference.scenario_package_id !== scenarioPackageId || reference.version !== version) {
    throw formalScenarioPackageRequestError();
  }
}

function formalPluginReleaseRequestError(): HttpError {
  return new HttpError(422, "PLUGIN_RELEASE-422-001", "formal plugin release request is invalid");
}

function parseFormalPluginReleaseString(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0)
    throw formalPluginReleaseRequestError();
  return value;
}

function parseFormalPluginReleaseReference(value: unknown): PluginReleaseReference {
  if (!isRecord(value)) throw formalPluginReleaseRequestError();
  try {
    return createPluginReleaseReference({
      content_digest: parseFormalPluginReleaseString(value.content_digest),
      plugin_package_id: parseFormalPluginReleaseString(value.plugin_package_id),
      version: parseFormalPluginReleaseString(value.version)
    });
  } catch {
    throw formalPluginReleaseRequestError();
  }
}

function parseFormalPluginReleaseDraft(value: unknown): PluginReleaseDraftInput {
  if (
    !isRecord(value) ||
    !isRecord(value.compatibility_metadata) ||
    !isRecord(value.plugin_manifest) ||
    !Array.isArray(value.official_commit_permissions)
  )
    throw formalPluginReleaseRequestError();
  const metadata = Object.entries(value.compatibility_metadata);
  if (
    metadata.some(([key, entry]) => key.trim().length === 0 || typeof entry !== "string") ||
    value.official_commit_permissions.some((entry) => typeof entry !== "string")
  )
    throw formalPluginReleaseRequestError();
  return {
    compatibility_metadata: Object.fromEntries(metadata) as Record<string, string>,
    official_commit_permissions: value.official_commit_permissions as string[],
    plugin_manifest: value.plugin_manifest as unknown as PluginReleaseDraftInput["plugin_manifest"],
    plugin_package_id: parseFormalPluginReleaseString(value.plugin_package_id),
    schema_version: parseFormalPluginReleaseString(value.schema_version),
    version: parseFormalPluginReleaseString(value.version)
  };
}

function createFormalPluginReleaseActor(
  context: RequestContext,
  actor: CurrentUser
): PluginReleaseAuthorityActor {
  return {
    actor_id: actor.user_id,
    capabilities: [
      "plugin_release:manage",
      "plugin_release:approve",
      "plugin_release:make_available"
    ],
    correlation_id: context.requestId
  };
}

function pluginReleaseAuthorityHttpError(error: unknown): HttpError {
  if (!(error instanceof PluginReleaseAuthorityError)) throw error;
  if (error.code === "PLUGIN_RELEASE_NOT_FOUND")
    return new HttpError(404, "PLUGIN_RELEASE-404-001", "formal plugin release not found");
  if (error.code === "PLUGIN_RELEASE_CAPABILITY_REQUIRED")
    return new HttpError(403, "PLUGIN_RELEASE-403-001", "formal plugin release authority required");
  if (
    [
      "PLUGIN_RELEASE_INVALID_TRANSITION",
      "PLUGIN_RELEASE_VERSION_ALREADY_EXISTS",
      "PLUGIN_RELEASE_CONTENT_DIGEST_CONFLICT",
      "PLUGIN_RELEASE_NOT_APPROVED",
      "PLUGIN_RELEASE_NOT_AVAILABLE",
      "PLUGIN_RELEASE_RETIRED_FOR_NEW_BINDING"
    ].includes(error.code)
  )
    return new HttpError(409, "PLUGIN_RELEASE-409-001", "formal plugin release lifecycle conflict");
  return formalPluginReleaseRequestError();
}

async function executeFormalPluginReleaseCommand<T>(command: () => Promise<T>): Promise<T> {
  try {
    return await command();
  } catch (error) {
    throw pluginReleaseAuthorityHttpError(error);
  }
}

function assertFormalPluginReleasePathReference(
  reference: PluginReleaseReference,
  pluginPackageId: string,
  version: string
): void {
  if (reference.plugin_package_id !== pluginPackageId || reference.version !== version)
    throw formalPluginReleaseRequestError();
}

function serializeDecisionPayloadForIdempotency(payload: DecisionPayload): string {
  return JSON.stringify(payload);
}

const decisionPayloadKeys = [
  "pricing",
  "marketing_budget",
  "service_quality_budget",
  "capacity_plan",
  "cash_buffer_target",
  "strategy_statement"
] as const;

function hasOnlyKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return Object.keys(value).every((key) => expected.includes(key));
}

/**
 * The legacy direct learner submission route has no extensibility contract.
 * Reject unknown JSON keys before they can become canonical-decision or replay-hash input.
 */
function assertNoUnexpectedDecisionPayloadFields(payload: unknown): void {
  if (!isRecord(payload)) return;

  const pricing = payload.pricing;
  if (
    !hasOnlyKeys(payload, decisionPayloadKeys) ||
    (isRecord(pricing) && !hasOnlyKeys(pricing, ["base_price"]))
  ) {
    throw new HttpError(422, "DEC-422-001", "decision validation failed", [
      { field: "decision_payload", reason: "unexpected_fields" }
    ]);
  }
}

async function findIdempotentDecisionSubmission(
  runtime: ApiRuntime,
  context: RequestContext,
  input: {
    actor: CurrentUser;
    payload: DecisionPayload;
    roundNo: number;
    runId: string;
    teamId: string;
  }
): Promise<Decision | null> {
  const priorDecisionSubmitLogs = await runtime.repositoryProvider.facade.auditLogs.listAuditLogs({
    action: "decision.submit",
    actor_id: input.actor.user_id,
    resource_type: "decision",
    scope: "tenant",
    tenant_id: context.tenantId
  });
  const matchingLog = priorDecisionSubmitLogs.find(
    (auditLog) => auditLog.request_id === context.requestId
  );

  if (!matchingLog) {
    return null;
  }

  const priorDecision = await runtime.repositoryProvider.facade.decisions.getDecisionById(
    context.tenantId,
    matchingLog.resource_id
  );
  if (!priorDecision) {
    throw new HttpError(
      409,
      "DEC-409-003",
      "decision idempotency key references a missing decision"
    );
  }

  const sameCommandTarget =
    priorDecision.run_id === input.runId &&
    priorDecision.round_no === input.roundNo &&
    priorDecision.team_id === input.teamId;
  const samePayload =
    serializeDecisionPayloadForIdempotency(priorDecision.payload) ===
    serializeDecisionPayloadForIdempotency(input.payload);

  if (!sameCommandTarget || !samePayload) {
    throw new HttpError(
      409,
      "DEC-409-002",
      "decision idempotency key was reused with a different decision command"
    );
  }

  return priorDecision;
}

function findTruthProtectedFields(value: unknown, path = ""): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findTruthProtectedFields(entry, `${path}[${index}]`));
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nestedValue]) => {
    const nextPath = path ? `${path}.${key}` : key;
    const ownViolation = isTruthProtectedField(key) ? [nextPath] : [];
    return [...ownViolation, ...findTruthProtectedFields(nestedValue, nextPath)];
  });
}

function assertNoTruthProtectedFields(value: unknown): void {
  const fields = findTruthProtectedFields(value);

  if (fields.length > 0) {
    throw new HttpError(
      403,
      "TRUTH-403-001",
      "truth protected fields can only be written by the simulation kernel",
      fields.map((field) => ({ field, reason: "truth_protected" }))
    );
  }
}

async function getCourseForRead(runtime: ApiRuntime, context: RequestContext, courseId: string) {
  const courseReadModel = await runtime.repositoryProvider.facade.courses.getCourse(
    context.tenantId,
    courseId
  );

  if (!courseReadModel) {
    throw new HttpError(404, "COURSE-404-001", "course not found");
  }

  return courseReadModel;
}

async function getCourseForActorRead(
  runtime: ApiRuntime,
  context: RequestContext,
  courseId: string
) {
  const course = await getCourseForRead(runtime, context, courseId);
  const actor = requireActor(context);

  if (canReadClassroomScope(actor)) {
    return course;
  }

  const visibleCourses = await runtime.repositoryProvider.facade.courses.listCoursesForUser(
    context.tenantId,
    actor.user_id
  );
  if (!visibleCourses.some((candidate) => candidate.course_id === course.course_id)) {
    throw new HttpError(404, "COURSE-404-001", "course not found");
  }

  return course;
}

function canReadClassroomScope(actor: CurrentUser): boolean {
  return actorHasAnyRole(actor, ["teacher", "tenant_admin", "platform_admin"]);
}

function isActorMemberOfTeam(actor: CurrentUser, team: Team): boolean {
  return (
    team.captain_user_id === actor.user_id ||
    team.members.some((member) => member.user_id === actor.user_id)
  );
}

function getVisibleResultTeamIdsForActor(actor: CurrentUser): Set<string> | undefined {
  if (canReadClassroomScope(actor)) {
    return undefined;
  }

  if (!actor.team_id) {
    return new Set();
  }

  return new Set([actor.team_id]);
}

async function assertActorCanReadRunResults(
  runtime: ApiRuntime,
  context: RequestContext,
  actor: CurrentUser,
  run: Run
): Promise<void> {
  if (canReadClassroomScope(actor)) return;

  const team = actor.team_id
    ? await runtime.repositoryProvider.facade.teams.getTeam(context.tenantId, actor.team_id)
    : null;
  if (!team || team.course_id !== run.course_id || !isActorMemberOfTeam(actor, team)) {
    throw new HttpError(404, "COURSE-404-001", "course not found");
  }
}

async function createPublicReplayEvidenceView(
  runtime: ApiRuntime,
  context: RequestContext,
  round: Round,
  settlement: SettlementResult
): Promise<PublicRunReplayEvidence | undefined> {
  const run = await runtime.repositoryProvider.facade.runs.getRun(
    context.tenantId,
    settlement.run_id
  );

  if (!run) {
    return undefined;
  }

  const [runtimeInputs, teams, decisions] = await Promise.all([
    resolveRunRuntimeInputs(runtime, context.tenantId, run),
    runtime.repositoryProvider.facade.teams.listTeamsForRun(context.tenantId, run.run_id),
    runtime.repositoryProvider.facade.decisions.listDecisionsForRound(
      context.tenantId,
      run.run_id,
      round.round_id
    )
  ]);

  if (!runtimeInputs) {
    return undefined;
  }

  return createM1RunReplayEvidence({
    decisions,
    ...(runtimeInputs.formalRuntimeBinding
      ? { formal_runtime_binding: runtimeInputs.formalRuntimeBinding }
      : {}),
    parameterSet: runtimeInputs.parameterSet,
    round,
    run,
    scenario: runtimeInputs.scenario,
    settlement,
    teams
  }).public_view;
}

async function resolveRunRuntimeInputs(
  runtime: ApiRuntime,
  tenantId: string,
  run: Run
): Promise<{
  formalRuntimeBinding?: {
    binding: NonNullable<ReturnType<FormalRunRuntimeBindingStore["getForRun"]>>;
    formal_resolution_digest: string;
  };
  parameterSet: ParameterSet;
  scenario: ScenarioPackage;
} | null> {
  const binding = runtime.formalRunRuntimeBindingStore.getForRun(tenantId, run.run_id);

  if (binding) {
    if (!runtime.formalRunBindingAuthorities) {
      throw new HttpError(409, "RUN-409-002", "formal runtime binding authority is unavailable");
    }

    try {
      const formalInputs = await resolveFormalRuntimeInputsForActiveRun({
        authorities: runtime.formalRunBindingAuthorities,
        binding,
        run
      });
      return {
        formalRuntimeBinding: {
          binding: formalInputs.binding,
          formal_resolution_digest: formalInputs.formal_resolution_digest
        },
        parameterSet: formalInputs.parameterSet,
        scenario: formalInputs.scenario
      };
    } catch {
      throw new HttpError(422, "RUN-422-003", "formal runtime binding cannot resolve exact inputs");
    }
  }

  const [scenario, parameterSet] = await Promise.all([
    runtime.repositoryProvider.facade.scenarios.getScenarioPackage(
      tenantId,
      run.scenario_package_id
    ),
    runtime.repositoryProvider.facade.parameterSets.getParameterSet(tenantId, run.parameter_set_id)
  ]);

  return scenario && parameterSet ? { parameterSet, scenario } : null;
}

async function getRunForRead(runtime: ApiRuntime, context: RequestContext, runId: string) {
  const run = await runtime.repositoryProvider.facade.runs.getRun(context.tenantId, runId);

  if (!run) {
    throw new HttpError(404, "RUN-404-001", "run not found");
  }

  return run;
}

async function getRoundForRead(
  runtime: ApiRuntime,
  context: RequestContext,
  runId: string,
  roundNo: number
) {
  const run = await getRunForRead(runtime, context, runId);
  const rounds = await runtime.repositoryProvider.facade.rounds.listRoundsForRun(
    context.tenantId,
    run.run_id
  );
  const round = rounds.find((candidate) => candidate.round_no === roundNo);

  if (!round) {
    throw new HttpError(404, "ROUND-404-001", "round not found");
  }

  return round;
}

async function createPublicResultView(
  runtime: ApiRuntime,
  context: RequestContext,
  runId: string,
  roundNo: number,
  options: { includeReplayEvidence?: boolean } = {}
): Promise<PublicResultView> {
  const actor = requirePermission(context, "result:read");
  const run = await getRunForRead(runtime, context, runId);
  await assertActorCanReadRunResults(runtime, context, actor, run);
  const round = await getRoundForRead(runtime, context, runId, roundNo);
  const settlements =
    await runtime.repositoryProvider.facade.settlements.listSettlementResultsForRound(
      context.tenantId,
      runId,
      round.round_id
    );
  const settlement = settlements.find(
    (result) =>
      result.run_id === runId &&
      result.round_no === roundNo &&
      result.tenant_id === context.tenantId
  );
  const canSeeTruth = canReadClassroomScope(actor);
  const m1ResultMetadata: Pick<
    PublicResultView,
    "classroom_debrief_prompts" | "result_label" | "runtime_boundary" | "runtime_limitations"
  > = {
    classroom_debrief_prompts: [...M1_CLASSROOM_DEBRIEF_PROMPTS],
    result_label: M1_TEACHING_OFFICIAL_RESULT_LABEL,
    runtime_boundary: M1_JSON_RUNTIME_BOUNDARY,
    runtime_limitations: [...M1_JSON_RUNTIME_LIMITATIONS]
  };

  if (!settlement) {
    return {
      ...m1ResultMetadata,
      run_id: runId,
      round_no: roundNo,
      status: round.status,
      results: []
    };
  }

  const visibleTeamIds = getVisibleResultTeamIdsForActor(actor);
  const visibleResults = settlement.team_results
    .filter((result) => !visibleTeamIds || visibleTeamIds.has(result.team_id))
    .map((result) => {
      if (canSeeTruth) {
        return result;
      }

      return {
        team_id: result.team_id,
        team_name: result.team_name,
        state_obs: result.state_obs,
        state_est: result.state_est
      };
    });
  const replayEvidence =
    canSeeTruth && (options.includeReplayEvidence ?? true)
      ? await createPublicReplayEvidenceView(runtime, context, round, settlement)
      : undefined;

  return {
    ...m1ResultMetadata,
    run_id: runId,
    round_no: roundNo,
    status: round.status,
    ...(canSeeTruth ? { replay_hash: settlement.replay_hash } : {}),
    ...(replayEvidence ? { replay_evidence: replayEvidence } : {}),
    results: visibleResults
  };
}

function selectInstructorDebriefSettlement(
  settlements: readonly SettlementResult[]
): SettlementResult {
  if (settlements.length === 0) {
    throw new HttpError(
      409,
      "INSTRUCTOR_DEBRIEF_SETTLEMENT_RESULT_REQUIRED",
      "published settlement result is required"
    );
  }
  if (settlements.length !== 1) {
    throw new HttpError(
      409,
      "INSTRUCTOR_DEBRIEF_SETTLEMENT_AMBIGUOUS",
      "published settlement result is ambiguous"
    );
  }
  return settlements[0]!;
}

function instructorDebriefHttpError(error: unknown): never {
  if (error instanceof HttpError) throw error;
  const code = error instanceof Error ? error.message : "INSTRUCTOR_DEBRIEF_INVALID";
  const statusCode =
    code === "INSTRUCTOR_DEBRIEF_SETTLEMENT_RESULT_REQUIRED" ||
    code === "INSTRUCTOR_DEBRIEF_SETTLEMENT_AMBIGUOUS"
      ? 409
      : 422;
  throw new HttpError(statusCode, code, "instructor debrief artifact request invalid");
}

function safeInstructorDebriefFilenamePart(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "unknown";
}

async function buildInstructorDebriefArtifactForRequest(
  runtime: ApiRuntime,
  context: RequestContext,
  url: URL
) {
  const assetId = url.searchParams.get("asset_id")?.trim();
  const runId = url.searchParams.get("run_id")?.trim();
  const roundNo = Number(url.searchParams.get("round_no"));
  if (!assetId || !runId || !Number.isInteger(roundNo) || roundNo < 1) {
    throw new HttpError(
      422,
      "INSTRUCTOR_DEBRIEF-422-001",
      "instructor debrief artifact request invalid"
    );
  }
  const asset = runtime.instructorAssets.get(context.tenantId, assetId);
  if (asset.status !== "teacher_published") {
    throw new HttpError(409, "INSTRUCTOR_ASSET-409-001", "instructor asset must be published");
  }
  const run = await getRunForRead(runtime, context, runId);
  if (run.course_id !== asset.course_id) {
    throw new HttpError(
      404,
      "INSTRUCTOR_ASSET-404-001",
      "instructor asset is not bound to this course"
    );
  }
  const round = await getRoundForRead(runtime, context, runId, roundNo);
  if (round.status !== "published") {
    throw new HttpError(
      409,
      "INSTRUCTOR_ASSET-409-002",
      "instructor debrief requires a published round"
    );
  }
  const settlements =
    await runtime.repositoryProvider.facade.settlements.listSettlementResultsForRound(
      context.tenantId,
      runId,
      round.round_id
    );
  const settlement = selectInstructorDebriefSettlement(
    settlements.filter(
      (candidate) =>
        candidate.run_id === runId &&
        candidate.round_no === roundNo &&
        candidate.tenant_id === context.tenantId
    )
  );
  const resultView = await createPublicResultView(runtime, context, runId, roundNo, {
    includeReplayEvidence: false
  });
  const previousRound = (
    await runtime.repositoryProvider.facade.rounds.listRoundsForRun(context.tenantId, runId)
  ).find((candidate) => candidate.round_no === roundNo - 1);
  let previousSettlement: SettlementResult | undefined;
  let previousResultView: PublicResultView | undefined;
  if (previousRound?.status === "published") {
    const previousSettlements =
      await runtime.repositoryProvider.facade.settlements.listSettlementResultsForRound(
        context.tenantId,
        runId,
        previousRound.round_id
      );
    if (previousSettlements.length > 1) {
      previousSettlement = selectInstructorDebriefSettlement(previousSettlements);
    } else if (previousSettlements.length === 1) {
      previousSettlement = previousSettlements[0];
      previousResultView = await createPublicResultView(runtime, context, runId, roundNo - 1, {
        includeReplayEvidence: false
      });
    }
  }
  return createInstructorDebriefArtifact({
    asset,
    ...(previousResultView ? { previous_result_view: previousResultView } : {}),
    ...(previousSettlement ? { previous_settlement: previousSettlement } : {}),
    result_view: resultView,
    round,
    settlement
  });
}

function assertRoundStatus(
  round: { status: RoundStatus },
  expected: RoundStatus,
  code: string
): void {
  if (round.status !== expected) {
    throw new HttpError(409, code, `round must be ${expected}`);
  }
}

async function filterAuditLogs(runtime: ApiRuntime, context: RequestContext, url: URL) {
  const actor = requirePermission(context, "audit:read");
  const requestedTenant = url.searchParams.get("tenant_id");
  const action = url.searchParams.get("action");
  const actorId = url.searchParams.get("actor_id");
  const resourceType = url.searchParams.get("resource_type");

  return runtime.repositoryProvider.facade.auditLogs.listAuditLogs({
    ...(actorHasAnyRole(actor, ["platform_admin"])
      ? {
          scope: "platform" as const,
          ...(requestedTenant ? { tenant_id: requestedTenant } : {})
        }
      : {
          scope: "tenant" as const,
          tenant_id: context.tenantId
        }),
    ...(actorId ? { actor_id: actorId } : {}),
    ...(action ? { action } : {}),
    ...(resourceType ? { resource_type: resourceType } : {})
  });
}

async function createAdminState(runtime: ApiRuntime, context: RequestContext): Promise<AdminState> {
  const store = runtime.store;
  const actor = requirePermission(context, "user:read");
  const isPlatform = actorHasAnyRole(actor, ["platform_admin"]);
  const tenants = isPlatform
    ? store.tenants
    : store.tenants.filter((tenant) => tenant.tenant_id === context.tenantId);
  const users = isPlatform
    ? store.users.map(sanitizeUser)
    : store.users.filter((user) => user.tenant_id === context.tenantId).map(sanitizeUser);

  return {
    current_user: actor,
    tenants,
    users,
    roles: store.roles,
    permissions: store.permissions,
    audit_logs: (
      await filterAuditLogs(runtime, context, new URL("/api/v1/audit/logs", "http://localhost"))
    ).slice(-30)
  };
}

function requireManagedTenant(
  store: SimWarStore,
  actor: CurrentUser,
  context: RequestContext,
  tenantId?: string
): Tenant {
  const requestedTenantId = tenantId?.trim();

  if (
    !actorHasAnyRole(actor, ["platform_admin"]) &&
    requestedTenantId &&
    requestedTenantId !== context.tenantId
  ) {
    throw new HttpError(403, "TENANT-403-001", "tenant boundary violation");
  }

  const targetTenantId = actorHasAnyRole(actor, ["platform_admin"])
    ? (requestedTenantId ?? context.tenantId)
    : context.tenantId;
  const tenant = store.tenants.find(
    (candidate) => candidate.tenant_id === targetTenantId && candidate.status === "active"
  );

  if (!tenant) {
    throw new HttpError(404, "TENANT-404-001", "tenant not found");
  }

  if (!actorHasAnyRole(actor, ["platform_admin"]) && tenant.tenant_id !== actor.tenant_id) {
    throw new HttpError(403, "TENANT-403-001", "tenant boundary violation");
  }

  return tenant;
}

function isKnownActorRole(role: string): role is ActorRole {
  return Object.prototype.hasOwnProperty.call(ROLE_PERMISSION_MATRIX, role);
}

function normalizeRoles(actor: CurrentUser, roles?: ActorRole[]): ActorRole[] {
  const requested = roles && roles.length > 0 ? roles : ["learner"];
  const invalidRole = requested.find((role) => !isKnownActorRole(role));

  if (invalidRole) {
    throw new HttpError(422, "ROLE-422-001", "invalid role requested", [
      { field: "roles", reason: "invalid_role" }
    ]);
  }

  if (!actorHasAnyRole(actor, ["platform_admin"]) && requested.includes("platform_admin")) {
    throw new HttpError(403, "AUTHZ-403-003", "tenant administrators cannot assign platform_admin");
  }

  return [...new Set(requested)] as ActorRole[];
}

function roleWorkflowActor(
  context: RequestContext,
  expected: "student" | "teacher"
): RoleWorkflowActor {
  const actor = requireActor(context);
  const permitted =
    expected === "teacher"
      ? actorHasAnyRole(actor, ["teacher"])
      : actorHasAnyRole(actor, ["learner", "team_captain"]);
  if (!permitted) {
    throw new HttpError(403, "ROLE_WORKFLOW-403-001", `${expected} role required`);
  }
  return {
    actor_id: actor.user_id,
    actor_role: expected,
    tenant_id: context.tenantId
  };
}

function roleWorkflowString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(422, "ROLE_WORKFLOW-422-001", "role workflow request invalid", [
      { field, reason: "required" }
    ]);
  }
  return value.trim();
}

function roleWorkflowScopeFromBody(body: Record<string, unknown>) {
  return {
    round_id: roleWorkflowString(body.round_id, "round_id"),
    run_id: roleWorkflowString(body.run_id, "run_id"),
    team_id: roleWorkflowString(body.team_id, "team_id")
  };
}

function assertOnlyRoleWorkflowFields(
  body: Record<string, unknown>,
  allowedFields: readonly string[]
): void {
  const allowed = new Set(allowedFields);
  if (Object.keys(body).some((field) => !allowed.has(field))) {
    throw new HttpError(422, "ROLE_WORKFLOW-422-001", "role workflow request invalid");
  }
}

function roleWorkflowScopeFromUrl(url: URL) {
  return {
    round_id: roleWorkflowString(url.searchParams.get("round_id"), "round_id"),
    run_id: roleWorkflowString(url.searchParams.get("run_id"), "run_id"),
    team_id: roleWorkflowString(url.searchParams.get("team_id"), "team_id")
  };
}

function parseRoleWorkflowPayload(value: unknown): Partial<DecisionPayload> {
  if (!isRecord(value)) {
    throw new HttpError(422, "ROLE_WORKFLOW-422-001", "role workflow request invalid");
  }
  const allowed = new Set([
    "pricing",
    "marketing_budget",
    "service_quality_budget",
    "capacity_plan",
    "cash_buffer_target",
    "strategy_statement"
  ]);
  const keys = Object.keys(value);
  if (keys.length === 0 || keys.some((key) => !allowed.has(key))) {
    throw new HttpError(422, "ROLE_WORKFLOW-422-001", "role workflow request invalid");
  }

  const payload: Partial<DecisionPayload> = {};
  if (value.pricing !== undefined) {
    if (
      !isRecord(value.pricing) ||
      Object.keys(value.pricing).some((key) => key !== "base_price") ||
      typeof value.pricing.base_price !== "number" ||
      !Number.isFinite(value.pricing.base_price) ||
      value.pricing.base_price <= 0
    ) {
      throw new HttpError(422, "ROLE_WORKFLOW-422-001", "role workflow request invalid");
    }
    payload.pricing = { base_price: value.pricing.base_price };
  }
  for (const field of [
    "marketing_budget",
    "service_quality_budget",
    "cash_buffer_target"
  ] as const) {
    const fieldValue = value[field];
    if (fieldValue !== undefined) {
      if (typeof fieldValue !== "number" || !Number.isFinite(fieldValue) || fieldValue < 0) {
        throw new HttpError(422, "ROLE_WORKFLOW-422-001", "role workflow request invalid");
      }
      payload[field] = fieldValue;
    }
  }
  if (value.capacity_plan !== undefined) {
    if (!["contract", "hold", "expand"].includes(String(value.capacity_plan))) {
      throw new HttpError(422, "ROLE_WORKFLOW-422-001", "role workflow request invalid");
    }
    payload.capacity_plan = value.capacity_plan as DecisionPayload["capacity_plan"];
  }
  if (value.strategy_statement !== undefined) {
    if (typeof value.strategy_statement !== "string") {
      throw new HttpError(422, "ROLE_WORKFLOW-422-001", "role workflow request invalid");
    }
    payload.strategy_statement = value.strategy_statement;
  }
  return payload;
}

function roleWorkflowHttpError(error: RoleWorkflowError): HttpError {
  const denied = new Set([
    "ROLE_WORKFLOW_CAPTAIN_REQUIRED",
    "ROLE_WORKFLOW_CONFIRMATION_DENIED",
    "ROLE_WORKFLOW_FIELD_DENIED",
    "ROLE_WORKFLOW_MERGE_DENIED",
    "ROLE_WORKFLOW_STUDENT_REQUIRED",
    "ROLE_WORKFLOW_TEACHER_REQUIRED",
    "ROLE_WORKFLOW_TENANT_DENIED"
  ]);
  const notFound = new Set([
    "ROLE_WORKFLOW_ASSIGNMENT_NOT_FOUND",
    "ROLE_WORKFLOW_MERGE_NOT_FOUND",
    "ROLE_WORKFLOW_SECTION_NOT_FOUND",
    "ROLE_WORKFLOW_TEMPLATE_NOT_FOUND"
  ]);
  const invalid = new Set([
    "ROLE_WORKFLOW_MEMBER_ROLE_INVALID",
    "ROLE_WORKFLOW_MERGED_PAYLOAD_INCOMPLETE",
    "ROLE_WORKFLOW_SCOPE_INVALID",
    "ROLE_WORKFLOW_TEAM_INCOMPLETE"
  ]);
  const statusCode = denied.has(error.code)
    ? 403
    : notFound.has(error.code)
      ? 404
      : invalid.has(error.code)
        ? 422
        : 409;
  return new HttpError(statusCode, error.code, error.message);
}

function executeRoleWorkflow<T>(command: () => T): T {
  try {
    return command();
  } catch (error) {
    if (error instanceof RoleWorkflowError) throw roleWorkflowHttpError(error);
    throw error;
  }
}

function requireInstructorAssetTeacher(context: RequestContext): CurrentUser {
  const actor = requirePermission(context, "course:read");
  if (!actorHasAnyRole(actor, ["teacher"]) || actor.tenant_id !== context.tenantId) {
    throw new HttpError(403, "INSTRUCTOR_ASSET-403-001", "teacher authority required");
  }
  return actor;
}

function coursePackageRequestError(): HttpError {
  return new HttpError(
    422,
    "COURSE_PACKAGE_INPUT_INVALID",
    "course package version request is invalid"
  );
}

function assertOnlyCoursePackageFields(
  value: Record<string, unknown>,
  expected: readonly string[]
): void {
  const keys = Object.keys(value);
  if (keys.length !== expected.length || keys.some((key) => !expected.includes(key))) {
    throw coursePackageRequestError();
  }
}

function requireCoursePackageText(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim()) {
    throw coursePackageRequestError();
  }
  return value;
}

function requireCoursePackageExactIdentity(value: unknown): string {
  const text = requireCoursePackageText(value);
  if (
    !/^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(text) ||
    /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(text)
  ) {
    throw coursePackageRequestError();
  }
  return text;
}

function requireCoursePackageExactVersion(value: unknown): string {
  const version = requireCoursePackageExactIdentity(value);
  if (/(?:^|[._:-])[xX*](?:$|[._:-])/.test(version)) {
    throw coursePackageRequestError();
  }
  return version;
}

function requireCoursePackageDigest(value: unknown): string {
  const digest = requireCoursePackageText(value);
  if (!/^[a-f0-9]{64}$/.test(digest)) throw coursePackageRequestError();
  return digest;
}

function requireCoursePackageAdmin(context: RequestContext): CurrentUser {
  const actor = requirePermission(context, "course:read");
  if (!actorHasAnyRole(actor, ["platform_admin", "tenant_admin"])) {
    throw new HttpError(403, "COURSE_PACKAGE_FORBIDDEN", "course package authority required");
  }
  if (actor.tenant_id !== context.tenantId && !actorHasAnyRole(actor, ["platform_admin"])) {
    throw new HttpError(403, "COURSE_PACKAGE_FORBIDDEN", "course package tenant scope required");
  }
  return actor;
}

function requireCoursePackageTeacher(context: RequestContext): CurrentUser {
  const actor = requirePermission(context, "course:read");
  if (!actorHasAnyRole(actor, ["teacher"]) || actor.tenant_id !== context.tenantId) {
    throw new HttpError(403, "COURSE_PACKAGE_FORBIDDEN", "teacher authority required");
  }
  return actor;
}

function courseReportHttpError(error: unknown): HttpError {
  if (error instanceof CourseReportQueryServiceError) {
    const statusCode =
      error.code === "COURSE_REPORT_NOT_FOUND"
        ? 404
        : error.code === "COURSE_REPORT_FORBIDDEN"
          ? 403
          : error.code === "COURSE_REPORT_AUTHENTICATION_REQUIRED"
            ? 401
            : error.code === "COURSE_REPORT_PROVIDER_UNSUPPORTED"
              ? 503
              : 422;
    return new HttpError(statusCode, error.code, "course report request failed");
  }
  if (error instanceof HttpError) {
    if (error.statusCode === 401) {
      return new HttpError(401, "COURSE_REPORT_AUTHENTICATION_REQUIRED", "authentication required");
    }
    if (error.statusCode === 403) {
      return new HttpError(403, "COURSE_REPORT_FORBIDDEN", "course report authority denied");
    }
    if (error.statusCode === 404) {
      return new HttpError(404, "COURSE_REPORT_NOT_FOUND", "course report scope not found");
    }
    if (error.statusCode === 422) {
      return new HttpError(422, "COURSE_REPORT_INPUT_INVALID", "course report request invalid");
    }
  }
  return new HttpError(500, "API-500-001", "internal server error");
}

function parseCoursePackageCourseBlueprintReference(
  value: unknown,
  tenantId: string
): CoursePackageVersion["course_blueprint_reference"] {
  if (!isRecord(value)) throw coursePackageRequestError();
  assertOnlyCoursePackageFields(value, [
    "content_digest",
    "course_blueprint_id",
    "tenant_id",
    "version"
  ]);
  if (requireCoursePackageExactIdentity(value.tenant_id) !== tenantId) {
    throw coursePackageRequestError();
  }
  return {
    content_digest: requireCoursePackageDigest(value.content_digest),
    course_blueprint_id: requireCoursePackageExactIdentity(value.course_blueprint_id),
    tenant_id: tenantId,
    version: requireCoursePackageExactVersion(value.version)
  };
}

function parseCoursePackageScenarioPackageReference(
  value: unknown,
  tenantId: string
): CoursePackageVersion["scenario_package_reference"] {
  if (!isRecord(value)) throw coursePackageRequestError();
  assertOnlyCoursePackageFields(value, [
    "content_digest",
    "scenario_package_id",
    "tenant_id",
    "version"
  ]);
  if (requireCoursePackageExactIdentity(value.tenant_id) !== tenantId) {
    throw coursePackageRequestError();
  }
  return {
    content_digest: requireCoursePackageDigest(value.content_digest),
    scenario_package_id: requireCoursePackageExactIdentity(value.scenario_package_id),
    tenant_id: tenantId,
    version: requireCoursePackageExactVersion(value.version)
  };
}

function parseCoursePackageParameterSetReference(
  value: unknown
): CoursePackageVersion["parameter_set_reference"] {
  if (!isRecord(value)) throw coursePackageRequestError();
  assertOnlyCoursePackageFields(value, ["content_digest", "parameter_set_id", "version"]);
  return {
    content_digest: requireCoursePackageDigest(value.content_digest),
    parameter_set_id: requireCoursePackageExactIdentity(value.parameter_set_id),
    version: requireCoursePackageExactVersion(value.version)
  };
}

function parseCoursePackageDraft(value: unknown, tenantId: string): CoursePackageVersionDraftInput {
  if (!isRecord(value)) throw coursePackageRequestError();
  assertOnlyCoursePackageFields(value, [
    "course_blueprint_reference",
    "course_package_id",
    "description",
    "parameter_set_reference",
    "scenario_package_reference",
    "title",
    "version"
  ]);
  return {
    course_blueprint_reference: parseCoursePackageCourseBlueprintReference(
      value.course_blueprint_reference,
      tenantId
    ),
    course_package_id: requireCoursePackageExactIdentity(value.course_package_id),
    description: requireCoursePackageText(value.description),
    parameter_set_reference: parseCoursePackageParameterSetReference(value.parameter_set_reference),
    scenario_package_reference: parseCoursePackageScenarioPackageReference(
      value.scenario_package_reference,
      tenantId
    ),
    title: requireCoursePackageText(value.title),
    version: requireCoursePackageExactVersion(value.version)
  };
}

function parseCoursePackageVersionReference(
  value: unknown,
  tenantId: string
): CoursePackageVersionReference {
  if (!isRecord(value)) throw coursePackageRequestError();
  assertOnlyCoursePackageFields(value, ["content_digest", "course_package_id", "version"]);
  return {
    content_digest: requireCoursePackageDigest(value.content_digest),
    course_package_id: requireCoursePackageExactIdentity(value.course_package_id),
    tenant_id: tenantId,
    version: requireCoursePackageExactVersion(value.version)
  };
}

function parseCoursePackageCloneInput(
  value: unknown,
  tenantId: string
): CoursePackageVersionCloneInput {
  if (!isRecord(value)) throw coursePackageRequestError();
  assertOnlyCoursePackageFields(value, [
    "course_package_id",
    "description",
    "source_course_package_reference",
    "title",
    "version"
  ]);
  return {
    course_package_id: requireCoursePackageExactIdentity(value.course_package_id),
    description: requireCoursePackageText(value.description),
    source_course_package_reference: parseCoursePackageVersionReference(
      value.source_course_package_reference,
      tenantId
    ),
    title: requireCoursePackageText(value.title),
    version: requireCoursePackageExactVersion(value.version)
  };
}

function parseCoursePackageImportedVersion(value: unknown, tenantId: string): CoursePackageVersion {
  if (!isRecord(value)) throw coursePackageRequestError();
  assertOnlyCoursePackageFields(value, [
    "content_digest",
    "course_blueprint_reference",
    "course_package_id",
    "created_at",
    "created_by",
    "description",
    "parameter_set_reference",
    "scenario_package_reference",
    "schema_version",
    "status",
    "tenant_id",
    "title",
    "version"
  ]);
  if (
    requireCoursePackageExactIdentity(value.tenant_id) !== tenantId ||
    requireCoursePackageText(value.schema_version) !== "course-package-version.v1" ||
    !["DRAFT", "VALIDATED", "AVAILABLE", "RETIRED"].includes(requireCoursePackageText(value.status))
  ) {
    throw coursePackageRequestError();
  }
  const draft = parseCoursePackageDraft(
    {
      course_blueprint_reference: value.course_blueprint_reference,
      course_package_id: value.course_package_id,
      description: value.description,
      parameter_set_reference: value.parameter_set_reference,
      scenario_package_reference: value.scenario_package_reference,
      title: value.title,
      version: value.version
    },
    tenantId
  );
  return {
    ...draft,
    content_digest: requireCoursePackageDigest(value.content_digest),
    created_at: requireCoursePackageText(value.created_at),
    created_by: requireCoursePackageExactIdentity(value.created_by),
    schema_version: "course-package-version.v1",
    status: value.status as CoursePackageVersion["status"],
    tenant_id: tenantId
  };
}

function parseCoursePackageImportInput(
  value: unknown,
  tenantId: string
): CoursePackageVersionImportInput {
  if (!isRecord(value)) throw coursePackageRequestError();
  assertOnlyCoursePackageFields(value, ["source_course_package_version"]);
  return {
    source_course_package_version: parseCoursePackageImportedVersion(
      value.source_course_package_version,
      tenantId
    )
  };
}

function coursePackageCommandActor(
  context: RequestContext,
  actor: CurrentUser
): { actor_id: string; tenant_id: string } {
  return { actor_id: actor.user_id, tenant_id: context.tenantId };
}

function coursePackageCommandHttpError(error: unknown): HttpError {
  if (!(error instanceof CoursePackageCommandError)) throw error;
  const statusCode =
    error.code === "COURSE_PACKAGE_NOT_FOUND"
      ? 404
      : error.code === "COURSE_PACKAGE_FORBIDDEN" ||
          error.code === "COURSE_PACKAGE_TENANT_SCOPE_VIOLATION"
        ? 403
        : error.code === "COURSE_PACKAGE_DUPLICATE_VERSION" ||
            error.code === "COURSE_PACKAGE_LIFECYCLE_INVALID"
          ? 409
          : 422;
  return new HttpError(statusCode, error.code, "course package command rejected");
}

async function executeCoursePackageCommand<T>(command: () => Promise<T>): Promise<T> {
  try {
    return await command();
  } catch (error) {
    throw coursePackageCommandHttpError(error);
  }
}

async function executeAuditedCoursePackageCommand<T>(
  runtime: ApiRuntime,
  command: () => Promise<T>,
  audit: (result: T) => Parameters<typeof appendAudit>[1]
): Promise<T> {
  const checkpoint = runtime.coursePackageCommands.captureAuditCheckpointForCompensation();
  const result = await executeCoursePackageCommand(command);
  try {
    await appendAudit(runtime, audit(result));
  } catch {
    try {
      runtime.coursePackageCommands.restoreAuditCheckpointAfterFailure(checkpoint);
    } catch {
      // The generic response below remains safe when the retry cannot persist.
    }
    throw new HttpError(
      500,
      "COURSE_PACKAGE_AUDIT_COMPENSATION_FAILED",
      "course package request could not be completed"
    );
  }
  return result;
}

function learningDesignRequestError(): HttpError {
  return new HttpError(422, "LEARNING_DESIGN_INPUT_INVALID", "learning design request is invalid");
}

function assertOnlyLearningDesignFields(
  value: Record<string, unknown>,
  fields: readonly string[]
): void {
  const keys = Object.keys(value);
  if (keys.length !== fields.length || keys.some((key) => !fields.includes(key))) {
    throw learningDesignRequestError();
  }
}

function parseLearningDesignText(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim()) {
    throw learningDesignRequestError();
  }
  return value;
}

function parseLearningDesignIdentity(value: unknown): string {
  const text = parseLearningDesignText(value);
  if (
    !/^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(text) ||
    /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(text)
  ) {
    throw learningDesignRequestError();
  }
  return text;
}

function parseLearningDesignVersion(value: unknown): string {
  const version = parseLearningDesignIdentity(value);
  if (
    version === "x" ||
    version === "X" ||
    version === "*" ||
    /(?:^|[._:-])[xX*](?:$|[._:-])/.test(version)
  ) {
    throw learningDesignRequestError();
  }
  return version;
}

function parseLearningDesignDigest(value: unknown): string {
  const digest = parseLearningDesignText(value);
  if (!/^[a-f0-9]{64}$/.test(digest)) throw learningDesignRequestError();
  return digest;
}

function parseLearningDesignStringList(value: unknown, allowEmpty = false): string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0))
    throw learningDesignRequestError();
  return value.map(parseLearningDesignText);
}

function parseLearningDesignReference(
  value: unknown,
  idField: "goal_id" | "rubric_id" | "course_package_id"
) {
  if (!isRecord(value)) throw learningDesignRequestError();
  assertOnlyLearningDesignFields(value, ["content_digest", idField, "tenant_id", "version"]);
  return {
    content_digest: parseLearningDesignDigest(value.content_digest),
    [idField]: parseLearningDesignIdentity(value[idField]),
    tenant_id: parseLearningDesignIdentity(value.tenant_id),
    version: parseLearningDesignVersion(value.version)
  } as Record<string, string>;
}

function parseLearningDesignActivityReferences(value: unknown) {
  if (!Array.isArray(value)) throw learningDesignRequestError();
  return value.map((item) => {
    if (!isRecord(item)) throw learningDesignRequestError();
    assertOnlyLearningDesignFields(item, ["activity_id", "content_digest", "version"]);
    return {
      activity_id: parseLearningDesignIdentity(item.activity_id),
      content_digest: parseLearningDesignDigest(item.content_digest),
      version: parseLearningDesignVersion(item.version)
    };
  });
}

function parseLearningGoalDraftBody(value: unknown, tenantId: string) {
  if (!isRecord(value)) throw learningDesignRequestError();
  assertOnlyLearningDesignFields(value, [
    "activity_refs",
    "course_package_reference",
    "expected_evidence_classes",
    "goal_id",
    "observable_behaviors",
    "role_scope",
    "statement",
    "title",
    "version"
  ]);
  const coursePackageReference = parseLearningDesignReference(
    value.course_package_reference,
    "course_package_id"
  );
  if (coursePackageReference.tenant_id !== tenantId)
    throw new HttpError(403, "LEARNING_DESIGN_TENANT_SCOPE_VIOLATION", "tenant scope violation");
  return {
    activity_refs: parseLearningDesignActivityReferences(value.activity_refs),
    course_package_reference:
      coursePackageReference as unknown as LearningGoalDraftInput["course_package_reference"],
    expected_evidence_classes: parseLearningDesignStringList(value.expected_evidence_classes),
    goal_id: parseLearningDesignIdentity(value.goal_id),
    observable_behaviors: parseLearningDesignStringList(value.observable_behaviors),
    role_scope: parseLearningDesignStringList(value.role_scope),
    statement: parseLearningDesignText(value.statement),
    title: parseLearningDesignText(value.title),
    version: parseLearningDesignVersion(value.version)
  };
}

function parseRubricCriteria(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) throw learningDesignRequestError();
  return value.map((item) => {
    if (!isRecord(item)) throw learningDesignRequestError();
    assertOnlyLearningDesignFields(item, ["criterion_id", "levels", "prompt"]);
    if (!Array.isArray(item.levels) || item.levels.length === 0) throw learningDesignRequestError();
    return {
      criterion_id: parseLearningDesignIdentity(item.criterion_id),
      levels: item.levels.map((level) => {
        if (!isRecord(level)) throw learningDesignRequestError();
        assertOnlyLearningDesignFields(level, ["description", "label", "ordinal"]);
        if (!Number.isInteger(level.ordinal) || Number(level.ordinal) < 1)
          throw learningDesignRequestError();
        return {
          description: parseLearningDesignText(level.description),
          label: parseLearningDesignText(level.label),
          ordinal: Number(level.ordinal)
        };
      }),
      prompt: parseLearningDesignText(item.prompt)
    };
  });
}

function parseRubricDraftBody(value: unknown, tenantId: string) {
  if (!isRecord(value)) throw learningDesignRequestError();
  assertOnlyLearningDesignFields(value, [
    "course_package_reference",
    "criteria",
    "learning_goal_references",
    "rubric_id",
    "title",
    "version"
  ]);
  const coursePackageReference = parseLearningDesignReference(
    value.course_package_reference,
    "course_package_id"
  );
  if (coursePackageReference.tenant_id !== tenantId)
    throw new HttpError(403, "LEARNING_DESIGN_TENANT_SCOPE_VIOLATION", "tenant scope violation");
  if (!Array.isArray(value.learning_goal_references) || value.learning_goal_references.length === 0)
    throw learningDesignRequestError();
  return {
    course_package_reference:
      coursePackageReference as unknown as RubricDraftInput["course_package_reference"],
    criteria: parseRubricCriteria(value.criteria),
    learning_goal_references: value.learning_goal_references.map(
      (reference) =>
        parseLearningDesignReference(
          reference,
          "goal_id"
        ) as unknown as LearningGoalVersionReference
    ),
    rubric_id: parseLearningDesignIdentity(value.rubric_id),
    title: parseLearningDesignText(value.title),
    version: parseLearningDesignVersion(value.version)
  };
}

function learningDesignCommandHttpError(error: unknown): HttpError {
  if (!(error instanceof LearningDesignCommandError)) throw error;
  const statusCode = [
    "LEARNING_DESIGN_TENANT_SCOPE_VIOLATION",
    "LEARNING_DESIGN_FORBIDDEN"
  ].includes(error.code)
    ? 403
    : error.code === "LEARNING_DESIGN_NOT_FOUND"
      ? 404
      : [
            "LEARNING_DESIGN_DUPLICATE_VERSION",
            "LEARNING_DESIGN_INVALID_TRANSITION",
            "LEARNING_DESIGN_DEPENDENCY_NOT_PUBLISHED"
          ].includes(error.code)
        ? 409
        : 422;
  return new HttpError(statusCode, error.code, "learning design command rejected");
}

function requireLearningDesignTeacher(context: RequestContext): CurrentUser {
  const actor = requirePermission(context, "course:read");
  if (!actorHasAnyRole(actor, ["teacher"]) || actor.tenant_id !== context.tenantId) {
    throw new HttpError(403, "LEARNING_DESIGN_FORBIDDEN", "teacher authority required");
  }
  return actor;
}

async function executeAuditedLearningDesignCommand<T>(
  runtime: ApiRuntime,
  command: () => Promise<T>,
  audit: (result: T) => Parameters<typeof appendAudit>[1]
): Promise<T> {
  const checkpoint = runtime.learningDesignCommands.captureAuditCheckpointForCompensation();
  let result: T;
  try {
    result = await command();
  } catch (error) {
    throw learningDesignCommandHttpError(error);
  }
  try {
    await appendAudit(runtime, audit(result));
  } catch {
    runtime.learningDesignCommands.restoreAuditCheckpointAfterFailure(checkpoint);
    throw new HttpError(
      500,
      "LEARNING_DESIGN_AUDIT_FAILED",
      "learning design request could not be completed"
    );
  }
  return result;
}

function d2EvidenceRequestError(): HttpError {
  return new HttpError(422, "D2_EVIDENCE_INPUT_INVALID", "D2 evidence request is invalid");
}

function assertOnlyD2EvidenceFields(
  value: Record<string, unknown>,
  fields: readonly string[]
): void {
  const keys = Object.keys(value);
  if (keys.length !== fields.length || keys.some((key) => !fields.includes(key))) {
    throw d2EvidenceRequestError();
  }
}

function parseD2EvidenceIdentity(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    !/^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) ||
    /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(value)
  ) {
    throw d2EvidenceRequestError();
  }
  return value;
}

function parseD2EvidenceRef(
  value: unknown,
  tenantId: string,
  resourceType: "course_package_version" | "learning_goal_version" | "rubric_version"
) {
  if (!isRecord(value)) throw d2EvidenceRequestError();
  assertOnlyD2EvidenceFields(value, [
    "content_digest",
    "discriminator",
    "resource_id",
    "resource_type",
    "tenant_id",
    "version"
  ]);
  if (
    value.discriminator !== "exact_ref" ||
    value.resource_type !== resourceType ||
    value.tenant_id !== tenantId ||
    !/^[a-f0-9]{64}$/.test(String(value.content_digest)) ||
    typeof value.resource_id !== "string" ||
    typeof value.version !== "string" ||
    /(?:^|[._:-])[xX*](?:$|[._:-])/.test(value.version)
  ) {
    throw d2EvidenceRequestError();
  }
  return {
    content_digest: String(value.content_digest),
    discriminator: "exact_ref" as const,
    resource_id: parseD2EvidenceIdentity(value.resource_id),
    resource_type: resourceType,
    tenant_id: tenantId,
    version: parseD2EvidenceIdentity(value.version)
  };
}

function parseD2EvidenceQuery(url: URL): D2EvidenceQuery {
  const values = {
    activity_id: url.searchParams.get("activity_id"),
    course_id: url.searchParams.get("course_id"),
    role_key: url.searchParams.get("role_key"),
    run_id: url.searchParams.get("run_id"),
    team_id: url.searchParams.get("team_id")
  };
  Object.values(values).forEach((value) => parseD2EvidenceIdentity(value));
  return values as D2EvidenceQuery;
}

function requireD2EvidenceTeacher(context: RequestContext): CurrentUser {
  const actor = requirePermission(context, "course:read");
  if (!actorHasAnyRole(actor, ["teacher"]) || actor.tenant_id !== context.tenantId) {
    throw new HttpError(403, "D2_EVIDENCE_FORBIDDEN", "teacher evidence authority required");
  }
  return actor;
}

function requireD4Student(context: RequestContext): CurrentUser {
  const actor = requireActor(context);
  if (
    !actorHasAnyRole(actor, ["learner", "student"]) ||
    actor.tenant_id !== context.tenantId ||
    !actor.team_id
  ) {
    throw new HttpError(403, "D4_REPORT_SCOPE_VIOLATION", "student report scope required");
  }
  return actor;
}

function requireD4Teacher(context: RequestContext): CurrentUser {
  const actor = requirePermission(context, "course:read");
  if (!actorHasAnyRole(actor, ["teacher"]) || actor.tenant_id !== context.tenantId) {
    throw new HttpError(403, "D4_REPORT_SCOPE_VIOLATION", "teacher report scope required");
  }
  return actor;
}

function requireD4Admin(context: RequestContext): CurrentUser {
  const actor = requirePermission(context, "course:read");
  if (
    !actorHasAnyRole(actor, ["tenant_admin", "admin", "platform_admin"]) ||
    (actor.tenant_id !== context.tenantId && !actorHasAnyRole(actor, ["platform_admin"]))
  ) {
    throw new HttpError(403, "D4_REPORT_SCOPE_VIOLATION", "admin report scope required");
  }
  return actor;
}

function d2EvidenceHttpError(error: unknown): HttpError {
  if (!(error instanceof D2EvidenceError)) throw error;
  const forbidden = [
    "D2_EVIDENCE_TENANT_SCOPE_VIOLATION",
    "D2_EVIDENCE_SCOPE_VIOLATION",
    "D2_EVIDENCE_ROLE_SCOPE_VIOLATION",
    "D2_EVIDENCE_FORBIDDEN"
  ];
  const conflict = ["D2_EVIDENCE_DUPLICATE_CONFLICT", "D2_EVIDENCE_REFERENCE_STALE"];
  return new HttpError(
    forbidden.includes(error.code) ? 403 : conflict.includes(error.code) ? 409 : 422,
    error.code,
    "D2 evidence command rejected"
  );
}

async function handleD2EvidenceRoute(
  runtime: ApiRuntime,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: RequestContext
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/v1/bff/teacher/evidence")) return false;
  const actor = requireD2EvidenceTeacher(context);
  try {
    if (request.method === "GET" && url.pathname === "/api/v1/bff/teacher/evidence") {
      const query = parseD2EvidenceQuery(url);
      const data = await runtime.evidenceCapture.listTeacherEvidence(context.tenantId, query);
      sendJson(response, 200, createEnvelope(context, data));
      return true;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/v1/bff/teacher/evidence-artifacts/capture"
    ) {
      const body = await readJson<Record<string, unknown>>(request, { requiredObject: true });
      assertOnlyD2EvidenceFields(body, [
        "activity_id",
        "course_id",
        "course_package_ref",
        "learning_goal_ref",
        "role_key",
        "rubric_ref",
        "run_id",
        "source_event_id",
        "team_id"
      ]);
      const input: D2EvidenceCaptureInput = {
        activity_id: parseD2EvidenceIdentity(body.activity_id),
        course_id: parseD2EvidenceIdentity(body.course_id),
        course_package_ref: parseD2EvidenceRef(
          body.course_package_ref,
          context.tenantId,
          "course_package_version"
        ),
        learning_goal_ref: parseD2EvidenceRef(
          body.learning_goal_ref,
          context.tenantId,
          "learning_goal_version"
        ),
        role_key: parseD2EvidenceIdentity(body.role_key),
        rubric_ref: parseD2EvidenceRef(body.rubric_ref, context.tenantId, "rubric_version"),
        run_id: parseD2EvidenceIdentity(body.run_id),
        source_event_id: parseD2EvidenceIdentity(body.source_event_id),
        team_id: parseD2EvidenceIdentity(body.team_id)
      };
      const data = await runtime.evidenceCapture.capture(
        { actor_id: actor.user_id, tenant_id: context.tenantId },
        input,
        context.requestId
      );
      sendJson(response, 201, createEnvelope(context, data));
      return true;
    }
  } catch (error) {
    throw d2EvidenceHttpError(error);
  }
  throw new HttpError(404, "ROUTE-404-001", "not found");
}

async function handleLearningDesignRoute(
  runtime: ApiRuntime,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: RequestContext
): Promise<boolean> {
  const isD1Route =
    url.pathname.startsWith("/api/v1/bff/teacher/learning-") ||
    url.pathname.startsWith("/api/v1/bff/teacher/rubrics/");
  if (!isD1Route) return false;
  const actor = requireLearningDesignTeacher(context);
  const commandActor = { actor_id: actor.user_id, tenant_id: context.tenantId };
  if (request.method === "GET" && url.pathname === "/api/v1/bff/teacher/learning-designs") {
    sendJson(
      response,
      200,
      createEnvelope(context, await runtime.learningDesignQueries.listTeacher(context.tenantId))
    );
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/v1/bff/teacher/learning-goals/drafts") {
    const input = parseLearningGoalDraftBody(
      await readJson(request, { requiredObject: true }),
      context.tenantId
    );
    const result = await executeAuditedLearningDesignCommand(
      runtime,
      () => runtime.learningDesignCommands.createGoalDraft(commandActor, input),
      (created) => ({
        actor,
        action: "learning_goal_version.draft_create",
        after: clonePublic(created),
        requestId: context.requestId,
        resourceId: `${created.goal_id}:${created.version}`,
        resourceType: "learning_goal_version",
        tenantId: context.tenantId
      })
    );
    sendJson(response, 201, createEnvelope(context, result));
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/v1/bff/teacher/rubrics/drafts") {
    const input = parseRubricDraftBody(
      await readJson(request, { requiredObject: true }),
      context.tenantId
    );
    const result = await executeAuditedLearningDesignCommand(
      runtime,
      () => runtime.learningDesignCommands.createRubricDraft(commandActor, input),
      (created) => ({
        actor,
        action: "rubric_version.draft_create",
        after: clonePublic(created),
        requestId: context.requestId,
        resourceId: `${created.rubric_id}:${created.version}`,
        resourceType: "rubric_version",
        tenantId: context.tenantId
      })
    );
    sendJson(response, 201, createEnvelope(context, result));
    return true;
  }
  if (
    request.method === "POST" &&
    url.pathname === "/api/v1/bff/teacher/learning-goals/revisions"
  ) {
    const body = await readJson<Record<string, unknown>>(request, { requiredObject: true });
    assertOnlyLearningDesignFields(body, ["source_reference", "version"]);
    const sourceReference = parseLearningDesignReference(
      body.source_reference,
      "goal_id"
    ) as unknown as LearningGoalVersionReference;
    const result = await executeAuditedLearningDesignCommand(
      runtime,
      () =>
        runtime.learningDesignCommands.reviseGoal(commandActor, {
          source_reference: sourceReference,
          version: parseLearningDesignVersion(body.version)
        }),
      (created) => ({
        actor,
        action: "learning_goal_version.revise",
        after: clonePublic(created),
        requestId: context.requestId,
        resourceId: `${created.goal_id}:${created.version}`,
        resourceType: "learning_goal_version",
        tenantId: context.tenantId
      })
    );
    sendJson(response, 201, createEnvelope(context, result));
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/v1/bff/teacher/rubrics/revisions") {
    const body = await readJson<Record<string, unknown>>(request, { requiredObject: true });
    assertOnlyLearningDesignFields(body, ["source_reference", "version"]);
    const sourceReference = parseLearningDesignReference(
      body.source_reference,
      "rubric_id"
    ) as unknown as RubricVersionReference;
    const result = await executeAuditedLearningDesignCommand(
      runtime,
      () =>
        runtime.learningDesignCommands.reviseRubric(commandActor, {
          source_reference: sourceReference,
          version: parseLearningDesignVersion(body.version)
        }),
      (created) => ({
        actor,
        action: "rubric_version.revise",
        after: clonePublic(created),
        requestId: context.requestId,
        resourceId: `${created.rubric_id}:${created.version}`,
        resourceType: "rubric_version",
        tenantId: context.tenantId
      })
    );
    sendJson(response, 201, createEnvelope(context, result));
    return true;
  }
  const goalTransition = url.pathname.match(
    /^\/api\/v1\/bff\/teacher\/learning-goals\/([^/]+)\/versions\/([^/]+)\/(validate|publish|reject)$/
  );
  if (request.method === "POST" && goalTransition) {
    const body = await readJson<Record<string, unknown>>(request, { requiredObject: true });
    assertOnlyLearningDesignFields(body, ["content_digest"]);
    const reference = {
      content_digest: parseLearningDesignDigest(body.content_digest),
      goal_id: parseLearningDesignIdentity(goalTransition[1]),
      tenant_id: context.tenantId,
      version: parseLearningDesignVersion(goalTransition[2])
    };
    const action = goalTransition[3];
    const command =
      action === "validate"
        ? runtime.learningDesignCommands.validateGoal
        : action === "publish"
          ? runtime.learningDesignCommands.publishGoal
          : runtime.learningDesignCommands.rejectGoal;
    const result = await executeAuditedLearningDesignCommand(
      runtime,
      () => command(commandActor, reference),
      (updated) => ({
        actor,
        action: `learning_goal_version.${action}`,
        after: clonePublic(updated),
        requestId: context.requestId,
        resourceId: `${updated.goal_id}:${updated.version}`,
        resourceType: "learning_goal_version",
        tenantId: context.tenantId
      })
    );
    sendJson(response, 200, createEnvelope(context, result));
    return true;
  }
  const rubricTransition = url.pathname.match(
    /^\/api\/v1\/bff\/teacher\/rubrics\/([^/]+)\/versions\/([^/]+)\/(validate|publish|reject)$/
  );
  if (request.method === "POST" && rubricTransition) {
    const body = await readJson<Record<string, unknown>>(request, { requiredObject: true });
    assertOnlyLearningDesignFields(body, ["content_digest"]);
    const reference = {
      content_digest: parseLearningDesignDigest(body.content_digest),
      rubric_id: parseLearningDesignIdentity(rubricTransition[1]),
      tenant_id: context.tenantId,
      version: parseLearningDesignVersion(rubricTransition[2])
    };
    const action = rubricTransition[3];
    const command =
      action === "validate"
        ? runtime.learningDesignCommands.validateRubric
        : action === "publish"
          ? runtime.learningDesignCommands.publishRubric
          : runtime.learningDesignCommands.rejectRubric;
    const result = await executeAuditedLearningDesignCommand(
      runtime,
      () => command(commandActor, reference),
      (updated) => ({
        actor,
        action: `rubric_version.${action}`,
        after: clonePublic(updated),
        requestId: context.requestId,
        resourceId: `${updated.rubric_id}:${updated.version}`,
        resourceType: "rubric_version",
        tenantId: context.tenantId
      })
    );
    sendJson(response, 200, createEnvelope(context, result));
    return true;
  }
  throw new HttpError(404, "ROUTE-404-001", "not found");
}

function assertOnlyInstructorAssetFields(
  body: Record<string, unknown>,
  expected: readonly string[]
): void {
  const keys = Object.keys(body);
  if (keys.length !== expected.length || keys.some((key) => !expected.includes(key))) {
    throw new HttpError(422, "INSTRUCTOR_ASSET-422-001", "instructor asset request invalid");
  }
}

function instructorAssetHttpError(error: unknown): never {
  if (!(error instanceof InstructorAssetRegistryError)) throw error;
  const statusCode =
    error.code === "INSTRUCTOR_ASSET_NOT_FOUND"
      ? 404
      : error.code === "INSTRUCTOR_ASSET_IMMUTABLE" ||
          error.code === "INSTRUCTOR_ASSET_REVISION_REQUIRES_FINAL_STATE"
        ? 409
        : 422;
  throw new HttpError(statusCode, error.code, error.message);
}

async function appendInstructorAssetAudit(
  runtime: ApiRuntime,
  input: Parameters<typeof appendAudit>[1],
  compensate: () => void
): Promise<void> {
  const auditCheckpoint = runtime.instructorAssets.captureAuditCheckpointForCompensation();
  try {
    await appendAudit(runtime, input);
  } catch (error) {
    try {
      runtime.instructorAssets.restoreAuditCheckpointAfterFailure(auditCheckpoint);
      compensate();
    } catch (compensationError) {
      throw new HttpError(
        500,
        "INSTRUCTOR_ASSET-500-001",
        `instructor asset audit compensation failed: ${String(compensationError)}`
      );
    }
    throw error;
  }
}

async function executeLockedRoleWorkflow<T>(
  runtime: ApiRuntime,
  tenantId: string,
  runId: string,
  command: () => T
): Promise<T> {
  const release = await acquireRunMutationLock(runtime, runMutationBusinessKey(tenantId, runId));
  try {
    return executeRoleWorkflow(command);
  } finally {
    release();
  }
}

async function routeRequest(
  runtime: ApiRuntime,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const store = runtime.store;

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  const url = new URL(request.url ?? "/", "http://localhost");
  const courseReportRoute = isCourseReportRoute(request.method, url);

  if (
    request.method === "GET" &&
    url.pathname === "/api/v1/bff/teacher/formal-scenario-package-catalog"
  ) {
    await handleTeacherFormalScenarioPackageCatalog(runtime, request, response);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/bff/teacher/course-blueprints") {
    await handleTeacherCourseBlueprintCatalog(runtime, request, response);
    return;
  }

  if (
    request.method === "POST" &&
    url.pathname === "/api/v1/bff/teacher/course-blueprints/readiness"
  ) {
    await handleTeacherCourseBlueprintReadiness(runtime, request, response);
    return;
  }

  if (
    request.method === "POST" &&
    url.pathname === "/api/v1/bff/teacher/course-blueprint-courses"
  ) {
    await handleTeacherCourseBlueprintCourseCreate(runtime, request, response);
    return;
  }

  if (
    request.method === "POST" &&
    url.pathname === "/api/v1/bff/teacher/course-blueprints/studio/preview"
  ) {
    await handleTeacherCourseBlueprintStudioPreview(runtime, request, response);
    return;
  }

  if (
    request.method === "POST" &&
    url.pathname === "/api/v1/bff/teacher/course-blueprints/studio/drafts"
  ) {
    await handleTeacherCourseBlueprintStudioDraftCreate(runtime, request, response);
    return;
  }

  if (
    request.method === "POST" &&
    url.pathname === "/api/v1/bff/teacher/course-blueprints/studio/submissions"
  ) {
    await handleTeacherCourseBlueprintStudioSubmission(runtime, request, response);
    return;
  }

  if (
    request.method === "POST" &&
    url.pathname === "/api/v1/bff/teacher/formal-course-bindings/preview"
  ) {
    await handleTeacherFormalCourseBindingPreview(runtime, request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/bff/teacher/formal-courses") {
    await handleTeacherFormalCourseCreate(runtime, request, response);
    return;
  }

  if (
    request.method === "GET" &&
    url.pathname.startsWith("/api/v1/bff/teacher/runs/") &&
    url.pathname.endsWith("/scenario-package-candidates")
  ) {
    await handleR7TeacherScenarioPackageCandidates(runtime, request, response, url);
    return;
  }

  if (
    request.method === "GET" &&
    url.pathname.startsWith("/api/v1/bff/teacher/runs/") &&
    url.pathname.endsWith("/scenario-selection-readiness")
  ) {
    await handleR7TeacherScenarioSelectionReadiness(runtime, request, response, url);
    return;
  }

  if (courseReportRoute) {
    try {
      await handleCourseReportRoute(request, response, url, {
        createContext: () => createContext(runtime, request),
        courseReports: runtime.courseReports,
        requirePermission,
        actorHasAnyRole,
        createEnvelope,
        sendJson
      });
      return;
    } catch (error) {
      throw courseReportHttpError(error);
    }
  }

  const context = createContext(runtime, request);

  if (isStudentLearningReportRoute(request.method, url)) {
    await handleStudentLearningReportRoute(
      { projections: runtime.studentLearningReports },
      request,
      response,
      url,
      { requestId: context.requestId, tenantId: context.tenantId },
      {
        createEnvelope: (routeContext, payload) =>
          createEnvelope(routeContext as RequestContext, payload),
        requireStudent: () => requireD4Student(context),
        requireTeacher: () => requireD4Teacher(context),
        requireAdmin: () => requireD4Admin(context),
        sendJson
      }
    );
    return;
  }

  if (
    await handleTeachingClosureRoute(
      { closure: runtime.teachingClosure },
      request,
      response,
      url,
      { requestId: context.requestId, tenantId: context.tenantId },
      {
        createEnvelope: (routeContext, payload) =>
          createEnvelope(routeContext as RequestContext, payload),
        requireTeacher: () => requireD4Teacher(context),
        sendJson
      }
    )
  )
    return;

  if (
    await handleD5ExportRoute(
      { exportAssembler: runtime.d5ExportAssembler, delivery: runtime.d5Delivery },
      request,
      response,
      url,
      { requestId: context.requestId, tenantId: context.tenantId },
      {
        readJson: (incoming, options) => readJson(incoming, options),
        sendJson,
        createEnvelope: (routeContext, payload, message) =>
          createEnvelope(routeContext as RequestContext, payload, message),
        requireTeacher: () => requireD4Teacher(context),
        requireAdmin: () => requireD4Admin(context)
      }
    )
  )
    return;

  if (
    await handleTransferResearchDesignRoute(
      { transferResearchDesign: runtime.transferResearchDesign },
      request,
      response,
      url,
      { requestId: context.requestId, tenantId: context.tenantId },
      {
        readJson: (incoming, options) => readJson(incoming, options),
        sendJson,
        createEnvelope: (routeContext, payload, message) =>
          createEnvelope(routeContext as RequestContext, payload, message),
        requireTeacher: () => requireD4Teacher(context),
        requireAdmin: () => requireD4Admin(context)
      }
    )
  )
    return;

  if (
    await handleGoldenJourneyRoute(
      { goldenJourney: runtime.goldenJourney },
      request,
      response,
      url,
      {
        requestId: context.requestId,
        tenantId: context.tenantId,
        correlationId: request.headers["x-correlation-id"]?.toString() ?? context.requestId
      },
      {
        sendJson,
        createEnvelope: (routeContext, payload) =>
          createEnvelope(routeContext as RequestContext, payload),
        requireStudent: () => requireD4Student(context),
        requireTeacher: () => requireD4Teacher(context)
      }
    )
  )
    return;

  if (await handleD2EvidenceRoute(runtime, request, response, url, context)) return;

  if (
    url.pathname.startsWith("/api/v1/bff/student/advisors") ||
    url.pathname.startsWith("/api/v1/bff/teacher/advisors")
  ) {
    if (
      await handleW020AdvisoryRoute(
        runtime.governedAdvisory,
        request,
        response,
        url,
        { requestId: context.requestId, tenantId: context.tenantId, actor: requireActor(context) },
        {
          readJson: (incoming) => readJson(incoming),
          sendJson,
          createEnvelope: (routeContext, payload) =>
            createEnvelope(routeContext as RequestContext, payload),
          requireStudent: () => requireD4Student(context),
          requireTeacher: () => requireD4Teacher(context)
        }
      )
    )
      return;
  }

  if (
    await handleTeacherConfirmationRoute(
      {
        commands: runtime.teacherConfirmations,
        queries: runtime.teacherConfirmationQueries,
        claims: runtime.teacherConfirmationClaims
      },
      request,
      response,
      url,
      {
        requestId: context.requestId,
        tenantId: context.tenantId,
        actorId: context.actor?.user_id ?? ""
      },
      {
        readJson: (incoming) => readJson(incoming),
        sendJson,
        createEnvelope: (routeContext, payload) =>
          createEnvelope(routeContext as RequestContext, payload),
        requireTeacher: () => requireD2EvidenceTeacher(context)
      }
    )
  )
    return;

  if (await handleLearningDesignRoute(runtime, request, response, url, context)) return;

  if (request.method === "GET" && url.pathname === "/api/v1/admin/course-package-versions") {
    requireCoursePackageAdmin(context);
    sendJson(
      response,
      200,
      createEnvelope(context, await runtime.coursePackageQueries.listAdmin(context.tenantId))
    );
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/bff/teacher/course-package-versions") {
    requireCoursePackageTeacher(context);
    sendJson(
      response,
      200,
      createEnvelope(context, await runtime.coursePackageQueries.listTeacher(context.tenantId))
    );
    return;
  }

  if (
    request.method === "POST" &&
    url.pathname === "/api/v1/bff/teacher/course-package-versions/clone"
  ) {
    const actor = requireCoursePackageTeacher(context);
    const input = parseCoursePackageCloneInput(
      await readJson<Record<string, unknown>>(request, { requiredObject: true }),
      context.tenantId
    );
    const created = await executeAuditedCoursePackageCommand(
      runtime,
      () => runtime.coursePackageCommands.clone(coursePackageCommandActor(context, actor), input),
      (result) => ({
        actor,
        action: "course_package_version.teacher_clone",
        after: clonePublic(result),
        requestId: context.requestId,
        resourceId: `${result.course_package_id}:${result.version}`,
        resourceType: "course_package_version",
        tenantId: context.tenantId
      })
    );
    sendJson(response, 201, createEnvelope(context, toTeacherCoursePackageVersionDto(created)));
    return;
  }

  if (
    request.method === "POST" &&
    url.pathname === "/api/v1/admin/course-package-versions/drafts"
  ) {
    const actor = requireCoursePackageAdmin(context);
    const draft = parseCoursePackageDraft(
      await readJson<Record<string, unknown>>(request, { requiredObject: true }),
      context.tenantId
    );
    const created = await executeAuditedCoursePackageCommand(
      runtime,
      () =>
        runtime.coursePackageCommands.createDraft(coursePackageCommandActor(context, actor), draft),
      (result) => ({
        actor,
        action: "course_package_version.draft_create",
        after: clonePublic(result),
        requestId: context.requestId,
        resourceId: `${result.course_package_id}:${result.version}`,
        resourceType: "course_package_version",
        tenantId: context.tenantId
      })
    );
    sendJson(response, 201, createEnvelope(context, created));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/admin/course-package-versions/clone") {
    const actor = requireCoursePackageAdmin(context);
    const input = parseCoursePackageCloneInput(
      await readJson<Record<string, unknown>>(request, { requiredObject: true }),
      context.tenantId
    );
    const created = await executeAuditedCoursePackageCommand(
      runtime,
      () => runtime.coursePackageCommands.clone(coursePackageCommandActor(context, actor), input),
      (result) => ({
        actor,
        action: "course_package_version.clone",
        after: clonePublic(result),
        requestId: context.requestId,
        resourceId: `${result.course_package_id}:${result.version}`,
        resourceType: "course_package_version",
        tenantId: context.tenantId
      })
    );
    sendJson(response, 201, createEnvelope(context, created));
    return;
  }

  if (
    request.method === "POST" &&
    url.pathname === "/api/v1/admin/course-package-versions/import"
  ) {
    const actor = requireCoursePackageAdmin(context);
    const input = parseCoursePackageImportInput(
      await readJson<Record<string, unknown>>(request, { requiredObject: true }),
      context.tenantId
    );
    const created = await executeAuditedCoursePackageCommand(
      runtime,
      () => runtime.coursePackageCommands.import(coursePackageCommandActor(context, actor), input),
      (result) => ({
        actor,
        action: "course_package_version.import",
        after: clonePublic(result),
        requestId: context.requestId,
        resourceId: `${result.course_package_id}:${result.version}`,
        resourceType: "course_package_version",
        tenantId: context.tenantId
      })
    );
    sendJson(response, 201, createEnvelope(context, created));
    return;
  }

  const coursePackageTransition = url.pathname.match(
    /^\/api\/v1\/admin\/course-package-versions\/([^/]+)\/versions\/([^/]+)\/(validate|make-available|retire)$/
  );
  if (request.method === "POST" && coursePackageTransition) {
    const actor = requireCoursePackageAdmin(context);
    const reference = parseCoursePackageVersionReference(
      await readJson<Record<string, unknown>>(request, { requiredObject: true }),
      context.tenantId
    );
    const [, coursePackageId, version, action] = coursePackageTransition;
    if (
      !coursePackageId ||
      !version ||
      !action ||
      reference.course_package_id !== coursePackageId ||
      reference.version !== version
    ) {
      throw coursePackageRequestError();
    }
    const commandActor = coursePackageCommandActor(context, actor);
    const transitioned = await executeAuditedCoursePackageCommand(
      runtime,
      () => {
        switch (action) {
          case "validate":
            return runtime.coursePackageCommands.validate(commandActor, reference);
          case "make-available":
            return runtime.coursePackageCommands.makeAvailable(commandActor, reference);
          case "retire":
            return runtime.coursePackageCommands.retire(commandActor, reference);
          default:
            throw coursePackageRequestError();
        }
      },
      (result) => ({
        actor,
        action: `course_package_version.${action}`,
        after: clonePublic(result),
        requestId: context.requestId,
        resourceId: `${result.course_package_id}:${result.version}`,
        resourceType: "course_package_version",
        tenantId: context.tenantId
      })
    );
    sendJson(response, 200, createEnvelope(context, transitioned));
    return;
  }

  const coursePackageExport = url.pathname.match(
    /^\/api\/v1\/admin\/course-package-versions\/([^/]+)\/versions\/([^/]+)\/export$/
  );
  if (request.method === "GET" && coursePackageExport) {
    const actor = requireCoursePackageAdmin(context);
    if (
      [...url.searchParams.keys()].length !== 1 ||
      !url.searchParams.has("content_digest") ||
      !coursePackageExport[1] ||
      !coursePackageExport[2]
    ) {
      throw coursePackageRequestError();
    }
    const exported = await executeCoursePackageCommand(() =>
      runtime.coursePackageCommands.export(coursePackageCommandActor(context, actor), {
        content_digest: requireCoursePackageDigest(url.searchParams.get("content_digest")),
        course_package_id: requireCoursePackageExactIdentity(coursePackageExport[1]),
        tenant_id: context.tenantId,
        version: requireCoursePackageExactVersion(coursePackageExport[2])
      })
    );
    try {
      await appendAudit(runtime, {
        actor,
        action: "course_package_version.export",
        after: clonePublic(exported),
        requestId: context.requestId,
        resourceId: `${exported.course_package_version.course_package_id}:${exported.course_package_version.version}`,
        resourceType: "course_package_version",
        tenantId: context.tenantId
      });
    } catch {
      throw new HttpError(
        500,
        "COURSE_PACKAGE_EXPORT_AUDIT_FAILED",
        "course package export could not be completed"
      );
    }
    sendJson(response, 200, createEnvelope(context, exported));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/bff/teacher/instructor-assets") {
    requireInstructorAssetTeacher(context);
    const courseId = url.searchParams.get("course_id")?.trim();
    if (!courseId) {
      throw new HttpError(422, "INSTRUCTOR_ASSET-422-002", "course_id is required");
    }
    sendJson(
      response,
      200,
      createEnvelope(context, runtime.instructorAssets.list(context.tenantId, courseId))
    );
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/bff/teacher/instructor-intelligence") {
    requireInstructorAssetTeacher(context);
    const assetId = url.searchParams.get("asset_id")?.trim();
    const runId = url.searchParams.get("run_id")?.trim();
    const roundNo = Number(url.searchParams.get("round_no"));
    if (!assetId || !runId || !Number.isInteger(roundNo) || roundNo < 1) {
      throw new HttpError(
        422,
        "INSTRUCTOR_ASSET-422-001",
        "instructor intelligence request invalid"
      );
    }
    try {
      const asset = runtime.instructorAssets.get(context.tenantId, assetId);
      if (asset.status !== "teacher_published") {
        throw new HttpError(409, "INSTRUCTOR_ASSET-409-001", "instructor asset must be published");
      }
      const run = await getRunForRead(runtime, context, runId);
      if (run.course_id !== asset.course_id) {
        throw new HttpError(
          404,
          "INSTRUCTOR_ASSET-404-001",
          "instructor asset is not bound to this course"
        );
      }
      const round = await getRoundForRead(runtime, context, runId, roundNo);
      if (round.status !== "published") {
        throw new HttpError(
          409,
          "INSTRUCTOR_ASSET-409-002",
          "instructor intelligence requires a published round"
        );
      }
      const resultView = await createPublicResultView(runtime, context, runId, roundNo, {
        includeReplayEvidence: false
      });
      const previousRound = (
        await runtime.repositoryProvider.facade.rounds.listRoundsForRun(context.tenantId, runId)
      ).find((candidate) => candidate.round_no === roundNo - 1);
      const previousResultView =
        previousRound?.status === "published"
          ? await createPublicResultView(runtime, context, runId, previousRound.round_no, {
              includeReplayEvidence: false
            })
          : undefined;
      sendJson(
        response,
        200,
        createEnvelope(
          context,
          createInstructorIntelligenceKit({
            asset,
            ...(previousResultView ? { previous_result_view: previousResultView } : {}),
            result_view: resultView,
            round
          })
        )
      );
      return;
    } catch (error) {
      instructorAssetHttpError(error);
    }
  }

  if (
    request.method === "GET" &&
    (url.pathname === "/api/v1/bff/teacher/instructor-debrief-artifact" ||
      url.pathname === "/api/v1/bff/teacher/instructor-debrief-artifact/export")
  ) {
    requireInstructorAssetTeacher(context);
    try {
      const artifact = await buildInstructorDebriefArtifactForRequest(runtime, context, url);
      if (url.pathname.endsWith("/export")) {
        const format = url.searchParams.get("format") ?? "json";
        if (format !== "json" && format !== "markdown") {
          throw new HttpError(
            422,
            "INSTRUCTOR_DEBRIEF-422-002",
            "export format must be json or markdown"
          );
        }
        const extension = format === "markdown" ? "md" : "json";
        const content =
          format === "markdown"
            ? renderInstructorDebriefMarkdown(artifact)
            : serializeInstructorDebriefArtifactJson(artifact);
        const filename =
          "simwar-instructor-debrief-" +
          safeInstructorDebriefFilenamePart(artifact.source_binding.run_id) +
          "-r" +
          artifact.source_binding.round_no +
          "-" +
          artifact.artifact_digest.slice(0, 8) +
          "." +
          extension;
        sendInstructorDebriefDownload(
          response,
          content,
          format === "markdown" ? "text/markdown" : "application/json",
          filename
        );
      } else {
        sendJson(response, 200, createEnvelope(context, artifact));
      }
      return;
    } catch (error) {
      if (error instanceof InstructorAssetRegistryError) instructorAssetHttpError(error);
      instructorDebriefHttpError(error);
    }
  }

  if (
    request.method === "POST" &&
    url.pathname === "/api/v1/bff/teacher/instructor-assets/drafts"
  ) {
    const actor = requireInstructorAssetTeacher(context);
    const body = await readJson<Record<string, unknown>>(request, { requiredObject: true });
    assertOnlyInstructorAssetFields(body, ["course_id", "title"]);
    try {
      const courseId = requireBodyString(body.course_id);
      const binding = runtime.courseBlueprintBindingStore.getForCourse(context.tenantId, courseId);
      if (!binding) {
        throw new InstructorAssetRegistryError("INSTRUCTOR_ASSET_COURSE_BINDING_REQUIRED");
      }
      const courseBlueprintRef: ExactRef = {
        content_digest: binding.course_blueprint_reference.content_digest,
        discriminator: "exact_ref",
        resource_id: binding.course_blueprint_reference.course_blueprint_id,
        resource_type: "course_blueprint",
        tenant_id: binding.course_blueprint_reference.tenant_id,
        version: binding.course_blueprint_reference.version
      };
      const asset = runtime.instructorAssets.createDraft({
        actor_id: actor.user_id,
        course_blueprint_ref: courseBlueprintRef,
        course_id: courseId,
        tenant_id: context.tenantId,
        title: requireBodyString(body.title)
      });
      await appendInstructorAssetAudit(
        runtime,
        {
          actor,
          action: "instructor_asset.draft_create",
          after: clonePublic(asset),
          requestId: context.requestId,
          resourceId: asset.asset_id,
          resourceType: "instructor_asset"
        },
        () =>
          runtime.instructorAssets.discardAfterAuditFailure({
            actor_id: actor.user_id,
            asset_id: asset.asset_id,
            tenant_id: context.tenantId
          })
      );
      sendJson(response, 201, createEnvelope(context, asset));
      return;
    } catch (error) {
      instructorAssetHttpError(error);
    }
  }

  const instructorAssetRevision = url.pathname.match(
    /^\/api\/v1\/bff\/teacher\/instructor-assets\/([^/]+)\/revisions$/
  );
  if (request.method === "POST" && instructorAssetRevision) {
    const actor = requireInstructorAssetTeacher(context);
    const body = await readJson<Record<string, unknown>>(request, { requiredObject: true });
    assertOnlyInstructorAssetFields(body, ["title"]);
    try {
      const asset = runtime.instructorAssets.createRevision({
        actor_id: actor.user_id,
        asset_id: instructorAssetRevision[1]!,
        tenant_id: context.tenantId,
        title: requireBodyString(body.title)
      });
      await appendInstructorAssetAudit(
        runtime,
        {
          actor,
          action: "instructor_asset.revision_create",
          after: clonePublic(asset),
          requestId: context.requestId,
          resourceId: asset.asset_id,
          resourceType: "instructor_asset"
        },
        () =>
          runtime.instructorAssets.discardAfterAuditFailure({
            actor_id: actor.user_id,
            asset_id: asset.asset_id,
            tenant_id: context.tenantId
          })
      );
      sendJson(response, 201, createEnvelope(context, asset));
      return;
    } catch (error) {
      instructorAssetHttpError(error);
    }
  }

  const instructorAssetTransition = url.pathname.match(
    /^\/api\/v1\/bff\/teacher\/instructor-assets\/([^/]+)\/(publish|reject)$/
  );
  if (request.method === "POST" && instructorAssetTransition) {
    const actor = requireInstructorAssetTeacher(context);
    const body = await readJson<Record<string, unknown>>(request, { requiredObject: true });
    assertOnlyInstructorAssetFields(body, []);
    const assetId = instructorAssetTransition[1]!;
    const action = instructorAssetTransition[2]!;
    try {
      const asset =
        action === "publish"
          ? runtime.instructorAssets.publish({
              actor_id: actor.user_id,
              asset_id: assetId,
              tenant_id: context.tenantId
            })
          : runtime.instructorAssets.reject({
              actor_id: actor.user_id,
              asset_id: assetId,
              tenant_id: context.tenantId
            });
      await appendInstructorAssetAudit(
        runtime,
        {
          actor,
          action: `instructor_asset.${action}`,
          after: clonePublic(asset),
          requestId: context.requestId,
          resourceId: asset.asset_id,
          resourceType: "instructor_asset"
        },
        () =>
          runtime.instructorAssets.revertTransitionAfterAuditFailure({
            actor_id: actor.user_id,
            asset_id: asset.asset_id,
            tenant_id: context.tenantId
          })
      );
      sendJson(response, 200, createEnvelope(context, asset));
      return;
    } catch (error) {
      instructorAssetHttpError(error);
    }
  }

  if (
    request.method === "GET" &&
    (url.pathname === "/healthz" || url.pathname === "/api/v1/health")
  ) {
    sendJson(response, 200, createEnvelope(context, getApiHealthPayload()));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/auth/login") {
    const body = await readJson<{ username?: string; email?: string; password?: string }>(request);
    const login = body.username?.trim() || body.email?.trim();
    const user = store.users.find(
      (candidate) =>
        candidate.tenant_id === context.tenantId &&
        candidate.status === "active" &&
        (candidate.username === login || candidate.email === login)
    );

    if (!user || !body.password || !verifyPassword(body.password, user.password_hash)) {
      throw new HttpError(401, "AUTH-401-002", "invalid credentials");
    }

    if (isSharedRuntime(runtime.securityConfig.environment) && isSeededDemoUser(user)) {
      throw new HttpError(401, "AUTH-401-003", "demo accounts disabled in shared runtime");
    }

    const actor = getActorFromUser(store, user);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const sessionId = nextId(store, "session", "session");
    const expiresAtSeconds = nowSeconds + SESSION_TTL_SECONDS;
    const accessToken = createSignedToken(
      {
        sub: actor.user_id,
        tenant_id: actor.tenant_id,
        roles: actor.roles,
        session_id: sessionId,
        iat: nowSeconds,
        exp: expiresAtSeconds
      },
      runtime.securityConfig.jwtSecret
    );

    store.sessions.push({
      session_id: sessionId,
      user_id: actor.user_id,
      tenant_id: actor.tenant_id,
      token_hash: hashToken(accessToken),
      created_at: new Date(nowSeconds * 1000).toISOString(),
      expires_at: new Date(expiresAtSeconds * 1000).toISOString()
    });
    await appendAudit(runtime, {
      actor,
      action: "auth.login",
      resourceType: "user",
      resourceId: actor.user_id,
      requestId: context.requestId,
      tenantId: actor.tenant_id
    });

    const session: AuthSession = {
      access_token: accessToken,
      expires_in: SESSION_TTL_SECONDS,
      token_type: "Bearer",
      user: actor
    };
    sendJson(response, 200, createEnvelope(context, session));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/bff/teacher/role-workflows") {
    const actor = roleWorkflowActor(context, "teacher");
    const data = executeRoleWorkflow(() =>
      runtime.roleWorkflow.getTeacherWorkspace(actor, roleWorkflowScopeFromUrl(url))
    );
    sendJson(response, 200, createEnvelope(context, data));
    return;
  }

  if (
    request.method === "PUT" &&
    url.pathname === "/api/v1/bff/teacher/role-workflows/assignments"
  ) {
    const actor = roleWorkflowActor(context, "teacher");
    const body = await readJson<Record<string, unknown>>(request);
    assertOnlyRoleWorkflowFields(body, ["course_id", "role_key", "run_id", "team_id", "user_id"]);
    const input = {
      course_id: roleWorkflowString(body.course_id, "course_id"),
      role_key: roleWorkflowString(body.role_key, "role_key") as RoleId,
      run_id: roleWorkflowString(body.run_id, "run_id"),
      team_id: roleWorkflowString(body.team_id, "team_id"),
      user_id: roleWorkflowString(body.user_id, "user_id")
    };
    if (!["CEO", "CFO", "CMO", "COO"].includes(input.role_key)) {
      throw new HttpError(422, "ROLE_WORKFLOW-422-001", "role workflow request invalid");
    }
    const data = await executeLockedRoleWorkflow(runtime, context.tenantId, input.run_id, () =>
      runtime.roleWorkflow.assignRole(actor, input)
    );
    sendJson(response, 201, createEnvelope(context, data));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/bff/teacher/role-workflows/reset") {
    const actor = roleWorkflowActor(context, "teacher");
    const body = await readJson<Record<string, unknown>>(request);
    assertOnlyRoleWorkflowFields(body, ["round_id", "run_id", "team_id"]);
    const input = roleWorkflowScopeFromBody(body);
    const data = await executeLockedRoleWorkflow(runtime, context.tenantId, input.run_id, () =>
      runtime.roleWorkflow.resetWorkflow(actor, input)
    );
    sendJson(response, 200, createEnvelope(context, data));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/bff/student/role-workspace") {
    const actor = roleWorkflowActor(context, "student");
    const data = executeRoleWorkflow(() =>
      runtime.roleWorkflow.getStudentWorkspace(actor, roleWorkflowScopeFromUrl(url))
    );
    sendJson(response, 200, createEnvelope(context, data));
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/v1/bff/student/role-workspace/section") {
    const actor = roleWorkflowActor(context, "student");
    const body = await readJson<Record<string, unknown>>(request);
    assertOnlyRoleWorkflowFields(body, [
      "expected_version",
      "payload",
      "round_id",
      "run_id",
      "team_id"
    ]);
    const scope = roleWorkflowScopeFromBody(body);
    if (
      typeof body.expected_version !== "number" ||
      !Number.isSafeInteger(body.expected_version) ||
      body.payload === undefined
    ) {
      throw new HttpError(422, "ROLE_WORKFLOW-422-001", "role workflow request invalid");
    }
    const payload = parseRoleWorkflowPayload(body.payload);
    const data = await executeLockedRoleWorkflow(runtime, context.tenantId, scope.run_id, () =>
      runtime.roleWorkflow.saveSection(actor, {
        ...scope,
        expected_version: body.expected_version as number,
        payload
      })
    );
    sendJson(response, 200, createEnvelope(context, data));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/bff/student/role-workspace/ready") {
    const actor = roleWorkflowActor(context, "student");
    const body = await readJson<Record<string, unknown>>(request);
    assertOnlyRoleWorkflowFields(body, ["expected_version", "round_id", "run_id", "team_id"]);
    const scope = roleWorkflowScopeFromBody(body);
    if (typeof body.expected_version !== "number" || !Number.isSafeInteger(body.expected_version)) {
      throw new HttpError(422, "ROLE_WORKFLOW-422-001", "role workflow request invalid");
    }
    const data = await executeLockedRoleWorkflow(runtime, context.tenantId, scope.run_id, () =>
      runtime.roleWorkflow.markSectionReady(actor, {
        ...scope,
        expected_version: body.expected_version as number
      })
    );
    sendJson(response, 200, createEnvelope(context, data));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/bff/student/role-workspace/merge") {
    const actor = roleWorkflowActor(context, "student");
    const body = await readJson<Record<string, unknown>>(request);
    assertOnlyRoleWorkflowFields(body, ["round_id", "run_id", "team_id"]);
    const scope = roleWorkflowScopeFromBody(body);
    const data = await executeLockedRoleWorkflow(runtime, context.tenantId, scope.run_id, () =>
      runtime.roleWorkflow.createMergeCommit(actor, scope)
    );
    sendJson(response, 201, createEnvelope(context, data));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/bff/student/role-workspace/confirm") {
    const actor = roleWorkflowActor(context, "student");
    const body = await readJson<Record<string, unknown>>(request);
    assertOnlyRoleWorkflowFields(body, ["merge_commit_id", "round_id", "run_id", "team_id"]);
    const scope = roleWorkflowScopeFromBody(body);
    const mergeCommitId = roleWorkflowString(body.merge_commit_id, "merge_commit_id");
    const result = await executeLockedRoleWorkflow(runtime, context.tenantId, scope.run_id, () => {
      const before = runtime.repositoryProvider.ports.roleWorkflow.readRoleWorkflow({
        ...scope,
        tenant_id: context.tenantId
      });
      return {
        data: runtime.roleWorkflow.confirmTeamDecision(actor, {
          ...scope,
          merge_commit_id: mergeCommitId
        }),
        wasExisting: before.confirmations.some(
          (candidate) => candidate.merge_commit_id === mergeCommitId
        )
      };
    });
    sendJson(response, result.wasExisting ? 200 : 201, createEnvelope(context, result.data));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/admin/tenant-baselines/provision") {
    const actor = requireActor(context);
    if (
      !actorHasAnyRole(actor, ["platform_admin"]) ||
      !actorHasPermission(actor, "parameter_set:manage") ||
      !actorHasPermission(actor, "scenario_package:manage")
    ) {
      throw new HttpError(
        403,
        "TENANT_BASELINE-403-001",
        "platform baseline provisioning authority required"
      );
    }
    const input = parseTenantBaselineProvisioningRequest(await readJson(request));
    try {
      requireManagedTenant(store, actor, context, input.target_tenant_id);
    } catch (error) {
      if (error instanceof HttpError && error.statusCode === 404) {
        throw new HttpError(404, "TENANT_BASELINE-404-001", "target tenant not found");
      }
      throw error;
    }
    const result = await executeTenantBaselineProvisioning(() =>
      runtime.tenantBaselineProvisioning.provision(
        { actor_id: actor.user_id, correlation_id: context.requestId },
        input,
        async (materialized) => {
          await appendAudit(runtime, {
            actor,
            action: "tenant_baseline.provision",
            after: clonePublic(materialized),
            requestId: context.requestId,
            resourceId: materialized.audit_identity,
            resourceType: "tenant_baseline_provisioning",
            tenantId: input.target_tenant_id
          });
        }
      )
    );
    sendJson(response, result.outcome === "CREATED" ? 201 : 200, createEnvelope(context, result));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/formal-authority/parameter-sets") {
    const actor = requirePermission(context, "parameter_set:manage");
    const draft = parseFormalParameterSetDraft(await readJson(request), context.tenantId);
    const created = await executeFormalParameterSetCommand(() =>
      runtime.formalParameterSets.createDraft(createFormalParameterSetActor(context, actor), draft)
    );
    await appendAudit(runtime, {
      actor,
      action: "parameter_set.create",
      resourceType: "formal_parameter_set",
      resourceId: formalParameterSetResourceId(created.reference),
      requestId: context.requestId,
      tenantId: context.tenantId,
      after: clonePublic(created)
    });
    sendJson(response, 201, createEnvelope(context, created));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/formal-authority/course-blueprints") {
    const actor = requirePermission(context, "course_blueprint:manage");
    if (!actorHasAnyRole(actor, ["platform_admin"])) {
      throw new HttpError(
        403,
        "COURSE_BLUEPRINT-403-001",
        "formal course blueprint authority required"
      );
    }
    const draft = parseCourseBlueprintDraft(await readJson(request), context.tenantId);
    const created = await executeCourseBlueprintCommand(() =>
      runtime.formalCourseBlueprints.createDraft(createCourseBlueprintActor(context, actor), draft)
    );
    await appendAudit(runtime, {
      actor,
      action: "course_blueprint.create",
      resourceId: `${created.reference.course_blueprint_id}:${created.reference.version}`,
      resourceType: "formal_course_blueprint",
      requestId: context.requestId,
      tenantId: context.tenantId,
      after: clonePublic(created)
    });
    sendJson(response, 201, createEnvelope(context, created));
    return;
  }

  if (
    request.method === "POST" &&
    /^\/api\/v1\/formal-authority\/course-blueprints\/[^/]+\/versions\/[^/]+\/(validate|freeze|approve|retire)$/.test(
      url.pathname
    )
  ) {
    const actor = requirePermission(context, "course_blueprint:manage");
    if (!actorHasAnyRole(actor, ["platform_admin"])) {
      throw new HttpError(
        403,
        "COURSE_BLUEPRINT-403-001",
        "formal course blueprint authority required"
      );
    }
    const [, blueprintId, version, action] = matchPath(
      url.pathname,
      /^\/api\/v1\/formal-authority\/course-blueprints\/([^/]+)\/versions\/([^/]+)\/(validate|freeze|approve|retire)$/
    );
    const body = await readJson(request);
    const reference = parseCourseBlueprintReference(body, context.tenantId);
    if (reference.course_blueprint_id !== blueprintId || reference.version !== version) {
      throw courseBlueprintRequestError();
    }
    const commandActor = createCourseBlueprintActor(context, actor);
    let result:
      | CourseBlueprintVersion
      | { approval_record: unknown; version: CourseBlueprintVersion };
    switch (action) {
      case "validate":
        result = await executeCourseBlueprintCommand(() =>
          runtime.formalCourseBlueprints.validate(commandActor, reference)
        );
        break;
      case "freeze":
        result = await executeCourseBlueprintCommand(() =>
          runtime.formalCourseBlueprints.freeze(commandActor, reference)
        );
        break;
      case "approve": {
        if (!isRecord(body)) throw courseBlueprintRequestError();
        result = await executeCourseBlueprintCommand(() =>
          runtime.formalCourseBlueprints.approve(
            commandActor,
            reference,
            requireBodyString(body.approval_id)
          )
        );
        break;
      }
      case "retire":
        result = await executeCourseBlueprintCommand(() =>
          runtime.formalCourseBlueprints.retire(commandActor, reference)
        );
        break;
      default:
        throw new HttpError(404, "ROUTE-404-001", "not found");
    }
    const versionResult = "version" in result ? result.version : result;
    await appendAudit(runtime, {
      actor,
      action: `course_blueprint.${action}`,
      resourceId: `${reference.course_blueprint_id}:${reference.version}`,
      resourceType: "formal_course_blueprint",
      requestId: context.requestId,
      tenantId: context.tenantId,
      after: clonePublic(versionResult)
    });
    sendJson(response, 200, createEnvelope(context, result));
    return;
  }

  if (
    request.method === "POST" &&
    /^\/api\/v1\/formal-authority\/parameter-sets\/[^/]+\/versions\/[^/]+\/(validate|freeze|approve|retire)$/.test(
      url.pathname
    )
  ) {
    const actor = requirePermission(context, "parameter_set:manage");
    const [, parameterSetId, version, action] = matchPath(
      url.pathname,
      /^\/api\/v1\/formal-authority\/parameter-sets\/([^/]+)\/versions\/([^/]+)\/(validate|freeze|approve|retire)$/
    );
    const body = await readJson(request);
    const reference = parseFormalParameterSetReference(body, context.tenantId);
    assertFormalParameterSetPathReference(reference, parameterSetId ?? "", version ?? "");
    const commandActor = createFormalParameterSetActor(context, actor);
    const command = runtime.formalParameterSets;
    let result: ParameterSetVersion | { approval_record: unknown; version: ParameterSetVersion };

    switch (action) {
      case "validate":
        result = await executeFormalParameterSetCommand(() =>
          command.validate(commandActor, reference)
        );
        break;
      case "freeze":
        result = await executeFormalParameterSetCommand(() =>
          command.freeze(commandActor, reference)
        );
        break;
      case "approve": {
        if (!isRecord(body)) {
          throw formalParameterSetRequestError();
        }
        const approvalId = parseFormalParameterSetString(body.approval_id);
        result = await executeFormalParameterSetCommand(() =>
          command.approve(commandActor, reference, approvalId)
        );
        break;
      }
      case "retire":
        result = await executeFormalParameterSetCommand(() =>
          command.retire(commandActor, reference)
        );
        break;
      default:
        throw new HttpError(404, "ROUTE-404-001", "not found");
    }

    const versionResult = "version" in result ? result.version : result;
    await appendAudit(runtime, {
      actor,
      action: `parameter_set.${action}`,
      resourceType: "formal_parameter_set",
      resourceId: formalParameterSetResourceId(reference),
      requestId: context.requestId,
      tenantId: context.tenantId,
      after: clonePublic(versionResult)
    });
    sendJson(response, 200, createEnvelope(context, result));
    return;
  }

  if (
    request.method === "POST" &&
    url.pathname === "/api/v1/formal-authority/scenario-packages/compile-draft"
  ) {
    const actor = requirePermission(context, "scenario_package:manage");
    const input = parseGenericScenarioCompileDraft(await readJson(request), context.tenantId);
    const result = await executeFormalScenarioPackageCommand(() =>
      compileGenericScenarioToDraft(
        runtime.formalScenarioPackages,
        createFormalScenarioPackageActor(context, actor),
        input
      )
    );

    if (result.draft === null) {
      sendJson(response, 422, createEnvelope(context, result));
      return;
    }

    await appendAudit(runtime, {
      actor,
      action: "scenario_package.compile_draft",
      resourceType: "formal_scenario_package",
      resourceId: formalScenarioPackageResourceId(result.draft.reference),
      requestId: context.requestId,
      tenantId: context.tenantId,
      after: clonePublic(result.draft)
    });
    sendJson(response, 201, createEnvelope(context, result));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/formal-authority/scenario-packages") {
    const actor = requirePermission(context, "scenario_package:manage");
    const draft = parseFormalScenarioPackageDraft(await readJson(request), context.tenantId);
    const created = await executeFormalScenarioPackageCommand(() =>
      runtime.formalScenarioPackages.createDraft(
        createFormalScenarioPackageActor(context, actor),
        draft
      )
    );
    await appendAudit(runtime, {
      actor,
      action: "scenario_package.create",
      resourceType: "formal_scenario_package",
      resourceId: formalScenarioPackageResourceId(created.reference),
      requestId: context.requestId,
      tenantId: context.tenantId,
      after: clonePublic(created)
    });
    sendJson(response, 201, createEnvelope(context, created));
    return;
  }

  if (
    request.method === "POST" &&
    /^\/api\/v1\/formal-authority\/scenario-packages\/[^/]+\/versions\/[^/]+\/(validate|freeze|approve|retire)$/.test(
      url.pathname
    )
  ) {
    const actor = requirePermission(context, "scenario_package:manage");
    const [, scenarioPackageId, version, action] = matchPath(
      url.pathname,
      /^\/api\/v1\/formal-authority\/scenario-packages\/([^/]+)\/versions\/([^/]+)\/(validate|freeze|approve|retire)$/
    );
    const body = await readJson(request);
    const reference = parseFormalScenarioPackageReference(body, context.tenantId);
    assertFormalScenarioPackagePathReference(reference, scenarioPackageId ?? "", version ?? "");
    const commandActor = createFormalScenarioPackageActor(context, actor);
    const command = runtime.formalScenarioPackages;
    let result:
      | ScenarioPackageVersion
      | { approval_record: unknown; version: ScenarioPackageVersion };

    switch (action) {
      case "validate":
        result = await executeFormalScenarioPackageCommand(() =>
          command.validate(commandActor, reference)
        );
        break;
      case "freeze":
        result = await executeFormalScenarioPackageCommand(() =>
          command.freeze(commandActor, reference)
        );
        break;
      case "approve": {
        if (!isRecord(body)) {
          throw formalScenarioPackageRequestError();
        }
        const approvalId = parseFormalScenarioPackageString(body.approval_id);
        result = await executeFormalScenarioPackageCommand(() =>
          command.approve(commandActor, reference, approvalId)
        );
        break;
      }
      case "retire":
        result = await executeFormalScenarioPackageCommand(() =>
          command.retire(commandActor, reference)
        );
        break;
      default:
        throw new HttpError(404, "ROUTE-404-001", "not found");
    }

    const versionResult = "version" in result ? result.version : result;
    await appendAudit(runtime, {
      actor,
      action: `scenario_package.${action}`,
      resourceType: "formal_scenario_package",
      resourceId: formalScenarioPackageResourceId(reference),
      requestId: context.requestId,
      tenantId: context.tenantId,
      after: clonePublic(versionResult)
    });
    sendJson(response, 200, createEnvelope(context, result));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/formal-authority/plugin-releases") {
    const actor = requirePermission(context, "plugin_release:manage");
    const draft = parseFormalPluginReleaseDraft(await readJson(request));
    const created = await executeFormalPluginReleaseCommand(() =>
      runtime.formalPluginReleases.createDraft(
        createFormalPluginReleaseActor(context, actor),
        draft
      )
    );
    await appendAudit(runtime, {
      actor,
      action: "plugin_release.create",
      resourceType: "formal_plugin_release",
      resourceId: `${created.reference.plugin_package_id}@${created.reference.version}:${created.reference.content_digest}`,
      requestId: context.requestId,
      tenantId: context.tenantId,
      after: clonePublic(created)
    });
    sendJson(response, 201, createEnvelope(context, created));
    return;
  }

  if (
    request.method === "POST" &&
    /^\/api\/v1\/formal-authority\/plugin-releases\/[^/]+\/versions\/[^/]+\/(validate|approve|make-available|retire)$/.test(
      url.pathname
    )
  ) {
    const [, pluginPackageId, version, action] = matchPath(
      url.pathname,
      /^\/api\/v1\/formal-authority\/plugin-releases\/([^/]+)\/versions\/([^/]+)\/(validate|approve|make-available|retire)$/
    );
    const body = await readJson(request);
    const reference = parseFormalPluginReleaseReference(body);
    assertFormalPluginReleasePathReference(reference, pluginPackageId ?? "", version ?? "");
    const lifecycleAction = action ?? "";
    const actor = requirePermission(
      context,
      lifecycleAction === "approve"
        ? "plugin_release:approve"
        : lifecycleAction === "make-available"
          ? "plugin_release:make_available"
          : "plugin_release:manage"
    );
    const command = runtime.formalPluginReleases;
    const commandActor = createFormalPluginReleaseActor(context, actor);
    let result: PluginReleaseVersion | { version: PluginReleaseVersion };
    if (lifecycleAction === "validate")
      result = await executeFormalPluginReleaseCommand(() =>
        command.validate(commandActor, reference)
      );
    else if (lifecycleAction === "approve")
      result = await executeFormalPluginReleaseCommand(() =>
        command.approve(
          commandActor,
          reference,
          parseFormalPluginReleaseString(isRecord(body) ? body.owner_decision_id : undefined)
        )
      );
    else if (lifecycleAction === "make-available")
      result = await executeFormalPluginReleaseCommand(() =>
        command.makeAvailable(
          commandActor,
          reference,
          parseFormalPluginReleaseString(isRecord(body) ? body.availability_decision_id : undefined)
        )
      );
    else
      result = await executeFormalPluginReleaseCommand(() =>
        command.retire(commandActor, reference)
      );
    const versionResult = "version" in result ? result.version : result;
    await appendAudit(runtime, {
      actor,
      action: `plugin_release.${lifecycleAction.replace("-", "_")}`,
      resourceType: "formal_plugin_release",
      resourceId: `${reference.plugin_package_id}@${reference.version}:${reference.content_digest}`,
      requestId: context.requestId,
      tenantId: context.tenantId,
      after: clonePublic(versionResult)
    });
    sendJson(response, 200, createEnvelope(context, result));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/auth/logout") {
    const actor = requireActor(context);
    const tokenHash = context.token ? hashToken(context.token) : undefined;
    const session = tokenHash
      ? store.sessions.find((candidate) => candidate.token_hash === tokenHash)
      : undefined;

    if (session) {
      session.revoked_at = new Date().toISOString();
    }

    await appendAudit(runtime, {
      actor,
      action: "auth.logout",
      resourceType: "session",
      resourceId: session?.session_id ?? "unknown",
      requestId: context.requestId
    });
    sendJson(response, 200, createEnvelope(context, { revoked: Boolean(session) }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/auth/me") {
    sendJson(response, 200, createEnvelope(context, requireActor(context)));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/admin/state") {
    sendJson(response, 200, createEnvelope(context, await createAdminState(runtime, context)));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/admin/tenants") {
    const actor = requirePermission(context, "tenant:read");
    const tenants = actorHasAnyRole(actor, ["platform_admin"])
      ? store.tenants
      : store.tenants.filter((tenant) => tenant.tenant_id === context.tenantId);
    sendJson(response, 200, createEnvelope(context, tenants));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/admin/tenants") {
    const actor = requirePermission(context, "tenant:create");
    const body = await readJson<{ name?: string; domain?: string }>(request);
    assertNoTruthProtectedFields(body);

    const name = body.name?.trim();
    const domain = body.domain?.trim().toLowerCase();
    if (!name || !domain) {
      throw new HttpError(422, "TENANT-422-001", "name and domain are required");
    }

    if (store.tenants.some((tenant) => tenant.domain === domain)) {
      throw new HttpError(409, "TENANT-409-001", "tenant domain already exists");
    }

    const now = new Date().toISOString();
    const tenant: Tenant = {
      tenant_id: nextId(store, "tenant", "tenant"),
      name,
      domain,
      status: "active",
      created_at: now,
      updated_at: now
    };
    store.tenants.push(tenant);
    await appendAudit(runtime, {
      actor,
      action: "tenant.create",
      resourceType: "tenant",
      resourceId: tenant.tenant_id,
      requestId: context.requestId,
      tenantId: tenant.tenant_id,
      after: clonePublic(tenant)
    });
    sendJson(response, 201, createEnvelope(context, tenant));
    return;
  }

  if (request.method === "GET" && /^\/api\/v1\/admin\/tenants\/[^/]+$/.test(url.pathname)) {
    const actor = requirePermission(context, "tenant:read");
    const [, tenantId] = matchPath(url.pathname, /^\/api\/v1\/admin\/tenants\/([^/]+)$/);
    const tenant = store.tenants.find((candidate) => candidate.tenant_id === tenantId);

    if (
      !tenant ||
      (!actorHasAnyRole(actor, ["platform_admin"]) && tenant.tenant_id !== context.tenantId)
    ) {
      throw new HttpError(404, "TENANT-404-001", "tenant not found");
    }

    sendJson(response, 200, createEnvelope(context, tenant));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/admin/users") {
    const actor = requirePermission(context, "user:read");
    const users = actorHasAnyRole(actor, ["platform_admin"])
      ? store.users.map(sanitizeUser)
      : store.users.filter((user) => user.tenant_id === context.tenantId).map(sanitizeUser);
    sendJson(response, 200, createEnvelope(context, users));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/admin/users") {
    const actor = requirePermission(context, "user:create");
    const body = await readJson<{
      tenant_id?: string;
      username?: string;
      email?: string;
      password?: string;
      display_name?: string;
      roles?: ActorRole[];
    }>(request);
    assertNoTruthProtectedFields(body);

    const tenant = requireManagedTenant(store, actor, context, body.tenant_id);
    const username = body.username?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const displayName = body.display_name?.trim() || username;

    if (!username || !email || !displayName || !password?.trim()) {
      throw new HttpError(
        422,
        "USER-422-001",
        "username, email, display_name and password are required"
      );
    }

    if (
      store.users.some(
        (user) =>
          user.tenant_id === tenant.tenant_id &&
          (user.username === username || user.email === email)
      )
    ) {
      throw new HttpError(409, "USER-409-001", "username or email already exists in tenant");
    }

    const now = new Date().toISOString();
    const roles = normalizeRoles(actor, body.roles);
    const user: StoredUser = {
      user_id: nextId(store, "user", "usr"),
      tenant_id: tenant.tenant_id,
      username,
      email,
      password_hash: hashPassword(password),
      display_name: displayName,
      roles,
      status: "active",
      created_at: now,
      updated_at: now
    };
    store.users.push(user);
    setUserRoles(store, user, roles);
    const publicUser = sanitizeUser(user);
    await appendAudit(runtime, {
      actor,
      action: "user.create",
      resourceType: "user",
      resourceId: user.user_id,
      requestId: context.requestId,
      tenantId: user.tenant_id,
      after: clonePublic(publicUser)
    });
    sendJson(response, 201, createEnvelope(context, publicUser));
    return;
  }

  if (request.method === "PATCH" && /^\/api\/v1\/admin\/users\/[^/]+$/.test(url.pathname)) {
    const actor = requirePermission(context, "user:update");
    const [, userId] = matchPath(url.pathname, /^\/api\/v1\/admin\/users\/([^/]+)$/);
    const user = store.users.find((candidate) => candidate.user_id === userId);

    if (
      !user ||
      (!actorHasAnyRole(actor, ["platform_admin"]) && user.tenant_id !== context.tenantId)
    ) {
      throw new HttpError(404, "USER-404-001", "user not found");
    }

    const body = await readJson<{
      display_name?: string;
      email?: string;
      status?: User["status"];
      roles?: ActorRole[];
      tenant_id?: string;
      password?: string;
    }>(request);
    assertNoTruthProtectedFields(body);

    if (body.tenant_id && body.tenant_id !== user.tenant_id) {
      throw new HttpError(403, "USER-403-001", "user tenant cannot be changed through patch");
    }

    const before = sanitizeUser(user);
    if (body.display_name) {
      user.display_name = body.display_name.trim();
    }

    if (body.email) {
      user.email = body.email.trim().toLowerCase();
    }

    if (body.status) {
      user.status = body.status;
    }

    if (body.password) {
      user.password_hash = hashPassword(body.password);
    }

    if (body.roles) {
      setUserRoles(store, user, normalizeRoles(actor, body.roles));
    }

    user.updated_at = new Date().toISOString();
    const after = sanitizeUser(user);
    await appendAudit(runtime, {
      actor,
      action: "user.update",
      resourceType: "user",
      resourceId: user.user_id,
      requestId: context.requestId,
      tenantId: user.tenant_id,
      before: clonePublic(before),
      after: clonePublic(after)
    });
    sendJson(response, 200, createEnvelope(context, after));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/rbac/roles") {
    requirePermission(context, "rbac:read");
    sendJson(response, 200, createEnvelope(context, store.roles));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/rbac/permissions") {
    requirePermission(context, "rbac:read");
    sendJson(response, 200, createEnvelope(context, store.permissions));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/demo-state") {
    const actor = requireActor(context);
    const tenantRuns = store.runs.filter((run) => run.tenant_id === context.tenantId);
    const tenantTeams = store.teams.filter((team) => team.tenant_id === context.tenantId);
    const visibleTeams = canReadClassroomScope(actor)
      ? tenantTeams
      : tenantTeams.filter((team) => isActorMemberOfTeam(actor, team));
    const visibleTeamIds = canReadClassroomScope(actor)
      ? undefined
      : new Set(visibleTeams.map((team) => team.team_id));
    const visibleCourseIds = visibleTeamIds
      ? new Set(visibleTeams.map((team) => team.course_id))
      : undefined;
    const tenantCourses = store.courses.filter((course) => course.tenant_id === context.tenantId);
    const visibleCourses = tenantCourses.filter(
      (course) => !visibleCourseIds || visibleCourseIds.has(course.course_id)
    );
    const visibleRuns = tenantRuns.filter(
      (run) => !visibleCourseIds || visibleCourseIds.has(run.course_id)
    );
    const visibleRunIds = new Set(visibleRuns.map((run) => run.run_id));
    const visibleRounds = store.rounds.filter(
      (round) => round.tenant_id === context.tenantId && visibleRunIds.has(round.run_id)
    );
    const latestRun = visibleRuns.at(-1);
    const latestRound = latestRun
      ? store.rounds.find(
          (round) => round.run_id === latestRun.run_id && round.tenant_id === context.tenantId
        )
      : undefined;
    const latestResult =
      latestRun && latestRound
        ? await createPublicResultView(runtime, context, latestRun.run_id, latestRound.round_no)
        : undefined;
    const canReadAdmin = actorHasPermission(actor, "user:read");

    sendJson(
      response,
      200,
      createEnvelope(context, {
        current_user: actor,
        ...(canReadAdmin
          ? { tenants: store.tenants.filter((tenant) => tenant.tenant_id === context.tenantId) }
          : {}),
        ...(canReadAdmin
          ? {
              users: store.users
                .filter((user) => user.tenant_id === context.tenantId)
                .map(sanitizeUser)
            }
          : {}),
        ...(canReadAdmin ? { roles: store.roles, permissions: store.permissions } : {}),
        courses: visibleCourses,
        teams: visibleTeams,
        runs: visibleRuns,
        rounds: canReadClassroomScope(actor)
          ? visibleRounds
          : visibleRounds.map(({ replay_hash: _replayHash, ...round }) => round),
        decisions: store.decisions.filter(
          (decision) =>
            decision.tenant_id === context.tenantId &&
            (!visibleTeamIds || visibleTeamIds.has(decision.team_id))
        ),
        ...(latestResult ? { latest_result: latestResult } : {}),
        audit_logs: actorHasPermission(actor, "audit:read")
          ? (
              await filterAuditLogs(
                runtime,
                context,
                new URL("/api/v1/audit/logs", "http://localhost")
              )
            ).slice(-20)
          : []
      })
    );
    return;
  }

  if (
    request.method === "GET" &&
    /^\/api\/v1\/bff\/teacher\/runs\/[^/]+\/rounds\/\d+\/workspace$/.test(url.pathname)
  ) {
    const actor = requirePermission(context, "result:read");
    if (!actorHasAnyRole(actor, ["teacher"])) {
      throw new HttpError(403, "AUTHZ-403-001", "teacher BFF requires teacher authority");
    }

    const [, runId, roundNoRaw] = matchPath(
      url.pathname,
      /^\/api\/v1\/bff\/teacher\/runs\/([^/]+)\/rounds\/(\d+)\/workspace$/
    );
    const run = await getRunForRead(runtime, context, runId ?? "");
    const course = await getCourseForActorRead(runtime, context, run.course_id);
    const round = await getRoundForRead(runtime, context, run.run_id, Number(roundNoRaw));
    const teams = store.teams.filter(
      (team) => team.tenant_id === context.tenantId && team.course_id === course.course_id
    );
    const decisions = store.decisions.filter(
      (decision) =>
        decision.tenant_id === context.tenantId &&
        decision.run_id === run.run_id &&
        decision.round_no === round.round_no
    );
    const resultView = await createPublicResultView(runtime, context, run.run_id, round.round_no);
    const scenario = store.scenarios.find(
      (candidate) =>
        candidate.tenant_id === context.tenantId &&
        candidate.scenario_package_id === course.scenario_package_id
    );
    const parameterSet = store.parameterSets.find(
      (candidate) =>
        candidate.tenant_id === context.tenantId &&
        candidate.parameter_set_id === course.parameter_set_id
    );

    sendJson(
      response,
      200,
      createEnvelope(
        context,
        createTeacherBffWorkspaceDto({
          actor,
          auditLogs: store.auditLogs.filter((log) => log.tenant_id === context.tenantId),
          course,
          decisions,
          resultView,
          round,
          run,
          ...(parameterSet ? { parameterSet } : {}),
          ...(scenario ? { scenario } : {}),
          teams
        })
      )
    );
    return;
  }

  if (
    request.method === "GET" &&
    /^\/api\/v1\/bff\/student\/runs\/[^/]+\/rounds\/\d+\/cockpit$/.test(url.pathname)
  ) {
    const actor = requirePermission(context, "result:read");
    if (canReadClassroomScope(actor) || !actor.team_id) {
      throw new HttpError(403, "AUTHZ-403-001", "student BFF requires learner team scope");
    }

    const [, runId, roundNoRaw] = matchPath(
      url.pathname,
      /^\/api\/v1\/bff\/student\/runs\/([^/]+)\/rounds\/(\d+)\/cockpit$/
    );
    const run = await getRunForRead(runtime, context, runId ?? "");
    const course = await getCourseForActorRead(runtime, context, run.course_id);
    const round = await getRoundForRead(runtime, context, run.run_id, Number(roundNoRaw));
    const team = store.teams.find(
      (candidate) =>
        candidate.tenant_id === context.tenantId &&
        candidate.course_id === course.course_id &&
        candidate.team_id === actor.team_id &&
        isActorMemberOfTeam(actor, candidate)
    );

    if (!team) {
      throw new HttpError(404, "TEAM-404-001", "team not found");
    }

    sendJson(
      response,
      200,
      createEnvelope(
        context,
        createStudentBffCockpitDto({
          actor,
          course,
          resultView: await createPublicResultView(runtime, context, run.run_id, round.round_no),
          round,
          run,
          team
        })
      )
    );
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/bff/admin/tenant-summary") {
    const actor = requirePermission(context, "tenant:read");
    if (!actorHasAnyRole(actor, ["tenant_admin"])) {
      throw new HttpError(
        403,
        "AUTHZ-403-001",
        "tenant summary BFF requires tenant admin authority"
      );
    }
    const tenant = store.tenants.find(
      (candidate) => candidate.tenant_id === context.tenantId && candidate.status === "active"
    );

    if (!tenant) {
      throw new HttpError(404, "TENANT-404-001", "tenant not found");
    }

    sendJson(
      response,
      200,
      createEnvelope(
        context,
        createTenantAdminSummaryDto({
          actor,
          auditLogs: store.auditLogs.filter((log) => log.tenant_id === tenant.tenant_id),
          courses: store.courses.filter((course) => course.tenant_id === tenant.tenant_id),
          runs: store.runs.filter((run) => run.tenant_id === tenant.tenant_id),
          teams: store.teams.filter((team) => team.tenant_id === tenant.tenant_id),
          tenant
        })
      )
    );
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/bff/admin/run-lifecycle-controls") {
    const actor = requirePermission(context, "run:lifecycle");
    if (!actorHasAnyRole(actor, ["tenant_admin"]) || actor.tenant_id !== context.tenantId) {
      throw new HttpError(
        403,
        "AUTHZ-403-001",
        "run lifecycle controls require tenant admin authority"
      );
    }

    sendJson(
      response,
      200,
      createEnvelope(
        context,
        await listSyntheticRunLifecycleControls({
          actor,
          environment: runtime.securityConfig.environment,
          provider: runtime.repositoryProvider,
          tenantId: actor.tenant_id
        })
      )
    );
    return;
  }

  if (
    request.method === "POST" &&
    /^\/api\/v1\/bff\/admin\/courses\/[^/]+\/runs\/[^/]+\/lifecycle\/(abort|reset|cleanup)$/.test(
      url.pathname
    )
  ) {
    const actor = requirePermission(context, "run:lifecycle");
    if (!actorHasAnyRole(actor, ["tenant_admin"]) || actor.tenant_id !== context.tenantId) {
      throw new HttpError(
        403,
        "AUTHZ-403-001",
        "run lifecycle controls require tenant admin authority"
      );
    }
    const [, courseId, runId, operationRaw] = matchPath(
      url.pathname,
      /^\/api\/v1\/bff\/admin\/courses\/([^/]+)\/runs\/([^/]+)\/lifecycle\/(abort|reset|cleanup)$/
    );
    const operation = operationRaw as SyntheticRunLifecycleOperation;
    const body = await readJson<{ confirmation?: string }>(request);
    if (body.confirmation !== `${operation.toUpperCase()} ${runId}`) {
      throw new HttpError(
        422,
        "LIFECYCLE-422-001",
        "exact lifecycle operation confirmation is required"
      );
    }

    const release = await acquireRunMutationLock(
      runtime,
      runMutationBusinessKey(actor.tenant_id, runId ?? "")
    );
    try {
      sendJson(
        response,
        200,
        createEnvelope(
          context,
          await executeSyntheticRunLifecycleOperation({
            actor,
            courseId: courseId ?? "",
            environment: runtime.securityConfig.environment,
            operation,
            provider: runtime.repositoryProvider,
            requestId: context.requestId,
            runId: runId ?? "",
            tenantId: actor.tenant_id
          })
        )
      );
    } finally {
      release();
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/bff/admin/platform-authority") {
    const actor = requirePermission(context, "tenant:read");
    if (!actorHasAnyRole(actor, ["platform_admin"])) {
      throw new HttpError(403, "AUTHZ-403-001", "platform BFF requires platform authority");
    }
    if (url.searchParams.get("scope") !== "platform") {
      throw new HttpError(
        422,
        "BFF-422-001",
        "platform authority BFF requires explicit scope=platform"
      );
    }

    sendJson(
      response,
      200,
      createEnvelope(
        context,
        createPlatformAdminAuthorityDto({
          actor,
          tenants: store.tenants
        })
      )
    );
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/courses") {
    const actor = requirePermission(context, "course:read");
    const courses = canReadClassroomScope(actor)
      ? await runtime.repositoryProvider.facade.courses.listCoursesForTenant(context.tenantId)
      : await runtime.repositoryProvider.facade.courses.listCoursesForUser(
          context.tenantId,
          actor.user_id
        );
    sendJson(response, 200, createEnvelope(context, courses));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/courses") {
    const actor = requirePermission(context, "course:create");
    const body = await readJson<CourseCreateBody>(request);
    assertNoTruthProtectedFields(body);
    const courseId = nextId(store, "course", "course");
    const formalRequest =
      body.formal_authority_binding === undefined
        ? null
        : parseFormalCourseAuthorityBindingBody(body.formal_authority_binding);
    let formalBinding: FormalCourseAuthorityBinding | null = null;
    let scenarioPackageId: string;
    let parameterSetId: string;

    if (formalRequest) {
      if (formalRequest.scenario_package_reference.tenant_id !== context.tenantId) {
        throw new HttpError(422, "COURSE-422-002", "formal course authority binding is invalid");
      }
      try {
        formalBinding = await createFormalCourseAuthorityBinding({
          authorities: runtime.formalRunBindingAuthorities,
          course_id: courseId,
          engine_reference: formalRequest.engine_reference,
          parameter_set_reference: formalRequest.parameter_set_reference,
          scenario_package_reference: formalRequest.scenario_package_reference,
          tenant_id: context.tenantId
        });
      } catch {
        throw new HttpError(422, "COURSE-422-002", "formal course authority binding is invalid");
      }
      scenarioPackageId = formalBinding.scenario_package_reference.scenario_package_id;
      parameterSetId = formalBinding.parameter_set_reference.parameter_set_id;
    } else {
      const scenario = store.scenarios.find(
        (candidate) => candidate.tenant_id === context.tenantId
      );
      const parameterSet = store.parameterSets.find(
        (candidate) => candidate.tenant_id === context.tenantId && candidate.status === "approved"
      );

      if (!scenario || !parameterSet) {
        throw new HttpError(
          422,
          "COURSE-422-001",
          "approved scenario and parameter set are required"
        );
      }
      scenarioPackageId = scenario.scenario_package_id;
      parameterSetId = parameterSet.parameter_set_id;
    }
    const course = {
      course_id: courseId,
      tenant_id: context.tenantId,
      title:
        typeof body.title === "string" && body.title.trim().length > 0
          ? body.title.trim()
          : "P1 商战课程",
      status: "draft" as const,
      scenario_package_id: scenarioPackageId,
      parameter_set_id: parameterSetId,
      created_by: actor.user_id
    };
    await runtime.repositoryProvider.facade.courses.saveCourse(course);
    if (formalBinding) {
      runtime.formalCourseAuthorityBindingStore.append(formalBinding);
    }
    await appendAudit(runtime, {
      actor,
      action: "course.create",
      resourceType: "course",
      resourceId: course.course_id,
      requestId: context.requestId,
      after: clonePublic({
        ...course,
        ...(formalBinding ? { formal_authority_binding: formalBinding } : {})
      })
    });
    sendJson(response, 201, createEnvelope(context, course));
    return;
  }

  if (request.method === "GET" && /^\/api\/v1\/courses\/[^/]+$/.test(url.pathname)) {
    requirePermission(context, "course:read");
    const [, courseId] = matchPath(url.pathname, /^\/api\/v1\/courses\/([^/]+)$/);
    const course = await getCourseForActorRead(runtime, context, courseId ?? "");
    sendJson(response, 200, createEnvelope(context, course));
    return;
  }

  if (request.method === "POST" && /^\/api\/v1\/courses\/[^/]+\/publish$/.test(url.pathname)) {
    const actor = requirePermission(context, "course:publish");
    const [, courseId] = matchPath(url.pathname, /^\/api\/v1\/courses\/([^/]+)\/publish$/);
    const course = await getCourseForRead(runtime, context, courseId ?? "");
    if (course.status === "published") {
      sendJson(response, 200, createEnvelope(context, course));
      return;
    }
    if (course.status !== "draft") {
      throw new HttpError(409, "COURSE-409-001", "course must be draft before publish");
    }
    const before = clonePublic(course);
    course.status = "published";
    await runtime.repositoryProvider.facade.courses.saveCourse(course);
    await appendAudit(runtime, {
      actor,
      action: "course.publish",
      resourceType: "course",
      resourceId: course.course_id,
      requestId: context.requestId,
      before,
      after: clonePublic(course)
    });
    sendJson(response, 200, createEnvelope(context, course));
    return;
  }

  if (request.method === "POST" && /^\/api\/v1\/courses\/[^/]+\/teams$/.test(url.pathname)) {
    const actor = requirePermission(context, "team:create");
    const [, courseId] = matchPath(url.pathname, /^\/api\/v1\/courses\/([^/]+)\/teams$/);
    const course = await getCourseForRead(runtime, context, courseId ?? "");
    const body = await readJson<{ name?: string; captain_user_id?: string }>(request);
    assertNoTruthProtectedFields(body);
    const captain = store.users.find(
      (user) =>
        user.user_id === (body.captain_user_id ?? "usr_student") &&
        user.tenant_id === context.tenantId
    );

    if (!captain) {
      throw new HttpError(422, "TEAM-422-001", "captain user not found");
    }

    const team = {
      team_id: nextId(store, "team", "team"),
      tenant_id: context.tenantId,
      course_id: course.course_id,
      name: body.name?.trim() || `Team ${store.counters.team}`,
      captain_user_id: captain.user_id,
      members: [
        {
          user_id: captain.user_id,
          display_name: captain.display_name,
          role_slot: "CEO" as const
        }
      ]
    };
    await runtime.repositoryProvider.facade.teams.createTeamWithCaptain(team);
    await appendAudit(runtime, {
      actor,
      action: "team.create",
      resourceType: "team",
      resourceId: team.team_id,
      requestId: context.requestId,
      after: clonePublic(team)
    });
    sendJson(response, 201, createEnvelope(context, team));
    return;
  }

  if (request.method === "POST" && /^\/api\/v1\/courses\/[^/]+\/runs$/.test(url.pathname)) {
    const actor = requirePermission(context, "run:create");
    const [, courseId] = matchPath(url.pathname, /^\/api\/v1\/courses\/([^/]+)\/runs$/);
    const course = await getCourseForRead(runtime, context, courseId ?? "");
    const body = await readJson<RunCreateBody>(request);

    if (course.status !== "published" && course.status !== "active") {
      throw new HttpError(409, "RUN-409-001", "course must be published before creating run");
    }

    const courseBinding = runtime.formalCourseAuthorityBindingStore.getForCourse(
      context.tenantId,
      course.course_id
    );
    const formalRequest = courseBinding
      ? body.formal_runtime_binding !== undefined || body.formal_runtime_seed === undefined
        ? null
        : {
            engine_reference: courseBinding.engine_reference,
            parameter_set_reference: courseBinding.parameter_set_reference,
            scenario_package_reference: courseBinding.scenario_package_reference,
            seed: requireBodySeed(body.formal_runtime_seed)
          }
      : body.formal_runtime_binding === undefined
        ? null
        : parseFormalRunCreateBody(body.formal_runtime_binding);
    let formalBindingPersisted = false;
    let run: Run;
    let round: Round;

    if (
      courseBinding &&
      (body.formal_runtime_binding !== undefined || body.formal_runtime_seed === undefined)
    ) {
      throw new HttpError(
        422,
        "RUN-422-002",
        "formal Course binding requires an explicit runtime seed without override references"
      );
    }
    if (!courseBinding && body.formal_runtime_seed !== undefined) {
      throw new HttpError(422, "RUN-422-002", "formal runtime binding is invalid");
    }

    if (formalRequest) {
      if (!runtime.formalRunBindingAuthorities) {
        throw new HttpError(409, "RUN-409-002", "formal runtime binding authority is unavailable");
      }
      if (
        formalRequest.parameter_set_reference.parameter_set_id !== course.parameter_set_id ||
        formalRequest.scenario_package_reference.scenario_package_id !==
          course.scenario_package_id ||
        formalRequest.scenario_package_reference.tenant_id !== context.tenantId
      ) {
        throw new HttpError(422, "RUN-422-002", "formal runtime binding does not match course");
      }

      run = {
        course_id: course.course_id,
        parameter_set_id: course.parameter_set_id,
        run_id: nextId(store, "run", "run"),
        scenario_package_id: course.scenario_package_id,
        seed: formalRequest.seed,
        status: "active",
        tenant_id: context.tenantId
      };
      try {
        round = {
          round_id: nextId(store, "round", "round"),
          round_no: 1,
          run_id: run.run_id,
          status: "draft",
          tenant_id: context.tenantId
        };
        const inheritedBinding = courseBinding ?? {
          engine_reference: formalRequest.engine_reference,
          parameter_set_reference: formalRequest.parameter_set_reference,
          scenario_package_reference: formalRequest.scenario_package_reference
        };
        await createFormalBoundRun({
          authorities: runtime.formalRunBindingAuthorities,
          bindingStore: runtime.formalRunRuntimeBindingStore,
          courseBinding: inheritedBinding,
          persistence: {
            deleteRound: runtime.repositoryProvider.facade.rounds.deleteRound,
            deleteRun: runtime.repositoryProvider.facade.runs.deleteRun,
            saveRound: runtime.repositoryProvider.facade.rounds.saveRound,
            saveRun: runtime.repositoryProvider.facade.runs.saveRun
          },
          round,
          run
        });
        formalBindingPersisted = true;
      } catch {
        throw new HttpError(422, "RUN-422-002", "formal runtime binding is invalid");
      }
    } else {
      const parameterSet = store.parameterSets.find(
        (candidate) =>
          candidate.parameter_set_id === course.parameter_set_id &&
          candidate.tenant_id === context.tenantId
      );
      if (!parameterSet || parameterSet.status !== "approved") {
        throw new HttpError(422, "RUN-422-001", "approved parameter set is required");
      }

      run = {
        run_id: nextId(store, "run", "run"),
        tenant_id: context.tenantId,
        course_id: course.course_id,
        scenario_package_id: course.scenario_package_id,
        parameter_set_id: course.parameter_set_id,
        seed: parameterSet.seed,
        status: "active" as const
      };
      round = {
        round_id: nextId(store, "round", "round"),
        tenant_id: context.tenantId,
        run_id: run.run_id,
        round_no: 1,
        status: "draft" as const
      };
    }
    if (!formalBindingPersisted) {
      store.runs.push(run);
      store.rounds.push(round);
    }
    await appendAudit(runtime, {
      actor,
      action: "run.create",
      resourceType: "run",
      resourceId: run.run_id,
      requestId: context.requestId,
      after: clonePublic({
        ...run,
        ...createSyntheticRunCreationAuditMarker(
          runtime.repositoryProvider.mode,
          runtime.securityConfig.environment
        )
      })
    });
    sendJson(response, 201, createEnvelope(context, { run, round }));
    return;
  }

  if (
    request.method === "POST" &&
    /^\/api\/v1\/runs\/[^/]+\/rounds\/\d+\/start$/.test(url.pathname)
  ) {
    const actor = requirePermission(context, "round:start");
    const [, runId, roundNoRaw] = matchPath(
      url.pathname,
      /^\/api\/v1\/runs\/([^/]+)\/rounds\/(\d+)\/start$/
    );
    const run = await getRunForRead(runtime, context, runId ?? "");
    const release = await acquireRunMutationLock(
      runtime,
      runMutationBusinessKey(context.tenantId, run.run_id)
    );
    try {
      await assertRunLifecycleAllowsProgress({
        provider: runtime.repositoryProvider,
        runId: run.run_id,
        tenantId: context.tenantId
      });
      const round = await getRoundForRead(runtime, context, run.run_id, Number(roundNoRaw));
      assertRoundStatus(round, "draft", "ROUND-409-001");
      const before = clonePublic(round);
      round.status = "open";
      await runtime.repositoryProvider.facade.rounds.saveRound(round);
      await appendAudit(runtime, {
        actor,
        action: "round.start",
        resourceType: "round",
        resourceId: round.round_id,
        requestId: context.requestId,
        before,
        after: clonePublic(round)
      });
      sendJson(response, 200, createEnvelope(context, round));
    } finally {
      release();
    }
    return;
  }

  if (
    request.method === "POST" &&
    /^\/api\/v1\/runs\/[^/]+\/rounds\/\d+\/decisions$/.test(url.pathname)
  ) {
    const [, runId, roundNoRaw] = matchPath(
      url.pathname,
      /^\/api\/v1\/runs\/([^/]+)\/rounds\/(\d+)\/decisions$/
    );
    const decision = await submitDecisionWithRunLock(
      runtime,
      context,
      request,
      runId ?? "",
      Number(roundNoRaw)
    );
    sendJson(response, 201, createEnvelope(context, decision));
    return;
  }

  if (
    request.method === "POST" &&
    /^\/api\/v1\/runs\/[^/]+\/rounds\/\d+\/lock$/.test(url.pathname)
  ) {
    const [, runId, roundNoRaw] = matchPath(
      url.pathname,
      /^\/api\/v1\/runs\/([^/]+)\/rounds\/(\d+)\/lock$/
    );
    const round = await lockRoundWithRunLock(runtime, context, runId ?? "", Number(roundNoRaw));
    sendJson(response, 200, createEnvelope(context, round));
    return;
  }

  if (
    request.method === "POST" &&
    /^\/api\/v1\/runs\/[^/]+\/rounds\/\d+\/settle$/.test(url.pathname)
  ) {
    const actor = requirePermission(context, "settlement:settle");
    const [, runId, roundNoRaw] = matchPath(
      url.pathname,
      /^\/api\/v1\/runs\/([^/]+)\/rounds\/(\d+)\/settle$/
    );
    const outcome = await runSettlement(runtime, context, runId ?? "", Number(roundNoRaw), {
      actor,
      action: "round.settle_requested"
    });

    response.setHeader("x-simwar-settlement-outcome", outcome.responseSemantics);
    sendJson(response, 200, createEnvelope(context, outcome.settlement));
    return;
  }

  if (
    request.method === "POST" &&
    /^\/internal\/v1\/runs\/[^/]+\/rounds\/\d+\/settle$/.test(url.pathname)
  ) {
    const serviceActor = requireServiceKernel(runtime, request, context);
    const [, runId, roundNoRaw] = matchPath(
      url.pathname,
      /^\/internal\/v1\/runs\/([^/]+)\/rounds\/(\d+)\/settle$/
    );
    const serviceContext: RequestContext = {
      requestId: context.requestId,
      tenantId: context.tenantId,
      actor: serviceActor
    };
    const outcome = await runSettlement(runtime, serviceContext, runId ?? "", Number(roundNoRaw), {
      actor: serviceActor,
      action: "round.settle"
    });

    response.setHeader("x-simwar-settlement-outcome", outcome.responseSemantics);
    sendJson(response, 200, createEnvelope(context, outcome.settlement));
    return;
  }

  if (
    request.method === "POST" &&
    /^\/api\/v1\/runs\/[^/]+\/rounds\/\d+\/publish$/.test(url.pathname)
  ) {
    const [, runId, roundNoRaw] = matchPath(
      url.pathname,
      /^\/api\/v1\/runs\/([^/]+)\/rounds\/(\d+)\/publish$/
    );
    const round = await publishRoundWithRunLock(runtime, context, runId ?? "", Number(roundNoRaw));
    sendJson(response, 200, createEnvelope(context, round));
    return;
  }

  if (
    request.method === "GET" &&
    /^\/api\/v1\/runs\/[^/]+\/rounds\/\d+\/results$/.test(url.pathname)
  ) {
    const [, runId, roundNoRaw] = matchPath(
      url.pathname,
      /^\/api\/v1\/runs\/([^/]+)\/rounds\/(\d+)\/results$/
    );
    sendJson(
      response,
      200,
      createEnvelope(
        context,
        await createPublicResultView(runtime, context, runId ?? "", Number(roundNoRaw))
      )
    );
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/audit/logs") {
    sendJson(response, 200, createEnvelope(context, await filterAuditLogs(runtime, context, url)));
    return;
  }

  throw new HttpError(404, "ROUTE-404-001", "not found");
}

async function runSettlement(
  runtime: ApiRuntime,
  context: RequestContext,
  runId: string,
  roundNo: number,
  audit: { actor: CurrentUser; action: string }
): Promise<RunSettlementOutcome> {
  const run = await runtime.repositoryProvider.facade.runs.getRun(context.tenantId, runId);

  if (!run) {
    throw new HttpError(404, "RUN-404-001", "run not found");
  }

  const lockKey = createSettlementBusinessKey({
    tenant_id: context.tenantId,
    run_id: run.run_id,
    round_no: roundNo
  });
  const releaseRunMutationLock = await acquireRunMutationLock(runtime, lockKey);

  try {
    await assertRunLifecycleAllowsProgress({
      provider: runtime.repositoryProvider,
      runId: run.run_id,
      tenantId: context.tenantId
    });
    const rounds = await runtime.repositoryProvider.facade.rounds.listRoundsForRun(
      context.tenantId,
      run.run_id
    );
    const round = rounds.find((candidate) => candidate.round_no === roundNo);

    if (!round) {
      throw new HttpError(404, "ROUND-404-001", "round not found");
    }

    if (round.status !== "locked" && round.status !== "settled" && round.status !== "published") {
      throw new HttpError(409, "ROUND-409-004", "round must be locked before settlement");
    }

    const [runtimeInputs, teams, roundDecisions] = await Promise.all([
      resolveRunRuntimeInputs(runtime, context.tenantId, run),
      runtime.repositoryProvider.facade.teams.listTeamsForRun(context.tenantId, run.run_id),
      runtime.repositoryProvider.facade.decisions.listDecisionsForRound(
        context.tenantId,
        run.run_id,
        round.round_id
      )
    ]);
    const latestDecisions = teams.map((team) => {
      const versions = roundDecisions.filter(
        (decision) => decision.round_no === round.round_no && decision.team_id === team.team_id
      );
      return versions.at(-1);
    });

    if (!runtimeInputs || latestDecisions.some((decision) => !decision)) {
      throw new HttpError(
        422,
        "SETTLE-422-001",
        "scenario, parameter set and team decisions are required"
      );
    }

    const existingSettlements =
      await runtime.repositoryProvider.facade.settlements.listSettlementResultsForRound(
        context.tenantId,
        run.run_id,
        round.round_id
      );
    const existingSettlement =
      existingSettlements.find(
        (settlement) =>
          settlement.tenant_id === context.tenantId &&
          settlement.run_id === run.run_id &&
          settlement.round_no === round.round_no
      ) ?? null;
    const outcome = prepareSettlementOutcome(
      {
        run,
        round,
        scenario: runtimeInputs.scenario,
        parameterSet: runtimeInputs.parameterSet,
        teams,
        decisions: latestDecisions.filter((decision): decision is NonNullable<typeof decision> =>
          Boolean(decision)
        )
      },
      {
        createSettlementResultId: () =>
          runtime.repositoryProvider.idGenerator.createSettlementResultId(),
        existingSettlement
      }
    );

    if (outcome.replayHashConflict) {
      throw new HttpError(
        409,
        "SETTLE-409-002",
        "settlement result already exists for this business key with different replay-relevant input",
        [{ field: "replay_hash", reason: "conflicting_existing_settlement" }]
      );
    }

    if (outcome.shouldCommit) {
      const successAudit = createAuditLog(runtime, {
        actor: audit.actor,
        action: audit.action,
        resourceType: "settlement_result",
        resourceId: outcome.settlement.settlement_result_id,
        requestId: context.requestId,
        tenantId: context.tenantId,
        after: clonePublic({ replay_hash: outcome.settlement.replay_hash })
      });
      const commit = await runtime.repositoryProvider.facade.commitSettlementOutcome({
        tenant_id: context.tenantId,
        round_id: round.round_id,
        settlement_result: outcome.settlement,
        success_audit: successAudit
      });

      if (commit.status === "conflict") {
        throw new HttpError(
          409,
          "SETTLE-409-002",
          "settlement result already exists for this business key with different replay-relevant input",
          [{ field: "replay_hash", reason: "conflicting_existing_settlement" }]
        );
      }

      return {
        settlement: commit.settlement_result,
        committed: commit.status === "committed",
        responseSemantics: commit.status
      };
    }

    return {
      settlement: outcome.settlement,
      committed: outcome.shouldCommit,
      responseSemantics: outcome.shouldCommit ? "committed" : "reused"
    };
  } finally {
    releaseRunMutationLock();
  }
}

export function createApiServer(
  store: SimWarStore = defaultStore,
  options: CreateApiServerOptions = {}
) {
  const runtime = createApiRuntime(store, options);

  return createServer((request, response) => {
    routeRequest(runtime, request, response).catch((error: unknown) => {
      const fallbackContext: RequestContext = {
        requestId: request.headers["x-request-id"]?.toString() ?? `req_${Date.now()}`,
        tenantId: request.headers["x-tenant-id"]?.toString() ?? DEFAULT_TENANT_ID
      };

      if (error instanceof SyntheticRunLifecycleError) {
        sendError(
          response,
          fallbackContext,
          new HttpError(error.statusCode, error.code, error.message)
        );
        return;
      }

      if (error instanceof HttpError) {
        sendError(response, fallbackContext, error);
        return;
      }

      if (error instanceof SyntaxError) {
        sendError(response, fallbackContext, new HttpError(400, "JSON-400-001", "invalid json"));
        return;
      }

      sendError(
        response,
        fallbackContext,
        new HttpError(500, "API-500-001", "internal server error")
      );
    });
  });
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const port = Number.parseInt(process.env.API_PORT ?? "", 10) || DEFAULT_PORT;
  const host = resolveApiHost();
  const server = createApiServer();

  server.listen(host ? { host, port } : { port }, () => {
    console.log(`SimWar API listening on http://${host ?? "system-default"}:${port}`);
    console.log(`SimWar API store: ${defaultStore.persistenceFile ?? "memory"}`);
    console.log(`Platform admin: tenant=${PLATFORM_TENANT_ID} username=platform`);
  });
}
