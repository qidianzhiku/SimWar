import { useState, type FormEvent } from "react";
import type { GSIExactBinding, GSIProposal, GSIReceipt } from "@simwar/shared-contracts";

export interface GovernedStakeholderIntelligenceWorkspaceProps {
  apiBase: string;
  binding: GSIExactBinding;
  tenantId: string;
  token: string;
  proposals?: readonly GSIProposal[];
}

const DEFAULT_PROPOSALS: readonly GSIProposal[] = [
  {
    proposal_id: "proposal_customer_1",
    stakeholder_type: "customer",
    intent: "protect_demand",
    priority: 0.8,
    influence: 0.4,
    summary: "Customers value predictable service."
  },
  {
    proposal_id: "proposal_regulator_1",
    stakeholder_type: "regulator",
    intent: "reduce_regulatory_risk",
    priority: 0.6,
    influence: -0.2,
    summary: "Regulatory review may slow expansion."
  }
];

interface ReceiptEnvelope {
  data?: GSIReceipt;
  error?: { message?: string };
}

function bindingEntries(binding: GSIExactBinding): [string, string][] {
  return Object.entries(binding) as [string, string][];
}

export function GovernedStakeholderIntelligenceWorkspace({
  apiBase,
  binding,
  tenantId,
  token,
  proposals = DEFAULT_PROPOSALS
}: GovernedStakeholderIntelligenceWorkspaceProps) {
  const [receipt, setReceipt] = useState<GSIReceipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function freezeCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/api/v1/bff/teacher/gsi/candidates`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-tenant-id": tenantId
        },
        body: JSON.stringify({
          discriminator: "gsi_stakeholder_shadow_request",
          binding,
          plane_mode: "OFF",
          publication_status: "PUBLISHED",
          proposals: [...proposals],
          idempotency_key: `gsi-ui:${binding.run_id}:${binding.round_id}:${binding.team_id}`
        })
      });
      const payload = (await response.json()) as ReceiptEnvelope;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "受控利益相关方候选创建失败");
      }
      setReceipt(payload.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "受控利益相关方候选创建失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel form-panel" aria-label="Governed Stakeholder Intelligence">
      <div className="panel-title">
        <div>
          <p className="eyebrow">GSI · Provider-OFF shadow plane</p>
          <h3>Governed Stakeholder Intelligence</h3>
        </div>
        <span className="technical-compatibility">Provider OFF · candidate-only</span>
      </div>
      <p className="lifecycle-boundary">
        教师可以冻结一个绑定到精确运行上下文的利益相关方候选；解析结果只用于受控诊断和角色安全投影，
        不会写入正式状态、结算、评分或回放真值。
      </p>
      <details>
        <summary>查看 exact binding</summary>
        <dl>
          {bindingEntries(binding).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </details>
      <form onSubmit={freezeCandidate}>
        <p className="lifecycle-status">
          本次演示将提交 {proposals.length} 个有界 stakeholder proposal，并启用 PUBLISHED role-safe
          projection。
        </p>
        <button type="submit" disabled={busy}>
          {busy ? "正在冻结…" : "冻结受控利益相关方候选"}
        </button>
      </form>
      {error ? (
        <p role="alert" className="lifecycle-error">
          {error}
        </p>
      ) : null}
      {receipt ? (
        <article className="candidate-preview" aria-label="GSI candidate receipt">
          <h4>候选已冻结并可供角色投影</h4>
          <p>
            candidate_id: <code>{receipt.candidate_id}</code>
          </p>
          <p>
            candidate_digest: <code>{receipt.resolver.candidate_digest}</code>
          </p>
          <p>
            Provider: {receipt.provider} · publication: {receipt.publication_status}
          </p>
          <p>不会写入正式状态、结算、评分或回放真值。</p>
          <ul>
            {receipt.resolver.signals.map((signal) => (
              <li key={signal.signal_id}>
                {signal.stakeholder_type} / {signal.intent}: {signal.bounded_value}
              </li>
            ))}
          </ul>
          <details>
            <summary>查看已知限制</summary>
            <ul>
              {receipt.known_limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </details>
        </article>
      ) : null}
    </section>
  );
}
