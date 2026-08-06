import { useState } from "react";
import type {
  TenantBaselineProvisioningRequest,
  TenantBaselineProvisioningResult
} from "@simwar/shared-contracts";
import { provisionTenantBaseline, tenantBaselineErrorMessage } from "./tenant-baseline-client";

type Props = {
  apiBase: string;
  token: string;
};

type FormState = {
  idempotency_key: string;
  source_parameter_set: {
    content_digest: string;
    parameter_set_id: string;
    source_tenant_id: string;
    version: string;
  };
  source_scenario_package: {
    content_digest: string;
    scenario_package_id: string;
    source_tenant_id: string;
    version: string;
  };
  target_tenant_id: string;
};

const EMPTY_FORM: FormState = {
  idempotency_key: "",
  source_parameter_set: {
    content_digest: "",
    parameter_set_id: "",
    source_tenant_id: "",
    version: ""
  },
  source_scenario_package: {
    content_digest: "",
    scenario_package_id: "",
    source_tenant_id: "",
    version: ""
  },
  target_tenant_id: ""
};

function fieldLabel(prefix: string, field: string): string {
  return `${prefix} ${field.replaceAll("_", " ")}`;
}

export function TenantBaselineWorkbench({ apiBase, token }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [result, setResult] = useState<TenantBaselineProvisioningResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(field: keyof FormState, value: string): void {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateReference(
    reference: "source_parameter_set" | "source_scenario_package",
    field:
      | "content_digest"
      | "parameter_set_id"
      | "scenario_package_id"
      | "source_tenant_id"
      | "version",
    value: string
  ): void {
    setForm((current) => ({
      ...current,
      [reference]: { ...current[reference], [field]: value }
    }));
  }

  async function submit(): Promise<void> {
    setBusy(true);
    setError("");
    setResult(null);
    const request: TenantBaselineProvisioningRequest = {
      idempotency_key: form.idempotency_key,
      source_parameter_set: form.source_parameter_set,
      source_scenario_package: {
        content_digest: form.source_scenario_package.content_digest,
        scenario_package_id: form.source_scenario_package.scenario_package_id,
        source_tenant_id: form.source_scenario_package.source_tenant_id,
        version: form.source_scenario_package.version
      },
      target_tenant_id: form.target_tenant_id
    };
    try {
      setResult(await provisionTenantBaseline(request, token, apiBase));
    } catch (caught) {
      setError(tenantBaselineErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const renderReference = (
    label: string,
    reference: "source_parameter_set" | "source_scenario_package",
    idField: "parameter_set_id" | "scenario_package_id"
  ) => (
    <fieldset className="tenant-baseline-reference">
      <legend>{label}</legend>
      {(["source_tenant_id", idField, "version", "content_digest"] as const).map((field) => (
        <label key={field}>
          {fieldLabel(label, field)}
          <input
            aria-label={fieldLabel(label, field)}
            value={(form[reference] as Record<string, string>)[field] ?? ""}
            onChange={(event) => updateReference(reference, field, event.target.value)}
          />
        </label>
      ))}
    </fieldset>
  );

  return (
    <section className="panel tenant-baseline-workbench" aria-label="tenant baseline provisioning">
      <div className="panel-title">
        <div>
          <p className="eyebrow">W018 Fresh Tenant Launch</p>
          <h2>Tenant baseline provisioning</h2>
        </div>
        <span>JSON_INTERNAL_ONLY</span>
      </div>
      <p className="lifecycle-boundary">
        Uses only approved exact ParameterSet and ScenarioPackage references. The response records
        tenant-local identities and source provenance; it never selects an implicit tenant or
        version.
      </p>
      <div className="tenant-baseline-grid">
        <label>
          Target tenant ID
          <input
            aria-label="target tenant ID"
            value={form.target_tenant_id}
            onChange={(event) => update("target_tenant_id", event.target.value)}
          />
        </label>
        <label>
          Idempotency key
          <input
            aria-label="idempotency key"
            value={form.idempotency_key}
            onChange={(event) => update("idempotency_key", event.target.value)}
          />
        </label>
      </div>
      <div className="tenant-baseline-grid">
        {renderReference("Source ParameterSet", "source_parameter_set", "parameter_set_id")}
        {renderReference(
          "Source ScenarioPackage",
          "source_scenario_package",
          "scenario_package_id"
        )}
      </div>
      <button className="primary" disabled={busy} onClick={() => void submit()}>
        {busy ? "Provisioning..." : "Provision exact tenant baseline"}
      </button>
      {error ? (
        <p className="lifecycle-error" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <article className="tenant-baseline-result" aria-label="tenant baseline result">
          <div className="panel-title">
            <h3>{result.outcome}</h3>
            <span>{result.parameter_set.tenant_id}</span>
          </div>
          <p>
            ParameterSet: {result.parameter_set.reference.parameter_set_id}@
            {result.parameter_set.version}
          </p>
          <p>
            ScenarioPackage: {result.scenario_package.reference.scenario_package_id}@
            {result.scenario_package.version}
          </p>
          <p>Source tenant: {result.provenance.source_parameter_set.tenant_id}</p>
          <p>Provenance digest: {result.provenance.provisioning_request_digest}</p>
          <p>
            Known limits: JSON_INTERNAL_ONLY; PostgreSQL NOT_ACTIVE; durable recovery NOT_PROVEN.
          </p>
        </article>
      ) : null}
    </section>
  );
}
