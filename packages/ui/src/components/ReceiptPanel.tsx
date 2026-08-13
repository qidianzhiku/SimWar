import { useId } from "react";

export interface Receipt {
  command: string;
  actor: string;
  timestamp: string;
  correlation_id: string;
  status: string;
  reuse_conflict: string;
  exact_ref: string;
}

export interface ReceiptPanelProps {
  receipt: Receipt;
}

export function ReceiptPanel({ receipt }: ReceiptPanelProps) {
  const headingId = `${useId()}-receipt-heading`;
  const rows: Array<[string, string, string]> = [
    ["命令", "command", receipt.command],
    ["执行者", "actor", receipt.actor],
    ["时间", "timestamp", receipt.timestamp],
    ["关联 ID", "correlation_id", receipt.correlation_id],
    ["状态", "status", receipt.status],
    ["复用/冲突", "reuse_conflict", receipt.reuse_conflict],
    ["精确引用", "exact_ref", receipt.exact_ref]
  ];

  return (
    <section className="sw-ui sw-receipt-panel" aria-labelledby={headingId}>
      <h2 id={headingId}>操作回执</h2>
      <dl className="sw-receipt-panel__details">
        {rows.map(([label, field, value]) => (
          <div className="sw-receipt-panel__row" key={field}>
            <dt>{label}</dt>
            <dd data-receipt-field={field}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
