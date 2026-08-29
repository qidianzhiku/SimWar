import { useState, type FormEvent } from "react";
import type { ESLResponse } from "@simwar/shared-contracts";

export interface ExecutiveStrategyLabAuditPanelProps {
  apiBase: string;
  tenantId: string;
  token: string;
}

interface Envelope {
  data?: ESLResponse;
  error?: { message?: string };
}

export function ExecutiveStrategyLabAuditPanel({
  apiBase,
  tenantId,
  token
}: ExecutiveStrategyLabAuditPanelProps) {
  const [candidateId, setCandidateId] = useState("");
  const [result, setResult] = useState<ESLResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAudit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const response = await fetch(
        `${apiBase}/api/v1/bff/admin/esl/audit?candidate_id=${encodeURIComponent(candidateId.trim())}`,
        {
          headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId }
        }
      );
      const payload = (await response.json()) as Envelope;
      if (!response.ok || !payload.data)
        throw new Error(payload.error?.message ?? "策略实验室审计加载失败");
      setResult(payload.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "策略实验室审计加载失败");
    }
  }

  return (
    <section className="panel form-panel esl-workspace" aria-label="Executive Strategy Lab audit">
      <div className="panel-title">
        <div>
          <p className="eyebrow">Admin · exact provenance</p>
          <h3>策略实验室审计</h3>
        </div>
        <span className="technical-compatibility">read-only · no write</span>
      </div>
      <form onSubmit={loadAudit} className="esl-form">
        <label>
          候选 ID
          <input
            aria-label="ESL audit candidate ID"
            value={candidateId}
            onChange={(event) => setCandidateId(event.target.value)}
            placeholder="esl_candidate_…"
          />
        </label>
        <button type="submit" disabled={!candidateId.trim()}>
          查询策略实验室审计
        </button>
      </form>
      {error ? (
        <p role="alert" className="lifecycle-error">
          {error}
        </p>
      ) : null}
      {result?.admin_projection ? (
        <div className="esl-result" data-testid="esl-admin-result">
          <h4>候选审计摘要</h4>
          <dl className="esl-binding-list">
            <div>
              <dt>candidate_id</dt>
              <dd>
                <code>{result.admin_projection.audit.candidate_id}</code>
              </dd>
            </div>
            <div>
              <dt>official/non-official</dt>
              <dd>
                {result.admin_projection.officiality_counts.official} /{" "}
                {result.admin_projection.officiality_counts.non_official}
              </dd>
            </div>
            <div>
              <dt>no_write</dt>
              <dd>{String(result.admin_projection.audit.no_write)}</dd>
            </div>
            <div>
              <dt>recovery</dt>
              <dd>{result.admin_projection.audit.recovery}</dd>
            </div>
          </dl>
          <details>
            <summary>查看 exact binding 与 source refs</summary>
            <pre>
              {JSON.stringify(
                {
                  binding: result.admin_projection.exact_binding,
                  source_refs: result.admin_projection.source_refs
                },
                null,
                2
              )}
            </pre>
          </details>
          <details>
            <summary>查看财务模型 provenance</summary>
            <ul>
              {result.admin_projection.finance_models.map((model) => (
                <li key={model.path_id}>
                  <code>{model.path_id}</code> · {model.model.model_version} · input{" "}
                  {model.input_digest}
                  <br />
                  source refs: {model.source_refs.join("、")}
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}
    </section>
  );
}
