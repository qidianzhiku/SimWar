import { useId, type ReactNode } from "react";

export interface AppShellProps {
  workspaceTitle: string;
  navigation: ReactNode;
  children: ReactNode;
  banner?: ReactNode;
  primaryAction?: ReactNode;
}

export function AppShell({
  workspaceTitle,
  navigation,
  children,
  banner,
  primaryAction
}: AppShellProps) {
  const mainId = `${useId()}-main-content`;
  return (
    <div className="sw-ui sw-app-shell">
      <a className="sw-skip-link" href={`#${mainId}`}>
        跳转到主要内容
      </a>
      <header className="sw-app-shell__header" role="banner">
        <h1>{workspaceTitle}</h1>
        {primaryAction ? <div className="sw-app-shell__primary-action">{primaryAction}</div> : null}
      </header>
      {banner ? <div className="sw-app-shell__banner">{banner}</div> : null}
      <div className="sw-app-shell__body">
        <nav className="sw-app-shell__nav" aria-label="角色导航">
          {navigation}
        </nav>
        <main className="sw-app-shell__main" id={mainId} tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
