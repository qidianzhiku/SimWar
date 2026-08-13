import type { ReactNode } from "react";

export const serverContextKeys = [
  "tenant",
  "course",
  "session",
  "run",
  "round",
  "team",
  "role",
  "mode"
] as const;

export type ServerContextKey = (typeof serverContextKeys)[number];
export type ServerContext = Partial<Record<ServerContextKey, ReactNode>>;

export interface ContextBarProps {
  context: ServerContext;
}

const labels: Record<ServerContextKey, string> = {
  tenant: "租户",
  course: "课程",
  session: "会话",
  run: "运行",
  round: "回合",
  team: "队伍",
  role: "角色",
  mode: "模式"
};

export function ContextBar({ context }: ContextBarProps) {
  const entries = serverContextKeys.flatMap((key) => {
    const value = context[key];
    if (value !== undefined && value !== null && value !== "") {
      return [[key, value] as const];
    }
    return [];
  });

  return (
    <dl className="sw-ui sw-context-bar" aria-label="当前上下文">
      {entries.map(([key, value]) => (
        <div className="sw-context-bar__item" key={key}>
          <dt>{labels[key]}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
