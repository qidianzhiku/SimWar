import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  getKnownLimitsProjection,
  M1_TEACHING_OFFICIAL_RESULT_LABEL,
  M1_TEACHING_PRODUCT_PACKAGE
} from "@simwar/shared-contracts";
import { StatePanel } from "@simwar/ui";
import type {
  ApiEnvelope,
  AuthSession,
  CoursePackageVersionCloneInput,
  CoursePackageVersionTeacherDto,
  P0DemoState,
  R7TeacherScenarioPackageCandidateDto,
  R7TeacherScenarioPackageCandidatesDto,
  Round,
  RoundContinuationResult,
  Run,
  SettlementResult,
  TeacherBffWorkspaceDTO,
  TeacherCourseBlueprintCatalogDto,
  TeacherCourseBlueprintReadinessDto,
  TeacherFormalCourseBindingPreviewDto,
  TeacherFormalScenarioPackageCatalogCandidateDto,
  TeacherFormalScenarioPackageCatalogDto,
  W3OfficialConsequenceContext
} from "@simwar/shared-contracts";
import {
  ScenarioReadinessRequestError,
  getScenarioCandidatesErrorMessage,
  getScenarioReadinessErrorMessage,
  getTeacherFormalCourseBindingErrorMessage,
  getTeacherFormalScenarioPackageCatalogErrorMessage,
  requestTeacherFormalCourseBindingPreview,
  requestTeacherCourseBlueprintCatalog,
  requestTeacherCourseBlueprintCourseCreate,
  requestTeacherCourseBlueprintReadiness,
  requestTeacherCourseBlueprintStudioDraftCreate,
  requestTeacherCourseBlueprintStudioPreview,
  requestTeacherCourseBlueprintStudioSubmission,
  requestScenarioPackageCandidates,
  requestScenarioReadiness,
  requestTeacherFormalScenarioPackageCatalog,
  validateScenarioReadinessInput,
  type TeacherCourseBlueprintStudioEditableContent,
  type TeacherCourseBlueprintStudioPreview,
  type ScenarioReadinessResponse
} from "./scenario-readiness";
import { RoleWorkflowPanel } from "./RoleWorkflowPanel";
import { W027DecisionExperiencePanel } from "./W027DecisionExperiencePanel";
import { InstructorIntelligencePanel } from "./InstructorIntelligencePanel";
import {
  cloneTeacherCoursePackageVersion as requestTeacherCoursePackageClone,
  getTeacherCoursePackageSurfaceState,
  loadTeacherCoursePackageVersions,
  type TeacherCoursePackageSurfaceState
} from "./course-package-client";
import { CourseReportBuilder } from "./CourseReportBuilder";
import { EvidenceWorkbench } from "./EvidenceWorkbench";
import { LearningDesignWorkbench } from "./LearningDesignWorkbench";
import { TeacherConfirmationWorkbench } from "./TeacherConfirmationWorkbench";
import { D5ExportWorkbench } from "./D5ExportWorkbench";
import { TransferResearchWorkbench } from "./features/transfer-research-workbench";
import { GoldenJourneyWorkbench } from "./features/GoldenJourneyWorkbench";
import { TeachingClosureWorkspace } from "./TeachingClosureWorkspace";
import { TeacherDebriefAdvisor } from "./TeacherDebriefAdvisor";
import { W3OfficialConsequenceLearningWorkbench } from "./W3OfficialConsequenceLearningWorkbench";
import { W4EnterpriseStateWorkbench } from "./W4EnterpriseStateWorkbench";
import { FreshLearnerAdmissionPanel } from "./FreshLearnerAdmissionPanel";
import { ValidationSessionWorkbench } from "./ValidationSessionWorkbench";
import { W5GovernedModelStudio } from "./W5GovernedModelStudio";
import {
  getTeacherNoticeLabel,
  getTeacherRoundAction,
  getTeacherWorkspaceState,
  isTeacherRoundActionAllowed,
  TEACHER_WORKSPACE_ERROR_REASON,
  TEACHER_WORKSPACE_LOADING_REASON,
  TeacherCourseWorkspace,
  TeacherLocation,
  TeacherNextStepButton,
  TeacherPermissionDenied,
  type TeacherWorkspaceLoadState
} from "./TeacherCourseWorkspace";
import {
  getTeacherRoundCommandPath,
  getTeacherRoundStatusLabel,
  getTeacherRunRounds,
  isTeacherRoundWorkspaceForContext,
  selectTeacherRound
} from "./round-context";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const W3_ENABLED =
  import.meta.env.VITE_SIMWAR_W3_ENABLED === "true" ||
  (typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("w3") === "true");

function readW3QueryContext(): W3OfficialConsequenceContext | undefined {
  if (typeof window === "undefined") return undefined;
  const params = new URLSearchParams(window.location.search);
  if (params.get("w3") !== "true") return undefined;
  const activityId = params.get("activity_id");
  const courseId = params.get("course_id");
  const roleKey = params.get("role_key");
  const roundId = params.get("round_id");
  const roundNo = Number(params.get("round_no"));
  const runId = params.get("run_id");
  const teamId = params.get("team_id");
  const tenantId = params.get("tenant_id");
  if (
    !activityId ||
    !courseId ||
    !roleKey ||
    !roundId ||
    !Number.isSafeInteger(roundNo) ||
    !runId ||
    !teamId ||
    !tenantId
  ) {
    return undefined;
  }
  return {
    activity_id: activityId,
    course_id: courseId,
    role_key: roleKey,
    round_id: roundId,
    round_no: roundNo,
    run_id: runId,
    team_id: teamId,
    tenant_id: tenantId
  };
}
const knownLimits = getKnownLimitsProjection("teacher");
type LoginForm = {
  tenantId: string;
  username: string;
  password: string;
};

type ScenarioReadinessForm = {
  parameterSetId: string;
  scenarioPackageId: string;
};

type ScenarioReadinessState =
  | { phase: "IDLE" }
  | { phase: "LOADING" }
  | { phase: "INVALID_REQUEST"; message: string; compatibilityMessage?: string }
  | {
      phase: "UNAUTHENTICATED" | "UNAUTHORIZED" | "NOT_FOUND_OR_OUT_OF_SCOPE" | "INTERNAL_ERROR";
      message: string;
      compatibilityMessage?: string;
    }
  | { phase: "READY" | "BLOCKED"; response: ScenarioReadinessResponse };

type ScenarioCandidatesState =
  | { phase: "IDLE" | "LOADING" }
  | { phase: "ERROR"; message: string; compatibilityMessage?: string }
  | { phase: "READY"; response: R7TeacherScenarioPackageCandidatesDto };

type FormalScenarioCatalogState =
  | { phase: "IDLE" | "LOADING" }
  | { phase: "ERROR"; message: string; compatibilityMessage?: string }
  | { phase: "READY"; response: TeacherFormalScenarioPackageCatalogDto };

type CourseBlueprintCatalogState =
  | { phase: "IDLE" | "LOADING" }
  | { phase: "ERROR"; message: string; compatibilityMessage?: string }
  | { phase: "READY"; response: TeacherCourseBlueprintCatalogDto };

type TeacherCoursePackageListState =
  | { phase: "IDLE" | "LOADING" }
  | { packages: readonly CoursePackageVersionTeacherDto[]; phase: "READY" }
  | {
      message: string;
      phase: "ERROR";
      surfaceState: TeacherCoursePackageSurfaceState;
    };

type TeacherCoursePackageCloneForm = {
  coursePackageId: string;
  description: string;
  title: string;
  version: string;
};

type CourseBlueprintStudioStatus = "IDLE" | "LOADING" | "EDITING" | "DRAFT" | "VALIDATED" | "ERROR";

const EMPTY_LOGIN: LoginForm = {
  tenantId: "",
  username: "",
  password: ""
};

const EMPTY_SCENARIO_READINESS_FORM: ScenarioReadinessForm = {
  parameterSetId: "",
  scenarioPackageId: ""
};

const SCENARIO_READINESS_KNOWN_LIMITS = [
  "仅检查就绪状态",
  "不会激活 Scenario 运行时",
  "不会绑定或修改 ParameterSet",
  "不会执行 Replay",
  "不会结算回合",
  "不会发布正式结果",
  "不会建立试点或生产就绪性"
] as const;

const DEMO_LOGIN: LoginForm = {
  tenantId: import.meta.env.VITE_SIMWAR_DEMO_TENANT_ID ?? "",
  username: import.meta.env.VITE_SIMWAR_DEMO_USERNAME ?? "",
  password: import.meta.env.VITE_SIMWAR_DEMO_PASSWORD ?? ""
};

const DEMO_LOGIN_ENABLED =
  import.meta.env.VITE_SIMWAR_DEMO_MODE === "true" &&
  Boolean(DEMO_LOGIN.tenantId && DEMO_LOGIN.username && DEMO_LOGIN.password);

const EMPTY_TEACHER_COURSE_PACKAGE_CLONE_FORM: TeacherCoursePackageCloneForm = {
  coursePackageId: "",
  description: "",
  title: "",
  version: ""
};

function TechnicalCompatibilityLabel({ children }: { children: ReactNode }) {
  return (
    <span className="technical-compatibility" aria-label="技术兼容标签">
      {children}
    </span>
  );
}

export interface TeacherWorkspaceRequestIdentity {
  epoch: number;
  sessionId: string;
  tenantId: string;
  runId: string;
  roundId: string;
}

export interface TeacherLoginRequestIdentity {
  epoch: number;
  tenantId: string;
  username: string;
}

export interface TeacherSessionRequestIdentity {
  actionRequestId: number;
  epoch: number;
  sessionId: string;
  tenantId: string;
  accessToken: string;
  runId: string;
  roundId: string;
  action: string;
}

export function isTeacherSessionRequestCurrent(
  request: TeacherSessionRequestIdentity,
  current: TeacherSessionRequestIdentity
): boolean {
  return (
    request.actionRequestId === current.actionRequestId &&
    request.epoch === current.epoch &&
    request.sessionId === current.sessionId &&
    request.tenantId === current.tenantId &&
    request.accessToken === current.accessToken &&
    request.runId === current.runId &&
    request.roundId === current.roundId &&
    request.action === current.action
  );
}

export function isTeacherWorkspaceRequestCurrent(
  request: TeacherWorkspaceRequestIdentity,
  current: TeacherWorkspaceRequestIdentity
): boolean {
  return (
    request.epoch === current.epoch &&
    request.sessionId === current.sessionId &&
    request.tenantId === current.tenantId &&
    request.runId === current.runId &&
    request.roundId === current.roundId
  );
}

export function isTeacherLoginRequestCurrent(
  request: TeacherLoginRequestIdentity,
  current: TeacherLoginRequestIdentity
): boolean {
  return (
    request.epoch === current.epoch &&
    request.tenantId === current.tenantId &&
    request.username === current.username
  );
}

function getTeacherErrorStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return null;
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

export function getTeacherScenarioPhaseLabel(phase: string): string {
  switch (phase) {
    case "IDLE":
      return "待检查";
    case "LOADING":
      return "加载中";
    case "READY":
      return "已就绪";
    case "BLOCKED":
      return "不可开课";
    case "UNAUTHENTICATED":
      return "需要登录";
    case "UNAUTHORIZED":
      return "未获授权";
    case "NOT_FOUND_OR_OUT_OF_SCOPE":
      return "不可用或超出范围";
    case "INVALID_REQUEST":
      return "请求待修正";
    case "INTERNAL_ERROR":
      return "加载失败";
    default:
      return "状态处理中";
  }
}

export function getTeacherScenarioStatusLabel(status: string): string {
  switch (status) {
    case "READY":
      return "已就绪";
    case "BLOCKED":
      return "不可开课";
    case "DRAFT_REVIEW_REQUIRED":
      return "待质量复核";
    case "APPROVED":
      return "已批准";
    case "VALIDATED":
      return "已验证";
    case "INCOMPATIBLE":
      return "不兼容";
    case "MISSING":
      return "缺少来源";
    case "UNVERIFIED":
      return "待核验";
    case "DRAFT_REGISTER_ONLY":
      return "仅草稿登记";
    case "NOT_REGISTERED":
      return "未注册";
    default:
      return "服务端状态已记录";
  }
}

export function getTeacherScenarioErrorMessage(error: unknown): string {
  switch (getTeacherErrorStatus(error)) {
    case 401:
      return "请先登录后检查场景就绪状态";
    case 403:
      return "当前教师会话未获场景检查授权";
    case 404:
      return "场景就绪信息不可用或超出范围";
    case 409:
      return "当前回合条件阻断了场景就绪检查";
    case 503:
      return "场景就绪服务暂不可用";
    default:
      return "场景就绪信息暂时无法加载，请稍后重试";
  }
}

function getTeacherScenarioValidationMessage(input: ScenarioReadinessForm): string {
  if (!input.scenarioPackageId.trim()) {
    return "请输入场景包 ID";
  }
  if (!input.parameterSetId.trim()) {
    return "请输入参数集 ID";
  }
  return "请求待修正";
}

export function getTeacherCoursePackageErrorMessage(error: unknown): string {
  switch (getTeacherErrorStatus(error)) {
    case 401:
      return "请先登录后管理课程包";
    case 403:
      return "当前教师会话未获课程包权限";
    case 404:
      return "课程包版本不存在或超出范围";
    case 409:
      return "课程包版本冲突，未创建新版本";
    case 503:
      return "课程包服务暂不可用";
    default:
      return "课程包服务暂时无法完成请求";
  }
}

function TeacherStatusText({ value }: { value: string }) {
  return (
    <>
      <span className="teacher-visible-status">{getTeacherScenarioStatusLabel(value)}</span>{" "}
      <TechnicalCompatibilityLabel>{value}</TechnicalCompatibilityLabel>
    </>
  );
}

function TeacherPhaseText({ value }: { value: string }) {
  return (
    <>
      <span className="teacher-visible-status">{getTeacherScenarioPhaseLabel(value)}</span>{" "}
      <TechnicalCompatibilityLabel>{value}</TechnicalCompatibilityLabel>
    </>
  );
}

