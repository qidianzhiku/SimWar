import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getKnownLimitsProjection,
  M1_TEACHING_OFFICIAL_RESULT_LABEL,
  M1_TEACHING_PRODUCT_PACKAGE
} from "@simwar/shared-contracts";
import type {
  ApiEnvelope,
  AuthSession,
  CoursePackageVersionCloneInput,
  CoursePackageVersionTeacherDto,
  P0DemoState,
  R7TeacherScenarioPackageCandidateDto,
  R7TeacherScenarioPackageCandidatesDto,
  Round,
  Run,
  SettlementResult,
  TeacherBffWorkspaceDTO,
  TeacherCourseBlueprintCatalogDto,
  TeacherCourseBlueprintReadinessDto,
  TeacherFormalCourseBindingPreviewDto,
  TeacherFormalScenarioPackageCatalogCandidateDto,
  TeacherFormalScenarioPackageCatalogDto
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
import { InstructorIntelligencePanel } from "./InstructorIntelligencePanel";
import {
  cloneTeacherCoursePackageVersion as requestTeacherCoursePackageClone,
  getTeacherCoursePackageSurfaceState,
  loadTeacherCoursePackageVersions,
  type TeacherCoursePackageSurfaceState
} from "./course-package-client";
import { CourseReportBuilder } from "./CourseReportBuilder";
import { LearningDesignWorkbench } from "./LearningDesignWorkbench";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
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
  | { phase: "INVALID_REQUEST"; message: string }
  | {
      phase: "UNAUTHENTICATED" | "UNAUTHORIZED" | "NOT_FOUND_OR_OUT_OF_SCOPE" | "INTERNAL_ERROR";
      message: string;
    }
  | { phase: "READY" | "BLOCKED"; response: ScenarioReadinessResponse };

type ScenarioCandidatesState =
  | { phase: "IDLE" | "LOADING" }
  | { phase: "ERROR"; message: string }
  | { phase: "READY"; response: R7TeacherScenarioPackageCandidatesDto };

type FormalScenarioCatalogState =
  | { phase: "IDLE" | "LOADING" }
  | { phase: "ERROR"; message: string }
  | { phase: "READY"; response: TeacherFormalScenarioPackageCatalogDto };

type CourseBlueprintCatalogState =
  | { phase: "IDLE" | "LOADING" }
  | { phase: "ERROR"; message: string }
  | { phase: "READY"; response: TeacherCourseBlueprintCatalogDto };

type TeacherCoursePackageListState =
  | { phase: "IDLE" | "LOADING" }
  | { packages: readonly CoursePackageVersionTeacherDto[]; phase: "READY" }
  | { phase: "ERROR"; surfaceState: TeacherCoursePackageSurfaceState };

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
  "Readiness check only",
  "Does not activate Scenario runtime",
  "Does not bind or modify ParameterSet",
  "Does not execute Replay",
  "Does not settle a round",
  "Does not publish an official result",
  "Does not establish Pilot or Production readiness"
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

function teacherCoursePackageStatusLabel(state: TeacherCoursePackageSurfaceState): string {
  return state === "PERMISSION_DENIED" ? "Permission denied" : "Unknown CoursePackageVersion state";
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

  return "已发布";
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
  return state.rounds.find((round) => round.run_id === runId);
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
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
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
  const [teacherCoursePackageCloneError, setTeacherCoursePackageCloneError] =
    useState<TeacherCoursePackageSurfaceState | null>(null);
  const readinessRequestSequence = useRef(0);
  const candidateRequestSequence = useRef(0);
  const formalCatalogRequestSequence = useRef(0);
  const coursePackageSessionEpoch = useRef(0);
  const selectedRunIdRef = useRef<string | null>(null);
  const selectedCourseIdRef = useRef<string | null>(null);

  const courseRuns = state ? getCourseRuns(state, selectedCourseId) : [];
  const latestRun = courseRuns.at(-1);
  const latestRound = latestRun
    ? state?.rounds.find((round) => round.run_id === latestRun.run_id)
    : undefined;
  const selectedRun = state ? selectVisibleRun(state, selectedRunId) : undefined;
  const selectedRound = selectedRun
    ? state?.rounds.find((round) => round.run_id === selectedRun.run_id)
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
  const hasDecision = useMemo(() => {
    if (!selectedRun || !selectedRound || !state) {
      return false;
    }

    return state.decisions.some(
      (decision) =>
        decision.run_id === selectedRun.run_id && decision.round_no === selectedRound.round_no
    );
  }, [selectedRun, selectedRound, state]);

  const refresh = useCallback(
    async (preferredRunId?: string | null) => {
      if (!session) {
        return;
      }

      const auth = { token: session.access_token, tenantId: login.tenantId };
      const nextState = await apiRequest<P0DemoState>("/api/v1/demo-state", auth);
      const nextCourseId = selectedCourseIdRef.current ?? selectInitialCourseId(nextState);
      const nextRun = selectVisibleRun(
        nextState,
        preferredRunId === undefined ? selectedRunIdRef.current : preferredRunId,
        nextCourseId
      );
      const nextRound = nextRun
        ? nextState.rounds.find((round) => round.run_id === nextRun.run_id)
        : undefined;

      setState(nextState);
      selectedCourseIdRef.current = nextCourseId;
      setSelectedCourseId(nextCourseId);
      selectedRunIdRef.current = nextRun?.run_id ?? null;
      setSelectedRunId(nextRun?.run_id ?? null);
      setWorkspace(null);

      if (!nextRun || !nextRound) {
        return;
      }

      setWorkspace(
        await apiRequest<TeacherBffWorkspaceDTO>(
          `/api/v1/bff/teacher/runs/${nextRun.run_id}/rounds/${nextRound.round_no}/workspace`,
          auth
        )
      );
    },
    [login.tenantId, session]
  );

  const refreshTeacherCoursePackages = useCallback(async () => {
    if (!session?.user.roles.includes("teacher")) {
      setCoursePackageList({ phase: "IDLE" });
      return;
    }

    const sessionEpoch = coursePackageSessionEpoch.current;
    setCoursePackageList({ phase: "LOADING" });
    try {
      const packages = await loadTeacherCoursePackageVersions(session.access_token, (path, init) =>
        fetch(`${API_BASE}${path}`, init)
      );
      if (sessionEpoch !== coursePackageSessionEpoch.current) return;
      setCoursePackageList({ packages, phase: "READY" });
    } catch (error) {
      if (sessionEpoch !== coursePackageSessionEpoch.current) return;
      setCoursePackageList({
        phase: "ERROR",
        surfaceState: getTeacherCoursePackageSurfaceState(error)
      });
    }
  }, [session]);

  function updateLogin(field: keyof LoginForm, value: string): void {
    coursePackageSessionEpoch.current += 1;
    setLogin((current) => ({ ...current, [field]: value }));
    setSession(null);
    setState(null);
    setWorkspace(null);
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
      setScenarioReadiness({ phase: "INVALID_REQUEST", message: validationMessage });
      return;
    }
    if (!session || !selectedRun) {
      setScenarioReadiness({
        phase: "UNAUTHENTICATED",
        message: "Authentication is required to check readiness."
      });
      return;
    }

    const requestSequence = readinessRequestSequence.current + 1;
    readinessRequestSequence.current = requestSequence;
    setScenarioReadiness({ phase: "LOADING" });

    try {
      const response = await requestScenarioReadiness({
        apiBaseUrl: API_BASE,
        parameterSetId: scenarioReadinessForm.parameterSetId,
        runId: selectedRun.run_id,
        scenarioPackageId: scenarioReadinessForm.scenarioPackageId,
        token: session.access_token
      });

      if (readinessRequestSequence.current === requestSequence) {
        setScenarioReadiness({
          phase: response.eligible ? "READY" : "BLOCKED",
          response
        });
      }
    } catch (error) {
      if (readinessRequestSequence.current !== requestSequence) {
        return;
      }

      const message = getScenarioReadinessErrorMessage(error);
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
          message
        });
        return;
      }
      setScenarioReadiness({ phase: "INTERNAL_ERROR", message });
    }
  }

  async function signIn(nextLogin = login): Promise<void> {
    coursePackageSessionEpoch.current += 1;
    setBusy(true);
    setSession(null);
    setState(null);
    setWorkspace(null);
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
      setSession(nextSession);
      setNotice("signed in");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "login failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh().catch((error: unknown) => {
      setNotice(error instanceof Error ? error.message : "load failed");
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
      setTeacherCoursePackageCloneReceipt(
        await requestTeacherCoursePackageClone(cloneInput, session.access_token, (path, init) =>
          fetch(`${API_BASE}${path}`, init)
        )
      );
      setTeacherCoursePackageCloneSource(null);
      setTeacherCoursePackageCloneForm(EMPTY_TEACHER_COURSE_PACKAGE_CLONE_FORM);
    } catch (error) {
      setTeacherCoursePackageCloneError(getTeacherCoursePackageSurfaceState(error));
    } finally {
      setBusy(false);
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
    setScenarioCandidates({ phase: "LOADING" });

    requestScenarioPackageCandidates({
      apiBaseUrl: API_BASE,
      runId: selectedRun.run_id,
      token: session.access_token
    })
      .then((response) => {
        if (candidateRequestSequence.current === requestSequence) {
          setScenarioCandidates({ phase: "READY", response });
        }
      })
      .catch((error: unknown) => {
        if (candidateRequestSequence.current === requestSequence) {
          setScenarioCandidates({
            phase: "ERROR",
            message: getScenarioCandidatesErrorMessage(error)
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
    setFormalScenarioCatalog({ phase: "LOADING" });

    requestTeacherFormalScenarioPackageCatalog({
      apiBaseUrl: API_BASE,
      token: session.access_token
    })
      .then((response) => {
        if (formalCatalogRequestSequence.current === requestSequence) {
          setFormalScenarioCatalog({ phase: "READY", response });
        }
      })
      .catch((error: unknown) => {
        if (formalCatalogRequestSequence.current === requestSequence) {
          setFormalScenarioCatalog({
            phase: "ERROR",
            message: getTeacherFormalScenarioPackageCatalogErrorMessage(error)
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
    setCourseBlueprintCatalog({ phase: "LOADING" });
    requestTeacherCourseBlueprintCatalog({ apiBaseUrl: API_BASE, token: session.access_token })
      .then((response) => setCourseBlueprintCatalog({ phase: "READY", response }))
      .catch((error: unknown) =>
        setCourseBlueprintCatalog({
          phase: "ERROR",
          message: getTeacherFormalCourseBindingErrorMessage(error)
        })
      );
  }, [session]);

  async function prepareFormalCourse(
    candidate: TeacherFormalScenarioPackageCatalogCandidateDto
  ): Promise<void> {
    if (!session) return;
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
      setFormalBindingPreview(preview);
      setFormalCourseTitle(`Course: ${candidate.scenario_package_reference.scenario_package_id}`);
      setNotice("formal Course binding preview ready");
    } catch (error) {
      setNotice(getTeacherFormalCourseBindingErrorMessage(error));
    } finally {
      setBusy(false);
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
    setBusy(true);
    try {
      const created = await requestTeacherCourseBlueprintCourseCreate({
        apiBaseUrl: API_BASE,
        courseBlueprintReference: selectedCourseBlueprint.course_blueprint_reference,
        scenarioPackageReference: formalDraftCandidate.scenario_package_reference,
        title: formalCourseTitle.trim(),
        token: session.access_token
      });
      selectedCourseIdRef.current = created.course.course_id;
      setSelectedCourseId(created.course.course_id);
      setFormalCoursePublished(false);
      setNotice("formal Course created");
    } catch (error) {
      setNotice(getTeacherFormalCourseBindingErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function selectCourseBlueprintLocally(
    blueprint: TeacherCourseBlueprintCatalogDto["candidates"][number]
  ): Promise<void> {
    setSelectedCourseBlueprint(blueprint);
    setCourseBlueprintReadiness(null);
    setNotice("LOCAL_SELECTION_ONLY - no Course write yet");
    if (!session || !formalDraftCandidate) return;
    setBusy(true);
    try {
      const readiness = await requestTeacherCourseBlueprintReadiness({
        apiBaseUrl: API_BASE,
        courseBlueprintReference: blueprint.course_blueprint_reference,
        scenarioPackageReference: formalDraftCandidate.scenario_package_reference,
        token: session.access_token
      });
      setCourseBlueprintReadiness(readiness);
      setFormalBindingPreview(readiness.formal_course_binding);
      setFormalCourseTitle(`Course: ${blueprint.title}`);
      setNotice("exact Blueprint and B5 readiness confirmed");
    } catch (error) {
      setNotice(getTeacherFormalCourseBindingErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function beginCourseBlueprintStudio(
    blueprint: TeacherCourseBlueprintCatalogDto["candidates"][number]
  ): Promise<void> {
    if (!session) return;
    setBusy(true);
    setCourseBlueprintStudioStatus("LOADING");
    try {
      const preview = await requestTeacherCourseBlueprintStudioPreview({
        apiBaseUrl: API_BASE,
        courseBlueprintReference: blueprint.course_blueprint_reference,
        token: session.access_token
      });
      setCourseBlueprintStudioSource(blueprint.course_blueprint_reference);
      setCourseBlueprintStudioPreview(preview);
      setCourseBlueprintStudioForm({
        ...preview.editable_content,
        version: preview.editable_content.version
      });
      setCourseBlueprintStudioStatus("EDITING");
      setNotice("Blueprint Studio edit ready");
    } catch (error) {
      setCourseBlueprintStudioStatus("ERROR");
      setNotice(getTeacherFormalCourseBindingErrorMessage(error));
    } finally {
      setBusy(false);
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
      setCourseBlueprintStudioPreview(preview);
      setCourseBlueprintStudioForm(preview.editable_content);
      setCourseBlueprintStudioStatus("DRAFT");
      setNotice("immutable Blueprint draft saved");
    } catch (error) {
      setCourseBlueprintStudioStatus("ERROR");
      setNotice(getTeacherFormalCourseBindingErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitCourseBlueprintStudioDraft(): Promise<void> {
    if (!session || !courseBlueprintStudioPreview || courseBlueprintStudioStatus !== "DRAFT") {
      return;
    }
    setBusy(true);
    try {
      const submission = await requestTeacherCourseBlueprintStudioSubmission({
        apiBaseUrl: API_BASE,
        courseBlueprintReference: courseBlueprintStudioPreview.course_blueprint_reference,
        token: session.access_token
      });
      setCourseBlueprintStudioStatus(submission.status);
      setNotice("Blueprint draft submitted for validation");
    } catch (error) {
      setCourseBlueprintStudioStatus("ERROR");
      setNotice(getTeacherFormalCourseBindingErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function publishFormalCourse(): Promise<void> {
    if (!session || !selectedCourseId) {
      setNotice("a formal Course is required before publication");
      return;
    }
    setBusy(true);
    try {
      const auth = { token: session.access_token, tenantId: login.tenantId };
      await apiRequest(`/api/v1/courses/${selectedCourseId}/publish`, {
        ...auth,
        method: "POST"
      });
      setFormalCoursePublished(true);
      setNotice("formal Course published");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "formal Course publication failed");
    } finally {
      setBusy(false);
    }
  }

  async function createFormalCourseRun(): Promise<void> {
    if (!session || !selectedCourseId || !/^\d+$/.test(formalRunSeed.trim())) {
      setNotice("an explicit non-negative Run seed is required");
      return;
    }
    setBusy(true);
    try {
      const auth = { token: session.access_token, tenantId: login.tenantId };
      const created = await apiRequest<{ run: Run; round: Round }>(
        `/api/v1/courses/${selectedCourseId}/runs`,
        { ...auth, body: { formal_runtime_seed: Number(formalRunSeed) }, method: "POST" }
      );
      selectedRunIdRef.current = created.run.run_id;
      setSelectedRunId(created.run.run_id);
      setNotice("formal Run created");
      await refresh(created.run.run_id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "formal Run creation failed");
    } finally {
      setBusy(false);
    }
  }

  async function createCourseRun(): Promise<void> {
    if (!session) {
      setNotice("please sign in first");
      return;
    }

    const courseId = selectedCourseId ?? (state ? selectInitialCourseId(state) : null);
    if (!courseId) {
      throw new Error("course not available");
    }

    const auth = { token: session.access_token, tenantId: login.tenantId };
    const created = await apiRequest<{ run: Run; round: Round }>(
      `/api/v1/courses/${courseId}/runs`,
      { ...auth, method: "POST" }
    );
    selectedRunIdRef.current = created.run.run_id;
    setSelectedRunId(created.run.run_id);
    setNotice("run created");
    await refresh(created.run.run_id);
  }

  async function createNextRun(): Promise<void> {
    if (!session || latestRound?.status !== "published") {
      setNotice("latest Run must be published first");
      return;
    }

    setBusy(true);
    try {
      await createCourseRun();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "run creation failed");
    } finally {
      setBusy(false);
    }
  }

  async function runNextStep(): Promise<void> {
    if (!session) {
      setNotice("please sign in first");
      return;
    }

    setBusy(true);
    try {
      const auth = { token: session.access_token, tenantId: login.tenantId };

      if (!selectedRun) {
        await createCourseRun();
        return;
      } else if (selectedRound?.status === "draft") {
        await apiRequest(`/api/v1/runs/${selectedRun.run_id}/rounds/1/start`, {
          ...auth,
          method: "POST"
        });
        setNotice("round opened");
      } else if (selectedRound?.status === "open") {
        if (!hasDecision) {
          setNotice("waiting for learner decision");
        } else {
          await apiRequest(`/api/v1/runs/${selectedRun.run_id}/rounds/1/lock`, {
            ...auth,
            method: "POST"
          });
          setNotice("round locked");
        }
      } else if (selectedRound?.status === "locked") {
        await apiRequest<SettlementResult>(`/api/v1/runs/${selectedRun.run_id}/rounds/1/settle`, {
          ...auth,
          method: "POST"
        });
        setNotice("settlement completed");
      } else if (selectedRound?.status === "settled") {
        await apiRequest(`/api/v1/runs/${selectedRun.run_id}/rounds/1/publish`, {
          ...auth,
          method: "POST"
        });
        setNotice("result published");
      }

      await refresh(selectedRun.run_id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "action failed");
    } finally {
      setBusy(false);
    }
  }

  const metrics = [
    ["身份", session?.user.display_name ?? "anonymous"],
    ["课程", courseWorkspace?.visible_state.course_title ?? state?.courses[0]?.title ?? "loading"],
    ["队伍", `${teacherDashboard?.visible_state.team_count ?? state?.teams.length ?? 0}`],
    ["回合", roundControl?.status ?? selectedRound?.status ?? "not created"],
    [
      "决策",
      roundControl?.visible_state.decision_count
        ? "validated"
        : hasDecision
          ? "validated"
          : "waiting"
    ],
    ["运行时", runtimeBoundary],
    ["Replay", replaySummary?.replay_status ?? "pending"],
    ["BFF", teacherDashboard?.evidence_label ?? "pending"]
  ];

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Teacher Console</p>
          <h1>SimWar M1 教师控制台</h1>
          <span className="official-label">{resultLabel}</span>
          <span className="identity">
            {session ? `${session.user.roles.join(" / ")} · ${login.tenantId}` : "not signed in"}
          </span>
        </div>
        <div className="run-toolbar">
          {courseRuns.length > 0 ? (
            <label className="run-selector">
              <span>Run</span>
              <select
                aria-label="run selector"
                disabled={busy || !session}
                onChange={(event) => {
                  void refresh(event.target.value).catch((error: unknown) => {
                    setNotice(error instanceof Error ? error.message : "run selection failed");
                  });
                }}
                value={selectedRun?.run_id ?? ""}
              >
                {courseRuns.map((run) => {
                  const round = state?.rounds.find((candidate) => candidate.run_id === run.run_id);
                  return (
                    <option key={run.run_id} value={run.run_id}>
                      {run.run_id} · {round?.status ?? run.status}
                    </option>
                  );
                })}
              </select>
            </label>
          ) : null}
          {selectedRound?.status === "published" ? (
            <span className="run-readonly">Historical Run · read-only</span>
          ) : null}
          {session && latestRound?.status === "published" ? (
            <button className="secondary" disabled={busy} onClick={() => void createNextRun()}>
              Create Next Run
            </button>
          ) : null}
        </div>
        <button
          className="primary"
          disabled={busy || selectedRound?.status === "published" || !session || !state}
          onClick={() => void runNextStep()}
        >
          {busy ? "处理中" : getRoundAction(selectedRound)}
        </button>
      </header>

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

      {session ? (
        <section className="known-limits-disclosure" aria-label="known limits product disclosure">
          <p className="eyebrow">Internal Use Boundary</p>
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
      ) : null}

      {isTeacher ? (
        <CourseReportBuilder
          sessionKey={`${session?.access_token ?? ""}:${login.tenantId}`}
          tenantId={login.tenantId}
          token={session?.access_token ?? ""}
        />
      ) : null}

      {isTeacher && session ? (
        <section className="candidate-surface" aria-label="D1 Learning Design entry point">
          <div className="candidate-heading">
            <div>
              <p className="eyebrow">L1+ Program D · D1</p>
              <h2>Learning Goals &amp; Rubrics</h2>
            </div>
            <button
              className="secondary"
              onClick={() => setShowLearningDesign((visible) => !visible)}
            >
              {showLearningDesign ? "Close D1 Workbench" : "Open D1 Workbench"}
            </button>
          </div>
          {showLearningDesign ? (
            <LearningDesignWorkbench tenantId={login.tenantId} token={session.access_token} />
          ) : (
            <p className="evidence-note">
              Open the D1 workbench to author immutable LearningGoalVersion and RubricVersion
              records.
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
              <p className="eyebrow">Teacher-safe projection</p>
              <h2>Available CoursePackageVersions</h2>
            </div>
            <button
              className="secondary"
              disabled={busy || coursePackageList.phase === "LOADING"}
              onClick={() => void refreshTeacherCoursePackages()}
            >
              Refresh CoursePackageVersions
            </button>
          </div>
          <p className="evidence-note">
            Read-only AVAILABLE teaching packages. The server owns dependency checks, digest
            verification, compatibility, lifecycle, import, export, and all source authority.
          </p>
          {coursePackageList.phase === "LOADING" ? (
            <p className="evidence-note" role="status">
              Loading CoursePackageVersions
            </p>
          ) : null}
          {coursePackageList.phase === "ERROR" ? (
            <p className="readiness-message" role="alert">
              {teacherCoursePackageStatusLabel(coursePackageList.surfaceState)}
            </p>
          ) : null}
          {coursePackageList.phase === "READY" && coursePackageList.packages.length === 0 ? (
            <p className="evidence-note">No available CoursePackageVersions.</p>
          ) : null}
          {coursePackageList.phase === "READY" && coursePackageList.packages.length > 0 ? (
            <div className="candidate-list">
              {coursePackageList.packages.map((coursePackage) => (
                <article
                  className="candidate-card"
                  key={coursePackage.course_package_reference.content_digest}
                >
                  <span>AVAILABLE</span>
                  <strong>{coursePackage.title}</strong>
                  <small>
                    {coursePackage.course_package_reference.course_package_id} /{" "}
                    {coursePackage.course_package_reference.version}
                  </small>
                  <p>{coursePackage.description}</p>
                  <small>
                    CourseBlueprint {coursePackage.course_blueprint_reference.course_blueprint_id} /{" "}
                    {coursePackage.course_blueprint_reference.version}
                  </small>
                  <small>
                    ScenarioPackage {coursePackage.scenario_package_reference.scenario_package_id} /{" "}
                    {coursePackage.scenario_package_reference.version}
                  </small>
                  <small>
                    ParameterSet {coursePackage.parameter_set_reference.parameter_set_id} /{" "}
                    {coursePackage.parameter_set_reference.version}
                  </small>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => beginTeacherCoursePackageClone(coursePackage)}
                  >
                    Clone {coursePackage.course_package_reference.course_package_id} as a new Course
                    Package version
                  </button>
                </article>
              ))}
            </div>
          ) : null}
          {teacherCoursePackageCloneSource ? (
            <section className="candidate-preview" aria-label="Teacher CoursePackageVersion clone">
              <span>Clone a new Course Package version</span>
              <strong>
                Source {teacherCoursePackageCloneSource.course_package_reference.course_package_id}{" "}
                / {teacherCoursePackageCloneSource.course_package_reference.version}
              </strong>
              <small>
                The server derives tenant and actor, and creates the DRAFT lifecycle record.
              </small>
              <label>
                new Course Package ID
                <input
                  aria-label="new Course Package ID"
                  value={teacherCoursePackageCloneForm.coursePackageId}
                  onChange={(event) =>
                    updateTeacherCoursePackageClone("coursePackageId", event.target.value)
                  }
                />
              </label>
              <label>
                new Course Package version
                <input
                  aria-label="new Course Package version"
                  value={teacherCoursePackageCloneForm.version}
                  onChange={(event) =>
                    updateTeacherCoursePackageClone("version", event.target.value)
                  }
                />
              </label>
              <label>
                new Course Package title
                <input
                  aria-label="new Course Package title"
                  value={teacherCoursePackageCloneForm.title}
                  onChange={(event) => updateTeacherCoursePackageClone("title", event.target.value)}
                />
              </label>
              <label>
                new Course Package description
                <input
                  aria-label="new Course Package description"
                  value={teacherCoursePackageCloneForm.description}
                  onChange={(event) =>
                    updateTeacherCoursePackageClone("description", event.target.value)
                  }
                />
              </label>
              <button disabled={busy} onClick={() => void cloneTeacherCoursePackageVersion()}>
                Clone Course Package version
              </button>
            </section>
          ) : null}
          {teacherCoursePackageCloneError ? (
            <p className="readiness-message" role="alert">
              {teacherCoursePackageStatusLabel(teacherCoursePackageCloneError)}
            </p>
          ) : null}
          {teacherCoursePackageCloneReceipt ? (
            <article
              className="candidate-preview"
              aria-label="Teacher CoursePackageVersion clone receipt"
            >
              <span>New Course Package version receipt</span>
              <strong>
                {teacherCoursePackageCloneReceipt.course_package_reference.course_package_id} /{" "}
                {teacherCoursePackageCloneReceipt.course_package_reference.version}
              </strong>
              <p>A new immutable CoursePackageVersion was created as a server-owned DRAFT.</p>
              <p>No Course or Run was created.</p>
            </article>
          ) : null}
        </section>
      ) : null}

      {session ? (
        <RoleWorkflowPanel
          active={selectedRound?.status === "open"}
          courseId={selectedRun?.course_id}
          disabled={busy || selectedRound?.status !== "open"}
          roundId={selectedRound?.round_id}
          runId={selectedRun?.run_id}
          teams={
            state?.teams.filter((candidate) => candidate.course_id === selectedRun?.course_id) ?? []
          }
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

      {session ? (
        <section className="candidate-surface studio-surface" aria-label="Teacher Blueprint Studio">
          <div className="candidate-heading">
            <h2>Teacher Blueprint Studio</h2>
            <span>{courseBlueprintStudioStatus}</span>
          </div>
          {courseBlueprintCatalog.phase === "READY" ? (
            <div className="studio-source-list">
              {courseBlueprintCatalog.response.candidates.map((blueprint) => (
                <button
                  className="secondary"
                  disabled={busy}
                  key={`studio-${blueprint.course_blueprint_reference.content_digest}`}
                  onClick={() => void beginCourseBlueprintStudio(blueprint)}
                >
                  Edit new version
                </button>
              ))}
            </div>
          ) : null}
          {courseBlueprintStudioForm ? (
            <div className="studio-form">
              <label className="field-label">
                <span>Blueprint version</span>
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
                <span>Blueprint title</span>
                <input
                  aria-label="Blueprint title"
                  disabled={busy || courseBlueprintStudioStatus === "VALIDATED"}
                  value={courseBlueprintStudioForm.title}
                  onChange={(event) => updateCourseBlueprintStudioForm("title", event.target.value)}
                />
              </label>
              <label className="field-label studio-description">
                <span>Blueprint description</span>
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
                  Save immutable draft
                </button>
                <button
                  className="secondary"
                  disabled={busy || courseBlueprintStudioStatus !== "DRAFT"}
                  onClick={() => void submitCourseBlueprintStudioDraft()}
                >
                  Submit draft for validation
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

      <section className="metrics" aria-label="M1 run status">
        {metrics.map(([label, value]) => (
          <article className="metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

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
                <span>Course</span>
                <strong>{courseWorkspace?.visible_state.course_title}</strong>
              </div>
              <div>
                <span>Run</span>
                <strong>{courseWorkspace?.visible_state.run_status}</strong>
              </div>
              <div>
                <span>Teams</span>
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
                <h2>Scenario Readiness</h2>
                <span>{scenarioReadiness.phase}</span>
              </div>
              <p className="evidence-note">Run context: {selectedRun?.run_id ?? "not selected"}</p>
              <section className="candidate-surface" aria-label="scenario package candidates">
                <div className="candidate-heading">
                  <h3>Scenario Candidates</h3>
                  <span>{scenarioCandidates.phase}</span>
                </div>
                {scenarioCandidates.phase === "LOADING" ? (
                  <p className="evidence-note" role="status">
                    Loading Scenario candidates
                  </p>
                ) : null}
                {scenarioCandidates.phase === "ERROR" ? (
                  <p className="readiness-message" role="status">
                    {scenarioCandidates.message}
                  </p>
                ) : null}
                {scenarioCandidates.phase === "READY" ? (
                  <>
                    {scenarioCandidates.response.candidates.length === 0 ? (
                      <p className="evidence-note">No ScenarioPackage candidates available.</p>
                    ) : (
                      <div className="candidate-list">
                        {scenarioCandidates.response.candidates.map((candidate) =>
                          candidate.is_current ? (
                            <article
                              className="candidate-card current-candidate"
                              key={candidate.scenario_package_id}
                            >
                              <span>Current ScenarioPackage</span>
                              <strong>{candidate.display_name}</strong>
                              <small>{candidate.version_label}</small>
                            </article>
                          ) : (
                            <article className="candidate-card" key={candidate.scenario_package_id}>
                              <span>Candidate</span>
                              <strong>{candidate.display_name}</strong>
                              <small>{candidate.version_label}</small>
                              <button onClick={() => setPreviewCandidate(candidate)}>
                                Preview {candidate.display_name}
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
                        <span>Preview Candidate</span>
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
                  <h3>Formal CourseBlueprint Catalog</h3>
                  <span>{courseBlueprintCatalog.phase}</span>
                </div>
                {courseBlueprintCatalog.phase === "LOADING" ? (
                  <p className="evidence-note">Loading approved CourseBlueprints</p>
                ) : null}
                {courseBlueprintCatalog.phase === "ERROR" ? (
                  <p className="readiness-message">{courseBlueprintCatalog.message}</p>
                ) : null}
                {courseBlueprintCatalog.phase === "READY" ? (
                  <>
                    {courseBlueprintCatalog.response.candidates.length === 0 ? (
                      <p className="evidence-note">No approved CourseBlueprints available.</p>
                    ) : (
                      <div className="candidate-list">
                        {courseBlueprintCatalog.response.candidates.map((blueprint) => (
                          <article
                            className="candidate-card"
                            key={blueprint.course_blueprint_reference.content_digest}
                          >
                            <span>{blueprint.status}</span>
                            <strong>{blueprint.title}</strong>
                            <small>
                              {blueprint.course_blueprint_reference.version} /{" "}
                              {blueprint.duration_minutes} minutes
                            </small>
                            <button
                              onClick={() => void selectCourseBlueprintLocally(blueprint)}
                              disabled={busy}
                            >
                              Select locally
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
                        <span>LOCAL_SELECTION_ONLY</span>
                        <strong>{selectedCourseBlueprint.title}</strong>
                        <small>NO_COURSE_WRITE_YET</small>
                        {courseBlueprintReadiness ? (
                          <small>Exact server-side readiness: READY</small>
                        ) : null}
                      </article>
                    ) : null}
                  </>
                ) : null}
              </section>
              <section className="candidate-surface" aria-label="formal ScenarioPackage catalog">
                <div className="candidate-heading">
                  <h3>Formal ScenarioPackage Catalog</h3>
                  <span>{formalScenarioCatalog.phase}</span>
                </div>
                {formalScenarioCatalog.phase === "LOADING" ? (
                  <p className="evidence-note" role="status">
                    Loading approved formal ScenarioPackages
                  </p>
                ) : null}
                {formalScenarioCatalog.phase === "ERROR" ? (
                  <p className="readiness-message" role="status">
                    {formalScenarioCatalog.message}
                  </p>
                ) : null}
                {formalScenarioCatalog.phase === "READY" ? (
                  <>
                    {formalScenarioCatalog.response.candidates.length === 0 ? (
                      <p className="evidence-note">
                        No approved formal ScenarioPackages available.
                      </p>
                    ) : (
                      <div className="candidate-list">
                        {formalScenarioCatalog.response.candidates.map((candidate) => (
                          <article
                            className="candidate-card"
                            key={candidate.scenario_package_reference.content_digest}
                          >
                            <span>{candidate.status}</span>
                            <strong>
                              {candidate.scenario_package_reference.scenario_package_id}
                            </strong>
                            <small>
                              {candidate.scenario_package_reference.version} /{" "}
                              {candidate.schema_version}
                            </small>
                            <small>
                              ParameterSet {candidate.parameter_set_reference.parameter_set_id} /{" "}
                              {candidate.parameter_set_reference.version}
                            </small>
                            <button onClick={() => prepareFormalCourse(candidate)} disabled={busy}>
                              Prepare formal Course
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
                        <span>Teacher selection preview</span>
                        <strong>
                          {formalDraftCandidate.scenario_package_reference.scenario_package_id} /{" "}
                          {formalDraftCandidate.scenario_package_reference.version}
                        </strong>
                        <small>
                          Scenario digest:{" "}
                          {formalDraftCandidate.scenario_package_reference.content_digest}
                        </small>
                        <small>
                          ParameterSet digest:{" "}
                          {formalDraftCandidate.parameter_set_reference.content_digest}
                        </small>
                        {formalBindingPreview ? (
                          <>
                            <small>
                              Engine {formalBindingPreview.engine_profile.engine_id} /{" "}
                              {formalBindingPreview.engine_profile.version}
                            </small>
                            <small>{formalBindingPreview.engine_profile.runtime_authority}</small>
                            <label>
                              formal Course title
                              <input
                                aria-label="formal Course title"
                                value={formalCourseTitle}
                                onChange={(event) => setFormalCourseTitle(event.target.value)}
                              />
                            </label>
                            <button onClick={() => void createFormalCourse()} disabled={busy}>
                              Create formal Course
                            </button>
                          </>
                        ) : (
                          <p>Resolving the exact server-side formal binding preview.</p>
                        )}
                      </article>
                    ) : null}
                    {selectedCourseId && formalBindingPreview ? (
                      <article className="candidate-preview" aria-label="formal Run creation">
                        <span>Selected formal Course: {selectedCourseId}</span>
                        {formalCoursePublished ? (
                          <>
                            <label>
                              explicit Run seed
                              <input
                                aria-label="explicit Run seed"
                                inputMode="numeric"
                                value={formalRunSeed}
                                onChange={(event) => setFormalRunSeed(event.target.value)}
                              />
                            </label>
                            <button onClick={() => void createFormalCourseRun()} disabled={busy}>
                              Create formal Run
                            </button>
                          </>
                        ) : (
                          <button onClick={() => void publishFormalCourse()} disabled={busy}>
                            Publish formal Course
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
                Scenario Package ID
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
                disabled={scenarioReadiness.phase === "LOADING"}
                onClick={() => void checkScenarioReadiness()}
              >
                {scenarioReadiness.phase === "LOADING" ? "Checking readiness" : "Check readiness"}
              </button>
              {scenarioReadiness.phase === "INVALID_REQUEST" ||
              scenarioReadiness.phase === "UNAUTHENTICATED" ||
              scenarioReadiness.phase === "UNAUTHORIZED" ||
              scenarioReadiness.phase === "NOT_FOUND_OR_OUT_OF_SCOPE" ||
              scenarioReadiness.phase === "INTERNAL_ERROR" ? (
                <p className="readiness-message" role="status">
                  {scenarioReadiness.message}
                </p>
              ) : null}
              {scenarioReadiness.phase === "READY" || scenarioReadiness.phase === "BLOCKED" ? (
                <div className="readiness-result">
                  <strong>{scenarioReadiness.response.readiness_status}</strong>
                  <div className="status-grid">
                    <div>
                      <span>Compatibility</span>
                      <strong>{scenarioReadiness.response.compatibility_status}</strong>
                    </div>
                    <div>
                      <span>Provenance</span>
                      <strong>{scenarioReadiness.response.provenance_status}</strong>
                    </div>
                    <div>
                      <span>QA</span>
                      <strong>{scenarioReadiness.response.qa_status}</strong>
                    </div>
                    <div>
                      <span>License</span>
                      <strong>{scenarioReadiness.response.license_status}</strong>
                    </div>
                    <div>
                      <span>Calibration</span>
                      <strong>{scenarioReadiness.response.calibration_status}</strong>
                    </div>
                    <div>
                      <span>Runtime adapter</span>
                      <strong>{scenarioReadiness.response.runtime_adapter_status}</strong>
                    </div>
                  </div>
                  <p className="evidence-note">
                    Evidence freshness:{" "}
                    {scenarioReadiness.response.evidence_freshness.collected_at ?? "unavailable"}
                  </p>
                  {scenarioReadiness.response.no_go_reasons.length > 0 ? (
                    <ul className="tag-list">
                      {scenarioReadiness.response.no_go_reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  ) : null}
                  <ul className="tag-list">
                    {scenarioReadiness.response.explicit_non_proofs.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <section className="known-limits" aria-label="known limits">
                <h3>Known limits</h3>
                <ul className="compact-list">
                  {SCENARIO_READINESS_KNOWN_LIMITS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            </article>
          ) : null}

          <article className="panel bff-panel">
            <div className="panel-title">
              <h2>BFF 回合控制</h2>
              <span>{roundControl?.evidence_label}</span>
            </div>
            <div className="status-grid">
              <div>
                <span>Round</span>
                <strong>{roundControl?.round_no}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{roundControl?.status}</strong>
              </div>
              <div>
                <span>Settlement</span>
                <strong>
                  {roundControl?.visible_state.settlement_available ? "available" : "pending"}
                </strong>
              </div>
            </div>
            <p className="evidence-note">
              Decisions {roundControl?.visible_state.decision_count} / Teams{" "}
              {roundControl?.visible_state.team_count}
            </p>
          </article>

          <article className="panel bff-panel">
            <div className="panel-title">
              <h2>BFF 队伍监控</h2>
              <span>{teamMonitor?.evidence_label}</span>
            </div>
            <div className="table">
              {teamMonitor?.teams.map((team) => (
                <div className="table-row" key={team.team_id}>
                  <span>{team.team_name}</span>
                  <span>{team.members} members</span>
                  <strong>{team.decision_submitted ? "submitted" : "waiting"}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="panel bff-panel">
            <div className="panel-title">
              <h2>BFF Replay 摘要</h2>
              <span>{replaySummary?.evidence_label}</span>
            </div>
            <div className="status-grid">
              <div>
                <span>Results</span>
                <strong>{replaySummary?.visible_state.result_count}</strong>
              </div>
              <div>
                <span>Replay</span>
                <strong>{replaySummary?.replay_status ?? "pending"}</strong>
              </div>
              <div>
                <span>Non-overwrite</span>
                <strong>
                  {replaySummary?.replay_writes_formal_results === false ? "read-only" : "pending"}
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
        </section>
      ) : null}

      <section className="workspace">
        <article className="panel">
          <div className="panel-title">
            <h2>队伍监控</h2>
            <span>{notice}</span>
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
            <span>{selectedRound?.status ?? "not created"}</span>
          </div>
          <div className="result-grid">
            {resultRows.map((result) => (
              <div className="result-card" key={result.team_id}>
                <span>{result.team_name}</span>
                <strong>{result.state_obs.score}</strong>
                <p>Rank {result.state_obs.rank}</p>
                {"state_true" in result && result.state_true ? (
                  <small>Profit {Math.round(result.state_true.profit)}</small>
                ) : null}
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

      <section className="panel audit">
        <div className="panel-title">
          <h2>审计链</h2>
          <span>{state?.audit_logs.length ?? 0} events</span>
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
    </main>
  );
}
