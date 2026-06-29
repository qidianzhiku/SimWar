import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ActorRole,
  AdminState,
  ApiEnvelope,
  AuthSession,
  Tenant,
  User
} from "@simwar/shared-contracts";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const DEFAULT_LOGIN = {
  tenantId: "tenant_platform",
  username: "platform",
  password: "platform"
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
    "content-type": "application/json",
    "x-tenant-id": options.tenantId ?? DEFAULT_LOGIN.tenantId
  };

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
  const [login, setLogin] = useState(DEFAULT_LOGIN);
  const [tenantDraft, setTenantDraft] = useState({
    name: "New Tenant",
    domain: "new.simwar.local"
  });
  const [userDraft, setUserDraft] = useState({
    tenant_id: "tenant_demo",
    username: "new_learner",
    email: "new-learner@demo.simwar.local",
    display_name: "New Learner",
    password: "simwar123",
    role: "learner" as ActorRole
  });
  const [notice, setNotice] = useState("ready");
  const [busy, setBusy] = useState(false);

  const tenantMap = useMemo(
    () => new Map((state?.tenants ?? []).map((tenant) => [tenant.tenant_id, tenant.name])),
    [state?.tenants]
  );
  const recentAudits = state?.audit_logs.slice(-8).reverse() ?? [];

  const refresh = useCallback(async () => {
    if (!session) {
      return;
    }

    setState(
      await apiRequest<AdminState>("/api/v1/admin/state", {
        token: session.access_token,
        tenantId: login.tenantId
      })
    );
  }, [login.tenantId, session]);

  function updateLogin(field: keyof typeof DEFAULT_LOGIN, value: string): void {
    setLogin((current) => ({ ...current, [field]: value }));
    setSession(null);
    setState(null);
    setNotice("context changed");
  }

  async function signIn(nextLogin = login): Promise<void> {
    setBusy(true);
    setSession(null);
    setState(null);
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
    void signIn(DEFAULT_LOGIN);
  }, []);

  useEffect(() => {
    refresh().catch((error: unknown) => {
      setNotice(error instanceof Error ? error.message : "load failed");
    });
  }, [refresh]);

  async function createTenant(): Promise<void> {
    if (!session) {
      return;
    }

    setBusy(true);
    try {
      const tenant = await apiRequest<Tenant>("/api/v1/admin/tenants", {
        method: "POST",
        token: session.access_token,
        tenantId: login.tenantId,
        body: tenantDraft
      });
      setTenantDraft({ name: `${tenant.name} Copy`, domain: `copy-${tenant.domain}` });
      setNotice(`tenant created: ${tenant.tenant_id}`);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "tenant create failed");
    } finally {
      setBusy(false);
    }
  }

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
      </section>

      <section className="metrics">
        <article>
          <span>租户</span>
          <strong>{state?.tenants.length ?? 0}</strong>
        </article>
        <article>
          <span>用户</span>
          <strong>{state?.users.length ?? 0}</strong>
        </article>
        <article>
          <span>角色</span>
          <strong>{state?.roles.length ?? 0}</strong>
        </article>
        <article>
          <span>权限</span>
          <strong>{state?.permissions.length ?? 0}</strong>
        </article>
      </section>

      <section className="workspace">
        <article className="panel form-panel">
          <div className="panel-title">
            <h2>创建租户</h2>
            <span>platform_admin</span>
          </div>
          <label>
            名称
            <input
              value={tenantDraft.name}
              onChange={(event) =>
                setTenantDraft((current) => ({ ...current, name: event.target.value }))
              }
            />
          </label>
          <label>
            域标识
            <input
              value={tenantDraft.domain}
              onChange={(event) =>
                setTenantDraft((current) => ({ ...current, domain: event.target.value }))
              }
            />
          </label>
          <button
            className="primary"
            disabled={busy || !session}
            onClick={() => void createTenant()}
          >
            创建租户
          </button>
        </article>

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
          <button className="primary" disabled={busy || !session} onClick={() => void createUser()}>
            创建用户
          </button>
        </article>
      </section>

      <section className="workspace wide">
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

      <section className="panel audit">
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
    </main>
  );
}
