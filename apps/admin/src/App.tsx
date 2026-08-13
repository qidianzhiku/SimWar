import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getKnownLimitsProjection } from "@simwar/shared-contracts";
import type {
  ActorRole,
  AdminState,
  ApiEnvelope,
  AuthSession,
  CoursePackageVersion,
  CoursePackageVersionDraftInput,
  SyntheticRunLifecycleControlDTO,
  SyntheticRunLifecycleOperation,
  User
} from "@simwar/shared-contracts";
import {
  executeRunLifecycleOperation,
  getAdminSummaryErrorMessage,
  loadAdminSummary,
  loadRunLifecycleControls,
  type AdminSummarySurface
} from "./admin-bff";
import {
  createAdminCoursePackageDraft,
  exportAdminCoursePackageVersion,
  getAdminCoursePackageSurfaceState,
  importAdminCoursePackageVersion,
  loadAdminCoursePackageVersions,
  runAdminCoursePackageLifecycle,
  type AdminCoursePackageOperation,
  type CoursePackageSurfaceState
} from "./course-package-client";
import { CourseReportBuilder } from "./CourseReportBuilder";
import { D5ExportWorkbench } from "./D5ExportWorkbench";
import { TenantBaselineWorkbench } from "./TenantBaselineWorkbench";
import { TransferResearchWorkbench } from "./features/transfer-research-workbench";
import { AuthorityBadge } from "@simwar/ui";
import {
  AdminDeliveryTrustWorkspace,
  AdminEnvironmentRecoveryLimit,
  AdminLifecycleOperationButton,
  ADMIN_NAVIGATION_ITEMS,
  formatLifecycleBlockedReasons
} from "./AdminDeliveryTrustWorkspace";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
type LoginForm = {
  tenantId: string;
  username: string;
  password: string;
};

export interface AdminRequestIdentity {
  epoch: number;
  tenantId: string;
  username: string;
  sessionId: string;
  accessToken: string;
}

export function isAdminRequestCurrent(
  request: AdminRequestIdentity,
  current: AdminRequestIdentity
): boolean {
  return (
    request.epoch === current.epoch &&
    request.tenantId === current.tenantId &&
    request.username === current.username &&
    request.sessionId === current.sessionId &&
    request.accessToken === current.accessToken
  );
}

type CoursePackageDraftForm = {
  blueprintDigest: string;
  blueprintId: string;
  blueprintVersion: string;
  description: string;
  packageId: string;
  parameterDigest: string;
  parameterId: string;
  parameterVersion: string;
  scenarioDigest: string;
  scenarioId: string;
  scenarioVersion: string;
  sourceTenantId: string;
  title: string;
  version: string;
};

type CoursePackageListState =
  | { phase: "IDLE" | "LOADING" }
  | { packages: readonly CoursePackageVersion[]; phase: "READY" }
  | { phase: "ERROR"; surfaceState: CoursePackageSurfaceState };

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

const EMPTY_COURSE_PACKAGE_DRAFT: CoursePackageDraftForm = {
  blueprintDigest: "",
  blueprintId: "",
  blueprintVersion: "",
  description: "",
  packageId: "",
  parameterDigest: "",
  parameterId: "",
  parameterVersion: "",
  scenarioDigest: "",
  scenarioId: "",
  scenarioVersion: "",
  sourceTenantId: "",
  title: "",
  version: ""
};

const roleOptions: ActorRole[] = [
  "tenant_admin",
  "teacher",
  "learner",
  "team_captain",
  "scenario_designer"
];

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

export function coursePackageStatusLabel(
  state: CoursePackageSurfaceState,
  operation: AdminCoursePackageOperation
): string {
  if (state === "DEPENDENCY_MISSING") return "缺少可绑定的依赖";
  if (state === "DIGEST_MISMATCH") {
    return operation === "import" ? "导入失败：摘要不匹配" : "摘要不匹配";
  }
  if (state === "EXPORT_RESTRICTED") return "导出受限";
  if (state === "INCOMPATIBLE") return "依赖不兼容";
  if (state === "PERMISSION_DENIED") return "当前会话无权执行此操作";
  if (state === "STALE") return "版本已过期或不可用";
  return "课程包版本状态暂时无法确认";
}

export function getAdminVisibleErrorMessage(
  error: unknown,
  fallback = "请求暂时无法完成，请稍后重试。"
) {
  const raw = error instanceof Error ? error.message : "";
  if (/AUTH[-_]|invalid credentials|登录/u.test(raw)) {
    return "登录失败，请检查租户、用户名和密码。";
  }
  if (/BFF-422-001|Explicit platform scope/u.test(raw)) {
    return "平台范围参数无效，请重新加载。";
  }
  if (/Sign in is required|需要登录/u.test(raw)) {
    return "请先登录管理员会话。";
  }
  if (/Admin summary is unavailable for this role/u.test(raw)) {
    return "当前角色无法读取管理摘要。";
  }
  if (/Admin summary is unavailable/u.test(raw)) {
    return "管理摘要暂时无法加载，请稍后重试。";
  }
  if (/Run lifecycle operation was denied/u.test(raw)) {
    return "运行操作被服务端边界拒绝。";
  }
  if (/load failed|request failed|failed/u.test(raw)) {
    return fallback;
  }
  return raw && !/[A-Za-z]{3,}/u.test(raw) ? raw : fallback;
}

