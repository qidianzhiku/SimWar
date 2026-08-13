import type { ReactNode } from "react";

export interface WorkbenchFrameProps {
  ariaLabel: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  badge?: ReactNode;
  boundary?: ReactNode;
  state?: ReactNode;
  actions?: ReactNode;
  headerActions?: ReactNode;
  children?: ReactNode;
  className?: string;
  headingClassName?: string;
  boundaryClassName?: string;
  testId?: string;
}

/**
 * Domain-neutral semantic frame. Callers supply every role, state and business
 * phrase so the shared presentation layer never infers authority or policy.
 */
export function WorkbenchFrame({
  ariaLabel,
  eyebrow,
  title,
  badge,
  boundary,
  state,
  actions,
  headerActions,
  children,
  className = "sw-workbench-frame",
  headingClassName = "sw-workbench-frame__heading",
  boundaryClassName = "sw-workbench-frame__boundary",
  testId
}: WorkbenchFrameProps) {
  return (
    <section className={className} aria-label={ariaLabel} data-testid={testId}>
      <div className={headingClassName}>
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
        </div>
        {badge ? <span>{badge}</span> : null}
        {headerActions}
      </div>
      {boundary ? <p className={boundaryClassName}>{boundary}</p> : null}
      {state}
      {actions}
      {children}
    </section>
  );
}
