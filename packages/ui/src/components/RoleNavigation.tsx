import type { ReactNode } from "react";

export interface RoleNavigationItem {
  id: string;
  label: ReactNode;
  href?: string;
}

export interface RoleNavigationProps {
  items: readonly RoleNavigationItem[];
  activeHref?: string;
}

/**
 * Accessible navigation for task-oriented role workspaces.
 *
 * The component intentionally accepts stable hash links instead of inventing a
 * router contract. Consumers can pass server-backed labels and choose the
 * active location from the browser hash without changing backend paths.
 */
export function RoleNavigation({ items, activeHref }: RoleNavigationProps) {
  return (
    <ul className="sw-ui sw-role-navigation">
      {items.map((item) => {
        const href = item.href ?? `#${item.id}`;
        const isCurrent = activeHref === href;
        return (
          <li key={item.id}>
            <a href={href} aria-current={isCurrent ? "page" : undefined}>
              {item.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
