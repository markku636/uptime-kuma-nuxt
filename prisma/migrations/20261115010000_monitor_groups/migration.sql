-- Monitor groups mirror Bruno collections (top level) and folders (nested).
-- Additive only: existing monitors keep group_id NULL ("Ungrouped") and behave as before.
CREATE TABLE monitor_groups (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id INTEGER,
  name VARCHAR(150) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  source_kind VARCHAR(16) NOT NULL DEFAULT 'manual' CHECK (source_kind IN ('manual','bruno')),
  collection_id VARCHAR(100),
  source_path VARCHAR(256),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT monitor_groups_id_workspace_key UNIQUE (id, workspace_id),
  -- A parent must live in the same workspace; deleting a parent deletes its subtree.
  CONSTRAINT monitor_groups_parent_fkey FOREIGN KEY (parent_id, workspace_id) REFERENCES monitor_groups(id, workspace_id) ON DELETE CASCADE,
  CONSTRAINT monitor_groups_not_own_parent CHECK (parent_id IS NULL OR parent_id <> id),
  CONSTRAINT monitor_groups_source_check CHECK ((source_kind = 'manual' AND collection_id IS NULL AND source_path IS NULL) OR (source_kind = 'bruno' AND collection_id IS NOT NULL AND source_path IS NOT NULL))
);
CREATE INDEX monitor_groups_workspace_parent_idx ON monitor_groups(workspace_id, parent_id, sort_order, id);
CREATE UNIQUE INDEX monitor_groups_bruno_source_key ON monitor_groups(workspace_id, collection_id, source_path) WHERE source_kind = 'bruno';

ALTER TABLE monitors ADD COLUMN group_id INTEGER;
-- Same-workspace FK; deleting a group only clears group_id (PostgreSQL 15+ column list).
ALTER TABLE monitors ADD CONSTRAINT monitors_group_fkey FOREIGN KEY (group_id, workspace_id) REFERENCES monitor_groups(id, workspace_id) ON DELETE SET NULL (group_id);
CREATE INDEX monitors_workspace_group_idx ON monitors(workspace_id, group_id);

-- Bruno blocks that were imported but are never executed (script, tests, post-response vars, settings).
ALTER TABLE bruno_sources ADD COLUMN ignored_blocks TEXT[] NOT NULL DEFAULT '{}';
