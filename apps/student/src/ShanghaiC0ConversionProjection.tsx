import { useEffect, useState } from "react";
import type { ApiEnvelope, ShanghaiC0StudentProjection } from "@simwar/shared-contracts";

interface Props {
  apiBase: string;
  receiptId?: string | null;
  tenantId: string;
  token: string;
}

export function ShanghaiC0ConversionProjection({ apiBase, receiptId, tenantId, token }: Props) {
  const [projection, setProjection] = useState<ShanghaiC0StudentProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(path: string, init?: RequestInit): Promise<ShanghaiC0StudentProjection> {
    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-tenant-id": tenantId,
        ...(init?.headers ?? {})
      }
    });
    const envelope = (await response.json()) as ApiEnvelope<ShanghaiC0StudentProjection>;
    if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
    return envelope.data;
  }

  useEffect(() => {
    let active = true;
    if (!receiptId || !token) {
      setProjection(null);
      setError(null);
      return () => {
        active = false;
      };
    }
    void load(`/api/v1/bff/student/shanghai-c0/conversions/${encodeURIComponent(receiptId)}`)
      .then((data) => {
        if (active) setProjection(data);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : "Student C0 projection 加载失败");
      });
    return () => {
      active = false;
    };
  }, [apiBase, receiptId, tenantId, token]);

  async function submitChoice(): Promise<void> {
    if (!receiptId || !choice.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setProjection(
        await load(
          `/api/v1/bff/student/shanghai-c0/conversions/${encodeURIComponent(receiptId)}/choice`,
          {
            method: "POST",
            body: JSON.stringify({ option_id: choice.trim() })
          }
        )
      );
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Student choice 提交失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="summary-panel" aria-label="Shanghai C0 conversion Student projection">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">SH-M13-M18 · C0 · Student</p>
          <h2>上海 C0 角色安全消费</h2>
        </div>
        <strong className="summary-badge">SAFE</strong>
      </div>
      {!receiptId ? (
        <p className="lifecycle-status">需要通过 Teacher 生成的 exact C0 receipt</p>
      ) : null}
      {error ? (
        <p className="summary-error" role="alert">
          {error}
        </p>
      ) : null}
      {projection ? (
        <>
          <p className="evidence-note">
            {projection.receipt.title} · {projection.receipt.consumer_status} ·{" "}
            {projection.receipt.state_a} → {projection.receipt.state_b}
          </p>
          <p className="lifecycle-boundary">{projection.mechanism}</p>
          <label className="field-label">
            学习者候选选项
            <input
              value={choice}
              onChange={(event) => setChoice(event.target.value)}
              placeholder="option-id"
            />
          </label>
          <button
            className="primary"
            disabled={busy || !choice.trim()}
            onClick={() => void submitChoice()}
          >
            {busy ? "提交中…" : "保存非正式草稿选择"}
          </button>
          {projection.choice ? (
            <p className="evidence-note">
              选择：{projection.choice.option_id} · {projection.choice.status}
            </p>
          ) : null}
          <details open>
            <summary>约束与 why-not</summary>
            <ul>
              {[...projection.constraints, ...projection.why_not].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </section>
  );
}

export default ShanghaiC0ConversionProjection;
