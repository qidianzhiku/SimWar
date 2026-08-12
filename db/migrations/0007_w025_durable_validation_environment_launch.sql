CREATE TABLE IF NOT EXISTS w025_validation_environment_launches (
  tenant_id TEXT NOT NULL,
  business_key_digest TEXT NOT NULL,
  launch_id TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  payload JSONB NOT NULL,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, business_key_digest),
  UNIQUE (launch_id)
);

CREATE INDEX IF NOT EXISTS w025_validation_environment_launches_tenant_status_idx
  ON w025_validation_environment_launches (tenant_id, status);

CREATE TABLE IF NOT EXISTS w025_formal_authority_records (
  tenant_id TEXT NOT NULL,
  authority_type TEXT NOT NULL,
  record_kind TEXT NOT NULL,
  record_id TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  content_digest TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL,
  append_sequence BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, authority_type, record_kind, record_id, version, status)
);

CREATE INDEX IF NOT EXISTS w025_formal_authority_lookup_idx
  ON w025_formal_authority_records
    (tenant_id, authority_type, record_kind, record_id, version, append_sequence);