export function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [state, setState] = useState<AdminState | null>(null);
  const [adminSummary, setAdminSummary] = useState<AdminSummarySurface>({ kind: "none" });
  const [summaryStatus, setSummaryStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [summaryError, setSummaryError] = useState("");
  const [lifecycleControls, setLifecycleControls] = useState<SyntheticRunLifecycleControlDTO[]>([]);
  const [lifecycleStatus, setLifecycleStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [lifecycleError, setLifecycleError] = useState("");
  const [coursePackageList, setCoursePackageList] = useState<CoursePackageListState>({
    phase: "IDLE"
  });
  const [coursePackageFeedback, setCoursePackageFeedback] = useState<{
    operation: AdminCoursePackageOperation;
    surfaceState: CoursePackageSurfaceState;
  } | null>(null);
  const [coursePackageDraft, setCoursePackageDraft] = useState<CoursePackageDraftForm>(
    EMPTY_COURSE_PACKAGE_DRAFT
  );
  const [coursePackageImportPayload, setCoursePackageImportPayload] = useState("");
  const [coursePackageExportPayload, setCoursePackageExportPayload] = useState("");
  const [login, setLogin] = useState<LoginForm>(EMPTY_LOGIN);
  const [userDraft, setUserDraft] = useState({
    tenant_id: "tenant_demo",
    username: "new_learner",
    email: "new-learner@demo.simwar.local",
    display_name: "New Learner",
    password: "",
    role: "learner" as ActorRole
  });
  const [notice, setNotice] = useState("准备就绪");
  const [busy, setBusy] = useState(false);
  const [activeHash, setActiveHash] = useState(() => {
    if (typeof window !== "undefined" && window.location.hash) return window.location.hash;
    return "#admin-delivery-overview";
  });
  const adminRequestEpoch = useRef(0);
  const adminRequestIdentityRef = useRef<AdminRequestIdentity>({
    accessToken: "",
    epoch: 0,
    sessionId: "",
    tenantId: "",
    username: ""
  });

  function buildAdminRequestIdentity(
    epoch: number,
    nextLogin: LoginForm,
    nextSession: AuthSession | null
  ): AdminRequestIdentity {
    return {
      accessToken: nextSession?.access_token ?? "",
      epoch,
      sessionId: nextSession?.user.user_id ?? "",
      tenantId: nextLogin.tenantId.trim(),
      username: nextLogin.username.trim()
    };
  }

  function isCurrentAdminContext(identity: AdminRequestIdentity): boolean {
    return isAdminRequestCurrent(identity, adminRequestIdentityRef.current);
  }

  const tenantMap = useMemo(
    () => new Map((state?.tenants ?? []).map((tenant) => [tenant.tenant_id, tenant.name])),
    [state?.tenants]
  );
  const recentAudits = state?.audit_logs.slice(-8).reverse() ?? [];
  const isTenantAdmin = session?.user.roles.includes("tenant_admin") ?? false;
  const hasAdminSummaryRole =
    session?.user.roles.some((role) => role === "tenant_admin" || role === "platform_admin") ??
    false;
  const hasCoursePackageAdminRole = hasAdminSummaryRole;
  const knownLimits = session?.user.roles.includes("platform_admin")
    ? getKnownLimitsProjection("platform_admin")
    : getKnownLimitsProjection("tenant_admin");
  const navigationItems = session
    ? isTenantAdmin
      ? ADMIN_NAVIGATION_ITEMS
      : hasAdminSummaryRole
        ? ADMIN_NAVIGATION_ITEMS.filter((item) => item.id !== "admin-users-roles")
        : []
    : ADMIN_NAVIGATION_ITEMS.filter((item) =>
        ["admin-delivery-overview", "admin-audit-receipts", "admin-security-projection"].includes(
          item.id
        )
      );

  useEffect(() => {
    const handleHashChange = () => {
      setActiveHash(window.location.hash || "#admin-delivery-overview");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const refresh = useCallback(async () => {
    const requestIdentity = adminRequestIdentityRef.current;
    if (!session || !session.user.roles.includes("tenant_admin")) {
      if (isCurrentAdminContext(requestIdentity)) {
        setState(null);
      }
      return;
    }

    try {
      const nextState = await apiRequest<AdminState>("/api/v1/admin/state", {
        token: session.access_token,
        tenantId: login.tenantId
      });
      if (isCurrentAdminContext(requestIdentity)) {
        setState(nextState);
      }
    } catch (error) {
      if (isCurrentAdminContext(requestIdentity)) {
        throw error;
      }
    }
  }, [login.tenantId, session]);

  const refreshLifecycleControls = useCallback(async () => {
    const requestIdentity = adminRequestIdentityRef.current;
    if (!session?.user.roles.includes("tenant_admin")) {
      if (isCurrentAdminContext(requestIdentity)) {
        setLifecycleControls([]);
        setLifecycleStatus("idle");
      }
      return;
    }

    if (!isCurrentAdminContext(requestIdentity)) return;
    setLifecycleStatus("loading");
    setLifecycleError("");
    try {
      const controls = await loadRunLifecycleControls(session.access_token, (path, init) =>
        fetch(`${API_BASE}${path}`, init)
      );
      if (!isCurrentAdminContext(requestIdentity)) return;
      setLifecycleControls(controls);
      setLifecycleStatus("ready");
    } catch (error) {
      if (!isCurrentAdminContext(requestIdentity)) return;
      setLifecycleControls([]);
      setLifecycleError(getAdminVisibleErrorMessage(getAdminSummaryErrorMessage(error)));
      setLifecycleStatus("error");
    }
  }, [session]);

  const refreshCoursePackages = useCallback(async () => {
    const requestIdentity = adminRequestIdentityRef.current;
    if (!session?.user.roles.some((role) => role === "tenant_admin" || role === "platform_admin")) {
      if (isCurrentAdminContext(requestIdentity)) {
        setCoursePackageList({ phase: "IDLE" });
      }
      return;
    }

    if (!isCurrentAdminContext(requestIdentity)) return;
    setCoursePackageList({ phase: "LOADING" });
    setCoursePackageFeedback(null);
    try {
      const packages = await loadAdminCoursePackageVersions(session.access_token, (path, init) =>
        fetch(`${API_BASE}${path}`, init)
      );
      if (!isCurrentAdminContext(requestIdentity)) return;
      setCoursePackageList({ packages, phase: "READY" });
    } catch (error) {
      if (!isCurrentAdminContext(requestIdentity)) return;
      setCoursePackageList({
        phase: "ERROR",
        surfaceState: getAdminCoursePackageSurfaceState(error, "list")
      });
    }
  }, [session]);

  function updateLogin(field: keyof LoginForm, value: string): void {
    const nextLogin = { ...login, [field]: value };
    const epoch = adminRequestEpoch.current + 1;
    adminRequestEpoch.current = epoch;
    adminRequestIdentityRef.current = buildAdminRequestIdentity(epoch, nextLogin, null);
    setLogin((current) => ({ ...current, [field]: value }));
    setSession(null);
    setState(null);
    setAdminSummary({ kind: "none" });
    setSummaryStatus("idle");
    setSummaryError("");
    setLifecycleControls([]);
    setLifecycleStatus("idle");
    setLifecycleError("");
    setCoursePackageList({ phase: "IDLE" });
    setCoursePackageFeedback(null);
    setCoursePackageDraft(EMPTY_COURSE_PACKAGE_DRAFT);
    setCoursePackageImportPayload("");
    setCoursePackageExportPayload("");
    setBusy(false);
    setNotice("登录上下文已更新");
  }

  async function signIn(nextLogin = login): Promise<void> {
    const epoch = adminRequestEpoch.current + 1;
    adminRequestEpoch.current = epoch;
    const requestIdentity = buildAdminRequestIdentity(epoch, nextLogin, null);
    adminRequestIdentityRef.current = requestIdentity;
    setBusy(true);
    setSession(null);
    setState(null);
    setAdminSummary({ kind: "none" });
    setSummaryStatus("idle");
    setSummaryError("");
    setLifecycleControls([]);
    setLifecycleStatus("idle");
    setLifecycleError("");
    setCoursePackageList({ phase: "IDLE" });
    setCoursePackageFeedback(null);
    setCoursePackageExportPayload("");
    try {
      const nextSession = await apiRequest<AuthSession>("/api/v1/auth/login", {
        method: "POST",
        tenantId: nextLogin.tenantId,
        body: {
          username: nextLogin.username,
          password: nextLogin.password
        }
      });
      if (!isCurrentAdminContext(requestIdentity)) return;
      const authenticatedIdentity = buildAdminRequestIdentity(epoch, nextLogin, nextSession);
      adminRequestIdentityRef.current = authenticatedIdentity;
      setSession(nextSession);
      setNotice("已登录");
    } catch (error) {
      if (isCurrentAdminContext(requestIdentity)) {
        setNotice(getAdminVisibleErrorMessage(error, "登录失败，请稍后重试。"));
      }
    } finally {
      if (isCurrentAdminContext(requestIdentity)) {
        setBusy(false);
      }
    }
  }

  useEffect(() => {
    const requestIdentity = adminRequestIdentityRef.current;
    refresh().catch((error: unknown) => {
      if (isCurrentAdminContext(requestIdentity)) {
        setNotice(getAdminVisibleErrorMessage(error, "管理状态暂时无法加载，请稍后重试。"));
      }
    });
  }, [refresh]);

  useEffect(() => {
    const requestIdentity = adminRequestIdentityRef.current;

    if (!session) {
      return;
    }

    if (!session.user.roles.some((role) => role === "tenant_admin" || role === "platform_admin")) {
      if (isCurrentAdminContext(requestIdentity)) {
        setAdminSummary({ kind: "none" });
        setSummaryStatus("idle");
      }
      return;
    }

    if (!isCurrentAdminContext(requestIdentity)) return;
    setSummaryStatus("loading");
    setSummaryError("");
    loadAdminSummary(session.user.roles, session.access_token, (path, init) =>
      fetch(`${API_BASE}${path}`, init)
    )
      .then((surface) => {
        if (!isCurrentAdminContext(requestIdentity)) return;
        setAdminSummary(surface);
        setSummaryStatus("ready");
      })
      .catch((error: unknown) => {
        if (!isCurrentAdminContext(requestIdentity)) return;
        setAdminSummary({ kind: "none" });
        setSummaryError(getAdminVisibleErrorMessage(getAdminSummaryErrorMessage(error)));
        setSummaryStatus("error");
      });
  }, [session]);

  useEffect(() => {
    void refreshLifecycleControls();
  }, [refreshLifecycleControls]);

  useEffect(() => {
    void refreshCoursePackages();
  }, [refreshCoursePackages]);

  async function createUser(): Promise<void> {
    if (!session) {
      return;
    }

    const requestIdentity = adminRequestIdentityRef.current;
    if (!isCurrentAdminContext(requestIdentity)) return;
    setBusy(true);
    try {
      const user = await apiRequest<User>("/api/v1/admin/users", {
        method: "POST",
        token: session.access_token,
        tenantId: login.tenantId,
        body: {
          tenant_id: userDraft.tenant_id,
          username: userDraft.username,
          email: userDraft.email,
          display_name: userDraft.display_name,
          password: userDraft.password,
          roles: [userDraft.role]
        }
      });
      if (!isCurrentAdminContext(requestIdentity)) return;
      setUserDraft((current) => ({
        ...current,
        username: `${current.username}_next`,
        email: `next-${current.email}`
      }));
      setNotice(`用户已创建：${user.user_id}`);
      await refresh();
    } catch (error) {
      if (isCurrentAdminContext(requestIdentity)) {
        setNotice(getAdminVisibleErrorMessage(error, "创建用户失败，请稍后重试。"));
      }
    } finally {
      if (isCurrentAdminContext(requestIdentity)) {
        setBusy(false);
      }
    }
  }

  async function applyLifecycleOperation(
    control: SyntheticRunLifecycleControlDTO,
    operation: SyntheticRunLifecycleOperation
  ): Promise<void> {
    if (!session || !control.allowed_operations.includes(operation)) {
      return;
    }
    const requestIdentity = adminRequestIdentityRef.current;
    if (!isCurrentAdminContext(requestIdentity)) return;

    const consequences: Record<SyntheticRunLifecycleOperation, string> = {
      abort: "中止会阻止提交、锁轮、结算和发布，同时保留证据。",
      reset: "重置只会重新打开尚未结算的回合锁定，并保留决策、审计、结果和回放证据。",
      cleanup:
        "清理会用审计墓碑封存此 synthetic 运行；v1 不删除持久化对象。Technical note: deletes no persisted artifacts."
    };
    const confirmed = window.confirm(
      `${operation.toUpperCase()} ${control.run_id}\n${control.tenant_id} / ${control.course_id}\n\n${consequences[operation]}`
    );
    if (!confirmed) {
      return;
    }

    setBusy(true);
    try {
      const result = await executeRunLifecycleOperation(
        control,
        operation,
        session.access_token,
        (path, init) => fetch(`${API_BASE}${path}`, init)
      );
      if (!isCurrentAdminContext(requestIdentity)) return;
      setNotice(
        `${operation === "abort" ? "中止" : operation === "reset" ? "重置" : "清理"} ${control.run_id}：${result.idempotent ? "已幂等应用" : "已完成"}`
      );
      await Promise.all([refresh(), refreshLifecycleControls()]);
    } catch (error) {
      if (!isCurrentAdminContext(requestIdentity)) return;
      setNotice(getAdminVisibleErrorMessage(getAdminSummaryErrorMessage(error)));
      await refreshLifecycleControls();
    } finally {
      if (isCurrentAdminContext(requestIdentity)) {
        setBusy(false);
      }
    }
  }

  function updateCoursePackageDraft(field: keyof CoursePackageDraftForm, value: string): void {
    setCoursePackageDraft((current) => ({ ...current, [field]: value }));
  }

  async function createCoursePackageDraft(): Promise<void> {
    if (!session) return;
    const requestIdentity = adminRequestIdentityRef.current;
    if (!isCurrentAdminContext(requestIdentity)) return;

    const draft: CoursePackageVersionDraftInput = {
      course_blueprint_reference: {
        content_digest: coursePackageDraft.blueprintDigest,
        course_blueprint_id: coursePackageDraft.blueprintId,
        tenant_id: coursePackageDraft.sourceTenantId,
        version: coursePackageDraft.blueprintVersion
      },
      course_package_id: coursePackageDraft.packageId,
      description: coursePackageDraft.description,
      parameter_set_reference: {
        content_digest: coursePackageDraft.parameterDigest,
        parameter_set_id: coursePackageDraft.parameterId,
        version: coursePackageDraft.parameterVersion
      },
      scenario_package_reference: {
        content_digest: coursePackageDraft.scenarioDigest,
        scenario_package_id: coursePackageDraft.scenarioId,
        tenant_id: coursePackageDraft.sourceTenantId,
        version: coursePackageDraft.scenarioVersion
      },
      title: coursePackageDraft.title,
      version: coursePackageDraft.version
    };
    setBusy(true);
    setCoursePackageFeedback(null);
    try {
      await createAdminCoursePackageDraft(draft, session.access_token, (path, init) =>
        fetch(`${API_BASE}${path}`, init)
      );
      if (!isCurrentAdminContext(requestIdentity)) return;
      setCoursePackageDraft(EMPTY_COURSE_PACKAGE_DRAFT);
      await refreshCoursePackages();
    } catch (error) {
      if (!isCurrentAdminContext(requestIdentity)) return;
      setCoursePackageFeedback({
        operation: "draft",
        surfaceState: getAdminCoursePackageSurfaceState(error, "draft")
      });
    } finally {
      if (isCurrentAdminContext(requestIdentity)) {
        setBusy(false);
      }
    }
  }

  async function importCoursePackage(): Promise<void> {
    if (!session) return;
    const requestIdentity = adminRequestIdentityRef.current;
    if (!isCurrentAdminContext(requestIdentity)) return;

    setBusy(true);
    setCoursePackageFeedback(null);
    try {
      const sourceCoursePackageVersion = JSON.parse(
        coursePackageImportPayload
      ) as CoursePackageVersion;
      await importAdminCoursePackageVersion(
        { source_course_package_version: sourceCoursePackageVersion },
        session.access_token,
        (path, init) => fetch(`${API_BASE}${path}`, init)
      );
      if (!isCurrentAdminContext(requestIdentity)) return;
      setCoursePackageImportPayload("");
      await refreshCoursePackages();
    } catch (error) {
      if (!isCurrentAdminContext(requestIdentity)) return;
      setCoursePackageFeedback({
        operation: "import",
        surfaceState: getAdminCoursePackageSurfaceState(error, "import")
      });
    } finally {
      if (isCurrentAdminContext(requestIdentity)) {
        setBusy(false);
      }
    }
  }

  async function applyCoursePackageLifecycle(
    operation: "validate" | "make-available" | "retire",
    coursePackage: CoursePackageVersion
  ): Promise<void> {
    if (!session) return;
    const requestIdentity = adminRequestIdentityRef.current;
    if (!isCurrentAdminContext(requestIdentity)) return;

    setBusy(true);
    setCoursePackageFeedback(null);
    try {
      await runAdminCoursePackageLifecycle(
        operation,
        coursePackage,
        session.access_token,
        (path, init) => fetch(`${API_BASE}${path}`, init)
      );
      if (!isCurrentAdminContext(requestIdentity)) return;
      await refreshCoursePackages();
    } catch (error) {
      if (!isCurrentAdminContext(requestIdentity)) return;
      setCoursePackageFeedback({
        operation,
        surfaceState: getAdminCoursePackageSurfaceState(error, operation)
      });
    } finally {
      if (isCurrentAdminContext(requestIdentity)) {
        setBusy(false);
      }
    }
  }

  async function exportCoursePackage(coursePackage: CoursePackageVersion): Promise<void> {
    if (!session) return;

    const requestIdentity = adminRequestIdentityRef.current;
    if (!isCurrentAdminContext(requestIdentity)) return;
    setBusy(true);
    setCoursePackageFeedback(null);
    try {
      const exported = await exportAdminCoursePackageVersion(
        coursePackage,
        session.access_token,
        (path, init) => fetch(`${API_BASE}${path}`, init)
      );
      if (!isCurrentAdminContext(requestIdentity)) return;
      setCoursePackageExportPayload(JSON.stringify(exported, null, 2));
    } catch (error) {
      if (!isCurrentAdminContext(requestIdentity)) return;
      setCoursePackageFeedback({
        operation: "export",
        surfaceState: getAdminCoursePackageSurfaceState(error, "export")
      });
    } finally {
      if (isCurrentAdminContext(requestIdentity)) {
        setBusy(false);
      }
    }
  }

  const lifecycleSurface = isTenantAdmin ? (
    <section className="lifecycle-surface" aria-label="synthetic run lifecycle controls">
      <div className="lifecycle-heading">
        <div>
          <p className="eyebrow">仅限内部 JSON synthetic 运行</p>
          <h2>预结算运行控制</h2>
        </div>
        <button
          aria-label="refresh lifecycle controls"
          disabled={busy || lifecycleStatus === "loading"}
          onClick={() => void refreshLifecycleControls()}
          title="Refresh lifecycle controls"
        >
          刷新
        </button>
      </div>

      <p className="lifecycle-boundary">
        仅作用于当前认证租户内、未结算且未发布的 synthetic JSON run。所有正式决策、审计、结果、
        score、rank、truth 与 Replay 证据均保留。
      </p>

      {lifecycleStatus !== "ready" || lifecycleControls.length === 0 ? (
        <p
          className={lifecycleStatus === "error" ? "lifecycle-error" : "lifecycle-status"}
          role={lifecycleStatus === "error" ? "alert" : undefined}
        >
          {lifecycleStatus === "loading"
            ? "正在读取可控运行..."
            : lifecycleStatus === "error"
              ? lifecycleError
              : "当前租户没有可显示的 synthetic JSON run。"}
        </p>
      ) : null}

      <div className="lifecycle-list">
        {lifecycleControls.map((control) => (
          <article className="lifecycle-run" key={control.run_id}>
            <div className="lifecycle-run-title">
              <div>
                <strong>{control.run_id}</strong>
                <span className="identity">
                  {control.tenant_id} / {control.course_id}
                </span>
              </div>
              <span className="summary-badge">{control.lifecycle_state}</span>
            </div>

            <p className="lifecycle-facts">
              预结算 {control.pre_settlement ? "是" : "否"} · 预发布{" "}
              {control.pre_publication ? "是" : "否"} · 证据冻结{" "}
              {control.evidence_frozen ? "是" : "否"} · 清理不会删除持久化对象{" "}
              <span className="technical-compatibility">Cleanup 删除 0 个持久化对象</span>
            </p>

            {control.blocked_reasons.length > 0 ? (
              <p className="lifecycle-blocked">
                操作受限：{formatLifecycleBlockedReasons(control.blocked_reasons)}
              </p>
            ) : null}

            <div className="lifecycle-actions" aria-label={`actions for ${control.run_id}`}>
              {(["abort", "reset", "cleanup"] as const).map((operation) => (
                <AdminLifecycleOperationButton
                  action={operation}
                  allowedActions={control.allowed_operations}
                  loading={busy}
                  disabledReason={formatLifecycleBlockedReasons(control.blocked_reasons)}
                  key={operation}
                  onClick={() => void applyLifecycleOperation(control, operation)}
                >
                  {operation === "abort"
                    ? "中止运行"
                    : operation === "reset"
                      ? "重置锁定"
                      : "清理运行"}
                </AdminLifecycleOperationButton>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  ) : null;

  const loginPanel = (
    <section className="login-strip" aria-label="admin login">
      <div className="admin-identity" aria-live="polite">
        <span className="eyebrow">管理治理</span>
        <span className="identity">
          {session ? `${session.user.display_name} · ${session.user.roles.join(" / ")}` : "未登录"}
        </span>
      </div>
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
        管理员登录
      </button>
      {DEMO_LOGIN_ENABLED ? (
        <button disabled={busy} onClick={() => void signIn(DEMO_LOGIN)}>
          演示登录
        </button>
      ) : null}
    </section>
  );

  if (session && !hasAdminSummaryRole) {
    return (
      <main className="admin-access-denied">
        <h1>管理权限验证</h1>
        <section role="alert" aria-label="管理权限">
          <h2>当前角色无管理权限</h2>
          <p>请使用已获服务端授权的管理员会话访问管理交付与信任工作区。</p>
          <p className="technical-compatibility">
            会话已登录 <span>signed in</span>
          </p>
        </section>
        {loginPanel}
      </main>
    );
  }

  return (
    <AdminDeliveryTrustWorkspace
      context={
        session
          ? {
              tenant: session.user.tenant_id,
              session: session.user.user_id,
              role: session.user.roles.join("、"),
              mode: session.user.roles.includes("platform_admin") ? "平台范围" : "租户范围"
            }
          : {}
      }
      authority={session ? "official" : "unknown"}
      activeHash={activeHash}
      navigationEnabled={!session || hasAdminSummaryRole}
      navigationItems={navigationItems}
      stateStatus={session ? "ready" : "empty"}
      stateMessage={
        session ? "仅展示服务端提供的上下文，不在前端计算正式结果。" : "请先登录管理员会话。"
      }
      primaryAction={
        <strong className="notice">
          {notice}
          {notice === "已登录" ? <span className="technical-compatibility">signed in</span> : null}
        </strong>
      }
      knownLimits={
        session && hasAdminSummaryRole ? (
          <>
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
          </>
        ) : null
      }
      environmentRecovery={
        session && hasAdminSummaryRole ? <AdminEnvironmentRecoveryLimit /> : null
      }
    >
      {loginPanel}

      {(!session || hasAdminSummaryRole) && (
        <section id="admin-audit-receipts" aria-labelledby="admin-audit-receipts-heading">
          <h2 id="admin-audit-receipts-heading">审计与回执</h2>
          {session && hasAdminSummaryRole ? (
            <D5ExportWorkbench
              apiBase={API_BASE}
              tenantId={session.user.tenant_id}
              token={session.access_token}
            />
          ) : (
            <p className="lifecycle-status">登录后显示交付回执与审计工作台。</p>
          )}
          {isTenantAdmin && state ? (
            <a className="admin-inline-link" href="#admin-audit-events">
              查看审计事件
            </a>
          ) : (
            <p className="lifecycle-status">
              {session
                ? "当前角色无法查看租户审计事件。"
                : "登录并获得租户管理员权限后查看租户审计事件。"}
            </p>
          )}
        </section>
      )}
      {session && hasAdminSummaryRole ? (
        <section id="admin-tenants-entitlements" aria-labelledby="admin-tenants-heading">
          <h2 id="admin-tenants-heading">租户与权益</h2>
          {session.user.roles.includes("platform_admin") ? (
            <TenantBaselineWorkbench apiBase={API_BASE} token={session.access_token} />
          ) : (
            <p className="lifecycle-status">当前会话仅显示服务端提供的租户范围与权益摘要。</p>
          )}
        </section>
      ) : null}
      {session && hasAdminSummaryRole ? (
        <section
          id="admin-runtime-support"
          className="admin-runtime-support"
          aria-labelledby="admin-runtime-heading"
        >
          <h2 id="admin-runtime-heading">运行与支持</h2>
          <TransferResearchWorkbench
            apiBase={API_BASE}
            tenantId={session.user.tenant_id}
            token={session.access_token}
            surface="admin"
          />
          {lifecycleSurface}
        </section>
      ) : null}

      <section id="admin-delivery-overview" aria-labelledby="admin-delivery-overview-heading">
        <div className="workspace-section-heading">
          <p className="eyebrow">管理工作区</p>
          <h2 id="admin-delivery-overview-heading">交付总览</h2>
        </div>

        {summaryStatus === "loading" && hasAdminSummaryRole ? (
          <section className="summary-status" aria-live="polite">
            正在加载管理摘要…
          </section>
        ) : null}

        {summaryStatus === "error" && hasAdminSummaryRole ? (
          <section className="summary-error" role="alert">
            {summaryError}
          </section>
        ) : null}

        {adminSummary.kind === "tenant" ? (
          <section className="summary-panel" aria-label="tenant admin scoped summary">
            <div className="summary-heading">
              <div>
                <p className="eyebrow">只读摘要</p>
                <h2>当前租户范围</h2>
              </div>
              <strong className="summary-badge">{adminSummary.summary.tenant_id}</strong>
            </div>
            <div className="summary-grid">
              <article>
                <span>课程</span>
                <strong>{adminSummary.summary.visible_state.course_count}</strong>
              </article>
              <article>
                <span>队伍</span>
                <strong>{adminSummary.summary.visible_state.team_count}</strong>
              </article>
              <article>
                <span>运行</span>
                <strong>{adminSummary.summary.visible_state.run_count}</strong>
              </article>
              <article>
                <span>审计事件</span>
                <strong>{adminSummary.summary.visible_state.audit_event_count}</strong>
              </article>
            </div>
          </section>
        ) : null}

        {adminSummary.kind === "platform" ? (
          <section className="summary-panel" aria-label="platform admin authority summary">
            <div className="summary-heading">
              <div>
                <p className="eyebrow">
                  平台权限已明确{" "}
                  <span className="technical-compatibility">Explicit platform authority</span>
                </p>
                <h2 aria-label="Platform scope">平台范围</h2>
              </div>
              <strong className="summary-badge" aria-label="Read-only summary">
                只读摘要 <span className="technical-compatibility">Read-only summary</span>
              </strong>
            </div>
            <div className="summary-grid platform-summary-grid">
              <article>
                <span aria-label="Tenant count">
                  租户数量 <span className="technical-compatibility">Tenant count</span>
                </span>
                <strong>{adminSummary.authority.visible_state.tenant_count}</strong>
              </article>
            </div>
          </section>
        ) : null}
      </section>

      {(!session || hasAdminSummaryRole) && (
        <section id="admin-security-projection" aria-labelledby="admin-security-heading">
          <div className="workspace-section-heading">
            <p className="eyebrow">服务端权限投影</p>
            <h2 id="admin-security-heading">权限与安全投影</h2>
          </div>
          {session ? (
            <div className="authority-projection">
              <AuthorityBadge authority="official" />
              <p>
                当前权限来自服务端会话：{session.user.roles.join("、")}。前端不根据状态、角色名称、
                URL 或本地存储推断权限。
              </p>
            </div>
          ) : (
            <p className="lifecycle-status">登录后显示服务端权限投影。</p>
          )}
        </section>
      )}

      {session && hasCoursePackageAdminRole ? (
        <section id="admin-assets" aria-labelledby="admin-assets-heading">
          <h2 id="admin-assets-heading">课程、场景与模型资产</h2>
          <CourseReportBuilder
            sessionKey={`${session.access_token}:${login.tenantId}`}
            tenantId={login.tenantId}
            token={session.access_token}
          />
          <section
            className="course-package-surface"
            aria-label="CoursePackageVersion administration"
          >
            <div className="lifecycle-heading">
              <div>
                <p className="eyebrow">仅限 JSON 内部快照</p>
                <h2>课程包版本管理</h2>
              </div>
              <button
                aria-label="Refresh CoursePackageVersions"
                disabled={busy || coursePackageList.phase === "LOADING"}
                onClick={() => void refreshCoursePackages()}
              >
                刷新课程包版本
              </button>
            </div>
            <p className="lifecycle-boundary">
              当前仅展示服务端拥有的不可变教学与配置快照。此处不会评估依赖兼容性、计算摘要，也不会修改
              课程、运行、参数集、结算、评分、排名、回放或真值字段。
            </p>

            {coursePackageList.phase === "LOADING" ? (
              <p className="lifecycle-status" role="status">
                正在加载课程包版本…
                <span className="technical-compatibility">Loading CoursePackageVersions</span>
              </p>
            ) : null}
            {coursePackageList.phase === "ERROR" ? (
              <p className="lifecycle-error" role="alert">
                {coursePackageStatusLabel(coursePackageList.surfaceState, "list")}
              </p>
            ) : null}
            {coursePackageFeedback ? (
              <p className="lifecycle-error" role="alert">
                {coursePackageStatusLabel(
                  coursePackageFeedback.surfaceState,
                  coursePackageFeedback.operation
                )}
              </p>
            ) : null}
            {coursePackageExportPayload ? (
              <article
                className="panel form-panel"
                aria-label="CoursePackageVersion export receipt"
              >
                <div className="panel-title">
                  <h3>不可变导出已就绪</h3>
                  <span>管理员控制的 JSON</span>
                </div>
                <label>
                  课程包导出 JSON
                  <textarea
                    aria-label="course package export payload"
                    readOnly
                    value={coursePackageExportPayload}
                  />
                </label>
                <button onClick={() => setCoursePackageImportPayload(coursePackageExportPayload)}>
                  使用导出内容作为导入载荷
                </button>
              </article>
            ) : null}
            {coursePackageList.phase === "READY" && coursePackageList.packages.length === 0 ? (
              <p className="lifecycle-status">
                当前没有可用的课程包版本。
                <span className="technical-compatibility">
                  No CoursePackageVersions are available.
                </span>
              </p>
            ) : null}
            {coursePackageList.phase === "READY" && coursePackageList.packages.length > 0 ? (
              <div className="course-package-list">
                {coursePackageList.packages.map((coursePackage) => (
                  <article
                    className="course-package-card"
                    key={`${coursePackage.course_package_id}-${coursePackage.version}-${coursePackage.content_digest}`}
                  >
                    <div>
                      <strong>{coursePackage.title}</strong>
                      <span>{coursePackage.status}</span>
                      {getAdminCoursePackageSurfaceState(coursePackage, "list") === "STALE" ? (
                        <span className="lifecycle-blocked">STALE</span>
                      ) : null}
                    </div>
                    <small>
                      {coursePackage.course_package_id} / {coursePackage.version}
                    </small>
                    <p>{coursePackage.description}</p>
                    <div className="lifecycle-actions">
                      <button
                        aria-label={`Validate ${coursePackage.course_package_id}`}
                        disabled={busy}
                        onClick={() => void applyCoursePackageLifecycle("validate", coursePackage)}
                      >
                        校验 {coursePackage.course_package_id}
                      </button>
                      <button
                        aria-label={`Make ${coursePackage.course_package_id} available`}
                        disabled={busy}
                        onClick={() =>
                          void applyCoursePackageLifecycle("make-available", coursePackage)
                        }
                      >
                        使 {coursePackage.course_package_id} 可用
                      </button>
                      <button
                        aria-label={`Export ${coursePackage.course_package_id}`}
                        disabled={busy}
                        onClick={() => void exportCoursePackage(coursePackage)}
                      >
                        导出 {coursePackage.course_package_id}
                      </button>
                      <button
                        aria-label={`Retire ${coursePackage.course_package_id}`}
                        disabled={busy}
                        onClick={() => void applyCoursePackageLifecycle("retire", coursePackage)}
                      >
                        退役 {coursePackage.course_package_id}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            <div className="course-package-forms">
              <article className="panel form-panel">
                <div className="panel-title">
                  <h3>创建不可变草稿</h3>
                  <span>服务端校验全部引用</span>
                </div>
                <label>
                  课程包 ID
                  <input
                    value={coursePackageDraft.packageId}
                    onChange={(event) => updateCoursePackageDraft("packageId", event.target.value)}
                  />
                </label>
                <label>
                  版本
                  <input
                    value={coursePackageDraft.version}
                    onChange={(event) => updateCoursePackageDraft("version", event.target.value)}
                  />
                </label>
                <label>
                  标题
                  <input
                    value={coursePackageDraft.title}
                    onChange={(event) => updateCoursePackageDraft("title", event.target.value)}
                  />
                </label>
                <label>
                  描述
                  <input
                    value={coursePackageDraft.description}
                    onChange={(event) =>
                      updateCoursePackageDraft("description", event.target.value)
                    }
                  />
                </label>
                <label>
                  源租户 ID
                  <input
                    value={coursePackageDraft.sourceTenantId}
                    onChange={(event) =>
                      updateCoursePackageDraft("sourceTenantId", event.target.value)
                    }
                  />
                </label>
                <label>
                  课程蓝图 ID
                  <input
                    value={coursePackageDraft.blueprintId}
                    onChange={(event) =>
                      updateCoursePackageDraft("blueprintId", event.target.value)
                    }
                  />
                </label>
                <label>
                  课程蓝图版本
                  <input
                    value={coursePackageDraft.blueprintVersion}
                    onChange={(event) =>
                      updateCoursePackageDraft("blueprintVersion", event.target.value)
                    }
                  />
                </label>
                <label>
                  课程蓝图摘要
                  <input
                    value={coursePackageDraft.blueprintDigest}
                    onChange={(event) =>
                      updateCoursePackageDraft("blueprintDigest", event.target.value)
                    }
                  />
                </label>
                <label>
                  场景包 ID
                  <input
                    value={coursePackageDraft.scenarioId}
                    onChange={(event) => updateCoursePackageDraft("scenarioId", event.target.value)}
                  />
                </label>
                <label>
                  场景包版本
                  <input
                    value={coursePackageDraft.scenarioVersion}
                    onChange={(event) =>
                      updateCoursePackageDraft("scenarioVersion", event.target.value)
                    }
                  />
                </label>
                <label>
                  场景包摘要
                  <input
                    value={coursePackageDraft.scenarioDigest}
                    onChange={(event) =>
                      updateCoursePackageDraft("scenarioDigest", event.target.value)
                    }
                  />
                </label>
                <label>
                  参数集 ID
                  <input
                    value={coursePackageDraft.parameterId}
                    onChange={(event) =>
                      updateCoursePackageDraft("parameterId", event.target.value)
                    }
                  />
                </label>
                <label>
                  参数集版本
                  <input
                    value={coursePackageDraft.parameterVersion}
                    onChange={(event) =>
                      updateCoursePackageDraft("parameterVersion", event.target.value)
                    }
                  />
                </label>
                <label>
                  参数集摘要
                  <input
                    value={coursePackageDraft.parameterDigest}
                    onChange={(event) =>
                      updateCoursePackageDraft("parameterDigest", event.target.value)
                    }
                  />
                </label>
                <button
                  aria-label="创建 CoursePackageVersion 草稿"
                  disabled={busy}
                  onClick={() => void createCoursePackageDraft()}
                >
                  创建 CoursePackageVersion 草稿
                </button>
              </article>

              <article className="panel form-panel">
                <div className="panel-title">
                  <h3>导入不可变导出</h3>
                  <span>服务端核验摘要</span>
                </div>
                <label>
                  课程包导出 JSON
                  <textarea
                    aria-label="course package import payload"
                    value={coursePackageImportPayload}
                    onChange={(event) => setCoursePackageImportPayload(event.target.value)}
                  />
                </label>
                <button
                  aria-label="Import CoursePackageVersion"
                  disabled={busy}
                  onClick={() => void importCoursePackage()}
                >
                  导入 CoursePackageVersion
                </button>
              </article>
            </div>
          </section>
        </section>
      ) : null}

      {isTenantAdmin && state ? (
        <section id="admin-users-roles" aria-labelledby="admin-users-roles-heading">
          <h2 id="admin-users-roles-heading" className="workspace-section-title">
            用户、角色与范围
          </h2>
          <section className="workspace legacy-operations">
            <article className="panel form-panel">
              <div className="panel-title">
                <h2>创建用户</h2>
                <span>租户范围</span>
              </div>
              <label>
                租户
                <input
                  value={userDraft.tenant_id}
                  onChange={(event) =>
                    setUserDraft((current) => ({ ...current, tenant_id: event.target.value }))
                  }
                />
              </label>
              <label>
                用户名
                <input
                  value={userDraft.username}
                  onChange={(event) =>
                    setUserDraft((current) => ({ ...current, username: event.target.value }))
                  }
                />
              </label>
              <label>
                邮箱
                <input
                  value={userDraft.email}
                  onChange={(event) =>
                    setUserDraft((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </label>
              <label>
                显示名
                <input
                  value={userDraft.display_name}
                  onChange={(event) =>
                    setUserDraft((current) => ({ ...current, display_name: event.target.value }))
                  }
                />
              </label>
              <label>
                初始密码
                <input
                  type="password"
                  value={userDraft.password}
                  onChange={(event) =>
                    setUserDraft((current) => ({ ...current, password: event.target.value }))
                  }
                />
              </label>
              <label>
                角色
                <select
                  value={userDraft.role}
                  onChange={(event) =>
                    setUserDraft((current) => ({
                      ...current,
                      role: event.target.value as ActorRole
                    }))
                  }
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="primary"
                disabled={busy || !session}
                onClick={() => void createUser()}
              >
                创建用户
              </button>
            </article>
          </section>
          <section className="workspace wide legacy-operations">
            <article className="panel">
              <div className="panel-title">
                <h2>租户目录</h2>
                <span>{state?.tenants.length ?? 0}</span>
              </div>
              <div className="table">
                {(state?.tenants ?? []).map((tenant) => (
                  <div className="table-row" key={tenant.tenant_id}>
                    <span>{tenant.name}</span>
                    <strong>{tenant.domain}</strong>
                    <small>{tenant.status}</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-title">
                <h2>用户目录</h2>
                <span>{state?.users.length ?? 0}</span>
              </div>
              <div className="table">
                {(state?.users ?? []).map((user) => (
                  <div className="table-row" key={user.user_id}>
                    <span>{user.display_name}</span>
                    <strong>{tenantMap.get(user.tenant_id) ?? user.tenant_id}</strong>
                    <small>{user.roles.join(", ")}</small>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </section>
      ) : null}

      {isTenantAdmin && state ? (
        <section id="admin-audit-events" className="panel audit legacy-operations">
          <div className="panel-title">
            <h2>审计事件</h2>
            <span>{state?.audit_logs.length ?? 0}</span>
          </div>
          <div className="timeline">
            {recentAudits.map((event) => (
              <div className="timeline-item" key={event.audit_id}>
                <span>{event.action}</span>
                <strong>{event.resource_type}</strong>
                <small>{new Date(event.created_at).toLocaleTimeString()}</small>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </AdminDeliveryTrustWorkspace>
  );
}
