import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  getKnownLimitsProjection,
  M1_TEACHING_OFFICIAL_RESULT_LABEL,
  M1_TEACHING_PRODUCT_PACKAGE,
  REAUTH_CONTEXT_STORAGE_KEY,
  isSameReauthBusinessContext,
  parseReauthContext,
  serializeReauthContext,
  validateReauthIdentity,
  type ReauthContext
} from "@simwar/shared-contracts";
import type {
  ApiEnvelope,
  AuthSession,
  ActorRole,
  Decision,
  DecisionPayload,
  P0DemoState,
  DecisionPayloadFieldPath,
  StudentBffCockpitDTO,
  StudentDecisionContextEvidence,
  W5GovernedModelStudentProjection,
  W3OfficialConsequenceContext
} from "@simwar/shared-contracts";
import { OperatingWorldBrief } from "./OperatingWorldBrief";
const StudentRoleWorkflowPanel = lazy(() => import("./StudentRoleWorkflowPanel"));
import { W027DecisionExperiencePanel } from "./W027DecisionExperiencePanel";
import { StudentLearningReportPanel } from "./StudentLearningReport";
import { W3OfficialConsequenceLearningPanel } from "./W3OfficialConsequenceLearningPanel";
const ShanghaiFullVerticalStudentPanel = lazy(() => import("./ShanghaiFullVerticalPanel"));
import { ProjectBriefPanel, type ProjectAwareEvidenceAvailability } from "./ProjectBriefPanel";
import { GoldenJourneyWorkbench } from "./GoldenJourneyWorkbench";
import { RegionalTransferProjection } from "./features/regional-transfer-projection";
import { StudentRoleAdvisor } from "./StudentRoleAdvisor";
import { ModelQualificationProjection } from "./ModelQualificationProjection";
import { GovernedStakeholderIntelligenceProjection } from "./GovernedStakeholderIntelligenceProjection";
import {
  getStudentDecisionDesktopState,
  type StudentDecisionDesktopContext
} from "./studentDecisionDesktopState";
const StudentDecisionDesktop = lazy(() =>
  import("./StudentDecisionDesktop").then(({ StudentDecisionDesktop: Component }) => ({
    default: Component
  }))
);
const ShanghaiC0ConversionProjection = lazy(() => import("./ShanghaiC0ConversionProjection"));
const ExecutiveStrategyLabProjection = lazy(() =>
  import("./ExecutiveStrategyLabProjection").then(
    ({ ExecutiveStrategyLabProjection: Component }) => ({
      default: Component
    })
  )
);
import { isW3ContextAvailable } from "./p2b-w3-context";
import {
  AppShell,
  AuthorityBadge,
  ContextBar,
  KnownLimitBanner,
  RoleNavigation,
  StatePanel,
  WorkbenchFrame
} from "@simwar/ui";

const O4CrossRoundDynamicsFeature = lazy(() => import("./O4"));
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const SHANGHAI_C0_RECEIPT_ID =
  typeof window === "undefined"
    ? ""
    : (new URLSearchParams(window.location.search).get("shanghaiC0ReceiptId")?.trim() ?? "");
const GSI_CANDIDATE_ID =
  typeof window === "undefined"
    ? ""
    : (new URLSearchParams(window.location.search).get("gsiCandidateId") ?? "");
const ESL_CANDIDATE_ID =
  typeof window === "undefined"
    ? ""
    : (new URLSearchParams(window.location.search).get("eslCandidateId") ?? "");
const REGIONAL_TRANSFER_CANDIDATE_ID =
  typeof window === "undefined"
    ? ""
    : (new URLSearchParams(window.location.search).get("regionalTransferCandidateId") ?? "");
const MODEL_QUALIFICATION_ID =
  typeof window === "undefined"
    ? ""
    : (new URLSearchParams(window.location.search).get("modelQualificationId") ?? "");
