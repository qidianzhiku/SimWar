export const authorityKinds = [
  "official",
  "draft",
  "shadow",
  "advisory",
  "system-result",
  "ai-explanation",
  "teacher-comment",
  "unknown"
] as const;

export type AuthorityKind = (typeof authorityKinds)[number];

export interface AuthorityBadgeProps {
  authority: AuthorityKind;
  className?: string;
}

const labels: Record<AuthorityKind, string> = {
  official: "正式",
  draft: "草稿",
  shadow: "影子",
  advisory: "建议",
  "system-result": "系统结果",
  "ai-explanation": "AI 解释",
  "teacher-comment": "教师点评",
  unknown: "未知"
};

export function AuthorityBadge({ authority, className }: AuthorityBadgeProps) {
  const classes = ["sw-ui", "sw-authority-badge", className].filter(Boolean).join(" ");
  return (
    <span className={classes} data-authority={authority}>
      {labels[authority]}
    </span>
  );
}
