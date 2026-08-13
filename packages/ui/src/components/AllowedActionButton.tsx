import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";

export interface AllowedActionButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "disabled" | "children"
> {
  action: string;
  allowedActions: readonly string[];
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  disabledReason?: string;
  variant?: "default" | "risk";
}

export function AllowedActionButton({
  action,
  allowedActions,
  children,
  disabled = false,
  loading = false,
  disabledReason,
  variant = "default",
  ...buttonProps
}: AllowedActionButtonProps) {
  const instanceId = useId();
  const authorized = allowedActions.includes(action);
  const isDisabled = !authorized || disabled || loading;
  const reason = loading
    ? (disabledReason ?? "正在处理中")
    : !authorized
      ? (disabledReason ?? "当前操作未获服务端授权")
      : disabled
        ? (disabledReason ?? "当前操作暂不可用")
        : undefined;
  const reasonId = `${instanceId}-action-reason`;
  const describedBy = [buttonProps["aria-describedby"], reason ? reasonId : undefined]
    .filter(Boolean)
    .join(" ");
  const classes = ["sw-ui", "sw-allowed-action"].join(" ");

  return (
    <span className="sw-ui sw-allowed-action-wrap">
      <button
        {...buttonProps}
        type={buttonProps.type ?? "button"}
        className={[classes, buttonProps.className].filter(Boolean).join(" ")}
        data-action={action}
        data-variant={variant}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        aria-describedby={describedBy || undefined}
      >
        {loading ? "处理中…" : children}
      </button>
      {reason ? (
        <span className="sw-action-reason" id={reasonId} role="status">
          {reason}
        </span>
      ) : null}
    </span>
  );
}