function readStoredReauthContext(): ReauthContext | null {
  if (typeof window === "undefined") return null;
  try {
    return parseReauthContext(window.sessionStorage.getItem(REAUTH_CONTEXT_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStoredReauthContext(context: ReauthContext): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(REAUTH_CONTEXT_STORAGE_KEY, serializeReauthContext(context));
  } catch {
    // A storage failure must not turn a safe re-auth flow into a secret-persistence fallback.
  }
}

function clearStoredReauthContext(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(REAUTH_CONTEXT_STORAGE_KEY);
  } catch {
    // Best effort only; no credential is stored here.
  }
}
const StudentDecisionLearningJourney = lazy(() => import("./P2BDecisionLearningJourney"));
const W4EnterpriseStatePanel = lazy(async () => {
  const module = await import("./W4EnterpriseStatePanel");
  return { default: module.W4EnterpriseStatePanel };
});
const ProjectAwareStudentContextPanel = lazy(async () => {
  const module = await import("./ProjectAwareStudentContextPanel");
  return { default: module.ProjectAwareStudentContextPanel };
});
const W5DemandConvergencePanel = lazy(async () => {
  const module = await import("./W5DemandCandidatePanel");
  return { default: module.W5DemandConvergencePanel };
});
const W3_ENABLED =
  import.meta.env.VITE_SIMWAR_W3_ENABLED === "true" ||
  (typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("w3") === "true");
const W3_ENVIRONMENT_ENABLED = import.meta.env.VITE_SIMWAR_W3_ENABLED === "true";

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
const knownLimits = getKnownLimitsProjection("student");
type LoginForm = {
  tenantId: string;
  username: string;
  password: string;
};

const EMPTY_LOGIN: LoginForm = {
  tenantId: "",
  username: "",
  password: ""
};

const DEMO_LOGIN: LoginForm = {
  tenantId: import.meta.env.VITE_SIMWAR_DEMO_TENANT_ID ?? "",
  username: import.meta.env.VITE_SIMWAR_DEMO_USERNAME ?? "",
  password: import.meta.env.VITE_SIMWAR_DEMO_PASSWORD ?? ""
};

const DEMO_LOGIN_ENABLED =
  import.meta.env.VITE_SIMWAR_DEMO_MODE === "true" &&
  Boolean(DEMO_LOGIN.tenantId && DEMO_LOGIN.username && DEMO_LOGIN.password);

export const STUDENT_NAVIGATION_ITEMS = [
  { id: "student-role-mission", label: "角色任务" },
  { id: "student-cockpit", label: "经营驾驶舱" },
  { id: "student-evidence", label: "信息与证据" },
  { id: "student-enterprise-state", label: "企业状态与战略演进" },
  { id: "student-private-draft", label: "个人草稿" },
  { id: "student-collaboration", label: "团队协作" },
  { id: "student-divergence", label: "分歧冲突" },
  { id: "student-confirmation", label: "团队确认" },
  { id: "student-submission", label: "最终提交" },
  { id: "student-results", label: "结果与因果链" },
  { id: "student-debrief", label: "复盘" },
  { id: "student-learning-report", label: "学习报告" },
  { id: "student-learning-path", label: "学习路径" }
] as const;

export function isStudentSessionAllowed(roles: readonly ActorRole[]): boolean {
  return roles.some((role) => role === "learner" || role === "team_captain" || role === "student");
}

export function isCurrentStudentRequest(requestId: number, currentId: number): boolean {
  return requestId === currentId;
}

export function isStudentFieldEditable(
  cockpit: StudentBffCockpitDTO | null,
  field: string
): boolean {
  return (
    cockpit !== null &&
    cockpit.decision_form.editable_fields.includes(field as DecisionPayloadFieldPath)
  );
}

export function getStudentAuthority(
  hasStudentSession: boolean,
  cockpit: StudentBffCockpitDTO | null
): "official" | "unknown" {
  return hasStudentSession &&
    cockpit?.student_cockpit?.evidence_label === "STUDENT_PROJECTION_EVIDENCE" &&
    cockpit.decision_form?.decision_schema_version === "m1-decision-form.v1"
    ? "official"
    : "unknown";
}

export type StudentRoleWorkflowAvailability = "checking" | "active" | "inactive" | "error";

export function isLegacyStudentSubmitAllowed(
  roleWorkflowAvailability: StudentRoleWorkflowAvailability,
  serverAllowsSubmit: boolean
): boolean {
  return roleWorkflowAvailability === "inactive" && serverAllowsSubmit;
}

export function getStudentNoticeCopy(value: string): {
  primary: string;
  compatibility?: string;
} {
  if (value.includes("AUTH-401-002") || /invalid credentials/i.test(value)) {
    return { primary: "登录失败，请检查租户、用户名和密码。", compatibility: value };
  }
  if (/^[A-Z][A-Z0-9_-]+(?:-\d+)*:/.test(value) || /\b(failed|error|denied)\b/i.test(value)) {
    return { primary: "服务端请求失败，请检查当前上下文后重试。", compatibility: value };
  }
  return { primary: value };
}

function toStudentSafeCopy(value: string): string {
  return value.replaceAll("state_true", "正式真值字段");
}

const studentStatusLabels: Record<string, string> = {
  open: "开放",
  closed: "已关闭",
  draft: "草稿",
  pending: "待处理",
  published: "已发布",
  ready: "已就绪",
  confirmed: "已确认",
  active: "进行中"
};

function studentStatusCopy(value: string | undefined, fallback: string): ReactNode {
  if (!value) return fallback;
  return (
    <>
      {studentStatusLabels[value.toLowerCase()] ?? "服务端状态"}{" "}
      <span className="compatibility-copy">{value}</span>
    </>
  );
}

/**
 * The legacy demo-state route is retained only as a bootstrap source because
 * no student bootstrap BFF exists yet. Keep the in-memory projection bounded
 * to the authenticated learner's selected team and selected run. During
 * re-authentication, the saved course/run/round is the only permitted target.
 */
export function projectStudentBootstrapState(
  source: P0DemoState,
  preferredContext?: Pick<ReauthContext, "course_id" | "run_id" | "round_id" | "round_no">
): P0DemoState {
  const ownTeam = source.teams.find(
    (candidate) => candidate.team_id === source.current_user.team_id
  );
  const ownTeamId = ownTeam?.team_id;
  const learnerOwnedRunIds = new Set(
    source.decisions
      .filter((decision) => decision.team_id === ownTeamId)
      .map((decision) => decision.run_id)
  );
  if (source.latest_result?.results.some((result) => result.team_id === ownTeamId)) {
    learnerOwnedRunIds.add(source.latest_result.run_id);
  }
  const latestRun = ownTeam
    ? source.runs
        .slice()
        .reverse()
        .find((run) => run.course_id === ownTeam.course_id || learnerOwnedRunIds.has(run.run_id))
    : undefined;
  const selectedRun = preferredContext
    ? source.runs.find(
        (run) =>
          run.tenant_id === source.current_user.tenant_id &&
          run.run_id === preferredContext.run_id &&
          run.course_id === preferredContext.course_id
      )
    : latestRun;
  const selectedRound = selectedRun
    ? preferredContext
      ? source.rounds.find(
          (round) =>
            round.tenant_id === source.current_user.tenant_id &&
            round.run_id === selectedRun.run_id &&
            round.round_id === preferredContext.round_id &&
            round.round_no === preferredContext.round_no
        )
      : source.rounds
          .filter(
            (round) =>
              round.tenant_id === source.current_user.tenant_id &&
              round.run_id === selectedRun.run_id
          )
          .sort((left, right) => right.round_no - left.round_no)
          .at(0)
    : undefined;
  const { tenants, users, roles, permissions, latest_result, audit_logs, ...safeSource } = source;
  void tenants;
  void users;
  void roles;
  void permissions;
  void latest_result;
  void audit_logs;
  return {
    ...safeSource,
    courses: source.courses.filter(
      (course) => course.course_id === (selectedRun?.course_id ?? ownTeam?.course_id)
    ),
    teams: ownTeam ? [ownTeam] : [],
    runs: selectedRun ? [selectedRun] : [],
    rounds: selectedRound ? [selectedRound] : [],
    decisions: source.decisions.filter(
      (candidate) =>
        candidate.team_id === ownTeamId &&
        candidate.run_id === selectedRun?.run_id &&
        candidate.round_no === selectedRound?.round_no
    ),
    audit_logs: []
  };
}

const defaultDecision: DecisionPayload = {
  pricing: { base_price: 12800 },
  marketing_budget: 180000,
  service_quality_budget: 160000,
  capacity_plan: "expand",
  cash_buffer_target: 0.16,
  strategy_statement: "守住中高端康养客群并优先保证交付能力"
};

async function apiRequest<TData>(
  path: string,
  options: {
    method?: string;
    token?: string;
    tenantId?: string;
    body?: unknown;
    signal?: AbortSignal;
  } = {}
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
    headers,
    ...(options.signal ? { signal: options.signal } : {})
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

export function App() {
  const [state, setState] = useState<P0DemoState | null>(null);
  const [cockpit, setCockpit] = useState<StudentBffCockpitDTO | null>(null);
  const [decisionContextEvidence, setDecisionContextEvidence] =
    useState<StudentDecisionContextEvidence | null>(null);
  const [projectAwareEvidenceAvailability, setProjectAwareEvidenceAvailability] =
    useState<ProjectAwareEvidenceAvailability>("checking");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [login, setLogin] = useState<LoginForm>(EMPTY_LOGIN);
  const [decision, setDecision] = useState<DecisionPayload>(defaultDecision);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(() =>
    readStoredReauthContext() ? "REAUTH_REQUIRED" : "等待服务端状态"
  );
  const [reauthContext, setReauthContext] = useState<ReauthContext | null>(() =>
    readStoredReauthContext()
  );
  const [contextRecoveryState, setContextRecoveryState] = useState<
    "NONE" | "REAUTH_REQUIRED" | "READY" | "CONTEXT_UNAUTHORIZED" | "CONTEXT_STALE"
  >(() => (readStoredReauthContext() ? "REAUTH_REQUIRED" : "NONE"));
  const [w5Projection, setW5Projection] = useState<W5GovernedModelStudentProjection | null>(null);
  const [workspacePhase, setWorkspacePhase] = useState<
    "idle" | "loading" | "empty" | "ready" | "error"
  >("idle");
  const [roleWorkflowAvailability, setRoleWorkflowAvailability] =
    useState<StudentRoleWorkflowAvailability>("checking");
  const [activeHash, setActiveHash] = useState(() => {
    if (typeof window !== "undefined" && window.location.hash) return window.location.hash;
    return "#student-role-mission";
  });
  const refreshIdentity = useRef(0);
  const refreshController = useRef<AbortController | null>(null);
  const authIdentity = useRef(0);
  const authController = useRef<AbortController | null>(null);
  const decisionIdentity = useRef(0);
  const decisionController = useRef<AbortController | null>(null);
  const w5DraftId =
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("w5DraftId") ?? "");
  const operatingWorldDraftId =
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("operatingWorldDraftId") ?? "");

  useEffect(() => {
    const handleHashChange = () => {
      setActiveHash(window.location.hash || "#student-role-mission");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function invalidateDecisionRequest(): void {
    decisionIdentity.current += 1;
    decisionController.current?.abort();
  }

  const latestRun = state?.runs.at(-1);
  const latestRound = latestRun
    ? state?.rounds.find((round) => round.run_id === latestRun.run_id)
    : undefined;
  const team = state?.teams.find((candidate) => candidate.team_id === state.current_user.team_id);
  const publishedResult = cockpit?.published_result;
  const myResult = publishedResult?.redacted_result;
  const resultLabel = publishedResult?.result_label ?? M1_TEACHING_OFFICIAL_RESULT_LABEL;
  const learnerKit = M1_TEACHING_PRODUCT_PACKAGE.learnerOnboarding;
  const submittedDecision = useMemo(() => {
    if (!latestRun || !latestRound || !team || !state) {
      return undefined;
    }

    return state.decisions.find(
      (candidate) =>
        candidate.run_id === latestRun.run_id &&
        candidate.round_no === latestRound.round_no &&
        candidate.team_id === team.team_id
    );
  }, [latestRun, latestRound, team, state]);

  const isStudentSession = Boolean(session && isStudentSessionAllowed(session.user.roles));
  const w3RoleKey =
    team?.members.find((member) => member.user_id === session?.user.user_id)?.role_slot ?? "CEO";
  const w3QueryContext = readW3QueryContext();
  const w3Context =
    w3QueryContext ??
    (latestRun && latestRound && team
      ? {
          activity_id: "activity_consequence",
          course_id: latestRun.course_id,
          role_key: w3RoleKey,
          round_id: latestRound.round_id,
          round_no: latestRound.round_no,
          run_id: latestRun.run_id,
          team_id: team.team_id,
          tenant_id: login.tenantId
        }
      : undefined);
  const w3ContextReady = isW3ContextAvailable(w3QueryContext, W3_ENVIRONMENT_ENABLED);

  const refresh = useCallback(async () => {
    const requestId = ++refreshIdentity.current;
    refreshController.current?.abort();
    const controller = new AbortController();
    refreshController.current = controller;
    if (!session || !isStudentSession) {
      return;
    }
    setState(null);
    setCockpit(null);
    setDecisionContextEvidence(null);
    setProjectAwareEvidenceAvailability("checking");
    setWorkspacePhase("loading");
    setRoleWorkflowAvailability("checking");

    try {
      const auth = {
        token: session.access_token,
        tenantId: login.tenantId,
        signal: controller.signal
      };
      const nextState = await apiRequest<P0DemoState>("/api/v1/demo-state", auth);
      if (!isCurrentStudentRequest(requestId, refreshIdentity.current)) return;
      const studentState = projectStudentBootstrapState(nextState, reauthContext ?? undefined);
      const nextRun = reauthContext
        ? studentState.runs.find(
            (run) =>
              run.run_id === reauthContext.run_id && run.course_id === reauthContext.course_id
          )
        : studentState.runs.at(-1);
      const nextRound = nextRun
        ? reauthContext
          ? studentState.rounds.find(
              (round) =>
                round.run_id === nextRun.run_id &&
                round.round_id === reauthContext.round_id &&
                round.round_no === reauthContext.round_no
            )
          : studentState.rounds.find((round) => round.run_id === nextRun.run_id)
        : undefined;
      const nextTeam = studentState.teams.find(
        (candidate) =>
          candidate.tenant_id === login.tenantId &&
          candidate.team_id === studentState.current_user.team_id
      );

      if (reauthContext && (!nextRun || !nextRound)) {
        setCockpit(null);
        setWorkspacePhase("error");
        setContextRecoveryState("CONTEXT_STALE");
        setNotice("CONTEXT_NOT_FOUND");
        return;
      }

      if (reauthContext && (!nextTeam || nextTeam.team_id !== reauthContext.team_id)) {
        setCockpit(null);
        setWorkspacePhase("error");
        setContextRecoveryState("CONTEXT_UNAUTHORIZED");
        setNotice("CONTEXT_UNAUTHORIZED");
        return;
      }

      if (reauthContext) {
        const identityValidation = validateReauthIdentity(reauthContext, {
          tenant_id: studentState.current_user.tenant_id,
          user_id: studentState.current_user.user_id,
          roles: session.user.roles,
          role_slots: nextTeam
            ? nextTeam.members
                .filter((member) => member.user_id === session.user.user_id)
                .map((member) => member.role_slot)
            : []
        });
        if (identityValidation.status !== "RESTORE_ALLOWED") {
          setCockpit(null);
          setWorkspacePhase("error");
          setContextRecoveryState("CONTEXT_UNAUTHORIZED");
          setNotice("CONTEXT_UNAUTHORIZED");
          return;
        }
      }

      setState(studentState);

      if (!nextRun || !nextRound) {
        setCockpit(null);
        setW5Projection(null);
        setWorkspacePhase("empty");
        return;
      }

      const nextCockpit = await apiRequest<StudentBffCockpitDTO>(
        `/api/v1/bff/student/runs/${nextRun.run_id}/rounds/${nextRound.round_no}/cockpit`,
        auth
      );
      if (!isCurrentStudentRequest(requestId, refreshIdentity.current)) return;
      if (
        reauthContext &&
        (nextCockpit.student_cockpit.tenant_id !== login.tenantId ||
          !isSameReauthBusinessContext(reauthContext, nextCockpit.student_cockpit))
      ) {
        setState(studentState);
        setCockpit(null);
        setWorkspacePhase("error");
        setContextRecoveryState("CONTEXT_STALE");
        setNotice("CONTEXT_NOT_FOUND");
        return;
      }
      setCockpit(nextCockpit);
      if (w5DraftId) {
        try {
          setW5Projection(
            await apiRequest<W5GovernedModelStudentProjection>(
              `/api/v1/bff/student/w5/convergence?draftId=${encodeURIComponent(w5DraftId)}&runId=${encodeURIComponent(nextRun.run_id)}&roundNo=${nextRound.round_no}`,
              auth
            )
          );
        } catch {
          setW5Projection(null);
        }
      } else {
        setW5Projection(null);
      }
      setWorkspacePhase("ready");
      if (reauthContext) {
        setContextRecoveryState("READY");
        // Keep the verified non-secret navigation context so the next full
        // reload still requires explicit reauthentication for this context.
        writeStoredReauthContext(reauthContext);
      }
    } catch (error) {
      if (controller.signal.aborted || !isCurrentStudentRequest(requestId, refreshIdentity.current))
        return;
      setWorkspacePhase("error");
      throw error;
    }
  }, [isStudentSession, login.tenantId, reauthContext, session, w5DraftId]);

  function updateLogin(field: keyof LoginForm, value: string): void {
    authIdentity.current += 1;
    refreshIdentity.current += 1;
    authController.current?.abort();
    refreshController.current?.abort();
    invalidateDecisionRequest();
    setLogin((current) => ({ ...current, [field]: value }));
    setSession(null);
    setState(null);
    setCockpit(null);
    setDecisionContextEvidence(null);
    setProjectAwareEvidenceAvailability("checking");
    setWorkspacePhase("idle");
    setRoleWorkflowAvailability("checking");
    setDecision(defaultDecision);
    setBusy(false);
    setNotice("登录上下文已更改 · context changed");
  }

  async function signIn(nextLogin = login): Promise<void> {
    const requestId = ++authIdentity.current;
    authController.current?.abort();
    invalidateDecisionRequest();
    const controller = new AbortController();
    authController.current = controller;
    setBusy(true);
    setSession(null);
    setState(null);
    setCockpit(null);
    setWorkspacePhase("idle");
    setRoleWorkflowAvailability("checking");
    setDecision(defaultDecision);
    try {
      const nextSession = await apiRequest<AuthSession>("/api/v1/auth/login", {
        method: "POST",
        tenantId: nextLogin.tenantId,
        body: {
          username: nextLogin.username,
          password: nextLogin.password
        },
        signal: controller.signal
      });
      if (requestId !== authIdentity.current) return;
      if (reauthContext && reauthContext.user_id !== nextSession.user.user_id) {
        clearStoredReauthContext();
        setReauthContext(null);
        setContextRecoveryState("NONE");
      } else if (reauthContext) {
        const identityValidation = validateReauthIdentity(reauthContext, {
          tenant_id: nextSession.user.tenant_id,
          user_id: nextSession.user.user_id,
          roles: nextSession.user.roles
        });
        if (identityValidation.status !== "RESTORE_ALLOWED") {
          setContextRecoveryState("CONTEXT_UNAUTHORIZED");
          setNotice("CONTEXT_UNAUTHORIZED");
          return;
        }
      }
      setLogin(nextLogin);
      setSession(nextSession);
      setNotice(
        isStudentSessionAllowed(nextSession.user.roles) ? "已登录" : "当前账号无学员工作区权限"
      );
    } catch (error) {
      if (controller.signal.aborted || requestId !== authIdentity.current) return;
      setNotice(error instanceof Error ? error.message : "登录失败");
    } finally {
      if (requestId === authIdentity.current) setBusy(false);
    }
  }

  useEffect(() => {
    const request = refresh();
    const requestId = refreshIdentity.current;
    request.catch((error: unknown) => {
      if (requestId !== refreshIdentity.current) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice(error instanceof Error ? error.message : "加载失败");
    });
    return () => {
      refreshController.current?.abort();
      refreshIdentity.current += 1;
    };
  }, [refresh]);

  useEffect(() => {
    if (!session || !isStudentSession || !latestRun || !latestRound || !team) return;
    const member = team.members.find((candidate) => candidate.user_id === session.user.user_id);
    if (!member) return;
    const route =
      typeof window === "undefined"
        ? "/"
        : `${window.location.pathname}${window.location.search}${window.location.hash}`;
    writeStoredReauthContext({
      schema_version: 1,
      tenant_id: session.user.tenant_id,
      user_id: session.user.user_id,
      role: member.role_slot,
      course_id: latestRun.course_id,
      run_id: latestRun.run_id,
      team_id: team.team_id,
      round_id: latestRound.round_id,
      round_no: latestRound.round_no,
      route,
      view: "student-role-workspace"
    });
  }, [isStudentSession, latestRound, latestRun, session, team, w3RoleKey]);

  async function submitDecision(): Promise<void> {
    const allowedActions = cockpit?.decision_form.allowed_actions ?? [];
    if (
      !session ||
      !isStudentSession ||
      !latestRun ||
      !latestRound ||
      !team ||
      !isLegacyStudentSubmitAllowed(
        roleWorkflowAvailability,
        allowedActions.includes("decision:submit")
      )
    ) {
      setNotice("当前回合尚未授予正式提交权限");
      return;
    }

    const requestId = ++decisionIdentity.current;
    decisionController.current?.abort();
    const controller = new AbortController();
    decisionController.current = controller;
    const target = {
      token: session.access_token,
      tenantId: login.tenantId,
      runId: latestRun.run_id,
      roundNo: latestRound.round_no,
      teamId: team.team_id
    };
    setBusy(true);
    try {
      await apiRequest<Decision>(
        `/api/v1/runs/${target.runId}/rounds/${target.roundNo}/decisions`,
        {
          method: "POST",
          token: target.token,
          tenantId: target.tenantId,
          signal: controller.signal,
          body: {
            team_id: target.teamId,
            decision_payload: decision
          }
        }
      );
      if (requestId !== decisionIdentity.current) return;
      setNotice("正式决策已提交");
      try {
        await refresh();
      } catch {
        if (requestId === decisionIdentity.current) {
          setNotice("正式决策已提交；最新工作区刷新失败，请重新加载。");
        }
      }
    } catch (error) {
      if (controller.signal.aborted || requestId !== decisionIdentity.current) return;
      setNotice(error instanceof Error ? error.message : "提交失败");
    } finally {
      if (requestId === decisionIdentity.current) setBusy(false);
    }
  }

  const serverAllowsLegacySubmit = Boolean(
    latestRound?.status === "open" &&
    team &&
    session &&
    isStudentSession &&
    cockpit?.decision_form.allowed_actions.includes("decision:submit")
  );
  const canSubmit = isLegacyStudentSubmitAllowed(
    roleWorkflowAvailability,
    serverAllowsLegacySubmit
  );
  const roleWorkflowActive = roleWorkflowAvailability === "active";
  const cards: Array<[string, ReactNode]> = [
    ["身份", session?.user.display_name ?? "未登录"],
    ["课程", state?.courses[0]?.title ?? "等待课程"],
    ["队伍", cockpit?.student_cockpit.visible_state.team_name ?? team?.name ?? "尚未分配队伍"],
    [
      "回合",
      studentStatusCopy(
        cockpit?.student_cockpit.visible_state.round_status ?? latestRound?.status,
        "尚未创建回合"
      )
    ],
    ["决策", submittedDecision ? `v${submittedDecision.version}` : "草稿"],
    ["BFF", studentStatusCopy(cockpit?.student_cockpit.evidence_label, "等待服务端投影")]
  ];
  const hasStudentSurface = Boolean(
    session &&
    isStudentSession &&
    (contextRecoveryState === "NONE" || contextRecoveryState === "READY")
  );
  const activeSession = session && isStudentSession ? session : null;
  const visibleNavigationItems = hasStudentSurface
    ? STUDENT_NAVIGATION_ITEMS
    : [STUDENT_NAVIGATION_ITEMS[0]];
  const studentContext = {
    tenant: hasStudentSurface ? login.tenantId : undefined,
    course: hasStudentSurface ? state?.courses[0]?.title : undefined,
    session: hasStudentSurface ? session?.user.display_name : undefined,
    run: hasStudentSurface ? latestRun?.run_id : undefined,
    round: hasStudentSurface ? latestRound?.round_no : undefined,
    team: hasStudentSurface ? cockpit?.student_cockpit.visible_state.team_name : undefined,
    role: hasStudentSurface ? "学员" : undefined,
    mode: "JSON_INTERNAL_ONLY"
  };
  const noticeCopy = getStudentNoticeCopy(notice);
  const w5Convergence = w5Projection?.convergence;
  const w5Demand = w5Convergence?.demand_realization;
  const course = state?.courses.find((candidate) => candidate.course_id === latestRun?.course_id);
  const desktopContext: StudentDecisionDesktopContext | null =
    latestRun && latestRound && team
      ? {
          tenant_id: login.tenantId,
          course_id: latestRun.course_id,
          ...(course?.title ? { course_title: course.title } : {}),
          run_id: latestRun.run_id,
          round_id: latestRound.round_id,
          round_no: latestRound.round_no,
          team_id: team.team_id
        }
      : cockpit
        ? {
            tenant_id: cockpit.student_cockpit.tenant_id,
            course_id: cockpit.student_cockpit.course_id,
            run_id: cockpit.student_cockpit.run_id,
            round_id: cockpit.student_cockpit.round_id,
            round_no: cockpit.student_cockpit.round_no,
            team_id: cockpit.student_cockpit.team_id
          }
        : null;
  const desktopExactContextReady = Boolean(
    session &&
    isStudentSession &&
    cockpit &&
    latestRun &&
    latestRound &&
    team &&
    cockpit.student_cockpit.tenant_id === login.tenantId &&
    cockpit.student_cockpit.course_id === latestRun.course_id &&
    cockpit.student_cockpit.run_id === latestRun.run_id &&
    cockpit.student_cockpit.round_id === latestRound.round_id &&
    cockpit.student_cockpit.round_no === latestRound.round_no &&
    cockpit.student_cockpit.team_id === team.team_id
  );
  const projectAwareEvidenceExpected = Boolean(
    latestRun && latestRound && team && projectAwareEvidenceAvailability === "required"
  );
  const projectAwareEvidenceGateRequired = Boolean(
    latestRun &&
      latestRound &&
      team &&
      projectAwareEvidenceAvailability !== "disabled" &&
      projectAwareEvidenceAvailability !== "checking"
  );
  const decisionContextEvidenceReady = Boolean(
    projectAwareEvidenceAvailability === "disabled" ||
      (projectAwareEvidenceAvailability === "required" &&
        decisionContextEvidence?.status === "READY" &&
        decisionContextEvidence.scope.tenant_id === login.tenantId &&
        decisionContextEvidence.scope.course_id === latestRun?.course_id &&
        decisionContextEvidence.scope.run_id === latestRun?.run_id &&
        decisionContextEvidence.scope.round_id === latestRound?.round_id &&
        decisionContextEvidence.scope.round_no === latestRound?.round_no &&
        decisionContextEvidence.scope.team_id === team?.team_id &&
        decisionContextEvidence.scope.role_key === w3RoleKey)
  );
  const desktopState = getStudentDecisionDesktopState({
    hasSession: Boolean(session),
    isStudentSession,
    workspacePhase,
    contextRecoveryState,
    exactContextReady: desktopExactContextReady && decisionContextEvidenceReady,
    hasPublishedResult: Boolean(myResult)
  });
  function updateDesktopDecision(
    field: DecisionPayloadFieldPath,
    value: string | number | DecisionPayload["capacity_plan"]
  ): void {
    setDecision((current) => {
      switch (field) {
        case "pricing.base_price":
          return { ...current, pricing: { base_price: Number(value) } };
        case "marketing_budget":
          return { ...current, marketing_budget: Number(value) };
        case "service_quality_budget":
          return { ...current, service_quality_budget: Number(value) };
        case "capacity_plan":
          return { ...current, capacity_plan: value as DecisionPayload["capacity_plan"] };
        case "cash_buffer_target":
          return { ...current, cash_buffer_target: Number(value) };
        case "strategy_statement":
          return { ...current, strategy_statement: String(value) };
      }
    });
  }

  return (
    <AppShell
      workspaceTitle="SimWar M1 学员执行环境"
      navigation={<RoleNavigation items={visibleNavigationItems} activeHref={activeHash} />}
      banner={<ContextBar context={studentContext} />}
      primaryAction={
        <>
          <AuthorityBadge authority={getStudentAuthority(hasStudentSurface, cockpit)} />
          <span>{myResult ? "服务端正式结果" : "学员工作区权限"}</span>{" "}
          {myResult ? <span className="compatibility-copy">{resultLabel}</span> : null}
        </>
      }
    >
      <div className="student-shell-content">
        <section id="student-role-mission" className="student-location" aria-label="角色任务">
          <WorkbenchFrame
            ariaLabel="角色任务"
            eyebrow="当前任务"
            title="先确认角色边界，再开始协作"
            badge={<AuthorityBadge authority="unknown" />}
            boundary="工作区只消费当前学员的服务端投影；没有服务端上下文时不会推断队伍或权限。"
          >
            <h2 className="compatibility-heading">SimWar M1 学员驾驶舱</h2>
            <section className="login-strip" aria-label="student login">
              <label>
                租户
                <input
                  aria-label="tenant"
                  value={login.tenantId}
                  onChange={(event) => updateLogin("tenantId", event.target.value)}
                />
              </label>
              <label>
                用户名
                <input
                  aria-label="username"
                  value={login.username}
                  onChange={(event) => updateLogin("username", event.target.value)}
                />
              </label>
              <label>
                密码
                <input
                  aria-label="password"
                  type="password"
                  value={login.password}
                  onChange={(event) => updateLogin("password", event.target.value)}
                />
              </label>
              <button disabled={busy} onClick={() => void signIn()}>
                学员登录
              </button>
              {DEMO_LOGIN_ENABLED ? (
                <button disabled={busy} onClick={() => void signIn(DEMO_LOGIN)}>
                  演示登录
                </button>
              ) : null}
            </section>
            {!session ? (
              <StatePanel
                status="unknown"
                message={
                  <>
                    {notice.startsWith("登录上下文已更改")
                      ? "登录上下文已更改，请重新登录。"
                      : contextRecoveryState === "REAUTH_REQUIRED"
                        ? "REAUTH_REQUIRED：刷新后请重新登录以恢复已验证业务上下文。"
                        : contextRecoveryState === "CONTEXT_UNAUTHORIZED"
                          ? "CONTEXT_UNAUTHORIZED：当前登录身份无权恢复此上下文。"
                          : contextRecoveryState === "CONTEXT_STALE"
                            ? "CONTEXT_NOT_FOUND：保存的回合上下文已失效，请选择有效的授权入口。"
                            : noticeCopy.compatibility
                              ? noticeCopy.primary
                              : "请登录后查看当前学员工作区。"}{" "}
                    <span className="compatibility-copy">
                      not signed in ·{" "}
                      {notice.startsWith("登录上下文已更改")
                        ? "context changed"
                        : contextRecoveryState === "REAUTH_REQUIRED"
                          ? "REAUTH_REQUIRED"
                          : contextRecoveryState === "CONTEXT_UNAUTHORIZED"
                            ? "CONTEXT_UNAUTHORIZED"
                            : contextRecoveryState === "CONTEXT_STALE"
                              ? "CONTEXT_NOT_FOUND"
                              : (noticeCopy.compatibility ?? "ready")}
                    </span>
                  </>
                }
              />
            ) : !isStudentSession ? (
              <StatePanel status="permission-denied" message="当前账号没有学员工作区权限。" />
            ) : (
              <>
                <p className="student-task-summary">
                  学员工作区 · {activeSession?.user.display_name} · {login.tenantId} ·{" "}
                  <span className="compatibility-copy">
                    {activeSession?.user.roles.join(" / ")} · {login.tenantId} · signed in
                  </span>
                </p>
                {workspacePhase === "error" ? (
                  <StatePanel
                    status="error"
                    message={
                      contextRecoveryState === "CONTEXT_UNAUTHORIZED"
                        ? "CONTEXT_UNAUTHORIZED：不会跨租户或跨角色恢复。"
                        : contextRecoveryState === "CONTEXT_STALE"
                          ? "CONTEXT_NOT_FOUND：不会静默切换到最新或默认回合。"
                          : "学员服务端投影加载失败；不会使用旧上下文或客户端推断。"
                    }
                    recoveryAction="重新加载学员工作区"
                    onRecover={() => void refresh().catch(() => undefined)}
                  />
                ) : null}
              </>
            )}
          </WorkbenchFrame>
        </section>

        {hasStudentSurface ? (
          <section className="known-limits-disclosure" aria-label="known limits product disclosure">
            <p className="eyebrow">
              内部使用边界 <span className="compatibility-copy">Internal Use Boundary</span>
            </p>
            <h2>已知限制与内部使用说明</h2>
            <p>{knownLimits.summary}</p>
            <KnownLimitBanner
              limitation="当前运行时仍为 JSON_INTERNAL_ONLY。"
              unaffected="学员安全 BFF 投影、角色草稿与确认链保持原有服务端边界。"
              notProven="尚未证明持久化恢复、生产部署或跨租户可见性。"
              scope="范围：当前学员、本租户、本队伍。"
            />
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

        {hasStudentSurface ? (
          <section id="student-cockpit" className="student-location" aria-label="经营驾驶舱">
            <WorkbenchFrame
              ariaLabel="经营驾驶舱"
              eyebrow="服务端投影"
              title="当前经营上下文"
              badge={<AuthorityBadge authority="unknown" />}
              boundary="排名、分数与回合状态仅作为服务端投影显示，客户端不计算正式指标。"
            >
              <section className="board" aria-label="learner status">
                {cards.map(([name, value]) => (
                  <article className="row" key={name}>
                    <span>{name}</span>
                    <strong>{value}</strong>
                  </article>
                ))}
              </section>
            </WorkbenchFrame>
          </section>
        ) : null}

        {hasStudentSurface ? (
          <section>
            <div role="region" aria-label="W5 governed model convergence">
              <Suspense fallback={null}>
                {w5Projection && w5Convergence && w5Demand ? (
                  <W5DemandConvergencePanel projection={w5Projection} />
                ) : null}
                <O4CrossRoundDynamicsFeature c={[activeSession, latestRun, team, login.tenantId]} />
              </Suspense>
            </div>
          </section>
        ) : null}

        {hasStudentSurface ? (
          <ModelQualificationProjection
            apiBase={API_BASE}
            courseId={latestRun?.course_id}
            qualificationId={MODEL_QUALIFICATION_ID}
            tenantId={login.tenantId}
            token={activeSession?.access_token ?? ""}
          />
        ) : null}

        {hasStudentSurface ? (
          <GovernedStakeholderIntelligenceProjection
            apiBase={API_BASE}
            candidateId={GSI_CANDIDATE_ID}
            tenantId={login.tenantId}
            token={activeSession?.access_token ?? ""}
          />
        ) : null}

        {hasStudentSurface ? (
          <Suspense fallback={<p className="muted">正在载入 Student Strategy Lab projection…</p>}>
            <ExecutiveStrategyLabProjection
              apiBase={API_BASE}
              candidateId={ESL_CANDIDATE_ID}
              tenantId={login.tenantId}
              token={activeSession?.access_token ?? ""}
            />
          </Suspense>
        ) : null}

        {hasStudentSurface && SHANGHAI_C0_RECEIPT_ID ? (
          <Suspense fallback={<p className="muted">正在载入 Shanghai C0 conversion…</p>}>
            <ShanghaiC0ConversionProjection
              apiBase={API_BASE}
              receiptId={SHANGHAI_C0_RECEIPT_ID}
              tenantId={login.tenantId}
              token={activeSession?.access_token ?? ""}
            />
          </Suspense>
        ) : null}

        {hasStudentSurface ? (
          <section>
            <Suspense fallback={null}>
              <ShanghaiFullVerticalStudentPanel
                apiBase={API_BASE}
                courseId={latestRun?.course_id}
                draftId={w5DraftId}
                roundNo={latestRound?.round_no}
                runId={latestRun?.run_id}
                tenantId={login.tenantId}
                token={activeSession?.access_token ?? ""}
              />
            </Suspense>
          </section>
        ) : null}

        {hasStudentSurface && REGIONAL_TRANSFER_CANDIDATE_ID ? (
          <section
            id="student-regional-transfer"
            className="student-location"
            aria-label="区域迁移与场景演化"
          >
            <RegionalTransferProjection
              apiBase={API_BASE}
              candidateId={REGIONAL_TRANSFER_CANDIDATE_ID}
              token={activeSession?.access_token ?? ""}
            />
          </section>
        ) : null}

        {hasStudentSurface && operatingWorldDraftId ? (
          <section
            id="student-operating-world-brief"
            className="student-location"
            aria-label="Operating World Brief"
          >
            <OperatingWorldBrief
              apiBase={API_BASE}
              courseId={latestRun?.course_id}
              draftId={operatingWorldDraftId}
              roundNo={latestRound?.round_no}
              runId={latestRun?.run_id}
              tenantId={login.tenantId}
              token={activeSession?.access_token ?? ""}
            />
          </section>
        ) : null}

        {hasStudentSurface ? (
          <section id="student-evidence" className="student-location" aria-label="信息与证据">
            <GoldenJourneyWorkbench
              courseId={latestRun?.course_id}
              runId={latestRun?.run_id}
              teamId={team?.team_id}
              tenantId={login.tenantId}
              token={activeSession?.access_token ?? ""}
            />
          </section>
        ) : null}

        {hasStudentSurface ? (
          <section
            id="student-enterprise-state"
            className="student-location"
            aria-label="企业状态与战略演进"
          >
            <Suspense fallback={<p className="muted">正在载入企业战略状态…</p>}>
              <W4EnterpriseStatePanel
                token={activeSession?.access_token ?? ""}
                tenantId={login.tenantId}
                courseId={latestRun?.course_id}
                runId={latestRun?.run_id}
                roundId={latestRound?.round_id}
                roundNo={latestRound?.round_no}
                teamId={team?.team_id}
              />
            </Suspense>
            <ProjectBriefPanel
              courseId={latestRun?.course_id}
              runId={latestRun?.run_id}
              roundId={latestRound?.round_id}
              teamId={team?.team_id}
              tenantId={login.tenantId}
              token={activeSession?.access_token ?? ""}
              onAvailabilityChange={setProjectAwareEvidenceAvailability}
            />
            {latestRun && projectAwareEvidenceExpected ? (
              <Suspense fallback={<p className="muted">正在载入项目上下文…</p>}>
                <ProjectAwareStudentContextPanel
                  baseUrl={API_BASE}
                  courseId={latestRun.course_id}
                  runId={latestRun.run_id}
                  roundId={latestRound?.round_id}
                  teamId={team?.team_id}
                  tenantId={login.tenantId}
                  token={activeSession?.access_token ?? ""}
                  onEvidenceChange={setDecisionContextEvidence}
                />
              </Suspense>
            ) : null}
          </section>
        ) : null}

        {hasStudentSurface ? (
          <section id="student-private-draft" className="student-location" aria-label="个人草稿">
            <Suspense fallback={<p className="muted">正在载入个人角色草稿…</p>}>
              <StudentRoleWorkflowPanel
                active={latestRound?.status === "open"}
                roundId={latestRound?.round_id}
                runId={latestRun?.run_id}
                teamId={team?.team_id}
                tenantId={login.tenantId}
                token={activeSession?.access_token}
                activeRoleKeys={team ? team.members.map((member) => member.role_slot) : []}
                decisionContextEvidenceId={
                  projectAwareEvidenceExpected ? decisionContextEvidence?.evidence_id : undefined
                }
                decisionContextEvidenceRequired={projectAwareEvidenceGateRequired}
                decisionContextEvidenceReady={decisionContextEvidenceReady}
                onAvailabilityChange={setRoleWorkflowAvailability}
              />
            </Suspense>
          </section>
        ) : null}

        {hasStudentSurface ? (
          <section id="student-w027-decision-experience" aria-label="W027 决策体验">
            <W027DecisionExperiencePanel
              active={latestRound?.status === "open"}
              courseId={latestRun?.course_id}
              roundId={latestRound?.round_id}
              runId={latestRun?.run_id}
              teamId={team?.team_id}
              tenantId={login.tenantId}
              token={activeSession?.access_token}
            />
          </section>
        ) : null}

        {hasStudentSurface ? (
          <>
            <section id="student-collaboration" className="student-location" aria-label="团队协作">
              <WorkbenchFrame
                ariaLabel="团队协作"
                eyebrow="协作"
                title="团队协作状态"
                badge={<AuthorityBadge authority="draft" />}
                boundary="仅显示当前队伍允许学员看到的协作状态，不展示其他成员的私有草稿。"
              >
                <StatePanel
                  status={roleWorkflowActive ? "ready" : "unknown"}
                  message={
                    roleWorkflowActive
                      ? "角色工作区已由服务端开放。"
                      : "等待服务端返回当前队伍的角色协作上下文。"
                  }
                />
              </WorkbenchFrame>
            </section>
            <section id="student-divergence" className="student-location" aria-label="分歧冲突">
              <WorkbenchFrame
                ariaLabel="分歧冲突"
                eyebrow="冲突处理"
                title="分歧与冲突"
                badge={<AuthorityBadge authority="unknown" />}
                boundary="当前 Student BFF 未提供对手或队友私有差异；没有服务端冲突证据时保持未知。"
              >
                <StatePanel status="unknown" message="尚无服务端冲突投影；不会在客户端猜测差异。" />
                <KnownLimitBanner
                  limitation="当前 BFF 没有返回跨成员私有差异。"
                  unaffected="当前队伍的角色草稿和服务端确认链不受影响。"
                  notProven="尚未证明跨队伍协作或对手策略可见性。"
                  scope="范围：本学员、本租户、本回合。"
                />
              </WorkbenchFrame>
            </section>
            <section id="student-confirmation" className="student-location" aria-label="团队确认">
              <WorkbenchFrame
                ariaLabel="团队确认"
                eyebrow="团队决策链"
                title="团队确认"
                badge={<AuthorityBadge authority="draft" />}
                boundary="正式 Decision 只能由服务端允许的合并与确认链生成。"
              >
                <StatePanel
                  status={roleWorkflowActive ? "partial" : "unknown"}
                  message={
                    roleWorkflowActive
                      ? "请在角色工作区完成服务端校验后的团队确认。"
                      : "当前没有可确认的服务端团队上下文。"
                  }
                />
              </WorkbenchFrame>
            </section>
          </>
        ) : null}

        {hasStudentSurface ? (
          <Suspense fallback={<StatePanel status="loading" message="正在载入学员决策桌面…" />}>
            <StudentDecisionDesktop
              desktopState={desktopState}
              context={desktopContext}
              decisionContextEvidence={decisionContextEvidence}
              cockpit={cockpit}
              decision={decision}
              {...(submittedDecision ? { submittedDecision } : {})}
              {...(myResult ? { publishedResult: myResult } : {})}
              busy={busy}
              canSubmit={canSubmit}
              roundIsOpen={latestRound?.status === "open"}
              roleWorkflowActive={roleWorkflowActive}
              roleWorkflowAvailability={roleWorkflowAvailability}
              notice={noticeCopy.primary}
              onDecisionChange={updateDesktopDecision}
              onSubmit={() => void submitDecision()}
              onRecover={() => void refresh().catch(() => undefined)}
            />
          </Suspense>
        ) : null}

        {hasStudentSurface ? (
          <section id="student-debrief" className="student-location" aria-label="复盘">
            <WorkbenchFrame
              ariaLabel="复盘"
              eyebrow="反馈"
              title="决策学习与复盘"
              badge={<AuthorityBadge authority="advisory" />}
              boundary="正式结果只读；学习输入与建议不能写入正式决策或结算真值。"
            >
              <Suspense fallback={<p className="muted">正在载入学习旅程…</p>}>
                <StudentDecisionLearningJourney
                  apiBase={API_BASE}
                  context={W3_ENABLED && w3ContextReady ? w3Context : undefined}
                  tenantId={login.tenantId}
                  token={activeSession?.access_token ?? ""}
                  published={W3_ENABLED && w3ContextReady && Boolean(myResult)}
                  decisionContextEvidence={
                    projectAwareEvidenceExpected ? (decisionContextEvidence ?? null) : null
                  }
                  decisionContextEvidenceRequired={projectAwareEvidenceGateRequired}
                  crossRoundEnabled={W3_ENABLED && w3ContextReady}
                  m4={
                    latestRun &&
                    latestRound && [latestRun.course_id, latestRun.run_id, latestRound.round_no]
                  }
                />
              </Suspense>
              <details className="p2b-compatibility-details">
                <summary>顾问兼容入口（advisory-only）</summary>
                <StudentRoleAdvisor
                  apiBase={API_BASE}
                  roundId={latestRound?.round_id}
                  runId={latestRun?.run_id}
                  teamId={team?.team_id}
                  tenantId={login.tenantId}
                  token={activeSession?.access_token ?? ""}
                />
              </details>
            </WorkbenchFrame>
          </section>
        ) : null}

        {W3_ENABLED && hasStudentSurface ? (
          <section
            id="student-w3-consequence"
            className="student-location"
            aria-label="W3 官方后果与决策学习"
          >
            <W3OfficialConsequenceLearningPanel
              apiBase={API_BASE}
              context={W3_ENABLED && w3ContextReady ? w3Context : undefined}
              tenantId={login.tenantId}
              token={activeSession?.access_token ?? ""}
            />
          </section>
        ) : null}

        {hasStudentSurface ? (
          <section id="student-learning-report" className="student-location" aria-label="学习报告">
            <StudentLearningReportPanel
              tenantId={login.tenantId}
              token={activeSession?.access_token ?? ""}
            />
          </section>
        ) : null}

        {hasStudentSurface ? (
          <section
            id="student-learning-path"
            className="learner-guide student-location"
            aria-label="学习路径"
          >
            <article className="panel guide-panel">
              <div className="panel-title">
                <h2>学员试讲导入</h2>
                <span>{learnerKit.title}</span>
              </div>
              <p>{learnerKit.roleBriefing}</p>
              <ul>
                {learnerKit.decisionRules.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="panel guide-panel">
              <div className="panel-title">
                <h2>提交前检查</h2>
                <span>团队决策</span>
              </div>
              <ul>
                {learnerKit.submissionChecklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="panel guide-panel">
              <div className="panel-title">
                <h2>反馈怎么读</h2>
                <span>安全结果视图</span>
              </div>
              <ul>
                {learnerKit.resultReadingGuide.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="visibility-note">{toStudentSafeCopy(learnerKit.visibilityBoundary)}</p>
            </article>
          </section>
        ) : null}

        {hasStudentSurface && cockpit ? (
          <section
            className="bff-surface"
            aria-label="信息与证据补充"
            data-logical-location="student-evidence"
          >
            <article className="panel bff-panel">
              <div className="panel-title">
                <h2>BFF 学员驾驶舱</h2>
                <span>{cockpit.student_cockpit.evidence_label}</span>
              </div>
              <div className="status-grid">
                <div>
                  <span>队伍</span>
                  <strong>{cockpit.student_cockpit.visible_state.team_name}</strong>
                </div>
                <div>
                  <span>回合</span>
                  <strong>
                    {studentStatusCopy(
                      cockpit.student_cockpit.visible_state.round_status,
                      "未知状态"
                    )}
                  </strong>
                </div>
                <div>
                  <span>租户</span>
                  <strong>{cockpit.student_cockpit.tenant_id}</strong>
                </div>
              </div>
              <p className="evidence-note">
                受保护字段已隐藏：{cockpit.student_cockpit.forbidden_fields.length}
              </p>
            </article>

            <article className="panel bff-panel">
              <div className="panel-title">
                <h2>BFF 决策表单</h2>
                <span>{cockpit.decision_form.evidence_label}</span>
              </div>
              <div className="status-grid">
                <div>
                  <span>契约版本</span>
                  <strong>{cockpit.decision_form.decision_schema_version}</strong>
                </div>
                <div>
                  <span>可编辑字段</span>
                  <strong>{cockpit.decision_form.editable_fields.length}</strong>
                </div>
                <div>
                  <span>允许动作</span>
                  <strong>{cockpit.decision_form.allowed_actions.length}</strong>
                </div>
              </div>
              <ul className="tag-list">
                {cockpit.decision_form.editable_fields.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            </article>

            <article className="panel bff-panel">
              <div className="panel-title">
                <h2>BFF 发布结果</h2>
                <span>{cockpit.published_result.evidence_label}</span>
              </div>
              {myResult ? (
                <div className="status-grid">
                  <div>
                    <span>排名（服务端投影）</span>
                    <strong>{myResult.state_obs.rank}</strong>
                  </div>
                  <div>
                    <span>分数（服务端投影）</span>
                    <strong>{myResult.state_obs.score}</strong>
                  </div>
                  <div>
                    <span>利润区间</span>
                    <strong>{myResult.state_obs.profit_band}</strong>
                  </div>
                </div>
              ) : (
                <p className="muted">结果发布后显示可见反馈。</p>
              )}
              {myResult ? (
                <p className="evidence-note">
                  服务端结果标签：{" "}
                  <span className="compatibility-copy">
                    {cockpit.published_result.result_label}
                  </span>
                </p>
              ) : null}
            </article>

            <article className="panel bff-panel">
              <div className="panel-title">
                <h2>三段式反馈</h2>
                <span>{cockpit.three_part_feedback.evidence_label}</span>
              </div>
              {cockpit.three_part_feedback.feedback.what_happened ? (
                <div className="feedback-stack">
                  <div>
                    <span>发生了什么</span>
                    <strong>
                      排名 {cockpit.three_part_feedback.feedback.what_happened.rank} / 分数{" "}
                      {cockpit.three_part_feedback.feedback.what_happened.score}
                    </strong>
                  </div>
                  <div>
                    <span>为什么发生</span>
                    <p>{cockpit.three_part_feedback.feedback.why_it_happened}</p>
                  </div>
                  <div>
                    <span>下一步风险</span>
                    <strong>{cockpit.three_part_feedback.feedback.next_step_risk}</strong>
                  </div>
                </div>
              ) : (
                <p className="muted">等待发布后的三段式反馈。</p>
              )}
            </article>

            <article className="panel bff-panel">
              <div className="panel-title">
                <h2>
                  学习报告 <span className="compatibility-copy">Learning Report</span>
                </h2>
                <span>{cockpit.learning_report.evidence_label}</span>
              </div>
              <div className="status-grid">
                <div>
                  <span>建议范围</span>
                  <strong>
                    仅建议：是 <span className="compatibility-copy">advisory_only: true</span>
                  </strong>
                </div>
                <div>
                  <span>正式评分</span>
                  <strong>
                    {cockpit.learning_report.learning_evidence.formal_grade ? "是" : "否"}
                  </strong>
                </div>
                <div>
                  <span>学习提示</span>
                  <strong>{cockpit.learning_report.learning_evidence.prompts.length}</strong>
                </div>
              </div>
              <ul className="compact-list">
                {cockpit.learning_report.learning_evidence.prompts.map((prompt) => (
                  <li key={prompt}>{toStudentSafeCopy(prompt)}</li>
                ))}
              </ul>
            </article>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
