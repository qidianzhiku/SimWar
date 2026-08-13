import { useId } from "react";

export interface KnownLimitBannerProps {
  limitation: string;
  unaffected: string;
  notProven: string;
  scope: string;
}

export function KnownLimitBanner({
  limitation,
  unaffected,
  notProven,
  scope
}: KnownLimitBannerProps) {
  const headingId = `${useId()}-known-limit-heading`;
  const rows = [
    ["当前限制", limitation],
    ["不受影响", unaffected],
    ["尚未证明", notProven],
    ["范围", scope]
  ] as const;

  return (
    <aside className="sw-ui sw-known-limit-banner" role="note" aria-labelledby={headingId}>
      <h2 id={headingId}>已知限制</h2>
      <dl className="sw-known-limit-banner__details">
        {rows.map(([label, value]) => (
          <div className="sw-known-limit-banner__row" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
