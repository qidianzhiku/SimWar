-- Course membership is the durable read-model boundary for learner visibility.
--
-- This migration prepares the inactive Postgres adapter for the same
-- tenant-scoped course membership query used by the current JSON runtime.
-- It does not activate Postgres, add a migration runner, or introduce a
-- write path for runtime course membership changes.

ALTER TABLE courses
  ADD CONSTRAINT courses_tenant_course_key UNIQUE (tenant_id, course_id);

ALTER TABLE users
  ADD CONSTRAINT users_tenant_user_key UNIQUE (tenant_id, user_id);

CREATE TABLE course_memberships (
  tenant_id text NOT NULL,
  course_id text NOT NULL,
  user_id text NOT NULL,
  membership_source text NOT NULL DEFAULT 'team',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, course_id, user_id),
  CONSTRAINT course_memberships_course_fk
    FOREIGN KEY (tenant_id, course_id) REFERENCES courses (tenant_id, course_id),
  CONSTRAINT course_memberships_user_fk
    FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS course_memberships_tenant_user_course_idx
  ON course_memberships (tenant_id, user_id, course_id);
