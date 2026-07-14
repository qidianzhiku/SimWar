import { useCallback, useEffect, useMemo, useState } from "react";
import { getKnownLimitsProjection } from "@simwar/shared-contracts";
import type {
  ActorRole,
  AdminState,
  ApiEnvelope,
  AuthSession,
  User
} from "@simwar/shared-contracts";
import {
  getAdminSummaryErrorMessage,
  loadAdminSummary,
  type AdminSummarySurface
} from "./admin-bff";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
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

export function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [state, setState] = useState<AdminState | null>(null);
  const [adminSummary, setAdminSummary] = useState<AdminSummarySurface>({ kind: "none" });
  const [summaryStatus, setSummaryStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [summaryError, setSummaryError] = useState("");
  const [login, setLogin] = useState<LoginForm>(EMPTY_LOGIN);
  const [userDraft, setUserDraft] = useState({
    tenant_id: "tenant_demo",
    username: "new_learner",
    email: "new-learner@demo.simwar.local",
    display_name: "New Learner",
    password: "",
    role: "learner" as ActorRole
  });
  const [notice, setNotice] = useState("ready");
  const [busy, setBusy] = useState(false);

  const tenantMap = useMemo(
    () => new Map((state?.tenants ?? []).map((tenant) => [tenant.tenant_id, tenant.name])),
    [state?.tenants]
  );
  const recentAudits = state?.audit_logs.slice(-8).reverse() ?? [];
  const isTenantAdmin = session?.user.roles.includes("tenant_admin") ?? false;
  const hasAdminSummaryRole =
    session?.user.roles.some((role) => role === "tenant_admin" || role === "platform_admin") ??
    false;
  const knownLimits = session?.user.roles.includes("platform_admin")
    ? getKnownLimitsProjection("platform_admin")
    : getKnownLimitsProjection("tenant_admin");

  const refresh = useCallback(async () => {
    if (!session || !session.user.roles.includes("tenant_admin")) {
      setState(null);
      return;
    }

    setState(
      await apiRequest<AdminState>("/api/v1/admin/state", {
        token: session.access_token,
        tenantId: login.tenantId
      })
    );
  }, [login.tenantId, session]);

  function updateLogin(field: keyof LoginForm, value: string): void {
    setLogin((current) => ({ ...current, [field]: value }));
    setSession(null);
    setState(null);
    setAdminSummary({ kind: "none" });
    setSummaryStatus("idle");
    setSummaryError("");
    setNotice("context changed");
  }

  async function signIn(nextLogin = login): Promise<void> {
    setBusy(true);
    setSession(null);
    setState(null);
    setAdminSummary({ kind: "none" });
    setSummaryStatus("idle");
    setSummaryError("");
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
    let cancelled = false;

    if (!session) {
      return;
    }

    if (!session.user.roles.some((role) => role === "tenant_admin" || role === "platform_admin")) {
      setAdminSummary({ kind: "none" });
      setSummaryStatus("idle");
      return;
    }

    setSummaryStatus("loading");
    setSummaryError("");
    loadAdminSummary(session.user.roles, session.access_token, (path, init) =>
      fetch(`${API_BASE}${path}`, init)
    )
      .then((surface) => {
        if (!cancelled) {
          setAdminSummary(surface);
          setSummaryStatus("ready");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAdminSummary({ kind: "none" });
          setSummaryError(getAdminSummaryErrorMessage(error));
          setSummaryStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  async function createUser(): Promise<void> {
    if (!session) {
      return;
    }

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
      setUserDraft((current) => ({
        ...current,
        username: `${current.username}_next`,
        email: `next-${current.email}`
      }));
      setNotice(`user created: ${user.user_id}`);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "user create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Admin Governance</p>
          <h1>SimWar P1 管理后台</h1>
          <span className="identity">
            {session
              ? `${session.user.display_name} · ${session.user.roles.join(" / ")}`
              : "not signed in"}
          </span>
        </div>
        <strong className="notice">{notice}</strong>
      </header>

      <section className="login-strip" aria-label="admin login">
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

      {session && hasAdminSummaryRole ? (
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

      {summaryStatus === "loading" && hasAdminSummaryRole ? (
        <section className="summary-status" aria-live="polite">
          Loading Admin summary...
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
              <p className="eyebrow">Explicit platform authority</p>
              <h2>Platform scope</h2>
            </div>
            <strong className="summary-badge">Read-only summary</strong>
          </div>
          <div className="summary-grid platform-summary-grid">
            <article>
              <span>Tenant count</span>
              <strong>{adminSummary.authority.visible_state.tenant_count}</strong>
            </article>
          </div>
        </section>
      ) : null}

      {isTenantAdmin && state ? (
        <section className="workspace legacy-operations">
          <article className="panel form-panel">
            <div className="panel-title">
              <h2>创建用户</h2>
              <span>tenant scoped</span>
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
                  setUserDraft((current) => ({ ...current, role: event.target.value as ActorRole }))
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
      ) : null}

      {isTenantAdmin && state ? (
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
      ) : null}

      {isTenantAdmin && state ? (
        <section className="panel audit legacy-operations">
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
    </main>
  );
}
