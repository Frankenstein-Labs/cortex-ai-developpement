-- CORTEX Cloud workspace foundation: projects own workspaces and cloud files.
-- Keep tenant isolation enforced by PostgreSQL RLS and the existing request context.
BEGIN;

CREATE TABLE projects (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug CITEXT NOT NULL,
  description TEXT,
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (organization_id, slug),
  UNIQUE (id, organization_id),
  CHECK (length(trim(name)) > 0),
  CHECK (length(trim(slug::text)) > 0)
);
CREATE INDEX projects_active_org_idx ON projects (organization_id, updated_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE workspaces ADD COLUMN project_id UUID;
ALTER TABLE workspaces
  ADD CONSTRAINT workspaces_project_organization_fk
  FOREIGN KEY (project_id, organization_id)
  REFERENCES projects (id, organization_id) ON DELETE SET NULL;
CREATE INDEX workspaces_project_idx ON workspaces (project_id, last_active_at DESC) WHERE project_id IS NOT NULL;

CREATE TABLE cloud_files (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  path TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (workspace_id, path),
  CHECK (path LIKE '/%'),
  CHECK (length(path) <= 4096)
);
ALTER TABLE cloud_files
  ADD CONSTRAINT cloud_files_workspace_organization_fk
  FOREIGN KEY (workspace_id, organization_id)
  REFERENCES workspaces (id, organization_id) ON DELETE CASCADE;
CREATE INDEX cloud_files_workspace_active_idx ON cloud_files (workspace_id, path) WHERE deleted_at IS NULL;

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
ALTER TABLE cloud_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_files FORCE ROW LEVEL SECURITY;

CREATE POLICY projects_member_read ON projects FOR SELECT
  USING (organization_id = app_current_organization_id() AND app_is_active_member_of_current_organization());
CREATE POLICY projects_member_write ON projects FOR ALL
  USING (organization_id = app_current_organization_id() AND app_is_active_member_of_current_organization())
  WITH CHECK (organization_id = app_current_organization_id() AND app_is_active_member_of_current_organization());

CREATE POLICY cloud_files_member_read ON cloud_files FOR SELECT
  USING (organization_id = app_current_organization_id() AND app_is_active_member_of_current_organization());
CREATE POLICY cloud_files_member_write ON cloud_files FOR ALL
  USING (organization_id = app_current_organization_id() AND app_is_active_member_of_current_organization())
  WITH CHECK (organization_id = app_current_organization_id() AND app_is_active_member_of_current_organization());

COMMIT;
