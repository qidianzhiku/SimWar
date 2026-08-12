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