async function apiRequest<TData>(
  path: string,
  options: { method?: string; token?: string; tenantId?: string; body?: unknown } = {}
): Promise<TData> {
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };
  const tenantId = options.tenantId?.trim();

  if (tenantId) {
    headers["x-tenant-id"] = tenantId;
  }

  if (options.token) {
    headers.authorization = `Bearer ${options.token}`;
  }

  const init: RequestInit = {
    method: options.method ?? "GET",
    headers
  };

  if (options.body) {
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}${path}`, init);
  const envelope = (await response.json()) as ApiEnvelope<TData>;

  if (!response.ok) {
    throw new Error(`${envelope.code}: ${envelope.message}`);
  }

  return envelope.data;
}

function getRoundAction(round?: Round): string {
  if (!round) {
    return "创建 Run";
  }

  if (round.status === "draft") {
    return "开启回合";
  }

  if (round.status === "open") {
    return "锁定回合";
  }

  if (round.status === "locked") {
    return "请求结算";
  }

  if (round.status === "settled") {
    return "发布结果";
  }

  return "创建下一回合";
}

function getCourseRuns(state: P0DemoState, selectedCourseId?: string | null): Run[] {
  const courseId = selectedCourseId ?? selectInitialCourseId(state);
  return courseId ? state.runs.filter((run) => run.course_id === courseId) : [];
}

function selectInitialCourseId(state: P0DemoState): string | null {
  const coursesWithTeams = new Set(state.teams.map((team) => team.course_id));
  const runnableCourses = state.courses.filter(
    (course) => course.status === "published" && coursesWithTeams.has(course.course_id)
  );
  return runnableCourses.at(-1)?.course_id ?? null;
}

function getRunRound(state: P0DemoState, runId: string): Round | undefined {
  const run = state.runs.find((candidate) => candidate.run_id === runId);
  return selectTeacherRound(getTeacherRunRounds(state.rounds, runId, run?.tenant_id));
}

function selectVisibleRun(
  state: P0DemoState,
  preferredRunId?: string | null,
  selectedCourseId?: string | null
): Run | undefined {
  const courseRuns = getCourseRuns(state, selectedCourseId);
  const preferredRun = preferredRunId
    ? courseRuns.find((run) => run.run_id === preferredRunId)
    : undefined;

  if (preferredRun) {
    return preferredRun;
  }

  return (
    [...courseRuns]
      .reverse()
      .find((run) => getRunRound(state, run.run_id)?.status !== "published") ?? courseRuns.at(-1)
  );
}

export function App() {
  const [state, setState] = useState<P0DemoState | null>(null);
  const [workspace, setWorkspace] = useState<TeacherBffWorkspaceDTO | null>(null);
  const [workspaceLoadState, setWorkspaceLoadState] = useState<TeacherWorkspaceLoadState>("idle");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [login, setLogin] = useState<LoginForm>(EMPTY_LOGIN);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("ready");
  const [showLearningDesign, setShowLearningDesign] = useState(false);
  const [scenarioReadinessForm, setScenarioReadinessForm] = useState<ScenarioReadinessForm>(
    EMPTY_SCENARIO_READINESS_FORM
  );
  const [scenarioReadiness, setScenarioReadiness] = useState<ScenarioReadinessState>({
    phase: "IDLE"
  });
  const [scenarioCandidates, setScenarioCandidates] = useState<ScenarioCandidatesState>({
    phase: "IDLE"
  });
  const [previewCandidate, setPreviewCandidate] =
    useState<R7TeacherScenarioPackageCandidateDto | null>(null);
  const [formalScenarioCatalog, setFormalScenarioCatalog] = useState<FormalScenarioCatalogState>({
    phase: "IDLE"
  });
  const [courseBlueprintCatalog, setCourseBlueprintCatalog] = useState<CourseBlueprintCatalogState>(
    {
      phase: "IDLE"
    }
  );
  const [selectedCourseBlueprint, setSelectedCourseBlueprint] = useState<
    TeacherCourseBlueprintCatalogDto["candidates"][number] | null
  >(null);
  const [courseBlueprintReadiness, setCourseBlueprintReadiness] =
    useState<TeacherCourseBlueprintReadinessDto | null>(null);
  const [courseBlueprintStudioStatus, setCourseBlueprintStudioStatus] =
    useState<CourseBlueprintStudioStatus>("IDLE");
  const [courseBlueprintStudioSource, setCourseBlueprintStudioSource] = useState<
    TeacherCourseBlueprintCatalogDto["candidates"][number]["course_blueprint_reference"] | null
  >(null);
  const [courseBlueprintStudioPreview, setCourseBlueprintStudioPreview] =
    useState<TeacherCourseBlueprintStudioPreview | null>(null);
  const [courseBlueprintStudioForm, setCourseBlueprintStudioForm] =
    useState<TeacherCourseBlueprintStudioEditableContent | null>(null);
  const [formalDraftCandidate, setFormalDraftCandidate] =
    useState<TeacherFormalScenarioPackageCatalogCandidateDto | null>(null);
  const [formalBindingPreview, setFormalBindingPreview] =
    useState<TeacherFormalCourseBindingPreviewDto | null>(null);
  const [formalCourseTitle, setFormalCourseTitle] = useState("");
  const [formalCoursePublished, setFormalCoursePublished] = useState(false);
  const [formalRunSeed, setFormalRunSeed] = useState("20260729");
  const [coursePackageList, setCoursePackageList] = useState<TeacherCoursePackageListState>({
    phase: "IDLE"
  });
  const [teacherCoursePackageCloneSource, setTeacherCoursePackageCloneSource] =
    useState<CoursePackageVersionTeacherDto | null>(null);
  const [teacherCoursePackageCloneForm, setTeacherCoursePackageCloneForm] =
    useState<TeacherCoursePackageCloneForm>(EMPTY_TEACHER_COURSE_PACKAGE_CLONE_FORM);
  const [teacherCoursePackageCloneReceipt, setTeacherCoursePackageCloneReceipt] =
    useState<CoursePackageVersionTeacherDto | null>(null);
  const [teacherCoursePackageCloneError, setTeacherCoursePackageCloneError] = useState<
    string | null
  >(null);
  const readinessRequestSequence = useRef(0);
  const candidateRequestSequence = useRef(0);
  const formalCatalogRequestSequence = useRef(0);
  const coursePackageSessionEpoch = useRef(0);
  const workspaceRequestEpoch = useRef(0);
  const loginRequestEpoch = useRef(0);
  const teacherContextEpoch = useRef(0);
  const teacherActionRequestSequence = useRef(0);
  const currentTeacherActionRequestRef = useRef(0);
  const teacherSessionIdentityRef = useRef<TeacherSessionRequestIdentity>({
    actionRequestId: 0,
    accessToken: "",
    action: "context",
    epoch: 0,
    roundId: "",
    runId: "",
    sessionId: "",
    tenantId: ""
  });
  const loginRequestIdentityRef = useRef<TeacherLoginRequestIdentity>({
    epoch: 0,
    tenantId: "",
    username: ""
  });
  const workspaceRequestIdentityRef = useRef<TeacherWorkspaceRequestIdentity>({
    epoch: 0,
    sessionId: "",
    tenantId: "",
    runId: "",
    roundId: ""
  });
  const selectedRunIdRef = useRef<string | null>(null);
  const selectedRoundIdRef = useRef<string | null>(null);
  const selectedCourseIdRef = useRef<string | null>(null);

  function buildTeacherSessionIdentity(
    action: string,
    nextSession: AuthSession | null,
    tenantId: string,
    runId = teacherSessionIdentityRef.current.runId,
    roundId = teacherSessionIdentityRef.current.roundId,
    actionRequestId = currentTeacherActionRequestRef.current
  ): TeacherSessionRequestIdentity {
    return {
      actionRequestId,
      accessToken: nextSession?.access_token ?? "",
      action,
      epoch: teacherContextEpoch.current,
      roundId,
      runId,
      sessionId: nextSession?.user.user_id ?? "",
      tenantId: tenantId.trim()
    };
  }

  function isCurrentTeacherContext(identity: TeacherSessionRequestIdentity): boolean {
    const current = teacherSessionIdentityRef.current;
    return (
      identity.actionRequestId === currentTeacherActionRequestRef.current &&
      identity.epoch === current.epoch &&
      identity.sessionId === current.sessionId &&
      identity.tenantId === current.tenantId &&
      identity.accessToken === current.accessToken &&
      identity.runId === current.runId &&
      identity.roundId === current.roundId
    );
  }

  function beginTeacherActionIdentity(
    action: string,
    nextSession: AuthSession,
    tenantId: string,
    runId = teacherSessionIdentityRef.current.runId,
    roundId = teacherSessionIdentityRef.current.roundId
  ): TeacherSessionRequestIdentity {
    const actionRequestId = ++teacherActionRequestSequence.current;
    currentTeacherActionRequestRef.current = actionRequestId;
    const identity = buildTeacherSessionIdentity(
      action,
      nextSession,
      tenantId,
      runId,
      roundId,
      actionRequestId
    );
    teacherSessionIdentityRef.current = identity;
    return identity;
  }

  function isCurrentTeacherSessionContext(identity: TeacherSessionRequestIdentity): boolean {
    const current = teacherSessionIdentityRef.current;
    return (
      identity.epoch === current.epoch &&
      identity.sessionId === current.sessionId &&
      identity.tenantId === current.tenantId &&
      identity.accessToken === current.accessToken
    );
  }

  function invalidateTeacherContext(
    nextLogin: LoginForm = login,
    nextRunId = "",
    nextSession: AuthSession | null = session
  ): void {
    teacherContextEpoch.current += 1;
    const actionRequestId = ++teacherActionRequestSequence.current;
    currentTeacherActionRequestRef.current = actionRequestId;
    teacherSessionIdentityRef.current = buildTeacherSessionIdentity(
      "context",
      nextSession,
      nextLogin.tenantId,
      nextRunId,
      "",
      actionRequestId
    );
  }

  const courseRuns = state ? getCourseRuns(state, selectedCourseId) : [];
  const latestRun = courseRuns.at(-1);
  const latestRound = latestRun ? getRunRound(state!, latestRun.run_id) : undefined;
  const selectedRun = state ? selectVisibleRun(state, selectedRunId, selectedCourseId) : undefined;
  const selectedRound = selectedRun
    ? selectTeacherRound(
        getTeacherRunRounds(state?.rounds ?? [], selectedRun.run_id, login.tenantId || undefined),
        selectedRoundId
      )
    : undefined;
  const latestResult = state?.latest_result;
  const selectedResult = latestResult?.run_id === selectedRun?.run_id ? latestResult : undefined;
  const resultRows = workspace?.teacher_replay_summary.authorized_result_snapshot ?? [];
  const resultLabel = selectedResult?.result_label ?? M1_TEACHING_OFFICIAL_RESULT_LABEL;
  const runtimeBoundary =
    workspace?.teacher_replay_summary.visible_state.runtime_boundary ??
    selectedResult?.runtime_boundary ??
    "current_json_active_runtime";
  const runtimeLimitations = selectedResult?.runtime_limitations ?? [
    "not_production_durable_settlement",
    "not_cross_process_idempotency",
    "not_database_transaction_recovery",
    "not_postgresql_active_runtime"
  ];
  const debriefPrompts = selectedResult?.classroom_debrief_prompts ?? [];
  const teachingPackage = M1_TEACHING_PRODUCT_PACKAGE;
  const teacherDashboard = workspace?.teacher_dashboard;
  const courseWorkspace = workspace?.course_workspace;
  const roundControl = workspace?.round_control;
  const teamMonitor = workspace?.team_monitor;
  const replaySummary = workspace?.teacher_replay_summary;
  const isTeacher = session?.user.roles.includes("teacher") ?? false;
  const w3Team = state?.teams.find(
    (candidate) => candidate.course_id === (selectedRun?.course_id ?? selectedCourseId)
  );
  const w3RoleKey = w3Team?.members[0]?.role_slot ?? "CEO";
  const w3Context =
    readW3QueryContext() ??
    (selectedRun && selectedRound && w3Team
      ? {
          activity_id: "activity_consequence",
          course_id: selectedRun.course_id,
          role_key: w3RoleKey,
          round_id: selectedRound.round_id,
          round_no: selectedRound.round_no,
          run_id: selectedRun.run_id,
          team_id: w3Team.team_id,
          tenant_id: login.tenantId
        }
      : undefined);
  const hasDecision = useMemo(() => {
    if (!selectedRun || !selectedRound || !state) {
      return false;
    }

    return state.decisions.some(
      (decision) =>
        decision.run_id === selectedRun.run_id &&
        decision.round_id === selectedRound.round_id &&
        decision.round_no === selectedRound.round_no
    );
  }, [selectedRun, selectedRound, state]);

  const refresh = useCallback(
    async (preferredRunId?: string | null, preferredRoundId?: string | null) => {
      if (!session) {
        return;
      }

      const requestedRunId =
        preferredRunId === undefined ? (selectedRunIdRef.current ?? "") : (preferredRunId ?? "");
      const requestedRoundId =
        preferredRoundId !== undefined
          ? (preferredRoundId ?? "")
          : preferredRunId === undefined || requestedRunId === (selectedRunIdRef.current ?? "")
            ? (selectedRoundIdRef.current ?? "")
            : "";
      if (preferredRunId !== undefined && requestedRunId !== (selectedRunIdRef.current ?? "")) {
        invalidateTeacherContext(login, requestedRunId, session);
      }
      const requestEpoch = workspaceRequestEpoch.current + 1;
      workspaceRequestEpoch.current = requestEpoch;
      const auth = { token: session.access_token, tenantId: login.tenantId };
      const requestIdentity: TeacherWorkspaceRequestIdentity = {
        epoch: requestEpoch,
        sessionId: session.user.user_id,
        tenantId: login.tenantId,
        runId: requestedRunId,
        roundId: requestedRoundId
      };
      workspaceRequestIdentityRef.current = requestIdentity;
      setWorkspace(null);
      setWorkspaceLoadState("loading");

      let nextState: P0DemoState;
      try {
        nextState = await apiRequest<P0DemoState>("/api/v1/demo-state", auth);
      } catch (error) {
        if (
          !isTeacherWorkspaceRequestCurrent(requestIdentity, {
            ...workspaceRequestIdentityRef.current,
            epoch: workspaceRequestEpoch.current
          })
        ) {
          return;
        }
        throw error;
      }
      const nextCourseId = selectedCourseIdRef.current ?? selectInitialCourseId(nextState);
      const nextRun = selectVisibleRun(
        nextState,
        preferredRunId === undefined ? selectedRunIdRef.current : preferredRunId,
        nextCourseId
      );
      const nextRound = nextRun
        ? selectTeacherRound(
            getTeacherRunRounds(nextState.rounds, nextRun.run_id, login.tenantId || undefined),
            requestedRoundId || null
          )
        : undefined;
      const resolvedIdentity: TeacherWorkspaceRequestIdentity = {
        ...requestIdentity,
        runId: nextRun?.run_id ?? "",
        roundId: nextRound?.round_id ?? ""
      };
      if (
        !isTeacherWorkspaceRequestCurrent(requestIdentity, {
          ...workspaceRequestIdentityRef.current,
          epoch: workspaceRequestEpoch.current
        })
      ) {
        return;
      }
      workspaceRequestIdentityRef.current = resolvedIdentity;
      teacherSessionIdentityRef.current = buildTeacherSessionIdentity(
        "context",
        session,
        login.tenantId,
        nextRun?.run_id ?? "",
        nextRound?.round_id ?? ""
      );

      setState(nextState);
      selectedCourseIdRef.current = nextCourseId;
      setSelectedCourseId(nextCourseId);
      selectedRunIdRef.current = nextRun?.run_id ?? null;
      setSelectedRunId(nextRun?.run_id ?? null);
      selectedRoundIdRef.current = nextRound?.round_id ?? null;
      setSelectedRoundId(nextRound?.round_id ?? null);
      setWorkspace(null);

      if (!nextRun || !nextRound) {
        setWorkspaceLoadState("idle");
        return;
      }

      setWorkspaceLoadState("loading");
      try {
        const nextWorkspace = await apiRequest<TeacherBffWorkspaceDTO>(
          `/api/v1/bff/teacher/runs/${nextRun.run_id}/rounds/${nextRound.round_no}/workspace`,
          auth
        );
        if (
          !isTeacherWorkspaceRequestCurrent(resolvedIdentity, {
            ...workspaceRequestIdentityRef.current,
            epoch: workspaceRequestEpoch.current
          })
        ) {
          return;
        }
        if (
          !isTeacherRoundWorkspaceForContext(nextWorkspace, {
            tenantId: login.tenantId,
            courseId: nextRun.course_id,
            runId: nextRun.run_id,
            roundId: nextRound.round_id,
            roundNo: nextRound.round_no
          })
        ) {
          throw new Error("TEACHER-ROUND-CONTEXT-409: BFF Round identity mismatch");
        }
        setWorkspace(nextWorkspace);
        setWorkspaceLoadState("ready");
      } catch (error) {
        if (
          !isTeacherWorkspaceRequestCurrent(resolvedIdentity, {
            ...workspaceRequestIdentityRef.current,
            epoch: workspaceRequestEpoch.current
          })
        ) {
          return;
        }
        setWorkspaceLoadState("error");
        throw error;
      }
    },
    [login.tenantId, session]
  );

  const refreshTeacherCoursePackages = useCallback(async () => {
    const requestIdentity = buildTeacherSessionIdentity(
      "course-package-catalog",
      session,
      login.tenantId,
      selectedRunIdRef.current ?? ""
    );
    if (!session?.user.roles.includes("teacher")) {
      if (isCurrentTeacherContext(requestIdentity)) {
        setCoursePackageList({ phase: "IDLE" });
      }
      return;
    }

    const sessionEpoch = coursePackageSessionEpoch.current;
    setCoursePackageList({ phase: "LOADING" });
    try {
      const packages = await loadTeacherCoursePackageVersions(session.access_token, (path, init) =>
        fetch(`${API_BASE}${path}`, init)
      );
      if (
        sessionEpoch !== coursePackageSessionEpoch.current ||
        !isCurrentTeacherSessionContext(requestIdentity)
      )
        return;
      setCoursePackageList({ packages, phase: "READY" });
    } catch (error) {
      if (
        sessionEpoch !== coursePackageSessionEpoch.current ||
        !isCurrentTeacherSessionContext(requestIdentity)
      )
        return;
      setCoursePackageList({
        phase: "ERROR",
        surfaceState: getTeacherCoursePackageSurfaceState(error),
        message: getTeacherCoursePackageErrorMessage(error)
      });
    }
  }, [session]);

  function updateLogin(field: keyof LoginForm, value: string): void {
    const nextLogin = { ...login, [field]: value };
    workspaceRequestEpoch.current += 1;
    coursePackageSessionEpoch.current += 1;
    loginRequestEpoch.current += 1;
    invalidateTeacherContext(nextLogin, "", null);
    loginRequestIdentityRef.current = {
      epoch: loginRequestEpoch.current,
      tenantId: (field === "tenantId" ? value : login.tenantId).trim(),
      username: (field === "username" ? value : login.username).trim()
    };
    setBusy(false);
    setLogin((current) => ({ ...current, [field]: value }));
    setSession(null);
    setState(null);
    setWorkspace(null);
    setWorkspaceLoadState("idle");
    selectedCourseIdRef.current = null;
    setSelectedCourseId(null);
    selectedRunIdRef.current = null;
    setSelectedRunId(null);
    setFormalCoursePublished(false);
    setScenarioReadiness({ phase: "IDLE" });
    setScenarioCandidates({ phase: "IDLE" });
    setPreviewCandidate(null);
    setFormalScenarioCatalog({ phase: "IDLE" });
    setCourseBlueprintCatalog({ phase: "IDLE" });
    setSelectedCourseBlueprint(null);
    setCourseBlueprintReadiness(null);
    setCourseBlueprintStudioStatus("IDLE");
    setCourseBlueprintStudioSource(null);
    setCourseBlueprintStudioPreview(null);
    setCourseBlueprintStudioForm(null);
    setFormalDraftCandidate(null);
    setFormalBindingPreview(null);
    setFormalCourseTitle("");
    setScenarioReadinessForm(EMPTY_SCENARIO_READINESS_FORM);
    setCoursePackageList({ phase: "IDLE" });
    setTeacherCoursePackageCloneSource(null);
    setTeacherCoursePackageCloneForm(EMPTY_TEACHER_COURSE_PACKAGE_CLONE_FORM);
    setTeacherCoursePackageCloneReceipt(null);
    setTeacherCoursePackageCloneError(null);
    setNotice("context changed");
  }

  function updateScenarioReadinessForm(field: keyof ScenarioReadinessForm, value: string): void {
    setScenarioReadinessForm((current) => ({ ...current, [field]: value }));
    if (scenarioReadiness.phase !== "LOADING") {
      setScenarioReadiness({ phase: "IDLE" });
    }
  }

  async function checkScenarioReadiness(): Promise<void> {
    const validationMessage = validateScenarioReadinessInput(scenarioReadinessForm);
    if (validationMessage) {
      setScenarioReadiness({
        compatibilityMessage: validationMessage,
        message: getTeacherScenarioValidationMessage(scenarioReadinessForm),
        phase: "INVALID_REQUEST"
      });
      return;
    }
    if (!session || !selectedRun) {
      setScenarioReadiness({
        phase: "UNAUTHENTICATED",
        message: "请先登录后检查场景就绪状态。"
      });
      return;
    }

    const requestSequence = readinessRequestSequence.current + 1;
    readinessRequestSequence.current = requestSequence;
    const requestIdentity = beginTeacherActionIdentity(
      "scenario-readiness",
      session,
      login.tenantId,
      selectedRun.run_id,
      selectedRound?.round_id ?? ""
    );
    setScenarioReadiness({ phase: "LOADING" });

    try {
      const response = await requestScenarioReadiness({
        apiBaseUrl: API_BASE,
        parameterSetId: scenarioReadinessForm.parameterSetId,
        runId: selectedRun.run_id,
        scenarioPackageId: scenarioReadinessForm.scenarioPackageId,
        token: session.access_token
      });

      if (
        readinessRequestSequence.current === requestSequence &&
        isCurrentTeacherContext(requestIdentity)
      ) {
        setScenarioReadiness({
          phase: response.eligible ? "READY" : "BLOCKED",
          response
        });
      }
    } catch (error) {
      if (
        readinessRequestSequence.current !== requestSequence ||
        !isCurrentTeacherContext(requestIdentity)
      ) {
        return;
      }

      const message = getTeacherScenarioErrorMessage(error);
      const compatibilityMessage = getScenarioReadinessErrorMessage(error);
      if (error instanceof ScenarioReadinessRequestError) {
        const { status } = error;
        setScenarioReadiness({
          phase:
            status === 401
              ? "UNAUTHENTICATED"
              : status === 403
                ? "UNAUTHORIZED"
                : status === 404
                  ? "NOT_FOUND_OR_OUT_OF_SCOPE"
                  : "INTERNAL_ERROR",
          message,
          compatibilityMessage
        });
        return;
      }
      setScenarioReadiness({ phase: "INTERNAL_ERROR", message, compatibilityMessage });
    }
  }

  async function signIn(nextLogin = login): Promise<void> {
    workspaceRequestEpoch.current += 1;
    coursePackageSessionEpoch.current += 1;
    invalidateTeacherContext(nextLogin, "", null);
    const requestIdentity: TeacherLoginRequestIdentity = {
      epoch: loginRequestEpoch.current + 1,
      tenantId: nextLogin.tenantId.trim(),
      username: nextLogin.username.trim()
    };
    loginRequestEpoch.current = requestIdentity.epoch;
    loginRequestIdentityRef.current = requestIdentity;
    setBusy(true);
    setSession(null);
    setState(null);
    setWorkspace(null);
    setWorkspaceLoadState("idle");
    selectedRunIdRef.current = null;
    setSelectedRunId(null);
    try {
      const nextSession = await apiRequest<AuthSession>("/api/v1/auth/login", {
        method: "POST",
        tenantId: nextLogin.tenantId,
        body: {
          username: nextLogin.username,
          password: nextLogin.password
        }
      });
      if (
        !isTeacherLoginRequestCurrent(requestIdentity, {
          ...loginRequestIdentityRef.current,
          epoch: loginRequestEpoch.current
        })
      ) {
        return;
      }
      setLogin(nextLogin);
      setSession(nextSession);
      teacherSessionIdentityRef.current = buildTeacherSessionIdentity(
        "context",
        nextSession,
        nextLogin.tenantId,
        selectedRunIdRef.current ?? "",
        teacherSessionIdentityRef.current.roundId,
        currentTeacherActionRequestRef.current
      );
      setNotice("signed in");
    } catch (error) {
      if (
        !isTeacherLoginRequestCurrent(requestIdentity, {
          ...loginRequestIdentityRef.current,
          epoch: loginRequestEpoch.current
        })
      ) {
        return;
      }
      setNotice(error instanceof Error ? error.message : "login failed");
    } finally {
      if (
        isTeacherLoginRequestCurrent(requestIdentity, {
          ...loginRequestIdentityRef.current,
          epoch: loginRequestEpoch.current
        })
      ) {
        setBusy(false);
      }
    }
  }

  useEffect(() => {
    const requestIdentity = teacherSessionIdentityRef.current;
    refresh().catch((error: unknown) => {
      if (isCurrentTeacherContext(requestIdentity)) {
        setNotice(getTeacherNoticeLabel(error instanceof Error ? error.message : "load failed"));
      }
    });
  }, [refresh]);

  useEffect(() => {
    void refreshTeacherCoursePackages();
  }, [refreshTeacherCoursePackages]);

  function beginTeacherCoursePackageClone(coursePackage: CoursePackageVersionTeacherDto): void {
    setTeacherCoursePackageCloneSource(coursePackage);
    setTeacherCoursePackageCloneForm(EMPTY_TEACHER_COURSE_PACKAGE_CLONE_FORM);
    setTeacherCoursePackageCloneReceipt(null);
    setTeacherCoursePackageCloneError(null);
  }

  function updateTeacherCoursePackageClone(
    field: keyof TeacherCoursePackageCloneForm,
    value: string
  ): void {
    setTeacherCoursePackageCloneForm((current) => ({ ...current, [field]: value }));
  }

  async function cloneTeacherCoursePackageVersion(): Promise<void> {
    if (!session || !teacherCoursePackageCloneSource) return;
    const requestIdentity = beginTeacherActionIdentity(
      "course-package-clone",
      session,
      login.tenantId,
      selectedRunIdRef.current ?? ""
    );
    if (!isCurrentTeacherContext(requestIdentity)) return;

    const cloneInput: CoursePackageVersionCloneInput = {
      course_package_id: teacherCoursePackageCloneForm.coursePackageId,
      description: teacherCoursePackageCloneForm.description,
      source_course_package_reference: teacherCoursePackageCloneSource.course_package_reference,
      title: teacherCoursePackageCloneForm.title,
      version: teacherCoursePackageCloneForm.version
    };
    setBusy(true);
    setTeacherCoursePackageCloneError(null);
    try {
      const receipt = await requestTeacherCoursePackageClone(
        cloneInput,
        session.access_token,
        (path, init) => fetch(`${API_BASE}${path}`, init)
      );
      if (!isCurrentTeacherContext(requestIdentity)) return;
      setTeacherCoursePackageCloneReceipt(receipt);
      setTeacherCoursePackageCloneSource(null);
      setTeacherCoursePackageCloneForm(EMPTY_TEACHER_COURSE_PACKAGE_CLONE_FORM);
    } catch (error) {
      if (isCurrentTeacherContext(requestIdentity)) {
        setTeacherCoursePackageCloneError(getTeacherCoursePackageErrorMessage(error));
      }
    } finally {
      if (isCurrentTeacherContext(requestIdentity)) {
        setBusy(false);
      }
    }
  }

  useEffect(() => {
    setPreviewCandidate(null);
    setScenarioReadiness({ phase: "IDLE" });
    if (!session || !selectedRun) {
      candidateRequestSequence.current += 1;
      setScenarioCandidates({ phase: "IDLE" });
      return;
    }

    const requestSequence = candidateRequestSequence.current + 1;
    candidateRequestSequence.current = requestSequence;
    const requestIdentity = buildTeacherSessionIdentity(
      "scenario-candidate-catalog",
      session,
      login.tenantId,
      selectedRun.run_id
    );
    setScenarioCandidates({ phase: "LOADING" });

    requestScenarioPackageCandidates({
      apiBaseUrl: API_BASE,
      runId: selectedRun.run_id,
      token: session.access_token
    })
      .then((response) => {
        if (
          candidateRequestSequence.current === requestSequence &&
          isCurrentTeacherContext(requestIdentity)
        ) {
          setScenarioCandidates({ phase: "READY", response });
        }
      })
      .catch((error: unknown) => {
        if (
          candidateRequestSequence.current === requestSequence &&
          isCurrentTeacherContext(requestIdentity)
        ) {
          setScenarioCandidates({
            phase: "ERROR",
            compatibilityMessage: getScenarioCandidatesErrorMessage(error),
            message: getTeacherScenarioErrorMessage(error)
          });
        }
      });
  }, [selectedRun?.run_id, session]);

  useEffect(() => {
    setFormalDraftCandidate(null);
    if (!session) {
      formalCatalogRequestSequence.current += 1;
      setFormalScenarioCatalog({ phase: "IDLE" });
      return;
    }

    const requestSequence = formalCatalogRequestSequence.current + 1;
    formalCatalogRequestSequence.current = requestSequence;
    const requestIdentity = buildTeacherSessionIdentity(
      "formal-scenario-catalog",
      session,
      login.tenantId
    );
    setFormalScenarioCatalog({ phase: "LOADING" });

    requestTeacherFormalScenarioPackageCatalog({
      apiBaseUrl: API_BASE,
      token: session.access_token
    })
      .then((response) => {
        if (
          formalCatalogRequestSequence.current === requestSequence &&
          isCurrentTeacherSessionContext(requestIdentity)
        ) {
          setFormalScenarioCatalog({ phase: "READY", response });
        }
      })
      .catch((error: unknown) => {
        if (
          formalCatalogRequestSequence.current === requestSequence &&
          isCurrentTeacherSessionContext(requestIdentity)
        ) {
          setFormalScenarioCatalog({
            phase: "ERROR",
            compatibilityMessage: getTeacherFormalScenarioPackageCatalogErrorMessage(error),
            message: getTeacherScenarioErrorMessage(error)
          });
        }
      });
  }, [session]);

  useEffect(() => {
    setSelectedCourseBlueprint(null);
    setCourseBlueprintReadiness(null);
    if (!session) {
      setCourseBlueprintCatalog({ phase: "IDLE" });
      return;
    }
    const requestIdentity = buildTeacherSessionIdentity(
      "course-blueprint-catalog",
      session,
      login.tenantId
    );
    setCourseBlueprintCatalog({ phase: "LOADING" });
    requestTeacherCourseBlueprintCatalog({ apiBaseUrl: API_BASE, token: session.access_token })
      .then((response) => {
        if (!isCurrentTeacherSessionContext(requestIdentity)) return;
        setCourseBlueprintCatalog({ phase: "READY", response });
      })
      .catch((error: unknown) => {
        if (!isCurrentTeacherSessionContext(requestIdentity)) return;
        setCourseBlueprintCatalog({
          phase: "ERROR",
          compatibilityMessage: getTeacherFormalCourseBindingErrorMessage(error),
          message: getTeacherScenarioErrorMessage(error)
        });
      });
  }, [session]);

  async function prepareFormalCourse(
    candidate: TeacherFormalScenarioPackageCatalogCandidateDto
  ): Promise<void> {
    if (!session) return;
    const requestIdentity = beginTeacherActionIdentity(
      "formal-course-binding-preview",
      session,
      login.tenantId
    );
    if (!isCurrentTeacherContext(requestIdentity)) return;
    setFormalDraftCandidate(candidate);
    setFormalBindingPreview(null);
    setFormalCoursePublished(false);
    setBusy(true);
    try {
      const preview = await requestTeacherFormalCourseBindingPreview({
        apiBaseUrl: API_BASE,
        scenarioPackageReference: candidate.scenario_package_reference,
        token: session.access_token
      });
      if (!isCurrentTeacherContext(requestIdentity)) return;
      setFormalBindingPreview(preview);
      setFormalCourseTitle(`Course: ${candidate.scenario_package_reference.scenario_package_id}`);
      setNotice("formal Course binding preview ready");
    } catch (error) {
      if (isCurrentTeacherContext(requestIdentity)) {
        setNotice(getTeacherFormalCourseBindingErrorMessage(error));
      }
    } finally {
      if (isCurrentTeacherContext(requestIdentity)) {
        setBusy(false);
      }
    }
  }

  async function createFormalCourse(): Promise<void> {
    if (
      !session ||
      !formalDraftCandidate ||
      !selectedCourseBlueprint ||
      !courseBlueprintReadiness ||
      !formalCourseTitle.trim()
    ) {
      setNotice("an approved CourseBlueprint and exact binding readiness are required");
      return;
    }
    const requestIdentity = beginTeacherActionIdentity(
      "formal-course-create",
      session,
      login.tenantId
    );
    if (!isCurrentTeacherContext(requestIdentity)) return;
    setBusy(true);
    try {
      const created = await requestTeacherCourseBlueprintCourseCreate({
        apiBaseUrl: API_BASE,
        courseBlueprintReference: selectedCourseBlueprint.course_blueprint_reference,
        scenarioPackageReference: formalDraftCandidate.scenario_package_reference,
        title: formalCourseTitle.trim(),
        token: session.access_token
      });
      if (!isCurrentTeacherContext(requestIdentity)) return;
      selectedCourseIdRef.current = created.course.course_id;
      setSelectedCourseId(created.course.course_id);
      setFormalCoursePublished(false);
      setNotice("formal Course created");
    } catch (error) {
      if (isCurrentTeacherContext(requestIdentity)) {
        setNotice(getTeacherFormalCourseBindingErrorMessage(error));
      }
    } finally {
      if (isCurrentTeacherContext(requestIdentity)) {
        setBusy(false);
      }
    }
  }

  async function selectCourseBlueprintLocally(
    blueprint: TeacherCourseBlueprintCatalogDto["candidates"][number]
  ): Promise<void> {
    setSelectedCourseBlueprint(blueprint);
    setCourseBlueprintReadiness(null);
    setNotice("LOCAL_SELECTION_ONLY - no Course write yet");
    if (!session || !formalDraftCandidate) return;
    const requestIdentity = beginTeacherActionIdentity(
      "course-blueprint-readiness",
      session,
      login.tenantId
    );
    if (!isCurrentTeacherContext(requestIdentity)) return;
    setBusy(true);
    try {
      const readiness = await requestTeacherCourseBlueprintReadiness({
        apiBaseUrl: API_BASE,
        courseBlueprintReference: blueprint.course_blueprint_reference,
        scenarioPackageReference: formalDraftCandidate.scenario_package_reference,
        token: session.access_token
      });
      if (!isCurrentTeacherContext(requestIdentity)) return;
      setCourseBlueprintReadiness(readiness);
      setFormalBindingPreview(readiness.formal_course_binding);
      setFormalCourseTitle(`Course: ${blueprint.title}`);
      setNotice("exact Blueprint and B5 readiness confirmed");
    } catch (error) {
      if (isCurrentTeacherContext(requestIdentity)) {
        setNotice(getTeacherFormalCourseBindingErrorMessage(error));
      }
    } finally {
      if (isCurrentTeacherContext(requestIdentity)) {
        setBusy(false);
      }
    }
  }

  async function beginCourseBlueprintStudio(
    blueprint: TeacherCourseBlueprintCatalogDto["candidates"][number]
  ): Promise<void> {
    if (!session) return;
    const requestIdentity = beginTeacherActionIdentity(
      "course-blueprint-studio-preview",
      session,
      login.tenantId
    );
    if (!isCurrentTeacherContext(requestIdentity)) return;
    setBusy(true);
    setCourseBlueprintStudioStatus("LOADING");
    try {
      const preview = await requestTeacherCourseBlueprintStudioPreview({
        apiBaseUrl: API_BASE,
        courseBlueprintReference: blueprint.course_blueprint_reference,
        token: session.access_token
      });
      if (!isCurrentTeacherContext(requestIdentity)) return;
      setCourseBlueprintStudioSource(blueprint.course_blueprint_reference);
      setCourseBlueprintStudioPreview(preview);
      setCourseBlueprintStudioForm({
        ...preview.editable_content,
        version: preview.editable_content.version
      });
      setCourseBlueprintStudioStatus("EDITING");
      setNotice("Blueprint Studio edit ready");
    } catch (error) {
      if (isCurrentTeacherContext(requestIdentity)) {
        setCourseBlueprintStudioStatus("ERROR");
        setNotice(getTeacherFormalCourseBindingErrorMessage(error));
      }
    } finally {
      if (isCurrentTeacherContext(requestIdentity)) {
        setBusy(false);
      }
    }
  }

  function updateCourseBlueprintStudioForm(
    field: "description" | "title" | "version",
    value: string
  ): void {
    setCourseBlueprintStudioForm((current) => (current ? { ...current, [field]: value } : current));
  }

  async function saveCourseBlueprintStudioDraft(): Promise<void> {
    if (!session || !courseBlueprintStudioSource || !courseBlueprintStudioForm) return;
    const requestIdentity = beginTeacherActionIdentity(
      "course-blueprint-studio-draft",
      session,
      login.tenantId
    );
    if (!isCurrentTeacherContext(requestIdentity)) return;
    setBusy(true);
    setCourseBlueprintStudioStatus("LOADING");
    try {
      const draft = await requestTeacherCourseBlueprintStudioDraftCreate({
        apiBaseUrl: API_BASE,
        draft: courseBlueprintStudioForm,
        sourceCourseBlueprintReference: courseBlueprintStudioSource,
        token: session.access_token
      });
      const preview = await requestTeacherCourseBlueprintStudioPreview({
        apiBaseUrl: API_BASE,
        courseBlueprintReference: draft.course_blueprint_reference,
        token: session.access_token
      });
      if (!isCurrentTeacherContext(requestIdentity)) return;
      setCourseBlueprintStudioPreview(preview);
      setCourseBlueprintStudioForm(preview.editable_content);
      setCourseBlueprintStudioStatus("DRAFT");
      setNotice("immutable Blueprint draft saved");
    } catch (error) {
      if (isCurrentTeacherContext(requestIdentity)) {
        setCourseBlueprintStudioStatus("ERROR");
        setNotice(getTeacherFormalCourseBindingErrorMessage(error));
      }
    } finally {
      if (isCurrentTeacherContext(requestIdentity)) {
        setBusy(false);
      }
    }
  }

  async function submitCourseBlueprintStudioDraft(): Promise<void> {
    if (!session || !courseBlueprintStudioPreview || courseBlueprintStudioStatus !== "DRAFT") {
      return;
    }
    const requestIdentity = beginTeacherActionIdentity(
      "course-blueprint-studio-submit",
      session,
      login.tenantId
    );
    if (!isCurrentTeacherContext(requestIdentity)) return;
    setBusy(true);
    try {
      const submission = await requestTeacherCourseBlueprintStudioSubmission({
        apiBaseUrl: API_BASE,
        courseBlueprintReference: courseBlueprintStudioPreview.course_blueprint_reference,
        token: session.access_token
      });
      if (!isCurrentTeacherContext(requestIdentity)) return;
      setCourseBlueprintStudioStatus(submission.status);
      setNotice("Blueprint draft submitted for validation");
    } catch (error) {
      if (isCurrentTeacherContext(requestIdentity)) {
        setCourseBlueprintStudioStatus("ERROR");
        setNotice(getTeacherFormalCourseBindingErrorMessage(error));
      }
    } finally {
      if (isCurrentTeacherContext(requestIdentity)) {
        setBusy(false);
      }
    }
  }

  async function publishFormalCourse(): Promise<void> {
    if (!session || !selectedCourseId) {
      setNotice("a formal Course is required before publication");
      return;
    }
    const requestIdentity = beginTeacherActionIdentity(
      "formal-course-publish",
      session,
      login.tenantId
    );
    if (!isCurrentTeacherContext(requestIdentity)) return;
    setBusy(true);
    try {
      const auth = { token: session.access_token, tenantId: login.tenantId };
      await apiRequest(`/api/v1/courses/${selectedCourseId}/publish`, {
        ...auth,
        method: "POST"
      });
      if (!isCurrentTeacherContext(requestIdentity)) return;
      setFormalCoursePublished(true);
      setNotice("formal Course published");
    } catch (error) {
      if (isCurrentTeacherContext(requestIdentity)) {
        setNotice(error instanceof Error ? error.message : "formal Course publication failed");
      }
    } finally {
      if (isCurrentTeacherContext(requestIdentity)) {
        setBusy(false);
      }
    }
  }

  async function createFormalCourseRun(): Promise<void> {
    if (!session || !selectedCourseId || !/^\d+$/.test(formalRunSeed.trim())) {
      setNotice("an explicit non-negative Run seed is required");
      return;
    }
    const requestIdentity = beginTeacherActionIdentity(
      "formal-run-create",
      session,
      login.tenantId
    );
    if (!isCurrentTeacherContext(requestIdentity)) return;
    setBusy(true);
    try {
      const auth = { token: session.access_token, tenantId: login.tenantId };
      const created = await apiRequest<{ run: Run; round: Round }>(
        `/api/v1/courses/${selectedCourseId}/runs`,
        { ...auth, body: { formal_runtime_seed: Number(formalRunSeed) }, method: "POST" }
      );
      if (!isCurrentTeacherContext(requestIdentity)) return;
      selectedRunIdRef.current = created.run.run_id;
      setSelectedRunId(created.run.run_id);
      setNotice("formal Run created");
      setBusy(false);
      await refresh(created.run.run_id);
    } catch (error) {
      if (isCurrentTeacherContext(requestIdentity)) {
        setNotice(error instanceof Error ? error.message : "formal Run creation failed");
      }
    } finally {
      if (isCurrentTeacherContext(requestIdentity)) {
        setBusy(false);
      }
    }
  }

  async function createCourseRun(
    requestIdentityOverride?: TeacherSessionRequestIdentity
  ): Promise<void> {
    if (!session) {
      if (!requestIdentityOverride || isCurrentTeacherContext(requestIdentityOverride)) {
        setNotice("please sign in first");
      }
      return;
    }

    const courseId = selectedCourseId ?? (state ? selectInitialCourseId(state) : null);
    if (!courseId) {
      throw new Error("course not available");
    }

    const requestIdentity =
      requestIdentityOverride ??
      beginTeacherActionIdentity("course-run-create", session, login.tenantId);
    if (!isCurrentTeacherContext(requestIdentity)) return;
    const auth = { token: session.access_token, tenantId: login.tenantId };
    const created = await apiRequest<{ run: Run; round: Round }>(
      `/api/v1/courses/${courseId}/runs`,
      { ...auth, method: "POST" }
    );
    if (!isCurrentTeacherContext(requestIdentity)) return;
    selectedRunIdRef.current = created.run.run_id;
    setSelectedRunId(created.run.run_id);
    setNotice("run created");
    setBusy(false);
    await refresh(created.run.run_id);
  }

  async function createNextRun(): Promise<void> {
    if (!session || latestRound?.status !== "published") {
      setNotice("latest Run must be published first");
      return;
    }

    const requestIdentity = beginTeacherActionIdentity(
      "course-run-create-next",
      session,
      login.tenantId,
      latestRun?.run_id ?? "",
      latestRound?.round_id ?? ""
    );
    if (!isCurrentTeacherContext(requestIdentity)) return;
    setBusy(true);
    try {
      await createCourseRun(requestIdentity);
    } catch (error) {
      if (isCurrentTeacherContext(requestIdentity)) {
        setNotice(error instanceof Error ? error.message : "run creation failed");
      }
    } finally {
      if (isCurrentTeacherContext(requestIdentity)) {
        setBusy(false);
      }
    }
  }

  async function runNextStep(): Promise<void> {
    if (!session) {
      setNotice("please sign in first");
      return;
    }

    if (selectedRun && !selectedRound) {
      setNotice("当前选择的回合上下文不可用，正式操作已关闭");
      return;
    }

    const requiredAction = getTeacherRoundAction(selectedRound?.status);
    if (
      requiredAction &&
      (workspaceLoadState !== "ready" ||
        !isTeacherRoundActionAllowed(selectedRound?.status, roundControl?.allowed_actions))
    ) {
      setNotice(
        workspaceLoadState === "error"
          ? TEACHER_WORKSPACE_ERROR_REASON
          : workspaceLoadState !== "ready" || !workspace
            ? TEACHER_WORKSPACE_LOADING_REASON
            : `服务端未授权此操作：${requiredAction}`
      );
      return;
    }

    const requestIdentity = beginTeacherActionIdentity(
      requiredAction ?? (selectedRun ? "run-refresh" : "run-create"),
      session,
      login.tenantId,
      selectedRun?.run_id ?? "",
      selectedRound?.round_id ?? ""
    );
    if (!isCurrentTeacherContext(requestIdentity)) return;
    setBusy(true);
    try {
      const auth = { token: session.access_token, tenantId: login.tenantId };
      let preferredRoundId = selectedRound?.round_id ?? null;

      if (!selectedRun) {
        await createCourseRun(requestIdentity);
        return;
      } else if (selectedRound?.status === "draft") {
        await apiRequest(
          getTeacherRoundCommandPath(selectedRun.run_id, selectedRound.round_no, "round:start"),
          {
            ...auth,
            method: "POST"
          }
        );
        if (!isCurrentTeacherContext(requestIdentity)) return;
        setNotice("round opened");
      } else if (selectedRound?.status === "open") {
        if (!hasDecision) {
          if (!isCurrentTeacherContext(requestIdentity)) return;
          setNotice("waiting for learner decision");
        } else {
          await apiRequest(
            getTeacherRoundCommandPath(selectedRun.run_id, selectedRound.round_no, "round:lock"),
            {
              ...auth,
              method: "POST"
            }
          );
          if (!isCurrentTeacherContext(requestIdentity)) return;
          setNotice("round locked");
        }
      } else if (selectedRound?.status === "locked") {
        await apiRequest<SettlementResult>(
          getTeacherRoundCommandPath(
            selectedRun.run_id,
            selectedRound.round_no,
            "settlement:settle"
          ),
          { ...auth, method: "POST" }
        );
        if (!isCurrentTeacherContext(requestIdentity)) return;
        setNotice("settlement completed");
      } else if (selectedRound?.status === "settled") {
        await apiRequest(
          getTeacherRoundCommandPath(selectedRun.run_id, selectedRound.round_no, "round:publish"),
          { ...auth, method: "POST" }
        );
        if (!isCurrentTeacherContext(requestIdentity)) return;
        setNotice("result published");
      } else if (selectedRound?.status === "published") {
        const continuation = await apiRequest<RoundContinuationResult>(
          getTeacherRoundCommandPath(selectedRun.run_id, selectedRound.round_no, "round:continue"),
          { ...auth, method: "POST" }
        );
        if (!isCurrentTeacherContext(requestIdentity)) return;
        preferredRoundId = continuation.round.round_id;
        setNotice("round continued");
      }

      if (!isCurrentTeacherContext(requestIdentity)) return;
      setBusy(false);
      await refresh(selectedRun.run_id, preferredRoundId);
    } catch (error) {
      if (isCurrentTeacherContext(requestIdentity)) {
        setNotice(error instanceof Error ? error.message : "action failed");
      }
    } finally {
      if (isCurrentTeacherContext(requestIdentity)) {
        setBusy(false);
      }
    }
  }

  const loginPanel = (
    <section className="login-strip" aria-label="teacher login">
      <input
        aria-label="tenant"
        value={login.tenantId}
        onChange={(event) => updateLogin("tenantId", event.target.value)}
      />
      <input
        aria-label="username"
        value={login.username}
        onChange={(event) => updateLogin("username", event.target.value)}
      />
      <input
        aria-label="password"
        type="password"
        value={login.password}
        onChange={(event) => updateLogin("password", event.target.value)}
      />
      <button disabled={busy} onClick={() => void signIn()}>
        教师登录
      </button>
      {DEMO_LOGIN_ENABLED ? (
        <button disabled={busy} onClick={() => void signIn(DEMO_LOGIN)}>
          演示登录
        </button>
      ) : null}
    </section>
  );

  if (session && !isTeacher) {
    return (
      <>
        <TeacherPermissionDenied role={session.user.roles.join("、")} />
        {loginPanel}
      </>
    );
  }

  const metrics = [
    ["身份", session?.user.display_name ?? "anonymous"],
    ["课程", courseWorkspace?.visible_state.course_title ?? state?.courses[0]?.title ?? "加载中"],
    ["队伍", `${teacherDashboard?.visible_state.team_count ?? state?.teams.length ?? 0}`],
    [
      "回合",
      selectedRound
        ? `第 ${selectedRound.round_no} 轮 · ${getTeacherRoundStatusLabel(selectedRound.status)}`
        : "尚未创建"
    ],
    [
      "决策",
      roundControl?.visible_state.decision_count ? "已校验" : hasDecision ? "已校验" : "等待提交"
    ],
    ["运行时", runtimeBoundary],
    ["回放（Replay）", replaySummary?.replay_status ?? "等待中"],
    ["前端聚合（BFF）", teacherDashboard?.evidence_label ?? "等待中"]
  ];
  const noticeLabel = getTeacherNoticeLabel(notice);

  const selectedRoundAction = selectedRound ? getTeacherRoundAction(selectedRound.status) : null;
  const selectedRoundActionAllowed = selectedRoundAction
    ? workspaceLoadState === "ready" &&
      isTeacherRoundActionAllowed(selectedRound?.status, roundControl?.allowed_actions)
    : true;
  const nextStepDisabledReason =
    workspaceLoadState === "error"
      ? TEACHER_WORKSPACE_ERROR_REASON
      : workspaceLoadState !== "ready" || !workspace
        ? TEACHER_WORKSPACE_LOADING_REASON
        : selectedRound?.status === "open" && !hasDecision && selectedRoundActionAllowed
          ? "等待学员提交决策"
          : undefined;
  const primaryCommand = selectedRound?.status ? (
    <TeacherNextStepButton
      roundStatus={selectedRound.status}
      allowedActions={roundControl?.allowed_actions ?? []}
      disabled={busy || !workspace || !state || (selectedRound.status === "open" && !hasDecision)}
      {...(nextStepDisabledReason ? { disabledReason: nextStepDisabledReason } : {})}
      loading={busy}
      onClick={() => void runNextStep()}
    >
      {busy ? "处理中" : getRoundAction(selectedRound)}
    </TeacherNextStepButton>
  ) : (
    <button
      className="primary"
      disabled={busy || !session || !state}
      onClick={() => void runNextStep()}
    >
      {busy ? "处理中" : getRoundAction(selectedRound)}
    </button>
  );
  const blockerSummary =
    workspaceLoadState === "error"
      ? TEACHER_WORKSPACE_ERROR_REASON
      : workspaceLoadState !== "ready" || !workspace
        ? TEACHER_WORKSPACE_LOADING_REASON
        : !selectedRound
          ? "当前没有已选择的回合"
          : selectedRoundAction === null
            ? "当前回合没有可用的服务端命令"
            : !selectedRoundActionAllowed
              ? `服务端未授权此操作：${selectedRoundAction}`
              : selectedRound.status === "open" && !hasDecision
                ? "等待学员提交决策"
                : "当前没有已观测的回合阻断";
  const teacherShellState = getTeacherWorkspaceState({
    hasSession: Boolean(session),
    hasState: Boolean(state),
    hasRun: Boolean(selectedRun),
    hasRound: Boolean(selectedRound),
    hasWorkspace: Boolean(workspace),
    workspaceLoadState
  });

  return (
    <TeacherCourseWorkspace
      context={
        session
          ? {
              tenant: session.user.tenant_id,
              session: session.user.user_id,
              role: session.user.roles.join("、"),
              course: courseWorkspace?.visible_state.course_title,
              run: selectedRun?.run_id,
              round: selectedRound?.round_no,
              mode: "教师课程工作区"
            }
          : {}
      }
      authority={session && workspace ? "official" : "unknown"}
      stateStatus={teacherShellState.status}
      stateMessage={teacherShellState.message}
      primaryAction={primaryCommand}
    >
      <TeacherLocation id="teacher-today">
        <header className="topbar">
          <div>
            <p className="eyebrow">教师控制台</p>
            <h1>SimWar M1 教师控制台</h1>
            <span className="official-label">{resultLabel}</span>
            <span className="identity">
              {session ? (
                `${session.user.roles.join(" / ")} · ${login.tenantId}`
              ) : (
                <>
                  尚未登录 <TechnicalCompatibilityLabel>not signed in</TechnicalCompatibilityLabel>
                </>
              )}
            </span>
            <p className="notice" aria-label="教师操作通知" role="status">
              {noticeLabel}
              {noticeLabel !== notice ? (
                <TechnicalCompatibilityLabel>{notice}</TechnicalCompatibilityLabel>
              ) : null}
            </p>
          </div>
          <div className="run-toolbar">
            {courseRuns.length > 0 ? (
              <label className="run-selector">
                <span>运行批次（Run）</span>
                <select
                  aria-label="run selector"
                  disabled={busy || !session}
                  onChange={(event) => {
                    const requestedRunId = event.target.value;
                    const refreshPromise = refresh(requestedRunId);
                    // `refresh(value)` installs the selection identity before its first await.
                    // Capture that exact identity so a later session/run cannot surface its
                    // rejection in the current shell.
                    const selectionIdentity = workspaceRequestIdentityRef.current;
                    const selectionContextIdentity = teacherSessionIdentityRef.current;
                    void refreshPromise.catch((error: unknown) => {
                      const currentWorkspace = workspaceRequestIdentityRef.current;
                      const sameSelection =
                        currentWorkspace.epoch === selectionIdentity.epoch &&
                        currentWorkspace.sessionId === selectionIdentity.sessionId &&
                        currentWorkspace.tenantId === selectionIdentity.tenantId &&
                        currentWorkspace.runId === requestedRunId;
                      if (
                        sameSelection &&
                        isCurrentTeacherSessionContext(selectionContextIdentity)
                      ) {
                        setNotice(
                          getTeacherNoticeLabel(
                            error instanceof Error ? error.message : "run selection failed"
                          )
                        );
                      }
                    });
                  }}
                  value={selectedRun?.run_id ?? ""}
                >
                  {courseRuns.map((run) => {
                    const round = state ? getRunRound(state, run.run_id) : undefined;
                    return (
                      <option key={run.run_id} value={run.run_id}>
                        {run.run_id} ·{" "}
                        {round ? getTeacherRoundStatusLabel(round.status) : run.status}
                      </option>
                    );
                  })}
                </select>
              </label>
            ) : null}
            {selectedRun && state ? (
              <label className="round-selector">
                <span>当前回合</span>
                <select
                  aria-label="round selector"
                  disabled={busy || !session}
                  value={selectedRound?.round_id ?? ""}
                  onChange={(event) => {
                    const requestedRoundId = event.target.value;
                    const refreshPromise = refresh(selectedRun.run_id, requestedRoundId);
                    const selectionIdentity = workspaceRequestIdentityRef.current;
                    const selectionContextIdentity = teacherSessionIdentityRef.current;
                    void refreshPromise.catch((error: unknown) => {
                      const currentWorkspace = workspaceRequestIdentityRef.current;
                      const sameSelection =
                        currentWorkspace.epoch === selectionIdentity.epoch &&
                        currentWorkspace.sessionId === selectionIdentity.sessionId &&
                        currentWorkspace.tenantId === selectionIdentity.tenantId &&
                        currentWorkspace.runId === selectedRun.run_id &&
                        currentWorkspace.roundId === requestedRoundId;
                      if (
                        sameSelection &&
                        isCurrentTeacherSessionContext(selectionContextIdentity)
                      ) {
                        setNotice(
                          getTeacherNoticeLabel(
                            error instanceof Error ? error.message : "round selection failed"
                          )
                        );
                      }
                    });
                  }}
                >
                  {getTeacherRunRounds(
                    state.rounds,
                    selectedRun.run_id,
                    login.tenantId || undefined
                  ).map((round) => (
                    <option key={round.round_id} value={round.round_id}>
                      第 {round.round_no} 轮 · {getTeacherRoundStatusLabel(round.status)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {selectedRound?.status === "published" ? (
              <span className="run-readonly">
                历史 Run · 只读{" "}
                <TechnicalCompatibilityLabel>
                  Historical Run · read-only
                </TechnicalCompatibilityLabel>
              </span>
            ) : null}
            {session && latestRound?.status === "published" ? (
              <button
                className="secondary"
                aria-label="Create Next Run"
                disabled={busy}
                onClick={() => void createNextRun()}
              >
                创建下一 Run
              </button>
            ) : null}
          </div>
        </header>

        {loginPanel}

        <section className="metrics" aria-label="M1 回合状态">
          {metrics.map(([label, value]) => (
            <article className="metric" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </section>
      </TeacherLocation>

      <TeacherLocation id="teacher-readiness">
        {isTeacher && session ? (
          <GoldenJourneyWorkbench
            courseId={selectedRun?.course_id ?? selectedCourseId}
            runId={selectedRun?.run_id ?? selectedRunId}
            tenantId={login.tenantId}
            token={session.access_token}
          />
        ) : null}
      </TeacherLocation>

      <TeacherLocation id="teacher-w5-governed-model">
        {isTeacher && session ? (
          <W5GovernedModelStudio
            apiBase={API_BASE}
            courseId={selectedRun?.course_id ?? selectedCourseId}
            runId={selectedRun?.run_id ?? selectedRunId}
            roundNo={selectedRound?.round_no}
            tenantId={login.tenantId}
            token={session.access_token}
          />
        ) : null}
      </TeacherLocation>

      <TeacherLocation id="teacher-validation">
        {isTeacher && session ? (
          <ValidationSessionWorkbench
            apiBase={API_BASE}
            courseId={selectedRun?.course_id ?? selectedCourseId}
            runId={selectedRun?.run_id ?? selectedRunId}
            tenantId={login.tenantId}
            token={session.access_token}
            teacherUserId={session.user.user_id}
            teams={
              state?.teams.filter(
                (candidate) => candidate.course_id === (selectedRun?.course_id ?? selectedCourseId)
              ) ?? []
            }
          />
        ) : null}
      </TeacherLocation>

      <TeacherLocation id="teacher-blockers">
        <StatePanel
          status={selectedRoundActionAllowed ? "ready" : "blocked"}
          message={blockerSummary}
        />
        <section className="known-limits-disclosure" aria-label="known limits product disclosure">
          <p className="eyebrow">内部使用边界</p>
          <h2>已知限制与内部使用说明</h2>
          <p>{knownLimits.summary}</p>
          <details>
            <summary>查看完整限制</summary>
            <p className="policy-version">Policy {knownLimits.policy_version}</p>
            <ul>
              {knownLimits.items.map((item) => (
                <li key={item.semantic_id}>
                  <strong>
                    {item.semantic_id} · {item.title}
                  </strong>
                  <span>{item.role_note ?? item.description}</span>
                </li>
              ))}
            </ul>
          </details>
        </section>
      </TeacherLocation>

      <TeacherLocation id="teacher-evidence">
        {isTeacher && session ? (
          <EvidenceWorkbench
            availablePackages={
              coursePackageList.phase === "READY" ? coursePackageList.packages : []
            }
            tenantId={login.tenantId}
            token={session.access_token}
          />
        ) : null}
        {isTeacher && session ? (
          <TeacherConfirmationWorkbench tenantId={login.tenantId} token={session.access_token} />
        ) : null}
      </TeacherLocation>
      <TeacherLocation id="teacher-reports">
        {isTeacher && session ? (
          <D5ExportWorkbench
            apiBase={API_BASE}
            tenantId={login.tenantId}
            token={session.access_token}
          />
        ) : null}
        {isTeacher ? (
          <CourseReportBuilder
            sessionKey={`${session?.access_token ?? ""}:${login.tenantId}`}
            tenantId={login.tenantId}
            token={session?.access_token ?? ""}
          />
        ) : null}
        {isTeacher && session ? (
          <TransferResearchWorkbench
            apiBase={API_BASE}
            tenantId={login.tenantId}
            token={session.access_token}
            surface="teacher"
          />
        ) : null}
      </TeacherLocation>

      <TeacherLocation id="teacher-courses">
        {isTeacher && session ? (
          <section className="candidate-surface" aria-label="D1 Learning Design entry point">
            <div className="candidate-heading">
              <div>
                <p className="eyebrow">L1+ 课程计划 · D1</p>
                <h2>
                  学习目标与评分量规{" "}
                  <TechnicalCompatibilityLabel>
                    Learning Goals &amp; Rubrics
                  </TechnicalCompatibilityLabel>
                </h2>
              </div>
              <button
                className="secondary"
                aria-label={showLearningDesign ? "Close D1 Workbench" : "Open D1 Workbench"}
                onClick={() => setShowLearningDesign((visible) => !visible)}
              >
                {showLearningDesign ? "关闭 D1 工作台" : "打开 D1 工作台"}
              </button>
            </div>
            {showLearningDesign ? (
              <LearningDesignWorkbench tenantId={login.tenantId} token={session.access_token} />
            ) : (
              <p className="evidence-note">
                打开 D1 工作台以创建不可变的 LearningGoalVersion 与 RubricVersion 记录。
              </p>
            )}
          </section>
        ) : null}

        {isTeacher ? (
          <section
            className="candidate-surface course-package-catalog"
            aria-label="Teacher CoursePackageVersion catalog"
          >
            <div className="candidate-heading">
              <div>
                <p className="eyebrow">教师安全投影</p>
                <h2>
                  可用 CoursePackageVersions{" "}
                  <TechnicalCompatibilityLabel>
                    Available CoursePackageVersions
                  </TechnicalCompatibilityLabel>
                </h2>
              </div>
              <button
                className="secondary"
                aria-label="Refresh CoursePackageVersions"
                disabled={busy || coursePackageList.phase === "LOADING"}
                onClick={() => void refreshTeacherCoursePackages()}
              >
                刷新 CoursePackageVersions
              </button>
            </div>
            <p className="evidence-note">
              只读 AVAILABLE 教学包。依赖检查、digest
              校验、兼容性、生命周期、导入、导出与源权威均由服务端负责。
            </p>
            {coursePackageList.phase === "LOADING" ? (
              <p className="evidence-note" role="status">
                正在加载 CoursePackageVersions{" "}
                <TechnicalCompatibilityLabel>
                  Loading CoursePackageVersions
                </TechnicalCompatibilityLabel>
              </p>
            ) : null}
            {coursePackageList.phase === "ERROR" ? (
              <p className="readiness-message" role="alert">
                {coursePackageList.message}{" "}
                <TechnicalCompatibilityLabel>
                  {coursePackageList.surfaceState}
                </TechnicalCompatibilityLabel>
              </p>
            ) : null}
            {coursePackageList.phase === "READY" && coursePackageList.packages.length === 0 ? (
              <p className="evidence-note">
                当前没有可用 CoursePackageVersions。{" "}
                <TechnicalCompatibilityLabel>
                  No available CoursePackageVersions.
                </TechnicalCompatibilityLabel>
              </p>
            ) : null}
            {coursePackageList.phase === "READY" && coursePackageList.packages.length > 0 ? (
              <div className="candidate-list">
                {coursePackageList.packages.map((coursePackage) => (
                  <article
                    className="candidate-card"
                    key={coursePackage.course_package_reference.content_digest}
                  >
                    <span>
                      可用（AVAILABLE）{" "}
                      <TechnicalCompatibilityLabel>AVAILABLE</TechnicalCompatibilityLabel>
                    </span>
                    <strong>{coursePackage.title}</strong>
                    <small>
                      {coursePackage.course_package_reference.course_package_id} /{" "}
                      {coursePackage.course_package_reference.version}
                    </small>
                    <p>{coursePackage.description}</p>
                    <small>
                      CourseBlueprint {coursePackage.course_blueprint_reference.course_blueprint_id}{" "}
                      / {coursePackage.course_blueprint_reference.version}
                    </small>
                    <small>
                      ScenarioPackage {coursePackage.scenario_package_reference.scenario_package_id}{" "}
                      / {coursePackage.scenario_package_reference.version}
                    </small>
                    <small>
                      ParameterSet {coursePackage.parameter_set_reference.parameter_set_id} /{" "}
                      {coursePackage.parameter_set_reference.version}
                    </small>
                    <button
                      className="secondary"
                      aria-label={`Clone ${coursePackage.course_package_reference.course_package_id} as a new Course Package version`}
                      disabled={busy}
                      onClick={() => beginTeacherCoursePackageClone(coursePackage)}
                    >
                      <span aria-hidden="true">
                        克隆 {coursePackage.course_package_reference.course_package_id}{" "}
                        为新课程包版本
                      </span>
                    </button>
                  </article>
                ))}
              </div>
            ) : null}
            {teacherCoursePackageCloneSource ? (
              <section
                className="candidate-preview"
                aria-label="Teacher CoursePackageVersion clone"
              >
                <span>
                  创建课程包新版本{" "}
                  <TechnicalCompatibilityLabel>
                    Clone a new Course Package version
                  </TechnicalCompatibilityLabel>
                </span>
                <strong>
                  来源 {teacherCoursePackageCloneSource.course_package_reference.course_package_id}{" "}
                  / {teacherCoursePackageCloneSource.course_package_reference.version}
                </strong>
                <small>租户与操作者由服务端推导，并创建 DRAFT 生命周期记录。</small>
                <label>
                  课程包 ID{" "}
                  <TechnicalCompatibilityLabel>new Course Package ID</TechnicalCompatibilityLabel>
                  <input
                    aria-label="new Course Package ID"
                    value={teacherCoursePackageCloneForm.coursePackageId}
                    onChange={(event) =>
                      updateTeacherCoursePackageClone("coursePackageId", event.target.value)
                    }
                  />
                </label>
                <label>
                  课程包版本{" "}
                  <TechnicalCompatibilityLabel>
                    new Course Package version
                  </TechnicalCompatibilityLabel>
                  <input
                    aria-label="new Course Package version"
                    value={teacherCoursePackageCloneForm.version}
                    onChange={(event) =>
                      updateTeacherCoursePackageClone("version", event.target.value)
                    }
                  />
                </label>
                <label>
                  课程包标题{" "}
                  <TechnicalCompatibilityLabel>
                    new Course Package title
                  </TechnicalCompatibilityLabel>
                  <input
                    aria-label="new Course Package title"
                    value={teacherCoursePackageCloneForm.title}
                    onChange={(event) =>
                      updateTeacherCoursePackageClone("title", event.target.value)
                    }
                  />
                </label>
                <label>
                  课程包描述{" "}
                  <TechnicalCompatibilityLabel>
                    new Course Package description
                  </TechnicalCompatibilityLabel>
                  <input
                    aria-label="new Course Package description"
                    value={teacherCoursePackageCloneForm.description}
                    onChange={(event) =>
                      updateTeacherCoursePackageClone("description", event.target.value)
                    }
                  />
                </label>
                <button
                  aria-label="Clone Course Package version"
                  disabled={busy}
                  onClick={() => void cloneTeacherCoursePackageVersion()}
                >
                  克隆课程包版本
                </button>
              </section>
            ) : null}
            {teacherCoursePackageCloneError ? (
              <p className="readiness-message" role="alert">
                {teacherCoursePackageCloneError}
              </p>
            ) : null}
            {teacherCoursePackageCloneReceipt ? (
              <article
                className="candidate-preview"
                aria-label="Teacher CoursePackageVersion clone receipt"
              >
                <span>
                  新课程包版本回执{" "}
                  <TechnicalCompatibilityLabel>
                    Course Package version receipt
                  </TechnicalCompatibilityLabel>
                </span>
                <strong>
                  {teacherCoursePackageCloneReceipt.course_package_reference.course_package_id} /{" "}
                  {teacherCoursePackageCloneReceipt.course_package_reference.version}
                </strong>
                <p>
                  已由服务端创建新的不可变 CoursePackageVersion DRAFT。{" "}
                  <TechnicalCompatibilityLabel>
                    A new immutable CoursePackageVersion was created as a server-owned DRAFT.
                  </TechnicalCompatibilityLabel>
                </p>
                <p>
                  未创建 Course 或 Run。{" "}
                  <TechnicalCompatibilityLabel>
                    No Course or Run was created.
                  </TechnicalCompatibilityLabel>
                </p>
              </article>
            ) : null}
          </section>
        ) : null}
        {session ? (
          <section
            className="candidate-surface studio-surface"
            aria-label="Teacher Blueprint Studio"
          >
            <div className="candidate-heading">
              <h2>
                Blueprint 编辑工作台{" "}
                <TechnicalCompatibilityLabel>Teacher Blueprint Studio</TechnicalCompatibilityLabel>
              </h2>
              <span>{courseBlueprintStudioStatus}</span>
            </div>
            {courseBlueprintCatalog.phase === "READY" ? (
              <div className="studio-source-list">
                {courseBlueprintCatalog.response.candidates.map((blueprint) => (
                  <button
                    className="secondary"
                    aria-label="Edit new version"
                    disabled={busy}
                    key={`studio-${blueprint.course_blueprint_reference.content_digest}`}
                    onClick={() => void beginCourseBlueprintStudio(blueprint)}
                  >
                    编辑新版本
                  </button>
                ))}
              </div>
            ) : null}
            {courseBlueprintStudioForm ? (
              <div className="studio-form">
                <label className="field-label">
                  <span>课程蓝图版本</span>
                  <input
                    aria-label="Blueprint version"
                    disabled={busy || courseBlueprintStudioStatus === "VALIDATED"}
                    value={courseBlueprintStudioForm.version}
                    onChange={(event) =>
                      updateCourseBlueprintStudioForm("version", event.target.value)
                    }
                  />
                </label>
                <label className="field-label">
                  <span>课程蓝图标题</span>
                  <input
                    aria-label="Blueprint title"
                    disabled={busy || courseBlueprintStudioStatus === "VALIDATED"}
                    value={courseBlueprintStudioForm.title}
                    onChange={(event) =>
                      updateCourseBlueprintStudioForm("title", event.target.value)
                    }
                  />
                </label>
                <label className="field-label studio-description">
                  <span>课程蓝图描述</span>
                  <textarea
                    aria-label="Blueprint description"
                    disabled={busy || courseBlueprintStudioStatus === "VALIDATED"}
                    value={courseBlueprintStudioForm.description}
                    onChange={(event) =>
                      updateCourseBlueprintStudioForm("description", event.target.value)
                    }
                  />
                </label>
                <div className="studio-actions">
                  <button
                    className="primary"
                    aria-label="Save immutable draft"
                    disabled={
                      busy ||
                      courseBlueprintStudioStatus === "DRAFT" ||
                      courseBlueprintStudioStatus === "VALIDATED" ||
                      !courseBlueprintStudioForm.version.trim() ||
                      !courseBlueprintStudioForm.title.trim() ||
                      !courseBlueprintStudioForm.description.trim()
                    }
                    onClick={() => void saveCourseBlueprintStudioDraft()}
                  >
                    <span aria-hidden="true">保存不可变草稿</span>
                  </button>
                  <button
                    className="secondary"
                    aria-label="Submit draft for validation"
                    disabled={busy || courseBlueprintStudioStatus !== "DRAFT"}
                    onClick={() => void submitCourseBlueprintStudioDraft()}
                  >
                    提交草稿进行校验
                  </button>
                </div>
                {courseBlueprintStudioPreview ? (
                  <div className="studio-receipt" role="status">
                    <strong>{courseBlueprintStudioStatus}</strong>
                    <code>{courseBlueprintStudioPreview.content_digest}</code>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="teaching-pack" aria-label="M1 teaching product package">
          <article className="panel teaching-panel">
            <div className="panel-title">
              <h2>{teachingPackage.courseBlueprint.timing}</h2>
              <span>{teachingPackage.courseBlueprint.title}</span>
            </div>
            <p className="package-brief">{teachingPackage.instructorKit.briefing}</p>
            <div className="phase-list">
              {teachingPackage.courseBlueprint.phases.map((phase) => (
                <div className="phase-row" key={phase.label}>
                  <span>{phase.label}</span>
                  <strong>{phase.title}</strong>
                  <p>{phase.guidance}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="panel teaching-panel">
            <div className="panel-title">
              <h2>教师操作清单</h2>
              <span>{teachingPackage.instructorKit.title}</span>
            </div>
            <ul className="compact-list">
              {teachingPackage.instructorKit.operationChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3>回合指导语</h3>
            <ul className="compact-list">
              {teachingPackage.instructorKit.roundScript.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="panel teaching-panel">
            <div className="panel-title">
              <h2>最小学习证据 Rubric</h2>
              <span>{teachingPackage.minimumAssessmentEvidence.title}</span>
            </div>
            <div className="rubric-list">
              {teachingPackage.minimumAssessmentEvidence.rubric.map((item) => (
                <div className="rubric-row" key={item.dimension}>
                  <strong>{item.dimension}</strong>
                  <p>{item.evidence}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        {workspace ? (
          <section className="bff-surface" aria-label="teacher bff dto surface">
            <article className="panel bff-panel">
              <div className="panel-title">
                <h2>BFF 教师工作台</h2>
                <span>{teacherDashboard?.evidence_label}</span>
              </div>
              <div className="status-grid">
                <div>
                  <span>课程</span>
                  <strong>{courseWorkspace?.visible_state.course_title}</strong>
                </div>
                <div>
                  <span>运行批次（Run）</span>
                  <strong>{courseWorkspace?.visible_state.run_status}</strong>
                </div>
                <div>
                  <span>队伍</span>
                  <strong>{teacherDashboard?.visible_state.team_count}</strong>
                </div>
              </div>
              <p className="evidence-note">{courseWorkspace?.evidence_label}</p>
              <ul className="tag-list">
                {teacherDashboard?.allowed_actions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </article>

            {session ? (
              <article className="panel readiness-panel" aria-label="scenario readiness">
                <div className="panel-title">
                  <h2>
                    场景就绪检查{" "}
                    <TechnicalCompatibilityLabel>Scenario Readiness</TechnicalCompatibilityLabel>
                  </h2>
                  <TeacherPhaseText value={scenarioReadiness.phase} />
                </div>
                <p className="evidence-note">当前 Run：{selectedRun?.run_id ?? "未选择"}</p>
                <section className="candidate-surface" aria-label="scenario package candidates">
                  <div className="candidate-heading">
                    <h3>ScenarioPackage 候选</h3>
                    <TeacherPhaseText value={scenarioCandidates.phase} />
                  </div>
                  {scenarioCandidates.phase === "LOADING" ? (
                    <p className="evidence-note" role="status">
                      正在加载 Scenario 候选{" "}
                      <TechnicalCompatibilityLabel>
                        Loading Scenario candidates
                      </TechnicalCompatibilityLabel>
                    </p>
                  ) : null}
                  {scenarioCandidates.phase === "ERROR" ? (
                    <p className="readiness-message" role="status">
                      {scenarioCandidates.message}{" "}
                      {scenarioCandidates.compatibilityMessage ? (
                        <TechnicalCompatibilityLabel>
                          {scenarioCandidates.compatibilityMessage}
                        </TechnicalCompatibilityLabel>
                      ) : null}
                    </p>
                  ) : null}
                  {scenarioCandidates.phase === "READY" ? (
                    <>
                      {scenarioCandidates.response.candidates.length === 0 ? (
                        <p className="evidence-note">
                          当前没有可用 ScenarioPackage 候选。{" "}
                          <TechnicalCompatibilityLabel>
                            No ScenarioPackage candidates available.
                          </TechnicalCompatibilityLabel>
                        </p>
                      ) : (
                        <div className="candidate-list">
                          {scenarioCandidates.response.candidates.map((candidate) =>
                            candidate.is_current ? (
                              <article
                                className="candidate-card current-candidate"
                                key={candidate.scenario_package_id}
                              >
                                <span>
                                  当前 ScenarioPackage{" "}
                                  <TechnicalCompatibilityLabel>
                                    Current ScenarioPackage
                                  </TechnicalCompatibilityLabel>
                                </span>
                                <strong>{candidate.display_name}</strong>
                                <small>{candidate.version_label}</small>
                              </article>
                            ) : (
                              <article
                                className="candidate-card"
                                key={candidate.scenario_package_id}
                              >
                                <span>候选项</span>
                                <strong>{candidate.display_name}</strong>
                                <small>{candidate.version_label}</small>
                                <button
                                  aria-label={`Preview ${candidate.display_name}`}
                                  onClick={() => setPreviewCandidate(candidate)}
                                >
                                  预览 {candidate.display_name}
                                </button>
                              </article>
                            )
                          )}
                        </div>
                      )}
                      {previewCandidate ? (
                        <article
                          className="candidate-preview"
                          aria-label="scenario candidate local preview"
                        >
                          <span>
                            候选预览{" "}
                            <TechnicalCompatibilityLabel>
                              Preview Candidate
                            </TechnicalCompatibilityLabel>
                          </span>
                          <strong>{previewCandidate.display_name}</strong>
                          <small>{previewCandidate.version_label}</small>
                          <p>仅本地预览，不会修改当前 Run</p>
                        </article>
                      ) : null}
                    </>
                  ) : null}
                </section>
                <section className="candidate-surface" aria-label="formal CourseBlueprint catalog">
                  <div className="candidate-heading">
                    <h3>正式 CourseBlueprint 目录</h3>
                    <TeacherPhaseText value={courseBlueprintCatalog.phase} />
                  </div>
                  {courseBlueprintCatalog.phase === "LOADING" ? (
                    <p className="evidence-note">正在加载已批准的 CourseBlueprint</p>
                  ) : null}
                  {courseBlueprintCatalog.phase === "ERROR" ? (
                    <p className="readiness-message">
                      {courseBlueprintCatalog.message}{" "}
                      {courseBlueprintCatalog.compatibilityMessage ? (
                        <TechnicalCompatibilityLabel>
                          {courseBlueprintCatalog.compatibilityMessage}
                        </TechnicalCompatibilityLabel>
                      ) : null}
                    </p>
                  ) : null}
                  {courseBlueprintCatalog.phase === "READY" ? (
                    <>
                      {courseBlueprintCatalog.response.candidates.length === 0 ? (
                        <p className="evidence-note">当前没有已批准的 CourseBlueprint。</p>
                      ) : (
                        <div className="candidate-list">
                          {courseBlueprintCatalog.response.candidates.map((blueprint) => (
                            <article
                              className="candidate-card"
                              key={blueprint.course_blueprint_reference.content_digest}
                            >
                              <span>
                                <TeacherStatusText value={blueprint.status} />
                              </span>
                              <strong>{blueprint.title}</strong>
                              <small>
                                {blueprint.course_blueprint_reference.version} /{" "}
                                {blueprint.duration_minutes} 分钟
                              </small>
                              <button
                                aria-label="Select locally"
                                onClick={() => void selectCourseBlueprintLocally(blueprint)}
                                disabled={busy}
                              >
                                本地选择
                              </button>
                            </article>
                          ))}
                        </div>
                      )}
                      {selectedCourseBlueprint ? (
                        <article
                          className="candidate-preview"
                          aria-label="CourseBlueprint local selection"
                        >
                          <span>
                            本地选择，仅供预览{" "}
                            <TechnicalCompatibilityLabel>
                              LOCAL_SELECTION_ONLY
                            </TechnicalCompatibilityLabel>
                          </span>
                          <strong>{selectedCourseBlueprint.title}</strong>
                          <small>
                            尚未写入课程{" "}
                            <TechnicalCompatibilityLabel>
                              NO_COURSE_WRITE_YET
                            </TechnicalCompatibilityLabel>
                          </small>
                          {courseBlueprintReadiness ? (
                            <small>
                              服务端精确就绪：已就绪{" "}
                              <TechnicalCompatibilityLabel>
                                Exact server-side readiness: READY
                              </TechnicalCompatibilityLabel>
                            </small>
                          ) : null}
                        </article>
                      ) : null}
                    </>
                  ) : null}
                </section>
                <section className="candidate-surface" aria-label="formal ScenarioPackage catalog">
                  <div className="candidate-heading">
                    <h3>正式 ScenarioPackage 目录</h3>
                    <TeacherPhaseText value={formalScenarioCatalog.phase} />
                  </div>
                  {formalScenarioCatalog.phase === "LOADING" ? (
                    <p className="evidence-note" role="status">
                      正在加载已批准的正式 ScenarioPackage
                    </p>
                  ) : null}
                  {formalScenarioCatalog.phase === "ERROR" ? (
                    <p className="readiness-message" role="status">
                      {formalScenarioCatalog.message}{" "}
                      {formalScenarioCatalog.compatibilityMessage ? (
                        <TechnicalCompatibilityLabel>
                          {formalScenarioCatalog.compatibilityMessage}
                        </TechnicalCompatibilityLabel>
                      ) : null}
                    </p>
                  ) : null}
                  {formalScenarioCatalog.phase === "READY" ? (
                    <>
                      {formalScenarioCatalog.response.candidates.length === 0 ? (
                        <p className="evidence-note">当前没有已批准的正式 ScenarioPackage。</p>
                      ) : (
                        <div className="candidate-list">
                          {formalScenarioCatalog.response.candidates.map((candidate) => (
                            <article
                              className="candidate-card"
                              key={candidate.scenario_package_reference.content_digest}
                            >
                              <span>
                                <TeacherStatusText value={candidate.status} />
                              </span>
                              <strong>
                                {candidate.scenario_package_reference.scenario_package_id}
                              </strong>
                              <small>
                                {candidate.scenario_package_reference.version} /{" "}
                                {candidate.schema_version}
                              </small>
                              <small>
                                参数集 {candidate.parameter_set_reference.parameter_set_id} /{" "}
                                {candidate.parameter_set_reference.version}{" "}
                                <TechnicalCompatibilityLabel>
                                  ParameterSet
                                </TechnicalCompatibilityLabel>
                              </small>
                              <button
                                aria-label="Prepare formal Course"
                                onClick={() => prepareFormalCourse(candidate)}
                                disabled={busy}
                              >
                                准备正式 Course
                              </button>
                            </article>
                          ))}
                        </div>
                      )}
                      {formalDraftCandidate ? (
                        <article
                          className="candidate-preview"
                          aria-label="formal ScenarioPackage Course selection"
                        >
                          <span>
                            教师选择预览{" "}
                            <TechnicalCompatibilityLabel>
                              Teacher selection preview
                            </TechnicalCompatibilityLabel>
                          </span>
                          <strong>
                            {formalDraftCandidate.scenario_package_reference.scenario_package_id} /{" "}
                            {formalDraftCandidate.scenario_package_reference.version}
                          </strong>
                          <small>
                            场景摘要：{" "}
                            {formalDraftCandidate.scenario_package_reference.content_digest}{" "}
                            <TechnicalCompatibilityLabel>
                              Scenario digest
                            </TechnicalCompatibilityLabel>
                          </small>
                          <small>
                            参数集摘要：{" "}
                            {formalDraftCandidate.parameter_set_reference.content_digest}{" "}
                            <TechnicalCompatibilityLabel>
                              ParameterSet digest
                            </TechnicalCompatibilityLabel>
                          </small>
                          {formalBindingPreview ? (
                            <>
                              <small>
                                引擎： {formalBindingPreview.engine_profile.engine_id} /{" "}
                                {formalBindingPreview.engine_profile.version}{" "}
                                <TechnicalCompatibilityLabel>Engine</TechnicalCompatibilityLabel>
                              </small>
                              <small>{formalBindingPreview.engine_profile.runtime_authority}</small>
                              <label>
                                正式 Course 标题
                                <input
                                  aria-label="formal Course title"
                                  value={formalCourseTitle}
                                  onChange={(event) => setFormalCourseTitle(event.target.value)}
                                />
                              </label>
                              <button
                                aria-label="Create formal Course"
                                onClick={() => void createFormalCourse()}
                                disabled={busy}
                              >
                                创建正式 Course
                              </button>
                            </>
                          ) : (
                            <p>正在解析服务端正式绑定预览。</p>
                          )}
                        </article>
                      ) : null}
                      {selectedCourseId && formalBindingPreview ? (
                        <article className="candidate-preview" aria-label="formal Run creation">
                          <span>
                            已选择正式课程： {selectedCourseId}{" "}
                            <TechnicalCompatibilityLabel>
                              Selected formal Course
                            </TechnicalCompatibilityLabel>
                          </span>
                          {formalCoursePublished ? (
                            <>
                              <label>
                                显式 Run seed
                                <input
                                  aria-label="explicit Run seed"
                                  inputMode="numeric"
                                  value={formalRunSeed}
                                  onChange={(event) => setFormalRunSeed(event.target.value)}
                                />
                              </label>
                              <button
                                aria-label="Create formal Run"
                                onClick={() => void createFormalCourseRun()}
                                disabled={busy}
                              >
                                创建正式 Run
                              </button>
                            </>
                          ) : (
                            <button
                              aria-label="Publish formal Course"
                              onClick={() => void publishFormalCourse()}
                              disabled={busy}
                            >
                              发布正式 Course
                            </button>
                          )}
                        </article>
                      ) : null}
                      <ul className="tag-list">
                        {formalScenarioCatalog.response.explicit_non_proofs.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </section>
                <label className="field-label">
                  ScenarioPackage ID
                  <input
                    aria-label="scenario package id"
                    disabled={scenarioReadiness.phase === "LOADING"}
                    onChange={(event) =>
                      updateScenarioReadinessForm("scenarioPackageId", event.target.value)
                    }
                    value={scenarioReadinessForm.scenarioPackageId}
                  />
                </label>
                <label className="field-label">
                  ParameterSet ID
                  <input
                    aria-label="parameter set id"
                    disabled={scenarioReadiness.phase === "LOADING"}
                    onChange={(event) =>
                      updateScenarioReadinessForm("parameterSetId", event.target.value)
                    }
                    value={scenarioReadinessForm.parameterSetId}
                  />
                </label>
                <button
                  aria-label="Check readiness"
                  disabled={scenarioReadiness.phase === "LOADING"}
                  onClick={() => void checkScenarioReadiness()}
                >
                  {scenarioReadiness.phase === "LOADING" ? "正在检查就绪状态" : "检查就绪状态"}
                </button>
                {scenarioReadiness.phase === "INVALID_REQUEST" ||
                scenarioReadiness.phase === "UNAUTHENTICATED" ||
                scenarioReadiness.phase === "UNAUTHORIZED" ||
                scenarioReadiness.phase === "NOT_FOUND_OR_OUT_OF_SCOPE" ||
                scenarioReadiness.phase === "INTERNAL_ERROR" ? (
                  <p className="readiness-message" role="status">
                    {scenarioReadiness.message}{" "}
                    {scenarioReadiness.compatibilityMessage ? (
                      <TechnicalCompatibilityLabel>
                        {scenarioReadiness.compatibilityMessage}
                      </TechnicalCompatibilityLabel>
                    ) : null}
                  </p>
                ) : null}
                {scenarioReadiness.phase === "READY" || scenarioReadiness.phase === "BLOCKED" ? (
                  <div className="readiness-result">
                    <strong>
                      <TeacherStatusText value={scenarioReadiness.response.readiness_status} />
                    </strong>
                    <div className="status-grid">
                      <div>
                        <span>兼容性</span>
                        <strong>
                          <TeacherStatusText
                            value={scenarioReadiness.response.compatibility_status}
                          />
                        </strong>
                      </div>
                      <div>
                        <span>来源</span>
                        <strong>
                          <TeacherStatusText value={scenarioReadiness.response.provenance_status} />
                        </strong>
                      </div>
                      <div>
                        <span>质量验证（QA）</span>
                        <strong>
                          <TeacherStatusText value={scenarioReadiness.response.qa_status} />
                        </strong>
                      </div>
                      <div>
                        <span>许可证</span>
                        <strong>
                          <TeacherStatusText value={scenarioReadiness.response.license_status} />
                        </strong>
                      </div>
                      <div>
                        <span>校准</span>
                        <strong>
                          <TeacherStatusText
                            value={scenarioReadiness.response.calibration_status}
                          />
                        </strong>
                      </div>
                      <div>
                        <span>运行时适配器</span>
                        <strong>
                          <TeacherStatusText
                            value={scenarioReadiness.response.runtime_adapter_status}
                          />
                        </strong>
                      </div>
                    </div>
                    <p className="evidence-note">
                      证据新鲜度：{" "}
                      {scenarioReadiness.response.evidence_freshness.collected_at ?? "暂不可用"}{" "}
                      {!scenarioReadiness.response.evidence_freshness.collected_at ? (
                        <TechnicalCompatibilityLabel>unavailable</TechnicalCompatibilityLabel>
                      ) : null}
                    </p>
                    {scenarioReadiness.response.no_go_reasons.length > 0 ? (
                      <ul className="tag-list">
                        {scenarioReadiness.response.no_go_reasons.map((reason) => (
                          <li key={reason}>
                            阻断条件{" "}
                            <TechnicalCompatibilityLabel>{reason}</TechnicalCompatibilityLabel>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <ul className="tag-list">
                      {scenarioReadiness.response.explicit_non_proofs.map((item) => (
                        <li key={item}>
                          服务端限制{" "}
                          <TechnicalCompatibilityLabel>{item}</TechnicalCompatibilityLabel>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <section className="known-limits" aria-label="known limits">
                  <h3>
                    已知限制 <TechnicalCompatibilityLabel>Known limits</TechnicalCompatibilityLabel>
                  </h3>
                  <ul className="compact-list">
                    {SCENARIO_READINESS_KNOWN_LIMITS.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              </article>
            ) : null}
          </section>
        ) : null}
      </TeacherLocation>

      <TeacherLocation id="teacher-round-control">
        <article className="panel bff-panel" aria-label="BFF 回合控制">
          <div className="panel-title">
            <h2>BFF 回合控制</h2>
            <span>{roundControl?.evidence_label}</span>
          </div>
          <div className="status-grid">
            <div>
              <span>回合</span>
              <strong>
                {roundControl?.round_no ? `第 ${roundControl.round_no} 轮` : "未选择"}
              </strong>
            </div>
            <div>
              <span>状态</span>
              <strong>
                {roundControl?.status ? getTeacherRoundStatusLabel(roundControl.status) : "未加载"}
              </strong>
            </div>
            <div>
              <span>结算</span>
              <strong>
                {roundControl?.visible_state.settlement_available ? "可用" : "等待中"}
              </strong>
            </div>
          </div>
          <p className="evidence-note">
            决策 {roundControl?.visible_state.decision_count} / 队伍{" "}
            {roundControl?.visible_state.team_count}
          </p>
        </article>
      </TeacherLocation>

      <TeacherLocation id="teacher-teams-roles">
        {session && selectedRun && selectedRound ? (
          <W4EnterpriseStateWorkbench
            courseId={selectedRun.course_id}
            roundId={selectedRound.round_id}
            roundNo={selectedRound.round_no}
            runId={selectedRun.run_id}
            teamId={
              state?.teams.find((candidate) => candidate.course_id === selectedRun.course_id)
                ?.team_id
            }
            tenantId={login.tenantId}
            token={session.access_token}
          />
        ) : null}
        {isTeacher && session ? (
          <FreshLearnerAdmissionPanel
            apiBase={API_BASE}
            courseId={selectedRun?.course_id}
            runId={selectedRun?.run_id}
            teamIds={
              state?.teams
                .filter((candidate) => candidate.course_id === selectedRun?.course_id)
                .map((candidate) => candidate.team_id) ?? []
            }
            tenantId={login.tenantId}
            token={session.access_token}
          />
        ) : null}
        {session ? (
          <RoleWorkflowPanel
            active={selectedRound?.status === "open"}
            courseId={selectedRun?.course_id}
            disabled={busy || selectedRound?.status !== "open"}
            roundId={selectedRound?.round_id}
            runId={selectedRun?.run_id}
            teams={
              state?.teams.filter((candidate) => candidate.course_id === selectedRun?.course_id) ??
              []
            }
            tenantId={login.tenantId}
            token={session.access_token}
          />
        ) : null}
        {session ? (
          <W027DecisionExperiencePanel
            active={selectedRound?.status === "open"}
            courseId={selectedRun?.course_id}
            roundId={selectedRound?.round_id}
            runId={selectedRun?.run_id}
            teams={
              state?.teams.filter((candidate) => candidate.course_id === selectedRun?.course_id) ??
              []
            }
            tenantId={login.tenantId}
            token={session.access_token}
          />
        ) : null}
        {workspace ? (
          <article className="panel bff-panel" aria-label="BFF 队伍监控">
            <div className="panel-title">
              <h2>BFF 队伍监控</h2>
              <span>{teamMonitor?.evidence_label}</span>
            </div>
            <div className="table">
              {teamMonitor?.teams.map((team) => (
                <div className="table-row" key={team.team_id}>
                  <span>{team.team_name}</span>
                  <span>{team.members} 位成员</span>
                  <strong>{team.decision_submitted ? "已提交" : "等待中"}</strong>
                </div>
              ))}
            </div>
          </article>
        ) : null}
      </TeacherLocation>

      <TeacherLocation id="teacher-debrief">
        {W3_ENABLED && isTeacher && session ? (
          <W3OfficialConsequenceLearningWorkbench
            apiBase={API_BASE}
            context={w3Context}
            tenantId={login.tenantId}
            token={session.access_token}
          />
        ) : null}
        {session ? (
          <InstructorIntelligencePanel
            courseId={selectedRun?.course_id}
            disabled={busy}
            roundNo={selectedRound?.round_no}
            runId={selectedRun?.run_id}
            tenantId={login.tenantId}
            token={session.access_token}
          />
        ) : null}
        {isTeacher && session ? (
          <TeacherDebriefAdvisor
            apiBase={API_BASE}
            roundId={selectedRound?.round_id}
            runId={selectedRun?.run_id}
            teamId={
              state?.teams.find((candidate) => candidate.course_id === selectedRun?.course_id)
                ?.team_id
            }
            teamIds={state?.teams
              .filter((candidate) => candidate.course_id === selectedRun?.course_id)
              .map((candidate) => candidate.team_id)}
            tenantId={login.tenantId}
            token={session.access_token}
          />
        ) : null}
      </TeacherLocation>

      <TeacherLocation id="teacher-results">
        <section className="workspace">
          <article className="panel bff-panel" aria-label="BFF Replay 摘要">
            <div className="panel-title">
              <h2>BFF Replay 摘要</h2>
              <span>{replaySummary?.evidence_label}</span>
            </div>
            <div className="status-grid">
              <div>
                <span>结果</span>
                <strong>{replaySummary?.visible_state.result_count}</strong>
              </div>
              <div>
                <span>回放（Replay）</span>
                <strong>{replaySummary?.replay_status ?? "等待中"}</strong>
              </div>
              <div>
                <span>不覆盖正式结果</span>
                <strong>
                  {replaySummary?.replay_writes_formal_results === false ? (
                    <>
                      只读 <TechnicalCompatibilityLabel>read-only</TechnicalCompatibilityLabel>
                    </>
                  ) : (
                    "等待中"
                  )}
                </strong>
              </div>
            </div>
            <p className="evidence-note">formal_truth_write_allowed: false</p>
            <ul className="tag-list">
              {replaySummary?.redacted_fields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </article>
          <article className="panel">
            <div className="panel-title">
              <h2>队伍监控</h2>
              <span>
                {noticeLabel}
                {noticeLabel !== notice ? (
                  <TechnicalCompatibilityLabel>{notice}</TechnicalCompatibilityLabel>
                ) : null}
              </span>
            </div>
            <div className="table">
              <div className="table-row table-head">
                <span>队伍</span>
                <span>成员</span>
                <span>提交</span>
              </div>
              {(state?.teams ?? []).map((team) => (
                <div className="table-row" key={team.team_id}>
                  <span>{team.name}</span>
                  <span>{team.members.map((member) => member.display_name).join(", ")}</span>
                  <span>{hasDecision ? "已校验" : "待提交"}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-title">
              <h2>M1 教学正式结果</h2>
              <span>{selectedRound?.status ?? "尚未创建"}</span>
            </div>
            <div className="result-grid">
              {resultRows.map((result) => (
                <div className="result-card" key={result.team_id}>
                  <span>{result.team_name}</span>
                  <strong>{result.state_obs.score}</strong>
                  <p>
                    排名 {result.state_obs.rank}{" "}
                    <TechnicalCompatibilityLabel>
                      Rank {result.state_obs.rank}
                    </TechnicalCompatibilityLabel>
                  </p>
                  <p className="result-explain">{result.state_est.recommended_focus}</p>
                </div>
              ))}
              {resultRows.length === 0 ? <p className="muted">发布后显示结果。</p> : null}
            </div>
            {resultRows.length > 0 ? (
              <div className="debrief-box" aria-label="classroom debrief materials">
                <h3>课堂复盘材料</h3>
                <p>{resultLabel}</p>
                <ul>
                  {[...debriefPrompts, ...teachingPackage.debriefKit.teacherDiscussionPoints].map(
                    (prompt) => (
                      <li key={prompt}>{prompt}</li>
                    )
                  )}
                </ul>
                <small>当前限制：{runtimeLimitations.join(" / ")}</small>
              </div>
            ) : null}
          </article>
        </section>
      </TeacherLocation>

      <TeacherLocation id="teacher-close-cleanup">
        {isTeacher && session ? (
          <TeachingClosureWorkspace
            apiBase={API_BASE}
            availablePackages={
              coursePackageList.phase === "READY" ? coursePackageList.packages : []
            }
            courseId={selectedRun?.course_id ?? selectedCourseId}
            runId={selectedRun?.run_id ?? selectedRunId}
            tenantId={login.tenantId}
            token={session.access_token}
          />
        ) : null}
        <section className="panel audit">
          <div className="panel-title">
            <h2>审计链</h2>
            <span>{state?.audit_logs.length ?? 0} 条事件</span>
          </div>
          <div className="timeline">
            {(state?.audit_logs ?? []).slice(-8).map((event) => (
              <div className="timeline-item" key={event.audit_id}>
                <span>{event.action}</span>
                <strong>{event.resource_type}</strong>
                <small>{new Date(event.created_at).toLocaleTimeString()}</small>
              </div>
            ))}
          </div>
        </section>
      </TeacherLocation>
    </TeacherCourseWorkspace>
  );
}
